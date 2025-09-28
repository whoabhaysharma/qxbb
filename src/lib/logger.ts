import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, splat } = winston.format;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const consoleFormat = combine(
  colorize(),
  timestamp(),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: combine(timestamp(), errors({ stack: true }), splat()),
  transports: [new winston.transports.Console({ format: consoleFormat })],
  exitOnError: false,
});

export default logger;
