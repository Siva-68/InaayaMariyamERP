import { api } from './api';
import type { Invoice } from '../types/invoice';
import type { ApiResponse } from '../types/auth';

export interface CreateInvoicePayload {
  idempotencyKey?: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  lines: Array<{
    productId: string;
    quantity: number;
    sellingPrice: string;
  }>;
  payment: {
    method: 'cash' | 'upi' | 'split';
    cashAmount: string;
    upiAmount: string;
    upiReference?: string | null;
    note?: string | null;
  };
}

export interface CreateInvoiceResult {
  invoice: Invoice;
  whatsappAdminUrl?: string;
  whatsappCustomerUrl?: string;
}

export const invoiceService = {
  async createInvoice(payload: CreateInvoicePayload): Promise<CreateInvoiceResult> {
    const res = await api.post<ApiResponse<CreateInvoiceResult>>('/invoices', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to finalize invoice');
    }
    return res.data.data;
  },

  async listInvoices(params: Record<string, string> = {}): Promise<{ invoices: Invoice[]; total: number }> {
    const qs = new URLSearchParams(params).toString();
    const res = await api.get<ApiResponse<{ invoices: Invoice[]; pagination: { total: number } }>>(
      `/invoices?${qs}`
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch invoices');
    }
    return { invoices: res.data.data.invoices, total: res.data.data.pagination.total };
  },

  async getInvoiceById(id: string): Promise<Invoice> {
    const res = await api.get<ApiResponse<{ invoice: Invoice }>>(`/invoices/${id}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch invoice');
    }
    return res.data.data.invoice;
  },
};
