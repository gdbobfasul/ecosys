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
// bg → lang (MyMemory). За eng target/празно връща оригинала. Реже на части (лимит ~450).
export async function translate(text, lang) {
  const t = String(text || '').trim(); if (!t) return '';
  const target = String(lang || 'bg').split('-')[0]; if (target === 'bg') return t;
  try {
    const parts = t.match(/[\s\S]{1,450}(\s|$)/g) || [t]; const out = [];
    for (const p of parts) {
      const j = await getJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(p.trim()) + '&langpair=bg|' + encodeURIComponent(target));
      out.push((j && j.responseData && j.responseData.translatedText) || p);
    }
    return out.join(' ');
  } catch (_) { return t; }
}

// Вграден многоезичен пакет (скрапнат, Wikipedia). Чете се с обикновен fetch (бъндъл-асет).
async function fetchLocal(p) { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch (_) { return null; } }
// Автентичен текст за състоянието на избрания език (описание/симптоми/лечение от статията).
export async function conditionText(id, lang) {
  const rec = await fetchLocal('reference/' + id + '.json'); if (!rec || !rec.langs) return '';
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
export async function imageMatches(/* file */) {
  const ref = await loadReference();
  if (!ref.length) return [];        // няма свалена референтна библиотека още
  return [];                          // TODO: MobileNet embedding + косинус срещу ref (следваща стъпка)
}
