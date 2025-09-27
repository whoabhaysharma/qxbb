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

    // include organizationId in token payload so non-admins can have org derived from token
    const tokenPayload = { id: user.id, role: user.role, organizationId: user.organizationId };

    // Use any-cast to avoid typing issues with different TS interop settings
    const token = (jwt as any).sign(tokenPayload, secretKey, { expiresIn });

    // decode token to read expiry (exp is in seconds since epoch)
    const decoded = jwt.decode(token) as JwtPayload | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

    res.status(200).json({ token, expiresAt });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (prisma) => {
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

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
