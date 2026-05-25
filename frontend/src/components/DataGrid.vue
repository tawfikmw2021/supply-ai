<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';

export interface GridColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency';
  editable?: boolean;
  width?: string;
  sortable?: boolean;
}

interface Row {
  id: number;
  [key: string]: any;
}

const props = defineProps<{
  columns: GridColumn[];
  rows: Row[];
  loading?: boolean;
  formatPrice?: (v: number) => string;
  canDuplicate?: boolean;
  canDelete?: boolean;
}>();

const canDup = computed(() => props.canDuplicate !== false);
const canDel = computed(() => props.canDelete !== false);

const emit = defineEmits<{
  (e: 'update', id: number, field: string, value: any): void;
  (e: 'delete', ids: number[]): void;
  (e: 'duplicate', ids: number[]): void;
}>();

// ── Search ─────────────────────────────────────────────
const search = ref('');
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.rows;
  return props.rows.filter(row =>
    props.columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q))
  );
});

// ── Sort ───────────────────────────────────────────────
const sortKey = ref<string | null>(null);
const sortDir = ref<'asc' | 'desc'>('asc');

function cycleSort(col: GridColumn) {
  if (col.sortable === false) return;
  if (sortKey.value === col.key) {
    sortDir.value === 'asc' ? (sortDir.value = 'desc') : (sortKey.value = null);
  } else {
    sortKey.value = col.key;
    sortDir.value = 'asc';
  }
}

const sorted = computed(() => {
  if (!sortKey.value) return filtered.value;
  const key = sortKey.value;
  const dir = sortDir.value === 'asc' ? 1 : -1;
  const col = props.columns.find(c => c.key === key);
  return [...filtered.value].sort((a, b) => {
    const av = a[key] ?? '';
    const bv = b[key] ?? '';
    if (col?.type === 'number' || col?.type === 'currency') {
      return (Number(av) - Number(bv)) * dir;
    }
    return String(av).localeCompare(String(bv), 'fr', { sensitivity: 'base' }) * dir;
  });
});

// ── Selection ──────────────────────────────────────────
const selected = ref(new Set<number>());
const lastClickedId = ref<number | null>(null);

const allSelected = computed(
  () => sorted.value.length > 0 && selected.value.size === sorted.value.length
);
const someSelected = computed(
  () => selected.value.size > 0 && !allSelected.value
);

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set();
  } else {
    selected.value = new Set(sorted.value.map(r => r.id));
  }
}

function toggleRow(id: number, e: MouseEvent) {
  const next = new Set(selected.value);
  if (e.shiftKey && lastClickedId.value !== null) {
    const ids = sorted.value.map(r => r.id);
    const a = ids.indexOf(lastClickedId.value);
    const b = ids.indexOf(id);
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    for (let i = lo; i <= hi; i++) next.add(ids[i]);
  } else {
    next.has(id) ? next.delete(id) : next.add(id);
    lastClickedId.value = id;
  }
  selected.value = next;
}

// ── Editing ────────────────────────────────────────────
interface EditCell { rowId: number; colKey: string }
const editing = ref<EditCell | null>(null);
const editValue = ref('');
let editEl: HTMLInputElement | null = null;

function setEditRef(el: any) {
  editEl = el;
  el?.select();
}

async function startEdit(row: Row, col: GridColumn) {
  if (!col.editable) return;
  editing.value = { rowId: row.id, colKey: col.key };
  editValue.value = String(row[col.key] ?? '');
  await nextTick();
  editEl?.select();
}

function commitEdit() {
  if (!editing.value) return;
  const { rowId, colKey } = editing.value;
  const col = props.columns.find(c => c.key === colKey)!;
  let val: any = editValue.value;
  if (col.type === 'number' || col.type === 'currency') {
    val = parseFloat(editValue.value);
    if (isNaN(val)) val = 0;
  }
  emit('update', rowId, colKey, val);
  editing.value = null;
}

function cancelEdit() { editing.value = null; }

function onKey(e: KeyboardEvent, row: Row, col: GridColumn) {
  if (e.key === 'Escape') { cancelEdit(); return; }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commitEdit();
    const next = sorted.value[sorted.value.findIndex(r => r.id === row.id) + 1];
    if (next) startEdit(next, col);
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    commitEdit();
    const editableCols = props.columns.filter(c => c.editable);
    const ci = editableCols.findIndex(c => c.key === col.key);
    const ri = sorted.value.findIndex(r => r.id === row.id);
    const dir = e.shiftKey ? -1 : 1;
    let nci = ci + dir, nri = ri;
    if (nci >= editableCols.length) { nci = 0; nri++; }
    else if (nci < 0) { nci = editableCols.length - 1; nri--; }
    const nextRow = sorted.value[nri];
    const nextCol = editableCols[nci];
    if (nextRow && nextCol) startEdit(nextRow, nextCol);
  }
}

function isEditing(rowId: number, colKey: string) {
  return editing.value?.rowId === rowId && editing.value?.colKey === colKey;
}

// ── Duplicate ──────────────────────────────────────────
const duplicating = ref(false);
async function duplicateSelected() {
  duplicating.value = true;
  emit('duplicate', [...selected.value]);
  selected.value = new Set();
  setTimeout(() => { duplicating.value = false; }, 800);
}

// ── Delete ─────────────────────────────────────────────
function deleteSelected() {
  emit('delete', [...selected.value]);
  selected.value = new Set();
}

// ── Display ────────────────────────────────────────────
function display(row: Row, col: GridColumn): string {
  const v = row[col.key];
  if (v == null || v === '') return '—';
  if (col.type === 'currency' && props.formatPrice) return props.formatPrice(Number(v));
  if (col.type === 'number') return Number(v).toLocaleString('fr-FR');
  return String(v);
}

const hasActions = computed(() => !!useSlots()['row-actions']);

import { useSlots } from 'vue';
const slots = useSlots();
</script>

<template>
  <div class="grid-wrap">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
        </svg>
        <input v-model="search" class="search" placeholder="Rechercher…" />
        <button v-if="search" class="clear-btn" @click="search = ''">✕</button>
      </div>

      <slot name="toolbar-extra" />

      <div class="actions">
        <template v-if="selected.size > 0">
          <span class="sel-label">{{ selected.size }} sél.</span>
          <button v-if="canDup" class="btn dup-btn" :disabled="duplicating" @click="duplicateSelected">
            {{ duplicating ? '…' : '⧉ Dupliquer' }}
          </button>
          <button v-if="canDel" class="btn del-btn" @click="deleteSelected">🗑️ Supprimer</button>
        </template>
        <span v-else class="count-label">{{ filtered.length }} ligne{{ filtered.length !== 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- Table -->
    <div class="scroll">
      <p v-if="loading" class="state-msg">Chargement…</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th class="cb-th">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="someSelected"
                @change="toggleAll"
              />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              :style="col.width ? { width: col.width } : {}"
              :class="{ 'col-sortable': col.sortable !== false }"
              @click="cycleSort(col)"
            >
              <span class="th-inner">
                {{ col.label }}
                <span v-if="col.editable" class="editable-mark" title="Double-clic pour modifier">✎</span>
                <span v-if="col.sortable !== false" class="sort-icon" :class="{ active: sortKey === col.key }">
                  <svg v-if="sortKey === col.key && sortDir === 'asc'" viewBox="0 0 10 10" fill="currentColor"><path d="M5 2 L9 8 L1 8 Z"/></svg>
                  <svg v-else-if="sortKey === col.key && sortDir === 'desc'" viewBox="0 0 10 10" fill="currentColor"><path d="M5 8 L9 2 L1 2 Z"/></svg>
                  <svg v-else viewBox="0 0 10 14" fill="currentColor"><path d="M5 1 L8.5 6 L1.5 6 Z M5 13 L8.5 8 L1.5 8 Z"/></svg>
                </span>
              </span>
            </th>
            <th v-if="slots['row-actions']" class="actions-th"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in sorted" :key="row.id">
            <tr :class="{ selected: selected.has(row.id) }">
              <td class="cb-td" @click.stop="toggleRow(row.id, $event)">
                <input
                  type="checkbox"
                  :checked="selected.has(row.id)"
                  @click.stop="toggleRow(row.id, $event)"
                  @change.stop
                />
              </td>
              <td
                v-for="col in columns"
                :key="col.key"
                :class="['cell', col.type, { editable: col.editable, active: isEditing(row.id, col.key) }]"
                @dblclick="startEdit(row, col)"
              >
                <!-- Custom slot for this column -->
                <slot v-if="slots[`cell-${col.key}`]" :name="`cell-${col.key}`" :row="row" :col="col" />
                <template v-else>
                  <input
                    v-if="isEditing(row.id, col.key)"
                    :ref="setEditRef"
                    v-model="editValue"
                    :type="col.type === 'number' || col.type === 'currency' ? 'number' : 'text'"
                    :step="col.type === 'currency' ? '0.01' : '1'"
                    class="cell-input"
                    @blur="commitEdit"
                    @keydown="onKey($event, row, col)"
                  />
                  <span v-else class="cell-text">{{ display(row, col) }}</span>
                </template>
              </td>
              <td v-if="slots['row-actions']" class="actions-td">
                <slot name="row-actions" :row="row" />
              </td>
            </tr>
            <!-- Optional expandable detail row -->
            <slot name="row-after" :row="row" />
          </template>
          <tr v-if="sorted.length === 0">
            <td :colspan="columns.length + 1 + (slots['row-actions'] ? 1 : 0)" class="empty">
              Aucun résultat.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.grid-wrap {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,.07);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .65rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  background: #fafbff;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 160px;
  max-width: 300px;
}
.search-icon {
  position: absolute;
  left: .6rem;
  width: 14px;
  height: 14px;
  color: #aaa;
  pointer-events: none;
}
.search {
  width: 100%;
  padding: .42rem .75rem .42rem 2rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: .85rem;
  background: white;
  transition: border-color .15s;
}
.search:focus { outline: none; border-color: #6c63ff; }
.clear-btn {
  position: absolute;
  right: .45rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #bbb;
  font-size: .75rem;
  line-height: 1;
  padding: 0;
}
.clear-btn:hover { color: #555; }

.actions { display: flex; align-items: center; gap: .5rem; margin-left: auto; }
.count-label { font-size: .8rem; color: #aaa; }
.sel-label { font-size: .8rem; font-weight: 700; color: #6c63ff; }

.btn {
  padding: .32rem .7rem;
  border-radius: 6px;
  font-size: .8rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: background .12s, color .12s;
}
.dup-btn { color: #059669; border-color: #6ee7b7; background: #ecfdf5; }
.dup-btn:hover:not(:disabled) { background: #d1fae5; }
.dup-btn:disabled { opacity: .6; cursor: not-allowed; }
.del-btn { color: #ef4444; border-color: #fca5a5; background: #fff5f5; }
.del-btn:hover { background: #fee2e2; }

/* ── Table ───────────────────────────────────────────── */
.scroll { overflow-x: auto; }

.table { width: 100%; border-collapse: collapse; font-size: .875rem; }

.table thead {
  background: #f7f8ff;
  position: sticky;
  top: 0;
  z-index: 1;
}
.table th {
  padding: .55rem 1rem;
  text-align: left;
  font-size: .75rem;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: .04em;
  border-bottom: 1px solid #eee;
  white-space: nowrap;
  user-select: none;
}
.editable-mark { color: #c7c4ff; font-size: .68rem; margin-left: .2rem; }
.actions-th { width: 1px; }

.col-sortable { cursor: pointer; }
.col-sortable:hover { background: #eeeeff; }

.th-inner {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  opacity: .25;
  transition: opacity .12s;
}
.sort-icon.active { opacity: 1; color: #6c63ff; }
.col-sortable:hover .sort-icon { opacity: .6; }
.sort-icon svg { width: 8px; height: 10px; }

.table td { border-bottom: 1px solid #f5f5f5; vertical-align: middle; }
.table tbody tr { transition: background .1s; }
.table tbody tr:hover { background: #fafaff; }
.table tbody tr.selected { background: #eeeeff; }
.table tbody tr.selected:hover { background: #e5e4ff; }
.table tbody tr:last-child td { border-bottom: none; }

.cb-th, .cb-td {
  width: 40px;
  text-align: center;
  padding: .5rem !important;
  cursor: pointer;
}
.cb-td input, .cb-th input { cursor: pointer; accent-color: #6c63ff; }

.cell {
  padding: .5rem 1rem;
  cursor: default;
  max-width: 260px;
}
.cell.editable { cursor: cell; }
.cell.editable:hover { background: rgba(108, 99, 255, .05); }
.cell.active { padding: 0; background: white; }
.cell.number, .cell.currency { text-align: right; font-variant-numeric: tabular-nums; }

.cell-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-input {
  width: 100%;
  padding: .5rem 1rem;
  border: none;
  border-bottom: 2px solid #6c63ff;
  outline: none;
  font-size: .875rem;
  font-family: inherit;
  background: #f5f4ff;
  box-sizing: border-box;
}
.cell.number .cell-input,
.cell.currency .cell-input { text-align: right; }

.actions-td { padding: .35rem .75rem !important; white-space: nowrap; }

.empty, .state-msg {
  text-align: center;
  color: #bbb;
  padding: 2.5rem;
  font-size: .9rem;
}
</style>
