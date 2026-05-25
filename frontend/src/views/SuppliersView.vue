<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useSuppliersStore, type Supplier } from '../stores/suppliers';
import DataGrid, { type GridColumn } from '../components/DataGrid.vue';

const auth = useAuthStore();
const store = useSuppliersStore();

const isAdmin = computed(() => auth.user?.role === 'admin');

// ── Grid columns ──────────────────────────────────────
const columns = computed<GridColumn[]>(() => [
  { key: 'name',     label: 'Nom',       type: 'text', editable: isAdmin.value, width: '160px' },
  { key: 'category', label: 'Catégorie', type: 'text', editable: isAdmin.value, width: '130px' },
  { key: 'email',    label: 'Email',     type: 'text', editable: isAdmin.value, width: '190px' },
  { key: 'phone',    label: 'Téléphone', type: 'text', editable: isAdmin.value, width: '130px' },
  { key: 'address',  label: 'Adresse',   type: 'text', editable: isAdmin.value },
  { key: 'notes',    label: 'Notes',     type: 'text', editable: isAdmin.value },
]);

async function onUpdate(id: number, field: string, value: any) {
  await store.updateSupplier(id, { [field]: value } as any);
}

async function onDelete(ids: number[]) {
  if (!confirm(`Supprimer ${ids.length} fournisseur${ids.length > 1 ? 's' : ''} ?`)) return;
  await Promise.all(ids.map(id => store.deleteSupplier(id)));
}

async function onDuplicate(ids: number[]) {
  const originals = store.suppliers.filter(s => ids.includes(s.id));
  await Promise.all(
    originals.map(s =>
      store.createSupplier({
        name: `${s.name} (copie)`,
        email: s.email,
        phone: s.phone,
        address: s.address,
        category: s.category,
        notes: s.notes,
      })
    )
  );
}

// ── Add / edit modal ──────────────────────────────────
const showForm = ref(false);
const editingId = ref<number | null>(null);
const formError = ref('');
const formLoading = ref(false);
const form = ref({ name: '', email: '', phone: '', address: '', category: '', notes: '' });

function openAdd() {
  editingId.value = null;
  form.value = { name: '', email: '', phone: '', address: '', category: '', notes: '' };
  formError.value = '';
  showForm.value = true;
}

function openEdit(s: Supplier) {
  editingId.value = s.id;
  form.value = { name: s.name, email: s.email, phone: s.phone, address: s.address, category: s.category, notes: s.notes };
  formError.value = '';
  showForm.value = true;
}

async function submitForm() {
  formError.value = '';
  formLoading.value = true;
  try {
    if (editingId.value) {
      await store.updateSupplier(editingId.value, form.value);
    } else {
      await store.createSupplier(form.value);
    }
    showForm.value = false;
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur';
  } finally {
    formLoading.value = false;
  }
}

onMounted(() => store.fetchSuppliers());
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Fournisseurs</h1>
      <button v-if="isAdmin" class="add-btn" @click="openAdd">+ Ajouter</button>
    </header>

    <DataGrid
      :columns="columns"
      :rows="store.suppliers"
      :loading="store.loading"
      :can-duplicate="isAdmin"
      :can-delete="isAdmin"
      @update="onUpdate"
      @delete="onDelete"
      @duplicate="onDuplicate"
    >
      <template #cell-email="{ row }">
        <a v-if="row.email" :href="`mailto:${row.email}`" class="link">{{ row.email }}</a>
        <span v-else class="empty-val">—</span>
      </template>

      <template #cell-phone="{ row }">
        <a v-if="row.phone" :href="`tel:${row.phone}`" class="link phone">{{ row.phone }}</a>
        <span v-else class="empty-val">—</span>
      </template>

      <template v-if="isAdmin" #row-actions="{ row }">
        <button class="act-btn edit" @click="openEdit(row as Supplier)" title="Modifier">✏</button>
      </template>
    </DataGrid>

    <!-- Modal -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <h2>{{ editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur' }}</h2>
        <form @submit.prevent="submitForm">
          <div class="row2">
            <div>
              <label>Nom *</label>
              <input v-model="form.name" required placeholder="Nom du fournisseur" />
            </div>
            <div>
              <label>Catégorie</label>
              <input v-model="form.category" placeholder="Ex: Électricité" />
            </div>
          </div>
          <div class="row2">
            <div>
              <label>Email</label>
              <input v-model="form.email" type="email" placeholder="contact@fournisseur.com" />
            </div>
            <div>
              <label>Téléphone</label>
              <input v-model="form.phone" type="tel" placeholder="+33 6 00 00 00 00" />
            </div>
          </div>
          <label>Adresse</label>
          <input v-model="form.address" placeholder="Adresse complète" />
          <label>Notes</label>
          <textarea v-model="form.notes" rows="3" placeholder="Informations complémentaires…"></textarea>
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

.link { color: #6c63ff; text-decoration: none; font-size: .85rem; }
.link:hover { text-decoration: underline; }
.phone { color: #059669; }
.empty-val { color: #ccc; }

.act-btn { padding: .25rem .45rem; font-size: .8rem; border-radius: 5px; cursor: pointer; border: 1px solid #ddd; background: transparent; transition: background .12s; }
.act-btn.edit { border-color: #6c63ff; color: #6c63ff; }
.act-btn.edit:hover { background: #6c63ff; color: white; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: white; border-radius: 12px; padding: 1.75rem; width: 100%; max-width: 520px; box-shadow: 0 8px 32px rgba(0,0,0,.15); }
.modal h2 { margin: 0 0 1.25rem; font-size: 1.2rem; color: #1a1a2e; }
label { display: block; margin: .6rem 0 .2rem; font-size: .875rem; color: #555; }
input, textarea { width: 100%; padding: .55rem .75rem; border: 1px solid #ddd; border-radius: 8px; font-size: .9rem; box-sizing: border-box; font-family: inherit; }
input:focus, textarea:focus { outline: none; border-color: #6c63ff; }
textarea { resize: vertical; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.error { color: #e53e3e; font-size: .875rem; margin: .5rem 0 0; }
.modal-footer { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.25rem; }
.cancel-btn { padding: .6rem 1rem; background: transparent; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: .9rem; }
.modal-footer button[type=submit] { padding: .6rem 1.2rem; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: .9rem; font-weight: 600; cursor: pointer; }
.modal-footer button[type=submit]:disabled { opacity: .6; cursor: not-allowed; }
</style>
