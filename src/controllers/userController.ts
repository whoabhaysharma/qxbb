import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import bcrypt from 'bcrypt';

export const createUser = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user as any;

    // derive organization from authenticated user if not provided in body
    const organizationId = actor?.organizationId || req.body.organizationId;
    if (!organizationId) {
      logger.warn('Create user failed: missing organizationId', { actorId: actor?.id });
      return res.status(400).json({ error: 'organizationId is required' });
    }

    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'EMPLOYEE',
        organizationId,
      },
    });

    // remove password from response
    const { password: _p, ...safeUser } = user as any;
    logger.info('User created', { userId: user.id, createdBy: actor?.id });
    res.status(201).json(safeUser);
  } catch (error) {
    // Prisma unique constraint for email
    if ((error as any)?.code === 'P2002') {
      logger.warn('Create user conflict: email already in use', { error });
      return res.status(409).json({ error: 'Email already in use' });
    }
    logger.error('Failed to create user', { error });
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
  } catch (error) {
    logger.error('Failed to fetch users', { error });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getUserById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    logger.error('Failed to fetch user', { error });
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const updateUser = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.status(200).json(user);
  } catch (error) {
    logger.error('Failed to update user', { error });
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete user', { error });
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
