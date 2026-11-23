export interface InvoiceLine {
  lineNumber: number;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  sellingPrice: string;
  gstRate: number;
  taxableAmount: string;
  cgst: string;
  sgst: string;
  lineTotal: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string | null;
  status: 'draft' | 'finalized';
  lines: InvoiceLine[];
  subtotalTaxable: string;
  totalCgst: string;
  totalSgst: string;
  grandTotal: string;
  amountPaid: string;
  outstandingAmount: string;
  idempotencyKey?: string | null;
  billedBy: {
    _id: string;
    name: string;
    email: string;
  };
  invoicedAt: string;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  unit: string;
  sellingPrice: string;
  gstRate: number | null;
  quantity: number;
  availableStock: number;
}
