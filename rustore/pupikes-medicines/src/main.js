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
// Пази латиница И кирилица (опаковки на bg/ru/sr) — само пунктуацията се маха.
function cleanTok(s) { return String(s || '').replace(/[^A-Za-z0-9А-Яа-яЁёІіЇїЈјЉљЊњ +\-]/g, ' ').replace(/\s+/g, ' ').trim(); }

// Предобработка на снимката преди OCR: разумен размер (уголеми дребните, смали огромните),
// сива скала + разтягане на контраста. Това чувствително подобрява четенето на надписи на
// опаковки (цветен фон, лога). Връща <canvas>; при проблем — хвърля и се пада на суровия файл.
async function preprocess(file) {
  let bmp;
  if (self.createImageBitmap) bmp = await createImageBitmap(file);
  else bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const w = bmp.width, h = bmp.height; if (!w || !h) throw new Error('no dim');
  const longest = Math.max(w, h); const MAX = 1800, MIN = 1000;
  let scale = 1; if (longest > MAX) scale = MAX / longest; else if (longest < MIN) scale = MIN / longest;
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0, cw, ch);
  try {
    const id = ctx.getImageData(0, 0, cw, ch); const p = id.data;
    for (let i = 0; i < p.length; i += 4) {
      const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      let v = (g - 128) * 1.35 + 140; v = v < 0 ? 0 : v > 255 ? 255 : v;
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    ctx.putImageData(id, 0, 0);
  } catch (_) { /* tainted canvas → оставяме цветната скала */ }
  return c;
}

// От OCR данните сглобява подредени кандидати: първо ЕДРИ ДУМИ (по височина, най-надеждни за
// името на лекарството), после цели редове (за двусловни имена), после всички дълги буквени
// токени от текста (резерв). Пробват се в тази подредба, докато уцелим лекарство.
function buildCandidates(data) {
  if (!data) return [];
  const scored = [];
  const push = (txt, h) => { const t = cleanTok(txt); if (t && t.length >= 3) scored.push({ t, h: h || 0 }); };
  for (const wd of (data.words || [])) { if ((wd.confidence || 0) < 45) continue; const bb = wd.bbox || {}; push(wd.text, (bb.y1 - bb.y0) || 0); }
  for (const ln of (data.lines || [])) { const bb = ln.bbox || {}; push(ln.text, (bb.y1 - bb.y0) || 0); }
  scored.sort((a, b) => b.h - a.h);
  // кандидат влиза само ако има буквена дума ≥4 знака (латиница ИЛИ кирилица) — маха „250"/„4 i"/„mg"
  const WORD = /[A-Za-zА-Яа-яЁё]{4,}/;
  const out = []; const add = (s) => { const v = cleanTok(s); if (v && WORD.test(v) && !out.includes(v)) out.push(v); };
  for (const s of scored) add(s.t);
  // резерв: всички буквени токени с ≥4 знака от целия текст (лови името дори при разбити редове)
  for (const m of String((data.text) || '').matchAll(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё-]{3,}/g)) add(m[0]);
  return out.slice(0, 12);
}

// OCR → списък кандидати (едри думи → редове → дълги токени). Пуска се върху ПРЕДОБРАБОТЕНАТА снимка,
// с подадения езиков пакет. Извиква се двупроходно (латиница → кирилица) от обработчика по-долу.
async function ocrCandidates(file, lang) {
  const Tesseract = await loadTesseract();
  if (!Tesseract) return [];
  let source = null, objurl = null;
  try { source = await preprocess(file); } catch (_) { objurl = URL.createObjectURL(file); source = objurl; }
  try {
    // Езиковите данни се теглят от CDN веднъж и се кешират. Кирилицата се свързва с латинската
    // база чрез транслитерация+фонетика (matchScore). Латинското INN на чужди опаковки се лови от прохода 'eng'.
    const res = await Tesseract.recognize(source, lang || 'eng');
    if (objurl) URL.revokeObjectURL(objurl);
    return buildCandidates(res && res.data);
  } catch (e) { try { if (objurl) URL.revokeObjectURL(objurl); } catch (_) {} return []; }
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
    // Отладъчен канал: какво прочете OCR-ът и какво намери базата за всеки кандидат (за диагностика).
    const dbg = { cands: [], tries: [], matched: null };
    try { window.__medDbg = dbg; } catch (_) {}
    let partial = null, partialCand = null;
    // Пробва списък кандидати; ПРЕДПОЧИТА ТОЧНО име (за да бие „Amoxicillin" случаен частичен шум).
    // Връща true при точно съвпадение (спира веднага); частичното се пази за накрая.
    const tryList = async (list) => {
      for (const c of list) {
        if (dbg.cands.indexOf(c) < 0) dbg.cands.push(c);
        if (!nameEl.value) nameEl.value = c;
        statusEl.textContent = M('searching');
        let res = null; try { res = await lookupMedicine(c, getLang()); } catch (_) { res = null; }
        try { const t = { cand: c, found: !!res, source: res && res.source, title: res && res.title, exact: !!(res && res.exact) }; dbg.tries.push(t); console.log('[MedDbg]', t); } catch (_) {}
        if (res && res.exact) { dbg.matched = c; nameEl.value = c; statusEl.textContent = ''; resultEl.innerHTML = renderResult(res); return true; }
        if (res && !partial) { partial = res; partialCand = c; }
      }
      return false;
    };
    // Разпознаване на ПИСМЕНОСТТА първо: четем с eng+bul+rus и броим кирилица срещу латиница по ВСИЧКИ
    // кандидати. Кирилска кутия = кирилицата ПРЕОБЛАДАВА (не просто няколко сбъркани знака в латинска).
    const cCyr = await ocrCandidates(file, 'eng+bul+rus');
    let cyrN = 0, latN = 0;
    for (const c of cCyr) { cyrN += (c.match(/[А-Яа-яЁё]/g) || []).length; latN += (c.match(/[A-Za-z]/g) || []).length; }
    const isCyr = cyrN > latN && cyrN >= 6;
    // Търсим по РАЗПОЗНАТАТА писменост ПЪРВО (кирилска кутия → кирилицата уцелва и връща, преди
    // латинският боклук изобщо да се пробва), а другият проход е РЕЗЕРВ (ако детекцията е сбъркала).
    const engList = async () => tryList((await ocrCandidates(file, 'eng')).filter((c) => dbg.cands.indexOf(c) < 0));
    const cyrList = async () => tryList(cCyr.filter((c) => dbg.cands.indexOf(c) < 0));
    if (isCyr) { if (await cyrList()) return; if (await engList()) return; }
    else { if (await engList()) return; if (await cyrList()) return; }
    // Няма точно → първо частично; иначе „не е намерено" / „нищо не се прочете".
    if (partial) { dbg.matched = partialCand; nameEl.value = partialCand; statusEl.textContent = ''; resultEl.innerHTML = renderResult(partial); return; }
    statusEl.textContent = '';
    resultEl.innerHTML = dbg.cands.length ? `<div class="notice">${esc(M('not_found'))}</div>` : `<div class="notice">${esc(M('ocr_none'))}</div>`;
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
