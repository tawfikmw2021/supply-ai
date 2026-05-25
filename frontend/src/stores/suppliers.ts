import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  notes: string;
  created_at: string;
}

export const useSuppliersStore = defineStore('suppliers', () => {
  const suppliers = ref<Supplier[]>([]);
  const loading = ref(false);

  async function fetchSuppliers() {
    loading.value = true;
    try {
      const { data } = await api.get('/suppliers');
      suppliers.value = data.suppliers;
    } finally {
      loading.value = false;
    }
  }

  async function createSupplier(payload: Omit<Supplier, 'id' | 'created_at'>) {
    const { data } = await api.post('/suppliers', payload);
    suppliers.value.unshift(data.supplier);
    return data.supplier as Supplier;
  }

  async function updateSupplier(id: number, payload: Partial<Omit<Supplier, 'id' | 'created_at'>>) {
    const { data } = await api.put(`/suppliers/${id}`, payload);
    const idx = suppliers.value.findIndex(s => s.id === id);
    if (idx !== -1) suppliers.value[idx] = data.supplier;
  }

  async function deleteSupplier(id: number) {
    await api.delete(`/suppliers/${id}`);
    suppliers.value = suppliers.value.filter(s => s.id !== id);
  }

  return { suppliers, loading, fetchSuppliers, createSupplier, updateSupplier, deleteSupplier };
});
