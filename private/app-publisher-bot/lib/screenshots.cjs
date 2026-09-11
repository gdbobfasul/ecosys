// screenshots.cjs — локализирани скрийншоти (15 езика) от готовия dist на приложението.
// Зарежда dist през локален http сървър, в телефонен размер, и снима поредица екрани по
// конфиг. Новините/динамичните екрани се пълнят с примерни локализирани заглавия, преведени
// през MyMemory (същия преводач, който ползва приложението).
//
// Конфигът идва от <appDir>/publish/publish.config.json (виж README). Ако липсва — грешка
// с подсказка, защото навигацията е специфична за всеки ап.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadPlaywright } = require('./util.cjs');

const LANGS = ['bg','ru','uk','en','de','fr','es','es-MX','it','pt','ar','hi','ja','ky','zh-Hant'];
const MM = { bg:'bg', ru:'ru', uk:'uk', en:'en', de:'de', fr:'fr', es:'es', 'es-MX':'es-MX', it:'it', pt:'pt', ar:'ar', hi:'hi', ja:'ja', ky:'ky', 'zh-Hant':'zh-TW' };

// Билднатият Playwright Chromium може да липсва (обновена Playwright версия без
// `playwright install`). Тогава минаваме на инсталиран браузър (Chrome → Edge)
// през официалната опция channel — снимките са същите (Chromium двигател).
async function launchChromium(pw) {
  let err;
  for (const opt of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
    try { return await pw.chromium.launch(opt); } catch (e) { err = e; }
  }
  throw err;
}

const trCache = new Map();
async function translate(text, target) {
  if (target === 'en') return text;
  const key = target + '|' + text;
  if (trCache.has(key)) return trCache.get(key);
  const lp = 'en|' + (MM[target] || target);
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) +
    '&langpair=' + encodeURIComponent(lp) + '&de=ltd.dai.grup@gmail.com';
  try {
    const r = await fetch(url);
    const j = await r.json();
    let out = (j && j.responseData && j.responseData.translatedText) || '';
    if (!out || /MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(out)) out = text;
    trCache.set(key, out); return out;
  } catch (_) { return text; }
}

function xmlEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function buildRss(titles) {
  const now = Date.now();
  const items = titles.map((t, i) => {
    const d = new Date(now - (i + 1) * 37 * 60000).toUTCString();
    return `<item><title>${xmlEsc(t)}</title><link>https://example.org/news/${i}</link><pubDate>${d}</pubDate><description>${xmlEsc(t)}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>News</title>${items}</channel></rss>`;
}

const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon' };
function serve(root) {
  return http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    const fp = path.join(root, u);
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

// Прилага състоянието за един екран (изпълнява се ПРЕДИ зареждане на страницата).
function initFor(screen, cfg, lang, rss) {
  // storage: допълнителни localStorage ключове (общи cfg.storage + за екрана screen.storage) — напр.
  // засети „веднъж на пускане" снимки (newslator.once.*) или списъци за новите табове; стойност-обект → JSON.
  // cfg.i18n: { токен: { bg:'…', en:'…', … } } — в семената (и във fill-стойностите) `{{токен}}` се заменя с текста
  // за текущия език (резервно en → токенът), за да са примерните имена на езика на снимката.
  const extra = Object.assign({}, cfg.storage || {}, screen.storage || {});
  const storage = {}; for (const k of Object.keys(extra)) storage[k] = i18nFill(typeof extra[k] === 'string' ? extra[k] : JSON.stringify(extra[k]), cfg, lang);
  return { langKey: cfg.langKey, lang, stateKey: cfg.stateKey,
    state: screen.state === 'full' && cfg.state ? i18nFill(JSON.stringify(cfg.state), cfg, lang) : null, storage };
}
function i18nFill(str, cfg, lang) {
  const dict = cfg.i18n || {};
  return String(str).replace(/\{\{(\w+)\}\}/g, (m, k) => { const e = dict[k]; return e ? (e[lang] != null ? e[lang] : e.en != null ? e.en : k) : m; });
}

async function generateScreenshots(appDir, opts = {}) {
  const cfgPath = path.join(appDir, 'publish', 'publish.config.json');
  if (!fs.existsSync(cfgPath)) {
    throw new Error('Липсва ' + cfgPath + ' — всеки ап има специфична навигация. Виж README за схемата.');
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const dist = path.join(appDir, cfg.webDir || 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Липсва билд (dist). Първо `vite build`. Търсих: ' + dist);
  const outRoot = path.join(appDir, 'publish', 'screenshots');
  const vp = cfg.viewport || { width: 360, height: 760 };
  const dsf = cfg.deviceScaleFactor || 3;
  const langs = opts.langs || LANGS;

  const pw = loadPlaywright();
  const server = serve(dist);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  let base = `http://127.0.0.1:${port}/`;
  let isLocal = (u) => u.startsWith('http://127.0.0.1:' + port);
  // ★ ОБВИВКИ (server.url, напр. chat → my.girl.place): dist-ът само пренасочва към отдалечен сайт, а
  //   stub-ът за не-local заявки връща фалшив RSS XML → снимката е XML-заглушка, ЕДНАКВА за всички
  //   езици (Huawei дедупликира еднакви картинки → „1/8"). С "remoteBase" снимаме живия сайт и
  //   пускаме ВСИЧКИ заявки (localStorage за езика се задава на origin-а на живия сайт).
  if (cfg.remoteBase) { base = cfg.remoteBase; isLocal = () => true; }
  const browser = await launchChromium(pw);

  // Преводи на примерните заглавия по език.
  const headlines = cfg.sampleHeadlines || [];
  const byLang = {};
  for (const lang of langs) {
    const arr = [];
    for (const h of headlines) arr.push(await translate(h, lang));
    byLang[lang] = arr;
  }

  // Опции на браузърния контекст. cfg.geolocation = { "latitude": …, "longitude": … } → дава разрешение за
  // местоположение и подава фалшиви координати (обвивки към живи сайтове с „търсене наблизо" иначе показват
  // „User denied Geolocation" в снимката).
  const ctxOpts = { viewport: vp, deviceScaleFactor: dsf };
  // Жив сайт (remoteBase): не спирай снимките заради сертификат (напр. временно грешен vhost/SNI на сървъра →
  // NET::ERR_CERT_COMMON_NAME_INVALID) — снимаме съдържанието; сертификатът се проверява отделно.
  if (cfg.remoteBase) ctxOpts.ignoreHTTPSErrors = true;
  if (cfg.geolocation && cfg.geolocation.latitude != null) {
    ctxOpts.geolocation = { latitude: +cfg.geolocation.latitude, longitude: +cfg.geolocation.longitude, accuracy: 20 };
    ctxOpts.permissions = ['geolocation'];
  }

  fs.mkdirSync(outRoot, { recursive: true });
  // Споделен екран (по подразбиране първият екран без език → език-избор).
  if (cfg.sharedShot) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { window.__KCY_INTRO_OFF__ = true; } catch (e) {} });
    await page.route('**/*', (route) => isLocal(route.request().url())
      ? route.continue() : route.fulfill({ status: 200, contentType: 'application/xml', body: buildRss(headlines) }));
    await page.goto(base, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outRoot, cfg.sharedShot) });
    await ctx.close();
  }

  let total = 0;
  for (const lang of langs) {
    const rss = buildRss(byLang[lang] && byLang[lang].length ? byLang[lang] : headlines);
    const outDir = path.join(outRoot, lang);
    fs.mkdirSync(outDir, { recursive: true });
    const ctx = await browser.newContext(ctxOpts);

    for (const screen of cfg.screens) {
      const page = await ctx.newPage();
      await page.route('**/*', (route) => isLocal(route.request().url())
        ? route.continue() : route.fulfill({ status: 200, contentType: 'application/xml', body: rss }));
      const init = initFor(screen, cfg, lang, rss);
      await page.addInitScript((d) => {
        try { localStorage.clear(); } catch (e) {}
        try { window.__KCY_INTRO_OFF__ = true; } catch (e) {}   // без „Pupikes" интро в снимките
        // езиковият гейт (core/lang-gate.js, #pupikes-langgate) покрива екрана и прихваща кликовете по табовете →
        // изключваме го за езиковите снимки (езикът е зададен в localStorage); остава само за споделената снимка.
        try { window.__PUPIKES_LANGGATE_OFF__ = true; } catch (e) {}
        try { window.__PUPIKES_INTRO_OFF__ = true; } catch (e) {}      // интрото (#pupikes-intro) също прихваща кликове
        // legal-gate („екран 3") пази съгласието в kcy.legal.<ап>.v1 — ап-идентификаторът не е
        // известен тук, затова прихващаме проверката. Снимките показват приложението, не портала;
        // самият портал остава задължителен в реалния ап (и има отделна снимка при market-pulse).
        try {
          const g = Storage.prototype.getItem;
          Storage.prototype.getItem = function (k) {
            if (typeof k === 'string' && /^(kcy|pupikes)\.legal\..+\.v1$/.test(k)) return '2026-01-01T00:00:00.000Z';   // + pupikes.legal.<ап>.v1 (новият legal-gate)
            return g.apply(this, arguments);
          };
        } catch (e) {}
        if (d.lang) localStorage.setItem(d.langKey, d.lang);
        if (d.state) localStorage.setItem(d.stateKey, d.state);
        if (d.storage) for (const k of Object.keys(d.storage)) { try { localStorage.setItem(k, d.storage[k]); } catch (e) {} }
      }, init);
      // screen.url — адрес спрямо base (напр. "profile.html" при жив сайт с отделни страници) → пряко зареждане
      // вместо навигация с кликове (по-малко заявки към сайта; живите API-та имат лимит на заявките).
      await page.goto(screen.url ? new URL(screen.url, base).href : base, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(screen.wait || 1500);
      if (screen.tab != null && cfg.tabSelector) {
        const tabs = page.locator(cfg.tabSelector);
        if (await tabs.count() > screen.tab) { await tabs.nth(screen.tab).click(); await page.waitForTimeout(900); }
      }
      // actions: последователни стъпки след таба — [{ "click": "селектор" | "text=…", "wait": ms }] (под-табове и др.);
      //   { "fill": "селектор", "value": "текст|{{токен}}" } — попълва поле (input събитие → апът преизчислява);
      //   { "scroll": "селектор", "offset": px } — превърта елемента в горния край на екрана (резултати под сгъвката); offset = място за фиксирана лента.
      //   { "click": "селектор", "files": ["samples/a.jpg", …] } — кликът отваря избор на файл (input[type=file]) →
      //     подаваме примерни файлове (пътища спрямо publish/) — снимки/документи за апове, които работят с файл;
      //   { "select": "селектор", "value": "стойност" } — избира опция в <select> (change събитие → апът преизчислява).
      //   { "css": "правила" } — вкарва <style> в страницата (напр. настолна двуколонна подредба на жив сайт →
      //     една колона за телефонната снимка; скриване на бадж). Само за снимката, апът не се пипа.
      for (const a of (screen.actions || [])) {
        try {
          if (a.css) await page.addStyleTag({ content: String(a.css) });
          if (a.click && a.files) {
            const paths = (Array.isArray(a.files) ? a.files : [a.files]).map((f) => path.resolve(appDir, 'publish', f));
            const [fc] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 4000 }),
              page.locator(a.click).first().click({ timeout: 4000 })
            ]);
            await fc.setFiles(paths);
          } else if (a.click) await page.locator(a.click).first().click({ timeout: 4000 });
          if (a.select) await page.locator(a.select).first().selectOption(i18nFill(a.value == null ? '' : String(a.value), cfg, lang), { timeout: 4000 });
          if (a.fill) await page.locator(a.fill).first().fill(i18nFill(a.value == null ? '' : String(a.value), cfg, lang), { timeout: 4000 });
          if (a.scroll) await page.locator(a.scroll).first().evaluate((el, off) => { el.scrollIntoView({ block: 'start' }); if (off) window.scrollBy(0, -off); }, a.offset || 0);
        } catch (e) {}
        await page.waitForTimeout(a.wait || 800);
      }
      await page.screenshot({ path: path.join(outDir, screen.name) });
      await page.close();
      total++;
    }
    await ctx.close();
  }

  await browser.close();
  server.close();
  return { total, langs: langs.length, dir: outRoot };
}

module.exports = { generateScreenshots, LANGS };
