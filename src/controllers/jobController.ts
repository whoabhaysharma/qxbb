import { Request, Response } from 'express';
import prisma from '../lib/prisma';

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

    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create job' });
  }
};

export const getJobs = async (_req: Request, res: Response) => {
  try {
    const jobs = await prisma.job.findMany();
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

export const getJobById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id as string } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

export const updateJob = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update job' });
  }
};

export const deleteJob = async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.job.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete job' });
  }
};
