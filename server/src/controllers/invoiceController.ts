import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { Product } from '../models/Product';
import { Invoice } from '../models/Invoice';
import { Payment } from '../models/Payment';
import { Customer } from '../models/Customer';
import { StockMovement } from '../models/StockMovement';
import { AuditLog } from '../models/AuditLog';
import { getNextInvoiceNumber } from '../models/InvoiceCounter';
import { isReplicaSetCapable } from '../config/db';
import { calculateInvoiceTotals } from '../utils/money';
import { generateInvoicePdf, DEFAULT_BUSINESS_DETAILS, PdfFontStyle } from '../services/pdfService';
import { dispatchInvoiceNotifications, getWhatsAppShareUrls } from '../services/notificationService';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const createInvoiceSchema = z.object({
  idempotencyKey: z.string().uuid('Idempotency key must be a valid UUID').optional(),
  customerName: z.string().min(2, 'Customer name must be at least 2 characters').trim(),
  customerMobile: z
    .string({ required_error: 'Customer mobile number is mandatory' })
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  customerEmail: z.string().email().trim().nullable().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive('Quantity must be at least 1'),
        sellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format'),
      })
    )
    .min(1, 'At least one product line is required'),
  payment: z.object({
    method: z.enum(['cash', 'upi', 'split']),
    cashAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
    upiAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
    upiReference: z.string().trim().nullable().optional(),
    note: z.string().trim().nullable().optional(),
  }),
});

export const addPaymentSchema = z.object({
  method: z.enum(['cash', 'upi', 'split']),
  cashAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  upiAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  upiReference: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional(),
});

/**
 * POST /api/invoices
 * Core Billing endpoint: creates invoice, deducts stock, records payment, and writes movements atomically.
 */
export async function createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { idempotencyKey, customerName, customerMobile, customerEmail, lines, payment } = req.body;

  try {
    // 1. Idempotency guard: Return existing invoice if previously finalized
    if (idempotencyKey) {
      const existing = await Invoice.findOne({ idempotencyKey });
      if (existing) {
        logger.info(`Idempotent request detected for key: ${idempotencyKey}. Returning existing invoice ${existing.invoiceNumber}`);
        res.status(200).json({
          success: true,
          data: {
            invoice: existing.toJSON(),
            idempotentReplay: true,
          },
        });
        return;
      }
    }

    // 2. Fetch and validate all products in the cart
    const productIds = lines.map((l: { productId: string }) => l.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    if (products.length !== lines.length) {
      return next(createError('One or more products in the cart could not be found', 404, 'PRODUCT_NOT_FOUND'));
    }

    const productMap = new Map<string, (typeof products)[0]>();
    for (const p of products) {
      productMap.set(p._id.toString(), p);
    }

    // 3. Strict business invariant validations: Active status, Unconfirmed GST rates, Server Price verification
    const itemsForCalculation: Array<{
      product: (typeof products)[0];
      quantity: number;
      unitPrice: string;
      gstRate: number;
    }> = [];

    for (const line of lines) {
      const p = productMap.get(line.productId)!;

      if (!p.isActive) {
        return next(createError(`Product "${p.name}" is inactive and cannot be billed`, 422, 'PRODUCT_INACTIVE'));
      }

      // INVARIANT: Do not invent GST rates. If unconfirmed, block finalization.
      if (p.gstRate === null || p.gstRate === undefined) {
        return next(
          createError(
            `Product "${p.name}" has no confirmed GST rate. Live billing is blocked until an accountant confirms the tax rate.`,
            422,
            'GST_NOT_CONFIGURED'
          )
        );
      }

      // Revalidate server selling price against client submitted price to prevent client tampering
      const serverPrice = p.sellingPrice.toString();
      if (new Decimal(serverPrice).toFixed(2) !== new Decimal(line.sellingPrice).toFixed(2)) {
        return next(
          createError(
            `Price mismatch for "${p.name}". Server price is ₹${serverPrice}, but client sent ₹${line.sellingPrice}. Please refresh your cart.`,
            422,
            'PRICE_CHANGED'
          )
        );
      }

      // Check current stock availability
      if (p.stock < line.quantity) {
        return next(
          createError(
            `Insufficient stock for "${p.name}". Available: ${p.stock}, Requested: ${line.quantity}`,
            422,
            'INSUFFICIENT_STOCK'
          )
        );
      }

      itemsForCalculation.push({
        product: p,
        quantity: line.quantity,
        unitPrice: serverPrice,
        gstRate: p.gstRate,
      });
    }

    // 4. Safe Financial Totals calculation using decimal.js
    const totals = calculateInvoiceTotals(
      itemsForCalculation.map((i) => ({
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        gstRate: i.gstRate,
      }))
    );

    // 5. Payment breakdown calculation
    const cash = new Decimal(payment.cashAmount || '0.00');
    const upi = new Decimal(payment.upiAmount || '0.00');
    let amountPaid: Decimal;

    if (payment.method === 'cash') {
      amountPaid = cash;
    } else if (payment.method === 'upi') {
      amountPaid = upi;
    } else {
      amountPaid = cash.plus(upi);
    }

    const grandTotal = new Decimal(totals.grandTotal);
    const outstandingAmount = grandTotal.minus(amountPaid).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    if (amountPaid.greaterThan(grandTotal)) {
      return next(
        createError(
          `Payment amount (₹${amountPaid.toFixed(2)}) cannot exceed grand total (₹${grandTotal.toFixed(2)})`,
          422,
          'PAYMENT_EXCEEDS_TOTAL'
        )
      );
    }

    // 6. Execute atomic operations
    const replicaSet = isReplicaSetCapable();
    const session = replicaSet ? await mongoose.startSession() : null;

    try {
      if (session) {
        session.startTransaction();
      }

      // Allocate server-generated sequential invoice number
      const invoiceNumber = await getNextInvoiceNumber(session || undefined);

      // Snapshot line items
      const snapshotLines = itemsForCalculation.map((item, index) => {
        const calc = totals.lines[index];
        return {
          lineNumber: index + 1,
          productId: item.product._id,
          productName: item.product.name,
          unit: item.product.packType || 'packet',
          quantity: item.quantity,
          sellingPrice: mongoose.Types.Decimal128.fromString(calc.unitPrice),
          purchaseCost: item.product.purchasePrice,
          gstRate: item.gstRate,
          taxableAmount: mongoose.Types.Decimal128.fromString(calc.taxableAmount),
          cgst: mongoose.Types.Decimal128.fromString(calc.cgst),
          sgst: mongoose.Types.Decimal128.fromString(calc.sgst),
          lineTotal: mongoose.Types.Decimal128.fromString(calc.lineTotal),
        };
      });

      // Create Invoice record
      const invoiceDocs = await Invoice.create(
        [
          {
            invoiceNumber,
            customerName,
            customerMobile,
            customerEmail: customerEmail || null,
            status: 'finalized',
            lines: snapshotLines,
            subtotalTaxable: mongoose.Types.Decimal128.fromString(totals.subtotalTaxable),
            totalCgst: mongoose.Types.Decimal128.fromString(totals.totalCgst),
            totalSgst: mongoose.Types.Decimal128.fromString(totals.totalSgst),
            grandTotal: mongoose.Types.Decimal128.fromString(totals.grandTotal),
            amountPaid: mongoose.Types.Decimal128.fromString(amountPaid.toFixed(2)),
            outstandingAmount: mongoose.Types.Decimal128.fromString(
              outstandingAmount.greaterThan(0) ? outstandingAmount.toFixed(2) : '0.00'
            ),
            idempotencyKey: idempotencyKey || null,
            billedBy: req.session.userId,
            invoicedAt: new Date(),
            finalizedAt: new Date(),
          },
        ],
        session ? { session } : {}
      );
      const invoice = invoiceDocs[0];

      // Create Payment record
      if (amountPaid.greaterThan(0)) {
        await Payment.create(
          [
            {
              invoiceId: invoice._id,
              invoiceNumber: invoice.invoiceNumber,
              method: payment.method,
              cashAmount: mongoose.Types.Decimal128.fromString(cash.toFixed(2)),
              upiAmount: mongoose.Types.Decimal128.fromString(upi.toFixed(2)),
              totalAmount: mongoose.Types.Decimal128.fromString(amountPaid.toFixed(2)),
              upiReference: payment.upiReference || null,
              recordedBy: req.session.userId,
              paidAt: new Date(),
              note: payment.note || null,
            },
          ],
          session ? { session } : {}
        );
      }

      // Deduct stock atomically and log StockMovements
      for (const item of itemsForCalculation) {
        // Atomic deduction with condition stock >= quantity to prevent simultaneous overselling
        const updated = await Product.findOneAndUpdate(
          {
            _id: item.product._id,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { new: true, session: session || undefined }
        );

        if (!updated) {
          throw createError(
            `Simultaneous sale prevented: stock for "${item.product.name}" was modified by another operator.`,
            409,
            'STOCK_CONFLICT'
          );
        }

        const stockAfter = updated.stock;
        const stockBefore = stockAfter + item.quantity;

        await StockMovement.create(
          [
            {
              productId: item.product._id,
              productName: item.product.name,
              movementType: 'sale',
              delta: -item.quantity,
              stockBefore,
              stockAfter,
              referenceType: 'invoice',
              referenceId: invoice._id,
              reason: `Billed in ${invoice.invoiceNumber}`,
              performedBy: req.session.userId,
            },
          ],
          session ? { session } : {}
        );
      }

      // Record / Update Customer record in separate 'customers' collection
      const grandTotalDec = new Decimal(totals.grandTotal);
      const existingCust = await Customer.findOne({ mobile: customerMobile });
      if (existingCust) {
        existingCust.name = customerName;
        if (customerEmail) existingCust.email = customerEmail;
        const currentTotal = new Decimal(existingCust.totalPurchaseAmount?.toString() || '0');
        existingCust.totalPurchaseAmount = mongoose.Types.Decimal128.fromString(currentTotal.plus(grandTotalDec).toFixed(2));
        existingCust.totalInvoicesCount += 1;
        existingCust.lastPurchaseDate = new Date();
        existingCust.lastInvoiceNumber = invoice.invoiceNumber;
        await existingCust.save(session ? { session } : undefined);
      } else {
        await Customer.create(
          [
            {
              name: customerName,
              mobile: customerMobile,
              email: customerEmail || null,
              totalPurchaseAmount: mongoose.Types.Decimal128.fromString(grandTotalDec.toFixed(2)),
              totalInvoicesCount: 1,
              lastPurchaseDate: new Date(),
              lastInvoiceNumber: invoice.invoiceNumber,
            },
          ],
          session ? { session } : {}
        );
      }

      // Audit Log
      await AuditLog.create(
        [
          {
            actorId: req.session.userId,
            actorEmail: req.session.email,
            actorRole: req.session.role,
            action: 'invoice.finalized',
            entity: 'invoice',
            entityId: invoice._id,
            after: {
              invoiceNumber: invoice.invoiceNumber,
              grandTotal: totals.grandTotal,
              amountPaid: amountPaid.toFixed(2),
              outstandingAmount: outstandingAmount.toFixed(2),
              customerName,
              customerMobile,
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          },
        ],
        session ? { session } : {}
      );

      if (session) {
        await session.commitTransaction();
      }

      logger.info(`Invoice finalized: ${invoice.invoiceNumber} | Grand Total: ₹${totals.grandTotal} | By: ${req.session.email}`);

      // Generate instant WhatsApp share URLs and dispatch async background notifications
      const { adminShareUrl, customerShareUrl } = getWhatsAppShareUrls(invoice);
      dispatchInvoiceNotifications(invoice).catch((notifErr) =>
        logger.warn('Background invoice notification dispatch error', { error: notifErr })
      );

      res.status(201).json({
        success: true,
        data: {
          invoice: invoice.toJSON(),
          whatsappAdminUrl: adminShareUrl,
          whatsappCustomerUrl: customerShareUrl,
        },
      });
    } catch (txError) {
      if (session) {
        await session.abortTransaction();
      }
      throw txError;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/invoices
 * Search & List past invoices
 */
export async function listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (req.query.search) {
      const s = req.query.search as string;
      filter.$or = [
        { invoiceNumber: new RegExp(s, 'i') },
        { customerName: new RegExp(s, 'i') },
        { customerMobile: new RegExp(s, 'i') },
      ];
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.hasOutstanding === 'true') {
      filter.$expr = { $gt: [{ $toDouble: '$outstandingAmount' }, 0] };
    }

    if (req.query.from || req.query.to) {
      const dateFilter: Record<string, unknown> = {};
      if (req.query.from) dateFilter.$gte = new Date(req.query.from as string);
      if (req.query.to) dateFilter.$lte = new Date(req.query.to as string);
      filter.invoicedAt = dateFilter;
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ invoicedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('billedBy', 'name email'),
      Invoice.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        invoices: invoices.map((i) => i.toJSON()),
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
 * GET /api/invoices/:id
 */
export async function getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('billedBy', 'name email');
    if (!invoice) {
      return next(createError('Invoice not found', 404, 'NOT_FOUND'));
    }

    const payments = await Payment.find({ invoiceId: invoice._id }).sort({ paidAt: 1 }).populate('recordedBy', 'name email');

    res.status(200).json({
      success: true,
      data: {
        invoice: invoice.toJSON(),
        payments: payments.map((p) => p.toJSON()),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/invoices/:id/pdf
 * Streams an A4 branded invoice PDF.
 * Never modifies or re-evaluates historical invoice prices.
 */
export async function downloadInvoicePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return next(createError('Invoice not found', 404, 'NOT_FOUND'));
    }

    const safeFilename = `Invoice-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);

    const fontQuery = (req.query.font as string)?.toLowerCase();
    const fontStyle: PdfFontStyle =
      fontQuery === 'helvetica' || fontQuery === 'courier' || fontQuery === 'times'
        ? fontQuery
        : 'times';

    const doc = generateInvoicePdf(invoice, DEFAULT_BUSINESS_DETAILS, fontStyle);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/invoices/:id/payments
 * Record an additional payment against an invoice with outstanding balance.
 * Strictly preserves original line item snapshots.
 */
export async function recordAdditionalPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { method, cashAmount, upiAmount, upiReference, note } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return next(createError('Invoice not found', 404, 'NOT_FOUND'));
    }

    const cash = new Decimal(cashAmount || '0.00');
    const upi = new Decimal(upiAmount || '0.00');
    let paymentTotal: Decimal;

    if (method === 'cash') paymentTotal = cash;
    else if (method === 'upi') paymentTotal = upi;
    else paymentTotal = cash.plus(upi);

    const currentOutstanding = new Decimal(invoice.outstandingAmount.toString());

    if (paymentTotal.greaterThan(currentOutstanding)) {
      return next(
        createError(
          `Payment amount (₹${paymentTotal.toFixed(2)}) exceeds outstanding balance (₹${currentOutstanding.toFixed(2)})`,
          422,
          'PAYMENT_EXCEEDS_OUTSTANDING'
        )
      );
    }

    const newAmountPaid = new Decimal(invoice.amountPaid.toString()).plus(paymentTotal);
    const newOutstanding = currentOutstanding.minus(paymentTotal);

    // Save payment record
    const payment = await Payment.create({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      method,
      cashAmount: mongoose.Types.Decimal128.fromString(cash.toFixed(2)),
      upiAmount: mongoose.Types.Decimal128.fromString(upi.toFixed(2)),
      totalAmount: mongoose.Types.Decimal128.fromString(paymentTotal.toFixed(2)),
      upiReference: upiReference || null,
      recordedBy: req.session.userId,
      paidAt: new Date(),
      note: note || 'Additional payment against outstanding balance',
    });

    // Update denormalized payment totals on invoice (lines snapshot untouched!)
    invoice.amountPaid = mongoose.Types.Decimal128.fromString(newAmountPaid.toFixed(2));
    invoice.outstandingAmount = mongoose.Types.Decimal128.fromString(newOutstanding.toFixed(2));
    await invoice.save();

    await AuditLog.create({
      actorId: req.session.userId,
      actorEmail: req.session.email,
      actorRole: req.session.role,
      action: 'invoice.additional_payment',
      entity: 'payment',
      entityId: payment._id,
      after: {
        invoiceNumber: invoice.invoiceNumber,
        paymentAmount: paymentTotal.toFixed(2),
        remainingOutstanding: newOutstanding.toFixed(2),
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      data: {
        payment: payment.toJSON(),
        amountPaid: newAmountPaid.toFixed(2),
        outstandingAmount: newOutstanding.toFixed(2),
      },
    });
  } catch (error) {
    next(error);
  }
}
