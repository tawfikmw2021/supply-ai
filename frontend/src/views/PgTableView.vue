<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { usePgTableStore, type PgColumnMeta } from '../stores/pgTable';
import { useColumnSettingsStore, type ColumnConfig } from '../stores/columnSettings';

const route  = useRoute();
const auth   = useAuthStore();
const store  = usePgTableStore();
const colCfg = useColumnSettingsStore();

const isAdmin = computed(() => auth.user?.role === 'admin' && !auth.viewAsUser);

// ── Table name from route ─────────────────────────────────────────────────────
const tableName = computed(() => route.params.table as string);
const state     = computed(() => store.getState(tableName.value));

// ── Columns: merge PG meta + saved column settings ────────────────────────────
const resolvedColumns = computed<ColumnConfig[]>(() => {
  const meta:  PgColumnMeta[]  = state.value?.meta ?? [];
  const saved: ColumnConfig[]  = colCfg.cache[tableName.value] ?? [];

  if (!meta.length) return [];

  return meta
    .map((m, i) => {
      const existing = saved.find(s => s.key === m.column_name);
      return existing ?? {
        key:     m.column_name,
        label:   m.column_name,
        visible: i < 8,        // first 8 columns visible by default
        order:   i,
        width:   undefined,
      };
    })
    .sort((a, b) => a.order - b.order)
    .filter(c => c.visible);
});

// ── Column visibility panel ───────────────────────────────────────────────────
const showColPanel = ref(false);

// All columns (visible + hidden) for the selector panel
const allColumns = computed<ColumnConfig[]>(() => {
  const meta:  PgColumnMeta[]  = state.value?.meta ?? [];
  const saved: ColumnConfig[]  = colCfg.cache[tableName.value] ?? [];
  if (!meta.length) return [];
  return meta
    .map((m, i) => {
      const existing = saved.find(s => s.key === m.column_name);
      return existing ?? { key: m.column_name, label: m.column_name, visible: i < 8, order: i, width: undefined };
    })
    .sort((a, b) => a.order - b.order);
});

async function toggleColumn(key: string) {
  const updated = allColumns.value.map(c =>
    c.key === key ? { ...c, visible: !c.visible } : { ...c }
  );
  await colCfg.saveSettings(tableName.value, updated);
}

function showAll() {
  const updated = allColumns.value.map(c => ({ ...c, visible: true }));
  colCfg.saveSettings(tableName.value, updated);
}

function hideAll() {
  const updated = allColumns.value.map(c => ({ ...c, visible: false }));
  colCfg.saveSettings(tableName.value, updated);
}

// ── Search & pagination ───────────────────────────────────────────────────────
const search   = ref('');
const searchQ  = ref('');
let   debTimer: ReturnType<typeof setTimeout>;
watch(search, (v) => { clearTimeout(debTimer); debTimer = setTimeout(() => { searchQ.value = v; load(1); }, 350); });

const totalPages = computed(() => {
  const total = state.value?.total ?? 0;
  const limit = state.value?.limit ?? 50;
  return Math.max(1, Math.ceil(total / limit));
});

async function load(page = state.value?.page ?? 1) {
  await store.fetchRows(tableName.value, page, searchQ.value);
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────
const showModal  = ref(false);
const editingId  = ref<unknown>(null);
const formData   = ref<Record<string, string>>({});
const formError  = ref('');
const formSaving = ref(false);

function openAdd() {
  const meta = state.value?.meta ?? [];
  const pk   = state.value?.pk   ?? 'id';
  editingId.value = null;
  formData.value  = Object.fromEntries(meta.map(m => [m.column_name, '']));
  delete formData.value[pk];
  formError.value = '';
  showModal.value = true;
}

function openEdit(row: Record<string, unknown>) {
  const pk = state.value?.pk ?? 'id';
  editingId.value = row[pk];
  formData.value  = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)]));
  formError.value = '';
  showModal.value = true;
}

async function submitForm() {
  formError.value  = '';
  formSaving.value = true;
  try {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(formData.value)) {
      payload[k] = v === '' ? null : v;
    }
    if (editingId.value !== null) {
      await store.updateRow(tableName.value, editingId.value, payload);
    } else {
      await store.createRow(tableName.value, payload);
    }
    showModal.value = false;
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? e.message;
  } finally {
    formSaving.value = false;
  }
}

async function deleteRow(row: Record<string, unknown>) {
  if (!confirm('Supprimer cet enregistrement ?')) return;
  try { await store.deleteRow(tableName.value, row[state.value.pk]); }
  catch (e: any) { alert(e.response?.data?.message ?? e.message); }
}

// ── Close col panel on outside click ─────────────────────────────────────────
function onDocClick() { showColPanel.value = false; }
onUnmounted(() => document.removeEventListener('click', onDocClick));
watch(showColPanel, (v) => {
  if (v) document.addEventListener('click', onDocClick);
  else    document.removeEventListener('click', onDocClick);
});

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([
    store.fetchMeta(tableName.value),
    colCfg.fetchSettings(tableName.value),
  ]);
  await load(1);
}

watch(tableName, init);
onMounted(init);

// ── Input type hint ───────────────────────────────────────────────────────────
function inputType(dataType: string): string {
  if (['integer','bigint','smallint','serial'].some(t => dataType.includes(t))) return 'number';
  if (dataType.includes('numeric') || dataType.includes('decimal') || dataType.includes('real')) return 'number';
  if (dataType.includes('timestamp') || dataType.includes('date')) return 'datetime-local';
  return 'text';
}

function formatCell(val: unknown, dataType: string): string {
  if (val == null) return '—';
  if (dataType.includes('timestamp') || dataType.includes('date')) {
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('fr-FR');
  }
  if (dataType === 'bytea') return '[image]';
  return String(val);
}

function getDataType(key: string): string {
  return (state.value?.meta ?? []).find(m => m.column_name === key)?.data_type ?? 'text';
}

// Safe accessors for template
const rows       = computed(() => state.value?.rows    ?? []);
const totalCount = computed(() => state.value?.total   ?? 0);
const isLoading  = computed(() => state.value?.loading ?? false);
const pkCol      = computed(() => state.value?.pk      ?? 'id');
const metaCols   = computed(() => state.value?.meta    ?? []);
</script>

<template>
  <div class="pg-page">
    <!-- Header -->
    <header class="topbar">
      <div class="topbar-left">
        <h1>{{ tableName }}</h1>
        <span class="count" v-if="totalCount > 0">{{ totalCount.toLocaleString('fr-FR') }} enregistrement(s)</span>
      </div>
      <div class="topbar-right">
        <input v-model="search" class="search-input" placeholder="Rechercher…" />

        <!-- Column visibility toggle -->
        <div class="col-picker-wrap">
          <button class="btn-cols" @click.stop="showColPanel = !showColPanel" title="Colonnes visibles">
            ⚙ Colonnes
          </button>
          <div v-if="showColPanel" class="col-panel" @click.stop>
            <div class="col-panel-header">
              <span>Colonnes</span>
              <div class="col-panel-actions">
                <button @click="showAll">Tout</button>
                <button @click="hideAll">Aucun</button>
                <button class="close-x" @click="showColPanel = false">✕</button>
              </div>
            </div>
            <div class="col-list">
              <label v-for="col in allColumns" :key="col.key" class="col-item">
                <input type="checkbox" :checked="col.visible" @change="toggleColumn(col.key)" />
                <span>{{ col.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <button v-if="isAdmin" class="btn-add" @click="openAdd">+ Ajouter</button>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="loading">Chargement…</div>

    <!-- Table -->
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="col in resolvedColumns" :key="col.key" :style="col.width ? `width:${col.width}` : ''">
              {{ col.label }}
            </th>
            <th v-if="isAdmin" class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="String(row[pkCol])">
            <td v-for="col in resolvedColumns" :key="col.key">
              {{ formatCell(row[col.key], getDataType(col.key)) }}
            </td>
            <td v-if="isAdmin" class="actions-cell">
              <button class="act-btn edit" @click="openEdit(row as Record<string,unknown>)" title="Modifier">✏</button>
              <button class="act-btn del"  @click="deleteRow(row as Record<string,unknown>)" title="Supprimer">🗑</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="resolvedColumns.length + (isAdmin ? 1 : 0)" class="empty-row">Aucun résultat</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button :disabled="(state?.page ?? 1) <= 1" @click="load((state?.page ?? 1) - 1)">‹</button>
      <span>Page {{ state?.page ?? 1 }} / {{ totalPages }}</span>
      <button :disabled="(state?.page ?? 1) >= totalPages" @click="load((state?.page ?? 1) + 1)">›</button>
    </div>

    <!-- Modal add/edit -->
    <div v-if="showModal" class="overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingId ? 'Modifier' : 'Nouveau' }} — {{ tableName }}</h2>
          <button class="close-btn" @click="showModal = false">✕</button>
        </div>
        <form @submit.prevent="submitForm" class="modal-form">
          <template v-for="col in metaCols" :key="col.column_name">
            <div class="field" v-if="col.column_name !== pkCol || editingId">
              <label>{{ col.column_name }}
                <span v-if="col.is_nullable === 'NO'" class="required">*</span>
              </label>
              <input
                v-if="col.data_type !== 'bytea'"
                v-model="formData[col.column_name]"
                :type="inputType(col.data_type)"
                :disabled="col.column_name === pkCol"
                :placeholder="col.data_type"
              />
              <span v-else class="field-note">Champ binaire (non éditable ici)</span>
            </div>
          </template>
          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="modal-footer">
            <button type="button" class="btn-cancel" @click="showModal = false">Annuler</button>
            <button type="submit" class="btn-save" :disabled="formSaving">
              {{ formSaving ? '…' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pg-page { padding: 1.5rem; min-height: 100%; box-sizing: border-box; }

/* Header */
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: .75rem; }
.topbar-left { display: flex; align-items: baseline; gap: .75rem; }
.topbar-left h1 { margin: 0; font-size: 1.4rem; color: #1a1a2e; }
.count { font-size: .8rem; color: #888; }
.topbar-right { display: flex; gap: .6rem; align-items: center; }
.search-input { padding: .45rem .75rem; border: 1px solid #ddd; border-radius: 8px; font-size: .875rem; width: 220px; }
.search-input:focus { outline: none; border-color: #6c63ff; }
.btn-add { padding: .45rem .9rem; background: #6c63ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: .875rem; font-weight: 600; white-space: nowrap; }
.btn-add:hover { opacity: .9; }

/* Loading */
.loading { text-align: center; padding: 3rem; color: #888; }

/* Table */
.table-wrap { overflow-x: auto; background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.data-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
.data-table th { background: #f7f8fc; padding: .65rem .85rem; text-align: left; font-size: .8rem; color: #555; border-bottom: 1px solid #eee; white-space: nowrap; }
.data-table td { padding: .6rem .85rem; border-bottom: 1px solid #f2f2f2; color: #333; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: #fafbff; }
.actions-col { width: 80px; text-align: center; }
.actions-cell { text-align: center; }
.act-btn { padding: .2rem .4rem; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; background: transparent; font-size: .8rem; margin: 0 .1rem; }
.act-btn.edit { border-color: #6c63ff; color: #6c63ff; }
.act-btn.edit:hover { background: #6c63ff; color: white; }
.act-btn.del  { border-color: #e53e3e; color: #e53e3e; }
.act-btn.del:hover  { background: #e53e3e; color: white; }
.empty-row { text-align: center; padding: 2rem; color: #aaa; }

/* Pagination */
.pagination { display: flex; align-items: center; gap: .75rem; justify-content: center; margin-top: 1.25rem; font-size: .875rem; color: #555; }
.pagination button { padding: .35rem .7rem; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; }
.pagination button:hover:not(:disabled) { background: #6c63ff; color: white; border-color: #6c63ff; }
.pagination button:disabled { opacity: .4; cursor: default; }

/* Modal */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal { background: white; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,.2); }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #eee; }
.modal-header h2 { margin: 0; font-size: 1.1rem; color: #1a1a2e; }
.close-btn { background: transparent; border: none; font-size: 1.1rem; cursor: pointer; color: #888; padding: .2rem .4rem; }
.close-btn:hover { color: #e53e3e; }
.modal-form { overflow-y: auto; padding: 1.25rem 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: .75rem .85rem; }
.field { display: flex; flex-direction: column; gap: .25rem; }
.field label { font-size: .8rem; color: #555; font-weight: 500; }
.required { color: #e53e3e; margin-left: .2rem; }
.field input { padding: .45rem .65rem; border: 1px solid #ddd; border-radius: 6px; font-size: .875rem; }
.field input:focus { outline: none; border-color: #6c63ff; }
.field input:disabled { background: #f8f8f8; color: #999; }
.field-note { font-size: .78rem; color: #aaa; font-style: italic; }
.error { grid-column: 1/-1; color: #e53e3e; font-size: .875rem; }
.modal-footer { grid-column: 1/-1; display: flex; justify-content: flex-end; gap: .6rem; margin-top: .5rem; }
.btn-cancel { padding: .5rem 1rem; background: transparent; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; }
.btn-save { padding: .5rem 1.2rem; background: #6c63ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-save:disabled { opacity: .6; cursor: not-allowed; }

/* Column picker */
.col-picker-wrap { position: relative; }
.btn-cols { padding: .45rem .8rem; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; font-size: .875rem; color: #555; }
.btn-cols:hover { border-color: #6c63ff; color: #6c63ff; }
.col-panel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 100; background: white; border: 1px solid #e0e0e0; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,.12); width: 230px; }
.col-panel-header { display: flex; justify-content: space-between; align-items: center; padding: .65rem .85rem; border-bottom: 1px solid #eee; font-size: .82rem; font-weight: 600; color: #333; }
.col-panel-actions { display: flex; gap: .3rem; align-items: center; }
.col-panel-actions button { padding: .2rem .5rem; font-size: .75rem; border: 1px solid #ddd; border-radius: 5px; background: white; cursor: pointer; color: #555; }
.col-panel-actions button:hover { background: #f0efff; border-color: #6c63ff; color: #6c63ff; }
.close-x { border-color: transparent !important; color: #aaa !important; font-size: .85rem; }
.close-x:hover { color: #e53e3e !important; background: transparent !important; }
.col-list { max-height: 320px; overflow-y: auto; padding: .4rem 0; }
.col-item { display: flex; align-items: center; gap: .55rem; padding: .35rem .85rem; font-size: .82rem; color: #333; cursor: pointer; user-select: none; }
.col-item:hover { background: #f7f8fc; }
.col-item input[type="checkbox"] { accent-color: #6c63ff; width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
</style>
