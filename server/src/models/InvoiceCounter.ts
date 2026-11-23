import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvoiceCounter extends Document {
  seriesKey: string; // e.g. "HM/2026"
  lastNumber: number;
  format: string;
  updatedAt: Date;
}

const InvoiceCounterSchema = new Schema<IInvoiceCounter>(
  {
    seriesKey: {
      type: String,
      required: true,
      unique: true,
    },
    lastNumber: {
      type: Number,
      required: true,
      default: 0,
    },
    format: {
      type: String,
      default: 'HM/YYYY/######',
    },
  },
  {
    timestamps: true,
  }
);

export const InvoiceCounter: Model<IInvoiceCounter> =
  mongoose.models.InvoiceCounter || mongoose.model<IInvoiceCounter>('InvoiceCounter', InvoiceCounterSchema);

/**
 * Atomically increments and formats the next sequential invoice number on the server.
 */
export async function getNextInvoiceNumber(
  session?: mongoose.ClientSession
): Promise<string> {
  const year = new Date().getFullYear();
  const seriesKey = `HM/${year}`;

  const counter = await InvoiceCounter.findOneAndUpdate(
    { seriesKey },
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true, session }
  );

  const sequentialNumber = String(counter.lastNumber).padStart(6, '0');
  return `HM/${year}/${sequentialNumber}`;
}
