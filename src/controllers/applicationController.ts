import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

export const createApplication = async (req: Request, res: Response) => {
  try {
    const application = await prisma.application.create({ data: req.body });
    logger.info('Application created', { applicationId: application.id });
    res.status(201).json(application);
  } catch (error) {
    logger.error('Failed to create application', { error });
    res.status(500).json({ error: 'Failed to create application' });
  }
};

export const getApplications = async (_req: Request, res: Response) => {
  try {
    const applications = await prisma.application.findMany();
    res.status(200).json(applications);
  } catch (error) {
    logger.error('Failed to fetch applications', { error });
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

export const getApplicationById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const application = await prisma.application.findUnique({ where: { id: req.params.id as string } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    res.status(200).json(application);
  } catch (error) {
    logger.error('Failed to fetch application', { error });
    res.status(500).json({ error: 'Failed to fetch application' });
  }
};

export const updateApplication = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const application = await prisma.application.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.status(200).json(application);
  } catch (error) {
    logger.error('Failed to update application', { error });
    res.status(500).json({ error: 'Failed to update application' });
  }
};

export const deleteApplication = async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.application.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete application', { error });
    res.status(500).json({ error: 'Failed to delete application' });
  }
};
