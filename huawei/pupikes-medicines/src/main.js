import { mountLangGate as __mountLangGate } from './core/lang-gate.js';
import { LANGUAGES as __LG_L, getLang as __LG_G, setLang as __LG_S } from './core/i18n.js';
__mountLangGate({ languages: __LG_L, current: __LG_G(), setLang: __LG_S });
enforceLicense('pupikes-medicines', 'huawei'); // лог на инсталация СЛЕД езика (huawei билд)
// Version: 1.0024
// main.js — Pupikes Medicines: сканираш опаковка (камера) → 1) БАРКОД НА УСТРОЙСТВОТО (v1.0024: EAN-13/UPC/
// DataMatrix/QR → GTIN → вграден регистър ~100 000 продукта, gtin-db.json; онлайн резерв openFDA по UPC) →
// 2) OCR НА УСТРОЙСТВОТО (вграден tesseract пакет: латиница „точен" модел + бързи кирилица/китайски; 2 бинаризации,
// увеличение на дребен текст, вертикален CJK) → изравняване (deskew v2) → кандидати за име → вградена база (~580
// лекарства, имена на 15 езика) + ГОЛЯМ РЕЧНИК (~48 000 имена, drug-names.json) + онлайн шардове на сървъра (8000,
// pupikes.app/medikit) + openFDA → описание, СЪСТАВКИ, листовка, рискови съставки, превод. НИКОГА празен резултат (v1.0023): ако не
// разпознае — карта с разчетения текст, кандидати за име с едно докосване, тип от дребния текст и „Търси по това име".
// Табове (4.1): Сканирай · Взаимодействия (таблица между 2 лекарства) · Дозировка (калкулатор ОТС по
// тегло/възраст) · График (напомняния през местни известия). „Пробвай с примерна опаковка" — 3 реални снимки.
// Стандартен „хром": интро → език (15) → правен гейт → медицински дисклеймър → футър.
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
import { enforceLicense } from './core/license.js';
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
import { M, MF } from './med/i18n-med.js';
import { classify as classifyHints, describe as describeHints, ocrLangsFor, ocrLangsCjk, OCR_BUNDLED, OCR_BEST, hasCjk } from './med/hints.js';
import { estimateSkew, rotateAny } from './med/deskew.js';
import { lookupMedicine } from './med/lookup.js';
import { strongNameMatch } from './med/data.js';
import { candidatesFromText, loadMedDb } from './med/meddb.js';
import { decodeBarcode } from './med/barcode.js';
import { lookupGtin, lookupGtinOnline, gtinQueries, gtinToResult, loadGtinDb } from './med/gtin.js';
import { loadNames } from './med/names.js';
import { leafletLinks, openExternal } from './med/links.js';
import { syncEnabled, setSyncEnabled, pullUpdates, medikitLookup, learn as syncLearn } from './med/sync.js';
import { checkInteractions, RULE_COUNT, GROUP_COUNT } from './med/interactions.js';
import { OTC, calcDose, otcName } from './med/dosing.js';
import { listSchedule, saveEntry, deleteEntry, isTaken, markTaken, restoreTimers, nextDose } from './med/schedule.js';

const app = document.getElementById('app');
const DISC_KEY = 'med.disclaimer.ok';
const TAB_KEY = 'med.tab';
// Примерни опаковки (реални снимки от тестовия стенд private/medikit-harvester/testsets/meds — трите с най-висока
// успеваемост на разпознаването: 12/12, 10/12, 10/12 пускания на стенда).
const SAMPLES = [
  { file: 'samples/amoxicillin.jpg', label: 'Amoxicillin 500 mg capsules' },
  { file: 'samples/aspirin.png', label: 'Aspirin 81 mg (Bayer, EN/FR)' },
  { file: 'samples/diclofenac.jpg', label: 'Diclofenac Kalium 12,5 mg (NL)' },
  // v1.0024: примерна опаковка с БАРКОД (истински UPC на Claritin от openFDA NDC) — минава през регистъра, без OCR
  { file: 'samples/barcode-claritin.png', label: 'Claritin 10 mg — barcode (UPC)' }
];

// ---------- OCR: ВГРАДЕН tesseract.js (public/ocr) — работи без интернет ----------
// v1.0023: библиотеката, ядрото (WASM) и езиковите модели eng/bul/rus/chi_sim/chi_tra са В АПА (tessdata_fast).
// CDN-ът остава само резерв за библиотеката и за НЕвградените езици (deu/fra/jpn…); ако те не се заредят
// (Китай), падаме на вградените пакети. Работниците се пазят по езиков низ (не се създават на всеки етап).
const OCR_BASE = (() => { try { return new URL('ocr/', document.baseURI).href; } catch (_) { return 'ocr/'; } })();
function loadTesseract() {
  return new Promise((resolve) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    const tryUrl = (src, next) => { const s = document.createElement('script'); s.src = src; s.onload = () => resolve(window.Tesseract || null); s.onerror = next; document.head.appendChild(s); };
    tryUrl(OCR_BASE + 'tesseract.min.js', () => tryUrl('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', () => resolve(null)));
  });
}
// v1.0024: „точният" модел (tessdata_best eng, 12,8 MB) беше пробван на стенда като допълнителен пас — без измерима
// полза за размера си → МАХНАТ (апът остава компактен). Кодът за езиков низ с наставка „@best" остава изключен
// (USE_BEST=false; ако някога се добави модел в public/ocr/lang-best и OCR_BEST, се включва оттук).
const USE_BEST = false;
function ocrOpts(lang) {
  const best = /@best$/.test(lang); const packs = String(lang).replace(/@best$/, '').split('+');
  const local = packs.every((l) => OCR_BUNDLED.includes(l));
  const useBest = best && local && packs.every((l) => OCR_BEST.includes(l));
  return { workerPath: OCR_BASE + 'worker.min.js', corePath: OCR_BASE, langPath: useBest ? OCR_BASE + 'lang-best' : local ? OCR_BASE + 'lang' : 'https://tessdata.projectnaptha.com/4.0.0_fast', workerBlobURL: false, gzip: true };
}
// Свежда езиков низ до само ВГРАДЕНИТЕ пакети (резерв без мрежа).
function bundledOnly(lang) { const l = String(lang).split('+').filter((x) => OCR_BUNDLED.includes(x)); return l.length ? l.join('+') : 'eng'; }
const WORKERS = {};
async function getWorker(lang) {
  if (WORKERS[lang]) return WORKERS[lang];
  const T = await loadTesseract(); if (!T || !T.createWorker) return null;
  const packs = String(lang).replace(/@best$/, '');
  try { WORKERS[lang] = await T.createWorker(packs, 1, ocrOpts(lang)); return WORKERS[lang]; }
  catch (_) {
    const b = bundledOnly(packs); if (b === lang) return null;
    if (WORKERS[b]) return WORKERS[b];
    try { WORKERS[b] = await T.createWorker(b, 1, ocrOpts(b)); WORKERS[lang] = WORKERS[b]; return WORKERS[b]; } catch (__) { return null; }
  }
}
// Пази латиница И кирилица (опаковки на bg/ru/sr) + CJK — само пунктуацията се маха.
function cleanTok(s) { return String(s || '').replace(/[^A-Za-z0-9А-Яа-яЁёІіЇїЈјЉљЊњ぀-ヿ㐀-鿿 +\-]/g, ' ').replace(/\s+/g, ' ').trim(); }

// Предобработка на снимката преди OCR: разумен размер (уголеми дребните, смали огромните),
// сива скала + разтягане на контраста. Връща <canvas>; при проблем — хвърля и се пада на суровия файл.
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
// v1.0024: БИНАРИЗАЦИЯ преди OCR — tesseract прави само глобален Otsu, който губи текст върху цветни/сенчести
// опаковки. Адаптивен праг (средно в прозорец ~1/40 от страната, минус C) дава чисти черно-бели букви и при
// неравномерна светлина; дребният текст се УВЕЛИЧАВА ×2 (до 2400 px), защото LSTM моделът иска ~30 px височина.
// mode: 'adaptive' | 'otsu'. Връща нов <canvas>; при грешка (tainted) — null.
function binarize(src, mode) {
  try {
    const w0 = src.width, h0 = src.height; const longest = Math.max(w0, h0);
    const scale = longest < 1300 ? Math.min(2, 2400 / longest) : 1;
    const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h); const p = id.data; const n = w * h;
    const g = new Uint8Array(n); for (let i = 0, j = 0; i < p.length; i += 4, j++) g[j] = (p[i] * 77 + p[i + 1] * 151 + p[i + 2] * 28) >> 8;
    let thrAt;
    if (mode === 'otsu') {
      const hist = new Uint32Array(256); for (let i = 0; i < n; i++) hist[g[i]]++;
      let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
      let sumB = 0, wB = 0, best = 0, thr = 128;
      for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; thr = t; } }
      thrAt = () => thr;
    } else {
      // интегрално изображение → средно в прозорец за O(1) на пиксел
      const R = Math.max(8, Math.round(Math.max(w, h) / 40)); const C = 10;
      const I = new Float64Array((w + 1) * (h + 1));
      for (let y = 1; y <= h; y++) { let row = 0; for (let x = 1; x <= w; x++) { row += g[(y - 1) * w + (x - 1)]; I[y * (w + 1) + x] = I[(y - 1) * (w + 1) + x] + row; } }
      thrAt = (x, y) => { const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1); const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]; return s / ((x1 - x0) * (y1 - y0)) - C; };
    }
    for (let y = 0, j = 0; y < h; y++) for (let x = 0; x < w; x++, j++) { const v = g[j] > thrAt(x, y) ? 255 : 0; const i = j * 4; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
    ctx.putImageData(id, 0, 0);
    return c;
  } catch (_) { return null; }
}

// От OCR данните сглобява подредени кандидати: първо ЕДРИ ДУМИ (по височина), после цели редове,
// после всички дълги буквени токени от текста (резерв). Пробват се в тази подредба, докато уцелим лекарство.
function buildCandidates(data) {
  if (!data) return [];
  const scored = [];
  const push = (txt, h) => { const t = cleanTok(txt); if (t && t.length >= 3) scored.push({ t, h: h || 0 }); };
  for (const wd of (data.words || [])) { if ((wd.confidence || 0) < 45) continue; const bb = wd.bbox || {}; push(wd.text, (bb.y1 - bb.y0) || 0); }
  for (const ln of (data.lines || [])) { const bb = ln.bbox || {}; push(ln.text, (bb.y1 - bb.y0) || 0); }
  scored.sort((a, b) => b.h - a.h);
  const WORD = /[A-Za-zА-Яа-яЁё]{4,}|[぀-ヿ㐀-鿿]{2,}/;
  const DRUG_SUFFIX = /(ol|in|ine|cillin|mycin|pril|sartan|olol|azole|fen|mide|pam|lam|statin|profen|amol|cet|zin|zine|dine|tidine|mab|vir|zolam|oxin|cin|tin|xin|ide|ate|ил|ин|ол|цин|зол|фен|мид|пам|там|ин|ат)$/i;
  const wordScored = [];
  for (const s of scored) for (const w of s.t.split(/\s+/)) { if (/^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё-]{4,}$/.test(w)) wordScored.push({ t: w, h: s.h + (DRUG_SUFFIX.test(w) ? 40 : 0) + (w.length >= 7 ? 10 : 0) }); else if (/^[぀-ヿ㐀-鿿]{2,8}$/.test(w)) wordScored.push({ t: w, h: s.h + 20 }); }
  wordScored.sort((a, b) => b.h - a.h);
  const out = []; const add = (s) => { const v = cleanTok(s); if (v && WORD.test(v) && !out.includes(v)) out.push(v); };
  for (const s of wordScored) add(s.t);
  for (const s of scored) add(s.t);
  for (const m of String((data.text) || '').matchAll(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё-]{3,}|[぀-ヿ㐀-鿿]{2,8}/g)) add(m[0]);
  return out.slice(0, 16);
}

// Завърта <canvas> на ПРОИЗВОЛЕН ъгъл (платното се уголемява до обхващащия правоъгълник).
function rotateCanvas(src, deg) {
  const w = src.width, h = src.height;
  const rad = deg * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const rc = document.createElement('canvas');
  rc.width = Math.max(1, Math.round(w * cos + h * sin));
  rc.height = Math.max(1, Math.round(w * sin + h * cos));
  const ctx = rc.getContext('2d');
  ctx.translate(rc.width / 2, rc.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -w / 2, -h / 2);
  return rc;
}

// OCR върху готов източник с подадения езиков пакет → списък кандидати. Работникът се преизползва.
// opts.psm: режим на сегментиране (v1.0024: 5 = ВЕРТИКАЛЕН блок текст — китайски/японски опаковки); връща се към 3.
async function ocrOn(src, lang, opts) {
  const w = await getWorker(lang);
  if (!w || !src) return [];
  const psm = opts && opts.psm;
  try { if (psm) { try { await w.setParameters({ tessedit_pageseg_mode: String(psm) }); } catch (_) {} }
    const res = await w.recognize(src);
    if (psm) { try { await w.setParameters({ tessedit_pageseg_mode: '3' }); } catch (_) {} }
    try { const txt = String((res && res.data && res.data.text) || ''); if (txt.trim()) { window.__medText = (window.__medText || '') + '\n' + txt; window.__medConf = Math.max(window.__medConf || 0, (res.data.confidence || 0)); } } catch (_) {}
    return (buildCandidates(res && res.data) || []).slice(0, 14); }
  catch (_) { delete WORKERS[lang]; return []; }
}

// ---------- ГЕЙТ ЗА ПРАВДОПОДОБНОСТ на разпознат кандидат (Huawei: по-малко ГРЕШНИ резултати) ----------
// Модераторите се оплакват от ГРЕШНО разпознати лекарства: къс/шумен OCR-фрагмент („hire", „eeet", „Sage"),
// обща английска дума („Strong") или фрагмент, който само ПРЕФИКСНО улучва по-дълго лекарство („проза"→Prozac,
// „cetam"→Ketamine) минаваше за „точно" съвпадение → показваше грешно лекарство. Този гейт приема УВЕРЕНО
// съвпадение при сканиране само ако прочетеното наистина ПРИЛИЧА на върнатото лекарство. Дългите нормални
// имена минават както преди; блокира се само късото/общото/префиксното. При отказ падаме честно на „не е
// разпознато" (по-добре, отколкото грешно име). Ръчното търсене (потребителят е написал името) НЕ се гейтва.
const COMMON_WORDS = new Set(['strong', 'sage', 'honey', 'lemon', 'mint', 'gold', 'care', 'plus', 'forte', 'fresh', 'pure', 'herbal', 'relief', 'extra', 'super', 'ultra', 'daily', 'active', 'value', 'maximum', 'original', 'natural', 'power', 'fast', 'cool', 'warm', 'clean', 'sensitive', 'complete', 'advance', 'total', 'medical', 'health', 'life', 'green', 'blue', 'white']);
const KNOWN_SHORT = new Set(['acc', 'nospa', 'tums', 'bcaa', 'msm', 'zma', 'k2']);   // истински къси имена (не се блокират по дължина)
function scanNames(r) { return [r && r.title, r && r.inn, r && r.matchedName, r && r.localName].concat((r && r.otherNames) || [], (r && r.active) || []); }
function plausibleScanHit(c, r) {
  const cc = String(c || '').trim();
  if (/[぀-ヿ㐀-鿿]/.test(cc)) return true;                          // CJK — обработва се отделно, не гейтваме
  const nq = cc.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '');
  if (!nq) return false;
  if (COMMON_WORDS.has(nq)) return false;                          // обща дума → не е лекарство
  if (nq.length < 5 && !KNOWN_SHORT.has(nq)) return false;         // твърде къс фрагмент (hire/eeet/Sage)
  if (nq.length <= 6 && !KNOWN_SHORT.has(nq)) return strongNameMatch(cc, scanNames(r));   // къс → трябва да ПРИЛИЧА на върнатото име
  return true;                                                     // дълго и нормално → приемаме както преди
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

// ---------- Начален екран: табове ----------
const TABS = [['scan', 'tab_scan'], ['inter', 'tab_inter'], ['dose', 'tab_dose'], ['sched', 'tab_sched']];
let curTab = 'scan';
let prefill = { inter: '', sched: null };   // пренос от резултата към другите табове
function renderHome(tab) {
  if (tab) curTab = tab; else { try { curTab = localStorage.getItem(TAB_KEY) || 'scan'; } catch (_) {} }
  if (!TABS.some((t) => t[0] === curTab)) curTab = 'scan';
  try { localStorage.setItem(TAB_KEY, curTab); } catch (_) {}
  app.innerHTML = `
    <div class="view">
      <div class="hero">
        <button class="lang-toggle" id="langbtn">🌐</button>
        <h1>Pupikes Medicines</h1>
        <p>${esc(M('tagline'))}</p>
      </div>
      <div class="tabs" id="tabs" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${TABS.map(([id, k]) => `<button class="tab${id === curTab ? ' active' : ''}" data-tab="${id}">${esc(M(k))}</button>`).join('')}</div>
      <div id="tabview"></div>
      <div class="notice" style="margin-top:16px;font-size:.82em;opacity:.85">${esc(M('disclaimer_title'))}: ${esc(M('disclaimer_body'))}</div>
    </div>`;
  app.querySelector('#langbtn').addEventListener('click', renderLanguage);
  app.querySelectorAll('#tabs .tab').forEach((b) => b.addEventListener('click', () => renderHome(b.dataset.tab)));
  const view = app.querySelector('#tabview');
  if (curTab === 'inter') renderInter(view);
  else if (curTab === 'dose') renderDose(view);
  else if (curTab === 'sched') renderSched(view);
  else renderScan(view);
  window.scrollTo(0, 0);
}

// ---------- Таб: скенер ----------
function renderScan(view) {
  view.innerHTML = `
      <label class="btn" id="scanlbl" style="display:block;text-align:center;margin-top:0">
        ${esc(M('scan_btn'))}
        <input type="file" id="photo" accept="image/*" capture="environment" style="display:none">
      </label>
      <button class="btn sec" id="samplebtn" style="margin-top:8px">${esc(M('sample_btn'))}</button>
      <div id="samples" style="display:none;margin-top:8px">
        <div class="hint">${esc(M('sample_pick'))}</div>
        <div style="display:flex;gap:8px;margin-top:6px">${SAMPLES.map((s, i) => `<button class="sample-card" data-i="${i}" style="flex:1;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--bg-2);cursor:pointer;color:var(--text)"><img src="${esc(s.file)}" alt="" style="width:100%;height:80px;object-fit:cover;border-radius:6px"><div style="font-size:.72em;margin-top:4px">${esc(s.label)}</div></button>`).join('')}</div>
      </div>
      <input class="search" id="name" type="text" placeholder="${esc(M('manual_ph'))}" autocomplete="off" style="margin-top:10px">
      <button class="btn" id="searchbtn" style="margin-top:10px">${esc(M('search_btn'))}</button>
      <div class="hint">${esc(M('scan_barcode_hint'))}</div>
      <div class="hint">${esc(M('ocr_offline'))}</div>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:10px 2px 0;cursor:pointer">
        <input type="checkbox" id="syncchk" style="width:20px;height:20px;margin-top:2px;flex:0 0 auto"${syncEnabled() ? ' checked' : ''}>
        <span><b>${esc(M('sync_title'))}</b><div class="hint" style="margin-top:4px">${esc(M('sync_desc'))}</div></span>
      </label>
      <div id="status" class="hint" style="margin-top:10px"></div>
      <div id="result" style="margin-top:12px"></div>`;
  const nameEl = view.querySelector('#name');
  const statusEl = view.querySelector('#status');
  const resultEl = view.querySelector('#result');
  view.querySelector('#samplebtn').addEventListener('click', () => { const s = view.querySelector('#samples'); s.style.display = s.style.display === 'none' ? 'block' : 'none'; });
  view.querySelectorAll('.sample-card').forEach((b) => b.addEventListener('click', async () => {
    const s = SAMPLES[parseInt(b.dataset.i, 10)]; if (!s) return;
    view.querySelector('#samples').style.display = 'none';   // панелът се прибира → резултатът е видим
    statusEl.textContent = M('ocr_running'); resultEl.innerHTML = '';
    try { const r = await fetch(s.file); const blob = await r.blob(); await runScan(new File([blob], s.file.split('/').pop(), { type: blob.type || 'image/jpeg' })); }
    catch (_) { statusEl.textContent = ''; resultEl.innerHTML = `<div class="notice">${esc(M('ocr_none'))}</div>`; }
  }));
  view.querySelector('#photo').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    // ВАЖНО: нулираме стойността, за да СЕ ПУСНЕ пак 'change' при СЪЩАТА снимка.
    e.target.value = '';
    if (!file) return;
    await runScan(file);
  });
  view.querySelector('#searchbtn').addEventListener('click', () => doSearch(nameEl.value));
  nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(nameEl.value); });
  loadMedDb().catch(() => {});   // загрява вградената база (за кандидатите)
  loadGtinDb().catch(() => {}); loadNames().catch(() => {});   // v1.0024: регистър по баркод + голям речник (веднъж)
  // v1.0024: настройка „Свързване със сървъра" (по избор, изключена по подразбиране); при включена — делта ВЕДНЪЖ на пускане
  view.querySelector('#syncchk').addEventListener('change', (e) => setSyncEnabled(!!e.target.checked));
  pullUpdates(false).catch(() => {});

  function showResult(r, extraCands) {
    resultEl.innerHTML = renderResult(r) + (extraCands && extraCands.length > 1 ? candChips(extraCands, M('did_you_mean')) : '');
    bindResult(resultEl, r);
  }
  function candChips(cands, title) {
    return `<div style="margin-top:10px"><div class="hint" style="margin-bottom:6px">${esc(title)}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${cands.map((c) => `<button class="tab cand" data-name="${esc(c.name)}" style="flex:0 1 auto;min-width:0">${esc(c.name)}${c.item && c.item.inn && c.item.inn.toLowerCase() !== c.name.toLowerCase() ? ` <span style="opacity:.7;font-weight:400">· ${esc(c.item.inn)}</span>` : ''}</button>`).join('')}</div></div>`;
  }
  function bindResult(root, r) {
    // кандидат с едно докосване = потвърждение от потребителя → (при включена настройка) анонимно учене на сървъра
    root.querySelectorAll('.cand').forEach((b) => b.addEventListener('click', () => { nameEl.value = b.dataset.name; doSearch(b.dataset.name, { confirmed: true }); }));
    root.querySelectorAll('.leaflet-link').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openExternal(a.dataset.url); }));
    const bi = root.querySelector('#to-inter'); if (bi) bi.addEventListener('click', () => { prefill.inter = (r && (r.inn || r.title)) || nameEl.value; renderHome('inter'); });
    const bs = root.querySelector('#to-sched'); if (bs) bs.addEventListener('click', () => { prefill.sched = { name: (r && r.title) || nameEl.value }; renderHome('sched'); });
    const sb = root.querySelector('#search-by'); if (sb) sb.addEventListener('click', () => { const q = sb.dataset.name || nameEl.value; nameEl.value = q; doSearch(q); });
  }
  // КАРТА „НЕ Е РАЗПОЗНАТО" (Huawei 3.1 — никога празен резултат): изчистен текст, кандидати от вградената
  // база с едно докосване, тип от дребния текст, „Търси по това име".
  async function renderUnknownCard(rawText, ocrCands) {
    const text = String(rawText || '').replace(/[^\S\n]+/g, ' ').replace(/\n{2,}/g, '\n').split('\n').map((l) => l.trim()).filter((l) => /[A-Za-zА-Яа-яЁё぀-ヿ㐀-鿿]{3,}/.test(l)).slice(0, 12).join('\n').slice(0, 500);
    let cands = []; try { cands = await candidatesFromText(rawText + '\n' + (ocrCands || []).join('\n'), 6); } catch (_) { cands = []; }
    const hint = hintsLine();
    const top = cands[0] ? cands[0].name : (ocrCands && ocrCands[0]) || '';
    const bc = barcodeLine(window.__medBarcode, true);
    return `<div class="card" style="display:block;text-align:left;cursor:default">
        <h3 style="margin:0 0 6px">${esc(M('card_unknown_title'))}</h3>${bc}
        ${text ? `<div style="margin-top:6px"><b>${esc(M('card_text'))}:</b><div style="white-space:pre-wrap;font-size:.88em;opacity:.9;margin-top:4px;line-height:1.4">${esc(text)}</div></div>` : ''}
        ${hint}
        ${cands.length ? candChips(cands, M('card_cands')) : `<div class="hint" style="margin-top:8px">${esc(M('card_none_cands'))}</div>`}
        ${top ? `<button class="btn" id="search-by" data-name="${esc(top)}" style="margin-top:12px">${esc(M('card_search_by'))} · ${esc(top)}</button>` : ''}
      </div>`;
  }

  async function runScan(file) {
    statusEl.textContent = M('ocr_running'); resultEl.innerHTML = '';
    // Отладъчен канал (тестовият стенд чете window.__medDbg).
    const dbg = { cands: [], tries: [], matched: null, angles: [] };
    try { window.__medDbg = dbg; } catch (_) {}
    let partial = null, partialCand = null;
    const NOT_DRUG = /^(headache|headaches|tablets|tablet|capsules|capsule|relief|reliever|fever|pain|coated|effective|strength|extra|maximum|regular|rapid|release|contains|contain|hours|adults|children|caution|warning|directions|dosage|store|keep|reach|medicine|pharma|pharmacy|health|formula|natural|original|classic|comprimes|comprimidos|tabletten|gelules|таблетки|капсули|капсулы|инструкция|применение|состав|показания|упаковка|опаковка|листовка)$/i;
    const isDrugLike = (c) => !NOT_DRUG.test(String(c).trim()) && /(ol|in|ine|cillin|mycin|pril|sartan|olol|azole|fen|mide|pam|lam|statin|profen|amol|cet|zin|zine|dine|mab|vir|oxin|cin|tin|xin|ide|ил|ин|ол|цин|зол|фен|мид|пам|там|ат)$/i.test(String(c).split(/\s+/)[0] || '') || /^[A-ZА-Я][a-zа-я]+$/.test(String(c).trim()) && String(c).trim().length >= 7 || /^[぀-ヿ㐀-鿿]{2,}$/.test(String(c).trim());
    // v1.0024: съвпадение през ГОЛЕМИЯ речник при сканиране — само ако думата изглежда като име на лекарство
    // (≥6 букви, с главна буква/лекарствен суфикс, не е обща дума): иначе „Honey"/„Strong"/„antibiotic" улучват записи.
    const namesOk = (c) => { const t = String(c).trim(); return !NOT_DRUG.test(t) && t.length >= 6 && /^[A-Za-zА-Яа-я][A-Za-zА-Яа-я-]*$/.test(t) && (DRUG_SUFFIX.test(t) || (/^[A-ZА-Я]/.test(t) && t.length >= 8)) || /^[぀-ヿ㐀-鿿]{2,}$/.test(t); };
    const DRUG_SUFFIX = /(ol|in|ine|cillin|mycin|pril|sartan|olol|azole|fen|mide|pam|lam|statin|profen|amol|cet|zin|zine|dine|tidine|mab|vir|zolam|oxin|cin|tin|xin|ide|ил|ин|ол|цин|зол|фен|мид|пам|там|ат)$/i;
    // Разпознато лекарство → показване; при включена настройка — анонимно учене (име/код + INN, без снимка).
    const finish = (r) => { statusEl.textContent = ''; showResult(r); try { if (r && r.exact) syncLearn({ name: r.matchedName || dbg.matched || r.title, inn: r.inn, gtin: r.barcode && r.barcode.gtin, lang: getLang() }); } catch (_) {} };
    const tryList = async (list) => {
      list.forEach((c) => { if (dbg.cands.indexOf(c) < 0) dbg.cands.push(c); });
      // ПАС 1 (офлайн, бърз): всички кандидати срещу вградените бази; точно съвпадение → пълен резултат.
      for (const c of list) {
        let off = null; try { off = await lookupMedicine(c, getLang(), { offlineOnly: true }); } catch (_) { off = null; }
        if (off && off.viaNames && !namesOk(c)) off = null;
        if (off && off.exact && !plausibleScanHit(c, off)) { try { dbg.tries.push({ cand: c, rejected: 'implausible', title: off.title }); } catch (_) {} off = null; }
        if (off && off.exact) { dbg.matched = c; nameEl.value = c; statusEl.textContent = M('searching'); let full = null; try { full = await lookupMedicine(c, getLang()); } catch (_) { full = off; } finish(full || off); return true; }
        if (off && !partial && (off.exact || isDrugLike(c))) { partial = off; partialCand = c; }
      }
      // ПАС 2 (онлайн): само най-добрите 4 кандидата.
      for (const c of list.slice(0, 4)) {
        if (!nameEl.value) nameEl.value = c;
        statusEl.textContent = M('searching');
        let res = null; try { res = await lookupMedicine(c, getLang()); } catch (_) { res = null; }
        if (res && res.viaNames && !namesOk(c)) res = null;
        if (res && res.exact && !plausibleScanHit(c, res)) { try { dbg.tries.push({ cand: c, rejected: 'implausible', title: res.title }); } catch (_) {} res = null; }
        try { const t = { cand: c, found: !!res, source: res && res.source, title: res && res.title, exact: !!(res && res.exact) }; dbg.tries.push(t); console.log('[MedDbg]', t); } catch (_) {}
        if (res && res.exact) { dbg.matched = c; nameEl.value = c; finish(res); return true; }
        if (res && !partial && (res.exact || isDrugLike(c))) { partial = res; partialCand = c; }
      }
      return false;
    };
    // Сканира ЕДНО завъртане: първо чист английски (латиница = INN имена), после многоезичният пакет
    // (eng+bul+rus + езика на апа; китайски при zh/ja интерфейс) като резерв.
    const scanAt = async (src, withBest) => {
      const cEn = await ocrOn(src, 'eng');
      if (await tryList(cEn.filter((c) => dbg.cands.indexOf(c) < 0))) return true;
      if (withBest && USE_BEST && OCR_BEST.length) { const cB = await ocrOn(src, 'eng@best'); if (await tryList(cB.filter((c) => dbg.cands.indexOf(c) < 0))) return true; }
      const cMulti = await ocrOn(src, ocrLangsFor(getLang(), window.__medText));
      if (await tryList(cMulti.filter((c) => dbg.cands.indexOf(c) < 0))) return true;
      return false;
    };
    let base = null, objurl = null;
    try { base = await preprocess(file); } catch (_) { objurl = URL.createObjectURL(file); base = objurl; }
    const canRotate = !!(base && base.getContext);
    window.__medText = ''; window.__medConf = 0; window.__medBarcode = null;
    // ЕТАП 0 (v1.0024): БАРКОД НА УСТРОЙСТВОТО. EAN-13/UPC/DataMatrix/QR → GTIN → вграден регистър (gtin-db) → при
    // съвпадение: пълна карта по генеричното/търговското име (med-db / речник / онлайн шард), иначе кратка карта от
    // регистъра. Кодът липсва в регистъра → онлайн openFDA по UPC; и това не → продължаваме с OCR, но показваме кода.
    if (canRotate) {
      statusEl.textContent = M('barcode_stage');
      let bc = null; try { bc = await decodeBarcode(base); } catch (_) { bc = null; }
      dbg.barcode = bc; window.__medBarcode = bc;
      if (bc && bc.gtin) {
        let g = null; try { g = await lookupGtin(bc.gtin); } catch (_) { g = null; }
        // липсва във вграденото → сървърът на Pupikes (само при включена настройка) → openFDA онлайн
        if (!g) { statusEl.textContent = M('searching'); try { g = await medikitLookup('', getLang(), { gtin: bc.gtin }); } catch (_) { g = null; } }
        if (!g) { try { g = await lookupGtinOnline(bc.gtin); } catch (_) { g = null; } }
        dbg.gtin = g;
        if (g) {
          statusEl.textContent = M('searching');
          let full = null, usedQ = '';
          for (const q of gtinQueries(g)) { try { full = await lookupMedicine(q, getLang()); } catch (_) { full = null; } if (full && full.exact) { usedQ = q; break; } full = null; }
          const r = full || (g.via === 'server' ? g : gtinToResult(g));
          r.barcode = bc; r.registry = g; if (g.links && !r.links) r.links = g.links;
          dbg.matched = usedQ || g.generic || g.brand; nameEl.value = g.brand || g.generic || usedQ;
          if (objurl) { try { URL.revokeObjectURL(objurl); } catch (_) {} }
          finish(r); return;
        }
      }
    }
    // ЕТАПИ OCR: deskew (изравнена снимка: 0°/180°/90°/270°) → резерв върху суровата (0°, или старите ъгли при несигурност).
    // v1.0024: първият етап се повтаря върху АДАПТИВНО БИНАРИЗИРАНА (+ увеличена ×2) картинка. Така цветни/сенчести
    // опаковки и дребен текст се четат, без да растат етапите при успех (успехите остават ~3 s).
    let done = false; const stages = [];
    if (canRotate) {
      let sk = { angle: 0, confidence: 0 }; try { sk = estimateSkew(base); } catch (_) {}
      dbg.skew = sk;
      const lvl = sk.horizontalAt != null ? sk.horizontalAt : sk.angle;
      if (Math.abs(lvl) >= 0.75 && sk.confidence >= 0.05) {
        const lev = rotateAny(base, -lvl);
        stages.push(['deskew', lev]);
        const ab = binarize(lev, 'adaptive'); if (ab) stages.push(['deskew-bin', ab]);
        stages.push(['deskew180', rotateCanvas(lev, 180)], ['deskew90', rotateCanvas(lev, 90)], ['deskew270', rotateCanvas(lev, 270)]);
      }
    }
    const sure = !!(dbg.skew && dbg.skew.confidence >= 0.35);
    const leveled = stages.length > 0;
    const fallback = !canRotate ? [0] : (leveled && sure) ? [0] : sure ? [0, 90, 270, 180] : [0, 90, 270, 180, 45, 135, 225, 315];
    for (const deg of fallback) {
      stages.push([deg, deg === 0 ? base : rotateCanvas(base, deg)]);
      if (deg === 0 && canRotate && !leveled) { const ab = binarize(base, 'adaptive'); if (ab) stages.push(['0-bin', ab]); }
    }
    // (Otsu като отделен последен етап беше пробван на стенда — 0 допълнителни успеха, +1 етап време → изключен;
    //  tesseract сам прави глобален Otsu. Адаптивната бинаризация остава — тя даде успех.)
    let n = 0;
    for (const [tag, src] of stages) {
      dbg.angles.push(tag); n++;
      statusEl.textContent = MF('ocr_stage', n, stages.length);
      if (await scanAt(src, n <= 2)) { done = true; break; }
    }
    // Резервен CJK етап (китайски опаковки при не-китайски интерфейс): един пас с chi_sim+chi_tra на първия етап.
    if (!done && stages.length && !/^(zh|ja)/.test(getLang()) && !hasCjk(window.__medText)) {
      dbg.angles.push('cjk');
      const cC = await ocrOn(stages[0][1], ocrLangsCjk());
      if (await tryList(cC.filter((c) => dbg.cands.indexOf(c) < 0))) done = true;
    }
    // v1.0024: ВЕРТИКАЛЕН CJK (японски/китайски опаковки с текст отгоре надолу): един пас с psm 5 върху първия етап,
    // когато интерфейсът е китайски/японски или вече е разчетен CJK текст.
    if (!done && stages.length && (/^(zh|ja)/.test(getLang()) || hasCjk(window.__medText))) {
      dbg.angles.push('cjk-vert');
      const cV = await ocrOn(stages[0][1], ocrLangsCjk(), { psm: 5 });
      if (await tryList(cV.filter((c) => dbg.cands.indexOf(c) < 0))) done = true;
    }
    if (objurl) { try { URL.revokeObjectURL(objurl); } catch (_) {} }
    if (done) return;
    // Няма точно → частично (+ „може би имаш предвид"); иначе КАРТАТА с разчетеното (никога празно).
    let cands = []; try { cands = await candidatesFromText(window.__medText || dbg.cands.join('\n'), 6); } catch (_) { cands = []; }
    if (partial) { dbg.matched = partialCand; nameEl.value = partialCand; statusEl.textContent = ''; showResult(partial, cands); return; }
    statusEl.textContent = '';
    resultEl.innerHTML = await renderUnknownCard(window.__medText || '', dbg.cands);
    bindResult(resultEl, null);
    try { dbg.unknownCard = true; dbg.dbCands = cands.map((c) => c.name); } catch (_) {}
  }

  async function doSearch(q, o) {
    q = String(q || '').trim();
    if (!q) return;
    statusEl.textContent = M('searching'); resultEl.innerHTML = '';
    let res = null;
    try { res = await lookupMedicine(q, getLang()); } catch (_) { res = null; }
    statusEl.textContent = '';
    // избран кандидат (потвърждение) → анонимно учене при включена настройка
    if (res && o && o.confirmed) { try { syncLearn({ name: q, inn: res.inn, lang: getLang() }); } catch (_) {} }
    if (!res) {
      // „Може би имаш предвид" — толерантно търсене в 15-езичната база (OCR/правописни грешки).
      let cands = []; try { cands = await candidatesFromText(q, 6); } catch (_) { cands = []; }
      resultEl.innerHTML = `<div class="notice">${esc(M('not_found'))}</div>` + (cands.length ? candChips(cands, M('did_you_mean')) : '');
      bindResult(resultEl, null); return;
    }
    showResult(res);
  }
}

// ---------- Резултат ----------
function riskLabel(risk) { return risk === 'opiate' ? M('risk_opiate') : risk === 'banned' ? M('risk_banned') : M('risk_danger'); }
function riskColor(risk) { return risk === 'opiate' ? '#e5484d' : risk === 'banned' ? '#d29922' : '#e5679b'; }
function hintsLine() {
  try { const h = classifyHints(window.__medText || ''); const d = h ? describeHints(h, getLang()) : ''; return d ? `<div style="margin-top:8px"><b>🏷 ${esc(M('card_hints'))}:</b> ${esc(d)}</div>` : ''; } catch (_) { return ''; }
}
function sourceLabel(src) { return src === 'med-db' || src === 'offline' ? M('src_meddb') : src === 'pupikes-shard' ? M('src_shard') : src === 'gtin-db' ? M('src_gtin') : src === 'names-db' ? M('src_names') : src === 'pupikes-server' ? M('src_server') : String(src || ''); }
// v1.0024: „Листовка и информация" — линкове по езика на интерфейса (Wikipedia, DailyMed/FDA, EMA, национални
// справочници); апът не носи листовките, само адресите. Отварят се в системния браузър (bindResult).
function linksSection(r) {
  let links = []; try { links = leafletLinks(r, getLang()); } catch (_) { links = []; }
  if (!links.length) return '';
  return `<div style="margin-top:14px;border-top:1px solid rgba(127,127,127,.25);padding-top:10px"><b>${esc(M('res_links'))}</b>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${links.map((l) => `<a class="tab leaflet-link" href="${esc(l.url)}" data-url="${esc(l.url)}" target="_blank" rel="noopener" style="flex:0 1 auto;min-width:0;text-decoration:none">${esc(l.title)} ↗</a>`).join('')}</div>
      <div class="hint" style="margin-top:6px">${esc(M('link_opens'))}</div></div>`;
}
// v1.0024: ред „Баркод" (формат + код) и, при съвпадение, записът от регистъра (търговско · генерично име).
// nomatch=true → в картата „не е разпознато": кодът е прочетен, но липсва в регистъра.
function barcodeLine(bc, nomatch) {
  if (!bc || !(bc.gtin || bc.text)) return '';
  const code = bc.gtin || String(bc.text || '').slice(0, 40);
  const fmt = String(bc.format || '').replace(/_/g, '-');
  if (nomatch) return `<div class="hint" style="margin-top:6px">▮ ${esc(MF('barcode_nomatch', code + (fmt ? ' · ' + fmt : '')))}</div>`;
  return `<div style="margin-top:6px"><b>▮ ${esc(M('res_barcode'))}:</b> ${esc(code)}${fmt ? ` <span style="opacity:.7">· ${esc(fmt)}</span>` : ''}</div>`;
}
function renderResult(r) {
  const risky = (r.risky || []).map((ing) => `
    <div style="border-left:4px solid ${riskColor(ing.risk)};background:rgba(255,255,255,.03);border-radius:8px;padding:8px 10px;margin:6px 0">
      <div style="font-weight:700;color:${riskColor(ing.risk)}">${esc(ing.name)} · ${esc(riskLabel(ing.risk))}</div>
      <div style="font-size:.9em;opacity:.9">${esc(ing.consequence)}</div>
    </div>`).join('');
  // Huawei 3.1: редът „Съставки" се показва ВИНАГИ (ако не са известни — „—").
  const hintsHtml = hintsLine();
  const active = hintsHtml + `<div style="margin-top:10px"><b>${esc(M('res_ingredients'))}:</b> ${esc((r.active || []).length ? (r.active || []).join(', ') : '—')}</div>`;
  // Форма: ПЪРВО разчетената от дребния текст на самата опаковка (капсули/сироп…), иначе от базата (един етикет).
  let formTxt = ''; try { const hf = (classifyHints(window.__medText || '') || {}).form; const f = hf || r.form; formTxt = f ? describeHints({ form: f, route: '', audience: '', strength: '', tags: [] }, getLang()) : ''; } catch (_) { formTxt = r.form || ''; }
  const extra = (r.otherNames && r.otherNames.length ? `<div style="margin-top:6px"><b>${esc(M('res_names'))}:</b> ${esc(r.otherNames.join(' · '))}</div>` : '') + (formTxt ? `<div style="margin-top:6px"><b>${esc(M('res_form'))}:</b> ${esc(formTxt)}</div>` : '')
    + barcodeLine(r.barcode, false) + (r.registry && r.registry.name ? `<div style="margin-top:6px"><b>${esc(M('res_registry'))}:</b> ${esc(r.registry.name)}</div>` : '');
  const warn = r.warningsT ? `<div style="margin-top:10px"><b>${esc(M('res_warnings'))}:</b> ${esc(r.warningsT)}</div>` : '';
  const secOrder = ['indications', 'dosage', 'contraindications', 'sideeffects', 'interactions', 'storage', 'warnings'];
  const sections = (r.sections && r.sections.length)
    ? `<div style="margin-top:14px;border-top:1px solid rgba(127,127,127,.25);padding-top:10px"><b>📄 ${esc(M('res_leaflet'))}</b>` +
      r.sections.slice().sort((a, b) => secOrder.indexOf(a.key) - secOrder.indexOf(b.key)).map((s) => `
        <div style="margin-top:9px"><div style="font-weight:600">${esc(M('res_' + s.key) || s.key)}</div>
        <div style="line-height:1.5;opacity:.92;white-space:pre-wrap">${esc(s.text)}</div></div>`).join('') + `</div>`
    : '';
  return `
    <div class="card" style="display:block;text-align:left;cursor:default">
      <h3 style="margin:0 0 6px">${esc(r.title)}</h3>
      <div style="line-height:1.5">${esc(r.descriptionT || r.description || '')}</div>
      ${active}${extra}
      ${risky ? `<div style="margin-top:12px"><b>${esc(M('res_risky'))}</b>${risky}</div>` : ''}
      ${sections || warn}
      ${linksSection(r)}
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn sec" id="to-inter" style="margin:0;flex:1;padding:10px 6px;font-size:.88em">${esc(M('res_check_inter'))}</button><button class="btn sec" id="to-sched" style="margin:0;flex:1;padding:10px 6px;font-size:.88em">${esc(M('res_add_sched'))}</button></div>
      <div style="margin-top:10px;font-size:.8em;opacity:.6">${esc(M('res_source'))}: ${esc(sourceLabel(r.source))}</div>
    </div>`;
}

// ---------- Таб: взаимодействия ----------
function renderInter(view) {
  view.innerHTML = `
      <h3 style="margin:0 0 4px">${esc(M('inter_title'))}</h3>
      <div class="hint" style="margin-top:0">${esc(M('inter_sub'))}</div>
      <input class="search" id="ia" type="text" placeholder="${esc(M('inter_a_ph'))}" autocomplete="off" style="margin-top:10px" value="${esc(prefill.inter || '')}">
      <input class="search" id="ib" type="text" placeholder="${esc(M('inter_b_ph'))}" autocomplete="off" style="margin-top:8px">
      <button class="btn" id="ibtn" style="margin-top:10px">${esc(M('inter_btn'))}</button>
      <div class="hint">${esc(M('inter_examples'))}</div>
      <div id="ires" style="margin-top:12px"></div>
      <div class="hint" style="margin-top:10px">${esc(MF('inter_table_note', RULE_COUNT, GROUP_COUNT))}</div>`;
  prefill.inter = '';
  const a = view.querySelector('#ia'), b = view.querySelector('#ib'), out = view.querySelector('#ires');
  const sevColor = { high: '#e5484d', mid: '#d29922', low: '#3fb950' };
  const run = async () => {
    const na = a.value.trim(), nb = b.value.trim(); if (!na || !nb) return;
    out.innerHTML = `<div class="hint">${esc(M('searching'))}</div>`;
    let r = null; try { r = await checkInteractions(na, nb); } catch (_) { r = null; }
    if (!r) { out.innerHTML = `<div class="notice">${esc(M('not_found'))}</div>`; return; }
    if (r.unknown.length) { out.innerHTML = `<div class="notice">${esc(MF('inter_unknown', r.unknown.join(', ')))}</div>`; return; }
    const head = `<div class="hint" style="margin-bottom:8px">${esc(na)} → <b>${esc(r.a.inn)}</b> · ${esc(nb)} → <b>${esc(r.b.inn)}</b></div>`;
    if (!r.hits.length) { out.innerHTML = head + `<div class="card" style="display:block;text-align:left;cursor:default;border-left:4px solid #3fb950">${esc(M('inter_none'))}</div>`; return; }
    out.innerHTML = head + r.hits.map((h) => `<div class="card" style="display:block;text-align:left;cursor:default;border-left:4px solid ${sevColor[h.sev]};margin-bottom:8px">
        <div style="font-weight:700;color:${sevColor[h.sev]}">${esc(M('sev_' + h.sev))}</div>
        <div style="margin-top:6px"><b>${esc(M('inter_why'))}:</b> ${esc(M('why_' + h.why))}</div>
      </div>`).join('');
  };
  view.querySelector('#ibtn').addEventListener('click', run);
  [a, b].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); }));
  if (a.value) b.focus();
}

// ---------- Таб: дозировка ----------
function renderDose(view) {
  const lang = getLang();
  const formLabel = (f) => f.kind === 'tablet' ? `${M('form_tablet')} ${f.mg} mg` : f.kind === 'syrup' ? `${M('form_syrup')} ${f.label}` : f.kind === 'drops' ? `${M('form_drops')} ${f.label}` : MF('form_sachet', f.dissolveMl || 200);
  view.innerHTML = `
      <h3 style="margin:0 0 4px">${esc(M('dose_title'))}</h3>
      <div class="hint" style="margin-top:0">${esc(M('dose_sub'))}</div>
      <label class="hint" style="display:block;margin-top:10px">${esc(M('dose_drug'))}</label>
      <select id="ddrug" class="search">${OTC.map((d) => `<option value="${d.id}">${esc(otcName(d, lang))}</option>`).join('')}</select>
      <div class="row" style="margin-top:8px">
        <div><label class="hint">${esc(M('dose_weight'))}</label><input class="search" id="dkg" type="number" inputmode="decimal" min="1" max="250" step="0.5" value="20"></div>
        <div><label class="hint">${esc(M('dose_age_y'))}</label><input class="search" id="dy" type="number" inputmode="numeric" min="0" max="120" value="6"></div>
        <div><label class="hint">${esc(M('dose_age_m'))}</label><input class="search" id="dm" type="number" inputmode="numeric" min="0" max="11" value="0"></div>
      </div>
      <label class="hint" style="display:block;margin-top:8px">${esc(M('dose_form'))}</label>
      <select id="dform" class="search"></select>
      <button class="btn" id="dbtn" style="margin-top:10px">${esc(M('dose_btn'))}</button>
      <div id="dres" style="margin-top:12px"></div>
      <div class="hint" style="margin-top:8px">${esc(M('dose_note'))}</div>`;
  const drug = view.querySelector('#ddrug'), form = view.querySelector('#dform'), out = view.querySelector('#dres');
  const fillForms = () => { const d = OTC.find((x) => x.id === drug.value); form.innerHTML = d.forms.map((f) => `<option value="${f.id}">${esc(formLabel(f))}</option>`).join(''); };
  fillForms(); drug.addEventListener('change', fillForms);
  const run = () => {
    const r = calcDose({ drugId: drug.value, kg: view.querySelector('#dkg').value, years: view.querySelector('#dy').value, months: view.querySelector('#dm').value, formId: form.value });
    const kg = parseFloat(view.querySelector('#dkg').value) || 0, y = parseInt(view.querySelector('#dy').value, 10) || 0, mo = parseInt(view.querySelector('#dm').value, 10) || 0;
    const ageTxt = y ? MF('age_years', y) + (mo ? ' ' + MF('age_months', mo) : '') : MF('age_months', mo);
    if (!r.ok) {
      const msg = r.reason === 'notUnder16' ? M('dose_not_under16') : r.reason === 'tooYoung' ? MF('dose_too_young', r.min) : M('dose_weight');
      out.innerHTML = `<div class="notice">${esc(msg)}</div>`; return;
    }
    if (r.ors) {
      out.innerHTML = `<div class="card" style="display:block;text-align:left;cursor:default"><h3 style="margin:0 0 6px">${esc(otcName(OTC.find((x) => x.id === 'ors'), lang))}</h3><div class="hint">${esc(MF('dose_result_for', kg, ageTxt))}</div>
        ${r.initialMl ? `<div style="margin-top:8px"><b>${esc(M('dose_per'))}:</b> ${r.initialMl[0]}–${r.initialMl[1]} ml / 4 h</div>` : ''}
        <div style="margin-top:6px;line-height:1.5">${esc(M('dose_ors_note'))}</div>
        <div style="margin-top:6px"><b>${esc(M('dose_form'))}:</b> ${esc(formLabel(r.form))}</div></div>`;
      return;
    }
    const rng = (a) => a[0] === a[1] ? String(a[0]) : `${a[0]}–${a[1]}`;
    const per = `${rng(r.doseMg)} mg` + (r.ml ? ` · ${esc(MF('dose_ml', rng(r.ml), r.form.label))}` : '') + (r.tablets ? ` · ${esc(MF('dose_tabs', rng(r.tablets), r.form.mg))}` : '');
    out.innerHTML = `<div class="card" style="display:block;text-align:left;cursor:default">
        <h3 style="margin:0 0 6px">${esc(otcName(r.drug, lang))}</h3><div class="hint">${esc(MF('dose_result_for', kg, ageTxt))}</div>
        <div style="margin-top:8px"><b>${esc(M('dose_per'))}:</b> ${per}</div>
        <div style="margin-top:6px"><b>${esc(M('dose_every'))}:</b> ${rng(r.everyH)} ${esc(M('dose_hours'))}</div>
        <div style="margin-top:6px"><b>${esc(M('dose_max_day'))}:</b> ${r.maxDayMg} mg (${r.maxDoses} ${esc(M('dose_max_doses'))})</div>
        ${r.capped ? `<div class="hint">${esc(M('dose_capped'))}</div>` : ''}${r.note ? `<div class="hint">${esc(r.note)}</div>` : ''}
      </div>`;
  };
  view.querySelector('#dbtn').addEventListener('click', run);
  run();
}

// ---------- Таб: график за прием ----------
function renderSched(view) {
  const pre = prefill.sched || {}; prefill.sched = null;
  view.innerHTML = `
      <h3 style="margin:0 0 4px">${esc(M('sched_title'))}</h3>
      <div class="hint" style="margin-top:0">${esc(M('sched_sub'))}</div>
      <input class="search" id="sname" type="text" placeholder="${esc(M('sched_name'))}" autocomplete="off" style="margin-top:10px" value="${esc(pre.name || '')}">
      <input class="search" id="sdose" type="text" placeholder="${esc(M('sched_dose'))}" autocomplete="off" style="margin-top:8px" value="${esc(pre.dose || '')}">
      <label class="hint" style="display:block;margin-top:8px">${esc(M('sched_times'))}</label>
      <div id="stimes" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      <button class="btn sec inline" id="saddt" style="margin-top:6px;padding:8px 14px">${esc(M('sched_add_time'))}</button>
      <label class="hint" style="display:block;margin-top:8px">${esc(M('sched_days'))}</label>
      <input class="search" id="sdays" type="number" inputmode="numeric" min="0" max="365" value="${pre.days || 7}">
      <button class="btn" id="ssave" style="margin-top:10px">${esc(M('sched_save'))}</button>
      <div class="hint">${esc(M('sched_example'))}</div>
      <div id="smsg" class="hint" style="margin-top:8px"></div>
      <div id="slist" style="margin-top:12px"></div>`;
  const timesEl = view.querySelector('#stimes'), msg = view.querySelector('#smsg'), list = view.querySelector('#slist');
  const addTime = (v) => { const i = document.createElement('input'); i.type = 'time'; i.className = 'search'; i.style.cssText = 'width:auto;flex:0 0 auto;margin-top:6px'; i.value = v || ''; timesEl.appendChild(i); };
  (pre.times || ['08:00', '20:00']).forEach(addTime);
  view.querySelector('#saddt').addEventListener('click', () => addTime(''));
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(getLang()); } catch (_) { return d; } };
  const fmtTime = (d) => { try { return d.toLocaleString(getLang(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return String(d); } };
  const draw = () => {
    const items = listSchedule();
    if (!items.length) { list.innerHTML = `<div class="notice">${esc(M('sched_empty'))}</div>`; return; }
    const nx = nextDose(items);
    list.innerHTML = (nx ? `<div class="hint" style="margin-bottom:8px">⏰ ${esc(MF('sched_next', nx.entry.name + ' ' + fmtTime(nx.at)))}</div>` : '') +
      `<div class="hint">${esc(M('sched_today'))} · ${esc(new Date().toLocaleDateString(getLang()))}</div>` +
      items.map((e) => `<div class="card" style="display:block;text-align:left;cursor:default;margin-top:8px">
        <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">${esc(e.name)}</h3><button class="tab sdel" data-id="${e.id}" style="flex:0 0 auto;min-width:0;padding:6px 10px">${esc(M('sched_delete'))}</button></div>
        ${e.dose ? `<div class="hint">${esc(e.dose)}${e.until ? ' · ' + esc(MF('sched_until', fmtDate(e.until))) : ''}</div>` : (e.until ? `<div class="hint">${esc(MF('sched_until', fmtDate(e.until)))}</div>` : '')}
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${e.times.map((t) => { const tk = isTaken(e.id, t); return `<button class="tab stake${tk ? ' active' : ''}" data-id="${e.id}" data-t="${t}" style="flex:0 1 auto;min-width:0">${esc(t)} ${tk ? esc(M('sched_taken')) : ''}</button>`; }).join('')}</div>
      </div>`).join('');
    list.querySelectorAll('.stake').forEach((b) => b.addEventListener('click', () => { markTaken(b.dataset.id, b.dataset.t, !isTaken(b.dataset.id, b.dataset.t)); draw(); }));
    list.querySelectorAll('.sdel').forEach((b) => b.addEventListener('click', async () => { await deleteEntry(b.dataset.id); draw(); }));
  };
  view.querySelector('#ssave').addEventListener('click', async () => {
    const name = view.querySelector('#sname').value.trim(); const dose = view.querySelector('#sdose').value.trim();
    const times = Array.from(timesEl.querySelectorAll('input')).map((i) => i.value).filter(Boolean);
    if (!name || !times.length) { msg.textContent = M('sched_need_name'); return; }
    msg.textContent = M('searching');
    const r = await saveEntry({ name, dose, times, days: view.querySelector('#sdays').value }, { title: 'Pupikes Medicines', body: MF('sched_notif_body', name, dose || '') });
    msg.textContent = r.notif === 'native' ? M('sched_notif_on') : r.notif === 'denied' ? M('sched_notif_denied') : M('sched_notif_web');
    view.querySelector('#sname').value = ''; view.querySelector('#sdose').value = '';
    draw();
  });
  draw();
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
try { restoreTimers({ title: 'Pupikes Medicines' }); } catch (_) {}
route();
