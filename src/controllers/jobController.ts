import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

export const createJob = async (req: Request, res: Response) => {
  try {
    // postedById must come from authenticated user token
    const user = (req as any).user as any;
    const postedById = user?.id as string | undefined;
    const role = user?.role as string | undefined;

    if (!postedById) {
      return res.status(401).json({ error: 'Unauthorized: missing authenticated user' });
    }

    // only ADMIN and HR can create jobs
    if (!role || (role !== 'ADMIN' && role !== 'HR')) {
      logger.warn('Forbidden create job attempt', { userId: postedById, role });
      return res.status(403).json({ error: 'Forbidden: insufficient permissions to create job' });
    }

    // Always derive organizationId from token — users always belong to an organization
    const organizationId = user?.organizationId as string | undefined;

    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    // ensure organization exists
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return res.status(400).json({ error: 'Invalid organization associated with user' });
    }

    const { title, description, location, salary } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const job = await prisma.job.create({
      data: {
        title,
        description,
        location,
        salary,
        postedById,
        organizationId,
      },
    });

    logger.info('Job created', { jobId: job.id, organizationId, postedById });
    res.status(201).json(job);
  } catch (error) {
    logger.error('Failed to create job', { error });
    res.status(500).json({ error: 'Failed to create job' });
  }
};

export const getJobs = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const jobs = await prisma.job.findMany({ where: { organizationId } });
    res.status(200).json(jobs);
  } catch (error) {
    logger.error('Failed to fetch jobs', { error });
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

export const getJobById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const job = await prisma.job.findFirst({ where: { id: req.params.id as string, organizationId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.status(200).json(job);
  } catch (error) {
    logger.error('Failed to fetch job', { error });
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

export const updateJob = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;
    const role = user?.role as string | undefined;
    const userId = user?.id as string | undefined;

    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const job = await prisma.job.findFirst({ where: { id: req.params.id as string, organizationId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Only ADMIN, HR or the original poster can update
    if (!(role === 'ADMIN' || role === 'HR' || job.postedById === userId)) {
      logger.warn('Forbidden job update attempt', { userId, role, jobId: job.id });
      return res.status(403).json({ error: 'Forbidden: insufficient permissions to update job' });
    }

    const updated = await prisma.job.update({ where: { id: job.id }, data: req.body });
    logger.info('Job updated', { jobId: updated.id, updatedBy: userId });
    res.status(200).json(updated);
  } catch (error) {
    logger.error('Failed to update job', { error });
    res.status(500).json({ error: 'Failed to update job' });
  }
};

export const deleteJob = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = (req as any).user as any;
    const organizationId = user?.organizationId as string | undefined;
    const role = user?.role as string | undefined;
    const userId = user?.id as string | undefined;

    if (!organizationId) {
      return res.status(400).json({ error: 'User is not associated with any organization' });
    }

    const job = await prisma.job.findFirst({ where: { id: req.params.id as string, organizationId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Only ADMIN, HR or the original poster can delete
    if (!(role === 'ADMIN' || role === 'HR' || job.postedById === userId)) {
      logger.warn('Forbidden job delete attempt', { userId, role, jobId: job.id });
      return res.status(403).json({ error: 'Forbidden: insufficient permissions to delete job' });
    }

    await prisma.job.delete({ where: { id: job.id } });
    logger.info('Job deleted', { jobId: job.id, deletedBy: userId });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete job', { error });
    res.status(500).json({ error: 'Failed to delete job' });
  }
};
