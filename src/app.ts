import express, { Express, Request, Response, NextFunction } from 'express';
import indexRouter from '@/routes/index';
import userRoutes from './routes/userRoutes';
import jobRoutes from './routes/jobRoutes';
import organizationRoutes from './routes/organizationRoutes';
import applicationRoutes from './routes/applicationRoutes';
import authRoutes from './routes/authRoutes';

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// JSON parse error handler
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

// Routes
app.use('/', indexRouter);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/auth', authRoutes);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});