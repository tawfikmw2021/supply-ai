<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useAccountStore } from '../../stores/account';
import api from '../../api';

const auth         = useAuthStore();
const accountStore = useAccountStore();

interface ScreenSetting {
  key: string; label: string; icon: string; description: string;
}

const SCREENS: ScreenSetting[] = [
  { key: 'dashboard',  label: 'Dashboard',    icon: '📊', description: 'Tableau de bord avec graphiques' },
  { key: 'products',   label: 'Articles',     icon: '📦', description: 'Catalogue articles et stocks' },
  { key: 'deliveries', label: 'Livraisons',   icon: '🚚', description: 'Suivi des livraisons entrantes et sortantes' },
  { key: 'documents',  label: 'Documents',    icon: '📄', description: 'Gestion des documents et fichiers' },
  { key: 'suppliers',  label: 'Fournisseurs', icon: '🏭', description: 'Liste et détails des fournisseurs' },
  { key: 'clients',    label: 'Clients',      icon: '🤝', description: 'Liste et détails des clients' },
  { key: 'invoices',   label: 'Factures',     icon: '🧾', description: 'Factures clients et fournisseurs' },
  { key: 'loaders',    label: 'Chargeurs',    icon: '📥', description: 'Import de données depuis des fichiers' },
];

const screens       = ref<Record<string, boolean>>({});
const barcodeCapture = ref<'manual' | 'auto'>('manual');
const saving  = ref(false);
const saved   = ref(false);
const error   = ref('');

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

async function save() {
  saving.value = true;
  error.value  = '';
  try {
    const existing = auth.account?.properties ?? {};
    await accountStore.update({
      properties: { ...existing, screens: screens.value, barcodeCapture: barcodeCapture.value },
    });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } catch {
    error.value = 'Erreur lors de la sauvegarde.';
  } finally {
    saving.value = false;
  }
}

// ── Data directory ────────────────────────────────────────────────────────────
const isElectron  = !!(window as any).electronAPI?.isElectron;
const dataDir     = ref('');
const resolvedDir = ref('');
const pendingDir  = ref('');
const dirSaving   = ref(false);
const dirError    = ref('');
const dirRestartNeeded = ref(false);

onMounted(async () => {
  if (isElectron) {
    const abs = await (window as any).electronAPI.getDataDir();
    dataDir.value = abs; resolvedDir.value = abs; pendingDir.value = abs;
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
  dirSaving.value = true; dirError.value = '';
  if (isElectron) {
    await (window as any).electronAPI.setDataDir(pendingDir.value);
  } else {
    try {
      await api.put('/config/data-dir', { path: pendingDir.value });
      dataDir.value = pendingDir.value;
      dirRestartNeeded.value = true;
    } catch (e: any) {
      dirError.value = e.response?.data?.message ?? 'Erreur lors de la sauvegarde.';
    } finally {
      dirSaving.value = false;
    }
  }
}

async function resetDir() {
  dirSaving.value = true; dirError.value = '';
  try {
    await api.delete('/config/data-dir');
    const { data } = await api.get('/config/data-dir');
    dataDir.value    = data.stored ?? data.default ?? '';
    resolvedDir.value = data.resolved ?? '';
    pendingDir.value  = data.stored ?? data.default ?? '';
    dirRestartNeeded.value = true;
  } catch (e: any) {
    dirError.value = e.response?.data?.message ?? 'Erreur lors de la réinitialisation.';
  } finally {
    dirSaving.value = false;
  }
}
</script>

<template>
  <div class="tab-page">
    <div class="tab-topbar">
      <div>
        <h2>Accès utilisateurs</h2>
        <p class="subtitle">Définissez quels écrans sont accessibles aux utilisateurs non-admin.</p>
      </div>
      <button class="save-btn" :disabled="saving" @click="save">
        {{ saving ? '…' : saved ? '✓ Sauvegardé' : 'Enregistrer' }}
      </button>
    </div>

    <p v-if="error" class="error-msg">{{ error }}</p>

    <!-- Screen visibility -->
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
            <label :for="`screen-${s.key}`" class="toggle-track"><span class="toggle-thumb" /></label>
          </div>
        </label>
      </div>
    </div>

    <!-- Barcode -->
    <div class="card">
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

    <!-- Data directory -->
    <div class="card">
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
        <span class="dir-current">Résolu : <code>{{ resolvedDir || dataDir || '—' }}</code></span>
        <div style="display:flex;gap:.5rem">
          <button v-if="!isElectron" class="dir-reset-btn" :disabled="dirSaving" @click="resetDir">
            Réinitialiser
          </button>
          <button class="dir-apply-btn" :disabled="!pendingDir || pendingDir === dataDir || dirSaving" @click="applyDir">
            {{ dirSaving ? '…' : isElectron ? 'Appliquer et redémarrer' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>

    <div class="info-box">
      <span class="info-icon">ℹ️</span>
      <div>
        <strong>Remarque :</strong> Les administrateurs ont toujours accès à tous les écrans,
        indépendamment de ces paramètres.
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-page { max-width: 680px; }

.tab-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
}
.tab-topbar h2 { margin: 0 0 .2rem; font-size: 1.2rem; color: #1a1a2e; }
.subtitle { margin: 0; font-size: .875rem; color: #888; }

.save-btn {
  padding: .45rem 1.1rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: .875rem;
  font-weight: 600;
  flex-shrink: 0;
}
.save-btn:disabled { opacity: .6; cursor: default; }

.error-msg { color: #e53e3e; font-size: .875rem; margin: 0 0 1rem; }

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
  margin-bottom: 1rem;
  overflow: hidden;
}
.card-header {
  padding: 1rem 1.25rem .75rem;
  border-bottom: 1px solid #f0f0f5;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: .5rem;
}
.card-title { font-weight: 600; font-size: .95rem; color: #1a1a2e; }
.card-hint  { font-size: .78rem; color: #aaa; text-align: right; }

/* Screen list */
.screen-list { padding: .25rem 0; }
.screen-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .7rem 1.25rem;
  cursor: pointer;
  transition: background .1s;
}
.screen-row:hover { background: #f8f8ff; }
.screen-row.disabled .screen-label { color: #bbb; }
.screen-row.disabled .screen-desc  { color: #ccc; }
.screen-left { display: flex; align-items: center; gap: .75rem; }
.screen-icon { font-size: 1.1rem; width: 1.4rem; text-align: center; }
.screen-info { display: flex; flex-direction: column; }
.screen-label { font-size: .88rem; font-weight: 500; color: #1a1a2e; }
.screen-desc  { font-size: .75rem; color: #999; }
.toggle-wrap  { display: flex; align-items: center; }
.toggle-input { display: none; }
.toggle-track {
  width: 38px; height: 22px;
  background: #ddd;
  border-radius: 11px;
  position: relative;
  cursor: pointer;
  transition: background .2s;
}
.toggle-input:checked + .toggle-track { background: #6c63ff; }
.toggle-thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 16px; height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(16px); }

/* Barcode */
.capture-options { display: flex; gap: .75rem; padding: 1rem 1.25rem; }
.capture-opt {
  flex: 1; display: flex; align-items: center; gap: .75rem;
  padding: .85rem 1rem;
  border: 2px solid #e8eaf0;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.capture-opt input[type="radio"] { display: none; }
.capture-opt.active { border-color: #6c63ff; background: #f3f2ff; }
.opt-icon { font-size: 1.3rem; }
.opt-label { font-size: .88rem; font-weight: 600; color: #1a1a2e; display: block; }
.opt-desc  { font-size: .75rem; color: #888; display: block; }

/* Data dir */
.dir-row { display: flex; gap: .5rem; padding: .75rem 1.25rem; }
.dir-input {
  flex: 1; padding: .5rem .75rem;
  border: 1px solid #ddd; border-radius: 8px;
  font-size: .875rem; color: #1a1a2e;
  font-family: monospace;
}
.dir-input:focus { outline: none; border-color: #6c63ff; }
.dir-pick-btn { padding: .5rem .9rem; background: #f3f2ff; color: #6c63ff; border: 1px solid #c9c4ff; border-radius: 8px; cursor: pointer; font-size: .8rem; }
.restart-banner { margin: 0 1.25rem; padding: .5rem .75rem; background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; font-size: .8rem; color: #856404; }
.dir-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: .6rem 1.25rem;
  border-top: 1px solid #f0f0f5;
  gap: .75rem;
}
.dir-current { font-size: .8rem; color: #888; }
.dir-current code { font-size: .78rem; background: #f5f5f5; padding: .1rem .35rem; border-radius: 4px; color: #555; }
.dir-reset-btn { padding: .38rem .8rem; background: white; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: .8rem; color: #666; }
.dir-apply-btn { padding: .38rem .9rem; background: #6c63ff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: .8rem; font-weight: 600; }
.dir-apply-btn:disabled { opacity: .5; cursor: default; }

.info-box {
  display: flex; gap: .75rem; align-items: flex-start;
  background: #f0f4ff; border: 1px solid #c7d7fb;
  border-radius: 10px; padding: .9rem 1rem;
  font-size: .82rem; color: #3a5bb0;
  margin-bottom: 1rem;
}
</style>
