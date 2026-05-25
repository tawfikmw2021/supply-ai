<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useHelpStore } from '../stores/help';

const store = useHelpStore();
const route = useRoute();

const open = ref(false);
const selectedType = ref<string>(localStorage.getItem('helpbot_type') ?? 'task');
const message = ref(localStorage.getItem('helpbot_msg') ?? '');
const sending = ref(false);
const sent = ref(false);
const error = ref('');

// ── Photos ────────────────────────────────────────────
const photos = ref<File[]>([]);
const photoPrev = ref<string[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

// ── Audio recording ───────────────────────────────────
interface MediaItem { blob: Blob; url: string; mimeType: string }
const audios = ref<MediaItem[]>([]);

const recording = ref<'audio' | null>(null);
const recSeconds = ref(0);
let recInterval: ReturnType<typeof setInterval> | null = null;
let mediaRec: MediaRecorder | null = null;
let recChunks: BlobPart[] = [];
let activeStream: MediaStream | null = null;

const recError = ref('');

// ── Speech recognition (transcription) ───────────────
const liveTranscript = ref('');
let recognition: any = null;
const SpeechRecognitionAPI = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;

function startRecognition() {
  if (!SpeechRecognitionAPI) return;
  recognition = new SpeechRecognitionAPI();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'fr-FR';
  let finalText = '';
  recognition.onresult = (e: any) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    liveTranscript.value = finalText + interim;
  };
  recognition.onerror = () => { /* ignore */ };
  try { recognition.start(); } catch { /* already started */ }
}

function stopRecognition() {
  try { recognition?.stop(); } catch { /* ignore */ }
  recognition = null;
  if (liveTranscript.value.trim()) {
    const t = liveTranscript.value.trim();
    message.value = message.value ? `${message.value}\n${t}` : t;
  }
  liveTranscript.value = '';
}

// ── Draft persistence ─────────────────────────────────
const KEYS = { msg: 'helpbot_msg', type: 'helpbot_type', photos: 'helpbot_photos', audios: 'helpbot_audios' };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function saveFiles() {
  try {
    const audioData = await Promise.all(
      audios.value.map(a => blobToBase64(a.blob).then(data => ({ data, mimeType: a.mimeType })))
    );
    const payload = { photos: photoPrev.value, audios: audioData };
    const json = JSON.stringify(payload);
    if (json.length < 4_000_000) localStorage.setItem(KEYS.photos, json);
  } catch { }
}

function clearDraft() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

watch(message, v => localStorage.setItem(KEYS.msg, v));
watch(selectedType, v => localStorage.setItem(KEYS.type, v));

onMounted(async () => {
  try {
    const raw = localStorage.getItem(KEYS.photos);
    if (!raw) return;
    const { photos: savedPhotos = [], audios: savedAudios = [] } = JSON.parse(raw) as {
      photos: string[];
      audios: { data: string; mimeType: string }[];
    };
    for (const dataUrl of savedPhotos) {
      const blob = await fetch(dataUrl).then(r => r.blob());
      photos.value.push(new File([blob], 'photo-restored.jpg', { type: blob.type }));
      photoPrev.value.push(dataUrl);
    }
    for (const { data, mimeType } of savedAudios) {
      const blob = await fetch(data).then(r => r.blob());
      audios.value.push({ blob, url: URL.createObjectURL(blob), mimeType });
    }
  } catch { }
});

const TYPES = [
  { key: 'task', label: 'Tâche', icon: '✅' },
  { key: 'bug', label: 'Bug', icon: '🐛' },
  { key: 'question', label: 'Question', icon: '❓' },
  { key: 'suggestion', label: 'Suggestion', icon: '💡' },
];

function formatTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function toggle() {
  open.value = !open.value;
  if (open.value) { sent.value = false; error.value = ''; recError.value = ''; }
}

// ── Photo helpers ─────────────────────────────────────
function onFileChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  for (const f of files) {
    if (photos.value.length >= 5) break;
    photos.value.push(f);
    const reader = new FileReader();
    reader.onload = ev => { photoPrev.value.push(ev.target?.result as string); saveFiles(); };
    reader.readAsDataURL(f);
  }
  if (fileInput.value) fileInput.value.value = '';
}
function removePhoto(i: number) { photos.value.splice(i, 1); photoPrev.value.splice(i, 1); saveFiles(); }

// ── Recording helpers ─────────────────────────────────
async function startRecording() {
  recError.value = '';
  if (!navigator.mediaDevices?.getUserMedia) {
    recError.value = 'Microphone non disponible (connexion sécurisée requise).';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    activeStream = stream;
    recChunks = [];

    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', ''];
    const mimeType = candidates.find(m => m === '' || MediaRecorder.isTypeSupported(m)) ?? '';

    mediaRec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRec.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
    mediaRec.onstop = async () => {
      const effectiveMime = mediaRec!.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(recChunks, { type: effectiveMime });
      const url = URL.createObjectURL(blob);
      audios.value.push({ blob, url, mimeType: effectiveMime });
      stopStream();
      await saveFiles();
    };
    mediaRec.start();
    startRecognition();
    recording.value = 'audio';
    recSeconds.value = 0;
    recInterval = setInterval(() => recSeconds.value++, 1000);
  } catch (e: any) {
    recError.value = e?.message ?? 'Accès refusé';
  }
}

function stopRecording() {
  stopRecognition();
  mediaRec?.stop();
  clearInterval(recInterval!);
  recInterval = null;
  recording.value = null;
  recSeconds.value = 0;
}

function stopStream() {
  activeStream?.getTracks().forEach(t => t.stop());
  activeStream = null;
}

function removeAudio(i: number) { URL.revokeObjectURL(audios.value[i].url); audios.value.splice(i, 1); saveFiles(); }

onUnmounted(() => { stopStream(); clearInterval(recInterval!); });

// ── Submit ────────────────────────────────────────────
async function submit() {
  if (!message.value.trim() && audios.value.length > 0)
    message.value = '(Aucun message, uniquement des pièces jointes)';
  if (!message.value.trim() && audios.value.length == 0) return;
  if (recording.value) stopRecording();
  sending.value = true;
  error.value = '';
  try {
    await store.submit(
      selectedType.value, message.value,
      photos.value,
      route.fullPath,
      audios.value.map(a => new File([a.blob], `audio-${Date.now()}.webm`, { type: a.mimeType })),
    );
    sent.value = true;
    message.value = '';
    photos.value = []; photoPrev.value = [];
    audios.value.forEach(a => URL.revokeObjectURL(a.url)); audios.value = [];
    clearDraft();
    setTimeout(() => { open.value = false; sent.value = false; }, 1800);
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Erreur';
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <!-- Backdrop -->
  <Transition name="fade">
    <div v-if="open" class="backdrop" @click="open = false" />
  </Transition>

  <!-- Full-width bottom sheet -->
  <Transition name="sheet">
    <div v-if="open" class="bot-sheet">
      <div class="sheet-inner">

        <div class="panel-header">
          <span>Besoin d'aide ?</span>
          <div class="header-actions">
            <button v-if="!sent" class="send-btn" :disabled="sending || !message.trim() && audios.length == 0"
              @click="submit">
              {{ sending ? '…' : 'Envoyer' }}
            </button>
            <button class="close-btn" @click="open = false">✕</button>
          </div>
        </div>

        <!-- Sent confirmation -->
        <div v-if="sent" class="sent-msg">
          <span class="sent-icon">✅</span>
          <p>Votre message a été envoyé !</p>
        </div>

        <template v-else>
          <p class="panel-hint">Sélectionnez un type et décrivez votre demande.</p>

          <div class="sheet-body">

            <!-- Type chips -->
            <div class="type-chips">
              <button v-for="t in TYPES" :key="t.key" class="chip" :class="{ active: selectedType === t.key }"
                @click="selectedType = t.key">{{ t.icon }} {{ t.label }}</button>
            </div>

            <!-- Message textarea -->
            <textarea v-model="message" class="msg-input"
              :placeholder="`Décrivez votre ${TYPES.find(t => t.key === selectedType)?.label.toLowerCase()}…`" rows="3"
              @keydown.ctrl.enter="submit" />

            <!-- Media action bar -->
            <div class="media-bar">
              <!-- Photo -->
              <input ref="fileInput" type="file" accept="image/*" multiple class="file-hidden" @change="onFileChange" />
              <button class="media-btn" type="button" :disabled="photos.length >= 5" @click="fileInput?.click()">
                📎 Photo<span v-if="photos.length"> ({{ photos.length }}/5)</span>
              </button>

              <!-- Audio record -->
              <button class="media-btn" :class="{ recording: recording === 'audio' }" type="button"
                @click="recording === 'audio' ? stopRecording() : startRecording()">
                <span v-if="recording === 'audio'" class="rec-dot" />
                🎤 {{ recording === 'audio' ? `Stop (${formatTime(recSeconds)})` : 'Audio' }}
              </button>
            </div>

            <!-- Live transcript -->
            <p v-if="liveTranscript" class="live-transcript">🎙️ {{ liveTranscript }}</p>

            <!-- Recording error -->
            <p v-if="recError" class="err-txt">{{ recError }}</p>

            <!-- Photo thumbnails -->
            <div v-if="photoPrev.length" class="media-previews">
              <div v-for="(src, i) in photoPrev" :key="'p' + i" class="thumb-wrap">
                <img :src="src" class="thumb img-thumb" />
                <button class="thumb-del" type="button" @click="removePhoto(i)">✕</button>
              </div>
            </div>

            <!-- Audio players -->
            <div v-if="audios.length" class="audio-list">
              <div v-for="(a, i) in audios" :key="'a' + i" class="audio-item">
                <button class="thumb-del static" type="button" @click="removeAudio(i)">✕</button>

                <audio :src="a.url" controls class="audio-player" />
              </div>
            </div>

            <p v-if="error" class="err-txt">{{ error }}</p>

          </div>
        </template>
      </div>
    </div>
  </Transition>

  <!-- FAB -->
  <button class="fab" :class="{ open }" @click="toggle" title="Aide / Feedback">
    <span v-if="!open">💬</span>
    <span v-else>✕</span>
  </button>
</template>

<style scoped>
/* Backdrop */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 998;
  background: rgba(0, 0, 0, .25);
}

/* FAB */
.fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 1001;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #6c63ff;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(108, 99, 255, .45);
  transition: background .2s, transform .15s;
}

.fab:hover {
  background: #5a52d5;
  transform: scale(1.07);
}

.fab.open {
  background: #5a52d5;
}

/* Bottom sheet */
.bot-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: white;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -4px 28px rgba(0, 0, 0, .13);
}

.sheet-inner {
  padding: 0 0 1.25rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: #6c63ff;
  color: white;
  font-weight: 700;
  font-size: .95rem;
  border-radius: 18px 18px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: .6rem;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, .8);
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
}

.close-btn:hover {
  color: white;
}

.send-btn {
  padding: .38rem 1.2rem;
  background: white;
  color: #6c63ff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: .82rem;
  font-weight: 700;
  transition: background .15s;
}

.send-btn:hover:not(:disabled) {
  background: #ede9ff;
}

.send-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.panel-hint {
  margin: .85rem 1.5rem .6rem;
  font-size: .82rem;
  color: #888;
}

.sheet-body {
  padding: 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}

.chip {
  padding: .32rem .85rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 20px;
  background: white;
  font-size: .82rem;
  cursor: pointer;
  color: #555;
  transition: border-color .15s, background .15s, color .15s;
}

.chip:hover {
  border-color: #6c63ff;
  color: #6c63ff;
}

.chip.active {
  border-color: #6c63ff;
  background: #6c63ff;
  color: white;
  font-weight: 600;
}

.msg-input {
  width: 100%;
  box-sizing: border-box;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: .65rem .85rem;
  font-size: .875rem;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color .15s;
  line-height: 1.5;
}

.msg-input:focus {
  border-color: #6c63ff;
}

/* Media action bar */
.media-bar {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}

.media-btn {
  padding: .3rem .8rem;
  border: 1.5px dashed #c0b8ff;
  border-radius: 8px;
  background: #f8f7ff;
  color: #6c63ff;
  font-size: .8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: .3rem;
  transition: border-color .15s, background .15s;
}

.media-btn:hover:not(:disabled) {
  border-color: #6c63ff;
  background: #ede9ff;
}

.media-btn:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.media-btn.recording {
  border-color: #ef4444;
  background: #fee2e2;
  color: #ef4444;
  border-style: solid;
}

/* Recording dot */
.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: blink 1s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: .2;
  }
}

/* Hidden file input */
.file-hidden {
  display: none;
}

/* Media previews grid */
.media-previews {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
}

.thumb-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
}

.thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

/* Delete button */
.thumb-del {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: none;
  cursor: pointer;
  font-size: .6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.thumb-del.static {
  position: static;
  flex-shrink: 0;
}

/* Audio list */
.audio-list {
  display: flex;
  flex-direction: column;
  gap: .4rem;
}

.audio-item {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.audio-player {
  flex: 1;
  height: 36px;
}

.live-transcript {
  margin: 0;
  font-size: .78rem;
  color: #6c63ff;
  font-style: italic;
  background: #f0eeff;
  border-radius: 6px;
  padding: .35rem .6rem;
  line-height: 1.4;
}

.err-txt {
  margin: 0;
  font-size: .78rem;
  color: #ef4444;
}

/* Sent state */
.sent-msg {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
}

.sent-icon {
  font-size: 1.8rem;
}

.sent-msg p {
  margin: 0;
  font-size: .9rem;
  font-weight: 600;
  color: #333;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity .2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform .22s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}
</style>
