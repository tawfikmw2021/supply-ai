import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { useAuthStore } from './auth';

export interface HelpItem {
  id: number;
  type: 'task' | 'bug' | 'question' | 'suggestion';
  message: string;
  user_id: number | null;
  user_name: string;
  status: 'open' | 'in_progress' | 'done' | 'closed' | 'rejected';
  attachments: string[];
  page_url: string;
  remarks: string;
  details: string;
  created_at: string;
}

function api() {
  const auth = useAuthStore();
  return axios.create({
    baseURL: `${import.meta.env.VITE_API_URL ?? ''}/help`,
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

export const useHelpStore = defineStore('help', () => {
  const items = ref<HelpItem[]>([]);

  async function submit(
    type: string, message: string,
    photos: File[] = [], pageUrl = '',
    audios: File[] = [], videos: File[] = [],
  ) {
    const fd = new FormData();
    fd.append('type', type);
    fd.append('message', message);
    fd.append('page_url', pageUrl);
    for (const f of photos) fd.append('photos', f);
    for (const f of audios) fd.append('audios', f);
    for (const f of videos) fd.append('videos', f);
    const res = await api().post('/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.item as HelpItem;
  }

  async function fetchAll(filters: { status?: string; type?: string } = {}) {
    const res = await api().get('/', { params: filters });
    items.value = res.data.items;
    return items.value;
  }

  async function updateStatus(id: number, status: string) {
    const updated = (await api().put(`/${id}`, { status })).data as HelpItem;
    const item = items.value.find(i => i.id === id);
    if (item) Object.assign(item, updated);
  }

  async function updateItem(id: number, patch: { status?: string; remarks?: string; details?: string }) {
    const updated = (await api().put(`/${id}`, patch)).data as HelpItem;
    const item = items.value.find(i => i.id === id);
    if (item) Object.assign(item, updated);
    return updated;
  }

  async function remove(id: number) {
    await api().delete(`/${id}`);
    items.value = items.value.filter(i => i.id !== id);
  }

  return { items, submit, fetchAll, updateStatus, updateItem, remove };
});
