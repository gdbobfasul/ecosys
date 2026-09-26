// Version: 1.0021
// voice-guard.js — ГЛАСОВ ПАЗАЧ около носещия: микрофонът слуша непрекъснато, при звук над
// прага записва кратък сегмент (до 15 s), разпознава реч (ако устройството дава разпознаване)
// и търси ключови думи за помощ/заплаха/накъде; рязък силен шум (вик, удар) също вдига сигнал.
//
// ЧЕСТНО:
//   • Нивото на звука и записът работят навсякъде, където има getUserMedia + MediaRecorder.
//   • Разпознаването на реч е през Web Speech API (SpeechRecognition) — налично е само където
//     WebView-ът го дава (Chrome/Google услуги). На устройства без него (напр. Huawei без GMS)
//     пазачът работи по ЗВУК (вик/рязък шум) и праща самия ЗАПИС на наблюдаващия, който го чува.
//   • Нищо не се пази извън устройството освен пакетите към сдвоения телефон (шифровани).
//
// API: startVoiceGuard({ lang, onLevel, onSegment, onAlert, onStatus }) → stop(); stopVoiceGuard().
//   onSegment({ ts, dur, audio(dataURL), peak, transcript })  — всеки записан сегмент
//   onAlert({ kind: 'scream'|'keyword', words, transcript, audio, peak, ts })  — тревога

import { matchThreatWords, isAlarming } from './threat-words.js';

const POLL_MS = 100;
const SEG_MAX_MS = 15000;      // най-дълъг сегмент
const QUIET_STOP_MS = 2500;    // тишина, след която сегментът приключва
const MIN_LEVEL = 0.035;       // абсолютен праг „има звук"
const SCREAM_LEVEL = 0.30;     // силен звук (вик/удар)
const SPIKE_RATIO = 6;         // скок спрямо фоновия шум

let _stream = null, _ctx = null, _analyser = null, _timer = null, _rec = null, _recog = null;
let _running = false;
let _floor = 0.01;             // фонов шум (пълзяща средна)
let _seg = null;               // текущ сегмент { start, lastLoud, peak, chunks, transcript, alarm }
let _recogText = '';           // натрупан текст от разпознаването за текущия сегмент
let _lastKeywordAlert = 0;
let _cb = {};

export function voiceGuardAvailable() {
  return typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof window.MediaRecorder !== 'undefined';
}
export function speechRecognitionAvailable() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
export function isVoiceGuardRunning() { return _running; }

function pickMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/aac', ''];
  for (const m of cands) { try { if (!m || MediaRecorder.isTypeSupported(m)) return m; } catch (_) {} }
  return '';
}

function rmsLevel() {
  const buf = new Uint8Array(_analyser.fftSize);
  _analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
  return Math.sqrt(sum / buf.length);
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    try { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = () => resolve(''); r.readAsDataURL(blob); }
    catch (_) { resolve(''); }
  });
}

function startSegment(level) {
  if (_seg) return;
  _seg = { start: Date.now(), lastLoud: Date.now(), peak: level, chunks: [], transcript: '', alarm: null };
  _recogText = '';
  try {
    _rec = new MediaRecorder(_stream, pickMime() ? { mimeType: pickMime() } : undefined);
    _rec.ondataavailable = (e) => { if (e.data && e.data.size) _seg && _seg.chunks.push(e.data); };
    _rec.start();
  } catch (_) { _rec = null; }
}

async function endSegment() {
  const seg = _seg; _seg = null;
  if (!seg) return;
  const rec = _rec; _rec = null;
  let audio = '';
  if (rec) {
    await new Promise((res) => {
      try { rec.onstop = () => res(); rec.stop(); setTimeout(res, 1500); } catch (_) { res(); }
    });
    if (seg.chunks.length) {
      try { audio = await blobToDataUrl(new Blob(seg.chunks, { type: rec.mimeType || 'audio/webm' })); } catch (_) { audio = ''; }
    }
  }
  const item = { ts: seg.start, dur: Math.round((Date.now() - seg.start) / 1000), audio, peak: Math.round(seg.peak * 100) / 100, transcript: (_recogText || seg.transcript || '').trim() };
  if (_cb.onSegment) { try { _cb.onSegment(item); } catch (_) {} }
  if (seg.alarm) {
    if (_cb.onAlert) { try { _cb.onAlert({ ...seg.alarm, audio, transcript: item.transcript, peak: item.peak, ts: seg.start }); } catch (_) {} }
  }
}

function tick() {
  if (!_running) return;
  let level = 0;
  try { level = rmsLevel(); } catch (_) {}
  if (_cb.onLevel) { try { _cb.onLevel(level); } catch (_) {} }
  const now = Date.now();
  const loud = level > MIN_LEVEL && level > _floor * 3;
  if (!_seg) {
    // Фонът се учи само в тишина (бавно).
    _floor = _floor * 0.98 + level * 0.02;
    if (loud) startSegment(level);
  }
  if (_seg) {
    if (loud) _seg.lastLoud = now;
    if (level > _seg.peak) _seg.peak = level;
    // Вик/рязък шум: силен звук И голям скок спрямо фона.
    if (!_seg.alarm && level > SCREAM_LEVEL && level > _floor * SPIKE_RATIO) _seg.alarm = { kind: 'scream', words: [] };
    if (now - _seg.start > SEG_MAX_MS || now - _seg.lastLoud > QUIET_STOP_MS) endSegment();
  }
  _timer = setTimeout(tick, POLL_MS);
}

// --- Разпознаване на реч (ако е налично) ------------------------------------
function startRecognition(lang) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return;
  const langTag = { bg: 'bg-BG', ru: 'ru-RU', uk: 'uk-UA', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', 'es-MX': 'es-MX', it: 'it-IT', pt: 'pt-PT', ar: 'ar-SA', hi: 'hi-IN', ja: 'ja-JP', ky: 'ky-KG', 'zh-Hant': 'zh-TW' }[lang] || 'en-US';
  const make = () => {
    if (!_running) return;
    try {
      const r = new Ctor();
      r.lang = langTag; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript + ' ';
        text = text.trim();
        if (!text) return;
        if (_seg) _recogText = (_recogText + ' ' + text).slice(-600);
        const m = matchThreatWords(text, lang);
        if (isAlarming(m) && Date.now() - _lastKeywordAlert > 15000) {
          _lastKeywordAlert = Date.now();
          const words = [...m.help, ...m.threat, ...m.place];
          if (_seg) { if (!_seg.alarm) _seg.alarm = { kind: 'keyword', words }; else _seg.alarm.words = words; _seg.lastLoud = Date.now(); }
          else if (_cb.onAlert) { try { _cb.onAlert({ kind: 'keyword', words, transcript: text, audio: '', peak: 0, ts: Date.now() }); } catch (_) {} }
        }
      };
      r.onend = () => { _recog = null; if (_running) setTimeout(make, 400); }; // рестарт (браузърът го спира периодично)
      r.onerror = () => {};
      r.start();
      _recog = r;
    } catch (_) { _recog = null; }
  };
  make();
}

export async function startVoiceGuard({ lang = 'en', onLevel, onSegment, onAlert, onStatus } = {}) {
  stopVoiceGuard();
  if (!voiceGuardAvailable()) { if (onStatus) onStatus({ ok: false, reason: 'unsupported' }); return () => {}; }
  _cb = { onLevel, onSegment, onAlert, onStatus };
  try {
    _stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }, video: false });
  } catch (e) {
    const name = (e && e.name) || '';
    if (onStatus) onStatus({ ok: false, reason: (name === 'NotAllowedError' || name === 'SecurityError') ? 'denied' : 'error' });
    return () => {};
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    _ctx = new AC();
    if (_ctx.state === 'suspended') { try { await _ctx.resume(); } catch (_) {} }
    const src = _ctx.createMediaStreamSource(_stream);
    _analyser = _ctx.createAnalyser(); _analyser.fftSize = 2048;
    src.connect(_analyser);
  } catch (_) {
    stopVoiceGuard();
    if (onStatus) onStatus({ ok: false, reason: 'error' });
    return () => {};
  }
  _running = true; _floor = 0.01; _seg = null;
  tick();
  startRecognition(lang);
  if (onStatus) onStatus({ ok: true, recognition: speechRecognitionAvailable() });
  return stopVoiceGuard;
}

export function stopVoiceGuard() {
  _running = false;
  if (_timer) { clearTimeout(_timer); _timer = null; }
  if (_recog) { try { _recog.onend = null; _recog.stop(); } catch (_) {} _recog = null; }
  if (_rec) { try { _rec.stop(); } catch (_) {} _rec = null; }
  _seg = null;
  if (_stream) { try { for (const t of _stream.getTracks()) t.stop(); } catch (_) {} _stream = null; }
  if (_ctx) { try { _ctx.close(); } catch (_) {} _ctx = null; }
  _analyser = null;
}
