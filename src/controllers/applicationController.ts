import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const createApplication = async (req: Request, res: Response) => {
  try {
    const application = await prisma.application.create({ data: req.body });
    res.status(201).json(application);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create application' });
  }
};

export const getApplications = async (_req: Request, res: Response) => {
  try {
    const applications = await prisma.application.findMany();
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

export const getApplicationById = async (req: Request, res: Response) => {
  try {
    const application = await prisma.application.findUnique({ where: { id: Number(req.params.id) } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch application' });
  }
};

export const updateApplication = async (req: Request, res: Response) => {
  try {
    const application = await prisma.application.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update application' });
  }
};

export const deleteApplication = async (req: Request, res: Response) => {
  try {
    await prisma.application.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete application' });
  }
};
