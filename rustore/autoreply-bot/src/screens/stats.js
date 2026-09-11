// Version: 1.0020
// stats.js — екран „Статистика": брой авто-отговори по дни (графика на платно),
// по канал, по правило, най-чести податели + износ на дневника като CSV.
// Всичко се смята от локалния дневник (state.log) — нищо не се тегли от мрежата.
import { el, toast } from '../ui/dom.js';
import { getState } from '../core/storage.js';
import { t, getLang } from '../core/i18n.js';

const DAYS = 14;

export function StatsScreen() {
  const s = getState();
  const log = s.log || [];
  const root = el('div', {});

  root.appendChild(el('div', { class: 'brand' }, [
    el('div', { class: 'logo' }, '📊'),
    el('h1', {}, t('stats_title'))
  ]));
  root.appendChild(el('p', { class: 'muted' }, t('stats_intro')));

  if (log.length === 0) {
    root.appendChild(el('div', { class: 'card' }, [el('div', { class: 'empty' }, t('stats_empty'))]));
    return root;
  }

  // --- Обобщение: днес / 7 дни / общо ---
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start7 = startToday - 6 * 86400000;
  const today = log.filter((e) => e.at >= startToday).length;
  const week = log.filter((e) => e.at >= start7).length;
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'stat-row' }, [
      statTile(today, t('stats_today')),
      statTile(week, t('stats_7d')),
      statTile(log.length, t('stats_total'))
    ])
  ]));

  // --- По дни (платно) ---
  const perDay = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const dayStart = startToday - i * 86400000;
    const d = new Date(dayStart);
    perDay.push({
      label: d.toLocaleDateString(getLang(), { day: '2-digit', month: '2-digit' }),
      count: log.filter((e) => e.at >= dayStart && e.at < dayStart + 86400000).length
    });
  }
  const canvas = el('canvas', { class: 'chart', width: '520', height: '180' });
  root.appendChild(el('div', { class: 'card' }, [el('h2', {}, t('stats_by_day')), canvas]));
  // Рисуваме след като елементът е в документа (за да знаем реалната ширина).
  setTimeout(() => drawBars(canvas, perDay), 0);

  // --- По канал ---
  root.appendChild(breakdownCard(t('stats_by_channel'), countBy(log, (e) => channelLabel(e.channel))));

  // --- По правило ---
  const ruleName = (e) => {
    if (e.mode === 'away' || e.ruleId === '__away__') return t('log_mode_away');
    if (e.mode === 'vacation') return t('log_mode_vacation');
    if (e.mode === 'group') {
      const gid = String(e.ruleId || '').replace('__group__:', '');
      const g = (s.groups || []).find((x) => x.id === gid);
      return `${t('log_mode_group')}: ${g ? g.name : gid}`;
    }
    const r = (s.rules || []).find((x) => x.id === e.ruleId);
    return r ? r.name : t('log_mode_rule');
  };
  root.appendChild(breakdownCard(t('stats_by_rule'), countBy(log, ruleName)));

  // --- Най-чести податели ---
  root.appendChild(breakdownCard(t('stats_by_sender'), countBy(log, (e) => e.sender || t('sender_unknown')).slice(0, 8)));

  // --- Износ CSV ---
  const exportBtn = el('button', { class: 'btn primary full' }, t('stats_export'));
  exportBtn.addEventListener('click', () => exportCsv(log, ruleName));
  root.appendChild(el('div', { class: 'card' }, [exportBtn]));

  return root;
}

function statTile(num, label) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat-num' }, String(num)),
    el('div', { class: 'muted' }, label)
  ]);
}

// Брои елементите по ключ; връща [{ label, count }] сортирано по брой.
function countBy(list, keyFn) {
  const map = new Map();
  for (const e of list) {
    const k = keyFn(e);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function breakdownCard(title, rows) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return el('div', { class: 'card' }, [
    el('h2', {}, title),
    ...rows.map((r) => el('div', { class: 'logrow' }, [
      el('div', { class: 'row between' }, [el('span', {}, r.label), el('strong', {}, String(r.count))]),
      el('div', { class: 'bar' }, [el('div', { class: 'bar-fill', style: `width:${Math.round(r.count / max * 100)}%` })])
    ]))
  ]);
}

function channelLabel(id) {
  return ({ pupikes: t('ch_pupikes_name'), whatsapp: 'WhatsApp', viber: 'Viber', messenger: 'Messenger', local: t('tab_demo') })[id] || id || t('tab_demo');
}

// Стълбова графика на платно (canvas) в цветовете на темата.
function drawBars(canvas, data) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cssW = canvas.clientWidth || 520;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(180 * dpr);
  ctx.scale(dpr, dpr);
  const W = cssW, H = 180;
  const padL = 24, padR = 6, padT = 10, padB = 26;
  const max = Math.max(1, ...data.map((d) => d.count));
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim() || '#16b364';
  const muted = styles.getPropertyValue('--muted').trim() || '#93a0c0';

  ctx.clearRect(0, 0, W, H);
  // Хоризонтални водещи линии + скала
  ctx.strokeStyle = '#ffffff14';
  ctx.fillStyle = muted;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 2; i++) {
    const y = padT + (H - padT - padB) * (1 - i / 2);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillText(String(Math.round(max * i / 2)), padL - 4, y + 3);
  }
  // Стълбове
  const n = data.length;
  const slot = (W - padL - padR) / n;
  const bw = Math.max(4, slot * 0.6);
  ctx.textAlign = 'center';
  data.forEach((d, i) => {
    const x = padL + i * slot + (slot - bw) / 2;
    const h = (H - padT - padB) * (d.count / max);
    const y = H - padB - h;
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, bw, h);
    if (d.count > 0) {
      ctx.fillStyle = '#e8ecf6';
      ctx.fillText(String(d.count), x + bw / 2, y - 3);
    }
    if (i % 2 === (n - 1) % 2) {
      ctx.fillStyle = muted;
      ctx.fillText(d.label, x + bw / 2, H - padB + 14);
    }
  });
}

// Износ на дневника като CSV: споделяне (ако устройството може) → сваляне → клипборд.
async function exportCsv(log, ruleName) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
  const head = [t('stats_col_time'), t('stats_col_channel'), t('demo_sender'), t('demo_message'), t('stats_col_reply'), t('stats_col_mode'), t('stats_col_rule')];
  const lines = [head.map(q).join(',')];
  for (const e of log) {
    lines.push([
      new Date(e.at).toISOString(), channelLabel(e.channel), e.sender, e.incoming, e.reply,
      modeLabel(e.mode), ruleName(e)
    ].map(q).join(','));
  }
  const csv = '﻿' + lines.join('\r\n');
  const name = 'auto-answer-log-' + new Date().toISOString().slice(0, 10) + '.csv';

  try {
    if (typeof File !== 'undefined' && navigator.share && navigator.canShare) {
      const file = new File([csv], name, { type: 'text/csv' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        toast(t('stats_export_shared'));
        return;
      }
    }
  } catch (_) { /* потребителят е отказал или няма споделяне → следващ вариант */ }

  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
    toast(t('stats_export_shared'));
    return;
  } catch (_) { /* следващ вариант */ }

  try {
    await navigator.clipboard.writeText(csv);
    toast(t('stats_export_copied'));
  } catch (_) {
    toast(t('stats_export_fail'));
  }
}

function modeLabel(mode) {
  return ({ away: t('log_mode_away'), vacation: t('log_mode_vacation'), group: t('log_mode_group') })[mode] || t('log_mode_rule');
}
