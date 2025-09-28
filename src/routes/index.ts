import express, { Request, Response } from 'express';
import prisma from '@/lib/prisma';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  res.send('Hello from the router!');
});

router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (err) {
    const logger = (await import('../lib/logger')).default;
    logger.error('Error fetching users', { error: err });
    res.status(500).send('Error fetching users');
  }
});

export default router;
