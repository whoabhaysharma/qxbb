import { Request, Response } from 'express';
import { decode, JwtPayload } from 'jsonwebtoken';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { sendVerificationEmail } from '../lib/email';
import {
  generateOTP,
  hashPassword,
  redisKeyFor,
  readSession,
  saveSession,
  deleteSession,
  signToken,
} from '../lib/authHelpers';
import bcrypt from 'bcrypt';

// load resend settings from env (kept local to controller)
const OTP_RESEND_COOLDOWN_S = parseInt(process.env.OTP_RESEND_COOLDOWN_S || '60', 10); // 60s
const OTP_MAX_RESENDS = parseInt(process.env.OTP_MAX_RESENDS || '3', 10);

// Controllers
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

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

    logger.info('User logged in', { userId: user.id, email: user.email });
    res.status(200).json({ token, expiresAt });
  } catch (err) {
    logger.error('Login error', { error: err instanceof Error ? err.stack : err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });

  const key = redisKeyFor(email);

  try {
    // If user exists in DB, clear any stale session and return conflict
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await deleteSession(key);
      return res.status(409).json({ error: 'Email already in use' });
    }

    const session = await readSession(key);
    const newPasswordHash = await hashPassword(password);

    if (session) {
      // enforce cooldown and max resends
      if (session.attempts >= OTP_MAX_RESENDS) {
        logger.warn('OTP resend limit reached', { email, attempts: session.attempts });
        return res.status(429).json({ error: 'Too many OTP requests. Please contact support or try again later.' });
      }

      const secondsSinceLast = Math.floor((Date.now() - session.lastSent) / 1000);
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_S) {
        const wait = OTP_RESEND_COOLDOWN_S - secondsSinceLast;
        return res.status(429).json({ error: `Please wait ${wait} seconds before requesting a new code.` });
      }

      // Update session with new OTP and latest password hash
      session.otp = generateOTP();
      session.attempts = session.attempts + 1;
      session.lastSent = Date.now();
      session.passwordHash = newPasswordHash;

      await saveSession(key, session);
      await sendVerificationEmail(email, session.otp);

      logger.info('OTP resent', { email, attempts: session.attempts });
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
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  const key = redisKeyFor(email);

  try {
    const session = await readSession(key);
    if (!session) return res.status(400).json({ error: 'Registration session expired or invalid' });

    const providedOtp = String(otp).trim();
    if (session.otp !== providedOtp) return res.status(400).json({ error: 'Invalid OTP' });

    // Double-check user does not already exist
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      await deleteSession(key);
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Create organization + user in a transaction, handle unique-constraint race
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
        return user;
      });

      await deleteSession(key);

      const { password: _p, ...safeUser } = created as any;
      return res.status(201).json({ message: 'Registration completed successfully', user: safeUser });
    } catch (err: any) {
      // Prisma unique constraint error code (P2002)
      if (err && err.code === 'P2002') {
        logger.warn('Race: email already created during verification', { email, err });
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