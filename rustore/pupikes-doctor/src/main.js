import { mountLangGate as __mountLangGate } from './core/lang-gate.js';
import { LANGUAGES as __LG_L, getLang as __LG_G, setLang as __LG_S } from './core/i18n.js';
__mountLangGate({ languages: __LG_L, current: __LG_G(), setLang: __LG_S });
enforceLicense('pupikes-doctor', 'rustore'); // лог на инсталация СЛЕД езика (rustore билд)
// Version: 1.0001
// main.js — Pupikes Doctor: снимаш проблема (или описваш оплаквания) + размер/болка/честота →
// показва ВЪЗМОЖНИ съвпадения (БЕЗ AI — сравнение по признаци + текст срещу база; снимковата
// референтна библиотека се включва по-късно) + съвети „какво да направиш" и „кога към лекар".
// Задължителен медицински дисклеймър в началото. Стандартен хром: интро→език(15)→правен→футър.
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
import { enforceLicense } from './core/license.js';
enforceLock();
mountEcosystem('pupikes-doctor');
playIntro();
startPromoAds('pupikes-doctor');
mountHelp('pupikes-doctor');
mountPrivacyLink('pupikes-doctor');
mountLegalGate('pupikes-doctor');
import './core/styles.css';
import { esc } from './core/ui.js';
import { getLang, setLang, hasLangChosen, applyDir, LANGUAGES } from './core/i18n.js';
import { APP_VERSION } from './version.js';
import { D, optLabel, condName, AREA_OPTS, SIZE_OPTS, PAIN_OPTS, PAINTYPE_OPTS, FREQ_OPTS } from './doc/i18n-doc.js';
import { score, translate, imageMatches, conditionText, bodyPainText, photoSignal, photoBoost } from './doc/analyze.js';
import { BODY_TYPES, renderBodySVG, causesFor, zoneLabel, EXTRA_ZONE_CHIPS } from './doc/body.js';

const app = document.getElementById('app');
const DISC_KEY = 'doc.disclaimer.ok';
let photoFile = null;

function selHTML(id, opts) {
  return `<select id="${id}" class="search" style="margin:4px 0 8px">` +
    opts.map((o) => `<option value="${esc(o.v)}">${esc(optLabel(o))}</option>`).join('') + `</select>`;
}

// Превод на най-честите дерматологични диагнози от снимковия корпус на разбираем български.
const DERMA_BG = {
  'nevus': 'бенка (невус)', 'melanoma': 'меланом', 'melanoma in situ': 'меланом (начален)',
  'melanoma invasive': 'инвазивен меланом', 'melanoma metastasis': 'меланомна метастаза',
  'seborrheic keratosis': 'себорейна кератоза', 'basal cell carcinoma': 'базоцелуларен карцином',
  'squamous cell carcinoma': 'плоскоклетъчен карцином', 'solar or actinic keratosis': 'слънчева (актинична) кератоза',
  'lichen planus like keratosis': 'кератоза', 'lentigo nos': 'лентиго (петно)', 'solar lentigo': 'слънчево петно',
  'lentigo simplex': 'лентиго', 'ink-spot lentigo': 'тъмно петно', 'dermatofibroma': 'дерматофибром',
  'hemangioma': 'хемангиом (съдово)', 'angiokeratoma': 'ангиокератом', 'neurofibroma': 'неврофибром',
  'scar': 'белег', 'verruca': 'брадавица', 'sebaceous hyperplasia': 'мастна хиперплазия',
  'clear cell acanthoma': 'акантом', 'skin lesion': 'кожна лезия', 'benign': 'доброкачествено образувание'
};
function dermaNameBg(lab) {
  const s = String(lab || '').toLowerCase().trim();
  if (DERMA_BG[s]) return DERMA_BG[s];
  if (/melanoma/.test(s)) return 'меланом';
  if (/carcinoma/.test(s)) return 'карцином (кожен)';
  if (/keratosis/.test(s)) return 'кератоза';
  if (/nevus|naevus/.test(s)) return 'бенка (невус)';
  if (/lentigo/.test(s)) return 'лентиго (петно)';
  return s;
}

// ---------- Език ----------
function renderLanguage() {
  app.innerHTML = `
    <div class="view">
      <div class="hero"><div style="font-size:2.4em">🌐</div><h1>Pupikes Doctor</h1></div>
      <div class="lang-grid" id="langgrid"></div>
      <button class="btn" id="startbtn" style="margin-top:16px">${esc(D('disclaimer_cont'))}</button>
      <div class="center" style="opacity:.55;font-size:12px;margin-top:6px">v${esc(APP_VERSION)}</div>
    </div>`;
  const cur = getLang();
  const grid = app.querySelector('#langgrid');
  grid.innerHTML = LANGUAGES.map((l) => `<button class="lang-btn${l.code === cur ? ' cur' : ''}" data-code="${l.code}">${esc(l.native)}</button>`).join('');
  const choose = (code) => { setLang(code); route(); };
  grid.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => choose(b.dataset.code)));
  app.querySelector('#startbtn').addEventListener('click', () => choose(cur));
}

// ---------- Медицински дисклеймър (еднократна отметка) ----------
function renderDisclaimer() {
  app.innerHTML = `
    <div class="view">
      <div class="hero"><div style="font-size:2.4em">⚕️</div><h1>${esc(D('disclaimer_title'))}</h1></div>
      <div class="notice" style="line-height:1.5">${esc(D('disclaimer_body'))}</div>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:14px 2px;cursor:pointer">
        <input type="checkbox" id="agree" style="width:20px;height:20px;margin-top:2px">
        <span>${esc(D('disclaimer_agree'))}</span>
      </label>
      <button class="btn" id="cont" disabled style="opacity:.6">${esc(D('disclaimer_cont'))}</button>
    </div>`;
  const chk = app.querySelector('#agree'); const btn = app.querySelector('#cont');
  chk.addEventListener('change', () => { btn.disabled = !chk.checked; btn.style.opacity = chk.checked ? '1' : '.6'; });
  btn.addEventListener('click', () => { try { localStorage.setItem(DISC_KEY, '1'); } catch (_) {} renderHome(); });
}

// ---------- Начален екран (2 режима: „Признаци/снимка" и „Къде боли") ----------
let homeMode = 'symptoms';
let bodyType = 'man';
function renderHome() {
  app.innerHTML = `
    <div class="view">
      <div class="hero">
        <button class="lang-toggle" id="langbtn">🌐</button>
        <h1>Pupikes Doctor</h1>
        <p>${esc(D('tagline'))}</p>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="btn modebtn" data-m="symptoms" style="flex:1">${esc(D('mode_symptoms'))}</button>
        <button class="btn modebtn" data-m="body" style="flex:1">${esc(D('mode_body'))}</button>
      </div>
      <div id="modehost"></div>
      <div class="notice" style="margin-top:16px;font-size:.82em;opacity:.85">${esc(D('disclaimer_title'))}: ${esc(D('disclaimer_body'))}</div>
    </div>`;
  app.querySelector('#langbtn').addEventListener('click', renderLanguage);
  const host = app.querySelector('#modehost');
  function paintMode() {
    app.querySelectorAll('.modebtn').forEach((b) => { const on = b.dataset.m === homeMode; b.style.background = on ? '#2f7d32' : ''; b.style.color = on ? '#fff' : ''; b.style.fontWeight = on ? '700' : ''; });
    if (homeMode === 'body') renderBody(host); else renderSymptoms(host);
  }
  app.querySelectorAll('.modebtn').forEach((b) => b.addEventListener('click', () => { homeMode = b.dataset.m; paintMode(); }));
  paintMode();
}

// ── Режим „Къде боли": фигура + кликаеми зони → възможни причини ──
function renderBody(host) {
  const lang = getLang();
  host.innerHTML = `
    <div class="hint" style="margin-bottom:6px">${esc(D('body_pick_type'))}</div>
    <div id="btypes" style="display:flex;gap:6px;margin-bottom:8px"></div>
    <div id="bfig"></div>
    <div class="hint" style="text-align:center;margin:4px 0">${esc(D('body_tap_hint'))}</div>
    <div class="hint">${esc(D('body_more_zones'))}</div>
    <div id="bchips" style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px"></div>
    <div id="bresult"></div>`;
  const typesEl = host.querySelector('#btypes'), fig = host.querySelector('#bfig');
  const chips = host.querySelector('#bchips'), result = host.querySelector('#bresult');
  typesEl.innerHTML = BODY_TYPES.map((t) => `<button class="btn btype" data-t="${t.id}" style="flex:1;padding:8px 4px;line-height:1.2">${t.emoji}<br><span style="font-size:.78em">${esc(t.label[lang] || t.label.en)}</span></button>`).join('');
  chips.innerHTML = EXTRA_ZONE_CHIPS.map((z) => `<button class="btn bchip" data-z="${z}" style="padding:6px 10px;font-size:.85em;background:#5b6472">${esc(zoneLabel(z, lang))}</button>`).join('');
  function paintTypes() { typesEl.querySelectorAll('.btype').forEach((b) => { const on = b.dataset.t === bodyType; b.style.background = on ? '#2f7d32' : ''; b.style.color = on ? '#fff' : ''; }); }
  function drawFig() { fig.innerHTML = renderBodySVG(bodyType); fig.querySelectorAll('.bz').forEach((el) => el.addEventListener('click', () => { fig.querySelectorAll('.bz').forEach((x) => x.style.filter = ''); el.style.filter = 'brightness(0.82)'; showZone(el.getAttribute('data-zone')); })); }
  async function showZone(zid) {
    const info = causesFor(zid, bodyType); if (!info) return;
    result.innerHTML = `<div class="hint">${esc(D('analyzing'))}</div>`;
    const title = zoneLabel(zid, lang);
    const tr = await translate('• ' + info.causes.join('\n• '), lang);
    let redHtml = '';
    if (info.red) { const rtr = await translate(info.red, lang); redHtml = `<div style="margin-top:10px;border-left:4px solid #e5484d;background:rgba(229,72,77,.08);border-radius:8px;padding:8px 10px"><b style="color:#e5484d">${esc(D('body_redflag'))}</b> ${esc(rtr)}</div>`; }
    // Авторитетен текст от онлайн пакета (Wikipedia, per език) — ако е наличен за зоната.
    let infoHtml = '';
    try { const wt = await bodyPainText(zid, lang); if (wt) infoHtml = `<div style="margin-top:10px;opacity:.9;line-height:1.5;border-top:1px solid rgba(127,127,127,.2);padding-top:8px">${esc(wt)}<div style="opacity:.55;font-size:.8em;margin-top:4px">Wikipedia</div></div>`; } catch (_) {}
    result.innerHTML = `<div class="card" style="display:block;text-align:left;cursor:default">
      <h3 style="margin:0 0 6px">${esc(title)}</h3>
      <div style="font-weight:600;margin-bottom:4px">${esc(D('body_causes_title'))}:</div>
      <div style="line-height:1.6;white-space:pre-line">${esc(tr)}</div>${redHtml}${infoHtml}</div>`;
  }
  typesEl.querySelectorAll('.btype').forEach((b) => b.addEventListener('click', () => { bodyType = b.dataset.t; paintTypes(); drawFig(); result.innerHTML = ''; }));
  chips.querySelectorAll('.bchip').forEach((b) => b.addEventListener('click', () => showZone(b.dataset.z)));
  paintTypes(); drawFig();
}

// ── Режим „Признаци / снимка" (досегашният анализатор) ──
function renderSymptoms(host) {
  host.innerHTML = `
      <label class="btn" id="photolbl" style="display:block;text-align:center">
        ${esc(D('photo_btn'))}
        <input type="file" id="photo" accept="image/*" capture="environment" style="display:none">
      </label>
      <div id="thumb" style="margin:8px 0"></div>
      <label class="hint">${esc(D('area_label'))}</label>${selHTML('area', AREA_OPTS)}
      <label class="hint">${esc(D('size_label'))}</label>${selHTML('size', SIZE_OPTS)}
      <label class="hint">${esc(D('pain_label'))}</label>${selHTML('pain', PAIN_OPTS)}
      <label class="hint">${esc(D('ptype_label'))}</label>${selHTML('ptype', PAINTYPE_OPTS)}
      <label class="hint">${esc(D('freq_label'))}</label>${selHTML('freq', FREQ_OPTS)}
      <input class="search" id="text" type="text" placeholder="${esc(D('text_ph'))}" autocomplete="off" style="margin-top:6px">
      <button class="btn" id="analyzebtn" style="margin-top:10px">${esc(D('analyze_btn'))}</button>
      <div id="status" class="hint" style="margin-top:10px"></div>
      <div id="result" style="margin-top:12px"></div>`;
  const statusEl = host.querySelector('#status');
  const resultEl = host.querySelector('#result');
  host.querySelector('#photo').addEventListener('change', (e) => {
    photoFile = e.target.files && e.target.files[0];
    e.target.value = '';   // да се пусне пак 'change' при СЪЩАТА снимка
    const thumb = host.querySelector('#thumb');
    if (photoFile) { const u = URL.createObjectURL(photoFile); thumb.innerHTML = `<img src="${u}" style="max-width:100%;max-height:220px;border-radius:12px">`; }
  });
  host.querySelector('#analyzebtn').addEventListener('click', analyze);

  async function analyze() {
    const input = {
      area: app.querySelector('#area').value,
      size: parseInt(app.querySelector('#size').value, 10) || 0,
      painLevel: parseInt(app.querySelector('#pain').value, 10) || 0,
      freq: app.querySelector('#freq').value,
      text: app.querySelector('#text').value
    };
    statusEl.textContent = D('analyzing'); resultEl.innerHTML = '';
    // Снимката се сравнява с числовия опис на ~22 000 дерматологични снимки (без да ги носим).
    // imageMatches връща { conds, top, dermat }: conds=състояния за първа помощ, top=най-близки
    // диагнози от корпуса, dermat=прилича на кожно образувание/бенка (изисква дерматолог).
    let im = { conds: [], top: [], dermat: false };
    try { const r = await imageMatches(photoFile); if (r) im = r; } catch (_) {}
    const imgHits = im.conds || [];
    // Анализ на снимката: център-изрязване + цветови сигнал → подсказва вероятни състояния.
    let boosts = {}; try { const sig = await photoSignal(photoFile); boosts = photoBoost(sig); } catch (_) {}
    let matches = score(input, boosts);
    // Съюз без дубли. РЕД според УВЕРЕНОСТТА на корпуса: при СИЛНО съвпадение (много от най-близките
    // сочат едно състояние) водят снимковите съвпадения; при СЛАБО/двусмислено (напр. следоперативна
    // рана — няма аналог в дерматологичния корпус) водят цветовите/текстовите състояния (рана/разрез/
    // натъртване от сигнала), за да не показваме уверено грешна дерматологична диагноза.
    const seen = new Set();
    const ordered = im.strong ? [...imgHits, ...matches] : [...matches, ...imgHits];
    const all = ordered.filter((c) => c && !seen.has(c.id) && seen.add(c.id));
    const lang = getLang();
    // Дерматологичен банер — САМО при силно съвпадение (иначе е гадаене върху случайни съседи).
    let dermaCard = '';
    if (im.dermat && im.strong && im.top && im.top.length) {
      const names = im.top.slice(0, 4).map((t) => dermaNameBg(t.label)).filter((v, i, a) => v && a.indexOf(v) === i);
      const bg = `Снимката прилича на кожно образувание (бенка/лезия). Такива се преглеждат от дерматолог. Ако образуванието бързо променя размер или цвят, има неравни ръбове, сърби, кърви или не зараства — потърси лекар скоро.`;
      const warn = await translate(bg, lang);
      const near = await translate('Най-близки от базата: ' + names.join(', '), lang);
      dermaCard = `
        <div class="card" style="display:block;text-align:left;cursor:default;border-left:3px solid #e5a54d">
          <h3 style="margin:0 0 6px">🔬 ${esc(await translate('Кожно образувание', lang))}</h3>
          <div style="opacity:.92;line-height:1.5">${esc(warn)}</div>
          ${names.length ? `<div style="margin-top:8px;opacity:.7;font-size:.9em">${esc(near)}</div>` : ''}
        </div>`;
    }
    if (!all.length && !dermaCard) { statusEl.textContent = ''; resultEl.innerHTML = `<div class="notice">${esc(D('no_match'))}</div>`; return; }
    // Превод на съветите на избрания език.
    const cards = [];
    for (const c of all) {
      const advice = await translate(c.advice, lang);
      const seeDoc = await translate(c.seeDoctor, lang);
      const info = await conditionText(c.id, lang);   // автентичен per-език текст от медицинската статия
      cards.push(`
        <div class="card" style="display:block;text-align:left;cursor:default">
          <h3 style="margin:0 0 6px">${esc(condName(c.id))}</h3>
          ${info ? `<div style="margin-top:2px;opacity:.92;line-height:1.5">${esc(info)}</div>` : ''}
          <div style="margin-top:8px"><b>${esc(D('res_advice'))}:</b> ${esc(advice)}</div>
          <div style="margin-top:8px;color:#e5a54d"><b>${esc(D('res_seedoctor'))}:</b> ${esc(seeDoc)}</div>
        </div>`);
    }
    statusEl.textContent = '';
    resultEl.innerHTML = `<div style="font-weight:700;margin:4px 0 8px">${esc(D('res_title'))}</div>` + cards.join('');
  }
}

// ---------- Рутер ----------
function route() {
  window.scrollTo(0, 0);
  if (!hasLangChosen()) return renderLanguage();
  let ok = false; try { ok = localStorage.getItem(DISC_KEY) === '1'; } catch (_) {}
  if (!ok) return renderDisclaimer();
  renderHome();
}

applyDir();
route();
