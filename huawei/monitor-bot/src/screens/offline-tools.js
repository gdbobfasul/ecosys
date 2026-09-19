// Version: 1.0030
// offline-tools.js — екран „🧰 Офлайн инструменти" (Huawei anti-„simple content").
// НАПЪЛНО ОФЛАЙН и независим от следенето на сайтове — НИКАКВА мрежа, само локална обработка.
// Три истински инструмента за уеб/разработка:
//   1) Regex тестер     — шаблон + флагове + текст; живо оцветяване, брой съвпадения и групи (native RegExp)
//   2) JSON/URL форматор — разкрасяване/смаляване/проверка на JSON + URL-компонент и base64 кодиране/декодиране
//   3) Cron/интервал помощник — интервал (на N минути/часа) → cron израз + следващи стартове + таблица HTTP кодове
// Всички етикети са статичен български текст; състоянието се пази в localStorage; без i18n инжекция.

const LSK = 'monitor-bot.offlineTools.v1';
const TABS = [
  { k: 'regex', label: 'Regex тестер' },
  { k: 'format', label: 'JSON / URL' },
  { k: 'cron', label: 'Cron / кодове' }
];
let active = 'regex';
let styled = false;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function loadS() { try { return JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch (_) { return {}; } }
function saveS(d) { try { localStorage.setItem(LSK, JSON.stringify(d)); } catch (_) {} }
function patchS(part) { const d = loadS(); saveS(Object.assign(d, part)); }

// Копиране в клипборда — офлайн, с резервен вариант през скрит textarea.
async function copyText(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
  } catch (_) { return false; }
}

// UTF-8 сигурни base64 помощници (btoa/atob не поемат кирилица директно).
function b64enc(s) { return btoa(unescape(encodeURIComponent(s))); }
function b64dec(s) { return decodeURIComponent(escape(atob(s))); }

function injectStyles() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
  .otools-wrap .mkt-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:10px;position:sticky;top:0;z-index:5;background:rgba(127,127,127,.08);border-bottom:1px solid rgba(128,128,128,.25);border-radius:0 0 12px 12px}
  .otools-wrap .mkt-tab{flex:1 1 30%;min-width:64px;padding:10px 8px;border-radius:12px;border:1.5px solid rgba(128,128,128,.45);background:rgba(127,127,127,.12);color:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;text-align:center}
  .otools-wrap .mkt-tab.active{background:var(--accent);border-color:var(--accent);color:#04121f}
  .otools-wrap .mkt-body{padding:12px}
  .otools-wrap .inp{display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:11px 12px;border-radius:10px;border:1px solid rgba(128,128,128,.4);background:#0e131a;color:inherit;font-size:15px}
  .otools-wrap textarea.inp{min-height:96px;font-family:ui-monospace,Consolas,monospace;font-size:13px;resize:vertical}
  .otools-wrap .flags{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
  .otools-wrap .flags label{display:inline-flex;align-items:center;gap:5px;margin:0;font-size:13px;color:#cdd6e2;background:rgba(127,127,127,.12);padding:6px 9px;border-radius:9px;cursor:pointer}
  .otools-wrap .flags input{width:auto;margin:0}
  .otools-wrap .stat{font-size:13px;color:#9aa6b5;margin:6px 0}
  .otools-wrap mark.rx-hit{background:rgba(10,132,255,.35);color:#fff;border-radius:3px;padding:0 1px}
  .otools-wrap .out{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Consolas,monospace;font-size:13px;background:#0e131a;border:1px solid #1e2530;border-radius:10px;padding:10px;min-height:22px;max-height:260px;overflow:auto}
  .otools-wrap .err{color:#ff9a9a}
  .otools-wrap .ok{color:#5be584}
  .otools-wrap .rowb{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}
  .otools-wrap .rowb .btn{width:auto;flex:1 1 auto;padding:10px 12px;font-size:13px}
  .otools-wrap .codes .ci{display:flex;gap:10px;padding:9px 6px;border-bottom:1px solid #1a2029;font-size:13px}
  .otools-wrap .codes .cc{font-weight:700;min-width:44px}
  .otools-wrap .c2{color:#5be584}.otools-wrap .c3{color:#7db6ff}.otools-wrap .c4{color:#f5c453}.otools-wrap .c5{color:#ff9a9a}
  .otools-wrap .runs{font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#cdd6e2}
  .otools-wrap .cronbox{font-size:20px;font-weight:700;letter-spacing:1px;color:var(--accent2);margin:6px 0}
  `;
  document.head.appendChild(s);
}

// ── Инструмент 1: Regex тестер ─────────────────────────────────────────────
const FLAGS = [
  { f: 'g', t: 'глобално (g)' }, { f: 'i', t: 'без регистър (i)' },
  { f: 'm', t: 'многоредово (m)' }, { f: 's', t: 'точка=нов ред (s)' },
  { f: 'u', t: 'уникод (u)' }, { f: 'y', t: 'прилепнало (y)' }
];
function highlight(text, re) {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const rg = new RegExp(re.source, flags);
  let out = '', last = 0, m, count = 0, groups = 0, guard = 0;
  while ((m = rg.exec(text)) !== null) {
    if (guard++ > 50000) break;
    const start = m.index, len = m[0].length;
    if (len > 0) {
      out += esc(text.slice(last, start)) + '<mark class="rx-hit">' + esc(m[0]) + '</mark>';
      last = start + len;
      count++;
      if (m.length - 1 > groups) groups = m.length - 1;
    }
    if (rg.lastIndex === start) rg.lastIndex++; // празно съвпадение → напред
    if (!flags.includes('g')) break;
  }
  out += esc(text.slice(last));
  return { html: out, count, groups };
}
function drawRegex(body) {
  const s = loadS();
  body.innerHTML =
    '<label>Шаблон (без ограждащи наклонени черти)</label>' +
    '<input class="inp" id="rx-pat" placeholder="напр. \\\\b\\\\w+@\\\\w+\\\\.\\\\w+\\\\b" />' +
    '<div class="flags" id="rx-flags">' + FLAGS.map((x) =>
      '<label><input type="checkbox" data-f="' + x.f + '" />' + x.t + '</label>').join('') + '</div>' +
    '<label>Текст за проверка</label>' +
    '<textarea class="inp" id="rx-text" placeholder="Постави текст тук — съвпаденията се оцветяват на живо."></textarea>' +
    '<div class="stat" id="rx-stat">—</div>' +
    '<label>Резултат (оцветени съвпадения)</label>' +
    '<div class="out" id="rx-out"></div>';
  const pat = body.querySelector('#rx-pat'), txt = body.querySelector('#rx-text');
  const stat = body.querySelector('#rx-stat'), out = body.querySelector('#rx-out');
  pat.value = s.rxPat || '';
  txt.value = s.rxText || '';
  const chosen = new Set((s.rxFlags || 'g').split(''));
  body.querySelectorAll('#rx-flags input').forEach((c) => { c.checked = chosen.has(c.getAttribute('data-f')); });
  function run() {
    const flags = Array.from(body.querySelectorAll('#rx-flags input')).filter((c) => c.checked).map((c) => c.getAttribute('data-f')).join('');
    patchS({ rxPat: pat.value, rxText: txt.value, rxFlags: flags });
    if (!pat.value) { stat.className = 'stat'; stat.textContent = 'Въведи шаблон, за да започне търсенето.'; out.innerHTML = esc(txt.value); return; }
    let re;
    try { re = new RegExp(pat.value, flags); } catch (e) {
      stat.className = 'stat err'; stat.textContent = 'Невалиден шаблон: ' + e.message; out.innerHTML = esc(txt.value); return;
    }
    const r = highlight(txt.value, re);
    stat.className = 'stat ' + (r.count ? 'ok' : '');
    stat.textContent = 'Съвпадения: ' + r.count + ' · заловени групи: ' + r.groups + ' · флагове: ' + (flags || '—');
    out.innerHTML = r.html || esc(txt.value);
  }
  pat.addEventListener('input', run);
  txt.addEventListener('input', run);
  body.querySelectorAll('#rx-flags input').forEach((c) => c.addEventListener('change', run));
  run();
}

// ── Инструмент 2: JSON / URL форматор ──────────────────────────────────────
function drawFormat(body) {
  const s = loadS();
  body.innerHTML =
    '<label>JSON</label>' +
    '<textarea class="inp" id="js-in" placeholder=\'{"пример": [1, 2, 3]}\'></textarea>' +
    '<div class="rowb">' +
      '<button class="btn primary" id="js-pretty">Разкраси</button>' +
      '<button class="btn" id="js-min">Смали</button>' +
      '<button class="btn" id="js-copy">Копирай</button>' +
    '</div>' +
    '<div class="stat" id="js-stat">—</div>' +
    '<div class="out" id="js-out"></div>' +
    '<label style="margin-top:14px">Текст за URL / base64</label>' +
    '<textarea class="inp" id="u-in" placeholder="Въведи текст…"></textarea>' +
    '<div class="rowb">' +
      '<button class="btn" id="u-enc">URL кодирай</button>' +
      '<button class="btn" id="u-dec">URL декодирай</button>' +
    '</div>' +
    '<div class="rowb">' +
      '<button class="btn" id="b-enc">base64 кодирай</button>' +
      '<button class="btn" id="b-dec">base64 декодирай</button>' +
      '<button class="btn" id="u-copy">Копирай</button>' +
    '</div>' +
    '<div class="stat" id="u-stat">—</div>' +
    '<div class="out" id="u-out"></div>';
  const jin = body.querySelector('#js-in'), jstat = body.querySelector('#js-stat'), jout = body.querySelector('#js-out');
  jin.value = s.jsIn || '';
  jin.addEventListener('input', () => patchS({ jsIn: jin.value }));
  function doJson(minify) {
    let obj;
    try { obj = JSON.parse(jin.value); } catch (e) {
      jstat.className = 'stat err'; jstat.textContent = '✗ Невалиден JSON: ' + e.message; jout.textContent = ''; return;
    }
    const s2 = JSON.stringify(obj, null, minify ? 0 : 2);
    jout.textContent = s2;
    const n = Array.isArray(obj) ? obj.length + ' елемента' : (obj && typeof obj === 'object' ? Object.keys(obj).length + ' ключа' : 'стойност');
    jstat.className = 'stat ok'; jstat.textContent = '✓ Валиден JSON · ' + n + ' · ' + s2.length + ' знака';
  }
  body.querySelector('#js-pretty').addEventListener('click', () => doJson(false));
  body.querySelector('#js-min').addEventListener('click', () => doJson(true));
  body.querySelector('#js-copy').addEventListener('click', async (e) => {
    if (!jout.textContent) return;
    if (await copyText(jout.textContent)) { e.target.textContent = '✓ Копирано'; setTimeout(() => { e.target.textContent = 'Копирай'; }, 1500); }
  });

  const uin = body.querySelector('#u-in'), ustat = body.querySelector('#u-stat'), uout = body.querySelector('#u-out');
  uin.value = s.uIn || '';
  uin.addEventListener('input', () => patchS({ uIn: uin.value }));
  function put(text, okMsg) { uout.textContent = text; ustat.className = 'stat ok'; ustat.textContent = okMsg + ' · ' + text.length + ' знака'; }
  function fail(msg) { ustat.className = 'stat err'; ustat.textContent = '✗ ' + msg; uout.textContent = ''; }
  body.querySelector('#u-enc').addEventListener('click', () => { try { put(encodeURIComponent(uin.value), 'URL кодирано'); } catch (e) { fail(e.message); } });
  body.querySelector('#u-dec').addEventListener('click', () => { try { put(decodeURIComponent(uin.value), 'URL декодирано'); } catch (e) { fail('Невалидна URL последователност'); } });
  body.querySelector('#b-enc').addEventListener('click', () => { try { put(b64enc(uin.value), 'base64 кодирано'); } catch (e) { fail(e.message); } });
  body.querySelector('#b-dec').addEventListener('click', () => { try { put(b64dec(uin.value), 'base64 декодирано'); } catch (e) { fail('Невалиден base64 текст'); } });
  body.querySelector('#u-copy').addEventListener('click', async (e) => {
    if (!uout.textContent) return;
    if (await copyText(uout.textContent)) { e.target.textContent = '✓ Копирано'; setTimeout(() => { e.target.textContent = 'Копирай'; }, 1500); }
  });
}

// ── Инструмент 3: Cron/интервал помощник + HTTP кодове ─────────────────────
const HTTP_CODES = [
  { c: 200, t: 'OK — заявката успя.' },
  { c: 201, t: 'Created — създаден е нов ресурс.' },
  { c: 204, t: 'No Content — успех, но без тяло на отговора.' },
  { c: 301, t: 'Moved Permanently — адресът е преместен за постоянно.' },
  { c: 302, t: 'Found — временно пренасочване.' },
  { c: 304, t: 'Not Modified — няма промяна, ползвай кеша.' },
  { c: 307, t: 'Temporary Redirect — временно, със същия метод.' },
  { c: 308, t: 'Permanent Redirect — постоянно, със същия метод.' },
  { c: 400, t: 'Bad Request — грешна или неразбираема заявка.' },
  { c: 401, t: 'Unauthorized — нужна е автентикация.' },
  { c: 403, t: 'Forbidden — достъпът е забранен.' },
  { c: 404, t: 'Not Found — ресурсът не е намерен.' },
  { c: 405, t: 'Method Not Allowed — методът не е разрешен.' },
  { c: 408, t: 'Request Timeout — заявката се забави твърде много.' },
  { c: 409, t: 'Conflict — конфликт със състоянието на ресурса.' },
  { c: 410, t: 'Gone — ресурсът е премахнат за постоянно.' },
  { c: 418, t: "I'm a teapot — шеговит код (RFC 2324)." },
  { c: 429, t: 'Too Many Requests — прекалено много заявки (лимит).' },
  { c: 500, t: 'Internal Server Error — вътрешна грешка на сървъра.' },
  { c: 502, t: 'Bad Gateway — грешен отговор от горен сървър.' },
  { c: 503, t: 'Service Unavailable — услугата е временно недостъпна.' },
  { c: 504, t: 'Gateway Timeout — горният сървър не отговори навреме.' }
];
function nextRuns(unit, n, count) {
  const res = []; const d = new Date();
  if (unit === 'min') {
    d.setSeconds(0, 0);
    let guard = 0;
    while (res.length < count && guard++ < 5000) { d.setTime(d.getTime() + 60000); if (d.getMinutes() % n === 0) res.push(new Date(d)); }
  } else {
    d.setMinutes(0, 0, 0);
    let guard = 0;
    while (res.length < count && guard++ < 5000) { d.setTime(d.getTime() + 3600000); if (d.getHours() % n === 0) res.push(new Date(d)); }
  }
  return res;
}
function drawCron(body) {
  const s = loadS();
  body.innerHTML =
    '<h3 style="margin:2px 0 6px">Интервал за проверка</h3>' +
    '<div class="rowb" style="align-items:center">' +
      '<span class="stat" style="margin:0">На всеки</span>' +
      '<input class="inp" id="cr-n" type="number" min="1" max="59" style="width:88px;margin:0" />' +
      '<select class="inp" id="cr-u" style="width:auto;margin:0"><option value="min">минути</option><option value="hour">часа</option></select>' +
    '</div>' +
    '<label>Еквивалентен cron израз</label>' +
    '<div class="cronbox" id="cr-exp">—</div>' +
    '<button class="btn small" id="cr-copy" style="width:auto">Копирай cron</button>' +
    '<label style="margin-top:12px">Следващи стартове</label>' +
    '<div class="runs" id="cr-runs"></div>' +
    '<h3 style="margin:18px 0 6px">HTTP кодове за състояние</h3>' +
    '<input class="inp" id="cr-search" placeholder="Търси по код или дума (напр. 404, забранен)…" />' +
    '<div class="codes" id="cr-codes"></div>';
  const nIn = body.querySelector('#cr-n'), uIn = body.querySelector('#cr-u');
  const exp = body.querySelector('#cr-exp'), runs = body.querySelector('#cr-runs');
  nIn.value = s.crN || 15;
  uIn.value = s.crU || 'min';
  function clampMax() { uIn.value === 'hour' ? nIn.setAttribute('max', '23') : nIn.setAttribute('max', '59'); }
  function calc() {
    clampMax();
    let n = parseInt(nIn.value, 10);
    const unit = uIn.value;
    const lim = unit === 'hour' ? 23 : 59;
    if (!(n >= 1)) n = 1; if (n > lim) n = lim; nIn.value = n;
    patchS({ crN: n, crU: unit });
    const cron = unit === 'min' ? ('*/' + n + ' * * * *') : ('0 */' + n + ' * * *');
    exp.textContent = cron;
    const list = nextRuns(unit, n, 5);
    runs.innerHTML = list.map((d) => '• ' + esc(d.toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))).join('<br>');
  }
  nIn.addEventListener('input', calc);
  uIn.addEventListener('change', () => { calc(); });
  body.querySelector('#cr-copy').addEventListener('click', async (e) => { if (await copyText(exp.textContent)) { e.target.textContent = '✓ Копирано'; setTimeout(() => { e.target.textContent = 'Копирай cron'; }, 1500); } });
  calc();

  const search = body.querySelector('#cr-search'), codes = body.querySelector('#cr-codes');
  search.value = s.crQ || '';
  function drawCodes() {
    const q = search.value.trim().toLowerCase();
    patchS({ crQ: search.value });
    const list = HTTP_CODES.filter((x) => !q || String(x.c).includes(q) || x.t.toLowerCase().includes(q));
    codes.innerHTML = list.length
      ? list.map((x) => '<div class="ci"><span class="cc c' + String(x.c)[0] + '">' + x.c + '</span><span>' + esc(x.t) + '</span></div>').join('')
      : '<div class="stat">Няма съвпадащ код.</div>';
  }
  search.addEventListener('input', drawCodes);
  drawCodes();
}

// ── Рутер на екрана ────────────────────────────────────────────────────────
export function renderOfflineTools(ctx) {
  injectStyles();
  if (ctx && ctx.params && ctx.params.tab && TABS.some((t) => t.k === ctx.params.tab)) active = ctx.params.tab;
  const wrap = document.createElement('div');
  wrap.className = 'otools-wrap content';
  draw();
  function draw() {
    wrap.innerHTML =
      '<h2 style="margin:2px 0 4px">🧰 Офлайн инструменти</h2>' +
      '<p class="muted" style="margin:0 0 8px">Работят изцяло без интернет — обработват само въведеното от теб.</p>' +
      '<div class="mkt-tabs">' + TABS.map((tb) => '<button class="mkt-tab' + (tb.k === active ? ' active' : '') + '" data-tab="' + tb.k + '">' + esc(tb.label) + '</button>').join('') + '</div>' +
      '<div class="mkt-body" id="ot-body"></div>';
    wrap.querySelectorAll('.mkt-tab').forEach((b) => b.addEventListener('click', () => { active = b.getAttribute('data-tab'); draw(); }));
    const bodyEl = wrap.querySelector('#ot-body');
    if (active === 'format') drawFormat(bodyEl);
    else if (active === 'cron') drawCron(bodyEl);
    else drawRegex(bodyEl);
  }
  return wrap;
}
