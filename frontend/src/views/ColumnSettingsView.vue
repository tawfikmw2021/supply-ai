<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../api';
import { useColumnSettingsStore, type ColumnConfig } from '../stores/columnSettings';
import { TABLE_GROUP_MAP } from '../data/pgGroups';

const store = useColumnSettingsStore();

// ── Tables list ───────────────────────────────────────────────────────────────
const tables  = ref<string[]>([]);
const search  = ref('');
const active  = ref('');
const saving  = ref(false);
const saved   = ref(false);
const loading = ref(false);

const filteredTables = computed(() =>
  tables.value.filter(t => t.toLowerCase().includes(search.value.toLowerCase()))
);

// Group label for table list item
function tableGroup(t: string) {
  return TABLE_GROUP_MAP.get(t) ?? null;
}

onMounted(async () => {
  const { data } = await api.get('/pg/tables');
  tables.value = data.tables;
  if (tables.value.length) selectTable(tables.value[0]);
});

// ── Columns for selected table ────────────────────────────────────────────────
const columns    = ref<ColumnConfig[]>([]);
const meta       = ref<{ column_name: string; data_type: string }[]>([]);
const colSearch  = ref('');

const filteredColumns = computed(() => {
  if (!colSearch.value) return columns.value;
  const q = colSearch.value.toLowerCase();
  return columns.value.filter(c =>
    c.key.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)
  );
});

const activeGroup = computed(() => TABLE_GROUP_MAP.get(active.value) ?? null);

async function selectTable(table: string) {
  active.value  = table;
  colSearch.value = '';
  loading.value = true;
  saved.value   = false;
  try {
    const [metaRes, cfgRes] = await Promise.all([
      api.get(`/pg/meta/${table}`),
      store.fetchSettings(table),
    ]);
    meta.value        = metaRes.data.columns;
    tableHidden.value = store.hiddenTables[table] ?? true;
    const saved_cfg: ColumnConfig[] = cfgRes;

    columns.value = meta.value.map((m, i) => {
      const ex = saved_cfg.find(c => c.key === m.column_name);
      return ex ?? { key: m.column_name, label: m.column_name, visible: i < 8, order: i };
    });
  } finally {
    loading.value = false;
  }
}

// ── Drag to reorder ───────────────────────────────────────────────────────────
const dragIdx = ref<number | null>(null);

function onDragStart(i: number) { dragIdx.value = i; }
function onDrop(i: number) {
  if (dragIdx.value === null || dragIdx.value === i) return;
  // Map filtered index back to full columns index
  const fromKey = filteredColumns.value[dragIdx.value]?.key;
  const toKey   = filteredColumns.value[i]?.key;
  if (!fromKey || !toKey) return;
  const fromI = columns.value.findIndex(c => c.key === fromKey);
  const toI   = columns.value.findIndex(c => c.key === toKey);
  const arr = [...columns.value];
  const [moved] = arr.splice(fromI, 1);
  arr.splice(toI, 0, moved);
  columns.value = arr.map((c, idx) => ({ ...c, order: idx }));
  dragIdx.value = null;
}

// ── Table hidden flag ─────────────────────────────────────────────────────────
const tableHidden = ref(true);

// ── Save ──────────────────────────────────────────────────────────────────────
async function save() {
  saving.value = true;
  try {
    await store.saveSettings(active.value, columns.value, tableHidden.value);
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } finally {
    saving.value = false;
  }
}

function toggleAll(visible: boolean) {
  columns.value = columns.value.map(c => ({ ...c, visible }));
}

function resetDefaults() {
  columns.value = meta.value.map((m, i) => ({
    key: m.column_name, label: m.column_name, visible: i < 8, order: i,
  }));
}

function dragIndexInFull(filteredIndex: number): number {
  const key = filteredColumns.value[filteredIndex]?.key;
  return columns.value.findIndex(c => c.key === key);
}
</script>

<template>
  <div class="cs-page">
    <header class="topbar">
      <h1>⚙️ Paramètres des colonnes</h1>
      <p class="subtitle">Choisissez les colonnes visibles et leur ordre d'affichage pour chaque table.</p>
    </header>

    <div class="layout">
      <!-- Left: table list -->
      <aside class="table-list">
        <input v-model="search" class="list-search" placeholder="Filtrer les tables…" />
        <div class="list-items">
          <button
            v-for="t in filteredTables" :key="t"
            class="list-item"
            :class="{ active: t === active }"
            @click="selectTable(t)"
          >
            <span class="list-item-name">{{ t }}</span>
            <span v-if="tableGroup(t)" class="list-item-group">{{ tableGroup(t)!.icon }}</span>
          </button>
        </div>
      </aside>

      <!-- Right: column config -->
      <section class="config-panel">
        <div v-if="!active" class="empty-hint">← Sélectionner une table</div>

        <div v-else>
          <div class="config-header">
            <div class="header-title">
              <h2>{{ active }}</h2>
              <span v-if="activeGroup" class="group-badge">
                {{ activeGroup.icon }} {{ activeGroup.label }}
              </span>
            </div>
            <div class="header-actions">
              <button class="btn-sm" @click="toggleAll(true)">Tout afficher</button>
              <button class="btn-sm" @click="toggleAll(false)">Tout masquer</button>
              <button class="btn-sm" @click="resetDefaults">Réinitialiser</button>
              <button class="btn-save" @click="save" :disabled="saving">
                {{ saving ? '…' : saved ? '✓ Sauvegardé' : 'Enregistrer' }}
              </button>
            </div>
          </div>

          <!-- Hide table toggle -->
          <div class="hide-table-row">
            <label class="hide-table-label">
              <input type="checkbox" v-model="tableHidden" />
              <span>Masquer cette table dans la navigation</span>
            </label>
          </div>

          <div v-if="loading" class="loading">Chargement…</div>

          <div v-else>
            <!-- Column search -->
            <div class="col-search-row">
              <input
                v-model="colSearch"
                class="col-search"
                placeholder="Rechercher une colonne…"
              />
              <span class="col-count">
                {{ filteredColumns.length }} / {{ columns.length }} colonnes
                <template v-if="colSearch"> correspondantes</template>
              </span>
            </div>

            <div class="col-list">
              <div class="col-list-head">
                <span class="col-drag"></span>
                <span class="col-visible">Visible</span>
                <span class="col-key">Colonne (DB)</span>
                <span class="col-label">Libellé affiché</span>
                <span class="col-type">Type</span>
              </div>

              <div
                v-for="(col, i) in filteredColumns"
                :key="col.key"
                class="col-row"
                :class="{ hidden: !col.visible, dragging: dragIdx === i }"
                draggable="true"
                @dragstart="onDragStart(i)"
                @dragover.prevent
                @drop.prevent="onDrop(i)"
              >
                <span class="col-drag handle" title="Glisser pour réordonner">⠿</span>

                <label class="col-visible toggle">
                  <input type="checkbox" v-model="col.visible" />
                  <span class="pill" :class="col.visible ? 'on' : 'off'">
                    {{ col.visible ? 'oui' : 'non' }}
                  </span>
                </label>

                <span class="col-key db-key">{{ col.key }}</span>

                <input
                  v-model="col.label"
                  class="col-label label-input"
                  :placeholder="col.key"
                />

                <span class="col-type type-badge">
                  {{ meta.find(m => m.column_name === col.key)?.data_type ?? '?' }}
                </span>
              </div>

              <div v-if="!filteredColumns.length" class="empty-col">
                Aucune colonne ne correspond à « {{ colSearch }} »
              </div>
            </div>

            <div class="footer-note">
              {{ columns.filter(c => c.visible).length }} / {{ columns.length }} colonnes visibles
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cs-page { padding: 1.5rem; min-height: 100%; box-sizing: border-box; }

.topbar { margin-bottom: 1.5rem; }
.topbar h1 { margin: 0 0 .3rem; font-size: 1.4rem; color: #1a1a2e; }
.subtitle { margin: 0; font-size: .875rem; color: #888; }

/* Layout */
.layout { display: flex; gap: 1.5rem; align-items: flex-start; }

/* Left sidebar */
.table-list { width: 220px; flex-shrink: 0; background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; position: sticky; top: 1.5rem; max-height: calc(100vh - 200px); display: flex; flex-direction: column; }
.list-search { padding: .6rem .75rem; border: none; border-bottom: 1px solid #eee; font-size: .875rem; outline: none; width: 100%; box-sizing: border-box; }
.list-search:focus { border-bottom-color: #6c63ff; }
.list-items { overflow-y: auto; flex: 1; }
.list-item { display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: .5rem .85rem; border: none; background: transparent; cursor: pointer; font-size: .83rem; color: #444; border-left: 3px solid transparent; }
.list-item:hover { background: #f7f8fc; }
.list-item.active { background: #eeecff; color: #6c63ff; border-left-color: #6c63ff; font-weight: 600; }
.list-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.list-item-group { font-size: .85rem; flex-shrink: 0; margin-left: .3rem; opacity: .7; }

/* Config panel */
.config-panel { flex: 1; min-width: 0; background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.empty-hint { padding: 3rem; text-align: center; color: #bbb; font-size: 1rem; }
.loading { padding: 3rem; text-align: center; color: #888; }

.config-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.25rem 1.5rem; border-bottom: 1px solid #eee; flex-wrap: wrap; gap: .75rem; }
.header-title { display: flex; flex-direction: column; gap: .3rem; }
.header-title h2 { margin: 0; font-size: 1.1rem; color: #1a1a2e; }
.group-badge { display: inline-flex; align-items: center; gap: .3rem; font-size: .75rem; color: #6c63ff; background: #eeecff; padding: .15rem .6rem; border-radius: 20px; font-weight: 500; width: fit-content; }
.header-actions { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
.btn-sm { padding: .35rem .75rem; border: 1px solid #ddd; border-radius: 6px; background: white; font-size: .8rem; cursor: pointer; }
.btn-sm:hover { border-color: #6c63ff; color: #6c63ff; }
.btn-save { padding: .4rem 1rem; background: #6c63ff; color: white; border: none; border-radius: 6px; font-size: .875rem; font-weight: 600; cursor: pointer; min-width: 120px; text-align: center; }
.btn-save:disabled { opacity: .7; cursor: not-allowed; }

/* Hide table row */
.hide-table-row { padding: .75rem 1.5rem; border-bottom: 1px solid #eee; background: #fffbf0; }
.hide-table-label { display: flex; align-items: center; gap: .6rem; cursor: pointer; font-size: .875rem; color: #555; user-select: none; }
.hide-table-label input[type="checkbox"] { accent-color: #e53e3e; width: 15px; height: 15px; cursor: pointer; }
.hide-table-label span { font-weight: 500; }

/* Column search */
.col-search-row { display: flex; align-items: center; gap: 1rem; padding: .75rem 1.5rem; border-bottom: 1px solid #f0f0f0; }
.col-search { flex: 1; max-width: 280px; padding: .4rem .7rem; border: 1px solid #ddd; border-radius: 7px; font-size: .875rem; outline: none; }
.col-search:focus { border-color: #6c63ff; }
.col-count { font-size: .8rem; color: #aaa; white-space: nowrap; }

/* Column list */
.col-list { padding: .5rem 1.5rem 0; }
.col-list-head { display: grid; grid-template-columns: 28px 70px 180px 1fr 120px; gap: .5rem; padding: .4rem .5rem; font-size: .75rem; color: #999; font-weight: 600; text-transform: uppercase; }
.col-row { display: grid; grid-template-columns: 28px 70px 180px 1fr 120px; gap: .5rem; align-items: center; padding: .4rem .5rem; border-radius: 6px; margin-bottom: .25rem; transition: background .12s; }
.col-row:hover { background: #f9f9ff; }
.col-row.hidden { opacity: .45; }
.col-row.dragging { opacity: .5; background: #eeecff; }
.empty-col { padding: 1.5rem; text-align: center; color: #bbb; font-size: .875rem; }

.handle { cursor: grab; color: #ccc; font-size: 1.1rem; text-align: center; }
.handle:active { cursor: grabbing; }

.toggle { display: flex; align-items: center; cursor: pointer; }
.toggle input { display: none; }
.pill { font-size: .72rem; padding: .15rem .55rem; border-radius: 10px; font-weight: 600; }
.pill.on  { background: #d1fae5; color: #065f46; }
.pill.off { background: #fee2e2; color: #991b1b; }

.db-key { font-size: .8rem; color: #444; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.label-input { padding: .3rem .5rem; border: 1px solid #ddd; border-radius: 5px; font-size: .875rem; width: 100%; }
.label-input:focus { outline: none; border-color: #6c63ff; }
.type-badge { font-size: .72rem; color: #888; background: #f3f3f3; padding: .15rem .5rem; border-radius: 4px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.footer-note { padding: .75rem 1.5rem; border-top: 1px solid #eee; font-size: .8rem; color: #888; text-align: right; }
</style>
