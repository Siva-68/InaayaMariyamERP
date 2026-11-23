export interface DashboardSummary {
  totalSales: string;
  taxableSales: string;
  totalCgst: string;
  totalSgst: string;
  invoiceCount: number;
  cashCollected: string;
  upiCollected: string;
  totalCollected: string;
  outstandingAmount: string;
  totalCostOfGoodsSold?: string | null;
  estimatedGrossProfit?: string | null;
  profitMarginPercent?: string | null;
  uncostedItemsCount?: number;
  canViewProfit: boolean;
  profitMethodDocumentation: string;
}

export interface TrendItem {
  key: string;
  label: string;
  sales: number;
  collections: number;
  invoices: number;
}

export interface PaymentBreakdownItem {
  name: string;
  value: number;
  color: string;
}

export interface CategorySalesItem {
  category: string;
  sales: number;
  quantity: number;
}

export interface TopProductItem {
  productId: string;
  name: string;
  unit: string;
  quantitySold: number;
  totalRevenue: string;
}

export interface LowStockProductItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStockAlert: number;
  unit: string;
}

export interface InventoryAlerts {
  totalActiveProducts: number;
  outOfStockCount: number;
  lowStockCount: number;
  lowStockProducts: LowStockProductItem[];
  totalStockRetailValue: string;
  totalStockCostValue?: string | null;
}

export interface DashboardMetrics {
  period: string;
  startDate: string;
  endDate: string;
  summary: DashboardSummary;
  charts: {
    trend: TrendItem[];
    paymentBreakdown: PaymentBreakdownItem[];
    categorySales: CategorySalesItem[];
  };
  topProducts: TopProductItem[];
  inventoryAlerts: InventoryAlerts;
}

export type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface DailyReportItem {
  _id: string;
  reportDate: string;
  generatedAt: string;
  status: 'generating' | 'completed' | 'failed';
  fileName?: string;
  fileSizeBytes?: number;
  summarySnapshot: {
    totalSales: string;
    totalCollected: string;
    outstandingAmount: string;
    invoiceCount: number;
    estimatedGrossProfit?: string;
  };
  emailDelivery: {
    status: 'pending' | 'sent' | 'failed' | 'disabled';
    sentAt?: string;
    error?: string;
    recipient?: string;
  };
  whatsappDelivery: {
    status: 'pending' | 'sent' | 'failed' | 'disabled';
    sentAt?: string;
    error?: string;
    recipient?: string;
  };
  retries: number;
  triggeredBy: 'scheduler' | 'manual';
  errorMessage?: string;
}

