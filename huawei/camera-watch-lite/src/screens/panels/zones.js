// Version: 1.0020
// panels/zones.js — таб „Зони": мрежа GRID_COLS×GRID_ROWS клетки върху живия кадър; докосната
// клетка се изключва (движение там не се брои). Маската е низ '0'/'1' в настройките и
// се подава на детектора при всеки кадър. Рисува се върху прозрачен canvas в сцената.

import { el } from '../../ui/dom.js';
import { GRID_COLS, GRID_ROWS, GRID_CELLS, maskActive } from '../../core/motion-detector.js';
import { t, tf } from '../../core/i18n.js';

export function buildZonesPanel({ s, persist, stage, zoneCanvas, activeSourceEl, isArmed }) {
  let editing = false;
  if (typeof s.zoneMask !== 'string' || s.zoneMask.length !== GRID_CELLS) s.zoneMask = '0'.repeat(GRID_CELLS);

  const countEl = el('p', { class: 'muted' });
  const hintEl = el('p', { class: 'muted' });
  const editBtn = el('button', { class: 'btn' });

  function excludedCount() { let n = 0; for (let i = 0; i < s.zoneMask.length; i++) if (s.zoneMask[i] === '1') n++; return n; }

  // Правоъгълникът, в който реално се показва кадърът (object-fit: contain → може да има ленти).
  function rect() {
    const W = stage.clientWidth, H = stage.clientHeight;
    let natW = 0, natH = 0;
    try { const src = activeSourceEl(); natW = src.videoWidth || src.naturalWidth || 0; natH = src.videoHeight || src.naturalHeight || 0; } catch (_) {}
    if (!natW || !natH) return { x: 0, y: 0, w: W, h: H };
    const sc = Math.min(W / natW, H / natH);
    const w = natW * sc, h = natH * sc;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }

  function draw() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    zoneCanvas.width = Math.round(W * dpr); zoneCanvas.height = Math.round(H * dpr);
    const c = zoneCanvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const active = maskActive(s.zoneMask);
    if (!editing && !active) return;
    const r = rect();
    const cw = r.w / GRID_COLS, ch = r.h / GRID_ROWS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = r.x + col * cw, y = r.y + row * ch;
        if (s.zoneMask[row * GRID_COLS + col] === '1') {
          c.fillStyle = editing ? 'rgba(255,60,90,.45)' : 'rgba(255,60,90,.28)';
          c.fillRect(x, y, cw, ch);
          c.strokeStyle = 'rgba(255,120,150,.8)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + cw - 3, y + ch - 3); c.moveTo(x + cw - 3, y + 3); c.lineTo(x + 3, y + ch - 3); c.stroke();
        }
        if (editing) { c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1); }
      }
    }
  }

  function updateText() {
    countEl.textContent = tf('zn_count', excludedCount(), GRID_CELLS);
    hintEl.textContent = editing ? (isArmed() ? t('zn_tap') : t('zn_need_cam') + ' ' + t('zn_tap')) : '';
    editBtn.textContent = editing ? t('zn_done') : t('zn_edit');
    editBtn.className = editing ? 'btn' : 'btn ghost';
    zoneCanvas.classList.toggle('editing', editing);
  }

  function setEditing(v) { editing = !!v; updateText(); draw(); }

  zoneCanvas.addEventListener('click', (e) => {
    if (!editing) return;
    const b = zoneCanvas.getBoundingClientRect();
    const px = e.clientX - b.left, py = e.clientY - b.top;
    const r = rect();
    const col = Math.floor((px - r.x) / (r.w / GRID_COLS)), row = Math.floor((py - r.y) / (r.h / GRID_ROWS));
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    const i = row * GRID_COLS + col;
    const arr = s.zoneMask.split('');
    arr[i] = arr[i] === '1' ? '0' : '1';
    s.zoneMask = arr.join('');
    persist();
    updateText(); draw();
  });

  editBtn.addEventListener('click', () => setEditing(!editing));

  const node = el('div', {}, [
    el('p', { class: 'muted', text: t('zn_intro') }),
    el('div', { class: 'row', style: 'gap:8px' }, [
      editBtn,
      el('button', { class: 'btn ghost', onclick: () => { s.zoneMask = '0'.repeat(GRID_CELLS); persist(); updateText(); draw(); } }, t('zn_all'))
    ]),
    countEl,
    hintEl
  ]);

  updateText();
  return { node, draw, setEditing, refresh: () => { updateText(); draw(); } };
}
