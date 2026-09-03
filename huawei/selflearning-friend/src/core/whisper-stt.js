// Version: 1.0000
// whisper-stt.js — ON-DEVICE разпознаване на реч (глас→текст) чрез Whisper (Transformers.js/WASM),
// което тече ИЗЦЯЛО в приложението: без Google услуги, работи и на Huawei, и ОФЛАЙН след еднократно
// сваляне на модела (кешира се в браузъра/WebView). Целта: български (и др. езици без Vosk модел) да
// имат надежден глас-към-текст. За езиците с Vosk модел (en, ru, de…) ползваме Vosk (по-бърз) — виж voice.js.
//
// Как работи: getUserMedia → MediaRecorder записва, докато слушаме → при стоп декодираме аудиото,
// ресемплираме на 16kHz моно → pipeline('automatic-speech-recognition') → текст на избрания език.
// Whisper е ПАКЕТЕН (не стрийминг): текстът идва след стоп (натискаш 🎤/Изпрати). За „разговор" режим
// има таван по време/тишина. Моделът е whisper-base (многоезичен, добър за български).

import { t, tf } from './i18n.js';

// Кодовете ни (15-те езика) → имена на езици, които Whisper разбира.
const WHISPER_LANG = {
  bg: 'bulgarian', ru: 'russian', uk: 'ukrainian', en: 'english', de: 'german', fr: 'french',
  es: 'spanish', 'es-MX': 'spanish', it: 'italian', pt: 'portuguese', ar: 'arabic', hi: 'hindi',
  ja: 'japanese', ky: 'russian', 'zh-Hant': 'chinese'   // ky: няма whisper модел за киргизки → ru е най-близкото; корекция ръчно
};
function whisperLangName(lang) { const c = String(lang || 'en').toLowerCase().split('-')[0]; return WHISPER_LANG[lang] || WHISPER_LANG[c] || 'english'; }

// Кой модел: по подразбиране base (баланс точност/скорост). Може да се смени на 'tiny' (по-бърз, по-слаб)
// през localStorage 'slf.whisper.model'. Квантизиран (по-малък, работи на телефон).
function modelName() {
  try { const m = localStorage.getItem('slf.whisper.model'); if (m === 'tiny') return 'Xenova/whisper-tiny'; if (m === 'small') return 'Xenova/whisper-small'; } catch (_) {}
  return 'Xenova/whisper-base';
}

let _pipe = null, _pipePromise = null;
// Зарежда (веднъж) Whisper pipeline. onStatus(progress0-100, text) за прогреса на сваляне на модела.
export async function loadWhisper(onStatus) {
  if (_pipe) return _pipe;
  if (!_pipePromise) {
    _pipePromise = (async () => {
      const tf = await import('@xenova/transformers');
      const { pipeline, env } = tf;
      // Моделите се теглят от отдалечено (HuggingFace по подразбиране) и се КЕШИРАТ в браузъра →
      // след първото сваляне работи офлайн. (За пълна независимост може env.remoteHost = нашия сървър.)
      try { env.allowLocalModels = false; } catch (_) {}
      try { if (env.backends && env.backends.onnx && env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1; } catch (_) {}
      const pipe = await pipeline('automatic-speech-recognition', modelName(), {
        quantized: true,
        progress_callback: onStatus ? (p) => {
          try { if (p && p.status === 'progress') onStatus(Math.round(p.progress || 0), 'модел ' + Math.round(p.progress || 0) + '%'); } catch (_) {}
        } : undefined
      });
      return pipe;
    })();
  }
  _pipe = await _pipePromise;
  return _pipe;
}

// Дали Whisper е приложим тук (има ли WebAssembly + микрофон API). В Capacitor WebView — да.
export function whisperAvailable() {
  try { return typeof WebAssembly !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); } catch (_) { return false; }
}

// Ресемплира AudioBuffer до 16kHz моно Float32Array (входът, който Whisper очаква).
async function to16kMono(audioBuffer) {
  const targetRate = 16000;
  const src = audioBuffer.getChannelData(0);
  if (audioBuffer.sampleRate === targetRate) return src;
  const ratio = audioBuffer.sampleRate / targetRate;
  const outLen = Math.floor(src.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx), i1 = Math.min(i0 + 1, src.length - 1);
    const frac = idx - i0;
    out[i] = src[i0] * (1 - frac) + src[i1] * frac;   // линейна интерполация
  }
  return out;
}

let _rec = null, _stream = null, _chunks = [], _stopResolve = null, _listening = false, _aborted = false;
export function isWhisperListening() { return _listening; }

// Спира записа → задейства транскрипцията (резултатът се връща от промиса на startWhisper).
export function stopWhisper() {
  _aborted = false;
  try { if (_rec && _rec.state !== 'inactive') _rec.stop(); } catch (_) {}
}
// Прекъсва без транскрипция (напр. смяна на екран).
export function abortWhisper() {
  _aborted = true;
  try { if (_rec && _rec.state !== 'inactive') _rec.stop(); } catch (_) {}
  try { if (_stream) _stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
  _listening = false;
}

// Записва глас, докато не се извика stopWhisper() (ръчен режим) ИЛИ мине таванът/тишината (разговор),
// после транскрибира → Promise<текст>. onInterim се вика с прогреса на модела (при първо сваляне) и
// с „…" докато транскрибира. onStatus(progress,text) — за сваляне на модела.
export async function startWhisper({ lang = 'bg', onInterim = null, manualStop = false, onStatus = null, maxMs = 600000 } = {}) {
  if (_listening) throw new Error('busy');
  _listening = true; _aborted = false; _chunks = [];
  // 1) достъп до микрофона
  try { _stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { _listening = false; throw new Error('denied'); }
  // 2) зареди модела (показва прогрес при първо сваляне)
  let pipe;
  try {
    if (onInterim) { try { onInterim(t('w_model_load')); } catch (_) {} }
    pipe = await loadWhisper((p, m) => { if (onStatus) onStatus(p, m); if (onInterim) { try { onInterim(tf('w_model_pct', p | 0)); } catch (_) {} } });
  } catch (e) { _listening = false; try { _stream.getTracks().forEach((t) => t.stop()); } catch (_) {} throw new Error('whisper-load'); }

  // 3) записвай
  const mime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : '';
  _rec = new MediaRecorder(_stream, mime ? { mimeType: mime } : undefined);
  _rec.ondataavailable = (e) => { if (e.data && e.data.size) _chunks.push(e.data); };

  const audioBlobPromise = new Promise((resolve) => { _rec.onstop = () => resolve(new Blob(_chunks, { type: _rec.mimeType || 'audio/webm' })); });
  _rec.start();
  // авто-стоп: таван по време; за „разговор" режим (не manualStop) — по-къс таван + тишина (проста)
  const hardCap = setTimeout(() => { try { stopWhisper(); } catch (_) {} }, Math.min(maxMs, manualStop ? 600000 : 20000));

  const blob = await audioBlobPromise;
  clearTimeout(hardCap);
  try { _stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
  _listening = false;
  if (_aborted) return '';
  if (!blob || !blob.size) return '';

  // 4) декодирай + ресемплирай на 16kHz
  if (onInterim) { try { onInterim(t('w_recognizing')); } catch (_) {} }
  let samples;
  try {
    const arr = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const audioBuffer = await ac.decodeAudioData(arr);
    samples = await to16kMono(audioBuffer);
    try { ac.close(); } catch (_) {}
  } catch (e) { throw new Error('decode'); }
  if (!samples || samples.length < 1600) return '';   // < 0.1s → нищо казано

  // 5) транскрибирай на избрания език
  try {
    const out = await pipe(samples, {
      language: whisperLangName(lang),
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5
    });
    const text = String((out && out.text) || '').trim();
    return text;
  } catch (e) { throw new Error('transcribe'); }
}
