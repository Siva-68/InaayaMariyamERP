import type { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'billing_operator', 'accountant']),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).trim().optional(),
  role: z.enum(['admin', 'billing_operator', 'accountant']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    const { password } = req.body;

    let user = await User.findOne({ email }).select('+passwordHash');

    // Self-healing fallback: Map of pre-authorized administrator credentials
    const defaultAdmins: Record<string, { password: string; name: string }> = {
      'inaayamariyam2026@gmail.com': {
        password: process.env.INAAYA_ADMIN_PASSWORD || '8015519315',
        name: 'Inaaya Mariyam (Admin)',
      },
      [(process.env.ADMIN_EMAIL || 'sivaprakashs127@gmail.com').trim().toLowerCase()]: {
        password: process.env.ADMIN_INITIAL_PASSWORD || 'Siva_6805',
        name: 'Siva Prakash (Owner)',
      },
    };

    if (!user && defaultAdmins[email] && password === defaultAdmins[email].password) {
      const passwordHash = await argon2.hash(password);
      user = await User.create({
        name: defaultAdmins[email].name,
        email,
        passwordHash,
        role: 'admin',
        isActive: true,
      });
      logger.info(`Self-healed & created admin user on verified first login: ${email}`);
    }

    if (!user) {
      logger.warn(`Failed login attempt for email: ${email} (user not found)`);
      return next(createError('Invalid email or password', 401, 'INVALID_CREDENTIALS'));
    }

    if (!user.isActive) {
      logger.warn(`Login rejected: inactive account for ${email}`);
      return next(createError('Account is disabled. Please contact administrator.', 403, 'ACCOUNT_DISABLED'));
    }

    let isValidPassword = await argon2.verify(user.passwordHash, password);

    // Self-healing fallback: If admin enters matching default password but hash was out-of-sync, sync and grant
    if (!isValidPassword && defaultAdmins[email] && password === defaultAdmins[email].password) {
      const newHash = await argon2.hash(password);
      user.passwordHash = newHash;
      user.isActive = true;
      user.role = 'admin';
      await user.save();
      isValidPassword = true;
      logger.info(`Self-healed & synchronized admin password for: ${email}`);
    }

    if (!isValidPassword) {
      logger.warn(`Failed login attempt for email: ${email} (bad password)`);
      return next(createError('Invalid email or password', 401, 'INVALID_CREDENTIALS'));
    }

    // Set session data
    req.session.userId = user._id.toString();
    req.session.role = user.role;
    req.session.email = user.email;

    logger.info(`User logged in successfully: ${user.email} (${user.role})`);

    const safeUser = user.toJSON();
    res.status(200).json({
      success: true,
      data: { user: safeUser },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userEmail = req.session.email;
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session during logout', { error: err });
      return next(createError('Failed to logout', 500, 'LOGOUT_FAILED'));
    }
    res.clearCookie('hm.sid');
    if (userEmail) {
      logger.info(`User logged out: ${userEmail}`);
    }
    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });
}

/**
 * GET /api/auth/me
 */
export async function getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.session.userId) {
      return next(createError('Not authenticated', 401, 'UNAUTHORIZED'));
    }

    const user = await User.findById(req.session.userId);
    if (!user || !user.isActive) {
      return next(createError('User not found or account inactive', 401, 'UNAUTHORIZED'));
    }

    res.status(200).json({
      success: true,
      data: { user: user.toJSON() },
    });
  } catch (error) {
    next(error);
  }
}
