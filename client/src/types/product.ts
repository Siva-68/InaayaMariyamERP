export interface Product {
  _id: string;
  name: string;
  category: string;
  sapCode?: string | null;
  barcode?: string | null;
  packType: string;
  netWeight?: string | null;
  piecesPerPack?: number | null;
  unitsPerCarton?: number | null;
  purchasePrice?: string; // string representation of Decimal128 (hidden for billing operator)
  sellingPrice: string;
  mrp?: string | null;
  gstRate?: number | null;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  serialNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistoryItem {
  _id: string;
  productId: string;
  field: 'sellingPrice' | 'purchasePrice' | 'mrp';
  previousValue: string;
  newValue: string;
  reason?: string;
  changedBy: {
    _id: string;
    name: string;
    email: string;
  };
  changedAt: string;
}

export interface StockMovementItem {
  _id: string;
  productId: string;
  productName: string;
  movementType: 'sale' | 'stock_in' | 'adjustment' | 'opening';
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason?: string;
  referenceType?: string;
  performedBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}
