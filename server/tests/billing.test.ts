import Decimal from 'decimal.js';
import request from 'supertest';
import app from '../src/index';
import { calculateTaxLine, calculateInvoiceTotals } from '../src/utils/money';

describe('Billing & Financial Calculations', () => {
  describe('GST-Inclusive Tax Decomposition (decimal.js)', () => {
    it('decomposes ₹105 with 5% GST into taxable ₹100.00, CGST ₹2.50, SGST ₹2.50', () => {
      const result = calculateTaxLine('105.00', 1, 5);

      expect(result.lineTotal).toBe('105.00');
      expect(result.taxableAmount).toBe('100.00');
      expect(result.cgst).toBe('2.50');
      expect(result.sgst).toBe('2.50');

      // Verify exact sum equality without rounding loss
      const sum = new Decimal(result.taxableAmount).plus(result.cgst).plus(result.sgst);
      expect(sum.toFixed(2)).toBe(result.lineTotal);
    });

    it('decomposes ₹240 with 5% GST into exact taxable and tax splits', () => {
      const result = calculateTaxLine('240.00', 2, 5); // ₹480 total

      expect(result.lineTotal).toBe('480.00');
      // 480 / 1.05 = 457.142857... -> 457.14
      expect(result.taxableAmount).toBe('457.14');
      // Total tax = 22.86 -> CGST 11.43, SGST 11.43
      expect(result.cgst).toBe('11.43');
      expect(result.sgst).toBe('11.43');

      const sum = new Decimal(result.taxableAmount).plus(result.cgst).plus(result.sgst);
      expect(sum.toFixed(2)).toBe('480.00');
    });

    it('aggregates multiple items accurately without float accumulation errors', () => {
      const totals = calculateInvoiceTotals([
        { unitPrice: '240.00', quantity: 1, gstRate: 5 },
        { unitPrice: '65.00', quantity: 2, gstRate: 5 },
        { unitPrice: '160.00', quantity: 1, gstRate: 5 },
      ]);

      // Total = 240 + 130 + 160 = 530.00
      expect(totals.grandTotal).toBe('530.00');

      const totalTax = new Decimal(totals.totalCgst).plus(totals.totalSgst);
      const totalReconstituted = new Decimal(totals.subtotalTaxable).plus(totalTax);
      expect(totalReconstituted.toFixed(2)).toBe('530.00');
    });
  });

  describe('Invoice API Endpoints Authorization & Validation', () => {
    it('POST /api/invoices returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).post('/api/invoices').send({
        customerName: 'Customer Test',
        lines: [
          {
            productId: '64b1f2e9a1b2c3d4e5f6a7b8',
            quantity: 1,
            sellingPrice: '100.00',
          },
        ],
        payment: { method: 'cash', cashAmount: '100.00' },
      });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('GET /api/invoices returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).get('/api/invoices');
      expect(res.status).toBe(401);
    });

    it('POST /api/invoices/123/payments returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).post('/api/invoices/123/payments').send({
        method: 'cash',
        cashAmount: '50.00',
      });
      expect(res.status).toBe(401);
    });
  });
});
