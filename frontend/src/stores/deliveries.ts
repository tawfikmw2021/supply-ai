import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface Delivery {
  id: number;
  reference: string;
  type: 'inbound' | 'outbound';
  supplier_id: number | null;
  supplier_name: string | null;
  client_id: number | null;
  client_name: string | null;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  expected_date: string | null;
  delivered_at: string | null;
  notes: string;
  created_at: string;
}

export type DeliveryPayload = Omit<Delivery, 'id' | 'supplier_name' | 'client_name' | 'created_at'>;

export const useDeliveriesStore = defineStore('deliveries', () => {
  const deliveries = ref<Delivery[]>([]);
  const loading    = ref(false);

  async function fetchDeliveries() {
    loading.value = true;
    try {
      const { data } = await api.get('/deliveries');
      deliveries.value = data.deliveries;
    } finally {
      loading.value = false;
    }
  }

  async function createDelivery(payload: Partial<DeliveryPayload>) {
    const { data } = await api.post('/deliveries', payload);
    deliveries.value.unshift(data.delivery);
    return data.delivery as Delivery;
  }

  async function updateDelivery(id: number, payload: Partial<DeliveryPayload>) {
    const { data } = await api.put(`/deliveries/${id}`, payload);
    const idx = deliveries.value.findIndex(d => d.id === id);
    if (idx !== -1) deliveries.value[idx] = data.delivery;
  }

  async function deleteDelivery(id: number) {
    await api.delete(`/deliveries/${id}`);
    deliveries.value = deliveries.value.filter(d => d.id !== id);
  }

  return { deliveries, loading, fetchDeliveries, createDelivery, updateDelivery, deleteDelivery };
});
