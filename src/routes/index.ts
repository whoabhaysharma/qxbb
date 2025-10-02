import express from 'express';
import userRoutes from './userRoutes';
import jobRoutes from './jobRoutes';
import organizationRoutes from './organizationRoutes';
import applicationRoutes from './applicationRoutes';
import authRoutes from './authRoutes';

const router = express.Router();

// Root route - API information or health check
router.get('/', (_, res) => {
  res.status(200).json({
    status: 'success',
    message: 'QuixHR API is running',
    version: '1.0.0',
  });
});

// API routes
router.use('/api/users', userRoutes);
router.use('/api/jobs', jobRoutes);
router.use('/api/organizations', organizationRoutes);
router.use('/api/applications', applicationRoutes);
router.use('/api/auth', authRoutes);

export default router;
