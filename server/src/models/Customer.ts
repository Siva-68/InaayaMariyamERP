import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  mobile: string;
  email?: string | null;
  totalPurchaseAmount: mongoose.Types.Decimal128;
  totalInvoicesCount: number;
  lastPurchaseDate: Date;
  lastInvoiceNumber: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      default: null,
      trim: true,
    },
    totalPurchaseAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    totalInvoicesCount: {
      type: Number,
      required: true,
      default: 0,
    },
    lastPurchaseDate: {
      type: Date,
      default: Date.now,
    },
    lastInvoiceNumber: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        if (r.totalPurchaseAmount) {
          r.totalPurchaseAmount = r.totalPurchaseAmount.toString();
        }
        return r;
      },
    },
  }
);

export const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
