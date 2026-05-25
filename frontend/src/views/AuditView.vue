<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import api from '../api';
import DataGrid, { type GridColumn } from '../components/DataGrid.vue';

interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: number | null;
  data: any;
  created_at: string;
}

const logs = ref<AuditLog[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');

const filterTable = ref('');
const filterOp = ref('');
const limit = 50;
const offset = ref(0);

const expandedId = ref<number | null>(null);

async function fetchLogs() {
  loading.value = true;
  error.value = '';
  try {
    const params: Record<string, any> = { limit, offset: offset.value };
    if (filterTable.value) params.table = filterTable.value;
    if (filterOp.value) params.operation = filterOp.value;
    const { data } = await api.get('/audit', { params });
    logs.value = data.logs;
    total.value = data.total;
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Erreur de chargement';
  } finally {
    loading.value = false;
  }
}

watch([filterTable, filterOp], () => { offset.value = 0; fetchLogs(); });
onMounted(fetchLogs);

function prevPage() {
  if (offset.value > 0) { offset.value = Math.max(0, offset.value - limit); fetchLogs(); }
}
function nextPage() {
  if (offset.value + limit < total.value) { offset.value += limit; fetchLogs(); }
}

// ── Grid ───────────────────────────────────────────────
const columns: GridColumn[] = [
  { key: 'created_at', label: 'Date',        width: '140px' },
  { key: 'user_name',  label: 'Utilisateur', width: '150px' },
  { key: 'table_name', label: 'Table',       width: '110px' },
  { key: 'operation',  label: 'Opération',   width: '100px' },
  { key: 'record_id',  label: 'ID',          width: '60px'  },
  { key: 'data',       label: 'Données' },
];

const opColor: Record<string, string> = {
  INSERT: '#10b981',
  UPDATE: '#3b82f6',
  DELETE: '#ef4444',
};

const tableColor: Record<string, string> = {
  products:  '#6c63ff',
  documents: '#f59e0b',
  suppliers: '#0ea5e9',
  clients:   '#10b981',
  invoices:  '#f97316',
  users:     '#f43f5e',
  accounts:  '#8b5cf6',
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id;
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Journal d'audit</h1>
      <span class="total">{{ total }} entrée{{ total !== 1 ? 's' : '' }}</span>
    </header>

    <p v-if="error" class="error-msg">{{ error }}</p>

    <DataGrid
      :columns="columns"
      :rows="logs"
      :loading="loading"
      :can-duplicate="false"
      :can-delete="false"
    >
      <!-- Filters in toolbar -->
      <template #toolbar-extra>
        <select v-model="filterTable" class="filter">
          <option value="">Toutes les tables</option>
          <option value="products">products</option>
          <option value="documents">documents</option>
          <option value="suppliers">suppliers</option>
          <option value="clients">clients</option>
          <option value="invoices">invoices</option>
          <option value="users">users</option>
          <option value="accounts">accounts</option>
        </select>
        <select v-model="filterOp" class="filter">
          <option value="">Toutes les opérations</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <button class="refresh-btn" :disabled="loading" @click="fetchLogs">↻</button>
      </template>

      <!-- Date -->
      <template #cell-created_at="{ row }">
        <span class="date-cell">{{ fmt(row.created_at) }}</span>
      </template>

      <!-- User -->
      <template #cell-user_name="{ row }">
        <span class="user-name">{{ row.user_name }}</span>
        <span class="user-id">#{{ row.user_id }}</span>
      </template>

      <!-- Table badge -->
      <template #cell-table_name="{ row }">
        <span class="badge" :style="{ background: tableColor[row.table_name] ?? '#888' }">
          {{ row.table_name }}
        </span>
      </template>

      <!-- Operation badge -->
      <template #cell-operation="{ row }">
        <span class="op-badge" :style="{ color: opColor[row.operation], borderColor: opColor[row.operation] }">
          {{ row.operation }}
        </span>
      </template>

      <!-- Record ID -->
      <template #cell-record_id="{ row }">
        <span class="id-cell">{{ row.record_id ?? '—' }}</span>
      </template>

      <!-- Data — click to expand -->
      <template #cell-data="{ row }">
        <span v-if="!row.data" class="empty-val">—</span>
        <button v-else class="data-toggle" @click.stop="toggleExpand(row.id)">
          <span class="data-preview">{{ JSON.stringify(row.data).slice(0, 55) }}…</span>
          <span class="expand-icon">{{ expandedId === row.id ? '▲' : '▼' }}</span>
        </button>
      </template>

      <!-- Expandable detail row -->
      <template #row-after="{ row }">
        <tr v-if="expandedId === row.id && row.data" class="detail-row">
          <td :colspan="columns.length + 1">
            <pre class="data-full">{{ JSON.stringify(row.data, null, 2) }}</pre>
          </td>
        </tr>
      </template>
    </DataGrid>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <button :disabled="offset === 0" @click="prevPage">← Précédent</button>
      <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} / {{ total }}</span>
      <button :disabled="offset + limit >= total" @click="nextPage">Suivant →</button>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 1.5rem; min-height: 100%; box-sizing: border-box; }

.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.topbar h1 { margin: 0; font-size: 1.5rem; color: #1a1a2e; }
.total { font-size: .875rem; color: #888; }

.error-msg { color: #ef4444; margin-bottom: 1rem; }

/* Toolbar extras */
.filter { padding: .4rem .65rem; border: 1px solid #ddd; border-radius: 8px; font-size: .82rem; background: white; }
.filter:focus { outline: none; border-color: #6c63ff; }
.refresh-btn { padding: .4rem .65rem; background: transparent; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: .9rem; }
.refresh-btn:hover { background: #f5f5f5; }
.refresh-btn:disabled { opacity: .5; cursor: not-allowed; }

/* Custom cells */
.date-cell { font-size: .8rem; color: #666; white-space: nowrap; }

.user-name { font-weight: 600; color: #1a1a2e; margin-right: .3rem; }
.user-id { font-size: .75rem; color: #aaa; font-family: monospace; }

.badge { font-size: .72rem; font-weight: 600; color: white; padding: .2rem .55rem; border-radius: 20px; white-space: nowrap; }
.op-badge { font-size: .75rem; font-weight: 700; padding: .15rem .45rem; border-radius: 4px; border: 1px solid; background: transparent; white-space: nowrap; }

.id-cell { font-family: monospace; color: #888; font-size: .82rem; }
.empty-val { color: #ccc; }

.data-toggle {
  display: flex;
  align-items: center;
  gap: .5rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
  width: 100%;
}
.data-preview { font-size: .75rem; color: #555; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; max-width: 220px; }
.expand-icon { font-size: .65rem; color: #aaa; flex-shrink: 0; }
.data-toggle:hover .data-preview { color: #6c63ff; }

/* Expandable detail */
.detail-row td { background: #f9f8ff; padding: 0 1rem .75rem !important; }
.data-full { margin: 0; font-size: .78rem; color: #333; background: #f0f0f8; padding: .75rem; border-radius: 6px; overflow-x: auto; max-height: 300px; overflow-y: auto; }

/* Pagination */
.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem; font-size: .875rem; color: #555; }
.pagination button { padding: .4rem .8rem; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; }
.pagination button:disabled { opacity: .4; cursor: not-allowed; }
.pagination button:not(:disabled):hover { background: #f5f5f5; }
</style>
