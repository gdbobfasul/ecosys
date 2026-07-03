// Version: 1.0001
// voiceprint.js — МЕК гласов профил на собственика (разпознаване по глас).
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ВАЖНО — ЧЕСТНО (НЕ Е СИГУРНОСТ):                                       ║
// ║   Това е МЕК/удобен сигнал, НЕ е сигурна биометрична автентикация.     ║
// ║   Може да бъде заблуден от запис на гласа ти и е чувствителен към шум  ║
// ║   и микрофон. КОДОВАТА ДУМА остава ЕДИНСТВЕНИЯТ истински ключ.          ║
// ║   Гласовото съвпадение НИКОГА не отключва, не заобикаля заключването и  ║
// ║   не дава достъп само по себе си. Истинска speaker verification би      ║
// ║   изисквала тежък ML модел/сървър (извън обхвата — тук само безплатно,  ║
// ║   on-device).                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// КАК РАБОТИ (изцяло on-device, чист JS, Web Audio API; без облак, без модел):
//   1) Enrollment (обучение): при първите няколко гласови реплики на собственика
//      (след отключване) хващаме къс аудио буфер от микрофона и смятаме ЛЕК
//      акустичен feature вектор за репликата. Усредняваме N реплики в съхранен
//      профил (локално, в storage).
//   2) Verification (проверка): при по-късен глас смятаме същите features и
//      similarity спрямо профила → matchOwnerVoice(sample) → {score, isLikelyOwner}.
//
// FEATURES (леки, евтини, без ML):
//   • F0 / pitch (Hz) — оценка чрез autocorrelation на времевия сигнал.
//   • Spectral centroid (Hz) — „яркост“ на спектъра.
//   • Spectral rolloff (Hz) — честота, под която е 85% от енергията.
//   • Zero-crossing rate — груба мярка за шумност/височина.
//   • RMS energy — сила.
//   • Band energies (8 log-разпределени ленти) — груб MFCC-подобен профил.
//   Векторът се нормализира (z-score по съхранена статистика) при сравнение, за
//   да не доминира силата/мащабът; similarity = косинусова близост на устойчивите
//   признаци + близост по pitch.
//
// API:
//   voiceprintSupported()                  → bool (Web Audio + getUserMedia налични)
//   enrollmentTarget()                      → нужният брой реплики (от настройки/деф.)
//   enrollmentProgress()                    → { count, target, done, enabled }
//   voiceProfileExists()                    → bool
//   captureSampleFeatures({ ms })           → Promise<features|null> (от микрофона)
//   extractFeatures(float32, sampleRate)    → features  (чиста математика, тестваема)
//   addEnrollmentSample(features)           → { count, target, done } (усреднява в профила)
//   matchOwnerVoice(features)               → { score, isLikelyOwner, reason }
//   similarity(a, b)                        → number 0..1  (чиста математика, тестваема)
//   resetVoiceProfile()                     → трие профила (за „Преобучи гласа“)
//   setVoiceProfileEnabled(bool) / voiceProfileEnabled()
//   getThreshold() / setThreshold(num)
//
// Профилът живее в storage под settings.voice.profile (виж storage.js defaults).
// При липса на микрофон / неподдържан Web Audio → функцията просто е изключена,
// БЕЗ срив (graceful degrade), точно като останалия глас.

import { getState, persist } from './storage.js';

// Колко реплики събираме по подразбиране, преди профилът да е „готов“.
const DEFAULT_ENROLL_TARGET = 5;
// Праг на сходство по подразбиране (тунируем). Над него → „вероятно собственикът“.
// Нарочно умерен: мек сигнал, не заключване.
const DEFAULT_THRESHOLD = 0.82;
// Колко ленти за band-energy профила.
const N_BANDS = 8;
// Дължина на хващания буфер по подразбиране (ms).
const DEFAULT_CAPTURE_MS = 1200;

// --- Достъп до под-състоянието на профила (с безопасни дефолти) ---------
function vp() {
  const st = getState();
  const v = (st.settings && st.settings.voice) || {};
  if (!v.profile) {
    v.profile = defaultProfile();
    if (st.settings && st.settings.voice) st.settings.voice.profile = v.profile;
  }
  return v.profile;
}
function defaultProfile() {
  return {
    enabled: true,        // гласовият профил включен ли е (мек сигнал)
    target: DEFAULT_ENROLL_TARGET,
    threshold: DEFAULT_THRESHOLD,
    count: 0,             // колко реплики са вписани досега
    mean: null,           // усреднен feature вектор (обектът features)
    // текуща статистика за нормализация при сравнение (стандартни отклонения)
    m2: null,             // сума на квадрати на отклоненията (за онлайн дисперсия)
    updatedAt: null
  };
}

// =========================================================================
//  ПОДДРЪЖКА / НАСТРОЙКИ
// =========================================================================

export function voiceprintSupported() {
  try {
    if (typeof window === 'undefined') return false;
    const hasCtx = !!(window.AudioContext || window.webkitAudioContext);
    const hasMic = !!(typeof navigator !== 'undefined' && navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function');
    return hasCtx && hasMic;
  } catch (_) { return false; }
}

export function voiceProfileEnabled() { return !!vp().enabled; }
export function setVoiceProfileEnabled(on) { vp().enabled = !!on; persist(); }

export function enrollmentTarget() {
  const t = parseInt(vp().target, 10);
  return (isNaN(t) || t < 1) ? DEFAULT_ENROLL_TARGET : t;
}
export function getThreshold() {
  const t = Number(vp().threshold);
  return (isNaN(t) || t <= 0 || t >= 1) ? DEFAULT_THRESHOLD : t;
}
export function setThreshold(v) {
  const n = Number(v);
  if (!isNaN(n) && n > 0 && n < 1) { vp().threshold = n; persist(); }
}

export function voiceProfileExists() {
  const p = vp();
  return !!(p.mean && p.count >= enrollmentTarget());
}

export function enrollmentProgress() {
  const p = vp();
  const target = enrollmentTarget();
  const count = Math.min(p.count || 0, target);
  return { count, target, done: count >= target, enabled: !!p.enabled };
}

export function resetVoiceProfile() {
  const st = getState();
  const enabled = vp().enabled;       // запазваме предпочитанието вкл/изкл
  const threshold = vp().threshold;
  const target = vp().target;
  if (st.settings && st.settings.voice) {
    st.settings.voice.profile = { ...defaultProfile(), enabled, threshold, target };
  }
  persist();
}

// =========================================================================
//  ХВАЩАНЕ НА АУДИО ОТ МИКРОФОНА (Web Audio API; degrade gracefully)
// =========================================================================

// Хваща ~ms милисекунди от микрофона и връща feature обекта (или null при липса
// на поддръжка/разрешение/прекалено тих сигнал). НИКОГА не хвърля.
// ВАЖНО: преизползва същия mic permission flow като voice.js (getUserMedia).
export async function captureSampleFeatures({ ms = DEFAULT_CAPTURE_MS } = {}) {
  if (!voiceprintSupported()) return null;
  let stream = null;
  let ctx = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    const sampleRate = ctx.sampleRate || 44100;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const timeBuf = new Float32Array(analyser.fftSize);
    const frames = [];
    const frameCount = Math.max(4, Math.round((ms / 1000) * (sampleRate / analyser.fftSize)));
    // Събираме няколко кадъра през интервали и ги осредняваме на ниво features.
    for (let i = 0; i < frameCount; i++) {
      // getFloatTimeDomainData не е универсален; пазим се.
      if (typeof analyser.getFloatTimeDomainData === 'function') {
        analyser.getFloatTimeDomainData(timeBuf);
      } else {
        const byteBuf = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(byteBuf);
        for (let j = 0; j < byteBuf.length; j++) timeBuf[j] = (byteBuf[j] - 128) / 128;
      }
      // копираме кадъра, защото timeBuf се презаписва
      frames.push(extractFeatures(Float32Array.from(timeBuf), sampleRate));
      await waitFrame(ms / frameCount);
    }
    const avg = averageFeatures(frames.filter((f) => f && f.rms > 0.004)); // махаме тишина
    return avg; // може да е null ако всичко е било тишина
  } catch (_) {
    return null; // отказан микрофон / неподдържано → мълчи, функцията деградира
  } finally {
    try { if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); } catch (_) {}
    try { if (ctx && typeof ctx.close === 'function') ctx.close(); } catch (_) {}
  }
}

function waitFrame(ms) {
  return new Promise((r) => setTimeout(r, Math.max(8, Math.min(80, ms || 30))));
}

// =========================================================================
//  ИЗВЛИЧАНЕ НА ПРИЗНАЦИ — ЧИСТА МАТЕМАТИКА (тестваема без микрофон)
// =========================================================================

// Връща { rms, zcr, pitch, centroid, rolloff, bands:[...] } за времеви сигнал.
// signal: Float32Array (-1..1), sampleRate: Hz.
export function extractFeatures(signal, sampleRate) {
  const N = signal.length;
  if (!N) return null;
  const sr = sampleRate || 44100;

  // --- RMS energy ---
  let sumSq = 0;
  for (let i = 0; i < N; i++) sumSq += signal[i] * signal[i];
  const rms = Math.sqrt(sumSq / N);

  // --- Zero-crossing rate ---
  let zc = 0;
  for (let i = 1; i < N; i++) {
    if ((signal[i - 1] >= 0) !== (signal[i] >= 0)) zc++;
  }
  const zcr = zc / N;

  // --- Pitch (F0) чрез нормализирана autocorrelation ---
  const pitch = estimatePitch(signal, sr);

  // --- Спектър (DFT magnitude) за centroid/rolloff/bands ---
  // За скорост ползваме умерен брой кошчета.
  const spec = magnitudeSpectrum(signal, sr);
  const { centroid, rolloff } = spectralShape(spec, sr, N);
  const bands = bandEnergies(spec, sr, N, N_BANDS);

  return { rms, zcr, pitch, centroid, rolloff, bands };
}

// Autocorrelation pitch detector (груб, но реален). Връща Hz или 0 при нетонален вход.
function estimatePitch(signal, sr) {
  const N = signal.length;
  const minHz = 70, maxHz = 400;            // човешки говор
  const maxLag = Math.min(N - 1, Math.floor(sr / minHz));
  const minLag = Math.max(2, Math.floor(sr / maxHz));
  // нулева енергия?
  let energy = 0;
  for (let i = 0; i < N; i++) energy += signal[i] * signal[i];
  if (energy < 1e-6) return 0;

  let bestLag = -1, bestVal = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < N; i++) sum += signal[i] * signal[i + lag];
    const norm = sum / (N - lag);
    if (norm > bestVal) { bestVal = norm; bestLag = lag; }
  }
  // прагът ограничава фалшиви пикове при шум
  if (bestLag <= 0 || bestVal < energy / N * 0.30) return 0;
  return sr / bestLag;
}

// Magnitude спектър чрез наивна DFT върху подмостряни кошчета (евтино, без външен FFT).
// Връща Float32Array от magnitudes за K кошчета (0..sr/2).
function magnitudeSpectrum(signal, sr) {
  const N = signal.length;
  const K = 64;                              // брой честотни кошчета (груб, но стабилен)
  const mags = new Float32Array(K);
  // прозорец (Hann) за по-малко изтичане
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = signal[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const nyq = sr / 2;
  for (let k = 0; k < K; k++) {
    const freq = (k + 0.5) * (nyq / K);
    const w = (2 * Math.PI * freq) / sr;
    let re = 0, im = 0;
    // подмостряме за скорост: стъпка ~ за да паднем до ≤512 умножения на кошче
    const step = Math.max(1, Math.floor(N / 512));
    for (let i = 0; i < N; i += step) {
      const a = w * i;
      re += win[i] * Math.cos(a);
      im -= win[i] * Math.sin(a);
    }
    mags[k] = Math.sqrt(re * re + im * im);
  }
  return mags;
}

function spectralShape(mags, sr, _N) {
  const K = mags.length;
  const nyq = sr / 2;
  let total = 0, weighted = 0;
  for (let k = 0; k < K; k++) {
    const freq = (k + 0.5) * (nyq / K);
    total += mags[k];
    weighted += freq * mags[k];
  }
  const centroid = total > 0 ? weighted / total : 0;
  // rolloff: честотата, под която е 85% от енергията
  const target = total * 0.85;
  let acc = 0, rolloff = 0;
  for (let k = 0; k < K; k++) {
    acc += mags[k];
    if (acc >= target) { rolloff = (k + 0.5) * (nyq / K); break; }
  }
  return { centroid, rolloff };
}

// Log-разпределени ленти → нормализирана енергия по лента (сумата = 1).
function bandEnergies(mags, sr, _N, nBands) {
  const K = mags.length;
  const nyq = sr / 2;
  const fMin = 80, fMax = Math.min(nyq, 6000);
  const out = new Array(nBands).fill(0);
  const logMin = Math.log(fMin), logMax = Math.log(fMax);
  for (let k = 0; k < K; k++) {
    const freq = (k + 0.5) * (nyq / K);
    if (freq < fMin || freq > fMax) continue;
    let b = Math.floor(((Math.log(freq) - logMin) / (logMax - logMin)) * nBands);
    if (b < 0) b = 0; if (b >= nBands) b = nBands - 1;
    out[b] += mags[k] * mags[k];          // енергия
  }
  let sum = 0;
  for (let i = 0; i < nBands; i++) sum += out[i];
  if (sum > 0) for (let i = 0; i < nBands; i++) out[i] /= sum;
  return out;
}

// =========================================================================
//  ОСРЕДНЯВАНЕ + ENROLLMENT (онлайн усредняване в съхранения профил)
// =========================================================================

function averageFeatures(list) {
  if (!list || !list.length) return null;
  const n = list.length;
  const acc = { rms: 0, zcr: 0, pitch: 0, centroid: 0, rolloff: 0, bands: new Array(N_BANDS).fill(0) };
  let pitchN = 0;
  for (const f of list) {
    acc.rms += f.rms; acc.zcr += f.zcr; acc.centroid += f.centroid; acc.rolloff += f.rolloff;
    if (f.pitch > 0) { acc.pitch += f.pitch; pitchN++; }   // 0 (нетонален) не разрежда pitch
    for (let i = 0; i < N_BANDS; i++) acc.bands[i] += (f.bands[i] || 0);
  }
  acc.rms /= n; acc.zcr /= n; acc.centroid /= n; acc.rolloff /= n;
  acc.pitch = pitchN ? acc.pitch / pitchN : 0;
  for (let i = 0; i < N_BANDS; i++) acc.bands[i] /= n;
  return acc;
}

// Влива нова реплика в профила (текущо средно). Връща прогреса.
export function addEnrollmentSample(features) {
  const p = vp();
  if (!features) return enrollmentProgress();
  if (!p.mean) {
    p.mean = cloneFeatures(features);
    p.count = 1;
  } else {
    const n = p.count + 1;
    p.mean.rms += (features.rms - p.mean.rms) / n;
    p.mean.zcr += (features.zcr - p.mean.zcr) / n;
    p.mean.centroid += (features.centroid - p.mean.centroid) / n;
    p.mean.rolloff += (features.rolloff - p.mean.rolloff) / n;
    if (features.pitch > 0) {
      // pitch се осреднява само от тонални реплики
      const pn = (p.mean._pitchN || 1) + 1;
      p.mean.pitch += (features.pitch - p.mean.pitch) / pn;
      p.mean._pitchN = pn;
    }
    for (let i = 0; i < N_BANDS; i++) {
      p.mean.bands[i] += ((features.bands[i] || 0) - p.mean.bands[i]) / n;
    }
    p.count = n;
  }
  p.updatedAt = Date.now();
  persist();
  return enrollmentProgress();
}

function cloneFeatures(f) {
  return {
    rms: f.rms, zcr: f.zcr, pitch: f.pitch, centroid: f.centroid, rolloff: f.rolloff,
    bands: (f.bands || []).slice(),
    _pitchN: f.pitch > 0 ? 1 : 0
  };
}

// =========================================================================
//  СХОДСТВО + ПРОВЕРКА (мек сигнал; НИКОГА не пипа заключването)
// =========================================================================

// similarity(a, b) → 0..1. Комбинира:
//   • косинусова близост на band-energy профила (форма на спектъра — устойчива),
//   • близост по pitch (относителна разлика),
//   • близост по spectral centroid (относителна),
//   • близост по zero-crossing rate.
// Чиста математика, тестваема без микрофон.
export function similarity(a, b) {
  if (!a || !b) return 0;
  const cos = cosineSim(a.bands || [], b.bands || []);             // 0..1
  const pitchSim = relSim(a.pitch, b.pitch, 60);                   // толеранс ~60Hz
  const centSim = relSim(a.centroid, b.centroid, 800);            // толеранс ~800Hz
  const zcrSim = relSim(a.zcr, b.zcr, 0.08);                      // толеранс на ZCR
  // Тежести: формата на спектъра носи най-много, после pitch.
  const score = 0.50 * cos + 0.25 * pitchSim + 0.15 * centSim + 0.10 * zcrSim;
  return clamp01(score);
}

function cosineSim(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return clamp01(dot / (Math.sqrt(na) * Math.sqrt(nb)));
}

// Относително сходство: 1 при равни, → 0 при разлика >= толеранс.
function relSim(x, y, tol) {
  if (!x && !y) return 1;        // и двете нула → еднакви (напр. нетонален)
  if (!x || !y) return 0;        // едното липсва → различни
  const d = Math.abs(x - y);
  return clamp01(1 - d / (tol || 1));
}

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

// matchOwnerVoice(features) → { score, isLikelyOwner, reason }
// МЕК сигнал. НЕ отключва и НЕ заобикаля заключването — само информира UI/увереност.
export function matchOwnerVoice(features) {
  const p = vp();
  if (!p.enabled) return { score: 0, isLikelyOwner: false, reason: 'disabled' };
  if (!p.mean || (p.count || 0) < enrollmentTarget()) {
    return { score: 0, isLikelyOwner: false, reason: 'not-enrolled' };
  }
  if (!features) return { score: 0, isLikelyOwner: false, reason: 'no-sample' };
  const score = similarity(features, p.mean);
  return {
    score,
    isLikelyOwner: score >= getThreshold(),
    reason: 'ok'
  };
}
