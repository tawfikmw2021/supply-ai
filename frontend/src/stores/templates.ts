import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface Template {
  id: number;
  name: string;
  type: 'client' | 'supplier' | 'both';
  is_default_client: number;
  is_default_supplier: number;
  html: string;
  created_at: string;
  updated_at: string;
}

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<Template[]>([]);

  async function fetchTemplates(): Promise<Template[]> {
    const { data } = await api.get('/templates');
    templates.value = data.templates;
    return data.templates;
  }

  async function fetchDefaultTemplate(invoiceType: 'client' | 'supplier'): Promise<Template> {
    const { data } = await api.get(`/templates/default/${invoiceType}`);
    return data.template;
  }

  async function fetchTemplate(id: number): Promise<Template> {
    const { data } = await api.get(`/templates/${id}`);
    return data.template;
  }

  async function createTemplate(name: string, type: string, html: string): Promise<Template> {
    const { data } = await api.post('/templates', { name, type, html });
    templates.value.push(data.template);
    return data.template;
  }

  async function updateTemplate(
    id: number,
    payload: Partial<Pick<Template, 'name' | 'type' | 'html'>>,
  ): Promise<Template> {
    const { data } = await api.put(`/templates/${id}`, payload);
    const idx = templates.value.findIndex(t => t.id === id);
    if (idx !== -1) templates.value[idx] = data.template;
    return data.template;
  }

  async function setDefault(id: number, invoiceType: 'client' | 'supplier'): Promise<Template> {
    const { data } = await api.put(`/templates/${id}/default/${invoiceType}`, {});
    const col = invoiceType === 'client' ? 'is_default_client' : 'is_default_supplier';
    templates.value.forEach(t => { (t as any)[col] = t.id === id ? 1 : 0; });
    const idx = templates.value.findIndex(t => t.id === id);
    if (idx !== -1) templates.value[idx] = data.template;
    return data.template;
  }

  async function deleteTemplate(id: number): Promise<void> {
    await api.delete(`/templates/${id}`);
    templates.value = templates.value.filter(t => t.id !== id);
  }

  return {
    templates,
    fetchTemplates,
    fetchDefaultTemplate,
    fetchTemplate,
    createTemplate,
    updateTemplate,
    setDefault,
    deleteTemplate,
  };
});
