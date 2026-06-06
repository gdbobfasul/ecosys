// Пре-рендира статичните JPEG постери на терена ОТ terrain-bg.js (същия engine като
// живия фон) — така постерът съвпада с анимацията (вкл. жираф/тиранозавър).
// Постерът се ползва като instant placeholder докато живият canvas се зареди.
// Ползва Playwright + Chromium. Пускане:  NODE_PATH=node_modules2 node scripts/render-battle-bg.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { chromium } = require('playwright'); // резолвва се чрез NODE_PATH=node_modules2

const ENGINE = path.join(ROOT, 'public', 'portals', 'games', 'terrain-bg.js');
const JOBS = [
  { scene: 1, w: 1280, h: 960,  out: 'public/assets/battle-bg/duel.jpg' },
  { scene: 2, w: 1920, h: 2560, out: 'public/assets/battle-bg/fight-on-place.jpg' },
];
const JPEG_QUALITY = 0.86;

(async () => {
  fs.mkdirSync(path.join(ROOT, 'public/assets/battle-bg'), { recursive: true });
  const browser = await chromium.launch();
  for (const j of JOBS) {
    const page = await browser.newPage({ viewport: { width: Math.min(j.w, 1600), height: Math.min(j.h, 1000) } });
    await page.setContent('<!DOCTYPE html><html><body style="margin:0">' +
      '<canvas id="c" width="' + j.w + '" height="' + j.h + '"></canvas></body></html>');
    await page.addScriptTag({ path: ENGINE });
    await page.evaluate((s) => window.startTerrainBg(document.getElementById('c'), s), j.scene);
    await page.waitForTimeout(3500); // нека анимационният loop дорисува сцената
    const dataUrl = await page.evaluate((q) => {
      const c = document.getElementById('c');
      return c ? c.toDataURL('image/jpeg', q) : null;
    }, JPEG_QUALITY);
    if (!dataUrl) { console.log('✗ няма canvas за сцена', j.scene); await page.close(); continue; }
    const buf = Buffer.from(dataUrl.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(ROOT, j.out), buf);
    console.log('✓', j.out, '—', Math.round(buf.length / 1024), 'KB');
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('Грешка:', e.message); process.exit(1); });
