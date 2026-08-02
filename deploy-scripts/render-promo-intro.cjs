// render-promo-intro.cjs — записва брандовото интро на Pupikes (лапата/логото) като промо-видео
// и го слага в app-shared/promo-pupikes.mp4 — ЕДНО общо място, откъдето ботът го качва като
// Promotion video за ВСИЧКИ приложения (Huawei иска MOV/MP4, 4:3).
//
// Как: Playwright зарежда готовия dist на едно приложение с предварително избран език (за да
// пусне интрото веднага), записва ~5s видео (1200×900 = 4:3), после ffmpeg-static го прекодира в
// H.264 mp4. Пуска се:  node deploy-scripts/render-promo-intro.cjs
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
let PW; for (const c of ['desktop/selflearning-friend/node_modules/playwright', 'node_modules2/playwright', 'node_modules/playwright']) { try { PW = require(path.resolve(c)); break; } catch (_) {} }
if (!PW) { console.log('Playwright липсва.'); process.exit(2); }
const FFMPEG = require(path.resolve('deploy-scripts/node_modules/ffmpeg-static'));

const DIST = path.resolve('huawei/auto-sound-diagnostics/dist');   // интрото е еднакво за всички апове
const OUTDIR = path.resolve('app-shared');
const TMPDIR = path.resolve('deploy-scripts/.promo-tmp');
fs.mkdirSync(OUTDIR, { recursive: true });
fs.mkdirSync(TMPDIR, { recursive: true });
// Huawei иска промо-видеото и скрийншотовете да са в ЕДНАКВА ориентация. Скрийншотовете ни са
// ВЕРТИКАЛНИ (телефон, 1080×2280), затова и видеото е ВЕРТИКАЛНО 720×1280 (9:16), 15s–2min.
const W = 720, H = 1280;

const http = require('http');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p === '/') p = '/index.html';
      fs.readFile(path.join(DIST, p), (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function clickIf(page, sel, t) { try { await page.waitForSelector(sel, { timeout: t || 5000 }); await page.click(sel); return true; } catch (_) { return false; } }

(async () => {
  const srv = await startServer(); const port = srv.address().port;
  let browser; for (const opt of [{ args: ['--use-gl=swiftshader', '--no-sandbox'] }, { channel: 'chrome', args: ['--no-sandbox'] }, { channel: 'msedge', args: ['--no-sandbox'] }]) { try { browser = await PW.chromium.launch(opt); break; } catch (_) {} }
  if (!browser) { console.log('Няма браузър.'); process.exit(2); }
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'load' }).catch(() => {});
  // мини през екрана за език (core lang-gate) → English → Continue (force: минава pointer-events)
  try { await page.waitForSelector('#pupikes-langgate', { timeout: 6000 }); } catch (_) {}
  try { await page.click('.pupikes-lg-b[data-code="en"]', { force: true, timeout: 4000 }); } catch (_) {}
  await page.waitForTimeout(200);
  try { await page.click('#pupikes-lg-go', { force: true, timeout: 3000 }); } catch (_) {}
  // изчакай самото интро (#pupikes-intro); ако не дойде за 8s — карай нататък
  let introOk = false; try { await page.waitForSelector('#pupikes-intro', { timeout: 8000 }); introOk = true; } catch (_) {}
  console.log('интро видимо: ' + introOk);
  const framesDir = path.join(TMPDIR, 'frames'); fs.mkdirSync(framesDir, { recursive: true });
  let i = 0; const start = Date.now();
  while (Date.now() - start < 4200) {                     // ~4.2s интро
    await page.screenshot({ path: path.join(framesDir, 'f' + String(i).padStart(3, '0') + '.png') }).catch(() => {});
    i++; await page.waitForTimeout(120);                  // ~8 кадъра/сек
  }
  await browser.close(); try { srv.close(); } catch (_) {}
  if (i < 3) { console.log('✗ не уловихме интрото (кадри: ' + i + ')'); process.exit(1); }

  const outMp4 = path.join(OUTDIR, 'promo-pupikes.mp4');
  console.log('сглобяване на ' + i + ' кадъра → ' + outMp4);
  // 8 fps вход → задържи всеки кадър; изход 30fps H.264, 4:3, ~5s
  // Huawei иска 15s–2min. Интрото се проиграва ВЕДНЪЖ, после последният кадър СТОИ неподвижно до 20s
  // (tpad clone) — без мигане/повторение. 16:9 1280×720, baseline + faststart (бързо зареждане).
  execFileSync(FFMPEG, ['-y', '-framerate', '8', '-i', path.join(framesDir, 'f%03d.png'),
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:white,tpad=stop_mode=clone:stop_duration=20`,
    '-r', '25', '-t', '20', '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
    '-pix_fmt', 'yuv420p', '-crf', '28', '-movflags', '+faststart', '-an', outMp4],
    { stdio: 'ignore' });
  try { fs.rmSync(TMPDIR, { recursive: true, force: true }); } catch (_) {}
  const kb = Math.round(fs.statSync(outMp4).size / 1024);
  console.log('✓ готово: app-shared/promo-pupikes.mp4 (' + kb + ' KB, ' + W + '×' + H + ' 9:16 вертикално, 20s (интро + застой))');
})();
