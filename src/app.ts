import express, { Express, Request, Response } from 'express';
import indexRouter from '@/routes/index';
import userRoutes from './routes/userRoutes';
import jobRoutes from './routes/jobRoutes';
import organizationRoutes from './routes/organizationRoutes';
import applicationRoutes from './routes/applicationRoutes';

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Routes
app.use('/', indexRouter);
app.use('/users', userRoutes);
app.use('/jobs', jobRoutes);
app.use('/organizations', organizationRoutes);
app.use('/applications', applicationRoutes);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

