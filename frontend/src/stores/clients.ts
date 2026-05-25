import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
}

export const useClientsStore = defineStore('clients', () => {
  const clients = ref<Client[]>([]);
  const loading = ref(false);

  async function fetchClients() {
    loading.value = true;
    try {
      const { data } = await api.get('/clients');
      clients.value = data.clients;
    } finally {
      loading.value = false;
    }
  }

  async function createClient(payload: Omit<Client, 'id' | 'created_at'>) {
    const { data } = await api.post('/clients', payload);
    clients.value.unshift(data.client);
    return data.client as Client;
  }

  async function updateClient(id: number, payload: Partial<Omit<Client, 'id' | 'created_at'>>) {
    const { data } = await api.put(`/clients/${id}`, payload);
    const idx = clients.value.findIndex(c => c.id === id);
    if (idx !== -1) clients.value[idx] = data.client;
  }

  async function deleteClient(id: number) {
    await api.delete(`/clients/${id}`);
    clients.value = clients.value.filter(c => c.id !== id);
  }

  return { clients, loading, fetchClients, createClient, updateClient, deleteClient };
});
