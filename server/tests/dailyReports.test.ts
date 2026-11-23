import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/index';
import {
  normalizeIndianMobile,
  normalizeRecipientEmail,
  sendReportViaWhatsApp,
  sendReportViaEmail,
} from '../src/services/reportDeliveryService';
import { generateDailyReportPdf } from '../src/services/dailyReportPdfService';
import { DailyReport } from '../src/models/DailyReport';
import type { DashboardMetrics } from '../src/services/reportService';
import type { IProduct } from '../src/models/Product';

describe('Automated Daily Report Delivery (Phase 6)', () => {
  const mockMetrics: DashboardMetrics = {
    period: 'Today',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    summary: {
      totalSales: '15400.00',
      taxableSales: '14666.67',
      totalCgst: '366.67',
      totalSgst: '366.67',
      invoiceCount: 22,
      cashCollected: '9400.00',
      upiCollected: '5000.00',
      totalCollected: '14400.00',
      outstandingAmount: '1000.00',
      totalCostOfGoodsSold: '11000.00',
      estimatedGrossProfit: '3666.67',
      profitMarginPercent: '25.0',
      canViewProfit: true,
      profitMethodDocumentation:
        'Estimated Gross Profit = Taxable Sales minus Cost of Goods Sold (COGS). Excludes GST.',
    },
    charts: {
      trend: [{ key: '12:00', label: '12:00', sales: 6000, collections: 5000, invoices: 8 }],
      paymentBreakdown: [
        { name: 'Cash', value: 9400, color: '#2E8B57' },
        { name: 'UPI', value: 5000, color: '#3B82F6' },
      ],
      categorySales: [{ category: 'Sweets', sales: 15400, quantity: 45 }],
    },
    topProducts: [
      { productId: '1', name: 'Kaju Katli 500g', unit: 'box', quantitySold: 20, totalRevenue: '8000.00' },
      { productId: '2', name: 'Milk Peda 250g', unit: 'packet', quantitySold: 15, totalRevenue: '3000.00' },
    ],
    inventoryAlerts: {
      totalActiveProducts: 30,
      outOfStockCount: 1,
      lowStockCount: 2,
      lowStockProducts: [
        { id: '1', name: 'Pista Roll', category: 'Sweets', stock: 2, minStockAlert: 5, unit: 'box' },
      ],
      totalStockRetailValue: '65000.00',
      totalStockCostValue: '48000.00',
    },
  };

  const mockProduct = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Kaju Katli 500g',
    category: 'Sweets',
    stock: 25,
    packType: 'box',
    lowStockThreshold: 5,
    sellingPrice: mongoose.Types.Decimal128.fromString('400.00'),
    purchasePrice: mongoose.Types.Decimal128.fromString('300.00'),
    isActive: true,
  } as unknown as IProduct;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hinaya_mariyam_erp');
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Route Security & Authorization Guards', () => {
    it('GET /api/reports/daily returns 401 UNAUTHORIZED when no session exists', async () => {
      const res = await request(app).get('/api/reports/daily');
      expect(res.status).toBe(401);
    });

    it('POST /api/reports/daily/generate returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).post('/api/reports/daily/generate').send({ targetDate: '2026-11-20' });
      expect(res.status).toBe(401);
    });
  });

  describe('Admin Contact Normalization', () => {
    it('normalizes mobile 9698603288 to E.164 +919698603288', () => {
      expect(normalizeIndianMobile('9698603288')).toBe('+919698603288');
      expect(normalizeIndianMobile('919698603288')).toBe('+919698603288');
      expect(normalizeIndianMobile('+91 96986 03288')).toBe('+919698603288');
    });

    it('normalizes recipient email to valid address', () => {
      expect(normalizeRecipientEmail('9698603288')).toBe('9698603288@gmail.com');
      expect(normalizeRecipientEmail('sivaprakashs127@gmail.com')).toBe('sivaprakashs127@gmail.com');
    });
  });

  describe('3-Page Official Daily PDF Report Generator', () => {
    it('compiles a multi-page A4 document matching Section 11 specifications', (done) => {
      const doc = generateDailyReportPdf({
        businessName: 'HINAYA MARIYAM',
        reportDateStr: '2026-11-20',
        metrics: mockMetrics,
        activeProducts: [mockProduct],
        purchasesToday: [],
        adjustmentsToday: [],
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdf = Buffer.concat(chunks);
        // Valid PDF magic header
        expect(pdf.toString('utf-8', 0, 5)).toBe('%PDF-');
        // Comprehensive 3-page document should exceed 5KB
        expect(pdf.length).toBeGreaterThan(5000);
        done();
      });
      doc.end();
    });
  });

  describe('Delivery Invariants & Truthful Status Reporting', () => {
    it('marks WhatsApp delivery as disabled when credentials are unset in test environment', async () => {
      const dummyBuffer = Buffer.from('test pdf content');
      const result = await sendReportViaWhatsApp(dummyBuffer, 'test.pdf', '9698603288');

      expect(result.status).toBe('disabled');
      expect(result.recipient).toBe('+919698603288');
      expect(result.error).toContain('WhatsApp Business Cloud API');
    });

    it('marks Email delivery as disabled when SMTP credentials are unset in test environment', async () => {
      const dummyBuffer = Buffer.from('test pdf content');
      const result = await sendReportViaEmail(dummyBuffer, 'test.pdf', '9698603288');

      expect(result.status).toBe('disabled');
      expect(result.recipient).toBe('9698603288@gmail.com');
      expect(result.error).toContain('SMTP host/user not configured');
    });
  });

  describe('Database Duplicate Prevention (Section 11 Invariant)', () => {
    it('enforces unique index on reportDate preventing duplicate daily reports', async () => {
      const testDate = '2099-01-01';

      // Clean up if left from previous runs
      await DailyReport.deleteMany({ reportDate: testDate });

      // First creation succeeds
      const report1 = await DailyReport.create({
        reportDate: testDate,
        status: 'completed',
        triggeredBy: 'manual',
      });
      expect(report1.reportDate).toBe(testDate);

      // Attempting to create another report for same date throws duplicate key error
      let errorThrown = false;
      try {
        await DailyReport.create({
          reportDate: testDate,
          status: 'completed',
          triggeredBy: 'scheduler',
        });
      } catch (err: unknown) {
        errorThrown = true;
        // Mongo duplicate key error code 11000
        expect((err as { code?: number }).code).toBe(11000);
      }
      expect(errorThrown).toBe(true);

      // Clean up test entry
      await DailyReport.deleteMany({ reportDate: testDate });
    });
  });
});
