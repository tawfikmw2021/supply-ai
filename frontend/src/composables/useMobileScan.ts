import { ref, onUnmounted } from 'vue';
import { getBackendUrl } from '../api/index';

// ── helpers ───────────────────────────────────────────────────────────────────
function randomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Convert the backend HTTP(S) URL to its WS(S) equivalent */
function toWsUrl(httpUrl: string, sessionId: string, role: 'desktop' | 'mobile'): string {
  const u = new URL(httpUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/ws';
  u.search   = `?session=${sessionId}&role=${role}`;
  return u.toString();
}

/** base64 data-URL → Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime  = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(b64);
  const arr   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── composable ────────────────────────────────────────────────────────────────
export function useMobileScan(onPhoto: (blob: Blob) => void) {
  const sessionId      = ref(randomId());
  const wsConnected    = ref(false);
  const mobileOnline   = ref(false);
  const photoReceived  = ref(false);
  let ws: WebSocket | null = null;

  /** URL the phone should open (shown as QR code) */
  function mobileUrl(): string {
    const base = getBackendUrl();
    return `${base}/#/scan/${sessionId.value}`;
  }

  function start() {
    if (ws) return;
    const url = toWsUrl(getBackendUrl(), sessionId.value, 'desktop');
    ws = new WebSocket(url);

    ws.onopen    = () => { wsConnected.value = true; };
    ws.onclose   = () => { wsConnected.value = false; mobileOnline.value = false; };
    ws.onerror   = () => { wsConnected.value = false; };

    ws.onmessage = (e) => {
      let msg: any;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === 'mobile_joined') { mobileOnline.value = true; }
      if (msg.type === 'mobile_left')   { mobileOnline.value = false; }

      if (msg.type === 'photo') {
        photoReceived.value = true;
        const blob = dataUrlToBlob(msg.data);
        onPhoto(blob);
        // Tell phone: photo received OK
        ws?.send(JSON.stringify({ type: 'ack' }));
        setTimeout(() => { photoReceived.value = false; }, 2000);
      }
    };
  }

  function stop() {
    ws?.close();
    ws = null;
    wsConnected.value  = false;
    mobileOnline.value = false;
    // Reset session ID so next open gets a fresh code
    sessionId.value = randomId();
  }

  onUnmounted(() => stop());

  return { sessionId, wsConnected, mobileOnline, photoReceived, mobileUrl, start, stop };
}
