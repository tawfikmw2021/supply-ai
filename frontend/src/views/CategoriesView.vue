<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCategoriesStore, type ProductCategory } from '../stores/categories';

const store = useCategoriesStore();

const emptyForm = () => ({ name: '', color: '#6c63ff', description: '' });
const showForm = ref(false);
const editingId = ref<number | null>(null);
const form = ref(emptyForm());
const formError = ref('');
const formLoading = ref(false);

function openAdd() {
  editingId.value = null;
  form.value = emptyForm();
  formError.value = '';
  showForm.value = true;
}

function openEdit(c: ProductCategory) {
  editingId.value = c.id;
  form.value = { name: c.name, color: c.color, description: c.description };
  formError.value = '';
  showForm.value = true;
}

function cancelForm() {
  if (editingId.value && !window.confirm('Annuler les modifications ?')) return;
  showForm.value = false;
}

async function submitForm() {
  formError.value = '';
  formLoading.value = true;
  try {
    if (editingId.value) {
      await store.updateCategory(editingId.value, form.value);
    } else {
      await store.createCategory(form.value);
    }
    showForm.value = false;
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur';
  } finally {
    formLoading.value = false;
  }
}

async function remove(id: number) {
  if (!window.confirm('Supprimer cette famille ?')) return;
  await store.deleteCategory(id);
}

onMounted(() => store.fetchCategories());
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Familles de produits</h1>
      <button class="add-btn" @click="openAdd">+ Ajouter</button>
    </header>

    <div class="table-wrap">
      <p v-if="store.loading" class="empty">Chargement…</p>
      <p v-else-if="store.categories.length === 0" class="empty">Aucune famille définie.</p>
      <table v-else class="tbl">
        <thead>
          <tr>
            <th>Couleur</th>
            <th>Nom</th>
            <th>Description</th>
            <th>Créée le</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in store.categories" :key="cat.id">
            <td>
              <span class="color-dot" :style="{ background: cat.color }"></span>
            </td>
            <td>
              <span class="badge" :style="{ background: cat.color }">{{ cat.name }}</span>
            </td>
            <td class="desc-cell">{{ cat.description || '—' }}</td>
            <td class="date-cell">{{ new Date(cat.created_at).toLocaleDateString('fr-FR') }}</td>
            <td class="actions-cell">
              <button class="edit-btn" @click="openEdit(cat)">Modifier</button>
              <button class="del-btn" @click="remove(cat.id)">Supprimer</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showForm" class="overlay">
      <div class="modal">
        <h2>{{ editingId ? 'Modifier la famille' : 'Nouvelle famille' }}</h2>
        <form @submit.prevent="submitForm" class="form-body">
          <label>Nom <span class="req">*</span></label>
          <input v-model="form.name" required placeholder="Ex: Matériaux" />

          <label>Couleur</label>
          <div class="color-row">
            <input v-model="form.color" type="color" class="color-input" />
            <span class="badge" :style="{ background: form.color }">{{ form.name || 'Aperçu' }}</span>
          </div>

          <label>Description</label>
          <textarea v-model="form.description" rows="2" placeholder="Description optionnelle…"></textarea>

          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="cancelForm">Annuler</button>
            <button type="submit" :disabled="formLoading">{{ formLoading ? '…' : 'Enregistrer' }}</button>
          </div>
        </form>
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

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.topbar h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #1a1a2e;
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

.add-btn:hover { opacity: .9; }

.table-wrap {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,.07);
  overflow: hidden;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: .9rem;
}

.tbl th {
  padding: .75rem 1rem;
  text-align: left;
  font-size: .72rem;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: .04em;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

.tbl td {
  padding: .7rem 1rem;
  border-bottom: 1px solid #f8f8f8;
  vertical-align: middle;
}

.tbl tbody tr:last-child td { border-bottom: none; }
.tbl tbody tr:hover { background: #fafbff; }

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.badge {
  display: inline-block;
  font-size: .75rem;
  font-weight: 600;
  color: white;
  padding: .2rem .65rem;
  border-radius: 20px;
}

.desc-cell { color: #666; font-size: .85rem; }
.date-cell { color: #aaa; font-size: .82rem; white-space: nowrap; }

.actions-cell {
  display: flex;
  gap: .4rem;
  justify-content: flex-end;
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

.edit-btn:hover { background: #6c63ff; color: white; }

.del-btn {
  padding: .25rem .6rem;
  font-size: .8rem;
  border: 1px solid #ef4444;
  color: #ef4444;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
}

.del-btn:hover { background: #ef4444; color: white; }

.empty {
  text-align: center;
  color: #888;
  padding: 3rem;
}

/* Modal */
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

.modal {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0,0,0,.15);
}

.modal h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: #1a1a2e;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: .1rem;
}

label {
  display: block;
  margin: .5rem 0 .2rem;
  font-size: .875rem;
  color: #555;
}

.req { color: #ef4444; }

input[type="text"],
input:not([type="color"]),
textarea {
  width: 100%;
  padding: .5rem .7rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: .9rem;
  box-sizing: border-box;
  font-family: inherit;
}

input:focus, textarea:focus {
  outline: none;
  border-color: #6c63ff;
}

textarea { resize: vertical; }

.color-row {
  display: flex;
  align-items: center;
  gap: .75rem;
  margin-top: .2rem;
}

.color-input {
  width: 48px !important;
  height: 38px;
  padding: 2px !important;
  border-radius: 8px !important;
  cursor: pointer;
}

.error { color: #e53e3e; font-size: .875rem; margin: .5rem 0 0; }

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
</style>
