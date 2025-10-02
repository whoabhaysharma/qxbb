import express, { Express, Request, Response, NextFunction } from 'express';
import router from './routes/index';
import logger from './lib/logger';
import { securityMiddleware } from './middleware/security';
import { connectPrisma } from './lib/prisma';

const app: Express = express();
const port = process.env.PORT || 3000;

// Apply security middleware
app.use(securityMiddleware);

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
app.use('/', router);

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', { error: err instanceof Error ? err.stack : err });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server after connecting to DB
connectPrisma()
  .then(() => {
    app.listen(port, () => {
      logger.info(`Server is running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to start server', { error: err instanceof Error ? err.stack : err });
    process.exit(1);
  });