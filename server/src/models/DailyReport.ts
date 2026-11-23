import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReportDeliveryStatus = 'pending' | 'sent' | 'failed' | 'disabled';

export interface IDeliveryLog {
  status: ReportDeliveryStatus;
  sentAt?: Date | null;
  error?: string | null;
  recipient?: string | null;
  providerResponse?: Record<string, unknown> | null;
}

export interface IDailyReport extends Document {
  reportDate: string; // 'YYYY-MM-DD' in Asia/Kolkata
  generatedAt: Date;
  status: 'generating' | 'completed' | 'failed';
  filePath?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  summarySnapshot: {
    totalSales: string;
    taxableSales: string;
    totalCgst: string;
    totalSgst: string;
    invoiceCount: number;
    cashCollected: string;
    upiCollected: string;
    totalCollected: string;
    outstandingAmount: string;
    estimatedGrossProfit?: string | null;
  };
  emailDelivery: IDeliveryLog;
  whatsappDelivery: IDeliveryLog;
  retries: number;
  triggeredBy: 'scheduler' | 'manual';
  triggeredByUserId?: mongoose.Types.ObjectId | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryLogSchema = new Schema<IDeliveryLog>(
  {
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'disabled'],
      default: 'disabled',
    },
    sentAt: { type: Date, default: null },
    error: { type: String, default: null },
    recipient: { type: String, default: null },
    providerResponse: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const DailyReportSchema = new Schema<IDailyReport>(
  {
    reportDate: {
      type: String,
      required: true,
      unique: true, // INVARIANT: Prevent duplicate reports for same business day
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'generating',
      index: true,
    },
    filePath: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    summarySnapshot: {
      totalSales: { type: String, default: '0.00' },
      taxableSales: { type: String, default: '0.00' },
      totalCgst: { type: String, default: '0.00' },
      totalSgst: { type: String, default: '0.00' },
      invoiceCount: { type: Number, default: 0 },
      cashCollected: { type: String, default: '0.00' },
      upiCollected: { type: String, default: '0.00' },
      totalCollected: { type: String, default: '0.00' },
      outstandingAmount: { type: String, default: '0.00' },
      estimatedGrossProfit: { type: String, default: null },
    },
    emailDelivery: {
      type: DeliveryLogSchema,
      default: () => ({ status: 'disabled' }),
    },
    whatsappDelivery: {
      type: DeliveryLogSchema,
      default: () => ({ status: 'disabled' }),
    },
    retries: {
      type: Number,
      default: 0,
    },
    triggeredBy: {
      type: String,
      enum: ['scheduler', 'manual'],
      default: 'scheduler',
    },
    triggeredByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const DailyReport: Model<IDailyReport> =
  mongoose.models.DailyReport || mongoose.model<IDailyReport>('DailyReport', DailyReportSchema);
