// Version: 1.0024
// names.js — ГОЛЯМ РЕЧНИК НА ИМЕНА (public/reference/drug-names.json, от deploy-scripts/gen-drug-names.mjs):
// десетки хиляди имена (INN/генерични + търговски + изписвания на 20 езика от Wikidata и openFDA), всяко свързано
// със запис [inn, брой статии, кратко описание]. Търсене с ТОЛЕРАНС (същата нормализация/транслитерация като
// meddb.js + Левенщайн по кошове с еднаква дължина → бързо и на телефон). Когато INN-ът е сред ~580-те на med-db,
// lookup.js показва пълната карта; иначе кратка карта от речника (+ openFDA онлайн за листовка).
import { norm, translitCyr } from './data.js';
import { extraName, setNameKey } from './sync.js';

let D = null;
const CJK = /[぀-ヿ㐀-鿿]/;
const lat = (s) => norm(translitCyr(String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')));
const keyOf = (s) => CJK.test(s) ? String(s).replace(/\s+/g, '') : lat(s);
setNameKey(keyOf);   // v1.0024: научените от сървъра имена се пазят със същия ключ като речника

async function load() {
  if (D) return D;
  let j = null; try { const r = await fetch('reference/drug-names.json'); j = r.ok ? await r.json() : null; } catch (_) { j = null; }
  const names = (j && j.names) || [], refs = (j && j.refs) || [], inns = (j && j.inns) || [];
  const keys = new Array(names.length); const exact = new Map(); const byLen = new Map(); const cjk = [];
  for (let i = 0; i < names.length; i++) {
    const k = keyOf(names[i]); keys[i] = k; if (!k) continue;
    if (!exact.has(k)) exact.set(k, i);
    if (CJK.test(k)) { cjk.push(i); continue; }
    let b = byLen.get(k.length); if (!b) { b = []; byLen.set(k.length, b); } b.push(i);
  }
  D = { names, refs, inns, keys, exact, byLen, cjk, count: names.length };
  return D;
}
export async function loadNames() { return load(); }

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
const tolFor = (len) => len >= 11 ? 2 : len >= 6 ? 1 : 0;
function hit(d, i, score) { const ref = d.refs[i]; const rec = d.inns[ref] || [String(d.names[i]).toLowerCase(), 0, '']; return { name: d.names[i], inn: rec[0], n: rec[1] || 0, desc: rec[2] || '', ref, score }; }

// Вещества, които са ПОМОЩНИ (ексципиенти) или храни/думи от опаковката, не лекарства — речникът ги има от
// Wikidata/DrugBank, но върху кутията те са „съдържа соев лецитин/лактоза", не името на лекарството.
const NOT_MED = /^(honey|lemon|lime|orange|apple|cherry|strawberry|grape|vanilla|chocolate|mint|menthol|milk|water|sugar|salt|alcohol|ethanol|coffee|tea|oil|glucose|lactose|sucrose|fructose|starch|gelatin|gelatine|caffeine|ginger|garlic|cinnamon|lecithin|soy lecithin|soya lecithin|cellulose|microcrystalline cellulose|magnesium stearate|stearic acid|silica|silicon dioxide|talc|titanium dioxide|povidone|crospovidone|mannitol|sorbitol|xylitol|glycerol|glycerin|propylene glycol|macrogol|polyethylene glycol|sodium chloride|potassium chloride|calcium carbonate|iron oxide|shellac|carnauba wax|beeswax|paraffin|petrolatum|lanolin|corn starch|maize starch|hypromellose|hydroxypropyl cellulose|sodium starch glycolate|croscarmellose sodium|walmart|equate|kroger|cvs|walgreens|target|kirkland|amazon|мед|лимон|захар|вода|сол|мята|мёд|лецитин|лактоза|целулоза|целлюлоза)$/i;
function withHit(h) { return h && NOT_MED.test(h.inn) ? null : h; }
// Най-добро съвпадение: 3 = точно, 2 = ≤tol грешки / падежно окончание (префикс с ≤2 знака разлика), 1 = префикс ≥6.
export async function searchNames(query, opts) { return withHit(await searchNamesRaw(query, opts)); }
async function searchNamesRaw(query, opts) {
  opts = opts || {}; const d = await load();
  const raw = String(query || '').trim(); if (!raw) return null;
  const q = keyOf(raw); const isCjk = CJK.test(q);
  if (!q || (!isCjk && q.length < 4)) return null;
  // v1.0024: научени от сървъра имена (локален допълнителен индекс) — точно съвпадение
  try { const sx = extraName(q); if (sx && sx.inn) return { name: sx.name || raw, inn: sx.inn, n: 0, desc: '', ref: -1, score: 3 }; } catch (_) {}
  if (!d.count) return null;
  const ex = d.exact.get(q); if (ex !== undefined) return hit(d, ex, 3);
  let best = null; const better = (i, s) => { if (!best || s > best.score || (s === best.score && (d.inns[d.refs[i]] || [0, 0])[1] > best.n)) best = hit(d, i, s); };
  if (isCjk) {
    for (const i of d.cjk) { const k = d.keys[i]; if (k.length >= 2 && (q.includes(k) && k.length >= 0.6 * q.length || k.includes(q) && q.length >= 2)) better(i, 2); }
    return best && best.score >= (opts.minScore || 2) ? best : null;
  }
  const tol = tolFor(q.length);
  for (let L = q.length - Math.max(tol, 2); L <= q.length + Math.max(tol, 2); L++) {
    const b = d.byLen.get(L); if (!b) continue;
    for (const i of b) {
      const k = d.keys[i];
      if (Math.min(k.length, q.length) >= 5 && Math.abs(k.length - q.length) <= 2 && (k.startsWith(q) || q.startsWith(k))) { better(i, 2); continue; }
      if (tol && Math.abs(k.length - q.length) <= tol && lev(k, q, tol) <= tol) { better(i, 2); continue; }
      if (q.length >= 6 && k.startsWith(q)) better(i, 1);
    }
    if (best && best.score >= 3) break;
  }
  return best && best.score >= (opts.minScore || 2) ? best : null;
}

// Кандидати от свободен текст (за картата „не е разпознато"): думи ≥4 букви + CJK откъси → до max различни INN.
const STOP = /^(tablets?|capsules?|caplets?|coated|film|relief|fever|pain|extra|strength|maximum|regular|adults?|children|contains?|active|ingredient|each|dose|dosage|directions|warnings?|store|keep|reach|pharma|pharmacy|health|natural|original|таблетки|капсули|капсулы|инструкция|состав|показания|упаковка|опаковка|листовка|comprimes|comprimidos|tabletten|gelules|filmomhulde|kalium|sodium|natrium|calcium|hydrochloride|hydrochlorid|acid|acide|forte|retard|rapid|plus|junior|baby|kids|extra|with|from|this|that|have|been|were|will|your|only|also|more|than|when|what|which|about|into|over|after|before|other|some|them|they|then|there|these|those|very|just|like|make|made|take|taken|used|uses|use|not|and|for|the)$/i;
// Вещества от речника, които са и обикновени думи/храни върху опаковките (мед, лимон, захар…) — не са кандидати.
const FOOD = /^(honey|lemon|lime|orange|apple|cherry|strawberry|grape|vanilla|chocolate|mint|menthol|milk|water|sugar|salt|alcohol|coffee|tea|oil|glucose|lactose|sucrose|starch|gelatin|caffeine|ginger|garlic|cinnamon|мед|лимон|захар|вода|сол|мята|мед|мёд)$/i;
export async function namesCandidates(text, max) {
  const d = await load(); if (!d.count) return [];
  const t = String(text || ''); const out = new Map(); const seen = new Set();
  const consider = async (tok, bonus) => {
    const h = await searchNames(tok, { minScore: 2 }); if (!h || FOOD.test(h.inn)) return;
    // OCR-шум (къси/обикновени думи) улучва редки имена от речника → само точно съвпадение на дълга дума
    if (h.score < 3 && tok.length < 8) return;
    const sc = h.score * 10 + bonus + Math.min(9, Math.log2((h.n || 0) + 1));
    const cur = out.get(h.inn); if (!cur || sc > cur.sc) out.set(h.inn, { inn: h.inn, name: h.name, token: tok, score: h.score, sc, desc: h.desc, n: h.n });
  };
  const words = t.match(/[A-Za-zÀ-ÿА-Яа-яЁё][A-Za-zÀ-ÿА-Яа-яЁё\-]{3,}/g) || [];
  for (const w of words) { const k = w.toLowerCase(); if (seen.has(k) || STOP.test(k)) continue; seen.add(k); await consider(w, /(ol|in|ine|cillin|mycin|pril|sartan|olol|azole|fen|mide|pam|lam|statin|profen|amol|cet|zin|zine|dine|mab|vir|oxin|cin|tin|xin|ide|ate|ил|ин|ол|цин|зол|фен|мид|пам|там|ат)$/i.test(w) ? 4 : 0); if (seen.size > 60) break; }
  for (const run of (t.match(/[぀-ヿ㐀-鿿]{2,10}/g) || []).slice(0, 20)) await consider(run, 0);
  return Array.from(out.values()).sort((a, b) => b.sc - a.sc).slice(0, max || 6);
}
// Кратка карта от речника (когато лекарството не е сред ~580-те с пълни данни).
export function namesToResult(h, lang) {
  const title = String(h.name || h.inn).replace(/^./, (c) => c.toUpperCase());
  return { source: 'names-db', title, active: [h.inn], description: h.desc || '', warnings: '', exact: h.score >= 2, inn: h.inn, otherNames: h.inn.toLowerCase() !== title.toLowerCase() ? [h.inn] : [], translated: false, form: '' };
}
