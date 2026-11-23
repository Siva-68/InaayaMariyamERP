import type { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * GET /api/users
 * Admin only: list all users
 */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: users.map((u) => u.toJSON()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users
 * Admin only: create a new user
 */
export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return next(createError('User with this email already exists', 409, 'USER_EXISTS'));
    }

    const passwordHash = await argon2.hash(password);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      isActive: true,
      createdBy: req.session.userId,
    });

    logger.info(`Admin created user: ${user.email} (${user.role})`);

    res.status(201).json({
      success: true,
      data: { user: user.toJSON() },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id
 * Admin only: update user properties
 */
export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, role, isActive, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return next(createError('User not found', 404, 'NOT_FOUND'));
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) {
      user.passwordHash = await argon2.hash(password);
    }

    await user.save();
    logger.info(`User updated: ${user.email} by admin`);

    res.status(200).json({
      success: true,
      data: { user: user.toJSON() },
    });
  } catch (error) {
    next(error);
  }
}
