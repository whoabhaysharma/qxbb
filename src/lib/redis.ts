import { createClient } from 'redis';
import logger from './logger';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));

// Connect to redis
redisClient.connect().catch(console.error);

export default redisClient;
