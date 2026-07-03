// Version: 1.0001
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
// Чиста логика, без DOM освен подадения работен canvas. Пази предишния сив кадър вътре.

const WORK_W = 64;
const WORK_H = 48;
const PIXEL_THRESHOLD = 24; // 0..255 разлика в сивото, за да е „променен“ пиксел

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

  // Подава се canvas с текущия пълен кадър. sensitivity ∈ (0..1).
  // Връща { ok, motion, ratio } или { ok:false, reason } (напр. CORS-замърсен canvas).
  function update(frameCanvas, sensitivity) {
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

      let changed = 0;
      for (let i = 0; i < n; i++) {
        const d = gray[i] - prevGray[i];
        if ((d < 0 ? -d : d) > PIXEL_THRESHOLD) changed++;
      }
      prevGray = gray;

      const ratio = changed / n;
      const motion = ratio >= sensitivity;
      return { ok: true, motion, ratio };
    } catch (e) {
      // CORS-замърсен canvas (cross-origin поток без CORS) → не можем да четем пиксели.
      return { ok: false, reason: 'Не мога да чета пиксели от източника (вероятно cross-origin поток без CORS).' };
    }
  }

  function reset() { prevGray = null; }

  return { update, reset };
}
