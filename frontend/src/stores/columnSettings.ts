import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import api from '../api';

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  width?: string;
}

export const useColumnSettingsStore = defineStore('columnSettings', () => {
  const cache        = reactive<Record<string, ColumnConfig[]>>({});
  const hiddenTables = reactive<Record<string, boolean>>({});
  const loading      = ref(false);
  const pending      = new Set<string>();

  // Fetch hidden flags for ALL tables in one request (used by sidebar)
  async function fetchAllHidden() {
    try {
      const { data } = await api.get('/column-settings');
      // data.tables: Record<tableName, hidden>
      // Tables not in the response have no saved settings → hidden by default
      Object.assign(hiddenTables, data.tables);
    } catch { /* ignore */ }
  }

  async function fetchSettings(table: string): Promise<ColumnConfig[]> {
    if (cache[table]) return cache[table];
    if (pending.has(table)) return [];
    pending.add(table);
    try {
      const { data } = await api.get(`/column-settings/${table}`);
      const cols: ColumnConfig[] = Array.isArray(data.columns) ? data.columns : [];
      cache[table]        = cols;
      hiddenTables[table] = data.hidden ?? true;   // default hidden
      return cols;
    } catch {
      cache[table]        = [];
      hiddenTables[table] = true;                  // default hidden
      return [];
    } finally {
      pending.delete(table);
    }
  }

  async function saveSettings(table: string, columns: ColumnConfig[], hidden?: boolean) {
    const hiddenVal = hidden !== undefined ? hidden : (hiddenTables[table] ?? false);
    await api.put(`/column-settings/${table}`, { columns, hidden: hiddenVal });
    cache[table]        = columns;
    hiddenTables[table] = hiddenVal;
  }

  async function setTableHidden(table: string, hidden: boolean) {
    const cols = cache[table] ?? [];
    await saveSettings(table, cols, hidden);
  }

  function invalidate(table: string) {
    delete cache[table];
    delete hiddenTables[table];
  }

  return { cache, hiddenTables, loading, fetchAllHidden, fetchSettings, saveSettings, setTableHidden, invalidate };
});
