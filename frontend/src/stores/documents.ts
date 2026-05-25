import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface Document {
  id: number;
  type: string;
  url: string;
  properties: Record<string, any>;
  created_at: string;
}

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<Document[]>([]);
  const loading = ref(false);

  async function fetchDocuments() {
    loading.value = true;
    try {
      const { data } = await api.get('/documents');
      documents.value = data.documents;
    } finally {
      loading.value = false;
    }
  }

  async function createDocument(payload: { type: string; url?: string; properties?: Record<string, any> }, file?: File) {
    const form = new FormData();
    form.append('type', payload.type);
    if (payload.url) form.append('url', payload.url);
    if (payload.properties) form.append('properties', JSON.stringify(payload.properties));
    if (file) form.append('file', file);

    const { data } = await api.post('/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    documents.value.unshift(data.document);
    return data.document as Document;
  }

  async function updateDocument(id: number, payload: { type?: string; url?: string; properties?: Record<string, any> }) {
    const { data } = await api.put(`/documents/${id}`, payload);
    const idx = documents.value.findIndex(d => d.id === id);
    if (idx !== -1) documents.value[idx] = data.document;
  }

  async function uploadFile(id: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/documents/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const idx = documents.value.findIndex(d => d.id === id);
    if (idx !== -1) documents.value[idx] = data.document;
  }

  async function deleteDocument(id: number) {
    await api.delete(`/documents/${id}`);
    documents.value = documents.value.filter(d => d.id !== id);
  }

  return { documents, loading, fetchDocuments, createDocument, updateDocument, uploadFile, deleteDocument };
});
