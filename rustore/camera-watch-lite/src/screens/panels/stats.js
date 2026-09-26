// Version: 1.0020
// panels/stats.js — таб „Статистика": колонна графика на платно (без библиотеки) —
// детекции по часове (последни 24 ч) или по дни (последни 7 дни), разбити на човек/животно/
// друго; общ брой, пик и износ на обобщението като CSV. Данните са от локалната хронология.

import { el, clear, toast } from '../../ui/dom.js';
import { loadEvents } from '../../core/storage.js';
import { exportText } from '../../core/export.js';
import { t, tf } from '../../core/i18n.js';

const COLORS = { person: '#ff5c7a', animal: '#ffcf5c', other: '#5c9dff' };
const DAY = 86400000;

function cat(ev) { return ev.category === 'person' ? 'person' : (ev.category === 'animal' ? 'animal' : 'other'); }

// Кофи за периода: { label, person, animal, other }.
function buckets(events, mode) {
  const now = Date.now();
  const out = [];
  if (mode === 'hour') {
    const start = new Date(now); start.setMinutes(0, 0, 0);
    const startTs = start.getTime() - 23 * 3600000;
    for (let i = 0; i < 24; i++) {
      const d = new Date(startTs + i * 3600000);
      out.push({ label: String(d.getHours()).padStart(2, '0'), ts: d.getTime(), person: 0, animal: 0, other: 0 });
    }
    for (const ev of events) {
      const i = Math.floor((ev.ts - startTs) / 3600000);
      if (i >= 0 && i < 24) out[i][cat(ev)]++;
    }
  } else {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const startTs = today.getTime() - 6 * DAY;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startTs + i * DAY);
      out.push({ label: String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0'), ts: d.getTime(), person: 0, animal: 0, other: 0 });
    }
    for (const ev of events) {
      const d = new Date(ev.ts); d.setHours(0, 0, 0, 0);
      const i = Math.round((d.getTime() - startTs) / DAY);
      if (i >= 0 && i < 7) out[i][cat(ev)]++;
    }
  }
  return out;
}

export function buildStatsPanel() {
  let mode = 'hour';
  let events = [];
  let data = [];

  const canvas = el('canvas', { class: 'chart' });
  const chips = el('div', { class: 'chips' });
  const totalEl = el('p', { class: 'muted' });

  function renderChips() {
    clear(chips);
    for (const m of ['hour', 'day']) {
      chips.appendChild(el('button', { class: 'chip' + (m === mode ? ' cur' : ''), onclick: () => { mode = m; compute(); } }, t(m === 'hour' ? 'stt_by_hour' : 'stt_by_day')));
    }
  }

  function draw() {
    const W = canvas.clientWidth || 320, H = canvas.clientHeight || 190;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const padL = 28, padR = 8, padT = 10, padB = 24;
    const cw = W - padL - padR, chh = H - padT - padB;
    const max = Math.max(1, ...data.map((b) => b.person + b.animal + b.other));
    // хоризонтални линии + стойности
    c.font = '11px system-ui, sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle';
    const steps = Math.min(4, max);
    for (let i = 0; i <= steps; i++) {
      const v = Math.round(max * i / steps);
      const y = padT + chh - chh * (v / max);
      c.strokeStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(padL, y); c.lineTo(W - padR, y); c.stroke();
      c.fillStyle = '#9aa6c4'; c.fillText(String(v), padL - 5, y);
    }
    // колони
    const n = data.length, gap = 3, bw = Math.max(2, (cw - gap * (n - 1)) / n);
    c.textAlign = 'center'; c.textBaseline = 'top';
    data.forEach((b, i) => {
      const x = padL + i * (bw + gap);
      let y = padT + chh;
      for (const k of ['other', 'animal', 'person']) {
        if (!b[k]) continue;
        const h = chh * (b[k] / max);
        c.fillStyle = COLORS[k]; c.fillRect(x, y - h, bw, h);
        y -= h;
      }
      const every = mode === 'hour' ? 3 : 1;
      if (i % every === 0) { c.fillStyle = '#9aa6c4'; c.fillText(b.label, x + bw / 2, padT + chh + 6); }
    });
  }

  function compute() {
    data = buckets(events, mode);
    renderChips();
    const total = data.reduce((a, b) => a + b.person + b.animal + b.other, 0);
    if (!total) { totalEl.textContent = t('stt_empty'); }
    else {
      let peak = data[0];
      for (const b of data) if (b.person + b.animal + b.other > peak.person + peak.animal + peak.other) peak = b;
      totalEl.textContent = tf('stt_total', total) + ' · ' + tf('stt_peak', peak.label + (mode === 'hour' ? ':00' : '') + ' (' + (peak.person + peak.animal + peak.other) + ')');
    }
    draw();
  }

  async function exportCsv() {
    const total = data.reduce((a, b) => a + b.person + b.animal + b.other, 0);
    if (!total) { toast(t('export_none')); return; }
    const rows = [[t('csv_time'), t('cls_person'), t('cls_animal'), t('cls_motion'), t('csv_count')].join(',')];
    for (const b of data) rows.push([new Date(b.ts).toISOString(), b.person, b.animal, b.other, b.person + b.animal + b.other].join(','));
    const r = await exportText('motionhawk-stats-' + mode + '.csv', rows.join('\n'), 'text/csv');
    if (r.ok) toast(r.how === 'copied' ? t('export_copied') : t('export_shared'));
  }

  const node = el('div', {}, [
    el('p', { class: 'muted', text: t('stt_intro') }),
    chips,
    canvas,
    el('div', { class: 'legend', style: 'margin-top:8px' }, [
      el('span', {}, [el('i', { style: 'background:' + COLORS.person }), t('cls_person')]),
      el('span', {}, [el('i', { style: 'background:' + COLORS.animal }), t('cls_animal')]),
      el('span', {}, [el('i', { style: 'background:' + COLORS.other }), t('cls_motion')])
    ]),
    totalEl,
    el('div', { class: 'row' }, [el('button', { class: 'btn ghost', onclick: exportCsv }, t('tl_export'))])
  ]);

  async function refresh() { events = await loadEvents(); compute(); }
  function add(ev) { events.unshift(ev); compute(); }

  renderChips();
  return { node, refresh, add, redraw: draw };
}
