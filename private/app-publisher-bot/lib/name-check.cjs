// name-check.cjs — проверка (clearance) на име на приложение ПРЕДИ да го дадем в AppGallery.
// Автоматизира надеждните проверки и дава директни линкове към официалните бази за ръчна справка.
//
// Проверки:
//   1) Apple App Store (iTunes Search API — реален, без ключ) — us + cn.
//   2) Huawei AppGallery — рендер през Playwright (best-effort; JS страница).
//   3) Домейни — пълен списък TLD през RDAP (авторитетно, DNS резерва) + статистика заети/
//      свободни; при малко заети се оглежда съдържанието им и се разпознава нишата.
//   4) ТЪРГОВСКА МАРКА — реално през TMview (EUIPO): обединява 70+ ведомства, вкл. ЕС (EM),
//      Китай (CN), Русия (RU), България (BG), САЩ (US). Хваща локални регистрации + Nice класове.
//   5) Сигнали за патент — ориентировъчно (DuckDuckGo) + линк към Google Patents.
//
// Официалните бази (за РЪЧНА финална справка) са по препоръка: WIPO Global Brand Database,
// TMview, EUIPO eSearch plus, CNIPA (Китай), Роспатент (Русия), BPO (България), USPTO (САЩ).
const { loadPlaywright, domainStatus, inspectDomain, pool, ddg, appleSearch, norm } = require('./util.cjs');
const tmview = require('./tmview.cjs');
const google = require('./google.cjs');
const { searchAppGallery } = require('./appgallery.cjs');

// Пълен списък разширения (TLD) за проверка на домейн — общи gTLD + релевантни за нишата
// + честите ccTLD. Ако искаш още — просто добави тук.
const TLD_LIST = [
  'com', 'net', 'org', 'co', 'io', 'ai', 'app', 'news', 'media', 'press', 'live', 'tv',
  'xyz', 'online', 'site', 'store', 'shop', 'tech', 'dev', 'digital', 'network', 'group',
  'me', 'info', 'biz', 'pro', 'world', 'today', 'blog', 'wiki', 'ink', 'design', 'art',
  'space', 'club', 'vip', 'work', 'fit', 'health', 'fashion', 'inc', 'llc',
  'us', 'is', 'cc', 'so', 'ac', 'cx', 'to'
];
// Основните разширения (за съвместимост и за „важните“ в статистиката).
const CORE_TLDS = ['com', 'app', 'news', 'io', 'net'];
// Праг: над толкова заети → името е широко заето → отказ.
const MANY_TAKEN = 12;
// Праг: под толкова заети → оглеждаме съдържанието/нишата на всеки зает.
const FEW_TAKEN = 5;

// Разпознаване на ниша по ключови думи в заглавие/адрес — за да видим В КОИ ОБЛАСТИ
// вече се ползва името (сблъсък е най-опасен, ако е в СЪЩАТА ниша — новини/софтуер).
const NICHE_KW = {
  'новини/медия': ['news', 'media', 'press', 'times', 'daily', 'post', 'herald', 'gazette', 'tribune', 'journal', 'newspaper', 'новини'],
  'софтуер/ИТ': ['software', 'app', 'apps', 'api', 'github', 'gitlab', 'npm', 'saas', 'tech', 'platform', 'developer', 'sdk', 'framework'],
  'финанси': ['finance', 'invest', 'trading', 'crypto', 'bank', 'capital', 'fund', 'fintech', 'lei'],
  'право/имиграция': ['immigration', 'legal', 'law', 'visa', 'case management', 'attorney', 'lawyer'],
  'образование/езици': ['education', 'learn', 'course', 'school', 'university', 'edu', 'language', 'lingo', 'tutor'],
  'маркетинг/реклама': ['marketing', 'agency', 'seo', 'brand', 'ads', 'advertis'],
  'социални мрежи': ['instagram', 'youtube', 'facebook', 'tiktok', 'twitter', 'x.com', 'reddit'],
  'здраве': ['health', 'medical', 'clinic', 'pharma', 'care'],
  'търговия': ['shop', 'store', 'ecommerce', 'retail', 'market']
};

function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } }

// Разпознава ниши в текст. ВАЖНО: маха самото име (и слятата му форма) преди сравнението,
// иначе поднизи като „news“ в „Newslate“ лъжливо мачват ниша „новини“.
function detectNiches(text, appName) {
  const nameLc = String(appName || '').toLowerCase();
  let hay = String(text || '').toLowerCase();
  if (nameLc) hay = hay.split(nameLc).join(' ');
  const nn = norm(appName);
  if (nn) hay = hay.split(nn).join(' ');
  const out = [];
  for (const [label, kws] of Object.entries(NICHE_KW)) if (kws.some((k) => hay.includes(k))) out.push(label);
  return out;
}

// От списък резултати {title,url} → уникални сайтове + разпознати ниши.
function analyzeWeb(items, appName) {
  const n = norm(appName);
  const sites = []; const seenDom = new Set(); const nicheHits = {};
  for (const it of (items || [])) {
    const dom = domainOf(it.url); if (!dom) continue;
    const niches = detectNiches((it.title || '') + ' ' + it.url, appName);
    niches.forEach((label) => { nicheHits[label] = (nicheHits[label] || 0) + 1; });
    if (!seenDom.has(dom)) { seenDom.add(dom); sites.push({ domain: dom, title: it.title || '', url: it.url, niches }); }
  }
  // Ниши, подредени по честота.
  const niches = Object.entries(nicheHits).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  // Има ли сайт в НАШАТА ниша (новини) с точно нашето име в домейна?
  const sameNicheNews = sites.some((s) => s.niches.includes('новини/медия') && norm(s.domain).includes(n));
  return { sites, niches, sameNicheNews };
}

// ТОЧНО четене на AppGallery през JSON API-то (не размит HTML скрейп) — виж appgallery.cjs.
async function checkAppGallery(name) {
  const r = await searchAppGallery(name);
  return { ok: r.ok, url: r.url, note: r.note, hits: r.apps || [] };
}

async function nameCheck(name) {
  const n = norm(name);
  const report = { name, time: new Date().toISOString() };

  // 1) Apple App Store (us + cn)
  const [appUs, appCn] = await Promise.all([appleSearch(name, 'us'), appleSearch(name, 'cn')]);
  const apple = []; const seen = new Set();
  for (const a of [...appUs, ...appCn]) {
    const k = norm(a.name) + '|' + norm(a.seller);
    if (seen.has(k)) continue; seen.add(k);
    apple.push({ ...a, exact: norm(a.name) === n });
  }
  report.apple = apple;
  report.appleExact = apple.filter((a) => a.exact);

  // 2) AppGallery + Google Play (Android магазин)
  report.appgallery = await checkAppGallery(name);
  report.googlePlay = await google.googlePlay(name);

  // 3) Домейни — пълен списък TLD през RDAP + статистика (заети/свободни/несигурни).
  const domChecks = await pool(TLD_LIST, 8, async (tld) => {
    const d = n + '.' + tld;
    const s = await domainStatus(d);
    return { domain: d, tld, status: s.status, method: s.method };
  });
  const takenList = domChecks.filter((x) => x.status === 'taken');
  const freeList = domChecks.filter((x) => x.status === 'free');
  const unknownList = domChecks.filter((x) => x.status === 'unknown');
  report.domainList = domChecks;
  report.domainStats = { checked: domChecks.length, taken: takenList.length, free: freeList.length, unknown: unknownList.length };
  // Съвместимост: обектът за основните разширения.
  const domains = {};
  domChecks.forEach((x) => { if (CORE_TLDS.includes(x.tld)) domains[x.domain] = (x.status === 'taken'); });
  report.domains = domains;
  // Ако заетите са МАЛКО (под FEW_TAKEN) — оглеждаме съдържанието и нишата на всеки.
  report.domainInspections = [];
  if (takenList.length > 0 && takenList.length < FEW_TAKEN) {
    report.domainInspections = await pool(takenList, 4, async (t) => {
      const info = await inspectDomain(t.domain);
      const niches = detectNiches((info.title || '') + ' ' + (info.desc || '') + ' ' + (info.sample || ''), name);
      return { domain: t.domain, ok: info.ok, status: info.status, title: info.title, desc: info.desc, sample: info.sample, niches };
    });
  }

  // 4) Търговска марка — TMview (реално, по ведомства + Nice класове)
  const tm = await tmview.search(name, { pageSize: 60 });
  report.tmview = tm;
  report.tmClass = tm.ok ? tmview.classify(name, tm.marks) : { exact: [], relevant: [], exactRelevant: [] };

  // 5) Патент (ориентировъчно) — Google с пад към DuckDuckGo
  report.patentSignals = await google.googleWeb('"' + name + '" patent');

  // 6) Уебсайтове и ниши — общо уеб търсене за ТОЧНОТО име (в кои области вече се ползва).
  report.websites = await google.googleWeb('"' + name + '"', 10);
  report.web = analyzeWeb(report.websites, name);

  // Линкове за РЪЧНА официална проверка (по препоръчаните бази).
  const q = encodeURIComponent(name);
  // Всички адреси проверени наживо (HTTP 200) на 2026-07-01.
  report.officialLinks = {
    'WIPO Global Brand Database': 'https://branddb.wipo.int/  (търси: ' + name + ', филтър China/Russia)',
    'TMview (70+ ведомства)': 'https://www.tmdn.org/tmview/  (търси: ' + name + ')',
    'EUIPO (ЕС/BG)': 'https://www.euipo.europa.eu/en/search-availability  (търси: ' + name + ')',
    'CNIPA (Китай, first-to-file!)': 'https://sbj.cnipa.gov.cn/sbj/index.html',
    'Роспатент / ФИПС (Русия)': 'https://www.fips.ru/iiss/db.xhtml',
    'BPO (България)': 'https://portal.bpo.bg/bpo-portal',
    'USPTO (САЩ)': 'https://tmsearch.uspto.gov/search/search-information?query=' + q,
    'Google Patents': 'https://patents.google.com/?q=' + q,
    'Google Play': 'https://play.google.com/store/search?q=' + q + '&c=apps',
    'AppGallery': 'https://appgallery.huawei.com/search/' + q
  };

  // Близки апове в App Store: само РЕАЛНО подобни имена (съдържат/се съдържат в името),
  // а НЕ всичките ~10 общи резултата, които iTunes винаги връща размито.
  const appleSimilar = apple.filter((a) => { const an = norm(a.name); return !a.exact && an && (an.includes(n) || n.includes(an)); });
  report.appleSimilar = appleSimilar;

  // Оценка на риска.
  const stats = report.domainStats;
  let risk = 'НИСЪК'; const why = [];
  if (report.appleExact.length) { risk = 'ВИСОК'; why.push('точно съвпадение на име в App Store (' + report.appleExact.map((a) => a.seller).join(', ') + ')'); }
  if ((report.googlePlay.exactish || []).length) { risk = 'ВИСОК'; why.push('съвпадащо приложение в Google Play (' + report.googlePlay.exactish.slice(0, 2).join(', ') + ')'); }
  if (report.tmClass.exactRelevant.length) { risk = 'ВИСОК'; why.push('точна марка в релевантен Nice клас (' + report.tmClass.exactRelevant.map((m) => m.office + ' кл.' + m.nice.join('/')).join('; ') + ')'); }
  if (stats.taken >= MANY_TAKEN) { risk = 'ВИСОК'; why.push('МНОГО заети домейни (' + stats.taken + '/' + stats.checked + ') — името е широко заето, отказ'); }
  if (risk !== 'ВИСОК') {
    if (report.tmClass.exact.length) { risk = 'СРЕДЕН'; why.push('точна марка в друг клас (' + report.tmClass.exact.map((m) => m.office + ' кл.' + m.nice.join('/')).join('; ') + ')'); }
    else if ((report.appgallery.hits || []).some((h) => norm(h) === n)) { risk = 'СРЕДЕН'; why.push('съвпадение в AppGallery'); }
    else if (report.web && report.web.sameNicheNews) { risk = 'СРЕДЕН'; why.push('съществуващ новинарски сайт със същото име (СЪЩАТА ниша — новини)'); }
    else if (stats.taken >= FEW_TAKEN) { risk = 'СРЕДЕН'; why.push('доста заети домейни (' + stats.taken + '/' + stats.checked + ')'); }
    else if (appleSimilar.length || report.tmClass.relevant.length >= 2) { risk = 'СРЕДЕН'; why.push('близки имена в App Store/марки (' + (appleSimilar.map((a) => a.name).concat(report.tmClass.relevant.slice(0, 2).map((m) => m.mark)).slice(0, 3).join(', ')) + ')'); }
    // Малко заети → казваме в кои ниши се ползват (от огледаното съдържание).
    else if (report.domainInspections.length) {
      const nis = [...new Set(report.domainInspections.flatMap((x) => x.niches))];
      if (nis.length) why.push('малко заети домейни, в ниши: ' + nis.join(', '));
    }
  }
  if (risk === 'НИСЪК' && stats.taken === 0 && (!tm.ok || tm.total === 0)) why.push('нула марки + всички домейни свободни — отличително, нисък риск');
  report.risk = risk; report.riskWhy = why;
  return report;
}

function toMarkdown(r) {
  const L = [];
  const n = norm(r.name);
  L.push('# Проверка на име: ' + r.name);
  L.push('');
  L.push('_' + r.time + ' — твърди сигнали: App Store, TMview, домейни, AppGallery. Марка/патент финално се потвърждават в официалните бази (виж долу). Не е правна expertise._');
  L.push('');
  L.push('## Оценка на риска: **' + r.risk + '**');
  if (r.riskWhy.length) L.push('- ' + r.riskWhy.join('\n- '));
  L.push('');
  L.push('## Търговска марка — TMview (ЕС/Китай/Русия/България/САЩ + др.)');
  if (!r.tmview.ok) L.push('Не успях автоматично (' + (r.tmview.note || '') + ') — провери ръчно в TMview/WIPO.');
  else {
    L.push('**Намерени марки: ' + r.tmview.total + '** · точни съвпадения на името: **' + r.tmClass.exact.length +
      '** · точни в релевантен клас (9/38/41/42): **' + r.tmClass.exactRelevant.length + '**');
    L.push('_Условия: търсено по думата „' + r.name + '" във ВСИЧКИ ведомства (ЕС/Китай/Русия/България/САЩ + 70+ др.), без филтър по клас. „Релевантен клас" = 9/38/41/42 (софтуер/предаване/новини/SaaS)._');
    const show = (r.tmClass.exact.length ? r.tmClass.exact : r.tmview.marks).slice(0, 12);
    if (show.length) { L.push(''); L.push('| Марка | Ведомство | Класове | Притежател | Статус |'); L.push('|---|---|---|---|---|');
      for (const m of show) L.push(`| ${m.mark} | ${m.office} | ${m.nice.join(', ')} | ${m.applicant} | ${m.status} |`); }
  }
  L.push('');
  L.push('## Apple App Store (iTunes Search)');
  L.push('**Намерени приложения: ' + r.apple.length + '** · точни съвпадения на името: **' + r.appleExact.length + '** · подобни (съдържат името): **' + (r.appleSimilar ? r.appleSimilar.length : 0) + '**');
  L.push('_Условия: търсено в App Store на 2 държави — САЩ (us) и Китай (cn), на английски по думата „' + r.name + '" (тип „software")._');
  if (!r.apple.length) L.push('→ Няма намерени приложения.');
  else for (const a of r.apple.slice(0, 12)) L.push(`- ${a.exact ? '⚠️ **' + a.name + '**' : a.name} — ${a.seller || '?'} (${a.genre || '?'})`);
  L.push('');
  L.push('## Huawei AppGallery');
  const agHits = (r.appgallery.ok && r.appgallery.hits) ? r.appgallery.hits : [];
  const agExact = agHits.filter((h) => norm(h) === n).length;
  L.push('**Намерени заглавия: ' + agHits.length + '** · точни съвпадения на името: **' + agExact + '**');
  L.push('_Условия: прочетено от JSON API-то на AppGallery (getTabDetail, всички AJAX страници при скролване), глобално по думата „' + r.name + '". Резултатите са РАЗМИТИ (свързани/препоръчани приложения), затова значение има само ТОЧНОТО съвпадение на името._');
  if (agHits.length) L.push('→ ' + agHits.slice(0, 25).join(', ') + (agHits.length > 25 ? ' … (+' + (agHits.length - 25) + ' още)' : ''));
  else L.push('→ Няма резултати (или регионално блокирано) — провери ръчно: ' + (r.appgallery.url || ''));
  L.push('');
  L.push('## Google Play (Android)');
  if (!r.googlePlay.ok) L.push('**Намерени приложения: 0** (не успях автоматично: ' + (r.googlePlay.note || '') + ').');
  else {
    L.push('**Намерени приложения: ' + r.googlePlay.titles.length + '** · възможни съвпадения на името: **' + r.googlePlay.exactish.length + '**');
    L.push('_Условия: търсено в Google Play (уеб), на английски, по думата „' + r.name + '" (без конкретна държава)._');
    if (r.googlePlay.exactish.length) L.push('⚠️ Възможно съвпадащо приложение: ' + r.googlePlay.exactish.join('; '));
    L.push(r.googlePlay.titles.length ? ('→ ' + r.googlePlay.titles.join(' · ')) : '→ Няма резултати.');
  }
  L.push('');
  L.push('## Домейни — статистика (RDAP, DNS резерва)');
  const s = r.domainStats || { checked: 0, taken: 0, free: 0, unknown: 0 };
  L.push('**Проверени разширения: ' + s.checked + '** · заети: **' + s.taken + '** · свободни: **' + s.free + '** · несигурни: **' + s.unknown + '**');
  L.push('_Условия: за всяко от ' + s.checked + '-те разширения (TLD) — заетост през RDAP (авторитетно) с WHOIS (порт 43) резерва по името „' + r.name + '". „Несигурни" = TLD, които нито RDAP, нито WHOIS покриват (изискват ръчна проверка)._');
  const takenNow = (r.domainList || []).filter((x) => x.status === 'taken');
  const freeNow = (r.domainList || []).filter((x) => x.status === 'free');
  const unkNow = (r.domainList || []).filter((x) => x.status === 'unknown');
  if (s.taken >= 12) L.push('⚠️ МНОГО заети — името е широко заето.');
  // Заети: ако са малко → показваме съдържание/ниша; ако много → само списък (до 15).
  if (r.domainInspections && r.domainInspections.length) {
    L.push('');
    L.push('Заети (малко — оглед на съдържание и ниша):');
    for (const ins of r.domainInspections) {
      const nis = ins.niches && ins.niches.length ? ins.niches.join(', ') : (ins.ok ? 'нишата неясна' : (ins.status ? 'няма достъпно съдържание (HTTP ' + ins.status + ')' : 'сайтът не отговаря'));
      const t = ins.title ? ' — "' + ins.title.replace(/\s+/g, ' ').slice(0, 70) + '"' : '';
      L.push('- **' + ins.domain + '**' + t + ' → ' + nis);
    }
  } else if (takenNow.length) {
    L.push('Заети (' + takenNow.length + '): ' + takenNow.slice(0, 15).map((x) => x.domain).join(', ') + (takenNow.length > 15 ? ' …' : ''));
  } else {
    L.push('Заети: няма.');
  }
  // Свободни: ако са малко (под 5) → изброяваме всичките; иначе примерни.
  if (freeNow.length && freeNow.length < 5) L.push('Свободни (' + freeNow.length + '): ' + freeNow.map((x) => x.domain).join(', '));
  else if (freeNow.length) L.push('Свободни: ' + freeNow.length + ' (напр. ' + freeNow.slice(0, 8).map((x) => x.domain).join(', ') + (freeNow.length > 8 ? ' …' : '') + ')');
  if (unkNow.length) L.push('Несигурни (RDAP без отговор + без DNS): ' + unkNow.map((x) => x.domain).join(', '));
  L.push('');
  L.push('## Интернет страници и ниши (в кои области се ползва името)');
  L.push('**Намерени страници: ' + ((r.web && r.web.sites) ? r.web.sites.length : 0) + '**');
  L.push('_Условия: общо уеб търсене по ТОЧНОТО име „' + r.name + '" (в кавички), на английски, без конкретна държава._');
  if (!r.web || !r.web.sites.length) L.push('→ Няма ясни резултати за точното име.');
  else {
    if (r.web.niches.length) L.push('Разпознати ниши: ' + r.web.niches.map((x) => x.label + ' (' + x.count + ')').join(', '));
    if (r.web.sameNicheNews) L.push('⚠️ Има действащ **новинарски** сайт със същото име — това е СЪЩАТА ниша като приложението.');
    L.push('');
    L.push('| Сайт | Заглавие | Ниши |');
    L.push('|---|---|---|');
    for (const s of r.web.sites.slice(0, 12)) L.push(`| ${s.domain} | ${(s.title || '').replace(/\|/g, '/').slice(0, 60)} | ${s.niches.join(', ') || '—'} |`);
  }
  L.push('');
  L.push('## Сигнали за патент (ориентировъчно)');
  L.push('**Намерени сигнали: ' + r.patentSignals.length + '**');
  L.push('_Условия: уеб търсене „' + r.name + ' patent" (на английски). Ориентировъчно — потвърждава се в Google Patents/официалните бази._');
  if (!r.patentSignals.length) L.push('→ Няма ясни сигнали.');
  else for (const s of r.patentSignals) L.push(`- [${s.title}](${s.url})`);
  L.push('');
  L.push('## Връзки за РЪЧНА официална проверка');
  for (const [k, v] of Object.entries(r.officialLinks)) L.push(`- ${k}: ${v}`);
  L.push('');
  return L.join('\n');
}

module.exports = { nameCheck, toMarkdown };
