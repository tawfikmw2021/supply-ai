<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useProductsStore, type Product, type StockMovement } from '../stores/products';
import { useSuppliersStore } from '../stores/suppliers';
import { useCategoriesStore } from '../stores/categories';
import { useCurrency } from '../composables/useCurrency';
import DataGrid, { type GridColumn } from '../components/DataGrid.vue';
import api from '../api';

const auth = useAuthStore();
const store = useProductsStore();
const supStore = useSuppliersStore();
const catStore = useCategoriesStore();
const { currency, formatPrice } = useCurrency();

const isAdmin = computed(() => auth.user?.role === 'admin');

// ── View mode ─────────────────────────────────────────────
type ViewMode = 'cards' | 'table';
const viewMode = ref<ViewMode>((localStorage.getItem('productsView') as ViewMode) ?? 'cards');
function setView(mode: ViewMode) {
  viewMode.value = mode;
  localStorage.setItem('productsView', mode);
}

// ── Card search ───────────────────────────────────────────
const search = ref('');
const filtered = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return store.products;
  return store.products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.code.toLowerCase().includes(q) ||
    p.manufacturer.toLowerCase().includes(q) ||
    p.barcode.toLowerCase().includes(q)
  );
});

// ── Add / edit modal ──────────────────────────────────────
const showForm = ref(false);
const editingId = ref<number | null>(null);
const formError = ref('');
const formLoading = ref(false);

const emptyForm = () => ({
  code: '', name: '', category: '', price: 0, sale_price: 0,
  vat: 20, stock: 0, description: '', manufacturer: '',
  supplier_id: null as number | null, barcode: '',
});
const form = ref(emptyForm());

const margin = computed(() => {
  const pa = Number(form.value.price);
  const pv = Number(form.value.sale_price);
  if (!pa) return null;
  return (((pv - pa) / pa) * 100).toFixed(1);
});

function openAdd() {
  editingId.value = null;
  form.value = emptyForm();
  formError.value = '';
  showForm.value = true;
}

function openEdit(p: Product) {
  editingId.value = p.id;
  form.value = {
    code: p.code ?? '',
    name: p.name,
    category: p.category,
    price: p.price,
    sale_price: p.sale_price ?? 0,
    vat: p.vat ?? 20,
    stock: p.stock,
    description: p.description,
    manufacturer: p.manufacturer ?? '',
    supplier_id: p.supplier_id ?? null,
    barcode: p.barcode ?? '',
  };
  formError.value = '';
  showForm.value = true;
}

async function submitForm() {
  formError.value = '';
  formLoading.value = true;
  try {
    if (editingId.value) {
      await store.updateProduct(editingId.value, form.value);
    } else {
      await store.createProduct(form.value);
    }
    //showForm.value = false;
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur';
  } finally {
    formLoading.value = false;
  }
}

function generateBarcode() {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const check = (10 - digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0) % 10) % 10;
  form.value.barcode = [...digits, check].join('');
}

// ── Barcode scanner ───────────────────────────────────
const scannerOpen = ref(false);
const scannerError = ref('');
const scannerScanning = ref(false);
const scannerNotFound = ref(false);
const scannerAuto = ref(false);
const scannerVideo = ref<HTMLVideoElement | null>(null);
const scannerCanvas = document.createElement('canvas');
let scanStream: MediaStream | null = null;
let autoTimer: ReturnType<typeof setTimeout> | null = null;

async function openScanner() {
  scannerError.value = '';
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
  scannerScanning.value = true;
  scannerNotFound.value = false;
  try {
    scannerCanvas.width = video.videoWidth;
    scannerCanvas.height = video.videoHeight;
    scannerCanvas.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>(r => scannerCanvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) return;
    const fd = new FormData();
    fd.append('image', blob, 'frame.jpg');
    const { data } = await api.post('/scan', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (data.barcode) {
      form.value.barcode = data.barcode;
      closeScanner();
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
  if (scannerAuto.value) {
    captureAndSend();
  } else {
    if (autoTimer !== null) { clearTimeout(autoTimer); autoTimer = null; }
  }
}

function closeScanner() {
  scannerOpen.value = false;
  scannerScanning.value = false;
  scannerNotFound.value = false;
  scannerAuto.value = false;
  if (autoTimer !== null) { clearTimeout(autoTimer); autoTimer = null; }
  scanStream?.getTracks().forEach(t => t.stop());
  scanStream = null;
}

onUnmounted(closeScanner);

function cancelForm() {
  if (editingId.value && !window.confirm('Annuler les modifications ?')) return;
  showForm.value = false;
}

async function remove(id: number) {
  if (!confirm('Supprimer cet article ?')) return;
  await store.deleteProduct(id);
}

// ── Image upload ──────────────────────────────────────────
const uploadingId = ref<number | null>(null);
const uploadError = ref('');

async function pickImage(product: Product) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    uploadingId.value = product.id;
    uploadError.value = '';
    try {
      await store.uploadImage(product.id, file);
    } catch (e: any) {
      uploadError.value = e.response?.data?.message ?? 'Erreur upload';
    } finally {
      uploadingId.value = null;
    }
  };
  input.click();
}

// ── Movements modal ───────────────────────────────────────
const movProduct = ref<Product | null>(null);
const movements = ref<StockMovement[]>([]);
const movLoading = ref(false);
const movForm = ref({ type: 'in', quantity: 1, reason: '' });
const movSubmitting = ref(false);
const movError = ref('');

async function openMovements(p: Product) {
  movProduct.value = p;
  movLoading.value = true;
  movError.value = '';
  try {
    movements.value = await store.getMovements(p.id);
  } finally {
    movLoading.value = false;
  }
}

function closeMovements() {
  movProduct.value = null;
  movements.value = [];
  movForm.value = { type: 'in', quantity: 1, reason: '' };
  movError.value = '';
}

async function submitMovement() {
  if (!movProduct.value) return;
  movSubmitting.value = true;
  movError.value = '';
  try {
    const mov = await store.addMovement(movProduct.value.id, movForm.value);
    movements.value.unshift(mov);
    movForm.value = { type: 'in', quantity: 1, reason: '' };
  } catch (e: any) {
    movError.value = e.response?.data?.message ?? 'Erreur';
  } finally {
    movSubmitting.value = false;
  }
}

function movTypeLabel(t: string) {
  return t === 'in' ? 'Entrée' : t === 'out' ? 'Sortie' : 'Ajustement';
}
function movTypeColor(t: string) {
  return t === 'in' ? '#10b981' : t === 'out' ? '#ef4444' : '#f59e0b';
}
function movQtyLabel(m: StockMovement) {
  if (m.type === 'in') return `+${m.quantity}`;
  if (m.type === 'out') return `-${m.quantity}`;
  return m.quantity > 0 ? `+${m.quantity}` : String(m.quantity);
}

// ── DataGrid ──────────────────────────────────────────────
const gridColumns = computed<GridColumn[]>(() => [
  { key: 'code', label: 'Code', type: 'text', editable: isAdmin.value, width: '110px' },
  { key: 'name', label: 'Désignation', type: 'text', editable: isAdmin.value, width: '180px' },
  { key: 'category', label: 'Famille', type: 'text', editable: isAdmin.value, width: '120px' },
  { key: 'manufacturer', label: 'Fabricant', type: 'text', editable: isAdmin.value, width: '130px' },
  { key: 'price', label: 'Prix achat', type: 'currency', editable: isAdmin.value, width: '110px' },
  { key: 'sale_price', label: 'Prix vente', type: 'currency', editable: isAdmin.value, width: '110px' },
  { key: 'vat', label: 'TVA %', type: 'number', editable: isAdmin.value, width: '80px' },
  { key: 'stock', label: 'Stock', type: 'number', editable: isAdmin.value, width: '80px' },
  { key: 'barcode', label: 'Code-barres', type: 'text', editable: isAdmin.value, width: '130px' },
]);

async function onGridUpdate(id: number, field: string, value: any) {
  await store.updateProduct(id, { [field]: value } as any);
}

async function onGridDelete(ids: number[]) {
  if (!confirm(`Supprimer ${ids.length} article${ids.length > 1 ? 's' : ''} ?`)) return;
  await Promise.all(ids.map(id => store.deleteProduct(id)));
}

async function onGridDuplicate(ids: number[]) {
  const originals = store.products.filter(p => ids.includes(p.id));
  await Promise.all(originals.map(p => store.createProduct({
    code: '', name: `${p.name} (copie)`, category: p.category,
    price: p.price, sale_price: p.sale_price, vat: p.vat,
    stock: 0, description: p.description, manufacturer: p.manufacturer,
    supplier_id: p.supplier_id, barcode: '',
  })));
}

// ── Helpers ───────────────────────────────────────────────
function categoryColor(name: string): string {
  return catStore.categories.find(c => c.name === name)?.color ?? '#6c63ff';
}

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function productMargin(p: Product) {
  if (!p.price) return null;
  return (((p.sale_price - p.price) / p.price) * 100).toFixed(1);
}

onMounted(() => {
  store.fetchProducts();
  supStore.fetchSuppliers();
  catStore.fetchCategories();
});
</script>

<template>
  <div class="page">
    <!-- Top bar -->
    <header class="topbar">
      <h1>Catalogue articles</h1>
      <div class="topbar-right">
        <button v-if="isAdmin" class="add-btn" @click="openAdd">+ Ajouter</button>
        <div class="view-toggle">
          <button class="toggle-btn" :class="{ active: viewMode === 'cards' }" title="Vue cartes"
            @click="setView('cards')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path
                d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button class="toggle-btn" :class="{ active: viewMode === 'table' }" title="Vue tableau"
            @click="setView('table')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd"
                d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm5-4h-5V8h5v2zM9 8H4v2h5V8z"
                clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Card view -->
    <template v-if="viewMode === 'cards'">
      <div class="toolbar">
        <input v-model="search" type="search" placeholder="Rechercher par nom, code, famille, fabricant…"
          class="search" />
        <span class="count">{{ filtered.length }} article{{ filtered.length !== 1 ? 's' : '' }}</span>
      </div>

      <p v-if="store.loading" class="empty">Chargement…</p>

      <div v-else class="grid">
        <div v-for="product in filtered" :key="product.id" class="card">
          <div class="img-wrap">
            <img v-if="product.document?.url" :src="apiBase + product.document.url" :alt="product.name"
              class="product-img" />
            <div v-else class="img-placeholder"><span>{{ product.name[0] }}</span></div>
            <button v-if="isAdmin" class="upload-btn" :disabled="uploadingId === product.id"
              @click="pickImage(product)">
              {{ uploadingId === product.id ? '…' : '📷' }}
            </button>
            <span v-if="product.code" class="code-chip">{{ product.code }}</span>
          </div>

          <div class="card-header">
            <span class="badge" :style="{ background: categoryColor(product.category) }">{{
              product.category }}</span>
            <span class="stock" :class="{ low: product.stock < 10 }">{{ product.stock.toLocaleString() }} en
              stock</span>
          </div>

          <h2>{{ product.name }}</h2>
          <div class="card-meta">
            <span v-if="product.manufacturer" class="meta-mfr">{{ product.manufacturer }}</span>
            <span v-if="product.supplier" class="meta-sup">{{ product.supplier.name }}</span>
          </div>

          <div class="prices">
            <div class="price-block">
              <span class="price-label">Achat</span>
              <span class="price-val">{{ formatPrice(product.price) }}</span>
            </div>
            <div class="price-sep">→</div>
            <div class="price-block">
              <span class="price-label">Vente</span>
              <span class="price-val accent">{{ formatPrice(product.sale_price) }}</span>
            </div>
            <div v-if="productMargin(product) !== null" class="price-block">
              <span class="price-label">Marge</span>
              <span class="price-val" :class="Number(productMargin(product)) >= 0 ? 'pos' : 'neg'">
                {{ productMargin(product) }}%
              </span>
            </div>
          </div>

          <p v-if="product.description" class="desc">{{ product.description }}</p>

          <div class="card-footer">
            <button v-if="isAdmin" class="mov-btn" @click="openMovements(product)" title="Mouvements de stock">
              📦 Mouvements
            </button>
            <div v-if="isAdmin" class="admin-actions">
              <button class="edit-btn" @click="openEdit(product)">Modifier</button>
              <button class="del-btn" @click="remove(product.id)">Supprimer</button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="!store.loading && filtered.length === 0" class="empty">Aucun article trouvé.</p>
      <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
    </template>

    <!-- Table view -->
    <template v-else>
      <DataGrid :columns="gridColumns" :rows="store.products" :loading="store.loading" :format-price="formatPrice"
        @update="onGridUpdate" @delete="onGridDelete" @duplicate="onGridDuplicate" />
      <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
    </template>

    <!-- ── Add / Edit modal ─────────────────────────────── -->
    <div v-if="showForm" class="overlay">
      <div class="modal">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2>{{ editingId ? 'Modifier l\'article' : 'Nouvel article' }}</h2>
          <!--span
            style="border: solid 1px; padding: 2px; border-radius: 50%; background-color: red; cursor: pointer;text-align: right;"
            @click="showForm = false">x</span-->
        </div>
        <form @submit.prevent="submitForm" class="form-body">

          <!-- Identification -->
          <div class="form-section-title">Identification</div>
          <div class="row2">
            <div>
              <label>Code</label>
              <input v-model="form.code" placeholder="Ex: ART-001" />
            </div>
            <div>
              <label>Code à barre</label>
              <div class="input-with-btn">
                <input v-model="form.barcode" placeholder="EAN-13…" />
                <button type="button" class="gen-btn" @click="generateBarcode"
                  title="Générer un code à barre">Générer</button>
                <button type="button" class="gen-btn scan-btn" @click="openScanner"
                  title="Lire un code à barre">📷</button>
              </div>
              <p v-if="scannerError" class="error" style="margin-top:.25rem">{{ scannerError }}</p>
            </div>
          </div>

          <!-- Désignation -->
          <div class="form-section-title">Désignation</div>
          <label>Nom <span class="req">*</span></label>
          <input v-model="form.name" required placeholder="Nom de l'article" />
          <label>Famille <span class="req">*</span></label>
          <select v-model="form.category" required class="sel">
            <option value="" disabled>— Choisir une famille —</option>
            <option v-for="c in catStore.categories" :key="c.id" :value="c.name">{{ c.name }}</option>
          </select>
          <label>Description</label>
          <textarea v-model="form.description" rows="2" placeholder="Description…"></textarea>

          <!-- Prix -->
          <div class="form-section-title">Prix</div>
          <div class="row3">
            <div>
              <label>Prix d'achat ({{ currency }}) <span class="req">*</span></label>
              <input v-model.number="form.price" type="number" step="0.01" min="0" required />
            </div>
            <div>
              <label>Prix de vente ({{ currency }})</label>
              <input v-model.number="form.sale_price" type="number" step="0.01" min="0" />
            </div>
            <div>
              <label>TVA (%)</label>
              <select v-model.number="form.vat" class="sel">
                <option :value="0">0%</option>
                <option :value="5.5">5.5%</option>
                <option :value="10">10%</option>
                <option :value="20">20%</option>
              </select>
            </div>
          </div>
          <div v-if="margin !== null" class="margin-preview">
            Marge : <strong :class="Number(margin) >= 0 ? 'pos' : 'neg'">{{ margin }}%</strong>
          </div>

          <!-- Fournisseur & Fabricant -->
          <div class="form-section-title">Origine</div>
          <div class="row2">
            <div>
              <label>Fournisseur</label>
              <select v-model.number="form.supplier_id" class="sel">
                <option :value="null">— Aucun —</option>
                <option v-for="s in supStore.suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label>Fabricant</label>
              <input v-model="form.manufacturer" placeholder="Ex: Bosch, 3M…" />
            </div>
          </div>

          <!-- Stock -->
          <div class="form-section-title">Stock</div>
          <div class="row2">
            <div>
              <label>Quantité en stock</label>
              <input v-model.number="form.stock" type="number" min="0" required />
            </div>
          </div>

          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="cancelForm">Annuler</button>
            <button type="submit" :disabled="formLoading">{{ formLoading ? '…' : 'Enregistrer' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Barcode scanner overlay ───────────────────────── -->
    <div v-if="scannerOpen" class="overlay scanner-overlay">
      <div class="scanner-box">
        <div class="scanner-header">
          <span>Pointez la caméra vers un code à barre</span>
          <button class="close-btn" @click="closeScanner">✕</button>
        </div>
        <div class="scanner-viewport">
          <video ref="scannerVideo" class="scanner-video" muted playsinline />
          <div class="scanner-aim" />
        </div>
        <div class="scanner-footer">
          <p v-if="scannerNotFound && !scannerAuto" class="scanner-not-found">Aucun code détecté — réessayez</p>
          <div class="scanner-actions">
            <button class="scanner-capture-btn" :disabled="scannerScanning || scannerAuto" @click="captureAndSend">
              {{ scannerScanning && !scannerAuto ? '🔍 Analyse…' : '📸 Capturer' }}
            </button>
            <button class="scanner-auto-btn" :class="{ active: scannerAuto }" @click="toggleAuto">
              {{ scannerAuto ? '⏹ Stop auto' : '🔄 Auto' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Movements modal ──────────────────────────────── -->
    <div v-if="movProduct" class="overlay" @click.self="closeMovements">
      <div class="modal mov-modal">
        <div class="mov-header">
          <div>
            <h2>Mouvements de stock</h2>
            <p class="mov-subtitle">{{ movProduct.name }} — stock actuel : <strong>{{ movProduct.stock }}</strong></p>
          </div>
          <button class="close-btn" @click="closeMovements">✕</button>
        </div>

        <!-- Add movement form (admin) -->
        <div v-if="isAdmin" class="mov-form">
          <select v-model="movForm.type" class="sel sel-sm">
            <option value="in">📥 Entrée</option>
            <option value="out">📤 Sortie</option>
            <option value="adjustment">⚖️ Ajustement</option>
          </select>
          <input v-model.number="movForm.quantity" type="number" :step="1"
            :placeholder="movForm.type === 'adjustment' ? 'Qté (±)' : 'Quantité'" class="mov-qty" />
          <input v-model="movForm.reason" placeholder="Motif (optionnel)" class="mov-reason" />
          <button class="mov-submit" :disabled="movSubmitting" @click="submitMovement">
            {{ movSubmitting ? '…' : 'Ajouter' }}
          </button>
        </div>
        <p v-if="movError" class="error" style="padding: 0 1.25rem .5rem;">{{ movError }}</p>

        <!-- History -->
        <div class="mov-list">
          <p v-if="movLoading" class="mov-empty">Chargement…</p>
          <p v-else-if="movements.length === 0" class="mov-empty">Aucun mouvement enregistré.</p>
          <table v-else class="mov-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Qté</th>
                <th>Motif</th>
                <th>Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movements" :key="m.id">
                <td class="mov-date">{{ new Date(m.created_at).toLocaleString('fr-FR', {
                  dateStyle: 'short', timeStyle:
                    'short'
                }) }}</td>
                <td>
                  <span class="mov-badge"
                    :style="{ color: movTypeColor(m.type), background: movTypeColor(m.type) + '1a' }">
                    {{ movTypeLabel(m.type) }}
                  </span>
                </td>
                <td class="mov-qty-cell" :style="{ color: movTypeColor(m.type) }">{{ movQtyLabel(m) }}</td>
                <td class="mov-reason-cell">{{ m.reason || '—' }}</td>
                <td class="mov-user">{{ m.user_name || '—' }}</td>
              </tr>
            </tbody>
          </table>
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

.toggle-btn:hover {
  background: #f5f5f5;
  color: #555;
}

.toggle-btn.active {
  background: #6c63ff;
  color: white;
}

.toggle-btn:not(:last-child) {
  border-right: 1px solid #ddd;
}

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search {
  flex: 1;
  max-width: 420px;
  padding: .6rem .85rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: .95rem;
  background: white;
}

.search:focus {
  outline: none;
  border-color: #6c63ff;
}

.count {
  font-size: .875rem;
  color: #888;
}

/* ── Cards ───────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 1rem;
}

.card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .07);
  display: flex;
  flex-direction: column;
}

.img-wrap {
  position: relative;
  height: 150px;
  background: #f7f8ff;
}

.product-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: 700;
  color: #c7c3ff;
  background: #f0f0ff;
}

.upload-btn {
  position: absolute;
  bottom: .5rem;
  right: .5rem;
  background: rgba(0, 0, 0, .55);
  color: white;
  border: none;
  border-radius: 6px;
  padding: .25rem .5rem;
  cursor: pointer;
  font-size: .85rem;
}

.upload-btn:hover {
  background: rgba(0, 0, 0, .8);
}

.upload-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.code-chip {
  position: absolute;
  top: .5rem;
  left: .5rem;
  background: rgba(0, 0, 0, .6);
  color: white;
  font-size: .7rem;
  font-family: monospace;
  padding: .15rem .4rem;
  border-radius: 4px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .65rem 1rem .2rem;
}

.badge {
  font-size: .72rem;
  font-weight: 600;
  color: white;
  padding: .2rem .6rem;
  border-radius: 20px;
}

.stock {
  font-size: .75rem;
  color: #888;
}

.stock.low {
  color: #ef4444;
  font-weight: 600;
}

.card h2 {
  margin: 0 0 .2rem;
  font-size: .95rem;
  color: #1a1a2e;
  padding: 0 1rem;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .3rem;
  padding: 0 1rem .3rem;
}

.meta-mfr {
  font-size: .73rem;
  color: #6c63ff;
  font-weight: 600;
}

.meta-sup {
  font-size: .73rem;
  color: #888;
}

.meta-mfr+.meta-sup::before {
  content: '·';
  margin-right: .3rem;
}

.prices {
  display: flex;
  align-items: center;
  gap: .4rem;
  padding: .3rem 1rem .4rem;
}

.price-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.price-label {
  font-size: .65rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.price-val {
  font-size: .85rem;
  font-weight: 700;
  color: #333;
}

.price-val.accent {
  color: #6c63ff;
}

.price-val.pos {
  color: #10b981;
}

.price-val.neg {
  color: #ef4444;
}

.price-sep {
  font-size: .75rem;
  color: #ddd;
  margin-top: .8rem;
}

.desc {
  margin: 0;
  font-size: .82rem;
  color: #666;
  line-height: 1.4;
  padding: 0 1rem;
  flex: 1;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .65rem 1rem;
  margin-top: .4rem;
  flex-wrap: wrap;
  gap: .4rem;
}

.admin-actions {
  display: flex;
  gap: .4rem;
}

.mov-btn {
  font-size: .78rem;
  padding: .25rem .6rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  color: #555;
}

.mov-btn:hover {
  border-color: #6c63ff;
  color: #6c63ff;
}

.edit-btn {
  padding: .25rem .6rem;
  font-size: .8rem;
  border: 1px solid #6c63ff;
  color: #6c63ff;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
}

.edit-btn:hover {
  background: #6c63ff;
  color: white;
}

.del-btn {
  padding: .25rem .6rem;
  font-size: .8rem;
  border: 1px solid #ef4444;
  color: #ef4444;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
}

.del-btn:hover {
  background: #ef4444;
  color: white;
}

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

/* ── Overlay ─────────────────────────────────────────── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

/* ── Product form modal ──────────────────────────────── */
.modal {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, .15);
}

.modal h2 {
  margin: 0 0 1rem;
  font-size: 1.15rem;
  color: #1a1a2e;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: .1rem;
}

.form-section-title {
  margin: .8rem 0 .3rem;
  font-size: .7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #aaa;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: .3rem;
}

.form-section-title:first-child {
  margin-top: 0;
}

label {
  display: block;
  margin: .5rem 0 .2rem;
  font-size: .875rem;
  color: #555;
}

.req {
  color: #ef4444;
}

input,
textarea,
.sel {
  width: 100%;
  padding: .5rem .7rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: .9rem;
  box-sizing: border-box;
  font-family: inherit;
  background: white;
}

input:focus,
textarea:focus,
.sel:focus {
  outline: none;
  border-color: #6c63ff;
}

textarea {
  resize: vertical;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .75rem;
}

.row3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: .75rem;
}

.margin-preview {
  font-size: .82rem;
  color: #666;
  background: #f7f8ff;
  padding: .4rem .7rem;
  border-radius: 6px;
  margin-top: .25rem;
}

.pos {
  color: #10b981;
}

.neg {
  color: #ef4444;
}

.error {
  color: #e53e3e;
  font-size: .875rem;
  margin: .5rem 0 0;
}

.input-with-btn {
  display: flex;
  gap: .4rem;
}

.input-with-btn input {
  flex: 1;
}

.gen-btn {
  padding: .5rem .65rem;
  font-size: .75rem;
  font-weight: 600;
  white-space: nowrap;
  background: #f0eeff;
  color: #6c63ff;
  border: 1px solid #c4beff;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.gen-btn:hover {
  background: #6c63ff;
  color: white;
}

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

.modal-footer button[type=submit]:disabled {
  opacity: .6;
  cursor: not-allowed;
}

/* ── Movements modal ─────────────────────────────────── */
.mov-modal {
  max-width: 680px;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 88vh;
}

.mov-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  background: #fafbff;
  flex-shrink: 0;
}

.mov-header h2 {
  margin: 0 0 .2rem;
  font-size: 1.1rem;
  color: #1a1a2e;
}

.mov-subtitle {
  margin: 0;
  font-size: .82rem;
  color: #888;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: #aaa;
  padding: .2rem .4rem;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #555;
}

.mov-form {
  display: flex;
  gap: .5rem;
  align-items: center;
  padding: .9rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.sel-sm {
  width: auto;
  min-width: 130px;
  padding: .4rem .6rem;
  font-size: .85rem;
}

.mov-qty {
  width: 90px;
  padding: .4rem .6rem;
  font-size: .85rem;
}

.mov-reason {
  flex: 1;
  min-width: 120px;
  padding: .4rem .6rem;
  font-size: .85rem;
}

.mov-submit {
  padding: .4rem .9rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: .85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.mov-submit:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.mov-list {
  overflow-y: auto;
  flex: 1;
}

.mov-empty {
  text-align: center;
  color: #aaa;
  padding: 2rem;
}

.mov-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .83rem;
}

.mov-table th {
  padding: .55rem 1rem;
  text-align: left;
  font-size: .72rem;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: .04em;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.mov-table td {
  padding: .55rem 1rem;
  border-bottom: 1px solid #f8f8f8;
  vertical-align: middle;
}

.mov-table tbody tr:last-child td {
  border-bottom: none;
}

.mov-table tbody tr:hover {
  background: #fafafa;
}

.mov-date {
  color: #aaa;
  white-space: nowrap;
}

.mov-badge {
  display: inline-block;
  font-size: .72rem;
  font-weight: 600;
  padding: .15rem .5rem;
  border-radius: 20px;
  white-space: nowrap;
}

.mov-qty-cell {
  font-weight: 700;
  font-size: .9rem;
}

.mov-reason-cell {
  color: #555;
}

.mov-user {
  color: #aaa;
  font-size: .78rem;
}

/* ── Barcode scanner ─────────────────────────────────── */
.scanner-overlay {
  z-index: 200;
}

.scanner-box {
  background: #1a1a2e;
  border-radius: 14px;
  overflow: hidden;
  width: min(300px, 80vw);
  box-shadow: 0 12px 40px rgba(0, 0, 0, .5);
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .85rem 1.1rem;
  color: rgba(255, 255, 255, .85);
  font-size: .85rem;
}

.scanner-header .close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, .6);
  font-size: 1rem;
  cursor: pointer;
  padding: .2rem .4rem;
  border-radius: 4px;
}

.scanner-header .close-btn:hover {
  color: white;
}

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
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, .45);
  pointer-events: none;
}

.scanner-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .5rem;
  padding: .85rem 1rem;
}

.scanner-actions {
  display: flex;
  gap: .6rem;
}

.scanner-capture-btn {
  padding: .55rem 1.4rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: .88rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .15s;
}

.scanner-capture-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.scanner-auto-btn {
  padding: .55rem 1.1rem;
  background: transparent;
  color: rgba(255, 255, 255, .7);
  border: 1.5px solid rgba(255, 255, 255, .25);
  border-radius: 10px;
  font-size: .88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, color .15s, border-color .15s;
}

.scanner-auto-btn:hover {
  border-color: rgba(255, 255, 255, .5);
  color: white;
}

.scanner-auto-btn.active {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

.scanner-not-found {
  margin: 0;
  font-size: .78rem;
  color: #f87171;
}

.scan-btn {
  font-size: .9rem;
  padding: .45rem .55rem !important;
}
</style>
