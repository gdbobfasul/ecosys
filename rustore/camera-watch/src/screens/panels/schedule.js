// Version: 1.0020
// panels/schedule.js — таб „График": режим за всеки час от денонощието.
//   0 = нормален, 1 = тих (движението се записва, но без аларми), 2 = чувствителен (прагът
//   на чувствителност е наполовина → реагира и на по-малко движение). Пази се в настройките.

import { el, clear } from '../../ui/dom.js';
import { scheduleMode } from '../../core/storage.js';
import { t, tf } from '../../core/i18n.js';

export function modeLabel(m) { return m === 1 ? t('mode_quiet') : (m === 2 ? t('mode_sensitive') : t('mode_normal')); }

export function buildSchedulePanel({ s, persist }) {
  if (!Array.isArray(s.schedule) || s.schedule.length !== 24) {
    const base = Array.isArray(s.schedule) ? s.schedule : [];
    s.schedule = Array.from({ length: 24 }, (_, i) => (base[i] === 1 || base[i] === 2) ? base[i] : 0);
  }

  const grid = el('div', { class: 'hours' });
  const nowEl = el('p', { class: 'muted' });

  function render() {
    clear(grid);
    const h = new Date().getHours();
    for (let i = 0; i < 24; i++) {
      const m = scheduleMode(s, i);
      grid.appendChild(el('button', {
        class: 'hour m' + m + (i === h ? ' now' : ''),
        onclick: () => { s.schedule[i] = (m + 1) % 3; persist(); render(); }
      }, String(i).padStart(2, '0')));
    }
    nowEl.textContent = tf('sc_now', String(h).padStart(2, '0'), modeLabel(scheduleMode(s, h)));
  }

  function setRange(from, to, mode) {
    for (let i = 0; i < 24; i++) {
      const inRange = from <= to ? (i >= from && i < to) : (i >= from || i < to);
      if (inRange) s.schedule[i] = mode;
    }
    persist(); render();
  }

  const node = el('div', {}, [
    el('p', { class: 'muted', text: t('sc_intro') }),
    el('div', { class: 'legend' }, [
      el('span', {}, [el('i', { style: 'background:#0e1426;border:1px solid #2a385e' }), t('mode_normal')]),
      el('span', {}, [el('i', { style: 'background:#2a2f4a' }), t('mode_quiet')]),
      el('span', {}, [el('i', { style: 'background:#4a1f2b' }), t('mode_sensitive')])
    ]),
    nowEl,
    grid,
    el('div', { class: 'row', style: 'gap:8px' }, [
      el('button', { class: 'btn ghost', onclick: () => { s.schedule = Array(24).fill(0); persist(); render(); } }, t('sc_reset')),
      el('button', { class: 'btn ghost', onclick: () => setRange(23, 6, 1) }, t('sc_night')),
      el('button', { class: 'btn ghost', onclick: () => setRange(23, 6, 2) }, t('sc_night_sens'))
    ])
  ]);

  render();
  return { node, refresh: render };
}
