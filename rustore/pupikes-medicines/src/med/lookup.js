// Version: 1.0001
// lookup.js — търсене на лекарство: 1) онлайн openFDA (+ уеб), 2) резерв офлайн база;
// после превод на описанието (MyMemory, keyless). На телефон ползва CapacitorHttp (заобикаля
// CORS); в браузър — fetch. БЕЗ AbortController (чупи CapacitorHttp) — таймаут през Promise.race.
import { offlineLookup, findRisky, norm } from './data.js';

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

// GET на JSON, с CapacitorHttp когато е налично, иначе fetch. Връща обект или хвърля.
async function getJson(url) {
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  if (CH && CH.get) {
    const r = await Promise.race([CH.get({ url, headers: { accept: 'application/json' } }), timeout(12000)]);
    const data = r && r.data;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
  const r = await Promise.race([fetch(url, { headers: { accept: 'application/json' } }), timeout(12000)]);
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

// Превод на текст en→lang през MyMemory (безплатно, без ключ). Празен/eng target → връща текста.
export async function translate(text, lang) {
  const t = String(text || '').trim();
  if (!t) return '';
  const target = String(lang || 'en').split('-')[0];
  if (target === 'en') return t;
  try {
    // MyMemory има лимит ~500 знака на заявка → режем на части.
    const parts = t.match(/[\s\S]{1,450}(\s|$)/g) || [t];
    const out = [];
    for (const p of parts) {
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(p.trim()) + '&langpair=en|' + encodeURIComponent(target);
      const j = await getJson(url);
      out.push((j && j.responseData && j.responseData.translatedText) || p);
    }
    return out.join(' ');
  } catch (_) { return t; }
}

// openFDA: търси етикет на лекарство по име/съставка. Връща нормализиран резултат или null.
async function openFdaLookup(query) {
  const q = encodeURIComponent(String(query).trim());
  const url = 'https://api.fda.gov/drug/label.json?search=' +
    '(openfda.brand_name:"' + q + '"+openfda.generic_name:"' + q + '"+active_ingredient:"' + q + '")&limit=1';
  const j = await getJson(url);
  const r = j && j.results && j.results[0];
  if (!r) return null;
  const ofda = r.openfda || {};
  const first = (a) => Array.isArray(a) && a.length ? a[0] : (a || '');
  const title = first(ofda.brand_name) || first(ofda.generic_name) || String(query);
  const active = [].concat(ofda.substance_name || [], r.active_ingredient || []).map((x) => String(x));
  const description = [first(r.purpose), first(r.indications_and_usage)].filter(Boolean).join(' ').slice(0, 1200)
    || first(r.description) || '';
  const warnings = (first(r.warnings) || '').slice(0, 800);
  return { source: 'openFDA', title, active, description, warnings };
}

// Локален (вграден) многоезичен пакет — събран чрез скрапване (Wikipedia, per език). Чете се
// през обикновен fetch (бъндъл-асет), НЕ CapacitorHttp (той е за абсолютни URL-и).
async function fetchLocal(p) { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch (_) { return null; } }
async function refLookup(query, lang) {
  const idx = await fetchLocal('reference/index.json'); if (!idx || !idx.items) return null;
  const nq = norm(query); const target = String(lang || 'en').split('-')[0];
  for (const it of idx.items) {
    const rec = await fetchLocal('reference/' + it.id + '.json'); if (!rec || !rec.langs) continue;
    const titles = Object.values(rec.langs).map((l) => norm(l.title));
    const hit = norm(it.id).includes(nq) || nq.includes(norm(it.id)) || titles.some((tt) => tt && (tt.includes(nq) || nq.includes(tt)));
    if (!hit) continue;
    const L = rec.langs[lang] || rec.langs[target] || rec.langs.en || Object.values(rec.langs)[0];
    if (L && L.extract) return { source: 'Wikipedia', title: L.title, active: [], description: L.extract, warnings: '', translated: true };
  }
  return null;
}

// Основно търсене: 1) наш многоезичен пакет (автентичен текст), 2) openFDA, 3) офлайн база.
// Добавя рисковите съставки (за открояване). Превежда САМО ако текстът не е вече на езика.
export async function lookupMedicine(query, lang) {
  let res = await refLookup(query, lang);
  if (!res) { try { res = await openFdaLookup(query); } catch (_) { res = null; } }
  if (!res) { const off = offlineLookup(query); if (off) res = { source: 'offline', title: off.title, active: off.active || [], description: off.description, warnings: '' }; }
  if (!res) return null;
  const scanText = [res.title, res.description, ...(res.active || [])].join(' ');
  res.risky = findRisky(scanText);
  if (res.translated) { res.descriptionT = res.description; res.warningsT = res.warnings; }
  else { res.descriptionT = await translate(res.description, lang); res.warningsT = res.warnings ? await translate(res.warnings, lang) : ''; }
  return res;
}
