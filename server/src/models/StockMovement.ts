import mongoose, { Schema, Document, Model } from 'mongoose';

export type MovementType = 'sale' | 'stock_in' | 'adjustment' | 'opening';
export type ReferenceType = 'invoice' | 'purchase_entry' | 'manual_adjustment' | null;

export interface IStockMovement extends Document {
  productId: mongoose.Types.ObjectId;
  productName: string;
  movementType: MovementType;
  delta: number;
  stockBefore: number;
  stockAfter: number;
  referenceType: ReferenceType;
  referenceId?: mongoose.Types.ObjectId | null;
  reason?: string | null;
  performedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
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
    movementType: {
      type: String,
      enum: ['sale', 'stock_in', 'adjustment', 'opening'],
      required: true,
      index: true,
    },
    delta: {
      type: Number,
      required: true,
    },
    stockBefore: {
      type: Number,
      required: true,
    },
    stockAfter: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['invoice', 'purchase_entry', 'manual_adjustment', null],
      default: null,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

StockMovementSchema.index({ productId: 1, createdAt: -1 });
StockMovementSchema.index({ createdAt: -1 });

export const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement || mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
