import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

export const createApplication = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;

    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const { jobId, fullName, email, resumeUrl } = req.body;
    if (!jobId || !fullName || !email) {
      return res.status(400).json({ error: 'jobId, fullName and email are required' });
    }

    // ensure job exists and belongs to the same organization
    const job = await prisma.job.findFirst({ where: { id: jobId, organizationId } });
    if (!job) return res.status(400).json({ error: 'Invalid job for your organization' });

    const application = await prisma.application.create({
      data: {
        jobId,
        fullName,
        email,
        resumeUrl,
        organizationId,
      },
    });
    logger.info('Application created', { applicationId: application.id, organizationId });
    res.status(201).json(application);
  } catch (error) {
    logger.error('Failed to create application', { error });
    res.status(500).json({ error: 'Failed to create application' });
  }
};

export const getApplications = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const applications = await prisma.application.findMany({ where: { organizationId } });
    res.status(200).json(applications);
  } catch (error) {
    logger.error('Failed to fetch applications', { error });
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

export const getApplicationById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const application = await prisma.application.findFirst({ where: { id: req.params.id as string, organizationId } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    res.status(200).json(application);
  } catch (error) {
    logger.error('Failed to fetch application', { error });
    res.status(500).json({ error: 'Failed to fetch application' });
  }
};

export const updateApplication = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;
    const role = user?.role as string | undefined;

    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const application = await prisma.application.findFirst({ where: { id: req.params.id as string, organizationId } });
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Only ADMIN or HR can update application status/details
    if (!(role === 'ADMIN' || role === 'HR')) {
      logger.warn('Forbidden application update attempt', { userId: user?.id, role, applicationId: application.id });
      return res.status(403).json({ error: 'Forbidden: insufficient permissions to update application' });
    }

    const updated = await prisma.application.update({ where: { id: application.id }, data: req.body });
    logger.info('Application updated', { applicationId: updated.id, updatedBy: user?.id });
    res.status(200).json(updated);
  } catch (error) {
    logger.error('Failed to update application', { error });
    res.status(500).json({ error: 'Failed to update application' });
  }
};

export const deleteApplication = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;
    const role = user?.role as string | undefined;

    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const application = await prisma.application.findFirst({ where: { id: req.params.id as string, organizationId } });
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Only ADMIN or HR can delete
    if (!(role === 'ADMIN' || role === 'HR')) {
      logger.warn('Forbidden application delete attempt', { userId: user?.id, role, applicationId: application.id });
      return res.status(403).json({ error: 'Forbidden: insufficient permissions to delete application' });
    }

    await prisma.application.delete({ where: { id: application.id } });
    logger.info('Application deleted', { applicationId: application.id, deletedBy: user?.id });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete application', { error });
    res.status(500).json({ error: 'Failed to delete application' });
  }
};
