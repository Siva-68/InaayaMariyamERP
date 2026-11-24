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
import mongoose from 'mongoose';
import argon2 from 'argon2';
import { User } from './models/User';
import { Product } from './models/Product';

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

// ── Initial Seed Guard ──────────────────────────────────────
async function ensureInitialData() {
  try {
    const defaultAdmins = [
      {
        email: 'inaayamariyam2026@gmail.com',
        password: process.env.INAAYA_ADMIN_PASSWORD || '8015519315',
        name: 'Inaaya Mariyam (Admin)',
      },
      {
        email: (process.env.ADMIN_EMAIL || 'sivaprakashs127@gmail.com').trim().toLowerCase(),
        password: process.env.ADMIN_INITIAL_PASSWORD || 'Siva_6805',
        name: 'Siva Prakash (Owner)',
      },
    ];

    let primaryAdminId: mongoose.Types.ObjectId | undefined;

    for (const adm of defaultAdmins) {
      const passwordHash = await argon2.hash(adm.password);
      let user = await User.findOne({ email: adm.email }).select('+passwordHash');
      if (!user) {
        user = await User.create({
          name: adm.name,
          email: adm.email,
          passwordHash,
          role: 'admin',
          isActive: true,
        });
        logger.info(`Initialized default admin account: ${adm.email}`);
      } else {
        user.passwordHash = passwordHash;
        user.isActive = true;
        user.role = 'admin';
        await user.save();
        logger.info(`Ensured active credentials for admin: ${adm.email}`);
      }
      if (!primaryAdminId && user) {
        primaryAdminId = user._id as mongoose.Types.ObjectId;
      }
    }

    const productCount = await Product.countDocuments();
    if (productCount === 0 && primaryAdminId) {
      await Product.insertMany([
        {
          name: 'Kaju Burfi 250g',
          category: 'Sweets & Burfi',
          sapCode: 'KB-250',
          packType: 'packet',
          netWeight: '250g',
          unitsPerCarton: 20,
          purchasePrice: mongoose.Types.Decimal128.fromString('180.00'),
          sellingPrice: mongoose.Types.Decimal128.fromString('240.00'),
          mrp: mongoose.Types.Decimal128.fromString('250.00'),
          gstRate: 5,
          stock: 45,
          lowStockThreshold: 10,
          isActive: true,
          createdBy: primaryAdminId,
        },
        {
          name: 'Milk Peda 250g',
          category: 'Sweets & Burfi',
          sapCode: 'MP-250',
          packType: 'packet',
          netWeight: '250g',
          unitsPerCarton: 24,
          purchasePrice: mongoose.Types.Decimal128.fromString('120.00'),
          sellingPrice: mongoose.Types.Decimal128.fromString('160.00'),
          mrp: mongoose.Types.Decimal128.fromString('170.00'),
          gstRate: 5,
          stock: 30,
          lowStockThreshold: 8,
          isActive: true,
          createdBy: primaryAdminId,
        },
        {
          name: 'Special Mixture 200g',
          category: 'Snacks & Savouries',
          sapCode: 'MIX-200',
          packType: 'packet',
          netWeight: '200g',
          unitsPerCarton: 40,
          purchasePrice: mongoose.Types.Decimal128.fromString('45.00'),
          sellingPrice: mongoose.Types.Decimal128.fromString('65.00'),
          mrp: mongoose.Types.Decimal128.fromString('70.00'),
          gstRate: 5,
          stock: 80,
          lowStockThreshold: 15,
          isActive: true,
          createdBy: primaryAdminId,
        },
        {
          name: 'Butter Murukku 200g',
          category: 'Snacks & Savouries',
          sapCode: 'MUR-200',
          packType: 'packet',
          netWeight: '200g',
          unitsPerCarton: 30,
          purchasePrice: mongoose.Types.Decimal128.fromString('40.00'),
          sellingPrice: mongoose.Types.Decimal128.fromString('60.00'),
          mrp: mongoose.Types.Decimal128.fromString('65.00'),
          gstRate: 5,
          stock: 50,
          lowStockThreshold: 12,
          isActive: true,
          createdBy: primaryAdminId,
        },
      ]);
      logger.info('Initialized default catalogue products');
    }
  } catch (err) {
    logger.warn('Initial data auto-init notice', { error: err });
  }
}

// ── Bootstrap ───────────────────────────────────────────────
async function bootstrap() {
  try {
    await connectDB();
    await ensureInitialData();

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
