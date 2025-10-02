import { PrismaClient } from '@prisma/client';
import logger from './logger';

// Use a global variable to prevent multiple instances in development (hot-reload)
declare global {
  // eslint-disable-next-line no-var
  var __prismaClient__: PrismaClient | undefined;
}

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Configure Prisma logging: emit events so we can log using our logger
const prismaLogConfig = LOG_LEVEL === 'debug'
  ? [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'info' }, { emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
  : [{ emit: 'event', level: 'info' }, { emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }];

const prisma = globalThis.__prismaClient__ ?? new PrismaClient({ log: prismaLogConfig as any });
if (process.env.NODE_ENV !== 'production') globalThis.__prismaClient__ = prisma;

// Optional explicit connect helper (call from app startup if you want to ensure connection)
export const connectPrisma = async () => {
  try {
    await prisma.$connect();
    logger.info('Prisma: database connection established');
  } catch (err) {
    logger.error('Prisma: failed to connect to database', { error: err instanceof Error ? err.stack : err });
    throw err;
  }
};

// Attach runtime event listeners using any cast to avoid strict typing friction
;(prisma as any).$on('error', (e: any) => {
  logger.error('Prisma runtime error', { error: e instanceof Error ? e.stack : e });
});

if (LOG_LEVEL === 'debug') {
  (prisma as any).$on('query', (e: any) => {
    logger.debug('Prisma query', { query: e.query, params: e.params, duration: e.duration });
  });
}

// Graceful shutdown handling - attach to process events instead of Prisma's beforeExit (removed in Prisma 5.0+)
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, closing Prisma connection`);
  try {
    await prisma.$disconnect();
    logger.info('Prisma: disconnected successfully');
    process.exit(0);
  } catch (err) {
    logger.error('Error during Prisma disconnect', { error: err instanceof Error ? err.stack : err });
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('beforeExit', () => {
  logger.info('Process beforeExit, disconnecting Prisma');
  prisma.$disconnect().catch((err) => {
    logger.warn('Error during disconnect on beforeExit', { error: err instanceof Error ? err.stack : err });
  });
});

export default prisma;
