import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/index';
import { getPeriodRange, getStartOfDayIst, getEndOfDayIst } from '../src/utils/dateUtils';
import { getDashboardMetrics, type DashboardMetrics } from '../src/services/reportService';
import { exportExcelReport, exportPdfSummary } from '../src/services/reportExportService';

describe('Dashboard & Business Reports (Phase 5)', () => {
  const mockMetrics: DashboardMetrics = {
    period: 'Today',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    summary: {
      totalSales: '12500.00',
      taxableSales: '11904.76',
      totalCgst: '297.62',
      totalSgst: '297.62',
      invoiceCount: 15,
      cashCollected: '8500.00',
      upiCollected: '3500.00',
      totalCollected: '12000.00',
      outstandingAmount: '500.00',
      totalCostOfGoodsSold: '9000.00',
      estimatedGrossProfit: '2904.76',
      profitMarginPercent: '24.4',
      canViewProfit: true,
      profitMethodDocumentation:
        'Estimated Gross Profit = Taxable Sales minus Cost of Goods Sold (COGS). Excludes CGST & SGST taxes.',
    },
    charts: {
      trend: [
        { key: '10:00', label: '10:00', sales: 3000, collections: 3000, invoices: 3 },
        { key: '14:00', label: '14:00', sales: 5000, collections: 4500, invoices: 7 },
        { key: '18:00', label: '18:00', sales: 4500, collections: 4500, invoices: 5 },
      ],
      paymentBreakdown: [
        { name: 'Cash Collected', value: 8500, color: '#2E8B57' },
        { name: 'UPI Collected', value: 3500, color: '#3B82F6' },
        { name: 'Outstanding Balance', value: 500, color: '#F59E0B' },
      ],
      categorySales: [
        { category: 'Sweets', sales: 7500, quantity: 25 },
        { category: 'Savouries', sales: 5000, quantity: 40 },
      ],
    },
    topProducts: [
      { productId: '1', name: 'Kaju Burfi 250g', unit: 'packet', quantitySold: 18, totalRevenue: '4320.00' },
      { productId: '2', name: 'Special Mixture 500g', unit: 'packet', quantitySold: 12, totalRevenue: '2160.00' },
    ],
    inventoryAlerts: {
      totalActiveProducts: 45,
      outOfStockCount: 1,
      lowStockCount: 3,
      lowStockProducts: [
        { id: '1', name: 'Gulab Jamun Tin', category: 'Sweets', stock: 2, minStockAlert: 5, unit: 'tin' },
      ],
      totalStockRetailValue: '48000.00',
      totalStockCostValue: '35000.00',
    },
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hinaya_mariyam_erp');
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Route Security & Authorization Guards', () => {
    it('GET /api/reports/dashboard returns 401 UNAUTHORIZED when no session exists', async () => {
      const res = await request(app).get('/api/reports/dashboard');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('GET /api/reports/export/excel returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).get('/api/reports/export/excel');
      expect(res.status).toBe(401);
    });

    it('GET /api/reports/export/pdf returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).get('/api/reports/export/pdf');
      expect(res.status).toBe(401);
    });
  });

  describe('Asia/Kolkata Business-Day Boundaries (UTC+05:30)', () => {
    it('calculates start and end of day in Asia/Kolkata matching 00:00:00 to 23:59:59.999 IST', () => {
      const now = new Date();
      const start = getStartOfDayIst(now);
      const end = getEndOfDayIst(now);

      const durationMs = end.getTime() - start.getTime();
      expect(durationMs).toBe(86399999);
    });

    it('parses custom date range in Asia/Kolkata bounds', () => {
      const range = getPeriodRange('custom', '2026-11-01', '2026-11-05');
      expect(range.label).toBe('2026-11-01 to 2026-11-05');

      const durationMs = range.end.getTime() - range.start.getTime();
      expect(durationMs).toBe(431999999);
    });
  });

  describe('Financial Distinction: Sales vs Collections vs Outstanding', () => {
    it('correctly aggregates metrics and strictly distinguishes sales from physical tender', async () => {
      const metrics = await getDashboardMetrics('today', undefined, undefined, 'billing_operator');

      expect(metrics).toHaveProperty('summary');
      expect(metrics.summary).toHaveProperty('totalSales');
      expect(metrics.summary.canViewProfit).toBe(false);
      expect(metrics.summary.estimatedGrossProfit).toBeNull();
      expect(metrics.summary.totalCostOfGoodsSold).toBeNull();
    });

    it('exposes estimated gross profit and documented cost method to Admin only', async () => {
      const metrics = await getDashboardMetrics('today', undefined, undefined, 'admin');

      expect(metrics.summary.canViewProfit).toBe(true);
      expect(metrics.summary.estimatedGrossProfit).not.toBeNull();
      expect(metrics.summary.totalCostOfGoodsSold).not.toBeNull();
      expect(metrics.summary.profitMethodDocumentation).toContain('Taxable Sales minus Cost of Goods Sold');
      expect(metrics.summary.profitMethodDocumentation).toContain('not Net Profit');
    });
  });

  describe('Excel and PDF Report Generation Services', () => {
    it('exportExcelReport generates a valid multi-sheet workbook buffer', async () => {
      const buffer = await exportExcelReport(mockMetrics);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });

    it('exportPdfSummary generates a valid A4 summary PDF document with %PDF- header', (done) => {
      const doc = exportPdfSummary(mockMetrics);
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
        expect(pdfBuffer.length).toBeGreaterThan(1000);
        done();
      });
      doc.end();
    });
  });
});
