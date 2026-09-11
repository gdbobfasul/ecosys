// Version: 1.0020
// panels/timeline.js — таб „Хронология": всяко засичане с миниатюра, час, сила на движението
// и увереност на разпознаването; филтър по категория; преглед на кадъра на цял екран;
// износ на дневника като CSV. Всичко от локалното хранилище.

import { el, clear, fmtTime, toast } from '../../ui/dom.js';
import { loadEvents, clearEvents } from '../../core/storage.js';
import { exportText } from '../../core/export.js';
import { t, tf } from '../../core/i18n.js';

const FILTERS = ['all', 'person', 'animal', 'other'];
const STRENGTH_FULL = 0.2; // 20% променени пиксели = пълна лента

function pctStrength(ev) { return Math.round(Math.min(1, (ev.ratio || 0) / STRENGTH_FULL) * 100); }
function inFilter(ev, f) {
  if (f === 'all') return true;
  if (f === 'other') return ev.category !== 'person' && ev.category !== 'animal';
  return ev.category === f;
}
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function filterLabel(f) {
  if (f === 'all') return t('tl_all');
  if (f === 'person') return t('cls_person');
  if (f === 'animal') return t('cls_animal');
  return t('cls_motion');
}

export function buildTimelinePanel() {
  let filter = 'all';
  let events = [];

  const chips = el('div', { class: 'chips' });
  const list = el('div', {});

  function renderChips() {
    clear(chips);
    for (const f of FILTERS) {
      chips.appendChild(el('button', {
        class: 'chip' + (f === filter ? ' cur' : ''),
        onclick: () => { filter = f; renderChips(); renderList(); }
      }, filterLabel(f)));
    }
  }

  function item(ev) {
    const img = ev.thumb
      ? el('img', { src: ev.thumb, alt: ev.label })
      : el('div', { style: 'width:56px;height:42px;border-radius:8px;background:#05080f;flex:0 0 auto' });
    const strength = pctStrength(ev);
    const labelTxt = (ev.silent ? '🔕 ' : '') + capitalize(ev.label) + (ev.score ? '  ' + Math.round(ev.score * 100) + '%' : '');
    return el('div', { class: 'log-item tap', onclick: () => preview(ev) }, [
      img,
      el('div', { class: 'meta' }, [
        el('div', { class: 'label', text: labelTxt }),
        el('div', { class: 'time', text: fmtTime(ev.ts) + ' · ' + tf('tl_strength', strength) }),
        el('div', { class: 'strength' }, [el('i', { style: 'width:' + strength + '%' })])
      ])
    ]);
  }

  function renderList() {
    clear(list);
    const shown = events.filter((e) => inFilter(e, filter));
    if (!shown.length) { list.appendChild(el('p', { class: 'muted', text: t('dash_no_events') })); return; }
    for (const ev of shown) list.appendChild(item(ev));
  }

  function preview(ev) {
    const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } });
    const details = [
      fmtTime(ev.ts),
      tf('tl_strength', pctStrength(ev)),
      ev.score ? tf('tl_score', Math.round(ev.score * 100)) : null,
      ev.silent ? t('tl_silent') : null
    ].filter(Boolean).join(' · ');
    bg.appendChild(el('div', { class: 'modal' }, [
      el('h2', { text: capitalize(ev.label), style: 'margin-top:0' }),
      ev.thumb ? el('img', { src: ev.thumb, alt: ev.label }) : null,
      el('p', { class: 'muted', text: details }),
      el('div', { class: 'row' }, [el('button', { class: 'btn grow', onclick: () => bg.remove() }, t('tl_close'))])
    ]));
    document.body.appendChild(bg);
  }

  function csvText() {
    const head = [t('csv_time'), t('csv_type'), t('csv_label'), t('csv_score'), t('csv_strength'), t('csv_silent')];
    const rows = [head.join(',')];
    for (const ev of events.slice().reverse()) {
      rows.push([
        new Date(ev.ts).toISOString(), ev.category || '', ev.label || '',
        ev.score ? Math.round(ev.score * 100) : 0, Math.round((ev.ratio || 0) * 1000) / 10, ev.silent ? 1 : 0
      ].map(csvCell).join(','));
    }
    return rows.join('\n');
  }

  function showCopied(text) {
    const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } });
    const ta = el('textarea', { readonly: true });
    ta.value = text;
    bg.appendChild(el('div', { class: 'modal' }, [
      el('p', { class: 'muted', text: t('export_copied'), style: 'margin-top:0' }),
      ta,
      el('div', { class: 'row', style: 'margin-top:8px' }, [el('button', { class: 'btn grow', onclick: () => bg.remove() }, t('tl_close'))])
    ]));
    document.body.appendChild(bg);
    try { ta.select(); } catch (_) {}
  }

  async function exportCsv() {
    if (!events.length) { toast(t('export_none')); return; }
    const text = csvText();
    const d = new Date();
    const name = 'motionhawk-log-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.csv';
    const r = await exportText(name, text, 'text/csv');
    if (r.how === 'copied') showCopied(text);
    else if (r.ok) toast(t('export_shared'));
  }

  const node = el('div', {}, [
    el('p', { class: 'muted', text: t('tl_intro') }),
    chips,
    el('div', { class: 'row', style: 'gap:8px;margin-bottom:6px' }, [
      el('button', { class: 'btn ghost', onclick: exportCsv }, t('tl_export')),
      el('button', { class: 'btn ghost', onclick: async () => { await clearEvents(); events = []; renderList(); } }, t('dash_clear'))
    ]),
    list
  ]);

  async function refresh() { events = await loadEvents(); renderChips(); renderList(); }
  function prepend(ev) { events.unshift(ev); renderList(); }

  renderChips();
  return { node, refresh, prepend };
}

function capitalize(str) { return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1); }
