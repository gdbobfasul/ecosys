// Version: 1.0000
// МОБИЛНИ АПОВЕ — ДЪЛБОКО журито: тества ОСНОВНА функционалност на ВСИЧКИ мобилни апове
// (rustore/*) като УЕБ страници (dist/ = кодът в APK-то), journeys-стил. НЕ в магазините —
// локално сервиран билд (същия код като на production/VM). За всеки ап генерично:
//   1) минава онбординга: интро (__PUPIKES_INTRO_OFF__) → език (клик по опция) →
//      правен екран (стандартни #pupikes-lg-chk + #pupikes-lg-accept);
//   2) стига до ГЛАВНИЯ екран (има съдържание + интерактивни контроли, без JS краш);
//   3) прави безопасно взаимодействие (клик по основен бутон/навигация) → пак без краш.
// Екранна снимка при провал. Само ЧЕТЕНЕ/клик локално — не пипа прод.
//
// Пускане:  node run.js --journey mobileactions
// По желание: MOBILE_APPS="newslator,market-pulse" за подмножество.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const RUSTORE = path.join(__dirname, '..', '..', '..', 'rustore');
const ONLY = (process.env.MOBILE_APPS || '').split(',').map((s) => s.trim()).filter(Boolean);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webm': 'video/webm', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

function serveDir(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let rel = decodeURIComponent((req.url || '/').split('?')[0]);
        if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
        let file = path.join(dir, rel);
        if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
        const body = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(body);
      } catch (e) { res.writeHead(404); res.end('not found'); }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function discoverApps() {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(RUSTORE); } catch (e) { return out; }
  for (const app of dirs.sort()) {
    if (ONLY.length && !ONLY.includes(app)) continue;
    const dist = path.join(RUSTORE, app, 'dist');
    if (fs.existsSync(path.join(dist, 'index.html'))) out.push({ app, dist });
  }
  return out;
}

// Мине онбординга генерично (best-effort — стъпка, която липсва, се прескача тихо).
async function passOnboarding(page) {
  // 1) Език: ако има екран за избор, натисни опция (english/en/първата видима).
  try {
    const langBtn = await page.$('[data-lang="en"], [data-lang], .lang-option, button[lang]');
    if (langBtn) { await langBtn.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); }
  } catch (_) {}
  // По текст „English", ако горното не хвана.
  try {
    const byText = page.locator('text=/^\\s*English\\s*$/i').first();
    if (await byText.count()) { await byText.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); }
  } catch (_) {}
  // 2) Правен екран (стандартни ID-та): отметка + приемам.
  try {
    const chk = await page.$('#pupikes-lg-chk');
    if (chk) { await chk.check({ timeout: 1500 }).catch(() => chk.click().catch(() => {})); await page.waitForTimeout(200); }
    const acc = await page.$('#pupikes-lg-accept');
    if (acc) { await acc.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(500); }
  } catch (_) {}
}

function actionsStep(app, dist) {
  return {
    label: 'основна функционалност: ' + app,
    run: async (page) => {
      const { server, port } = await serveDir(dist);
      const errors = [];
      const onErr = (e) => errors.push(String(e && e.message ? e.message : e));
      page.on('pageerror', onErr);
      const stub = async (route) => {
        const u = route.request().url();
        if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
        try { await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); } catch (e) { try { await route.abort(); } catch (_) {} }
      };
      await page.route('**/*', stub);
      try {
        await page.addInitScript(() => { try { window.__PUPIKES_INTRO_OFF__ = true; } catch (e) {} });
        const resp = await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 30000 });
        if (!resp || resp.status() >= 400) throw new Error(app + ' не зареди (HTTP ' + (resp ? resp.status() : 0) + ')');
        await page.waitForTimeout(1200);
        await passOnboarding(page);
        await page.waitForTimeout(800);

        // ГЛАВЕН екран: има ли съдържание и интерактивни контроли?
        const info = await page.evaluate(() => {
          const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
          const ctrls = Array.prototype.filter.call(document.querySelectorAll('button, a[href], [role="button"], input, select, .btn, .tab, nav *'), vis);
          return { txt: (document.body && document.body.innerText || '').trim().length, ctrls: ctrls.length };
        }).catch(() => ({ txt: 0, ctrls: 0 }));
        if (info.txt === 0 && info.ctrls === 0) throw new Error(app + ' — главният екран е ПРАЗЕН след онбординг (счупен поток?)');
        if (info.ctrls === 0) throw new Error(app + ' — няма интерактивни контроли на главния екран');
        if (errors.length) throw new Error(app + ' — некаутнати грешки след онбординг: ' + errors.slice(0, 3).join(' | '));

        // ── ДЪЛБОКО: ако апът има регистър от инструменти (toolkit) → отвори ВСЕКИ инструмент по
        //    хеш (#/tool/<id>) и провери, че се зарежда без краш. Иначе → 1 безопасен клик. ──
        const before = errors.length;
        let toolIds = [];
        try {
          const reg = fs.readFileSync(path.join(RUSTORE, app, 'src', 'core', 'registry.js'), 'utf8');
          const re = /id:\s*'([^']+)'/g; let mm;
          while ((mm = re.exec(reg))) toolIds.push(mm[1]);
        } catch (_) {}
        if (toolIds.length) {
          for (const id of toolIds) {
            const b2 = errors.length;
            await page.goto('http://127.0.0.1:' + port + '/#/tool/' + id, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
            await passOnboarding(page);
            await page.waitForTimeout(600);
            const has = await page.evaluate(() => (document.body && document.body.innerText || '').trim().length > 0 || document.querySelector('canvas, input, textarea, select, button') != null).catch(() => false);
            if (!has) throw new Error(app + ' — инструмент „' + id + '" не се зарежда (празен екран)');
            if (errors.length > b2) throw new Error(app + ' — инструмент „' + id + '" даде грешка: ' + errors.slice(b2, b2 + 2).join(' | '));
          }
        } else {
          try {
            const target = await page.evaluateHandle(() => {
              const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none'; };
              const bad = /back|назад|http|mailto|tel:|exit|изход/i;
              const cands = Array.prototype.filter.call(document.querySelectorAll('button, [role="button"], .btn, .tab, nav a, nav button'), (el) => vis(el) && !bad.test((el.textContent || '') + (el.getAttribute('href') || '')));
              return cands[0] || null;
            });
            const elem = target.asElement();
            if (elem) { await elem.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(900); }
          } catch (_) {}
        }
        const stillOk = await page.evaluate(() => (document.body && document.body.innerText || '').trim().length > 0 || document.querySelectorAll('canvas, button, a').length > 0).catch(() => false);
        if (errors.length > before) throw new Error(app + ' — взаимодействие предизвика грешка: ' + errors.slice(before, before + 2).join(' | '));
        if (!stillOk) throw new Error(app + ' — след взаимодействие екранът се изпразни (счупена навигация?)');
      } finally {
        page.off('pageerror', onErr);
        try { await page.unroute('**/*', stub); } catch (e) {}
        try { server.close(); } catch (e) {}
      }
    },
  };
}

const apps = discoverApps();
module.exports = {
  name: 'Мобилни апове — основна функционалност (dist като уеб, journeys)',
  scenarios: [
    {
      name: 'Онбординг → главен екран → взаимодействие (всички мобилни апове)',
      steps: apps.length ? apps.map(({ app, dist }) => actionsStep(app, dist))
        : [{ label: 'няма билднати апове (dist/)', run: async () => { throw new Error('липсват dist/ билдове — пусни точка 57 първо'); } }],
    },
  ],
};
