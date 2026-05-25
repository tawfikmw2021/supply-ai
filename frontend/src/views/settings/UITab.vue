<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useAccountStore } from '../../stores/account';

const auth         = useAuthStore();
const accountStore = useAccountStore();

const saving = ref(false);
const saved  = ref(false);
const error  = ref('');

const dateFormat   = ref('DD/MM/YYYY');
const itemsPerPage = ref('25');
const language     = ref('fr');
const sidebarCompact = ref(false);

watch(
  () => auth.account?.properties,
  (props) => {
    const u = props?.ui ?? {};
    dateFormat.value    = u.dateFormat    ?? 'DD/MM/YYYY';
    itemsPerPage.value  = String(u.itemsPerPage ?? 25);
    language.value      = u.language      ?? 'fr';
    sidebarCompact.value = u.sidebarCompact ?? false;
  },
  { immediate: true },
);

async function save() {
  saving.value = true;
  error.value  = '';
  try {
    const existing = auth.account?.properties ?? {};
    await accountStore.update({
      properties: {
        ...existing,
        ui: {
          ...(existing.ui ?? {}),
          dateFormat:     dateFormat.value,
          itemsPerPage:   Number(itemsPerPage.value) || 25,
          language:       language.value,
          sidebarCompact: sidebarCompact.value,
        },
      },
    });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } catch {
    error.value = 'Erreur lors de la sauvegarde.';
  } finally {
    saving.value = false;
  }
}

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'JJ/MM/AAAA  (31/12/2024)' },
  { value: 'MM/DD/YYYY', label: 'MM/JJ/AAAA  (12/31/2024)' },
  { value: 'YYYY-MM-DD', label: 'AAAA-MM-JJ  (2024-12-31)' },
  { value: 'DD.MM.YYYY', label: 'JJ.MM.AAAA  (31.12.2024)' },
];

const LANGUAGES = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'ar', label: '🇲🇦 العربية' },
];

const PAGE_SIZES = [
  { value: '10',  label: '10 lignes' },
  { value: '25',  label: '25 lignes' },
  { value: '50',  label: '50 lignes' },
  { value: '100', label: '100 lignes' },
];
</script>

<template>
  <div class="tab-page">
    <div class="tab-topbar">
      <div>
        <h2>Interface</h2>
        <p class="subtitle">Paramètres d'affichage et de présentation pour ce compte.</p>
      </div>
      <button class="save-btn" :disabled="saving" @click="save">
        {{ saving ? '…' : saved ? '✓ Sauvegardé' : 'Enregistrer' }}
      </button>
    </div>

    <p v-if="error" class="error-msg">{{ error }}</p>

    <!-- Display -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">🌐 Localisation</span>
      </div>
      <div class="fields">
        <div class="field-row">
          <div class="field-info">
            <span class="field-label">Langue</span>
            <span class="field-hint">Langue par défaut de l'interface</span>
          </div>
          <select v-model="language" class="field-select">
            <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
          </select>
        </div>
        <div class="field-row">
          <div class="field-info">
            <span class="field-label">Format de date</span>
            <span class="field-hint">Utilisé dans les tableaux et exports</span>
          </div>
          <select v-model="dateFormat" class="field-select">
            <option v-for="f in DATE_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Tables -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">📊 Tableaux</span>
      </div>
      <div class="fields">
        <div class="field-row">
          <div class="field-info">
            <span class="field-label">Éléments par page</span>
            <span class="field-hint">Nombre de lignes affichées par défaut dans les listes</span>
          </div>
          <select v-model="itemsPerPage" class="field-select">
            <option v-for="p in PAGE_SIZES" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Layout -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">🖥️ Disposition</span>
      </div>
      <div class="fields">
        <div class="field-row">
          <div class="field-info">
            <span class="field-label">Menu latéral compact</span>
            <span class="field-hint">Afficher uniquement les icônes dans la barre latérale</span>
          </div>
          <div class="toggle-wrap">
            <input type="checkbox" id="compact-toggle" v-model="sidebarCompact" class="toggle-input" />
            <label for="compact-toggle" class="toggle-track"><span class="toggle-thumb" /></label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-page { max-width: 620px; }

.tab-topbar {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 1.5rem; gap: 1rem;
}
.tab-topbar h2 { margin: 0 0 .2rem; font-size: 1.2rem; color: #1a1a2e; }
.subtitle { margin: 0; font-size: .875rem; color: #888; }

.save-btn {
  padding: .45rem 1.1rem; background: #6c63ff; color: white;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: .875rem; font-weight: 600; flex-shrink: 0;
}
.save-btn:disabled { opacity: .6; cursor: default; }
.error-msg { color: #e53e3e; font-size: .875rem; margin: 0 0 1rem; }

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

.fields { padding: .25rem 0; }

.field-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: .8rem 1.25rem; gap: 1rem;
}
.field-row + .field-row { border-top: 1px solid #f5f5f8; }

.field-info { display: flex; flex-direction: column; gap: .15rem; flex: 1; }
.field-label { font-size: .875rem; color: #1a1a2e; font-weight: 500; }
.field-hint  { font-size: .75rem; color: #aaa; }

.field-select {
  min-width: 200px; padding: .42rem .65rem;
  border: 1px solid #ddd; border-radius: 7px;
  font-size: .875rem; color: #1a1a2e;
  background: white; cursor: pointer;
}
.field-select:focus { outline: none; border-color: #6c63ff; }

.toggle-wrap { display: flex; align-items: center; }
.toggle-input { display: none; }
.toggle-track {
  width: 38px; height: 22px; background: #ddd;
  border-radius: 11px; position: relative; cursor: pointer; transition: background .2s;
}
.toggle-input:checked + .toggle-track { background: #6c63ff; }
.toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; background: white;
  border-radius: 50%; transition: transform .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(16px); }
</style>
