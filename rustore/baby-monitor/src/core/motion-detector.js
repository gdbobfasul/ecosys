// motion-detector.js — засичане на движение чрез разлика между кадри (frame-differencing)
// + логика спи/размърда се/събуди се. Чиста логика върху canvas пиксели (без DOM освен подадените).
//
// ИДЕЯ:
//   • Смаляваме всеки кадър до малка сива решетка (downscale → grayscale) за бързина.
//   • Сравняваме с предишния кадър: средна абсолютна разлика на пикселите = „motion score“ (0..1).
//   • Праг по чувствителност: над прага = има движение.
//   • Машина на състоянията върху историята на движението:
//       calm  (спи спокойно) — ниско движение продължително време (>= sleepSeconds)
//       stir  (размърда се)  — кратко/умерено движение
//       awake (събуди се)    — УСТОЙЧИВО движение СЛЕД период на спокойствие → СИГНАЛ
//   • „Излезе от кадър“ се решава отделно от разпознавателя (recognizer.js), не тук.
//
// Бруто евристика за „пожар“ (по избор, изключена по подразбиране, виж settings):
//   • рязък скок на яркост + оранжев оттенък + трептене. НЕ Е НАДЕЖДНА ДЕТЕКЦИЯ НА ПОЖАР.

const GRID_W = 48;        // ширина на работната решетка
const GRID_H = 36;        // височина на работната решетка

// Създава нов детектор. opts:
//   sensitivity: 0..100 (по-високо = по-чувствителен; сваля прага)
//   sleepSeconds: колко сек ниско движение = „спи спокойно“
export function createMotionDetector(opts = {}) {
  let prevGray = null;          // Float32Array на предишната сива решетка
  let prevAvgBright = null;     // средна яркост (за пожар-евристика)
  let state = 'unknown';        // 'unknown' | 'calm' | 'stir' | 'awake'
  let calmSince = null;         // ts откога е спокойно
  let movingSince = null;       // ts откога има устойчиво движение
  let lastWakeAt = 0;           // дебоунс на „събуди се“
  const history = [];           // [{ at, score }] последните N за timeline
  const HISTORY_MAX = 120;

  let sensitivity = clamp(opts.sensitivity ?? 55, 0, 100);
  let sleepSeconds = Math.max(3, opts.sleepSeconds ?? 20);
  // По-висока чувствителност → по-нисък праг. Map 0..100 → праг ~0.10..0.012
  function motionThreshold() { return 0.10 - (sensitivity / 100) * 0.088; }
  const STIR_FACTOR = 1.0;      // над прага = stir
  const WAKE_FACTOR = 1.6;      // устойчиво движение над прага*факт. = кандидат за „събуди се“
  const WAKE_SUSTAIN_MS = 1500; // движение трябва да се задържи толкова, за да е „събуди се“
  const WAKE_DEBOUNCE_MS = 8000;

  function setSensitivity(v) { sensitivity = clamp(v, 0, 100); }
  function setSleepSeconds(v) { sleepSeconds = Math.max(3, v); }

  // Анализира текущия кадър от подаден canvas. Връща обект със събитие/състояние:
  //   { ok, score, state, event, brightness, fireHeuristic }
  //   event ∈ null | 'wake' | 'fire?'
  function analyze(canvasEl, now = Date.now()) {
    const grid = toGrayGrid(canvasEl);
    if (!grid) return { ok: false, reason: 'Няма пиксели за анализ.' };
    const { gray, avgBright } = grid;

    let score = 0;
    if (prevGray) {
      let sum = 0;
      for (let i = 0; i < gray.length; i++) sum += Math.abs(gray[i] - prevGray[i]);
      score = (sum / gray.length) / 255; // 0..1
    }
    prevGray = gray;

    // Пожар-евристика (груба!): рязък скок на яркост спрямо предишния кадър.
    let fireHeuristic = false;
    if (prevAvgBright != null) {
      const brightJump = avgBright - prevAvgBright;
      // голям внезапен скок нагоре + висока абсолютна яркост = подозрителен трепкащ блясък
      fireHeuristic = brightJump > 22 && avgBright > 150;
    }
    prevAvgBright = avgBright;

    history.push({ at: now, score });
    if (history.length > HISTORY_MAX) history.shift();

    const thr = motionThreshold();
    let event = null;

    if (score < thr) {
      // ниско движение
      movingSince = null;
      if (calmSince == null) calmSince = now;
      if (now - calmSince >= sleepSeconds * 1000) state = 'calm';
      else if (state !== 'calm') state = (state === 'unknown') ? 'unknown' : 'stir';
    } else {
      // има движение
      const wasCalm = state === 'calm' || (calmSince != null && now - calmSince >= sleepSeconds * 1000);
      calmSince = null;
      if (movingSince == null) movingSince = now;
      const sustained = now - movingSince >= WAKE_SUSTAIN_MS;
      const strong = score >= thr * WAKE_FACTOR;

      if (wasCalm && sustained && strong && (now - lastWakeAt) > WAKE_DEBOUNCE_MS) {
        state = 'awake';
        event = 'wake';
        lastWakeAt = now;
      } else if (state !== 'awake') {
        state = 'stir';
      }
    }

    return { ok: true, score, state, event, brightness: avgBright, fireHeuristic };
  }

  function reset() {
    prevGray = null; prevAvgBright = null; state = 'unknown';
    calmSince = null; movingSince = null; history.length = 0;
  }

  function getHistory() { return history.slice(); }
  function getState() { return state; }

  return { analyze, reset, getHistory, getState, setSensitivity, setSleepSeconds };
}

// --- помощници ---

// Смалява canvas до GRID_W×GRID_H и връща сива решетка + средна яркост.
function toGrayGrid(canvasEl) {
  try {
    const w = canvasEl.width, h = canvasEl.height;
    if (!w || !h) return null;
    const tmp = document.createElement('canvas');
    tmp.width = GRID_W; tmp.height = GRID_H;
    const ctx = tmp.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvasEl, 0, 0, GRID_W, GRID_H);
    const data = ctx.getImageData(0, 0, GRID_W, GRID_H).data; // RGBA
    const gray = new Float32Array(GRID_W * GRID_H);
    let bsum = 0;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // luma
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[j] = g;
      bsum += g;
    }
    return { gray, avgBright: bsum / gray.length };
  } catch (_) {
    return null; // напр. опетнен canvas (cross-origin без CORS)
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Етикет на български за състояние.
export function stateLabel(state) {
  switch (state) {
    case 'calm': return 'Спи спокойно';
    case 'stir': return 'Размърдва се';
    case 'awake': return 'Събуди се';
    default: return 'Изчаквам…';
  }
}
