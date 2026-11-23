import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface TaxLineCalculation {
  quantity: number;
  unitPrice: string;
  gstRate: number;
  taxableAmount: string;
  cgst: string;
  sgst: string;
  lineTotal: string;
}

export interface GstRateBreakdown {
  rate: number;
  taxableValue: string;
  cgstRate: number;
  cgst: string;
  sgstRate: number;
  sgst: string;
  totalTax: string;
  totalAmount: string;
}

export interface InvoiceTotalsCalculation {
  subtotalTaxable: string;
  totalCgst: string;
  totalSgst: string;
  grandTotal: string;
  lines: TaxLineCalculation[];
  gstBreakdown: GstRateBreakdown[];
}

/**
 * Calculates GST-inclusive line item totals.
 * For a retail selling price of ₹105 with 5% GST:
 *   Line Total = 105.00
 *   Taxable Amount = 105 / (1 + 0.05) = 100.00
 *   Total GST = 5.00
 *   CGST = 2.50
 *   SGST = 2.50
 */
export function calculateTaxLine(
  unitPriceStr: string,
  quantity: number,
  gstRate: number
): TaxLineCalculation {
  const price = new Decimal(unitPriceStr);
  const qty = new Decimal(quantity);
  const rate = new Decimal(gstRate);

  // Line total is quantity × unit selling price (inclusive of GST)
  const lineTotal = price.times(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Taxable Value = Line Total / (1 + (gstRate / 100))
  const divisor = new Decimal(1).plus(rate.dividedBy(100));
  const taxableAmount = lineTotal.dividedBy(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Total tax = Line Total - Taxable Amount
  const totalTax = lineTotal.minus(taxableAmount);

  // Split equally into CGST and SGST
  const cgst = totalTax.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  // Ensure CGST + SGST exactly equals totalTax without rounding loss
  const sgst = totalTax.minus(cgst).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    quantity,
    unitPrice: price.toFixed(2),
    gstRate,
    taxableAmount: taxableAmount.toFixed(2),
    cgst: cgst.toFixed(2),
    sgst: sgst.toFixed(2),
    lineTotal: lineTotal.toFixed(2),
  };
}

/**
 * Groups lines by GST rate and calculates exact per-slab taxable value, CGST, SGST, and total.
 */
export function computeGstBreakdown(
  lines: Array<{
    gstRate: number;
    taxableAmount: number | string | Decimal | unknown;
    cgst: number | string | Decimal | unknown;
    sgst: number | string | Decimal | unknown;
    lineTotal: number | string | Decimal | unknown;
  }>
): GstRateBreakdown[] {
  const map = new Map<
    number,
    {
      taxable: Decimal;
      cgst: Decimal;
      sgst: Decimal;
      total: Decimal;
    }
  >();

  for (const line of lines) {
    const rate = Number(line.gstRate) || 0;
    const taxable = new Decimal(line.taxableAmount?.toString() || '0');
    const cgst = new Decimal(line.cgst?.toString() || '0');
    const sgst = new Decimal(line.sgst?.toString() || '0');
    const total = new Decimal(line.lineTotal?.toString() || '0');

    const cur = map.get(rate) || {
      taxable: new Decimal(0),
      cgst: new Decimal(0),
      sgst: new Decimal(0),
      total: new Decimal(0),
    };

    cur.taxable = cur.taxable.plus(taxable);
    cur.cgst = cur.cgst.plus(cgst);
    cur.sgst = cur.sgst.plus(sgst);
    cur.total = cur.total.plus(total);
    map.set(rate, cur);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, vals]) => ({
      rate,
      taxableValue: vals.taxable.toFixed(2),
      cgstRate: rate / 2,
      cgst: vals.cgst.toFixed(2),
      sgstRate: rate / 2,
      sgst: vals.sgst.toFixed(2),
      totalTax: vals.cgst.plus(vals.sgst).toFixed(2),
      totalAmount: vals.total.toFixed(2),
    }));
}

/**
 * Aggregates all line item taxes and totals safely without JavaScript floating point errors.
 */
export function calculateInvoiceTotals(
  items: Array<{ unitPrice: string; quantity: number; gstRate: number }>
): InvoiceTotalsCalculation {
  let subtotalTaxable = new Decimal(0);
  let totalCgst = new Decimal(0);
  let totalSgst = new Decimal(0);
  let grandTotal = new Decimal(0);

  const lines = items.map((item) => {
    const calc = calculateTaxLine(item.unitPrice, item.quantity, item.gstRate);
    subtotalTaxable = subtotalTaxable.plus(calc.taxableAmount);
    totalCgst = totalCgst.plus(calc.cgst);
    totalSgst = totalSgst.plus(calc.sgst);
    grandTotal = grandTotal.plus(calc.lineTotal);
    return calc;
  });

  const gstBreakdown = computeGstBreakdown(lines);

  return {
    subtotalTaxable: subtotalTaxable.toFixed(2),
    totalCgst: totalCgst.toFixed(2),
    totalSgst: totalSgst.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    lines,
    gstBreakdown,
  };
}
