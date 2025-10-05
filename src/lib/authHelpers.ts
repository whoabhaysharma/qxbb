import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sign } from 'jsonwebtoken';
import redisClient from './redis';
import logger from './logger';

// Configuration
const REGISTRATION_OTP_TTL_S = parseInt(process.env.REGISTRATION_OTP_TTL_S || '600', 10);
const PASSWORD_RESET_OTP_TTL_S = parseInt(process.env.PASSWORD_RESET_OTP_TTL_S || '600', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

export type BaseSession = {
  otp: string;
  attempts: number;
  lastSent: number; // ms since epoch
};

export type RegistrationSession = BaseSession & {
  name: string;
  email: string;
  passwordHash: string;
};

export type PasswordResetSession = BaseSession & {
  email: string;
};

export const generateOTP = (): string => crypto.randomInt(100000, 1000000).toString();
export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const redisKeyFor = (email: string) => `registration:${email}`;

export const readSession = async <T extends BaseSession>(key: string): Promise<T | null> => {
  const raw = await redisClient.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error('Error parsing session', { key, error: err });
    return null;
  }
};

export const saveSession = async <T extends BaseSession>(key: string, session: T, isReset: boolean = false) => {
  const ttl = isReset ? PASSWORD_RESET_OTP_TTL_S : REGISTRATION_OTP_TTL_S;
  await redisClient.setEx(key, ttl, JSON.stringify(session));
};

export const deleteSession = async (key: string) => {
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.warn('Failed to delete registration session', { key, err });
  }
};

export const signToken = (payload: unknown) => sign(payload as any, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
