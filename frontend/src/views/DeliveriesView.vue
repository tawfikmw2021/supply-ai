<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useSuppliersStore } from '../stores/suppliers';
import { useClientsStore } from '../stores/clients';
import { useDeliveriesStore, type Delivery, type DeliveryPayload } from '../stores/deliveries';
import DataGrid, { type GridColumn } from '../components/DataGrid.vue';

const auth      = useAuthStore();
const store     = useDeliveriesStore();
const suppliers = useSuppliersStore();
const clients   = useClientsStore();

const effectiveAdmin = computed(() => auth.user?.role === 'admin' && !auth.viewAsUser);

const STATUS_LABELS: Record<string, string> = {
  pending:    'En attente',
  in_transit: 'En transit',
  delivered:  'Livré',
  cancelled:  'Annulé',
};
const STATUS_COLORS: Record<string, string> = {
  pending:    '#f59e0b',
  in_transit: '#6c63ff',
  delivered:  '#10b981',
  cancelled:  '#ef4444',
};
const TYPE_LABELS: Record<string, string> = {
  inbound:  'Entrante',
  outbound: 'Sortante',
};

const columns = computed<GridColumn[]>(() => [
  { key: 'reference',     label: 'Référence',       type: 'text', sortable: true, width: '130px' },
  { key: 'type',          label: 'Type',             type: 'text', sortable: true, width: '100px' },
  { key: 'supplier_name', label: 'Fournisseur',      type: 'text', sortable: true, width: '160px' },
  { key: 'client_name',   label: 'Client',           type: 'text', sortable: true, width: '150px' },
  { key: 'status',        label: 'Statut',           type: 'text', sortable: true, width: '120px' },
  { key: 'expected_date', label: 'Date prévue',      type: 'text', sortable: true, width: '120px' },
  { key: 'delivered_at',  label: 'Livré le',         type: 'text', sortable: true, width: '120px' },
  { key: 'notes',         label: 'Notes',            type: 'text' },
]);

async function onUpdate(id: number, field: string, value: any) {
  await store.updateDelivery(id, { [field]: value } as any);
}

async function onDelete(ids: number[]) {
  if (!confirm(`Supprimer ${ids.length} livraison${ids.length > 1 ? 's' : ''} ?`)) return;
  await Promise.all(ids.map(id => store.deleteDelivery(id)));
}

// ── Modal ──────────────────────────────────────────────
const showForm   = ref(false);
const editingId  = ref<number | null>(null);
const formError  = ref('');
const formLoading = ref(false);

const emptyForm = (): Partial<DeliveryPayload> => ({
  reference: '', type: 'inbound', supplier_id: null, client_id: null,
  status: 'pending', expected_date: '', delivered_at: '', notes: '',
});
const form = ref<Partial<DeliveryPayload>>(emptyForm());

function openAdd() {
  editingId.value = null;
  form.value = emptyForm();
  formError.value = '';
  showForm.value = true;
}

function openEdit(d: Delivery) {
  editingId.value = d.id;
  form.value = {
    reference: d.reference, type: d.type,
    supplier_id: d.supplier_id, client_id: d.client_id,
    status: d.status, expected_date: d.expected_date ?? '',
    delivered_at: d.delivered_at ?? '', notes: d.notes,
  };
  formError.value = '';
  showForm.value = true;
}

async function submitForm() {
  formError.value = '';
  formLoading.value = true;
  try {
    const payload = {
      ...form.value,
      supplier_id:   form.value.supplier_id  || null,
      client_id:     form.value.client_id    || null,
      expected_date: form.value.expected_date || null,
      delivered_at:  form.value.delivered_at  || null,
    };
    if (editingId.value) {
      await store.updateDelivery(editingId.value, payload);
    } else {
      await store.createDelivery(payload);
    }
    showForm.value = false;
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur';
  } finally {
    formLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([
    store.fetchDeliveries(),
    suppliers.fetchSuppliers(),
    clients.fetchClients(),
  ]);
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Livraisons</h1>
      <button v-if="effectiveAdmin" class="add-btn" @click="openAdd">+ Ajouter</button>
    </header>

    <DataGrid
      :columns="columns"
      :rows="store.deliveries"
      :loading="store.loading"
      :can-delete="effectiveAdmin"
      @update="onUpdate"
      @delete="onDelete"
    >
      <!-- Type badge -->
      <template #cell-type="{ row }">
        <span class="badge" :class="row.type">{{ TYPE_LABELS[row.type] ?? row.type }}</span>
      </template>

      <!-- Status badge -->
      <template #cell-status="{ row }">
        <span class="status-badge" :style="{ background: STATUS_COLORS[row.status] + '1a', color: STATUS_COLORS[row.status] }">
          {{ STATUS_LABELS[row.status] ?? row.status }}
        </span>
      </template>

      <!-- Supplier -->
      <template #cell-supplier_name="{ row }">
        <span v-if="row.supplier_name">{{ row.supplier_name }}</span>
        <span v-else class="empty-val">—</span>
      </template>

      <!-- Client -->
      <template #cell-client_name="{ row }">
        <span v-if="row.client_name">{{ row.client_name }}</span>
        <span v-else class="empty-val">—</span>
      </template>

      <!-- Dates -->
      <template #cell-expected_date="{ row }">
        <span v-if="row.expected_date">{{ row.expected_date }}</span>
        <span v-else class="empty-val">—</span>
      </template>
      <template #cell-delivered_at="{ row }">
        <span v-if="row.delivered_at">{{ row.delivered_at }}</span>
        <span v-else class="empty-val">—</span>
      </template>

      <!-- Row action: edit -->
      <template v-if="effectiveAdmin" #row-actions="{ row }">
        <button class="act-btn edit" @click="openEdit(row as Delivery)" title="Modifier">✏</button>
      </template>
    </DataGrid>

    <!-- Modal -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <h2>{{ editingId ? 'Modifier la livraison' : 'Nouvelle livraison' }}</h2>
        <form @submit.prevent="submitForm">

          <div class="row2">
            <div>
              <label>Référence</label>
              <input v-model="form.reference" placeholder="Ex: LIV-2024-001" />
            </div>
            <div>
              <label>Type</label>
              <select v-model="form.type">
                <option value="inbound">Entrante (fournisseur)</option>
                <option value="outbound">Sortante (client)</option>
              </select>
            </div>
          </div>

          <div class="row2">
            <div>
              <label>Fournisseur</label>
              <select v-model="form.supplier_id">
                <option :value="null">— Aucun —</option>
                <option v-for="s in suppliers.suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label>Client</label>
              <select v-model="form.client_id">
                <option :value="null">— Aucun —</option>
                <option v-for="c in clients.clients" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
          </div>

          <div class="row2">
            <div>
              <label>Statut</label>
              <select v-model="form.status">
                <option value="pending">En attente</option>
                <option value="in_transit">En transit</option>
                <option value="delivered">Livré</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            <div>
              <label>Date prévue</label>
              <input v-model="form.expected_date" type="date" />
            </div>
          </div>

          <div class="row2">
            <div>
              <label>Livré le</label>
              <input v-model="form.delivered_at" type="date" />
            </div>
            <div></div>
          </div>

          <label>Notes</label>
          <textarea v-model="form.notes" rows="3" placeholder="Informations complémentaires…" />

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

/* Badges */
.badge {
  display: inline-block;
  padding: .18rem .55rem;
  border-radius: 20px;
  font-size: .75rem;
  font-weight: 600;
}
.badge.inbound  { background: #e0f2fe; color: #0369a1; }
.badge.outbound { background: #fdf4ff; color: #9333ea; }

.status-badge {
  display: inline-block;
  padding: .18rem .55rem;
  border-radius: 20px;
  font-size: .75rem;
  font-weight: 600;
}

.empty-val { color: #ccc; }

.act-btn { padding: .25rem .45rem; font-size: .8rem; border-radius: 5px; cursor: pointer; border: 1px solid #ddd; background: transparent; transition: background .12s; }
.act-btn.edit { border-color: #6c63ff; color: #6c63ff; }
.act-btn.edit:hover { background: #6c63ff; color: white; }

/* Modal */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: white; border-radius: 12px; padding: 1.75rem; width: 100%; max-width: 560px; box-shadow: 0 8px 32px rgba(0,0,0,.15); max-height: 90vh; overflow-y: auto; }
.modal h2 { margin: 0 0 1.25rem; font-size: 1.2rem; color: #1a1a2e; }

label { display: block; margin: .6rem 0 .2rem; font-size: .875rem; color: #555; }
input, select, textarea {
  width: 100%; padding: .55rem .75rem;
  border: 1px solid #ddd; border-radius: 8px;
  font-size: .9rem; box-sizing: border-box; font-family: inherit;
}
input:focus, select:focus, textarea:focus { outline: none; border-color: #6c63ff; }
textarea { resize: vertical; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.error { color: #e53e3e; font-size: .875rem; margin: .5rem 0 0; }
.modal-footer { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.25rem; }
.cancel-btn { padding: .6rem 1rem; background: transparent; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: .9rem; }
.modal-footer button[type=submit] { padding: .6rem 1.2rem; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: .9rem; font-weight: 600; cursor: pointer; }
.modal-footer button[type=submit]:disabled { opacity: .6; cursor: not-allowed; }
</style>
