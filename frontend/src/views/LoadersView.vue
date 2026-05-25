<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useLoadersStore, type Loader, type RunResult, type TestResult } from '../stores/loaders';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const store = useLoadersStore();

const effectiveAdmin = computed(() => auth.user?.role === 'admin' && !auth.viewAsUser);
const accountId = computed(() => route.params.accountId as string);

const activeRunId = ref<number | null>(null);
const runFileInputs = ref<Record<number, HTMLInputElement | null>>({});
const previewData = ref<Record<number, { headers: string[]; rows: Record<string, string>[] }>>({});
const runResults = ref<Record<number, RunResult>>({});
const runErrors = ref<Record<number, string>>({});
const running = ref<Record<number, boolean>>({});
const previewing = ref<Record<number, boolean>>({});
const testing = ref<Record<number, boolean>>({});
const testResults = ref<Record<number, TestResult>>({});

onMounted(() => store.fetchLoaders());

function toggleRun(id: number) {
  activeRunId.value = activeRunId.value === id ? null : id;
}

function navigateToEditor(id?: number) {
  if (id) {
    router.push(`/accounts/${accountId.value}/loaders/${id}/edit`);
  } else {
    router.push(`/accounts/${accountId.value}/loaders/new`);
  }
}

async function doDelete(loader: Loader) {
  if (!confirm(`Supprimer le chargeur "${loader.name}" ?`)) return;
  await store.deleteLoader(loader.id);
}

function getFileForLoader(id: number): File | null {
  const el = runFileInputs.value[id];
  return el?.files?.[0] ?? null;
}

async function doPreview(loader: Loader) {
  const file = getFileForLoader(loader.id);
  if (!file) { runErrors.value[loader.id] = 'Veuillez sélectionner un fichier.'; return; }
  runErrors.value[loader.id] = '';
  previewing.value[loader.id] = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('file_format', loader.file_format);
    fd.append('delimiter', loader.delimiter);
    fd.append('has_header', String(loader.has_header));
    const result = await store.parseFile(fd);
    previewData.value[loader.id] = { headers: result.headers, rows: result.preview };
  } catch (e: any) {
    runErrors.value[loader.id] = e.response?.data?.message ?? 'Erreur de prévisualisation.';
  } finally {
    previewing.value[loader.id] = false;
  }
}

async function doTest(loader: Loader) {
  const file = getFileForLoader(loader.id);
  if (!file) { runErrors.value[loader.id] = 'Veuillez sélectionner un fichier.'; return; }
  runErrors.value[loader.id] = '';
  testing.value[loader.id] = true;
  delete testResults.value[loader.id];
  delete runResults.value[loader.id];
  try {
    const fd = new FormData();
    fd.append('file', file);
    testResults.value[loader.id] = await store.testLoader(loader.id, fd);
  } catch (e: any) {
    runErrors.value[loader.id] = e.response?.data?.message ?? 'Erreur lors du test.';
  } finally {
    testing.value[loader.id] = false;
  }
}

async function doRun(loader: Loader) {
  const file = getFileForLoader(loader.id);
  if (!file) { runErrors.value[loader.id] = 'Veuillez sélectionner un fichier.'; return; }
  runErrors.value[loader.id] = '';
  running.value[loader.id] = true;
  runResults.value[loader.id] = { total: 0, inserted: 0, skipped: 0, replaced: 0, errors: [] };
  try {
    const fd = new FormData();
    fd.append('file', file);
    runResults.value[loader.id] = await store.runLoader(loader.id, fd);
  } catch (e: any) {
    runErrors.value[loader.id] = e.response?.data?.message ?? 'Erreur lors de l\'exécution.';
  } finally {
    running.value[loader.id] = false;
  }
}

function testPreviewCols(id: number): string[] {
  const rows = testResults.value[id]?.preview ?? [];
  if (rows.length === 0) return [];
  return Object.keys(rows[0]).filter(k => k !== '_action');
}

function formatBadge(f: string) {
  if (f === 'image') return '🖼 Image';
  return f.toUpperCase();
}

function badgeClass(f: string) {
  if (f === 'csv') return 'badge-csv';
  if (f === 'tsv') return 'badge-tsv';
  if (f === 'image') return 'badge-image';
  return 'badge-json';
}

function fileAccept(f: string) {
  return f === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : '.csv,.tsv,.json,.txt';
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Chargeurs</h1>
      <button v-if="effectiveAdmin" class="btn-primary" @click="navigateToEditor()">+ Nouveau chargeur</button>
    </div>

    <div v-if="store.loaders.length === 0" class="empty-state">
      Aucun chargeur défini.
    </div>

    <div v-for="loader in store.loaders" :key="loader.id" class="loader-block">
      <div class="loader-card">
        <div class="loader-info">
          <span :class="['badge', badgeClass(loader.file_format)]">{{ formatBadge(loader.file_format) }}</span>
          <span class="loader-name">{{ loader.name }}</span>
          <span class="loader-meta">→ {{ loader.target_table }}</span>
          <span class="loader-meta">{{ loader.mapping.length }} colonne(s)</span>
        </div>
        <div class="loader-actions">
          <button class="btn-icon" @click="toggleRun(loader.id)">▶ Exécuter</button>
          <template v-if="effectiveAdmin">
            <button class="btn-icon" @click="navigateToEditor(loader.id)">✏️ Modifier</button>
            <button class="btn-icon btn-danger" @click="doDelete(loader)">🗑 Supprimer</button>
          </template>
        </div>
      </div>

      <div v-if="activeRunId === loader.id" class="run-panel">
        <div class="run-file-row">
          <label class="run-label">{{ loader.file_format === 'image' ? 'Image à importer' : 'Fichier à importer' }}</label>
          <input
            type="file"
            :ref="el => runFileInputs[loader.id] = el as HTMLInputElement | null"
            :accept="fileAccept(loader.file_format)"
          />
        </div>

        <div v-if="loader.file_format === 'image'" class="ai-run-notice">
          ✨ Claude analysera l'image et extraira les données avant import.
        </div>

        <div v-if="runErrors[loader.id]" class="error-msg">{{ runErrors[loader.id] }}</div>

        <div class="run-btn-row">
          <button v-if="loader.file_format !== 'image'" class="btn-secondary" :disabled="previewing[loader.id]" @click="doPreview(loader)">
            {{ previewing[loader.id] ? 'Chargement…' : 'Prévisualiser' }}
          </button>
          <button class="btn-test" :disabled="testing[loader.id]" @click="doTest(loader)">
            {{ testing[loader.id] ? 'Test…' : '🧪 Tester' }}
          </button>
          <button class="btn-primary" :disabled="running[loader.id]" @click="doRun(loader)">
            {{ running[loader.id] ? 'Exécution…' : 'Exécuter' }}
          </button>
        </div>

        <div v-if="previewData[loader.id]" class="preview-section">
          <p class="section-label">Aperçu (10 premières lignes)</p>
          <div class="table-wrap">
            <table class="preview-table">
              <thead>
                <tr>
                  <th v-for="h in previewData[loader.id].headers" :key="h">{{ h }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in previewData[loader.id].rows" :key="i">
                  <td v-for="h in previewData[loader.id].headers" :key="h">{{ row[h] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="testResults[loader.id]" class="result-section test-result-section">
          <p class="section-label">🧪 Résultat du test <span class="dry-run-tag">simulation — aucune donnée modifiée</span></p>
          <div class="result-stats">
            <div class="stat stat-total">Total : {{ testResults[loader.id].total }}</div>
            <div class="stat stat-inserted">À insérer : {{ testResults[loader.id].inserted }}</div>
            <div class="stat stat-skipped">À ignorer : {{ testResults[loader.id].skipped }}</div>
            <div class="stat stat-replaced">À remplacer : {{ testResults[loader.id].replaced }}</div>
          </div>
          <div v-if="testResults[loader.id].preview.length > 0" class="table-wrap">
            <table class="preview-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th v-for="col in testPreviewCols(loader.id)" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, i) in testResults[loader.id].preview"
                  :key="i"
                  :class="`test-row-${row._action}`"
                >
                  <td><span :class="`action-badge action-${row._action}`">{{ row._action }}</span></td>
                  <td v-for="col in testPreviewCols(loader.id)" :key="col">{{ row[col] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul v-if="testResults[loader.id].errors.length > 0" class="error-list">
            <li v-for="(e, i) in testResults[loader.id].errors" :key="i">{{ e }}</li>
          </ul>
        </div>

        <div v-if="runResults[loader.id]" class="result-section">
          <p class="section-label">Résultats</p>
          <div class="result-stats">
            <div class="stat stat-total">Total : {{ runResults[loader.id].total }}</div>
            <div class="stat stat-inserted">Insérés : {{ runResults[loader.id].inserted }}</div>
            <div class="stat stat-skipped">Ignorés : {{ runResults[loader.id].skipped }}</div>
            <div class="stat stat-replaced">Remplacés : {{ runResults[loader.id].replaced }}</div>
          </div>
          <ul v-if="runResults[loader.id].errors.length > 0" class="error-list">
            <li v-for="(e, i) in runResults[loader.id].errors" :key="i">{{ e }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
}

.empty-state {
  color: #999;
  text-align: center;
  padding: 3rem 0;
}

.loader-block {
  margin-bottom: 1rem;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.loader-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  background: white;
  flex-wrap: wrap;
  gap: .5rem;
}

.loader-info {
  display: flex;
  align-items: center;
  gap: .75rem;
  flex-wrap: wrap;
}

.loader-name {
  font-weight: 600;
  color: #1a1a2e;
}

.loader-meta {
  font-size: .85rem;
  color: #6b7280;
}

.loader-actions {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}

.badge {
  padding: .15rem .55rem;
  border-radius: 20px;
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
}
.badge-csv { background: #d1fae5; color: #065f46; }
.badge-tsv { background: #dbeafe; color: #1d4ed8; }
.badge-json { background: #fef3c7; color: #92400e; }
.badge-image { background: #ede9fe; color: #5b21b6; }

.btn-primary {
  padding: .45rem 1rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: .85rem;
  font-weight: 600;
}
.btn-primary:disabled { opacity: .6; cursor: default; }
.btn-secondary {
  padding: .45rem 1rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: .85rem;
}
.btn-secondary:disabled { opacity: .6; cursor: default; }
.btn-test {
  padding: .45rem 1rem;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  cursor: pointer;
  font-size: .85rem;
  font-weight: 600;
}
.btn-test:hover { background: #fde68a; }
.btn-test:disabled { opacity: .6; cursor: default; }
.btn-icon {
  padding: .35rem .75rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: .8rem;
}
.btn-danger { color: #dc2626; border-color: #fca5a5; }

.run-panel {
  background: #f9fafb;
  padding: 1.2rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.run-file-row {
  display: flex;
  align-items: center;
  gap: .75rem;
  flex-wrap: wrap;
}

.run-label {
  font-size: .85rem;
  font-weight: 600;
  color: #374151;
}

.run-btn-row {
  display: flex;
  gap: .5rem;
}

.error-msg {
  color: #dc2626;
  font-size: .85rem;
}

.section-label {
  font-weight: 600;
  font-size: .85rem;
  color: #374151;
  margin-bottom: .4rem;
}

.table-wrap {
  overflow-x: auto;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .8rem;
}

.preview-table th,
.preview-table td {
  padding: .35rem .6rem;
  border: 1px solid #e5e7eb;
  text-align: left;
  white-space: nowrap;
}

.preview-table thead tr {
  background: #1a1a2e;
  color: white;
}

.result-stats {
  display: flex;
  gap: .75rem;
  flex-wrap: wrap;
  margin-bottom: .5rem;
}

.stat {
  padding: .3rem .75rem;
  border-radius: 20px;
  font-size: .8rem;
  font-weight: 600;
}
.stat-total    { background: #f3f4f6; color: #374151; }
.stat-inserted { background: #d1fae5; color: #065f46; }
.stat-skipped  { background: #e5e7eb; color: #4b5563; }
.stat-replaced { background: #dbeafe; color: #1d4ed8; }

.error-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: .25rem;
}
.error-list li {
  font-size: .8rem;
  color: #dc2626;
  background: #fee2e2;
  padding: .3rem .6rem;
  border-radius: 4px;
}

.test-result-section { border: 1px dashed #fcd34d; border-radius: 8px; background: #fffbeb; }
.dry-run-tag {
  font-size: .7rem;
  font-weight: 400;
  color: #92400e;
  background: #fde68a;
  padding: .1rem .45rem;
  border-radius: 20px;
  margin-left: .4rem;
  vertical-align: middle;
}

.action-badge {
  padding: .1rem .45rem;
  border-radius: 20px;
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
}
.action-insert  { background: #d1fae5; color: #065f46; }
.action-skip    { background: #e5e7eb; color: #4b5563; }
.action-replace { background: #dbeafe; color: #1d4ed8; }

.test-row-insert  { background: #f0fdf4; }
.test-row-skip    { background: #f9fafb; opacity: .7; }
.test-row-replace { background: #eff6ff; }

.ai-run-notice {
  font-size: .82rem;
  color: #5b21b6;
  background: #ede9fe;
  border: 1px solid #c4b5fd;
  border-radius: 8px;
  padding: .45rem .75rem;
}
</style>
