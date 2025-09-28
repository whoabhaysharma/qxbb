import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import logger from '../lib/logger';

declare global {
  namespace Express {
    interface Request {
      user?: string | JwtPayload;
    }
  }
}

const secretKey = process.env.JWT_SECRET || 'default_secret_key';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, secretKey) as jwt.JwtPayload | string;
    // token was signed with payload: { user: { ... } }
    // normalize so handlers always see `req.user` as the user claim
    const claim = typeof decoded === 'object' && decoded && (decoded as any).user ? (decoded as any).user : decoded;
    req.user = claim; // Attach decoded token payload (user claim) to the request object
    next();
  } catch (error) {
    logger.warn('Token verification failed', { error });
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
};
