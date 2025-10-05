import express from 'express';
import { login, register, verifyEmail, requestPasswordReset, resetPassword } from '../controllers/authController';
import { authLimiter } from '../middleware/security';

const router = express.Router();

// Apply auth rate limiter to all auth routes
router.use(authLimiter);

router.post('/login', login);
router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);

export default router;
