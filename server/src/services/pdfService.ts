import PDFDocument from 'pdfkit';
import type { IInvoice } from '../models/Invoice';
import { formatIstDateTime } from '../utils/dateUtils';
import { computeGstBreakdown } from '../utils/money';
import { numberToIndianWords } from '../utils/numberToWords';

export interface BusinessDetails {
  name: string;
  address: string;
  mobile: string;
  gstin: string;
}

export const DEFAULT_BUSINESS_DETAILS: BusinessDetails = {
  name: 'INAAYA ENTERPRISES',
  address: '38/185, Pattali Street East , Adivaram , Sivagiripatti , Dindigul , Tamil Nadu - 624601',
  mobile: '9597038755 , 7010760392',
  gstin: '33BEWPA6233E1ZO',
};

export type PdfFontStyle = 'times' | 'helvetica' | 'courier';

export interface FontSet {
  regular: string;
  bold: string;
  italic: string;
  displayName: string;
}

export const PDF_FONTS: Record<PdfFontStyle, FontSet> = {
  times: {
    regular: 'Times-Roman',
    bold: 'Times-Bold',
    italic: 'Times-Italic',
    displayName: 'Times New Roman (Formal Tax Invoice Serif)',
  },
  helvetica: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    displayName: 'Modern Sans-Serif (Helvetica / Arial)',
  },
  courier: {
    regular: 'Courier',
    bold: 'Courier-Bold',
    italic: 'Courier-Oblique',
    displayName: 'Courier Monospace (Thermal POS Format)',
  },
};

/**
 * Generates an A4 professional Indian GST retail tax invoice PDF matching
 * the user's specification and tax invoice layout:
 * - Shop Name & Complete Address
 * - Mobile No (left) | GSTIN (right)
 * - Customer Name (left) | Customer MobileNum (right)
 * - Invoice No & Date
 * - Itemized table: S.No | Description | Qty | Price | GST % | Amount
 * - GST Slab Breakdown Table (GST % | Taxable Value | CGST | SGST | Total Tax)
 * - Summary box with explicit GST rate percentage applied before the Total sum
 * - Amount in Words (Rupees ... Only)
 * - Authorized signatory and appreciation footer
 * - Multi-font support: Times New Roman (default), Modern Sans (Helvetica), and Courier POS
 */
export function generateInvoicePdf(
  invoice: IInvoice,
  business: BusinessDetails = DEFAULT_BUSINESS_DETAILS,
  fontStyle: PdfFontStyle = 'times'
): InstanceType<typeof PDFDocument> {
  const fonts = PDF_FONTS[fontStyle] || PDF_FONTS.times;

  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    info: {
      Title: `Invoice ${invoice.invoiceNumber}`,
      Author: business.name,
      Subject: 'Retail Tax Invoice',
    },
  });

  const primaryColor = '#2E8B57';
  const darkColor = '#1B5E39';
  const lightBg = '#F3F9F5';
  const grayDark = '#1F2937';
  const grayLight = '#4B5563';
  const grayBorder = '#D1D5DB';

  const pageWidth = 595.28;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // ── Header Top Accent ─────────────────────────────────────
  doc.rect(margin, margin, contentWidth, 4).fill(primaryColor);

  let y = margin + 14;

  // Title: TAX INVOICE
  doc
    .font(fonts.bold)
    .fontSize(10)
    .fillColor(grayLight)
    .text('TAX INVOICE', margin, y, { align: 'center', width: contentWidth });

  y += 15;

  // Shop Name (Centered)
  doc
    .font(fonts.bold)
    .fontSize(22)
    .fillColor(primaryColor)
    .text(business.name, margin, y, { align: 'center', width: contentWidth });

  y += 28;

  // Address (Centered)
  doc
    .font(fonts.regular)
    .fontSize(9)
    .fillColor(grayLight)
    .text(business.address, margin, y, { align: 'center', width: contentWidth });

  y += 18;

  // Divider
  doc.strokeColor(grayBorder).lineWidth(0.75).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
  y += 10;

  // ── Business & Customer Details ──
  // Line 1: Mobile No (Left) | GSTIN (Right)
  doc
    .font(fonts.bold)
    .fontSize(9.5)
    .fillColor(grayDark)
    .text(`Mobile No :  ${business.mobile}`, margin + 4, y);

  doc.text(`GSTIN :  ${business.gstin}`, margin, y, {
    align: 'right',
    width: contentWidth - 4,
  });

  y += 16;

  // Line 2: Customer Name (Left) | Customer MobileNum (Right)
  doc
    .font(fonts.bold)
    .fontSize(9.5)
    .fillColor(darkColor)
    .text(`Customer Name :  ${invoice.customerName}`, margin + 4, y);

  doc
    .font(fonts.bold)
    .fontSize(9.5)
    .fillColor(darkColor)
    .text(`Customer MobileNum :  +91 ${invoice.customerMobile}`, margin, y, {
      align: 'right',
      width: contentWidth - 4,
    });

  y += 16;

  // Line 3: Invoice No & Date
  doc
    .font(fonts.regular)
    .fontSize(9)
    .fillColor(grayLight)
    .text(`Invoice No :  ${invoice.invoiceNumber}`, margin + 4, y);

  doc.text(`Date & Time :  ${formatIstDateTime(new Date(invoice.invoicedAt))}`, margin, y, {
    align: 'right',
    width: contentWidth - 4,
  });

  y += 18;

  // Divider above table
  doc.strokeColor(darkColor).lineWidth(1.2).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
  y += 6;

  // ── Items Table: S.No | Description | Quantity | Price | GST % | Amount ──
  const colSno = margin + 4;
  const colDesc = margin + 34;
  const colQty = margin + contentWidth - 195;
  const colPrice = margin + contentWidth - 135;
  const colGst = margin + contentWidth - 75;
  const colTotal = margin + contentWidth - 4;

  // Table Header Background
  doc.rect(margin, y, contentWidth, 22).fill(lightBg);

  const thY = y + 6;
  doc.font(fonts.bold).fontSize(9).fillColor(darkColor);
  doc.text('S.No', colSno, thY);
  doc.text('Description', colDesc, thY);
  doc.text('Qty', colQty, thY, { width: 55, align: 'center' });
  doc.text('Price (₹)', colPrice, thY, { width: 55, align: 'right' });
  doc.text('GST %', colGst, thY, { width: 40, align: 'center' });
  doc.text('Amount (₹)', colTotal - 55, thY, { width: 55, align: 'right' });

  y += 24;

  // Table Rows
  (invoice.lines || []).forEach((line, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.rect(margin, y, contentWidth, 20).fill('#FAFAFA');
    }

    doc.font(fonts.regular).fontSize(8.5).fillColor(grayDark);
    doc.text(String(index + 1), colSno + 2, y + 5);
    doc.text(line.productName, colDesc, y + 5, { width: 250, ellipsis: true });
    doc.text(`${line.quantity} ${line.unit || ''}`.trim(), colQty, y + 5, { width: 55, align: 'center' });
    doc.text(`₹${Number(line.sellingPrice?.toString() || 0).toFixed(2)}`, colPrice, y + 5, {
      width: 55,
      align: 'right',
    });
    doc.text(`${line.gstRate ?? 5}%`, colGst, y + 5, { width: 40, align: 'center' });
    doc.text(`₹${Number(line.lineTotal?.toString() || 0).toFixed(2)}`, colTotal - 55, y + 5, {
      width: 55,
      align: 'right',
    });

    y += 20;
  });

  // Table bottom border
  doc.strokeColor(grayBorder).lineWidth(0.75).moveTo(margin, y + 2).lineTo(margin + contentWidth, y + 2).stroke();
  y += 12;

  // ── Compute GST Slab Breakdown ─────────────────────────────
  const slabs = computeGstBreakdown(invoice.lines || []);

  // ── Bottom Section: Left = GST Slab Table | Right = Summary ──
  const startBottomY = y;
  const leftBoxWidth = 265;
  const rightBoxWidth = contentWidth - leftBoxWidth - 10;
  const rightBoxX = margin + leftBoxWidth + 10;

  // Left: GST Slab Table (Exact layout from user's uploaded tax invoice image)
  doc.font(fonts.bold).fontSize(8.5).fillColor(darkColor).text('GST Rate Breakdown Slabs', margin, y);
  y += 14;

  doc.rect(margin, y, leftBoxWidth, 18).fill(lightBg);
  const slabThY = y + 4;
  doc.font(fonts.bold).fontSize(7.5).fillColor(darkColor);
  doc.text('GST %', margin + 4, slabThY, { width: 42 });
  doc.text('Taxable Val', margin + 48, slabThY, { width: 55, align: 'right' });
  doc.text('CGST', margin + 108, slabThY, { width: 45, align: 'right' });
  doc.text('SGST', margin + 158, slabThY, { width: 45, align: 'right' });
  doc.text('Total Tax', margin + 208, slabThY, { width: 50, align: 'right' });
  y += 18;

  slabs.forEach((s) => {
    doc.rect(margin, y, leftBoxWidth, 16).fillAndStroke('#FFFFFF', '#E5E7EB');
    doc.font(fonts.regular).fontSize(7.5).fillColor(grayDark);
    doc.text(`${s.rate}%`, margin + 4, y + 4, { width: 42 });
    doc.text(`₹${s.taxableValue}`, margin + 48, y + 4, { width: 55, align: 'right' });
    doc.text(`₹${s.cgst}`, margin + 108, y + 4, { width: 45, align: 'right' });
    doc.text(`₹${s.sgst}`, margin + 158, y + 4, { width: 45, align: 'right' });
    doc.text(`₹${s.totalTax}`, margin + 208, y + 4, { width: 50, align: 'right' });
    y += 16;
  });

  // Amount in Words Box under Left Slab Table
  y += 10;
  const totalAmountNum = Number(invoice.grandTotal?.toString() || 0);
  const words = numberToIndianWords(totalAmountNum);
  doc.font(fonts.bold).fontSize(8).fillColor(grayLight).text('Amount in Words:', margin, y);
  y += 12;
  doc
    .font(fonts.bold)
    .fontSize(8.5)
    .fillColor(primaryColor)
    .text(words, margin, y, { width: leftBoxWidth });

  // Right: Summary Box with explicit GST percentages applied before total sum
  const summaryBoxHeight = Math.max(105, 75 + slabs.length * 28);
  doc.rect(rightBoxX, startBottomY, rightBoxWidth, summaryBoxHeight).fillAndStroke('#F9FAFB', grayBorder);

  let curSY = startBottomY + 8;
  doc.font(fonts.regular).fontSize(8.5).fillColor(grayLight);
  doc.text('Taxable Subtotal :', rightBoxX + 10, curSY);
  doc.font(fonts.bold).fillColor(grayDark).text(`₹${invoice.subtotalTaxable}`, rightBoxX + 110, curSY, {
    align: 'right',
    width: rightBoxWidth - 120,
  });
  curSY += 16;

  // Mention each GST Rate applied with percentage e.g. 18% (CGST 9% + SGST 9%)
  slabs.forEach((s) => {
    doc.font(fonts.regular).fontSize(8).fillColor(grayLight);
    doc.text(`CGST (${s.cgstRate}%) :`, rightBoxX + 10, curSY);
    doc.font(fonts.bold).fillColor(grayDark).text(`₹${s.cgst}`, rightBoxX + 110, curSY, {
      align: 'right',
      width: rightBoxWidth - 120,
    });
    curSY += 14;

    doc.font(fonts.regular).fontSize(8).fillColor(grayLight);
    doc.text(`SGST (${s.sgstRate}%) :`, rightBoxX + 10, curSY);
    doc.font(fonts.bold).fillColor(grayDark).text(`₹${s.sgst}`, rightBoxX + 110, curSY, {
      align: 'right',
      width: rightBoxWidth - 120,
    });
    curSY += 14;

    doc.font(fonts.bold).fontSize(8).fillColor(darkColor);
    doc.text(`Total GST (${s.rate}%) :`, rightBoxX + 10, curSY);
    doc.text(`₹${s.totalTax}`, rightBoxX + 110, curSY, {
      align: 'right',
      width: rightBoxWidth - 120,
    });
    curSY += 16;
  });

  // Total divider
  doc.strokeColor(grayBorder).lineWidth(0.75).moveTo(rightBoxX + 10, curSY).lineTo(rightBoxX + rightBoxWidth - 10, curSY).stroke();
  curSY += 8;

  // Grand Total
  doc.font(fonts.bold).fontSize(11).fillColor(darkColor).text('Net Total :', rightBoxX + 10, curSY);
  doc.fontSize(12).fillColor(primaryColor).text(`₹${Number(invoice.grandTotal?.toString() || 0).toFixed(2)}`, rightBoxX + 100, curSY - 1, {
    align: 'right',
    width: rightBoxWidth - 110,
  });
  curSY += 18;

  // Amount Paid & Balance Due
  doc.font(fonts.regular).fontSize(8).fillColor(grayLight).text('Amount Paid :', rightBoxX + 10, curSY);
  doc.font(fonts.bold).fillColor('#059669').text(`₹${invoice.amountPaid}`, rightBoxX + 100, curSY, {
    align: 'right',
    width: rightBoxWidth - 110,
  });
  curSY += 14;

  if (Number(invoice.outstandingAmount?.toString() || 0) > 0) {
    doc.font(fonts.bold).fontSize(8.5).fillColor('#DC2626').text(`Balance Due : ₹${invoice.outstandingAmount}`, rightBoxX + 10, curSY);
  }

  // ── Bottom Signatory & Appreciation Footer ─────────────────
  const quoteY = 740;

  // Left terms / E.&O.E.
  doc.font(fonts.regular).fontSize(7.5).fillColor(grayLight).text('E. & O.E.', margin, quoteY - 14);
  doc.text('Amount Of Tax Subject To Reverse Charges: NO', margin, quoteY - 4);

  // Right Signatory
  doc.font(fonts.bold).fontSize(8.5).fillColor(grayDark).text(`FOR ${business.name}`, margin, quoteY - 16, {
    align: 'right',
    width: contentWidth,
  });
  doc.font(fonts.regular).fontSize(7.5).fillColor(grayLight).text('Authorised Signatory', margin, quoteY - 4, {
    align: 'right',
    width: contentWidth,
  });

  // Appreciation Banner
  doc.rect(margin, quoteY + 12, contentWidth, 26).fill(lightBg);
  doc
    .font(fonts.italic)
    .fontSize(8.5)
    .fillColor(grayDark)
    .text(
      `“Thank you for choosing ${business.name}! Your support means a lot to us. We look forward to serving you again.”`,
      margin + 10,
      quoteY + 20,
      { align: 'center', width: contentWidth - 20 }
    );

  return doc;
}
