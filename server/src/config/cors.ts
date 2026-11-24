import type { CorsOptions } from 'cors';
import { logger } from '../utils/logger';

const rawAllowed = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const allowedOrigins = rawAllowed
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // 1. Requests with no origin:
    // Standard browser navigation (GET /), same-origin requests, static assets (/favicon.ico),
    // curl, and cloud health checks. These MUST always be allowed.
    if (!origin) {
      return callback(null, true);
    }

    // 2. Explicitly allowed origins (from CORS_ORIGIN environment variable)
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // 3. Automatically permit Render and Vercel domains, as well as localhost
    if (
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }

    logger.warn(`CORS: blocked origin ${origin}`);
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  maxAge: 86400, // 24h preflight cache
};
