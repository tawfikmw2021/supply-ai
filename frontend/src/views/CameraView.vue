<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { usePhotoInboxStore } from '../stores/photoInbox';
import { useAuthStore } from '../stores/auth';

const auth  = useAuthStore();
const inbox = usePhotoInboxStore();

// Connect as 'mobile' so photos go to desktop
onMounted(() => {
  if (auth.token) inbox.connect(auth.token, 'mobile');
});
onUnmounted(() => {
  // Don't disconnect — just leave; AppLayout keeps the desktop WS open
  // But the mobile role WS is separate, so we close it here
  inbox.disconnect();
  // Reconnect as desktop for this tab (if needed)
  if (auth.token) inbox.connect(auth.token, 'desktop');
});

// ── Camera / file ─────────────────────────────────────────────────────────────
const fileInput  = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const status     = ref<'idle' | 'preview' | 'sending' | 'sent' | 'error'>('idle');
const errMsg     = ref('');
let pendingDataUrl = '';
let pendingMime    = 'image/jpeg';

function takePhoto() { fileInput.value?.click(); }

function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (fileInput.value) fileInput.value.value = '';
  pendingMime = file.type || 'image/jpeg';

  const reader = new FileReader();
  reader.onload = () => {
    pendingDataUrl  = reader.result as string;
    previewUrl.value = pendingDataUrl;
    status.value    = 'preview';
  };
  reader.readAsDataURL(file);
}

function send() {
  if (!pendingDataUrl || !inbox.wsConnected) { errMsg.value = 'Non connecté au serveur.'; status.value = 'error'; return; }
  status.value = 'sending';
  inbox.sendPhoto(pendingDataUrl, pendingMime);
  // Optimistically go to sent; server sends ack but we don't wait for it here
  setTimeout(() => { status.value = 'sent'; }, 400);
}

function retake() {
  previewUrl.value = null;
  pendingDataUrl   = '';
  status.value     = 'idle';
  errMsg.value     = '';
}

function sendAnother() {
  retake();
}
</script>

<template>
  <div class="camera-page">
    <div class="camera-card">

      <!-- Header -->
      <div class="cam-header">
        <span class="cam-icon">📷</span>
        <h1>Caméra</h1>
        <p class="cam-sub">Envoyez une photo à votre session PC</p>
      </div>

      <!-- Connection indicator -->
      <div class="conn-row">
        <span class="conn-dot" :class="{ on: inbox.wsConnected }"></span>
        <span>{{ inbox.wsConnected ? 'Connecté au serveur' : 'Connexion…' }}</span>
      </div>

      <!-- Status banner -->
      <div class="status-bar" :class="status">
        <span v-if="status === 'idle'">Appuyez sur le bouton pour prendre ou choisir une photo.</span>
        <span v-else-if="status === 'preview'">Photo prête — vérifiez et envoyez.</span>
        <span v-else-if="status === 'sending'">📤 Envoi en cours…</span>
        <span v-else-if="status === 'sent'">✅ Photo envoyée au PC !</span>
        <span v-else-if="status === 'error'">❌ {{ errMsg }}</span>
      </div>

      <!-- Preview -->
      <div v-if="previewUrl" class="preview-wrap">
        <img :src="previewUrl" class="preview-img" alt="Aperçu" />
      </div>

      <!-- Placeholder when no photo -->
      <div v-else class="preview-placeholder">
        <span>🖼️</span>
        <p>Aucune photo</p>
      </div>

      <!-- Buttons -->
      <div class="cam-actions">
        <template v-if="status === 'idle' || status === 'error'">
          <button class="btn primary" @click="takePhoto" :disabled="!inbox.wsConnected">
            📷 Prendre / Choisir une photo
          </button>
        </template>

        <template v-else-if="status === 'preview'">
          <button class="btn primary" @click="send">📤 Envoyer au PC</button>
          <button class="btn secondary" @click="retake">🔄 Reprendre</button>
        </template>

        <template v-else-if="status === 'sent'">
          <button class="btn primary" @click="sendAnother">📷 Envoyer une autre</button>
        </template>

        <template v-else-if="status === 'sending'">
          <button class="btn primary" disabled>📤 Envoi…</button>
        </template>
      </div>

      <!-- Hidden file input -->
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        style="display:none"
        @change="onFile"
      />

    </div>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }

.camera-page {
  min-height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2rem 1rem;
  background: #f0f2f5;
}

.camera-card {
  background: white;
  border-radius: 1.25rem;
  padding: 2rem 1.5rem;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  box-shadow: 0 4px 24px rgba(0,0,0,.1);
}

/* Header */
.cam-header { text-align: center; }
.cam-icon   { font-size: 2.5rem; line-height: 1; }
h1 { margin: .3rem 0 .15rem; font-size: 1.5rem; color: #1a1a2e; }
.cam-sub { margin: 0; font-size: .85rem; color: #888; }

/* Connection */
.conn-row {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: .82rem;
  color: #555;
}
.conn-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
  background: #d1d5db;
  flex-shrink: 0;
  transition: background .3s;
}
.conn-dot.on { background: #10b981; }

/* Status */
.status-bar {
  padding: .55rem 1rem;
  border-radius: .6rem;
  font-size: .875rem;
  text-align: center;
  font-weight: 500;
}
.status-bar.idle     { background: #f1f5f9; color: #475569; }
.status-bar.preview  { background: #eff6ff; color: #3b82f6; }
.status-bar.sending  { background: #eef2ff; color: #6366f1; }
.status-bar.sent     { background: #f0fdf4; color: #16a34a; }
.status-bar.error    { background: #fef2f2; color: #dc2626; }

/* Preview */
.preview-wrap { border-radius: .85rem; overflow: hidden; }
.preview-img  { width: 100%; display: block; }

.preview-placeholder {
  height: 180px;
  border: 2px dashed #e2e8f0;
  border-radius: .85rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
  font-size: 2rem;
  gap: .5rem;
}
.preview-placeholder p { margin: 0; font-size: .85rem; }

/* Buttons */
.cam-actions { display: flex; flex-direction: column; gap: .65rem; }

.btn {
  width: 100%;
  padding: .85rem;
  border: none;
  border-radius: .75rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .15s, transform .1s;
}
.btn:active   { transform: scale(.97); }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn.primary  { background: #6366f1; color: white; }
.btn.primary:hover:not(:disabled)   { background: #4f46e5; }
.btn.secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn.secondary:hover:not(:disabled) { background: #e2e8f0; }
</style>
