// Version: 1.0021
// „Видео инструкция от телефона" — ГЛАВНАТА функция на приложението (Huawei 4.3, 11.09.2026).
// Потребителят снима или избира няколко клипа/снимки като СТЪПКИ → апът ги подрежда като глави
// (стъпка 1, 2, 3…), слага надпис на всяка стъпка (на избран от 15 езика), стрелки/кръгове/подчертаване
// върху кадъра, заглавен и финален екран, по избор глас (запис от микрофона или вграден синтез на реч)
// и генерирана фонова музика. Изнася: видео урок MP4 (вграден ffmpeg.wasm), GIF инструкция и лист за
// печат PDF/PNG. Шаблони: ремонт, рецепта, продукт/ревю, упражнение. Всичко на устройството, офлайн.
// Работата се пази в IndexedDB (с файловете). При първо пускане — ясно маркирана ПРИМЕРНА инструкция
// (нарисувани илюстрации), която се изтрива с един бутон.
import './howto-i18n.js';
import { esc, setStatus, fmtSize } from '../core/ui.js';
import { saveFile } from '../core/filesave.js';
import { t, tf, getLang } from '../core/i18n.js';
import { LANGUAGES, languageByCode } from '../core/languages.js';
import { loadVideo, seekVideo } from '../core/vframe.js';
import { speak, stopSpeaking, ttsAvailable } from '../core/tts.js';
import { startVoice, voiceAvailable } from '../core/voice-rec.js';
import { lessonTexts } from './howto-texts.js';
import {
  SIZES, TPL, TPL_KEYS, ANN_COLORS, SAMPLE_ANN, MUSIC_KEYS, timeline, segAt, clipTime, stepDur, fitRect,
  drawAnn, drawFrame, prepareThumbs, exportMP4, exportGIF, sheetPages, makePDF, sheetPNG, synthMusic,
  mixAudio, transcodeToMp4, makeSampleImage
} from './howto-engine.js';

export const title = t('t_howto_name');

const LS_SAMPLE_DONE = 'howto.sampleDone';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let P = null;               // проектът (урокът)
let loaded = false;
let root = null;
const media = new Map();    // id на стъпка → Promise<{ el, w, h, isVideo, duration, url }>
let pv = null;              // текущ преглед
let rec = null;             // текущ запис на глас { i, ctl, timer }
let annOpen = -1, annTool = 'arrow', annColor = ANN_COLORS[0];
let resultUrl = null;
let saveTimer = null;

// ───────────────────────── съхранение (IndexedDB, с файловете) ─────────────────────────
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('pupikes-howto', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  try { const db = await idb(); return await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
  catch (e) { return null; }
}
async function idbSet(k, v) {
  try { const db = await idb(); await new Promise((res) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = res; }); }
  catch (e) { /* без запис — работата остава в паметта */ }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => idbSet('draft', P), 600); }

// ───────────────────────── проект / пример ─────────────────────────
const L = () => lessonTexts(P.lang);
const rtl = () => P.lang === 'ar';
const voiceCode = () => languageByCode(P.lang).voice;

async function applySample(tpl) {
  const Lx = L();
  const imgs = await Promise.all([0, 1, 2, 3].map((i) => makeSampleImage(tpl, i)));
  P.steps.filter((s) => s.sample).forEach(forgetMedia);
  const steps = imgs.map((b, i) => ({
    id: uid(), kind: 'image', blob: b, mime: 'image/jpeg', name: 'sample-' + (i + 1) + '.jpg',
    caption: Lx.tpl[tpl].s[i], dur: 3.5, clipFrom: 0, ann: JSON.parse(JSON.stringify(SAMPLE_ANN[i])), voice: null, sample: true, si: i
  }));
  P.steps = steps.concat(P.steps.filter((s) => !s.sample));
  P.template = tpl; P.title = Lx.tpl[tpl].t; P.music = TPL[tpl].music; P.sample = true;
}
async function newProject() {
  P = { v: 1, template: 'recipe', lang: getLang(), title: '', subtitle: '', outro: '', steps: [], voiceMode: 'mine', music: 'cozy', format: 'portrait', fps: 10, sample: false };
  let done = false;
  try { done = !!localStorage.getItem(LS_SAMPLE_DONE); } catch (e) {}
  if (!done) await applySample('recipe');
}
function deleteSample() {
  P.steps.filter((s) => s.sample).forEach(forgetMedia);
  P.steps = P.steps.filter((s) => !s.sample);
  P.sample = false; P.title = '';
  try { localStorage.setItem(LS_SAMPLE_DONE, '1'); } catch (e) {}
  save(); draw();
}

// ───────────────────────── медия на стъпките ─────────────────────────
function forgetMedia(s) {
  const p = media.get(s.id);
  media.delete(s.id);
  if (p) p.then((m) => { try { if (m.isVideo) { m.el.pause(); m.el.removeAttribute('src'); } URL.revokeObjectURL(m.url); } catch (e) {} }).catch(() => {});
}
function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image')); im.src = url; });
}
function ensureMedia(s) {
  if (media.has(s.id)) return media.get(s.id);
  const p = (async () => {
    let url = URL.createObjectURL(s.blob);
    if (s.kind !== 'video') {
      const el = await loadImage(url);
      return { el, w: el.naturalWidth, h: el.naturalHeight, isVideo: false, url };
    }
    let v;
    try { v = await loadVideo(url); }
    catch (e) { // вграденият декодер не го отваря → еднократно преобразуване до MP4
      URL.revokeObjectURL(url);
      stepStatus('work', tf('ht_import_conv', s.name || ''));
      s.blob = await transcodeToMp4(s.blob, s.name);
      s.mime = 'video/mp4';
      save();
      url = URL.createObjectURL(s.blob);
      v = await loadVideo(url);
      stepStatus('', '');
    }
    return { el: v, w: v.videoWidth, h: v.videoHeight, isVideo: true, duration: v.duration, url };
  })();
  media.set(s.id, p);
  p.catch(() => media.delete(s.id));
  return p;
}
async function mediaAll() {
  const mm = new Map();
  for (const s of P.steps) mm.set(s.id, await ensureMedia(s));
  return mm;
}
const frameOpts = (thumbs) => ({ L: L(), rtl: rtl(), thumbs });

// ───────────────────────── избор / снимане на файлове ─────────────────────────
function isNative() {
  try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; }
}
function b64ToBytes(b64) {
  const bin = atob(String(b64 || '').replace(/^data:[^,]*,/, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function webPick(accept, multiple, capture) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.style.display = 'none';
    if (multiple) inp.multiple = true;
    if (capture) inp.setAttribute('capture', 'environment');
    inp.addEventListener('change', () => {
      resolve(Array.from(inp.files || []).map((f) => ({ name: f.name, blob: f, mime: f.type || '' })));
      setTimeout(() => { try { inp.remove(); } catch (e) {} }, 100);
    });
    document.body.appendChild(inp);
    try { window.__PUPIKES_SUSPEND_LOCK__ = true; setTimeout(() => { window.__PUPIKES_SUSPEND_LOCK__ = false; }, 60000); } catch (e) {}
    inp.click();
  });
}
// Телефон: нативният избор (WebView-ът понякога дава празни файлове от Downloads/Drive).
async function nativePickMany() {
  const { FilePicker } = await import('@capawesome/capacitor-file-picker');
  let res;
  try { window.__PUPIKES_SUSPEND_LOCK__ = true; res = await FilePicker.pickFiles({ types: ['image/*', 'video/*'], readData: true, limit: 0 }); }
  finally { setTimeout(() => { try { window.__PUPIKES_SUSPEND_LOCK__ = false; } catch (e) {} }, 500); }
  const out = [];
  for (const f of (res && res.files) || []) {
    let blob = null;
    if (f.data) blob = new Blob([b64ToBytes(f.data)], { type: f.mimeType || '' });
    else if (f.blob) blob = f.blob;
    else if (f.path) {
      try { const u = window.Capacitor.convertFileSrc ? window.Capacitor.convertFileSrc(f.path) : f.path; const r = await fetch(u); if (r.ok) blob = await r.blob(); } catch (e) {}
    }
    if (blob && blob.size) out.push({ name: f.name || 'file', blob, mime: f.mimeType || blob.type || '' });
  }
  return out;
}
async function addFiles(list) {
  for (const f of list || []) {
    const isV = /^video\//.test(f.mime) || /\.(mp4|m4v|webm|mov|mkv|avi|3gp)$/i.test(f.name || '');
    const s = { id: uid(), kind: isV ? 'video' : 'image', blob: f.blob, mime: f.mime, name: f.name || '', caption: '', dur: 3.5, clipFrom: 0, ann: [], voice: null };
    P.steps.push(s);
    try {
      const m = await ensureMedia(s);
      if (isV) { const d = isFinite(m.duration) && m.duration > 0 ? m.duration : 5; s.dur = Math.max(1.5, Math.min(6, Math.round(d * 2) / 2)); }
    } catch (e) {
      P.steps.splice(P.steps.indexOf(s), 1);
      stepStatus('err', tf('ht_import_err', f.name || ''));
    }
  }
  save(); draw();
}

// ───────────────────────── изглед ─────────────────────────
function injectCSS() {
  if (document.getElementById('ht-css')) return;
  const st = document.createElement('style');
  st.id = 'ht-css';
  st.textContent = `
.ht-banner{margin-bottom:14px}.ht-banner .btn{margin-top:10px}
.ht-stage{display:block;margin:0 auto;max-width:100%;max-height:54vh;width:auto;height:auto;border-radius:12px;background:#000}
.ht-chips{display:flex;flex-wrap:wrap;gap:6px}
.ht-chip{padding:8px 11px;border-radius:999px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:.88em;cursor:pointer;font-family:inherit}
.ht-chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.ht-step{border:1px solid var(--line);border-radius:12px;padding:10px;margin-top:10px;background:var(--bg)}
.ht-sh{display:flex;align-items:center;gap:8px}
.ht-num{min-width:28px;height:28px;border-radius:50%;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}
.ht-kind{font-size:.82em;color:var(--text-dim)}.ht-grow{flex:1}
.ht-ib{background:var(--bg-3);border:none;color:var(--text);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:15px}
.ht-sb{display:flex;gap:10px;margin-top:8px;align-items:flex-start}
.ht-thumb{width:108px;border-radius:8px;flex-shrink:0;cursor:pointer;background:#111}
.ht-cap{min-height:72px!important;font-size:.92em}
.ht-nums label{margin-top:8px}
.ht-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ht-mini{padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg-2);color:var(--text);font-size:.82em;cursor:pointer;font-family:inherit}
.ht-mini.rec{background:var(--err);border-color:var(--err);color:#fff}
.ht-annot{margin-top:10px;border-top:1px dashed var(--line);padding-top:10px}
.ht-ecv{display:block;width:100%;border-radius:8px;touch-action:none;margin-top:8px;background:#111}
.ht-col{width:30px;height:30px;border-radius:50%;border:3px solid transparent;cursor:pointer}
.ht-col.on{border-color:var(--text)}
.ht-exp{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ht-exp .btn{margin-top:0;padding:12px 8px;font-size:.9em}
.ht-result{margin-top:12px;text-align:center}.ht-result video,.ht-result img{max-width:100%;max-height:50vh;border-radius:10px;background:#000}
.ht-result .hint{margin-bottom:6px}
`;
  document.head.appendChild(st);
}

const $ = (s) => root && root.querySelector(s);
function stepStatus(kind, msg) {
  const el = $('#htStepStatus');
  if (!el) return;
  if (!kind) { el.className = 'status'; el.textContent = ''; return; }
  setStatus(el, kind, msg);
}
const fmtS = (x) => (Math.round(x * 10) / 10).toString();

export async function render(container) {
  root = container;
  injectCSS();
  container.innerHTML = `<div class="hint">${esc(t('loading'))}</div>`;
  if (!loaded) {
    const d = await idbGet('draft');
    if (d && d.v === 1 && Array.isArray(d.steps)) P = d; else await newProject();
    loaded = true;
  }
  if (root !== container) return;
  draw();
}
export function unmount() { stopPreview(); stopRec(true); root = null; }

function opt(v, label, cur) { return `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`; }

function draw() {
  if (!root) return;
  const Lx = L();
  const tl = timeline(P);
  root.innerHTML = `
    ${P.sample ? `<div class="notice ht-banner"><b>📌 ${esc(t('ht_sample_tag'))}</b> — ${esc(t('ht_banner'))}<button class="btn sec" id="htDelSample">${esc(t('ht_sample_del'))}</button></div>` : ''}
    <div class="tool-card">
      <canvas id="htStage" class="ht-stage"></canvas>
      <button class="btn" id="htPlay">${esc(pv ? t('ht_stop') : t('ht_play'))}</button>
      <div class="hint center" id="htTotal">${esc(tf('ht_total', fmtS(tl.total), P.steps.length))}</div>
    </div>
    <div class="tool-card">
      <label>${esc(t('ht_tpl'))}</label>
      <div class="ht-chips" id="htTpl">${TPL_KEYS.map((k) => `<button class="ht-chip${k === P.template ? ' on' : ''}" data-k="${k}">${TPL[k].icon} ${esc(t('ht_tpl_' + k))}</button>`).join('')}</div>
      <div class="hint">${esc(t('ht_tpl_hint'))}</div>
      <label>${esc(t('ht_lang'))}</label>
      <select id="htLang">${LANGUAGES.map((l) => opt(l.code, l.native, P.lang)).join('')}</select>
      <label>${esc(t('ht_f_title'))}</label>
      <input id="htTitle" value="${esc(P.title)}" placeholder="${esc(Lx.tpl[P.template].t)}">
      <label>${esc(t('ht_f_sub'))}</label>
      <input id="htSub" value="${esc(P.subtitle)}" placeholder="${esc(Lx.inSteps.replace('{0}', P.steps.length))}">
      <label>${esc(t('ht_f_outro'))}</label>
      <input id="htOutro" value="${esc(P.outro)}" placeholder="${esc(Lx.outro)}">
    </div>
    <div class="tool-card" id="htStepsCard">
      <label id="htStepsLbl">${esc(tf('ht_steps', P.steps.length))}</label>
      <div id="htSteps"></div>
      <div class="row">
        <div><button class="btn" id="htShoot">${esc(t('ht_shoot'))}</button></div>
        <div><button class="btn" id="htShootClip">${esc(t('ht_shoot_clip'))}</button></div>
      </div>
      <button class="btn sec" id="htAdd">${esc(t('ht_add'))}</button>
      <div class="status" id="htStepStatus"></div>
      <div class="hint">${esc(t('ht_saved_note'))}</div>
    </div>
    <div class="tool-card">
      <label>${esc(t('ht_voice'))}</label>
      <select id="htVoice">${opt('mine', t('ht_voice_mine'), P.voiceMode)}${opt('tts', t('ht_voice_tts'), P.voiceMode)}${opt('none', t('ht_voice_none'), P.voiceMode)}</select>
      <div class="hint">${esc(t('ht_voice_hint'))}</div>
      <label>${esc(t('ht_music'))}</label>
      <div class="row"><div><select id="htMusic">${opt('none', t('ht_music_none'), P.music)}${MUSIC_KEYS.map((k) => opt(k, t('ht_music_' + k), P.music)).join('')}</select></div>
        <div style="flex:0 0 auto;min-width:0"><button class="btn sec inline" id="htMusicTry" style="margin-top:0">${esc(t('ht_music_try'))}</button></div></div>
      <div class="row">
        <div><label>${esc(t('ht_format'))}</label><select id="htFormat">${['portrait', 'landscape', 'square'].map((k) => opt(k, t('ht_fmt_' + k), P.format)).join('')}</select></div>
        <div><label>${esc(t('ht_fps'))}</label><select id="htFps">${opt(10, t('ht_fps_fast'), P.fps)}${opt(20, t('ht_fps_smooth'), P.fps)}</select></div>
      </div>
    </div>
    <div class="tool-card" id="htExportCard">
      <label>${esc(t('ht_export'))}</label>
      <div class="ht-exp">
        <button class="btn" data-x="mp4">${esc(t('ht_exp_mp4'))}</button>
        <button class="btn" data-x="gif">${esc(t('ht_exp_gif'))}</button>
        <button class="btn sec" data-x="pdf">${esc(t('ht_exp_pdf'))}</button>
        <button class="btn sec" data-x="png">${esc(t('ht_exp_png'))}</button>
      </div>
      <div class="bar" id="htBarW" style="display:none"><div id="htBar"></div></div>
      <div class="status" id="htStatus"></div>
      <div class="ht-result" id="htResult"></div>
    </div>`;
  bind();
  drawSteps();
  drawPoster();
}

function bind() {
  const del = $('#htDelSample');
  if (del) del.addEventListener('click', deleteSample);
  $('#htPlay').addEventListener('click', () => { if (pv) { stopPreview(); drawPoster(); } else startPreview(); });
  $('#htTpl').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.getAttribute('data-k');
    stopPreview();
    if (P.sample) await applySample(k);
    else { P.template = k; P.music = TPL[k].music; }
    save(); draw();
  });
  $('#htLang').addEventListener('change', (e) => {
    P.lang = e.target.value;
    if (P.sample) { const Lx = L(); P.title = Lx.tpl[P.template].t; P.steps.forEach((s) => { if (s.sample) s.caption = Lx.tpl[P.template].s[s.si]; }); }
    save(); draw();
  });
  const bindText = (sel, key) => $(sel).addEventListener('input', (e) => { P[key] = e.target.value; save(); drawPoster(); });
  bindText('#htTitle', 'title'); bindText('#htSub', 'subtitle'); bindText('#htOutro', 'outro');
  $('#htShoot').addEventListener('click', () => webPick('image/*', false, true).then(addFiles));
  $('#htShootClip').addEventListener('click', () => webPick('video/*', false, true).then(addFiles));
  $('#htAdd').addEventListener('click', () => {
    const p = isNative() ? nativePickMany() : webPick('image/*,video/*', true, false);
    p.then(addFiles).catch((e) => stepStatus('err', tf('ht_err', (e && e.message) || e)));
  });
  $('#htVoice').addEventListener('change', (e) => { P.voiceMode = e.target.value; save(); });
  $('#htMusic').addEventListener('change', (e) => { P.music = e.target.value; save(); });
  $('#htMusicTry').addEventListener('click', tryMusic);
  $('#htFormat').addEventListener('change', (e) => { P.format = e.target.value; save(); stopPreview(); drawPoster(); });
  $('#htFps').addEventListener('change', (e) => { P.fps = +e.target.value || 10; save(); });
  root.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => doExport(b.getAttribute('data-x'))));
  const list = $('#htSteps');
  list.addEventListener('click', onStepClick);
  list.addEventListener('input', onStepInput);
}

// ───────────────────────── стъпки ─────────────────────────
function drawSteps() {
  const list = $('#htSteps');
  if (!list) return;
  const Lx = L();
  const tp = TPL[P.template] || TPL.repair;
  $('#htStepsLbl').textContent = tf('ht_steps', P.steps.length);
  const tot = $('#htTotal'); if (tot) tot.textContent = tf('ht_total', fmtS(timeline(P).total), P.steps.length);
  if (!P.steps.length) { list.innerHTML = `<div class="hint">${esc(t('ht_empty'))}</div>`; return; }
  list.innerHTML = P.steps.map((s, i) => {
    const recOn = rec && rec.i === i;
    const ph = (Lx.tpl[P.template].s[i]) || t('ht_caption_ph');
    return `<div class="ht-step" data-i="${i}">
      <div class="ht-sh"><span class="ht-num" style="background:${tp.c1}">${i + 1}</span>
        <span class="ht-kind">${s.kind === 'video' ? '🎬' : '🖼'} ${esc(tf('ht_step', i + 1))} · ${fmtS(stepDur(s))} s${s.sample ? ' · ' + esc(t('ht_sample_tag')) : ''}</span><span class="ht-grow"></span>
        <button class="ht-ib" data-a="up" title="${esc(t('ht_up'))}">↑</button><button class="ht-ib" data-a="down" title="${esc(t('ht_down'))}">↓</button><button class="ht-ib" data-a="del" title="${esc(t('ht_remove'))}">✕</button></div>
      <div class="ht-sb"><canvas class="ht-thumb" data-a="mark" data-thumb="${i}"></canvas>
        <textarea class="ht-cap" data-f="caption" rows="3" placeholder="${esc(ph)}">${esc(s.caption)}</textarea></div>
      <div class="row ht-nums"><div><label>${esc(t('ht_dur'))}</label><input type="number" data-f="dur" min="1" max="60" step="0.5" value="${esc(s.dur)}"></div>
        ${s.kind === 'video' ? `<div><label>${esc(t('ht_clip_from'))}</label><input type="number" data-f="clipFrom" min="0" step="0.5" value="${esc(s.clipFrom || 0)}"></div>` : ''}</div>
      <div class="ht-tools">
        <button class="ht-mini" data-a="mark">${esc(annOpen === i ? t('ht_mark_done') : t('ht_mark'))}</button>
        <button class="ht-mini${recOn ? ' rec' : ''}" data-a="rec">${esc(recOn ? tf('ht_rec_stop', 0) : t('ht_rec'))}</button>
        <button class="ht-mini" data-a="speak">${esc(t('ht_speak'))}</button>
        <button class="ht-mini" data-a="rectts">${esc(t('ht_rec_tts'))}</button>
        ${s.voice ? `<button class="ht-mini" data-a="pv">${esc(tf('ht_voice_len', fmtS(s.voice.dur || 0)))}</button><button class="ht-mini" data-a="dv" title="${esc(t('ht_voice_del'))}">✕ 🎙</button>` : ''}
      </div>
      ${annOpen === i ? annEditorHTML() : ''}
    </div>`;
  }).join('');
  drawThumbs();
  if (annOpen >= 0 && annOpen < P.steps.length) setupAnnEditor(annOpen);
}
async function drawThumbs() {
  for (let i = 0; i < P.steps.length; i++) {
    const s = P.steps[i];
    const cv = root && root.querySelector(`[data-thumb="${i}"]`);
    if (!cv) continue;
    try {
      const m = await ensureMedia(s);
      if (m.isVideo) await seekVideo(m.el, Math.max(0, +s.clipFrom || 0));
      const w = 216, h = Math.max(1, Math.round(w * m.h / m.w));
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(m.el, 0, 0, w, h);
      (s.ann || []).forEach((a) => drawAnn(ctx, a, { x: 0, y: 0, w, h }, 1));
    } catch (e) { /* файлът не се отваря — остава тъмна миниатюра */ }
  }
}
function onStepInput(e) {
  const card = e.target.closest('.ht-step'); if (!card) return;
  const s = P.steps[+card.getAttribute('data-i')]; if (!s) return;
  const f = e.target.getAttribute('data-f');
  if (f === 'caption') s.caption = e.target.value;
  else if (f === 'dur') s.dur = Math.max(1, Math.min(60, parseFloat(e.target.value) || 3));
  else if (f === 'clipFrom') { s.clipFrom = Math.max(0, parseFloat(e.target.value) || 0); drawThumbs(); }
  save();
  const tot = $('#htTotal'); if (tot) tot.textContent = tf('ht_total', fmtS(timeline(P).total), P.steps.length);
  if (!pv) drawPoster();
}
async function onStepClick(e) {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const card = b.closest('.ht-step'); if (!card) return;
  const i = +card.getAttribute('data-i');
  const s = P.steps[i]; if (!s) return;
  const a = b.getAttribute('data-a');
  if (a === 'up' && i > 0) { [P.steps[i - 1], P.steps[i]] = [P.steps[i], P.steps[i - 1]]; annOpen = -1; }
  else if (a === 'down' && i < P.steps.length - 1) { [P.steps[i + 1], P.steps[i]] = [P.steps[i], P.steps[i + 1]]; annOpen = -1; }
  else if (a === 'del') { forgetMedia(s); P.steps.splice(i, 1); annOpen = -1; if (!P.steps.some((x) => x.sample)) P.sample = false; }
  else if (a === 'mark') { annOpen = annOpen === i ? -1 : i; }
  else if (a === 'speak') { if (!ttsAvailable()) stepStatus('err', t('ht_tts_none')); else speak(s.caption || '', voiceCode()); return; }
  else if (a === 'rec') { if (rec && rec.i === i) { await stopRec(); return; } await beginRec(i, false); return; }
  else if (a === 'rectts') { await beginRec(i, true); return; }
  else if (a === 'pv') { try { const au = new Audio(URL.createObjectURL(s.voice.blob)); au.play().catch(() => {}); } catch (err) {} return; }
  else if (a === 'dv') { s.voice = null; }
  else return;
  stopPreview();
  save(); drawSteps(); drawPoster();
}

// ───────────────────────── глас ─────────────────────────
async function beginRec(i, synth) {
  if (rec) await stopRec();
  const s = P.steps[i];
  if (synth && !ttsAvailable()) { stepStatus('err', t('ht_tts_none')); return; }
  if (!voiceAvailable()) { stepStatus('err', t('ht_mic_none')); return; }
  stopPreview();
  try {
    const est = synth ? Math.min(30, 2 + (s.caption || '').length * 0.09) : 30;
    const ctl = await startVoice(est, { raw: synth });
    rec = { i, ctl, t0: Date.now() };
    drawSteps();
    rec.timer = setInterval(() => {
      if (!rec) return;
      const btn = root && root.querySelector(`.ht-step[data-i="${rec.i}"] [data-a="rec"]`);
      if (btn) btn.textContent = tf('ht_rec_stop', Math.round((Date.now() - rec.t0) / 1000));
      if (!rec.ctl.running()) stopRec();
    }, 300);
    if (synth) { await speak(s.caption || '', voiceCode()); await sleep(450); await stopRec(); }
  } catch (e) {
    rec = null;
    const m = (e && e.message) || '';
    stepStatus('err', m === 'denied' ? t('ht_mic_denied') : m === 'nomic' ? t('ht_mic_none') : tf('ht_err', m));
    drawSteps();
  }
}
async function stopRec(silent) {
  if (!rec) return;
  const r = rec; rec = null;
  clearInterval(r.timer);
  try {
    const res = await r.ctl.stop();
    const s = P.steps[r.i];
    if (s && res && res.blob) { s.voice = res; if (P.voiceMode === 'none' || P.voiceMode === 'tts') P.voiceMode = 'mine'; save(); }
  } catch (e) { if (!silent) stepStatus('err', tf('ht_err', (e && e.message) || e)); }
  if (!silent) { draw(); }
}

// ───────────────────────── отметки върху кадъра ─────────────────────────
function annEditorHTML() {
  return `<div class="ht-annot">
    <div class="ht-chips" data-ann="tools">${['arrow', 'circle', 'line'].map((k) => `<button class="ht-chip${annTool === k ? ' on' : ''}" data-tool="${k}">${esc(t('ht_ann_' + k))}</button>`).join('')}</div>
    <div class="ht-chips" style="margin-top:8px">${ANN_COLORS.map((c) => `<button class="ht-col${annColor === c ? ' on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
    <canvas class="ht-ecv"></canvas>
    <div class="hint">${esc(t('ht_ann_hint'))}</div>
    <div class="ht-tools"><button class="ht-mini" data-ae="undo">${esc(t('ht_undo'))}</button><button class="ht-mini" data-ae="clear">${esc(t('ht_clear'))}</button></div>
  </div>`;
}
async function setupAnnEditor(i) {
  const s = P.steps[i];
  const card = root.querySelector(`.ht-step[data-i="${i}"]`);
  if (!card) return;
  const box = card.querySelector('.ht-annot');
  const cv = card.querySelector('.ht-ecv');
  let m;
  try { m = await ensureMedia(s); } catch (e) { return; }
  if (m.isVideo) await seekVideo(m.el, Math.max(0, +s.clipFrom || 0));
  const w = Math.min(900, Math.max(240, Math.round((cv.clientWidth || 300) * (window.devicePixelRatio || 1))));
  const h = Math.max(1, Math.round(w * m.h / m.w));
  cv.width = w; cv.height = h;
  const base = document.createElement('canvas'); base.width = w; base.height = h;
  base.getContext('2d').drawImage(m.el, 0, 0, w, h);
  const ctx = cv.getContext('2d');
  const R = { x: 0, y: 0, w, h };
  let temp = null;
  const paint = () => {
    ctx.drawImage(base, 0, 0);
    (s.ann || []).forEach((a) => drawAnn(ctx, a, R, 1));
    if (temp) drawAnn(ctx, temp, R, 1);
  };
  paint();
  const pos = (ev) => { const r = cv.getBoundingClientRect(); return { x: clamp01((ev.clientX - r.left) / r.width), y: clamp01((ev.clientY - r.top) / r.height) }; };
  cv.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    const p = pos(ev);
    temp = { type: annTool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: annColor };
    paint();
  });
  cv.addEventListener('pointermove', (ev) => {
    if (!temp) return;
    const p = pos(ev);
    temp.x2 = p.x; temp.y2 = annTool === 'line' ? temp.y1 : p.y;
    paint();
  });
  const up = () => {
    if (!temp) return;
    const d = Math.hypot(temp.x2 - temp.x1, temp.y2 - temp.y1);
    if (d > 0.03) { s.ann = (s.ann || []).concat([temp]); save(); }
    temp = null; paint(); drawThumbs(); if (!pv) drawPoster();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  box.addEventListener('click', (ev) => {
    const tb = ev.target.closest('[data-tool]');
    const cb = ev.target.closest('[data-color]');
    const ab = ev.target.closest('[data-ae]');
    if (tb) { annTool = tb.getAttribute('data-tool'); box.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x === tb)); }
    if (cb) { annColor = cb.getAttribute('data-color'); box.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === cb)); }
    if (ab) {
      if (ab.getAttribute('data-ae') === 'undo') s.ann = (s.ann || []).slice(0, -1); else s.ann = [];
      save(); paint(); drawThumbs(); if (!pv) drawPoster();
    }
  });
}

// ───────────────────────── преглед ─────────────────────────
let posterTok = 0;
async function drawPoster() {
  const cv = $('#htStage'); if (!cv) return;
  const tok = ++posterTok;
  const [W, H] = SIZES[P.format] || SIZES.portrait;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  let mm = new Map(), thumbs = new Map();
  try { mm = await mediaAll(); thumbs = await prepareThumbs(P, mm, 240); } catch (e) {}
  if (tok !== posterTok || pv || !root) return;
  const tl = timeline(P);
  drawFrame(cv.getContext('2d'), W, H, P, tl, 1.9, mm, frameOpts(thumbs));
}
function stopPreview() {
  if (!pv) return;
  const p = pv; pv = null;
  p.stop();
  const b = $('#htPlay'); if (b) b.textContent = t('ht_play');
}
async function startPreview() {
  const st = $('#htStatus');
  if (!P.steps.length) { setStatus(st, 'err', t('ht_need_steps')); return; }
  const btn = $('#htPlay');
  const cv = $('#htStage');
  const [W, H] = SIZES[P.format] || SIZES.portrait;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  let mm, thumbs, buf = null;
  try {
    mm = await mediaAll();
    thumbs = await prepareThumbs(P, mm, 240);
    setStatus(st, 'work', t('ht_mixing'));
    buf = await mixAudio(P, P.music, P.voiceMode === 'mine');
    st.className = 'status';
  } catch (e) { setStatus(st, 'err', tf('ht_err', (e && e.message) || e)); return; }
  const tl = timeline(P);
  const o = frameOpts(thumbs);
  let ac = null, src = null, a0 = 0;
  const p0 = performance.now();
  if (buf) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC(); src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination);
      src.start(); a0 = ac.currentTime;
    } catch (e) { ac = null; }
  }
  const now = () => (ac ? ac.currentTime - a0 : (performance.now() - p0) / 1000);
  let lastSeg = null, playing = null;
  const state = {
    raf: 0,
    stop: () => {
      cancelAnimationFrame(state.raf);
      try { if (src) src.stop(); } catch (e) {}
      try { if (ac) ac.close(); } catch (e) {}
      try { if (playing) playing.pause(); } catch (e) {}
      stopSpeaking();
    }
  };
  pv = state;
  btn.textContent = t('ht_stop');
  const frame = () => {
    if (pv !== state) return;
    const tt = now();
    if (tt >= tl.total) { stopPreview(); drawPoster(); return; }
    const seg = segAt(tl, tt);
    if (seg !== lastSeg) {
      if (playing) { try { playing.pause(); } catch (e) {} playing = null; }
      if (seg.kind === 'step') {
        const s = P.steps[seg.i], m = mm.get(s.id);
        if (m && m.isVideo) { try { m.el.currentTime = clipTime(s, m, 0); m.el.play().catch(() => {}); playing = m.el; } catch (e) {} }
        if (P.voiceMode === 'tts' && s.caption) speak(s.caption, voiceCode());
      }
      lastSeg = seg;
    }
    drawFrame(ctx, W, H, P, tl, tt, mm, o);
    state.raf = requestAnimationFrame(frame);
  };
  state.raf = requestAnimationFrame(frame);
}
async function tryMusic() {
  if (!P.music || P.music === 'none') return;
  try {
    const buf = await synthMusic(P.music, 8);
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC(); const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start();
    src.onended = () => { try { ac.close(); } catch (e) {} };
  } catch (e) {}
}

// ───────────────────────── изнасяне ─────────────────────────
function fileBase() { return (String(P.title || 'howto').trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60)) || 'howto'; }
function busy(on) { root && root.querySelectorAll('[data-x], #htPlay').forEach((b) => { b.disabled = on; }); }
function showResult(kind, blob, extra) {
  const box = $('#htResult'); if (!box) return;
  if (resultUrl) { try { URL.revokeObjectURL(resultUrl); } catch (e) {} resultUrl = null; }
  let html = `<div class="hint">${esc(t('ht_result'))}: ${esc(fmtSize(blob.size))}${extra && extra.pages ? ' · PDF ' + extra.pages + ' A4' : ''}</div>`;
  if (kind === 'mp4') { resultUrl = URL.createObjectURL(blob); html += `<video controls playsinline src="${resultUrl}"></video>`; }
  else if (kind === 'gif' || kind === 'png') { resultUrl = URL.createObjectURL(blob); html += `<img alt="" src="${resultUrl}">`; }
  else if (extra && extra.preview) html += `<img alt="" src="${extra.preview}">`;
  box.innerHTML = html;
}
async function doExport(kind) {
  const st = $('#htStatus');
  if (!P.steps.length) { setStatus(st, 'err', t('ht_need_steps')); return; }
  stopPreview(); busy(true);
  const bw = $('#htBarW'), bar = $('#htBar');
  bw.style.display = ''; bar.style.width = '0%';
  try {
    const mm = await mediaAll();
    const [W, H] = SIZES[P.format] || SIZES.portrait;
    const base = fileBase();
    let blob, name, mime, extra = null;
    if (kind === 'mp4' || kind === 'gif') {
      const thumbs = await prepareThumbs(P, mm, 320);
      const o = Object.assign(frameOpts(thumbs), { W, H, fps: P.fps || 10, music: P.music, voice: P.voiceMode === 'mine' });
      setStatus(st, 'work', t('ht_engine'));
      const prog = (stage, p) => {
        const pct = Math.round(clamp01(p) * 100);
        if (stage === 'draw') { bar.style.width = Math.round(pct * 0.7) + '%'; setStatus(st, 'work', tf('ht_drawing', pct)); }
        else if (stage === 'audio') setStatus(st, 'work', t('ht_mixing'));
        else { bar.style.width = (70 + Math.round(pct * 0.3)) + '%'; setStatus(st, 'work', tf('ht_encoding', pct)); }
      };
      const out = kind === 'mp4' ? await exportMP4(P, mm, o, prog) : await exportGIF(P, mm, o, prog);
      mime = kind === 'mp4' ? 'video/mp4' : 'image/gif';
      blob = new Blob([out], { type: mime });
      name = base + '.' + kind;
    } else {
      setStatus(st, 'work', tf('ht_drawing', 0));
      const pages = await sheetPages(P, mm, frameOpts(null));
      bar.style.width = '60%';
      if (kind === 'pdf') {
        blob = new Blob([await makePDF(pages)], { type: 'application/pdf' }); mime = 'application/pdf'; name = base + '.pdf';
        extra = { pages: pages.length, preview: pages[0].toDataURL('image/jpeg', 0.8) };
      } else { blob = await sheetPNG(pages); mime = 'image/png'; name = base + '.png'; }
    }
    bar.style.width = '100%';
    showResult(kind, blob, extra);
    await saveFile(name, blob, mime);
    setStatus(st, 'ok', tf('ht_done', name, fmtSize(blob.size)));
  } catch (e) {
    setStatus(st, 'err', tf('ht_err', (e && e.message) || e));
  } finally { busy(false); }
}
