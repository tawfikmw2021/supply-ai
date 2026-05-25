import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  account_id: number;
  created_at: string;
}

export const useUsersStore = defineStore('users', () => {
  const users = ref<AppUser[]>([]);
  const loading = ref(false);

  async function fetchUsers() {
    loading.value = true;
    try {
      const { data } = await api.get('/users');
      users.value = data.users;
    } finally {
      loading.value = false;
    }
  }

  async function createUser(payload: { name: string; email: string; password: string; role: string }) {
    const { data } = await api.post('/users', payload);
    users.value.push(data.user);
    return data.user as AppUser;
  }

  async function updateUser(id: number, payload: { name?: string; role?: string }) {
    const { data } = await api.put(`/users/${id}`, payload);
    const idx = users.value.findIndex(u => u.id === id);
    if (idx !== -1) users.value[idx] = data.user;
  }

  async function resetPassword(id: number, password: string) {
    await api.put(`/users/${id}/password`, { password });
  }

  async function deleteUser(id: number) {
    await api.delete(`/users/${id}`);
    users.value = users.value.filter(u => u.id !== id);
  }

  return { users, loading, fetchUsers, createUser, updateUser, resetPassword, deleteUser };
});
