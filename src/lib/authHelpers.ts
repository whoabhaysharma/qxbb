import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sign } from 'jsonwebtoken';
import redisClient from './redis';
import logger from './logger';

// Configuration
const REGISTRATION_OTP_TTL_S = parseInt(process.env.REGISTRATION_OTP_TTL_S || '600', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

export type RegistrationSession = {
  name: string;
  email: string;
  passwordHash: string;
  otp: string;
  attempts: number;
  lastSent: number; // ms since epoch
};

export const generateOTP = (): string => crypto.randomInt(100000, 1000000).toString();
export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const redisKeyFor = (email: string) => `registration:${email}`;

export const readSession = async (key: string): Promise<RegistrationSession | null> => {
  const raw = await redisClient.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RegistrationSession;
  } catch (err) {
    logger.warn('Invalid registration session JSON, clearing', { key, err });
    await redisClient.del(key);
    return null;
  }
};

export const saveSession = async (key: string, session: RegistrationSession) => {
  await redisClient.setEx(key, REGISTRATION_OTP_TTL_S, JSON.stringify(session));
};

export const deleteSession = async (key: string) => {
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.warn('Failed to delete registration session', { key, err });
  }
};

export const signToken = (payload: unknown) => sign(payload as any, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
