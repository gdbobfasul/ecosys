// Version: 1.0024
// gtin.js — ВГРАДЕНА ТАБЛИЦА БАРКОД → ЛЕКАРСТВО (public/reference/gtin-db.json, от deploy-scripts/gen-gtin-db.mjs):
// ~100 000 продукта от openFDA NDC Directory (търговско име | генерично име), достъпни по:
//   • изричен UPC-12 (openfda.upc);
//   • NDC-производен код: в САЩ UPC-A на лекарство = „3" + 10-цифрен NDC + контролна цифра → префиксът на продукта
//     (9 или 8 цифри) се търси в таблицата (двоично търсене в числови масиви, разгънати от delta/base36 запис).
// Резерв ОНЛАЙН (когато кодът липсва): openFDA ndc.json по openfda.upc (пряко → през relay), 12 s таймаут.
import { getJson } from './lookup.js';
import { extraGtin } from './sync.js';

let DB = null;
function expand(deltas) { const parts = String(deltas || '').split(','); const out = new Float64Array(parts.length); let v = 0; for (let i = 0; i < parts.length; i++) { v += parseInt(parts[i], 36) || 0; out[i] = v; } return out; }
function refs(s) { const parts = String(s || '').split(','); const out = new Uint32Array(parts.length); for (let i = 0; i < parts.length; i++) out[i] = parseInt(parts[i], 36) || 0; return out; }
async function load() {
  if (DB) return DB;
  try {
    const r = await fetch('reference/gtin-db.json'); const j = r.ok ? await r.json() : null;
    DB = j && j.names ? { names: j.names, n8: expand(j.n8), r8: refs(j.r8), n9: expand(j.n9), r9: refs(j.r9), u: expand(j.u), ru: refs(j.ru), products: j.products || 0, updated: j.updated || '' } : { names: [], n8: new Float64Array(0), r8: new Uint32Array(0), n9: new Float64Array(0), r9: new Uint32Array(0), u: new Float64Array(0), ru: new Uint32Array(0), products: 0 };
  } catch (_) { DB = { names: [], n8: new Float64Array(0), r8: new Uint32Array(0), n9: new Float64Array(0), r9: new Uint32Array(0), u: new Float64Array(0), ru: new Uint32Array(0), products: 0 }; }
  return DB;
}
export async function loadGtinDb() { return load(); }
function bsearch(arr, v) { let lo = 0, hi = arr.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] === v) return mid; if (arr[mid] < v) lo = mid + 1; else hi = mid - 1; } return -1; }
function entry(db, idx) {
  const s = db.names[idx]; if (s == null) return null;
  const [brand, generic] = String(s).split('|');
  return { brand: brand || '', generic: generic || '', name: [brand, generic].filter(Boolean).join(' · ') };
}
// Нормализира прочетения код до 12-цифрен UPC (когато е възможно) и 13-цифрен EAN.
export function gtinForms(code) {
  let d = String(code || '').replace(/\D/g, '');
  if (d.length === 14) d = d.replace(/^0+/, '');
  if (d.length === 13 && d[0] === '0') d = d.slice(1);
  const upc12 = d.length === 12 ? d : ''; const ean13 = d.length === 13 ? d : (upc12 ? '0' + upc12 : '');
  return { digits: d, upc12, ean13 };
}
// Търсене в таблицата. Връща { brand, generic, name, gtin, via } или null.
export async function lookupGtin(code) {
  const db = await load(); const f = gtinForms(code);
  if (!f.digits) return null;
  // v1.0024: научени от сървъра кодове (локален допълнителен индекс) — първи
  try { const ex = extraGtin(f.upc12 || f.digits); if (ex) return Object.assign(ex, { gtin: f.ean13 || f.digits }); } catch (_) {}
  if (!db.names.length) return null;
  if (f.upc12) {
    let i = bsearch(db.u, parseInt(f.upc12, 10)); if (i >= 0) { const e = entry(db, db.ru[i]); if (e) return Object.assign(e, { gtin: f.ean13, via: 'upc' }); }
    if (f.upc12[0] === '3') {
      const ndc10 = f.upc12.slice(1, 11);
      i = bsearch(db.n9, parseInt(ndc10.slice(0, 9), 10)); if (i >= 0) { const e = entry(db, db.r9[i]); if (e) return Object.assign(e, { gtin: f.ean13, via: 'ndc', ndc: ndc10 }); }
      i = bsearch(db.n8, parseInt(ndc10.slice(0, 8), 10)); if (i >= 0) { const e = entry(db, db.r8[i]); if (e) return Object.assign(e, { gtin: f.ean13, via: 'ndc', ndc: ndc10 }); }
    }
  }
  return null;
}
// Онлайн резерв: openFDA NDC по UPC (13- и 12-цифрен запис). Хвърля при липса на мрежа — викащият го хваща.
export async function lookupGtinOnline(code) {
  const f = gtinForms(code); if (!f.upc12 && !f.ean13) return null;
  const q = [f.ean13, f.upc12].filter(Boolean).map((x) => 'openfda.upc:"' + x + '"').join('+OR+');
  const j = await getJson('https://api.fda.gov/drug/ndc.json?search=(' + q + ')&limit=1');
  const p = j && j.results && j.results[0]; if (!p) return null;
  return { brand: String(p.brand_name || ''), generic: String(p.generic_name || ''), name: [p.brand_name, p.generic_name].filter(Boolean).join(' · '), gtin: f.ean13, via: 'openFDA', form: String(p.dosage_form || '').toLowerCase(), active: (p.active_ingredients || []).map((a) => a.name + (a.strength ? ' ' + a.strength.replace(/\/1$/, '') : '')) };
}
// Заявки за пълната карта по намерения запис: генерично (цяло → без солта → първа дума), после марката.
export function gtinQueries(g) {
  const out = []; const push = (s) => { s = String(s || '').replace(/\s+/g, ' ').trim(); if (s && s.length >= 4 && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s); };
  const gen = String(g.generic || '').replace(/,.*$/, '');
  push(gen);
  const w = gen.split(' '); if (w.length > 1) push(w.slice(0, -1).join(' '));
  if (w[0] && w[0].length >= 6) push(w[0]);
  push(g.brand);
  return out;
}
// Кратка карта само от регистъра (когато нито една заявка не намери пълна карта).
export function gtinToResult(g) {
  const title = g.brand ? g.brand + (g.generic && g.generic.toLowerCase() !== g.brand.toLowerCase() ? ' (' + g.generic + ')' : '') : g.generic;
  return { source: g.via === 'openFDA' ? 'openFDA' : 'gtin-db', title, active: (g.active && g.active.length ? g.active : [g.generic]).filter(Boolean), description: '', warnings: '', exact: true, inn: g.generic, form: g.form || '', translated: true };
}
