// Version: 1.0020
// motion-detector.js — засичане на движение чрез разлика между кадри (frame differencing).
//
// КАК РАБОТИ (реално, не плейсхолдър):
//   1) Текущият кадър се смалява до малък работен canvas (напр. 64×48), за да е бързо и
//      да заглажда шум.
//   2) Превръщаме го в сива скала (luma).
//   3) Сравняваме пиксел по пиксел с предишния кадър; ако |разлика| > pixelThreshold,
//      пикселът е „променен“.
//   4) changedRatio = променени / общо. Ако changedRatio >= sensitivity → ДВИЖЕНИЕ.
//
// ЗОНИ ЗА СЛЕДЕНЕ: кадърът е разделен на мрежа GRID_COLS×GRID_ROWS клетки. Маската е низ
// от '0'/'1' (по една клетка); '1' = клетката е ИЗКЛЮЧЕНА и промените в нея не се броят
// (нито в числителя, нито в знаменателя). Така улица/дърво/телевизор не вдигат аларма.
//
// Чиста логика, без DOM освен подадения работен canvas. Пази предишния сив кадър вътре.

const WORK_W = 64;
const WORK_H = 48;
const PIXEL_THRESHOLD = 24; // 0..255 разлика в сивото, за да е „променен“ пиксел

export const GRID_COLS = 8;  // клетки по ширина (64/8 = 8 px на клетка)
export const GRID_ROWS = 6;  // клетки по височина (48/6 = 8 px на клетка)
export const GRID_CELLS = GRID_COLS * GRID_ROWS;

// Валидна ли е маската (низ с точния брой клетки) и има ли поне една изключена клетка.
export function maskActive(mask) {
  return typeof mask === 'string' && mask.length === GRID_CELLS && mask.indexOf('1') > -1;
}

export function createMotionDetector() {
  let prevGray = null; // Uint8Array (WORK_W*WORK_H) от предишния кадър
  let work = null;     // работен canvas

  function ensureWork() {
    if (!work) {
      work = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(WORK_W, WORK_H)
        : document.createElement('canvas');
      work.width = WORK_W;
      work.height = WORK_H;
    }
    return work;
  }

  // Подава се canvas с текущия пълен кадър. sensitivity ∈ (0..1). mask — по избор (виж горе).
  // Връща { ok, motion, ratio } или { ok:false, reason } (напр. CORS-замърсен canvas).
  function update(frameCanvas, sensitivity, mask) {
    try {
      const w = ensureWork();
      const ctx = w.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(frameCanvas, 0, 0, WORK_W, WORK_H);
      const { data } = ctx.getImageData(0, 0, WORK_W, WORK_H); // може да хвърли при CORS

      const n = WORK_W * WORK_H;
      const gray = new Uint8Array(n);
      for (let i = 0, p = 0; i < n; i++, p += 4) {
        // luma по Rec.601
        gray[i] = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) | 0;
      }

      if (!prevGray) {
        prevGray = gray;
        return { ok: true, motion: false, ratio: 0 }; // първи кадър = базова линия
      }

      const useMask = maskActive(mask);
      const cellW = WORK_W / GRID_COLS, cellH = WORK_H / GRID_ROWS;
      let changed = 0, total = 0;
      for (let y = 0; y < WORK_H; y++) {
        const rowBase = ((y / cellH) | 0) * GRID_COLS;
        for (let x = 0; x < WORK_W; x++) {
          if (useMask && mask.charCodeAt(rowBase + ((x / cellW) | 0)) === 49 /* '1' */) continue;
          const i = y * WORK_W + x;
          total++;
          const d = gray[i] - prevGray[i];
          if ((d < 0 ? -d : d) > PIXEL_THRESHOLD) changed++;
        }
      }
      prevGray = gray;

      const ratio = total ? changed / total : 0;
      const motion = total > 0 && ratio >= sensitivity;
      return { ok: true, motion, ratio };
    } catch (e) {
      // CORS-замърсен canvas (cross-origin поток без CORS) → не можем да четем пиксели.
      return { ok: false, reason: 'Не мога да чета пиксели от източника (вероятно cross-origin поток без CORS).' };
    }
  }

  function reset() { prevGray = null; }

  return { update, reset };
}
