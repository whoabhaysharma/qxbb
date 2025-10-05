import { Request, Response } from 'express';
import { decode, JwtPayload } from 'jsonwebtoken';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email';
import {
  generateOTP,
  hashPassword,
  redisKeyFor,
  readSession,
  saveSession,
  deleteSession,
  signToken,
  RegistrationSession,
  PasswordResetSession,
} from '../lib/authHelpers';
import bcrypt from 'bcrypt';

// load resend settings from env (kept local to controller)
const OTP_RESEND_COOLDOWN_S = parseInt(process.env.OTP_RESEND_COOLDOWN_S || '60', 10); // 60s
const OTP_MAX_RESENDS = parseInt(process.env.OTP_MAX_RESENDS || '3', 10);
const RESET_KEY_PREFIX = 'reset:'; // prefix for reset sessions to distinguish from registration

// Helper to generate reset-specific Redis key
const resetKeyFor = (email: string) => `${RESET_KEY_PREFIX}${email}`;

// Controllers
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  logger.debug('Login request received', { email });
  if (!email || !password) {
    logger.warn('Login request missing email or password', { email });
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    logger.debug('User fetched for login', { email, userExists: !!user });
    if (!user) {
      logger.warn('Invalid login attempt: user not found', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password);
    logger.debug('Password comparison result', { email, result: ok });
    if (!ok) {
      logger.warn('Invalid login attempt: incorrect password', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userClaim = {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
    };

    const token = signToken({ user: userClaim });
    const decoded = decode(token) as JwtPayload | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

    logger.info('User logged in successfully', { userId: user.id, email: user.email });
    res.status(200).json({ token, expiresAt });
  } catch (err) {
    logger.error('Login error', { error: err instanceof Error ? err.stack : err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  logger.debug('Registration request received', { email });
  if (!name || !email || !password) {
    logger.warn('Registration request missing required fields', { email });
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  const key = redisKeyFor(email);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    logger.debug('Checked for existing user during registration', { email, userExists: !!existing });
    if (existing) {
      await deleteSession(key);
      logger.warn('Registration attempt with already used email', { email });
      return res.status(409).json({ error: 'Email already in use' });
    }

    const session = await readSession<RegistrationSession>(key);
    logger.debug('Read registration session', { email, sessionExists: !!session });
    const newPasswordHash = await hashPassword(password);

    if (session) {
      // enforce cooldown and max resends
      if (session.attempts >= OTP_MAX_RESENDS) {
        logger.warn('OTP resend limit reached during registration', { email, attempts: session.attempts });
        return res.status(429).json({ error: 'Too many OTP requests. Please contact support or try again later.' });
      }

      const secondsSinceLast = Math.floor((Date.now() - session.lastSent) / 1000);
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_S) {
        const wait = OTP_RESEND_COOLDOWN_S - secondsSinceLast;
        logger.warn('OTP resend cooldown active', { email, wait });
        return res.status(429).json({ error: `Please wait ${wait} seconds before requesting a new code.` });
      }

      // Update session with new OTP and latest password hash
      const updatedSession: RegistrationSession = {
        ...session,
        otp: generateOTP(),
        attempts: session.attempts + 1,
        lastSent: Date.now(),
        passwordHash: newPasswordHash,
      };

      await saveSession(key, session);
      await sendVerificationEmail(email, session.otp);

      logger.info('OTP resent during registration', { email, attempts: session.attempts });
      return res.status(200).json({ message: 'Verification code resent. Please check your email.' });
    }

    // No existing session – create one
    const newSession = {
      name,
      email,
      passwordHash: newPasswordHash,
      otp: generateOTP(),
      attempts: 1,
      lastSent: Date.now(),
    };

    await saveSession(key, newSession);
    await sendVerificationEmail(email, newSession.otp);

    logger.info('Registration initiated', { email });
    return res.status(200).json({ message: 'Registration initiated. Please check your email for verification code.', email });
  } catch (err) {
    logger.error('Registration Error', { error: err instanceof Error ? err.stack : err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  logger.debug('Verify email request received', { email });
  if (!email || !otp) {
    logger.warn('Verify email request missing email or OTP', { email });
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const key = redisKeyFor(email);

  try {
    const session = await readSession<RegistrationSession>(key);
    logger.debug('Read registration session for verification', { email, sessionExists: !!session });
    if (!session) {
      logger.warn('Verification session expired or invalid', { email });
      return res.status(400).json({ error: 'Registration session expired or invalid' });
    }

    const providedOtp = String(otp).trim();
    logger.debug('Comparing provided OTP with session OTP', { email, providedOtp });
    if (session.otp !== providedOtp) {
      logger.warn('Invalid OTP provided during verification', { email });
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    logger.debug('Checked if user already exists during verification', { email, userExists: !!exists });
    if (exists) {
      await deleteSession(key);
      logger.warn('Email already in use during verification', { email });
      return res.status(409).json({ error: 'Email already in use' });
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({ data: { name: `${session.name}'s Organization` } });
        const user = await tx.user.create({
          data: {
            name: session.name,
            email: session.email,
            password: session.passwordHash,
            role: 'ADMIN',
            organizationId: organization.id,
          },
        });
        logger.info('User and organization created successfully', { email, organizationId: organization.id, userId: user.id });
        return user;
      });

      await deleteSession(key);
      logger.info('Verification session deleted after successful registration', { email });

      const { password: _p, ...safeUser } = created as any;
      return res.status(201).json({ message: 'Registration completed successfully', user: safeUser });
    } catch (err: any) {
      if (err && err.code === 'P2002') {
        logger.warn('Unique constraint violation during verification', { email, error: err });
        await deleteSession(key);
        return res.status(409).json({ error: 'Email already in use' });
      }
      throw err;
    }
  } catch (err) {
    logger.error('Verification Error', { error: err instanceof Error ? err.stack : err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  logger.debug('Password reset request received', { email });
  if (!email) {
    logger.warn('Password reset request missing email');
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    logger.debug('Checked if user exists for password reset', { email, userExists: !!user });
    if (!user) {
      logger.info('Password reset requested for non-existent email', { email });
      return res.status(200).json({ message: 'If your email exists in our system, you will receive reset instructions.' });
    }

    const key = resetKeyFor(email);
    const session = await readSession<PasswordResetSession>(key);
    logger.debug('Read password reset session', { email, sessionExists: !!session });

    if (session) {
      if (session.attempts >= OTP_MAX_RESENDS) {
        logger.warn('Password reset OTP limit reached', { email, attempts: session.attempts });
        return res.status(429).json({ error: 'Too many reset attempts. Please try again later.' });
      }

      const secondsSinceLast = Math.floor((Date.now() - session.lastSent) / 1000);
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_S) {
        const wait = OTP_RESEND_COOLDOWN_S - secondsSinceLast;
        logger.warn('Password reset OTP resend cooldown active', { email, wait });
        return res.status(429).json({ error: `Please wait ${wait} seconds before requesting a new code.` });
      }

      const updatedSession: PasswordResetSession = {
        ...session,
        otp: generateOTP(),
        attempts: session.attempts + 1,
        lastSent: Date.now(),
      };

      await saveSession(key, updatedSession, true);
      await sendPasswordResetEmail(email, updatedSession.otp);
      logger.info('Password reset OTP resent', { email, attempts: updatedSession.attempts });
    } else {
      const newSession: PasswordResetSession = {
        email,
        otp: generateOTP(),
        attempts: 1,
        lastSent: Date.now(),
      };
      await saveSession(key, newSession, true);
      await sendPasswordResetEmail(email, newSession.otp);
      logger.info('New password reset session created', { email });
    }

    logger.info('Password reset instructions sent', { email });
    return res.status(200).json({
      message: 'If your email exists in our system, you will receive reset instructions.',
    });
  } catch (err) {
    logger.error('Password Reset Request Error', { error: err instanceof Error ? err.stack : err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  logger.debug('Reset password request received', { email });
  if (!email || !otp || !newPassword) {
    logger.warn('Reset password request missing required fields', { email });
    return res.status(400).json({ error: 'Email, OTP, and new password are required' });
  }

  const key = resetKeyFor(email);

  try {
    const session = await readSession(key);
    logger.debug('Read reset session for password reset', { email, sessionExists: !!session });
    if (!session) {
      logger.warn('Reset session expired or invalid', { email });
      return res.status(400).json({ error: 'Reset session expired or invalid' });
    }

    const providedOtp = String(otp).trim();
    logger.debug('Comparing provided OTP with session OTP for password reset', { email, providedOtp });
    if (session.otp !== providedOtp) {
      logger.warn('Invalid OTP provided for password reset', { email });
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email },
      data: { password: passwordHash },
    });
    logger.info('User password updated successfully', { email });

    await deleteSession(key);
    logger.info('Reset session deleted after successful password reset', { email });

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    logger.error('Password Reset Error', { error: err instanceof Error ? err.stack : err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSelf = async (req: Request, res: Response) => {
  logger.debug('Get self request received', { userId: req.user?.id });
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.debug('Fetched user profile', { userId: req.user?.id, userExists: !!user });
    if (!user) {
      logger.error('Authenticated user not found in database', { userId: req.user?.id });
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User profile fetched successfully', { userId: req.user?.id });
    return res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (err) {
    logger.error('Error fetching user profile', { error: err instanceof Error ? err.stack : err });
    return res.status(500).json({ error: 'Internal server error' });
  }
};