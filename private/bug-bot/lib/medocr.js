// Version: 1.0002
// medocr.js — РЕАЛЕН тест за Pupikes Medicines: подава на СЪЩИНСКИЯ апп (сервира dist, зарежда в
// браузър) КУРИРАНИ РЕАЛНИ снимки на лекарствени опаковки (ръчно прегледани, четимо латинско име,
// от Wikimedia Commons — виж fixtures/medicines/manifest.json), пуска РЕАЛНИЯ му OCR (Tesseract от
// CDN) + търсенето, и проверява дали намереното лекарство съвпада с името до снимката. За всяко
// лекарство прави и НЕЗАВИСИМА проверка на базата (въвежда истинското име ръчно) — така се разделя
// „OCR-ът не прочете" от „не е в базата". Ползва подадения Playwright context.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const DIST = path.join(__dirname, '..', '..', '..', 'rustore', 'pupikes-medicines', 'dist');
const FIXDIR = path.join(__dirname, '..', 'fixtures', 'medicines');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

// Курирани РЕАЛНИ снимки (локални фикстури, БЕЗ мрежа) — ръчно прегледани ясни латински опаковки.
function loadFixtures() {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(FIXDIR, 'manifest.json'), 'utf8'));
    return (m.items || []).filter((it) => fs.existsSync(path.join(FIXDIR, it.file)));
  } catch (_) { return []; }
}

function serveDir(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
        let file = path.join(dir, rel);
        if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(fs.readFileSync(file));
      } catch (e) { res.writeHead(404); res.end('nf'); }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function runMedicinesOcr({ context, log } = {}) {
  const say = (m) => { if (log) log(m); };
  const findings = [];
  const now = () => new Date().toISOString();
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    findings.push({ ts: now(), severity: 'warn', kind: 'medocr', app: 'pupikes-medicines', detail: 'няма билднат dist — билдни Medicines преди теста' });
    return { findings, summary: { passed: 0, total: 0 } };
  }
  const DRUGS = loadFixtures();
  if (!DRUGS.length) {
    findings.push({ ts: now(), severity: 'warn', kind: 'medocr', app: 'pupikes-medicines', detail: 'няма курирани фикстури в fixtures/medicines — добави снимки + manifest.json' });
    return { findings, summary: { passed: 0, total: 0 } };
  }
  say(`   курирани реални опаковки: ${DRUGS.length} (${DRUGS.map((d) => d.names[0]).join(', ')})`);
  const { server, port } = await serveDir(DIST);
  let ok = 0, total = 0, gotImg = 0, dbOk = 0, dbTotal = 0;
  try {
    for (const d of DRUGS) {
      const page = await context.newPage();
      try {
        await page.addInitScript(() => { try { window.__PUPIKES_INTRO_OFF__ = true; localStorage.setItem('servicestoolkit.lang', 'en'); localStorage.setItem('med.disclaimer.ok', '1'); } catch (e) {} });
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 30000 });
        await page.waitForSelector('#name', { state: 'attached', timeout: 15000 });

        // ── СТЪПКА 2 (независима): има ли ИСТИНСКОТО име в базата? Въвеждаме го ръчно, без OCR. ──
        // Така разделяме „OCR-ът не прочете" от „не е в базата".
        dbTotal++;
        await page.fill('#name', d.names[0]);
        await page.click('#searchbtn', { force: true });   // force: промо-оувърлеят може да покрива бутона
        const dbRes = await page.waitForFunction(() => {
          const r = document.getElementById('result'); const s = document.getElementById('status');
          const rt = (r && r.innerText || '').trim(); const st = (s && s.innerText || '').trim();
          if (rt) return { text: rt }; if (!st) return { text: '' }; return false;
        }, { timeout: 30000, polling: 500 }).then((h) => h.jsonValue()).catch(() => ({ text: '' }));
        const dbText = (dbRes.text || '').toLowerCase();
        const inDb = dbText && !/not_found|не е намерен|not found/i.test(dbText) && dbText.length > 12;
        if (inDb) dbOk++;
        say(`   [БАЗА] „${d.names[0]}" директно → ${inDb ? '✓ намерено в базата' : '✗ НЯМА в базата'}: ${dbText ? dbText.replace(/\s+/g, ' ').slice(0, 60) : '(празно)'}`);

        // ── СТЪПКА 1: курирана реална снимка на опаковка → OCR-а на апа. ──
        const fpath = path.join(FIXDIR, d.file);
        gotImg++; total++;
        // #photo е СКРИТ вход (display:none) — чакаме го „закачен" (не видим), после подаваме файла.
        await page.waitForSelector('#photo', { state: 'attached', timeout: 15000 });
        await page.setInputFiles('#photo', fpath);
        // изчакай OCR (Tesseract от CDN, бавно първия път) + търсенето → резултат ИЛИ „не е намерено"
        const res = await page.waitForFunction(() => {
          const r = document.getElementById('result'); const s = document.getElementById('status');
          const rt = (r && r.innerText || '').trim(); const st = (s && s.innerText || '').trim();
          if (rt) return { done: true, text: rt };
          if (!st) return { done: true, text: '' };   // статусът се изчисти без резултат
          return false;
        }, { timeout: 60000, polling: 800 }).then((h) => h.jsonValue()).catch(() => ({ done: false, text: '' }));
        // Извади ОТЛАДЪЧНИЯ канал: какво прочете OCR-ът (кандидати) + всеки опит в базата.
        const dbg = await page.evaluate(() => window.__medDbg || null).catch(() => null);
        const text = (res.text || '').toLowerCase();
        const hit = d.names.some((n) => text.includes(n));
        if (hit) ok++;
        if (dbg) {
          say(`   [OCR ] „${d.names[0]}" прочете: [${(dbg.cands || []).map((c) => '"' + c + '"').join(', ') || '—'}]`);
          for (const t of (dbg.tries || [])) say(`          опит „${t.cand}" → ${t.found ? '✓ намерено (' + (t.source || '?') + '): ' + (t.title || '') : '✗ няма в базата'}`);
          say(`   ${hit ? '✓' : '✗'} „${d.names[0]}" ФИНАЛ: ${dbg.matched ? 'уцели с „' + dbg.matched + '"' : 'нито един кандидат не се намери'}`);
        } else {
          say(`   ${hit ? '✓' : '✗'} „${d.names[0]}" → ${text ? text.replace(/\s+/g, ' ').slice(0, 70) : '(апът не разпозна)'}`);
        }
      } catch (e) { say(`   · „${d.names[0]}": грешка ${e.message.split('\n')[0].slice(0, 60)}`); }
      finally { await page.close().catch(() => {}); }
    }
  } finally {
    try { server.close(); } catch (_) {}
  }
  const rate = total ? Math.round((ok / total) * 100) : 0;
  const dbRate = dbTotal ? Math.round((dbOk / dbTotal) * 100) : 0;
  say(`   → БАЗА (директно име): ${dbOk}/${dbTotal} намерени (${dbRate}%)  ·  OCR+БАЗА (от снимка): ${ok}/${total} (${rate}%)`);
  // Диагноза: ако базата намира директните имена, но OCR-ът не → проблемът е в OCR/снимката, НЕ в логиката/базата.
  if (dbTotal >= 3 && dbRate < 60) findings.push({ ts: now(), severity: 'warn', kind: 'medocr', app: 'pupikes-medicines', detail: `Medicines: базата не намери ${dbTotal - dbOk}/${dbTotal} директни имена (${dbRate}%) — липсват в базата` });
  else if (total >= 3 && rate < 50) findings.push({ ts: now(), severity: 'info', kind: 'medocr', app: 'pupikes-medicines', detail: `Medicines: базата е ОК (${dbRate}%), но OCR от снимка уцели само ${rate}% — проблемът е в четенето на снимката/качеството на извадката, не в логиката` });
  return { findings, summary: { passed: ok, total, gotImg, rate, dbOk, dbTotal, dbRate } };
}

module.exports = { runMedicinesOcr };
