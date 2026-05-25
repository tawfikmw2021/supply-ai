<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useArticlesStore, type Article, type ArticleUpdatePayload } from '../stores/articles';
import { useCurrency } from '../composables/useCurrency';
import DataGrid, { type GridColumn } from '../components/DataGrid.vue';
import api from '../api';

const auth    = useAuthStore();
const store   = useArticlesStore();
const { formatPrice } = useCurrency();

const isAdmin  = computed(() => auth.user?.role === 'admin' && !auth.viewAsUser);
const apiBase  = import.meta.env.VITE_API_URL ?? 'http://localhost:3100';

// ── Image handling ────────────────────────────────────────
// Cache-bust counter per article id — incremented after a successful upload
const imageBusts = ref<Record<number, number>>({});

function imageUrl(a: Article) {
  const bust = imageBusts.value[a.id] ?? 0;
  return `${apiBase}/articles/${a.id}/image?token=${auth.token}&_=${bust}`;
}

const uploadingId = ref<number | null>(null);
const uploadError = ref('');

async function pickImage(a: Article) {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    uploadingId.value = a.id;
    uploadError.value = '';
    try {
      await store.uploadImage(a.id, file);
      imageBusts.value = { ...imageBusts.value, [a.id]: Date.now() };
    } catch (e: any) {
      uploadError.value = e.response?.data?.message ?? 'Erreur upload';
    } finally {
      uploadingId.value = null;
    }
  };
  input.click();
}

// ── View mode ─────────────────────────────────────────────
type ViewMode = 'cards' | 'table';
const viewMode = ref<ViewMode>((localStorage.getItem('productsView') as ViewMode) ?? 'cards');
function setView(mode: ViewMode) {
  viewMode.value = mode;
  localStorage.setItem('productsView', mode);
}

// ── Filters ───────────────────────────────────────────────
const search          = ref('');
const selectedFamille = ref('');
const showSommeil     = ref(false);
let   searchTimer: ReturnType<typeof setTimeout> | null = null;

function load(p = 1) {
  store.fetchArticles({
    page:    p,
    search:  search.value || undefined,
    famille: selectedFamille.value || undefined,
    sommeil: showSommeil.value || undefined,
  });
}

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
});
watch([selectedFamille, showSommeil], () => load(1));

// ── Pagination ────────────────────────────────────────────
const totalPages = computed(() => Math.max(1, Math.ceil(store.total / store.limit)));

// ── DataGrid columns (read-only) ──────────────────────────
const gridColumns: GridColumn[] = [
  { key: 'code',          label: 'Code',          type: 'text',     editable: false, width: '110px' },
  { key: 'nom',           label: 'Désignation',   type: 'text',     editable: false, width: '200px' },
  { key: 'famille',       label: 'Famille',       type: 'text',     editable: false, width: '130px' },
  { key: 'marque',        label: 'Marque',        type: 'text',     editable: false, width: '120px' },
  { key: 'prix_achat_ht', label: 'Achat HT',      type: 'currency', editable: false, width: '110px' },
  { key: 'prix_vente_ht', label: 'Vente HT',      type: 'currency', editable: false, width: '110px' },
  { key: 'taux_tva',      label: 'TVA %',         type: 'number',   editable: false, width: '80px'  },
  { key: 'stock_total',   label: 'Stock',         type: 'number',   editable: false, width: '80px'  },
  { key: 'code_barre',    label: 'Code-barres',   type: 'text',     editable: false, width: '140px' },
];

// ── Barcode scanner (search by barcode) ───────────────────
const scannerOpen      = ref(false);
const scannerError     = ref('');
const scannerScanning  = ref(false);
const scannerNotFound  = ref(false);
const scannerAuto      = ref(false);
const scannerVideo     = ref<HTMLVideoElement | null>(null);
const scannerCanvas    = document.createElement('canvas');
let   scanStream: MediaStream | null = null;
let   autoTimer: ReturnType<typeof setTimeout> | null = null;

async function openScanner() {
  scannerError.value    = '';
  scannerNotFound.value = false;
  if (!navigator.mediaDevices?.getUserMedia) {
    scannerError.value = 'Caméra non disponible.';
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    scannerOpen.value = true;
    await new Promise(r => setTimeout(r, 100));
    if (scannerVideo.value) {
      scannerVideo.value.srcObject = scanStream;
      await scannerVideo.value.play();
    }
    if ((auth.account?.properties?.barcodeCapture ?? 'manual') === 'auto') {
      scannerAuto.value = true;
      captureAndSend();
    }
  } catch (e: any) {
    scannerError.value = e?.message ?? 'Accès caméra refusé';
  }
}

async function captureAndSend() {
  const video = scannerVideo.value;
  if (!video || video.readyState < 2) {
    if (scannerAuto.value) autoTimer = setTimeout(captureAndSend, 800);
    return;
  }
  scannerScanning.value  = true;
  scannerNotFound.value  = false;
  try {
    scannerCanvas.width  = video.videoWidth;
    scannerCanvas.height = video.videoHeight;
    scannerCanvas.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>(r => scannerCanvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) return;
    const fd = new FormData();
    fd.append('image', blob, 'frame.jpg');
    const { data } = await api.post('/scan', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (data.barcode) {
      closeScanner();
      search.value = data.barcode;   // search articles by barcode
      return;
    }
    scannerNotFound.value = true;
  } catch {
    scannerNotFound.value = true;
  } finally {
    scannerScanning.value = false;
  }
  if (scannerAuto.value) autoTimer = setTimeout(captureAndSend, 900);
}

function toggleAuto() {
  scannerAuto.value = !scannerAuto.value;
  if (scannerAuto.value) captureAndSend();
  else if (autoTimer !== null) { clearTimeout(autoTimer); autoTimer = null; }
}

function closeScanner() {
  scannerOpen.value     = false;
  scannerScanning.value = false;
  scannerNotFound.value = false;
  scannerAuto.value     = false;
  if (autoTimer !== null) { clearTimeout(autoTimer); autoTimer = null; }
  scanStream?.getTracks().forEach(t => t.stop());
  scanStream = null;
}

onUnmounted(closeScanner);

// ── Helpers ───────────────────────────────────────────────
function articleMargin(a: Article) {
  if (!a.prix_achat_ht) return null;
  return (((a.prix_vente_ht - a.prix_achat_ht) / a.prix_achat_ht) * 100).toFixed(1);
}

function stockClass(a: Article) {
  if (a.hors_stock) return 'hs';
  if (a.alerte_stock && a.stock_total <= a.alerte_stock) return 'low';
  return '';
}

// ── Edit modal ────────────────────────────────────────────
const showEdit   = ref(false);
const editError  = ref('');

const emptyForm = (): ArticleUpdatePayload => ({
  code: '', nom: '', designation_courte: '', description: '', code_barre: '',
  prix_achat_ht: 0, prix_vente_ht: 0, prix_achat_ttc: 0, prix_vente_ttc: 0,
  id_famille: null, id_marque: null, id_tva: null,
  hors_stock: 0, sommeil: 0, alerte_stock: null,
});

const form      = ref<ArticleUpdatePayload>(emptyForm());
const editingId = ref<number | null>(null);

const editMargin = computed(() => {
  const pa = Number(form.value.prix_achat_ht);
  const pv = Number(form.value.prix_vente_ht);
  if (!pa) return null;
  return (((pv - pa) / pa) * 100).toFixed(1);
});

function openEdit(a: Article) {
  editingId.value = a.id;
  form.value = {
    code:               a.code               ?? '',
    nom:                a.nom,
    designation_courte: a.designation_courte ?? '',
    description:        a.description        ?? '',
    code_barre:         a.code_barre         ?? '',
    prix_achat_ht:      a.prix_achat_ht,
    prix_vente_ht:      a.prix_vente_ht,
    prix_achat_ttc:     a.prix_achat_ttc,
    prix_vente_ttc:     a.prix_vente_ttc,
    id_famille:         a.id_famille,
    id_marque:          a.id_marque,
    id_tva:             a.id_tva,
    hors_stock:         a.hors_stock  ?? 0,
    sommeil:            a.sommeil     ?? 0,
    alerte_stock:       a.alerte_stock,
  };
  editError.value = '';
  showEdit.value  = true;
}

async function submitEdit() {
  if (!editingId.value) return;
  editError.value = '';
  try {
    await store.updateArticle(editingId.value, form.value);
    showEdit.value = false;
  } catch (e: any) {
    editError.value = e.response?.data?.message ?? 'Erreur lors de la sauvegarde';
  }
}

onMounted(() => {
  load(1);
  store.fetchFamilles();
  store.fetchMarques();
  store.fetchTvas();
});
</script>

<template>
  <div class="page">
    <!-- Top bar -->
    <header class="topbar">
      <h1>Catalogue articles</h1>
      <div class="topbar-right">
        <div class="view-toggle">
          <button class="toggle-btn" :class="{ active: viewMode === 'cards' }" title="Vue cartes"
            @click="setView('cards')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button class="toggle-btn" :class="{ active: viewMode === 'table' }" title="Vue tableau"
            @click="setView('table')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm5-4h-5V8h5v2zM9 8H4v2h5V8z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="search-wrap">
        <input v-model="search" type="search"
          placeholder="Rechercher nom, code, code-barres, marque…" class="search" />
        <button class="scan-search-btn" title="Scanner un code-barres" @click="openScanner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4M8 12h8"/>
          </svg>
        </button>
      </div>

      <select v-model="selectedFamille" class="sel famille-sel">
        <option value="">Toutes les familles</option>
        <option v-for="f in store.familles" :key="f.id" :value="String(f.id)">{{ f.libelle }}</option>
      </select>

      <label class="sommeil-toggle">
        <input type="checkbox" v-model="showSommeil" />
        <span>Inactifs</span>
      </label>

      <span class="count">
        {{ store.total.toLocaleString() }} article{{ store.total !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Loading -->
    <p v-if="store.loading && !store.articles.length" class="empty">Chargement…</p>

    <!-- Card view -->
    <template v-if="viewMode === 'cards'">
      <div v-if="store.articles.length" class="grid" :class="{ dimmed: store.loading }">
        <div v-for="a in store.articles" :key="a.id" class="card"
          :class="{ inactive: a.sommeil, hs: a.hors_stock }">

          <!-- Photo / placeholder -->
          <div class="img-wrap">
            <img v-if="a.has_image" :src="imageUrl(a)" :alt="a.nom" class="product-img" />
            <div v-else class="img-placeholder">
              <span>{{ a.nom?.[0] ?? '?' }}</span>
            </div>

            <!-- upload button (admin) -->
            <button v-if="isAdmin" class="upload-btn"
              :disabled="uploadingId === a.id"
              :title="a.has_image ? 'Changer la photo' : 'Ajouter une photo'"
              @click.stop="pickImage(a)">
              {{ uploadingId === a.id ? '…' : '📷' }}
            </button>

            <span v-if="a.code" class="code-chip">{{ a.code }}</span>
            <span v-if="a.sommeil"         class="status-chip sommeil-chip">Inactif</span>
            <span v-else-if="a.hors_stock" class="status-chip hs-chip">Hors stock</span>
          </div>

          <!-- Family + stock -->
          <div class="card-header">
            <span v-if="a.famille" class="badge fam-badge">{{ a.famille }}</span>
            <span v-else class="badge fam-badge grey">—</span>
            <span class="stock" :class="stockClass(a)">
              {{ Number(a.stock_total).toLocaleString('fr-FR') }} en stock
            </span>
          </div>

          <!-- Name -->
          <h2 :title="a.nom">{{ a.nom }}</h2>

          <!-- Meta -->
          <div class="card-meta">
            <span v-if="a.marque" class="meta-mfr">{{ a.marque }}</span>
            <span v-if="a.designation_courte" class="meta-des">{{ a.designation_courte }}</span>
          </div>

          <!-- Prices -->
          <div class="prices">
            <div class="price-block">
              <span class="price-label">Achat HT</span>
              <span class="price-val">{{ formatPrice(a.prix_achat_ht) }}</span>
            </div>
            <div class="price-sep">→</div>
            <div class="price-block">
              <span class="price-label">Vente HT</span>
              <span class="price-val accent">{{ formatPrice(a.prix_vente_ht) }}</span>
            </div>
            <div v-if="articleMargin(a) !== null" class="price-block">
              <span class="price-label">Marge</span>
              <span class="price-val" :class="Number(articleMargin(a)) >= 0 ? 'pos' : 'neg'">
                {{ articleMargin(a) }}%
              </span>
            </div>
            <div v-if="a.taux_tva !== null" class="price-block">
              <span class="price-label">TVA</span>
              <span class="price-val tva">{{ a.taux_tva }}%</span>
            </div>
          </div>

          <p v-if="a.code_barre" class="barcode-line">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
              width="12" height="12" style="flex-shrink:0">
              <rect x="4" y="4" width="1.5" height="16"/><rect x="7" y="4" width="1" height="16"/>
              <rect x="10" y="4" width="2" height="16"/><rect x="14" y="4" width="1" height="16"/>
              <rect x="17" y="4" width="1.5" height="16"/>
            </svg>
            {{ a.code_barre }}
          </p>

          <div v-if="isAdmin" class="card-footer">
            <button class="edit-btn" @click="openEdit(a)">✏️ Modifier</button>
          </div>
        </div>
      </div>

      <p v-if="!store.loading && !store.articles.length" class="empty">Aucun article trouvé.</p>
      <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
    </template>

    <!-- Table view -->
    <template v-else>
      <DataGrid
        :columns="gridColumns"
        :rows="store.articles"
        :loading="store.loading"
        :format-price="formatPrice"
      />
    </template>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="store.page <= 1" @click="load(store.page - 1)">‹</button>
      <template v-for="p in totalPages" :key="p">
        <button v-if="Math.abs(p - store.page) <= 2 || p === 1 || p === totalPages"
          class="page-btn" :class="{ active: p === store.page }" @click="load(p)">
          {{ p }}
        </button>
        <span v-else-if="p === store.page - 3 || p === store.page + 3" class="page-ellipsis">…</span>
      </template>
      <button class="page-btn" :disabled="store.page >= totalPages" @click="load(store.page + 1)">›</button>
      <span class="page-info">Page {{ store.page }} / {{ totalPages }}</span>
    </div>

    <!-- ── Edit modal ─────────────────────────────────────── -->
    <div v-if="showEdit" class="overlay" @click.self="showEdit = false">
      <div class="modal">
        <div class="modal-header">
          <h2>Modifier l'article</h2>
          <button class="close-btn" @click="showEdit = false">✕</button>
        </div>

        <form @submit.prevent="submitEdit" class="form-body">

          <!-- Identification -->
          <div class="form-section-title">Identification</div>
          <div class="row2">
            <div>
              <label>Code</label>
              <input v-model="form.code" placeholder="Ex: ART-001" />
            </div>
            <div>
              <label>Code-barres</label>
              <input v-model="form.code_barre" placeholder="EAN-13…" />
            </div>
          </div>

          <!-- Désignation -->
          <div class="form-section-title">Désignation</div>
          <label>Nom <span class="req">*</span></label>
          <input v-model="form.nom" required placeholder="Nom de l'article" />
          <label>Désignation courte</label>
          <input v-model="form.designation_courte" placeholder="Désignation abrégée…" />
          <label>Description</label>
          <textarea v-model="form.description" rows="2" placeholder="Description…"></textarea>

          <!-- Famille / Marque / TVA -->
          <div class="form-section-title">Classification</div>
          <div class="row3">
            <div>
              <label>Famille</label>
              <select v-model.number="form.id_famille" class="sel">
                <option :value="null">— Aucune —</option>
                <option v-for="f in store.familles" :key="f.id" :value="f.id">{{ f.libelle }}</option>
              </select>
            </div>
            <div>
              <label>Marque</label>
              <select v-model.number="form.id_marque" class="sel">
                <option :value="null">— Aucune —</option>
                <option v-for="m in store.marques" :key="m.id" :value="m.id">{{ m.libelle }}</option>
              </select>
            </div>
            <div>
              <label>TVA</label>
              <select v-model.number="form.id_tva" class="sel">
                <option :value="null">— Aucune —</option>
                <option v-for="t in store.tvas" :key="t.id" :value="t.id">{{ t.taux }}%</option>
              </select>
            </div>
          </div>

          <!-- Prix -->
          <div class="form-section-title">Prix</div>
          <div class="row2">
            <div>
              <label>Prix achat HT</label>
              <input v-model.number="form.prix_achat_ht" type="number" step="0.001" min="0" />
            </div>
            <div>
              <label>Prix vente HT</label>
              <input v-model.number="form.prix_vente_ht" type="number" step="0.001" min="0" />
            </div>
          </div>
          <div class="row2">
            <div>
              <label>Prix achat TTC</label>
              <input v-model.number="form.prix_achat_ttc" type="number" step="0.001" min="0" />
            </div>
            <div>
              <label>Prix vente TTC</label>
              <input v-model.number="form.prix_vente_ttc" type="number" step="0.001" min="0" />
            </div>
          </div>
          <div v-if="editMargin !== null" class="margin-preview">
            Marge : <strong :class="Number(editMargin) >= 0 ? 'pos' : 'neg'">{{ editMargin }}%</strong>
          </div>

          <!-- Options -->
          <div class="form-section-title">Options</div>
          <div class="row2">
            <div>
              <label>Alerte stock (qté min)</label>
              <input v-model.number="form.alerte_stock" type="number" min="0" placeholder="—" />
            </div>
            <div class="flags-col">
              <label class="flag-label">
                <input type="checkbox" :checked="!!form.hors_stock"
                  @change="form.hors_stock = ($event.target as HTMLInputElement).checked ? 1 : 0" />
                Hors stock
              </label>
              <label class="flag-label">
                <input type="checkbox" :checked="!!form.sommeil"
                  @change="form.sommeil = ($event.target as HTMLInputElement).checked ? 1 : 0" />
                Inactif (sommeil)
              </label>
            </div>
          </div>

          <p v-if="editError" class="error">{{ editError }}</p>

          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="showEdit = false">Annuler</button>
            <button type="submit" :disabled="store.saving">
              {{ store.saving ? '…' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Barcode scanner overlay ───────────────────────── -->
    <div v-if="scannerOpen" class="overlay scanner-overlay">
      <div class="scanner-box">
        <div class="scanner-header">
          <span>Pointez la caméra vers un code-barres</span>
          <button class="close-btn" @click="closeScanner">✕</button>
        </div>
        <div class="scanner-viewport">
          <video ref="scannerVideo" class="scanner-video" muted playsinline />
          <div class="scanner-aim" />
        </div>
        <div class="scanner-footer">
          <p v-if="scannerNotFound && !scannerAuto" class="scanner-not-found">
            Aucun code détecté — réessayez
          </p>
          <p v-if="scannerError" class="scanner-not-found">{{ scannerError }}</p>
          <div class="scanner-actions">
            <button class="scanner-capture-btn" :disabled="scannerScanning || scannerAuto"
              @click="captureAndSend">
              {{ scannerScanning && !scannerAuto ? '🔍 Analyse…' : '📸 Capturer' }}
            </button>
            <button class="scanner-auto-btn" :class="{ active: scannerAuto }" @click="toggleAuto">
              {{ scannerAuto ? '⏹ Stop auto' : '🔄 Auto' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 1.5rem;
  box-sizing: border-box;
}

/* ── Top bar ─────────────────────────────────────────── */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
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
.view-toggle {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: clip;
  background: white;
}
.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: .4rem .55rem;
  border: none;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.toggle-btn:hover  { background: #f5f5f5; color: #555; }
.toggle-btn.active { background: #6c63ff; color: white; }
.toggle-btn:not(:last-child) { border-right: 1px solid #ddd; }

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: .75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.search-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 420px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  overflow: hidden;
}
.search {
  flex: 1;
  padding: .6rem .85rem;
  border: none;
  font-size: .95rem;
  background: transparent;
  outline: none;
}
.search-wrap:focus-within { border-color: #6c63ff; }
.scan-search-btn {
  padding: .4rem .6rem;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.scan-search-btn:hover { color: #6c63ff; }

.famille-sel {
  padding: .55rem .7rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: .875rem;
  background: white;
  min-width: 160px;
  cursor: pointer;
}
.famille-sel:focus { outline: none; border-color: #6c63ff; }

.sommeil-toggle {
  display: flex;
  align-items: center;
  gap: .35rem;
  font-size: .85rem;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.sommeil-toggle input { cursor: pointer; }

.count {
  font-size: .875rem;
  color: #888;
  white-space: nowrap;
}

/* ── Cards ───────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  transition: opacity .2s;
}
.grid.dimmed { opacity: .55; pointer-events: none; }

.card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,.07);
  display: flex;
  flex-direction: column;
}
.card.inactive { opacity: .7; }
.card.hs { border-left: 3px solid #ef4444; }

.img-wrap {
  position: relative;
  height: 100px;
  background: #f0f0ff;
}
.product-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  font-weight: 700;
  color: #c7c3ff;
}
.upload-btn {
  position: absolute;
  bottom: .4rem;
  right: .4rem;
  background: rgba(0,0,0,.55);
  color: white;
  border: none;
  border-radius: 6px;
  padding: .2rem .45rem;
  font-size: .8rem;
  cursor: pointer;
  line-height: 1.4;
}
.upload-btn:hover    { background: rgba(0,0,0,.8); }
.upload-btn:disabled { opacity: .5; cursor: not-allowed; }
.code-chip {
  position: absolute;
  top: .5rem;
  left: .5rem;
  background: rgba(0,0,0,.55);
  color: white;
  font-size: .7rem;
  font-family: monospace;
  padding: .15rem .4rem;
  border-radius: 4px;
}
.status-chip {
  position: absolute;
  top: .5rem;
  right: .5rem;
  font-size: .65rem;
  font-weight: 700;
  padding: .15rem .45rem;
  border-radius: 20px;
}
.sommeil-chip { background: #fef9c3; color: #854d0e; }
.hs-chip      { background: #fee2e2; color: #b91c1c; }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .6rem 1rem .15rem;
}
.badge {
  font-size: .7rem;
  font-weight: 600;
  color: white;
  padding: .18rem .55rem;
  border-radius: 20px;
  background: #6c63ff;
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge.grey { background: #ccc; }

.stock { font-size: .74rem; color: #888; }
.stock.low { color: #ef4444; font-weight: 600; }
.stock.hs  { color: #b45309; font-weight: 600; }

.card h2 {
  margin: 0 0 .15rem;
  font-size: .92rem;
  color: #1a1a2e;
  padding: 0 1rem;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .25rem;
  padding: 0 1rem .25rem;
}
.meta-mfr {
  font-size: .72rem;
  color: #6c63ff;
  font-weight: 600;
}
.meta-des {
  font-size: .72rem;
  color: #888;
}
.meta-mfr + .meta-des::before { content: '·'; margin-right: .25rem; }

.prices {
  display: flex;
  align-items: center;
  gap: .35rem;
  padding: .25rem 1rem .3rem;
  flex-wrap: wrap;
}
.price-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.price-label {
  font-size: .62rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.price-val          { font-size: .82rem; font-weight: 700; color: #333; }
.price-val.accent   { color: #6c63ff; }
.price-val.pos      { color: #10b981; }
.price-val.neg      { color: #ef4444; }
.price-val.tva      { color: #888; font-weight: 600; }
.price-sep          { font-size: .7rem; color: #ddd; margin-top: .8rem; }

.barcode-line {
  margin: 0;
  padding: .2rem 1rem .65rem;
  font-size: .73rem;
  color: #bbb;
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: .3rem;
}

/* ── Pagination ──────────────────────────────────────── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .4rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}
.page-btn {
  min-width: 2rem;
  height: 2rem;
  padding: 0 .6rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: .875rem;
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
}
.page-btn:hover:not(:disabled) { border-color: #6c63ff; color: #6c63ff; }
.page-btn.active  { background: #6c63ff; color: white; border-color: #6c63ff; }
.page-btn:disabled { opacity: .35; cursor: not-allowed; }
.page-ellipsis { color: #aaa; font-size: .875rem; padding: 0 .25rem; }
.page-info { font-size: .8rem; color: #888; margin-left: .5rem; }

/* ── Shared ──────────────────────────────────────────── */
.empty {
  text-align: center;
  color: #888;
  margin-top: 3rem;
}
.upload-error {
  text-align: center;
  color: #ef4444;
  font-size: .875rem;
  margin-top: .5rem;
}
.sel {
  padding: .5rem .7rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: .9rem;
  background: white;
  font-family: inherit;
}
.sel:focus { outline: none; border-color: #6c63ff; }

/* ── Card footer ─────────────────────────────────────── */
.card-footer {
  display: flex;
  justify-content: flex-end;
  padding: .5rem 1rem .7rem;
  border-top: 1px solid #f3f3f3;
  margin-top: auto;
}
.edit-btn {
  padding: .3rem .75rem;
  font-size: .8rem;
  border: 1px solid #6c63ff;
  color: #6c63ff;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.edit-btn:hover { background: #6c63ff; color: white; }

/* ── Edit modal ──────────────────────────────────────── */
.modal {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,.18);
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem 0;
  flex-shrink: 0;
}
.modal-header h2 { margin: 0; font-size: 1.1rem; color: #1a1a2e; }
.form-body {
  display: flex;
  flex-direction: column;
  gap: .1rem;
  padding: .75rem 1.5rem 1.5rem;
  overflow-y: auto;
}
.form-section-title {
  margin: .85rem 0 .3rem;
  font-size: .68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #aaa;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: .3rem;
}
label {
  display: block;
  margin: .4rem 0 .15rem;
  font-size: .875rem;
  color: #555;
}
.req { color: #ef4444; }
input[type=text], input[type=number], input:not([type]), textarea, .sel {
  width: 100%;
  padding: .5rem .7rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: .9rem;
  box-sizing: border-box;
  font-family: inherit;
  background: white;
}
input:focus, textarea:focus, .sel:focus {
  outline: none;
  border-color: #6c63ff;
}
textarea { resize: vertical; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .75rem; }
.flags-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: .45rem;
  padding-bottom: .15rem;
}
.flag-label {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .875rem;
  color: #555;
  cursor: pointer;
  user-select: none;
  margin: 0;
}
.flag-label input { width: auto; cursor: pointer; }
.margin-preview {
  font-size: .82rem;
  color: #666;
  background: #f7f8ff;
  padding: .4rem .7rem;
  border-radius: 6px;
  margin-top: .25rem;
}
.pos { color: #10b981; }
.neg { color: #ef4444; }
.error { color: #e53e3e; font-size: .875rem; margin: .4rem 0 0; }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: .6rem;
  margin-top: 1.25rem;
}
.cancel-btn {
  padding: .55rem 1rem;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: .9rem;
}
.modal-footer button[type=submit] {
  padding: .55rem 1.2rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: .9rem;
  font-weight: 600;
  cursor: pointer;
}
.modal-footer button[type=submit]:disabled { opacity: .6; cursor: not-allowed; }

/* ── Overlay ─────────────────────────────────────────── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

/* ── Barcode scanner ─────────────────────────────────── */
.scanner-overlay { z-index: 200; }
.scanner-box {
  background: #1a1a2e;
  border-radius: 14px;
  overflow: hidden;
  width: min(300px, 80vw);
  box-shadow: 0 12px 40px rgba(0,0,0,.5);
}
.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .85rem 1.1rem;
  color: rgba(255,255,255,.85);
  font-size: .85rem;
}
.scanner-header .close-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,.6);
  font-size: 1rem;
  cursor: pointer;
  padding: .2rem .4rem;
  border-radius: 4px;
}
.scanner-header .close-btn:hover { color: white; }
.scanner-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: black;
}
.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.scanner-aim {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 65%;
  height: 38%;
  border: 2.5px solid #6c63ff;
  border-radius: 10px;
  box-shadow: 0 0 0 9999px rgba(0,0,0,.45);
  pointer-events: none;
}
.scanner-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .5rem;
  padding: .85rem 1rem;
}
.scanner-actions { display: flex; gap: .6rem; }
.scanner-capture-btn {
  padding: .55rem 1.4rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: .88rem;
  font-weight: 600;
  cursor: pointer;
}
.scanner-capture-btn:disabled { opacity: .45; cursor: not-allowed; }
.scanner-auto-btn {
  padding: .55rem 1.1rem;
  background: transparent;
  color: rgba(255,255,255,.7);
  border: 1.5px solid rgba(255,255,255,.25);
  border-radius: 10px;
  font-size: .88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, color .15s, border-color .15s;
}
.scanner-auto-btn:hover         { border-color: rgba(255,255,255,.5); color: white; }
.scanner-auto-btn.active        { background: #ef4444; border-color: #ef4444; color: white; }
.scanner-not-found { margin: 0; font-size: .78rem; color: #f87171; }
.close-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: #aaa;
  padding: .2rem .4rem;
  border-radius: 4px;
}
.close-btn:hover { background: #f0f0f0; color: #555; }
</style>
