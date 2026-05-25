<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useUsersStore, type AppUser } from '../stores/users';
import DataGrid, { type GridColumn } from '../components/DataGrid.vue';

const auth = useAuthStore();
const store = useUsersStore();

const currentUserId = computed(() => auth.user?.id);

const columns: GridColumn[] = [
  { key: 'name',       label: 'Nom',        type: 'text', width: '180px' },
  { key: 'email',      label: 'Email',                    width: '220px' },
  { key: 'role',       label: 'Rôle',                     width: '90px'  },
  { key: 'created_at', label: 'Membre depuis',            width: '130px' },
];

// ── Modals ────────────────────────────────────────────
type ModalMode = 'add' | 'edit' | 'password' | null;
const modal = ref<ModalMode>(null);
const targetUser = ref<AppUser | null>(null);
const formError = ref('');
const formLoading = ref(false);

const addForm  = ref({ name: '', email: '', password: '', role: 'user' });
const editForm = ref({ name: '', role: 'user' });
const pwForm   = ref({ password: '', confirm: '' });

function openAdd() {
  addForm.value = { name: '', email: '', password: '', role: 'user' };
  formError.value = '';
  modal.value = 'add';
}

function openEdit(u: AppUser) {
  targetUser.value = u;
  editForm.value = { name: u.name, role: u.role };
  formError.value = '';
  modal.value = 'edit';
}

function openPassword(u: AppUser) {
  targetUser.value = u;
  pwForm.value = { password: '', confirm: '' };
  formError.value = '';
  modal.value = 'password';
}

function closeModal() { modal.value = null; targetUser.value = null; }

async function submitAdd() {
  formError.value = '';
  if (addForm.value.password.length < 6) { formError.value = 'Mot de passe trop court (min. 6 caractères)'; return; }
  formLoading.value = true;
  try {
    await store.createUser(addForm.value);
    closeModal();
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur';
  } finally { formLoading.value = false; }
}

async function submitEdit() {
  if (!targetUser.value) return;
  formError.value = '';
  formLoading.value = true;
  try {
    await store.updateUser(targetUser.value.id, editForm.value);
    closeModal();
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur';
  } finally { formLoading.value = false; }
}

async function submitPassword() {
  if (!targetUser.value) return;
  formError.value = '';
  if (pwForm.value.password.length < 6) { formError.value = 'Min. 6 caractères'; return; }
  if (pwForm.value.password !== pwForm.value.confirm) { formError.value = 'Les mots de passe ne correspondent pas'; return; }
  formLoading.value = true;
  try {
    await store.resetPassword(targetUser.value.id, pwForm.value.password);
    closeModal();
  } catch (e: any) {
    formError.value = e.response?.data?.message ?? 'Erreur';
  } finally { formLoading.value = false; }
}

async function onDelete(ids: number[]) {
  if (ids.includes(currentUserId.value!)) {
    alert('Vous ne pouvez pas supprimer votre propre compte.');
    return;
  }
  if (!confirm(`Supprimer ${ids.length} utilisateur${ids.length > 1 ? 's' : ''} ?`)) return;
  await Promise.all(ids.map(id => store.deleteUser(id)));
}

function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString('fr-FR');
}

onMounted(() => store.fetchUsers());
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Utilisateurs</h1>
      <button class="add-btn" @click="openAdd">+ Inviter</button>
    </header>

    <DataGrid
      :columns="columns"
      :rows="store.users"
      :loading="store.loading"
      :can-duplicate="false"
      :can-delete="true"
      @delete="onDelete"
    >
      <!-- Email -->
      <template #cell-email="{ row }">
        <a :href="`mailto:${row.email}`" class="email-link">{{ row.email }}</a>
      </template>

      <!-- Role badge -->
      <template #cell-role="{ row }">
        <span class="role-badge" :class="row.role">{{ row.role }}</span>
        <span v-if="row.id === currentUserId" class="you-tag">vous</span>
      </template>

      <!-- Date -->
      <template #cell-created_at="{ row }">
        <span class="date-text">{{ fmtDate(row.created_at) }}</span>
      </template>

      <!-- Row actions -->
      <template #row-actions="{ row }">
        <button class="act-btn edit" @click="openEdit(row as AppUser)" title="Modifier">✏</button>
        <button class="act-btn key" @click="openPassword(row as AppUser)" title="Réinitialiser le mot de passe">🔑</button>
      </template>
    </DataGrid>

    <!-- Add user modal -->
    <div v-if="modal === 'add'" class="overlay" @click.self="closeModal">
      <div class="modal">
        <h2>Inviter un utilisateur</h2>
        <form @submit.prevent="submitAdd">
          <div class="row2">
            <div>
              <label>Nom *</label>
              <input v-model="addForm.name" required placeholder="Prénom Nom" />
            </div>
            <div>
              <label>Rôle</label>
              <select v-model="addForm.role" class="select">
                <option value="user">Utilisateur</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
          </div>
          <label>Email *</label>
          <input v-model="addForm.email" required type="email" placeholder="prenom@exemple.com" />
          <label>Mot de passe provisoire *</label>
          <input v-model="addForm.password" required type="password" placeholder="Min. 6 caractères" />
          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="closeModal">Annuler</button>
            <button type="submit" :disabled="formLoading">{{ formLoading ? '…' : 'Créer' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit user modal -->
    <div v-if="modal === 'edit'" class="overlay" @click.self="closeModal">
      <div class="modal">
        <h2>Modifier l'utilisateur</h2>
        <p class="modal-subtitle">{{ targetUser?.email }}</p>
        <form @submit.prevent="submitEdit">
          <label>Nom</label>
          <input v-model="editForm.name" placeholder="Prénom Nom" />
          <label>Rôle</label>
          <select
            v-model="editForm.role"
            class="select"
            :disabled="targetUser?.id === currentUserId"
          >
            <option value="user">Utilisateur</option>
            <option value="admin">Administrateur</option>
          </select>
          <p v-if="targetUser?.id === currentUserId" class="hint">Vous ne pouvez pas modifier votre propre rôle.</p>
          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="closeModal">Annuler</button>
            <button type="submit" :disabled="formLoading">{{ formLoading ? '…' : 'Enregistrer' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reset password modal -->
    <div v-if="modal === 'password'" class="overlay" @click.self="closeModal">
      <div class="modal">
        <h2>Réinitialiser le mot de passe</h2>
        <p class="modal-subtitle">{{ targetUser?.name }} — {{ targetUser?.email }}</p>
        <form @submit.prevent="submitPassword">
          <label>Nouveau mot de passe *</label>
          <input v-model="pwForm.password" required type="password" placeholder="Min. 6 caractères" />
          <label>Confirmer *</label>
          <input v-model="pwForm.confirm" required type="password" placeholder="Répéter le mot de passe" />
          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="closeModal">Annuler</button>
            <button type="submit" :disabled="formLoading">{{ formLoading ? '…' : 'Réinitialiser' }}</button>
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

/* Custom cells */
.email-link { color: #6c63ff; text-decoration: none; font-size: .85rem; }
.email-link:hover { text-decoration: underline; }

.role-badge {
  display: inline-block;
  font-size: .72rem;
  font-weight: 700;
  padding: .2rem .55rem;
  border-radius: 20px;
  text-transform: capitalize;
}
.role-badge.admin { background: #ede9fe; color: #6c63ff; }
.role-badge.user  { background: #f0f0f0; color: #666; }

.you-tag { font-size: .68rem; color: #aaa; margin-left: .35rem; font-style: italic; }
.date-text { font-size: .8rem; color: #888; white-space: nowrap; }

/* Row actions */
.act-btn { padding: .25rem .45rem; font-size: .8rem; border-radius: 5px; cursor: pointer; border: 1px solid #ddd; background: transparent; margin-left: .2rem; transition: background .12s; }
.act-btn:first-child { margin-left: 0; }
.act-btn.edit { border-color: #6c63ff; color: #6c63ff; }
.act-btn.edit:hover { background: #6c63ff; color: white; }
.act-btn.key { border-color: #f59e0b; color: #f59e0b; font-size: .75rem; }
.act-btn.key:hover { background: #f59e0b; color: white; }

/* Modal */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: white; border-radius: 12px; padding: 1.75rem; width: 100%; max-width: 460px; box-shadow: 0 8px 32px rgba(0,0,0,.15); }
.modal h2 { margin: 0 0 .25rem; font-size: 1.2rem; color: #1a1a2e; }
.modal-subtitle { margin: 0 0 1.25rem; font-size: .85rem; color: #888; }
label { display: block; margin: .6rem 0 .2rem; font-size: .875rem; color: #555; }
input, .select { width: 100%; padding: .55rem .75rem; border: 1px solid #ddd; border-radius: 8px; font-size: .9rem; box-sizing: border-box; font-family: inherit; background: white; }
input:focus, .select:focus { outline: none; border-color: #6c63ff; }
.select:disabled { background: #f9f9f9; color: #aaa; cursor: not-allowed; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.hint { font-size: .78rem; color: #f59e0b; margin: .25rem 0 0; }
.error { color: #e53e3e; font-size: .875rem; margin: .5rem 0 0; }
.modal-footer { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.25rem; }
.cancel-btn { padding: .6rem 1rem; background: transparent; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: .9rem; }
.modal-footer button[type=submit] { padding: .6rem 1.2rem; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: .9rem; font-weight: 600; cursor: pointer; }
.modal-footer button[type=submit]:disabled { opacity: .6; cursor: not-allowed; }
</style>
