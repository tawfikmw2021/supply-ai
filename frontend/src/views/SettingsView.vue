<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useAccountStore } from '../stores/account';
import api from '../api';

const auth = useAuthStore();
const accountStore = useAccountStore();

interface ScreenSetting {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const SCREENS: ScreenSetting[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', description: 'Tableau de bord avec graphiques' },
  { key: 'products', label: 'Articles', icon: '📦', description: 'Catalogue articles et stocks' },
  { key: 'deliveries', label: 'Livraisons', icon: '🚚', description: 'Suivi des livraisons entrantes et sortantes' },
  { key: 'documents', label: 'Documents', icon: '📄', description: 'Gestion des documents et fichiers' },
  { key: 'suppliers', label: 'Fournisseurs', icon: '🏭', description: 'Liste et détails des fournisseurs' },
  { key: 'clients', label: 'Clients', icon: '🤝', description: 'Liste et détails des clients' },
  { key: 'invoices', label: 'Factures', icon: '🧾', description: 'Factures clients et fournisseurs' },
  { key: 'loaders', label: 'Chargeurs', icon: '📥', description: 'Import de données depuis des fichiers' },
];

const screens = ref<Record<string, boolean>>({});
const barcodeCapture = ref<'manual' | 'auto'>('manual');
const saving = ref(false);
const saved = ref(false);
const error = ref('');

watch(
  () => auth.account?.properties,
  (props) => {
    const src = props?.screens ?? {};
    const result: Record<string, boolean> = {};
    for (const s of SCREENS) result[s.key] = src[s.key] !== false;
    screens.value = result;
    barcodeCapture.value = props?.barcodeCapture ?? 'manual';
  },
  { immediate: true },
);

// ── Data directory ────────────────────────────────────────────────────────────
const isElectron   = !!(window as any).electronAPI?.isElectron;
const dataDir      = ref('');   // raw stored value (possibly relative) — shown in input
const resolvedDir  = ref('');   // absolute resolved path — shown in "Actuel" footer
const pendingDir   = ref('');
const dirSaving    = ref(false);
const dirError     = ref('');
const dirRestartNeeded = ref(false);

onMounted(async () => {
  if (isElectron) {
    const abs = await (window as any).electronAPI.getDataDir();
    dataDir.value    = abs;
    resolvedDir.value = abs;
    pendingDir.value  = abs;
  } else {
    try {
      const { data } = await api.get('/config/data-dir');
      dataDir.value    = data.stored ?? data.default ?? '';
      resolvedDir.value = data.resolved ?? '';
      pendingDir.value  = data.stored ?? data.default ?? '';
    } catch {}
  }
});

async function pickDir() {
  if (!isElectron) return;
  const picked = await (window as any).electronAPI.pickDataDir();
  if (picked) pendingDir.value = picked;
}

async function applyDir() {
  if (!pendingDir.value || pendingDir.value === dataDir.value) return;
  dirSaving.value = true;
  dirError.value  = '';
  if (isElectron) {
    await (window as any).electronAPI.setDataDir(pendingDir.value);
    // app relaunches — code below won't be reached
  } else {
    try {
      await api.put('/config/data-dir', { path: pendingDir.value });
      dataDir.value      = pendingDir.value;
      dirRestartNeeded.value = true;
    } catch (e: any) {
      dirError.value = e.response?.data?.message ?? 'Erreur lors de la sauvegarde.';
    } finally {
      dirSaving.value = false;
    }
  }
}

async function resetDir() {
  dirSaving.value = true;
  dirError.value  = '';
  try {
    await api.delete('/config/data-dir');
    const { data } = await api.get('/config/data-dir');
    dataDir.value      = data.stored ?? data.default ?? '';
    resolvedDir.value  = data.resolved ?? '';
    pendingDir.value   = data.stored ?? data.default ?? '';
    dirRestartNeeded.value = true;
  } catch (e: any) {
    dirError.value = e.response?.data?.message ?? 'Erreur lors de la réinitialisation.';
  } finally {
    dirSaving.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = '';
  try {
    const existing = auth.account?.properties ?? {};
    await accountStore.update({ properties: { ...existing, screens: screens.value, barcodeCapture: barcodeCapture.value } });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } catch {
    error.value = 'Erreur lors de la sauvegarde.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>Accès utilisateurs</h1>
        <p class="subtitle">Définissez quels écrans sont accessibles aux utilisateurs non-admin.</p>
      </div>
      <button class="save-btn" :disabled="saving" @click="save">
        {{ saving ? '…' : saved ? '✓ Sauvegardé' : 'Enregistrer' }}
      </button>
    </header>

    <p v-if="error" class="error-msg">{{ error }}</p>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Écrans visibles</span>
        <span class="card-hint">Les écrans désactivés ne sont pas accessibles aux utilisateurs standard.</span>
      </div>

      <div class="screen-list">
        <label v-for="s in SCREENS" :key="s.key" class="screen-row" :class="{ disabled: !screens[s.key] }">
          <div class="screen-left">
            <span class="screen-icon">{{ s.icon }}</span>
            <div class="screen-info">
              <span class="screen-label">{{ s.label }}</span>
              <span class="screen-desc">{{ s.description }}</span>
            </div>
          </div>
          <div class="toggle-wrap">
            <input type="checkbox" v-model="screens[s.key]" class="toggle-input" :id="`screen-${s.key}`" />
            <label :for="`screen-${s.key}`" class="toggle-track">
              <span class="toggle-thumb" />
            </label>
          </div>
        </label>
      </div>
    </div>

    <div class="card" style="margin-bottom:1rem">
      <div class="card-header">
        <span class="card-title">Scanner de code à barre</span>
        <span class="card-hint">Mode de capture par défaut à l'ouverture du scanner.</span>
      </div>
      <div class="capture-options">
        <label class="capture-opt" :class="{ active: barcodeCapture === 'manual' }">
          <input type="radio" v-model="barcodeCapture" value="manual" />
          <span class="opt-icon">📸</span>
          <div class="opt-info">
            <span class="opt-label">Manuel</span>
            <span class="opt-desc">L'utilisateur appuie sur "Capturer" à chaque essai</span>
          </div>
        </label>
        <label class="capture-opt" :class="{ active: barcodeCapture === 'auto' }">
          <input type="radio" v-model="barcodeCapture" value="auto" />
          <span class="opt-icon">🔄</span>
          <div class="opt-info">
            <span class="opt-label">Automatique</span>
            <span class="opt-desc">Envoi en continu jusqu'à détection du code</span>
          </div>
        </label>
      </div>
    </div>

    <div v-if="auth.user?.role === 'admin'" class="card" style="margin-bottom:1rem">
      <div class="card-header">
        <span class="card-title">Dossier de données</span>
        <span class="card-hint">Chemin relatif ou absolu où sont stockées les bases de données et les fichiers.</span>
      </div>
      <div class="dir-row">
        <input
          class="dir-input"
          v-model="pendingDir"
          :readonly="isElectron"
          :title="isElectron ? 'Cliquer pour choisir' : ''"
          @click="isElectron ? pickDir() : undefined"
          placeholder="../backend/data"
        />
        <button v-if="isElectron" class="dir-pick-btn" @click="pickDir">Parcourir…</button>
      </div>
      <p v-if="dirError" class="error-msg" style="margin:.4rem 1rem 0">{{ dirError }}</p>
      <div v-if="dirRestartNeeded" class="restart-banner">
        Redémarrez le service pour appliquer le nouveau chemin.
      </div>
      <div class="dir-footer">
        <span class="dir-current">Actuel : <code>{{ resolvedDir || dataDir || '—' }}</code></span>
        <div style="display:flex;gap:.5rem">
          <button
            v-if="!isElectron"
            class="dir-reset-btn"
            :disabled="dirSaving"
            @click="resetDir"
            title="Supprimer la valeur personnalisée et utiliser le dossier par défaut"
          >
            Réinitialiser
          </button>
          <button
            class="dir-apply-btn"
            :disabled="!pendingDir || pendingDir === dataDir || dirSaving"
            @click="applyDir"
          >
            {{ dirSaving ? '…' : isElectron ? 'Appliquer et redémarrer' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>

    <div class="info-box">
      <span class="info-icon">ℹ️</span>
      <div>
        <strong>Remarque :</strong> Les administrateurs ont toujours accès à tous les écrans,
        indépendamment de ces paramètres. Utilisez le mode "Utilisateur" dans la barre latérale
        pour prévisualiser la vue d'un utilisateur standard.
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 1.5rem;
  max-width: 680px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.topbar h1 {
  margin: 0 0 .2rem;
  font-size: 1.5rem;
  color: #1a1a2e;
}

.subtitle {
  margin: 0;
  font-size: .875rem;
  color: #888;
}

.save-btn {
  padding: .45rem 1.1rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: .875rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.save-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.error-msg {
  color: #ef4444;
  margin-bottom: 1rem;
  font-size: .875rem;
}

.card {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.card-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: .2rem;
}

.card-title {
  font-weight: 700;
  font-size: .9rem;
  color: #1a1a2e;
}

.card-hint {
  font-size: .78rem;
  color: #aaa;
}

.screen-list { display: contents; }

.screen-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .9rem 1.25rem;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background .12s;
  gap: 1rem;
}

.screen-row:last-child {
  border-bottom: none;
}

.screen-row:hover {
  background: #fafafa;
}

.screen-row.disabled .screen-label {
  color: #aaa;
}

.screen-row.disabled .screen-desc {
  color: #ccc;
}

.screen-row.disabled .screen-icon {
  opacity: .4;
  filter: grayscale(1);
}

.screen-left {
  display: flex;
  align-items: center;
  gap: .85rem;
}

.screen-icon {
  font-size: 1.3rem;
  width: 1.5rem;
  text-align: center;
}

.screen-info {
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.screen-label {
  font-size: .9rem;
  font-weight: 600;
  color: #1a1a2e;
}

.screen-desc {
  font-size: .78rem;
  color: #888;
}

/* Toggle switch */
.toggle-wrap {
  flex-shrink: 0;
}

.toggle-input {
  display: none;
}

.toggle-track {
  display: block;
  width: 42px;
  height: 24px;
  background: #ddd;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background .2s;
}

.toggle-input:checked+.toggle-track {
  background: #6c63ff;
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
  transition: left .2s;
}

.toggle-input:checked+.toggle-track .toggle-thumb {
  left: 21px;
}

.info-box {
  display: flex;
  gap: .75rem;
  background: #f0f4ff;
  border: 1px solid #d4d0ff;
  border-radius: 10px;
  padding: .9rem 1.1rem;
  font-size: .82rem;
  color: #444;
  line-height: 1.6;
}

.info-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.capture-options {
  display: flex;
  flex-direction: column;
}

.capture-opt {
  display: flex;
  align-items: center;
  gap: .85rem;
  padding: .9rem 1.25rem;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background .12s;
}

.capture-opt:last-child {
  border-bottom: none;
}

.capture-opt:hover {
  background: #fafafa;
}

.capture-opt.active {
  background: #f0eeff;
}

.capture-opt input[type="radio"] {
  display: none;
}

.opt-icon {
  font-size: 1.3rem;
  width: 1.5rem;
  text-align: center;
}

.opt-info {
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.opt-label {
  font-size: .9rem;
  font-weight: 600;
  color: #1a1a2e;
}

.capture-opt.active .opt-label {
  color: #6c63ff;
}

.opt-desc {
  font-size: .78rem;
  color: #888;
}

/* ── Data directory ─────────────────────────────── */
.dir-row {
  display: flex;
  gap: .6rem;
  padding: .75rem 1rem 0;
}

.dir-input {
  flex: 1;
  padding: .5rem .75rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  font-size: .82rem;
  font-family: monospace;
  color: #333;
  background: #fafafa;
  cursor: pointer;
  outline: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-input:hover { border-color: #6c63ff; }

.dir-pick-btn {
  padding: .5rem 1rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  font-size: .82rem;
  cursor: pointer;
  color: #555;
  white-space: nowrap;
}

.dir-pick-btn:hover { border-color: #6c63ff; color: #6c63ff; }

.dir-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .6rem 1rem .9rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.dir-current {
  font-size: .75rem;
  color: #aaa;
}

.dir-current code {
  color: #666;
  font-size: .75rem;
}

.dir-apply-btn {
  padding: .45rem 1.1rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: .82rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .15s;
}

.dir-apply-btn:hover:not(:disabled) { opacity: .88; }
.dir-apply-btn:disabled { opacity: .45; cursor: not-allowed; }

.dir-reset-btn {
  padding: .45rem 1.1rem;
  background: white;
  color: #888;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  font-size: .82rem;
  font-weight: 600;
  cursor: pointer;
}
.dir-reset-btn:hover:not(:disabled) { border-color: #aaa; color: #555; }
.dir-reset-btn:disabled { opacity: .45; cursor: not-allowed; }

.restart-banner {
  margin: .5rem 1rem 0;
  padding: .45rem .75rem;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 7px;
  font-size: .78rem;
  color: #92400e;
}
</style>
