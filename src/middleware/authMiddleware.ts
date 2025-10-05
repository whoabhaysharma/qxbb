import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../lib/logger';
import { AuthUser } from '../types/auth';

const secretKey = process.env.JWT_SECRET || 'default_secret_key';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, secretKey);
    if (typeof decoded === 'string') {
      throw new Error('Invalid token payload');
    }

    // Verify the token payload has the required user fields
    const { user } = decoded as { user: AuthUser };
    if (!user || !user.id || !user.role || !user.organizationId) {
      throw new Error('Invalid token payload structure');
    }

    req.user = user;
    next();
  } catch (err) {
    logger.warn('JWT Authentication failed', { error: err instanceof Error ? err.message : 'Unknown error' });
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
