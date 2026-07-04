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
  return { langKey: cfg.langKey, lang, stateKey: cfg.stateKey,
    state: screen.state === 'full' ? JSON.stringify(cfg.state) : null };
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
  const base = `http://127.0.0.1:${port}/`;
  const isLocal = (u) => u.startsWith('http://127.0.0.1:' + port);
  const browser = await pw.chromium.launch();

  // Преводи на примерните заглавия по език.
  const headlines = cfg.sampleHeadlines || [];
  const byLang = {};
  for (const lang of langs) {
    const arr = [];
    for (const h of headlines) arr.push(await translate(h, lang));
    byLang[lang] = arr;
  }

  fs.mkdirSync(outRoot, { recursive: true });
  // Споделен екран (по подразбиране първият екран без език → език-избор).
  if (cfg.sharedShot) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf });
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
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf });

    for (const screen of cfg.screens) {
      const page = await ctx.newPage();
      await page.route('**/*', (route) => isLocal(route.request().url())
        ? route.continue() : route.fulfill({ status: 200, contentType: 'application/xml', body: rss }));
      const init = initFor(screen, cfg, lang, rss);
      await page.addInitScript((d) => {
        try { localStorage.clear(); } catch (e) {}
        try { window.__KCY_INTRO_OFF__ = true; } catch (e) {}   // без „KCY Ecosystem" интро в снимките
        if (d.lang) localStorage.setItem(d.langKey, d.lang);
        if (d.state) localStorage.setItem(d.stateKey, d.state);
      }, init);
      await page.goto(base, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(screen.wait || 1500);
      if (screen.tab != null && cfg.tabSelector) {
        const tabs = page.locator(cfg.tabSelector);
        if (await tabs.count() > screen.tab) { await tabs.nth(screen.tab).click(); await page.waitForTimeout(900); }
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
