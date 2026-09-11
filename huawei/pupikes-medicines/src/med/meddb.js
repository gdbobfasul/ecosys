// Version: 1.0024
// meddb.js — ВГРАДЕНА ОФЛАЙН БАЗА (public/reference/med-db.json, генерирана от deploy-scripts/gen-med-db.mjs):
// ~580 най-разпространени лекарства с имена на 15 езика (генерично + търговски/чужди изписвания вкл.
// китайски, руски, латински), съставки, форма, кратко показание/дозировка (openFDA). Търсене с ТОЛЕРАНС
// (нормализация, транслитерация, фонетика от data.js + разстояние на Левенщайн за OCR-грешки; CJK —
// по подниз). Дава и КАНДИДАТИ по целия разчетен текст (за картата „не е разпознато" — Huawei 3.1).
import { norm, matchScore, translitCyr } from './data.js';
import { namesCandidates, searchNames } from './names.js';

let DB = null, INDEX = null;
const CJK = /[぀-ヿ㐀-鿿]/;
const lat = (s) => norm(translitCyr(s));

async function load() {
  if (DB) return DB;
  try { const r = await fetch('reference/med-db.json'); DB = r.ok ? (await r.json()) : { items: [] }; } catch (_) { DB = { items: [] }; }
  INDEX = [];
  for (const it of (DB.items || [])) {
    const names = it.names || {};
    for (const lg of Object.keys(names)) for (const raw of names[lg]) {
      const isCjk = CJK.test(raw);
      INDEX.push({ raw, lg, k: isCjk ? raw.replace(/\s+/g, '') : lat(raw), cjk: isCjk, it });
    }
  }
  return DB;
}
export async function loadMedDb() { await load(); return DB.items || []; }

// Левенщайн с ранен изход (само за близки дължини).
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length, m = b.length; let prev = new Array(m + 1), cur = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i; let rowMin = i;
    for (let j = 1; j <= m; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1; cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c); if (cur[j] < rowMin) rowMin = cur[j]; }
    if (rowMin > max) return max + 1;
    const t = prev; prev = cur; cur = t;
  }
  return prev[m];
}
// Допустими грешки според дължината (OCR бърка 1–2 букви в дълги имена).
function tolFor(len) { return len >= 10 ? 2 : len >= 6 ? 1 : 0; }

// Оценка на един запис от индекса срещу заявка: 3 = точно, 2 = близко (≤tol грешки / падежно окончание),
// 1 = частично (префикс ≥6 или името се съдържа в заявката). 0 = не.
function scoreEntry(e, q, qCjk) {
  if (e.cjk !== qCjk) return 0;
  if (qCjk) { const a = e.k, b = q; if (a === b) return 3; if (b.length >= 2 && (a.includes(b) && b.length >= 0.6 * a.length || b.includes(a) && a.length >= 2)) return 2; return 0; }
  const ms = matchScore(e.raw, q);
  if (ms === 2) return 3;
  const a = e.k, b = q; if (!a || !b) return 0;
  const tol = tolFor(Math.min(a.length, b.length));
  if (tol && lev(a, b, tol) <= tol) return 2;
  if (ms === 1) return 1;
  if (b.length >= 6 && a.startsWith(b)) return 1;
  return 0;
}

// Най-добро съвпадение за една заявка. Връща { item, name, score } или null. minScore по подразбиране 2.
export async function searchMedDb(query, opts) {
  opts = opts || {};
  await load();
  const raw = String(query || '').trim(); if (!raw) return null;
  const qCjk = CJK.test(raw); const q = qCjk ? raw.replace(/\s+/g, '') : lat(raw);
  if (!q || (!qCjk && q.length < 4)) return null;
  let best = null;
  for (const e of INDEX) {
    const s = scoreEntry(e, q, qCjk);
    if (s && (!best || s > best.score || (s === best.score && e.it.n > best.item.n))) { best = { item: e.it, name: e.raw, score: s }; if (s === 3 && e.it.n >= 30) break; }
  }
  return best && best.score >= (opts.minScore || 2) ? best : null;
}

// КАНДИДАТИ ОТ ТЕКСТ: всички думи (латиница/кирилица ≥4 букви) и CJK откъси от разчетения текст се
// оценяват срещу базата; връща до max различни лекарства, най-добрите първо. Ползва се за картата
// „не е разпознато" (избор с едно докосване) и за „Може би имаш предвид".
const DRUG_SUFFIX = /(ol|in|ine|cillin|mycin|pril|sartan|olol|azole|fen|mide|pam|lam|statin|profen|amol|cet|zin|zine|dine|mab|vir|oxin|cin|tin|xin|ide|ate|ил|ин|ол|цин|зол|фен|мид|пам|там|ат)$/i;
const STOP = /^(tablets?|capsules?|caplets?|coated|film|relief|fever|pain|extra|strength|maximum|regular|adults?|children|contains?|active|ingredient|each|dose|dosage|directions|warnings?|store|keep|reach|pharma|pharmacy|health|natural|original|таблетки|капсули|капсулы|инструкция|состав|показания|упаковка|опаковка|листовка|comprimes|comprimidos|tabletten|gelules|filmomhulde|kalium|sodium|natrium|calcium|hydrochloride|hydrochlorid|acid|acide|forte|retard|rapid|plus|junior|baby|kids|extra)$/i;
export async function candidatesFromText(text, max) {
  await load();
  const t = String(text || ''); const out = new Map();
  const consider = (tok, bonus) => {
    const qCjk = CJK.test(tok); const q = qCjk ? tok : lat(tok);
    if (!q || (!qCjk && q.length < 4)) return;
    for (const e of INDEX) {
      const s = scoreEntry(e, q, qCjk); if (!s) continue;
      const sc = s * 10 + bonus + Math.min(9, Math.log2((e.it.n || 1) + 1));
      const cur = out.get(e.it.inn);
      if (!cur || sc > cur.sc) out.set(e.it.inn, { item: e.it, name: e.raw, token: tok, score: s, sc });
    }
  };
  const words = t.match(/[A-Za-zÀ-ÿА-Яа-яЁё][A-Za-zÀ-ÿА-Яа-яЁё\-]{3,}/g) || [];
  const seen = new Set();
  for (const w of words) { const k = w.toLowerCase(); if (seen.has(k) || STOP.test(k)) continue; seen.add(k); consider(w, DRUG_SUFFIX.test(w) ? 4 : 0); if (seen.size > 80) break; }
  for (const run of (t.match(/[぀-ヿ㐀-鿿]{2,10}/g) || []).slice(0, 30)) {
    consider(run, 0);
    if (run.length > 3) for (let i = 0; i + 2 <= run.length && i < 6; i++) consider(run.slice(i, i + Math.min(4, run.length - i)), -2);
  }
  const res = Array.from(out.values()).sort((a, b) => b.sc - a.sc).slice(0, max || 6);
  // v1.0024: ГОЛЕМИЯТ РЕЧНИК допълва (различни INN; med-db кандидатите остават първи).
  if (res.length < (max || 6)) {
    let more = []; try { more = await namesCandidates(t, (max || 6) * 2); } catch (_) { more = []; }
    for (const c of more) { if (res.length >= (max || 6)) break; if (c.score < 3 && String(c.token || '').length < 8) continue; if (res.some((r) => r.item.inn === c.inn || r.name.toLowerCase() === c.name.toLowerCase())) continue; res.push({ item: { inn: c.inn, n: c.n, names: {} }, name: c.name, token: c.token, score: c.score, sc: c.sc - 5, fromNames: true }); }
  }
  return res;
}

// Показване: заглавие на езика на апа (първо име за lang, иначе генеричното), други имена, форма, описание.
const FORM_KEYS = { tablet: 'form_tablet', capsule: 'form_capsule', syrup: 'form_syrup', drops: 'form_drops', cream: 'form_cream', spray: 'form_spray', injection: 'form_injection', suppository: 'form_suppository', inhaler: 'form_inhaler', patch: 'form_patch', powder: 'form_powder', solution: 'form_solution' };
export function medDbFormKey(form) { return FORM_KEYS[form] || ''; }
export function medDbToResult(hit, lang) {
  const it = hit.item; const names = it.names || {};
  const base = String(lang || 'en').split('-')[0];
  const local = names[lang] || names[base] || [];
  const title = (local[0] || it.inn).replace(/^./, (c) => c.toUpperCase());
  // други имена: до 8, различни от заглавието, предпочитай езика на апа + английски + латински + китайски
  const other = []; const push = (v) => { if (v && v.toLowerCase() !== title.toLowerCase() && !other.some((o) => o.toLowerCase() === v.toLowerCase())) other.push(v); };
  for (const lg of [lang, base, 'en', 'la', 'ru', 'zh', 'zh-Hant']) for (const v of (names[lg] || []).slice(0, 4)) push(v);
  const desc = (it.desc || {})[lang] || (it.desc || {})[base] || '';
  const description = [desc, it.usage].filter(Boolean).join('. ');
  const sections = [];
  if (it.usage) sections.push({ key: 'indications', text: it.usage });
  if (it.dosage) sections.push({ key: 'dosage', text: it.dosage });
  if (it.warn) sections.push({ key: 'warnings', text: it.warn });
  // localName: локалното изписване (за точна Wikipedia страница на езика — med/links.js)
  return { source: 'med-db', title, active: (it.active || []).slice(), description, warnings: '', exact: hit.score >= 2, sections: sections.length ? sections : undefined, otherNames: other.slice(0, 8), form: it.form || '', inn: it.inn, translated: !it.usage, localName: local[0] || '' };
}
// Канонично генерично име (INN) за каквото и да е изписване — за таблицата на взаимодействията.
export async function resolveInn(query) {
  const hit = await searchMedDb(query, { minScore: 2 });
  if (hit) return { inn: hit.item.inn, active: hit.item.active || [hit.item.inn], name: hit.name };
  // v1.0024: резерв — големият речник (търговско име → INN), после INN-ът пак се търси в med-db за съставките
  let nm = null; try { nm = await searchNames(query, { minScore: 2 }); } catch (_) { nm = null; }
  if (!nm) return null;
  let md = null; try { md = await searchMedDb(nm.inn, { minScore: 3 }); } catch (_) { md = null; }
  return md ? { inn: md.item.inn, active: md.item.active || [md.item.inn], name: nm.name } : { inn: nm.inn, active: [nm.inn], name: nm.name };
}
