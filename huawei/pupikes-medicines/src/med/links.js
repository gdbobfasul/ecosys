// Version: 1.0024
// links.js — „ЛИСТОВКА И ИНФОРМАЦИЯ" (искане 11.09.2026): апът НЕ носи пълните листовки на всички лекарства на всички
// езици — след като разпознае лекарството, дава ЛИНКОВЕ по езика на интерфейса (15): Wikipedia на езика (по локалното
// име от вградената база, иначе търсене), DailyMed/FDA етикет (en; по NDC при баркод), EMA (ЕС), национални
// справочници/регистри (bg framar, ru vidal/rlsnet, uk compendium, de Gelbe Liste, fr base-donnees-publique,
// es CIMA/AEMPS, it Torrinomedica, pt Infomed/Infarmed, ar Webteb/Altibbi, hi 1mg, ja KEGG/PMDA, zh-Hant HK Drug Office,
// ky — руските). Само заглавие + адрес; нищо не се тегли. Отваря се в системния браузър (Capacitor Browser / _blank).
const enc = encodeURIComponent;
const WIKI = { bg: 'bg', ru: 'ru', uk: 'uk', en: 'en', de: 'de', fr: 'fr', es: 'es', 'es-MX': 'es', it: 'it', pt: 'pt', ar: 'ar', hi: 'hi', ja: 'ja', ky: 'ky', 'zh-Hant': 'zh' };
function wiki(lg, name, exact) {
  const host = 'https://' + WIKI[lg] + '.wikipedia.org';
  if (exact) return host + (lg === 'zh-Hant' ? '/zh-tw/' : '/wiki/') + enc(String(name).replace(/ /g, '_'));
  return host + '/w/index.php?search=' + enc(name);
}
// Национални справочници: [заглавие, адрес(q)] — q е латинското име (INN/марка), l — локалното име ако има.
const NATIONAL = {
  bg: [['framar.bg', (q, l) => 'https://www.framar.bg/?s=' + enc(l || q)]],
  ru: [['vidal.ru', (q, l) => 'https://www.vidal.ru/search?q=' + enc(l || q)], ['rlsnet.ru', (q, l) => 'https://www.rlsnet.ru/search_result.htm?word=' + enc(l || q)]],
  uk: [['compendium.com.ua', (q, l) => 'https://compendium.com.ua/uk/?s=' + enc(l || q)]],
  de: [['Gelbe Liste', (q, l) => 'https://www.gelbe-liste.de/suche?term=' + enc(l || q)]],
  fr: [['Base de données publique des médicaments', (q, l) => 'https://base-donnees-publique.medicaments.gouv.fr/index.php?page=1&affliste=0&affNumero=0&isAlphabet=0&inClauseSubst=0&nomSubstances=&typeRecherche=0&choixRecherche=medicament&txtCaracteres=' + enc(l || q)]],
  es: [['CIMA · AEMPS', (q, l) => 'https://cima.aemps.es/cima/publico/lista.html?nombre=' + enc(l || q)]],
  'es-MX': [['CIMA · AEMPS', (q, l) => 'https://cima.aemps.es/cima/publico/lista.html?nombre=' + enc(l || q)]],
  it: [['Torrinomedica', (q, l) => 'https://www.torrinomedica.it/?s=' + enc(l || q)]],
  pt: [['Infomed · Infarmed', () => 'https://extranet.infarmed.pt/INFOMED-fo/']],
  ar: [['Webteb', (q, l) => 'https://www.webteb.com/search?q=' + enc(l || q)], ['Altibbi', (q, l) => 'https://altibbi.com/search?q=' + enc(l || q)]],
  hi: [['1mg', (q) => 'https://www.1mg.com/search/all?name=' + enc(q)]],
  ja: [['KEGG MEDICUS', (q, l) => 'https://www.kegg.jp/medicus-bin/search_drug?search=' + enc(l || q)], ['PMDA 医薬品検索', () => 'https://www.pmda.go.jp/PmdaSearch/iyakuSearch/']],
  'zh-Hant': [['香港藥物辦公室 Drug Office', (q) => 'https://www.drugoffice.gov.hk/eps/do/tc/consumer/search_drug_database.html?keyword=' + enc(q)]],
  ky: [['vidal.ru', (q, l) => 'https://www.vidal.ru/search?q=' + enc(l || q)], ['rlsnet.ru', (q, l) => 'https://www.rlsnet.ru/search_result.htm?word=' + enc(l || q)]],
  en: []
};
const EU = /^(bg|ru|uk|en|de|fr|es|es-MX|it|pt|ky)$/;
const isLatin = (s) => /^[\x20-\x7EÀ-ɏ]+$/.test(String(s || ''));
// r: резултатът от картата (title, inn, active, localName?, barcode?, registry?); lang: език на интерфейса.
// Връща [{ title, url }] — 3–5 линка.
export function leafletLinks(r, lang) {
  if (!r) return [];
  const lg = WIKI[lang] ? lang : 'en';
  const inn = String(r.inn || (r.active && r.active[0]) || '').trim();
  const title = String(r.title || '').replace(/\s*\(.*\)$/, '').trim();
  const q = (isLatin(inn) && inn) || (isLatin(title) && title) || inn || title;   // латинско име за световните бази
  const local = r.localName || (!isLatin(title) ? title : '');                    // локално изписване (от med-db)
  if (!q && !local) return [];
  const out = [];
  // Wikipedia на езика: точна страница по локалното име (med-db го дава за 15 езика), иначе търсене
  out.push({ title: 'Wikipedia (' + WIKI[lg] + ')', url: wiki(lg, local || q, !!local || lg === 'en') });
  if (lg !== 'en' && q) out.push({ title: 'Wikipedia (en)', url: wiki('en', q, true) });
  // DailyMed / FDA етикет: по NDC от баркода (точна опаковка), иначе по име
  const ndc = r.registry && r.registry.ndc ? String(r.registry.ndc) : '';
  if (ndc) out.push({ title: 'DailyMed · FDA label (NDC ' + ndc.slice(0, 5) + '-' + ndc.slice(5) + ')', url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=' + enc(ndc) });
  else if (q) out.push({ title: 'DailyMed · FDA label (en)', url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=' + enc(q) });
  if (EU.test(lg) && q) out.push({ title: 'EMA (EU)', url: 'https://www.ema.europa.eu/en/search?search_api_fulltext=' + enc(q) });
  for (const [t, fn] of (NATIONAL[lg] || [])) out.push({ title: t, url: fn(q || local, local) });
  // сървърни линкове (Pupikes сървър — ако е включен и е върнал такива)
  for (const l of (r.links || [])) if (l && l.url && !out.some((o) => o.url === l.url)) out.push({ title: String(l.title || l.url), url: String(l.url) });
  return out.slice(0, 6);
}
// Отваряне в системния браузър (както core/ecosystem.js): Capacitor Browser → window.open(_blank) → location.
export function openExternal(url) {
  try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url }); return; } } catch (_) {}
  try { const w = window.open(url, '_blank', 'noopener'); if (w) return; } catch (_) {}
  try { location.href = url; } catch (_) {}
}
