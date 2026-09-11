// Version: 1.0021
// howto-engine.js — ДВИГАТЕЛЯТ на „Видео инструкция" (всичко на устройството, без мрежа):
//   • подрежда стъпките в глави: заглавен екран → стъпка 1, 2, 3… → финален екран с обобщение;
//   • рисува всеки кадър в canvas: снимка/клип (снимките с бавно приближение), номер на стъпката,
//     надпис, стрелки/кръгове/подчертаване (изрисуват се постепенно), лента за напредък, преливане;
//   • генерира фонова музика (Web Audio синтез — 3 стила) и я смесва с гласовите записи (приглушава
//     музиката, докато се говори);
//   • изнася: MP4 (кадрите → вградения ffmpeg.wasm, H.264 + AAC), GIF (две минавания с палитра),
//     лист-инструкция PDF (собствен малък PDF писач, страници A4 като снимки) и PNG.
// Кадрите от клиповете се взимат с <video> + canvas (core/vframe.js), не с ffmpeg.
import { getFFmpeg } from '../core/ffm.js';
import { loadVideo, seekVideo, canvasBlob } from '../core/vframe.js';

export const SIZES = { portrait: [540, 960], landscape: [960, 540], square: [720, 720] };
export const TPL = {
  repair:   { icon: '🔧', c1: '#1f6feb', c2: '#0b2a5e', music: 'calm',   emoji: ['🔌', '🔄', '💡', '✅'] },
  recipe:   { icon: '🍳', c1: '#f97316', c2: '#6b2108', music: 'cozy',   emoji: ['🥚', '🥣', '🍳', '🍽️'] },
  product:  { icon: '📦', c1: '#8b5cf6', c2: '#2e1065', music: 'upbeat', emoji: ['📦', '🔋', '📱', '🎧'] },
  exercise: { icon: '🏋️', c1: '#10b981', c2: '#053b2c', music: 'upbeat', emoji: ['🧍', '🔄', '🏋️', '💧'] }
};
export const TPL_KEYS = Object.keys(TPL);
export const ANN_COLORS = ['#ffd400', '#ff3b30', '#34c759', '#ffffff'];
// Готови отметки за примерните стъпки (координати 0..1 спрямо снимката).
export const SAMPLE_ANN = [
  [{ type: 'arrow', x1: 0.12, y1: 0.12, x2: 0.36, y2: 0.33, color: '#ffd400' }],
  [{ type: 'circle', x1: 0.24, y1: 0.24, x2: 0.76, y2: 0.66, color: '#ff3b30' }],
  [{ type: 'line', x1: 0.26, y1: 0.73, x2: 0.74, y2: 0.73, color: '#ffd400' }],
  [{ type: 'circle', x1: 0.26, y1: 0.25, x2: 0.74, y2: 0.65, color: '#34c759' }, { type: 'arrow', x1: 0.9, y1: 0.88, x2: 0.7, y2: 0.66, color: '#ffffff' }]
];

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans CJK TC", "Noto Sans Devanagari", "Noto Naskh Arabic", sans-serif';
export const TITLE_DUR = 2.6;
export const OUTRO_DUR = 3.2;
const FADE = 0.3;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const fmt = (s, v) => String(s).replace('{0}', String(v));

// ───────────────────────── времева линия ─────────────────────────
// Дължина на стъпка: зададените секунди, но не по-малко от гласовия запис (+ малко въздух).
export function stepDur(s) {
  const d = Math.max(1, Math.min(60, +s.dur || 3));
  const v = s.voice && s.voice.dur ? Math.min(60, s.voice.dur + 0.6) : 0;
  return Math.max(d, v);
}
export function timeline(P) {
  const segs = [{ kind: 'title', start: 0, dur: TITLE_DUR }];
  let t = TITLE_DUR;
  P.steps.forEach((s, i) => { const d = stepDur(s); segs.push({ kind: 'step', i, start: t, dur: d }); t += d; });
  segs.push({ kind: 'outro', start: t, dur: OUTRO_DUR });
  t += OUTRO_DUR;
  return { segs, total: t };
}
export function segAt(tl, t) {
  for (const s of tl.segs) if (t < s.start + s.dur) return s;
  return tl.segs[tl.segs.length - 1];
}
// Секунда от клипа за даден момент от стъпката (клипът тече 1:1; ако свърши — задържа последния кадър).
export function clipTime(s, m, tLocal) {
  const from = Math.max(0, +s.clipFrom || 0);
  const dur = isFinite(m.duration) && m.duration > 0 ? m.duration : from + tLocal + 1;
  return Math.min(from + tLocal, Math.max(from, dur - 0.05));
}

// ───────────────────────── помощници за рисуване ─────────────────────────
export function fitRect(sw, sh, W, H, mode) {
  const k = mode === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  const w = sw * k, h = sh * k;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// Пренасяне на текст по ширина; думи без интервали (японски/китайски) се делят по знаци.
function wrap(ctx, text, maxW) {
  const out = [];
  String(text || '').split(/\n+/).forEach((para) => {
    let line = '';
    para.split(/\s+/).filter(Boolean).forEach((w) => {
      const cand = line ? line + ' ' + w : w;
      if (ctx.measureText(cand).width <= maxW) { line = cand; return; }
      if (line) out.push(line);
      line = '';
      if (ctx.measureText(w).width <= maxW) { line = w; return; }
      let part = '';
      Array.from(w).forEach((ch) => {
        if (part && ctx.measureText(part + ch).width > maxW) { out.push(part); part = ch; } else part += ch;
      });
      line = part;
    });
    if (line) out.push(line);
  });
  return out;
}
function fitLines(ctx, text, maxW, size, weight, maxLines, minSize) {
  let fs = size, lines = [];
  for (let k = 0; k < 6; k++) {
    ctx.font = `${weight} ${fs}px ${FONT}`;
    lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines || fs <= minSize) break;
    fs *= 0.88;
  }
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
  return { fs, lines };
}
const _tiny = typeof document !== 'undefined' ? document.createElement('canvas') : null;
// Размит фон от самия кадър (смаляване до 24 px и разпъване обратно — евтино „размиване").
function blurBg(ctx, src, sw, sh, W, H) {
  _tiny.width = 24; _tiny.height = Math.max(1, Math.round(24 * H / W));
  const tc = _tiny.getContext('2d');
  const r = fitRect(sw, sh, _tiny.width, _tiny.height, 'cover');
  tc.drawImage(src, r.x, r.y, r.w, r.h);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(_tiny, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function gradientBg(ctx, W, H, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const b = Math.min(W, H);
  ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(W * 0.86, H * 0.1, b * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.08, H * 0.94, b * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Една отметка (стрелка / кръг / подчертаване) в правоъгълника на кадъра; p = 0..1 — колко е изрисувана.
export function drawAnn(ctx, a, rect, p) {
  if (p <= 0) return;
  const X = (u) => rect.x + u * rect.w, Y = (v) => rect.y + v * rect.h;
  const lw = Math.max(3, Math.min(rect.w, rect.h) * 0.014);
  const x1 = X(a.x1), y1 = Y(a.y1), x2 = X(a.x2), y2 = Y(a.y2);
  ctx.save();
  ctx.strokeStyle = a.color || '#ffd400'; ctx.fillStyle = a.color || '#ffd400';
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = lw * 1.3;
  if (a.type === 'arrow') {
    const ex = x1 + (x2 - x1) * p, ey = y1 + (y2 - y1) * p;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke();
    if (p > 0.5) {
      const ang = Math.atan2(y2 - y1, x2 - x1), hs = lw * 4.2 * Math.min(1, (p - 0.5) * 2 + 0.2);
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - hs * Math.cos(ang - 0.45), ey - hs * Math.sin(ang - 0.45));
      ctx.lineTo(ex - hs * Math.cos(ang + 0.45), ey - hs * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
    }
  } else if (a.type === 'circle') {
    const rx = Math.max(lw * 2, Math.abs(x2 - x1) / 2), ry = Math.max(lw * 2, Math.abs(y2 - y1) / 2);
    ctx.beginPath();
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
  } else {
    ctx.globalAlpha = 0.9; ctx.lineWidth = lw * 1.7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p); ctx.stroke();
  }
  ctx.restore();
}

// Миниатюра на стъпка (кадърът на „откъс от" + отметките). За клип — първо прескача до кадъра.
export async function stepThumb(s, m, maxW) {
  const c = document.createElement('canvas');
  const w = Math.max(16, Math.round(maxW));
  const h = m ? Math.max(1, Math.round(w * m.h / m.w)) : Math.round(w * 0.75);
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!m) { ctx.fillStyle = '#333'; ctx.fillRect(0, 0, w, h); return c; }
  if (m.isVideo) await seekVideo(m.el, Math.max(0, +s.clipFrom || 0));
  ctx.drawImage(m.el, 0, 0, w, h);
  (s.ann || []).forEach((a) => drawAnn(ctx, a, { x: 0, y: 0, w, h }, 1));
  return c;
}
export async function prepareThumbs(P, mm, maxW) {
  const out = new Map();
  for (const s of P.steps) out.set(s.id, await stepThumb(s, mm.get(s.id), maxW));
  return out;
}

// ───────────────────────── кадрите на урока ─────────────────────────
function drawTitle(ctx, W, H, P, tLocal, o) {
  const tp = TPL[P.template] || TPL.repair;
  const b = Math.min(W, H);
  gradientBg(ctx, W, H, tp.c1, tp.c2);
  const a = ease(tLocal / 0.7);
  ctx.save();
  ctx.globalAlpha = a;
  const es = b * 0.2 * (0.8 + 0.2 * a);
  ctx.font = `${es}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.fillText(tp.icon, W / 2, H * 0.22);
  let y = H * 0.22 + es * 0.72;
  const T = fitLines(ctx, P.title || '', W * 0.86, b * 0.085, 800, 3, b * 0.05);
  ctx.textBaseline = 'top'; ctx.font = `800 ${T.fs}px ${FONT}`;
  T.lines.forEach((l) => { ctx.fillText(l, W / 2, y); y += T.fs * 1.18; });
  const sub = P.subtitle || fmt(o.L.inSteps, P.steps.length);
  const S = fitLines(ctx, sub, W * 0.86, b * 0.045, 500, 2, b * 0.03);
  ctx.font = `500 ${S.fs}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.88)';
  y += b * 0.015;
  S.lines.forEach((l) => { ctx.fillText(l, W / 2, y); y += S.fs * 1.25; });
  // миниатюри на стъпките (до 5) — появяват се една след друга
  const th = P.steps.slice(0, 5);
  if (th.length && o.thumbs) {
    const n = th.length, gap = b * 0.022;
    const tw = Math.min((W * 0.9 - gap * (n - 1)) / n, b * 0.25);
    const tH = tw;
    const yT = Math.max(y + b * 0.04, H - tH - b * 0.1);
    const x0 = (W - (tw * n + gap * (n - 1))) / 2;
    th.forEach((s, i) => {
      const c = o.thumbs.get(s.id);
      const x = x0 + i * (tw + gap);
      const d = ease((tLocal - 0.35 - i * 0.12) / 0.5);
      if (d <= 0) return;
      ctx.save();
      ctx.globalAlpha = a * d;
      ctx.translate(0, (1 - d) * b * 0.05);
      rr(ctx, x, yT, tw, tH, b * 0.022);
      ctx.save(); ctx.clip();
      if (c) { const r = fitRect(c.width, c.height, tw, tH, 'cover'); ctx.drawImage(c, x + r.x, yT + r.y, r.w, r.h); }
      else { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x, yT, tw, tH); }
      ctx.restore();
      ctx.lineWidth = b * 0.006; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
      const cr = tw * 0.16;
      ctx.beginPath(); ctx.arc(x + cr * 1.2, yT + cr * 1.2, cr, 0, Math.PI * 2); ctx.fillStyle = tp.c1; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${cr * 1.2}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x + cr * 1.2, yT + cr * 1.25);
      ctx.restore();
    });
  }
  ctx.restore();
}

function drawOutro(ctx, W, H, P, tLocal, o) {
  const tp = TPL[P.template] || TPL.repair;
  const b = Math.min(W, H);
  gradientBg(ctx, W, H, tp.c2, tp.c1);
  const a = ease(tLocal / 0.6);
  ctx.save();
  ctx.globalAlpha = a;
  const cy = H * 0.17, r = b * 0.1 * (0.7 + 0.3 * a);
  ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = tp.c1; ctx.lineWidth = r * 0.18; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(W / 2 - r * 0.45, cy + r * 0.02); ctx.lineTo(W / 2 - r * 0.1, cy + r * 0.36); ctx.lineTo(W / 2 + r * 0.5, cy - r * 0.34); ctx.stroke();
  let y = cy + r + b * 0.05;
  const O = fitLines(ctx, P.outro || o.L.outro, W * 0.86, b * 0.066, 800, 3, b * 0.04);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `800 ${O.fs}px ${FONT}`;
  O.lines.forEach((l) => { ctx.fillText(l, W / 2, y); y += O.fs * 1.2; });
  // обобщение: номер + първия ред от надписа на всяка стъпка
  const list = P.steps.slice(0, 6);
  if (list.length) {
    y += b * 0.03;
    const fs = b * 0.036, lh = fs * 1.55, boxW = W * 0.86, bx = (W - boxW) / 2;
    const boxH = list.length * lh + fs * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(ctx, bx, y, boxW, boxH, b * 0.025); ctx.fill();
    ctx.font = `600 ${fs}px ${FONT}`;
    list.forEach((s, i) => {
      const d = ease((tLocal - 0.3 - i * 0.1) / 0.4);
      ctx.save(); ctx.globalAlpha = a * d;
      const yy = y + fs * 0.45 + i * lh;
      const num = (i + 1) + '.';
      const cap = String(s.caption || '').split('\n')[0];
      let line = cap;
      const maxW = boxW - fs * 3.2;
      while (line && ctx.measureText(line).width > maxW) line = line.slice(0, -2);
      if (line !== cap) line += '…';
      ctx.fillStyle = '#fff';
      if (o.rtl) { ctx.textAlign = 'right'; ctx.fillText(num, bx + boxW - fs * 0.7, yy); ctx.fillText(line, bx + boxW - fs * 2.4, yy); }
      else { ctx.textAlign = 'left'; ctx.fillText(num, bx + fs * 0.7, yy); ctx.fillText(line, bx + fs * 2.4, yy); }
      ctx.restore();
    });
  }
  ctx.globalAlpha = a * 0.75; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.font = `600 ${b * 0.03}px ${FONT}`;
  ctx.fillText('Pupikes', W / 2, H - b * 0.04);
  ctx.restore();
}

function drawStep(ctx, W, H, P, seg, tLocal, mm, o) {
  const s = P.steps[seg.i];
  const m = mm.get(s.id);
  const tp = TPL[P.template] || TPL.repair;
  const b = Math.min(W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (m) {
    blurBg(ctx, m.el, m.w, m.h, W, H);
    let r = fitRect(m.w, m.h, W, H, 'contain');
    if (!m.isVideo) { // снимка: бавно приближение (усещане за движение)
      const z = 1 + 0.07 * clamp01(tLocal / seg.dur);
      r = { x: r.x - r.w * (z - 1) / 2, y: r.y - r.h * (z - 1) / 2, w: r.w * z, h: r.h * z };
    }
    ctx.drawImage(m.el, r.x, r.y, r.w, r.h);
    (s.ann || []).forEach((a, k) => drawAnn(ctx, a, r, ease((tLocal - 0.3 - k * 0.25) / 0.6)));
  }
  // „Стъпка 2/5"
  const label = `${o.L.step} ${seg.i + 1}/${P.steps.length}`;
  const fs = b * 0.042;
  ctx.font = `800 ${fs}px ${FONT}`;
  const pw = ctx.measureText(label).width + fs * 1.3, ph = fs * 1.7;
  const px = o.rtl ? W - pw - b * 0.04 : b * 0.04, py = b * 0.05;
  ctx.fillStyle = tp.c1; rr(ctx, px, py, pw, ph, ph / 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, px + pw / 2, py + ph / 2 + fs * 0.04);
  // надпис
  if (s.caption) {
    const pad = b * 0.035;
    const C = fitLines(ctx, s.caption, W - pad * 4, b * 0.056, 700, 4, b * 0.034);
    const lh = C.fs * 1.25, boxH = C.lines.length * lh + pad * 1.4;
    const y0 = H - boxH - b * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,.66)'; rr(ctx, pad, y0, W - pad * 2, boxH, b * 0.03); ctx.fill();
    ctx.fillStyle = tp.c1; rr(ctx, o.rtl ? W - pad - b * 0.014 : pad, y0, b * 0.014, boxH, b * 0.007); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `700 ${C.fs}px ${FONT}`;
    C.lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + pad * 0.7 + i * lh));
  }
}

// Рисува кадъра за момент t от урока. o = { L (текстове на урока), rtl, thumbs }.
export function drawFrame(ctx, W, H, P, tl, t, mm, o) {
  const seg = segAt(tl, t);
  const tLocal = Math.max(0, t - seg.start);
  ctx.save();
  try { ctx.direction = o.rtl ? 'rtl' : 'ltr'; } catch (e) {}
  if (seg.kind === 'title') drawTitle(ctx, W, H, P, tLocal, o);
  else if (seg.kind === 'outro') drawOutro(ctx, W, H, P, tLocal, o);
  else drawStep(ctx, W, H, P, seg, tLocal, mm, o);
  const b = Math.min(W, H);
  if (seg.kind === 'step') { // напредък на целия урок
    const tp = TPL[P.template] || TPL.repair;
    const bh = Math.max(3, b * 0.012);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, H - bh, W, bh);
    ctx.fillStyle = tp.c1;
    const gw = W * clamp01(t / tl.total);
    ctx.fillRect(o.rtl ? W - gw : 0, H - bh, gw, bh);
  }
  if (tLocal < FADE) { ctx.fillStyle = `rgba(0,0,0,${(1 - tLocal / FADE).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  return seg;
}

// Обхожда всички кадри (fps) → onFrame(canvas, индекс, общо). Клиповете се прескачат кадър по кадър.
export async function renderSequence(P, mm, o, onFrame, onProg) {
  const tl = timeline(P);
  const n = Math.max(1, Math.ceil(tl.total * o.fps));
  const c = document.createElement('canvas');
  c.width = o.W; c.height = o.H;
  const ctx = c.getContext('2d');
  for (let f = 0; f < n; f++) {
    const t = f / o.fps;
    const seg = segAt(tl, t);
    if (seg.kind === 'step') {
      const s = P.steps[seg.i], m = mm.get(s.id);
      if (m && m.isVideo) await seekVideo(m.el, clipTime(s, m, t - seg.start));
    }
    drawFrame(ctx, o.W, o.H, P, tl, t, mm, o);
    await onFrame(c, f, n);
    if (onProg) onProg((f + 1) / n);
  }
  return { frames: n, total: tl.total };
}

async function canvasBytes(c, type, q) { return new Uint8Array(await (await canvasBlob(c, type, q)).arrayBuffer()); }
const pad5 = (n) => String(n).padStart(5, '0');
async function cleanup(ff, names) { for (const nm of names) { try { await ff.deleteFile(nm); } catch (e) {} } }

// ───────────────────────── MP4 ─────────────────────────
// prog(етап, 0..1): 'draw' (рисуване на кадрите), 'audio', 'enc' (кодиране).
export async function exportMP4(P, mm, o, prog) {
  const ff = await getFFmpeg((p) => prog('enc', p));
  const names = [];
  await renderSequence(P, mm, o, async (c, f) => {
    const nm = 'ht' + pad5(f) + '.jpg';
    await ff.writeFile(nm, await canvasBytes(c, 'image/jpeg', 0.86));
    names.push(nm);
  }, (p) => prog('draw', p));
  prog('audio', 0);
  const audio = await mixAudio(P, o.music, o.voice);
  const args = ['-framerate', String(o.fps), '-i', 'ht%05d.jpg'];
  if (audio) { await ff.writeFile('ht_audio.wav', encodeWAV(audio)); names.push('ht_audio.wav'); args.push('-i', 'ht_audio.wav'); }
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-r', String(o.fps));
  if (audio) args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
  args.push('-movflags', '+faststart', 'ht_out.mp4');
  names.push('ht_out.mp4');
  try {
    prog('enc', 0);
    await ff.exec(args);
    const out = await ff.readFile('ht_out.mp4');
    if (!out || !out.length) throw new Error('empty output');
    return out;
  } finally { await cleanup(ff, names); }
}

// ───────────────────────── GIF ─────────────────────────
// По-малък размер (до 480 px) и 8 кадъра/сек; палитра в две минавания (без буфериране на всички кадри).
export async function exportGIF(P, mm, o, prog) {
  const k = 480 / Math.max(o.W, o.H);
  const W = Math.round(o.W * k / 2) * 2, H = Math.round(o.H * k / 2) * 2;
  const ff = await getFFmpeg((p) => prog('enc', p));
  const names = [];
  await renderSequence(P, mm, Object.assign({}, o, { W, H, fps: 8 }), async (c, f) => {
    const nm = 'hg' + pad5(f) + '.jpg';
    await ff.writeFile(nm, await canvasBytes(c, 'image/jpeg', 0.9));
    names.push(nm);
  }, (p) => prog('draw', p));
  names.push('hg_pal.png', 'hg_out.gif');
  try {
    prog('enc', 0);
    await ff.exec(['-framerate', '8', '-i', 'hg%05d.jpg', '-vf', 'palettegen=max_colors=160:stats_mode=diff', 'hg_pal.png']);
    await ff.exec(['-framerate', '8', '-i', 'hg%05d.jpg', '-i', 'hg_pal.png', '-lavfi', 'paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', 'hg_out.gif']);
    const out = await ff.readFile('hg_out.gif');
    if (!out || !out.length) throw new Error('empty output');
    return out;
  } finally { await cleanup(ff, names); }
}

// ───────────────────────── лист-инструкция (A4) ─────────────────────────
export async function sheetPages(P, mm, o) {
  const PW = 1240, PH = 1754, M = 70, GAP = 34;
  const tp = TPL[P.template] || TPL.repair;
  const thumbs = await prepareThumbs(P, mm, 560);
  const cw = (PW - M * 2 - GAP) / 2, ih = Math.round(cw * 0.66);
  const capFs = 27, capLines = 4, ch = ih + 26 + capLines * capFs * 1.3 + 24;
  const headH = 260, footH = 60;
  const rowsFirst = Math.max(1, Math.floor((PH - M - headH - footH) / (ch + GAP)));
  const rowsNext = Math.max(1, Math.floor((PH - M * 2 - footH) / (ch + GAP)));
  const plan = [];
  const n = P.steps.length;
  let i = 0, first = true;
  do { const rows = first ? rowsFirst : rowsNext; plan.push({ first, from: i, to: Math.min(n, i + rows * 2) }); i += rows * 2; first = false; } while (i < n);
  return plan.map((pg, pi) => {
    const c = document.createElement('canvas');
    c.width = PW; c.height = PH;
    const ctx = c.getContext('2d');
    try { ctx.direction = o.rtl ? 'rtl' : 'ltr'; } catch (e) {}
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, PW, PH);
    let y0 = M;
    if (pg.first) {
      const g = ctx.createLinearGradient(0, 0, PW, headH);
      g.addColorStop(0, tp.c1); g.addColorStop(1, tp.c2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, PW, headH - 40);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
      ctx.font = `90px ${FONT}`; ctx.textAlign = o.rtl ? 'right' : 'left';
      ctx.fillText(tp.icon, o.rtl ? PW - M : M, (headH - 40) / 2);
      const tx = o.rtl ? PW - M - 130 : M + 130;
      const T = fitLines(ctx, P.title || '', PW - M * 2 - 140, 56, 800, 2, 36);
      ctx.font = `800 ${T.fs}px ${FONT}`; ctx.textBaseline = 'top';
      let ty = 44;
      T.lines.forEach((l) => { ctx.fillText(l, tx, ty); ty += T.fs * 1.15; });
      ctx.font = `500 30px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillText(P.subtitle || fmt(o.L.inSteps, n), tx, ty + 8);
      y0 = headH;
    }
    for (let k = pg.from; k < pg.to; k++) {
      const idx = k - pg.from, col = idx % 2, row = Math.floor(idx / 2);
      const x = M + ((o.rtl ? 1 - col : col) * (cw + GAP)), y = y0 + row * (ch + GAP);
      const s = P.steps[k];
      ctx.fillStyle = '#f6f8fa'; rr(ctx, x, y, cw, ch, 22); ctx.fill();
      ctx.strokeStyle = '#d0d7de'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); rr(ctx, x, y, cw, ih, 22); ctx.clip();
      ctx.fillStyle = '#111'; ctx.fillRect(x, y, cw, ih);
      const th = thumbs.get(s.id);
      if (th) { const r = fitRect(th.width, th.height, cw, ih, 'contain'); ctx.drawImage(th, x + r.x, y + r.y, r.w, r.h); }
      ctx.restore();
      const cx = o.rtl ? x + cw - 44 : x + 44;
      ctx.beginPath(); ctx.arc(cx, y + 44, 30, 0, Math.PI * 2); ctx.fillStyle = tp.c1; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `800 32px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(k + 1), cx, y + 46);
      const C = fitLines(ctx, s.caption || '', cw - 36, capFs, 600, capLines, capFs);
      ctx.font = `600 ${C.fs}px ${FONT}`; ctx.fillStyle = '#1f2328'; ctx.textBaseline = 'top';
      ctx.textAlign = o.rtl ? 'right' : 'left';
      C.lines.forEach((l, li) => ctx.fillText(l, o.rtl ? x + cw - 18 : x + 18, y + ih + 22 + li * capFs * 1.3));
    }
    ctx.fillStyle = '#8b949e'; ctx.font = `500 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`Pupikes · ${pi + 1}/${plan.length}`, PW / 2, PH - 26);
    return c;
  });
}

// Минимален PDF писач: всяка страница A4 = една JPEG снимка (DCTDecode). Всички писмености (кирилица,
// арабски, хинди, японски, китайски) излизат правилно, защото текстът е нарисуван от системните шрифтове.
export async function makePDF(pages) {
  const enc = new TextEncoder();
  const parts = []; let len = 0; const offs = [];
  const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const mark = (id) => { offs[id] = len; };
  const n = pages.length;
  add('%PDF-1.4\n%âãÏÓ\n');
  mark(1); add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  mark(2); add(`2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, k) => (3 + k * 3) + ' 0 R').join(' ')}] /Count ${n} >>\nendobj\n`);
  for (let k = 0; k < n; k++) {
    const jpg = await canvasBytes(pages[k], 'image/jpeg', 0.9);
    const pid = 3 + k * 3, cid = pid + 1, iid = pid + 2;
    mark(pid); add(`${pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>\nendobj\n`);
    const cs = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
    mark(cid); add(`${cid} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
    mark(iid); add(`${iid} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pages[k].width} /Height ${pages[k].height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    add(jpg); add('\nendstream\nendobj\n');
  }
  const total = 3 + n * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let id = 1; id < total; id++) x += String(offs[id]).padStart(10, '0') + ' 00000 n \n';
  add(x);
  add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let p = 0;
  parts.forEach((b) => { out.set(b, p); p += b.length; });
  return out;
}

// Всички страници една под друга → една PNG снимка (за споделяне в чат).
export async function sheetPNG(pages) {
  const gap = 24;
  let H = pages.reduce((a, c) => a + c.height, 0) + gap * (pages.length - 1);
  const k = H > 16000 ? 16000 / H : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(pages[0].width * k); c.height = Math.round(H * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d0d7de'; ctx.fillRect(0, 0, c.width, c.height);
  let y = 0;
  pages.forEach((pg) => { ctx.drawImage(pg, 0, y, pg.width * k, pg.height * k); y += (pg.height + gap) * k; });
  return canvasBlob(c, 'image/png');
}

// ───────────────────────── звук: музика + глас ─────────────────────────
const STYLES = {
  calm:   { bpm: 72,  prog: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]], pad: 'sine',     arp: 'triangle', kick: false, hat: false, cut: 1800 },
  upbeat: { bpm: 112, prog: [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], pad: 'triangle', arp: 'square',   kick: true,  hat: true,  cut: 2600 },
  cozy:   { bpm: 84,  prog: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 60, 64, 67]], pad: 'triangle', arp: 'sine',     kick: true,  hat: false, cut: 1300 }
};
export const MUSIC_KEYS = Object.keys(STYLES);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function OAC() { return window.OfflineAudioContext || window.webkitOfflineAudioContext; }

// Генерира фонова музика (моно) за secs секунди — акорди, бас, арпеджио и по избор ритъм.
export async function synthMusic(style, secs, sr) {
  const S = STYLES[style];
  if (!S) return null;
  sr = sr || 44100;
  const len = Math.max(1, Math.ceil(secs * sr));
  const ac = new (OAC())(1, len, sr);
  const master = ac.createGain();
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.9, Math.min(0.8, secs / 3));
  master.gain.setValueAtTime(0.9, Math.max(0.9, secs - 1.6));
  master.gain.linearRampToValueAtTime(0, secs);
  master.connect(ac.destination);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = S.cut; lp.connect(master);
  const note = (type, freq, t0, dur, vol, att, dest) => {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + att);
    g.gain.linearRampToValueAtTime(vol * 0.6, t0 + Math.max(att + 0.01, dur * 0.6));
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.25);
    o.connect(g); g.connect(dest || lp);
    o.start(t0); o.stop(t0 + dur + 0.3);
  };
  let noise = null;
  if (S.hat) {
    noise = ac.createBuffer(1, Math.round(sr * 0.08), sr);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; hp.connect(master);
  const beat = 60 / S.bpm, bar = beat * 4;
  for (let b = 0, t = 0; t < secs; b++, t += bar) {
    const ch = S.prog[b % S.prog.length];
    ch.forEach((m) => note(S.pad, mtof(m), t, bar, 0.045, 0.35));
    note('sine', mtof(ch[0] - 24), t, beat * 1.8, 0.16, 0.02);
    note('sine', mtof(ch[0] - 24), t + beat * 2, beat * 1.8, 0.14, 0.02);
    for (let k = 0; k < 8; k++) note(S.arp, mtof(ch[(k * 2 + (k > 3 ? 1 : 0)) % ch.length] + 12), t + k * beat / 2, beat / 2 * 0.8, S.arp === 'square' ? 0.018 : 0.035, 0.01);
    if (S.kick) {
      for (let k = 0; k < 4; k += (S.bpm > 100 ? 1 : 2)) {
        const t0 = t + k * beat;
        const o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
        const g = ac.createGain(); g.gain.setValueAtTime(0.32, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
        o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.3);
      }
    }
    if (noise) {
      for (let k = 0; k < 4; k++) {
        const t0 = t + k * beat + beat / 2;
        const src = ac.createBufferSource(); src.buffer = noise;
        const g = ac.createGain(); g.gain.value = 0.05;
        src.connect(g); g.connect(hp); src.start(t0);
      }
    }
  }
  return ac.startRendering();
}

// Смесва музиката и гласовите записи по времевата линия (моно, 44.1 kHz). null = урокът е без звук.
export async function mixAudio(P, style, withVoice) {
  const tl = timeline(P);
  const sr = 44100;
  const voices = [];
  if (withVoice) {
    tl.segs.forEach((g) => { if (g.kind === 'step') { const s = P.steps[g.i]; if (s.voice && s.voice.blob) voices.push({ s, g }); } });
  }
  const music = style && style !== 'none' ? await synthMusic(style, tl.total, sr) : null;
  if (!music && !voices.length) return null;
  const ac = new (OAC())(1, Math.ceil(tl.total * sr), sr);
  if (music) {
    const src = ac.createBufferSource(); src.buffer = music;
    const g = ac.createGain();
    g.gain.setValueAtTime(voices.length ? 0.7 : 0.9, 0);
    voices.forEach((v) => { // приглушаване под гласа
      const d = (v.s.voice.dur || 2) + 0.3;
      g.gain.setTargetAtTime(0.22, v.g.start, 0.12);
      g.gain.setTargetAtTime(0.7, v.g.start + d, 0.3);
    });
    src.connect(g); g.connect(ac.destination); src.start(0);
  }
  for (const v of voices) {
    try {
      const buf = await ac.decodeAudioData(await v.s.voice.blob.arrayBuffer());
      const src = ac.createBufferSource(); src.buffer = buf;
      const g = ac.createGain(); g.gain.value = 1.15;
      src.connect(g); g.connect(ac.destination);
      src.start(v.g.start + 0.25);
    } catch (e) { /* повреден запис — пропуска се */ }
  }
  return ac.startRendering();
}

// AudioBuffer → WAV 16-bit моно.
export function encodeWAV(buf) {
  const ch = buf.getChannelData(0), n = ch.length, sr = buf.sampleRate;
  const out = new Uint8Array(44 + n * 2);
  const dv = new DataView(out.buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, ch[i])); dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return out;
}

// ───────────────────────── внос на клипове ─────────────────────────
// Клип, който вграденият декодер не отваря (AVI/MKV/…), се преобразува веднъж до MP4 (до 2 мин., 720p).
export async function transcodeToMp4(blob, name, onProg) {
  const ff = await getFFmpeg(onProg);
  const inName = 'imp_' + String(name || 'clip').replace(/[^\w.\-]+/g, '_');
  await ff.writeFile(inName, new Uint8Array(await blob.arrayBuffer()));
  try {
    await ff.exec(['-i', inName, '-t', '120', '-vf', 'scale=-2:trunc(min(720\\,ih)/2)*2', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-pix_fmt', 'yuv420p', '-an', 'imp_out.mp4']);
    const out = await ff.readFile('imp_out.mp4');
    if (!out || !out.length) throw new Error('empty output');
    return new Blob([out], { type: 'video/mp4' });
  } finally { await cleanup(ff, [inName, 'imp_out.mp4']); }
}
export { loadVideo };

// ───────────────────────── примерни снимки ─────────────────────────
function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const ch = (x, s) => (x >> s) & 255;
  const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
// Нарисувана илюстрация за примерната стъпка (сцена + голям символ) → JPEG Blob.
export async function makeSampleImage(tplKey, i) {
  const tp = TPL[tplKey] || TPL.repair;
  const W = 720, H = 900;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const wall = ctx.createLinearGradient(0, 0, 0, H * 0.64);
  wall.addColorStop(0, mix(tp.c1, '#ffffff', 0.82)); wall.addColorStop(1, mix(tp.c1, '#ffffff', 0.6));
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = mix(tp.c2, '#8a6a4a', 0.55); ctx.fillRect(0, H * 0.64, W, H * 0.36);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, H * 0.64, W, 10);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(60 + k * 100, 70 + (k % 2) * 40, 8 + (k % 3) * 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.67, 190, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.font = `300px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tp.emoji[i % tp.emoji.length], W / 2, H * 0.45);
  return canvasBlob(c, 'image/jpeg', 0.9);
}
