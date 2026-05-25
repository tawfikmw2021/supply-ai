/**
 * Global WebSocket connection keyed by the logged-in user's JWT.
 * Receives photos from the mobile camera screen and makes them available
 * to any view (e.g. InvoicesView) via a pending-photo queue.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getBackendUrl } from '../api/index';

export interface InboxPhoto {
  id:       number;
  dataUrl:  string;
  mimeType: string;
  at:       Date;
}

let _ws: WebSocket | null = null;
let _uid = 0;

function toWsUrl(base: string, token: string, role: 'desktop' | 'mobile'): string {
  const u = new URL(base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/ws';
  u.search   = `?token=${encodeURIComponent(token)}&role=${role}`;
  return u.toString();
}

export const usePhotoInboxStore = defineStore('photoInbox', () => {
  const photos        = ref<InboxPhoto[]>([]);
  const mobileOnline  = ref(false);
  const wsConnected   = ref(false);
  const hasNew        = computed(() => photos.value.length > 0);

  // ── connect / disconnect ───────────────────────────────────────────────────
  function connect(token: string, role: 'desktop' | 'mobile' = 'desktop') {
    if (_ws && _ws.readyState === WebSocket.OPEN) return;
    _ws = new WebSocket(toWsUrl(getBackendUrl(), token, role));

    _ws.onopen  = () => { wsConnected.value = true; };
    _ws.onclose = () => { wsConnected.value = false; mobileOnline.value = false; _ws = null; };
    _ws.onerror = () => { wsConnected.value = false; };

    _ws.onmessage = (e) => {
      let msg: any;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === 'mobile_online')  { mobileOnline.value = true; }
      if (msg.type === 'mobile_offline') { mobileOnline.value = false; }

      if (msg.type === 'photo') {
        photos.value.push({
          id:       ++_uid,
          dataUrl:  msg.data,
          mimeType: msg.mimeType ?? 'image/jpeg',
          at:       new Date(),
        });
      }
    };
  }

  function disconnect() {
    _ws?.close();
    _ws = null;
    photos.value       = [];
    mobileOnline.value = false;
    wsConnected.value  = false;
  }

  // ── send a photo (used by mobile camera screen) ────────────────────────────
  function sendPhoto(dataUrl: string, mimeType: string) {
    if (_ws?.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'photo', data: dataUrl, mimeType }));
    }
  }

  // ── consume one photo (invoice view calls this) ────────────────────────────
  function shift(): InboxPhoto | null {
    return photos.value.shift() ?? null;
  }

  function dismiss(id: number) {
    photos.value = photos.value.filter(p => p.id !== id);
  }

  function clearAll() { photos.value = []; }

  return {
    photos, mobileOnline, wsConnected, hasNew,
    connect, disconnect, sendPhoto, shift, dismiss, clearAll,
  };
});
