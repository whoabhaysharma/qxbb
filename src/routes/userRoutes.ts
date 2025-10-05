import express from 'express';
import { createUser, getUsers, getUserById, updateUser, deleteUser, getSelf } from '../controllers/userController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateJWT);

// Self route should come before /:id to prevent id param matching
router.get('/me', getSelf);

router.post('/', createUser);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
