// names-report.cjs — събира ВСИЧКИ доклади за имена (docs/publish/huawei/name-checks/*.md) в ЕДИН
// файл за анализ: сравнителна таблица + детайли по име (риск, марки, App Store, домейни
// заети/свободни, ниши, сигнали). За да се вижда на едно място пълната и вярна информация
// преди да заковем име. Резултат: docs/publish/huawei/name-checks/_ANALYSIS.md
const fs = require('fs');
const path = require('path');
const similar = require('./similar.cjs');

// Заявки, описващи ФУНКЦИЯТА на приложението (световни новини, преведени на твоя език, четени).
const FUNC_QUERIES = ['news translator', 'translate news', 'read foreign news your language', 'world news translated', 'multilingual news'];
const FUNC_SITE_QUERIES = ['read world news translated to your language', 'news by country translator app', 'multilingual world news aggregator'];

function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }
function m1(re, s) { const m = s.match(re); return m ? m[1].trim() : ''; }

function parseReport(file, src) {
  const name = m1(/#\s*Проверка на име:\s*(.+)/, src) || path.basename(file, '.md');
  const risk = m1(/##\s*Оценка на риска:\s*\*\*(.+?)\*\*/, src) || '?';
  // причини (булети веднага след реда за риска)
  const reasons = [];
  const rm = src.match(/##\s*Оценка на риска:[^\n]*\n([\s\S]*?)\n##/);
  if (rm) rm[1].split('\n').forEach((l) => { const t = l.replace(/^-\s*/, '').trim(); if (t) reasons.push(t); });
  // марки (TMview) — новият формат „Намерени марки: N" (стар: „Общо съвпадения за думата")
  const tmTotal = m1(/(?:Намерени марки|Общо съвпадения за думата):\s*\*?\*?(\d+)/, src);
  const tmExactRel = m1(/точни в релевантен клас[^:]*:\s*\*\*(\d+)\*\*/, src);
  // App Store точни съвпадения (редове с ⚠️ **име**)
  const appleExact = (src.match(/^-\s*⚠️\s*\*\*(.+?)\*\*/gm) || []).map((l) => l.replace(/^-\s*⚠️\s*\*\*(.+?)\*\*.*/, '$1'));
  // домейни статистика — новият формат „заети: **X** · свободни: **Y** · несигурни: **Z**"
  const dTaken = m1(/заети:\s*\*\*(\d+)\*\*/i, src);
  const dFree = m1(/свободни:\s*\*\*(\d+)\*\*/i, src);
  const dUnknown = m1(/несигурни:\s*\*\*(\d+)\*\*/i, src);
  // ниши (от уеб търсенето)
  const niches = m1(/Разпознати ниши:\s*(.+)/, src);
  // ниши на ЗАЕТИТЕ домейни (когато са малко — от огледа на съдържанието им)
  const takenDomains = [];
  const tdBlock = src.match(/Заети \(малко[^\n]*\n([\s\S]*?)(?:\nСвободни|\nНесигурни|\n\n|\n##)/);
  if (tdBlock) tdBlock[1].split('\n').forEach((l) => {
    const mm = l.match(/^-\s*\*\*(.+?)\*\*(?:\s*—\s*"[^"]*")?\s*→\s*(.+)$/);
    if (mm) takenDomains.push({ domain: mm[1].trim(), niche: mm[2].trim() });
  });
  const sameNicheNews = /действащ \*\*новинарски\*\* сайт със същото име/.test(src);
  const hasWebSection = /(Уебсайтове|Интернет страници) и ниши/.test(src);
  const hasRdap = /RDAP/.test(src);
  return {
    name, risk, reasons,
    tmTotal: tmTotal || '?', tmExactRel: tmExactRel || '?',
    appleExact, dTaken: dTaken || '?', dFree: dFree || '?', dUnknown: dUnknown || '?',
    niches, takenDomains, sameNicheNews, current: hasWebSection && hasRdap,
    raw: src,
    file: 'name-checks/' + path.basename(file)
  };
}

// Блок „Готовност за публикуване" за конкретното приложение (за да е ВСИЧКО в единия файл).
function readinessBlock(appDir) {
  const rd = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } };
  const meta = rd(path.join(appDir, 'publish', 'huawei.meta'));
  const mf = (label) => { const m = meta.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(.+)')); return m ? m[1].split('#')[0].trim() : ''; };
  const version = (rd(path.join(appDir, 'src', 'version.js')).match(/APP_VERSION\s*=\s*['"]([^'"]+)/) || [])[1] || '?';
  let cap = {}; try { cap = JSON.parse(rd(path.join(appDir, 'capacitor.config.json'))); } catch (_) {}
  let shots = 0; try { const sd = path.join(appDir, 'publish', 'screenshots'); for (const e of fs.readdirSync(sd, { withFileTypes: true })) { if (e.isFile() && e.name.endsWith('.png')) shots++; else if (e.isDirectory()) shots += fs.readdirSync(path.join(sd, e.name)).filter((x) => x.endsWith('.png')).length; } } catch (_) {}
  let listings = 0; try { listings = fs.readdirSync(path.join(appDir, 'publish', 'store-listing')).filter((f) => /\.txt$/.test(f) && f !== '_index.txt').length; } catch (_) {}
  const L = [];
  L.push('## Готовност за публикуване');
  L.push('- **Име:** ' + (mf('App name') || cap.appName || '?'));
  L.push('- **Пакет:** ' + (mf('App package name') || cap.appId || '?'));
  L.push('- **Категория:** ' + (mf('Level-1 app category') || '?'));
  L.push('- **Версия:** ' + version);
  L.push('- **Имейл за поддръжка:** dai.group.ltd.support@gmail.com');
  L.push('- **Снимки на екрана:** ' + shots + ' · **Описания:** ' + listings + ' езика · **huawei.meta:** ' + (meta ? 'готов' : 'ЛИПСВА'));
  L.push('');
  return L;
}

async function generateNamesReport(reportsDir, opts = {}) {
  let files = [];
  try { files = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'ANALYSIS.md'); } catch (_) {}
  const rows = files.map((f) => parseReport(f, readSafe(path.join(reportsDir, f))));
  const order = { 'НИСЪК': 0, 'СРЕДЕН': 1, 'ВИСОК': 2 };
  rows.sort((a, b) => ((order[a.risk] != null ? order[a.risk] : 9) - (order[b.risk] != null ? order[b.risk] : 9)) || a.name.localeCompare(b.name));

  const L = [];
  L.push('# Анализ на имената — NewsLator / „Stay Informed"');
  L.push('');
  L.push('_Генерирано от AppPublisherBot (`names-report`). Събира всички проверки на едно място. ' +
    'Твърди сигнали: App Store (iTunes), TMview (марки), домейни (RDAP, 49 разширения), Google Play. ' +
    'Ниши/патент са ориентировъчни. НЕ е правна expertise — финалната марка се потвърждава в официалните бази._');
  L.push('');
  const stale = rows.filter((r) => !r.current);
  if (stale.length) L.push('> ⚠️ Доклади със СТАР формат (без RDAP/ниши) — пусни ги наново: ' + stale.map((r) => r.name).join(', '));
  else L.push('> ✅ Всички доклади са с текущия бот (RDAP домейни + ниши + Google Play).');
  L.push('');
  if (opts.appDir) readinessBlock(opts.appDir).forEach((x) => L.push(x));
  L.push('## Обобщение — всички изследвани имена по риск (най-нисък отгоре)');
  const byRisk = (lvl) => rows.filter((r) => r.risk === lvl).map((r) => r.name);
  L.push('- **Най-нисък риск:** ' + (byRisk('НИСЪК').join(', ') || '—'));
  L.push('- **Среден риск:** ' + (byRisk('СРЕДЕН').join(', ') || '—'));
  L.push('- **Висок риск (за избягване):** ' + (byRisk('ВИСОК').join(', ') || '—'));
  L.push('');
  L.push('| № | Име | Риск | Марки общо/релев. | App Store точно | Домейни З/С/несиг. | Ниши (уеб) |');
  L.push('|---|---|---|---|---|---|---|');
  rows.forEach((r, i) => {
    const apple = r.appleExact.length ? '⚠️ ' + r.appleExact.join(', ') : '—';
    const dom = r.dTaken + '/' + r.dFree + '/' + r.dUnknown;
    const niches = (r.niches || '—').replace(/\|/g, '/').slice(0, 36);
    L.push(`| ${i + 1} | **${r.name}** | ${r.risk}${r.sameNicheNews ? ' ⚠️' : ''} | ${r.tmTotal}/${r.tmExactRel} | ${apple} | ${dom} | ${niches} |`);
  });
  L.push('');
  L.push('_Пълните данни за всяко име — марка, App Store, Google Play, Huawei AppGallery, всеки домейн + нишите на заетите, патент, връзки — са в НЕГОВАТА номерирана секция по-долу. Домейни: З=заети / С=свободни / несиг.=не покрити от RDAP+WHOIS._');
  L.push('');
  L.push('---');
  L.push('# Изследване по всяко име (всичко за едно име — на едно място)');
  L.push('_Всяка секция съдържа ЦЯЛАТА информация за името: риск · TMview марки · Apple App Store · Huawei AppGallery · Google Play · всеки домейн + нишите на заетите · интернет страници и ниши · сигнали за патент · връзки към официалните бази._');
  L.push('');
  rows.forEach((r, i) => {
    L.push('');
    L.push('═══════════════════════════════════════════════════════════');
    L.push('## ' + (i + 1) + '. Име „' + r.name + '" — риск ' + r.risk);
    L.push('═══════════════════════════════════════════════════════════');
    L.push('');
    // Вграждаме суровия доклад: махаме оригиналното заглавие и правим всяка подсекция H3,
    // като ѝ добавяме номера и името (напр. „3.2 Търговска марка … — име „NewsLator"").
    let sub = 0;
    const body = r.raw
      .replace(/^#\s*Проверка на име:.*$/m, '')
      .replace(/^##\s+(.+)$/gm, (m, h) => { sub += 1; return '### ' + (i + 1) + '.' + sub + ' ' + h.trim() + ' — име „' + r.name + '"'; })
      .trim();
    L.push(body);
    L.push('');
  });
  // Накрая: „Подобни приложения и сайтове" (по ФУНКЦИЯ на приложението, не по конкретно име).
  L.push('');
  L.push('---');
  try {
    const sim = await similar.findSimilar(opts.queries || FUNC_QUERIES, {
      siteQueries: opts.siteQueries || FUNC_SITE_QUERIES, limit: 5,
      agQuery: opts.agQuery || 'news translator',
      countries: ['us', 'gb', 'in', 'de', 'ru', 'br', 'fr']
    });
    L.push(similar.toMarkdown(sim, 'NewsLator (световни новини, преведени на твоя език)'));
  } catch (e) { L.push('## Подобни приложения и сайтове\n_Не успях автоматично: ' + (e.message || e) + '_\n'); }
  const out = opts.outFile || path.join(reportsDir, '_ANALYSIS.md');
  fs.writeFileSync(out, L.join('\n'), 'utf8');
  return { path: out, count: rows.length, stale: stale.length };
}

module.exports = { generateNamesReport };
