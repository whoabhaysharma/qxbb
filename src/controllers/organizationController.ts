import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

export const createOrganization = async (req: Request, res: Response) => {
  try {
    const organization = await prisma.organization.create({ data: req.body });
    logger.info('Organization created', { organizationId: organization.id });
    res.status(201).json(organization);
  } catch (error) {
    logger.error('Failed to create organization', { error });
    res.status(500).json({ error: 'Failed to create organization' });
  }
};

export const getOrganizations = async (_req: Request, res: Response) => {
  try {
    const organizations = await prisma.organization.findMany();
    res.status(200).json(organizations);
  } catch (error) {
    logger.error('Failed to fetch organizations', { error });
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
};

export const getOrganizationById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: req.params.id as string } });
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    res.status(200).json(organization);
  } catch (error) {
    logger.error('Failed to fetch organization', { error });
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
};

export const updateOrganization = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const organization = await prisma.organization.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.status(200).json(organization);
  } catch (error) {
    logger.error('Failed to update organization', { error });
    res.status(500).json({ error: 'Failed to update organization' });
  }
};

export const deleteOrganization = async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.organization.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete organization', { error });
    res.status(500).json({ error: 'Failed to delete organization' });
  }
};
