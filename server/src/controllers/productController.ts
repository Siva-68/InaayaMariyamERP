import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Product } from '../models/Product';
import { PriceHistory } from '../models/PriceHistory';
import { AuditLog } from '../models/AuditLog';
import { StockMovement } from '../models/StockMovement';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  category: z.string().min(1, 'Category is required').trim(),
  sapCode: z.string().trim().nullable().optional(),
  barcode: z.string().trim().nullable().optional(),
  packType: z.string().trim().default('packet'),
  netWeight: z.string().trim().nullable().optional(),
  piecesPerPack: z.number().int().positive().nullable().optional(),
  unitsPerCarton: z.number().int().positive().default(1),
  purchasePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid purchase price format'),
  sellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid selling price format'),
  mrp: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid MRP format').nullable().optional(),
  gstRate: z.number().min(0).max(100).nullable().optional(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(10),
  serialNumber: z.string().trim().nullable().optional(),
});

export const updateProductSchema = createProductSchema.partial();

/**
 * GET /api/products
 * All roles: list products (purchasePrice hidden from billing_operator)
 */
export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      filter.$or = [
        { name: searchRegex },
        { category: searchRegex },
        { sapCode: searchRegex },
        { barcode: searchRegex },
      ];
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    } else {
      filter.isActive = true; // Default to active products
    }

    if (req.query.lowStock === 'true') {
      filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);

    const isBillingOperator = req.session.role === 'billing_operator';

    const safeProducts = products.map((p) => {
      const json = p.toJSON() as Record<string, unknown>;
      if (isBillingOperator) {
        delete json.purchasePrice; // Never expose purchase cost to billing staff
      }
      return json;
    });

    res.status(200).json({
      success: true,
      data: {
        products: safeProducts,
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
 * GET /api/products/:id
 */
export async function getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(createError('Product not found', 404, 'NOT_FOUND'));
    }

    const json = product.toJSON() as Record<string, unknown>;
    if (req.session.role === 'billing_operator') {
      delete json.purchasePrice;
    }

    res.status(200).json({
      success: true,
      data: { product: json },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/products
 * Admin only
 */
export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const existing = await Product.findOne({
      name: new RegExp(`^${data.name}$`, 'i'),
      category: data.category,
    });

    if (existing) {
      return next(
        createError('A product with this name and category already exists', 409, 'DUPLICATE_PRODUCT')
      );
    }

    const product = new Product({
      ...data,
      purchasePrice: mongoose.Types.Decimal128.fromString(data.purchasePrice),
      sellingPrice: mongoose.Types.Decimal128.fromString(data.sellingPrice),
      mrp: data.mrp ? mongoose.Types.Decimal128.fromString(data.mrp) : null,
      createdBy: req.session.userId,
    });

    await product.save();

    // Audit log
    await AuditLog.create({
      actorId: req.session.userId,
      actorEmail: req.session.email,
      actorRole: req.session.role,
      action: 'product.created',
      entity: 'product',
      entityId: product._id,
      after: product.toJSON(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Product created: ${product.name} [ID: ${product._id}] by ${req.session.email}`);

    res.status(201).json({
      success: true,
      data: { product: product.toJSON() },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/products/:id
 * Admin only
 */
export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return next(createError('Product not found', 404, 'NOT_FOUND'));
    }

    const previousState = product.toJSON();

    // Check price changes and log to PriceHistory
    if (updates.sellingPrice && updates.sellingPrice !== product.sellingPrice.toString()) {
      await PriceHistory.create({
        productId: product._id,
        changedBy: req.session.userId,
        field: 'sellingPrice',
        previousValue: product.sellingPrice,
        newValue: mongoose.Types.Decimal128.fromString(updates.sellingPrice),
        reason: updates.reason || 'Price updated via admin panel',
      });
      product.sellingPrice = mongoose.Types.Decimal128.fromString(updates.sellingPrice);
    }

    if (updates.purchasePrice && updates.purchasePrice !== product.purchasePrice.toString()) {
      await PriceHistory.create({
        productId: product._id,
        changedBy: req.session.userId,
        field: 'purchasePrice',
        previousValue: product.purchasePrice,
        newValue: mongoose.Types.Decimal128.fromString(updates.purchasePrice),
        reason: updates.reason || 'Purchase price updated via admin panel',
      });
      product.purchasePrice = mongoose.Types.Decimal128.fromString(updates.purchasePrice);
    }

    if (updates.mrp !== undefined) {
      const newMrp = updates.mrp ? mongoose.Types.Decimal128.fromString(updates.mrp) : null;
      if (newMrp?.toString() !== product.mrp?.toString()) {
        await PriceHistory.create({
          productId: product._id,
          changedBy: req.session.userId,
          field: 'mrp',
          previousValue: product.mrp || mongoose.Types.Decimal128.fromString('0.00'),
          newValue: newMrp || mongoose.Types.Decimal128.fromString('0.00'),
          reason: updates.reason || 'MRP updated via admin panel',
        });
        product.mrp = newMrp;
      }
    }

    // Apply remaining updates
    if (updates.name !== undefined) product.name = updates.name;
    if (updates.category !== undefined) product.category = updates.category;
    if (updates.sapCode !== undefined) product.sapCode = updates.sapCode;
    if (updates.barcode !== undefined) product.barcode = updates.barcode;
    if (updates.packType !== undefined) product.packType = updates.packType;
    if (updates.netWeight !== undefined) product.netWeight = updates.netWeight;
    if (updates.piecesPerPack !== undefined) product.piecesPerPack = updates.piecesPerPack;
    if (updates.unitsPerCarton !== undefined) product.unitsPerCarton = updates.unitsPerCarton;
    if (updates.gstRate !== undefined) product.gstRate = updates.gstRate;
    if (updates.lowStockThreshold !== undefined) product.lowStockThreshold = updates.lowStockThreshold;
    if (updates.isActive !== undefined) product.isActive = updates.isActive;
    if (updates.serialNumber !== undefined) product.serialNumber = updates.serialNumber;

    await product.save();

    // Audit log
    await AuditLog.create({
      actorId: req.session.userId,
      actorEmail: req.session.email,
      actorRole: req.session.role,
      action: 'product.updated',
      entity: 'product',
      entityId: product._id,
      before: previousState,
      after: product.toJSON(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      data: { product: product.toJSON() },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/products/:id
 * Prefer deactivation over deletion if product has history
 */
export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return next(createError('Product not found', 404, 'NOT_FOUND'));
    }

    // Check if product has any stock movements
    const movementCount = await StockMovement.countDocuments({ productId: product._id });
    if (movementCount > 0) {
      // Deactivate instead of hard deleting
      product.isActive = false;
      await product.save();

      await AuditLog.create({
        actorId: req.session.userId,
        actorEmail: req.session.email,
        actorRole: req.session.role,
        action: 'product.deactivated',
        entity: 'product',
        entityId: product._id,
        before: { isActive: true },
        after: { isActive: false },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Product has transaction history; deactivated instead of deleted',
          product: product.toJSON(),
        },
      });
      return;
    }

    await Product.findByIdAndDelete(id);

    await AuditLog.create({
      actorId: req.session.userId,
      actorEmail: req.session.email,
      actorRole: req.session.role,
      action: 'product.deleted',
      entity: 'product',
      entityId: product._id,
      before: product.toJSON(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      data: { message: 'Product deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/products/:id/price-history
 * Admin & Accountant only
 */
export async function getPriceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await PriceHistory.find({ productId: req.params.id })
      .sort({ changedAt: -1 })
      .populate('changedBy', 'name email');

    res.status(200).json({
      success: true,
      data: { history },
    });
  } catch (error) {
    next(error);
  }
}
