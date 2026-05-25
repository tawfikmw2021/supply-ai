<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { getBackendUrl } from '../api/index';

const route     = useRoute();
const sessionId = route.params.sessionId as string;

// ── WebSocket ─────────────────────────────────────────────────────────────────
type Status = 'connecting' | 'ready' | 'desktop_offline' | 'sending' | 'sent' | 'error';
const status  = ref<Status>('connecting');
const errMsg  = ref('');
let ws: WebSocket | null = null;

function buildWsUrl(): string {
  const base = getBackendUrl();
  const u    = new URL(base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/ws';
  u.search   = `?session=${sessionId}&role=mobile`;
  return u.toString();
}

function connect() {
  status.value = 'connecting';
  ws = new WebSocket(buildWsUrl());

  ws.onopen    = () => { status.value = 'ready'; };
  ws.onclose   = () => { if (status.value !== 'sent') status.value = 'error'; };
  ws.onerror   = () => { status.value = 'error'; errMsg.value = 'Connexion perdue.'; };

  ws.onmessage = (e) => {
    let msg: any;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'desktop_joined') { status.value = 'ready'; }
    if (msg.type === 'desktop_left')   { status.value = 'desktop_offline'; }
    if (msg.type === 'ack')            { status.value = 'sent'; }
  };
}

onMounted(connect);
onUnmounted(() => ws?.close());

// ── Camera capture ────────────────────────────────────────────────────────────
const fileInput   = ref<HTMLInputElement | null>(null);
const previewUrl  = ref<string | null>(null);
const pendingBlob = ref<Blob | null>(null);

function triggerCamera() {
  fileInput.value?.click();
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  pendingBlob.value = file;
  previewUrl.value  = URL.createObjectURL(file);
  status.value      = 'ready';
}

async function sendPhoto() {
  if (!pendingBlob.value || !ws || ws.readyState !== WebSocket.OPEN) return;
  status.value = 'sending';

  const reader = new FileReader();
  reader.onload = () => {
    ws!.send(JSON.stringify({
      type:     'photo',
      data:     reader.result as string,   // base64 data-URL
      mimeType: pendingBlob.value!.type,
    }));
  };
  reader.readAsDataURL(pendingBlob.value);
}

function retake() {
  previewUrl.value  = null;
  pendingBlob.value = null;
  status.value      = 'ready';
  if (fileInput.value) fileInput.value.value = '';
}
</script>

<template>
  <div class="mobile-shell">
    <div class="mobile-card">

      <!-- Header -->
      <div class="mobile-header">
        <span class="mobile-icon">📷</span>
        <h1>Scan mobile</h1>
        <p class="session-label">Session&nbsp;<strong>{{ sessionId }}</strong></p>
      </div>

      <!-- Status banner -->
      <div class="status-bar" :class="status">
        <span v-if="status === 'connecting'">⏳ Connexion…</span>
        <span v-else-if="status === 'ready' && !previewUrl">✅ Prêt — prenez une photo</span>
        <span v-else-if="status === 'ready' && previewUrl">✅ Photo prête à envoyer</span>
        <span v-else-if="status === 'desktop_offline'">⚠️ PC déconnecté</span>
        <span v-else-if="status === 'sending'">📤 Envoi…</span>
        <span v-else-if="status === 'sent'">✅ Photo reçue par le PC !</span>
        <span v-else-if="status === 'error'">❌ Erreur — {{ errMsg || 'Reconnectez-vous' }}</span>
      </div>

      <!-- Preview -->
      <div v-if="previewUrl" class="preview-wrap">
        <img :src="previewUrl" class="preview-img" alt="Aperçu" />
      </div>

      <!-- Actions -->
      <div class="actions">
        <template v-if="!previewUrl">
          <button class="btn primary" @click="triggerCamera" :disabled="status === 'connecting' || status === 'error'">
            📷 Prendre une photo
          </button>
        </template>
        <template v-else>
          <button class="btn primary"  @click="sendPhoto" :disabled="status === 'sending' || status === 'sent'">
            {{ status === 'sending' ? 'Envoi…' : status === 'sent' ? '✅ Envoyé !' : '📤 Envoyer' }}
          </button>
          <button class="btn secondary" @click="retake" :disabled="status === 'sending'">
            🔄 Reprendre
          </button>
        </template>
      </div>

      <!-- Reconnect -->
      <button v-if="status === 'error'" class="btn secondary" @click="connect" style="margin-top:1rem">
        🔁 Reconnecter
      </button>

      <!-- Hidden file input — opens native camera on mobile -->
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        style="display:none"
        @change="onFileChange"
      />
    </div>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }

.mobile-shell {
  min-height: 100vh;
  background: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  font-family: system-ui, sans-serif;
}

.mobile-card {
  background: #1e293b;
  border-radius: 1.25rem;
  padding: 2rem 1.5rem;
  width: 100%;
  max-width: 420px;
  color: white;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
}

.mobile-header { text-align: center; }
.mobile-icon   { font-size: 2.5rem; }
h1 { margin: .35rem 0 .2rem; font-size: 1.4rem; }
.session-label { margin: 0; font-size: .82rem; color: #94a3b8; }

/* Status */
.status-bar {
  padding: .6rem 1rem;
  border-radius: .6rem;
  font-size: .9rem;
  text-align: center;
  font-weight: 500;
}
.status-bar.connecting     { background: rgba(251,191,36,.15); color: #fbbf24; }
.status-bar.ready          { background: rgba(34,197,94,.12);  color: #4ade80; }
.status-bar.desktop_offline{ background: rgba(251,191,36,.15); color: #fbbf24; }
.status-bar.sending        { background: rgba(99,102,241,.2);  color: #a5b4fc; }
.status-bar.sent           { background: rgba(34,197,94,.2);   color: #4ade80; }
.status-bar.error          { background: rgba(239,68,68,.15);  color: #f87171; }

/* Preview */
.preview-wrap { border-radius: .75rem; overflow: hidden; }
.preview-img  { width: 100%; display: block; border-radius: .75rem; }

/* Buttons */
.actions { display: flex; flex-direction: column; gap: .65rem; }

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
.btn:active    { transform: scale(.97); }
.btn:disabled  { opacity: .45; cursor: not-allowed; }
.btn.primary   { background: #6366f1; color: white; }
.btn.primary:hover:not(:disabled)   { background: #4f46e5; }
.btn.secondary { background: #334155; color: #cbd5e1; }
.btn.secondary:hover:not(:disabled) { background: #475569; }
</style>
