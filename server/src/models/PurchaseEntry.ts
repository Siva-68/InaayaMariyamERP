import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPurchaseEntry extends Document {
  productId: mongoose.Types.ObjectId;
  productName: string;
  purchaseUnit: string;
  purchaseQty: number;
  conversionFactor: number;
  unitQtyAdded: number;
  purchaseCost: mongoose.Types.Decimal128;
  totalCost: mongoose.Types.Decimal128;
  purchaseDate: Date;
  notes?: string | null;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PurchaseEntrySchema = new Schema<IPurchaseEntry>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    purchaseUnit: {
      type: String,
      required: true,
      default: 'carton',
      trim: true,
    },
    purchaseQty: {
      type: Number,
      required: true,
      min: 1,
    },
    conversionFactor: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    unitQtyAdded: {
      type: Number,
      required: true,
    },
    purchaseCost: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    totalCost: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        if (r.purchaseCost) r.purchaseCost = r.purchaseCost.toString();
        if (r.totalCost) r.totalCost = r.totalCost.toString();
        delete r.__v;
        return r;
      },
    },
  }
);

PurchaseEntrySchema.index({ purchaseDate: -1 });

export const PurchaseEntry: Model<IPurchaseEntry> =
  mongoose.models.PurchaseEntry || mongoose.model<IPurchaseEntry>('PurchaseEntry', PurchaseEntrySchema);
