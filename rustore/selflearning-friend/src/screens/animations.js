// Version: 1.0001
// animations.js (екран) — „Анимации“: ботът СЪЗДАВА кратки анимации на <canvas>
// (чист код — частици, подскачащи форми, градиентни вълни, поздравителен надпис)
// и може да ги ЗАПИШЕ във видео файл (.webm) през canvas.captureStream() + MediaRecorder.
//
// OWNER-GATED: рутерът в main.js рисува този екран само когато сме отключени
// (същата защита като другите екрани). Тук спираме анимацията и записа при
// напускане (hashchange/visibility), за да не държим устройството заето.
//
// ЧЕСТНОСТ: анимациите се генерират в код (canvas). „Видеото“ е реален запис на
// canvas потока чрез MediaRecorder (формат webm — vp9/vp8, според браузъра/WebView).
// Няма външна видео услуга. Тежка видео обработка / компютърно зрение НЕ е тук —
// това е създаване и запис.
import { el, clear, toast } from '../ui/dom.js';
import { addMemory } from '../core/memory-store.js';
import { sessionName } from '../core/responder.js';
import { t, tf } from '../core/i18n.js';

// --- Модулно състояние (за чисто освобождаване между навигации) ---
let _raf = null;            // requestAnimationFrame дръжка
let _recorder = null;       // активен MediaRecorder
let _recStream = null;      // canvas.captureStream() поток
let _chunks = [];           // събрани blob парчета
let _lastUrl = null;        // последен objectURL (за revoke)
let _cleanupBound = false;

function stopAnimation() {
  if (_raf != null) { cancelAnimationFrame(_raf); _raf = null; }
}

function stopRecording(silent) {
  try {
    if (_recorder && _recorder.state !== 'inactive') _recorder.stop();
  } catch (_) { /* ignore */ }
  _recorder = null;
  if (_recStream) {
    try { _recStream.getTracks().forEach((t) => t.stop()); } catch (_) { /* ignore */ }
    _recStream = null;
  }
  if (silent) _chunks = [];
}

function releaseAll() {
  stopRecording(true);
  stopAnimation();
}

function revokeLastUrl() {
  if (_lastUrl) { try { URL.revokeObjectURL(_lastUrl); } catch (_) { /* ignore */ } _lastUrl = null; }
}

// Спираме анимация/запис при напускане на екрана (смяна на хеш) или скриване.
function bindLifecycle() {
  if (_cleanupBound || typeof window === 'undefined') return;
  _cleanupBound = true;
  window.addEventListener('hashchange', () => {
    if ((location.hash || '').replace(/^#\/?/, '') !== 'animations') { releaseAll(); revokeLastUrl(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
}

// --- Поддръжка на запис (честна проверка на средата) ---
function recordingSupport(canvas) {
  if (typeof MediaRecorder === 'undefined') {
    return { ok: false, reason: t('anim_no_mediarecorder') };
  }
  if (!canvas || typeof canvas.captureStream !== 'function') {
    return { ok: false, reason: t('anim_no_capturestream') };
  }
  return { ok: true };
}

// Избира най-добрия поддържан webm mime (vp9 → vp8 → webm).
function pickMime() {
  const cands = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) { /* ignore */ } }
  }
  return 'video/webm';
}

// --- Стилове на анимация (чист код, рисуват в 2D контекст) ---
// Всеки стил: factory(opts) → function draw(ctx, t, W, H) (t = секунди).
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// 1) Частици — рояк точки, които се движат и отскачат, оцветени в акцента.
function styleParticles({ color, speed }) {
  const c = hexToRgb(color);
  let parts = null;
  return (ctx, t, W, H) => {
    if (!parts) {
      parts = [];
      for (let i = 0; i < 80; i++) {
        parts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 60 * speed,
          vy: (Math.random() - 0.5) * 60 * speed,
          r: 1.5 + Math.random() * 3
        });
      }
    }
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
    const dt = 1 / 60;
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      p.x = Math.max(0, Math.min(W, p.x));
      p.y = Math.max(0, Math.min(H, p.y));
      const a = 0.5 + 0.5 * Math.sin(t * 2 + p.x);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

// 2) Подскачащи форми — кръг + квадрат + триъгълник, подскачат с лек pulse.
function styleBounce({ color, speed }) {
  const c = hexToRgb(color);
  return (ctx, t, W, H) => {
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
    const shapes = 3;
    for (let i = 0; i < shapes; i++) {
      const ph = t * 1.6 * speed + (i * Math.PI * 2) / shapes;
      const x = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(ph)));
      const y = H * (0.5 + 0.32 * Math.sin(ph * 1.7 + i));
      const s = 24 + 12 * (0.5 + 0.5 * Math.cos(ph * 2));
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.85)`;
      ctx.beginPath();
      if (i === 0) { ctx.arc(x, y, s, 0, Math.PI * 2); }
      else if (i === 1) { ctx.rect(x - s, y - s, s * 2, s * 2); }
      else {
        ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.closePath();
      }
      ctx.fill();
    }
  };
}

// 3) Градиентни вълни — наслагани синусоиди с движещ се градиент.
function styleWaves({ color, speed }) {
  const c = hexToRgb(color);
  return (ctx, t, W, H) => {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b1020');
    g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0.35)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let layer = 0; layer < 4; layer++) {
      ctx.beginPath();
      const amp = 18 + layer * 10;
      const yBase = H * (0.35 + layer * 0.16);
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= W; x += 8) {
        const y = yBase + Math.sin((x / W) * Math.PI * 4 + t * 2 * speed + layer) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${(0.10 + layer * 0.06).toFixed(2)})`;
      ctx.fill();
    }
  };
}

// 4) Поздрав — анимиран надпис (името на бота / собствен текст) с pulse + блясък.
function styleGreeting({ color, speed, text }) {
  const c = hexToRgb(color);
  const label = (text && text.trim()) || (sessionName() || t('anim_default_hello'));
  return (ctx, t, W, H) => {
    const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.45)`);
    g.addColorStop(1, '#0b1020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const pulse = 1 + 0.06 * Math.sin(t * 3 * speed);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(pulse, pulse);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.min(W, H) * 0.16;
    ctx.font = `700 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.9)`;
    ctx.shadowBlur = 20 + 12 * (0.5 + 0.5 * Math.sin(t * 4));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 0, 0);
    ctx.restore();
    // долна лента частици-искрици
    for (let i = 0; i < 24; i++) {
      const x = (i / 24) * W + ((t * 40 * speed) % (W / 24));
      const y = H * 0.82 + Math.sin(t * 3 + i) * 8;
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.7)`;
      ctx.beginPath(); ctx.arc(x % W, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  };
}

// Вторият елемент е КЛЮЧ за превод (резолвва се при рисуване → следва UI езика).
const STYLES = [
  ['particles', 'anim_style_particles', styleParticles],
  ['bounce', 'anim_style_shapes', styleBounce],
  ['waves', 'anim_style_waves', styleWaves],
  ['greeting', 'anim_style_greeting', styleGreeting]
];

export function renderAnimations(root /*, { navigate, rerender } */) {
  clear(root);
  bindLifecycle();
  releaseAll(); // чист старт при всяко влизане

  root.appendChild(el('h2', {}, t('screen_animations')));
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('anim_intro')));

  // --- Платно ---
  const W = 480, H = 270; // 16:9 работна резолюция
  const canvas = el('canvas', {
    width: W, height: H,
    style: 'width:100%;border-radius:12px;background:#0b1020;display:block;max-height:300px'
  });
  const ctx = canvas.getContext('2d');

  // --- Параметри ---
  const styleSel = el('select', {},
    STYLES.map(([v, labelKey]) => el('option', { value: v }, t(labelKey))));
  styleSel.value = 'greeting';

  const colorInput = el('input', { type: 'color', value: '#7b5cff', style: 'width:64px;height:40px;padding:2px' });
  const speedInput = el('input', { type: 'range', min: '0.2', max: '2.5', step: '0.1', value: '1', style: 'flex:1' });
  const textInput = el('input', {
    type: 'text', placeholder: t('anim_greeting_ph'),
    value: sessionName() || ''
  });

  // --- Двигател на анимацията ---
  let draw = null;
  let t0 = 0;

  function buildDraw() {
    const id = styleSel.value;
    const factory = (STYLES.find((s) => s[0] === id) || STYLES[0])[2];
    draw = factory({ color: colorInput.value, speed: parseFloat(speedInput.value) || 1, text: textInput.value });
  }

  function loop(ts) {
    if (!t0) t0 = ts;
    const t = (ts - t0) / 1000;
    if (draw) { try { draw(ctx, t, W, H); } catch (_) { /* пропускаме кадър */ } }
    _raf = requestAnimationFrame(loop);
  }

  function start() {
    stopAnimation();
    buildDraw();
    t0 = 0;
    _raf = requestAnimationFrame(loop);
  }

  // Рестарт при смяна на параметри (живо).
  for (const node of [styleSel, colorInput, speedInput, textInput]) {
    node.addEventListener('input', () => { buildDraw(); });
    node.addEventListener('change', () => { buildDraw(); });
  }

  start(); // авто-старт на анимацията

  root.appendChild(el('div', { class: 'card' }, [
    canvas,
    el('label', {}, t('anim_style_label')), styleSel,
    el('div', { class: 'row', style: 'gap:10px;margin-top:8px;align-items:center' }, [
      el('span', { class: 'muted', style: 'font-size:13px' }, t('anim_color')),
      colorInput,
      el('span', { class: 'muted', style: 'font-size:13px' }, t('anim_speed')),
      speedInput
    ]),
    el('label', {}, t('anim_greeting_text_label')), textInput
  ]));

  // --- Запис на видео (MediaRecorder) ---
  const recStatus = el('div', { class: 'muted', style: 'font-size:13px;min-height:18px' }, '');
  const startRecBtn = el('button', { class: 'grow' }, t('anim_rec_btn'));
  const stopRecBtn = el('button', { class: 'secondary grow', disabled: true }, t('anim_rec_stop_btn'));
  const resultBox = el('div', { style: 'margin-top:10px' });

  const sup = recordingSupport(canvas);
  if (!sup.ok) {
    startRecBtn.disabled = true;
    recStatus.className = 'warn-text';
    recStatus.textContent = sup.reason;
  }

  startRecBtn.addEventListener('click', () => {
    const s = recordingSupport(canvas);
    if (!s.ok) { toast(s.reason); return; }
    try {
      _recStream = canvas.captureStream(30); // 30 fps
      const mime = pickMime();
      _chunks = [];
      revokeLastUrl();
      clear(resultBox);
      _recorder = new MediaRecorder(_recStream, { mimeType: mime });
      _recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) _chunks.push(e.data); };
      _recorder.onstop = () => {
        const blob = new Blob(_chunks, { type: mime });
        _chunks = [];
        if (_recStream) { try { _recStream.getTracks().forEach((tr) => tr.stop()); } catch (_) { /* ignore */ } _recStream = null; }
        if (!blob.size) { recStatus.textContent = t('anim_rec_empty'); return; }
        revokeLastUrl();
        _lastUrl = URL.createObjectURL(blob);
        const kb = Math.round(blob.size / 1024);
        recStatus.className = 'ok-text';
        recStatus.textContent = tf('anim_rec_done', kb, mime);
        buildResult(blob, _lastUrl);
      };
      _recorder.start();
      startRecBtn.disabled = true; stopRecBtn.disabled = false;
      recStatus.className = 'muted';
      recStatus.textContent = tf('anim_recording', mime);
    } catch (e) {
      recStatus.className = 'err-text';
      recStatus.textContent = tf('anim_rec_start_fail', (e && e.message ? e.message : e));
      stopRecording(true);
      startRecBtn.disabled = false; stopRecBtn.disabled = true;
    }
  });

  stopRecBtn.addEventListener('click', () => {
    try { if (_recorder && _recorder.state !== 'inactive') _recorder.stop(); } catch (_) { /* ignore */ }
    startRecBtn.disabled = false; stopRecBtn.disabled = true;
  });

  function buildResult(blob, url) {
    clear(resultBox);
    const fname = `animation-${Date.now()}.webm`;
    const video = el('video', { src: url, controls: true, loop: true, style: 'width:100%;border-radius:12px;margin-top:8px;max-height:300px' });
    const dl = el('a', { href: url, download: fname, class: 'ghost', style: 'display:inline-block;margin-top:8px' }, t('anim_download'));
    const row = el('div', { class: 'row wrap', style: 'gap:8px;margin-top:6px' }, [dl]);
    // Web Share (ако е наличен и поддържа файлове).
    if (typeof navigator !== 'undefined' && navigator.share) {
      const shareBtn = el('button', { class: 'secondary' }, t('anim_share'));
      shareBtn.addEventListener('click', async () => {
        try {
          const file = new File([blob], fname, { type: blob.type || 'video/webm' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: t('anim_share_title') });
          } else {
            await navigator.share({ title: t('anim_share_title'), text: t('anim_share_text') });
          }
        } catch (_) { toast(t('anim_share_denied')); }
      });
      row.appendChild(shareBtn);
    }
    resultBox.appendChild(video);
    resultBox.appendChild(row);
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('anim_rec_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('anim_rec_desc')),
    el('div', { class: 'row wrap', style: 'gap:8px' }, [startRecBtn, stopRecBtn]),
    recStatus, resultBox
  ]));

  // --- Бележка в паметта (по избор) ---
  const noteInput = el('input', { type: 'text', placeholder: t('anim_note_ph') });
  const noteBtn = el('button', { class: 'secondary grow' }, t('anim_remember_note'));
  noteBtn.addEventListener('click', () => {
    const v = noteInput.value.trim();
    if (!v) { toast(t('anim_write_note')); return; }
    const styleLabel = t((STYLES.find((s) => s[0] === styleSel.value) || STYLES[0])[1]);
    addMemory({
      type: 'fact',
      key: tf('anim_mem_key', styleLabel, new Date().toLocaleString()),
      value: v
    });
    noteInput.value = '';
    toast(t('anim_note_saved'));
  });

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('anim_note_title')),
    noteInput,
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [noteBtn])
  ]));
}
