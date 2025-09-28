import express from 'express';
import { getOrganizations, getOrganizationById, updateOrganization } from '../controllers/organizationController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateJWT);

// Remove public create and delete routes. Organization is created at user signup.
router.post('/', (req, res) => res.status(403).json({ error: 'Forbidden: organization creation not allowed via this endpoint' }));
router.delete('/:id', (req, res) => res.status(403).json({ error: 'Forbidden: organization deletion not allowed' }));

router.get('/', getOrganizations);
router.get('/:id', getOrganizationById);
router.put('/:id', updateOrganization);

export default router;
