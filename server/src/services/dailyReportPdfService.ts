import PDFDocument from 'pdfkit';
import type { DashboardMetrics } from './reportService';
import type { IProduct } from '../models/Product';
import type { IPurchaseEntry } from '../models/PurchaseEntry';
import type { IStockMovement } from '../models/StockMovement';
import { formatIstDateTime } from '../utils/dateUtils';

export interface DailyReportPdfData {
  businessName?: string;
  reportDateStr: string; // 'YYYY-MM-DD'
  metrics: DashboardMetrics;
  activeProducts: IProduct[];
  purchasesToday: IPurchaseEntry[];
  adjustmentsToday: IStockMovement[];
}

/**
 * Generates the official 3-Page Daily Business Report PDF per Project Brief Section 11.
 * - Page 1: Sales, collections, gross profit, GST, visual charts, top products.
 * - Page 2: Complete active product inventory table with stock status.
 * - Page 3: Purchase entries, incoming stock, manual adjustments, and restocking alerts.
 */
export function generateDailyReportPdf(data: DailyReportPdfData): InstanceType<typeof PDFDocument> {
  const businessName = data.businessName || 'INAAYA ENTERPRISES';
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    autoFirstPage: true,
    info: {
      Title: `${businessName} Daily Performance Report - ${data.reportDateStr}`,
      Author: businessName,
      Subject: 'Official Daily Business, Inventory & Audit Report',
    },
  });

  const primaryColor = '#2E8B57';
  const darkColor = '#206B45';
  const lightBg = '#E8F5EC';
  const textDark = '#1F2937';
  const textMuted = '#4B5563';
  const grayBorder = '#E5E7EB';

  const drawHeader = (pageNum: number, title: string) => {
    doc.rect(36, 36, 523, 56).fill(primaryColor);
    doc.fillColor('#FFFFFF');
    doc.font('Helvetica-Bold').fontSize(18).text(businessName, 50, 46);
    doc.font('Helvetica').fontSize(10).text(title.toUpperCase(), 50, 68);
    doc.fontSize(8).text(`Date: ${data.reportDateStr} (Asia/Kolkata)`, 330, 48, { align: 'right', width: 215 });
    doc.text(`Page ${pageNum} of 3 • Generated: ${formatIstDateTime(new Date())}`, 330, 64, {
      align: 'right',
      width: 215,
    });
  };

  const drawFooter = (note: string) => {
    doc.rect(36, 780, 523, 26).fill('#F9FAFB');
    doc.fillColor(textMuted).font('Helvetica').fontSize(7.5);
    doc.text(
      `INAAYA ENTERPRISES ERP • Official Executive Report • ${note}`,
      46,
      788,
      { width: 503, align: 'center' }
    );
  };

  // ═════════════════════════════════════════════════════════════
  // ── PAGE 1: Executive Sales & Daily Summary ─────────────────
  // ═════════════════════════════════════════════════════════════
  drawHeader(1, 'Daily Sales & Financial Performance Summary');

  let y = 106;

  // 1. KPI Cards Grid (2 rows x 3 columns)
  const cardW = 168;
  const cardH = 50;
  const kpis = [
    {
      title: 'TOTAL INVOICED SALES',
      val: `₹${data.metrics.summary.totalSales}`,
      sub: `${data.metrics.summary.invoiceCount} invoices generated`,
    },
    {
      title: 'ACTUAL COLLECTIONS',
      val: `₹${data.metrics.summary.totalCollected}`,
      sub: `Cash: ₹${data.metrics.summary.cashCollected} | UPI: ₹${data.metrics.summary.upiCollected}`,
    },
    {
      title: 'OUTSTANDING RECEIVABLES',
      val: `₹${data.metrics.summary.outstandingAmount}`,
      sub: Number(data.metrics.summary.outstandingAmount) > 0 ? 'Pending customer payment' : 'Fully collected',
    },
    {
      title: 'EST. GROSS PROFIT (ADMIN)',
      val: `₹${data.metrics.summary.estimatedGrossProfit || '0.00'}`,
      sub: `Margin: ${data.metrics.summary.profitMarginPercent || '0.0'}% (Taxable - COGS)`,
    },
    {
      title: 'GST TAX REMITTANCE',
      val: `₹${(Number(data.metrics.summary.totalCgst) + Number(data.metrics.summary.totalSgst)).toFixed(2)}`,
      sub: `CGST: ₹${data.metrics.summary.totalCgst} | SGST: ₹${data.metrics.summary.totalSgst}`,
    },
    {
      title: 'INVENTORY VALUATION',
      val: `₹${data.metrics.inventoryAlerts.totalStockRetailValue}`,
      sub: `${data.metrics.inventoryAlerts.totalActiveProducts} active products in stock`,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx = 36 + col * (cardW + 9);
    const cy = y + row * (cardH + 8);

    doc.rect(cx, cy, cardW, cardH).fillAndStroke('#FFFFFF', grayBorder);
    doc.fillColor(textMuted).font('Helvetica').fontSize(7.5).text(kpi.title, cx + 8, cy + 7);
    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(12).text(kpi.val, cx + 8, cy + 20);
    doc.fillColor(primaryColor).font('Helvetica').fontSize(7.5).text(kpi.sub, cx + 8, cy + 36);
  });

  y += 2 * (cardH + 8) + 12;

  // 2. GST Breakdown Table
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('GST Tax Decomposition', 36, y);
  y += 15;

  doc.rect(36, y, 523, 20).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8);
  doc.text('Taxable Subtotal (Net Sales)', 46, y + 6);
  doc.text('CGST (Central Tax)', 210, y + 6);
  doc.text('SGST (State Tax)', 340, y + 6);
  doc.text('Total Invoice (Gross Sales)', 440, y + 6);

  y += 20;
  doc.rect(36, y, 523, 20).stroke(grayBorder);
  doc.fillColor(textDark).font('Helvetica').fontSize(8.5);
  doc.text(`₹${data.metrics.summary.taxableSales}`, 46, y + 6);
  doc.text(`₹${data.metrics.summary.totalCgst}`, 210, y + 6);
  doc.text(`₹${data.metrics.summary.totalSgst}`, 340, y + 6);
  doc.text(`₹${data.metrics.summary.totalSales}`, 440, y + 6);

  y += 30;

  // 3. Visual Performance Chart Summary (Rendered from real data)
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('Tender Mix & Sales Hourly Trend', 36, y);
  y += 15;

  // Payment Breakdown Bars
  const totalColl = Number(data.metrics.summary.totalCollected) || 1;
  const cashVal = Number(data.metrics.summary.cashCollected) || 0;
  const upiVal = Number(data.metrics.summary.upiCollected) || 0;
  const cashPct = Math.round((cashVal / totalColl) * 100);
  const upiPct = 100 - cashPct;

  doc.rect(36, y, 523, 24).fillAndStroke('#F9FAFB', grayBorder);
  doc.fillColor(textDark).font('Helvetica-Bold').fontSize(8).text('Tender Mix:', 46, y + 7);

  // Cash bar
  const barTotalW = 380;
  const cashW = Math.max(8, Math.round((cashPct / 100) * barTotalW));
  const upiW = barTotalW - cashW;
  doc.rect(130, y + 5, cashW, 14).fill(primaryColor);
  doc.rect(130 + cashW, y + 5, upiW, 14).fill('#3B82F6');

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
  if (cashW > 35) doc.text(`Cash ${cashPct}%`, 134, y + 8);
  if (upiW > 35) doc.text(`UPI ${upiPct}%`, 134 + cashW + 4, y + 8);

  y += 35;

  // 4. Top Selling Products
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('Top Selling Products Today', 36, y);
  y += 15;

  doc.rect(36, y, 523, 18).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8);
  doc.text('#', 46, y + 5);
  doc.text('PRODUCT NAME', 70, y + 5);
  doc.text('UNIT', 310, y + 5);
  doc.text('QTY SOLD', 380, y + 5);
  doc.text('REVENUE (₹)', 460, y + 5);

  y += 18;
  const topList = data.metrics.topProducts.slice(0, 7);
  if (topList.length === 0) {
    doc.fillColor(textMuted).font('Helvetica-Oblique').fontSize(8).text('No items sold today yet.', 46, y + 8);
    y += 24;
  } else {
    topList.forEach((prod, i) => {
      doc.rect(36, y, 523, 18).fillAndStroke(i % 2 === 0 ? '#FFFFFF' : '#F9FAFB', grayBorder);
      doc.fillColor(textDark).font('Helvetica').fontSize(8);
      doc.text(`${i + 1}`, 46, y + 5);
      doc.text(prod.name, 70, y + 5, { width: 230, ellipsis: true });
      doc.text(prod.unit, 310, y + 5);
      doc.text(`${prod.quantitySold}`, 380, y + 5);
      doc.text(`₹${prod.totalRevenue}`, 460, y + 5);
      y += 18;
    });
  }

  // Accounting footnote
  y = 735;
  doc.rect(36, y, 523, 38).fill('#F3F4F6');
  doc.fillColor(textMuted).font('Helvetica').fontSize(7);
  doc.text(
    'Accounting Note: Estimated Gross Profit = Taxable Sales - Cost of Goods Sold (COGS). Excludes GST. ' +
      'Physical cash and UPI collections represent actual cash tender distinct from invoiced sales. ' +
      'Confidential business record.',
    46,
    y + 6,
    { width: 503, lineGap: 2 }
  );

  drawFooter('Page 1: Sales & Financial Highlights');

  // ═════════════════════════════════════════════════════════════
  // ── PAGE 2: Complete Active Product Inventory Table ─────────
  // ═════════════════════════════════════════════════════════════
  doc.addPage();
  drawHeader(2, 'Complete Active Product Inventory & Stock Health');

  y = 106;
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('Active Products Catalog & Status', 36, y);
  y += 15;

  doc.rect(36, y, 523, 18).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8);
  doc.text('SERIAL / CODE', 44, y + 5);
  doc.text('PRODUCT NAME', 120, y + 5);
  doc.text('CATEGORY', 270, y + 5);
  doc.text('STOCK', 365, y + 5);
  doc.text('SELLING PRICE', 420, y + 5);
  doc.text('STATUS', 485, y + 5);

  y += 18;
  const products = data.activeProducts || [];
  const maxProds = 32; // Fit comfortably on page 2 table

  for (let i = 0; i < Math.min(products.length, maxProds); i++) {
    const p = products[i];
    const stock = p.stock || 0;
    const alertThreshold = p.lowStockThreshold || 5;
    const isOut = stock <= 0;
    const isLow = !isOut && stock <= alertThreshold;

    doc.rect(36, y, 523, 17).fillAndStroke(i % 2 === 0 ? '#FFFFFF' : '#F9FAFB', grayBorder);
    doc.fillColor(textDark).font('Helvetica').fontSize(7.5);
    doc.text(p.sapCode || p.serialNumber || `P-${String(i + 1).padStart(3, '0')}`, 44, y + 4.5, {
      width: 70,
      ellipsis: true,
    });
    doc.text(p.name, 120, y + 4.5, { width: 145, ellipsis: true });
    doc.text(p.category || 'General', 270, y + 4.5, { width: 90, ellipsis: true });
    doc.text(`${stock} ${p.packType || 'unit'}`, 365, y + 4.5);
    doc.text(`₹${Number(p.sellingPrice?.toString() || 0).toFixed(2)}`, 420, y + 4.5);

    if (isOut) {
      doc.fillColor('#DC2626').font('Helvetica-Bold').text('OUT OF STOCK', 485, y + 4.5);
    } else if (isLow) {
      doc.fillColor('#D97706').font('Helvetica-Bold').text('LOW STOCK', 485, y + 4.5);
    } else {
      doc.fillColor('#059669').font('Helvetica').text('IN STOCK', 485, y + 4.5);
    }

    y += 17;
  }

  if (products.length > maxProds) {
    doc.fillColor(textMuted).font('Helvetica-Oblique').fontSize(7.5).text(
      `...and ${products.length - maxProds} additional active products. See web portal for complete directory.`,
      44,
      y + 6
    );
  }

  drawFooter('Page 2: Inventory Directory & Stock Levels');

  // ═════════════════════════════════════════════════════════════
  // ── PAGE 3: Movements, Purchases & Restocking Alerts ────────
  // ═════════════════════════════════════════════════════════════
  doc.addPage();
  drawHeader(3, 'Purchases, Stock Movements & Restocking Alerts');

  y = 106;

  // 1. Purchases & Incoming Stock
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('1. Incoming Stock & Purchases Today', 36, y);
  y += 15;

  doc.rect(36, y, 523, 18).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8);
  doc.text('SUPPLIER / REF', 44, y + 5);
  doc.text('PRODUCT', 160, y + 5);
  doc.text('CARTONS', 330, y + 5);
  doc.text('UNITS ADDED', 400, y + 5);
  doc.text('COST / UNIT', 475, y + 5);

  y += 18;
  const purchases = data.purchasesToday || [];
  if (purchases.length === 0) {
    doc.rect(36, y, 523, 20).stroke(grayBorder);
    doc.fillColor(textMuted).font('Helvetica-Oblique').fontSize(8).text(
      'No incoming supplier purchases recorded today.',
      44,
      y + 6
    );
    y += 24;
  } else {
    purchases.slice(0, 6).forEach((pur, i) => {
      doc.rect(36, y, 523, 18).fillAndStroke(i % 2 === 0 ? '#FFFFFF' : '#F9FAFB', grayBorder);
      doc.fillColor(textDark).font('Helvetica').fontSize(8);
      doc.text(pur.notes || 'Direct Stock-in', 44, y + 5, {
        width: 110,
        ellipsis: true,
      });
      doc.text(pur.productName || 'Stock entry', 160, y + 5, { width: 160, ellipsis: true });
      doc.text(`${pur.purchaseQty || 0} ${pur.purchaseUnit || 'carton'}`, 330, y + 5);
      doc.text(`+${pur.unitQtyAdded || 0}`, 400, y + 5);
      doc.text(`₹${Number(pur.purchaseCost?.toString() || 0).toFixed(2)}`, 475, y + 5);
      y += 18;
    });
  }

  y += 15;

  // 2. Manual Stock Adjustments
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('2. Manual Stock Adjustments & Corrections', 36, y);
  y += 15;

  doc.rect(36, y, 523, 18).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8);
  doc.text('TIME', 44, y + 5);
  doc.text('TYPE', 95, y + 5);
  doc.text('QTY', 150, y + 5);
  doc.text('BALANCE', 200, y + 5);
  doc.text('REASON / NOTE', 270, y + 5);

  y += 18;
  const adjustments = data.adjustmentsToday || [];
  if (adjustments.length === 0) {
    doc.rect(36, y, 523, 20).stroke(grayBorder);
    doc.fillColor(textMuted).font('Helvetica-Oblique').fontSize(8).text(
      'No manual adjustments or damage reports recorded today.',
      44,
      y + 6
    );
    y += 24;
  } else {
    adjustments.slice(0, 6).forEach((adj, i) => {
      doc.rect(36, y, 523, 18).fillAndStroke(i % 2 === 0 ? '#FFFFFF' : '#F9FAFB', grayBorder);
      doc.fillColor(textDark).font('Helvetica').fontSize(8);
      doc.text(formatIstDateTime(new Date(adj.createdAt)).substring(12), 44, y + 5);
      doc.text(adj.movementType, 95, y + 5);
      doc.text(adj.delta > 0 ? `+${adj.delta}` : `${adj.delta}`, 150, y + 5);
      doc.text(`${adj.stockAfter}`, 200, y + 5);
      doc.text(adj.reason || 'Inventory correction', 270, y + 5, { width: 270, ellipsis: true });
      y += 18;
    });
  }

  y += 15;

  // 3. Urgent Restocking Alerts
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('3. Urgent Restocking Alerts', 36, y);
  y += 15;

  const lowAlerts = data.metrics.inventoryAlerts.lowStockProducts || [];
  doc.rect(36, y, 523, 18).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8);
  doc.text('PRODUCT NAME', 44, y + 5);
  doc.text('CATEGORY', 240, y + 5);
  doc.text('CURRENT STOCK', 350, y + 5);
  doc.text('MIN THRESHOLD', 420, y + 5);
  doc.text('SEVERITY', 485, y + 5);

  y += 18;
  if (lowAlerts.length === 0) {
    doc.rect(36, y, 523, 20).stroke(grayBorder);
    doc.fillColor('#059669').font('Helvetica').fontSize(8).text(
      '✓ No critical inventory shortages. All products are above minimum alert levels.',
      44,
      y + 6
    );
    y += 24;
  } else {
    lowAlerts.slice(0, 8).forEach((item, i) => {
      doc.rect(36, y, 523, 18).fillAndStroke(i % 2 === 0 ? '#FFFFFF' : '#F9FAFB', grayBorder);
      doc.fillColor(textDark).font('Helvetica').fontSize(8);
      doc.text(item.name, 44, y + 5, { width: 190, ellipsis: true });
      doc.text(item.category, 240, y + 5, { width: 100, ellipsis: true });
      doc.text(`${item.stock} ${item.unit}`, 350, y + 5);
      doc.text(`${item.minStockAlert} ${item.unit}`, 420, y + 5);

      if (item.stock <= 0) {
        doc.fillColor('#DC2626').font('Helvetica-Bold').text('CRITICAL', 485, y + 5);
      } else {
        doc.fillColor('#D97706').font('Helvetica-Bold').text('WARNING', 485, y + 5);
      }
      y += 18;
    });
  }

  // Verification & Sign-off footer
  y = 720;
  doc.rect(36, y, 523, 50).fill('#F9FAFB');
  doc.fillColor(textDark).font('Helvetica-Bold').fontSize(8).text('End-of-Day Operations Verification', 46, y + 8);
  doc.fillColor(textMuted).font('Helvetica').fontSize(7.5).text(
    `This 3-page daily report was automatically compiled by HINAYA MARIYAM ERP on ${formatIstDateTime(
      new Date()
    )} (Asia/Kolkata). ` +
      'Delivered to registered administrator mobile +91 9698603288 and authorized administrative email channel. ' +
      'Data integrity strictly protected by append-only ledger.',
    46,
    y + 20,
    { width: 503, lineGap: 1.5 }
  );

  drawFooter('Page 3: Procurement, Movements & Alerts');

  return doc;
}
