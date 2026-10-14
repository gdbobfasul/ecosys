// gen-rustore-func-shots.cjs — ФУНКЦИОНАЛНИ RuStore скрийншоти: 1080×1920 (9:16), ОСНОВНО НА РУСКИ
// + един-два на друг език (по искане: RuStore иска 9:16 и руско съдържание, но държим и по 1 на англ.).
// Снима РЕАЛНОТО приложение (dist), минава език-гейта (руски) и легал-гейта, прави няколко екрана.
//
// Пускане:  node deploy-scripts/gen-rustore-func-shots.cjs <app> [<app2> ...]
// Изход:    rustore/<app>/publish/1-ru.png … 4-ru.png + 5-en.png  (старите N-*.png се трият първо)
// Формат:   viewport 540×960 @ deviceScaleFactor 2 → 1080×1920 точно (0.5625 = 9:16).
const fs = require('fs');
const path = require('path');
const http = require('http');
let PW; for (const c of ['desktop/selflearning-friend/node_modules/playwright', 'node_modules/playwright']) { try { PW = require(path.resolve(c)); break; } catch (_) {} }
if (!PW) { console.log('Playwright липсва.'); process.exit(2); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.bin': 'application/octet-stream' };
function startServer(distDir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(distDir, p);
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
async function clickIf(page, sel, t) { try { await page.waitForSelector(sel, { timeout: t || 5000 }); await page.click(sel); return true; } catch (_) { return false; } }
async function passGates(page, lang) {
  // език
  if (!(await clickIf(page, '[data-lang="' + lang + '"]', 8000))) await clickIf(page, '[data-lang]', 4000);
  await page.waitForTimeout(1200);
  // старт бутон (ако има)
  await clickIf(page, '#lang-start, .lang-start, [data-lang-start]', 1500);
  await page.waitForTimeout(800);
  // легал-гейт: изчакай overlay-а, отметни (fires change → активира бутона), приеми
  try { await page.waitForSelector('#pupikes-lg-chk', { timeout: 6000 }); } catch (_) {}
  try { await page.check('#pupikes-lg-chk', { timeout: 3000 }); } catch (_) { await clickIf(page, '#pupikes-lg-chk', 2000); }
  await page.waitForTimeout(500);
  if (!(await clickIf(page, '#pupikes-lg-accept:not([disabled])', 3000))) await clickIf(page, '#pupikes-lg-accept', 2000);
  await page.waitForTimeout(1600);
  // затвори евентуалното еко-балонче/овърлей, ако пречи
  await clickIf(page, '#pupikes-eco-close, .pupikes-bar-close, [data-eco-close]', 1000);
  await page.waitForTimeout(400);
}

async function genApp(app) {
  const distDir = path.resolve('rustore', app, 'dist');
  if (!fs.existsSync(distDir)) { console.log('  ✗ ' + app + ': няма dist (' + distDir + ')'); return; }
  const OUT = path.resolve('rustore', app, 'publish');
  fs.mkdirSync(OUT, { recursive: true });
  // трий старите скрийншоти (грешен размер)
  for (const f of fs.readdirSync(OUT).filter((x) => /^\d+.*\.(png|jpe?g)$/i.test(x))) { try { fs.unlinkSync(path.join(OUT, f)); } catch (_) {} }

  let browser;
  const LOPT = { args: ['--use-gl=swiftshader', '--no-sandbox'] };
  for (const opt of [LOPT, { ...LOPT, channel: 'chrome' }, { ...LOPT, channel: 'msedge' }]) { try { browser = await PW.chromium.launch(opt); break; } catch (_) { browser = null; } }
  if (!browser) { console.log('  ✗ Chromium не тръгна'); return; }
  const srv = await startServer(distDir);
  const URL = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const shots = [];
  const cap = async (page, name) => { const f = path.join(OUT, name); try { await page.screenshot({ path: f }); shots.push(name); console.log('    ✓ ' + name); } catch (e) { console.log('    ✗ ' + name + ': ' + e.message); } };

  // ── РУСКИ: 4 екрана ──
  let page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  try { await page.goto(URL, { waitUntil: 'load', timeout: 30000 }); } catch (_) {}
  await page.waitForTimeout(3800);                 // интро
  await passGates(page, 'ru');
  await cap(page, '1-ru.png');                     // главен екран
  // опитай да натиснеш до 3 навигационни елемента (долна лента / карти / бутони) за различни екрани
  const navSel = ['.kcy-bottombar button', '.bottom-bar button', '[data-nav]', '.cp-market', '.card', 'nav button', 'main button'];
  let taken = 1;
  for (const sel of navSel) {
    if (taken >= 4) break;
    const els = await page.$$(sel);
    for (let i = 0; i < els.length && taken < 4; i++) {
      try { await els[i].click({ timeout: 2500 }); await page.waitForTimeout(1800); await cap(page, (taken + 1) + '-ru.png'); taken++; } catch (_) {}
      // върни се ако има назад
      await clickIf(page, '#cp-back, .back, [data-back]', 800);
    }
    if (taken > 1) break;   // намерихме работеща навигация
  }
  // резерва: ако навигацията не даде достатъчно екрани → скрол-заснемане за разнообразие
  if (taken < 3) {
    const h = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);
    for (let y = 960; taken < 4 && y < h; y += 820) {
      try { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(900); await cap(page, (taken + 1) + '-ru.png'); taken++; } catch (_) {}
    }
    try { await page.evaluate(() => window.scrollTo(0, 0)); } catch (_) {}
  }
  await page.close();

  // ── 5-ти екран СЪЩО НА РУСКИ (03.10 ФИКС): преди беше английски („5-en.png"), но RuStore п.6.2 го
  //   флагваше „содержание/описание не адаптировано для русскоговорящей аудитории" → всички руски сега.
  page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  try { await page.goto(URL, { waitUntil: 'load', timeout: 30000 }); } catch (_) {}
  await page.waitForTimeout(3800);
  await passGates(page, 'ru');
  await cap(page, (Math.max(taken, 4) + 1) + '-ru.png');
  await page.close();

  await browser.close().catch(() => {});
  srv.close();
  // проверка на размерите
  for (const f of shots) { try { const b = fs.readFileSync(path.join(OUT, f)); const w = b.readUInt32BE(16), h = b.readUInt32BE(20); console.log('    ' + f + ' → ' + w + 'x' + h + (Math.abs(w / h - 0.5625) < 0.01 ? ' (9:16 ✓)' : ' (⚠ не 9:16)')); } catch (_) {} }
  console.log('  ✓ ' + app + ': ' + shots.length + ' скрийншота → rustore/' + app + '/publish/');
}

(async () => {
  const apps = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (!apps.length) { console.log('Употреба: node deploy-scripts/gen-rustore-func-shots.cjs <app> [...]'); process.exit(1); }
  for (const a of apps) { console.log('▶ ' + a); try { await genApp(a); } catch (e) { console.log('  ✗ ' + a + ': ' + e.message); } }
})();
