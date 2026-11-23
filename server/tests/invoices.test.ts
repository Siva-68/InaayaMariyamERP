import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/index';
import { generateInvoicePdf } from '../src/services/pdfService';
import { Invoice } from '../src/models/Invoice';

describe('Past Invoices & A4 PDF Generator', () => {
  describe('PDF Generation Service (pdfkit)', () => {
    it('generates a valid A4 PDF document stream with correct PDF header', (done) => {
      // Create a mock invoice document for rendering
      const mockInvoice = new Invoice({
        invoiceNumber: 'HM/2026/000001',
        customerName: 'Ahmad Khan',
        customerMobile: '9876543210',
        status: 'finalized',
        lines: [
          {
            lineNumber: 1,
            productId: new mongoose.Types.ObjectId(),
            productName: 'Kaju Burfi 250g',
            unit: 'packet',
            quantity: 2,
            sellingPrice: mongoose.Types.Decimal128.fromString('240.00'),
            gstRate: 5,
            taxableAmount: mongoose.Types.Decimal128.fromString('457.14'),
            cgst: mongoose.Types.Decimal128.fromString('11.43'),
            sgst: mongoose.Types.Decimal128.fromString('11.43'),
            lineTotal: mongoose.Types.Decimal128.fromString('480.00'),
          },
        ],
        subtotalTaxable: mongoose.Types.Decimal128.fromString('457.14'),
        totalCgst: mongoose.Types.Decimal128.fromString('11.43'),
        totalSgst: mongoose.Types.Decimal128.fromString('11.43'),
        grandTotal: mongoose.Types.Decimal128.fromString('480.00'),
        amountPaid: mongoose.Types.Decimal128.fromString('480.00'),
        outstandingAmount: mongoose.Types.Decimal128.fromString('0.00'),
        billedBy: new mongoose.Types.ObjectId(),
        invoicedAt: new Date(),
        finalizedAt: new Date(),
      });

      const doc = generateInvoicePdf(mockInvoice);
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        // Standard PDF signature starts with %PDF-
        expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
        expect(pdfBuffer.length).toBeGreaterThan(1000);
        done();
      });
      doc.end();
    });
  });

  describe('Invoice Security & Immutability Invariants', () => {
    it('GET /api/invoices/:id/pdf returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).get('/api/invoices/64b1f2e9a1b2c3d4e5f6a7b8/pdf');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('PUT /api/invoices/:id is not permitted (returns 404 - endpoint does not exist)', async () => {
      const res = await request(app).put('/api/invoices/64b1f2e9a1b2c3d4e5f6a7b8').send({
        customerName: 'Modified Name',
      });
      // Finalized invoices are strictly immutable. No PUT/PATCH routes exist.
      expect(res.status).toBe(404);
    });

    it('DELETE /api/invoices/:id is not permitted (returns 404 - endpoint does not exist)', async () => {
      const res = await request(app).delete('/api/invoices/64b1f2e9a1b2c3d4e5f6a7b8');
      expect(res.status).toBe(404);
    });
  });
});
