// Version: 1.0001
// recognizer.js — класификация „какво помръдна“ с TensorFlow.js + COCO-SSD (on-device).
//
// ПРИНЦИП: безплатно/keyless. Теглата на COCO-SSD идват веднъж от официалния storage
// през tfjs (без ключ), после се кешират. TF.js е голям → LAZY-LOAD с динамичен import(),
// за да буутва приложението бързо. Зарежда се чак при първа нужда (първо движение).
//
// COCO-SSD връща класове като 'person', 'dog', 'cat', 'bird', 'horse', 'cow', 'sheep',
// 'bear', 'elephant', 'zebra', 'giraffe' и др. Картографираме ги към български етикети
// и в три категории: person | animal | other.

import { t, classLabel } from './i18n.js';

let _tfReady = false;
let _cocoSsd = null;
let _loading = null;

const ANIMAL_CLASSES = new Set([
  'dog', 'cat', 'bird', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe'
]);

async function ensureModel(onStatus) {
  if (_cocoSsd) return _cocoSsd;
  if (_loading) return _loading;
  _loading = (async () => {
    if (onStatus) onStatus(t('rec_loading'));
    const tf = await import('@tensorflow/tfjs');
    try { await tf.setBackend('webgl'); } catch (_) {}
    try { await tf.ready(); } catch (_) {}
    _tfReady = true;
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    _cocoSsd = await cocoSsd.load(); // тегла от официалния storage (безплатно, без ключ)
    return _cocoSsd;
  })();
  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

// Дали моделът е вече зареден (за UI индикатор).
export function isModelReady() { return !!_cocoSsd && _tfReady; }

// Класифицира съдържанието на подаден canvas (или image-like).
// Връща { ok, top, category, label, score, objects } или { ok:false, reason }.
//   category: 'person' | 'animal' | 'other' | 'none'
//   objects: суров списък [{ class, score, bbox }]
export async function classifyFrame(canvasOrImg, { minScore = 0.5, onStatus } = {}) {
  try {
    const model = await ensureModel(onStatus);
    const preds = await model.detect(canvasOrImg);
    const objects = (preds || [])
      .filter((p) => p && typeof p.score === 'number' && p.score >= minScore)
      .map((p) => ({ class: p.class, score: p.score, bbox: p.bbox }));

    if (!objects.length) {
      return { ok: true, top: null, category: 'none', label: t('cls_something'), score: 0, objects: [] };
    }

    // Приоритет: човек > животно > друго; при равенство — по-висок score.
    const rank = (c) => (c === 'person' ? 2 : (ANIMAL_CLASSES.has(c) ? 1 : 0));
    objects.sort((a, b) => (rank(b.class) - rank(a.class)) || (b.score - a.score));
    const top = objects[0];

    let category = 'other';
    if (top.class === 'person') category = 'person';
    else if (ANIMAL_CLASSES.has(top.class)) category = 'animal';

    const label = classLabel(top.class) || (category === 'animal' ? t('cls_animal') : top.class);
    return { ok: true, top, category, label, score: top.score, objects };
  } catch (e) {
    return { ok: false, reason: 'classify-failed: ' + (e && e.message ? e.message : 'unknown') };
  }
}
