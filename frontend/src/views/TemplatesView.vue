<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useTemplatesStore, type Template } from '../stores/templates';
import { useInvoicesStore } from '../stores/invoices';
import { useClientsStore } from '../stores/clients';
import { useSuppliersStore } from '../stores/suppliers';
import { useCurrency } from '../composables/useCurrency';
import { renderInvoiceHtml } from '../composables/useInvoicePdf';

const auth = useAuthStore();
const store = useTemplatesStore();
const invoicesStore = useInvoicesStore();
const clientsStore = useClientsStore();
const suppliersStore = useSuppliersStore();
const { formatPrice } = useCurrency();

const loading = ref(false);
const error = ref('');

const selectedId = ref<number | null>(null);
const editName = ref('');
const editType = ref<'client' | 'supplier' | 'both'>('both');
const editHtml = ref('');
const originalName = ref('');
const originalType = ref('');
const originalHtml = ref('');

const saving = ref(false);
const saved = ref(false);
const showPreview = ref(false);

const creating = ref(false);
const newName = ref('');
const newType = ref<'client' | 'supplier' | 'both'>('both');

const isDirty = computed(() =>
  editHtml.value !== originalHtml.value ||
  editName.value !== originalName.value ||
  editType.value !== originalType.value,
);

const selectedTemplate = computed(() => store.templates.find(t => t.id === selectedId.value));

const variables = [
  { v: '{{account_name}}',         d: 'Nom de votre compte' },
  { v: '{{invoice_reference}}',    d: 'Numéro de facture' },
  { v: '{{invoice_date}}',         d: 'Date de facturation' },
  { v: '{{invoice_due_date}}',     d: "Date d'échéance" },
  { v: '{{invoice_status}}',       d: 'Code statut (draft, sent, paid, cancelled)' },
  { v: '{{invoice_status_label}}', d: 'Libellé du statut' },
  { v: '{{entity_type_label}}',    d: 'Client ou Fournisseur' },
  { v: '{{entity_name}}',          d: "Nom du client / fournisseur" },
  { v: '{{entity_email}}',         d: 'Email' },
  { v: '{{entity_phone}}',         d: 'Téléphone' },
  { v: '{{entity_address}}',       d: 'Adresse' },
  { v: '{{lines_table}}',          d: 'Tableau des lignes (HTML généré)' },
  { v: '{{subtotal}}',             d: 'Total formaté avec devise' },
  { v: '{{notes}}',                d: 'Notes de la facture' },
  { v: '{{notes_section}}',        d: 'Bloc notes complet (vide si pas de notes)' },
];

const previewHtml = computed(() => {
  const inv = invoicesStore.invoices[0];
  if (!inv) return (editHtml.value ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => `[${k}]`);
  const entity =
    inv.type === 'client'
      ? clientsStore.clients.find(c => c.id === inv.client_id)
      : suppliersStore.suppliers.find(s => s.id === inv.supplier_id);
  return renderInvoiceHtml(editHtml.value, inv, entity, auth.account?.name ?? 'Mon Compte', formatPrice);
});

function selectTemplate(tmpl: Template) {
  selectedId.value = tmpl.id;
  editName.value = tmpl.name;
  editType.value = tmpl.type;
  editHtml.value = tmpl.html ?? '';
  originalName.value = tmpl.name;
  originalType.value = tmpl.type;
  originalHtml.value = tmpl.html ?? '';
  showPreview.value = false;
  saved.value = false;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const list = await store.fetchTemplates();
    if (list.length > 0 && !selectedId.value) selectTemplate(list[0]);
  } catch {
    error.value = 'Impossible de charger les modèles.';
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!selectedId.value) return;
  saving.value = true;
  error.value = '';
  try {
    const updated = await store.updateTemplate(selectedId.value, {
      name: editName.value,
      type: editType.value,
      html: editHtml.value,
    });
    originalName.value = updated.name;
    originalType.value = updated.type;
    originalHtml.value = updated.html;
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } catch {
    error.value = 'Erreur lors de la sauvegarde.';
  } finally {
    saving.value = false;
  }
}

async function setDefaultClient() {
  if (!selectedId.value) return;
  try { await store.setDefault(selectedId.value, 'client'); }
  catch { error.value = 'Erreur.'; }
}

async function setDefaultSupplier() {
  if (!selectedId.value) return;
  try { await store.setDefault(selectedId.value, 'supplier'); }
  catch { error.value = 'Erreur.'; }
}

async function deleteSelected() {
  if (!selectedId.value) return;
  const name = store.templates.find(t => t.id === selectedId.value)?.name ?? '';
  if (!confirm(`Supprimer le modèle "${name}" ?`)) return;
  try {
    await store.deleteTemplate(selectedId.value);
    selectedId.value = null;
    if (store.templates.length > 0) selectTemplate(store.templates[0]);
  } catch {
    error.value = 'Erreur lors de la suppression.';
  }
}

async function createNew() {
  if (!newName.value.trim()) return;
  try {
    const tmpl = await store.createTemplate(newName.value.trim(), newType.value, '');
    creating.value = false;
    newName.value = '';
    newType.value = 'both';
    selectTemplate(tmpl);
  } catch {
    error.value = 'Erreur lors de la création.';
  }
}

function insertVar(v: string) {
  const ta = document.getElementById('template-editor') as HTMLTextAreaElement | null;
  if (!ta) { editHtml.value += v; return; }
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  editHtml.value = editHtml.value.slice(0, start) + v + editHtml.value.slice(end);
  setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + v.length; ta.focus(); }, 0);
}

onMounted(() => {
  load();
  invoicesStore.fetchInvoices();
  clientsStore.fetchClients();
  suppliersStore.fetchSuppliers();
});
</script>

<template>
  <div class="page">
    <div class="layout">
      <!-- Left sidebar: template list -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>Modèles</h2>
          <button class="add-btn" @click="creating = !creating" title="Nouveau modèle">+</button>
        </div>

        <div v-if="creating" class="new-form">
          <input
            v-model="newName"
            class="new-input"
            placeholder="Nom du modèle"
            @keydown.enter="createNew"
            @keydown.escape="creating = false"
            autofocus
          />
          <select v-model="newType" class="new-select">
            <option value="both">Les deux</option>
            <option value="client">Client</option>
            <option value="supplier">Fournisseur</option>
          </select>
          <div class="new-actions">
            <button class="new-cancel" @click="creating = false">Annuler</button>
            <button class="new-confirm" :disabled="!newName.trim()" @click="createNew">Créer</button>
          </div>
        </div>

        <p v-if="loading" class="sidebar-msg">Chargement…</p>
        <p v-else-if="store.templates.length === 0" class="sidebar-msg">Aucun modèle</p>

        <div
          v-for="tmpl in store.templates"
          :key="tmpl.id"
          class="tmpl-item"
          :class="{ active: tmpl.id === selectedId }"
          @click="selectTemplate(tmpl)"
        >
          <div class="tmpl-name">{{ tmpl.name }}</div>
          <div class="tmpl-badges">
            <span class="badge" :class="`badge-${tmpl.type}`">
              {{ tmpl.type === 'client' ? 'Client' : tmpl.type === 'supplier' ? 'Fourn.' : 'Les deux' }}
            </span>
            <span v-if="tmpl.is_default_client" class="badge badge-def-c" title="Défaut client">★ C</span>
            <span v-if="tmpl.is_default_supplier" class="badge badge-def-s" title="Défaut fournisseur">★ F</span>
          </div>
        </div>
      </aside>

      <!-- Right: editor -->
      <div class="editor-area">
        <div v-if="!selectedId" class="no-selection">
          <p>Sélectionnez un modèle ou créez-en un nouveau.</p>
        </div>

        <template v-else>
          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="topbar">
            <div class="topbar-left">
              <input v-model="editName" class="name-input" placeholder="Nom du modèle" />
              <select v-model="editType" class="type-select">
                <option value="both">Les deux</option>
                <option value="client">Client</option>
                <option value="supplier">Fournisseur</option>
              </select>
              <span v-if="isDirty" class="dirty-badge">Modifié</span>
            </div>
            <div class="topbar-right">
              <button
                class="def-btn"
                :class="{ active: selectedTemplate?.is_default_client }"
                title="Définir comme modèle par défaut pour les factures clients"
                @click="setDefaultClient"
              >★ Défaut client</button>
              <button
                class="def-btn"
                :class="{ active: selectedTemplate?.is_default_supplier }"
                title="Définir comme modèle par défaut pour les factures fournisseurs"
                @click="setDefaultSupplier"
              >★ Défaut fourn.</button>
              <button class="preview-btn" :class="{ active: showPreview }" @click="showPreview = !showPreview">
                {{ showPreview ? 'Masquer' : 'Aperçu' }}
              </button>
              <button class="delete-btn" @click="deleteSelected">Supprimer</button>
              <button class="save-btn" :disabled="saving || !isDirty" @click="save">
                {{ saving ? '…' : saved ? '✓ Sauvegardé' : 'Enregistrer' }}
              </button>
            </div>
          </div>

          <div class="editor-layout" :class="{ split: showPreview }">
            <div class="editor-panel">
              <div class="vars-bar">
                <span class="vars-label">Insérer :</span>
                <button
                  v-for="v in variables"
                  :key="v.v"
                  class="var-chip"
                  :title="v.d"
                  @click="insertVar(v.v)"
                >{{ v.v }}</button>
              </div>

              <textarea
                id="template-editor"
                v-model="editHtml"
                class="editor"
                spellcheck="false"
                placeholder="HTML du modèle de facture…"
              />

              <details class="vars-ref">
                <summary>Référence des variables</summary>
                <table class="vars-table">
                  <thead><tr><th>Variable</th><th>Description</th></tr></thead>
                  <tbody>
                    <tr v-for="v in variables" :key="v.v">
                      <td><code>{{ v.v }}</code></td>
                      <td>{{ v.d }}</td>
                    </tr>
                  </tbody>
                </table>
              </details>
            </div>

            <div v-if="showPreview" class="preview-panel">
              <div class="preview-label">
                Aperçu <span class="preview-hint">(première facture disponible)</span>
              </div>
              <iframe :srcdoc="previewHtml" class="preview-frame" sandbox="allow-same-origin" />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 1.5rem; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }
.layout { flex: 1; display: flex; gap: 1rem; min-height: 0; }

/* Sidebar */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .85rem 1rem;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  background: white;
  z-index: 1;
}
.sidebar-header h2 { margin: 0; font-size: 1rem; color: #1a1a2e; font-weight: 700; }
.add-btn {
  width: 28px; height: 28px; border-radius: 50%;
  background: #6c63ff; color: white; border: none;
  font-size: 1.3rem; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.add-btn:hover { background: #5a52d5; }

/* New template form */
.new-form { padding: .75rem; border-bottom: 1px solid #eee; display: flex; flex-direction: column; gap: .4rem; }
.new-input { padding: .4rem .6rem; border: 1px solid #ddd; border-radius: 6px; font-size: .85rem; }
.new-input:focus { outline: none; border-color: #6c63ff; }
.new-select { padding: .35rem .6rem; border: 1px solid #ddd; border-radius: 6px; font-size: .82rem; background: white; }
.new-actions { display: flex; gap: .4rem; justify-content: flex-end; }
.new-cancel { padding: .3rem .7rem; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-size: .8rem; }
.new-confirm { padding: .3rem .7rem; border: none; border-radius: 6px; background: #6c63ff; color: white; cursor: pointer; font-size: .8rem; font-weight: 600; }
.new-confirm:disabled { opacity: .5; cursor: not-allowed; }

.sidebar-msg { padding: 1rem; font-size: .85rem; color: #aaa; }

/* Template list items */
.tmpl-item { padding: .65rem 1rem; cursor: pointer; border-bottom: 1px solid #f5f5f5; transition: background .12s; }
.tmpl-item:hover { background: #fafafa; }
.tmpl-item.active { background: #f0f0ff; }
.tmpl-name { font-size: .875rem; font-weight: 600; color: #1a1a2e; margin-bottom: .3rem; }
.tmpl-badges { display: flex; flex-wrap: wrap; gap: .25rem; }

.badge { font-size: .68rem; padding: .1rem .4rem; border-radius: 4px; font-weight: 600; }
.badge-client   { background: #dbeafe; color: #1d4ed8; }
.badge-supplier { background: #fce7f3; color: #9d174d; }
.badge-both     { background: #f3f4f6; color: #374151; }
.badge-def-c    { background: #d1fae5; color: #065f46; }
.badge-def-s    { background: #ede9fe; color: #5b21b6; }

/* Editor area */
.editor-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
.no-selection { flex: 1; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: .95rem; }

/* Top bar */
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem; flex-wrap: wrap; gap: .5rem; flex-shrink: 0; }
.topbar-left  { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.topbar-right { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }

.name-input { padding: .35rem .6rem; border: 1px solid #ddd; border-radius: 7px; font-size: .9rem; font-weight: 600; color: #1a1a2e; min-width: 180px; }
.name-input:focus { outline: none; border-color: #6c63ff; }
.type-select { padding: .32rem .55rem; border: 1px solid #ddd; border-radius: 7px; font-size: .82rem; background: white; }
.dirty-badge { font-size: .72rem; background: #fef9c3; color: #854d0e; border: 1px solid #fde68a; padding: .15rem .5rem; border-radius: 20px; font-weight: 600; }

.def-btn { padding: .35rem .7rem; border: 1px solid #d4d0ff; border-radius: 7px; background: white; color: #6c63ff; cursor: pointer; font-size: .78rem; font-weight: 600; transition: background .12s; }
.def-btn:hover { background: #f0f0ff; }
.def-btn.active { background: #6c63ff; color: white; border-color: #6c63ff; }
.preview-btn { padding: .35rem .75rem; border: 1px solid #ddd; border-radius: 7px; background: white; cursor: pointer; font-size: .82rem; transition: background .12s; }
.preview-btn:hover, .preview-btn.active { background: #f0f0ff; border-color: #6c63ff; color: #6c63ff; }
.delete-btn { padding: .35rem .7rem; border: 1px solid #fca5a5; border-radius: 7px; background: white; color: #ef4444; cursor: pointer; font-size: .82rem; transition: background .12s; }
.delete-btn:hover { background: #fee2e2; }
.save-btn { padding: .35rem .85rem; background: #6c63ff; color: white; border: none; border-radius: 7px; cursor: pointer; font-size: .82rem; font-weight: 600; }
.save-btn:disabled { opacity: .5; cursor: not-allowed; }

.error-msg { color: #ef4444; margin-bottom: .5rem; font-size: .85rem; }

/* Editor layout */
.editor-layout { flex: 1; display: flex; gap: 1rem; min-height: 0; overflow: hidden; }
.editor-panel  { flex: 1; display: flex; flex-direction: column; gap: .5rem; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.editor-layout.split .editor-panel { flex: 1; }

/* Variable chips */
.vars-bar { flex-shrink: 0; display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; background: white; border: 1px solid #e8e8e8; border-radius: 8px; padding: .5rem .7rem; }
.vars-label { font-size: .75rem; color: #aaa; margin-right: .2rem; white-space: nowrap; }
.var-chip { padding: .18rem .45rem; font-size: .72rem; font-family: monospace; background: #f0f0ff; border: 1px solid #d4d0ff; color: #6c63ff; border-radius: 5px; cursor: pointer; white-space: nowrap; transition: background .12s; }
.var-chip:hover { background: #6c63ff; color: white; border-color: #6c63ff; }

/* HTML textarea */
.editor {
  flex: 1;
  width: 100%;
  min-height: 240px;
  font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: .82rem;
  line-height: 1.6;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 1rem;
  resize: none;
  background: #1e1e2e;
  color: #cdd6f4;
  box-sizing: border-box;
  outline: none;
  tab-size: 2;
}
.editor:focus { border-color: #6c63ff; }

/* Variables reference */
.vars-ref { background: white; border: 1px solid #eee; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
.vars-ref summary { padding: .6rem 1rem; cursor: pointer; font-size: .82rem; font-weight: 600; color: #555; user-select: none; }
.vars-ref summary:hover { background: #fafafa; }
.vars-table { width: 100%; border-collapse: collapse; font-size: .8rem; }
.vars-table th { padding: .45rem 1rem; text-align: left; background: #f7f8ff; color: #666; font-weight: 600; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #eee; }
.vars-table td { padding: .4rem 1rem; border-bottom: 1px solid #f5f5f5; color: #444; }
.vars-table tr:last-child td { border-bottom: none; }
.vars-table code { font-size: .78rem; background: #f0f0ff; color: #6c63ff; padding: .1rem .35rem; border-radius: 4px; }

/* Preview */
.preview-panel { flex: 1; display: flex; flex-direction: column; gap: .5rem; min-height: 0; overflow: hidden; }
.preview-label { font-size: .8rem; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: .04em; flex-shrink: 0; }
.preview-hint  { font-weight: 400; font-size: .72rem; text-transform: none; letter-spacing: 0; }
.preview-frame { flex: 1; border: 1px solid #ddd; border-radius: 10px; background: white; min-height: 0; }
</style>
