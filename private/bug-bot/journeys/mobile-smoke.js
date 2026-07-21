// Version: 1.0001
// МОБИЛНИ АПОВЕ — генерично СМОУК журито за ВСИЧКИ мобилни приложения (rustore/*),
// вкл. новите/преименувани (3D Rotate, EvadeArena, Godfist Arena, …) — АВТОМАТИЧНО,
// без хардкод. Ползва ГОТОВИЯ билд (dist/ = кодът, който влиза в APK-то).
//
// За всеки ап: вдига мини уеб сървър на случаен порт → Playwright зарежда → проверява:
//   • НЯМА некаутната JS грешка (счупен бъндъл/краш);
//   • страницата реално рендира съдържание (не е бяла);
//   • интрото се прескача (флаг __KCY_INTRO_OFF__), за да стигнем до самото приложение.
// Прави екранна снимка при провал. НЕ пипа прод — всичко е локално.
//
// Пускане:  node run.js --journey mobilesmoke     (целта prod/vm е без значение — локално е)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const RUSTORE = path.join(__dirname, '..', '..', '..', 'rustore');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webm': 'video/webm', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

// мини статичен сървър за папка (dist/) — връща { server, port } на случаен порт
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

// открий мобилните апове с готов билд (dist/index.html)
function discoverApps() {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(RUSTORE); } catch (e) { return out; }
  for (const app of dirs.sort()) {
    const dist = path.join(RUSTORE, app, 'dist');
    if (fs.existsSync(path.join(dist, 'index.html'))) out.push({ app, dist });
  }
  return out;
}

// една стъпка = смоук на един ап (сервира dist, зарежда, проверява)
function smokeStep(app, dist) {
  return {
    label: 'смоук: ' + app,
    run: async (page) => {
      const { server, port } = await serveDir(dist);
      const errors = [];
      const onErr = (e) => errors.push(String(e && e.message ? e.message : e));
      page.on('pageerror', onErr);                          // некаутнати JS изключения = реален крах
      // Локален смоук: външните заявки (промо каталог/новини/борси) не са предмет на теста →
      // ги стъбваме с празен отговор, за да няма CORS шум (иначе се брои като „грешка").
      const stub = async (route) => {
        const u = route.request().url();
        if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
        try { await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); } catch (e) { try { await route.abort(); } catch (_) {} }
      };
      await page.route('**/*', stub);
      try {
        // прескочи интрото, за да стигнем до самото приложение
        await page.addInitScript(() => { try { window.__KCY_INTRO_OFF__ = true; } catch (e) {} });
        const resp = await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 30000 });
        if (!resp || resp.status() >= 400) throw new Error(app + ' не зареди (HTTP ' + (resp ? resp.status() : 0) + ')');
        await page.waitForTimeout(1800);                    // време бъндълът да се инициализира и да гръмне, ако ще
        // реално рендира ли? (тяло с видимо съдържание)
        const txtLen = await page.evaluate(() => (document.body && document.body.innerText || '').trim().length).catch(() => 0);
        const kids = await page.evaluate(() => (document.body ? document.body.querySelectorAll('*').length : 0)).catch(() => 0);
        if (txtLen === 0 && kids < 5) throw new Error(app + ' рендира ПРАЗНА страница (счупен билд?)');
        if (errors.length) throw new Error(app + ' — некаутнати грешки: ' + errors.slice(0, 3).join(' | '));
      } finally {
        page.off('pageerror', onErr);
        try { await page.unroute('**/*', stub); } catch (e) {}
        try { server.close(); } catch (e) {}
      }
    },
  };
}

const APPS = discoverApps();
module.exports = {
  app: 'mobilesmoke',
  name: 'Мобилни апове — смоук (' + APPS.length + ' апа, локален билд)',
  scenarios: [
    {
      name: 'Всеки мобилен ап зарежда без крах и рендира',
      steps: APPS.length ? APPS.map(({ app, dist }) => smokeStep(app, dist))
        : [{ label: 'няма билднати апове (dist/) — първо билдни', run: async () => { throw new Error('няма rustore/*/dist — билдни аповете преди смоука'); } }],
    },
  ],
};
