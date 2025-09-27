import express from 'express';
import { createOrganization, getOrganizations, getOrganizationById, updateOrganization, deleteOrganization } from '../controllers/organizationController';

const router = express.Router();

router.post('/', createOrganization);
router.get('/', getOrganizations);
router.get('/:id', getOrganizationById);
router.put('/:id', updateOrganization);
router.delete('/:id', deleteOrganization);

export default router;
