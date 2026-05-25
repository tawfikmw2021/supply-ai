import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import api from '../api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  account_id: number;
}

interface Account {
  id: number;
  name: string;
  properties: Record<string, any>;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const account = ref<Account | null>(null);
  const token = ref<string | null>(localStorage.getItem('token'));

  function setAuth(t: string, u: User, a: Account) {
    token.value = t;
    user.value = u;
    account.value = a;
    localStorage.setItem('token', t);
    localStorage.setItem('accountId', String(u.account_id));
  }

  function setAccount(a: Account) {
    account.value = a;
  }

  function logout() {
    token.value = null;
    user.value = null;
    account.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('accountId');
    localStorage.removeItem('lastRoute');
    localStorage.removeItem('viewAsUser');
  }

  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me');
      user.value = data.user;
      account.value = data.account;
    } catch {
      logout();
    }
  }

  // Default: user mode (true). Persisted across refreshes.
  const viewAsUser = ref(localStorage.getItem('viewAsUser') !== 'false');
  watch(viewAsUser, v => localStorage.setItem('viewAsUser', String(v)));

  return { user, account, token, viewAsUser, setAuth, setAccount, logout, fetchMe };
});
