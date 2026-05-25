<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useHelpStore, type HelpItem } from '../stores/help';

const store = useHelpStore();

// ── Update from URL ───────────────────────────────────────
const isElectron = !!(window as any).electronAPI?.isElectron;
const updateUrl = ref('');
const updateState = ref<'idle' | 'downloading' | 'done' | 'error'>('idle');
const updateProgress = ref(0);
const updateError = ref('');

async function installUpdate() {
  if (!updateUrl.value.trim()) return;
  updateState.value = 'downloading';
  updateProgress.value = 0;
  updateError.value = '';

  const api = (window as any).electronAPI;
  const unsub = api.onUpdateProgress((pct: number) => {
    if (pct >= 0) updateProgress.value = pct;
  });

  try {
    await api.updateFromUrl(updateUrl.value.trim());
    updateState.value = 'done';
  } catch (e: any) {
    updateState.value = 'error';
    updateError.value = e?.message ?? 'Erreur de téléchargement';
  } finally {
    unsub();
  }
}

const filterType = ref('');
const filterStatus = ref('');
const loading = ref(true);

const TYPES = [
  { key: 'task', label: 'Tâche', icon: '✅', color: '#6c63ff' },
  { key: 'bug', label: 'Bug', icon: '🐛', color: '#ef4444' },
  { key: 'question', label: 'Question', icon: '❓', color: '#f59e0b' },
  { key: 'suggestion', label: 'Suggestion', icon: '💡', color: '#10b981' },
];

const STATUSES = [
  { key: 'open', label: 'Ouvert', color: '#6c63ff' },
  { key: 'in_progress', label: 'En cours', color: '#f59e0b' },
  { key: 'done', label: 'Terminé', color: '#10b981' },
  { key: 'closed', label: 'Fermé', color: '#aaa' },
  { key: 'rejected', label: 'Rejeté', color: '#6c6300' },
];

function typeInfo(key: string) { return TYPES.find(t => t.key === key) ?? { label: key, icon: '•', color: '#aaa' }; }
function statusInfo(key: string) { return STATUSES.find(s => s.key === key) ?? { label: key, color: '#aaa' }; }

async function load() {
  loading.value = true;
  await store.fetchAll({
    ...(filterType.value ? { type: filterType.value } : {}),
    ...(filterStatus.value ? { status: filterStatus.value } : {}),
  });
  loading.value = false;
}

async function setStatus(item: HelpItem, status: string) {
  await store.updateStatus(item.id, status);
}

async function del(item: HelpItem) {
  if (!confirm(`Supprimer ce message de "${item.user_name}" ?`)) return;
  await store.remove(item.id);
}

function mediaKind(url: string): 'image' | 'audio' | 'video' {
  const ext = url.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'ogg', 'wav', 'm4a', 'aac'].includes(ext)) return 'audio';
  return 'image';
}

// ── Detail modal ──────────────────────────────────────
const detailItem = ref<HelpItem | null>(null);
const dRemarks = ref('');
const dDetails = ref('');
const dStatus = ref('');
const dSaving = ref(false);
const dSaveError = ref('');

function openDetail(item: HelpItem) {
  detailItem.value = item;
  dRemarks.value = item.remarks ?? '';
  dDetails.value = item.details ?? '';
  dStatus.value = item.status;
  dSaveError.value = '';
}
function closeDetail() { detailItem.value = null; }

async function saveDetail() {
  if (!detailItem.value) return;
  dSaving.value = true;
  dSaveError.value = '';
  try {
    await store.updateItem(detailItem.value.id, {
      status: dStatus.value,
      remarks: dRemarks.value,
      details: dDetails.value,
    });
    closeDetail();
  } catch {
    dSaveError.value = 'Erreur lors de la sauvegarde.';
  } finally {
    dSaving.value = false;
  }
}

// ── Lightbox ──────────────────────────────────────────
const preview = ref<{ url: string; kind: 'image' | 'audio' | 'video' } | null>(null);

function openPreview(url: string) {
  preview.value = { url, kind: mediaKind(url) };
}
function closePreview() {
  preview.value = null;
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (preview.value) { closePreview(); return; }
    if (detailItem.value) { closeDetail(); return; }
  }
}
onMounted(() => { load(); window.addEventListener('keydown', onKey); });
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>Demandes d'aide</h1>
      <span class="count">{{ store.items.length }} résultat{{ store.items.length !== 1 ? 's' : '' }}</span>
    </header>

    <!-- Update from URL (Electron only) -->
    <div v-if="isElectron" class="update-box">
      <p class="update-title">Mettre à jour l'application</p>
      <div class="update-row">
        <input
          v-model="updateUrl"
          class="update-input"
          placeholder="https://example.com/supply-ai.exe"
          :disabled="updateState === 'downloading'"
        />
        <button class="update-btn" :disabled="!updateUrl.trim() || updateState === 'downloading'" @click="installUpdate">
          {{ updateState === 'downloading' ? 'Téléchargement…' : 'Installer' }}
        </button>
      </div>
      <div v-if="updateState === 'downloading'" class="progress-wrap">
        <div class="progress-bar" :style="{ width: updateProgress > 0 ? updateProgress + '%' : '100%', opacity: updateProgress > 0 ? 1 : 0.5 }" />
        <span class="progress-label">{{ updateProgress > 0 ? updateProgress + ' %' : '…' }}</span>
      </div>
      <p v-if="updateState === 'error'" class="update-error">{{ updateError }}</p>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="filterType" @change="load" class="filter-sel">
        <option value="">Tous les types</option>
        <option v-for="t in TYPES" :key="t.key" :value="t.key">{{ t.icon }} {{ t.label }}</option>
      </select>
      <select v-model="filterStatus" @change="load" class="filter-sel">
        <option value="">Tous les statuts</option>
        <option v-for="s in STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
      </select>
      <button class="refresh-btn" @click="load">↺ Actualiser</button>
    </div>

    <p v-if="loading" class="msg">Chargement…</p>

    <div v-else-if="store.items.length === 0" class="empty">
      <div class="empty-icon">💬</div>
      <p>Aucune demande pour l'instant.</p>
    </div>

    <div v-else class="table-wrap">
      <table class="htable">
        <thead>
          <tr>
            <th>Type</th>
            <th>Message</th>
            <th>Page</th>
            <th>Remarque</th>
            <th>Utilisateur</th>
            <th>Statut</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.items" :key="item.id" class="clickable-row" @click="openDetail(item)">
            <td>
              <span class="type-badge"
                :style="{ background: typeInfo(item.type).color + '1a', color: typeInfo(item.type).color }">
                {{ typeInfo(item.type).icon }} {{ typeInfo(item.type).label }}
              </span>
            </td>
            <td class="msg-cell">
              <div>{{ item.message }}</div>
              <div v-if="item.attachments?.length" class="attach-row">
                <button v-for="(url, i) in item.attachments" :key="i" class="attach-btn"
                  :title="mediaKind(url) === 'image' ? 'Voir la photo' : mediaKind(url) === 'audio' ? 'Écouter' : 'Regarder'"
                  @click.stop="openPreview(url)">
                  <img v-if="mediaKind(url) === 'image'" :src="url" class="attach-thumb" />
                  <span v-else-if="mediaKind(url) === 'audio'" class="attach-icon">🎤</span>
                  <span v-else class="attach-icon">🎬</span>
                </button>
              </div>
            </td>
            <td class="page-cell">
              <RouterLink v-if="item.page_url" :to="item.page_url" class="page-url" :title="item.page_url">
                {{ item.page_url }}
              </RouterLink>
              <span v-else class="empty">—</span>
            </td>
            <td class="remark-cell">{{ item.remarks || '—' }}</td>
            <td class="user-cell" >{{ item.user_name || '—' }}</td>
            <td>
              <select class="status-sel" :value="item.status" :style="{ color: statusInfo(item.status).color }"
                @click.stop @change="setStatus(item, ($event.target as HTMLSelectElement).value)">
                <option v-for="s in STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
              </select>
            </td>
            <td class="date-cell">{{ new Date(item.created_at).toLocaleString('fr-FR', {
              dateStyle: 'short', timeStyle:
                'short'
            }) }}</td>
            <td>
              <button class="del-btn" title="Supprimer" @click.stop="del(item)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Detail modal ─────────────────────────────── -->
    <Transition name="lb">
      <div v-if="detailItem" class="lb-backdrop detail-backdrop" @click.self="closeDetail">
        <div class="detail-modal">

          <!-- Header -->
          <div class="dm-header">
            <div class="dm-header-left">
              <span class="type-badge"
                :style="{ background: typeInfo(detailItem.type).color + '1a', color: typeInfo(detailItem.type).color }">
                {{ typeInfo(detailItem.type).icon }} {{ typeInfo(detailItem.type).label }}
              </span>
              <span class="dm-user">{{ detailItem.user_name || '—' }}</span>
              <span class="dm-date">{{ new Date(detailItem.created_at).toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short'
              }) }}</span>
            </div>
            <button class="dm-close" @click="closeDetail">✕</button>
          </div>

          <div class="dm-body">
            <!-- Original message -->
            <div class="dm-section">
              <p class="dm-label">Message</p>
              <p class="dm-message">{{ detailItem.message }}</p>
            </div>

            <!-- Page URL -->
            <div v-if="detailItem.page_url" class="dm-section">
              <p class="dm-label">Page</p>
              <RouterLink :to="detailItem.page_url" class="page-url" @click="closeDetail">{{ detailItem.page_url }}
              </RouterLink>
            </div>

            <!-- Attachments -->
            <div v-if="detailItem.attachments?.length" class="dm-section">
              <p class="dm-label">Pièces jointes</p>
              <div class="attach-row">
                <button v-for="(url, i) in detailItem.attachments" :key="i" class="attach-btn"
                  @click="openPreview(url)">
                  <img v-if="mediaKind(url) === 'image'" :src="url" class="attach-thumb" />
                  <span v-else-if="mediaKind(url) === 'audio'" class="attach-icon">🎤</span>
                  <span v-else class="attach-icon">🎬</span>
                </button>
              </div>
            </div>

            <!-- Status -->
            <div class="dm-section">
              <p class="dm-label">Statut</p>
              <select v-model="dStatus" class="status-sel">
                <option v-for="s in STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
              </select>
            </div>

            <!-- Remarks -->
            <div class="dm-section">
              <p class="dm-label">Remarques</p>
              <textarea v-model="dRemarks" class="dm-textarea" rows="3" placeholder="Remarques visibles / réponse…" />
            </div>

            <!-- Details -->
            <div class="dm-section">
              <p class="dm-label">Détails internes</p>
              <textarea v-model="dDetails" class="dm-textarea" rows="3"
                placeholder="Notes internes, diagnostic, contexte technique…" />
            </div>

            <p v-if="dSaveError" class="dm-error">{{ dSaveError }}</p>
          </div>

          <!-- Footer -->
          <div class="dm-footer">
            <button class="dm-cancel" @click="closeDetail">Annuler</button>
            <button class="dm-save" :disabled="dSaving" @click="saveDetail">
              {{ dSaving ? '…' : 'Enregistrer' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>

    <!-- Lightbox -->
    <Transition name="lb">
      <div v-if="preview" class="lb-backdrop" @click.self="closePreview">
        <div class="lb-box">
          <button class="lb-close" @click="closePreview">✕</button>

          <img v-if="preview.kind === 'image'" :src="preview.url" class="lb-img" @click.stop />

          <audio v-else-if="preview.kind === 'audio'" :src="preview.url" controls autoplay class="lb-audio"
            @click.stop />

          <video v-else :src="preview.url" controls autoplay class="lb-video" @click.stop />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page {
  padding: 1.5rem;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.topbar h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #1a1a2e;
}

.count {
  font-size: .82rem;
  color: #aaa;
}

.filters {
  display: flex;
  gap: .6rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.filter-sel {
  padding: .38rem .7rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  font-size: .82rem;
  background: white;
  color: #333;
  cursor: pointer;
  outline: none;
}

.filter-sel:focus {
  border-color: #6c63ff;
}

.refresh-btn {
  padding: .38rem .9rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  font-size: .82rem;
  cursor: pointer;
  color: #555;
}

.refresh-btn:hover {
  border-color: #6c63ff;
  color: #6c63ff;
}

.msg {
  color: #888;
}

.empty {
  text-align: center;
  padding: 4rem 2rem;
  color: #aaa;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: .75rem;
}

.empty p {
  margin: 0;
  font-size: .95rem;
}

.table-wrap {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 14px;
  overflow: clip;
}

.htable {
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
}

.htable thead tr {
  background: #fafafa;
}

.htable th {
  padding: .7rem 1rem;
  text-align: left;
  font-size: .75rem;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: .04em;
  border-bottom: 1px solid #f0f0f0;
}

.htable td {
  padding: .7rem 1rem;
  border-bottom: 1px solid #f7f7f7;
  vertical-align: top;
}

.htable tbody tr:last-child td {
  border-bottom: none;
}

.htable tbody tr:hover {
  background: #fafafa;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: .2rem .55rem;
  border-radius: 20px;
  font-size: .75rem;
  font-weight: 600;
  white-space: nowrap;
}

.msg-cell {
  max-width: 360px;
  word-break: break-word;
  color: #333;
}

.attach-row {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
  margin-top: .5rem;
}

.attach-btn {
  padding: 0;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
  cursor: pointer;
  overflow: hidden;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color .15s, transform .1s;
  flex-shrink: 0;
}

.attach-btn:hover {
  border-color: #6c63ff;
  transform: scale(1.06);
}

.attach-thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  display: block;
}

.attach-icon {
  font-size: 1.6rem;
  line-height: 1;
}

/* Lightbox */
.lb-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, .82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.lb-box {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lb-close {
  position: absolute;
  top: -2.2rem;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  padding: .2rem .4rem;
  opacity: .8;
  transition: opacity .15s;
}

.lb-close:hover {
  opacity: 1;
}

.lb-img {
  max-width: 88vw;
  max-height: 85vh;
  border-radius: 10px;
  display: block;
  object-fit: contain;
}

.lb-audio {
  width: min(480px, 88vw);
}

.lb-video {
  max-width: 88vw;
  max-height: 82vh;
  border-radius: 10px;
  display: block;
}

/* Lightbox transition */
.lb-enter-active,
.lb-leave-active {
  transition: opacity .18s;
}

.lb-enter-from,
.lb-leave-to {
  opacity: 0;
}

.user-cell {
  color: #555;
  white-space: nowrap;
}

.page-cell {
  max-width: 200px;
}

.page-url {
  font-size: .75rem;
  color: #6c63ff;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  max-width: 180px;
  text-decoration: none;
}

.page-url:hover {
  text-decoration: underline;
}

.empty {
  color: #ccc;
}

.date-cell {
  color: #aaa;
  font-size: .78rem;
  white-space: nowrap;
}

.status-sel {
  border: 1.5px solid #e0e0e0;
  border-radius: 7px;
  padding: .22rem .45rem;
  font-size: .78rem;
  font-weight: 600;
  background: white;
  cursor: pointer;
  outline: none;
}

.status-sel:focus {
  border-color: #6c63ff;
}

.del-btn {
  padding: .2rem .4rem;
  border: 1px solid #e8e8e8;
  border-radius: 5px;
  background: white;
  cursor: pointer;
  font-size: .75rem;
  color: #aaa;
}

.del-btn:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

/* ── Clickable rows ───────────────────────────────────── */
.clickable-row {
  cursor: pointer;
  transition: background .12s;
}

.clickable-row:hover {
  background: #f0eeff !important;
}

/* ── Detail modal ────────────────────────────────────── */
.detail-backdrop {
  align-items: center;
  justify-content: center;
}

.detail-modal {
  background: white;
  border-radius: 14px;
  width: min(580px, 96vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, .28);
  overflow: hidden;
}

.dm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f0f0f0;
  background: #fafbff;
  flex-shrink: 0;
}

.dm-header-left {
  display: flex;
  align-items: center;
  gap: .6rem;
  flex-wrap: wrap;
}

.dm-user {
  font-size: .82rem;
  font-weight: 600;
  color: #444;
}

.dm-date {
  font-size: .75rem;
  color: #aaa;
}

.dm-close {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: #aaa;
  padding: .2rem .4rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.dm-close:hover {
  background: #f0f0f0;
  color: #555;
}

.dm-body {
  padding: 1.1rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: .85rem;
}

.dm-section {
  display: flex;
  flex-direction: column;
  gap: .3rem;
}

.dm-label {
  margin: 0;
  font-size: .72rem;
  font-weight: 700;
  color: #999;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.dm-message {
  margin: 0;
  font-size: .9rem;
  color: #222;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f7f8ff;
  border-radius: 8px;
  padding: .6rem .8rem;
}

.dm-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: .55rem .75rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  font-size: .875rem;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color .15s;
  line-height: 1.5;
  color: #1a1a2e;
}

.dm-textarea:focus {
  border-color: #6c63ff;
}

.dm-error {
  margin: 0;
  font-size: .82rem;
  color: #ef4444;
}

.dm-footer {
  display: flex;
  justify-content: flex-end;
  gap: .6rem;
  padding: .9rem 1.25rem;
  border-top: 1px solid #f0f0f0;
  background: #fafbff;
  flex-shrink: 0;
}

.dm-cancel {
  padding: .5rem 1rem;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: .875rem;
  color: #555;
}

.dm-cancel:hover {
  border-color: #aaa;
}

.dm-save {
  padding: .5rem 1.3rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: .875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .15s;
}

.dm-save:hover:not(:disabled) {
  opacity: .88;
}

.dm-save:disabled {
  opacity: .6;
  cursor: not-allowed;
}

/* ── Update box ──────────────────────────────────────────── */
.update-box {
  background: white;
  border: 1.5px solid #e8e8e8;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
}

.update-title {
  margin: 0 0 .7rem;
  font-size: .82rem;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.update-row {
  display: flex;
  gap: .6rem;
}

.update-input {
  flex: 1;
  padding: .5rem .75rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  font-size: .875rem;
  outline: none;
  transition: border-color .15s;
}

.update-input:focus { border-color: #6c63ff; }

.update-btn {
  padding: .5rem 1.2rem;
  background: #6c63ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: .875rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity .15s;
}

.update-btn:hover:not(:disabled) { opacity: .88; }
.update-btn:disabled { opacity: .5; cursor: not-allowed; }

.progress-wrap {
  display: flex;
  align-items: center;
  gap: .6rem;
  margin-top: .6rem;
}

.progress-bar {
  height: 6px;
  background: #6c63ff;
  border-radius: 99px;
  transition: width .3s;
  flex: 1;
}

.progress-label {
  font-size: .75rem;
  color: #888;
  width: 3rem;
  text-align: right;
}

.update-error {
  margin: .5rem 0 0;
  font-size: .82rem;
  color: #ef4444;
}
</style>
