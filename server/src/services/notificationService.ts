import axios from 'axios';
import nodemailer from 'nodemailer';
import type { IInvoice } from '../models/Invoice';
import { generateInvoicePdf, DEFAULT_BUSINESS_DETAILS } from './pdfService';
import { normalizeIndianMobile, normalizeRecipientEmail } from './reportDeliveryService';
import { formatIstDateTime } from '../utils/dateUtils';
import { computeGstBreakdown } from '../utils/money';
import { logger } from '../utils/logger';

const ADMIN_MOBILE = process.env.ADMIN_MOBILE || process.env.ADMIN_REPORT_MOBILE || '9597038755';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.ADMIN_REPORT_EMAIL || 'sivaprakashs127@gmail.com';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3001';

/**
 * Formats structured receipt text with explicit GST rates and direct PDF link
 */
export function formatReceiptText(invoice: IInvoice): string {
  const slabs = computeGstBreakdown(invoice.lines || []);
  const pdfDownloadUrl = `${APP_BASE_URL}/api/invoices/${invoice._id}/pdf`;

  const linesSummary = (invoice.lines || [])
    .map(
      (l, i) =>
        `${i + 1}. ${l.productName} | ${l.quantity} ${l.unit} x ₹${l.sellingPrice} (GST ${l.gstRate}%) = ₹${l.lineTotal}`
    )
    .join('\n');

  const gstBreakdownSummary = slabs
    .map(
      (s) =>
        `• CGST (${s.cgstRate}%): ₹${s.cgst} | SGST (${s.sgstRate}%): ₹${s.sgst} [GST ${s.rate}% Applied: ₹${s.totalTax}]`
    )
    .join('\n');

  return (
    `🧾 *${DEFAULT_BUSINESS_DETAILS.name} - RETAIL TAX INVOICE*\n` +
    `${DEFAULT_BUSINESS_DETAILS.address}\n` +
    `Mobile No: ${DEFAULT_BUSINESS_DETAILS.mobile} | GSTIN: ${DEFAULT_BUSINESS_DETAILS.gstin}\n` +
    `----------------------------------------\n` +
    `*Invoice No:* ${invoice.invoiceNumber}\n` +
    `*Customer Name:* ${invoice.customerName}\n` +
    `*Customer MobileNum:* +91 ${invoice.customerMobile}\n` +
    `*Date & Time:* ${formatIstDateTime(new Date(invoice.invoicedAt))}\n` +
    `----------------------------------------\n` +
    `📄 *OFFICIAL A4 PDF INVOICE DOWNLOAD:*\n` +
    `${pdfDownloadUrl}\n` +
    `----------------------------------------\n` +
    `*ITEMS:*\n` +
    `${linesSummary}\n` +
    `----------------------------------------\n` +
    `Taxable Subtotal: ₹${invoice.subtotalTaxable}\n` +
    (gstBreakdownSummary ? `${gstBreakdownSummary}\n` : '') +
    `*NET TOTAL AMOUNT: ₹${invoice.grandTotal}*\n` +
    `Amount Paid: ₹${invoice.amountPaid}\n` +
    (Number(invoice.outstandingAmount) > 0 ? `*Balance Due: ₹${invoice.outstandingAmount}*\n` : '') +
    `----------------------------------------\n` +
    `"Thank you for choosing ${DEFAULT_BUSINESS_DETAILS.name}! Your support means a lot to us. We look forward to serving you again."`
  );
}

/**
 * Generates direct one-click WhatsApp share links with pre-filled receipt & PDF link
 */
export function getWhatsAppShareUrls(invoice: IInvoice): {
  adminShareUrl: string;
  customerShareUrl: string;
} {
  const text = encodeURIComponent(formatReceiptText(invoice));
  const adminClean = normalizeIndianMobile(ADMIN_MOBILE).replace('+', '');
  const custClean = normalizeIndianMobile(invoice.customerMobile).replace('+', '');

  return {
    adminShareUrl: `https://wa.me/${adminClean}?text=${text}`,
    customerShareUrl: `https://wa.me/${custClean}?text=${text}`,
  };
}

/**
 * Asynchronously dispatches bill notifications to Admin & Customer via configured channels:
 * - WhatsApp Business Cloud API: Dispatches PDF Document directly to chat
 * - SMTP Nodemailer: Dispatches Email with the official A4 PDF attached
 */
export async function dispatchInvoiceNotifications(invoice: IInvoice): Promise<{
  whatsappSent: boolean;
  emailSent: boolean;
}> {
  const receiptText = formatReceiptText(invoice);
  const pdfDownloadUrl = `${APP_BASE_URL}/api/invoices/${invoice._id}/pdf`;
  let whatsappSent = false;
  let emailSent = false;

  // 1. WhatsApp Delivery via Meta Cloud API (if configured)
  const waToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (waToken && waPhoneId) {
    try {
      const targets = [
        normalizeIndianMobile(ADMIN_MOBILE).replace('+', ''),
        normalizeIndianMobile(invoice.customerMobile).replace('+', ''),
      ];

      for (const target of targets) {
        // Send official PDF document directly into WhatsApp chat
        await axios.post(
          `https://graph.facebook.com/v21.0/${waPhoneId}/messages`,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: target,
            type: 'document',
            document: {
              link: pdfDownloadUrl,
              caption: `Tax Invoice ${invoice.invoiceNumber} from ${DEFAULT_BUSINESS_DETAILS.name} (Total: ₹${invoice.grandTotal})`,
              filename: `Invoice_${invoice.invoiceNumber.replace(/\//g, '_')}.pdf`,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${waToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        // Also send summary text
        await axios.post(
          `https://graph.facebook.com/v21.0/${waPhoneId}/messages`,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: target,
            type: 'text',
            text: { body: receiptText },
          },
          {
            headers: {
              Authorization: `Bearer ${waToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      }
      whatsappSent = true;
      logger.info(`Invoice PDF notification dispatched to WhatsApp for invoice ${invoice.invoiceNumber}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown WhatsApp error';
      logger.warn(`WhatsApp automated dispatch failed for invoice ${invoice.invoiceNumber}: ${msg}`);
    }
  } else {
    logger.info(`WhatsApp Cloud API not configured. Automated WhatsApp notification skipped for ${invoice.invoiceNumber}. Direct web link available.`);
  }

  // 2. Email Delivery via Nodemailer (with PDF attached)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpFrom = process.env.SMTP_FROM || `"${DEFAULT_BUSINESS_DETAILS.name}" <invoices@inaayaenterprises.com>`;

  if (smtpHost && smtpUser) {
    try {
      // Compile PDF buffer
      const doc = generateInvoicePdf(invoice);
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve());
        doc.on('error', (err) => reject(err));
        doc.end();
      });
      const pdfBuffer = Buffer.concat(chunks);

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const recipients = [normalizeRecipientEmail(ADMIN_EMAIL)];
      if (invoice.customerEmail && invoice.customerEmail.includes('@')) {
        recipients.push(invoice.customerEmail.trim());
      }

      await transporter.sendMail({
        from: smtpFrom,
        to: recipients.join(', '),
        subject: `[${DEFAULT_BUSINESS_DETAILS.name}] Tax Invoice ${invoice.invoiceNumber} - ₹${invoice.grandTotal}`,
        text: receiptText,
        attachments: [
          {
            filename: `Invoice_${invoice.invoiceNumber.replace(/\//g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      emailSent = true;
      logger.info(`Invoice notification email with attached PDF dispatched to ${recipients.join(', ')} for invoice ${invoice.invoiceNumber}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown SMTP error';
      logger.warn(`Email automated dispatch failed for invoice ${invoice.invoiceNumber}: ${msg}`);
    }
  } else {
    logger.info(`SMTP not configured. Automated email notification skipped for ${invoice.invoiceNumber}.`);
  }

  return { whatsappSent, emailSent };
}
