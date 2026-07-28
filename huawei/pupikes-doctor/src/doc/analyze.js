// Version: 1.0001
// analyze.js — БЕЗ AI. Анализ по признаци (област/размер/болка) + текстови оплаквания срещу
// база `CONDITIONS` → възможни съвпадения (топ N). Снимката се сравнява срещу СВАЛЕНА референтна
// библиотека (когато е налична — виж loadReference/imageMatches; засега структура-готова).
// Съветите се превеждат на избрания език (MyMemory, keyless).
import { CONDITIONS, norm } from './data.js';

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
async function getJson(url) {
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  if (CH && CH.get) {
    const r = await Promise.race([CH.get({ url, headers: { accept: 'application/json' } }), timeout(12000)]);
    const d = r && r.data; return typeof d === 'string' ? JSON.parse(d) : d;
  }
  const r = await Promise.race([fetch(url, { headers: { accept: 'application/json' } }), timeout(12000)]);
  if (!r.ok) throw new Error('http ' + r.status); return r.json();
}
// source → lang (MyMemory). Ако target == source (или празно) връща оригинала. Реже на части (лимит ~450).
// source по подразбиране 'bg' (съветите ни са на български); при статиен текст, паднал на английски,
// подаваме source='en', за да превеждаме от ПРАВИЛНИЯ език към избрания.
export async function translate(text, lang, source) {
  const t = String(text || '').trim(); if (!t) return '';
  const target = String(lang || 'bg').split('-')[0];
  const src = String(source || 'bg').split('-')[0];
  if (!target || target === src) return t;
  try {
    const parts = t.match(/[\s\S]{1,450}(\s|$)/g) || [t]; const out = [];
    for (const p of parts) {
      const j = await getJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(p.trim()) + '&langpair=' + encodeURIComponent(src) + '|' + encodeURIComponent(target));
      out.push((j && j.responseData && j.responseData.translatedText) || p);
    }
    return out.join(' ');
  } catch (_) { return t; }
}

// Вграден многоезичен пакет (скрапнат, Wikipedia). Чете се с обикновен fetch (бъндъл-асет).
async function fetchLocal(p) { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch (_) { return null; } }
// Автентичен текст за състоянието на избрания език (описание/симптоми/лечение от статията).
// Ако липсва точно на избрания език → взима наличния (en/bg) и ГО ПРЕВЕЖДА към избрания, за да не
// показваме английски текст на български потребител (изискване: резултатът е на избрания език).
export async function conditionText(id, lang) {
  const rec = await fetchLocal('reference/' + id + '.json'); if (!rec || !rec.langs) return '';
  const want = String(lang || '').split('-')[0] || 'en';
  const exact = rec.langs[lang] || rec.langs[want];
  if (exact && exact.extract) return exact.extract;                 // има го на избрания език
  // няма → вземи наличния (предпочети en, после bg, после кой да е) и преведи от НЕГОВИЯ език
  let srcLang = 'en', src = rec.langs.en;
  if (!src || !src.extract) { srcLang = 'bg'; src = rec.langs.bg; }
  if (!src || !src.extract) { for (const k in rec.langs) { if (rec.langs[k] && rec.langs[k].extract) { srcLang = String(k).split('-')[0]; src = rec.langs[k]; break; } } }
  if (!src || !src.extract) return '';
  return await translate(src.extract, want, srcLang);
}
// Авторитетен текст за БОЛКА В ЗОНА (режим „Къде боли") — от bodypain пакета (Wikipedia, per език).
export async function bodyPainText(zoneId, lang) {
  const rec = await fetchLocal('reference/bodypain/' + zoneId + '.json'); if (!rec || !rec.langs) return '';
  const L = rec.langs[lang] || rec.langs[String(lang).split('-')[0]] || rec.langs.en;
  return (L && L.extract) || '';
}

// Оценка на състоянията спрямо входа. input = { area, painLevel(0-3), size(0-2), text }.
// boosts (по избор) = карта {id: точки} от анализа на СНИМКАТА (виж photoBoost) — прибавя се.
export function score(input, boosts) {
  boosts = boosts || {};
  const nText = norm(input.text);
  const results = [];
  for (const c of CONDITIONS) {
    let s = 0;
    if (input.area && c.area === input.area) s += 4;                 // съвпадение на областта
    for (const k of c.keywords) { if (nText && nText.includes(norm(k))) s += 2; }
    for (const sg of c.signs) { if (nText && nText.includes(norm(sg))) s += 2; }
    if (c.painRelevant && input.painLevel >= 2) s += 1;              // силна болка → по-вероятни болезнените
    if (c.sizeRelevant && input.size >= 2) s += 1;                   // голям размер → тежест
    if (boosts[c.id]) s += boosts[c.id];                             // сигнал от снимката (център + цвят)
    if (s > 0) results.push({ c, s });
  }
  results.sort((a, b) => b.s - a.s);
  return results.slice(0, 5).map((r) => r.c);
}

// ── Анализ на СНИМКАТА (център-изрязване + цветови сигнал) ───────────────────────
// Проблемът обикновено е в СРЕДАТА на кадъра и е най-ясен там → анализираме централните ~60%.
// Без AI/библиотека: смятаме цветови характеристики (червенина, тъмнина/синьо, наситеност) и от
// тях подсказваме вероятни състояния (изгаряне/обрив/инфекция/рана срещу натъртване/оток).
function loadImg(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(u); res(img); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); };
    img.src = u;
  });
}
export async function photoSignal(file) {
  if (!file) return null;
  let img; try { img = await loadImg(file); } catch (_) { return null; }
  const S = 64, c = document.createElement('canvas'); c.width = S; c.height = S;
  const cx = c.getContext('2d');
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const cw = Math.max(1, Math.floor(w * 0.6)), ch = Math.max(1, Math.floor(h * 0.6));   // центъра
  cx.drawImage(img, Math.floor((w - cw) / 2), Math.floor((h - ch) / 2), cw, ch, 0, 0, S, S);
  let d; try { d = cx.getImageData(0, 0, S, S).data; } catch (_) { return null; }
  let r = 0, g = 0, b = 0, redSpots = 0, darkSpots = 0; const n = S * S;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    r += R; g += G; b += B;
    if (R > 120 && R - (G + B) / 2 > 35) redSpots++;              // силно червено (кръв/възпаление/изгаряне)
    if ((R + G + B) / 3 < 70 && B >= R) darkSpots++;              // тъмно/синкаво (натъртване)
  }
  r /= n; g /= n; b /= n;
  const bright = (r + g + b) / 3, max = Math.max(r, g, b), min = Math.min(r, g, b);
  return { r, g, b, bright, redness: r - (g + b) / 2, sat: max ? (max - min) / max : 0, redFrac: redSpots / n, darkFrac: darkSpots / n };
}
// Превръща цветовия сигнал в подсказки към състоянията (id → допълнителни точки).
export function photoBoost(sig) {
  const b = {}; if (!sig) return b;
  const add = (id, v) => { b[id] = (b[id] || 0) + v; };
  if (sig.redness > 18 || sig.redFrac > 0.06) { add('burn', 3); add('rash', 3); add('infection', 3); add('bite', 2); add('cut', 2); add('sunburn', 3); add('hives', 2); add('eczema', 2); add('abrasion', 2); add('boil', 2); }
  if (sig.redFrac > 0.18) { add('cut', 3); add('burn', 2); }                 // концентрирано ярко червено → кръв/рана
  if (sig.darkFrac > 0.12 || (sig.bright < 95 && sig.b >= sig.r)) { add('bruise', 4); add('swelling', 2); add('frostbite', 2); }
  if (sig.r > 150 && sig.g > 130 && sig.b < 110) { add('infection', 2); add('boil', 2); }    // жълтеникаво (гной)
  return b;
}

// ── Снимкова библиотека (референтни снимки на състояния, СВАЛЯТ се предварително) ──
// Когато е налична: MobileNet embedding на снимката → косинусово сходство срещу референтните
// вектори → най-близките състояния. Засега няма свалена библиотека → връща [] и анализът минава
// по признаци/текст. (Механизмът е готов за включване на библиотеката.)
export async function loadReference() {
  try { const j = await getJson('reference/index.json'); return (j && j.items) || []; }
  catch (_) { return []; }
}

// ── РЕАЛНО сравнение срещу снимковия корпус (21 971 снимки) ──────────────────────────
// В апа НЕ носим снимките (226 MB), а ЧИСЛОВ ОПИС: 128 байта на снимка (8×8 сива структура +
// 4×4×4 цветова хистограма), сметнати от ЦЕНТЪРА на кадъра. Тук смятаме същия отпечатък за
// заснетата снимка и търсим най-близките (L1 разстояние) → етикетите им подсказват състояния.
// ПО-БОГАТИЯТ опис (по-висок таван на снимки/диагноза → по-точен мач) живее на СЪРВЪРА и се тегли
// ОНЛАЙН. Офлайн ползваме вградения (по-лек) опис от бъндъла. Така апът е лек, но по-точен с интернет.
const MEDIKIT_BASE = 'https://selflearning.bot.nu/medikit';
function parseSigs(j) {
  if (!j || !j.items || !j.items.length) return null;
  const dim = j.dim || 128, n = j.items.length;
  const flat = new Uint8Array(n * dim), labs = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const b = atob(j.items[i].v);
    for (let k = 0; k < dim; k++) flat[i * dim + k] = b.charCodeAt(k);
    labs[i] = j.items[i].l | 0;
  }
  return { dim, n, flat, labs, labels: j.labels || [] };
}
let SIGS = null;
async function loadSignatures() {
  if (SIGS !== null) return SIGS;
  // Телефонът е ОСНОВЕН (вграденият опис се събира под бюджета) → пробвай първо него (мигновено, офлайн).
  try { const loc = parseSigs(await fetchLocal('reference/image-signatures.json')); if (loc) { SIGS = loc; return SIGS; } } catch (_) {}
  // Резерв: ако вграденият липсва/е празен → по-богатия от сървъра (изисква интернет).
  try { const srv = parseSigs(await getJson(MEDIKIT_BASE + '/image-signatures.json')); SIGS = srv || false; } catch (_) { SIGS = false; }
  return SIGS;
}
// Същият алгоритъм като офлайн описа, но през canvas.
async function photoSignature(file) {
  if (!file) return null;
  let img; try { img = await loadImg(file); } catch (_) { return null; }
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const cw = Math.max(2, Math.floor(w * 0.6)), ch = Math.max(2, Math.floor(h * 0.6));
  const sx = Math.floor((w - cw) / 2), sy = Math.floor((h - ch) / 2);
  const out = new Uint8Array(128);
  // 8×8 сива структура, нормализирана по min/max
  const c1 = document.createElement('canvas'); c1.width = 8; c1.height = 8;
  const x1 = c1.getContext('2d'); x1.drawImage(img, sx, sy, cw, ch, 0, 0, 8, 8);
  let d1; try { d1 = x1.getImageData(0, 0, 8, 8).data; } catch (_) { return null; }
  const gray = new Array(64);
  for (let i = 0; i < 64; i++) gray[i] = 0.299 * d1[i * 4] + 0.587 * d1[i * 4 + 1] + 0.114 * d1[i * 4 + 2];
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < 64; i++) { if (gray[i] < mn) mn = gray[i]; if (gray[i] > mx) mx = gray[i]; }
  const rng = (mx - mn) || 1;
  for (let i = 0; i < 64; i++) out[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - mn) / rng) * 255)));
  // 4×4×4 цветова хистограма от 32×32
  const c2 = document.createElement('canvas'); c2.width = 32; c2.height = 32;
  const x2 = c2.getContext('2d'); x2.drawImage(img, sx, sy, cw, ch, 0, 0, 32, 32);
  let d2; try { d2 = x2.getImageData(0, 0, 32, 32).data; } catch (_) { return null; }
  const hist = new Array(64).fill(0), px = 32 * 32;
  for (let i = 0; i < px; i++) { const r = d2[i * 4] >> 6, g = d2[i * 4 + 1] >> 6, b = d2[i * 4 + 2] >> 6; hist[r * 16 + g * 4 + b]++; }
  for (let i = 0; i < 64; i++) out[64 + i] = Math.min(255, Math.round((hist[i] / px) * 255 * 8));
  return out;
}
// Етикет от корпуса → id на състояние (където има смислово съответствие).
function condFromLabel(lab) {
  const s = String(lab || '').toLowerCase();
  if (/sunburn/.test(s)) return 'sunburn';
  if (/burn|scald/.test(s)) return 'burn';
  if (/bruis|contusion|h(a)?ematoma|ecchymos/.test(s)) return 'bruise';
  if (/abrasion|graze/.test(s)) return 'abrasion';
  if (/wound|laceration|\bcut\b|incision/.test(s)) return 'cut';
  if (/urticaria|hives/.test(s)) return 'hives';
  if (/psorias/.test(s)) return 'psoriasis';
  if (/dermatitis|eczema/.test(s)) return 'eczema';
  if (/tinea|dermatophyt|fungal|candid|mycos/.test(s)) return 'fungal';
  if (/furuncle|boil|abscess|carbuncle/.test(s)) return 'boil';
  if (/cellulitis|impetigo|infect|pyoderma/.test(s)) return 'infection';
  if (/blister|bulla|vesic/.test(s)) return 'blister';
  if (/frostbite|chilblain|pernio/.test(s)) return 'frostbite';
  if (/fracture/.test(s)) return 'fracture';
  if (/sprain/.test(s)) return 'sprain';
  if (/dislocation/.test(s)) return 'dislocation';
  if (/bite|sting/.test(s)) return 'bite';
  if (/edema|oedema|swelling/.test(s)) return 'swelling';
  if (/ingrown/.test(s)) return 'ingrown_nail';
  if (/rash|exanthem|erythema/.test(s)) return 'rash';
  return '';
}
// Връща { conds:[condition обекти], top:[{label,count}], dermat:bool }.
export async function imageMatches(file) {
  const empty = { conds: [], top: [], dermat: false };
  const S = await loadSignatures(); if (!S) return empty;
  const q = await photoSignature(file); if (!q) return empty;
  const K = 24, dim = S.dim, n = S.n, flat = S.flat;   // повече съседи → рядко-но-близки класове (напр. псориазис) също се появяват
  const bestD = new Array(K).fill(Infinity), bestI = new Array(K).fill(-1);
  for (let i = 0; i < n; i++) {
    let d = 0; const off = i * dim;
    for (let k = 0; k < dim; k++) { const diff = q[k] - flat[off + k]; d += diff < 0 ? -diff : diff; }
    if (d < bestD[K - 1]) {                       // вмъкване в подредения топ-K
      let j = K - 1;
      while (j > 0 && bestD[j - 1] > d) { bestD[j] = bestD[j - 1]; bestI[j] = bestI[j - 1]; j--; }
      bestD[j] = d; bestI[j] = i;
    }
  }
  const counts = new Map(), condCount = new Map();
  for (let t = 0; t < K; t++) {
    const i = bestI[t]; if (i < 0) continue;
    const lab = S.labels[S.labs[i]] || '';
    counts.set(lab, (counts.get(lab) || 0) + 1);
    const cid = condFromLabel(lab);
    if (cid) condCount.set(cid, (condCount.get(cid) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));
  const ids = [...condCount.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const conds = ids.map((id) => CONDITIONS.find((c) => c.id === id)).filter(Boolean);
  // Дерматологичен характер (бенки/лезии) — корпусът е предимно такъв; отбелязва се отделно.
  const dermat = top.some((t) => /melanom|nevus|naevus|carcinom|keratos|lesion|mole|dysplas|lentigo|dermatofibrom|hemangiom|angiokeratom|neurofibrom|acanthoma|verruca|melanocytic|benign|malignant/.test(t.label));
  // УВЕРЕНОСТ: колко от 15-те най-близки сочат ЕДНО И СЪЩО състояние. Малко съгласие → съвпадението
  // е несигурно (напр. следоперативна рана няма аналог в дерматологичния корпус → случайни съседи).
  // Тогава НЕ бива да водим уверено с корпусната диагноза (виж main.js: слаб корпус → водят цвят/текст).
  const topCondVotes = ids.length ? (condCount.get(ids[0]) || 0) : 0;
  const strong = topCondVotes >= 6;
  return { conds, top, dermat, strong, topCondVotes, minDist: bestD[0] };
}
