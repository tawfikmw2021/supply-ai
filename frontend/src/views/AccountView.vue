<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useAccountStore } from '../stores/account';

const auth = useAuthStore();
const accountStore = useAccountStore();

const isAdmin = computed(() => auth.user?.role === 'admin');

// ── Editable fields ───────────────────────────────────
const accountName = ref('');
const saving = ref(false);
const error = ref('');
const success = ref(false);

interface Prop { name: string; value: string }
const props = ref<Prop[]>([]);

function toRows(obj: Record<string, any>): Prop[] {
  return Object.entries(obj).map(([name, value]) => ({
    name,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

function toObject(rows: Prop[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const r of rows) {
    if (!r.name.trim()) continue;
    try { obj[r.name.trim()] = JSON.parse(r.value); }
    catch { obj[r.name.trim()] = r.value; }
  }
  return obj;
}

// Sync from store whenever account changes
watch(
  () => auth.account,
  (a) => {
    if (!a) return;
    accountName.value = a.name;
    props.value = toRows(a.properties);
  },
  { immediate: true },
);

function addProp() { props.value.push({ name: '', value: '' }); }
function removeProp(i: number) { props.value.splice(i, 1); }

async function save() {
  error.value = '';
  success.value = false;
  const duplicates = props.value.map(p => p.name.trim()).filter((n, i, a) => n && a.indexOf(n) !== i);
  if (duplicates.length) { error.value = `Noms en double : ${duplicates.join(', ')}`; return; }

  saving.value = true;
  try {
    await accountStore.update({ name: accountName.value, properties: toObject(props.value) });
    success.value = true;
    setTimeout(() => { success.value = false; }, 2500);
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Erreur lors de la sauvegarde';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Paramètres du compte</h1>
    </header>

    <div class="card">
      <section>
        <h2>Informations générales</h2>
        <label>Nom du compte</label>
        <input v-model="accountName" :disabled="!isAdmin" placeholder="Nom du compte" />
      </section>

      <section>
        <div class="section-header">
          <h2>Propriétés</h2>
          <button v-if="isAdmin" type="button" class="add-btn" @click="addProp">+ Ajouter</button>
        </div>
        <p class="hint">Les propriétés sont des données clé-valeur associées à votre compte (ex: devise, région…).</p>

        <div class="props-editor">
          <div v-if="props.length === 0" class="no-props">Aucune propriété.</div>
          <div v-for="(prop, i) in props" :key="i" class="prop-row">
            <input v-model="prop.name" :disabled="!isAdmin" placeholder="Nom" class="prop-name" />
            <span class="sep">=</span>
            <input v-model="prop.value" :disabled="!isAdmin" placeholder="Valeur" class="prop-value" />
            <button v-if="isAdmin" type="button" class="del-btn" @click="removeProp(i)">✕</button>
          </div>
        </div>
      </section>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">Sauvegardé ✓</div>

      <div class="actions">
        <span class="account-id">ID compte : {{ auth.account?.id }}</span>
        <button v-if="isAdmin" class="save-btn" :disabled="saving" @click="save">
          {{ saving ? 'Sauvegarde…' : 'Enregistrer' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 1.5rem; max-width: 640px; box-sizing: border-box; }

.topbar { margin-bottom: 1.5rem; }
.topbar h1 { margin: 0; font-size: 1.5rem; color: #1a1a2e; }

.card { background: white; border-radius: 12px; padding: 1.75rem; box-shadow: 0 2px 8px rgba(0,0,0,.07); display: flex; flex-direction: column; gap: 1.5rem; }

section { display: flex; flex-direction: column; gap: .5rem; }
h2 { margin: 0; font-size: 1rem; color: #1a1a2e; }

.section-header { display: flex; justify-content: space-between; align-items: center; }
.add-btn { padding: .2rem .6rem; font-size: .78rem; font-weight: 600; color: #6c63ff; border: 1px solid #6c63ff; background: transparent; border-radius: 6px; cursor: pointer; }
.add-btn:hover { background: #6c63ff; color: white; }

.hint { margin: 0; font-size: .8rem; color: #888; }

label { font-size: .875rem; color: #555; }
input { padding: .55rem .75rem; border: 1px solid #ddd; border-radius: 8px; font-size: .9rem; font-family: inherit; width: 100%; box-sizing: border-box; }
input:focus { outline: none; border-color: #6c63ff; }
input:disabled { background: #f9f9f9; color: #888; cursor: default; }

.props-editor { border: 1px solid #eee; border-radius: 8px; padding: .4rem; display: flex; flex-direction: column; gap: .3rem; }
.no-props { font-size: .8rem; color: #bbb; padding: .4rem .2rem; }

.prop-row { display: grid; grid-template-columns: 1fr auto 1.4fr auto; align-items: center; gap: .35rem; }
.prop-name { font-weight: 600; }
.prop-value { font-family: monospace; }
.sep { color: #aaa; font-size: .85rem; text-align: center; }
.del-btn { padding: .2rem .4rem; border: none; background: transparent; color: #bbb; cursor: pointer; border-radius: 4px; }
.del-btn:hover { background: #fee2e2; color: #ef4444; }

.error { color: #e53e3e; font-size: .875rem; }
.success { color: #10b981; font-size: .875rem; }

.actions { display: flex; justify-content: space-between; align-items: center; padding-top: .5rem; border-top: 1px solid #f0f0f0; }
.account-id { font-size: .8rem; color: #bbb; font-family: monospace; }
.save-btn { padding: .6rem 1.4rem; background: #6c63ff; color: white; border: none; border-radius: 8px; font-size: .9rem; font-weight: 600; cursor: pointer; }
.save-btn:hover { opacity: .9; }
.save-btn:disabled { opacity: .6; cursor: not-allowed; }
</style>
