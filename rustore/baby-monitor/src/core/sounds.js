// Version: 1.0027
// sounds.js — приспивни звуци, генерирани с WebAudio (без файлове, без мрежа):
//   шумове: rain (дъжд), sea (море), fan (вентилатор), heart (сърце);
//   песнички: melody (нежна мелодия), brahms (приспивна на Брамс), twinkle („Блести, звездичке"), hush (тиха люлчина).
// Единичен „свирач" на ниво модул — свири и при смяна на екрана; таймер за автоматично спиране;
// плавно намаляване на силата (fadeVolume) за сценария „приспиване" на детегледачката.

let _ctx = null;
let _master = null;
let _nodes = [];        // активни възли, за да ги спрем
let _timerId = null;    // таймер за спиране
let _timerEnd = 0;      // кога изтича (ms)
let _current = null;    // вид от SOUND_KINDS | null
let _volume = 0.6;
let _listeners = [];

function ctx() {
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    _ctx = new AC();
    _master = _ctx.createGain();
    _master.gain.value = _volume;
    _master.connect(_ctx.destination);
  }
  if (_ctx.state === 'suspended') { try { _ctx.resume(); } catch (_) {} }
  return _ctx;
}

// Буфер с шум: 'white' | 'pink' | 'brown' (2 секунди, зациклен).
function noiseBuffer(kind) {
  const c = ctx();
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    } else { // brown
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

function noiseSource(kind) {
  const c = ctx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(kind);
  src.loop = true;
  return src;
}

function startRain() {
  const c = ctx();
  const src = noiseSource('pink');
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.6;
  const g = c.createGain(); g.gain.value = 0.9;
  src.connect(bp).connect(g).connect(_master);
  src.start();
  // Лек „ромон": бавно люлеене на филтъра.
  const lfo = c.createOscillator(); lfo.frequency.value = 0.25;
  const lg = c.createGain(); lg.gain.value = 500;
  lfo.connect(lg).connect(bp.frequency); lfo.start();
  _nodes = [src, lfo];
}

function startSea() {
  const c = ctx();
  const src = noiseSource('brown');
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g = c.createGain(); g.gain.value = 0.55;
  src.connect(lp).connect(g).connect(_master);
  src.start();
  // Вълни: гласността диша на ~10 секунди.
  const lfo = c.createOscillator(); lfo.frequency.value = 0.1;
  const lg = c.createGain(); lg.gain.value = 0.4;
  lfo.connect(lg).connect(g.gain); lfo.start();
  _nodes = [src, lfo];
}

function startFan() {
  const c = ctx();
  const src = noiseSource('brown');
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450;
  const g = c.createGain(); g.gain.value = 0.7;
  src.connect(lp).connect(g).connect(_master);
  src.start();
  // Тихо бръмчене на мотора.
  const hum = c.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 110;
  const hg = c.createGain(); hg.gain.value = 0.03;
  hum.connect(hg).connect(_master); hum.start();
  _nodes = [src, hum];
}

// Сърце: две меки „тупкания" на всеки удар (~68 удара/мин), планирани напред.
function startHeart() {
  const c = ctx();
  const beat = 60 / 68;
  let next = c.currentTime + 0.1;
  const timer = setInterval(() => {
    while (next < c.currentTime + 1.5) {
      thump(next, 0.9); thump(next + 0.22, 0.6);
      next += beat;
    }
  }, 400);
  function thump(at, amp) {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, at);
    o.frequency.exponentialRampToValueAtTime(40, at + 0.15);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    o.connect(g).connect(_master); o.start(at); o.stop(at + 0.2);
  }
  _nodes = [{ stop: () => clearInterval(timer) }];
}

// Песнички като списъци [честота Hz, дължина в единици]; 0 Hz = пауза. Всички са обществено
// достояние (Брамс, 1868; „Ah! vous dirai-je, maman", 18 в.) или собствени. Зациклят се.
const MELODY = [
  [392, 1], [440, 1], [523, 2], [440, 1], [392, 1], [330, 2],
  [294, 1], [330, 1], [392, 2], [330, 1], [294, 1], [262, 2],
  [392, 1], [523, 1], [587, 2], [523, 1], [440, 1], [392, 2],
  [330, 1], [294, 1], [330, 1], [392, 1], [262, 4]
];
// Приспивна песен на Брамс (до мажор, опростена).
const BRAHMS = [
  [330, 1], [330, 1], [392, 3], [330, 1], [330, 1], [392, 3],
  [330, 1], [392, 1], [523, 2], [494, 1], [440, 2], [440, 1], [392, 3],
  [294, 1], [330, 1], [349, 2], [294, 1], [294, 1], [330, 1], [349, 3],
  [294, 1], [349, 1], [494, 1], [440, 1], [392, 1], [494, 1], [523, 4],
  [262, 1], [262, 1], [523, 3], [440, 1], [349, 1], [392, 3],
  [330, 1], [262, 1], [349, 1], [392, 1], [440, 1], [392, 3],
  [262, 1], [262, 1], [523, 3], [440, 1], [349, 1], [392, 3],
  [330, 1], [392, 1], [349, 1], [294, 1], [262, 4], [0, 2]
];
// „Блести, блести, звездичке" (до мажор).
const TWINKLE = [
  [262, 1], [262, 1], [392, 1], [392, 1], [440, 1], [440, 1], [392, 2],
  [349, 1], [349, 1], [330, 1], [330, 1], [294, 1], [294, 1], [262, 2],
  [392, 1], [392, 1], [349, 1], [349, 1], [330, 1], [330, 1], [294, 2],
  [392, 1], [392, 1], [349, 1], [349, 1], [330, 1], [330, 1], [294, 2],
  [262, 1], [262, 1], [392, 1], [392, 1], [440, 1], [440, 1], [392, 2],
  [349, 1], [349, 1], [330, 1], [330, 1], [294, 1], [294, 1], [262, 2], [0, 2]
];
// Собствена тиха люлчина (ла минор, бавна, люлееща се).
const HUSH = [
  [330, 2], [294, 1], [262, 3], [294, 2], [330, 1], [262, 3],
  [220, 2], [262, 1], [294, 3], [262, 2], [220, 1], [196, 3],
  [330, 2], [392, 1], [440, 3], [392, 2], [330, 1], [294, 3],
  [262, 2], [294, 1], [220, 5], [0, 2]
];
const SONGS = { melody: [MELODY, 0.55], brahms: [BRAHMS, 0.42], twinkle: [TWINKLE, 0.5], hush: [HUSH, 0.6] };

// Общ свирач на песничка: планира нотите напред (2 с), нежен синусов тембър + лек октавен обертон.
function songStarter(kind) {
  return function () {
    const c = ctx();
    const [seq, step] = SONGS[kind];
    let next = c.currentTime + 0.1;
    let idx = 0;
    const timer = setInterval(() => {
      while (next < c.currentTime + 2) {
        const [f, len] = seq[idx % seq.length];
        if (f > 0) note(next, f, len * step);
        next += len * step; idx++;
      }
    }, 500);
    function note(at, freq, dur) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.35, at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.95);
      const g2 = c.createGain(); g2.gain.value = 0.15;
      o.connect(g); o2.connect(g2).connect(g); g.connect(_master);
      o.start(at); o2.start(at); o.stop(at + dur); o2.stop(at + dur);
    }
    _nodes = [{ stop: () => clearInterval(timer) }];
  };
}

const STARTERS = {
  rain: startRain, sea: startSea, fan: startFan, heart: startHeart,
  melody: songStarter('melody'), brahms: songStarter('brahms'), twinkle: songStarter('twinkle'), hush: songStarter('hush')
};

// Видове по групи — за менютата на екраните.
export const SONG_KINDS = ['brahms', 'twinkle', 'hush', 'melody'];
export const NOISE_KINDS = ['rain', 'sea', 'fan', 'heart'];
export const SOUND_KINDS = [...SONG_KINDS, ...NOISE_KINDS];

export function soundSupported() {
  return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
}

export function currentSound() { return _current; }
export function getVolume() { return _volume; }
export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, Number(v) || 0));
  if (_master) {
    try { _master.gain.cancelScheduledValues(_ctx.currentTime); } catch (_) {}
    _master.gain.value = _volume;
  }
}

// Плавно намаляване/увеличаване на силата до target (0..1) за seconds секунди (сценарий „приспиване").
export function fadeVolume(target, seconds) {
  const v = Math.max(0, Math.min(1, Number(target) || 0));
  _volume = v;
  if (!_master) return;
  const c = ctx();
  try {
    _master.gain.cancelScheduledValues(c.currentTime);
    _master.gain.setValueAtTime(_master.gain.value, c.currentTime);
    _master.gain.linearRampToValueAtTime(v, c.currentTime + Math.max(0.1, Number(seconds) || 0));
  } catch (_) { _master.gain.value = v; }
}

// Оставащи секунди от таймера (0 = няма таймер).
export function timerLeft() { return _timerEnd ? Math.max(0, Math.round((_timerEnd - Date.now()) / 1000)) : 0; }

// Пуска звук; minutes = 0 → без таймер.
export function playSound(kind, minutes = 0) {
  stopSound();
  if (!STARTERS[kind]) return false;
  try { STARTERS[kind](); } catch (e) { console.warn('sounds: неуспешен старт', e); return false; }
  _current = kind;
  if (minutes > 0) {
    _timerEnd = Date.now() + minutes * 60000;
    _timerId = setTimeout(stopSound, minutes * 60000);
  }
  emit();
  return true;
}

export function stopSound() {
  for (const n of _nodes) { try { n.stop(); } catch (_) {} }
  _nodes = [];
  if (_timerId) { clearTimeout(_timerId); _timerId = null; }
  _timerEnd = 0;
  if (_current) { _current = null; emit(); }
}

// Известяване на екрана при промяна (старт/стоп/изтекъл таймер).
export function onSoundChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((f) => f !== fn); };
}
function emit() { for (const f of _listeners) { try { f(_current); } catch (_) {} } }
