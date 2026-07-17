// gen-market-pulse-shots.cjs — реални скрийншоти на Market Pulse: минава ПРЕЗ целия поток
// (интро → избор на език → legal-gate „екран 3" с отметка → табло → пазар → анализ) и снима.
// Така е и END-TO-END тест на новия legal-gate стандарт. Пуска се СЛЕД `npm run build`.
//   node deploy-scripts/gen-market-pulse-shots.cjs
const path = require('path');
const fs = require('fs');
let PW;
for (const c of [
  path.join(__dirname, '..', 'node_modules2', 'playwright'),
  path.join(__dirname, '..', 'desktop', 'selflearning-friend', 'node_modules', 'playwright'),
  path.join(__dirname, '..', 'node_modules', 'playwright')
]) { try { PW = require(c); break; } catch (_) {} }
if (!PW) { console.log('Playwright липсва.'); process.exit(2); }

const DIST_DIR = path.join(__dirname, '..', 'huawei', 'market-pulse', 'dist');
const OUT = path.join(__dirname, '..', 'huawei', 'market-pulse', 'publish', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

// Мъничък статичен HTTP сървър (ES модулите не се зареждат от file://).
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
  // Билднатият Playwright Chromium може да липсва → резерва: инсталиран Chrome/Edge (channel).
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
  await page.waitForTimeout(3500);                         // изчакай интрото

  // ЕКРАН 2: избор на език (натискаме English)
  if (!(await clickIf(page, '[data-lang="en"]', 8000))) { await clickIf(page, '[data-lang]', 4000); }
  await page.waitForTimeout(1200);

  // ЕКРАН 3: legal-gate → отметка + Продължи
  await shot(page, '1-legal-gate.png');                    // самият задължителен екран (за магазина е ок да го покажем)
  await clickIf(page, '#kcy-lg-chk', 6000);
  await page.waitForTimeout(300);
  await clickIf(page, '#kcy-lg-accept', 3000);
  await page.waitForTimeout(1200);

  // Табло (избор на пазар)
  await shot(page, '2-markets.png');

  // Крипто → инструменти
  if (await clickIf(page, '.cp-market[data-id="crypto"]', 6000)) {
    await page.waitForTimeout(900);
    await shot(page, '3-crypto-list.png');
    // първи инструмент → детайлен анализ (CoinGecko позволява CORS → реални данни)
    if (await clickIf(page, '.cp-inst', 6000)) {
      await page.waitForTimeout(6000);                     // изчакай теглене/анализ
      await shot(page, '4-detail-analysis.png');
      // натисни „1 г. назад" за исторически прозорец
      if (await clickIf(page, '.cp-p[data-p="y1"]', 3000)) { await page.waitForTimeout(5000); await shot(page, '5-history-1y.png'); }
    }
  }
  // Друг пазар за разнообразие (индекси)
  await clickIf(page, '#cp-back', 2000); await page.waitForTimeout(500);
  await clickIf(page, '#cp-back', 2000); await page.waitForTimeout(500);
  if (await clickIf(page, '.cp-market[data-id="stocks"]', 4000)) { await page.waitForTimeout(700); await shot(page, '6-stocks-list.png'); }

  await browser.close();
  try { srv.close(); } catch (_) {}
  console.log('\nГотово: скрийншоти в ' + OUT);
  process.exit(0);
})();
