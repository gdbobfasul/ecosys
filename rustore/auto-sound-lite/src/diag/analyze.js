// Version: 1.0001
// analyze.js — БЕЗ AI. Сравнява извлечените акустични признаци (audio.js) с базата PROBLEMS
// (data.js) + контекста (къде/кога) → подредени възможни причини. Текстовете са на български и
// се превеждат на избрания език на показване (MyMemory, keyless — както в другите приложения).
import { PROBLEMS } from './data.js';

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

// Превод bg → избрания език. Ако target == bg (или няма мрежа) връща оригинала.
export async function translate(text, lang) {
  const t = String(text || '').trim(); if (!t) return '';
  const target = String(lang || 'bg').split('-')[0];
  if (!target || target === 'bg') return t;
  try {
    const parts = t.match(/[\s\S]{1,450}(\s|$)/g) || [t]; const out = [];
    for (const p of parts) {
      const j = await getJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(p.trim()) + '&langpair=bg|' + encodeURIComponent(target));
      out.push((j && j.responseData && j.responseData.translatedText) || p);
    }
    return out.join(' ');
  } catch (_) { return t; }
}

// Оценка на едно състояние спрямо признаците (feat) и контекста (where/when — по избор).
// present → колкото по-силни, толкова по-добре; absent → колкото по-слаби, толкова по-добре.
function scoreOne(p, feat, where, when) {
  let s = 0, n = 0;
  for (const k of p.present) { s += (feat[k] || 0); n++; }
  const presAvg = n ? s / n : 0;
  let a = 0, m = 0;
  for (const k of p.absent) { a += (feat[k] || 0); m++; }
  const absAvg = m ? a / m : 0;
  let score = presAvg - absAvg * 0.6;                 // силни present, слаби absent
  // контекстен бонус (не е задължителен — само насочва)
  if (where && p.where.includes(where)) score += 0.12;
  if (when && p.when.includes(when)) score += 0.12;
  return score;
}

// Връща подредени съвпадения (най-вероятните отгоре). input: feat (признаци), where, when.
// Всяко: { id, name, cause, advice, urgency, confidence (0..1) }.
export function diagnose(feat, where, when) {
  const scored = PROBLEMS.map((p) => ({ p, s: scoreOne(p, feat, where, when) }));
  // отделяме „здраво" — то е база: ако нищо реално не изпъква, то печели
  const real = scored.filter((x) => x.p.id !== 'healthy').sort((a, b) => b.s - a.s);
  const healthy = scored.find((x) => x.p.id === 'healthy');

  const top = real.slice(0, 4).filter((x) => x.s > 0.18);
  const out = [];
  // ако най-силното реално съвпадение е слабо → показваме „звучи нормално" начело
  if (!top.length || (healthy && healthy.s > top[0].s && top[0].s < 0.3)) {
    out.push(pack(healthy.p, Math.min(0.9, 0.5 + healthy.s)));
  }
  for (const x of top) out.push(pack(x.p, conf(x.s)));
  return out.slice(0, 4);
}

function conf(s) { return Math.max(0.2, Math.min(0.95, s * 1.3)); }
function pack(p, confidence) {
  return { id: p.id, name: p.name, cause: p.cause, advice: p.advice, urgency: p.urgency, confidence: +confidence.toFixed(2) };
}
