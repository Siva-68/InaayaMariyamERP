import { api } from './api';
import type { Product, PriceHistoryItem } from '../types/product';
import type { ApiResponse } from '../types/auth';

export interface ProductFilters {
  search?: string;
  category?: string;
  lowStock?: boolean;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ProductListResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const productService = {
  async listProducts(filters: ProductFilters = {}): Promise<ProductListResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.lowStock) params.append('lowStock', 'true');
    if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const res = await api.get<ApiResponse<ProductListResponse>>(`/products?${params.toString()}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch products');
    }
    return res.data.data;
  },

  async createProduct(data: Partial<Product>): Promise<Product> {
    const res = await api.post<ApiResponse<{ product: Product }>>('/products', data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to create product');
    }
    return res.data.data.product;
  },

  async updateProduct(id: string, updates: Partial<Product> & { reason?: string }): Promise<Product> {
    const res = await api.patch<ApiResponse<{ product: Product }>>(`/products/${id}`, updates);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to update product');
    }
    return res.data.data.product;
  },

  async deleteProduct(id: string): Promise<{ message: string; product?: Product }> {
    const res = await api.delete<ApiResponse<{ message: string; product?: Product }>>(`/products/${id}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to delete product');
    }
    return res.data.data;
  },

  async getPriceHistory(id: string): Promise<PriceHistoryItem[]> {
    const res = await api.get<ApiResponse<{ history: PriceHistoryItem[] }>>(`/products/${id}/price-history`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch price history');
    }
    return res.data.data.history;
  },
};
