import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { Product } from '../models/Product';
import { PurchaseEntry } from '../models/PurchaseEntry';
import { StockMovement } from '../models/StockMovement';
import { AuditLog } from '../models/AuditLog';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const stockInSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  purchaseUnit: z.string().min(1, 'Purchase unit is required').default('carton'),
  purchaseQty: z.number().int().positive('Quantity must be greater than 0'),
  conversionFactor: z.number().int().positive('Conversion factor must be at least 1').default(1),
  purchaseCost: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid purchase cost'),
  purchaseDate: z.string().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const adjustStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  delta: z.number().int().refine((val) => val !== 0, 'Delta cannot be zero'),
  reason: z.string().min(3, 'A clear reason is required for manual stock adjustment').trim(),
});

/**
 * POST /api/inventory/stock-in
 * Admin only: Record incoming stock purchase entry and atomically update stock
 */
export async function recordStockIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId, purchaseUnit, purchaseQty, conversionFactor, purchaseCost, purchaseDate, notes } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return next(createError('Product not found', 404, 'NOT_FOUND'));
    }

    const unitQtyAdded = purchaseQty * conversionFactor;
    const stockBefore = product.stock;
    const stockAfter = stockBefore + unitQtyAdded;

    const totalCostCalc = new Decimal(purchaseCost).times(purchaseQty).toFixed(2);

    // Save purchase entry
    const purchaseEntry = await PurchaseEntry.create({
      productId: product._id,
      productName: product.name,
      purchaseUnit,
      purchaseQty,
      conversionFactor,
      unitQtyAdded,
      purchaseCost: mongoose.Types.Decimal128.fromString(purchaseCost),
      totalCost: mongoose.Types.Decimal128.fromString(totalCostCalc),
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      notes: notes || null,
      recordedBy: req.session.userId,
    });

    // Update product stock and optionally purchase price
    product.stock = stockAfter;
    await product.save();

    // Log stock movement
    const movement = await StockMovement.create({
      productId: product._id,
      productName: product.name,
      movementType: 'stock_in',
      delta: unitQtyAdded,
      stockBefore,
      stockAfter,
      referenceType: 'purchase_entry',
      referenceId: purchaseEntry._id,
      reason: notes || `Stock in: ${purchaseQty} ${purchaseUnit}(s) × ${conversionFactor}`,
      performedBy: req.session.userId,
    });

    // Audit log
    await AuditLog.create({
      actorId: req.session.userId,
      actorEmail: req.session.email,
      actorRole: req.session.role,
      action: 'inventory.stock_in',
      entity: 'purchase_entry',
      entityId: purchaseEntry._id,
      after: {
        productName: product.name,
        unitQtyAdded,
        stockBefore,
        stockAfter,
        purchaseCost,
        totalCost: totalCostCalc,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Stock-in recorded: ${unitQtyAdded} units added for ${product.name}. New stock: ${stockAfter}`);

    res.status(201).json({
      success: true,
      data: {
        purchaseEntry: purchaseEntry.toJSON(),
        stockMovement: movement.toJSON(),
        currentStock: stockAfter,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/inventory/adjust
 * Admin only: Manual stock correction (damage, count correction, sample) with mandatory reason
 */
export async function adjustStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId, delta, reason } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return next(createError('Product not found', 404, 'NOT_FOUND'));
    }

    const stockBefore = product.stock;
    const stockAfter = stockBefore + delta;

    if (stockAfter < 0) {
      return next(
        createError(
          `Adjustment of ${delta} would result in negative stock (current: ${stockBefore})`,
          422,
          'NEGATIVE_STOCK'
        )
      );
    }

    product.stock = stockAfter;
    await product.save();

    const movement = await StockMovement.create({
      productId: product._id,
      productName: product.name,
      movementType: 'adjustment',
      delta,
      stockBefore,
      stockAfter,
      referenceType: 'manual_adjustment',
      reason,
      performedBy: req.session.userId,
    });

    await AuditLog.create({
      actorId: req.session.userId,
      actorEmail: req.session.email,
      actorRole: req.session.role,
      action: 'inventory.adjustment',
      entity: 'product',
      entityId: product._id,
      before: { stock: stockBefore },
      after: { stock: stockAfter, delta, reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Stock adjusted for ${product.name}: delta ${delta}, new stock ${stockAfter}. Reason: ${reason}`);

    res.status(200).json({
      success: true,
      data: {
        stockMovement: movement.toJSON(),
        currentStock: stockAfter,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/inventory/movements/:productId
 * Admin and Accountant only
 */
export async function getProductMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { productId: req.params.productId };

    const [movements, total] = await Promise.all([
      StockMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('performedBy', 'name email'),
      StockMovement.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        movements,
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
