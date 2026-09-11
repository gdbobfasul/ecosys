// Version: 1.0021
// audio.js — прихващане на звук от микрофона и извличане на акустични признаци. БЕЗ AI, БЕЗ мрежа —
// всичко се смята на устройството. Връща вектор от признаци 0..1, който analyze.js сравнява с базата
// PROBLEMS (data.js).
//
// ДВА ПЪТЯ ЗА ЗАПИС (Huawei 3.1, 08.09 и 10.09.2026: „No microphone access" при ДАДЕНО разрешение на
// Mate 30 Pro/EMUI 12 и Nova 9/EMUI 13 — EMUI WebView-ът отказва getUserMedia дори след ensureMic()):
//   1) НАТИВЕН (предпочитан на телефон): window.PupikesNative.startRecord(сек) — Android AudioRecord в
//      MainActivity (шаблонът в deploy-scripts/build-mobile-apps.sh) → WAV 16 kHz mono PCM 16-bit в кеша на
//      апа → getRecordBase64() → тук WAV-ът се разчита и се смятат СЪЩИТЕ признаци със собствен FFT
//      (без AudioContext/getUserMedia). Временният файл се трие веднага след анализа (deleteRecord()).
//   2) getUserMedia + Web Audio AnalyserNode (браузър/устройства без моста) — досегашният път. Ако
//      нативният път се провали по друга причина (не липса на разрешение), пада на този.
//
// Признаци: rumble/lowmid/mid/highmid/high (честотни ленти), knock (тежко ритмично тропане),
// tick (бързо цъкане), squeal (устойчив писклив тон), grind (широколентово стържене),
// hiss (равномерно съскане), rough (пулсираща/неравна работа), loud (обща сила).
// И двата пътя подават кадри в ЕДИН И СЪЩ акумулатор (makeAccumulator) → еднакви резултати.

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function AC() { return window.AudioContext || window.webkitAudioContext; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const FFT_SIZE = 4096;

// Нативният мост за запис (MainActivity → PupikesNative) — има го само в APK билда.
export function nativeRecAvailable() {
  const n = window.PupikesNative;
  return !!(n && typeof n.startRecord === 'function' && typeof n.getRecordBase64 === 'function');
}
// Уеб път: getUserMedia + Web Audio.
function webMicAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && AC());
}
// Проверка за наличен микрофон/аудио стек (нативен ИЛИ уеб).
export function micAvailable() { return nativeRecAvailable() || webMicAvailable(); }

// ───────────────────────── общ акумулатор на признаци ─────────────────────────
// push(freq, time): freq = Uint8Array 0..255 по бинове (като AnalyserNode.getByteFrequencyData: dB от −100 до −30
// → 0..255), time = Uint8Array 0..255 (като getByteTimeDomainData: 128 + s·128). Връща нивото 0..1 за индикатора.
// finish(secs): обобщава признаците; secs = реална дължина на записа (за честотата на ударите).
function makeAccumulator(bins, binHz) {
  const idx = (hz) => Math.max(0, Math.min(bins - 1, Math.round(hz / binHz)));
  const B = {
    rumble: [idx(20), idx(120)], lowmid: [idx(120), idx(400)], mid: [idx(400), idx(2000)],
    highmid: [idx(2000), idx(6000)], high: [idx(6000), Math.min(bins - 1, idx(16000))]
  };
  let freq = null;
  const bandAvg = (name) => { const [a, b] = B[name]; let s = 0, n = 0; for (let i = a; i <= b; i++) { s += freq[i]; n++; } return n ? s / n / 255 : 0; };
  // спектрална „плоскост" (шум срещу тон) в дадена лента: geomean/mean → 1=шум, ~0=чист тон
  const flatness = (name) => {
    const [a, b] = B[name]; let logSum = 0, lin = 0, n = 0;
    for (let i = a; i <= b; i++) { const v = freq[i] / 255 + 1e-6; logSum += Math.log(v); lin += v; n++; }
    if (!n) return 1; const gm = Math.exp(logSum / n), am = lin / n; return clamp01(gm / (am + 1e-6));
  };
  // остротата на върха в лента: max/avg → голямо = тесен силен тон (писък)
  const peakiness = (name) => {
    const [a, b] = B[name]; let mx = 0, s = 0, n = 0; for (let i = a; i <= b; i++) { const v = freq[i]; if (v > mx) mx = v; s += v; n++; } const av = n ? s / n : 0; return av > 4 ? clamp01((mx / (av + 1e-6) - 1) / 6) : 0;
  };

  const acc = { rumble: 0, lowmid: 0, mid: 0, highmid: 0, high: 0 };
  const rmsSeq = [];                 // времева обвивка (сила по кадри) → за ритъм/грапавина
  let squealPersist = 0, hissPersist = 0, flatSum = 0, frames = 0;

  return {
    push(f, time) {
      freq = f;
      // RMS от времевата форма (0..1)
      let sq = 0; for (let i = 0; i < time.length; i++) { const d = (time[i] - 128) / 128; sq += d * d; }
      const rms = Math.sqrt(sq / time.length);
      rmsSeq.push(rms);
      acc.rumble += bandAvg('rumble'); acc.lowmid += bandAvg('lowmid'); acc.mid += bandAvg('mid');
      acc.highmid += bandAvg('highmid'); acc.high += bandAvg('high');
      // писък: тесен силен връх в highmid/high, който се задържа
      const pk = Math.max(peakiness('highmid'), peakiness('high'));
      if (pk > 0.45) squealPersist++;
      // съскане: широколентов шум (плосък спектър) в highmid, устойчив, без силна модулация
      if (flatness('highmid') > 0.55 && bandAvg('highmid') > 0.12) hissPersist++;
      flatSum += (flatness('mid') + flatness('high')) / 2;
      frames++;
      return clamp01(rms * 3);
    },
    finish(secs) {
      const f = frames || 1;
      const rumble = clamp01(acc.rumble / f * 1.6);
      const lowmid = clamp01(acc.lowmid / f * 1.5);
      const mid = clamp01(acc.mid / f * 1.6);
      const highmid = clamp01(acc.highmid / f * 1.8);
      const high = clamp01(acc.high / f * 2.2);
      const loud = clamp01((rmsSeq.reduce((a, b) => a + b, 0) / f) * 3);

      // ── ритъм/грапавина от обвивката ──
      const mean = rmsSeq.reduce((a, b) => a + b, 0) / f;
      let varSum = 0; for (const v of rmsSeq) varSum += (v - mean) * (v - mean);
      const cv = mean > 0.01 ? Math.sqrt(varSum / f) / mean : 0;          // коеф. на вариация
      const rough = clamp01((cv - 0.15) * 1.4);                          // неравна работа/прекъсване

      // броене на пикове в обвивката → честота на ударите
      let peaks = 0; const thr = mean + Math.sqrt(varSum / f) * 0.8;
      for (let i = 1; i < rmsSeq.length - 1; i++) { if (rmsSeq[i] > thr && rmsSeq[i] >= rmsSeq[i - 1] && rmsSeq[i] > rmsSeq[i + 1]) peaks++; }
      const peakRate = peaks / Math.max(0.5, secs || 1);                 // удари в секунда
      // тежко тропане (knock): по-бавни удари + доминира ниската лента
      const lowDom = clamp01((rumble + lowmid) - (highmid + high) + 0.3);
      const knock = clamp01((peakRate >= 2 && peakRate <= 22 ? (peakRate / 22) : 0) * (0.4 + lowDom));
      // бързо цъкане (tick): по-чести удари + повече средна/висока лента
      const hiDom = clamp01((mid + highmid) - rumble + 0.2);
      const tick = clamp01((peakRate > 6 ? Math.min(1, peakRate / 30) : 0) * (0.4 + hiDom));

      const squeal = clamp01(squealPersist / f * 1.5);
      const hiss = clamp01(hissPersist / f * 1.4);
      // стържене (grind): широколентов, шумен (плосък) звук със сила в mid+high, но не чист тон
      const grind = clamp01(((mid + high) / 2) * (0.4 + clamp01(flatSum / f)) - squeal * 0.5);

      return {
        rumble, lowmid, mid, highmid, high, knock, tick, squeal, grind, hiss, rough, loud,
        _meta: { frames: f, peakRate: +peakRate.toFixed(2), durationMs: Math.round((secs || 0) * 1000) }
      };
    }
  };
}

// ───────────────────────── собствен FFT (за WAV буфера) ─────────────────────────
// Итеративен radix-2 FFT на място (re/im Float32Array с дължина n = степен на 2).
function makeFFT(n) {
  const bits = Math.round(Math.log2(n));
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) { let r = 0, x = i; for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
  const cosT = new Float32Array(n / 2), sinT = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cosT[i] = Math.cos(-2 * Math.PI * i / n); sinT[i] = Math.sin(-2 * Math.PI * i / n); }
  return function fft(re, im) {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const l = i + j + half, u = i + j;
          const tr = re[l] * cosT[k] - im[l] * sinT[k];
          const ti = re[l] * sinT[k] + im[l] * cosT[k];
          re[l] = re[u] - tr; im[l] = im[u] - ti; re[u] += tr; im[u] += ti;
        }
      }
    }
  };
}

// Признаци от PCM буфер (Float32Array −1..1) — кадри по FFT_SIZE проби със стъпка ≈ 1/60 s (както rAF в уеб
// пътя), прозорец на Blackman и dB-скала като на AnalyserNode → същите байтови кадри → същият акумулатор.
export function featuresFromPcm(pcm, sampleRate) {
  const N = FFT_SIZE, bins = N / 2, sr = sampleRate || 16000, binHz = sr / N;
  const hop = Math.max(64, Math.round(sr / 60));
  const A = makeAccumulator(bins, binHz);
  const fft = makeFFT(N);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N);
  const re = new Float32Array(N), im = new Float32Array(N);
  const freq = new Uint8Array(bins), time = new Uint8Array(N);
  const total = Math.max(pcm.length, N);
  for (let start = 0; start + N <= total; start += hop) {
    for (let i = 0; i < N; i++) {
      const s = start + i < pcm.length ? pcm[start + i] : 0;
      re[i] = s * win[i]; im[i] = 0;
      time[i] = Math.max(0, Math.min(255, Math.round(128 + s * 128)));
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N;
      const db = 20 * Math.log10(mag + 1e-12);                       // AnalyserNode: min −100 dB, max −30 dB
      freq[k] = Math.max(0, Math.min(255, Math.round((db + 100) / 70 * 255)));
    }
    A.push(freq, time);
  }
  return A.finish(pcm.length / sr);
}

// Разчита WAV (RIFF/PCM 16-bit, 1+ канала → моно) → { pcm: Float32Array, sampleRate }.
export function parseWav(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('wav-format');
  let off = 12, sr = 16000, ch = 1, bits = 16, dataOff = -1, dataLen = 0;
  while (off + 8 <= bytes.length) {
    const id = tag(off), len = dv.getUint32(off + 4, true);
    if (id === 'fmt ') { ch = dv.getUint16(off + 10, true) || 1; sr = dv.getUint32(off + 12, true) || 16000; bits = dv.getUint16(off + 22, true) || 16; }
    else if (id === 'data') { dataOff = off + 8; dataLen = Math.min(len, bytes.length - dataOff); break; }
    off += 8 + len + (len & 1);
  }
  if (dataOff < 0 || bits !== 16) throw new Error('wav-data');
  const n = Math.floor(dataLen / 2 / ch);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; for (let c = 0; c < ch; c++) s += dv.getInt16(dataOff + (i * ch + c) * 2, true);
    pcm[i] = s / ch / 32768;
  }
  return { pcm, sampleRate: sr };
}

function base64ToBytes(b64) {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ───────────────────────── нативен път (AudioRecord през PupikesNative) ─────────────────────────
async function analyzeNative(dur, onLevel) {
  const nat = window.PupikesNative;
  // Runtime разрешение: ensureMic() го иска; при "requested" чакаме потребителя да отговори (до ~20 s).
  let st = 'error'; try { st = String(nat.ensureMic()); } catch (_) {}
  for (let i = 0; i < 40 && st === 'requested'; i++) { await sleep(500); try { st = String(nat.ensureMic()); } catch (_) {} }
  if (st !== 'granted') throw new Error('mic-denied');
  const secs = Math.max(2, Math.ceil(dur / 1000));
  let r = ''; try { r = String(nat.startRecord(secs)); } catch (e) { r = 'error:' + (e && e.message); }
  if (r === 'busy') { try { nat.stopRecord(); } catch (_) {} await sleep(300); try { r = String(nat.startRecord(secs)); } catch (e) { r = 'error:' + (e && e.message); } }
  if (r === 'denied') throw new Error('mic-denied');
  if (r !== 'ok') throw new Error('native-' + r);
  try {
    // Записът спира сам след secs; междувременно четем нивото за индикатора.
    const t0 = Date.now();
    while (Date.now() - t0 < dur + 2500) {
      let on = true; try { on = !!nat.isRecording(); } catch (_) {}
      if (!on && Date.now() - t0 > 300) break;
      let lvl = 0; try { lvl = Number(nat.getRecordLevel()) || 0; } catch (_) {}
      if (typeof onLevel === 'function') { try { onLevel(clamp01(lvl)); } catch (_) {} }
      await sleep(50);
    }
    try { nat.stopRecord(); } catch (_) {}
    let b64 = ''; try { b64 = String(nat.getRecordBase64() || ''); } catch (_) {}
    if (!b64) throw new Error('native-empty');
    const wav = parseWav(base64ToBytes(b64));
    if (wav.pcm.length < wav.sampleRate * 0.5) throw new Error('native-short');
    const feat = featuresFromPcm(wav.pcm, wav.sampleRate);
    feat._meta.source = 'native'; feat._meta.sampleRate = wav.sampleRate;
    return feat;
  } finally {
    // временният WAV в кеша се трие веднага — нищо не остава на устройството
    try { if (typeof nat.deleteRecord === 'function') nat.deleteRecord(); } catch (_) {}
  }
}

// ───────────────────────── уеб път (getUserMedia + AnalyserNode) ─────────────────────────
async function analyzeWeb(dur, onLevel) {
  if (!webMicAvailable()) throw new Error('no-mic');
  let stream = null, ctx = null;
  try {
    // Huawei 3.1 (08.09.2026, Mate 30 Pro/EMUI 12): 1) WebView-ът отхвърля изключените constraints (echo/noise/AGC)
    // → OverconstrainedError; 2) runtime разрешението RECORD_AUDIO не е поискано преди getUserMedia. Затова: първо
    // нативно ensureMic() (MainActivity), после опит с „сурови" constraints, при грешка — най-простото { audio: true }.
    try { const nat = window.PupikesNative; if (nat && typeof nat.ensureMic === 'function' && nat.ensureMic() === 'requested') await sleep(1500); } catch (_) {}
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (e1) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    ctx = new (AC())();
    const srcNode = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.0;   // без изглаждане — ловим импулсите (тропане/цъкане)
    srcNode.connect(analyser);

    const bins = analyser.frequencyBinCount;              // 2048
    const sr = ctx.sampleRate || 44100;
    const A = makeAccumulator(bins, sr / analyser.fftSize);
    const freq = new Uint8Array(bins);
    const time = new Uint8Array(analyser.fftSize);

    const start = ctx.currentTime;
    await new Promise((resolve) => {
      const tick = () => {
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(time);
        const lvl = A.push(freq, time);
        if (typeof onLevel === 'function') { try { onLevel(lvl); } catch (_) {} }
        if (ctx.currentTime - start >= dur / 1000) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const feat = A.finish(dur / 1000);
    feat._meta.source = 'web'; feat._meta.sampleRate = sr;
    return feat;
  } finally {
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { if (ctx && ctx.close) ctx.close(); } catch (_) {}
  }
}

// Записва ~durationMs, вика onLevel(0..1) на всеки кадър (за визуализация), после връща признаците.
// onLevel е по избор. Хвърля грешка при отказан/липсващ микрофон — викащият показва съобщение.
// Ред: нативен запис (ако мостът е наличен) → при провал, който НЕ е липса на разрешение, уеб път.
export async function analyzeMic(durationMs, onLevel) {
  if (!micAvailable()) throw new Error('no-mic');
  const dur = Math.max(2000, Math.min(8000, durationMs || 4500));
  if (nativeRecAvailable()) {
    try { return await analyzeNative(dur, onLevel); }
    catch (e) {
      const msg = String((e && e.message) || e);
      if (msg === 'mic-denied' || !webMicAvailable()) throw e;
    }
  }
  return analyzeWeb(dur, onLevel);
}
