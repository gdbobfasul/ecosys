// Version: 1.0023
// family-voice.js — гласът на родителя за „Денят на семейството": ЗАПИС от микрофона (не синтез),
// пазен на устройството като data-URL (base64) в семейните данни. По образеца на
// BabySecuritySitter (huawei/baby-monitor/src/core/phrases.js). Нищо не се качва никъде.
// Възпроизвеждане през <audio>; ако фраза няма — гласът на робота (tts.js) чете задачата.

export const MAX_PHRASE_MS = 10000;   // най-дълъг запис (10 сек.)
export const MAX_PHRASES = 12;        // до 12 фрази (пазят се в хранилището)

let _rec = null, _stream = null, _chunks = [], _startedAt = 0, _limitTimer = null, _audio = null;

export function recordSupported() {
  return typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    && typeof MediaRecorder !== 'undefined';
}
export function isRecording() { return !!_rec; }

// Поддържан формат (Android WebView: webm/opus; резервно — каквото има).
function pickMime() {
  const c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  for (const m of c) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) {} }
  return '';
}
function releaseStream() {
  if (_stream) { try { _stream.getTracks().forEach((tr) => tr.stop()); } catch (_) {} _stream = null; }
}

// Започва запис. onLimit() се вика при достигнат лимит от 10 сек. (UI-то тогава вика stopRecording).
export async function startRecording({ onLimit } = {}) {
  if (!recordSupported()) return { ok: false, reason: 'unsupported' };
  if (_rec) return { ok: false, reason: 'busy' };
  try { _stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
  catch (e) { return { ok: false, reason: (e && e.name) || 'denied' }; }
  const mime = pickMime();
  try { _rec = mime ? new MediaRecorder(_stream, { mimeType: mime }) : new MediaRecorder(_stream); }
  catch (e) { releaseStream(); _rec = null; return { ok: false, reason: 'recorder' }; }
  _chunks = [];
  _rec.ondataavailable = (e) => { if (e.data && e.data.size) _chunks.push(e.data); };
  _startedAt = Date.now();
  _rec.start(250);
  _limitTimer = setTimeout(() => { if (_rec && typeof onLimit === 'function') onLimit(); }, MAX_PHRASE_MS);
  return { ok: true };
}

// Спира записа. Връща { ok, dataUrl, mime, ms } или { ok:false, reason }.
export function stopRecording() {
  return new Promise((resolve) => {
    if (!_rec) { resolve({ ok: false, reason: 'idle' }); return; }
    const rec = _rec; _rec = null;
    if (_limitTimer) { clearTimeout(_limitTimer); _limitTimer = null; }
    rec.onstop = () => {
      const ms = Math.min(MAX_PHRASE_MS, Date.now() - _startedAt);
      const blob = new Blob(_chunks, { type: rec.mimeType || 'audio/webm' });
      _chunks = [];
      releaseStream();
      if (!blob.size || ms < 400) { resolve({ ok: false, reason: 'short' }); return; }
      const fr = new FileReader();
      fr.onload = () => resolve({ ok: true, dataUrl: String(fr.result), mime: blob.type, ms });
      fr.onerror = () => resolve({ ok: false, reason: 'read' });
      fr.readAsDataURL(blob);
    };
    try { rec.stop(); } catch (_) { releaseStream(); resolve({ ok: false, reason: 'stop' }); }
  });
}

export function cancelRecording() {
  if (_limitTimer) { clearTimeout(_limitTimer); _limitTimer = null; }
  if (!_rec) return;
  const rec = _rec; _rec = null;
  rec.onstop = () => { _chunks = []; releaseStream(); };
  try { rec.stop(); } catch (_) { releaseStream(); }
}

// Пуска записана фраза. Обещанието се изпълнява при край (true) или грешка (false).
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
