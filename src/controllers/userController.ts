import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import bcrypt from 'bcrypt';
import { AuthUser } from '../types/auth';

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

export const getUsers = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user as any;
    if (!actor?.organizationId) {
      logger.warn('getUsers: missing organizationId on token', { actorId: actor?.id });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const users = await prisma.user.findMany({ where: { organizationId: actor.organizationId } });
    res.status(200).json(users);
  } catch (error) {
    logger.error('Failed to fetch users', { error });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getUserById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const actor = (req as any).user as any;
    if (!actor?.organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.organizationId !== actor.organizationId) {
      logger.warn('getUserById: cross-organization access denied', { actorId: actor?.id, targetUserId: user.id });
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.status(200).json(user);
  } catch (error) {
    logger.error('Failed to fetch user', { error });
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const updateUser = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const actor = (req as any).user as any;
    if (!actor?.organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.organizationId !== actor.organizationId) {
      logger.warn('updateUser: cross-organization update denied', { actorId: actor?.id, targetUserId: existing.id });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // prevent moving users between organizations via this endpoint
    if (req.body.organizationId && req.body.organizationId !== existing.organizationId) {
      return res.status(400).json({ error: 'Cannot change organizationId' });
    }

    const user = await prisma.user.update({ where: { id: existing.id }, data: req.body });
    res.status(200).json(user);
  } catch (error) {
    logger.error('Failed to update user', { error });
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const actor = (req as any).user as any;
    if (!actor?.organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.organizationId !== actor.organizationId) {
      logger.warn('deleteUser: cross-organization delete denied', { actorId: actor?.id, targetUserId: existing.id });
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.user.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete user', { error });
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export const getSelf = async (req: Request, res: Response) => {
  try {
    // User is already authenticated via middleware, so req.user exists
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
          }
        }
      }
    });

    if (!user) {
      logger.error('Authenticated user not found in database', { userId: req.user?.id });
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    logger.error('Error fetching user profile', { error: err instanceof Error ? err.stack : err });
    return res.status(500).json({ error: 'Internal server error' });
  }
};
