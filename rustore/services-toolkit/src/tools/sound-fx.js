// Version: 1.0020
// sound-fx.js — ЧИСТ звуков двигател за „Студио за звук и глас": ефекти, модулатори и модификатори
// на звук и глас, изцяло НА УСТРОЙСТВОТО (WebAudio: OfflineAudioContext за филтри/конволюция +
// собствени алгоритми върху Float32Array: фазов вокодер, спектрално изваждане, закъснителни линии).
// БЕЗ интерфейс, БЕЗ i18n, БЕЗ външни зависимости → същият файл се включва и в Pupikes Toolkit
// (services-toolkit) без промяна. Всички функции работят върху AudioBuffer и връщат НОВ AudioBuffer.
//
// Публичен API:
//   EFFECTS, PRESETS                     — списък на ефектите (id, група, параметри: ключ/мин/макс/стъпка/подразбиране)
//   audioContext()                       — общ AudioContext (за прослушване/декодиране)
//   decodeAudio(bytes)                   → AudioBuffer (вградения декодер на WebView-а: MP3/M4A/WAV/OGG/FLAC…)
//   applyEffect(buf, id, params, onProg) → AudioBuffer (нов)
//   applyChain(buf, chain, onProg)       → AudioBuffer (верига [[id, params], …])
//   encodeWav(buf)                       → Uint8Array (16-битов PCM WAV)
//   makeDemo(sr)                         → AudioBuffer (синтезиран пример: „глас" с гласни + звънче + лек шум)
//   peaks(buf, n)                        → Float32Array (за рисуване на вълновата форма)
//   makeBuffer(channels, sr), getChannels(buf), describe(buf)

function AC() { return window.AudioContext || window.webkitAudioContext; }
function OAC() { return window.OfflineAudioContext || window.webkitOfflineAudioContext; }

let _ctx = null;
export function audioContext() {
  if (!_ctx) _ctx = new (AC())();
  try { if (_ctx.state === 'suspended') _ctx.resume().catch(() => {}); } catch (e) {}
  return _ctx;
}

// ---------------------------------------------------------------- описания на ефектите
// Параметрите са ЧИСЛА; етикетите/преводите са грижа на интерфейса (ключ = key).
export const EFFECTS = [
  { id: 'pitch',     group: 'voice', params: [{ key: 'semitones', min: -12, max: 12, step: 1, def: 4 }] },
  { id: 'chipmunk',  group: 'voice', params: [{ key: 'amount', min: 1, max: 12, step: 1, def: 7 }] },
  { id: 'deep',      group: 'voice', params: [{ key: 'amount', min: 1, max: 12, step: 1, def: 6 }] },
  { id: 'robot',     group: 'voice', params: [{ key: 'freq_hz', min: 20, max: 200, step: 5, def: 50 }] },
  { id: 'telephone', group: 'voice', params: [{ key: 'drive', min: 0, max: 100, step: 5, def: 30 }] },
  { id: 'radio',     group: 'voice', params: [{ key: 'drive', min: 0, max: 100, step: 5, def: 50 }, { key: 'static', min: 0, max: 100, step: 5, def: 20 }] },
  { id: 'vibrato',   group: 'voice', params: [{ key: 'rate_hz', min: 1, max: 10, step: 0.5, def: 5 }, { key: 'depth', min: 0, max: 100, step: 5, def: 40 }] },
  { id: 'tremolo',   group: 'voice', params: [{ key: 'rate_hz', min: 1, max: 15, step: 0.5, def: 6 }, { key: 'depth', min: 0, max: 100, step: 5, def: 60 }] },
  { id: 'chorus',    group: 'space', params: [{ key: 'depth_ms', min: 1, max: 10, step: 0.5, def: 3 }, { key: 'rate_hz', min: 0.1, max: 3, step: 0.1, def: 0.9 }, { key: 'mix', min: 0, max: 100, step: 5, def: 50 }] },
  { id: 'echo',      group: 'space', params: [{ key: 'delay_ms', min: 60, max: 1200, step: 10, def: 300 }, { key: 'feedback', min: 0, max: 90, step: 5, def: 40 }, { key: 'mix', min: 0, max: 100, step: 5, def: 45 }] },
  { id: 'reverb',    group: 'space', params: [{ key: 'size_s', min: 0.3, max: 6, step: 0.1, def: 2 }, { key: 'mix', min: 0, max: 100, step: 5, def: 40 }] },
  { id: 'eq',        group: 'tone',  params: [{ key: 'low_db', min: -15, max: 15, step: 1, def: 3 }, { key: 'mid_db', min: -15, max: 15, step: 1, def: 0 }, { key: 'high_db', min: -15, max: 15, step: 1, def: 3 }] },
  { id: 'denoise',   group: 'tone',  params: [{ key: 'strength', min: 10, max: 100, step: 5, def: 60 }] },
  { id: 'tempo',     group: 'time',  params: [{ key: 'percent', min: 50, max: 200, step: 5, def: 120 }] },
  { id: 'speed',     group: 'time',  params: [{ key: 'percent', min: 50, max: 200, step: 5, def: 125 }] },
  { id: 'reverse',   group: 'time',  params: [] },
  { id: 'trim',      group: 'time',  params: [{ key: 'start_s', min: 0, max: 3600, step: 0.1, def: 0 }, { key: 'end_s', min: 0, max: 3600, step: 0.1, def: 0 }] },
  { id: 'fade',      group: 'level', params: [{ key: 'fade_in_ms', min: 0, max: 5000, step: 50, def: 500 }, { key: 'fade_out_ms', min: 0, max: 5000, step: 50, def: 800 }] },
  { id: 'gain',      group: 'level', params: [{ key: 'db', min: -24, max: 24, step: 1, def: 6 }] },
  { id: 'normalize', group: 'level', params: [{ key: 'target_db', min: -12, max: 0, step: 1, def: -1 }] },
  { id: 'mono',      group: 'level', params: [] }
];

// Готови „модулатори на глас" с едно докосване — верига от ефекти.
export const PRESETS = [
  { id: 'robot',     chain: [['robot', { freq_hz: 50 }], ['eq', { low_db: -3, mid_db: 2, high_db: 2 }]] },
  { id: 'chipmunk',  chain: [['chipmunk', { amount: 7 }]] },
  { id: 'deep',      chain: [['deep', { amount: 6 }]] },
  { id: 'telephone', chain: [['telephone', { drive: 30 }]] },
  { id: 'radio',     chain: [['radio', { drive: 50, static: 20 }]] },
  { id: 'hall',      chain: [['reverb', { size_s: 2.5, mix: 45 }]] },
  { id: 'cave',      chain: [['echo', { delay_ms: 420, feedback: 50, mix: 40 }], ['reverb', { size_s: 3, mix: 35 }]] },
  { id: 'choir',     chain: [['chorus', { depth_ms: 4, rate_hz: 0.8, mix: 60 }], ['reverb', { size_s: 1.5, mix: 25 }]] },
  { id: 'alien',     chain: [['pitch', { semitones: -3 }], ['robot', { freq_hz: 30 }], ['chorus', { depth_ms: 5, rate_hz: 1.5, mix: 50 }]] },
  { id: 'clean',     chain: [['denoise', { strength: 60 }], ['normalize', { target_db: -1 }]] }
];

export function effectById(id) { return EFFECTS.find((e) => e.id === id) || null; }
export function defaultParams(id) { const e = effectById(id); const p = {}; if (e) e.params.forEach((q) => { p[q.key] = q.def; }); return p; }

// ---------------------------------------------------------------- помощни
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
// Отстъпва на интерфейса на всеки N кадъра (тежките цикли не замразяват екрана).
const yieldUI = () => new Promise((r) => setTimeout(r, 0));

export function makeBuffer(channels, sr) {
  const ctx = audioContext();
  const len = Math.max(1, channels[0] ? channels[0].length : 1);
  const b = ctx.createBuffer(Math.max(1, channels.length), len, sr || ctx.sampleRate);
  channels.forEach((c, i) => { if (c.length === len) b.copyToChannel(c, i); else { const t = new Float32Array(len); t.set(c.subarray(0, len)); b.copyToChannel(t, i); } });
  return b;
}
export function getChannels(buf) { const out = []; for (let i = 0; i < buf.numberOfChannels; i++) out.push(buf.getChannelData(i).slice()); return out; }
export function describe(buf) { return { duration: buf.length / buf.sampleRate, sampleRate: buf.sampleRate, channels: buf.numberOfChannels, frames: buf.length }; }

export function decodeAudio(bytes) {
  const ctx = audioContext();
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((res, rej) => {
    let done = false; const ok = (b) => { if (!done) { done = true; res(b); } }; const bad = (e) => { if (!done) { done = true; rej(e || new Error('decode')); } };
    try { const p = ctx.decodeAudioData(ab, ok, bad); if (p && p.then) p.then(ok, bad); } catch (e) { bad(e); }
  });
}

// Офлайн рендер: src → build(ctx, src) → destination. Връща новия AudioBuffer.
function renderOffline(buf, lengthFrames, build) {
  const ctx = new (OAC())(buf.numberOfChannels, Math.max(1, Math.round(lengthFrames)), buf.sampleRate);
  const src = ctx.createBufferSource(); src.buffer = buf;
  build(ctx, src);
  src.start(0);
  const p = ctx.startRendering();
  if (p && p.then) return p;
  return new Promise((r) => { ctx.oncomplete = (e) => r(e.renderedBuffer); });
}

// ---------------------------------------------------------------- FFT (радикс-2, на място) с кеширани таблици
const _tw = {};
function twiddles(n) {
  if (_tw[n]) return _tw[n];
  const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
  const rev = new Uint32Array(n); let bits = 0; while ((1 << bits) < n) bits++;
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b); rev[i] = r; }
  return (_tw[n] = { cos, sin, rev });
}
function fft(re, im, inverse) {
  const n = re.length; const { cos, sin, rev } = twiddles(n);
  for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k], wi = inverse ? sin[k] : -sin[k];
        const a = i + j, b = a + half;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  if (inverse) { const s = 1 / n; for (let i = 0; i < n; i++) { re[i] *= s; im[i] *= s; } }
}
const _hann = {};
function hann(n) { if (_hann[n]) return _hann[n]; const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); return (_hann[n] = w); }

// ---------------------------------------------------------------- фазов вокодер: разтягане във времето без смяна на височината
// factor > 1 → по-дълго (по-бавно), < 1 → по-кратко (по-бързо). Хан прозорец 2048, стъпка 512 (75% припокриване).
async function stretchChannel(x, factor, onProg) {
  const N = 2048, Ha = 512; const Hs = Math.max(1, Math.round(Ha * factor)); const real = Hs / Ha;
  const win = hann(N);
  const frames = Math.max(1, Math.floor(x.length / Ha) + 1);
  const outLen = (frames - 1) * Hs + N;
  const out = new Float32Array(outLen), norm = new Float32Array(outLen);
  const re = new Float32Array(N), im = new Float32Array(N);
  const half = N / 2;
  const lastPh = new Float32Array(half + 1), sumPh = new Float32Array(half + 1);
  const expct = 2 * Math.PI * Ha / N;
  for (let f = 0; f < frames; f++) {
    const pos = f * Ha;
    for (let i = 0; i < N; i++) { const s = pos + i < x.length ? x[pos + i] : 0; re[i] = s * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k <= half; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const ph = Math.atan2(im[k], re[k]);
      let d = ph - lastPh[k]; lastPh[k] = ph;
      d -= k * expct;
      d = d - 2 * Math.PI * Math.round(d / (2 * Math.PI));     // в (-π, π]
      sumPh[k] += (k * expct + d) * real;
      re[k] = mag * Math.cos(sumPh[k]); im[k] = mag * Math.sin(sumPh[k]);
    }
    for (let k = 1; k < half; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    fft(re, im, true);
    const op = f * Hs;
    for (let i = 0; i < N; i++) { out[op + i] += re[i] * win[i]; norm[op + i] += win[i] * win[i]; }
    if ((f & 63) === 0) { if (onProg) onProg(f / frames); await yieldUI(); }
  }
  for (let i = 0; i < outLen; i++) out[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  // реалната нова дължина = старата × factor (без опашката на последния прозорец)
  const want = Math.max(1, Math.round(x.length * real));
  return out.length > want ? out.subarray(0, want).slice() : out;
}

// Пресемплиране с линейна интерполация: rate > 1 → по-кратко и по-високо.
function resampleChannel(x, rate) {
  const outLen = Math.max(1, Math.floor(x.length / rate));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const p = i * rate; const j = Math.floor(p); const fr = p - j;
    const a = x[j] || 0, b = j + 1 < x.length ? x[j + 1] : 0;
    out[i] = a + (b - a) * fr;
  }
  return out;
}

async function pitchShift(buf, semitones, onProg) {
  const r = Math.pow(2, clamp(semitones, -24, 24) / 12);
  if (Math.abs(r - 1) < 1e-4) return buf;
  const chs = getChannels(buf); const out = [];
  for (let c = 0; c < chs.length; c++) {
    const st = await stretchChannel(chs[c], r, (p) => onProg && onProg((c + p) / chs.length));   // по-дълго/кратко с r…
    out.push(resampleChannel(st, r));                                                             // …и обратно към старата дължина → сменя се височината
  }
  // изравняване до оригиналната дължина (грешки от закръгляне)
  return makeBuffer(out.map((ch) => { if (ch.length === buf.length) return ch; const t = new Float32Array(buf.length); t.set(ch.subarray(0, Math.min(ch.length, buf.length))); return t; }), buf.sampleRate);
}

// ---------------------------------------------------------------- спектрално изваждане (шумопотискане)
async function denoise(buf, strength, onProg) {
  const s = clamp(strength, 0, 100) / 100;
  const alpha = 1 + 2 * s;                 // колко от шумовия профил се изважда
  const floor = 0.12 * (1 - s) + 0.02;     // минимален остатък (срещу „музикален шум")
  const N = 2048, H = 512; const win = hann(N); const half = N / 2;
  const chs = getChannels(buf); const out = [];
  for (let c = 0; c < chs.length; c++) {
    const x = chs[c]; const frames = Math.max(1, Math.floor(x.length / H) + 1);
    // 1) енергия на всеки кадър → най-тихите 10% (мин. 6 кадъра) дават профила на шума
    const energy = new Float32Array(frames);
    for (let f = 0; f < frames; f++) { let e = 0; const pos = f * H; for (let i = 0; i < N; i += 4) { const v = pos + i < x.length ? x[pos + i] : 0; e += v * v; } energy[f] = e; }
    const sorted = Array.from(energy).sort((a, b) => a - b);
    const qn = Math.max(Math.min(6, frames), Math.floor(frames * 0.1));
    const thr = sorted[Math.min(frames - 1, qn - 1)];
    const re = new Float32Array(N), im = new Float32Array(N);
    const noise = new Float32Array(half + 1); let cnt = 0;
    for (let f = 0; f < frames && cnt < qn; f++) {
      if (energy[f] > thr) continue;
      const pos = f * H; for (let i = 0; i < N; i++) { const v = pos + i < x.length ? x[pos + i] : 0; re[i] = v * win[i]; im[i] = 0; }
      fft(re, im, false);
      for (let k = 0; k <= half; k++) noise[k] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      cnt++;
    }
    if (cnt) for (let k = 0; k <= half; k++) noise[k] /= cnt;
    // 2) изваждане от всеки кадър, фазата се пази, припокриване-събиране
    const y = new Float32Array(x.length + N), norm = new Float32Array(x.length + N);
    for (let f = 0; f < frames; f++) {
      const pos = f * H; for (let i = 0; i < N; i++) { const v = pos + i < x.length ? x[pos + i] : 0; re[i] = v * win[i]; im[i] = 0; }
      fft(re, im, false);
      for (let k = 0; k <= half; k++) {
        const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]); if (mag < 1e-9) continue;
        const nm = Math.max(mag - alpha * noise[k], floor * mag); const g = nm / mag;
        re[k] *= g; im[k] *= g;
      }
      for (let k = 1; k < half; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
      fft(re, im, true);
      for (let i = 0; i < N; i++) { y[pos + i] += re[i] * win[i]; norm[pos + i] += win[i] * win[i]; }
      if ((f & 63) === 0) { if (onProg) onProg((c + f / frames) / chs.length); await yieldUI(); }
    }
    const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = norm[i] > 1e-3 ? y[i] / norm[i] : 0;
    out.push(o);
  }
  return makeBuffer(out, buf.sampleRate);
}

// ---------------------------------------------------------------- закъснителни ефекти (ехо, хор, вибрато)
function echo(buf, delayMs, feedback, mix) {
  const sr = buf.sampleRate; const D = Math.max(1, Math.round(clamp(delayMs, 10, 5000) / 1000 * sr));
  const fb = clamp(feedback, 0, 95) / 100, m = clamp(mix, 0, 100) / 100;
  const reps = fb > 0.001 ? Math.min(14, Math.ceil(Math.log(0.001) / Math.log(fb))) : 1;
  const chs = getChannels(buf); const outLen = buf.length + reps * D;
  const out = chs.map((x) => {
    const y = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) { const dry = i < x.length ? x[i] : 0; y[i] = dry + (i >= D ? fb * y[i - D] : 0); }
    for (let i = 0; i < outLen; i++) { const dry = i < x.length ? x[i] : 0; y[i] = dry * (1 - m) + y[i] * m; }
    return y;
  });
  return makeBuffer(out, sr);
}
// Четене с дробен индекс (линейна интерполация) — общо за хор/вибрато.
function readFrac(x, p) { if (p < 0) return 0; const j = Math.floor(p); if (j >= x.length - 1) return j < x.length ? x[j] : 0; const fr = p - j; return x[j] + (x[j + 1] - x[j]) * fr; }
function chorus(buf, depthMs, rateHz, mix) {
  const sr = buf.sampleRate; const base = 0.02 * sr; const depth = clamp(depthMs, 0, 20) / 1000 * sr; const m = clamp(mix, 0, 100) / 100; const w = 2 * Math.PI * clamp(rateHz, 0.05, 10) / sr;
  const out = getChannels(buf).map((x, c) => {
    const y = new Float32Array(x.length); const ph = c * 1.7;
    for (let i = 0; i < x.length; i++) {
      const d1 = base + depth * (1 + Math.sin(w * i + ph)), d2 = base * 1.4 + depth * (1 + Math.cos(w * 1.31 * i + ph));
      const v = (readFrac(x, i - d1) + readFrac(x, i - d2)) * 0.5;
      y[i] = x[i] * (1 - m * 0.5) + v * m;
    }
    return y;
  });
  return makeBuffer(out, sr);
}
function vibrato(buf, rateHz, depthPct) {
  const sr = buf.sampleRate; const base = 0.006 * sr; const depth = clamp(depthPct, 0, 100) / 100 * 0.004 * sr; const w = 2 * Math.PI * clamp(rateHz, 0.1, 20) / sr;
  const out = getChannels(buf).map((x) => { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = readFrac(x, i - base - depth * (1 + Math.sin(w * i))); return y; });
  return makeBuffer(out, sr);
}
function tremolo(buf, rateHz, depthPct) {
  const sr = buf.sampleRate; const d = clamp(depthPct, 0, 100) / 100; const w = 2 * Math.PI * clamp(rateHz, 0.1, 30) / sr;
  const out = getChannels(buf).map((x) => { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * (1 - d * (0.5 - 0.5 * Math.cos(w * i))); return y; });
  return makeBuffer(out, sr);
}
// Робот = пръстенова модулация със синус (носеща честота) + малко от сухия сигнал.
function robot(buf, freqHz) {
  const sr = buf.sampleRate; const w = 2 * Math.PI * clamp(freqHz, 5, 1000) / sr;
  const out = getChannels(buf).map((x) => { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * (0.85 * Math.sin(w * i) + 0.15); return y; });
  return makeBuffer(out, sr);
}

// ---------------------------------------------------------------- филтри през OfflineAudioContext
function biq(ctx, type, f, q, gain) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q; if (gain != null) n.gain.value = gain; return n; }
function shaper(ctx, drivePct) {
  const k = clamp(drivePct, 0, 100) / 100 * 40 + 1; const n = 2048; const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
  const ws = ctx.createWaveShaper(); ws.curve = curve; ws.oversample = '2x'; return ws;
}
function chain(nodes, ctx) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); nodes[nodes.length - 1].connect(ctx.destination); }
function eq(buf, lowDb, midDb, highDb) {
  return renderOffline(buf, buf.length, (ctx, src) => chain([src, biq(ctx, 'lowshelf', 250, null, clamp(lowDb, -30, 30)), biq(ctx, 'peaking', 1200, 0.9, clamp(midDb, -30, 30)), biq(ctx, 'highshelf', 4000, null, clamp(highDb, -30, 30))], ctx));
}
function telephone(buf, drive) {
  return renderOffline(buf, buf.length, (ctx, src) => chain([src, biq(ctx, 'highpass', 300, 0.8), biq(ctx, 'highpass', 300, 0.8), biq(ctx, 'lowpass', 3400, 0.8), biq(ctx, 'lowpass', 3400, 0.8), shaper(ctx, drive), biq(ctx, 'peaking', 1800, 1.2, 4)], ctx));
}
async function radio(buf, drive, staticPct) {
  const r = await renderOffline(buf, buf.length, (ctx, src) => chain([src, biq(ctx, 'highpass', 200, 0.9), biq(ctx, 'lowpass', 5000, 0.9), shaper(ctx, drive), biq(ctx, 'peaking', 2500, 1.0, 5)], ctx));
  const st = clamp(staticPct, 0, 100) / 100 * 0.05; if (st <= 0) return r;
  const chs = getChannels(r); let lp = 0;
  chs.forEach((x) => { for (let i = 0; i < x.length; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; x[i] = clamp(x[i] + lp * st, -1, 1); } });
  return makeBuffer(chs, r.sampleRate);
}
// Реверб: синтезирана импулсна характеристика (шум с експоненциално затихване до -60 dB за size_s) + конволюция.
function reverb(buf, sizeS, mix) {
  const sr = buf.sampleRate; const size = clamp(sizeS, 0.1, 10); const L = Math.round(size * sr); const m = clamp(mix, 0, 100) / 100;
  return renderOffline(buf, buf.length + L, (ctx, src) => {
    const ir = ctx.createBuffer(2, L, sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < L; i++) { const t = i / sr; const env = Math.pow(10, -3 * t / size) * (i < sr * 0.02 ? i / (sr * 0.02) : 1); d[i] = (Math.random() * 2 - 1) * env; } }
    const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = ir;
    const dry = ctx.createGain(); dry.gain.value = 1 - m; const wet = ctx.createGain(); wet.gain.value = m;
    src.connect(dry); dry.connect(ctx.destination); src.connect(conv); conv.connect(wet); wet.connect(ctx.destination);
  });
}

// ---------------------------------------------------------------- прости операции
function gain(buf, db) { const g = Math.pow(10, clamp(db, -60, 60) / 20); return makeBuffer(getChannels(buf).map((x) => { for (let i = 0; i < x.length; i++) x[i] = clamp(x[i] * g, -1, 1); return x; }), buf.sampleRate); }
function normalize(buf, targetDb) {
  const chs = getChannels(buf); let peak = 0; chs.forEach((x) => { for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; } });
  if (peak < 1e-6) return buf;
  const g = Math.pow(10, clamp(targetDb, -40, 0) / 20) / peak;
  return makeBuffer(chs.map((x) => { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }), buf.sampleRate);
}
function fade(buf, inMs, outMs) {
  const sr = buf.sampleRate; const fi = Math.min(buf.length, Math.round(clamp(inMs, 0, 60000) / 1000 * sr)); const fo = Math.min(buf.length, Math.round(clamp(outMs, 0, 60000) / 1000 * sr));
  return makeBuffer(getChannels(buf).map((x) => { for (let i = 0; i < fi; i++) x[i] *= i / fi; for (let i = 0; i < fo; i++) x[x.length - 1 - i] *= i / fo; return x; }), sr);
}
function reverse(buf) { return makeBuffer(getChannels(buf).map((x) => x.reverse()), buf.sampleRate); }
function trim(buf, startS, endS) {
  const sr = buf.sampleRate; const a = clamp(Math.round(num(startS, 0) * sr), 0, buf.length - 1); let b = num(endS, 0) > 0 ? Math.round(num(endS, 0) * sr) : buf.length; b = clamp(b, a + 1, buf.length);
  return makeBuffer(getChannels(buf).map((x) => x.slice(a, b)), sr);
}
function mono(buf) {
  if (buf.numberOfChannels === 1) return buf;
  const chs = getChannels(buf); const y = new Float32Array(buf.length);
  for (let i = 0; i < y.length; i++) { let s = 0; for (let c = 0; c < chs.length; c++) s += chs[c][i]; y[i] = s / chs.length; }
  return makeBuffer([y], buf.sampleRate);
}
function speed(buf, percent) { const r = clamp(num(percent, 100), 25, 400) / 100; return makeBuffer(getChannels(buf).map((x) => resampleChannel(x, r)), buf.sampleRate); }
async function tempo(buf, percent, onProg) {
  const r = clamp(num(percent, 100), 25, 400) / 100; if (Math.abs(r - 1) < 1e-4) return buf;
  const chs = getChannels(buf); const out = [];
  for (let c = 0; c < chs.length; c++) out.push(await stretchChannel(chs[c], 1 / r, (p) => onProg && onProg((c + p) / chs.length)));
  const len = Math.min.apply(null, out.map((x) => x.length));
  return makeBuffer(out.map((x) => x.subarray(0, len).slice()), buf.sampleRate);
}

// ---------------------------------------------------------------- диспечер
export async function applyEffect(buf, id, params, onProg) {
  const p = Object.assign(defaultParams(id), params || {});
  switch (id) {
    case 'pitch':     return pitchShift(buf, num(p.semitones, 0), onProg);
    case 'chipmunk':  return pitchShift(buf, Math.abs(num(p.amount, 7)), onProg);
    case 'deep':      return pitchShift(buf, -Math.abs(num(p.amount, 6)), onProg);
    case 'robot':     return robot(buf, num(p.freq_hz, 50));
    case 'telephone': return telephone(buf, num(p.drive, 30));
    case 'radio':     return radio(buf, num(p.drive, 50), num(p.static, 20));
    case 'vibrato':   return vibrato(buf, num(p.rate_hz, 5), num(p.depth, 40));
    case 'tremolo':   return tremolo(buf, num(p.rate_hz, 6), num(p.depth, 60));
    case 'chorus':    return chorus(buf, num(p.depth_ms, 3), num(p.rate_hz, 0.9), num(p.mix, 50));
    case 'echo':      return echo(buf, num(p.delay_ms, 300), num(p.feedback, 40), num(p.mix, 45));
    case 'reverb':    return reverb(buf, num(p.size_s, 2), num(p.mix, 40));
    case 'eq':        return eq(buf, num(p.low_db, 0), num(p.mid_db, 0), num(p.high_db, 0));
    case 'denoise':   return denoise(buf, num(p.strength, 60), onProg);
    case 'tempo':     return tempo(buf, num(p.percent, 100), onProg);
    case 'speed':     return speed(buf, num(p.percent, 100));
    case 'reverse':   return reverse(buf);
    case 'trim':      return trim(buf, p.start_s, p.end_s);
    case 'fade':      return fade(buf, num(p.fade_in_ms, 0), num(p.fade_out_ms, 0));
    case 'gain':      return gain(buf, num(p.db, 0));
    case 'normalize': return normalize(buf, num(p.target_db, -1));
    case 'mono':      return mono(buf);
    default: throw new Error('unknown effect: ' + id);
  }
}
export async function applyChain(buf, chainList, onProg) {
  let b = buf; const n = chainList.length;
  for (let i = 0; i < n; i++) { const [id, params] = chainList[i]; b = await applyEffect(b, id, params, (p) => onProg && onProg((i + p) / n)); if (onProg) onProg((i + 1) / n); }
  return b;
}

// ---------------------------------------------------------------- WAV (16-битов PCM)
export function encodeWav(buf) {
  const nCh = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const bytes = new Uint8Array(44 + n * nCh * 2); const dv = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * nCh * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, nCh, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * nCh * 2, true); dv.setUint16(32, nCh * 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, n * nCh * 2, true);
  const chs = []; for (let c = 0; c < nCh; c++) chs.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nCh; c++) { const v = clamp(chs[c][i], -1, 1); dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  return bytes;
}

// ---------------------------------------------------------------- вълнова форма (пикове за рисуване)
export function peaks(buf, n) {
  const out = new Float32Array(n); const len = buf.length; const per = Math.max(1, Math.floor(len / n)); const nCh = buf.numberOfChannels;
  const chs = []; for (let c = 0; c < nCh; c++) chs.push(buf.getChannelData(c));
  for (let i = 0; i < n; i++) { let m = 0; const a = i * per, b = Math.min(len, a + per); const st = Math.max(1, Math.floor(per / 64)); for (let j = a; j < b; j += st) for (let c = 0; c < nCh; c++) { const v = Math.abs(chs[c][j]); if (v > m) m = v; } out[i] = m; }
  return out;
}

// ---------------------------------------------------------------- синтезиран пример (без файл, без мрежа)
// „Глас": гласни а-е-и-о-у (хармоници, претеглени по формантите на всяка гласна) с лек вибрато и
// мелодия на основния тон + звънче от 3 ноти + много лек фонов шум (за да се вижда работата на шумопотискането).
const VOWELS = [[730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240]];
export function makeDemo(sr) {
  sr = sr || audioContext().sampleRate;
  const segDur = 0.42, gap = 0.05, chimeDur = 0.4;
  const voiceLen = Math.round(VOWELS.length * (segDur + gap) * sr);
  const chimeStart = voiceLen + Math.round(0.25 * sr);
  const total = chimeStart + Math.round(3 * chimeDur * sr) + Math.round(0.35 * sr);
  const y = new Float32Array(total);
  const bw = [90, 110, 150];
  for (let v = 0; v < VOWELS.length; v++) {
    const F = VOWELS[v]; const start = Math.round(v * (segDur + gap) * sr); const len = Math.round(segDur * sr);
    const f0base = 118 + [0, 6, 12, 4, -6][v];
    const amps = []; let sum = 0;
    for (let h = 1; h * f0base < 5200; h++) { let a = 0; for (let k = 0; k < 3; k++) { const d = (h * f0base - F[k]) / bw[k]; a += 1 / (1 + d * d); } a *= 1 / Math.sqrt(h); amps.push(a); sum += a; }
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr; const env = Math.min(1, i / (0.03 * sr), (len - i) / (0.06 * sr));
      const f0 = f0base * (1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * t)) * (1 + 0.04 * t);
      ph += 2 * Math.PI * f0 / sr; let s = 0;
      for (let h = 0; h < amps.length; h++) s += amps[h] * Math.sin(ph * (h + 1));
      y[start + i] += (s / sum) * 0.9 * env;
    }
  }
  const notes = [523.25, 659.25, 783.99];
  for (let n = 0; n < 3; n++) {
    const start = chimeStart + Math.round(n * chimeDur * sr); const len = Math.round(0.7 * sr);
    for (let i = 0; i < len && start + i < total; i++) { const t = i / sr; const env = Math.exp(-4.5 * t) * Math.min(1, i / (0.004 * sr)); y[start + i] += 0.35 * env * (Math.sin(2 * Math.PI * notes[n] * t) + 0.35 * Math.sin(2 * Math.PI * notes[n] * 2 * t) + 0.12 * Math.sin(2 * Math.PI * notes[n] * 3 * t)); }
  }
  let lp = 0; for (let i = 0; i < total; i++) { lp = lp * 0.5 + (Math.random() * 2 - 1) * 0.5; y[i] = clamp(y[i] + lp * 0.006, -1, 1); }
  return makeBuffer([y], sr);
}
