import express from 'express';
import { login, register, verifyEmail } from '../controllers/authController';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/verify-email', verifyEmail);

export default router;
