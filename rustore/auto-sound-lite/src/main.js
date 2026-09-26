import { mountLangGate as __mountLangGate } from './core/lang-gate.js';
import { LANGUAGES as __LG_L, getLang as __LG_G, setLang as __LG_S } from './core/i18n.js';
__mountLangGate({ languages: __LG_L, current: __LG_G(), setLang: __LG_S });
enforceLicense('auto-sound-diagnostics', 'rustore'); // лог на инсталация СЛЕД езика (rustore билд)
// Version: 1.0001
// main.js — Auto Sound Diagnostics: слушаш колата с микрофона, записваш звука (двигател/ходова/
// спирачки/купе) и приложението показва ВЪЗМОЖНИ причини по акустичните признаци — БЕЗ AI, всичко
// се смята на устройството. Стандартен хром: избор на език → лого-интро (Pupikes) → правен екран
// (съгласие) → апът, с лапата на Pupikes долу вляво + реклами на другите приложения.
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
import { enforceLicense } from './core/license.js';
enforceLock();
mountEcosystem('auto-sound-diagnostics');
playIntro();
startPromoAds('auto-sound-diagnostics');
mountHelp('auto-sound-diagnostics');
mountPrivacyLink('auto-sound-diagnostics');
mountLegalGate('auto-sound-diagnostics');
import './core/styles.css';
import { esc } from './core/ui.js';
import { getLang, setLang, hasLangChosen, applyDir, LANGUAGES } from './core/i18n.js';
import { APP_VERSION } from './version.js';
import { WHERE, WHEN } from './diag/data.js';
import { analyzeMic, micAvailable } from './diag/audio.js';
import { diagnose, translate } from './diag/analyze.js';
import { T, whereLabel, whenLabel, urgencyLabel } from './diag/i18n-diag.js';
import { renderToolsView } from './tools/tools.js';
import { liteRequire, openFull, isLite, fullLabel, demoNote } from './core/lite-gate.js';

const app = document.getElementById('app');
const DISC_KEY = 'asd.disclaimer.ok';
const LITE_BANNER_KEY = 'asd.lite.banner.hidden';
let selWhere = 'engine';
let selWhen = 'idle';
let diagUsed = false; // Lite: първата диагностика е безплатна, следващите водят към пълната версия

// ---------- Lite банер „Пълна версия" (само в демо билда) ----------
function liteBannerHidden() { try { return localStorage.getItem(LITE_BANNER_KEY) === '1'; } catch (_) { return false; } }
function liteBannerHTML() {
  if (!isLite() || liteBannerHidden()) return '';
  return `<div id="litebanner" class="notice" style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="flex:1">🚗 ${demoNote()}</span>
      <button class="btn sec inline" id="litefull" style="margin:0;padding:8px 12px;white-space:nowrap">${fullLabel()}</button>
      <button id="liteclose" aria-label="${esc(T('close_aria'))}" style="background:transparent;border:0;font-size:1.2em;line-height:1;cursor:pointer;color:inherit;padding:2px 6px">✕</button>
    </div>`;
}
function wireLiteBanner() {
  const lf = app.querySelector('#litefull'); if (lf) lf.addEventListener('click', () => openFull());
  const lc = app.querySelector('#liteclose'); if (lc) lc.addEventListener('click', () => {
    try { localStorage.setItem(LITE_BANNER_KEY, '1'); } catch (_) {}
    const b = app.querySelector('#litebanner'); if (b) b.remove();
  });
}

// ---------- Език ----------
function renderLanguage() {
  app.innerHTML = `
    <div class="view">
      <div class="hero"><div style="font-size:2.4em">🚗🎙️</div><h1>${esc(T('title'))}</h1></div>
      <div class="lang-grid" id="langgrid"></div>
      <button class="btn" id="startbtn" style="margin-top:16px">${esc(T('cont'))}</button>
      <div class="center" style="opacity:.55;font-size:12px;margin-top:6px">v${esc(APP_VERSION)}</div>
    </div>`;
  const cur = getLang();
  const grid = app.querySelector('#langgrid');
  grid.innerHTML = LANGUAGES.map((l) => `<button class="lang-btn${l.code === cur ? ' cur' : ''}" data-code="${l.code}">${esc(l.native)}</button>`).join('');
  const choose = (code) => { setLang(code); route(); };
  grid.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => choose(b.dataset.code)));
  app.querySelector('#startbtn').addEventListener('click', () => choose(cur));
}

// ---------- Съгласие (безопасност + отговорност) ----------
function renderDisclaimer() {
  app.innerHTML = `
    <div class="view">
      <div class="hero"><div style="font-size:2.4em">🔧</div><h1>${esc(T('disc_title'))}</h1></div>
      <div class="notice" style="line-height:1.5">${esc(T('disc_body'))}</div>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:14px 2px;cursor:pointer">
        <input type="checkbox" id="agree" style="width:20px;height:20px;margin-top:2px">
        <span>${esc(T('disc_agree'))}</span>
      </label>
      <button class="btn" id="cont" disabled style="opacity:.6">${esc(T('cont'))}</button>
    </div>`;
  const chk = app.querySelector('#agree'); const btn = app.querySelector('#cont');
  chk.addEventListener('change', () => { btn.disabled = !chk.checked; btn.style.opacity = chk.checked ? '1' : '.6'; });
  btn.addEventListener('click', () => { try { localStorage.setItem(DISC_KEY, '1'); } catch (_) {} renderHome(); });
}

function selHTML(id, values, labelFn, cur) {
  return `<select id="${id}" class="search" style="margin:4px 0 10px">` +
    values.map((v) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(labelFn(v))}</option>`).join('') + `</select>`;
}

// ---------- Горна навигация (Диагностика / Инструменти) ----------
function navTabsHTML(active) {
  return `<div class="tabs" id="navtabs">
    <button class="tab${active === 'diag' ? ' active' : ''}" data-nav="diag">🔧 ${esc(T('nav_diag'))}</button>
    <button class="tab${active === 'tools' ? ' active' : ''}" data-nav="tools">🧰 ${esc(T('nav_tools'))}</button>
  </div>`;
}
function wireNavTabs() {
  app.querySelectorAll('#navtabs [data-nav]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.nav === 'tools') renderTools(); else renderHome();
  }));
}

// ---------- Изглед „Инструменти" ----------
function renderTools() {
  window.scrollTo(0, 0);
  app.innerHTML = `<div class="view">${navTabsHTML('tools')}<div id="toolsroot"></div></div>`;
  wireNavTabs();
  renderToolsView(app.querySelector('#toolsroot'));
}

// ---------- Начален екран ----------
function renderHome() {
  app.innerHTML = `
    <div class="view">
      ${navTabsHTML('diag')}
      ${liteBannerHTML()}
      <div class="hero">
        <button class="lang-toggle" id="langbtn">🌐</button>
        <h1>${esc(T('title'))}</h1>
        <p>${esc(T('tagline'))}</p>
      </div>
      <label class="hint">${esc(T('where_label'))}</label>${selHTML('where', WHERE, whereLabel, selWhere)}
      <label class="hint">${esc(T('when_label'))}</label>${selHTML('when', WHEN, whenLabel, selWhen)}
      <button class="btn" id="recbtn" style="margin-top:6px">${esc(T('record_btn'))}</button>
      <div id="meter" style="height:10px;border-radius:6px;background:rgba(127,127,127,.18);margin:12px 0;overflow:hidden">
        <div id="meterbar" style="height:100%;width:0;background:#2f7d32;transition:width .05s linear"></div>
      </div>
      <div id="status" class="hint"></div>
      <div id="result" style="margin-top:12px"></div>
      <div class="hint" style="margin-top:14px;opacity:.8;font-size:.85em">${esc(T('tip'))}</div>
      <div class="notice" style="margin-top:8px;font-size:.8em;opacity:.85">${esc(T('disc_body'))}</div>
    </div>`;
  wireNavTabs();
  wireLiteBanner();
  app.querySelector('#langbtn').addEventListener('click', renderLanguage);
  app.querySelector('#where').addEventListener('change', (e) => { selWhere = e.target.value; });
  app.querySelector('#when').addEventListener('change', (e) => { selWhen = e.target.value; });
  // Lite: първата диагностика е свободна; следващите записи водят към пълната версия.
  app.querySelector('#recbtn').addEventListener('click', () => {
    if (diagUsed) { liteRequire('repeat', record); return; }
    record();
  });
}

async function record() {
  const statusEl = app.querySelector('#status');
  const resultEl = app.querySelector('#result');
  const bar = app.querySelector('#meterbar');
  const btn = app.querySelector('#recbtn');
  resultEl.innerHTML = '';
  if (!micAvailable()) { statusEl.textContent = T('no_mic'); return; }
  btn.disabled = true; btn.style.opacity = '.6';
  statusEl.textContent = T('recording');
  let feat = null;
  try {
    feat = await analyzeMic(4500, (lvl) => { if (bar) bar.style.width = Math.round(lvl * 100) + '%'; });
  } catch (e) {
    statusEl.textContent = T('no_mic');
    btn.disabled = false; btn.style.opacity = '1'; if (bar) bar.style.width = '0';
    return;
  }
  if (bar) bar.style.width = '0';
  statusEl.textContent = T('analyzing');
  const lang = getLang();
  const results = diagnose(feat, selWhere, selWhen);
  const cards = [];
  for (const r of results) {
    const name = await translate(r.name, lang);
    const cause = await translate(r.cause, lang);
    const advice = await translate(r.advice, lang);
    const border = r.urgency === 'urgent' ? '#e5484d' : r.urgency === 'soon' ? '#e5a54d' : '#2f7d32';
    cards.push(`
      <div class="card" style="display:block;text-align:left;cursor:default;border-left:4px solid ${border}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h3 style="margin:0">${esc(name)}</h3>
          <span style="font-size:.78em;opacity:.7;white-space:nowrap">${esc(T('confidence'))} ${Math.round(r.confidence * 100)}%</span>
        </div>
        <div style="margin-top:4px;font-size:.86em;color:${border}">${esc(urgencyLabel(r.urgency))}</div>
        <div style="margin-top:8px"><b>${esc(T('res_cause'))}:</b> ${esc(cause)}</div>
        <div style="margin-top:6px"><b>${esc(T('res_advice'))}:</b> ${esc(advice)}</div>
      </div>`);
  }
  statusEl.textContent = '';
  resultEl.innerHTML = `<div style="font-weight:700;margin:4px 0 8px">${esc(T('res_title'))}</div>` + cards.join('') +
    `<button class="btn" id="againbtn" style="margin-top:10px;background:#5b6472">${esc(T('again_btn'))}</button>`;
  const again = app.querySelector('#againbtn');
  if (again) again.addEventListener('click', () => { resultEl.innerHTML = ''; statusEl.textContent = ''; });
  btn.disabled = false; btn.style.opacity = '1';
  diagUsed = true; // Lite: маркирай, че демо диагностиката е използвана
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
