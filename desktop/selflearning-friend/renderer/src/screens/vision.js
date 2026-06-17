// vision.js (екран) — „Зрение“: камера на живо + OCR + разпознаване + превод.
//
// OWNER-GATED: рутерът в main.js рисува този екран само когато сме отключени
// (същата защита като другите екрани). Тук не дублираме проверката, но спираме
// камерата при напускане (hashchange/visibility), за да не държим устройството заето.
import { el, clear, toast } from '../ui/dom.js';
import { addMemory } from '../core/memory-store.js';
import { frameAiSuggestion } from '../core/honesty.js';
import {
  startCamera, stopCamera, grabFrame, drawImageFileToCanvas,
  ocrCanvas, ocrPdfFile,
  classifyImage, detectObjects, describeRecognition,
  translateText, TARGET_LANGS, understandViaTeacher
} from '../core/vision.js';

// Модулно състояние на камерата (за чисто освобождаване между навигации).
let _stream = null;
let _cleanupBound = false;

function releaseCamera() {
  if (_stream) { stopCamera(_stream); _stream = null; }
}

// Спираме камерата при напускане на екрана (смяна на хеш) или скриване на приложението.
function bindLifecycle() {
  if (_cleanupBound || typeof window === 'undefined') return;
  _cleanupBound = true;
  window.addEventListener('hashchange', () => {
    if ((location.hash || '').replace(/^#\/?/, '') !== 'vision') releaseCamera();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseCamera(); });
}

export function renderVision(root /*, { navigate, rerender } */) {
  clear(root);
  bindLifecycle();
  releaseCamera(); // чист старт при всяко влизане

  root.appendChild(el('h2', {}, '👁️ Зрение'));
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' },
    'Камера на живо, четене на текст (OCR), разпознаване на изображения и превод — ' +
    'всичко на устройството, безплатно. Тежките модели се зареждат при първа нужда, ' +
    'затова първият път може да отнеме малко.'));

  // Общ работен canvas (скрит) + последно извлечен текст за действия.
  const canvas = el('canvas', { style: 'display:none' });
  let lastText = '';        // последно OCR/разпознато описание (за „Запомни“/„Преведи“)
  let lastKind = 'OCR';     // етикет за паметта

  // --- Камера на живо ---
  const video = el('video', {
    style: 'width:100%;border-radius:12px;background:#000;max-height:300px;object-fit:contain;display:none'
  });
  const camMsg = el('p', { class: 'muted', style: 'font-size:13px' },
    'Камерата е спряна. Натисни „Пусни камерата“ (нужно е реално устройство и разрешение).');
  const preview = el('canvas', { style: 'width:100%;border-radius:12px;display:none;max-height:300px;object-fit:contain' });

  const startBtn = el('button', { class: 'grow' }, '📷 Пусни камерата');
  const stopBtn = el('button', { class: 'secondary grow', disabled: true }, '⏹ Спри');
  const grabBtn = el('button', { class: 'secondary grow', disabled: true }, '📸 Хвани кадър');

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    const r = await startCamera(video);
    if (r.ok) {
      _stream = r.stream;
      video.style.display = 'block';
      camMsg.style.display = 'none';
      stopBtn.disabled = false; grabBtn.disabled = false;
    } else {
      camMsg.textContent = r.reason;
      camMsg.className = 'warn-text';
      startBtn.disabled = false;
      toast(r.reason);
    }
  });
  stopBtn.addEventListener('click', () => {
    releaseCamera();
    video.style.display = 'none';
    camMsg.className = 'muted'; camMsg.style.display = 'block';
    camMsg.textContent = 'Камерата е спряна.';
    stopBtn.disabled = true; grabBtn.disabled = true; startBtn.disabled = false;
  });
  grabBtn.addEventListener('click', () => {
    const r = grabFrame(video, preview);
    if (!r.ok) { toast(r.reason || 'Няма кадър.'); return; }
    preview.style.display = 'block';
    toast('Кадърът е хванат. Сега „Прочети текста“ или „Какво има“.');
  });

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Камера на живо'),
    video, camMsg, preview,
    el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [startBtn, stopBtn]),
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [grabBtn])
  ]));

  // --- Качи изображение / PDF ---
  const imgInput = el('input', { type: 'file', accept: 'image/*' });
  const pdfInput = el('input', { type: 'file', accept: 'application/pdf,.pdf', style: 'margin-top:8px' });
  imgInput.addEventListener('change', async () => {
    const f = imgInput.files && imgInput.files[0];
    if (!f) return;
    const r = await drawImageFileToCanvas(f, preview);
    if (r.ok) { preview.style.display = 'block'; toast('Изображението е заредено.'); }
    else toast(r.reason || 'Грешка.');
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Или качи файл'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Качи изображение (за OCR/разпознаване) или PDF (за четене на текст).'),
    imgInput, pdfInput
  ]));

  // --- Резултат + действия ---
  const progress = el('div', { class: 'muted', style: 'font-size:12px;min-height:16px' }, '');
  const out = el('div', { style: 'white-space:pre-wrap;font-size:14px;margin-top:8px' }, '');
  const setProgress = (p) => { progress.textContent = p == null ? '' : `Обработвам… ${Math.round(p * 100)}%`; };
  const setOut = (txt) => { out.textContent = txt || ''; };

  // Източник за анализ: предпочитаме preview (хванат кадър/качено), иначе хващаме от видеото.
  function ensureSource() {
    if (preview.style.display !== 'none' && preview.width) return true;
    const r = grabFrame(video, preview);
    if (r.ok) { preview.style.display = 'block'; return true; }
    toast('Първо хвани кадър или качи изображение.');
    return false;
  }

  // OCR от текущия canvas (кадър/качено изображение).
  const ocrBtn = el('button', { class: 'grow' }, '🔤 Прочети текста');
  ocrBtn.addEventListener('click', async () => {
    if (!ensureSource()) return;
    ocrBtn.disabled = true; setOut(''); setProgress(0);
    const r = await ocrCanvas(preview, { langs: 'bul+eng', onProgress: setProgress });
    setProgress(null); ocrBtn.disabled = false;
    if (!r.ok) { setOut(r.reason); return; }
    lastText = r.text || ''; lastKind = 'OCR';
    setOut(lastText
      ? `Прочетен текст${r.confidence != null ? ` (увереност ~${Math.round(r.confidence)}%)` : ''}:\n\n${lastText}`
      : 'Не открих четим текст в изображението.');
  });

  // OCR от PDF.
  const pdfBtn = el('button', { class: 'secondary grow' }, '📄 Прочети PDF');
  pdfBtn.addEventListener('click', async () => {
    const f = pdfInput.files && pdfInput.files[0];
    if (!f) { toast('Първо избери PDF файл.'); return; }
    pdfBtn.disabled = true; setOut(''); setProgress(0);
    const r = await ocrPdfFile(f, { langs: 'bul+eng', maxPages: 5, onProgress: setProgress });
    setProgress(null); pdfBtn.disabled = false;
    if (!r.ok) { setOut(r.reason); return; }
    lastText = r.text || ''; lastKind = 'PDF';
    setOut(lastText ? `Текст от PDF (до ${r.pages} стр.):\n\n${lastText}` : 'Не открих текст в PDF.');
  });

  // Разпознаване „какво има“ (MobileNet класификация + COCO-SSD детекция).
  const recogBtn = el('button', { class: 'grow' }, '🧠 Какво има');
  recogBtn.addEventListener('click', async () => {
    if (!ensureSource()) return;
    recogBtn.disabled = true; setOut(''); progress.textContent = 'Зареждам модели и разпознавам…';
    const [cls, det] = await Promise.all([classifyImage(preview), detectObjects(preview)]);
    progress.textContent = '';
    recogBtn.disabled = false;
    const labels = cls.ok ? cls.labels : [];
    const objects = det.ok ? det.objects : [];
    if (!labels.length && !objects.length) {
      setOut((cls.reason || det.reason) ? `Грешка: ${cls.reason || det.reason}` : 'Нищо разпознато със сигурност.');
      lastText = ''; return;
    }
    const desc = describeRecognition({ labels, objects });
    lastText = desc; lastKind = 'Разпознаване';
    const lines = [];
    if (labels.length) lines.push('Класификация (MobileNet):\n' +
      labels.map((l) => `• ${l.label} — ${Math.round(l.prob * 100)}%`).join('\n'));
    if (objects.length) lines.push('Обекти (COCO-SSD):\n' +
      objects.map((o) => `• ${o.label} — ${Math.round(o.score * 100)}%`).join('\n'));
    setOut(lines.join('\n\n'));
  });

  // По избор: „разбиране“ през AI учителя (текстово описание → teach()).
  const understandBtn = el('button', { class: 'ghost grow' }, '💬 Разбери (AI)');
  understandBtn.addEventListener('click', async () => {
    if (!lastText) { toast('Първо разпознай или прочети нещо.'); return; }
    understandBtn.disabled = true; progress.textContent = 'Питам учителя…';
    const r = await understandViaTeacher(lastText);
    progress.textContent = ''; understandBtn.disabled = false;
    if (!r) { setOut(out.textContent + '\n\n(Учителят не отговори — само on-device резултатът остава.)'); return; }
    const framed = r.ai ? frameAiSuggestion(r.text) : r.text;
    setOut(out.textContent + '\n\n— Тълкуване —\n' + framed);
  });

  // --- Превод (преизползва teacher.js) ---
  const langSel = el('select', {},
    TARGET_LANGS.map(([v, label]) => el('option', { value: v }, label)));
  langSel.value = 'английски';
  const translateBtn = el('button', { class: 'grow' }, '🌍 Преведи');
  translateBtn.addEventListener('click', async () => {
    if (!lastText) { toast('Първо прочети или разпознай текст.'); return; }
    translateBtn.disabled = true; progress.textContent = 'Превеждам…';
    const r = await translateText(lastText, langSel.value);
    progress.textContent = ''; translateBtn.disabled = false;
    if (!r) { toast('Не успях да преведа (няма AI/локален резултат).'); return; }
    const framed = r.ai ? frameAiSuggestion(r.text) : r.text;
    setOut(out.textContent + `\n\n— Превод (${langSel.value}) —\n` + framed);
  });

  // --- Запомни в паметта ---
  const memBtn = el('button', { class: 'secondary grow' }, '💾 Запомни');
  memBtn.addEventListener('click', () => {
    if (!lastText) { toast('Няма какво да запомня още.'); return; }
    addMemory({
      type: 'fact',
      key: `Зрение (${lastKind}) ${new Date().toLocaleString('bg-BG')}`,
      value: lastText
    });
    toast('Запомних видяното в локалната памет.');
  });

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Анализ'),
    el('div', { class: 'row wrap', style: 'gap:8px' }, [ocrBtn, recogBtn]),
    el('div', { class: 'row wrap', style: 'gap:8px;margin-top:8px' }, [pdfBtn, understandBtn]),
    el('label', { style: 'margin-top:12px' }, 'Език за превод'), langSel,
    el('div', { class: 'row wrap', style: 'gap:8px;margin-top:8px' }, [translateBtn, memBtn]),
    progress, out
  ]));
}
