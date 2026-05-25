<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useInvoicesStore, type Invoice, type InvoiceLine } from '../stores/invoices';
import { useClientsStore } from '../stores/clients';
import { useSuppliersStore } from '../stores/suppliers';
import { useTemplatesStore } from '../stores/templates';
import { useCurrency } from '../composables/useCurrency';
import { renderInvoiceHtml, printHtml } from '../composables/useInvoicePdf';
import DataGrid, { type GridColumn } from '../components/DataGrid.vue';
import api from '../api';
import { usePhotoInboxStore, type InboxPhoto } from '../stores/photoInbox';

const auth = useAuthStore();
const store = useInvoicesStore();
const clientsStore = useClientsStore();
const suppliersStore = useSuppliersStore();
const templatesStore = useTemplatesStore();
const { formatPrice } = useCurrency();

// ── PDF download ──────────────────────────────────────
const downloadingId = ref<number | null>(null);

async function downloadPdf(inv: Invoice) {
  downloadingId.value = inv.id;
  try {
    const [full, tmpl] = await Promise.all([
      store.fetchInvoice(inv.id),
      templatesStore.fetchDefaultTemplate(inv.type),
    ]);
    const entity =
      full.type === 'client'
        ? clientsStore.clients.find(c => c.id === full.client_id)
        : suppliersStore.suppliers.find(s => s.id === full.supplier_id);
    const rendered = renderInvoiceHtml(tmpl.html, full, entity, auth.account?.name ?? '', formatPrice);
    printHtml(rendered, full.reference);
  } finally {
    downloadingId.value = null;
  }
}

const isAdmin = computed(() => auth.user?.role === 'admin');

// ── Type filter ───────────────────────────────────────
const typeFilter = ref<'all' | 'client' | 'supplier'>('all');
watch(typeFilter, () => store.fetchInvoices(typeFilter.value === 'all' ? undefined : typeFilter.value));

// ── Grid columns ──────────────────────────────────────
const columns: GridColumn[] = [
  { key: 'reference', label: 'Référence', width: '150px' },
  { key: 'type', label: 'Type', width: '110px' },
  { key: 'entity_name', label: 'Client / Fournisseur', width: '180px' },
  { key: 'date', label: 'Date', width: '100px' },
  { key: 'due_date', label: 'Échéance', width: '100px' },
  { key: 'status', label: 'Statut', width: '110px' },
  { key: 'total', label: 'Total', type: 'currency', width: '120px' },
];

async function onDelete(ids: number[]) {
  if (!confirm(`Supprimer ${ids.length} facture${ids.length > 1 ? 's' : ''} ?`)) return;
  await Promise.all(ids.map(id => store.deleteInvoice(id)));
}

// ── Invoice modal ─────────────────────────────────────
const showModal = ref(false);
const modalLoading = ref(false);
const modalError = ref('');
const isNew = ref(true);

interface FormState {
  id: number | null;
  type: 'client' | 'supplier';
  reference: string;
  client_id: number | null;
  supplier_id: number | null;
  date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  notes: string;
  lines: InvoiceLine[];
}

function today() { return new Date().toISOString().slice(0, 10); }
function blankForm(): FormState {
  return { id: null, type: 'client', reference: '', client_id: null, supplier_id: null, date: today(), due_date: '', status: 'draft', notes: '', lines: [] };
}

const form = ref<FormState>(blankForm());

function addLine() {
  form.value.lines.push({ description: '', quantity: 1, unit_price: 0 });
}
function removeLine(i: number) { form.value.lines.splice(i, 1); }

// ── Image scan ────────────────────────────────────────
const scanInput = ref<HTMLInputElement | null>(null);
const scanning = ref(false);
const scanError = ref('');

// ── OpenCV object detection ───────────────────────────
interface DetectedProduct { id: number; name: string; code: string; category: string; sale_price: number; matches: number; confidence: number; }
const detectInput = ref<HTMLInputElement | null>(null);
const detecting = ref(false);
const detectError = ref('');
const detectResults = ref<DetectedProduct[]>([]);
const detectSelected = ref<Set<number>>(new Set());
const showDetectModal = ref(false);

function triggerDetect() { detectError.value = ''; detectInput.value?.click(); }

async function onDetectFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (detectInput.value) detectInput.value.value = '';
  detecting.value = true;
  detectError.value = '';
  try {
    const fd = new FormData();
    fd.append('image', file);
    const { data } = await api.post('/detect', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (!data.detected?.length) {
      detectError.value = 'Aucun produit reconnu dans l\'image.';
    } else {
      detectResults.value = data.detected;
      detectSelected.value = new Set(data.detected.map((p: DetectedProduct) => p.id));
      showDetectModal.value = true;
    }
  } catch (err: any) {
    detectError.value = err.response?.data?.message ?? 'Erreur lors de la détection.';
  } finally {
    detecting.value = false;
  }
}

function toggleDetectProduct(id: number) {
  if (detectSelected.value.has(id)) detectSelected.value.delete(id);
  else detectSelected.value.add(id);
}

function confirmDetected() {
  const toAdd = detectResults.value.filter(p => detectSelected.value.has(p.id));
  const newLines = toAdd.map(p => ({ description: p.name + (p.code ? ` (${p.code})` : ''), quantity: 1, unit_price: p.sale_price ?? 0 }));
  if (form.value.lines.length === 1 && !form.value.lines[0].description && !form.value.lines[0].unit_price) {
    form.value.lines = newLines;
  } else {
    form.value.lines.push(...newLines);
  }
  showDetectModal.value = false;
  detectResults.value = [];
}

// ── Photo inbox (from mobile camera screen) ───────────────────────────────────
const inbox            = usePhotoInboxStore();
const pendingPhotos    = computed(() => inbox.photos);
const mobilePhotoAlert = ref<InboxPhoto | null>(null);

// When a photo arrives while the invoice modal is open → show inline banner
watch(pendingPhotos, (photos) => {
  if (showModal.value && photos.length > 0) {
    mobilePhotoAlert.value = photos[photos.length - 1];
  }
}, { deep: true });

async function usePhotoFromMobile(photo: InboxPhoto) {
  inbox.dismiss(photo.id);
  mobilePhotoAlert.value = null;
  detecting.value  = true;
  detectError.value = '';
  try {
    // Convert data-URL to Blob for multipart upload
    const res   = await fetch(photo.dataUrl);
    const blob  = await res.blob();
    const fd    = new FormData();
    fd.append('image', blob, 'mobile.jpg');
    const { data } = await api.post('/detect', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (!data.detected?.length) {
      detectError.value = 'Aucun produit reconnu dans la photo mobile.';
    } else {
      detectResults.value  = data.detected;
      detectSelected.value = new Set(data.detected.map((p: DetectedProduct) => p.id));
      showDetectModal.value = true;
    }
  } catch (err: any) {
    detectError.value = err.response?.data?.message ?? 'Erreur détection photo mobile.';
  } finally {
    detecting.value = false;
  }
}

function dismissMobileAlert() {
  if (mobilePhotoAlert.value) inbox.dismiss(mobilePhotoAlert.value.id);
  mobilePhotoAlert.value = null;
}

function triggerScan() {
  scanError.value = '';
  scanInput.value?.click();
}

async function onScanFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (scanInput.value) scanInput.value.value = '';
  scanning.value = true;
  scanError.value = '';
  try {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/invoices/scan-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const extracted: InvoiceLine[] = data.lines ?? [];
    if (extracted.length === 0) {
      scanError.value = 'Aucun article détecté dans l\'image.';
    } else {
      if (form.value.lines.length === 1 && !form.value.lines[0].description && !form.value.lines[0].unit_price) {
        form.value.lines = extracted;
      } else {
        form.value.lines.push(...extracted);
      }
    }
  } catch (err: any) {
    scanError.value = err.response?.data?.message ?? 'Erreur lors de l\'analyse.';
  } finally {
    scanning.value = false;
  }
}

const subtotal = computed(() =>
  form.value.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
);

function openCreate() {
  form.value = blankForm();
  addLine();
  isNew.value = true;
  modalError.value = '';
  showModal.value = true;
}

async function openEdit(inv: Invoice) {
  modalLoading.value = true;
  modalError.value = '';
  isNew.value = false;
  showModal.value = true;
  try {
    const full = await store.fetchInvoice(inv.id);
    form.value = {
      id: full.id,
      type: full.type,
      reference: full.reference,
      client_id: full.client_id,
      supplier_id: full.supplier_id,
      date: full.date,
      due_date: full.due_date ?? '',
      status: full.status,
      notes: full.notes,
      lines: (full.lines ?? []).map(l => ({ ...l })),
    };
  } catch {
    modalError.value = 'Impossible de charger la facture.';
  } finally {
    modalLoading.value = false;
  }
}

async function submitForm() {
  modalError.value = '';
  const payload = {
    type: form.value.type,
    reference: form.value.reference || undefined,
    client_id: form.value.type === 'client' ? form.value.client_id : null,
    supplier_id: form.value.type === 'supplier' ? form.value.supplier_id : null,
    date: form.value.date,
    due_date: form.value.due_date || null,
    status: form.value.status,
    notes: form.value.notes,
    lines: form.value.lines.map(l => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
    })),
  };
  modalLoading.value = true;
  try {
    if (isNew.value) {
      await store.createInvoice(payload as any);
    } else {
      await store.updateInvoice(form.value.id!, payload as any);
    }
    showModal.value = false;
  } catch (e: any) {
    modalError.value = e.response?.data?.message ?? 'Erreur';
  } finally {
    modalLoading.value = false;
  }
}

// ── Article autocomplete ──────────────────────────────
interface ArticleSug {
  id: number;
  code: string | null;
  nom: string;
  famille: string | null;
  marque: string | null;
  prix_vente_ht: number;
  stock_total: number;
}

const activeSuggestIdx = ref<number | null>(null);
const suggestions      = ref<ArticleSug[]>([]);
const suggestCursor    = ref(-1);
let   suggestTimer: ReturnType<typeof setTimeout> | null = null;

function onDescInput(i: number, val: string) {
  activeSuggestIdx.value = i;
  suggestCursor.value    = -1;
  if (suggestTimer) clearTimeout(suggestTimer);
  if (!val.trim()) { suggestions.value = []; return; }
  suggestTimer = setTimeout(() => fetchSuggestions(val.trim()), 250);
}

async function fetchSuggestions(q: string) {
  try {
    const { data } = await api.get('/articles', { params: { search: q, limit: 10, page: 1 } });
    suggestions.value = data.articles ?? [];
  } catch {
    suggestions.value = [];
  }
}

function onDescKeydown(e: KeyboardEvent, i: number) {
  if (activeSuggestIdx.value !== i || !suggestions.value.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggestCursor.value = Math.min(suggestCursor.value + 1, suggestions.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggestCursor.value = Math.max(suggestCursor.value - 1, -1);
  } else if (e.key === 'Enter' && suggestCursor.value >= 0) {
    e.preventDefault();
    applySuggest(i, suggestions.value[suggestCursor.value]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSuggest();
  }
}

function applySuggest(lineIdx: number, a: ArticleSug) {
  form.value.lines[lineIdx].description = a.nom + (a.code ? ` (${a.code})` : '');
  form.value.lines[lineIdx].unit_price  = Number(a.prix_vente_ht) || 0;
  closeSuggest();
}

function closeSuggest() {
  activeSuggestIdx.value = null;
  suggestions.value      = [];
  suggestCursor.value    = -1;
}

// ── Helpers ───────────────────────────────────────────
const statusLabel: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  cancelled: 'Annulée',
};
const statusColor: Record<string, string> = {
  draft: '#888',
  sent: '#3b82f6',
  paid: '#10b981',
  cancelled: '#ef4444',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

onMounted(() => {
  store.fetchInvoices();
  clientsStore.fetchClients();
  suppliersStore.fetchSuppliers();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Factures</h1>
      <div class="topbar-right">
        <!-- Type filter -->
        <div class="type-tabs">
          <button :class="{ active: typeFilter === 'all' }" @click="typeFilter = 'all'">Toutes</button>
          <button :class="{ active: typeFilter === 'client' }" @click="typeFilter = 'client'">Clients</button>
          <button :class="{ active: typeFilter === 'supplier' }" @click="typeFilter = 'supplier'">Fournisseurs</button>
        </div>
        <button v-if="isAdmin" class="add-btn" @click="openCreate">+ Créer</button>
      </div>
    </header>

    <DataGrid :columns="columns" :rows="store.invoices" :loading="store.loading" :format-price="formatPrice"
      :can-duplicate="false" :can-delete="isAdmin" @delete="onDelete">
      <!-- Reference -->
      <template #cell-reference="{ row }">
        <span class="ref-text">{{ row.reference }}</span>
      </template>

      <!-- Type badge -->
      <template #cell-type="{ row }">
        <span class="type-badge" :class="row.type">
          {{ row.type === 'client' ? 'Client' : 'Fournisseur' }}
        </span>
      </template>

      <!-- Entity name -->
      <template #cell-entity_name="{ row }">
        <span class="entity-name">{{ row.entity_name ?? '—' }}</span>
      </template>

      <!-- Dates -->
      <template #cell-date="{ row }">
        <span class="date-text">{{ fmtDate(row.date) }}</span>
      </template>
      <template #cell-due_date="{ row }">
        <span class="date-text"
          :class="{ overdue: row.due_date && row.status !== 'paid' && new Date(row.due_date) < new Date() }">
          {{ fmtDate(row.due_date) }}
        </span>
      </template>

      <!-- Status badge -->
      <template #cell-status="{ row }">
        <span class="status-badge" :style="{ color: statusColor[row.status], borderColor: statusColor[row.status] }">
          {{ statusLabel[row.status] }}
        </span>
      </template>

      <!-- Total -->
      <template #cell-total="{ row }">
        <span class="total-cell">{{ formatPrice(row.total) }}</span>
      </template>

      <!-- Row actions -->
      <template #row-actions="{ row }">
        <button class="act-btn" @click="openEdit(row as Invoice)" title="Modifier">✏</button>
        <button class="act-btn pdf-btn" :disabled="downloadingId === row.id" :title="'Télécharger PDF'"
          @click="downloadPdf(row as Invoice)">{{ downloadingId === row.id ? '…' : '⬇ PDF' }}</button>
      </template>
    </DataGrid>

    <!-- ── Invoice modal ──────────────────────────────── -->
    <div v-if="showModal" class="overlay" @click.self="showModal = false">
      <div class="invoice-modal">

        <!-- Modal header -->
        <div class="inv-header">
          <div class="inv-title">
            <span class="inv-ref">{{ isNew ? 'Nouvelle facture' : form.reference }}</span>
          </div>
          <div class="inv-header-right">
            <select v-model="form.status" class="status-select" :style="{ color: statusColor[form.status] }">
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyée</option>
              <option value="paid">Payée</option>
              <option value="cancelled">Annulée</option>
            </select>
            <button class="close-btn" @click="showModal = false">✕</button>
          </div>
        </div>

        <div v-if="modalLoading && !isNew" class="modal-loading">Chargement…</div>

        <form v-else @submit.prevent="submitForm" class="inv-body">
          <!-- Row 1: type + entity + reference -->
          <div class="form-grid-3">
            <div>
              <label>Type</label>
              <div class="type-toggle">
                <button type="button" :class="{ active: form.type === 'client' }"
                  @click="form.type = 'client'; form.supplier_id = null">Client</button>
                <button type="button" :class="{ active: form.type === 'supplier' }"
                  @click="form.type = 'supplier'; form.client_id = null">Fournisseur</button>
              </div>
            </div>
            <div>
              <label>{{ form.type === 'client' ? 'Client' : 'Fournisseur' }}</label>
              <select v-if="form.type === 'client'" v-model="form.client_id" class="fselect">
                <option :value="null">— Sélectionner —</option>
                <option v-for="c in clientsStore.clients" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <select v-else v-model="form.supplier_id" class="fselect">
                <option :value="null">— Sélectionner —</option>
                <option v-for="s in suppliersStore.suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label>Référence <span class="hint">(auto si vide)</span></label>
              <input v-model="form.reference" placeholder="CLI-2024-0001" />
            </div>
          </div>

          <!-- Row 2: dates -->
          <div class="form-grid-2">
            <div>
              <label>Date de facturation</label>
              <input v-model="form.date" type="date" required />
            </div>
            <div>
              <label>Date d'échéance</label>
              <input v-model="form.due_date" type="date" />
            </div>
          </div>

          <!-- Line items -->
          <div class="lines-section">
            <div class="lines-header">
              <span class="lines-title">Lignes</span>
              <div class="lines-header-actions">
                <input ref="scanInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                  class="scan-input-hidden" @change="onScanFile" />
                <input ref="detectInput" type="file" accept="image/jpeg,image/png,image/webp"
                  class="scan-input-hidden" @change="onDetectFile" />
                <button type="button" class="scan-btn" :disabled="scanning" @click="triggerScan"
                  title="Scanner une photo de articles avec l'IA">
                  <span v-if="scanning" class="scan-spinner" />
                  <span v-else>📷</span>
                  {{ scanning ? 'Analyse…' : 'Scanner' }}
                </button>
                <button type="button" class="detect-btn" :disabled="detecting" @click="triggerDetect"
                  title="Détecter les produits par correspondance d'images (OpenCV)">
                  <span v-if="detecting" class="scan-spinner" />
                  <span v-else>🔍</span>
                  {{ detecting ? 'Détection…' : 'Détecter' }}
                </button>
                <button type="button" class="add-line-btn" @click="addLine">+ Ajouter</button>
              </div>
            </div>

            <!-- Mobile photo notification banner -->
            <Transition name="photo-alert">
              <div v-if="mobilePhotoAlert" class="mobile-photo-alert">
                <img :src="mobilePhotoAlert.dataUrl" class="alert-thumb" alt="Photo mobile" />
                <div class="alert-body">
                  <p class="alert-title">📷 Photo reçue depuis le mobile</p>
                  <p class="alert-sub">{{ mobilePhotoAlert.at.toLocaleTimeString() }}</p>
                </div>
                <div class="alert-actions">
                  <button class="alert-use" @click="usePhotoFromMobile(mobilePhotoAlert)">
                    Utiliser
                  </button>
                  <button class="alert-dismiss" @click="dismissMobileAlert">✕</button>
                </div>
              </div>
            </Transition>

            <p v-if="scanError" class="scan-error">{{ scanError }}</p>
            <p v-if="detectError" class="scan-error">{{ detectError }}</p>
            <div class="lines-table-wrap">
              <table class="lines-table">
                <thead>
                  <tr>
                    <th>Désignation</th>
                    <th class="num-col">Qté</th>
                    <th class="num-col">Prix unitaire</th>
                    <th class="num-col">Total</th>
                    <th class="del-col"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(line, i) in form.lines" :key="i">
                    <td class="desc-cell">
                      <div class="sug-wrap">
                        <input
                          v-model="line.description"
                          placeholder="Description…"
                          class="line-input"
                          autocomplete="off"
                          @input="onDescInput(i, line.description)"
                          @focus="activeSuggestIdx = i"
                          @blur="closeSuggest"
                          @keydown="onDescKeydown($event, i)"
                        />
                        <Transition name="sug-fade">
                          <ul v-if="activeSuggestIdx === i && suggestions.length" class="sug-dropdown">
                            <li
                              v-for="(a, si) in suggestions"
                              :key="a.id"
                              class="sug-item"
                              :class="{ active: suggestCursor === si }"
                              @mousedown.prevent
                              @click="applySuggest(i, a)"
                            >
                              <div class="sug-main">
                                <span class="sug-nom">{{ a.nom }}</span>
                                <span v-if="a.code" class="sug-code">{{ a.code }}</span>
                              </div>
                              <div class="sug-meta">
                                <span v-if="a.famille" class="sug-fam">{{ a.famille }}</span>
                                <span v-if="a.marque"  class="sug-mar">{{ a.marque }}</span>
                                <span class="sug-price">{{ formatPrice(a.prix_vente_ht) }}</span>
                                <span class="sug-stock" :class="{ low: a.stock_total <= 0 }">
                                  {{ a.stock_total }} en stock
                                </span>
                              </div>
                            </li>
                          </ul>
                        </Transition>
                      </div>
                    </td>
                    <td><input v-model.number="line.quantity" type="number" min="0" step="0.01"
                        class="line-input num" />
                    </td>
                    <td><input v-model.number="line.unit_price" type="number" min="0" step="0.01"
                        class="line-input num" />
                    </td>
                    <td class="line-total">{{ formatPrice(line.quantity * line.unit_price) }}</td>
                    <td><button type="button" class="del-line-btn" @click="removeLine(i)">✕</button></td>
                  </tr>
                  <tr v-if="form.lines.length === 0">
                    <td colspan="5" class="no-lines">Aucune ligne — cliquez sur Ajouter.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="subtotal-row">
              <span>Total</span>
              <strong class="subtotal-amount">{{ formatPrice(subtotal) }}</strong>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label>Notes</label>
            <textarea v-model="form.notes" rows="2" placeholder="Conditions de paiement, remarques…"></textarea>
          </div>

          <p v-if="modalError" class="error">{{ modalError }}</p>

          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="showModal = false">Annuler</button>
            <button type="submit" class="save-btn" :disabled="modalLoading">
              {{ modalLoading ? '…' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- ── OpenCV detection results modal ──────────────── -->
  <Transition name="lb">
    <div v-if="showDetectModal" class="detect-backdrop" @click.self="showDetectModal = false">
      <div class="detect-modal">
        <div class="detect-header">
          <div>
            <h3>Produits détectés</h3>
            <p class="detect-subtitle">{{ detectResults.length }} produit{{ detectResults.length > 1 ? 's' : '' }} reconnu{{ detectResults.length > 1 ? 's' : '' }} par correspondance d'images</p>
          </div>
          <button class="detect-close" @click="showDetectModal = false">✕</button>
        </div>
        <div class="detect-list">
          <label v-for="p in detectResults" :key="p.id" class="detect-row" :class="{ selected: detectSelected.has(p.id) }">
            <input type="checkbox" :checked="detectSelected.has(p.id)" @change="toggleDetectProduct(p.id)" />
            <div class="detect-info">
              <span class="detect-name">{{ p.name }}</span>
              <span v-if="p.code" class="detect-code">{{ p.code }}</span>
            </div>
            <div class="detect-confidence">
              <div class="conf-bar-wrap">
                <div class="conf-bar" :style="{ width: p.confidence + '%', background: p.confidence > 70 ? '#10b981' : p.confidence > 40 ? '#f59e0b' : '#ef4444' }" />
              </div>
              <span class="conf-label">{{ p.confidence }}%</span>
            </div>
          </label>
        </div>
        <div class="detect-footer">
          <button class="detect-cancel" @click="showDetectModal = false">Annuler</button>
          <button class="detect-confirm" :disabled="detectSelected.size === 0" @click="confirmDetected">
            Ajouter {{ detectSelected.size }} ligne{{ detectSelected.size > 1 ? 's' : '' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── Mobile scan modal ────────────────────────────────────────────────── -->
</template>

<style scoped>
.page {
  padding: 1.5rem;
  min-height: 100%;
  box-sizing: border-box;
}

/* ── Top bar ─────────────────────────────────────────── */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: .75rem;
}

.topbar h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #1a1a2e;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.type-tabs {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.type-tabs button {
  padding: .35rem .75rem;
  border: none;
  background: transparent;
  font-size: .82rem;
  cursor: pointer;
  color: #888;
  transition: background .12s, color .12s;
}

.type-tabs button:not(:last-child) {
  border-right: 1px solid #ddd;
}

.type-tabs button.active {
  background: #6c63ff;
  color: white;
}

.add-btn {
  padding: .4rem .9rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: .875rem;
  font-weight: 600;
}

.add-btn:hover {
  opacity: .9;
}

/* ── Custom cells ─────────────────────────────────────── */
.ref-text {
  font-family: monospace;
  font-size: .82rem;
  color: #444;
  font-weight: 600;
}

.type-badge {
  font-size: .72rem;
  font-weight: 700;
  padding: .2rem .55rem;
  border-radius: 20px;
  color: white;
}

.type-badge.client {
  background: #10b981;
}

.type-badge.supplier {
  background: #0ea5e9;
}

.entity-name {
  font-size: .875rem;
  color: #1a1a2e;
}

.date-text {
  font-size: .8rem;
  color: #888;
  white-space: nowrap;
}

.date-text.overdue {
  color: #ef4444;
  font-weight: 600;
}

.status-badge {
  font-size: .75rem;
  font-weight: 700;
  padding: .15rem .45rem;
  border-radius: 4px;
  border: 1px solid;
  background: transparent;
  white-space: nowrap;
}

.total-cell {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.act-btn {
  padding: .25rem .45rem;
  font-size: .8rem;
  border-radius: 5px;
  cursor: pointer;
  border: 1px solid #6c63ff;
  color: #6c63ff;
  background: transparent;
  transition: background .12s;
  margin-left: .2rem;
}

.act-btn:first-child {
  margin-left: 0;
}

.act-btn:hover:not(:disabled) {
  background: #6c63ff;
  color: white;
}

.act-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.pdf-btn {
  border-color: #059669;
  color: #059669;
}

.pdf-btn:hover:not(:disabled) {
  background: #059669;
  color: white;
}

/* ── Invoice modal ───────────────────────────────────── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.invoice-modal {
  background: white;
  border-radius: 14px;
  width: 100%;
  max-width: 780px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0, 0, 0, .2);
  overflow: hidden;
}

.inv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.1rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
  background: #fafbff;
  flex-shrink: 0;
}

.inv-title {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.inv-ref {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a1a2e;
  font-family: monospace;
}

.inv-header-right {
  display: flex;
  align-items: center;
  gap: .6rem;
}

.status-select {
  padding: .3rem .6rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: .82rem;
  font-weight: 600;
  background: white;
  cursor: pointer;
}

.status-select:focus {
  outline: none;
  border-color: #6c63ff;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #aaa;
  padding: .2rem .4rem;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #555;
}

.modal-loading {
  padding: 2rem;
  text-align: center;
  color: #888;
}

.inv-body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Form grids */
.form-grid-3 {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  gap: .75rem;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .75rem;
}

label {
  display: block;
  font-size: .82rem;
  color: #666;
  margin-bottom: .3rem;
}

.hint {
  font-size: .72rem;
  color: #bbb;
  font-weight: 400;
}

input,
textarea,
.fselect {
  width: 100%;
  padding: .5rem .7rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: .875rem;
  box-sizing: border-box;
  font-family: inherit;
  background: white;
}

input:focus,
textarea:focus,
.fselect:focus {
  outline: none;
  border-color: #6c63ff;
}

textarea {
  resize: vertical;
}

/* Type toggle */
.type-toggle {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.type-toggle button {
  flex: 1;
  padding: .48rem 0;
  border: none;
  background: transparent;
  font-size: .85rem;
  cursor: pointer;
  color: #888;
  transition: background .12s, color .12s;
}

.type-toggle button:not(:last-child) {
  border-right: 1px solid #ddd;
}

.type-toggle button.active {
  background: #6c63ff;
  color: white;
  font-weight: 600;
}

/* Line items */
.lines-section {
  border: 1px solid #eee;
  border-radius: 10px;
  overflow: hidden;
}

.lines-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .6rem .9rem;
  background: #f7f8ff;
  border-bottom: 1px solid #eee;
}

.lines-title {
  font-size: .8rem;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.lines-header-actions {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.add-line-btn {
  padding: .2rem .6rem;
  font-size: .78rem;
  font-weight: 600;
  color: #6c63ff;
  border: 1px solid #6c63ff;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
}

.add-line-btn:hover {
  background: #6c63ff;
  color: white;
}

.scan-input-hidden {
  display: none;
}

.scan-btn {
  display: flex;
  align-items: center;
  gap: .35rem;
  padding: .2rem .65rem;
  font-size: .78rem;
  font-weight: 600;
  background: linear-gradient(135deg, #6c63ff, #a855f7);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity .15s;
}

.scan-btn:hover:not(:disabled) {
  opacity: .85;
}

.scan-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.scan-spinner {
  width: 11px;
  height: 11px;
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

.scan-error {
  margin: 0;
  padding: .4rem .9rem;
  font-size: .78rem;
  color: #dc2626;
  background: #fee2e2;
  border-bottom: 1px solid #fca5a5;
}

.lines-table-wrap {
  overflow-x: auto;
}

.lines-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
}

.lines-table th {
  padding: .45rem .75rem;
  text-align: left;
  font-size: .75rem;
  color: #888;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .03em;
  border-bottom: 1px solid #f0f0f0;
}

.lines-table td {
  padding: .3rem .5rem;
  border-bottom: 1px solid #f7f7f7;
  vertical-align: middle;
}

.lines-table tbody tr:last-child td {
  border-bottom: none;
}

.num-col {
  width: 110px;
  text-align: right;
}

.del-col {
  width: 36px;
}

.line-input {
  padding: .3rem .5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: .85rem;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
}

.line-input:focus {
  outline: none;
  border-color: #6c63ff;
  background: white;
}

.line-input.num {
  text-align: right;
}

.line-total {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #1a1a2e;
  padding-right: .75rem;
  white-space: nowrap;
}

.del-line-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #ccc;
  font-size: .8rem;
  border-radius: 4px;
  padding: .2rem .35rem;
}

.del-line-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.no-lines {
  text-align: center;
  color: #bbb;
  padding: 1rem;
  font-size: .85rem;
}

.subtotal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .65rem .9rem;
  background: #f7f8ff;
  border-top: 1px solid #eee;
  font-size: .9rem;
  color: #555;
}

.subtotal-amount {
  font-size: 1.05rem;
  color: #1a1a2e;
  font-variant-numeric: tabular-nums;
}

/* Footer */
.error {
  color: #e53e3e;
  font-size: .875rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: .6rem;
  padding-top: .25rem;
}

.cancel-btn {
  padding: .6rem 1rem;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: .9rem;
}

.save-btn {
  padding: .6rem 1.4rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: .9rem;
  font-weight: 600;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

/* ── Detect button ──────────────────────────────────── */
.detect-btn {
  display: flex;
  align-items: center;
  gap: .35rem;
  padding: .2rem .65rem;
  font-size: .78rem;
  font-weight: 600;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity .15s;
}
.detect-btn:hover:not(:disabled) { opacity: .88; }
.detect-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ── Detection modal ────────────────────────────────── */
.detect-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0,0,0,.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.detect-modal {
  background: white;
  border-radius: 14px;
  width: min(520px, 96vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
  overflow: hidden;
}

.detect-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid #f0f0f0;
  background: #f7fff9;
}

.detect-header h3 { margin: 0 0 .2rem; font-size: 1rem; color: #1a1a2e; }
.detect-subtitle { margin: 0; font-size: .78rem; color: #888; }

.detect-close {
  background: none; border: none; font-size: 1.05rem;
  cursor: pointer; color: #aaa; padding: .2rem .4rem; border-radius: 4px;
}
.detect-close:hover { background: #f0f0f0; color: #555; }

.detect-list {
  overflow-y: auto;
  flex: 1;
}

.detect-row {
  display: flex;
  align-items: center;
  gap: .85rem;
  padding: .75rem 1.25rem;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background .1s;
}
.detect-row:last-child { border-bottom: none; }
.detect-row:hover { background: #f7f8ff; }
.detect-row.selected { background: #f0fdf4; }
.detect-row input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #10b981; flex-shrink: 0; }

.detect-info { flex: 1; display: flex; flex-direction: column; gap: .1rem; }
.detect-name { font-size: .88rem; font-weight: 600; color: #1a1a2e; }
.detect-code { font-size: .75rem; color: #888; font-family: monospace; }

.detect-confidence {
  display: flex;
  align-items: center;
  gap: .5rem;
  flex-shrink: 0;
}
.conf-bar-wrap { width: 70px; height: 6px; background: #eee; border-radius: 3px; overflow: hidden; }
.conf-bar { height: 100%; border-radius: 3px; transition: width .3s; }
.conf-label { font-size: .75rem; font-weight: 700; color: #555; width: 32px; text-align: right; }

.detect-footer {
  display: flex;
  justify-content: flex-end;
  gap: .6rem;
  padding: .9rem 1.25rem;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.detect-cancel {
  padding: .45rem .9rem; background: transparent;
  border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: .875rem;
}
.detect-confirm {
  padding: .45rem 1.2rem; background: #10b981; color: white;
  border: none; border-radius: 8px; font-size: .875rem; font-weight: 600; cursor: pointer;
}
.detect-confirm:disabled { opacity: .4; cursor: not-allowed; }
.detect-confirm:not(:disabled):hover { background: #059669; }

/* ── Mobile photo alert banner ───────────────────────────── */
.mobile-photo-alert {
  display: flex;
  align-items: center;
  gap: .75rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-left: 4px solid #6366f1;
  border-radius: 10px;
  padding: .65rem .85rem;
  margin-bottom: .25rem;
}

.alert-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 7px;
  flex-shrink: 0;
}

.alert-body { flex: 1; min-width: 0; }
.alert-title { margin: 0 0 .1rem; font-size: .82rem; font-weight: 700; color: #3730a3; }
.alert-sub   { margin: 0; font-size: .72rem; color: #6366f1; }

.alert-actions { display: flex; align-items: center; gap: .4rem; flex-shrink: 0; }

.alert-use {
  padding: .3rem .75rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: .78rem;
  font-weight: 600;
  cursor: pointer;
}
.alert-use:hover { background: #4f46e5; }

.alert-dismiss {
  background: none;
  border: none;
  color: #818cf8;
  cursor: pointer;
  font-size: .85rem;
  padding: .2rem;
}
.alert-dismiss:hover { color: #4f46e5; }

.photo-alert-enter-active { transition: all .25s ease; }
.photo-alert-leave-active { transition: all .2s ease; }
.photo-alert-enter-from   { opacity: 0; transform: translateY(-8px); }
.photo-alert-leave-to     { opacity: 0; transform: translateX(10px); }

/* ── Article autocomplete ────────────────────────────── */
.desc-cell { position: relative; }

.sug-wrap { position: relative; }

.sug-dropdown {
  position: absolute;
  top: calc(100% + 3px);
  left: 0;
  right: 0;
  min-width: 340px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,.12);
  z-index: 500;
  list-style: none;
  margin: 0;
  padding: .25rem 0;
  max-height: 320px;
  overflow-y: auto;
}

.sug-item {
  padding: .45rem .75rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: .15rem;
  transition: background .1s;
}
.sug-item:hover,
.sug-item.active { background: #f4f3ff; }

.sug-main {
  display: flex;
  align-items: baseline;
  gap: .5rem;
}
.sug-nom {
  font-size: .88rem;
  font-weight: 600;
  color: #1a1a2e;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sug-code {
  font-size: .72rem;
  font-family: monospace;
  color: #888;
  background: #f5f5f5;
  padding: .05rem .35rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.sug-meta {
  display: flex;
  align-items: center;
  gap: .45rem;
  flex-wrap: wrap;
}
.sug-fam {
  font-size: .7rem;
  background: #ede9fe;
  color: #6c63ff;
  padding: .05rem .4rem;
  border-radius: 20px;
  font-weight: 600;
}
.sug-mar {
  font-size: .7rem;
  color: #888;
}
.sug-price {
  font-size: .78rem;
  font-weight: 700;
  color: #6c63ff;
  margin-left: auto;
}
.sug-stock {
  font-size: .68rem;
  color: #aaa;
  flex-shrink: 0;
}
.sug-stock.low { color: #ef4444; font-weight: 600; }

/* dropdown transition */
.sug-fade-enter-active { transition: opacity .12s, transform .12s; }
.sug-fade-leave-active { transition: opacity .1s; }
.sug-fade-enter-from   { opacity: 0; transform: translateY(-4px); }
.sug-fade-leave-to     { opacity: 0; }
</style>
