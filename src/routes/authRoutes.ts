import express from 'express';
import { login, register, verifyEmail, requestPasswordReset, resetPassword } from '../controllers/authController';
import { authLimiter } from '../middleware/security';

const router = express.Router();

// Apply auth rate limiter to auth mutation routes
router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/forgot-password', authLimiter, requestPasswordReset);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
