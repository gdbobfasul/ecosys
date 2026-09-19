// Version: 1.0026
// tools.js (екран) — „🧰 Инструменти": ОФЛАЙН помощни средства за сигурност, които обикновеният
// аутентикатор няма (отличителна функционалност, Huawei 4.3). Всичко се смята НА УСТРОЙСТВОТО —
// никаква мрежа. Три инструмента:
//   1) Проверка на силата на парола — ентропия (битове), оценка за време за разбиване и списък
//      с проверки (дължина, главни/малки, цифри, символи, повторения). Въведеното НЕ се пази.
//   2) Генератор на пароли / парол-фрази — плъзгач за дължина + превключватели (главни/цифри/
//      символи/без двусмислени) и режим „парол-фраза" (N случайни думи). Само локално.
//   3) Контролен списък за сигурност — добри практики с напредък; отметките се пазят локално
//      (localStorage) — само на устройството.
// Статични български надписи + логика на JavaScript. Няма i18n инжекция, няма мрежа.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { passwordStrength } from '../core/audit.js';

const CHECKLIST_KEY = 'pupikes_auth_tools_checklist';

// ── долна лента с 4-те таба (същата като в списъка), за да е свързан навигацията ──
function bottomTabs(nav) {
  const tabs = [
    { key: 'auth', icon: '🔐', label: 'Кодове', go: () => nav.go('list', { main: 'auth' }) },
    { key: 'passwords', icon: '🔑', label: 'Пароли', go: () => nav.go('list', { main: 'passwords' }) },
    { key: 'security', icon: '🩺', label: 'Защита', go: () => nav.go('list', { main: 'security' }) },
    { key: 'tools', icon: '🧰', label: 'Инструменти', go: () => {} }
  ];
  return h('div', { class: 'tabbar' },
    ...tabs.map((tb) => h('button', { class: 'tab' + (tb.key === 'tools' ? ' on' : ''), onclick: tb.go },
      h('div', {}, tb.icon), h('div', { class: 'tablabel', text: tb.label }))));
}

// Човешко представяне на времето за разбиване по брой битове ентропия
// (офлайн атака ~10 милиарда опита/сек; средно = половината пространство).
function crackTime(bits) {
  if (!bits || bits <= 0) return 'мигновено';
  const RATE_LOG10 = 10;                        // 1e10 опита/сек
  const log10sec = (bits - 1) * Math.LOG10E * Math.LN2 - RATE_LOG10; // log10(2^(bits-1)/1e10)
  if (log10sec < -0.5) return 'мигновено';
  const L = (x) => Math.log10(x);
  const tiers = [
    [L(1), L(60), 'сек'],
    [L(60), L(3600), 'мин'],
    [L(3600), L(86400), 'часа'],
    [L(86400), L(2629800), 'дни'],           // до ~1 месец
    [L(2629800), L(31557600), 'месеца'],     // до ~1 година
    [L(31557600), L(3.15576e9), 'години'],   // до 100 години
    [L(3.15576e9), L(3.15576e12), 'века'],
    [L(3.15576e12), L(3.15576e15), 'хиляди години'],
    [L(3.15576e15), L(3.15576e18), 'милиони години']
  ];
  for (let i = 0; i < tiers.length; i++) {
    const [lo, hi, unit] = tiers[i];
    if (log10sec < hi) {
      const val = Math.round(Math.pow(10, log10sec - lo));
      return (val <= 1 ? '~1' : '~' + val.toLocaleString('bg-BG')) + ' ' + unit;
    }
  }
  return 'практически невъзможно (милиарди+ години)';
}

// ---------------- ЕКРАН ----------------
export function renderTools(root, nav) {
  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list', { main: 'auth' }) }, '←'),
    h('h1', { text: '🧰 Инструменти' }));
  const body = h('div', { class: 'content' });
  const intro = h('p', { class: 'muted', style: 'font-size:.85em;margin:0 0 14px',
    text: 'Офлайн инструменти за сигурност. Всичко се изчислява само на това устройство — нищо не се качва в мрежата.' });
  mount(root, topbar, body, bottomTabs(nav));
  mount(body, intro, sectionStrength(), sectionGenerator(), sectionChecklist());
}

// ── 1) Проверка на силата на парола ─────────────────────────────────────────
function sectionStrength() {
  const LEVELS = ['Много слаба', 'Слаба', 'Средна', 'Силна', 'Много силна'];
  const LEVEL_COLOR = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--accent)', 'var(--accent)'];

  const input = h('input', { type: 'password', placeholder: 'Въведете парола за проверка',
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  const showBtn = h('button', { class: 'copy-btn', title: 'Покажи/скрий', onclick: () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  } }, '👁');
  const bar = h('div', { style: 'height:8px;border-radius:999px;background:var(--bgInput);overflow:hidden;margin:12px 0 6px' },
    h('div', { style: 'height:100%;width:0;background:var(--border);transition:.2s' }));
  const fill = bar.firstChild;
  const label = h('div', { style: 'font-weight:800;margin-bottom:6px', text: '—' });
  const meta = h('div', { class: 'muted', style: 'font-size:.85em;margin-bottom:10px', text: 'Ентропия: —   ·   Време за разбиване: —' });
  const checksBox = h('div', {});

  const CHECKS = [
    ['len', 'Поне 12 знака', (s) => s.length >= 12],
    ['upper', 'Главни букви (A–Я)', (s) => /[A-ZА-ЯЁ]/.test(s)],
    ['lower', 'Малки букви (a–я)', (s) => /[a-zа-яё]/.test(s)],
    ['digit', 'Цифри (0–9)', (s) => /\d/.test(s)],
    ['sym', 'Символи (!@#…)', (s) => /[^\w\s]|_/.test(s)],
    ['norep', 'Без повторения/последователности', (s, st) => s.length > 0 && st.issues.indexOf('seq') === -1],
    ['nocommon', 'Не е често срещана парола', (s, st) => s.length > 0 && st.issues.indexOf('common') === -1]
  ];

  function redraw() {
    const s = input.value || '';
    const st = passwordStrength(s);
    const lvl = s ? st.level : -1;
    fill.style.width = s ? ((st.level + 1) / 5 * 100) + '%' : '0';
    fill.style.background = lvl >= 0 ? LEVEL_COLOR[lvl] : 'var(--border)';
    label.textContent = lvl >= 0 ? LEVELS[lvl] : '—';
    label.style.color = lvl >= 0 ? LEVEL_COLOR[lvl] : 'var(--text)';
    meta.textContent = s
      ? 'Ентропия: ' + st.bits + ' бита   ·   Време за разбиване: ' + crackTime(st.bits)
      : 'Ентропия: —   ·   Време за разбиване: —';
    mount(checksBox, ...CHECKS.map(([, text, fn]) => {
      const ok = s ? !!fn(s, st) : false;
      return h('div', { style: 'display:flex;align-items:center;gap:8px;padding:5px 0;font-size:.9em' },
        h('span', { style: 'font-size:1.05em;color:' + (ok ? 'var(--accent)' : 'var(--textDim)') }, ok ? '✓' : '○'),
        h('span', { style: 'color:' + (ok ? 'var(--text)' : 'var(--textDim)'), text }));
    }));
  }
  input.addEventListener('input', redraw);
  redraw();

  return card('🔎 Проверка на силата на парола',
    'Оцените парола локално. Въведеното НЕ се запазва и напуска паметта, щом излезете.',
    h('div', { class: 'copyfield' }, input, showBtn),
    bar, label, meta,
    h('div', { style: 'border-top:1px solid var(--border);margin-top:6px;padding-top:6px' }, checksBox));
}

// ── 2) Генератор на пароли / парол-фрази ─────────────────────────────────────
function sectionGenerator() {
  const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';       // без I,O (двусмислени вкл. долу)
  const UPPER_AMB = 'IO';
  const LOWER = 'abcdefghijkmnpqrstuvwxyz';
  const LOWER_AMB = 'lo';
  const DIGITS = '23456789';
  const DIGITS_AMB = '01';
  const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';
  const WORDS = ['ябълка', 'планина', 'река', 'облак', 'вятър', 'гора', 'звезда', 'камък', 'море', 'слънце',
    'книга', 'ключ', 'мост', 'поле', 'цвете', 'птица', 'зима', 'лято', 'пламък', 'сянка',
    'tiger', 'river', 'stone', 'cloud', 'forest', 'planet', 'anchor', 'silver', 'copper', 'thunder',
    'orbit', 'castle', 'meadow', 'falcon', 'harbor', 'lantern', 'compass', 'granite', 'willow', 'ember'];

  let mode = 'password';                          // 'password' | 'passphrase'
  let length = 20;
  const opts = { upper: true, lower: true, digits: true, symbols: true, noAmbiguous: false };
  let words = 4;

  const rnd = (n) => {
    const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n;
  };
  const pick = (str) => str[rnd(str.length)];

  function genPassword() {
    let up = UPPER, lo = LOWER, di = DIGITS;
    if (!opts.noAmbiguous) { up += UPPER_AMB; lo += LOWER_AMB; di += DIGITS_AMB; }
    const sets = [];
    if (opts.upper) sets.push(up);
    if (opts.lower) sets.push(lo);
    if (opts.digits) sets.push(di);
    if (opts.symbols) sets.push(SYMBOLS);
    if (!sets.length) return '';
    const pool = sets.join('');
    const out = [];
    sets.forEach((s) => out.push(pick(s)));        // поне по един от всеки избран набор
    while (out.length < length) out.push(pick(pool));
    // разбъркване (Fisher–Yates с крипто-случайност)
    for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); const tmp = out[i]; out[i] = out[j]; out[j] = tmp; }
    return out.slice(0, length).join('');
  }
  function genPassphrase() {
    const parts = [];
    for (let i = 0; i < words; i++) { let w = pick(WORDS); if (i === 0) w = w.charAt(0).toUpperCase() + w.slice(1); parts.push(w); }
    return parts.join('-') + '-' + (10 + rnd(90));
  }

  const output = h('input', { readonly: 'readonly', style: 'font-family:ui-monospace,monospace;font-size:1.05em', value: '' });
  const copyBtn = h('button', { class: 'copy-btn', title: 'Копирай', onclick: () => {
    if (output.value) { copyText(output.value); toast('Копирано'); }
  } }, '📋');
  const strengthLine = h('div', { class: 'muted', style: 'font-size:.82em;margin-top:6px', text: '' });

  function regenerate() {
    const val = mode === 'passphrase' ? genPassphrase() : genPassword();
    output.value = val;
    if (!val) { strengthLine.textContent = 'Изберете поне един вид знаци.'; return; }
    const st = passwordStrength(val);
    strengthLine.textContent = 'Ентропия: ' + st.bits + ' бита · Време за разбиване: ' + crackTime(st.bits);
  }

  // превключвател между двата режима
  const seg = h('div', { class: 'seg' },
    h('button', { class: 'on', onclick: (e) => setMode('password', e) }, 'Парола'),
    h('button', { onclick: (e) => setMode('passphrase', e) }, 'Парол-фраза'));
  function setMode(m, e) {
    mode = m;
    [...seg.children].forEach((b) => b.classList.remove('on'));
    e.currentTarget.classList.add('on');
    pwOpts.style.display = m === 'password' ? '' : 'none';
    ppOpts.style.display = m === 'passphrase' ? '' : 'none';
    regenerate();
  }

  // опции за режим „Парола"
  const lenLabel = h('span', { style: 'font-weight:700', text: String(length) });
  const slider = h('input', { type: 'range', min: '8', max: '64', value: String(length),
    style: 'padding:0;background:transparent;border:none', oninput: (e) => { length = +e.target.value; lenLabel.textContent = String(length); regenerate(); } });
  const toggle = (key, text) => {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = opts[key];
    cb.addEventListener('change', () => { opts[key] = cb.checked; regenerate(); });
    return h('label', { class: 'setting', style: 'margin:0' },
      h('span', { class: 'lbl', style: 'font-weight:500', text }),
      h('span', { class: 'switch' }, cb, h('span', { class: 'track' }, h('span', { class: 'knob' }))));
  };
  const pwOpts = h('div', {},
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 2px' },
      h('span', { class: 'muted', text: 'Дължина' }), lenLabel),
    slider,
    toggle('upper', 'Главни букви (A–Z)'),
    toggle('lower', 'Малки букви (a–z)'),
    toggle('digits', 'Цифри (0–9)'),
    toggle('symbols', 'Символи (!@#…)'),
    toggle('noAmbiguous', 'Без двусмислени знаци (0/O, 1/l/I)'));

  // опции за режим „Парол-фраза"
  const wLabel = h('span', { style: 'font-weight:700', text: String(words) });
  const wSlider = h('input', { type: 'range', min: '3', max: '8', value: String(words),
    style: 'padding:0;background:transparent;border:none', oninput: (e) => { words = +e.target.value; wLabel.textContent = String(words); regenerate(); } });
  const ppOpts = h('div', { style: 'display:none' },
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 2px' },
      h('span', { class: 'muted', text: 'Брой думи' }), wLabel),
    wSlider,
    h('p', { class: 'muted', style: 'font-size:.8em;margin:6px 0 0', text: 'Случайни думи (български и английски), лесни за запомняне, свързани с тире, плюс число.' }));

  const genBtn = h('button', { class: 'btn accent', onclick: regenerate, text: '🎲 Генерирай' });
  regenerate();

  return card('🎲 Генератор на пароли и парол-фрази',
    'Създайте силна тайна с криптографски случаен генератор. Нищо не се записва — само на устройството.',
    seg, pwOpts, ppOpts,
    h('div', { class: 'copyfield', style: 'margin-top:12px' }, output, copyBtn),
    strengthLine, genBtn);
}

// ── 3) Контролен списък за сигурност (localStorage) ──────────────────────────
function sectionChecklist() {
  const ITEMS = [
    ['twofa', 'Включена 2FA за важните акаунти (поща, банка, соц. мрежи)'],
    ['unique', 'Уникална парола за всеки сайт (без повтаряне)'],
    ['backup', 'Резервните кодове (backup codes) са запазени офлайн'],
    ['recovery', 'Зададен резервен e-mail / телефон за възстановяване'],
    ['master', 'Master паролата е дълга парол-фраза, която помня'],
    ['rotate', 'Смяна на критичните пароли поне веднъж годишно'],
    ['biometric', 'Биометрично заключване на приложението е включено'],
    ['audit', 'Направена проверка за изтичания (таб „Защита")']
  ];
  let state = {};
  try { state = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}') || {}; } catch (_) { state = {}; }
  const save = () => { try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state)); } catch (_) {} };

  const bar = h('div', { style: 'height:8px;border-radius:999px;background:var(--bgInput);overflow:hidden;margin:4px 0 4px' },
    h('div', { style: 'height:100%;width:0;background:var(--accent);transition:.2s' }));
  const fill = bar.firstChild;
  const pct = h('div', { class: 'muted', style: 'font-size:.85em;margin-bottom:10px', text: '' });
  const rows = h('div', {});

  function refreshProgress() {
    const done = ITEMS.filter(([k]) => state[k]).length;
    fill.style.width = Math.round(done / ITEMS.length * 100) + '%';
    pct.textContent = 'Изпълнени: ' + done + ' от ' + ITEMS.length;
  }
  function build() {
    mount(rows, ...ITEMS.map(([key, text]) => {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = !!state[key];
      cb.addEventListener('change', () => { state[key] = cb.checked; save(); refreshProgress(); });
      return h('label', { class: 'setting', style: 'margin:0' },
        h('span', { class: 'lbl', style: 'font-weight:500;white-space:normal', text }),
        h('span', { class: 'switch' }, cb, h('span', { class: 'track' }, h('span', { class: 'knob' }))));
    }));
    refreshProgress();
  }
  build();

  const resetBtn = h('button', { class: 'btn ghost', onclick: () => {
    state = {}; save(); build(); toast('Списъкът е нулиран');
  }, text: '↺ Нулирай списъка' });

  return card('✅ Контролен списък за сигурност',
    'Добри практики за защита на акаунтите. Отметките се пазят само локално на това устройство.',
    bar, pct, rows, resetBtn);
}

// ── обвивка на секция (карта) ──
function card(title, desc, ...children) {
  return h('div', { class: 'entry', style: 'flex-direction:column;align-items:stretch;gap:0;padding:16px;margin-bottom:16px' },
    h('h1', { style: 'font-size:1.02em;margin:0 0 4px', text: title }),
    h('p', { class: 'muted', style: 'font-size:.82em;margin:0 0 8px', text: desc }),
    ...children);
}
