import express from 'express';
import { createOrganization, getOrganizations, getOrganizationById, updateOrganization, deleteOrganization } from '../controllers/organizationController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateJWT);

router.post('/', createOrganization);
router.get('/', getOrganizations);
router.get('/:id', getOrganizationById);
router.put('/:id', updateOrganization);
router.delete('/:id', deleteOrganization);

export default router;
