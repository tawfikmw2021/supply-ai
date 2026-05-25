<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import api from '../../api';

const auth = useAuthStore();

// ── Profile ───────────────────────────────────────────────────────────────────
const name         = ref(auth.user?.name ?? '');
const profileSaving = ref(false);
const profileSaved  = ref(false);
const profileError  = ref('');

async function saveProfile() {
  const trimmed = name.value.trim();
  if (!trimmed) { profileError.value = 'Le nom ne peut pas être vide.'; return; }
  profileSaving.value = true;
  profileError.value  = '';
  try {
    const { data } = await api.put('/auth/profile', { name: trimmed });
    if (auth.user) auth.user.name = data.user.name;
    profileSaved.value = true;
    setTimeout(() => { profileSaved.value = false; }, 2000);
  } catch (e: any) {
    profileError.value = e.response?.data?.message ?? 'Erreur lors de la sauvegarde.';
  } finally {
    profileSaving.value = false;
  }
}

// ── Password ──────────────────────────────────────────────────────────────────
const currentPassword  = ref('');
const newPassword      = ref('');
const confirmPassword  = ref('');
const pwdSaving = ref(false);
const pwdSaved  = ref(false);
const pwdError  = ref('');

async function changePassword() {
  pwdError.value = '';
  if (!currentPassword.value)  { pwdError.value = 'Saisissez votre mot de passe actuel.'; return; }
  if (newPassword.value.length < 6) { pwdError.value = 'Le nouveau mot de passe doit contenir au moins 6 caractères.'; return; }
  if (newPassword.value !== confirmPassword.value) { pwdError.value = 'Les mots de passe ne correspondent pas.'; return; }
  pwdSaving.value = true;
  try {
    await api.put('/auth/password', {
      currentPassword: currentPassword.value,
      newPassword:     newPassword.value,
    });
    currentPassword.value = '';
    newPassword.value     = '';
    confirmPassword.value = '';
    pwdSaved.value = true;
    setTimeout(() => { pwdSaved.value = false; }, 2000);
  } catch (e: any) {
    pwdError.value = e.response?.data?.message ?? 'Erreur lors du changement de mot de passe.';
  } finally {
    pwdSaving.value = false;
  }
}
</script>

<template>
  <div class="tab-page">
    <h2 class="page-title">Mon compte</h2>

    <!-- Identity card -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">👤 Identité</span>
      </div>

      <div class="identity-block">
        <div class="avatar-col">
          <div class="avatar">{{ (auth.user?.name ?? '?')[0].toUpperCase() }}</div>
          <span class="role-badge" :class="auth.user?.role">{{ auth.user?.role === 'admin' ? 'Administrateur' : 'Utilisateur' }}</span>
        </div>
        <div class="identity-fields">
          <div class="field-group">
            <label class="field-label">Nom d'affichage</label>
            <input
              v-model="name"
              type="text"
              class="field-input"
              placeholder="Votre nom"
              @keyup.enter="saveProfile"
            />
          </div>
          <div class="field-group">
            <label class="field-label">Adresse e-mail</label>
            <input :value="auth.user?.email" type="email" class="field-input readonly" readonly />
          </div>
          <p v-if="profileError" class="form-error">{{ profileError }}</p>
          <div class="field-actions">
            <button class="save-btn" :disabled="profileSaving || name.trim() === auth.user?.name" @click="saveProfile">
              {{ profileSaving ? '…' : profileSaved ? '✓ Sauvegardé' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Password card -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">🔑 Changer le mot de passe</span>
      </div>
      <div class="pwd-fields">
        <div class="field-group">
          <label class="field-label">Mot de passe actuel</label>
          <input v-model="currentPassword" type="password" class="field-input" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div class="field-group">
          <label class="field-label">Nouveau mot de passe</label>
          <input v-model="newPassword" type="password" class="field-input" placeholder="Min. 6 caractères" autocomplete="new-password" />
        </div>
        <div class="field-group">
          <label class="field-label">Confirmer le nouveau mot de passe</label>
          <input v-model="confirmPassword" type="password" class="field-input" placeholder="Répétez le nouveau mot de passe" autocomplete="new-password" @keyup.enter="changePassword" />
        </div>
        <p v-if="pwdError" class="form-error">{{ pwdError }}</p>
        <div class="field-actions">
          <button class="save-btn" :disabled="pwdSaving || !currentPassword || !newPassword" @click="changePassword">
            {{ pwdSaving ? '…' : pwdSaved ? '✓ Mot de passe mis à jour' : 'Changer le mot de passe' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Account info -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">🏢 Compte</span>
      </div>
      <div class="info-rows">
        <div class="info-row">
          <span class="info-label">Nom du compte</span>
          <span class="info-value">{{ auth.account?.name ?? '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">ID utilisateur</span>
          <span class="info-value muted">#{{ auth.user?.id }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">ID compte</span>
          <span class="info-value muted">#{{ auth.user?.account_id }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-page { max-width: 580px; }
.page-title { margin: 0 0 1.5rem; font-size: 1.2rem; color: #1a1a2e; }

.card {
  background: white; border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
  margin-bottom: 1rem; overflow: hidden;
}
.card-header {
  padding: 1rem 1.25rem .75rem;
  border-bottom: 1px solid #f0f0f5;
}
.card-title { font-weight: 600; font-size: .95rem; color: #1a1a2e; }

/* Identity block */
.identity-block {
  display: flex; gap: 1.5rem; padding: 1.25rem;
}
.avatar-col {
  display: flex; flex-direction: column; align-items: center; gap: .5rem;
  flex-shrink: 0;
}
.avatar {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #6c63ff, #a89aff);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; font-weight: 700;
}
.role-badge {
  font-size: .7rem; font-weight: 600;
  padding: .2rem .55rem; border-radius: 20px;
  background: #f0f0f5; color: #666;
  text-transform: uppercase; letter-spacing: .03em;
}
.role-badge.admin { background: #ede9ff; color: #6c63ff; }

.identity-fields { flex: 1; display: flex; flex-direction: column; gap: .75rem; }

/* Password fields */
.pwd-fields {
  padding: 1rem 1.25rem;
  display: flex; flex-direction: column; gap: .75rem;
}

.field-group { display: flex; flex-direction: column; gap: .3rem; }
.field-label { font-size: .8rem; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .03em; }
.field-input {
  padding: .5rem .75rem;
  border: 1px solid #ddd; border-radius: 8px;
  font-size: .9rem; color: #1a1a2e;
  transition: border-color .15s;
}
.field-input:focus { outline: none; border-color: #6c63ff; }
.field-input.readonly { background: #f8f8fb; color: #888; cursor: default; }

.form-error { margin: 0; font-size: .82rem; color: #e53e3e; }

.field-actions { display: flex; justify-content: flex-end; margin-top: .25rem; }
.save-btn {
  padding: .45rem 1.1rem; background: #6c63ff; color: white;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: .875rem; font-weight: 600;
}
.save-btn:disabled { opacity: .55; cursor: default; }

/* Info rows */
.info-rows { padding: .25rem 0; }
.info-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: .7rem 1.25rem;
}
.info-row + .info-row { border-top: 1px solid #f5f5f8; }
.info-label { font-size: .875rem; color: #555; }
.info-value { font-size: .875rem; color: #1a1a2e; font-weight: 500; }
.info-value.muted { color: #aaa; font-weight: 400; font-family: monospace; }
</style>
