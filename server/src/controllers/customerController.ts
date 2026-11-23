import { Request, Response, NextFunction } from 'express';
import { Customer } from '../models/Customer';
import { logger } from '../utils/logger';

/**
 * GET /api/customers/lookup?mobile=9698603288
 * Fast auto-complete lookup for billing operator when typing customer mobile number.
 */
export async function lookupCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mobile = req.query.mobile as string | undefined;
    if (!mobile || mobile.trim().length < 4) {
      res.status(200).json({ success: true, data: { customer: null } });
      return;
    }

    const cleaned = mobile.trim();
    const customer = await Customer.findOne({ mobile: cleaned }).lean();

    res.status(200).json({
      success: true,
      data: {
        customer: customer
          ? {
              ...customer,
              totalPurchaseAmount: customer.totalPurchaseAmount?.toString() || '0.00',
            }
          : null,
      },
    });
  } catch (err) {
    logger.error('Error looking up customer', { error: err });
    next(err);
  }
}

/**
 * GET /api/customers
 * List customers with total purchase amounts and bill counts.
 */
export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = req.query.search as string | undefined;
    const query: Record<string, unknown> = {};

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { mobile: { $regex: q, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(query)
      .sort({ lastPurchaseDate: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        customers: customers.map((c) => ({
          ...c,
          totalPurchaseAmount: c.totalPurchaseAmount?.toString() || '0.00',
        })),
      },
    });
  } catch (err) {
    logger.error('Error listing customers', { error: err });
    next(err);
  }
}
