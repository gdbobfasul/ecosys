// Version: 1.0001
// MARKET PULSE (Pupikes Market Pulse) — дълбоко журито от локалния билд.
// Минава финансовия правен екран (отметка „Разбрах и съм съгласен") и обхожда потока
// начало → пазар → инструмент(детайл с графика), проверявайки че всеки екран реално
// рендира и НЕ хвърля некаутната грешка. Данните за графиката идват от външни борси
// (Yahoo/CoinGecko) → в браузър може да са CORS-блокирани; тогава очакваме ГРАЦИОЗНО
// поведение (кеш/съобщение), НЕ крах.
//
// Пускане:  node run.js --journey marketpulse     (локално — целта prod/vm е без значение)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const DIST = path.join(__dirname, '..', '..', '..', 'rustore', 'market-pulse', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
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
async function passLegalGate(page) {
  const cbs = page.locator('input[type=checkbox]');
  const n = await cbs.count().catch(() => 0);
  for (let i = 0; i < n; i++) { await cbs.nth(i).check({ timeout: 800 }).catch(() => {}); }
  for (const t of ['Разбрах', 'Съгласен', 'Приемам', 'Продължи', 'Продължавам', 'Accept', 'Agree', 'Continue', 'ОК', 'OK']) {
    const b = page.locator('button:has-text("' + t + '"), a:has-text("' + t + '")').first();
    if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 800 }).catch(() => {}); break; }
  }
}
// текстът на #app (за да засечем реална навигация между екраните)
async function appText(page) { return (await page.evaluate(() => { const a = document.getElementById('app'); return a ? a.innerText.trim() : ''; }).catch(() => '')); }
// кликни първия смислен елемент вътре в #app (карта/бутон/ред) → навигация
async function clickFirst(page) {
  const sel = '#app .card, #app button, #app [data-market], #app [data-inst], #app li, #app a, #app [role="button"]';
  const el = page.locator(sel).first();
  if (await el.isVisible().catch(() => false)) { await el.click({ timeout: 2500 }).catch(() => {}); return true; }
  return false;
}

let ERR = [];
const NORM = { label: 'зареди билда, прескочи интро, мини правния екран', run: async (page, ctx) => {
  ERR = [];
  if (!ctx.__mpErr) { ctx.__mpErr = true; page.on('pageerror', (e) => ERR.push(String(e && e.message ? e.message : e))); }
  const { port } = ctx.__mp || (ctx.__mp = await serveDir(DIST));
  // локален тест → стъбвай външните заявки (борси/новини/промо) с празен отговор, за да
  // няма CORS шум; графиката тогава показва грациозно „няма данни" (което и проверяваме).
  if (!ctx.__mpRoute) {
    ctx.__mpRoute = true;
    await page.route('**/*', async (route) => {
      if (route.request().url().startsWith('http://127.0.0.1:' + port)) return route.continue();
      try { await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); } catch (e) { try { await route.abort(); } catch (_) {} }
    });
  }
  await page.addInitScript(() => { try { window.__KCY_INTRO_OFF__ = true; } catch (e) {} });
  const resp = await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 30000 });
  if (!resp || resp.status() >= 400) throw new Error('market-pulse не зареди (HTTP ' + (resp ? resp.status() : 0) + ')');
  await page.waitForTimeout(900);
  await passLegalGate(page);
  await page.waitForTimeout(600);
} };

module.exports = {
  app: 'marketpulse',
  name: 'Pupikes Market Pulse — дълбоко (локален билд)',
  scenarios: [
    {
      name: 'Начало → пазар → инструмент(графика) без крах',
      steps: [
        NORM,
        { label: 'началото рендира списък пазари', run: async (page) => {
          const t = await appText(page);
          if (!t || t.length < 5) throw new Error('началният екран е празен (билдът не рендира)');
          if (ERR.length) throw new Error('некаутнати грешки на началото: ' + ERR.slice(0, 3).join(' | '));
        } },
        { label: 'избор на пазар → екранът се сменя', run: async (page) => {
          const before = await appText(page);
          const ok = await clickFirst(page);
          if (!ok) throw new Error('няма кликаем пазар на началото');
          await page.waitForTimeout(1200);
          const after = await appText(page);
          if (after === before) throw new Error('изборът на пазар не смени екрана');
          if (ERR.length) throw new Error('некаутнати грешки при избор на пазар: ' + ERR.slice(0, 3).join(' | '));
        } },
        { label: 'избор на инструмент → детайл (графика ИЛИ грациозно съобщение), без крах', run: async (page) => {
          const before = await appText(page);
          await clickFirst(page);
          await page.waitForTimeout(2500);   // време за (опит за) теглене на данни
          const hasCanvas = await page.locator('#app canvas, canvas').first().isVisible().catch(() => false);
          const after = await appText(page);
          const moved = after !== before;
          if (!hasCanvas && !moved) throw new Error('детайлът не се отвори (нито графика, нито смяна на екрана)');
          if (ERR.length) throw new Error('некаутнати грешки в детайла: ' + ERR.slice(0, 3).join(' | '));
        } },
      ],
    },
  ],
  teardown: async (ctx) => { try { ctx.__mp && ctx.__mp.server && ctx.__mp.server.close(); } catch (e) {} },
};
