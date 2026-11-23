import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  category: string;
  sapCode?: string | null;
  barcode?: string | null;
  packType: string;
  netWeight?: string | null;
  piecesPerPack?: number | null;
  unitsPerCarton?: number | null;
  purchasePrice: mongoose.Types.Decimal128;
  sellingPrice: mongoose.Types.Decimal128;
  mrp?: mongoose.Types.Decimal128 | null;
  gstRate?: number | null;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  serialNumber?: string | null;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sapCode: {
      type: String,
      default: null,
      trim: true,
      sparse: true,
    },
    barcode: {
      type: String,
      default: null,
      trim: true,
      sparse: true,
    },
    packType: {
      type: String,
      required: true,
      default: 'packet',
      trim: true,
    },
    netWeight: {
      type: String,
      default: null,
      trim: true,
    },
    piecesPerPack: {
      type: Number,
      default: null,
    },
    unitsPerCarton: {
      type: Number,
      default: 1,
    },
    purchasePrice: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    sellingPrice: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    mrp: {
      type: Schema.Types.Decimal128,
      default: null,
    },
    gstRate: {
      type: Number,
      default: null, // Unconfirmed until verified by accountant
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    serialNumber: {
      type: String,
      default: null,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        if (r.purchasePrice) r.purchasePrice = r.purchasePrice.toString();
        if (r.sellingPrice) r.sellingPrice = r.sellingPrice.toString();
        if (r.mrp) r.mrp = r.mrp.toString();
        delete r.__v;
        return r;
      },
    },
  }
);

// Compound unique index on name and category to prevent duplicate products
ProductSchema.index({ name: 1, category: 1 }, { unique: true });
ProductSchema.index({ stock: 1, lowStockThreshold: 1 });
ProductSchema.index({ isActive: 1, category: 1 });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
