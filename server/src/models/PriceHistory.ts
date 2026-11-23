import mongoose, { Schema, Document, Model } from 'mongoose';

export type PriceField = 'sellingPrice' | 'purchasePrice' | 'mrp';

export interface IPriceHistory extends Document {
  productId: mongoose.Types.ObjectId;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  field: PriceField;
  previousValue: mongoose.Types.Decimal128;
  newValue: mongoose.Types.Decimal128;
  reason?: string | null;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    field: {
      type: String,
      enum: ['sellingPrice', 'purchasePrice', 'mrp'],
      required: true,
    },
    previousValue: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    newValue: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        if (r.previousValue) r.previousValue = r.previousValue.toString();
        if (r.newValue) r.newValue = r.newValue.toString();
        delete r.__v;
        return r;
      },
    },
  }
);

PriceHistorySchema.index({ productId: 1, changedAt: -1 });

export const PriceHistory: Model<IPriceHistory> =
  mongoose.models.PriceHistory || mongoose.model<IPriceHistory>('PriceHistory', PriceHistorySchema);
