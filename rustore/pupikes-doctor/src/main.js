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
import { D, optLabel, condName, AREA_OPTS, SIZE_OPTS, PAIN_OPTS, FREQ_OPTS } from './doc/i18n-doc.js';
import { score, translate, imageMatches, conditionText } from './doc/analyze.js';

const app = document.getElementById('app');
const DISC_KEY = 'doc.disclaimer.ok';
let photoFile = null;

function selHTML(id, opts) {
  return `<select id="${id}" class="search" style="margin:4px 0 8px">` +
    opts.map((o) => `<option value="${esc(o.v)}">${esc(optLabel(o))}</option>`).join('') + `</select>`;
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

// ---------- Начален екран: анализатор ----------
function renderHome() {
  app.innerHTML = `
    <div class="view">
      <div class="hero">
        <button class="lang-toggle" id="langbtn">🌐</button>
        <h1>Pupikes Doctor</h1>
        <p>${esc(D('tagline'))}</p>
      </div>
      <label class="btn" id="photolbl" style="display:block;text-align:center">
        ${esc(D('photo_btn'))}
        <input type="file" id="photo" accept="image/*" capture="environment" style="display:none">
      </label>
      <div id="thumb" style="margin:8px 0"></div>
      <label class="hint">${esc(D('area_label'))}</label>${selHTML('area', AREA_OPTS)}
      <label class="hint">${esc(D('size_label'))}</label>${selHTML('size', SIZE_OPTS)}
      <label class="hint">${esc(D('pain_label'))}</label>${selHTML('pain', PAIN_OPTS)}
      <label class="hint">${esc(D('freq_label'))}</label>${selHTML('freq', FREQ_OPTS)}
      <input class="search" id="text" type="text" placeholder="${esc(D('text_ph'))}" autocomplete="off" style="margin-top:6px">
      <button class="btn" id="analyzebtn" style="margin-top:10px">${esc(D('analyze_btn'))}</button>
      <div id="status" class="hint" style="margin-top:10px"></div>
      <div id="result" style="margin-top:12px"></div>
      <div class="notice" style="margin-top:16px;font-size:.82em;opacity:.85">${esc(D('disclaimer_title'))}: ${esc(D('disclaimer_body'))}</div>
    </div>`;
  const statusEl = app.querySelector('#status');
  const resultEl = app.querySelector('#result');
  app.querySelector('#langbtn').addEventListener('click', renderLanguage);
  app.querySelector('#photo').addEventListener('change', (e) => {
    photoFile = e.target.files && e.target.files[0];
    const thumb = app.querySelector('#thumb');
    if (photoFile) { const u = URL.createObjectURL(photoFile); thumb.innerHTML = `<img src="${u}" style="max-width:100%;max-height:220px;border-radius:12px">`; }
  });
  app.querySelector('#analyzebtn').addEventListener('click', analyze);

  async function analyze() {
    const input = {
      area: app.querySelector('#area').value,
      size: parseInt(app.querySelector('#size').value, 10) || 0,
      painLevel: parseInt(app.querySelector('#pain').value, 10) || 0,
      freq: app.querySelector('#freq').value,
      text: app.querySelector('#text').value
    };
    statusEl.textContent = D('analyzing'); resultEl.innerHTML = '';
    // Снимкова библиотека (когато е свалена) → съвпадения по изображение; засега [].
    let imgHits = []; try { imgHits = await imageMatches(photoFile); } catch (_) {}
    let matches = score(input);
    // Съюз: първо снимковите съвпадения, после по признаци (без дубли).
    const seen = new Set();
    const all = [...imgHits, ...matches].filter((c) => c && !seen.has(c.id) && seen.add(c.id));
    if (!all.length) { statusEl.textContent = ''; resultEl.innerHTML = `<div class="notice">${esc(D('no_match'))}</div>`; return; }
    // Превод на съветите на избрания език.
    const lang = getLang();
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
