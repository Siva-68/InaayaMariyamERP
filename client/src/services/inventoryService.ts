import { api } from './api';
import type { StockMovementItem } from '../types/product';
import type { ApiResponse } from '../types/auth';

export interface StockInPayload {
  productId: string;
  purchaseUnit: string;
  purchaseQty: number;
  conversionFactor: number;
  purchaseCost: string;
  purchaseDate?: string;
  notes?: string;
}

export interface AdjustStockPayload {
  productId: string;
  delta: number;
  reason: string;
}

export const inventoryService = {
  async recordStockIn(payload: StockInPayload): Promise<{ currentStock: number }> {
    const res = await api.post<ApiResponse<{ currentStock: number }>>('/inventory/stock-in', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to record stock in');
    }
    return res.data.data;
  },

  async adjustStock(payload: AdjustStockPayload): Promise<{ currentStock: number }> {
    const res = await api.post<ApiResponse<{ currentStock: number }>>('/inventory/adjust', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to adjust stock');
    }
    return res.data.data;
  },

  async getMovements(productId: string): Promise<StockMovementItem[]> {
    const res = await api.get<ApiResponse<{ movements: StockMovementItem[] }>>(
      `/inventory/movements/${productId}`
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch stock movements');
    }
    return res.data.data.movements;
  },
};
