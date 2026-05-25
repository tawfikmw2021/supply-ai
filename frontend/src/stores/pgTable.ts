import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import api from '../api';

export interface PgColumnMeta {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface PgTableState {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  meta: PgColumnMeta[];
  pk: string;
}

// Cache table meta so we don't re-fetch on every navigation
const metaCache = new Map<string, { meta: PgColumnMeta[]; pk: string }>();

export const usePgTableStore = defineStore('pgTable', () => {
  const state = reactive<Record<string, PgTableState>>({});

  function getState(table: string): PgTableState {
    if (!state[table]) {
      state[table] = { rows: [], total: 0, page: 1, limit: 50, loading: false, meta: [], pk: 'id' };
    }
    return state[table];
  }

  async function fetchMeta(table: string) {
    if (metaCache.has(table)) {
      const cached = metaCache.get(table)!;
      const s = getState(table);
      s.meta = cached.meta;
      s.pk   = cached.pk;
      return;
    }
    try {
      const { data } = await api.get(`/pg/meta/${table}`);
      const cols: PgColumnMeta[] = Array.isArray(data.columns) ? data.columns : [];
      const pk:   string         = typeof data.pk === 'string' ? data.pk : 'id';
      metaCache.set(table, { meta: cols, pk });
      const s = getState(table);
      s.meta = cols;
      s.pk   = pk;
    } catch {
      // leave meta as [] so UI stays consistent
    }
  }

  async function fetchRows(table: string, page = 1, search = '') {
    const s = getState(table);
    s.loading = true;
    s.page    = page;
    try {
      const { data } = await api.get(`/pg/${table}`, {
        params: { page, limit: s.limit, search: search || undefined },
      });
      s.rows  = data.rows;
      s.total = data.total;
    } catch (err: any) {
      console.error(`[pgTable] fetchRows ${table}:`, err.message);
    } finally {
      s.loading = false;
    }
  }

  async function createRow(table: string, payload: Record<string, unknown>) {
    const { data } = await api.post(`/pg/${table}`, payload);
    const s = getState(table);
    s.rows.unshift(data.row);
    s.total++;
    return data.row;
  }

  async function updateRow(table: string, id: unknown, payload: Record<string, unknown>) {
    const { data } = await api.put(`/pg/${table}/${id}`, payload);
    const s = getState(table);
    const idx = s.rows.findIndex(r => r[s.pk] === id);
    if (idx !== -1) s.rows[idx] = data.row;
  }

  async function deleteRow(table: string, id: unknown) {
    const s = getState(table);
    await api.delete(`/pg/${table}/${id}`);
    s.rows = s.rows.filter(r => r[s.pk] !== id);
    s.total = Math.max(0, s.total - 1);
  }

  return { getState, fetchMeta, fetchRows, createRow, updateRow, deleteRow };
});
