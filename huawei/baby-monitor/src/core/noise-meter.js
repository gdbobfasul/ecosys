// Version: 1.0027
// noise-meter.js — ниво на шума от микрофона (RMS → 0..100), само на устройството.
// Нищо не се записва и не се праща; стойността се чете на всеки SAMPLE_MS и се подава на слушателите.
//
// Един микрофонен поток, МНОГО слушатели: детегледачката („Детегледачка") слуша за плач през цялата
// нощ, а графикът в „Грижа" може да се включва/изключва, без да ѝ спира микрофона.
// startMeter(fn) добавя слушател (отваря микрофона при първия); stopMeter(fn) го маха
// (затваря микрофона при последния); stopMeter() без аргумент спира всичко.

const SAMPLE_MS = 500;

let _stream = null;
let _ctx = null;
let _timer = null;
let _listeners = [];

export function micSupported() {
  return typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    && !!(window.AudioContext || window.webkitAudioContext);
}

// Добавя слушател onLevel(level 0..100). Връща { ok, reason }.
export async function startMeter(onLevel) {
  if (!micSupported()) return { ok: false, reason: 'unsupported' };
  if (typeof onLevel === 'function' && !_listeners.includes(onLevel)) _listeners.push(onLevel);
  if (_timer) return { ok: true };
  try {
    _stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false }, video: false });
  } catch (e) {
    _listeners = _listeners.filter((f) => f !== onLevel);
    return { ok: false, reason: (e && e.name) || 'denied' };
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  _ctx = new AC();
  const src = _ctx.createMediaStreamSource(_stream);
  const an = _ctx.createAnalyser();
  an.fftSize = 2048;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  _timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    // dBFS (−60..0) → 0..100
    const db = 20 * Math.log10(rms || 1e-6);
    const level = Math.max(0, Math.min(100, Math.round((db + 60) / 60 * 100)));
    for (const fn of _listeners) { try { fn(level); } catch (_) {} }
  }, SAMPLE_MS);
  return { ok: true };
}

// Маха слушател; без аргумент — всички. Микрофонът се затваря, когато не остане никой.
export function stopMeter(onLevel) {
  _listeners = onLevel ? _listeners.filter((f) => f !== onLevel) : [];
  if (_listeners.length) return;
  if (_timer) { clearInterval(_timer); _timer = null; }
  if (_stream) { try { _stream.getTracks().forEach((t) => t.stop()); } catch (_) {} _stream = null; }
  if (_ctx) { try { _ctx.close(); } catch (_) {} _ctx = null; }
}

export function meterRunning() { return !!_timer; }
