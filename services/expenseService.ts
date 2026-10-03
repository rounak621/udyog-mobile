import { api } from './api';
import * as FileSystem from 'expo-file-system/legacy';

export type PaymentMode = 'CASH' | 'BANK' | 'UPI' | 'CHEQUE';

export interface Expense {
  id: string;
  business_id: string;
  date: string;
  category: string;
  amount: number;
  payment_mode: PaymentMode;
  is_gst_applicable: boolean;
  vendor_gstin?: string | null;
  vendor_name?: string | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  notes?: string | null;
  receipt_url?: string | null;
  created_at: string;
  is_deleted: boolean;
}

export interface ExpenseCreatePayload {
  date: string;
  category: string;
  amount: number;
  payment_mode: PaymentMode;
  is_gst_applicable: boolean;
  vendor_gstin?: string | null;
  vendor_name?: string | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  notes?: string | null;
  receipt_url?: string | null;
}

export interface ExpenseUpdatePayload {
  date?: string;
  category?: string;
  amount?: number;
  payment_mode?: PaymentMode;
  is_gst_applicable?: boolean;
  vendor_gstin?: string | null;
  vendor_name?: string | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  notes?: string | null;
  receipt_url?: string | null;
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
  total_amount: number;
}

export interface ExpenseCategoriesResponse {
  categories: string[];
}

export interface ExpenseCategorySummary {
  category: string;
  total_amount: number;
  count: number;
}

export interface ExpenseBreakdownResponse {
  categories: ExpenseCategorySummary[];
  total_amount: number;
}

export const expenseService = {
  listExpenses: async (
    businessId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      category?: string;
      skip?: number;
      limit?: number;
    }
  ): Promise<ExpenseListResponse> => {
    const res = await api.get('/expenses/', {
      params: {
        business_id: businessId,
        start_date: params?.startDate || undefined,
        end_date: params?.endDate || undefined,
        category: params?.category || undefined,
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 500,
      },
    });
    return res.data;
  },

  getExpense: async (businessId: string, id: string): Promise<Expense> => {
    const res = await api.get(`/expenses/${id}`, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  createExpense: async (businessId: string, payload: ExpenseCreatePayload): Promise<Expense> => {
    const res = await api.post('/expenses/', payload, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  updateExpense: async (
    businessId: string,
    id: string,
    payload: ExpenseUpdatePayload
  ): Promise<Expense> => {
    const res = await api.put(`/expenses/${id}`, payload, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  deleteExpense: async (businessId: string, id: string): Promise<{ message: string }> => {
    const res = await api.delete(`/expenses/${id}`, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  getCategories: async (businessId: string): Promise<string[]> => {
    const res = await api.get('/expenses/categories', {
      params: { business_id: businessId },
    });
    return res.data?.categories || [];
  },

  getBreakdown: async (
    businessId: string,
    params?: { startDate?: string; endDate?: string }
  ): Promise<ExpenseBreakdownResponse> => {
    const res = await api.get('/expenses/breakdown', {
      params: {
        business_id: businessId,
        start_date: params?.startDate || undefined,
        end_date: params?.endDate || undefined,
      },
    });
    return res.data;
  },

  uploadReceipt: async (
    businessId: string,
    uri: string
  ): Promise<{ url: string; filename: string; content_type: string }> => {
    // Validate 5MB limit before sending
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists && (fileInfo as any).size && (fileInfo as any).size > 5 * 1024 * 1024) {
        throw new Error('Receipt file size must be under 5MB.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('5MB')) throw e;
    }

    const filename = uri.split('/').pop() || 'receipt.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    let mime = 'image/jpeg';
    if (ext === 'png') mime = 'image/png';
    else if (ext === 'pdf') mime = 'application/pdf';

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: filename,
      type: mime,
    } as any);

    const res = await api.post(`/expenses/upload-receipt?business_id=${businessId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });

    return res.data;
  },
};
