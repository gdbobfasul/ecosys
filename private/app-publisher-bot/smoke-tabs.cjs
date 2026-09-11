// smoke-tabs.cjs — ПРОВЕРКА „зареждат ли всички табове" (искане 11.09.2026): отваря билднатия dist на
// приложението като генератора на снимки (същия конфиг publish/publish.config.json: state/storage/tab/
// actions, изключени бариери, подменена мрежа), минава през ВСЕКИ конфигуриран екран + през ВСИЧКИ
// бутони в tabSelector и записва: JS грешки (pageerror), console.error, празен екран (малко текст),
// и видим текст „error/грешка/failed". Изход: таблица + JSON в publish/smoke-tabs.json.
//   node private/app-publisher-bot/smoke-tabs.cjs huawei/<app> [lang=en] [lang2...]
const fs = require('fs'); const path = require('path'); const http = require('http');
let PW; for (const c of ['G:/wrk/2026-06-02-toks/node_modules2/playwright', 'G:/wrk/2026-06-02-toks/node_modules/playwright', 'G:/wrk/2026-06-02-toks/desktop/selflearning-friend/node_modules/playwright']) { try { PW = require(c); break; } catch (_) {} }
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain' };
function serve(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p === '/' || !fs.existsSync(path.join(root, p))) p = '/index.html';
    const f = path.join(root, p); const ext = path.extname(f).toLowerCase();
    fs.readFile(f, (e, b) => { if (e) { res.statusCode = 404; return res.end('nf'); } res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream'); res.end(b); });
  });
}
(async () => {
  const appDir = process.argv[2]; if (!appDir) { console.log('употреба: node smoke-tabs.cjs huawei/<app> [lang...]'); process.exit(1); }
  const langs = process.argv.slice(3); if (!langs.length) langs.push('en');
  const cfg = JSON.parse(fs.readFileSync(path.join(appDir, 'publish', 'publish.config.json'), 'utf8'));
  const dist = path.join(appDir, cfg.webDir || 'dist');
  const server = serve(dist); await new Promise((r) => server.listen(0, r)); const port = server.address().port;
  const base = cfg.remoteBase || `http://127.0.0.1:${port}/`; const isLocal = (u) => cfg.remoteBase ? true : u.startsWith('http://127.0.0.1:' + port);
  const browser = await PW.chromium.launch({ headless: true }).catch(async () => PW.chromium.launch({ headless: true, channel: 'chrome' }));
  const rows = []; const stateStr = (cfg.state && typeof cfg.state !== 'string') ? JSON.stringify(cfg.state) : (cfg.state || '');
  async function openPage(ctx, lang, screen) {
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push('JS: ' + String(e.message || e).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/net::|ERR_|favicon|404|Failed to load resource/.test(t)) errs.push('console: ' + t.slice(0, 160)); } });
    await page.route('**/*', (route) => isLocal(route.request().url()) ? route.continue() : route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const storage = Object.assign({}, cfg.storage || {}, (screen && screen.storage) || {});
    const d = { lang, langKey: cfg.langKey, stateKey: cfg.stateKey, state: (!screen || screen.state !== 'langOnly') ? stateStr : '', storage: Object.fromEntries(Object.entries(storage).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])) };
    await page.addInitScript((d) => {
      try { localStorage.clear(); } catch (e) {}
      try { window.__KCY_INTRO_OFF__ = true; window.__PUPIKES_LANGGATE_OFF__ = true; window.__PUPIKES_INTRO_OFF__ = true; } catch (e) {}
      try { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (typeof k === 'string' && /^(kcy|pupikes)\.legal\..+\.v1$/.test(k)) return '2026-01-01T00:00:00.000Z'; return g.apply(this, arguments); }; } catch (e) {}
      if (d.lang && d.langKey) localStorage.setItem(d.langKey, d.lang);
      if (d.state && d.stateKey) localStorage.setItem(d.stateKey, d.state);
      for (const k of Object.keys(d.storage || {})) { try { localStorage.setItem(k, d.storage[k]); } catch (e) {} }
    }, d);
    await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errs.push('goto: ' + e.message.slice(0, 80)));
    return { page, errs };
  }
  async function measure(page) {
    return page.evaluate(() => {
      const main = document.querySelector('main, .content, #app, body'); const t = (main && main.innerText || '').replace(/\s+/g, ' ').trim();
      const bad = /\b(error|грешка|failed|не може|cannot|undefined|NaN|\[object)\b/i.test(t) ? (t.match(/.{0,40}\b(error|грешка|failed|undefined|NaN|\[object)\b.{0,40}/i) || [''])[0] : '';
      return { len: t.length, bad, head: t.slice(0, 70) };
    }).catch(() => ({ len: 0, bad: 'evaluate failed', head: '' }));
  }
  for (const lang of langs) {
    const ctx = await browser.newContext({ viewport: cfg.viewport || { width: 360, height: 760 } });
    // 1) конфигурираните екрани
    for (const screen of (cfg.screens || [])) {
      if (screen.state === 'langOnly') continue;
      const { page, errs } = await openPage(ctx, lang, screen);
      await page.waitForTimeout(screen.wait || 1500);
      if (screen.tab != null && cfg.tabSelector) { const tabs = page.locator(cfg.tabSelector); if (await tabs.count() > screen.tab) { await tabs.nth(screen.tab).click().catch(() => {}); await page.waitForTimeout(900); } }
      for (const a of (screen.actions || [])) { if (a.fill) { try { await page.locator(a.fill).first().fill(String(a.value == null ? '' : a.value), { timeout: 4000 }); } catch (e) { errs.push('fill✗ ' + a.fill); } } if (a.select) { try { await page.locator(a.select).first().selectOption(String(a.value == null ? '' : a.value), { timeout: 4000 }); } catch (e) {} } /* fill/select — нужни за апове с екран за парола (authenticator) */ if (!a.click) { await page.waitForTimeout(a.wait || 300); continue; } try { await page.locator(a.click).first().click({ timeout: 4000 }); } catch (e) { errs.push('click✗ ' + a.click); } await page.waitForTimeout(a.wait || 800); }   // не-click стъпки (scroll/fill/select — само за снимките) се прескачат
      const m = await measure(page); rows.push({ lang, what: 'екран ' + screen.name, len: m.len, bad: m.bad, errs, head: m.head }); await page.close();
    }
    // 2) всички бутони в tabSelector (пълно обхождане)
    if (cfg.tabSelector) {
      const { page, errs } = await openPage(ctx, lang, null); await page.waitForTimeout(1500);
      const n = await page.locator(cfg.tabSelector).count();
      for (let i = 0; i < n; i++) {
        const before = errs.length; const lbl = (await page.locator(cfg.tabSelector).nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 24);
        await page.locator(cfg.tabSelector).nth(i).click({ timeout: 4000 }).catch(() => errs.push('click✗ tab ' + i)); await page.waitForTimeout(1200);
        const m = await measure(page); rows.push({ lang, what: `таб ${i} „${lbl}"`, len: m.len, bad: m.bad, errs: errs.slice(before), head: m.head });
      }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  let problems = 0;
  for (const r of rows) { const ok = r.len >= 40 && !r.bad && !r.errs.length; if (!ok) problems++; console.log((ok ? '✓' : '✗') + ' ' + r.lang + ' ' + r.what.padEnd(34) + ' текст=' + String(r.len).padStart(5) + (r.bad ? ' | ' + r.bad : '') + (r.errs.length ? ' | ' + r.errs.join(' ; ') : '')); }
  fs.writeFileSync(path.join(appDir, 'publish', 'smoke-tabs.json'), JSON.stringify(rows, null, 1));
  console.log(`ОБЩО ${rows.length} проверки, проблеми: ${problems}`);
})();
