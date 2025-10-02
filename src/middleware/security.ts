import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

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

// ---------------------------
// Rate Limiters
// ---------------------------

// Global limiter for all routes
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_S || '900') * 1000, // Default: 15 minutes
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || '100'), // Default: 100 requests per IP
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter limiter for auth routes (login/signup)
export const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_S || '3600') * 1000, // Default: 1 hour
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10'), // Default: 10 requests per IP per hour
  message: { error: 'Too many authentication attempts, try again after an hour.' },
  keyGenerator: (req) => req.ip + (req.body.email ? `:${req.body.email}` : ''),
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
