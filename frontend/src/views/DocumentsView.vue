<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useDocumentsStore, type Document } from '../stores/documents';
import DataGrid, { type GridColumn } from '../components/DataGrid.vue';

const auth = useAuthStore();
const store = useDocumentsStore();

const isAdmin = computed(() => auth.user?.role === 'admin');

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ── Grid columns ──────────────────────────────────────
const columns = computed<GridColumn[]>(() => [
  { key: 'type',       label: 'Type',       type: 'text', editable: isAdmin.value, width: '130px' },
  { key: 'url',        label: 'Fichier / URL' },
  { key: 'properties', label: 'Propriétés' },
  { key: 'created_at', label: 'Créé le', width: '110px' },
]);

// ── Grid events ───────────────────────────────────────
async function onUpdate(id: number, field: string, value: any) {
  await store.updateDocument(id, { [field]: value } as any);
}

async function onDelete(ids: number[]) {
  if (!confirm(`Supprimer ${ids.length} document${ids.length > 1 ? 's' : ''} ?`)) return;
  await Promise.all(ids.map(id => store.deleteDocument(id)));
}

async function onDuplicate(ids: number[]) {
  const originals = store.documents.filter(d => ids.includes(d.id));
  await Promise.all(
    originals.map(d =>
      store.createDocument({ type: `${d.type} (copie)`, url: d.url, properties: { ...d.properties } })
    )
  );
}

// ── Upload replacement file ───────────────────────────
const uploadingId = ref<number | null>(null);

async function pickFile(doc: Document) {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    uploadingId.value = doc.id;
    try { await store.uploadFile(doc.id, file); }
    finally { uploadingId.value = null; }
  };
  input.click();
}

// ── Add / edit modal ──────────────────────────────────
const showForm = ref(false);
const editingId = ref<number | null>(null);
const formError = ref('');
const formLoading = ref(false);
const form = ref({ type: '', url: '' });
const formFile = ref<File | null>(null);

interface Prop { name: string; value: string }
const formProps = ref<Prop[]>([]);

function propsToRows(obj: Record<string, any>): Prop[] {
  return Object.entries(obj).map(([name, value]) => ({
    name,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

function rowsToProps(rows: Prop[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const row of rows) {
    if (!row.name.trim()) continue;
    try { obj[row.name.trim()] = JSON.parse(row.value); }
    catch { obj[row.name.trim()] = row.value; }
  }
  return obj;
}

function openAdd() {
  editingId.value = null;
  form.value = { type: '', url: '' };
  formProps.value = [];
  formFile.value = null;
  formError.value = '';
  showForm.value = true;
}

function openEdit(doc: Document) {
  editingId.value = doc.id;
  form.value = { type: doc.type, url: doc.url };
  formProps.value = propsToRows(doc.properties);
  formFile.value = null;
  formError.value = '';
  showForm.value = true;
}

function onFileChange(e: Event) {
  formFile.value = (e.target as HTMLInputElement).files?.[0] ?? null;
}

async function submitForm() {
  formError.value = '';
  const duplicates = formProps.value.map(p => p.name.trim()).filter((n, i, arr) => n && arr.indexOf(n) !== i);
  if (duplicates.length) { formError.value = `Noms en double : ${duplicates.join(', ')}`; return; }

  formLoading.value = true;
  try {
    const props = rowsToProps(formProps.value);
    if (editingId.value) {
      await store.updateDocument(editingId.value, {
        type: form.value.type,
        url: form.value.url || undefined,
        properties: props,
      });
    } else {
      await store.createDocument(
        { type: form.value.type, url: form.value.url || undefined, properties: props },
        formFile.value ?? undefined,
      );
    }
    showForm.value = false;
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur';
  } finally {
    formLoading.value = false;
  }
}

// ── Helpers ────────────────────────────────────────────
const typeColor: Record<string, string> = {
  image: '#10b981',
  pdf: '#ef4444',
  datasheet: '#3b82f6',
  invoice: '#f59e0b',
  contract: '#8b5cf6',
};

function isImage(doc: Document) {
  return doc.type === 'image' || /\.(png|jpe?g|gif|webp|svg)$/i.test(doc.url);
}

function filename(url: string) {
  return url.split('/').pop() ?? url;
}

function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString('fr-FR');
}

onMounted(() => store.fetchDocuments());
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Documents</h1>
      <button v-if="isAdmin" class="add-btn" @click="openAdd">+ Ajouter</button>
    </header>

    <DataGrid
      :columns="columns"
      :rows="store.documents"
      :loading="store.loading"
      :can-duplicate="isAdmin"
      :can-delete="isAdmin"
      @update="onUpdate"
      @delete="onDelete"
      @duplicate="onDuplicate"
    >
      <!-- Preview column -->
      <template #cell-url="{ row }">
        <div class="url-cell">
          <img
            v-if="isImage(row as Document)"
            :src="row.url.startsWith('/') ? apiBase + row.url : row.url"
            :alt="row.type"
            class="thumb"
          />
          <div v-else class="file-icon">{{ row.type === 'pdf' ? '📄' : '📎' }}</div>
          <a
            :href="row.url.startsWith('/') ? apiBase + row.url : row.url"
            target="_blank"
            class="url-link"
          >{{ filename(row.url) }}</a>
        </div>
      </template>

      <!-- Type column — badge when not editing -->
      <template #cell-type="{ row, col }">
        <span class="type-badge" :style="{ background: typeColor[row.type] ?? '#6c63ff' }">
          {{ row.type }}
        </span>
      </template>

      <!-- Properties column -->
      <template #cell-properties="{ row }">
        <code v-if="Object.keys(row.properties ?? {}).length" class="props-preview">
          {{ JSON.stringify(row.properties) }}
        </code>
        <span v-else class="empty-val">—</span>
      </template>

      <!-- Date column -->
      <template #cell-created_at="{ row }">
        <span class="date-text">{{ fmtDate(row.created_at) }}</span>
      </template>

      <!-- Row actions -->
      <template v-if="isAdmin" #row-actions="{ row }">
        <button class="act-btn" :disabled="uploadingId === row.id" @click="pickFile(row as Document)" title="Remplacer le fichier">
          {{ uploadingId === row.id ? '…' : '⬆' }}
        </button>
        <button class="act-btn edit" @click="openEdit(row as Document)" title="Modifier">✏</button>
      </template>
    </DataGrid>

    <!-- Modal -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <h2>{{ editingId ? 'Modifier le document' : 'Nouveau document' }}</h2>
        <form @submit.prevent="submitForm">
          <label>Type</label>
          <input v-model="form.type" required placeholder="image, pdf, datasheet…" />

          <label>URL externe <span class="hint">(ou choisissez un fichier ci-dessous)</span></label>
          <input v-model="form.url" placeholder="https://…" />

          <template v-if="!editingId">
            <label>Fichier</label>
            <input type="file" @change="onFileChange" class="file-input" />
          </template>

          <div class="props-header">
            <label>Propriétés</label>
            <button type="button" class="add-prop-btn" @click="formProps.push({ name: '', value: '' })">+ Ajouter</button>
          </div>
          <div class="props-editor">
            <div v-if="formProps.length === 0" class="no-props">Aucune propriété.</div>
            <div v-for="(prop, i) in formProps" :key="i" class="prop-row">
              <input v-model="prop.name" placeholder="Nom" class="prop-name" />
              <span class="prop-sep">=</span>
              <input v-model="prop.value" placeholder="Valeur" class="prop-value" />
              <button type="button" class="prop-del" @click="formProps.splice(i, 1)">✕</button>
            </div>
          </div>

          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="showForm = false">Annuler</button>
            <button type="submit" :disabled="formLoading">{{ formLoading ? '…' : 'Enregistrer' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 1.5rem; min-height: 100%; box-sizing: border-box; }

.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.topbar h1 { margin: 0; font-size: 1.5rem; color: #1a1a2e; }
.add-btn { padding: .4rem .9rem; background: #6c63ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: .875rem; font-weight: 600; }
.add-btn:hover { opacity: .9; }

/* ── Custom cells ─────────────────────────────────────── */
.url-cell { display: flex; align-items: center; gap: .6rem; }
.thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.file-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; background: #f0f0f0; border-radius: 6px; flex-shrink: 0; }
.url-link { color: #6c63ff; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; display: block; font-size: .82rem; }
.url-link:hover { text-decoration: underline; }

.type-badge { font-size: .72rem; font-weight: 600; color: white; padding: .2rem .55rem; border-radius: 20px; white-space: nowrap; }

.props-preview { font-size: .75rem; color: #555; background: #f5f5f5; padding: .2rem .4rem; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; max-width: 200px; }
.empty-val { color: #ccc; }

.date-text { font-size: .8rem; color: #888; white-space: nowrap; }

/* ── Row actions ─────────────────────────────────────── */
.act-btn { padding: .25rem .45rem; font-size: .8rem; border-radius: 5px; cursor: pointer; border: 1px solid #ddd; background: transparent; margin-left: .2rem; transition: background .12s; }
.act-btn:first-child { margin-left: 0; }
.act-btn:hover { background: #f0f0f0; }
.act-btn.edit { border-color: #6c63ff; color: #6c63ff; }
.act-btn.edit:hover { background: #6c63ff; color: white; }
.act-btn:disabled { opacity: .4; cursor: not-allowed; }

/* ── Modal ───────────────────────────────────────────── */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: white; border-radius: 12px; padding: 1.75rem; width: 100%; max-width: 460px; box-shadow: 0 8px 32px rgba(0,0,0,.15); max-height: 90vh; overflow-y: auto; }
.modal h2 { margin: 0 0 1.25rem; font-size: 1.2rem; color: #1a1a2e; }
label { display: block; margin: .6rem 0 .2rem; font-size: .875rem; color: #555; }
.hint { font-size: .75rem; color: #aaa; font-weight: 400; }
input:not([type=file]), textarea { width: 100%; padding: .55rem .75rem; border: 1px solid #ddd; border-radius: 8px; font-size: .9rem; box-sizing: border-box; font-family: inherit; }
input:not([type=file]):focus, textarea:focus { outline: none; border-color: #6c63ff; }
.file-input { border: none; padding: 0; font-size: .875rem; }

.props-header { display: flex; justify-content: space-between; align-items: center; margin: .6rem 0 .3rem; }
.props-header label { margin: 0; }
.add-prop-btn { padding: .2rem .6rem; font-size: .78rem; font-weight: 600; color: #6c63ff; border: 1px solid #6c63ff; background: transparent; border-radius: 6px; cursor: pointer; }
.add-prop-btn:hover { background: #6c63ff; color: white; }

.props-editor { border: 1px solid #ddd; border-radius: 8px; padding: .4rem; display: flex; flex-direction: column; gap: .3rem; min-height: 48px; }
.no-props { font-size: .8rem; color: #bbb; padding: .4rem .2rem; }
.prop-row { display: grid; grid-template-columns: 1fr auto 1.4fr auto; align-items: center; gap: .35rem; }
.prop-name { font-weight: 600; }
.prop-sep { color: #aaa; font-size: .85rem; text-align: center; }
.prop-value { font-family: monospace; }
.prop-del { padding: .2rem .4rem; border: none; background: transparent; color: #bbb; cursor: pointer; font-size: .85rem; border-radius: 4px; line-height: 1; }
.prop-del:hover { background: #fee2e2; color: #ef4444; }

.error { color: #e53e3e; font-size: .875rem; margin: .5rem 0 0; }
.modal-footer { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.25rem; }
.cancel-btn { padding: .6rem 1rem; background: transparent; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: .9rem; }
.modal-footer button[type=submit] { padding: .6rem 1.2rem; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: .9rem; font-weight: 600; cursor: pointer; }
.modal-footer button[type=submit]:disabled { opacity: .6; cursor: not-allowed; }
</style>
