import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import { Invoice, type IInvoice } from '../models/Invoice';
import { Payment, type IPayment } from '../models/Payment';
import { Product } from '../models/Product';
import { getPeriodRange, getIstDate, formatIstDate } from '../utils/dateUtils';

export interface DashboardMetrics {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalSales: string; // Grand total invoiced (inclusive of GST)
    taxableSales: string; // Tax-exclusive sales subtotal
    totalCgst: string;
    totalSgst: string;
    invoiceCount: number;
    cashCollected: string; // Total cash physically collected in period
    upiCollected: string; // Total UPI payments collected in period
    totalCollected: string; // cashCollected + upiCollected
    outstandingAmount: string; // Total pending balance on invoices created in period
    totalCostOfGoodsSold?: string | null; // COGS (Admin only)
    estimatedGrossProfit?: string | null; // Gross Profit = Taxable Sales - COGS (Admin only)
    profitMarginPercent?: string | null; // (Gross Profit / Taxable Sales) * 100
    uncostedItemsCount?: number; // Items sold without documented purchase cost
    canViewProfit: boolean;
    profitMethodDocumentation: string;
  };
  charts: {
    trend: Array<{
      key: string;
      label: string;
      sales: number;
      collections: number;
      invoices: number;
    }>;
    paymentBreakdown: Array<{
      name: string;
      value: number;
      color: string;
    }>;
    categorySales: Array<{
      category: string;
      sales: number;
      quantity: number;
    }>;
  };
  topProducts: Array<{
    productId: string;
    name: string;
    unit: string;
    quantitySold: number;
    totalRevenue: string;
  }>;
  inventoryAlerts: {
    totalActiveProducts: number;
    outOfStockCount: number;
    lowStockCount: number;
    lowStockProducts: Array<{
      id: string;
      name: string;
      category: string;
      stock: number;
      minStockAlert: number;
      unit: string;
    }>;
    totalStockRetailValue: string;
    totalStockCostValue?: string | null; // Admin only
  };
}

/**
 * Calculates complete dashboard and business metrics for a given period and user role.
 */
export async function getDashboardMetrics(
  period: 'today' | 'yesterday' | 'week' | 'month' | 'custom',
  customStart?: string,
  customEnd?: string,
  userRole?: string
): Promise<DashboardMetrics> {
  const isAdmin = userRole === 'admin';
  const { start, end, label } = getPeriodRange(period, customStart, customEnd);

  // 1. Fetch finalized invoices within period boundary
  const invoices = await Invoice.find({
    status: 'finalized',
    invoicedAt: { $gte: start, $lte: end },
  }).lean();

  // 2. Fetch payments recorded within period boundary
  const payments = await Payment.find({
    paidAt: { $gte: start, $lte: end },
  }).lean();

  // 3. Fetch all active products for inventory metrics and category mapping
  const activeProducts = await Product.find({ isActive: true }).lean();
  const productCategoryMap = new Map<string, string>();
  for (const p of activeProducts) {
    productCategoryMap.set(p._id.toString(), p.category || 'General');
  }

  // 4. Invoices Aggregation (Decimal-safe financial arithmetic)
  let totalSalesDec = new Decimal(0);
  let taxableSalesDec = new Decimal(0);
  let totalCgstDec = new Decimal(0);
  let totalSgstDec = new Decimal(0);
  let outstandingDec = new Decimal(0);
  let totalCogsDec = new Decimal(0);
  let uncostedCount = 0;

  const productSalesMap = new Map<
    string,
    { name: string; unit: string; quantity: number; revenue: Decimal }
  >();
  const categorySalesMap = new Map<string, { sales: Decimal; quantity: number }>();

  for (const inv of invoices) {
    totalSalesDec = totalSalesDec.plus(inv.grandTotal?.toString() || '0');
    taxableSalesDec = taxableSalesDec.plus(inv.subtotalTaxable?.toString() || '0');
    totalCgstDec = totalCgstDec.plus(inv.totalCgst?.toString() || '0');
    totalSgstDec = totalSgstDec.plus(inv.totalSgst?.toString() || '0');
    outstandingDec = outstandingDec.plus(inv.outstandingAmount?.toString() || '0');

    // Process snapshot lines
    for (const line of inv.lines || []) {
      const pid = line.productId?.toString();
      const pName = line.productName || 'Unknown Product';
      const unit = line.unit || 'unit';
      const qty = line.quantity || 0;
      const lineRev = new Decimal(line.lineTotal?.toString() || '0');

      // Top products map
      const existingProd = productSalesMap.get(pid) || {
        name: pName,
        unit,
        quantity: 0,
        revenue: new Decimal(0),
      };
      existingProd.quantity += qty;
      existingProd.revenue = existingProd.revenue.plus(lineRev);
      productSalesMap.set(pid, existingProd);

      // Category map
      const category = productCategoryMap.get(pid) || 'General';
      const existingCat = categorySalesMap.get(category) || {
        sales: new Decimal(0),
        quantity: 0,
      };
      existingCat.sales = existingCat.sales.plus(lineRev);
      existingCat.quantity += qty;
      categorySalesMap.set(category, existingCat);

      // Cost of Goods Sold (COGS) calculation
      if (line.purchaseCost !== null && line.purchaseCost !== undefined) {
        const unitCost = new Decimal(line.purchaseCost.toString());
        totalCogsDec = totalCogsDec.plus(unitCost.times(qty));
      } else {
        uncostedCount += 1;
      }
    }
  }

  // Calculate Estimated Gross Profit = Taxable Sales - COGS
  const grossProfitDec = taxableSalesDec.minus(totalCogsDec);
  const profitMarginPercent =
    taxableSalesDec.greaterThan(0)
      ? grossProfitDec.dividedBy(taxableSalesDec).times(100).toFixed(1)
      : '0.0';

  // 5. Payments Aggregation
  let cashCollectedDec = new Decimal(0);
  let upiCollectedDec = new Decimal(0);

  for (const p of payments) {
    cashCollectedDec = cashCollectedDec.plus(p.cashAmount?.toString() || '0');
    upiCollectedDec = upiCollectedDec.plus(p.upiAmount?.toString() || '0');
  }
  const totalCollectedDec = cashCollectedDec.plus(upiCollectedDec);

  // 6. Trend Buckets
  const isHourly = period === 'today' || period === 'yesterday';
  const trendBuckets = new Map<
    string,
    { label: string; sales: Decimal; collections: Decimal; invoices: number }
  >();

  if (isHourly) {
    for (let h = 8; h <= 22; h++) {
      const hStr = `${String(h).padStart(2, '0')}:00`;
      trendBuckets.set(hStr, {
        label: hStr,
        sales: new Decimal(0),
        collections: new Decimal(0),
        invoices: 0,
      });
    }

    for (const inv of invoices) {
      const ist = getIstDate(new Date(inv.invoicedAt));
      const hStr = `${String(ist.getHours()).padStart(2, '0')}:00`;
      if (trendBuckets.has(hStr)) {
        const b = trendBuckets.get(hStr)!;
        b.sales = b.sales.plus(inv.grandTotal?.toString() || '0');
        b.invoices += 1;
      }
    }

    for (const pay of payments) {
      const ist = getIstDate(new Date(pay.paidAt));
      const hStr = `${String(ist.getHours()).padStart(2, '0')}:00`;
      if (trendBuckets.has(hStr)) {
        const b = trendBuckets.get(hStr)!;
        b.collections = b.collections.plus(pay.totalAmount?.toString() || '0');
      }
    }
  } else {
    // Daily buckets
    const cur = new Date(start);
    while (cur <= end) {
      const dStr = formatIstDate(cur);
      trendBuckets.set(dStr, {
        label: dStr.substring(5), // 'MM-DD'
        sales: new Decimal(0),
        collections: new Decimal(0),
        invoices: 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    for (const inv of invoices) {
      const dStr = formatIstDate(new Date(inv.invoicedAt));
      if (trendBuckets.has(dStr)) {
        const b = trendBuckets.get(dStr)!;
        b.sales = b.sales.plus(inv.grandTotal?.toString() || '0');
        b.invoices += 1;
      }
    }

    for (const pay of payments) {
      const dStr = formatIstDate(new Date(pay.paidAt));
      if (trendBuckets.has(dStr)) {
        const b = trendBuckets.get(dStr)!;
        b.collections = b.collections.plus(pay.totalAmount?.toString() || '0');
      }
    }
  }

  const trend = Array.from(trendBuckets.entries()).map(([key, val]) => ({
    key,
    label: val.label,
    sales: val.sales.toNumber(),
    collections: val.collections.toNumber(),
    invoices: val.invoices,
  }));

  // 7. Top Selling Products (Sorted by quantity sold descending)
  const topProducts = Array.from(productSalesMap.entries())
    .map(([productId, data]) => ({
      productId,
      name: data.name,
      unit: data.unit,
      quantitySold: data.quantity,
      totalRevenue: data.revenue.toFixed(2),
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  // 8. Category Sales
  const categorySales = Array.from(categorySalesMap.entries()).map(([category, data]) => ({
    category,
    sales: data.sales.toNumber(),
    quantity: data.quantity,
  }));

  // 9. Inventory Alerts & Valuation
  let totalRetailValDec = new Decimal(0);
  let totalCostValDec = new Decimal(0);
  const lowStockProducts: Array<{
    id: string;
    name: string;
    category: string;
    stock: number;
    minStockAlert: number;
    unit: string;
  }> = [];
  let outOfStockCount = 0;

  for (const prod of activeProducts) {
    const stock = prod.stock || 0;
    const minAlert = prod.lowStockThreshold || 5;
    const sellPrice = new Decimal(prod.sellingPrice?.toString() || '0');

    totalRetailValDec = totalRetailValDec.plus(sellPrice.times(Math.max(0, stock)));

    if (prod.purchasePrice) {
      const buyPrice = new Decimal(prod.purchasePrice.toString());
      totalCostValDec = totalCostValDec.plus(buyPrice.times(Math.max(0, stock)));
    }

    if (stock <= 0) {
      outOfStockCount += 1;
      lowStockProducts.push({
        id: prod._id.toString(),
        name: prod.name,
        category: prod.category || 'General',
        stock,
        minStockAlert: minAlert,
        unit: prod.packType || 'unit',
      });
    } else if (stock <= minAlert) {
      lowStockProducts.push({
        id: prod._id.toString(),
        name: prod.name,
        category: prod.category || 'General',
        stock,
        minStockAlert: minAlert,
        unit: prod.packType || 'unit',
      });
    }
  }

  // 10. Payment Breakdown chart
  const paymentBreakdown = [
    { name: 'Cash Collected', value: cashCollectedDec.toNumber(), color: '#2E8B57' },
    { name: 'UPI Collected', value: upiCollectedDec.toNumber(), color: '#3B82F6' },
    { name: 'Outstanding Balance', value: outstandingDec.toNumber(), color: '#F59E0B' },
  ];

  const profitMethodDocumentation =
    'Estimated Gross Profit = Taxable Sales minus Cost of Goods Sold (COGS). ' +
    'COGS is computed as quantity sold multiplied by the snapshot purchase cost recorded at invoice time. ' +
    'CGST and SGST taxes are collected for government remittance and are strictly excluded from gross profit. ' +
    'This metric represents Gross Margin before operating expenses, not Net Profit.';

  return {
    period: label,
    startDate: formatIstDate(start),
    endDate: formatIstDate(end),
    summary: {
      totalSales: totalSalesDec.toFixed(2),
      taxableSales: taxableSalesDec.toFixed(2),
      totalCgst: totalCgstDec.toFixed(2),
      totalSgst: totalSgstDec.toFixed(2),
      invoiceCount: invoices.length,
      cashCollected: cashCollectedDec.toFixed(2),
      upiCollected: upiCollectedDec.toFixed(2),
      totalCollected: totalCollectedDec.toFixed(2),
      outstandingAmount: outstandingDec.toFixed(2),
      totalCostOfGoodsSold: isAdmin ? totalCogsDec.toFixed(2) : null,
      estimatedGrossProfit: isAdmin ? grossProfitDec.toFixed(2) : null,
      profitMarginPercent: isAdmin ? profitMarginPercent : null,
      uncostedItemsCount: isAdmin ? uncostedCount : undefined,
      canViewProfit: isAdmin,
      profitMethodDocumentation,
    },
    charts: {
      trend,
      paymentBreakdown,
      categorySales,
    },
    topProducts,
    inventoryAlerts: {
      totalActiveProducts: activeProducts.length,
      outOfStockCount,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.slice(0, 15),
      totalStockRetailValue: totalRetailValDec.toFixed(2),
      totalStockCostValue: isAdmin ? totalCostValDec.toFixed(2) : null,
    },
  };
}
