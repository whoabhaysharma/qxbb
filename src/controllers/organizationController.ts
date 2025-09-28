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

export const getOrganizations = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user as any;
    if (!actor || !actor.organizationId) {
      logger.warn('getOrganizations: missing organizationId on token', { actor });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const organization = await prisma.organization.findUnique({ where: { id: actor.organizationId } });
    if (!organization) {
      logger.warn('Organization not found for actor', { organizationId: actor.organizationId });
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.status(200).json(organization);
  } catch (error) {
    logger.error('Failed to fetch organization for actor', { error });
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
};

export const getOrganizationById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const actor = (req as any).user as any;
    const requestedOrgId = req.params.id as string;

    // allow if actor is ADMIN or belongs to requested organization
    if (!(actor?.role === 'ADMIN' || actor?.organizationId === requestedOrgId)) {
      logger.warn('Unauthorized organization access', { actorId: actor?.id, requestedOrgId });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const organization = await prisma.organization.findUnique({ where: { id: requestedOrgId } });
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    res.status(200).json(organization);
  } catch (error) {
    logger.error('Failed to fetch organization by id', { error });
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
};

export const updateOrganization = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const actor = (req as any).user as any;
    const orgId = req.params.id as string;

    // only ADMINs may update their own organization
    if (actor?.role !== 'ADMIN' || actor?.organizationId !== orgId) {
      logger.warn('Unauthorized organization update attempt', { actorId: actor?.id, orgId });
      return res.status(403).json({ error: 'Forbidden: only organization ADMIN can update' });
    }

    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: req.body,
    });
    res.status(200).json(organization);
  } catch (error) {
    logger.error('Failed to update organization', { error });
    res.status(500).json({ error: 'Failed to update organization' });
  }
};

export const deleteOrganization = async (req: Request<{ id: string }>, res: Response) => {
  // Deletion is not allowed via API. Organizations are created at signup and cannot be deleted by users.
  logger.warn('Attempt to delete organization blocked', { requestedOrgId: req.params.id, actor: (req as any).user });
  return res.status(403).json({ error: 'Forbidden: organization deletion is not allowed' });
};
