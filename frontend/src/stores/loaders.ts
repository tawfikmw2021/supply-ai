import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface MappingEntry {
  source: string;
  target: string;
  transform: 'string' | 'number' | 'integer' | 'boolean' | 'date';
}

export interface Loader {
  id: number;
  name: string;
  file_format: 'csv' | 'tsv' | 'json' | 'image';
  delimiter: string;
  has_header: number;
  target_table: string;
  upsert_key: string;
  on_conflict: 'skip' | 'replace';
  mapping: MappingEntry[];
  created_at: string;
  updated_at: string;
}

export interface RunResult {
  total: number;
  inserted: number;
  skipped: number;
  replaced: number;
  errors: string[];
}

export interface TestResult extends RunResult {
  preview: ({ _action: 'insert' | 'skip' | 'replace'; [key: string]: any })[];
}

export interface TableSchema {
  name: string;
  columns: { name: string; type: string }[];
}

export const useLoadersStore = defineStore('loaders', () => {
  const loaders = ref<Loader[]>([]);

  async function fetchLoaders(): Promise<void> {
    const { data } = await api.get('/loaders');
    loaders.value = data.loaders;
  }

  async function fetchTables(): Promise<TableSchema[]> {
    const { data } = await api.get('/loaders/tables');
    return data.tables;
  }

  async function parseFile(formData: FormData): Promise<{ headers: string[]; preview: Record<string, string>[] }> {
    const { data } = await api.post('/loaders/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async function parseImage(formData: FormData): Promise<{ headers: string[]; preview: Record<string, string>[]; description: string }> {
    const { data } = await api.post('/loaders/parse-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async function getLoader(id: number): Promise<Loader> {
    const { data } = await api.get(`/loaders/${id}`);
    return data.loader;
  }

  async function createLoader(payload: Omit<Loader, 'id' | 'created_at' | 'updated_at'>): Promise<Loader> {
    const { data } = await api.post('/loaders', payload);
    loaders.value.push(data.loader);
    return data.loader;
  }

  async function updateLoader(id: number, payload: Partial<Omit<Loader, 'id' | 'created_at' | 'updated_at'>>): Promise<Loader> {
    const { data } = await api.put(`/loaders/${id}`, payload);
    const idx = loaders.value.findIndex(l => l.id === id);
    if (idx !== -1) loaders.value[idx] = data.loader;
    return data.loader;
  }

  async function deleteLoader(id: number): Promise<void> {
    await api.delete(`/loaders/${id}`);
    loaders.value = loaders.value.filter(l => l.id !== id);
  }

  async function runLoader(id: number, formData: FormData): Promise<RunResult> {
    const { data } = await api.post(`/loaders/${id}/run`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async function testLoader(id: number, formData: FormData): Promise<TestResult> {
    const { data } = await api.post(`/loaders/${id}/test`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  return { loaders, fetchLoaders, fetchTables, parseFile, parseImage, getLoader, createLoader, updateLoader, deleteLoader, runLoader, testLoader };
});
