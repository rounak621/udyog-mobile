import { api } from './api';

export type QuotationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface QuotationLineItem {
  id?: number | string;
  item_id?: number | null;
  item_name?: string | null;
  hsn_code?: string | null;
  description?: string | null;
  quantity: number | string;
  rate: number | string;
  gst_rate?: number | string | null;
  tax_amount?: number | string;
  line_total?: number | string;
  discount_percent?: number | string;
  unit?: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  state?: string | null;
}

export interface Quotation {
  id: string;
  business_id: string;
  customer_id: string;
  quotation_number: string;
  status: QuotationStatus;
  valid_until?: string | null;
  issue_date: string;
  subtotal: string | number;
  total_tax_amount: string | number;
  total_amount: string | number;
  cgst_amount?: string | number | null;
  sgst_amount?: string | number | null;
  igst_amount?: string | number | null;
  round_off: string | number;
  terms_and_conditions?: string | null;
  notes?: string | null;
  walk_in_name?: string | null;
  share_token?: string | null;
  converted_invoice_id?: number | string | null;
  converted_at?: string | null;
  created_at: string;
  updated_at: string;
  customer?: CustomerSummary | null;
  items?: QuotationLineItem[];
}

export interface QuotationListItem {
  id: string;
  quotation_number: string;
  share_token?: string | null;
  customer_id: string;
  customer_name?: string | null;
  walk_in_name?: string | null;
  issue_date: string;
  valid_until?: string | null;
  status: QuotationStatus;
  subtotal: string | number;
  total_tax_amount: string | number;
  total_amount: string | number;
  converted_invoice_id?: number | string | null;
  created_at: string;
}

export interface QuotationListResponse {
  total: number;
  items: QuotationListItem[];
  skip: number;
  limit: number;
}

export interface CreateQuotationPayload {
  customer_id: string;
  issue_date?: string;
  valid_until?: string | null;
  line_items: {
    item_id?: number | null;
    item_name?: string | null;
    hsn_code?: string | null;
    description?: string | null;
    quantity: number;
    rate: number;
    discount_percent?: number;
    gst_rate?: number;
  }[];
  terms_and_conditions?: string | null;
  notes?: string | null;
  walk_in_name?: string | null;
}

export interface ConvertedInvoiceResponse {
  id: number | string;
  invoice_number?: string;
  [key: string]: any;
}

export const quotationService = {
  async listQuotations(
    businessId: string,
    params?: {
      status?: string;
      customer_id?: string;
      start_date?: string;
      end_date?: string;
      skip?: number;
      limit?: number;
    }
  ): Promise<QuotationListResponse> {
    const res = await api.get<QuotationListResponse>('/quotations/', {
      params: {
        business_id: businessId,
        ...params,
      },
    });
    return res.data;
  },

  async getQuotation(id: string, businessId: string): Promise<Quotation> {
    const res = await api.get<Quotation>(`/quotations/${id}`, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  async createQuotation(businessId: string, payload: CreateQuotationPayload): Promise<Quotation> {
    const res = await api.post<Quotation>('/quotations/', payload, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  async updateQuotation(id: string, businessId: string, payload: Partial<CreateQuotationPayload>): Promise<Quotation> {
    const res = await api.put<Quotation>(`/quotations/${id}`, payload, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  async deleteQuotation(id: string, businessId: string): Promise<{ status: string; message: string }> {
    const res = await api.delete<{ status: string; message: string }>(`/quotations/${id}`, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  async acceptQuotation(id: string, businessId: string): Promise<Quotation> {
    const res = await api.post<Quotation>(`/quotations/${id}/accept`, null, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  async rejectQuotation(id: string, businessId: string): Promise<Quotation> {
    const res = await api.post<Quotation>(`/quotations/${id}/reject`, null, {
      params: { business_id: businessId },
    });
    return res.data;
  },

  async convertToInvoice(id: string, businessId: string): Promise<ConvertedInvoiceResponse> {
    const res = await api.post<ConvertedInvoiceResponse>(`/quotations/${id}/convert-to-invoice`, null, {
      params: { business_id: businessId },
    });
    return res.data;
  },
};
