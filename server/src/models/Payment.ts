import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentMethod = 'cash' | 'upi' | 'split';

export interface IPayment extends Document {
  invoiceId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  method: PaymentMethod;
  cashAmount: mongoose.Types.Decimal128;
  upiAmount: mongoose.Types.Decimal128;
  totalAmount: mongoose.Types.Decimal128;
  upiReference?: string | null;
  recordedBy: mongoose.Types.ObjectId;
  paidAt: Date;
  note?: string | null;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ['cash', 'upi', 'split'],
      required: true,
    },
    cashAmount: {
      type: Schema.Types.Decimal128,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    upiAmount: {
      type: Schema.Types.Decimal128,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    totalAmount: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    upiReference: {
      type: String,
      default: null,
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paidAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    note: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        if (r.cashAmount) r.cashAmount = r.cashAmount.toString();
        if (r.upiAmount) r.upiAmount = r.upiAmount.toString();
        if (r.totalAmount) r.totalAmount = r.totalAmount.toString();
        delete r.__v;
        return r;
      },
    },
  }
);

PaymentSchema.index({ invoiceId: 1, paidAt: -1 });

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
