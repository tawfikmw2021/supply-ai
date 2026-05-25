import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface InvoiceLine {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: number;
  type: 'client' | 'supplier';
  reference: string;
  client_id: number | null;
  supplier_id: number | null;
  client_name: string | null;
  supplier_name: string | null;
  entity_name: string | null;
  date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  notes: string;
  total: number;
  lines?: InvoiceLine[];
  created_at: string;
}

export const useInvoicesStore = defineStore('invoices', () => {
  const invoices = ref<Invoice[]>([]);
  const loading = ref(false);

  async function fetchInvoices(type?: 'client' | 'supplier') {
    loading.value = true;
    try {
      const params = type ? { type } : {};
      const { data } = await api.get('/invoices', { params });
      invoices.value = data.invoices;
    } finally {
      loading.value = false;
    }
  }

  async function fetchInvoice(id: number): Promise<Invoice> {
    const { data } = await api.get(`/invoices/${id}`);
    return data.invoice;
  }

  async function createInvoice(payload: Partial<Invoice> & { lines: InvoiceLine[] }): Promise<Invoice> {
    const { data } = await api.post('/invoices', payload);
    invoices.value.unshift(data.invoice);
    return data.invoice;
  }

  async function updateInvoice(id: number, payload: Partial<Invoice> & { lines?: InvoiceLine[] }): Promise<Invoice> {
    const { data } = await api.put(`/invoices/${id}`, payload);
    const idx = invoices.value.findIndex(i => i.id === id);
    if (idx !== -1) invoices.value[idx] = data.invoice;
    return data.invoice;
  }

  async function deleteInvoice(id: number) {
    await api.delete(`/invoices/${id}`);
    invoices.value = invoices.value.filter(i => i.id !== id);
  }

  return { invoices, loading, fetchInvoices, fetchInvoice, createInvoice, updateInvoice, deleteInvoice };
});
