<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useDashboardStore, buildTraces, type ChartType, type WidgetWidth, type WidgetConfig, type SchemaTable } from '../stores/dashboard';
import PlotlyChart from '../components/PlotlyChart.vue';

const route  = useRoute();
const router = useRouter();
const auth   = useAuthStore();
const store  = useDashboardStore();

const base      = computed(() => `/accounts/${auth.user?.account_id}`);
const isEditing = computed(() => !!route.params.widgetId);
const widgetId  = computed(() => Number(route.params.widgetId) || null);

// Form state
const title      = ref('Nouveau widget');
const chartType  = ref<ChartType>('bar');
const width      = ref<WidgetWidth>('half');
const query      = ref('');
const configX    = ref('');
const configY    = ref('');
const configYCols = ref<string[]>([]);
const configLabels = ref('');
const configValues = ref('');
const layoutJson = ref('{}');

// Preview state
const previewRows    = ref<any[]>([]);
const previewCols    = ref<string[]>([]);
const runningQuery   = ref(false);
const queryError     = ref('');
const showPreview    = ref(false);

// Schema state
const schema       = ref<SchemaTable[]>([]);
const schemaOpen   = ref(false);

// Save state
const saving = ref(false);
const saveError = ref('');

const CHART_TYPES: { value: ChartType; label: string; icon: string }[] = [
  { value: 'bar',     label: 'Barres',     icon: '📊' },
  { value: 'line',    label: 'Lignes',     icon: '📈' },
  { value: 'pie',     label: 'Camembert',  icon: '🥧' },
  { value: 'scatter', label: 'Nuage',      icon: '✦' },
  { value: 'table',   label: 'Tableau',    icon: '⊞' },
];

const WIDTH_OPTS: { value: WidgetWidth; label: string }[] = [
  { value: 'half',  label: '½ largeur' },
  { value: 'third', label: '⅓ largeur' },
  { value: 'full',  label: 'Pleine largeur' },
];

// Recompute preview traces whenever config or rows change
const previewTraces = computed(() => {
  let layoutOverride: Record<string, any> = {};
  try { layoutOverride = JSON.parse(layoutJson.value || '{}'); } catch { /* ignore */ }

  const cfg: WidgetConfig = {
    x: configX.value || undefined,
    y: configY.value || undefined,
    y_cols: configYCols.value.length ? configYCols.value : undefined,
    labels: configLabels.value || undefined,
    values: configValues.value || undefined,
    layout: layoutOverride,
  };
  return buildTraces(previewRows.value, chartType.value, cfg);
});

const previewLayout = computed(() => {
  try { return JSON.parse(layoutJson.value || '{}'); } catch { return {}; }
});

// When chart type changes, reset column mapping
watch(chartType, () => {
  configX.value = '';
  configY.value = '';
  configYCols.value = [];
  configLabels.value = '';
  configValues.value = '';
});

// When query results change, try to auto-fill mapping columns
watch(previewCols, (cols) => {
  if (!cols.length) return;
  if (!configX.value) configX.value = cols[0];
  if (!configY.value && cols[1]) configY.value = cols[1];
  if (!configLabels.value) configLabels.value = cols[0];
  if (!configValues.value && cols[1]) configValues.value = cols[1];
});

async function runQuery() {
  if (!query.value.trim()) return;
  runningQuery.value = true;
  queryError.value = '';
  previewRows.value = [];
  previewCols.value = [];
  try {
    const rows = await store.previewQuery(query.value);
    previewRows.value = rows;
    previewCols.value = rows.length ? Object.keys(rows[0]) : [];
    showPreview.value = true;
  } catch (e: any) {
    queryError.value = e?.response?.data?.message ?? 'Erreur SQL';
  } finally {
    runningQuery.value = false;
  }
}

function buildConfig(): WidgetConfig {
  let layoutOverride: Record<string, any> = {};
  try { layoutOverride = JSON.parse(layoutJson.value || '{}'); } catch { /* ignore */ }
  return {
    x: configX.value || undefined,
    y: configY.value || undefined,
    y_cols: configYCols.value.length ? configYCols.value : undefined,
    labels: configLabels.value || undefined,
    values: configValues.value || undefined,
    layout: Object.keys(layoutOverride).length ? layoutOverride : undefined,
  };
}

async function save() {
  saving.value = true;
  saveError.value = '';
  try {
    const payload = { title: title.value, chart_type: chartType.value, query: query.value, config: buildConfig(), width: width.value };
    if (isEditing.value && widgetId.value) {
      await store.updateWidget(widgetId.value, payload);
    } else {
      await store.createWidget(payload);
    }
    router.push(`${base.value}/dashboard`);
  } catch (e: any) {
    saveError.value = e?.response?.data?.message ?? 'Erreur lors de la sauvegarde';
  } finally {
    saving.value = false;
  }
}

async function loadForEdit() {
  if (!widgetId.value) return;
  // Find in store or fetch
  let w = store.widgets.find(x => x.id === widgetId.value);
  if (!w) {
    await store.fetchWidgets();
    w = store.widgets.find(x => x.id === widgetId.value);
  }
  if (!w) return;
  title.value      = w.title;
  chartType.value  = w.chart_type;
  width.value      = w.width;
  query.value      = w.query;
  configX.value    = w.config.x ?? '';
  configY.value    = w.config.y ?? '';
  configYCols.value = w.config.y_cols ?? [];
  configLabels.value = w.config.labels ?? '';
  configValues.value = w.config.values ?? '';
  layoutJson.value = w.config.layout ? JSON.stringify(w.config.layout, null, 2) : '{}';
  // Run query to populate preview columns
  if (w.query.trim()) {
    try {
      const rows = await store.previewQuery(w.query);
      previewRows.value = rows;
      previewCols.value = rows.length ? Object.keys(rows[0]) : [];
      showPreview.value = true;
    } catch { /* ignore */ }
  }
}

onMounted(async () => {
  schema.value = await store.fetchSchema().catch(() => []);
  if (isEditing.value) await loadForEdit();
});
</script>

<template>
  <div class="page">
    <!-- Top bar -->
    <header class="topbar">
      <div class="topbar-left">
        <button class="back-btn" @click="router.push(`${base}/dashboard`)">← Retour</button>
        <h1>{{ isEditing ? 'Modifier le widget' : 'Nouveau widget' }}</h1>
      </div>
      <div class="topbar-right">
        <span v-if="saveError" class="save-error">{{ saveError }}</span>
        <button class="save-btn" :disabled="saving" @click="save">
          {{ saving ? '…' : 'Enregistrer' }}
        </button>
      </div>
    </header>

    <div class="layout">
      <!-- ── Left panel: form ── -->
      <div class="form-panel">

        <!-- Basics -->
        <section class="section">
          <label class="field-label">Titre</label>
          <input v-model="title" class="text-input" placeholder="Nom du widget" />
        </section>

        <section class="section row-section">
          <div>
            <label class="field-label">Type de graphique</label>
            <div class="chart-type-grid">
              <label
                v-for="ct in CHART_TYPES"
                :key="ct.value"
                class="ct-opt"
                :class="{ active: chartType === ct.value }"
              >
                <input type="radio" v-model="chartType" :value="ct.value" />
                <span class="ct-icon">{{ ct.icon }}</span>
                <span class="ct-label">{{ ct.label }}</span>
              </label>
            </div>
          </div>
          <div>
            <label class="field-label">Largeur</label>
            <div class="width-opts">
              <label v-for="wo in WIDTH_OPTS" :key="wo.value" class="width-opt" :class="{ active: width === wo.value }">
                <input type="radio" v-model="width" :value="wo.value" />
                {{ wo.label }}
              </label>
            </div>
          </div>
        </section>

        <!-- SQL query -->
        <section class="section">
          <div class="query-header">
            <label class="field-label">Requête SQL</label>
            <div class="query-actions">
              <button class="schema-btn" @click="schemaOpen = !schemaOpen">
                {{ schemaOpen ? 'Masquer schéma' : 'Voir schéma' }}
              </button>
              <button class="run-btn" :disabled="runningQuery || !query.trim()" @click="runQuery">
                {{ runningQuery ? '…' : '▶ Exécuter' }}
              </button>
            </div>
          </div>
          <textarea v-model="query" class="query-editor" spellcheck="false" placeholder="SELECT category, COUNT(*) as total FROM products GROUP BY category" rows="6" />
          <p v-if="queryError" class="query-error">{{ queryError }}</p>

          <!-- Schema browser -->
          <div v-if="schemaOpen" class="schema-panel">
            <div v-for="tbl in schema" :key="tbl.name" class="schema-table">
              <div class="schema-table-name">{{ tbl.name }}</div>
              <div class="schema-cols">
                <span
                  v-for="col in tbl.columns"
                  :key="col.name"
                  class="schema-col"
                  :title="col.type"
                  @click="query += (query.trim() ? ', ' : 'SELECT ') + tbl.name + '.' + col.name"
                >{{ col.name }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Column mapping -->
        <section v-if="previewCols.length" class="section">
          <label class="field-label">Mapping des colonnes</label>

          <template v-if="chartType === 'bar' || chartType === 'line'">
            <div class="mapping-row">
              <span class="mapping-label">Axe X</span>
              <select v-model="configX" class="col-select">
                <option value="">— choisir —</option>
                <option v-for="c in previewCols" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="mapping-row">
              <span class="mapping-label">Axe Y (multiple)</span>
              <div class="multicol">
                <label v-for="c in previewCols" :key="c" class="multicol-opt">
                  <input type="checkbox" :value="c" v-model="configYCols" />
                  {{ c }}
                </label>
              </div>
            </div>
          </template>

          <template v-else-if="chartType === 'scatter'">
            <div class="mapping-row">
              <span class="mapping-label">Axe X</span>
              <select v-model="configX" class="col-select">
                <option value="">— choisir —</option>
                <option v-for="c in previewCols" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="mapping-row">
              <span class="mapping-label">Axe Y</span>
              <select v-model="configY" class="col-select">
                <option value="">— choisir —</option>
                <option v-for="c in previewCols" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
          </template>

          <template v-else-if="chartType === 'pie'">
            <div class="mapping-row">
              <span class="mapping-label">Étiquettes</span>
              <select v-model="configLabels" class="col-select">
                <option value="">— choisir —</option>
                <option v-for="c in previewCols" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="mapping-row">
              <span class="mapping-label">Valeurs</span>
              <select v-model="configValues" class="col-select">
                <option value="">— choisir —</option>
                <option v-for="c in previewCols" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
          </template>

          <p v-else-if="chartType === 'table'" class="mapping-note">
            Le tableau affiche toutes les colonnes retournées par la requête.
          </p>
        </section>

        <!-- Layout JSON -->
        <section class="section">
          <details class="layout-details">
            <summary class="field-label">Options Plotly avancées (JSON)</summary>
            <textarea v-model="layoutJson" class="json-editor" spellcheck="false" rows="5" placeholder='{"xaxis":{"title":"Catégorie"},"yaxis":{"title":"Total"}}' />
          </details>
        </section>
      </div>

      <!-- ── Right panel: preview ── -->
      <div class="preview-panel">
        <div class="preview-header">Aperçu</div>

        <div v-if="!showPreview" class="preview-hint">
          Exécutez la requête pour voir un aperçu du graphique.
        </div>

        <template v-else>
          <!-- Chart preview -->
          <div class="chart-wrap">
            <div v-if="!previewTraces.length" class="no-traces">
              Configurez le mapping des colonnes pour afficher le graphique.
            </div>
            <PlotlyChart v-else :traces="previewTraces" :layout="previewLayout" />
          </div>

          <!-- Raw data table -->
          <details class="raw-data" open>
            <summary>Données brutes ({{ previewRows.length }} lignes)</summary>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th v-for="c in previewCols" :key="c">{{ c }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in previewRows.slice(0, 50)" :key="i">
                    <td v-for="c in previewCols" :key="c">{{ row[c] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="previewRows.length > 50" class="row-limit">Affichage des 50 premières lignes.</p>
          </details>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 1.5rem; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }

/* Top bar */
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-shrink: 0; flex-wrap: wrap; gap: .5rem; }
.topbar-left  { display: flex; align-items: center; gap: .75rem; }
.topbar-right { display: flex; align-items: center; gap: .6rem; }
.topbar h1 { margin: 0; font-size: 1.3rem; color: #1a1a2e; }
.back-btn { padding: .35rem .75rem; border: 1px solid #ddd; border-radius: 7px; background: white; cursor: pointer; font-size: .82rem; color: #555; }
.back-btn:hover { border-color: #6c63ff; color: #6c63ff; }
.save-btn { padding: .4rem 1.1rem; background: #6c63ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: .875rem; font-weight: 600; }
.save-btn:disabled { opacity: .6; cursor: not-allowed; }
.save-error { font-size: .8rem; color: #ef4444; }

/* Two-column layout */
.layout { flex: 1; display: flex; gap: 1.25rem; min-height: 0; overflow: hidden; }
.form-panel    { width: 380px; flex-shrink: 0; overflow-y: auto; display: flex; flex-direction: column; gap: .75rem; }
.preview-panel { flex: 1; display: flex; flex-direction: column; gap: .75rem; min-height: 0; overflow: hidden; }

/* Sections */
.section { background: white; border: 1px solid #e8e8e8; border-radius: 12px; padding: .9rem 1rem; }
.row-section { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.field-label { display: block; font-size: .78rem; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: .04em; margin-bottom: .45rem; }

.text-input { width: 100%; padding: .4rem .6rem; border: 1px solid #ddd; border-radius: 7px; font-size: .875rem; box-sizing: border-box; }
.text-input:focus { outline: none; border-color: #6c63ff; }

/* Chart type grid */
.chart-type-grid { display: flex; flex-wrap: wrap; gap: .35rem; }
.ct-opt { display: flex; flex-direction: column; align-items: center; gap: .15rem; padding: .4rem .55rem; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: .72rem; color: #555; transition: background .12s; min-width: 54px; }
.ct-opt input { display: none; }
.ct-opt.active { border-color: #6c63ff; background: #f0f0ff; color: #6c63ff; font-weight: 600; }
.ct-icon { font-size: 1.1rem; }

/* Width opts */
.width-opts { display: flex; flex-direction: column; gap: .3rem; }
.width-opt { display: flex; align-items: center; gap: .4rem; font-size: .82rem; cursor: pointer; color: #444; padding: .2rem .3rem; border-radius: 5px; }
.width-opt input { display: none; }
.width-opt.active { color: #6c63ff; font-weight: 600; }
.width-opt::before { content: '○'; font-size: .8rem; }
.width-opt.active::before { content: '●'; }

/* Query editor */
.query-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .45rem; }
.query-actions { display: flex; gap: .4rem; }
.schema-btn { padding: .25rem .6rem; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-size: .75rem; color: #555; }
.schema-btn:hover { border-color: #6c63ff; color: #6c63ff; }
.run-btn { padding: .25rem .7rem; border: none; border-radius: 6px; background: #059669; color: white; cursor: pointer; font-size: .75rem; font-weight: 600; }
.run-btn:disabled { opacity: .5; cursor: not-allowed; }
.query-editor { width: 100%; font-family: 'Fira Code', monospace; font-size: .78rem; background: #1e1e2e; color: #cdd6f4; border: 1px solid #333; border-radius: 8px; padding: .75rem; resize: vertical; box-sizing: border-box; outline: none; line-height: 1.5; }
.query-editor:focus { border-color: #6c63ff; }
.query-error { color: #ef4444; font-size: .78rem; margin-top: .35rem; }

/* Schema browser */
.schema-panel { margin-top: .6rem; background: #f7f8ff; border: 1px solid #e8e8e8; border-radius: 8px; padding: .65rem; display: flex; flex-direction: column; gap: .5rem; max-height: 200px; overflow-y: auto; }
.schema-table-name { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6c63ff; margin-bottom: .25rem; }
.schema-cols { display: flex; flex-wrap: wrap; gap: .25rem; }
.schema-col { font-size: .7rem; font-family: monospace; background: white; border: 1px solid #d4d0ff; color: #444; border-radius: 4px; padding: .1rem .35rem; cursor: pointer; transition: background .1s; }
.schema-col:hover { background: #6c63ff; color: white; border-color: #6c63ff; }

/* Column mapping */
.mapping-row { display: flex; align-items: center; gap: .65rem; margin-bottom: .4rem; }
.mapping-label { font-size: .78rem; color: #666; width: 100px; flex-shrink: 0; }
.col-select { flex: 1; padding: .3rem .5rem; border: 1px solid #ddd; border-radius: 6px; font-size: .82rem; background: white; }
.multicol { display: flex; flex-wrap: wrap; gap: .35rem; flex: 1; }
.multicol-opt { display: flex; align-items: center; gap: .25rem; font-size: .78rem; cursor: pointer; }
.mapping-note { font-size: .8rem; color: #888; font-style: italic; }

/* Layout JSON */
.layout-details summary { cursor: pointer; font-size: .78rem; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: .04em; }
.json-editor { width: 100%; font-family: 'Fira Code', monospace; font-size: .75rem; background: #1e1e2e; color: #cdd6f4; border: 1px solid #333; border-radius: 8px; padding: .65rem; resize: vertical; box-sizing: border-box; outline: none; margin-top: .45rem; }

/* Preview panel */
.preview-header { font-size: .78rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .04em; flex-shrink: 0; }
.preview-hint { flex: 1; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: .9rem; background: white; border: 1px solid #e8e8e8; border-radius: 12px; }
.chart-wrap { background: white; border: 1px solid #e8e8e8; border-radius: 12px; height: 300px; overflow: hidden; flex-shrink: 0; padding: .5rem; box-sizing: border-box; }
.no-traces { height: 100%; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: .85rem; }

/* Raw data table */
.raw-data { background: white; border: 1px solid #e8e8e8; border-radius: 12px; overflow: hidden; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.raw-data summary { padding: .6rem 1rem; cursor: pointer; font-size: .8rem; font-weight: 600; color: #555; user-select: none; flex-shrink: 0; }
.raw-data summary:hover { background: #fafafa; }
.table-wrap { flex: 1; overflow: auto; min-height: 0; }
.data-table { width: 100%; border-collapse: collapse; font-size: .78rem; }
.data-table th { padding: .4rem .75rem; background: #f7f8ff; border-bottom: 1px solid #eee; text-align: left; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: #666; position: sticky; top: 0; }
.data-table td { padding: .35rem .75rem; border-bottom: 1px solid #f5f5f5; color: #333; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.row-limit { padding: .4rem 1rem; font-size: .75rem; color: #aaa; flex-shrink: 0; }
</style>
