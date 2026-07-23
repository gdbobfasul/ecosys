// Version: 1.0001
// main.js — Pupikes Medicines: сканираш опаковка (камера) → OCR взима най-едрия надпис →
// търси лекарството (онлайн openFDA + офлайн резерв) → описание + СЪСТАВКИ с цветово
// открояване на рискови (опиати/забранени/опасни при предозиране) → превод на избрания език.
// Стандартен „хром": интро → език (15) → правен гейт → медицински дисклеймър → футър.
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('pupikes-medicines');
playIntro();
startPromoAds('pupikes-medicines');
mountHelp('pupikes-medicines');
mountPrivacyLink('pupikes-medicines');
mountLegalGate('pupikes-medicines');
import './core/styles.css';
import { esc } from './core/ui.js';
import { getLang, setLang, hasLangChosen, applyDir, LANGUAGES } from './core/i18n.js';
import { APP_VERSION } from './version.js';
import { M } from './med/i18n-med.js';
import { lookupMedicine } from './med/lookup.js';

const app = document.getElementById('app');
const DISC_KEY = 'med.disclaimer.ok';

// ---------- OCR: най-едрият надпис от снимка ----------
// Tesseract се зарежда от CDN по ВРЕМЕ НА ИЗПЪЛНЕНИЕ (не влиза в бъндъла — лек APK; изисква
// интернет ПРИ първо сканиране). Ако не се зареди (офлайн/блокирано) → връща null → ръчно въвеждане.
function loadTesseract() {
  return new Promise((resolve) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}
// OCR → връща СПИСЪК от кандидати (най-едрите надписи по височина, най-голям пръв), защото
// името на лекарството невинаги е абсолютно най-едрото — така пробваме няколко, докато уцелим.
function cleanTok(s) { return String(s || '').replace(/[^A-Za-z0-9 +\-]/g, ' ').replace(/\s+/g, ' ').trim(); }
async function ocrCandidates(file) {
  const Tesseract = await loadTesseract();
  if (!Tesseract) return [];
  const url = URL.createObjectURL(file);
  try {
    const res = await Tesseract.recognize(url, 'eng');
    URL.revokeObjectURL(url);
    const data = res && res.data;
    const lines = ((data && data.lines) || [])
      .map((ln) => ({ h: ((ln.bbox || {}).y1 - (ln.bbox || {}).y0) || 0, txt: cleanTok(ln.text) }))
      .filter((x) => x.txt && x.txt.length >= 3)
      .sort((a, b) => b.h - a.h);
    const cands = [];
    for (const l of lines) { if (!cands.includes(l.txt)) cands.push(l.txt); if (cands.length >= 5) break; }
    // Резерв: първите думи от целия текст, ако редовете са празни.
    if (!cands.length) { const t = cleanTok(((data && data.text) || '').split('\n')[0]); if (t) cands.push(t); }
    return cands;
  } catch (e) { try { URL.revokeObjectURL(url); } catch (_) {} return []; }
}

// ---------- Език ----------
function renderLanguage() {
  app.innerHTML = `
    <div class="view">
      <div class="hero"><div style="font-size:2.4em">🌐</div><h1>Pupikes Medicines</h1></div>
      <div class="lang-grid" id="langgrid"></div>
      <button class="btn" id="startbtn" style="margin-top:16px">${esc(M('disclaimer_cont'))}</button>
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
      <div class="hero"><div style="font-size:2.4em">⚕️</div><h1>${esc(M('disclaimer_title'))}</h1></div>
      <div class="notice" style="line-height:1.5">${esc(M('disclaimer_body'))}</div>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:14px 2px;cursor:pointer">
        <input type="checkbox" id="agree" style="width:20px;height:20px;margin-top:2px">
        <span>${esc(M('disclaimer_agree'))}</span>
      </label>
      <button class="btn" id="cont" disabled style="opacity:.6">${esc(M('disclaimer_cont'))}</button>
    </div>`;
  const chk = app.querySelector('#agree'); const btn = app.querySelector('#cont');
  chk.addEventListener('change', () => { btn.disabled = !chk.checked; btn.style.opacity = chk.checked ? '1' : '.6'; });
  btn.addEventListener('click', () => { try { localStorage.setItem(DISC_KEY, '1'); } catch (_) {} renderHome(); });
}

// ---------- Начален екран: скенер ----------
function renderHome() {
  app.innerHTML = `
    <div class="view">
      <div class="hero">
        <button class="lang-toggle" id="langbtn">🌐</button>
        <h1>Pupikes Medicines</h1>
        <p>${esc(M('tagline'))}</p>
      </div>
      <label class="btn" id="scanlbl" style="display:block;text-align:center">
        ${esc(M('scan_btn'))}
        <input type="file" id="photo" accept="image/*" capture="environment" style="display:none">
      </label>
      <input class="search" id="name" type="text" placeholder="${esc(M('manual_ph'))}" autocomplete="off" style="margin-top:10px">
      <button class="btn" id="searchbtn" style="margin-top:10px">${esc(M('search_btn'))}</button>
      <div id="status" class="hint" style="margin-top:10px"></div>
      <div id="result" style="margin-top:12px"></div>
      <div class="notice" style="margin-top:16px;font-size:.82em;opacity:.85">${esc(M('disclaimer_title'))}: ${esc(M('disclaimer_body'))}</div>
    </div>`;
  const nameEl = app.querySelector('#name');
  const statusEl = app.querySelector('#status');
  const resultEl = app.querySelector('#result');
  app.querySelector('#langbtn').addEventListener('click', renderLanguage);

  app.querySelector('#photo').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    // ВАЖНО: нулираме стойността, за да СЕ ПУСНЕ пак 'change' при СЪЩАТА снимка (иначе втория
    // път нищо не се случва — класически бъг на <input type=file>). Затова „спираше" след 1 път.
    e.target.value = '';
    if (!file) return;
    statusEl.textContent = M('ocr_running'); resultEl.innerHTML = '';
    const cands = await ocrCandidates(file);
    if (!cands.length) { statusEl.textContent = M('ocr_none'); return; }
    // Пробваме кандидатите (най-едрият пръв) докато някой намери лекарство; ако никой — показваме
    // първия в полето, за да може потребителят да коригира ръчно.
    nameEl.value = cands[0];
    for (const c of cands) {
      statusEl.textContent = M('searching');
      let res = null; try { res = await lookupMedicine(c, getLang()); } catch (_) { res = null; }
      if (res) { nameEl.value = c; statusEl.textContent = ''; resultEl.innerHTML = renderResult(res); return; }
    }
    statusEl.textContent = ''; resultEl.innerHTML = `<div class="notice">${esc(M('not_found'))}</div>`;
  });
  app.querySelector('#searchbtn').addEventListener('click', () => doSearch(nameEl.value));
  nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(nameEl.value); });

  async function doSearch(q) {
    q = String(q || '').trim();
    if (!q) return;
    statusEl.textContent = M('searching'); resultEl.innerHTML = '';
    let res = null;
    try { res = await lookupMedicine(q, getLang()); } catch (_) { res = null; }
    statusEl.textContent = '';
    if (!res) { resultEl.innerHTML = `<div class="notice">${esc(M('not_found'))}</div>`; return; }
    resultEl.innerHTML = renderResult(res);
  }
}

// ---------- Резултат ----------
function riskLabel(risk) {
  return risk === 'opiate' ? M('risk_opiate') : risk === 'banned' ? M('risk_banned') : M('risk_danger');
}
function riskColor(risk) {
  return risk === 'opiate' ? '#e5484d' : risk === 'banned' ? '#d29922' : '#e5679b';
}
function renderResult(r) {
  const risky = (r.risky || []).map((ing) => `
    <div style="border-left:4px solid ${riskColor(ing.risk)};background:rgba(255,255,255,.03);border-radius:8px;padding:8px 10px;margin:6px 0">
      <div style="font-weight:700;color:${riskColor(ing.risk)}">${esc(ing.name)} · ${esc(riskLabel(ing.risk))}</div>
      <div style="font-size:.9em;opacity:.9">${esc(ing.consequence)}</div>
    </div>`).join('');
  const active = (r.active || []).length
    ? `<div style="margin-top:10px"><b>${esc(M('res_ingredients'))}:</b> ${esc((r.active || []).join(', '))}</div>` : '';
  const warn = r.warningsT ? `<div style="margin-top:10px"><b>${esc(M('res_warnings'))}:</b> ${esc(r.warningsT)}</div>` : '';
  return `
    <div class="card" style="display:block;text-align:left;cursor:default">
      <h3 style="margin:0 0 6px">${esc(r.title)}</h3>
      <div style="line-height:1.5">${esc(r.descriptionT || r.description || '')}</div>
      ${active}
      ${risky ? `<div style="margin-top:12px"><b>${esc(M('res_risky'))}</b>${risky}</div>` : ''}
      ${warn}
      <div style="margin-top:10px;font-size:.8em;opacity:.6">${esc(M('res_source'))}: ${esc(r.source)}</div>
    </div>`;
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
