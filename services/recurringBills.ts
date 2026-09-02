import { api } from './api';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
export type RecurringStatus = 'active' | 'paused' | 'stopped';

export interface RecurringLineItem {
  id?: string | number;
  item_id?: number | null;
  item_name?: string | null;
  quantity: string | number;
  rate: string | number;
  gst_rate?: string | number | null;
  hsn_code?: string | null;
  description?: string | null;
  discount_percent?: string | number;
  unit?: string;
}

export interface RecurringBillTemplate {
  id: string;
  business_id: string;
  customer_id: string;
  customer_name?: string;
  line_items: RecurringLineItem[];
  frequency: RecurringFrequency;
  interval_days: number | null;
  billing_day: number | null;
  billing_time: string | null;
  start_date: string;
  end_date: string | null;
  status: RecurringStatus;
  auto_send_enabled: boolean;
  whatsapp_auto_send: boolean;
  next_run_date: string;
  last_generated_invoice_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringBillPayload {
  customer_id: string;
  line_items: {
    item_id?: number | null;
    item_name?: string | null;
    quantity: number;
    rate: number;
    gst_rate?: number;
    hsn_code?: string | null;
    description?: string | null;
    discount_percent?: number;
    unit?: string;
  }[];
  frequency: RecurringFrequency;
  interval_days?: number | null;
  billing_day?: number | null;
  billing_time?: string | null;
  start_date: string;
  end_date?: string | null;
  auto_send_enabled?: boolean;
  whatsapp_auto_send?: boolean;
  notes?: string | null;
}

export interface UpdateRecurringBillPayload {
  customer_id?: string;
  line_items?: {
    item_id?: number | null;
    item_name?: string | null;
    quantity: number;
    rate: number;
    gst_rate?: number;
    hsn_code?: string | null;
    description?: string | null;
    discount_percent?: number;
  }[];
  frequency?: RecurringFrequency;
  interval_days?: number | null;
  billing_day?: number | null;
  billing_time?: string | null;
  start_date?: string;
  end_date?: string | null;
  status?: RecurringStatus;
  auto_send_enabled?: boolean;
  whatsapp_auto_send?: boolean;
  notes?: string | null;
}

export interface RecurringBillGenerationLog {
  id: string;
  recurring_bill_template_id: string;
  generated_invoice_id: number | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface PreviewRecurringBillPayload {
  customer_id: string;
  line_items: {
    item_id?: number | null;
    item_name?: string | null;
    quantity: number;
    rate: number;
    gst_rate?: number;
    hsn_code?: string | null;
    description?: string | null;
    discount_percent?: number;
  }[];
  start_date?: string;
  notes?: string | null;
}

const base = (businessId: string) => `/business/${businessId}/recurring-bills`;

export const recurringBillsService = {
  async list(businessId: string): Promise<RecurringBillTemplate[]> {
    const res = await api.get<RecurringBillTemplate[]>(base(businessId));
    return res.data;
  },

  async get(businessId: string, templateId: string): Promise<RecurringBillTemplate> {
    const res = await api.get<RecurringBillTemplate>(`${base(businessId)}/${templateId}`);
    return res.data;
  },

  async create(businessId: string, payload: CreateRecurringBillPayload): Promise<RecurringBillTemplate> {
    const res = await api.post<RecurringBillTemplate>(base(businessId), payload);
    return res.data;
  },

  async update(
    businessId: string,
    templateId: string,
    payload: UpdateRecurringBillPayload
  ): Promise<RecurringBillTemplate> {
    const res = await api.patch<RecurringBillTemplate>(`${base(businessId)}/${templateId}`, payload);
    return res.data;
  },

  async remove(businessId: string, templateId: string): Promise<void> {
    await api.delete<void>(`${base(businessId)}/${templateId}`);
  },

  async logs(businessId: string, templateId: string): Promise<RecurringBillGenerationLog[]> {
    const res = await api.get<RecurringBillGenerationLog[]>(`${base(businessId)}/${templateId}/logs`);
    return res.data;
  },

  async previewPdf(businessId: string, payload: PreviewRecurringBillPayload): Promise<ArrayBuffer> {
    const res = await api.post(`${base(businessId)}/preview-pdf`, payload, {
      responseType: 'arraybuffer',
    });
    return res.data;
  },
};
