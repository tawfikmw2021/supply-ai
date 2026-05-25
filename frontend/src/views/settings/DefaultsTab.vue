<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useAccountStore } from '../../stores/account';

const auth         = useAuthStore();
const accountStore = useAccountStore();

const saving = ref(false);
const saved  = ref(false);
const error  = ref('');

const currency      = ref('EUR');
const tvaRate       = ref('20');
const unit          = ref('pcs');
const paymentTerms  = ref('30');
const deliveryDelay = ref('7');

watch(
  () => auth.account?.properties,
  (props) => {
    const d = props?.defaults ?? {};
    currency.value      = props?.currency           ?? 'EUR';
    tvaRate.value       = String(d.tvaRate          ?? 20);
    unit.value          = d.unit                    ?? 'pcs';
    paymentTerms.value  = String(d.paymentTerms     ?? 30);
    deliveryDelay.value = String(d.deliveryDelay    ?? 7);
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
        currency: currency.value,
        defaults: {
          ...(existing.defaults ?? {}),
          tvaRate:       Number(tvaRate.value)       || 0,
          unit:          unit.value,
          paymentTerms:  Number(paymentTerms.value)  || 30,
          deliveryDelay: Number(deliveryDelay.value) || 7,
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

const CURRENCIES = [
  { value: 'EUR', label: '€ Euro' },
  { value: 'USD', label: '$ Dollar US' },
  { value: 'GBP', label: '£ Livre sterling' },
  { value: 'MAD', label: 'DH Dirham marocain' },
  { value: 'DZD', label: 'DA Dinar algérien' },
  { value: 'TND', label: 'DT Dinar tunisien' },
];

const UNITS = [
  { value: 'pcs',  label: 'Pièces (pcs)' },
  { value: 'kg',   label: 'Kilogrammes (kg)' },
  { value: 'g',    label: 'Grammes (g)' },
  { value: 'L',    label: 'Litres (L)' },
  { value: 'mL',   label: 'Millilitres (mL)' },
  { value: 'm',    label: 'Mètres (m)' },
  { value: 'm²',   label: 'Mètres carrés (m²)' },
  { value: 'boîte',label: 'Boîtes' },
  { value: 'lot',  label: 'Lots' },
];
</script>

<template>
  <div class="tab-page">
    <div class="tab-topbar">
      <div>
        <h2>Valeurs par défaut</h2>
        <p class="subtitle">Pré-remplissage des champs lors de la création de nouveaux éléments.</p>
      </div>
      <button class="save-btn" :disabled="saving" @click="save">
        {{ saving ? '…' : saved ? '✓ Sauvegardé' : 'Enregistrer' }}
      </button>
    </div>

    <p v-if="error" class="error-msg">{{ error }}</p>

    <!-- Financial defaults -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">💰 Finance</span>
      </div>
      <div class="fields">
        <div class="field-row">
          <label class="field-label">Devise</label>
          <select v-model="currency" class="field-select">
            <option v-for="c in CURRENCIES" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label">Taux TVA par défaut</label>
          <div class="field-input-wrap">
            <input v-model="tvaRate" type="number" min="0" max="100" step="0.1" class="field-input" />
            <span class="field-unit">%</span>
          </div>
        </div>
        <div class="field-row">
          <label class="field-label">Délai de paiement</label>
          <div class="field-input-wrap">
            <input v-model="paymentTerms" type="number" min="0" class="field-input" />
            <span class="field-unit">jours</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Stock defaults -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">📦 Stock & livraisons</span>
      </div>
      <div class="fields">
        <div class="field-row">
          <label class="field-label">Unité de mesure par défaut</label>
          <select v-model="unit" class="field-select">
            <option v-for="u in UNITS" :key="u.value" :value="u.value">{{ u.label }}</option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label">Délai de livraison</label>
          <div class="field-input-wrap">
            <input v-model="deliveryDelay" type="number" min="0" class="field-input" />
            <span class="field-unit">jours</span>
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

.fields { padding: .5rem 0; }

.field-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: .7rem 1.25rem; gap: 1rem;
}
.field-row + .field-row { border-top: 1px solid #f5f5f8; }

.field-label {
  font-size: .875rem; color: #444; font-weight: 500;
  flex: 1;
}

.field-select {
  min-width: 200px;
  padding: .42rem .65rem;
  border: 1px solid #ddd; border-radius: 7px;
  font-size: .875rem; color: #1a1a2e;
  background: white; cursor: pointer;
}
.field-select:focus { outline: none; border-color: #6c63ff; }

.field-input-wrap {
  display: flex; align-items: center;
  border: 1px solid #ddd; border-radius: 7px;
  overflow: hidden; min-width: 120px;
}
.field-input {
  flex: 1; padding: .42rem .65rem;
  border: none; font-size: .875rem; color: #1a1a2e;
  width: 70px;
}
.field-input:focus { outline: none; }
.field-unit {
  padding: .42rem .65rem;
  background: #f5f5f8; color: #888;
  font-size: .8rem; border-left: 1px solid #ddd;
  white-space: nowrap;
}
</style>
