<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api';

interface AlertRule {
  id: number;
  name: string;
  query: string;
  operator: string;
  threshold: number;
  severity: 'info' | 'warning' | 'danger';
  message: string;
  active: number;
  created_at: string;
}

interface TriggeredAlert extends AlertRule { value: number; }

const OPERATORS = ['>', '<', '>=', '<=', '=', '!='];
const SEVERITIES = [
  { key: 'info',    label: 'Info',    color: '#3b82f6' },
  { key: 'warning', label: 'Attention', color: '#f59e0b' },
  { key: 'danger',  label: 'Critique', color: '#ef4444' },
];

function sevInfo(key: string) { return SEVERITIES.find(s => s.key === key) ?? SEVERITIES[1]; }

// ── State ──────────────────────────────────────────────────────────────────
const rules       = ref<AlertRule[]>([]);
const triggered   = ref<TriggeredAlert[]>([]);
const loading     = ref(true);
const evaluating  = ref(false);

// ── Modal ──────────────────────────────────────────────────────────────────
const showModal  = ref(false);
const editTarget = ref<AlertRule | null>(null);
const form = ref({ name: '', query: '', operator: '>', threshold: 0, severity: 'warning', message: '', active: true });
const saving     = ref(false);
const formError  = ref('');

function openCreate() {
  editTarget.value = null;
  form.value = { name: '', query: '', operator: '>', threshold: 0, severity: 'warning', message: '', active: true };
  formError.value = '';
  showModal.value = true;
}

function openEdit(r: AlertRule) {
  editTarget.value = r;
  form.value = { name: r.name, query: r.query, operator: r.operator, threshold: r.threshold,
                 severity: r.severity, message: r.message, active: !!r.active };
  formError.value = '';
  showModal.value = true;
}

function closeModal() { showModal.value = false; }

async function saveRule() {
  if (!form.value.name || !form.value.query) { formError.value = 'Nom et requête requis.'; return; }
  saving.value = true;
  formError.value = '';
  try {
    const payload = { ...form.value, active: form.value.active ? 1 : 0 };
    if (editTarget.value) {
      await api.put(`/alerts/${editTarget.value.id}`, payload);
    } else {
      await api.post('/alerts', payload);
    }
    closeModal();
    await load();
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur lors de la sauvegarde.';
  } finally {
    saving.value = false;
  }
}

async function toggleActive(r: AlertRule) {
  await api.put(`/alerts/${r.id}`, { active: r.active ? 0 : 1 });
  await load();
}

async function del(r: AlertRule) {
  if (!confirm(`Supprimer l'alerte "${r.name}" ?`)) return;
  await api.delete(`/alerts/${r.id}`);
  await load();
}

async function evaluate() {
  evaluating.value = true;
  try {
    const { data } = await api.get('/alerts/evaluate');
    triggered.value = data;
  } finally {
    evaluating.value = false;
  }
}

async function load() {
  loading.value = true;
  const [rulesRes] = await Promise.all([api.get('/alerts'), evaluate()]);
  rules.value = rulesRes.data;
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Alertes</h1>
      <div class="topbar-actions">
        <button class="refresh-btn" :disabled="evaluating" @click="evaluate">
          {{ evaluating ? '…' : '↺ Évaluer' }}
        </button>
        <button class="create-btn" @click="openCreate">+ Nouvelle alerte</button>
      </div>
    </header>

    <!-- Triggered alerts -->
    <section class="section">
      <p class="section-title">État actuel</p>

      <div v-if="evaluating" class="msg">Évaluation en cours…</div>

      <div v-else-if="triggered.length === 0" class="all-ok">
        <span class="ok-icon">✅</span>
        <span>Toutes les conditions sont normales.</span>
      </div>

      <div v-else class="triggered-list">
        <div v-for="t in triggered" :key="t.id" class="alert-card" :class="t.severity">
          <div class="alert-left">
            <span class="sev-dot" :style="{ background: sevInfo(t.severity).color }" />
            <div>
              <p class="alert-name">{{ t.name }}</p>
              <p class="alert-msg">{{ t.message || `Valeur actuelle : ${t.value} ${t.operator} ${t.threshold}` }}</p>
            </div>
          </div>
          <span class="alert-value" :style="{ color: sevInfo(t.severity).color }">{{ t.value }}</span>
        </div>
      </div>
    </section>

    <!-- Rules management -->
    <section class="section">
      <p class="section-title">Règles d'alerte</p>

      <p v-if="loading" class="msg">Chargement…</p>

      <div v-else-if="rules.length === 0" class="empty">
        Aucune règle définie. Créez-en une pour commencer.
      </div>

      <div v-else class="rules-table-wrap">
        <table class="rules-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Requête</th>
              <th>Condition</th>
              <th>Gravité</th>
              <th>Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rules" :key="r.id">
              <td class="name-cell">{{ r.name }}</td>
              <td class="query-cell"><code>{{ r.query }}</code></td>
              <td class="cond-cell">
                <span class="cond-badge">valeur {{ r.operator }} {{ r.threshold }}</span>
              </td>
              <td>
                <span class="sev-badge" :style="{ background: sevInfo(r.severity).color + '20', color: sevInfo(r.severity).color }">
                  {{ sevInfo(r.severity).label }}
                </span>
              </td>
              <td>
                <button class="toggle-btn" :class="{ on: r.active }" @click="toggleActive(r)">
                  {{ r.active ? 'Oui' : 'Non' }}
                </button>
              </td>
              <td class="actions-cell">
                <button class="edit-btn" @click="openEdit(r)">✏️</button>
                <button class="del-btn" @click="del(r)">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Modal -->
    <Transition name="lb">
      <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
        <div class="modal">
          <div class="modal-header">
            <span>{{ editTarget ? 'Modifier l\'alerte' : 'Nouvelle alerte' }}</span>
            <button class="modal-close" @click="closeModal">✕</button>
          </div>

          <div class="modal-body">
            <label class="field-label">Nom</label>
            <input v-model="form.name" class="field-input" placeholder="Stock bas articles" />

            <label class="field-label">Requête SQL <span class="hint">(doit retourner une valeur numérique)</span></label>
            <textarea v-model="form.query" class="field-input field-code" rows="3"
              placeholder="SELECT COUNT(*) FROM products WHERE stock = 0" />

            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Opérateur</label>
                <select v-model="form.operator" class="field-input">
                  <option v-for="op in OPERATORS" :key="op" :value="op">{{ op }}</option>
                </select>
              </div>
              <div class="field-group">
                <label class="field-label">Seuil</label>
                <input v-model.number="form.threshold" type="number" class="field-input" />
              </div>
              <div class="field-group">
                <label class="field-label">Gravité</label>
                <select v-model="form.severity" class="field-input">
                  <option v-for="s in SEVERITIES" :key="s.key" :value="s.key">{{ s.label }}</option>
                </select>
              </div>
            </div>

            <label class="field-label">Message <span class="hint">(optionnel)</span></label>
            <input v-model="form.message" class="field-input" placeholder="Des articles sont en rupture de stock" />

            <label class="field-label toggle-label">
              <input type="checkbox" v-model="form.active" />
              Alerte active
            </label>

            <p v-if="formError" class="form-error">{{ formError }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="closeModal">Annuler</button>
            <button class="btn-save" :disabled="saving" @click="saveRule">
              {{ saving ? '…' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page { padding: 1.5rem; }

.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; }
.topbar h1 { margin: 0; font-size: 1.5rem; color: #1a1a2e; }
.topbar-actions { display: flex; gap: .6rem; }

.refresh-btn { padding: .42rem .9rem; border: 1.5px solid #e0e0e0; border-radius: 8px; background: white; font-size: .82rem; cursor: pointer; color: #555; }
.refresh-btn:hover:not(:disabled) { border-color: #6c63ff; color: #6c63ff; }
.refresh-btn:disabled { opacity: .5; cursor: not-allowed; }

.create-btn { padding: .42rem 1rem; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: .82rem; font-weight: 600; cursor: pointer; }
.create-btn:hover { opacity: .88; }

.section { margin-bottom: 1.75rem; }
.section-title { margin: 0 0 .75rem; font-size: .72rem; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .06em; }

.msg { color: #aaa; font-size: .875rem; }

.all-ok { display: flex; align-items: center; gap: .5rem; padding: .9rem 1.1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; color: #166534; font-size: .875rem; }
.ok-icon { font-size: 1.1rem; }

.triggered-list { display: flex; flex-direction: column; gap: .6rem; }

.alert-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: .85rem 1.1rem; border-radius: 10px; border: 1.5px solid;
}
.alert-card.info    { background: #eff6ff; border-color: #bfdbfe; }
.alert-card.warning { background: #fffbeb; border-color: #fde68a; }
.alert-card.danger  { background: #fef2f2; border-color: #fecaca; }

.alert-left { display: flex; align-items: flex-start; gap: .75rem; }
.sev-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: .3rem; }
.alert-name { margin: 0 0 .2rem; font-weight: 600; font-size: .9rem; color: #1a1a2e; }
.alert-msg  { margin: 0; font-size: .8rem; color: #555; }
.alert-value { font-size: 1.4rem; font-weight: 700; }

.empty { color: #aaa; font-size: .875rem; padding: 1rem 0; }

.rules-table-wrap { background: white; border: 1px solid #e8e8e8; border-radius: 12px; overflow: clip; }
.rules-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.rules-table thead tr { background: #fafafa; }
.rules-table th { padding: .65rem 1rem; text-align: left; font-size: .72rem; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #f0f0f0; }
.rules-table td { padding: .7rem 1rem; border-bottom: 1px solid #f7f7f7; vertical-align: middle; }
.rules-table tbody tr:last-child td { border-bottom: none; }
.rules-table tbody tr:hover { background: #fafafa; }

.name-cell { font-weight: 600; color: #1a1a2e; white-space: nowrap; }
.query-cell { max-width: 320px; }
.query-cell code { font-size: .75rem; color: #555; word-break: break-all; white-space: pre-wrap; }
.cond-cell { white-space: nowrap; }
.cond-badge { background: #f4f4f5; border-radius: 6px; padding: .18rem .5rem; font-size: .75rem; color: #555; }

.sev-badge { padding: .2rem .55rem; border-radius: 20px; font-size: .75rem; font-weight: 600; }

.toggle-btn { padding: .2rem .55rem; border-radius: 6px; border: 1.5px solid #e0e0e0; background: white; font-size: .75rem; cursor: pointer; color: #aaa; }
.toggle-btn.on { border-color: #6c63ff; color: #6c63ff; background: #f0eeff; }

.actions-cell { display: flex; gap: .35rem; white-space: nowrap; }
.edit-btn { padding: .2rem .4rem; border: 1px solid #e8e8e8; border-radius: 5px; background: white; cursor: pointer; font-size: .8rem; }
.edit-btn:hover { border-color: #6c63ff; }
.del-btn { padding: .2rem .4rem; border: 1px solid #e8e8e8; border-radius: 5px; background: white; cursor: pointer; font-size: .75rem; color: #aaa; }
.del-btn:hover { background: #fee2e2; border-color: #ef4444; color: #ef4444; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.modal { background: white; border-radius: 14px; width: min(560px, 96vw); max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.25); }

.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #f0f0f0; font-weight: 600; font-size: .95rem; color: #1a1a2e; flex-shrink: 0; }
.modal-close { background: none; border: none; font-size: 1rem; cursor: pointer; color: #aaa; padding: .2rem .4rem; border-radius: 4px; }
.modal-close:hover { background: #f0f0f0; }

.modal-body { padding: 1.1rem 1.25rem; overflow-y: auto; display: flex; flex-direction: column; gap: .7rem; }

.field-label { font-size: .78rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .04em; }
.field-label .hint { font-weight: 400; text-transform: none; color: #bbb; letter-spacing: 0; }
.field-input { width: 100%; box-sizing: border-box; padding: .5rem .75rem; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: .875rem; outline: none; transition: border-color .15s; }
.field-input:focus { border-color: #6c63ff; }
.field-code { font-family: monospace; font-size: .82rem; resize: vertical; }
.field-row { display: flex; gap: .6rem; }
.field-group { flex: 1; display: flex; flex-direction: column; gap: .3rem; }

.toggle-label { display: flex; align-items: center; gap: .5rem; font-size: .875rem; font-weight: 500; color: #444; text-transform: none; letter-spacing: 0; cursor: pointer; }

.form-error { margin: 0; font-size: .82rem; color: #ef4444; }

.modal-footer { display: flex; justify-content: flex-end; gap: .6rem; padding: .9rem 1.25rem; border-top: 1px solid #f0f0f0; flex-shrink: 0; }
.btn-cancel { padding: .5rem 1rem; background: transparent; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: .875rem; color: #555; }
.btn-cancel:hover { border-color: #aaa; }
.btn-save { padding: .5rem 1.3rem; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: .875rem; font-weight: 600; cursor: pointer; }
.btn-save:hover:not(:disabled) { opacity: .88; }
.btn-save:disabled { opacity: .55; cursor: not-allowed; }

.lb-enter-active, .lb-leave-active { transition: opacity .18s; }
.lb-enter-from, .lb-leave-to { opacity: 0; }
</style>
