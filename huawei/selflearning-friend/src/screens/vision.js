// Version: 1.0001
// vision.js (екран) — „Зрение“: камера на живо + OCR + разпознаване + превод.
//
// OWNER-GATED: рутерът в main.js рисува този екран само когато сме отключени
// (същата защита като другите екрани). Тук не дублираме проверката, но спираме
// камерата при напускане (hashchange/visibility), за да не държим устройството заето.
import { el, clear, toast } from '../ui/dom.js';
import { addMemory } from '../core/memory-store.js';
import { frameAiSuggestion } from '../core/honesty.js';
import { t, tf } from '../core/i18n.js';
import {
  startCamera, stopCamera, grabFrame, drawImageFileToCanvas,
  ocrCanvas, ocrPdfFile,
  classifyImage, detectObjects, describeRecognition,
  translateText, TARGET_LANGS, understandViaTeacher,
  takeVisionIntent
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

  root.appendChild(el('h2', {}, t('screen_vision')));
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('vis_intro')));

  // Общ работен canvas (скрит) + последно извлечен текст за действия.
  const canvas = el('canvas', { style: 'display:none' });
  let lastText = '';        // последно OCR/разпознато описание (за „Запомни“/„Преведи“)
  let lastKind = 'OCR';     // етикет за паметта

  // --- Камера на живо ---
  const video = el('video', {
    style: 'width:100%;border-radius:12px;background:#000;max-height:300px;object-fit:contain;display:none'
  });
  const camMsg = el('p', { class: 'muted', style: 'font-size:13px' }, t('vis_cam_off'));
  const preview = el('canvas', { style: 'width:100%;border-radius:12px;display:none;max-height:300px;object-fit:contain' });

  const startBtn = el('button', { class: 'grow' }, t('vis_start_cam'));
  const stopBtn = el('button', { class: 'secondary grow', disabled: true }, t('vis_stop'));
  const grabBtn = el('button', { class: 'secondary grow', disabled: true }, t('vis_grab'));

  // Пуска камерата с избрана посока ('environment' = задна, 'user' = предна). Връща true при успех.
  async function startCam(facing = 'environment') {
    startBtn.disabled = true;
    const r = await startCamera(video, { facingMode: facing });
    if (r.ok) {
      _stream = r.stream;
      video.style.display = 'block';
      camMsg.style.display = 'none';
      stopBtn.disabled = false; grabBtn.disabled = false;
      return true;
    }
    camMsg.textContent = r.reason;
    camMsg.className = 'warn-text';
    startBtn.disabled = false;
    toast(r.reason);
    return false;
  }
  startBtn.addEventListener('click', () => startCam('environment'));
  stopBtn.addEventListener('click', () => {
    releaseCamera();
    video.style.display = 'none';
    camMsg.className = 'muted'; camMsg.style.display = 'block';
    camMsg.textContent = t('vis_cam_stopped');
    stopBtn.disabled = true; grabBtn.disabled = true; startBtn.disabled = false;
  });
  grabBtn.addEventListener('click', () => {
    const r = grabFrame(video, preview);
    if (!r.ok) { toast(r.reason || t('vis_no_frame')); return; }
    preview.style.display = 'block';
    toast(t('vis_frame_grabbed'));
  });

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('vis_cam_live')),
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
    if (r.ok) { preview.style.display = 'block'; toast(t('vis_img_loaded')); }
    else toast(r.reason || t('vis_error'));
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('vis_or_upload')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('vis_upload_desc')),
    imgInput, pdfInput
  ]));

  // --- Резултат + действия ---
  const progress = el('div', { class: 'muted', style: 'font-size:12px;min-height:16px' }, '');
  const out = el('div', { style: 'white-space:pre-wrap;font-size:14px;margin-top:8px' }, '');
  const setProgress = (p) => { progress.textContent = p == null ? '' : tf('vis_processing', Math.round(p * 100)); };
  const setOut = (txt) => { out.textContent = txt || ''; };

  // Източник за анализ: предпочитаме preview (хванат кадър/качено), иначе хващаме от видеото.
  function ensureSource() {
    if (preview.style.display !== 'none' && preview.width) return true;
    const r = grabFrame(video, preview);
    if (r.ok) { preview.style.display = 'block'; return true; }
    toast(t('vis_need_source'));
    return false;
  }

  // OCR от текущия canvas (кадър/качено изображение).
  const ocrBtn = el('button', { class: 'grow' }, t('vis_read_text'));
  ocrBtn.addEventListener('click', async () => {
    if (!ensureSource()) return;
    ocrBtn.disabled = true; setOut(''); setProgress(0);
    const r = await ocrCanvas(preview, { langs: 'bul+eng', onProgress: setProgress });
    setProgress(null); ocrBtn.disabled = false;
    if (!r.ok) { setOut(r.reason); return; }
    lastText = r.text || ''; lastKind = 'OCR';
    const header = r.confidence != null ? tf('vis_read_result', Math.round(r.confidence)) : t('vis_read_result_plain');
    setOut(lastText ? `${header}\n\n${lastText}` : t('vis_no_text'));
  });

  // OCR от PDF.
  const pdfBtn = el('button', { class: 'secondary grow' }, t('vis_read_pdf'));
  pdfBtn.addEventListener('click', async () => {
    const f = pdfInput.files && pdfInput.files[0];
    if (!f) { toast(t('vis_pick_pdf')); return; }
    pdfBtn.disabled = true; setOut(''); setProgress(0);
    const r = await ocrPdfFile(f, { langs: 'bul+eng', maxPages: 5, onProgress: setProgress });
    setProgress(null); pdfBtn.disabled = false;
    if (!r.ok) { setOut(r.reason); return; }
    lastText = r.text || ''; lastKind = 'PDF';
    setOut(lastText ? `${tf('vis_pdf_result', r.pages)}\n\n${lastText}` : t('vis_no_pdf_text'));
  });

  // Разпознаване „какво има“ (MobileNet класификация + COCO-SSD детекция).
  const recogBtn = el('button', { class: 'grow' }, t('vis_whats_in'));
  async function doRecognize() {
    if (!ensureSource()) return;
    recogBtn.disabled = true; setOut(''); progress.textContent = t('vis_loading_models');
    const [cls, det] = await Promise.all([classifyImage(preview), detectObjects(preview)]);
    progress.textContent = '';
    recogBtn.disabled = false;
    const labels = cls.ok ? cls.labels : [];
    const objects = det.ok ? det.objects : [];
    if (!labels.length && !objects.length) {
      setOut((cls.reason || det.reason) ? tf('vis_error_p', cls.reason || det.reason) : t('vis_nothing_sure'));
      lastText = ''; return;
    }
    const desc = describeRecognition({ labels, objects });
    lastText = desc; lastKind = t('vis_kind_recognition');
    const lines = [];
    if (labels.length) lines.push(t('vis_classification') + '\n' +
      labels.map((l) => `• ${l.label} — ${Math.round(l.prob * 100)}%`).join('\n'));
    if (objects.length) lines.push(t('vis_objects') + '\n' +
      objects.map((o) => `• ${o.label} — ${Math.round(o.score * 100)}%`).join('\n'));
    setOut(lines.join('\n\n'));
  }
  recogBtn.addEventListener('click', doRecognize);

  // По избор: „разбиране“ през AI учителя (текстово описание → teach()).
  const understandBtn = el('button', { class: 'ghost grow' }, t('vis_understand_ai'));
  understandBtn.addEventListener('click', async () => {
    if (!lastText) { toast(t('vis_recognize_first')); return; }
    understandBtn.disabled = true; progress.textContent = t('vis_asking_teacher');
    const r = await understandViaTeacher(lastText);
    progress.textContent = ''; understandBtn.disabled = false;
    if (!r) { setOut(out.textContent + '\n\n' + t('vis_teacher_silent')); return; }
    const framed = r.ai ? frameAiSuggestion(r.text) : r.text;
    setOut(out.textContent + '\n\n' + t('vis_interpretation') + '\n' + framed);
  });

  // --- Превод (преизползва teacher.js) ---
  // TARGET_LANGS стойностите се пращат на преводача като ЦЕЛЕВИ език (данни за модела),
  // затова не ги превеждаме — иначе целта се разминава.
  const langSel = el('select', {},
    TARGET_LANGS.map(([v, label]) => el('option', { value: v }, label)));
  langSel.value = 'английски';
  const translateBtn = el('button', { class: 'grow' }, t('vis_translate'));
  translateBtn.addEventListener('click', async () => {
    if (!lastText) { toast(t('vis_read_first')); return; }
    translateBtn.disabled = true; progress.textContent = t('vis_translating');
    const r = await translateText(lastText, langSel.value);
    progress.textContent = ''; translateBtn.disabled = false;
    if (!r) { toast(t('vis_translate_fail')); return; }
    const framed = r.ai ? frameAiSuggestion(r.text) : r.text;
    setOut(out.textContent + '\n\n' + tf('vis_translation_label', langSel.value) + '\n' + framed);
  });

  // --- Запомни в паметта ---
  const memBtn = el('button', { class: 'secondary grow' }, t('vis_remember'));
  memBtn.addEventListener('click', () => {
    if (!lastText) { toast(t('vis_nothing_remember')); return; }
    addMemory({
      type: 'fact',
      key: tf('vis_mem_key', lastKind, new Date().toLocaleString()),
      value: lastText
    });
    toast(t('vis_remembered'));
  });

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('vis_analysis')),
    el('div', { class: 'row wrap', style: 'gap:8px' }, [ocrBtn, recogBtn]),
    el('div', { class: 'row wrap', style: 'gap:8px;margin-top:8px' }, [pdfBtn, understandBtn]),
    el('label', { style: 'margin-top:12px' }, t('vis_translate_lang')), langSel,
    el('div', { class: 'row wrap', style: 'gap:8px;margin-top:8px' }, [translateBtn, memBtn]),
    progress, out
  ]));

  // --- Изпълнение на ГЛАСОВА заявка („виж“/„виж през предната“/„запази“) ---
  // Чатът остави заявка (setVisionIntent) и навигира тук. Пускаме исканата камера, изчакваме
  // първи кадър, хващаме го и анализираме автоматично — за да „види“ каквото показваш.
  function waitForFrame(timeoutMs = 5000) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        if ((video.videoWidth || 0) > 0 && (video.videoHeight || 0) > 0) return resolve(true);
        if (Date.now() - t0 > timeoutMs) return resolve(false);
        setTimeout(tick, 120);
      };
      tick();
    });
  }
  async function runVoiceIntent(intent) {
    // Уверяваме се, че камерата работи (с исканата посока; за „запази“ — задната по подразбиране).
    if (!_stream) {
      const ok = await startCam(intent.facing || 'environment');
      if (!ok) return;
    }
    const haveFrame = await waitForFrame();
    if (haveFrame) {
      const g = grabFrame(video, preview);
      if (g.ok) preview.style.display = 'block';
    }
    if (intent.analyze) {
      await doRecognize();
      // По избор: и кратко „разбиране“ през учителя, ако има какво.
      if (lastText) { try { understandBtn.click(); } catch (_) {} }
    }
  }
  const intent = takeVisionIntent();
  if (intent) { try { runVoiceIntent(intent); } catch (_) {} }
}
