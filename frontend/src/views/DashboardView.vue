<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useDashboardStore, buildTraces, type Widget } from '../stores/dashboard';
import PlotlyChart from '../components/PlotlyChart.vue';

const auth   = useAuthStore();
const store  = useDashboardStore();
const router = useRouter();

const isAdmin = computed(() => auth.user?.role === 'admin');
const base    = computed(() => `/accounts/${auth.user?.account_id}`);

interface WidgetState { rows: any[]; loading: boolean; error: string; }
const widgetState = reactive<Record<number, WidgetState>>({});

const loading = ref(true);

async function loadWidget(w: Widget) {
  widgetState[w.id] = { rows: [], loading: true, error: '' };
  try {
    const rows = await store.fetchWidgetData(w.id);
    widgetState[w.id] = { rows, loading: false, error: '' };
  } catch (e: any) {
    widgetState[w.id] = { rows: [], loading: false, error: e?.response?.data?.message ?? 'Erreur' };
  }
}

const traceMap = computed(() => {
  const map: Record<number, any[]> = {};
  for (const w of store.widgets) {
    map[w.id] = buildTraces(widgetState[w.id]?.rows ?? [], w.chart_type, w.config);
  }
  return map;
});

async function load() {
  loading.value = true;
  const widgets = await store.fetchWidgets();
  loading.value = false;
  widgets.forEach(loadWidget);
}

async function deleteWidget(w: Widget) {
  if (!confirm(`Supprimer le widget "${w.title}" ?`)) return;
  await store.deleteWidget(w.id);
}

async function move(w: Widget, dir: -1 | 1) {
  const sorted = [...store.widgets].sort((a, b) => a.position - b.position);
  const idx = sorted.findIndex(x => x.id === w.id);
  const other = sorted[idx + dir];
  if (!other) return;
  const positions = [
    { id: w.id,     position: other.position },
    { id: other.id, position: w.position },
  ];
  await store.savePositions(positions);
  w.position = other.position;
  other.position = w.position < other.position ? w.position : other.position;
  await store.fetchWidgets(); // re-fetch for correct order
}

function widgetSpan(width: string) {
  return width === 'full' ? 'span-full' : width === 'third' ? 'span-third' : 'span-half';
}

onMounted(load);
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Tableau de bord</h1>
      <button v-if="isAdmin && !auth.viewAsUser" class="add-btn" @click="router.push(`${base}/dashboard/new`)">
        + Nouveau widget
      </button>
    </header>

    <p v-if="loading" class="msg">Chargement…</p>

    <div v-else-if="store.widgets.length === 0" class="empty">
      <div class="empty-icon">📊</div>
      <p>Aucun widget pour l'instant.</p>
      <button v-if="isAdmin && !auth.viewAsUser" class="add-btn" @click="router.push(`${base}/dashboard/new`)">
        Créer le premier widget
      </button>
    </div>

    <div v-else class="grid">
      <div
        v-for="w in [...store.widgets].sort((a,b) => a.position - b.position)"
        :key="w.id"
        class="widget-card"
        :class="widgetSpan(w.width)"
      >
        <div class="widget-header">
          <span class="widget-title">{{ w.title }}</span>
          <div v-if="isAdmin && !auth.viewAsUser" class="widget-actions">
            <button class="act-btn" title="Monter" @click="move(w, -1)">↑</button>
            <button class="act-btn" title="Descendre" @click="move(w, 1)">↓</button>
            <button class="act-btn edit" title="Modifier" @click="router.push(`${base}/dashboard/${w.id}/edit`)">✎</button>
            <button class="act-btn del" title="Supprimer" @click="deleteWidget(w)">✕</button>
          </div>
        </div>

        <div class="widget-body">
          <div v-if="widgetState[w.id]?.loading" class="widget-loading">Chargement…</div>
          <div v-else-if="widgetState[w.id]?.error" class="widget-error">{{ widgetState[w.id].error }}</div>
          <div v-else-if="!traceMap[w.id]?.length" class="widget-empty">Aucune donnée — vérifiez la configuration.</div>
          <PlotlyChart v-else :traces="traceMap[w.id]" :layout="w.config.layout" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 1.5rem; min-height: 100%; box-sizing: border-box; }

.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.topbar h1 { margin: 0; font-size: 1.5rem; color: #1a1a2e; }

.add-btn { padding: .45rem 1.1rem; background: #6c63ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: .875rem; font-weight: 600; }
.add-btn:hover { background: #5a52d5; }

.msg { color: #888; }

.empty { text-align: center; padding: 4rem 2rem; color: #aaa; }
.empty-icon { font-size: 3rem; margin-bottom: .75rem; }
.empty p { margin-bottom: 1rem; font-size: 1rem; }

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1rem;
  align-items: start;
}
.span-full  { grid-column: span 6; }
.span-half  { grid-column: span 3; }
.span-third { grid-column: span 2; }

@media (max-width: 900px) {
  .span-half, .span-third { grid-column: span 6; }
}

/* Widget card */
.widget-card {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .65rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}
.widget-title { font-size: .875rem; font-weight: 700; color: #1a1a2e; }
.widget-actions { display: flex; gap: .25rem; }
.act-btn {
  padding: .2rem .4rem;
  border: 1px solid #e8e8e8;
  border-radius: 5px;
  background: white;
  cursor: pointer;
  font-size: .75rem;
  color: #555;
  transition: background .12s;
}
.act-btn:hover { background: #f0f0ff; border-color: #6c63ff; color: #6c63ff; }
.act-btn.edit:hover { background: #f0f0ff; }
.act-btn.del:hover  { background: #fee2e2; border-color: #ef4444; color: #ef4444; }

.widget-body { flex: 1; height: 280px; padding: .5rem; box-sizing: border-box; }
.span-full .widget-body { height: 320px; }

.widget-loading,
.widget-error,
.widget-empty { height: 100%; display: flex; align-items: center; justify-content: center; }
.widget-loading { color: #aaa; font-size: .85rem; }
.widget-error   { color: #ef4444; font-size: .82rem; text-align: center; padding: 1rem; }
.widget-empty   { color: #bbb; font-size: .82rem; text-align: center; }
</style>
