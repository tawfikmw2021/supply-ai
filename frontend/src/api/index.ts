import axios from 'axios';

const STORAGE_KEY = 'backendUrl';

function defaultBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const origin = window.location.origin;
  return origin.startsWith('http') ? origin : 'http://localhost:3100';
}

export function getBackendUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || defaultBaseUrl();
}

export function setBackendUrl(url: string) {
  const trimmed = url.replace(/\/+$/, '');
  if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
  else localStorage.removeItem(STORAGE_KEY);
}

const api = axios.create({ baseURL: getBackendUrl() });

api.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
