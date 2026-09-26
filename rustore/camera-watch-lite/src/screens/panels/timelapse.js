// Version: 1.0020
// panels/timelapse.js — таб „Таймлапс": докато е на пост, таблото подава малък кадър на всеки
// N секунди (addLapseFrame). Тук: избор на интервал, лента с миниатюри, плейър на платно с
// избор на скорост, и GIF (собствен кодер, виж core/gif.js). Нищо не напуска устройството.

import { el, clear, toast } from '../../ui/dom.js';
import { loadLapse, clearLapse, MAX_LAPSE } from '../../core/storage.js';
import { encodeGif } from '../../core/gif.js';
import { exportBytes } from '../../core/export.js';
import { t, tf } from '../../core/i18n.js';

const INTERVALS = [0, 5, 10, 30, 60, 120];
const FPS = [2, 5, 10];

function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function buildLapsePanel({ s, persist }) {
  let frames = [];
  let idx = 0;
  let fps = 5;
  let timer = null;
  let gifBytes = null;
  const imgCache = new Map(); // ts → Image

  const player = el('canvas', { class: 'player' });
  player.width = 320; player.height = 240;
  const strip = el('div', { class: 'strip' });
  const countEl = el('span', { class: 'pill' });
  const emptyEl = el('p', { class: 'muted', text: t('lp_empty') });
  const playBtn = el('button', { class: 'btn ghost' });
  const gifBtn = el('button', { class: 'btn ghost' }, t('lp_gif'));
  const gifWrap = el('div', {});

  const intervalSel = el('select', { class: 'small-select', onchange: (e) => { s.lapseSec = parseInt(e.target.value, 10) || 0; persist(); } },
    INTERVALS.map((v) => el('option', { value: String(v), text: v ? tf('cfg_seconds', v) : t('lp_off'), selected: (s.lapseSec | 0) === v })));
  const fpsSel = el('select', { class: 'small-select', onchange: (e) => { fps = parseInt(e.target.value, 10) || 5; if (timer) { stop(); play(); } } },
    FPS.map((v) => el('option', { value: String(v), text: tf('lp_fps', v), selected: v === fps })));

  async function getImage(f) {
    if (imgCache.has(f.ts)) return imgCache.get(f.ts);
    const im = await loadImage(f.img);
    if (im) imgCache.set(f.ts, im);
    return im;
  }

  async function drawFrame(i) {
    if (!frames.length) { player.getContext('2d').clearRect(0, 0, player.width, player.height); return; }
    idx = ((i % frames.length) + frames.length) % frames.length;
    const im = await getImage(frames[idx]);
    const c = player.getContext('2d');
    c.fillStyle = '#05080f'; c.fillRect(0, 0, player.width, player.height);
    if (im) {
      const sc = Math.min(player.width / im.width, player.height / im.height);
      const w = im.width * sc, h = im.height * sc;
      c.drawImage(im, (player.width - w) / 2, (player.height - h) / 2, w, h);
    }
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, player.height - 22, player.width, 22);
    c.fillStyle = '#e8ecf5'; c.font = '13px system-ui, sans-serif';
    c.fillText(new Date(frames[idx].ts).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '  ' + (idx + 1) + '/' + frames.length, 8, player.height - 7);
    for (const ch of strip.children) ch.classList.toggle('cur', parseInt(ch.dataset.i, 10) === idx);
  }

  function play() {
    if (!frames.length) return;
    timer = setInterval(() => drawFrame(idx + 1), Math.round(1000 / fps));
    playBtn.textContent = t('lp_pause');
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    playBtn.textContent = t('lp_play');
  }
  playBtn.addEventListener('click', () => { if (timer) stop(); else play(); });

  function thumb(f, i) {
    return el('img', { src: f.img, alt: '', 'data-i': String(i), onclick: () => { stop(); drawFrame(i); } });
  }

  function renderStrip() {
    clear(strip);
    frames.forEach((f, i) => strip.appendChild(thumb(f, i)));
    countEl.textContent = tf('lp_frames', frames.length);
    emptyEl.style.display = frames.length ? 'none' : '';
    playBtn.disabled = gifBtn.disabled = !frames.length;
  }

  async function makeGif() {
    if (!frames.length) return;
    gifBtn.disabled = true; gifBtn.textContent = t('lp_gif_working');
    clear(gifWrap);
    try {
      const first = await getImage(frames[0]);
      const w = first ? first.width : 160, h = first ? first.height : 120;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const cx = c.getContext('2d', { willReadFrequently: true });
      const out = [];
      for (const f of frames) {
        const im = await getImage(f);
        if (!im) continue;
        cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h);
        cx.drawImage(im, 0, 0, w, h);
        out.push({ data: cx.getImageData(0, 0, w, h).data, w, h });
      }
      gifBytes = encodeGif(out, { delayMs: Math.round(1000 / fps) });
      const kb = Math.max(1, Math.round(gifBytes.length / 1024));
      const url = 'data:image/gif;base64,' + bytesToBase64(gifBytes);
      gifWrap.appendChild(el('p', { class: 'muted', text: tf('lp_gif_ready', kb) }));
      gifWrap.appendChild(el('img', { src: url, alt: 'GIF', style: 'width:100%;border-radius:12px;background:#05080f' }));
      gifWrap.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [
        el('button', { class: 'btn grow', onclick: async () => {
          const r = await exportBytes('motionhawk-timelapse.gif', gifBytes, 'image/gif');
          if (r.ok) toast(t('export_shared'));
        } }, t('lp_save'))
      ]));
    } catch (_) {
      gifBytes = null;
    } finally {
      gifBtn.disabled = false; gifBtn.textContent = t('lp_gif');
    }
  }
  gifBtn.addEventListener('click', makeGif);

  const node = el('div', {}, [
    el('p', { class: 'muted', text: tf('lp_intro', MAX_LAPSE) }),
    el('div', { class: 'row between' }, [
      el('div', { class: 'row', style: 'gap:8px' }, [el('span', {}, t('lp_interval')), intervalSel]),
      countEl
    ]),
    emptyEl,
    player,
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      playBtn,
      el('span', {}, t('lp_speed')), fpsSel,
      gifBtn,
      el('button', { class: 'btn ghost', onclick: async () => { stop(); await clearLapse(); frames = []; imgCache.clear(); gifBytes = null; clear(gifWrap); renderStrip(); drawFrame(0); } }, t('lp_clear'))
    ]),
    strip,
    gifWrap
  ]);

  async function refresh() {
    frames = await loadLapse();
    renderStrip();
    drawFrame(frames.length - 1);
  }
  // Нов кадър от таблото (докато е на пост).
  function onFrame(f) {
    frames.push(f);
    if (frames.length > MAX_LAPSE) { const dropped = frames.splice(0, frames.length - MAX_LAPSE); for (const d of dropped) imgCache.delete(d.ts); renderStrip(); }
    else { strip.appendChild(thumb(f, frames.length - 1)); countEl.textContent = tf('lp_frames', frames.length); emptyEl.style.display = 'none'; playBtn.disabled = gifBtn.disabled = false; }
    if (!timer) drawFrame(frames.length - 1);
  }

  renderStrip();
  return { node, refresh, onFrame, stop };
}
