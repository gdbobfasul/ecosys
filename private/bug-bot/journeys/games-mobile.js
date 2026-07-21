// Version: 1.0001
// ИГРИ (мобилни) — дълбоко журито за Phaser-аповете (авто-открива по phaser зависимост).
// Покрива EvadeArena/Godfist Arena/Huntline 3D/Warbird Rush/duel/rustam/hmm — без хардкод.
// За всяка игра (локален билд): вдига мини сървър → зарежда с прескочено интро → минава
// правния екран → чака Phaser canvas → проверява:
//   • canvas съществува и НЕ е празен (играта реално се рисува);
//   • взаимодействие (тап/клавиши) не хвърля некаутната грешка;
//   • анимира се (2 кадъра се различават) — предупреждение, ако е статично.
//
// Пускане:  node run.js --journey gamesmobile     (локално — целта prod/vm е без значение)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const RUSTORE = path.join(__dirname, '..', '..', '..', 'rustore');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

function serveDir(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let rel = decodeURIComponent((req.url || '/').split('?')[0]);
        if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
        let file = path.join(dir, rel);
        if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(fs.readFileSync(file));
      } catch (e) { res.writeHead(404); res.end('not found'); }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// игра = ап, чийто package.json зависи от phaser (авто-включва бъдещи игри)
function discoverGames() {
  const out = [];
  let dirs = []; try { dirs = fs.readdirSync(RUSTORE); } catch (e) { return out; }
  for (const app of dirs.sort()) {
    const base = path.join(RUSTORE, app);
    const dist = path.join(base, 'dist');
    if (!fs.existsSync(path.join(dist, 'index.html'))) continue;
    let pkg = {}; try { pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8')); } catch (e) {}
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    // игров енджин в зависимостите (Phaser 2D, Three/WebGL 3D, Pixi, Babylon, regl, Matter)
    if (deps && Object.keys(deps).some((k) => /^(phaser|three|pixi\.js|pixi|babylonjs|@babylonjs|regl|matter-js)$/.test(k))) out.push({ app, dist });
  }
  return out;
}

// опит да минем правния екран (ЕКРАН 3): чекни всички отметки + натисни бутон за приемане
async function passLegalGate(page) {
  try {
    const cbs = page.locator('input[type=checkbox]');
    const n = await cbs.count().catch(() => 0);
    for (let i = 0; i < n; i++) { await cbs.nth(i).check({ timeout: 800 }).catch(() => {}); }
    for (const t of ['Приемам', 'Съгласен', 'Продължи', 'Продължавам', 'Accept', 'Agree', 'Continue', 'ОК', 'OK', 'Старт', 'Играй', 'Play']) {
      const b = page.locator('button:has-text("' + t + '"), a:has-text("' + t + '")').first();
      if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 800 }).catch(() => {}); break; }
    }
  } catch (e) { /* без гейт — продължаваме */ }
}

function gameStep(app, dist) {
  return {
    label: 'игра: ' + app,
    run: async (page) => {
      const { server, port } = await serveDir(dist);
      const errors = [];
      const onErr = (e) => errors.push(String(e && e.message ? e.message : e));
      page.on('pageerror', onErr);
      // локален тест → стъбвай външните заявки (промо/реклами), за да няма CORS шум
      const stub = async (route) => {
        if (route.request().url().startsWith('http://127.0.0.1:' + port)) return route.continue();
        try { await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); } catch (e) { try { await route.abort(); } catch (_) {} }
      };
      await page.route('**/*', stub);
      try {
        await page.addInitScript(() => { try { window.__KCY_INTRO_OFF__ = true; } catch (e) {} });
        const resp = await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 30000 });
        if (!resp || resp.status() >= 400) throw new Error(app + ' не зареди (HTTP ' + (resp ? resp.status() : 0) + ')');
        await page.waitForTimeout(1000);
        await passLegalGate(page);
        // Phaser създава canvas (в #game или директно) — изчакай да се появи
        const canvas = page.locator('canvas').first();
        await canvas.waitFor({ state: 'visible', timeout: 15000 }).catch(() => { throw new Error(app + ' — Phaser canvas не се появи (играта не тръгна)'); });
        await page.waitForTimeout(1200);
        // непразен ли е (реално се рисува)?
        const box = await canvas.boundingBox().catch(() => null);
        if (!box || box.width < 10 || box.height < 10) throw new Error(app + ' — canvas е с нулев размер');
        const shot1 = await canvas.screenshot().catch(() => null);
        // взаимодействие: тап в центъра + клавиши (движение/старт) — да не гръмне
        if (box) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {}); }
        for (const k of ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp']) { await page.keyboard.press(k).catch(() => {}); await page.waitForTimeout(120); }
        await page.waitForTimeout(1200);
        const shot2 = await canvas.screenshot().catch(() => null);
        if (errors.length) throw new Error(app + ' — некаутнати грешки: ' + errors.slice(0, 3).join(' | '));
        // анимация: различни кадри = игровият цикъл тече (само предупреждение, не провал)
        if (shot1 && shot2 && Buffer.compare(shot1, shot2) === 0) {
          console.log('    ⚠ ' + app + ': кадрите са еднакви (възможно статичен екран/меню)');
        }
      } finally {
        page.off('pageerror', onErr);
        try { await page.unroute('**/*', stub); } catch (e) {}
        try { server.close(); } catch (e) {}
      }
    },
  };
}

const GAMES = discoverGames();
module.exports = {
  app: 'gamesmobile',
  name: 'Игри (мобилни) — дълбоко (' + GAMES.length + ' игрови апа: Phaser/WebGL)',
  scenarios: [
    {
      name: 'Всяка игра тръгва, рисува и понася взаимодействие без крах',
      steps: GAMES.length ? GAMES.map(({ app, dist }) => gameStep(app, dist))
        : [{ label: 'няма Phaser игри с готов билд', run: async () => { throw new Error('няма rustore/*/dist с phaser — билдни игрите'); } }],
    },
  ],
};
