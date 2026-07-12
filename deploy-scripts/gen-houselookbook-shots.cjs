// gen-houselookbook-shots.cjs — прави реални екранни снимки на houselookbook (обвивка към живия
// сайт look.myhousesetup.com) на телефонен размер, за да покрие изискването ≥3 снимки.
// Пуска се: node deploy-scripts/gen-houselookbook-shots.cjs
const path = require('path');
const fs = require('fs');

let PW;
const CANDIDATES = [
  path.join(__dirname, '..', 'node_modules2', 'playwright'),
  path.join(__dirname, '..', 'desktop', 'selflearning-friend', 'node_modules', 'playwright'),
  path.join(__dirname, '..', 'private', 'robot', 'node_modules', 'playwright'),
  path.join(__dirname, '..', 'node_modules', 'playwright'),
  'playwright'
];
for (const c of CANDIDATES) { try { PW = require(c); console.log('Playwright от: ' + c); break; } catch (_) {} }
if (!PW) { console.log('Playwright липсва във всички пътища.'); process.exit(2); }

const SITE = process.argv[2] || 'https://look.myhousesetup.com';
const OUT = path.join(__dirname, '..', 'huawei', 'houselookbook', 'publish', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  let browser;
  try {
    browser = await PW.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  } catch (e) { console.log('Chromium не тръгна: ' + e.message); process.exit(2); }

  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  try {
    await page.goto(SITE, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) { console.log('Сайтът не се отвори: ' + e.message); await browser.close(); process.exit(1); }

  await page.waitForTimeout(2500);
  const title = await page.title().catch(() => '');
  const bodyLen = await page.evaluate(() => (document.body && document.body.innerText || '').trim().length).catch(() => 0);
  console.log(`Заглавие: "${title}"  ·  текст: ${bodyLen} знака`);

  const scrollH = await page.evaluate(() => document.body.scrollHeight).catch(() => 915);
  const steps = Math.max(3, Math.min(6, Math.ceil(scrollH / 915)));
  let saved = 0;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * 820);
    await page.waitForTimeout(900);
    const f = path.join(OUT, `${i + 1}-view.png`);
    try { await page.screenshot({ path: f }); saved++; console.log('✓ ' + path.basename(f)); } catch (e) { console.log('✗ ' + e.message); }
  }
  await browser.close();
  console.log(`\nГотово: ${saved} снимки в ${OUT}`);
  if (bodyLen < 40) console.log('⚠️ Страницата изглежда празна/логин — може да трябват реални снимки от вписан акаунт.');
})();
