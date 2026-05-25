import { defineStore } from 'pinia';
import api from '../api';
import { useAuthStore } from './auth';

export const useAccountStore = defineStore('account', () => {
  async function update(payload: { name?: string; properties?: Record<string, any> }) {
    const { data } = await api.put('/accounts/me', payload);
    useAuthStore().setAccount(data.account);
    return data.account;
  }

  return { update };
});
