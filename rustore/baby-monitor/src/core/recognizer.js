// Version: 1.0001
// recognizer.js — разпознаване на хора в кадъра с TensorFlow.js coco-ssd (on-device).
//
// ПРИНЦИПИ:
//   • Lazy-load: tfjs + coco-ssd се теглят с динамичен import() само когато потрябват,
//     за да не бавят буутването (големият chunk е очакван).
//   • Теглата на модела идват от официалния безплатен storage през coco-ssd (keyless),
//     после се кешират. Без GMS/HMS/Firebase, без ключове.
//   • Използваме само класа 'person' от coco-ssd:
//       0 души   → детето е извън кадър (left-frame)
//       2+ души  → „непознат в стаята“ (ВТОРИ човек) → сигнал
//     ЧЕСТНО: това е само „появи се втори човек“, НЕ е разпознаване на конкретно лице
//     и НЕ е анти-отвличане.
//   • Графично пада: ако моделът не се зареди (offline при първо пускане / headless),
//     връщаме { ok:false } и наблюдението по движение продължава без него.

let _tfReady = false;
let _model = null;
let _loadingPromise = null;

async function ensureModel() {
  if (_model) return _model;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    const tf = await import('@tensorflow/tfjs');
    if (!_tfReady) {
      try { await tf.setBackend('webgl'); } catch (_) {}
      try { await tf.ready(); } catch (_) {}
      _tfReady = true;
    }
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    // 'lite_mobilenet_v2' е по-малък/бърз — подходящ за телефон.
    _model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    return _model;
  })();
  try {
    return await _loadingPromise;
  } finally {
    _loadingPromise = null;
  }
}

// Брои хора в подаден canvas. Връща { ok, persons:[{score,bbox}], count } или { ok:false, reason }.
// minScore: праг на увереност, за да броим човек.
export async function detectPersons(canvasEl, { minScore = 0.5 } = {}) {
  try {
    const model = await ensureModel();
    const preds = await model.detect(canvasEl);
    const persons = (preds || [])
      .filter((p) => p.class === 'person' && p.score >= minScore)
      .map((p) => ({ score: p.score, bbox: p.bbox }));
    return { ok: true, persons, count: persons.length };
  } catch (e) {
    return { ok: false, reason: 'Разпознаването се провали: ' + (e && e.message ? e.message : 'неизвестно') };
  }
}

// Предварително зарежда модела (по избор, напр. след старт на наблюдението).
export async function preload() {
  try { await ensureModel(); return { ok: true }; }
  catch (e) { return { ok: false, reason: e && e.message }; }
}

// Готов ли е моделът (за UI индикатор).
export function isReady() { return !!_model; }
