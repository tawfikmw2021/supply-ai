<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useColumnSettingsStore } from '../stores/columnSettings';
import { PG_GROUPS, type NavGroup, type NavChild } from '../data/pgGroups';
import HelpBot from '../components/HelpBot.vue';

const route  = useRoute();
const router = useRouter();
const auth   = useAuthStore();
const colCfg = useColumnSettingsStore();

const base        = computed(() => `/accounts/${auth.user?.account_id ?? route.params.accountId}`);
const isAdmin     = computed(() => auth.user?.role === 'admin');
const effectiveAdmin = computed(() => isAdmin.value && !auth.viewAsUser);

function screenEnabled(key: string): boolean {
  const screens = auth.account?.properties?.screens ?? {};
  return screens[key] !== false;
}

// ── Two-level nav definition ──────────────────────────────────────────────────
interface NavFlat { path: string; label: string; icon: string; key?: string; adminOnly?: boolean }

const pgGroups = computed(() => PG_GROUPS);

// ── Flat legacy nav items (non-PG screens) ────────────────────────────────────
const legacyItems = computed<NavFlat[]>(() => [
    { path: `${base.value}/invoices`,      label: 'Factures',  icon: '🏷️', adminOnly: false },
  { path: `${base.value}/loaders`,         label: 'Chargeurs',    icon: '📥', key: 'loaders' },
  { path: `${base.value}/documents`,       label: 'Documents',    icon: '📄', key: 'documents' },
  { path: `${base.value}/column-settings`, label: 'Colonnes',     icon: '🗃️', adminOnly: true },
  { path: `${base.value}/categories`,      label: 'Familles DB',  icon: '🏷️', adminOnly: true },
    { path: `${base.value}/deliveries`,      label: 'Livraisons',  icon: '🏷️', adminOnly: false },
  { path: `${base.value}/products`,      label: 'Articles',  icon: '🏷️', adminOnly: false },

  { path: `${base.value}/dashboard`,      label: 'Dashboard',  icon: '', adminOnly: true },
  { path: `${base.value}/users`,           label: 'Utilisateurs', icon: '👤', adminOnly: true },
  { path: `${base.value}/templates`,       label: 'Modèles',      icon: '🖨️', adminOnly: true },
  { path: `${base.value}/settings`,        label: 'Accès',        icon: '🔐', adminOnly: true },
  { path: `${base.value}/audit`,           label: 'Audit',        icon: '🕵️', adminOnly: true },
  { path: `${base.value}/alerts`,          label: 'Alertes',      icon: '🔔', adminOnly: true },
  { path: `${base.value}/help`,            label: 'Aide',         icon: '💬', adminOnly: true },
].filter(item => {
  if (item.adminOnly) return effectiveAdmin.value;
  return effectiveAdmin.value || screenEnabled(item.key ?? '');
}));

// ── Expand/collapse state (persisted in localStorage) ────────────────────────
function loadExpanded(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem('nav_expanded') ?? '{}'); }
  catch { return {}; }
}
const expanded = ref<Record<string, boolean>>(loadExpanded());

function toggleGroup(id: string) {
  expanded.value[id] = !expanded.value[id];
  localStorage.setItem('nav_expanded', JSON.stringify(expanded.value));
}

function isGroupActive(group: NavGroup): boolean {
  return group.children.some(c => {
    const path = c.path ?? `${base.value}/pg/${c.table}`;
    return route.path === path || route.path.startsWith(path + '/');
  });
}

function childPath(c: NavChild): string {
  return c.path ?? `${base.value}/pg/${c.table}`;
}

// Auto-expand the active group
watch(() => route.path, () => {
  for (const g of pgGroups.value) {
    if (isGroupActive(g)) {
      expanded.value[g.id] = true;
      localStorage.setItem('nav_expanded', JSON.stringify(expanded.value));
      break;
    }
  }
}, { immediate: true });

// Redirect off admin pages on user-view
watch(() => auth.viewAsUser, (asUser) => {
  if (asUser && route.matched.some(r => r.meta.requiresAdmin)) {
    router.push(`${base.value}/pg/article`);
  }
});

watch(() => route.path, (path) => {
  localStorage.setItem('lastRoute', path);
}, { immediate: true });

onMounted(() => colCfg.fetchAllHidden());

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-icon">⬡</span>
        <span class="logo-text">Supply AI</span>
      </div>

      <nav class="nav">
        <!-- PG Groups (two-level) -->
        <template v-for="group in pgGroups" :key="group.id">
          <div
            v-if="(!group.adminOnly || effectiveAdmin) && group.children.some(c => colCfg.hiddenTables[c.table ?? ''] === false)"
            class="nav-group"
          >
            <!-- Group header (level 1) -->
            <button
              class="nav-group-btn"
              :class="{ active: isGroupActive(group), open: expanded[group.id] }"
              @click="toggleGroup(group.id)"
            >
              <span class="nav-icon">{{ group.icon }}</span>
              <span class="nav-label">{{ group.label }}</span>
              <span class="chevron">{{ expanded[group.id] ? '▾' : '▸' }}</span>
            </button>

            <!-- Children (level 2) -->
            <div class="nav-children" v-show="expanded[group.id]">
              <RouterLink
                v-for="child in group.children.filter(c => colCfg.hiddenTables[c.table ?? ''] === false)"
                :key="childPath(child)"
                :to="childPath(child)"
                class="nav-child"
                :class="{ active: route.path === childPath(child) }"
              >
                {{ child.label }}
              </RouterLink>
            </div>
          </div>
        </template>

        <!-- Separator -->
        <div class="nav-sep"></div>

        <!-- Flat legacy items -->
        <RouterLink
          v-for="item in legacyItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="user-section">
        <div v-if="auth.user" class="user-info">
          <div class="avatar">{{ auth.user.name[0].toUpperCase() }}</div>
          <div class="user-details">
            <p class="user-name">{{ auth.user.name }}</p>
            <p class="user-role">{{ auth.account?.name ?? auth.user.role }}</p>
          </div>
        </div>

        <div v-if="isAdmin" class="view-toggle">
          <label class="view-opt" :class="{ active: !auth.viewAsUser }">
            <input type="radio" name="viewMode" :value="false" v-model="auth.viewAsUser" />
            Admin
          </label>
          <label class="view-opt" :class="{ active: auth.viewAsUser }">
            <input type="radio" name="viewMode" :value="true" v-model="auth.viewAsUser" />
            Utilisateur
          </label>
        </div>

        <button class="logout-btn" @click="logout">Déconnexion</button>
      </div>
    </aside>

    <main class="content">
      <RouterView />
    </main>

    <HelpBot />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
}

/* ── Sidebar ─────────────────────────────────────────── */
.sidebar {
  width: 230px;
  flex-shrink: 0;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}

.logo {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: 1.2rem 1.2rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.logo-icon { font-size: 1.3rem; }
.logo-text { font-size: 1rem; font-weight: 700; color: white; letter-spacing: .02em; }

.nav {
  flex: 1;
  padding: .5rem 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.nav::-webkit-scrollbar { width: 4px; }
.nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 2px; }

/* ── Level-1 group button ─────────────────────────── */
.nav-group { }

.nav-group-btn {
  display: flex;
  align-items: center;
  width: 100%;
  gap: .6rem;
  padding: .55rem 1rem .55rem 1.1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(255,255,255,.6);
  font-size: .875rem;
  text-align: left;
  border-left: 3px solid transparent;
  transition: background .12s, color .12s;
}
.nav-group-btn:hover {
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.9);
}
.nav-group-btn.active {
  color: white;
  border-left-color: #6c63ff;
}
.nav-group-btn.open {
  background: rgba(108,99,255,.15);
  color: white;
}

.nav-label { flex: 1; }
.nav-icon   { font-size: .95rem; width: 1.2rem; text-align: center; }
.chevron    { font-size: .65rem; color: rgba(255,255,255,.35); transition: transform .15s; }

/* ── Level-2 children ─────────────────────────────── */
.nav-children {
  padding: .2rem 0 .4rem 0;
  border-left: 2px solid rgba(108,99,255,.3);
  margin-left: 1.6rem;
}

.nav-child {
  display: block;
  padding: .38rem .75rem;
  font-size: .815rem;
  color: rgba(255,255,255,.5);
  text-decoration: none;
  border-left: 2px solid transparent;
  margin-left: -2px;
  transition: color .12s, background .12s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-child:hover  { color: rgba(255,255,255,.85); background: rgba(255,255,255,.04); }
.nav-child.active { color: #a5a0ff; border-left-color: #6c63ff; background: rgba(108,99,255,.12); }

/* ── Separator ────────────────────────────────────── */
.nav-sep {
  height: 1px;
  background: rgba(255,255,255,.08);
  margin: .5rem .8rem;
}

/* ── Flat nav items ───────────────────────────────── */
.nav-item {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .5rem 1rem .5rem 1.1rem;
  color: rgba(255,255,255,.5);
  text-decoration: none;
  font-size: .855rem;
  border-left: 3px solid transparent;
  transition: background .12s, color .12s;
}
.nav-item:hover { background: rgba(255,255,255,.06); color: rgba(255,255,255,.85); }
.nav-item.active { background: rgba(108,99,255,.25); color: white; border-left-color: #6c63ff; }

/* ── User section ─────────────────────────────────── */
.user-section { padding: .85rem 1rem; border-top: 1px solid rgba(255,255,255,.08); }
.user-info { display: flex; align-items: center; gap: .55rem; margin-bottom: .5rem; }
.avatar { width: 30px; height: 30px; border-radius: 50%; background: #6c63ff; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: .8rem; flex-shrink: 0; }
.user-details { overflow: hidden; }
.user-name  { margin: 0; font-size: .82rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-role  { margin: 0; font-size: .7rem; color: rgba(255,255,255,.4); }

.view-toggle { display: flex; gap: .3rem; margin-bottom: .5rem; background: rgba(255,255,255,.06); border-radius: 8px; padding: .2rem; }
.view-opt { flex: 1; display: flex; align-items: center; justify-content: center; padding: .25rem .3rem; border-radius: 6px; font-size: .7rem; color: rgba(255,255,255,.45); cursor: pointer; user-select: none; transition: background .12s, color .12s; }
.view-opt input[type="radio"] { display: none; }
.view-opt.active { background: rgba(108,99,255,.5); color: white; font-weight: 600; }
.view-opt:not(.active):hover { color: rgba(255,255,255,.7); }

.logout-btn { width: 100%; padding: .4rem; background: transparent; border: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.5); border-radius: 6px; cursor: pointer; font-size: .78rem; transition: background .12s, color .12s; }
.logout-btn:hover { background: rgba(229,62,62,.25); border-color: #e53e3e; color: #fc8181; }

/* ── Content ──────────────────────────────────────── */
.content { flex: 1; overflow-y: auto; min-width: 0; }
</style>
