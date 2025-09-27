import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const createJob = async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.create({ data: req.body });
    res.status(201).json(job);
  } catch (error) {
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

export const getJobById = async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: Number(req.params.id) } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update job' });
  }
};

export const deleteJob = async (req: Request, res: Response) => {
  try {
    await prisma.job.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete job' });
  }
};
