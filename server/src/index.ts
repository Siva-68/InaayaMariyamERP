import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import session from 'express-session';
import MongoStore from 'connect-mongo';

import { connectDB } from './config/db';
import { corsOptions } from './config/cors';
import { sessionOptions } from './config/session';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import productsRouter from './routes/products';
import inventoryRouter from './routes/inventory';
import invoicesRouter from './routes/invoices';
import reportsRouter from './routes/reports';
import customersRouter from './routes/customers';

const app = express();

// Trust reverse proxy (Render, Railway, Nginx, Cloudflare) for secure cookies & client IP
app.set('trust proxy', 1);

// ── Security middleware ─────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors(corsOptions));
app.use(mongoSanitize());

// ── Rate limiting (global) ──────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  })
);

// ── Body parsing ────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Session ─────────────────────────────────────────────────
const sessionStore =
  process.env.NODE_ENV !== 'test' && process.env.MONGODB_URI
    ? MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: parseInt(process.env.SESSION_TTL_HOURS ?? '8') * 60 * 60,
        autoRemove: 'interval',
        autoRemoveInterval: 60,
      })
    : undefined;

app.use(
  session({
    ...sessionOptions,
    ...(sessionStore ? { store: sessionStore } : {}),
  })
);

// ── Routes ──────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/customers', customersRouter);

// ── Static Frontend Assets (Production SPA) ────────────────
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ── Error handling ──────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Bootstrap ───────────────────────────────────────────────
async function bootstrap() {
  try {
    await connectDB();

    const port = parseInt(process.env.PORT ?? '3001', 10);
    app.listen(port, () => {
      logger.info(`HINAYA MARIYAM server running on port ${port} [${process.env.NODE_ENV ?? 'development'}]`);
    });

    // Initialize automated 9:00 PM IST daily business report delivery
    const { initReportScheduler } = await import('./services/schedulerService');
    initReportScheduler();
  } catch (err) {
    logger.error('Fatal: server failed to start', { error: err });
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { bootstrap };
export default app;
