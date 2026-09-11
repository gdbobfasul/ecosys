// Version: 1.0027
// phrases.js — фрази с гласа на мама/тати: ЗАПИСИ от микрофона (не синтез), пазени на устройството
// като base64 в хранилището (storage.sitter.phrases). Пускат се през <audio> със зададена сила.
// Нищо не се качва: записът остава само на телефона при детето.

import { addPhrase, MAX_PHRASES } from './storage.js';

export const PHRASE_SLOTS = ['sleep', 'here', 'ok', 'custom']; // „спи, миличко" / „мама е тук" / „всичко е наред" / друга
export const MAX_PHRASE_MS = 15000;                              // най-дълъг запис

let _rec = null;      // активен MediaRecorder
let _stream = null;
let _chunks = [];
let _startedAt = 0;
let _limitTimer = null;
let _audio = null;    // текущо пускана фраза

export function recordSupported() {
  return typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    && typeof MediaRecorder !== 'undefined';
}

export function isRecording() { return !!_rec; }

// Избира поддържан формат (Android WebView: webm/opus; резервно — каквото има).
function pickMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) {} }
  return '';
}

// Започва запис. Връща { ok, reason }.
export async function startRecording() {
  if (!recordSupported()) return { ok: false, reason: 'unsupported' };
  if (_rec) return { ok: false, reason: 'busy' };
  try {
    _stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (e) { return { ok: false, reason: (e && e.name) || 'denied' }; }
  const mime = pickMime();
  try { _rec = mime ? new MediaRecorder(_stream, { mimeType: mime }) : new MediaRecorder(_stream); }
  catch (e) { releaseStream(); return { ok: false, reason: 'recorder' }; }
  _chunks = [];
  _rec.ondataavailable = (e) => { if (e.data && e.data.size) _chunks.push(e.data); };
  _startedAt = Date.now();
  _rec.start(250);
  return { ok: true };
}

function releaseStream() {
  if (_stream) { try { _stream.getTracks().forEach((t) => t.stop()); } catch (_) {} _stream = null; }
}

// Спира записа и го запазва като фраза. Връща { ok, phrase } или { ok:false, reason }.
export function stopRecording({ slot = 'custom', title = '' } = {}) {
  return new Promise((resolve) => {
    if (!_rec) { resolve({ ok: false, reason: 'idle' }); return; }
    const rec = _rec; _rec = null;
    if (_limitTimer) { clearTimeout(_limitTimer); _limitTimer = null; }
    rec.onstop = () => {
      const ms = Date.now() - _startedAt;
      const blob = new Blob(_chunks, { type: rec.mimeType || 'audio/webm' });
      _chunks = [];
      releaseStream();
      if (!blob.size || ms < 400) { resolve({ ok: false, reason: 'empty' }); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const phrase = addPhrase({ slot, title, mime: blob.type, dataUrl: String(fr.result), ms });
        resolve(phrase ? { ok: true, phrase } : { ok: false, reason: 'limit', limit: MAX_PHRASES });
      };
      fr.onerror = () => resolve({ ok: false, reason: 'read' });
      fr.readAsDataURL(blob);
    };
    try { rec.stop(); } catch (_) { releaseStream(); resolve({ ok: false, reason: 'stop' }); }
  });
}

// Отказва записа (без запазване).
export function cancelRecording() {
  if (!_rec) return;
  const rec = _rec; _rec = null;
  rec.onstop = () => { _chunks = []; releaseStream(); };
  try { rec.stop(); } catch (_) { releaseStream(); }
}

// Пуска фраза; volume 0..1. Връща обещание, което се изпълнява, когато свърши (или при грешка).
export function playPhrase(phrase, volume = 1) {
  stopPhrase();
  return new Promise((resolve) => {
    if (!phrase || !phrase.dataUrl) { resolve(false); return; }
    const a = new Audio(phrase.dataUrl);
    a.volume = Math.max(0, Math.min(1, volume));
    _audio = a;
    const done = (ok) => { if (_audio === a) _audio = null; resolve(ok); };
    a.onended = () => done(true);
    a.onerror = () => done(false);
    a.play().catch(() => done(false));
  });
}

export function stopPhrase() {
  if (_audio) { try { _audio.pause(); _audio.src = ''; } catch (_) {} _audio = null; }
}

export function phrasePlaying() { return !!_audio; }
