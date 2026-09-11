// Version: 1.0027
// care.js — таб „Грижа": шест под-таба, всичко на устройството (без мрежа):
//   • Шум — график на нивото на звука от микрофона (платно) с маркери за шум и събития;
//   • Звуци — приспивни звуци с WebAudio (дъжд, море, вентилатор, сърце, мелодия) + таймер;
//   • Лампа — нощна лампа (екранът в мек цвят, яркост, цвят);
//   • Отчет — дневник хранене/сън/пелени + дневен отчет с обобщение и споделяне като текст;
//   • Растеж — тегло/ръст спрямо ориентировъчния СЗО коридор (вградена таблица) + графика;
//   • Ваксини — типична схема по възраст с отметка „направена".
import { el, clear, toast } from '../ui/dom.js';
import { getState, getCare, setCare, addDiary, removeDiary, addGrowth, removeGrowth, setVaccineDone } from '../core/storage.js';
import { startMeter, stopMeter, micSupported } from '../core/noise-meter.js';
import { playSound, stopSound, currentSound, getVolume, setVolume, timerLeft, onSoundChange, soundSupported } from '../core/sounds.js';
import { whoAt, whoBand, ageMonths, WHO_MAX_MONTHS, VACCINES } from '../core/baby-data.js';
import { typeLabel } from '../core/events.js';
import { t, getLang } from '../core/i18n.js';

const SUBS = ['noise', 'sounds', 'light', 'report', 'growth', 'vax'];
let _sub = 'noise';
let _cleanup = [];      // функции за спиране при напускане на екрана
let _light = null;      // елементът на нощната лампа (ако е отворена)
let _meterFn = null;    // слушателят на шумомера от графика (за да махнем само него)

export function teardownCare() {
  for (const fn of _cleanup) { try { fn(); } catch (_) {} }
  _cleanup = [];
  if (_meterFn) { stopMeter(_meterFn); _meterFn = null; } // само слушателят на графика; детегледачката продължава да слуша
  closeLight();
}

export function renderCare(root, ctx) {
  teardownCare();
  root.appendChild(el('h1', {}, t('nav_care')));

  const chips = el('div', { class: 'chips' }, SUBS.map((s) =>
    el('button', { class: 'chip' + (s === _sub ? ' active' : ''), onclick: () => { _sub = s; ctx.rerender(); } }, t('care_tab_' + s))
  ));
  root.appendChild(chips);

  const body = el('div', {});
  root.appendChild(body);
  const R = { noise: renderNoise, sounds: renderSounds, light: renderLight, report: renderReport, growth: renderGrowth, vax: renderVax };
  R[_sub](body, ctx);
}

// ---------------------------------------------------------------- помощни
function fmtDate(iso) { try { return new Date(iso).toLocaleDateString(getLang()); } catch (_) { return iso; } }
function fmtTime(ms) { try { return new Date(ms).toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } }
function isoDay(d) { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
function dayBounds(offsetDays) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - offsetDays);
  return { from: d.getTime(), to: d.getTime() + 86400000, date: d };
}
function fmtDur(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return (h ? h + ' ' + t('rep_hours_short') + ' ' : '') + m + ' ' + t('rep_min_short');
}
function optionEl(value, label, current) {
  const o = el('option', { value }, label);
  if (value === current) o.setAttribute('selected', '');
  return o;
}
// Платно с реални пиксели по ширината на елемента (за ясна графика).
function fitCanvas(cv) {
  const w = cv.clientWidth || 320, h = cv.clientHeight || 150;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

// ---------------------------------------------------------------- 1) Шум
function renderNoise(root) {
  const samples = [];          // {t, level}
  const marks = [];            // {t, kind: 'loud'|'event', label}
  const MAX = 240;             // 2 минути при 0.5 с
  let threshold = 60;
  let lastLoud = 0;
  let peaks = 0;
  let seenEvents = getState().events.length;

  const levelEl = el('span', { class: 'pill' }, '—');
  const peaksEl = el('span', { class: 'pill' }, t('noise_peaks') + ': 0');
  const canvas = el('canvas', { class: 'chart' });
  const startBtn = el('button', { class: 'btn' }, t('noise_start'));
  const stopBtn = el('button', { class: 'btn secondary', disabled: true }, t('noise_stop'));
  const thrVal = el('span', { class: 'pill' }, String(threshold));
  const errEl = el('p', { class: 'muted small', style: 'display:none' }, '');

  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted small' }, t('noise_intro')),
    el('div', { class: 'spread' }, [startBtn, stopBtn]),
    el('div', { class: 'spread', style: 'margin-top:10px' }, [el('span', { class: 'pill' }, t('noise_level') + ': '), levelEl, peaksEl]),
    errEl
  ]));
  root.appendChild(el('div', { class: 'card' }, [
    canvas,
    el('p', { class: 'muted small', style: 'margin-top:8px' }, t('noise_hint')),
    el('div', { class: 'row between' }, [el('label', {}, t('noise_threshold')), thrVal]),
    el('input', { type: 'range', min: '20', max: '95', value: String(threshold), oninput: (e) => { threshold = Number(e.target.value); thrVal.textContent = String(threshold); draw(); } })
  ]));

  function draw() {
    const { g, w, h } = fitCanvas(canvas);
    g.clearRect(0, 0, w, h);
    const pad = 6, ph = h - pad * 2;
    // линия на прага
    const ty = pad + ph * (1 - threshold / 100);
    g.strokeStyle = 'rgba(251,191,36,.5)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, ty); g.lineTo(w, ty); g.stroke(); g.setLineDash([]);
    if (!samples.length) return;
    const t0 = samples[0].t, t1 = Math.max(samples[samples.length - 1].t, t0 + MAX * 500);
    const x = (tt) => (tt - t0) / (t1 - t0) * w;
    // площ на нивото
    g.beginPath(); g.moveTo(x(samples[0].t), h - pad);
    for (const s of samples) g.lineTo(x(s.t), pad + ph * (1 - s.level / 100));
    g.lineTo(x(samples[samples.length - 1].t), h - pad); g.closePath();
    g.fillStyle = 'rgba(240,163,92,.35)'; g.fill();
    g.beginPath();
    samples.forEach((s, i) => { const px = x(s.t), py = pad + ph * (1 - s.level / 100); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.strokeStyle = '#f0a35c'; g.lineWidth = 1.5; g.stroke();
    // маркери
    for (const m of marks) {
      if (m.t < t0) continue;
      g.strokeStyle = m.kind === 'event' ? '#fb7185' : '#fbbf24'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x(m.t), pad); g.lineTo(x(m.t), h - pad); g.stroke();
    }
  }

  function onLevel(level) {
    const now = Date.now();
    samples.push({ t: now, level });
    if (samples.length > MAX) samples.shift();
    levelEl.textContent = level + ' — ' + (level >= threshold ? t('noise_loud') : t('noise_quiet'));
    if (level >= threshold && now - lastLoud > 3000) {
      lastLoud = now; peaks++;
      marks.push({ t: now, kind: 'loud' });
      peaksEl.textContent = t('noise_peaks') + ': ' + peaks;
    }
    // Нови събития от наблюдението (събуждане/непознат…) → червен маркер.
    const evs = getState().events;
    if (evs.length > seenEvents) {
      for (const e of evs.slice(0, evs.length - seenEvents)) marks.push({ t: e.at || now, kind: 'event', label: typeLabel(e.type) });
      seenEvents = evs.length;
    }
    while (marks.length && samples.length && marks[0].t < samples[0].t) marks.shift();
    draw();
  }

  async function start() {
    if (!micSupported()) { errEl.style.display = 'block'; errEl.textContent = t('noise_mic_err'); return; }
    _meterFn = onLevel;
    const r = await startMeter(onLevel);
    if (!r.ok) { errEl.style.display = 'block'; errEl.textContent = t('noise_mic_err') + ' (' + r.reason + ')'; return; }
    errEl.style.display = 'none';
    startBtn.disabled = true; stopBtn.disabled = false;
  }
  function stop() { stopMeter(onLevel); _meterFn = null; startBtn.disabled = false; stopBtn.disabled = true; }
  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
  requestAnimationFrame(draw); // след като платното е в документа (реална ширина)
}

// ---------------------------------------------------------------- 2) Звуци
function renderSounds(root) {
  const kinds = ['rain', 'sea', 'fan', 'heart', 'melody'];
  const icons = { rain: '🌧️', sea: '🌊', fan: '🌀', heart: '💗', melody: '🎵' };
  let minutes = 0;
  const status = el('div', { class: 'muted', style: 'margin-top:10px' }, '');
  const btns = {};
  const stopBtn = el('button', { class: 'btn secondary', onclick: () => stopSound() }, t('snd_stop'));

  const timerSel = el('select', { onchange: (e) => { minutes = Number(e.target.value); } }, [
    optionEl('0', t('snd_timer_off'), '0'),
    optionEl('15', '15 ' + t('snd_min'), '0'),
    optionEl('30', '30 ' + t('snd_min'), '0'),
    optionEl('60', '60 ' + t('snd_min'), '0')
  ]);
  const volVal = el('span', { class: 'pill' }, Math.round(getVolume() * 100) + '%');

  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted small' }, soundSupported() ? t('snd_intro') : t('noise_mic_err')),
    el('div', { class: 'spread' }, kinds.map((k) => (btns[k] = el('button', { class: 'btn secondary', onclick: () => { playSound(k, minutes); } }, icons[k] + ' ' + t('snd_' + k))))),
    el('label', {}, t('snd_timer')), timerSel,
    el('div', { class: 'row between' }, [el('label', {}, t('snd_volume')), volVal]),
    el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(getVolume() * 100)), oninput: (e) => { setVolume(Number(e.target.value) / 100); volVal.textContent = e.target.value + '%'; } }),
    el('div', { class: 'spread', style: 'margin-top:12px' }, [stopBtn]),
    status
  ]));

  function refresh() {
    const cur = currentSound();
    for (const k of kinds) btns[k].className = 'btn ' + (k === cur ? '' : 'secondary');
    if (!cur) { status.textContent = ''; return; }
    const left = timerLeft();
    status.textContent = t('snd_playing') + ' ' + t('snd_' + cur) + (left ? ' · ' + Math.ceil(left / 60) + ' ' + t('snd_min') : '');
  }
  const off = onSoundChange(refresh);
  const iv = setInterval(refresh, 1000);
  _cleanup.push(off, () => clearInterval(iv));
  refresh();
}

// ---------------------------------------------------------------- 3) Лампа
const LIGHT_COLORS = { warm: '#ffb56b', rose: '#ff9fb8', sky: '#8fc9ff', mint: '#9be7c4' };
let _lightColor = 'warm';
let _lightBright = 60;
let _wakeLock = null;

function closeLight() {
  if (_light) { _light.remove(); _light = null; }
  if (_wakeLock) { try { _wakeLock.release(); } catch (_) {} _wakeLock = null; }
}

function openLight() {
  closeLight();
  const apply = () => { ov.style.background = LIGHT_COLORS[_lightColor]; ov.style.filter = 'brightness(' + (0.2 + _lightBright / 100 * 0.8) + ')'; };
  const brVal = el('span', { class: 'pill' }, _lightBright + '%');
  const swatches = Object.keys(LIGHT_COLORS).map((c) => el('button', {
    class: 'swatch' + (c === _lightColor ? ' cur' : ''), style: 'background:' + LIGHT_COLORS[c], title: t('light_' + c), 'aria-label': t('light_' + c),
    onclick: () => { _lightColor = c; swatches.forEach((s, i) => s.classList.toggle('cur', Object.keys(LIGHT_COLORS)[i] === c)); apply(); }
  }));
  const ov = el('div', { class: 'nightlight' }, [
    el('div', { class: 'tapzone', onclick: closeLight }, t('light_tap_exit')),
    el('div', { class: 'panel' }, [
      el('div', { class: 'row between' }, [el('span', {}, t('light_brightness')), brVal]),
      el('input', { type: 'range', min: '5', max: '100', value: String(_lightBright), oninput: (e) => { _lightBright = Number(e.target.value); brVal.textContent = _lightBright + '%'; apply(); } }),
      el('div', { class: 'row', style: 'margin-top:10px' }, [el('span', {}, t('light_color')), ...swatches])
    ])
  ]);
  document.body.appendChild(ov);
  _light = ov;
  apply();
  // Екранът да не гасне, докато лампата свети (ако устройството поддържа).
  try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then((l) => { _wakeLock = l; }).catch(() => {}); } catch (_) {}
}

function renderLight(root) {
  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted small' }, t('light_intro')),
    el('button', { class: 'btn wide', onclick: openLight }, '🌙 ' + t('light_on'))
  ]));
}

// ---------------------------------------------------------------- 4) Отчет
function renderReport(root) {
  let offset = 0; // 0 = днес, 1 = вчера

  const daySel = el('select', { onchange: (e) => { offset = Number(e.target.value); refresh(); } }, [
    optionEl('0', t('rep_today'), '0'), optionEl('1', t('rep_yesterday'), '0')
  ]);
  const quick = [['feed', '🍼', 'rep_feed'], ['sleep', '😴', 'rep_sleep_start'], ['wake', '🌞', 'rep_sleep_end'], ['diaper', '🧷', 'rep_diaper']];
  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted small' }, t('rep_intro')),
    el('div', { class: 'spread' }, quick.map(([type, ic, key]) => el('button', { class: 'btn secondary sm', onclick: () => { addDiary(type); toast(t('saved')); refresh(); } }, ic + ' ' + t(key))))
  ]));

  const summary = el('div', { class: 'card' });
  const list = el('div', { class: 'card' });
  root.appendChild(el('div', { class: 'card' }, [el('label', {}, t('rep_day')), daySel]));
  root.appendChild(summary);
  root.appendChild(list);

  function compute() {
    const { from, to, date } = dayBounds(offset);
    const diary = getCare().diary.filter((d) => d.at >= from && d.at < to).sort((a, b) => a.at - b.at);
    const events = getState().events.filter((e) => e.at >= from && e.at < to);
    let feedings = 0, diapers = 0, wakeups = 0, sleepMin = 0, sleepingSince = null;
    for (const d of diary) {
      if (d.type === 'feed') feedings++;
      else if (d.type === 'diaper') diapers++;
      else if (d.type === 'sleep') sleepingSince = d.at;
      else if (d.type === 'wake') {
        wakeups++;
        if (sleepingSince != null) { sleepMin += (d.at - sleepingSince) / 60000; sleepingSince = null; }
      }
    }
    // Ако още спи (само за днес) — броим до момента.
    let stillSleeping = null;
    if (sleepingSince != null) {
      const end = offset === 0 ? Date.now() : to;
      sleepMin += (end - sleepingSince) / 60000;
      if (offset === 0) stillSleeping = sleepingSince;
    }
    const evWake = events.filter((e) => e.type === 'wake').length;
    return { date, diary, events, feedings, diapers, wakeups: wakeups + evWake, sleepMin, stillSleeping };
  }

  function reportText(r) {
    const lines = [
      t('rep_title_text') + ' — ' + r.date.toLocaleDateString(getLang()),
      t('rep_feedings') + ': ' + r.feedings,
      t('rep_sleep_total') + ': ' + fmtDur(r.sleepMin),
      t('rep_wakeups') + ': ' + r.wakeups,
      t('rep_diapers') + ': ' + r.diapers,
      t('rep_events') + ': ' + r.events.length
    ];
    if (r.stillSleeping) lines.push(t('rep_sleeping_now') + ' ' + fmtTime(r.stillSleeping));
    lines.push('', 'Pupikes Baby Radar');
    return lines.join('\n');
  }

  async function share(r) {
    const text = reportText(r);
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (_) { /* отказано → копиране */ }
    try { await navigator.clipboard.writeText(text); toast(t('rep_copied')); }
    catch (_) { toast(text.slice(0, 120), 6000); }
  }

  function refresh() {
    const r = compute();
    clear(summary);
    summary.appendChild(el('h3', {}, t('rep_title_text')));
    summary.appendChild(el('div', { class: 'grid2' }, [
      stat(r.feedings, t('rep_feedings')),
      stat(fmtDur(r.sleepMin), t('rep_sleep_total')),
      stat(r.wakeups, t('rep_wakeups')),
      stat(r.diapers, t('rep_diapers')),
      stat(r.events.length, t('rep_events'))
    ]));
    if (r.stillSleeping) summary.appendChild(el('p', { class: 'muted small', style: 'margin-top:8px' }, t('rep_sleeping_now') + ' ' + fmtTime(r.stillSleeping)));
    summary.appendChild(el('button', { class: 'btn wide', style: 'margin-top:10px', onclick: () => share(r) }, '📤 ' + t('rep_share')));

    clear(list);
    list.appendChild(el('h3', {}, t('rep_entries')));
    if (!r.diary.length && !r.events.length) { list.appendChild(el('p', { class: 'muted small' }, t('rep_empty'))); return; }
    const rows = [
      ...r.diary.map((d) => ({ at: d.at, label: t(labelKey(d.type)), del: () => { removeDiary(d.id); refresh(); } })),
      ...r.events.map((e) => ({ at: e.at, label: '⚠️ ' + typeLabel(e.type) }))
    ].sort((a, b) => b.at - a.at);
    for (const row of rows) {
      list.appendChild(el('div', { class: 'line' }, [
        el('div', { class: 'main' }, [el('div', {}, row.label), el('div', { class: 'muted small' }, fmtTime(row.at))]),
        row.del ? el('button', { class: 'btn danger small', onclick: row.del }, t('rep_delete')) : null
      ]));
    }
  }
  function labelKey(type) { return { feed: 'rep_feed', sleep: 'rep_sleep_start', wake: 'rep_sleep_end', diaper: 'rep_diaper' }[type] || 'rep_feed'; }
  function stat(val, lbl) { return el('div', { class: 'stat' }, [el('div', { class: 'val' }, String(val)), el('div', { class: 'lbl' }, lbl)]); }
  refresh();
}

// ---------------------------------------------------------------- 5) Растеж
function renderGrowth(root, ctx) {
  const care = getCare();
  const birthIn = el('input', { type: 'date', value: care.birthDate || '' });
  const sexSel = el('select', {}, [optionEl('boy', t('gr_boy'), care.sex), optionEl('girl', t('gr_girl'), care.sex)]);
  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted small' }, t('gr_intro')),
    el('label', {}, t('gr_birth')), birthIn,
    el('label', {}, t('gr_sex')), sexSel,
    el('button', { class: 'btn sm', style: 'margin-top:10px', onclick: () => { setCare({ birthDate: birthIn.value, sex: sexSel.value }); toast(t('saved')); ctx.rerender(); } }, t('save'))
  ]));

  const dateIn = el('input', { type: 'date', value: isoDay(Date.now()) });
  const wIn = el('input', { type: 'number', step: '0.01', min: '0', placeholder: '0.00' });
  const hIn = el('input', { type: 'number', step: '0.1', min: '0', placeholder: '0.0' });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('gr_add')),
    el('label', {}, t('gr_date')), dateIn,
    el('div', { class: 'grid2' }, [
      el('div', {}, [el('label', {}, t('gr_weight')), wIn]),
      el('div', {}, [el('label', {}, t('gr_height')), hIn])
    ]),
    el('button', { class: 'btn sm', style: 'margin-top:10px', onclick: () => {
      const weight = parseFloat(wIn.value), height = parseFloat(hIn.value);
      if (!dateIn.value || (!(weight > 0) && !(height > 0))) { toast(t('gr_need_value')); return; }
      addGrowth({ at: dateIn.value, weight: weight > 0 ? weight : null, height: height > 0 ? height : null });
      toast(t('saved')); ctx.rerender();
    } }, t('gr_add'))
  ]));

  if (!care.birthDate) { root.appendChild(el('p', { class: 'muted' }, t('gr_no_birth'))); }
  else {
    const age = ageMonths(care.birthDate, Date.now());
    root.appendChild(el('p', { class: 'muted small' }, t('gr_age') + ': ' + age.toFixed(1) + ' ' + t('gr_months')));
    const cw = el('canvas', { class: 'chart tall' }), ch = el('canvas', { class: 'chart tall' });
    root.appendChild(el('div', { class: 'card' }, [el('h3', {}, t('gr_weight')), cw]));
    root.appendChild(el('div', { class: 'card' }, [el('h3', {}, t('gr_height')), ch]));
    root.appendChild(el('p', { class: 'muted small' }, t('gr_who_note')));
    requestAnimationFrame(() => { drawGrowth(cw, 'weight', care); drawGrowth(ch, 'height', care); });
  }

  const list = el('div', { class: 'card' }, [el('h3', {}, t('gr_entries'))]);
  const entries = care.growth.slice().reverse();
  if (!entries.length) list.appendChild(el('p', { class: 'muted small' }, t('rep_empty')));
  for (const g of entries) {
    const m = care.birthDate ? ageMonths(care.birthDate, g.at) : null;
    const parts = [];
    if (g.weight) parts.push(g.weight + ' ' + t('gr_kg') + bandTag('weight', m, g.weight));
    if (g.height) parts.push(g.height + ' ' + t('gr_cm') + bandTag('height', m, g.height));
    list.appendChild(el('div', { class: 'line' }, [
      el('div', { class: 'main' }, [
        el('div', { html: parts.join(' · ') }),
        el('div', { class: 'muted small' }, fmtDate(g.at) + (m != null ? ' · ' + m.toFixed(1) + ' ' + t('gr_months') : ''))
      ]),
      el('button', { class: 'btn danger small', onclick: () => { removeGrowth(g.id); ctx.rerender(); } }, t('rep_delete'))
    ]));
  }
  root.appendChild(list);

  function bandTag(measure, m, v) {
    const b = whoBand(measure, care.sex, m, v);
    if (!b) return '';
    return ' <span class="band-' + b + '">' + t('gr_band_' + b) + '</span>';
  }
}

function drawGrowth(cv, measure, care) {
  const { g, w, h } = fitCanvas(cv);
  g.clearRect(0, 0, w, h);
  const padL = 30, padR = 8, padT = 8, padB = 18;
  const pw = w - padL - padR, ph = h - padT - padB;
  const pts = care.growth.filter((e) => e[measure] > 0).map((e) => ({ m: ageMonths(care.birthDate, e.at), v: e[measure] })).filter((p) => p.m != null);
  const maxM = Math.max(6, Math.min(WHO_MAX_MONTHS, Math.ceil(Math.max(ageMonths(care.birthDate, Date.now()) + 1, ...pts.map((p) => p.m + 1)))));
  const top = whoAt(measure, care.sex, maxM).p97 * 1.08;
  const bottom = Math.min(whoAt(measure, care.sex, 0).p3 * 0.9, ...pts.map((p) => p.v * 0.95));
  const X = (m) => padL + m / maxM * pw;
  const Y = (v) => padT + ph * (1 - (v - bottom) / (top - bottom));
  // коридор P3–P97
  g.beginPath();
  for (let m = 0; m <= maxM; m += 0.5) { const r = whoAt(measure, care.sex, m); m ? g.lineTo(X(m), Y(r.p97)) : g.moveTo(X(m), Y(r.p97)); }
  for (let m = maxM; m >= 0; m -= 0.5) { const r = whoAt(measure, care.sex, m); g.lineTo(X(m), Y(r.p3)); }
  g.closePath(); g.fillStyle = 'rgba(255,255,255,.10)'; g.fill();
  // медиана
  g.beginPath(); g.setLineDash([4, 4]);
  for (let m = 0; m <= maxM; m += 0.5) { const r = whoAt(measure, care.sex, m); m ? g.lineTo(X(m), Y(r.med)) : g.moveTo(X(m), Y(r.med)); }
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.stroke(); g.setLineDash([]);
  // оси
  g.fillStyle = '#9fc2b8'; g.font = '10px system-ui'; g.textAlign = 'center';
  const stepM = maxM > 12 ? 3 : 1;
  for (let m = 0; m <= maxM; m += stepM) g.fillText(String(m), X(m), h - 5);
  g.textAlign = 'right';
  const stepV = measure === 'weight' ? 2 : 10;
  for (let v = Math.ceil(bottom / stepV) * stepV; v <= top; v += stepV) g.fillText(String(v), padL - 4, Y(v) + 3);
  // точки + линия
  if (pts.length) {
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.m), Y(p.v)) : g.moveTo(X(p.m), Y(p.v))));
    g.strokeStyle = '#f0a35c'; g.lineWidth = 2; g.stroke();
    for (const p of pts) { g.beginPath(); g.arc(X(p.m), Y(p.v), 4, 0, Math.PI * 2); g.fillStyle = '#f0a35c'; g.fill(); }
  }
}

// ---------------------------------------------------------------- 6) Ваксини
function renderVax(root, ctx) {
  const care = getCare();
  root.appendChild(el('p', { class: 'muted small' }, t('vx_intro')));
  if (!care.birthDate) root.appendChild(el('p', { class: 'muted' }, t('gr_no_birth')));
  const nowM = care.birthDate ? ageMonths(care.birthDate, Date.now()) : null;
  const doneCount = VACCINES.filter((v) => care.vaccines[v.id]).length;
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'grid2' }, [
      el('div', { class: 'stat' }, [el('div', { class: 'val' }, doneCount + ' / ' + VACCINES.length), el('div', { class: 'lbl' }, t('vx_done'))]),
      el('div', { class: 'stat' }, [el('div', { class: 'val' }, nowM != null ? nowM.toFixed(1) : '—'), el('div', { class: 'lbl' }, t('gr_age') + ', ' + t('gr_months'))])
    ])
  ]));

  const box = el('div', { class: 'card' });
  let lastMonth = -1;
  for (const v of VACCINES) {
    if (v.month !== lastMonth) {
      lastMonth = v.month;
      let due = v.month === 0 ? t('vx_at_birth') : v.month + ' ' + t('vx_month');
      if (care.birthDate) { const d = new Date(care.birthDate); d.setMonth(d.getMonth() + v.month); due += ' · ' + d.toLocaleDateString(getLang()); }
      box.appendChild(el('h3', { style: 'margin-top:12px' }, t('vx_due') + ': ' + due));
    }
    const doneAt = care.vaccines[v.id];
    let status = 'upcoming', stText = t('vx_upcoming');
    if (doneAt) { status = 'done'; stText = t('vx_completed') + ' ' + fmtDate(doneAt); }
    else if (nowM != null && nowM > v.month + 1) { status = 'overdue'; stText = t('vx_overdue'); }
    box.appendChild(el('div', { class: 'line' }, [
      el('div', { class: 'main' }, [
        el('div', {}, t(v.name) + ' — ' + t('vx_dose') + ' ' + v.dose),
        el('div', { class: 'small vx ' + status }, stText)
      ]),
      el('button', { class: 'btn ' + (doneAt ? 'danger small' : 'sm'), onclick: () => { setVaccineDone(v.id, doneAt ? null : isoDay(Date.now())); ctx.rerender(); } },
        doneAt ? t('vx_undo') : '✓ ' + t('vx_done'))
    ]));
  }
  root.appendChild(box);
}
