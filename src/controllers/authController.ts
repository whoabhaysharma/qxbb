import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';

const secretKey = process.env.JWT_SECRET || 'default_secret_key';
const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

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

    // debug log to verify payload (remove in production)

    const token = (jwt as any).sign({ user: userClaim }, secretKey, { expiresIn });

    // decode token to read expiry (exp is in seconds since epoch)
    const decoded = jwt.decode(token) as JwtPayload | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

    console.debug('Signing token with payload.user =', token, expiresAt);

    res.status(200).json({ token, expiresAt });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.$transaction(async (prisma) => {
      const organization = await prisma.organization.create({
        data: {
          name: `${name}'s Organization`,
        },
      });

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });

      return user;
    });

    // --- FIX STARTS HERE ---
    // Omit the password from the user object for security
    const { password: _p, ...safeUser } = newUser;

    // Do not generate or return a token on registration per standard practice.
    // Return only the created user (without the password).
    res.status(201).json({ user: safeUser });

    // --- FIX ENDS HERE ---

  } catch (error: any) {
    // This part is good, it correctly handles duplicate emails
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error('Registration Error:', error); // Use console.error for errors
    res.status(500).json({ error: 'Internal server error' });
  }
};