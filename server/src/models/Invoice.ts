import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvoiceLine {
  lineNumber: number;
  productId: mongoose.Types.ObjectId;
  productName: string;
  unit: string;
  quantity: number;
  sellingPrice: mongoose.Types.Decimal128;
  purchaseCost?: mongoose.Types.Decimal128 | null;
  gstRate: number;
  taxableAmount: mongoose.Types.Decimal128;
  cgst: mongoose.Types.Decimal128;
  sgst: mongoose.Types.Decimal128;
  lineTotal: mongoose.Types.Decimal128;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string | null;
  status: 'draft' | 'finalized';
  lines: IInvoiceLine[];
  subtotalTaxable: mongoose.Types.Decimal128;
  totalCgst: mongoose.Types.Decimal128;
  totalSgst: mongoose.Types.Decimal128;
  grandTotal: mongoose.Types.Decimal128;
  amountPaid: mongoose.Types.Decimal128;
  outstandingAmount: mongoose.Types.Decimal128;
  idempotencyKey?: string | null;
  billedBy: mongoose.Types.ObjectId;
  invoicedAt: Date;
  finalizedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineSchema = new Schema<IInvoiceLine>(
  {
    lineNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    unit: { type: String, default: 'packet' },
    quantity: { type: Number, required: true, min: 1 },
    sellingPrice: { type: Schema.Types.Decimal128, required: true },
    purchaseCost: { type: Schema.Types.Decimal128, default: null },
    gstRate: { type: Number, required: true },
    taxableAmount: { type: Schema.Types.Decimal128, required: true },
    cgst: { type: Schema.Types.Decimal128, required: true },
    sgst: { type: Schema.Types.Decimal128, required: true },
    lineTotal: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerMobile: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'finalized'],
      default: 'finalized',
      index: true,
    },
    lines: [InvoiceLineSchema],
    subtotalTaxable: { type: Schema.Types.Decimal128, required: true },
    totalCgst: { type: Schema.Types.Decimal128, required: true },
    totalSgst: { type: Schema.Types.Decimal128, required: true },
    grandTotal: { type: Schema.Types.Decimal128, required: true },
    amountPaid: { type: Schema.Types.Decimal128, required: true },
    outstandingAmount: { type: Schema.Types.Decimal128, required: true },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    billedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invoicedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    finalizedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        if (r.subtotalTaxable) r.subtotalTaxable = r.subtotalTaxable.toString();
        if (r.totalCgst) r.totalCgst = r.totalCgst.toString();
        if (r.totalSgst) r.totalSgst = r.totalSgst.toString();
        if (r.grandTotal) r.grandTotal = r.grandTotal.toString();
        if (r.amountPaid) r.amountPaid = r.amountPaid.toString();
        if (r.outstandingAmount) r.outstandingAmount = r.outstandingAmount.toString();
        if (Array.isArray(r.lines)) {
          r.lines = r.lines.map((line: Record<string, unknown>) => {
            if (line.sellingPrice) line.sellingPrice = line.sellingPrice.toString();
            if (line.purchaseCost) line.purchaseCost = line.purchaseCost.toString();
            if (line.taxableAmount) line.taxableAmount = line.taxableAmount.toString();
            if (line.cgst) line.cgst = line.cgst.toString();
            if (line.sgst) line.sgst = line.sgst.toString();
            if (line.lineTotal) line.lineTotal = line.lineTotal.toString();
            return line;
          });
        }
        delete r.__v;
        return r;
      },
    },
  }
);

// Immutability invariant: prevent updating finalized invoices
InvoiceSchema.pre('save', function (next) {
  if (!this.isNew && this.status === 'finalized' && this.isModified('lines')) {
    return next(new Error('Finalized invoices are strictly immutable. Lines cannot be modified.'));
  }
  next();
});

InvoiceSchema.index({ invoicedAt: -1 });
InvoiceSchema.index({ customerName: 'text' });

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);
