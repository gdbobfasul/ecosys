// vision.js — „ЗРЕНИЕ“: камера на живо + OCR + разпознаване на изображения + превод.
//
// ПРИНЦИПИ (както целия апп):
//   • Безплатно/keyless/on-device по подразбиране. Tesseract.js (WASM) и TensorFlow.js
//     се изпълняват на устройството. Единствената мрежа = БЕЗПЛАТНИ тегла на модела
//     (CDN на tfhub през tfjs / unpkg за tesseract worker) + СЪЩЕСТВУВАЩИЯТ безплатен
//     AI учител (Pollinations). Без GMS/HMS/Firebase, без контакти, без проследяване.
//   • Тежките библиотеки се LAZY-LOAD-ват с динамичен import(), за да не бавят буутването.
//   • Графично пада: ако камерата е отказана/липсва (напр. headless), казваме честно.
//   • Преводът ПРЕИЗПОЛЗВА teacher.js (tier1 Claude по избор → tier2 Pollinations →
//     tier3 локално), НЕ дублира AI клиента.
//
// Този модул е чиста логика (без DOM освен подадените canvas/video). Екранът vision.js
// прави UI-то.

import { teach } from './teacher.js';

// --- Камера на живо --------------------------------------------------------

// Стартира задната камера в подаден <video>. Връща { ok, stream } или { ok:false, reason }.
// Грациозно се справя с липса/отказ (browser dev / headless / без разрешение).
export async function startCamera(videoEl, { facingMode = 'environment' } = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return { ok: false, reason: 'Това устройство/среда не поддържа камера (няма getUserMedia).' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode }, audio: false
    });
    if (videoEl) {
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', '');
      videoEl.muted = true;
      try { await videoEl.play(); } catch (_) { /* автоплей понякога чака жест */ }
    }
    return { ok: true, stream };
  } catch (e) {
    const name = (e && e.name) || '';
    let reason = 'Не успях да отворя камерата.';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      reason = 'Достъпът до камерата е отказан. Разреши камерата за приложението и опитай пак.';
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      reason = 'Не открих камера на това устройство.';
    } else if (name === 'NotReadableError') {
      reason = 'Камерата е заета от друго приложение.';
    }
    return { ok: false, reason };
  }
}

// Спира всички пътеки на потока (освобождава камерата).
export function stopCamera(stream) {
  try {
    if (stream && typeof stream.getTracks === 'function') {
      for (const t of stream.getTracks()) { try { t.stop(); } catch (_) {} }
    }
  } catch (_) {}
}

// Рисува текущия кадър от <video> в <canvas>. Връща { ok, w, h } или { ok:false }.
export function grabFrame(videoEl, canvasEl) {
  try {
    const w = videoEl.videoWidth || 0;
    const h = videoEl.videoHeight || 0;
    if (!w || !h) return { ok: false, reason: 'Още няма кадър от камерата.' };
    canvasEl.width = w; canvasEl.height = h;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, w, h);
    return { ok: true, w, h };
  } catch (e) {
    return { ok: false, reason: 'Не успях да хвана кадър.' };
  }
}

// Зарежда качено изображение (File) в <canvas>. Връща Promise<{ok,w,h}>.
export function drawImageFileToCanvas(file, canvasEl) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          canvasEl.width = img.naturalWidth;
          canvasEl.height = img.naturalHeight;
          canvasEl.getContext('2d').drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) { URL.revokeObjectURL(url); resolve({ ok: false, reason: 'Грешка при рисуване.' }); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, reason: 'Не успях да заредя изображението.' }); };
      img.src = url;
    } catch (e) { resolve({ ok: false, reason: 'Невалиден файл.' }); }
  });
}

// --- OCR (Tesseract.js, WASM, on-device) -----------------------------------
// Езици по подразбиране: bul+eng. Worker и тегла идват от CDN (безплатно, без ключ)
// при първото пускане; после се кешират. Lazy-load с динамичен import().

let _tesseractMod = null;
async function loadTesseract() {
  if (_tesseractMod) return _tesseractMod;
  _tesseractMod = await import('tesseract.js');
  return _tesseractMod;
}

// Разпознава текст от <canvas> (или всеки image-like). Връща { ok, text, confidence }.
// onProgress(0..1) по избор за прогрес лента.
export async function ocrCanvas(canvasEl, { langs = 'bul+eng', onProgress } = {}) {
  try {
    const T = await loadTesseract();
    const result = await T.recognize(canvasEl, langs, {
      logger: (m) => {
        if (onProgress && m && m.status === 'recognizing text' && typeof m.progress === 'number') {
          onProgress(m.progress);
        }
      }
    });
    const text = ((result && result.data && result.data.text) || '').trim();
    const confidence = (result && result.data && typeof result.data.confidence === 'number')
      ? result.data.confidence : null;
    return { ok: true, text, confidence };
  } catch (e) {
    return { ok: false, reason: 'OCR се провали: ' + (e && e.message ? e.message : 'неизвестно') };
  }
}

// --- PDF → OCR (pdfjs рендира страница → canvas → Tesseract) ----------------
// Реално извличане, не плейсхолдър. Lazy-load на pdfjs-dist.

let _pdfjsMod = null;
async function loadPdfjs() {
  if (_pdfjsMod) return _pdfjsMod;
  const pdfjs = await import('pdfjs-dist');
  // Worker от bundled URL (Vite го прихваща като asset). Без мрежа за самия worker.
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (_) {
    // ако worker URL-ът не се разреши, pdfjs пада към fake worker (бавно, но работи)
  }
  _pdfjsMod = pdfjs;
  return pdfjs;
}

// OCR върху PDF файл. Рендира до maxPages страници, прави OCR на всяка и слепва текста.
// Връща { ok, text, pages }.
export async function ocrPdfFile(file, { langs = 'bul+eng', maxPages = 5, scale = 2, onProgress } = {}) {
  try {
    const pdfjs = await loadPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const n = Math.min(doc.numPages || 1, maxPages);
    const parts = [];
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const r = await ocrCanvas(canvas, {
        langs,
        onProgress: (p) => { if (onProgress) onProgress((i - 1 + p) / n); }
      });
      if (r.ok && r.text) parts.push(`— стр. ${i} —\n${r.text}`);
    }
    return { ok: true, text: parts.join('\n\n').trim(), pages: n };
  } catch (e) {
    return { ok: false, reason: 'Не успях да прочета PDF: ' + (e && e.message ? e.message : 'неизвестно') };
  }
}

// --- Разпознаване на изображения (TensorFlow.js, on-device) -----------------
// MobileNet (класификация „какво е“) + COCO-SSD (детекция на обекти „какво има и къде“).
// Теглата се теглят веднъж от официалния tfhub/storage през tfjs (БЕЗПЛАТНО, без ключ),
// после се кешират. Lazy-load на tfjs и моделите.

let _tfReady = false;
let _mobilenet = null;
let _cocoSsd = null;

async function ensureTf() {
  if (_tfReady) return;
  const tf = await import('@tensorflow/tfjs');
  // WebGL backend ако е наличен, иначе CPU (винаги работи, по-бавно).
  try { await tf.setBackend('webgl'); } catch (_) {}
  try { await tf.ready(); } catch (_) {}
  _tfReady = true;
}

// Класификация: връща { ok, labels:[{label, prob}] }.
export async function classifyImage(canvasOrImg, { topk = 5 } = {}) {
  try {
    await ensureTf();
    if (!_mobilenet) {
      const mobilenet = await import('@tensorflow-models/mobilenet');
      _mobilenet = await mobilenet.load(); // тегла от официалния storage (безплатно)
    }
    const preds = await _mobilenet.classify(canvasOrImg, topk);
    const labels = (preds || []).map((p) => ({ label: p.className, prob: p.probability }));
    return { ok: true, labels };
  } catch (e) {
    return { ok: false, reason: 'Класификацията се провали: ' + (e && e.message ? e.message : 'неизвестно') };
  }
}

// Детекция на обекти: връща { ok, objects:[{label, score, bbox:[x,y,w,h]}] }.
export async function detectObjects(canvasOrImg) {
  try {
    await ensureTf();
    if (!_cocoSsd) {
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      _cocoSsd = await cocoSsd.load(); // тегла от официалния storage (безплатно)
    }
    const preds = await _cocoSsd.detect(canvasOrImg);
    const objects = (preds || []).map((p) => ({ label: p.class, score: p.score, bbox: p.bbox }));
    return { ok: true, objects };
  } catch (e) {
    return { ok: false, reason: 'Детекцията се провали: ' + (e && e.message ? e.message : 'неизвестно') };
  }
}

// Кратко текстово описание от резултатите (за памет/„разбиране“ през AI учителя).
export function describeRecognition({ labels = [], objects = [] } = {}) {
  const top = labels.slice(0, 3).map((l) => `${l.label} (${Math.round(l.prob * 100)}%)`);
  const objCounts = {};
  for (const o of objects) objCounts[o.label] = (objCounts[o.label] || 0) + 1;
  const objList = Object.entries(objCounts).map(([k, c]) => (c > 1 ? `${c}× ${k}` : k));
  const parts = [];
  if (top.length) parts.push('Прилича на: ' + top.join(', '));
  if (objList.length) parts.push('Открити обекти: ' + objList.join(', '));
  return parts.join('. ') || 'Нищо разпознато със сигурност.';
}

// --- Превод (ПРЕИЗПОЛЗВА teacher.js — без дублиране на AI клиент) -----------

export const TARGET_LANGS = [
  ['български', 'български'],
  ['английски', 'английски (English)'],
  ['руски', 'руски (Русский)'],
  ['немски', 'немски (Deutsch)'],
  ['френски', 'френски (Français)'],
  ['испански', 'испански (Español)'],
  ['турски', 'турски (Türkçe)'],
  ['китайски', 'китайски (中文)']
];

// По избор „разбиране“ на разпознатото през учителя (текстово описание → teach()).
// Връща { text, tier, ai } | null.
export async function understandViaTeacher(description) {
  const d = String(description || '').trim();
  if (!d) return null;
  const prompt =
    `На база това описание на изображение, обясни накратко на български какво вероятно е ` +
    `и за какво служи. Не измисляй факти:\n\n` + d.slice(0, 2000);
  return teach({ prompt, context: d });
}

// Превежда текст към targetLang през съществуващия учител (tier1→tier2→tier3).
// Връща { text, tier, ai } | null (както teach()).
export async function translateText(text, targetLang = 'английски') {
  const src = String(text || '').trim();
  if (!src) return null;
  const prompt =
    `Преведи точно следния текст на ${targetLang}. ` +
    `Върни САМО превода, без обяснения и без измислици:\n\n` + src.slice(0, 2000);
  return teach({ prompt, context: src });
}
