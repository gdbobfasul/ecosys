// insights.cjs — „развитие на приложението" от конзолата на RuStore, КАТО ФУНКЦИЯ НА БОТА.
//
// ОТДЕЛНО от модераторските коментари (виж moderation.cjs). Тук четем как СЕ РАЗВИВА апът:
//   • рейтинг + брой оценки          (Отзывы / Rating / звёзд)
//   • мнения на потребители (Отзывы) — текст на последните ревюта
//   • инсталации/сваляния            (Установки / Загрузки / Downloads)
//   • приходи / плащания / продажби  (Доход / Выплаты / Продажи / Покупки / ₽)
//   • текущ статус на публикацията    (Опубликовано / На модерации / Отклонено)
//
// Ботът се закача за ВЕЧЕ ЛОГНАТИЯ браузър (CDP 9222). Този модул НЕ въвежда нищо — само ЧЕТЕ
// конзолата (само console.rustore.ru) и записва в app-shared/rustore-insights.json + в
// rustore/<app>/publish/insights.md. Никакви външни/измислени данни — само реалното от платформата.
const fs = require('fs');
const path = require('path');

const OUT_JSON = path.resolve('app-shared', 'rustore-insights.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function load() {
  try { return JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')); }
  catch (_) { return { _note: 'Развитие на приложенията (рейтинг/мнения/инсталации/приходи), събрано от бота от console.rustore.ru. НЕ редактирай ръчно.', store: 'rustore', overview: { apps: [] }, apps: {} }; }
}
function save(data) { try { fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8'); return true; } catch (_) { return false; } }
function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

// Маркери за РАЗВИТИЕ (не за модерация). Кирилица не се хваща от \w → ползваме \S*.
const M = {
  rating: /(рейтинг|оценк\S*|звёзд\S*|звезд\S*|\brating\b|\bstars?\b)/i,
  reviews: /(отзыв\S*|мнени\S*|коментар\S*\s+потребител|\breviews?\b|\bfeedback\b)/i,
  installs: /(установк\S*|загрузк\S*|скачив\S*|\binstalls?\b|\bdownloads?\b|активн\S*\s+пользоват|\bDAU\b|\bMAU\b)/i,
  money: /(доход\S*|выплат\S*|продаж\S*|покупк\S*|выручк\S*|платеж\S*|монетизац\S*|\brevenue\b|\bsales\b|\bpayout\S*\b|\bearnings?\b|\bincome\b|₽|руб\b|\bRUB\b)/i,
  status: /(опубликован\S*|на\s+модерац\S*|отклонен\S*|черновик\S*|published|moderation|rejected|draft|waiting)/i,
};
// Числа (вкл. „1 234", „4,7", „12.5K", „350 ₽")
const NUM = /(\d[\d\s.,]*\d|\d)\s*(₽|руб|RUB|K|M|тыс|млн)?/i;

// Изважда сигнали за развитие от видим текст. НЕ включва редове с модераторски отказ (за да е
// РАЗЛИЧНО от reasons-събирача) — тези думи се филтрират.
const MODWORDS = /(не\s+прошл\S*\s+модерац|причин\S*\s+отклонен|замечани\S*\s+модератор|коментар\S*\s+модератор|rejection\s+reason|moderator'?s?\s+comment)/i;
function extractInsights(text) {
  const out = { rating: [], reviews: [], installs: [], money: [], status: [] };
  if (!text) return out;
  const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (MODWORDS.test(ln)) continue;                 // това е модераторско — прескачаме (иска се РАЗЛИЧНО)
    const ctx = norm(lines.slice(i, i + 2).join(' ')).slice(0, 200);
    for (const key of Object.keys(M)) {
      if (!M[key].test(ln)) continue;
      if (key === 'reviews' && ln.length >= 12 && !/^\W*$/.test(ln)) out.reviews.push(ctx);
      else if (key === 'status') out.status.push(norm(ln).slice(0, 80));
      else { const m = ctx.match(NUM); if (m) out[key].push(ctx); }
    }
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].slice(0, 30);
  return out;
}

async function pageText(p) { try { return await p.evaluate(() => (document.body ? document.body.innerText : '')); } catch (_) { return ''; } }
function rsPages(browser) { const r = []; for (const c of browser.contexts()) for (const p of c.pages()) { let u = ''; try { u = p.url(); } catch (_) {} if (/rustore\.ru/.test(u)) r.push(p); } return r; }

// Чете списъка /apps (общ преглед: име, статус, рейтинг за ВСЕКИ ап) + намира id за избрания ап.
async function readOverview(page, appName) {
  await page.goto('https://console.rustore.ru/apps', { waitUntil: 'domcontentloaded' }).catch(() => {});
  // Списъкът се пълни ЛЕНИВО (SPA) → poll до ~30s, докато се появят линкове към апове (иначе четем празно
  // и виждаме само 1 ап). Не евалюираме по време на навигация — само след като страницата се уталожи.
  const readRows = () => page.evaluate(() => {
    const res = [];
    for (const a of document.querySelectorAll('a[href*="/apps/"]')) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/^\/?apps\/(\d+)\/?$/) || href.match(/\/apps\/(\d+)(?:$|\?)/); if (!m) continue;
      const own = (a.innerText || '').replace(/\s+/g, ' ').trim();
      if (!own) continue;
      const name = own.split(/\s+(?:DaiGrup|DAI|ООО|LTD|ОсОО)/i)[0].trim() || own;   // име = преди издателя
      const status = ((own.match(/(Not\s+published|Published|Waiting\s+for\s+moderation|On\s+moderation|Rejected|Draft|Опубликован\S*|На\s+модерац\S*|Отклонен\S*|Черновик\S*)/i) || [])[1]) || '';
      res.push({ id: m[1], name, status, row: own.slice(0, 220) });
    }
    const seen = new Set(); return res.filter((r) => (r.id && !seen.has(r.id)) && seen.add(r.id));
  }).catch(() => []);
  let rows = [];
  for (let i = 0; i < 12; i++) { await sleep(2500); rows = await readRows(); if (rows.length > 1) break; }
  const want = norm(appName).toLowerCase();
  const hit = rows.find((r) => norm(r.name).toLowerCase() === want) ||
              rows.find((r) => norm(r.row).toLowerCase().includes(want)) ||
              rows.find((r) => want.includes(norm(r.name).toLowerCase()) && norm(r.name).length > 4);
  return { rows, hit };
}

// Реалните под-маршрути от лявото меню на конзолата (виж дъмп 17.08): мнения, статистика (инсталации),
// плащания и статистика на плащанията. best-effort — непознат маршрут просто се прескача.
const SUBROUTES = ['reviews', 'statistics', 'payments', 'payment-statistics', 'in-apps', 'subscriptions'];
async function readApp(page, id) {
  const agg = { rating: [], reviews: [], installs: [], money: [], status: [], visited: [] };
  // първо самата страница на апа (там често има рейтинг/статус/инсталации)
  const base = ['', ...SUBROUTES];
  for (const seg of base) {
    const url = 'https://console.rustore.ru/apps/' + id + (seg ? '/' + seg : '');
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(3500);
    let cur = ''; try { cur = page.url(); } catch (_) {}
    // ако маршрутът не съществува, конзолата пренасочва към /apps или показва 404 → прескачаме
    if (seg && !new RegExp('/apps/' + id + '/' + seg).test(cur)) continue;
    const t = await pageText(page);
    if (/404|not\s+found|страница\s+не\s+найдена/i.test(t) && t.length < 400) continue;
    const ins = extractInsights(t);
    let any = false;
    for (const k of Object.keys(ins)) if (ins[k].length) { agg[k].push(...ins[k]); any = true; }
    if (any || !seg) agg.visited.push(seg || '(преглед)');
  }
  for (const k of Object.keys(agg)) if (Array.isArray(agg[k])) agg[k] = [...new Set(agg[k])].slice(0, 40);
  return agg;
}

function writeMd(app, appName, rec) {
  const dir = path.resolve('rustore', app, 'publish');
  try { if (!fs.existsSync(dir)) return false; } catch (_) { return false; }
  const L = [];
  L.push('# Развитие на „' + appName + '" в RuStore');
  L.push('');
  L.push('> Събрано автоматично от console.rustore.ru на ' + rec.collectedAt + '. Само реални данни от конзолата.');
  L.push('> Това е РАЗЛИЧНО от модераторските коментари (виж moderation-history.md).');
  L.push('');
  const sec = (title, arr) => { L.push('## ' + title); if (!arr || !arr.length) L.push('_няма данни в конзолата_'); else for (const x of arr) L.push('- ' + x); L.push(''); };
  sec('Статус на публикацията', rec.status);
  sec('Рейтинг / оценки', rec.rating);
  sec('Мнения на потребители (Отзывы)', rec.reviews);
  sec('Инсталации / сваляния', rec.installs);
  sec('Приходи / плащания / продажби', rec.money);
  if (rec.visited && rec.visited.length) { L.push('---'); L.push('_прегледани раздели: ' + rec.visited.join(', ') + '_'); }
  try { fs.writeFileSync(path.join(dir, 'insights.md'), L.join('\n') + '\n', 'utf8'); return true; } catch (_) { return false; }
}

// Име за конзолата (същата логика като бота): store-names._default или appName, с представка „Pupikes".
function appConsoleName(app) {
  const rd = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; } };
  const cfg = rd(path.resolve('rustore', app, 'capacitor.config.json'));
  const sn = rd(path.resolve('rustore', app, 'publish', 'store-names.json'));
  const base = sn._default || cfg.appName || app;
  return /^pupikes/i.test(base) ? base : ('Pupikes ' + base);
}

// Детайли за ЕДИН ап по вече прочетен общ преглед (rows). Не чете пак /apps.
async function detailForApp(page, pages, rows, app, appName, nowIso) {
  const want = norm(appName).toLowerCase();
  const hit = rows.find((r) => norm(r.name).toLowerCase() === want) ||
              rows.find((r) => norm(r.row).toLowerCase().includes(want)) ||
              rows.find((r) => want.includes(norm(r.name).toLowerCase()) && norm(r.name).length > 4);
  let rec = { collectedAt: nowIso, appName, id: (hit && hit.id) || null, status: [], rating: [], reviews: [], installs: [], money: [], visited: [] };
  if (hit && hit.id) {
    const agg = await readApp(page, hit.id);
    rec = Object.assign(rec, agg, { collectedAt: nowIso, appName, id: hit.id, listStatus: hit.status || '' });
    if (hit.row) rec.status.unshift(norm(hit.row).slice(0, 120));
    if (hit.status) rec.status.unshift(hit.status);
    rec.status = [...new Set(rec.status)].slice(0, 10);
  }
  // прибави каквото е ОТВОРЕНО ръчно (напр. таб Отзывы), ако споменава този ап
  for (const p of pages) { const t = await pageText(p); if (!norm(t).toLowerCase().includes(want)) continue; const ins = extractInsights(t); for (const k of ['rating', 'reviews', 'installs', 'money']) if (ins[k].length) { rec[k].push(...ins[k]); rec[k] = [...new Set(rec[k])].slice(0, 40); } }
  return rec;
}

// Главна (за ЕДНО или МНОГО приложения): чете общия преглед на /apps ВЕДНЪЖ, после детайли за всеки
// ап в обхвата. Записва JSON + по един insights.md на приложение. Връща обобщение.
async function collectInsights({ browser, app, appName, apps, stampMs }) {
  const nowIso = new Date(stampMs || Date.now()).toISOString().slice(0, 10);
  const data = load(); data.overview = data.overview || { apps: [] }; data.apps = data.apps || {};
  const pages = rsPages(browser);
  if (!pages.length) return { ok: false, error: 'няма отворена страница на RuStore' };
  const page = pages[0];

  // списък приложения за обработка (по подразбиране само подаденото)
  const list = (Array.isArray(apps) && apps.length) ? apps : [app];

  // 1) общ преглед на /apps (всички апове) — ВЕДНЪЖ
  const { rows } = await readOverview(page, appName || appConsoleName(list[0]));
  data.overview = { collectedAt: nowIso, apps: rows.map((r) => ({ id: r.id, name: r.name, status: r.status, row: r.row })) };

  // 2) детайли за всеки ап в обхвата
  const results = [];
  for (const a of list) {
    const nm = (a === app && appName) ? appName : appConsoleName(a);
    const rec = await detailForApp(page, pages, rows, a, nm, nowIso);
    data.apps[a] = rec;
    const mdOk = writeMd(a, nm, rec);
    results.push({ app: a, appName: nm, rec, mdOk });
  }
  save(data);
  // върни към списъка (чисто състояние за следващото действие)
  await page.goto('https://console.rustore.ru/apps', { waitUntil: 'domcontentloaded' }).catch(() => {});
  return { ok: true, overviewCount: rows.length, results, rec: results[0] && results[0].rec, id: results[0] && results[0].rec.id, mdOk: results[0] && results[0].mdOk };
}

module.exports = { collectInsights, extractInsights, appConsoleName, OUT_JSON };
