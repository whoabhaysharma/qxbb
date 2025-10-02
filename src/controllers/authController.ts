import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import logger from '../lib/logger';
import redisClient from '../lib/redis';
import { sendVerificationEmail } from '../lib/email';

const secretKey = process.env.JWT_SECRET || 'default_secret_key';
const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

// Function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // include user information in token payload under `user` to avoid any claim filtering
    const userClaim = {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
    } as any;

    const token = (jwt as any).sign({ user: userClaim }, secretKey, { expiresIn });

    // decode token to read expiry (exp is in seconds since epoch)
    const decoded = jwt.decode(token) as JwtPayload | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

    logger.debug('Signing token', { userId: user.id, expiresAt });
    logger.info('User logged in', { userId: user.id, email: user.email });

    res.status(200).json({ token, expiresAt });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store registration data and OTP in Redis with 10 minutes expiry
    const registrationData = {
      name,
      email,
      password,
      otp,
    };
    
    await redisClient.setEx(
      `registration:${email}`, 
      600, // 10 minutes
      JSON.stringify(registrationData)
    );

    // Send OTP via email
    await sendVerificationEmail(email, otp);

    res.status(200).json({ 
      message: 'Registration initiated. Please check your email for verification code.',
      email 
    });

  } catch (error) {
    logger.error('Registration Error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    // Get registration data from Redis
    const registrationDataStr = await redisClient.get(`registration:${email}`);
    
    if (!registrationDataStr) {
      return res.status(400).json({ error: 'Registration session expired or invalid' });
    }

    const registrationData = JSON.parse(registrationDataStr);

    if (registrationData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const hashedPassword = await bcrypt.hash(registrationData.password, 10);

    // Create user and organization in transaction
    const newUser = await prisma.$transaction(async (prisma) => {
      const organization = await prisma.organization.create({
        data: {
          name: `${registrationData.name}'s Organization`,
        },
      });

      const user = await prisma.user.create({
        data: {
          name: registrationData.name,
          email: registrationData.email,
          password: hashedPassword,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });

      return user;
    });

    // Delete registration data from Redis
    await redisClient.del(`registration:${email}`);

    // Omit the password from the user object for security
    const { password: _p, ...safeUser } = newUser;

    res.status(201).json({ 
      message: 'Registration completed successfully',
      user: safeUser 
    });

  } catch (error) {
    logger.error('Verification Error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};