<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLoadersStore, type MappingEntry, type TableSchema } from '../stores/loaders';

const route = useRoute();
const router = useRouter();
const store = useLoadersStore();

const loaderId = computed(() => route.params.loaderId ? Number(route.params.loaderId) : null);
const isEdit = computed(() => loaderId.value !== null);

const saving = ref(false);
const saveError = ref('');

const name = ref('');
const fileFormat = ref<'csv' | 'tsv' | 'json' | 'image'>('csv');
const delimiter = ref(',');
const customDelimiter = ref('');
const hasHeader = ref(true);
const targetTable = ref('products');
const upsertKey = ref('');
const onConflict = ref<'skip' | 'replace'>('skip');
const mapping = ref<MappingEntry[]>([]);

const tables = ref<TableSchema[]>([]);
const detectedCols = ref<string[]>([]);
const previewHeaders = ref<string[]>([]);
const previewRows = ref<Record<string, string>[]>([]);
const sampleFileInput = ref<HTMLInputElement | null>(null);
const imageFileInput = ref<HTMLInputElement | null>(null);
const detecting = ref(false);
const detectError = ref('');
const aiDescription = ref('');

const DELIMITER_OPTIONS = [
  { label: 'Virgule (,)', value: ',' },
  { label: 'Point-virgule (;)', value: ';' },
  { label: 'Pipe (|)', value: '|' },
  { label: 'Tabulation', value: '\t' },
  { label: 'Personnalisé', value: '__custom__' },
];

const delimiterSelectValue = computed({
  get() {
    if ([',', ';', '|', '\t'].includes(delimiter.value)) return delimiter.value;
    return '__custom__';
  },
  set(v: string) {
    if (v === '__custom__') {
      delimiter.value = customDelimiter.value;
    } else {
      delimiter.value = v;
    }
  },
});

watch(customDelimiter, (v) => {
  if (delimiterSelectValue.value === '__custom__') delimiter.value = v;
});

const targetColumns = computed(() => {
  const t = tables.value.find(t => t.name === targetTable.value);
  return t ? t.columns : [];
});

watch(targetTable, () => {
  upsertKey.value = '';
  if (mapping.value.length > 0) {
    mapping.value = mapping.value.map(entry => ({ ...entry, target: '' }));
  }
});

watch(fileFormat, () => {
  detectedCols.value = [];
  previewHeaders.value = [];
  previewRows.value = [];
  aiDescription.value = '';
});

function addMappingRow() {
  mapping.value.push({ source: '', target: '', transform: 'string' });
}

function removeMappingRow(index: number) {
  mapping.value.splice(index, 1);
}

async function detect() {
  const file = sampleFileInput.value?.files?.[0];
  if (!file) { detectError.value = 'Veuillez sélectionner un fichier exemple.'; return; }
  detectError.value = '';
  detecting.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('file_format', fileFormat.value);
    const effectiveDelimiter = fileFormat.value === 'tsv' ? '\t' : delimiter.value;
    fd.append('delimiter', effectiveDelimiter);
    fd.append('has_header', hasHeader.value ? '1' : '0');
    const result = await store.parseFile(fd);
    detectedCols.value = result.headers;
    previewHeaders.value = result.headers;
    previewRows.value = result.preview;

    if (mapping.value.length === 0 && result.headers.length > 0) {
      mapping.value = result.headers.map(col => ({ source: col, target: '', transform: 'string' as const }));
    }
  } catch (e: any) {
    detectError.value = e.response?.data?.message ?? 'Erreur de détection.';
  } finally {
    detecting.value = false;
  }
}

async function analyzeImage() {
  const file = imageFileInput.value?.files?.[0];
  if (!file) { detectError.value = 'Veuillez sélectionner une image.'; return; }
  detectError.value = '';
  aiDescription.value = '';
  detecting.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const result = await store.parseImage(fd);
    detectedCols.value = result.headers;
    previewHeaders.value = result.headers;
    previewRows.value = result.preview;
    aiDescription.value = result.description;

    if (result.headers.length > 0) {
      mapping.value = result.headers.map(col => ({ source: col, target: '', transform: 'string' as const }));
    }
  } catch (e: any) {
    detectError.value = e.response?.data?.message ?? 'Erreur d\'analyse IA.';
  } finally {
    detecting.value = false;
  }
}

async function save() {
  if (!name.value.trim()) { saveError.value = 'Le nom est requis.'; return; }
  saveError.value = '';
  saving.value = true;
  try {
    const payload = {
      name: name.value.trim(),
      file_format: fileFormat.value,
      delimiter: fileFormat.value === 'tsv' ? '\t' : delimiter.value,
      has_header: hasHeader.value ? 1 : 0,
      target_table: targetTable.value,
      upsert_key: upsertKey.value,
      on_conflict: onConflict.value,
      mapping: mapping.value,
    };
    if (isEdit.value) {
      await store.updateLoader(loaderId.value!, payload);
    } else {
      await store.createLoader(payload as any);
    }
    router.push(`/accounts/${route.params.accountId}/loaders`);
  } catch (e: any) {
    saveError.value = e.response?.data?.message ?? 'Erreur lors de la sauvegarde.';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  tables.value = await store.fetchTables();
  if (isEdit.value) {
    const loader = await store.getLoader(loaderId.value!);
    name.value = loader.name;
    fileFormat.value = loader.file_format;
    hasHeader.value = loader.has_header === 1;
    targetTable.value = loader.target_table;
    upsertKey.value = loader.upsert_key;
    onConflict.value = loader.on_conflict;
    mapping.value = loader.mapping;

    const knownDelimiters = [',', ';', '|', '\t'];
    if (knownDelimiters.includes(loader.delimiter)) {
      delimiter.value = loader.delimiter;
    } else {
      customDelimiter.value = loader.delimiter;
      delimiter.value = loader.delimiter;
    }
  }
});
</script>

<template>
  <div class="editor-shell">
    <div class="topbar">
      <button class="btn-back" @click="router.back()">← Retour</button>
      <h1 class="topbar-title">{{ isEdit ? 'Modifier le chargeur' : 'Nouveau chargeur' }}</h1>
      <div class="topbar-right">
        <span v-if="saveError" class="save-error">{{ saveError }}</span>
        <button class="btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Sauvegarde…' : 'Enregistrer' }}
        </button>
      </div>
    </div>

    <div class="editor-body">
      <div class="left-panel">
        <section class="section">
          <h2 class="section-title">Paramètres généraux</h2>

          <div class="field">
            <label class="field-label">Nom</label>
            <input class="field-input" v-model="name" placeholder="Ex: Import articles CSV" />
          </div>

          <div class="field">
            <label class="field-label">Format</label>
            <div class="pill-group">
              <button v-for="fmt in ['csv', 'tsv', 'json', 'image']" :key="fmt"
                :class="['pill', { active: fileFormat === fmt }]"
                @click="fileFormat = fmt as 'csv' | 'tsv' | 'json' | 'image'">
                {{ fmt === 'image' ? '🖼 Image (IA)' : fmt.toUpperCase() }}
              </button>
            </div>
          </div>

          <div v-if="fileFormat === 'image'" class="field ai-notice">
            <span class="ai-badge">✨ IA</span>
            Claude analysera l'image et proposera un mapping automatique.
          </div>

          <div v-if="fileFormat === 'csv'" class="field">
            <label class="field-label">Délimiteur</label>
            <select class="field-input" :value="delimiterSelectValue"
              @change="e => delimiterSelectValue = (e.target as HTMLSelectElement).value">
              <option v-for="opt in DELIMITER_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <input v-if="delimiterSelectValue === '__custom__'" class="field-input mt-xs" v-model="customDelimiter"
              placeholder="Caractère personnalisé" maxlength="5" />
          </div>

          <div v-if="fileFormat !== 'image'" class="field field-row">
            <label class="field-label">En-têtes en première ligne</label>
            <input type="checkbox" v-model="hasHeader" />
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">Destination</h2>

          <div class="field">
            <label class="field-label">Table cible</label>
            <select class="field-input" v-model="targetTable">
              <option v-for="t in tables" :key="t.name" :value="t.name">{{ t.name }}</option>
            </select>
          </div>

          <div class="field">
            <label class="field-label">Clé de correspondance (upsert)</label>
            <select class="field-input" v-model="upsertKey">
              <option value="">— Toujours insérer —</option>
              <option v-for="col in targetColumns" :key="col.name" :value="col.name">{{ col.name }}</option>
            </select>
          </div>

          <div v-if="upsertKey" class="field">
            <label class="field-label">En cas de conflit</label>
            <select class="field-input" v-model="onConflict">
              <option value="skip">Ignorer (skip)</option>
              <option value="replace">Remplacer (replace)</option>
            </select>
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">Correspondance des colonnes</h2>

          <datalist id="source-cols">
            <option v-for="col in detectedCols" :key="col" :value="col" />
          </datalist>

          <div v-if="mapping.length === 0" class="empty-mapping">
            Aucune correspondance. Ajoutez des lignes ou détectez les colonnes via un fichier exemple.
          </div>

          <div class="mapping-table" v-if="mapping.length > 0">
            <div class="mapping-header">
              <span>Source</span>
              <span>Destination</span>
              <span>Transformation</span>
              <span></span>
            </div>
            <div v-for="(entry, idx) in mapping" :key="idx" class="mapping-row">
              <input class="field-input" v-model="entry.source" list="source-cols" placeholder="Colonne source" />
              <select class="field-input" v-model="entry.target">
                <option value="">— Choisir —</option>
                <option v-for="col in targetColumns" :key="col.name" :value="col.name">
                  {{ col.name }}
                </option>
              </select>
              <select class="field-input" v-model="entry.transform">
                <option value="string">Texte</option>
                <option value="number">Nombre</option>
                <option value="integer">Entier</option>
                <option value="boolean">Booléen</option>
                <option value="date">Date</option>
              </select>
              <button class="btn-remove" @click="removeMappingRow(idx)">✕</button>
            </div>
          </div>

          <button class="btn-add" @click="addMappingRow">+ Ajouter</button>
        </section>
      </div>

      <div class="right-panel">
        <section class="section">
          <h2 class="section-title">{{ fileFormat === 'image' ? 'Analyse IA' : 'Fichier exemple' }}</h2>

          <!-- CSV / TSV / JSON detect -->
          <template v-if="fileFormat !== 'image'">
            <div class="field">
              <label class="field-label">Fichier exemple (pour détecter les colonnes)</label>
              <input ref="sampleFileInput" type="file" accept=".csv,.tsv,.json,.txt" />
            </div>

            <div v-if="detectError" class="error-msg">{{ detectError }}</div>

            <button class="btn-secondary" :disabled="detecting" @click="detect">
              {{ detecting ? 'Détection…' : 'Détecter' }}
            </button>
          </template>

          <!-- Image detect via AI -->
          <template v-else>
            <div class="field">
              <label class="field-label">Image exemple (JPEG, PNG, WebP)</label>
              <input ref="imageFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
            </div>

            <div v-if="detectError" class="error-msg">{{ detectError }}</div>

            <button class="btn-ai" :disabled="detecting" @click="analyzeImage">
              <span v-if="detecting" class="spinner" />
              {{ detecting ? 'Analyse en cours…' : '✨ Analyser avec l\'IA' }}
            </button>

            <div v-if="aiDescription" class="ai-desc">
              <span class="ai-badge">IA</span>
              {{ aiDescription }}
            </div>
          </template>

          <div v-if="previewHeaders.length > 0" class="preview-section">
            <p class="preview-label">Aperçu (10 premières lignes)</p>
            <div class="table-wrap">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th v-for="h in previewHeaders" :key="h">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in previewRows" :key="i">
                    <td v-for="h in previewHeaders" :key="h">{{ row[h] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: .75rem 1.5rem;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar-title {
  flex: 1;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1a1a2e;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.save-error {
  color: #dc2626;
  font-size: .85rem;
}

.btn-back {
  background: none;
  border: none;
  color: #6c63ff;
  cursor: pointer;
  font-size: .9rem;
  font-weight: 600;
}

.btn-primary {
  padding: .45rem 1.2rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: .9rem;
  font-weight: 600;
}

.btn-primary:disabled {
  opacity: .6;
  cursor: default;
}

.btn-secondary {
  padding: .4rem .9rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: .85rem;
}

.btn-secondary:disabled {
  opacity: .6;
  cursor: default;
}

.editor-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
  overflow-y: auto;
  align-items: start;
}

@media (max-width: 768px) {
  .editor-body {
    grid-template-columns: 1fr;
  }
}

.left-panel,
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section {
  background: white;
  border-radius: 10px;
  padding: 1.2rem;
  border: 1px solid #e5e7eb;
}

.section-title {
  font-size: .95rem;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 1rem;
}

.field {
  margin-bottom: .75rem;
}

.field-row {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.field-label {
  display: block;
  font-size: .8rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: .3rem;
}

.field-input {
  width: 100%;
  padding: .4rem .6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: .85rem;
  color: #1a1a2e;
  background: white;
  box-sizing: border-box;
}

.mt-xs {
  margin-top: .4rem;
}

.pill-group {
  display: flex;
  gap: .4rem;
}

.pill {
  padding: .3rem .8rem;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  font-size: .8rem;
  font-weight: 600;
  color: #6b7280;
  transition: background .15s, color .15s;
}

.pill.active {
  background: #6c63ff;
  color: white;
  border-color: #6c63ff;
}

.empty-mapping {
  font-size: .85rem;
  color: #9ca3af;
  margin-bottom: .75rem;
}

.mapping-table {
  display: flex;
  flex-direction: column;
  gap: .4rem;
  margin-bottom: .75rem;
}

.mapping-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: .4rem;
  font-size: .75rem;
  font-weight: 700;
  color: #6b7280;
  padding: 0 .2rem;
}

.mapping-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: .4rem;
  align-items: center;
}

.btn-remove {
  background: #fee2e2;
  border: none;
  color: #dc2626;
  border-radius: 4px;
  cursor: pointer;
  padding: .25rem .5rem;
  font-size: .75rem;
}

.btn-add {
  background: #f3f4f6;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  padding: .4rem .8rem;
  cursor: pointer;
  font-size: .85rem;
  color: #6b7280;
  width: 100%;
}

.btn-add:hover {
  background: #e5e7eb;
}

.error-msg {
  color: #dc2626;
  font-size: .85rem;
  margin-bottom: .5rem;
}

.preview-section {
  margin-top: 1rem;
}

.preview-label {
  font-size: .8rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: .4rem;
}

.table-wrap {
  overflow-x: auto;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .75rem;
}

.preview-table th,
.preview-table td {
  padding: .3rem .5rem;
  border: 1px solid #e5e7eb;
  text-align: left;
  white-space: nowrap;
}

.preview-table thead tr {
  background: #1a1a2e;
  color: white;
}

.ai-notice {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: .82rem;
  color: #6b7280;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  border-radius: 8px;
  padding: .5rem .75rem;
}

.ai-badge {
  font-size: .7rem;
  font-weight: 700;
  background: #6c63ff;
  color: white;
  border-radius: 4px;
  padding: .1rem .4rem;
  flex-shrink: 0;
}

.btn-ai {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .5rem 1rem;
  background: linear-gradient(135deg, #6c63ff, #a855f7);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: .9rem;
  font-weight: 600;
  transition: opacity .15s;
}

.btn-ai:disabled {
  opacity: .6;
  cursor: default;
}

.btn-ai:hover:not(:disabled) {
  opacity: .88;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, .4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.ai-desc {
  display: flex;
  align-items: flex-start;
  gap: .5rem;
  font-size: .83rem;
  color: #374151;
  background: #f5f3ff;
  border: 1px solid #c4b5fd;
  border-radius: 8px;
  padding: .6rem .75rem;
  margin-top: .5rem;
}
</style>
