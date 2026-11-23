import { Router } from 'express';
import {
  createInvoice,
  listInvoices,
  getInvoiceById,
  downloadInvoicePdf,
  recordAdditionalPayment,
  createInvoiceSchema,
  addPaymentSchema,
} from '../controllers/invoiceController';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Finalizing new invoices: admin and billing_operator
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'billing_operator'),
  validateBody(createInvoiceSchema),
  createInvoice
);

// Viewing invoices: all authenticated roles
router.get('/', requireAuth, listInvoices);
router.get('/:id', requireAuth, getInvoiceById);
router.get('/:id/pdf', requireAuth, downloadInvoicePdf);

// Recording payment against outstanding balance: admin and billing_operator
router.post(
  '/:id/payments',
  requireAuth,
  requireRole('admin', 'billing_operator'),
  validateBody(addPaymentSchema),
  recordAdditionalPayment
);

export default router;
