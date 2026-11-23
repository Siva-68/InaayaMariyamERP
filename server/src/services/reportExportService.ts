import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { DashboardMetrics } from './reportService';
import { formatIstDateTime } from '../utils/dateUtils';

/**
 * Generates a multi-sheet formatted Excel workbook (.xlsx) from dashboard metrics
 */
export async function exportExcelReport(
  metrics: DashboardMetrics,
  businessName: string = 'INAAYA ENTERPRISES'
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = businessName;
  workbook.created = new Date();

  const brandGreen = '2E8B57';
  const lightGreen = 'E8F5EC';
  const headerFont = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: brandGreen },
  };

  // ── Sheet 1: Executive KPI Summary ──────────────────────────
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Value (₹ / Count)', key: 'value', width: 24 },
    { header: 'Notes', key: 'notes', width: 45 },
  ];
  summarySheet.getRow(1).font = headerFont;
  summarySheet.getRow(1).fill = headerFill;

  summarySheet.addRow({
    metric: 'Reporting Period',
    value: metrics.period,
    notes: `${metrics.startDate} to ${metrics.endDate} (Asia/Kolkata)`,
  });
  summarySheet.addRow({
    metric: 'Total Invoiced Sales (Gross)',
    value: `₹${metrics.summary.totalSales}`,
    notes: 'Total value of finalized invoices including GST',
  });
  summarySheet.addRow({
    metric: 'Taxable Sales (Net)',
    value: `₹${metrics.summary.taxableSales}`,
    notes: 'Tax-exclusive sales subtotal',
  });
  summarySheet.addRow({
    metric: 'Total CGST (Central Tax)',
    value: `₹${metrics.summary.totalCgst}`,
    notes: 'Collected for government remittance',
  });
  summarySheet.addRow({
    metric: 'Total SGST (State Tax)',
    value: `₹${metrics.summary.totalSgst}`,
    notes: 'Collected for government remittance',
  });
  summarySheet.addRow({
    metric: 'Total Invoices Finalized',
    value: metrics.summary.invoiceCount,
    notes: 'Count of unique bill transactions',
  });
  summarySheet.addRow({
    metric: 'Physical Cash Collected',
    value: `₹${metrics.summary.cashCollected}`,
    notes: 'Actual cash in drawer received in period',
  });
  summarySheet.addRow({
    metric: 'UPI Payments Collected',
    value: `₹${metrics.summary.upiCollected}`,
    notes: 'Bank/UPI QR collections received in period',
  });
  summarySheet.addRow({
    metric: 'Total Collections',
    value: `₹${metrics.summary.totalCollected}`,
    notes: 'Physical Cash + Digital UPI',
  });
  summarySheet.addRow({
    metric: 'Outstanding Receivables',
    value: `₹${metrics.summary.outstandingAmount}`,
    notes: 'Pending customer balance from period invoices',
  });

  if (metrics.summary.canViewProfit) {
    summarySheet.addRow({
      metric: 'Cost of Goods Sold (COGS)',
      value: `₹${metrics.summary.totalCostOfGoodsSold}`,
      notes: 'Total snapshot purchase cost of goods sold',
    });
    summarySheet.addRow({
      metric: 'Estimated Gross Profit',
      value: `₹${metrics.summary.estimatedGrossProfit}`,
      notes: 'Taxable Sales minus COGS (Not Net Profit)',
    });
    summarySheet.addRow({
      metric: 'Gross Profit Margin',
      value: `${metrics.summary.profitMarginPercent}%`,
      notes: 'Estimated Gross Margin on Taxable Sales',
    });
  }

  // ── Sheet 2: Trend Data ─────────────────────────────────────
  const trendSheet = workbook.addWorksheet('Trend Data');
  trendSheet.columns = [
    { header: 'Interval / Date', key: 'label', width: 20 },
    { header: 'Invoiced Sales (₹)', key: 'sales', width: 22 },
    { header: 'Collections (₹)', key: 'collections', width: 22 },
    { header: 'Invoice Count', key: 'invoices', width: 16 },
  ];
  trendSheet.getRow(1).font = headerFont;
  trendSheet.getRow(1).fill = headerFill;

  for (const t of metrics.charts.trend) {
    trendSheet.addRow({
      label: t.label,
      sales: t.sales,
      collections: t.collections,
      invoices: t.invoices,
    });
  }

  // ── Sheet 3: Top Selling Products ───────────────────────────
  const prodSheet = workbook.addWorksheet('Top Products');
  prodSheet.columns = [
    { header: 'Rank', key: 'rank', width: 10 },
    { header: 'Product Name', key: 'name', width: 35 },
    { header: 'Unit', key: 'unit', width: 14 },
    { header: 'Quantity Sold', key: 'quantity', width: 18 },
    { header: 'Revenue (₹)', key: 'revenue', width: 20 },
  ];
  prodSheet.getRow(1).font = headerFont;
  prodSheet.getRow(1).fill = headerFill;

  metrics.topProducts.forEach((p, idx) => {
    prodSheet.addRow({
      rank: idx + 1,
      name: p.name,
      unit: p.unit,
      quantity: p.quantitySold,
      revenue: `₹${p.totalRevenue}`,
    });
  });

  // ── Sheet 4: Inventory & Alerts ─────────────────────────────
  const invSheet = workbook.addWorksheet('Inventory & Low Stock');
  invSheet.columns = [
    { header: 'Product Name', key: 'name', width: 35 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Current Stock', key: 'stock', width: 16 },
    { header: 'Alert Level', key: 'alert', width: 16 },
    { header: 'Unit', key: 'unit', width: 14 },
    { header: 'Status', key: 'status', width: 18 },
  ];
  invSheet.getRow(1).font = headerFont;
  invSheet.getRow(1).fill = headerFill;

  for (const p of metrics.inventoryAlerts.lowStockProducts) {
    invSheet.addRow({
      name: p.name,
      category: p.category,
      stock: p.stock,
      alert: p.minStockAlert,
      unit: p.unit,
      status: p.stock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK',
    });
  }

  const uint8 = await workbook.xlsx.writeBuffer();
  return Buffer.from(uint8);
}

/**
 * Generates an executive A4 PDF summary from dashboard metrics using PDFKit
 */
export function exportPdfSummary(
  metrics: DashboardMetrics,
  businessName: string = 'HINAYA MARIYAM'
): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `${businessName} - Business Summary (${metrics.period})`,
      Author: businessName,
      Subject: 'Sales, Collections & Inventory Report',
    },
  });

  const primaryColor = '#2E8B57';
  const darkColor = '#206B45';
  const lightBg = '#E8F5EC';
  const textDark = '#1F2937';
  const textMuted = '#4B5563';

  // ── Header Banner ───────────────────────────────────────────
  doc.rect(40, 40, 515, 65).fill(primaryColor);
  doc.fillColor('#FFFFFF');
  doc.font('Helvetica-Bold').fontSize(20).text(businessName, 55, 52);
  doc.font('Helvetica').fontSize(11).text('EXECUTIVE BUSINESS PERFORMANCE REPORT', 55, 76);
  doc.fontSize(9).text(
    `Period: ${metrics.period} (${metrics.startDate} to ${metrics.endDate})`,
    320,
    56,
    { align: 'right', width: 220 }
  );
  doc.text(`Generated: ${formatIstDateTime(new Date())}`, 320, 72, { align: 'right', width: 220 });

  let y = 120;

  // ── Section 1: Key Financial Highlights ─────────────────────
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(13).text('1. Financial & Sales Overview', 40, y);
  y += 20;

  // 2x3 Grid of KPI summary boxes
  const cardW = 165;
  const cardH = 50;
  const kpis = [
    { label: 'Total Invoiced Sales', val: `₹${metrics.summary.totalSales}`, sub: `${metrics.summary.invoiceCount} bills` },
    { label: 'Total Collections', val: `₹${metrics.summary.totalCollected}`, sub: `Cash + UPI` },
    { label: 'Outstanding Balance', val: `₹${metrics.summary.outstandingAmount}`, sub: 'Receivables' },
    { label: 'Cash In Drawer', val: `₹${metrics.summary.cashCollected}`, sub: 'Physical tender' },
    { label: 'Digital UPI', val: `₹${metrics.summary.upiCollected}`, sub: 'Instant bank transfer' },
    {
      label: metrics.summary.canViewProfit ? 'Est. Gross Profit' : 'GST Collected',
      val: metrics.summary.canViewProfit
        ? `₹${metrics.summary.estimatedGrossProfit}`
        : `₹${(Number(metrics.summary.totalCgst) + Number(metrics.summary.totalSgst)).toFixed(2)}`,
      sub: metrics.summary.canViewProfit ? `${metrics.summary.profitMarginPercent}% Margin` : 'CGST + SGST',
    },
  ];

  kpis.forEach((kpi, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx = 40 + col * (cardW + 10);
    const cy = y + row * (cardH + 10);

    doc.rect(cx, cy, cardW, cardH).fillAndStroke('#F9FAFB', '#E5E7EB');
    doc.fillColor(textMuted).font('Helvetica').fontSize(8).text(kpi.label.toUpperCase(), cx + 8, cy + 8);
    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(12).text(kpi.val, cx + 8, cy + 22);
    doc.fillColor(primaryColor).font('Helvetica').fontSize(8).text(kpi.sub, cx + 8, cy + 37);
  });

  y += 2 * (cardH + 10) + 15;

  // ── Section 2: GST Summary ──────────────────────────────────
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(13).text('2. GST & Tax Decomposition', 40, y);
  y += 18;

  doc.rect(40, y, 515, 24).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(9);
  doc.text('Taxable Value (Subtotal)', 50, y + 7);
  doc.text('CGST (Central Tax)', 220, y + 7);
  doc.text('SGST (State Tax)', 350, y + 7);
  doc.text('Total Invoice (Gross)', 440, y + 7);

  y += 24;
  doc.rect(40, y, 515, 24).stroke('#E5E7EB');
  doc.fillColor(textDark).font('Helvetica').fontSize(9);
  doc.text(`₹${metrics.summary.taxableSales}`, 50, y + 7);
  doc.text(`₹${metrics.summary.totalCgst}`, 220, y + 7);
  doc.text(`₹${metrics.summary.totalSgst}`, 350, y + 7);
  doc.text(`₹${metrics.summary.totalSales}`, 440, y + 7);

  y += 35;

  // ── Section 3: Top Selling Products ─────────────────────────
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(13).text('3. Top Selling Products', 40, y);
  y += 18;

  doc.rect(40, y, 515, 20).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8);
  doc.text('#', 50, y + 6);
  doc.text('PRODUCT NAME', 75, y + 6);
  doc.text('UNIT', 300, y + 6);
  doc.text('QTY SOLD', 380, y + 6);
  doc.text('REVENUE (₹)', 460, y + 6);

  y += 20;
  const prodsToShow = metrics.topProducts.slice(0, 5);
  if (prodsToShow.length === 0) {
    doc.fillColor(textMuted).font('Helvetica-Oblique').fontSize(8).text('No sales recorded in this period.', 50, y + 5);
    y += 20;
  } else {
    prodsToShow.forEach((p, idx) => {
      doc.rect(40, y, 515, 18).fillAndStroke(idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB', '#F3F4F6');
      doc.fillColor(textDark).font('Helvetica').fontSize(8);
      doc.text(`${idx + 1}`, 50, y + 5);
      doc.text(p.name, 75, y + 5, { width: 215, ellipsis: true });
      doc.text(p.unit, 300, y + 5);
      doc.text(`${p.quantitySold}`, 380, y + 5);
      doc.text(`₹${p.totalRevenue}`, 460, y + 5);
      y += 18;
    });
  }

  y += 20;

  // ── Section 4: Inventory & Low Stock Alerts ─────────────────
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(13).text('4. Inventory Health & Low Stock Alerts', 40, y);
  y += 18;

  const lowProds = metrics.inventoryAlerts.lowStockProducts.slice(0, 5);
  doc.rect(40, y, 515, 20).fill(lightBg);
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(8);
  doc.text('PRODUCT NAME', 50, y + 6);
  doc.text('CATEGORY', 240, y + 6);
  doc.text('CURRENT STOCK', 360, y + 6);
  doc.text('STATUS', 460, y + 6);

  y += 20;
  if (lowProds.length === 0) {
    doc.fillColor('#059669').font('Helvetica').fontSize(8).text('✓ All active inventory levels are above alert thresholds.', 50, y + 5);
    y += 20;
  } else {
    lowProds.forEach((p, idx) => {
      doc.rect(40, y, 515, 18).fillAndStroke(idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB', '#F3F4F6');
      doc.fillColor(textDark).font('Helvetica').fontSize(8);
      doc.text(p.name, 50, y + 5, { width: 180, ellipsis: true });
      doc.text(p.category, 240, y + 5);
      doc.text(`${p.stock} ${p.unit}`, 360, y + 5);
      doc.fillColor(p.stock <= 0 ? '#DC2626' : '#D97706').font('Helvetica-Bold');
      doc.text(p.stock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK', 460, y + 5);
      y += 18;
    });
  }

  // ── Footer Note & Documentation ─────────────────────────────
  doc.rect(40, 750, 515, 45).fill('#F3F4F6');
  doc.fillColor(textMuted).font('Helvetica').fontSize(7);
  doc.text(
    'Accounting Note: Estimated Gross Profit = Taxable Sales - Cost of Goods Sold (COGS). CGST & SGST taxes are excluded. ' +
      'Physical cash and UPI collections represent actual cash flow into the business, distinct from invoiced sales. ' +
      'System generated by HINAYA MARIYAM ERP.',
    50,
    756,
    { width: 495, lineGap: 2 }
  );

  return doc;
}
