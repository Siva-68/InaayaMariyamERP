import fs from 'fs';
import path from 'path';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { DailyReport, type IDailyReport, type IDeliveryLog } from '../models/DailyReport';
import { Product } from '../models/Product';
import { PurchaseEntry } from '../models/PurchaseEntry';
import { StockMovement } from '../models/StockMovement';
import { getDashboardMetrics } from './reportService';
import { generateDailyReportPdf } from './dailyReportPdfService';
import { getPeriodRange, formatIstDate } from '../utils/dateUtils';
import { logger } from '../utils/logger';

export interface DispatchResult {
  report: IDailyReport;
  emailDelivery: IDeliveryLog;
  whatsappDelivery: IDeliveryLog;
  savedPdfPath: string;
}

const DEFAULT_ADMIN_MOBILE = process.env.ADMIN_REPORT_MOBILE || '9698603288';
const DEFAULT_ADMIN_EMAIL =
  process.env.ADMIN_REPORT_EMAIL ||
  (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.includes('@')
    ? process.env.ADMIN_EMAIL
    : 'sivaprakashs127@gmail.com');

/**
 * Normalizes phone number into international E.164 format (+91 for India)
 */
export function normalizeIndianMobile(mobile: string): string {
  const cleaned = mobile.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Normalizes recipient email, ensuring a valid domain if user provided raw phone or username
 */
export function normalizeRecipientEmail(emailInput: string): string {
  if (emailInput.includes('@')) {
    return emailInput.trim();
  }
  // If user provided a mobile number or alias without domain, map to configured Gmail
  return `${emailInput.trim()}@gmail.com`;
}

/**
 * Dispatches PDF report via Official WhatsApp Business Cloud API.
 * Strict Invariant: Never claim delivery without provider confirmation.
 * If credentials are not set, return status: 'disabled'.
 */
export async function sendReportViaWhatsApp(
  pdfBuffer: Buffer,
  fileName: string,
  recipientMobile: string = DEFAULT_ADMIN_MOBILE
): Promise<IDeliveryLog> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = normalizeIndianMobile(recipientMobile);

  if (!token || !phoneId) {
    logger.info('WhatsApp Cloud API credentials absent in .env. WhatsApp delivery set to disabled.');
    return {
      status: 'disabled',
      recipient,
      error: 'WhatsApp Business Cloud API credentials not configured in environment (WHATSAPP_CLOUD_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID). Delivery disabled.',
    };
  }

  try {
    // 1. Upload media document to Meta Graph API
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), fileName);

    const uploadRes = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneId}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const mediaId = uploadRes.data?.id;
    if (!mediaId) {
      throw new Error('Meta Graph API did not return media ID');
    }

    // 2. Send document message to recipient
    const recipientDigits = recipient.replace('+', '');
    const sendRes = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientDigits,
        type: 'document',
        document: {
          id: mediaId,
          filename: fileName,
          caption: `HINAYA MARIYAM Official Daily Executive Report (${fileName})`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      status: 'sent',
      recipient,
      sentAt: new Date(),
      providerResponse: sendRes.data,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown WhatsApp API error';
    logger.error('WhatsApp report delivery failed', { error: errorMsg });
    return {
      status: 'failed',
      recipient,
      error: errorMsg,
    };
  }
}

/**
 * Dispatches PDF report via configured SMTP server using Nodemailer.
 * If credentials are not set, return status: 'disabled'.
 */
export async function sendReportViaEmail(
  pdfBuffer: Buffer,
  fileName: string,
  recipientEmail: string = DEFAULT_ADMIN_EMAIL
): Promise<IDeliveryLog> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const from = process.env.SMTP_FROM || '"HINAYA MARIYAM ERP" <reports@hinayamariyam.com>';

  const recipient = normalizeRecipientEmail(recipientEmail);

  if (!host || !user) {
    logger.info('SMTP credentials absent in .env. Email report delivery set to disabled.');
    return {
      status: 'disabled',
      recipient,
      error: 'SMTP host/user not configured in environment (SMTP_HOST / SMTP_USER). Email delivery disabled.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject: `[HINAYA MARIYAM] Daily Performance & Inventory Report - ${fileName}`,
      text: `Dear Administrator,\n\nPlease find attached the official 3-page daily performance and inventory report for HINAYA MARIYAM.\n\nIncluded sections:\n1. Sales, Collections, Gross Profit & GST\n2. Complete Active Product Inventory Table\n3. Incoming Stock, Adjustments & Restocking Alerts\n\nGenerated by HINAYA MARIYAM ERP.`,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return {
      status: 'sent',
      recipient,
      sentAt: new Date(),
      providerResponse: { messageId: info.messageId },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown SMTP error';
    logger.error('Email report delivery failed', { error: errorMsg });
    return {
      status: 'failed',
      recipient,
      error: errorMsg,
    };
  }
}

/**
 * Compiles and saves the 3-page daily report PDF, records metadata in MongoDB,
 * and executes delivery to configured WhatsApp and Email destinations.
 */
export async function generateAndDispatchDailyReport(
  targetDate?: string, // 'YYYY-MM-DD'
  triggeredBy: 'scheduler' | 'manual' = 'scheduler',
  triggeredByUserId?: string,
  forceRetry: boolean = false
): Promise<DispatchResult> {
  const dateStr = targetDate || formatIstDate(new Date());

  // 1. Duplicate check: Enforce only one report per business date unless explicitly retried
  let existing = await DailyReport.findOne({ reportDate: dateStr });
  if (existing && existing.status === 'completed' && !forceRetry) {
    throw new Error(
      `Daily report for ${dateStr} has already been compiled and saved. Duplicate generation prevented. Set forceRetry=true to regenerate.`
    );
  }

  if (!existing) {
    existing = await DailyReport.create({
      reportDate: dateStr,
      status: 'generating',
      triggeredBy,
      triggeredByUserId: triggeredByUserId || null,
    });
  } else {
    existing.status = 'generating';
    existing.retries += 1;
    await existing.save();
  }

  try {
    // 2. Fetch data for target date bounds in Asia/Kolkata
    const { start, end } = getPeriodRange('custom', dateStr, dateStr);

    const [metrics, activeProducts, purchasesToday, adjustmentsToday] = await Promise.all([
      getDashboardMetrics('custom', dateStr, dateStr, 'admin'),
      Product.find({ isActive: true }).sort({ category: 1, name: 1 }),
      PurchaseEntry.find({ purchaseDate: { $gte: start, $lte: end } }),
      StockMovement.find({ createdAt: { $gte: start, $lte: end } }),
    ]);

    // 3. Generate 3-Page PDF buffer
    const doc = generateDailyReportPdf({
      businessName: 'HINAYA MARIYAM',
      reportDateStr: dateStr,
      metrics,
      activeProducts,
      purchasesToday,
      adjustmentsToday,
    });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve());
      doc.on('error', (err) => reject(err));
      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const fileName = `hinaya_mariyam_daily_report_${dateStr}.pdf`;

    // 4. Save to persistent server directory
    const reportsDir = path.resolve(process.cwd(), 'reports', 'daily');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const filePath = path.join(reportsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    // 5. Execute deliveries (WhatsApp + Email)
    const [whatsappLog, emailLog] = await Promise.all([
      sendReportViaWhatsApp(pdfBuffer, fileName, DEFAULT_ADMIN_MOBILE),
      sendReportViaEmail(pdfBuffer, fileName, DEFAULT_ADMIN_EMAIL),
    ]);

    // 6. Update DailyReport metadata in MongoDB
    existing.status = 'completed';
    existing.filePath = filePath;
    existing.fileName = fileName;
    existing.fileSizeBytes = pdfBuffer.length;
    existing.summarySnapshot = {
      totalSales: metrics.summary.totalSales,
      taxableSales: metrics.summary.taxableSales,
      totalCgst: metrics.summary.totalCgst,
      totalSgst: metrics.summary.totalSgst,
      invoiceCount: metrics.summary.invoiceCount,
      cashCollected: metrics.summary.cashCollected,
      upiCollected: metrics.summary.upiCollected,
      totalCollected: metrics.summary.totalCollected,
      outstandingAmount: metrics.summary.outstandingAmount,
      estimatedGrossProfit: metrics.summary.estimatedGrossProfit,
    };
    existing.whatsappDelivery = whatsappLog;
    existing.emailDelivery = emailLog;
    await existing.save();

    logger.info(`Daily report compiled successfully for ${dateStr}. Stored at ${filePath}`);

    return {
      report: existing,
      emailDelivery: emailLog,
      whatsappDelivery: whatsappLog,
      savedPdfPath: filePath,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Report generation failed';
    existing.status = 'failed';
    existing.errorMessage = errorMsg;
    await existing.save();
    logger.error('Failed to generate daily report', { error: errorMsg, date: dateStr });
    throw err;
  }
}
