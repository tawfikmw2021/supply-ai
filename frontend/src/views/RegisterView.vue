<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import api, { getBackendUrl, setBackendUrl } from '../api';

const router = useRouter();
const auth = useAuthStore();

const name = ref('');
const email = ref('');
const password = ref('');
const error   = ref('');
const loading = ref(false);

const showServer   = ref(false);
const serverUrl    = ref(getBackendUrl());
const serverSaved  = ref(false);

const dataDir      = ref('');
const resolvedDir  = ref('');
const dataDirSaved = ref(false);
const dataDirError = ref('');
const dataDirRestartNeeded = ref(false);

watch(showServer, async (open) => {
  if (!open) return;
  try {
    const { data } = await api.get('/config/data-dir');
    dataDir.value    = data.stored ?? data.default ?? '';
    resolvedDir.value = data.resolved ?? '';
  } catch {}
});

function applyServer() {
  setBackendUrl(serverUrl.value.trim());
  serverUrl.value   = getBackendUrl();
  serverSaved.value = true;
  setTimeout(() => { serverSaved.value = false; }, 1500);
}

async function applyDataDir() {
  dataDirError.value = '';
  try {
    await api.put('/config/data-dir', { path: dataDir.value.trim() });
    dataDirSaved.value = true;
    dataDirRestartNeeded.value = true;
    setTimeout(() => { dataDirSaved.value = false; }, 1500);
  } catch (e: any) {
    dataDirError.value = e.response?.data?.message ?? 'Erreur';
  }
}

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const { data } = await api.post('/auth/register', { name: name.value, email: email.value, password: password.value });
    auth.setAuth(data.token, data.user, data.account);
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.message ?? "Erreur lors de l'inscription";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="container">
    <div class="card">
      <h1>Inscription</h1>
      <form @submit.prevent="submit">
        <label>Nom</label>
        <input v-model="name" type="text" placeholder="Votre nom" required />
        <label>Email</label>
        <input v-model="email" type="email" placeholder="vous@example.com" required />
        <label>Mot de passe</label>
        <input v-model="password" type="password" placeholder="••••••••" required minlength="6" />
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">
          {{ loading ? 'Inscription…' : "S'inscrire" }}
        </button>
      </form>
      <div class="server-section">
        <button type="button" class="server-toggle" @click="showServer = !showServer">
          Serveur {{ showServer ? '▲' : '▼' }}
        </button>
        <div v-if="showServer" class="server-fields">
          <label>URL du backend</label>
          <div class="server-row">
            <input v-model="serverUrl" type="url" placeholder="http://localhost:3000" />
            <button type="button" class="apply-btn" @click="applyServer">
              {{ serverSaved ? '✓' : 'OK' }}
            </button>
          </div>
          <p class="server-hint">Laissez vide pour utiliser l'origine de la page.</p>

          <label style="margin-top:.75rem">Dossier de données</label>
          <div class="server-row">
            <input v-model="dataDir" type="text" placeholder="../backend/data" />
            <button type="button" class="apply-btn" @click="applyDataDir">
              {{ dataDirSaved ? '✓' : 'OK' }}
            </button>
          </div>
          <p v-if="dataDirError" class="error" style="text-align:left">{{ dataDirError }}</p>
          <p v-else-if="dataDirRestartNeeded" class="restart-hint">
            Redémarrez le service pour appliquer le nouveau chemin.
          </p>
          <p v-else class="server-hint">
            Chemin relatif ou absolu.
            <span v-if="resolvedDir"> → <code>{{ resolvedDir }}</code></span>
          </p>
        </div>
      </div>

      <p>Déjà un compte ? <RouterLink to="/login">Se connecter</RouterLink></p>
    </div>
  </div>
</template>

<style scoped>
.container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f2f5; }
.card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,.1); width: 100%; max-width: 400px; }
h1 { margin: 0 0 1.5rem; font-size: 1.5rem; color: #1a1a2e; }
label { display: block; margin: .75rem 0 .25rem; font-size: .875rem; color: #555; }
input { width: 100%; padding: .6rem .75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box; }
input:focus { outline: none; border-color: #6c63ff; }
button[type="submit"] { width: 100%; margin-top: 1.25rem; padding: .75rem; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
button[type="submit"]:disabled { opacity: .6; cursor: not-allowed; }
.error { color: #e53e3e; font-size: .875rem; margin: .5rem 0 0; }
p { margin-top: 1rem; font-size: .875rem; text-align: center; color: #555; }
a { color: #6c63ff; text-decoration: none; font-weight: 600; }

.server-section { margin-top: 1.25rem; border-top: 1px solid #eee; padding-top: .75rem; }
.server-toggle { background: none; border: none; color: #888; font-size: .8rem; cursor: pointer; padding: 0; width: 100%; text-align: left; }
.server-toggle:hover { color: #555; }
.server-fields { margin-top: .5rem; }
.server-fields label { margin-top: .25rem; }
.server-row { display: flex; gap: .5rem; }
.server-row input { flex: 1; }
.apply-btn { padding: .6rem .9rem; background: #6c63ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: .9rem; white-space: nowrap; }
.apply-btn:hover { background: #5a52e0; }
.server-hint { font-size: .75rem; color: #aaa; margin: .25rem 0 0; text-align: left; }
.restart-hint { font-size: .75rem; color: #92400e; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 5px; padding: .3rem .5rem; margin: .25rem 0 0; text-align: left; }
</style>
