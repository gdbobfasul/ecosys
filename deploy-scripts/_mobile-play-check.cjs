// Version: 1.0215
// Pupikes — помощник за „тест-робота": зарежда URL в безглав Chromium (Playwright от
// private/bug-bot) и проверява дали приложението наистина се РЕНДИРА без реални грешки.
// Изход: 0 = чисто; 1 = реални console/page грешки или не се рендира; 2 = Playwright липсва.
// Употреба: node _mobile-play-check.cjs <url> <screenshotPath>
const path = require('path');
let PW;
try {
  PW = require(path.join(__dirname, '..', 'private', 'robot', 'node_modules', 'playwright'));
} catch (e) {
  console.log('Playwright не е намерен в private/bug-bot/node_modules: ' + e.message);
  process.exit(2);
}

const url = process.argv[2];
const shot = process.argv[3];

// Шум от безглавия Chromium/SwiftShader (НЕ е бъг на апа) — игнорира се.
const NOISE = /Framebuffer|swiftshader|WebGL|GL_INVALID|GroupMarkerNotSet|fallback to software|GPU stall|Failed to create WebGL|THREE\.WebGLRenderer.*context/i;

(async () => {
  const errors = [];
  let browser;
  try {
    browser = await PW.chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
    });
  } catch (e) {
    console.log('Не успях да пусна Chromium: ' + e.message + ' (опитай: cd private/bug-bot && npx playwright install chromium)');
    process.exit(2);
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => { const t = (e && e.message) || String(e); if (!NOISE.test(t)) errors.push('pageerror: ' + t); });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch (e) {
    console.log('goto: ' + e.message);
    await browser.close();
    process.exit(1);
  }

  // Чакаме РЕАЛНО рендиране (до ~12с): canvas (игри) ИЛИ populated #app/main/бутони (апове),
  // и да е напуснал началния „Зареждане" екран. По-надеждно от фиксиран sleep.
  let rendered = false;
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    rendered = await page.evaluate(() => {
      const hasCanvas = !!document.querySelector('canvas');
      const app = document.getElementById('app');
      const appFull = app && app.children && app.children.length > 0;
      const ui = document.querySelectorAll('button, main, .screen, .tabbar, input, textarea').length > 0;
      const txt = (document.body && document.body.innerText || '').trim();
      const stillLoading = /^\s*(зареждане|loading)\b/i.test(txt) || /зареждане\.\.\./i.test(txt) && txt.length < 40;
      return (hasCanvas || appFull || ui) && !stillLoading;
    });
    if (rendered) break;
  }

  if (shot) { try { await page.screenshot({ path: shot }); } catch (_) {} }
  await browser.close();

  if (!rendered) { console.log('НЕ се рендира (остана на началния/празен екран до ~12с)'); process.exit(1); }
  if (errors.length) { console.log(errors.slice(0, 20).join('\n')); process.exit(1); }
  console.log('OK');
  process.exit(0);
})();
