import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import cors from 'cors';
import { Request } from 'express';

// ---------------------------
// CORS Configuration
// ---------------------------
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').filter(Boolean)
  : ['http://localhost:3000'];

const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // allow cookies if needed
};

// Helper to extract an IP string (prefer X-Forwarded-For), used with ipKeyGenerator
const extractIpString = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || (req.ip as string) || '0.0.0.0';
};

// ---------------------------
// Rate Limiters
// ---------------------------

// Global limiter for all routes
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_S || '900') * 1000, // Default: 15 minutes
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || '100'), // Default: 100 requests per IP
  message: { error: 'Too many requests, please try again later.' },
  keyGenerator: (req: Request) => {
    const ip = extractIpString(req);
    return ipKeyGenerator(ip);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth routes (login/signup)
export const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_S || '3600') * 1000, // Default: 1 hour
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10'), // Default: 10 requests per IP per hour
  message: { error: 'Too many authentication attempts, try again after an hour.' },
  keyGenerator: (req: Request) => {
    const ip = extractIpString(req);
    const normalized = ipKeyGenerator(ip);
    return `${normalized}:${req.body?.email || 'anonymous'}`;
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// ---------------------------
// Helmet / Security Headers
// ---------------------------
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // removed 'unsafe-inline' for better security
      styleSrc: ["'self'"],  // removed 'unsafe-inline'
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hidePoweredBy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginResourcePolicy: { policy: "same-origin" },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
});

// ---------------------------
// Export Security Middleware
// ---------------------------
export const securityMiddleware = [
  cors(corsOptions),    // CORS protection
  securityHeaders,      // Security headers via Helmet
  globalLimiter,        // Global rate limiting
];
