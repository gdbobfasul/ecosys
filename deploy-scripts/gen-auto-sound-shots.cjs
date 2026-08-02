// gen-auto-sound-shots.cjs — реални скрийншоти на Auto Sound Diagnostics: минава ПРЕЗ целия поток
// (интро Pupikes → избор на език → legal-gate „екран 3" с отметка → екран за съгласие → начало) и
// снима. Служи и като END-TO-END тест на потока. Пуска се СЛЕД `npm run build` на приложението.
//   node deploy-scripts/gen-auto-sound-shots.cjs
const path = require('path');
const fs = require('fs');
let PW;
for (const c of [
  path.join(__dirname, '..', 'node_modules2', 'playwright'),
  path.join(__dirname, '..', 'desktop', 'selflearning-friend', 'node_modules', 'playwright'),
  path.join(__dirname, '..', 'node_modules', 'playwright')
]) { try { PW = require(c); break; } catch (_) {} }
if (!PW) { console.log('Playwright липсва.'); process.exit(2); }

const DIST_DIR = path.join(__dirname, '..', 'huawei', 'auto-sound-diagnostics', 'dist');
const OUT = path.join(__dirname, '..', 'huawei', 'auto-sound-diagnostics', 'publish', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const http = require('http');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(DIST_DIR, p);
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
async function shot(page, name) { const f = path.join(OUT, name); try { await page.screenshot({ path: f }); console.log('✓ ' + name); } catch (e) { console.log('✗ ' + name + ': ' + e.message); } }
async function clickIf(page, sel, t) { try { await page.waitForSelector(sel, { timeout: t || 6000 }); await page.click(sel); return true; } catch (_) { return false; } }

(async () => {
  let browser;
  const LOPT = { args: ['--use-gl=swiftshader', '--no-sandbox'] };
  for (const opt of [LOPT, { ...LOPT, channel: 'chrome' }, { ...LOPT, channel: 'msedge' }]) {
    try { browser = await PW.chromium.launch(opt); break; } catch (e) { browser = null; }
  }
  if (!browser) { console.log('Chromium не тръгна (нито билднат, нито Chrome/Edge).'); process.exit(2); }
  const srv = await startServer();
  const port = srv.address().port;
  const URL = 'http://127.0.0.1:' + port + '/index.html';
  console.log('сървър на ' + URL);
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('  page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  console.error: ' + m.text()); });

  try { await page.goto(URL, { waitUntil: 'load', timeout: 30000 }); } catch (e) { console.log('goto: ' + e.message); }
  await page.waitForTimeout(1200);

  // 1) ЕЗИК — core lang-gate #pupikes-langgate (.pupikes-lg-b[data-code]) + бутон #pupikes-lg-go
  await page.waitForSelector('#pupikes-langgate', { timeout: 8000 }).catch(() => {});
  await shot(page, '1-language-picker.png');
  await clickIf(page, '.pupikes-lg-b[data-code="en"]', 5000);
  await page.waitForTimeout(300);
  await clickIf(page, '#pupikes-lg-go', 4000);

  // 2) ИНТРО — рекламата с логото на Pupikes (#pupikes-intro), играе на верния език
  try { await page.waitForSelector('#pupikes-intro', { timeout: 5000 }); await page.waitForTimeout(700); await shot(page, '2-intro.png'); } catch (_) {}
  // изчакай интрото да се затвори само (иначе го докосни)
  try { await page.waitForSelector('#pupikes-intro', { state: 'detached', timeout: 6000 }); } catch (_) { try { await page.mouse.click(206, 400); } catch (_) {} }
  await page.waitForTimeout(600);

  // 3) ПРАВИЛА/УСЛОВИЯ — съгласие #pupikes-legal-gate: отметка #pupikes-lg-chk + #pupikes-lg-accept
  await page.waitForSelector('#pupikes-legal-gate', { timeout: 6000 }).catch(() => {});
  await shot(page, '3-consent.png');
  await clickIf(page, '#pupikes-lg-chk', 5000);
  await page.waitForTimeout(300);
  await clickIf(page, '#pupikes-lg-accept', 3000);
  await page.waitForTimeout(1000);

  // 4) НАШ екран за съгласие (безопасност/отговорност) — #agree + #cont
  if (await page.$('#agree')) {
    await shot(page, '4-disclaimer.png');
    await clickIf(page, '#agree', 3000);
    await page.waitForTimeout(200);
    await clickIf(page, '#cont', 3000);
    await page.waitForTimeout(1000);
  }

  // 5) НАЧАЛО — запис + контекст (на английски)
  await page.waitForSelector('#recbtn', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, '5-home-en.png');

  await browser.close();
  try { srv.close(); } catch (_) {}
  console.log('\nГотово: скрийншоти в ' + OUT);
  process.exit(0);
})();
