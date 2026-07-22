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
export function score(input) {
  const nText = norm(input.text);
  const results = [];
  for (const c of CONDITIONS) {
    let s = 0;
    if (input.area && c.area === input.area) s += 4;                 // съвпадение на областта
    for (const k of c.keywords) { if (nText && nText.includes(norm(k))) s += 2; }
    for (const sg of c.signs) { if (nText && nText.includes(norm(sg))) s += 2; }
    if (c.painRelevant && input.painLevel >= 2) s += 1;              // силна болка → по-вероятни болезнените
    if (c.sizeRelevant && input.size >= 2) s += 1;                   // голям размер → тежест
    if (s > 0) results.push({ c, s });
  }
  results.sort((a, b) => b.s - a.s);
  return results.slice(0, 5).map((r) => r.c);
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
