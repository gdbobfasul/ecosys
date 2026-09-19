// Version: 1.0027
// tools.js — таб „🧰 Инструменти": три НАПЪЛНО ОФЛАЙН инструмента за грижа,
// независими от наблюдението (без камера, без сдвояване, без микрофон, без мрежа):
//   1) Дневник на бебето — хранене/сън/памперс/друго с час и бележка; списък (най-новото
//      отгоре), триене, дневно обобщение, копиране/експорт. Само localStorage.
//   2) Успокояващи звуци — бял/розов шум и мек „шшш" тон през Web Audio API (без файлове),
//      старт/стоп и таймер за сън (авто-спиране след N минути).
//   3) Калкулатор за хранене — тегло (kg) → приблизителен дневен прием мляко (ml) по проста
//      формула + количество на хранене при N хранения. Само ориентир, не медицински съвет.
//
// Умишлено самостоятелен модул със собствено localStorage хранилище и собствен Web Audio,
// за да не зависи от логиката на монитора и да остане напълно офлайн.
import { el, clear, toast } from '../ui/dom.js';

// ---------------------------------------------------------------- локално хранилище
const TKEY = 'babymon.tools.v1';

function loadStore() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(TKEY) : null;
    if (!raw) return { diary: [] };
    const p = JSON.parse(raw);
    return { diary: Array.isArray(p.diary) ? p.diary : [] };
  } catch (_) { return { diary: [] }; }
}
function saveStore(s) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(TKEY, JSON.stringify(s)); }
  catch (_) { /* пренебрегваме — работим и без запис */ }
}
function tuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ---------------------------------------------------------------- помощни за час/дата
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtTime(ms) { const d = new Date(ms); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function fmtDate(ms) { const d = new Date(ms); return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear(); }
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

// Типове записи в дневника (стойност → етикет с емоджи, само на български).
const DIARY_TYPES = [
  ['feed', '🍼 Хранене'],
  ['sleep', '😴 Сън'],
  ['diaper', '🧷 Памперс'],
  ['other', '📝 Друго']
];
function typeLabel(type) { const f = DIARY_TYPES.find((x) => x[0] === type); return f ? f[1] : '📝 Друго'; }

// ---------------------------------------------------------------- под-табове
const SUBS = [
  ['diary', '📔 Дневник'],
  ['sounds', '🎵 Успокояващи звуци'],
  ['calc', '🍼 Калкулатор']
];
let _sub = 'diary';
let _cleanup = [];       // слушатели/интервали за спиране при напускане на екрана

export function teardownTools() {
  for (const fn of _cleanup) { try { fn(); } catch (_) {} }
  _cleanup = [];
  stopNoise(); // при напускане на таба спираме генерирания шум (пести батерия)
}

export function renderTools(root, ctx) {
  teardownTools();
  root.appendChild(el('h1', {}, '🧰 Инструменти'));
  root.appendChild(el('p', { class: 'muted small' },
    'Помощни инструменти за ежедневието — работят изцяло на телефона, без интернет и без камера.'));

  const chips = el('div', { class: 'chips' }, SUBS.map(([id, label]) =>
    el('button', { class: 'chip' + (id === _sub ? ' active' : ''), onclick: () => { _sub = id; ctx.rerender(); } }, label)
  ));
  root.appendChild(chips);

  const body = el('div', {});
  root.appendChild(body);
  const R = { diary: renderDiary, sounds: renderSounds, calc: renderCalc };
  (R[_sub] || renderDiary)(body, ctx);

  // Кратко предупреждение — валидно за целия таб.
  root.appendChild(el('p', { class: 'muted small', style: 'margin-top:16px;text-align:center' },
    '⚠️ Информацията тук е само ориентировъчна и не е медицински съвет. При съмнение се консултирайте с лекар.'));
}

// ================================================================ 1) Дневник
function renderDiary(root) {
  let type = 'feed';
  const store = loadStore();

  const typeSel = el('select', { onchange: (e) => { type = e.target.value; } },
    DIARY_TYPES.map(([v, label]) => el('option', { value: v }, label)));
  const noteIn = el('input', { type: 'text', maxlength: '120', placeholder: 'Бележка (по желание)' });

  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted small' }, 'Записвайте храненията, съня и смяната на памперси. Всичко се пази само на този телефон.'),
    el('label', {}, 'Тип'), typeSel,
    el('label', {}, 'Бележка'), noteIn,
    el('button', {
      class: 'btn wide', style: 'margin-top:10px', onclick: () => {
        const s = loadStore();
        s.diary.unshift({ id: tuid(), type, at: Date.now(), note: (noteIn.value || '').trim() });
        if (s.diary.length > 500) s.diary.length = 500;
        saveStore(s);
        noteIn.value = '';
        toast('Записано');
        refresh();
      }
    }, '➕ Добави запис')
  ]));

  const summary = el('div', { class: 'card' });
  const list = el('div', { class: 'card' });
  root.appendChild(summary);
  root.appendChild(list);

  function todayCounts(entries) {
    const from = startOfToday();
    const c = { feed: 0, sleep: 0, diaper: 0, other: 0 };
    for (const d of entries) if (d.at >= from && c[d.type] != null) c[d.type]++;
    return c;
  }

  function exportText(entries) {
    const c = todayCounts(entries);
    const lines = [
      'Дневник на бебето — ' + fmtDate(Date.now()),
      'Днес: 🍼 хранения ' + c.feed + ' · 😴 сън ' + c.sleep + ' · 🧷 памперси ' + c.diaper + ' · 📝 други ' + c.other,
      ''
    ];
    for (const d of entries) lines.push(fmtDate(d.at) + ' ' + fmtTime(d.at) + ' — ' + typeLabel(d.type) + (d.note ? ' · ' + d.note : ''));
    lines.push('', 'Pupikes: гласът на мама');
    return lines.join('\n');
  }

  async function copyAll(entries) {
    const text = exportText(entries);
    try { await navigator.clipboard.writeText(text); toast('Копирано в паметта'); }
    catch (_) { toast(text.slice(0, 120), 6000); }
  }

  function stat(val, lbl) { return el('div', { class: 'stat' }, [el('div', { class: 'val' }, String(val)), el('div', { class: 'lbl' }, lbl)]); }

  function refresh() {
    const s = loadStore();
    const entries = s.diary.slice().sort((a, b) => b.at - a.at); // най-новото отгоре
    const c = todayCounts(entries);

    clear(summary);
    summary.appendChild(el('h3', {}, 'Днес'));
    summary.appendChild(el('div', { class: 'grid2' }, [
      stat(c.feed, '🍼 Хранения'),
      stat(c.sleep, '😴 Сън'),
      stat(c.diaper, '🧷 Памперси'),
      stat(c.other, '📝 Други')
    ]));
    summary.appendChild(el('button', { class: 'btn wide', style: 'margin-top:10px', onclick: () => copyAll(entries) }, '📋 Копирай / експортирай'));

    clear(list);
    list.appendChild(el('h3', {}, 'Записи'));
    if (!entries.length) { list.appendChild(el('p', { class: 'muted small' }, 'Още няма записи.')); return; }
    for (const d of entries) {
      list.appendChild(el('div', { class: 'line' }, [
        el('div', { class: 'main' }, [
          el('div', {}, typeLabel(d.type) + (d.note ? ' · ' + d.note : '')),
          el('div', { class: 'muted small' }, fmtDate(d.at) + ' ' + fmtTime(d.at))
        ]),
        el('button', {
          class: 'btn danger small', onclick: () => {
            const cur = loadStore();
            cur.diary = cur.diary.filter((x) => x.id !== d.id);
            saveStore(cur);
            refresh();
          }
        }, 'Изтрий')
      ]));
    }
  }
  refresh();
}

// ================================================================ 2) Успокояващи звуци
// Собствен Web Audio генератор — бял/розов шум и мек „шшш" (лентов филтър).
let _ac = null;          // AudioContext
let _node = null;        // текущият източник (ScriptProcessor/Buffer)
let _gain = null;
let _filter = null;
let _kind = null;        // 'white' | 'pink' | 'shhh' | null
let _timer = null;       // таймер за сън
let _timerEnd = 0;       // край на таймера (ms), 0 = без таймер
const _listeners = new Set();

function notify() { for (const fn of _listeners) { try { fn(); } catch (_) {} } }

function makeNoiseBuffer(ac, pink) {
  const len = ac.sampleRate * 2; // 2 секунди, зациклени
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  if (!pink) {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else {
    // Розов шум по филтъра на Paul Kellet.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

function noiseSupported() {
  return typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
}

export function stopNoise() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _timerEnd = 0;
  if (_node) { try { _node.stop(); } catch (_) {} try { _node.disconnect(); } catch (_) {} _node = null; }
  if (_filter) { try { _filter.disconnect(); } catch (_) {} _filter = null; }
  if (_gain) { try { _gain.disconnect(); } catch (_) {} _gain = null; }
  _kind = null;
  notify();
}

function startNoise(kind, minutes) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  stopNoise();
  if (!_ac) _ac = new AC();
  try { if (_ac.state === 'suspended') _ac.resume(); } catch (_) {}

  const src = _ac.createBufferSource();
  src.buffer = makeNoiseBuffer(_ac, kind === 'pink');
  src.loop = true;

  _gain = _ac.createGain();
  _gain.gain.value = 0.4;

  if (kind === 'shhh') {
    // „шшш" = розов шум през лентов филтър около 2 kHz с лека модулация.
    src.buffer = makeNoiseBuffer(_ac, true);
    _filter = _ac.createBiquadFilter();
    _filter.type = 'bandpass';
    _filter.frequency.value = 2000;
    _filter.Q.value = 0.8;
    src.connect(_filter); _filter.connect(_gain);
  } else {
    src.connect(_gain);
  }
  _gain.connect(_ac.destination);
  src.start();
  _node = src;
  _kind = kind;

  if (minutes > 0) {
    _timerEnd = Date.now() + minutes * 60000;
    _timer = setInterval(() => { if (Date.now() >= _timerEnd) stopNoise(); else notify(); }, 1000);
  }
  notify();
  return true;
}

function renderSounds(root) {
  const kinds = [['white', '⚪ Бял шум'], ['pink', '🌸 Розов шум'], ['shhh', '🤫 Шшш']];
  let minutes = 0;
  const btns = {};
  const status = el('div', { class: 'muted', style: 'margin-top:10px' }, '');

  const timerSel = el('select', { onchange: (e) => { minutes = Number(e.target.value); } }, [
    el('option', { value: '0' }, 'Без таймер'),
    el('option', { value: '15' }, '15 минути'),
    el('option', { value: '30' }, '30 минути'),
    el('option', { value: '45' }, '45 минути'),
    el('option', { value: '60' }, '60 минути')
  ]);

  const stopBtn = el('button', { class: 'btn secondary', onclick: () => stopNoise() }, '⏹ Спри');

  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted small' }, noiseSupported()
      ? 'Равномерни звуци, които помагат на бебето да заспи. Звукът се генерира на телефона — без файлове и без интернет.'
      : 'Този телефон не поддържа генериране на звук.'),
    el('div', { class: 'spread' }, kinds.map(([k, label]) =>
      (btns[k] = el('button', { class: 'btn secondary', onclick: () => { if (!startNoise(k, minutes)) toast('Звукът не е наличен'); } }, label)))),
    el('label', { style: 'margin-top:10px' }, 'Таймер за сън'), timerSel,
    el('div', { class: 'spread', style: 'margin-top:12px' }, [stopBtn]),
    status
  ]));

  function refresh() {
    for (const [k] of kinds) btns[k].className = 'btn ' + (k === _kind ? '' : 'secondary');
    if (!_kind) { status.textContent = 'Спрян.'; return; }
    let txt = 'Свири: ' + (kinds.find((x) => x[0] === _kind)[1]);
    if (_timerEnd) txt += ' · остават ' + Math.ceil((_timerEnd - Date.now()) / 60000) + ' мин';
    status.textContent = txt;
  }
  _listeners.add(refresh);
  const iv = setInterval(refresh, 1000);
  _cleanup.push(() => { _listeners.delete(refresh); clearInterval(iv); });
  refresh();
}

// ================================================================ 3) Калкулатор за хранене
const ML_PER_KG = 150; // ориентировъчно: ~150 ml/kg/ден за кърмаче (ориентир, не съвет)

function renderCalc(root) {
  const wIn = el('input', { type: 'number', step: '0.1', min: '0', inputmode: 'decimal', placeholder: 'напр. 4.5' });
  const feedsSel = el('select', {}, [6, 7, 8, 10, 12].map((n) => el('option', { value: String(n) }, n + ' хранения')));
  const out = el('div', { class: 'card', style: 'display:none' });

  function calc() {
    const kg = parseFloat(wIn.value);
    if (!(kg > 0)) { out.style.display = 'none'; toast('Въведете тегло в кг'); return; }
    const feeds = Number(feedsSel.value) || 8;
    const daily = Math.round(kg * ML_PER_KG);
    const perFeed = Math.round(daily / feeds);
    clear(out);
    out.style.display = 'block';
    out.appendChild(el('h3', {}, 'Ориентировъчен прием'));
    out.appendChild(el('div', { class: 'grid2' }, [
      el('div', { class: 'stat' }, [el('div', { class: 'val' }, daily + ' ml'), el('div', { class: 'lbl' }, 'на ден (~' + ML_PER_KG + ' ml/kg)')]),
      el('div', { class: 'stat' }, [el('div', { class: 'val' }, perFeed + ' ml'), el('div', { class: 'lbl' }, 'на хранене при ' + feeds)])
    ]));
    out.appendChild(el('p', { class: 'muted small', style: 'margin-top:10px' },
      'Формула: тегло × ' + ML_PER_KG + ' ml. Реалната нужда зависи от възрастта, кърменето и здравето — това е само груб ориентир.'));
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted small' }, 'Приблизителен дневен прием мляко според теглото. Ориентир за родители — не замества съвет от педиатър.'),
    el('label', {}, 'Тегло (kg)'), wIn,
    el('label', {}, 'Брой хранения на ден'), feedsSel,
    el('button', { class: 'btn wide', style: 'margin-top:10px', onclick: calc }, '🍼 Изчисли')
  ]));
  root.appendChild(out);
}
