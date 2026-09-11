// Проба в истинския dist: примерна опаковка №4 (баркод) + ръчно търсене „Zyrtec-D" (речник) → заглавие/редове.
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let PW; for (const c of ['G:/wrk/2026-06-02-toks/node_modules2/playwright', 'G:/wrk/2026-06-02-toks/node_modules/playwright', 'G:/wrk/2026-06-02-toks/desktop/selflearning-friend/node_modules/playwright']) { try { PW = require(c); break; } catch (e) {} }
const DIST = process.argv[2] || 'G:/wrk/2026-06-02-toks/huawei/pupikes-medicines/dist';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html'; const fp = path.join(DIST, u); fs.readFile(fp, (err, d) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise((r) => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await PW.chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 400, height: 900 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e && e.message || e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
await page.addInitScript((lang) => { try { localStorage.clear(); } catch (e) {} try { window.__KCY_INTRO_OFF__ = true; window.__PUPIKES_INTRO_OFF__ = true; window.__PUPIKES_LANGGATE_OFF__ = true; } catch (e) {} try { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (typeof k === 'string' && /^(kcy|pupikes)\.legal\..+\.v1$/.test(k)) return '2026-01-01T00:00:00.000Z'; return g.apply(this, arguments); }; } catch (e) {} localStorage.setItem('servicestoolkit.lang', lang); localStorage.setItem('med.disclaimer.ok', '1'); }, process.argv[3] || 'en');
await page.goto(base, { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(1200);
for (let i = 0; i < 3; i++) { if (await page.locator('#photo').count()) break; await page.locator('#startbtn, #cont, button').first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); }
const waitDone = async () => { for (let w = 0; w < 120; w++) { await page.waitForTimeout(500); const st = await page.evaluate(() => ({ s: (document.querySelector('#status') || {}).textContent || '', r: (document.querySelector('#result') || {}).innerHTML || '' })); if (!st.s.trim() && st.r) return true; } return false; };
const dump = async (tag) => { const info = await page.evaluate(() => { const d = window.__medDbg || {}; const r = document.querySelector('#result'); return { h3: (r && r.querySelector('h3') || {}).textContent || '', lines: (r ? r.innerText : '').split('\n').filter((l) => /▮|Barcode|Баркод|registry|регист|Ingredients|Съставки|Source|Източник|↗|Leaflet|Листовка/.test(l)).slice(0, 12), matched: d.matched, barcode: d.barcode, gtin: d.gtin && d.gtin.name, angles: d.angles }; }); console.log('[' + tag + ']', JSON.stringify(info)); };
// 1) примерна опаковка с баркод
await page.locator('#samplebtn').click(); await page.waitForTimeout(300);
const t0 = Date.now(); await page.locator('.sample-card[data-i="3"]').click(); await waitDone(); console.log('време', ((Date.now() - t0) / 1000).toFixed(1) + ' s'); await dump('barcode sample');
// 2) ръчно търсене — само в речника
for (const q of ['Zyrtec-D', 'Motrin IB', 'Ozempic', 'Amoxiciline']) { await page.fill('#name', q); await page.locator('#searchbtn').click(); await waitDone(); await dump('search ' + q); }
// 3) примерна опаковка №1 (OCR път) — да не е счупен
const t1 = Date.now(); await page.locator('#samplebtn').click(); await page.waitForTimeout(300); await page.locator('.sample-card[data-i="0"]').click(); await waitDone(); console.log('време', ((Date.now() - t1) / 1000).toFixed(1) + ' s'); await dump('ocr sample');
console.log('грешки:', errors.length ? errors.slice(0, 5) : 'няма');
await browser.close(); server.close();
