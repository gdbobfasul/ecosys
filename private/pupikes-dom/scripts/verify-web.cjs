#!/usr/bin/env node
'use strict';
/* Pupikes Дом — УЕБ/приложения авто-тест (5-те роли + лончър + заключване на ролята).
 * Всяко роля-приложение (owner/tech/mod/admin/center) е отделен вход (owner.html…), а нативната
 * обвивка само зарежда същата страница през server.url — значи тестът на страницата = тест на
 * приложението по логика. Бизнес-правилата се тестват отделно в verify.cjs (API, 73 теста).
 *
 * Самостоятелен: вдига сървъра на изолиран порт+база, сейд-ва demo, кара headless Chrome.
 * Ако няма Playwright/Chrome на машината → SKIP (не чупи), с ясно съобщение.
 *   node scripts/verify-web.cjs
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.WEB_TEST_PORT || 8911;
const BASE = 'http://127.0.0.1:' + PORT;
const DBFILE = path.join(os.tmpdir(), 'pupikes-dom-webtest-' + process.pid + '.sqlite');
const ENV = Object.assign({}, process.env, { PORT: String(PORT), SQLITE_FILE: DBFILE, NODE_ENV: 'test' });

function loadPlaywright() {
  const tries = ['playwright', path.join(ROOT, 'node_modules', 'playwright'),
    'G:/wrk/2026-06-02-toks/private/bug-bot/node_modules/playwright'];
  for (const p of tries) { try { return require(p); } catch (_) {} }
  return null;
}

(async () => {
  const pw = loadPlaywright();
  if (!pw) { console.log('⏭  SKIP: няма Playwright на тази машина (npm i -D playwright). Бекендът пак е покрит от verify.cjs.'); process.exit(0); }

  // 1) seed demo в изолираната база
  try { fs.unlinkSync(DBFILE); } catch (_) {}
  const seed = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'seed-demo.cjs')], { env: ENV, encoding: 'utf8' });
  if (seed.status !== 0) { console.error('✗ seed-demo се провали:', seed.stderr || seed.stdout); process.exit(1); }

  // 2) вдигни сървъра
  const srv = spawn(process.execPath, [path.join(ROOT, 'src', 'server.cjs')], { env: ENV, stdio: 'ignore' });
  const stop = () => { try { srv.kill(); } catch (_) {} try { fs.unlinkSync(DBFILE); } catch (_) {} };
  const waitHealth = async () => { for (let i = 0; i < 40; i++) { try { const r = await fetch(BASE + '/api/health'); if (r.ok) return true; } catch (_) {} await new Promise(r => setTimeout(r, 250)); } return false; };
  if (!await waitHealth()) { console.error('✗ сървърът не тръгна на ' + BASE); stop(); process.exit(1); }

  const results = [];
  const ok = (name, cond, extra) => results.push({ name, pass: !!cond, extra: cond ? '' : (extra || '') });
  let browser;
  try {
    try { browser = await pw.chromium.launch({ headless: true, channel: 'chrome' }); }
    catch (_) { browser = await pw.chromium.launch({ headless: true }); } // пада на вградения chromium

    const page = async () => { const c = await browser.newContext({ viewport: { width: 1000, height: 700 } }); await c.addInitScript(() => { try { localStorage.setItem('pd_lang', 'bg'); } catch (e) {} }); const errs = []; const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return { c, p, errs }; };
    const txt = async (p, sel) => (await p.locator(sel).first().textContent().catch(() => '')) || '';

    const ROLES = [
      { file: 'owner.html', role: 'owner', label: 'собственик', selfreg: true, login: ['owner@pupikes.local', 'demo123'] },
      { file: 'tech.html', role: 'tech', label: 'майстор', selfreg: true, login: ['majstor@pupikes.local', 'demo123'] },
      { file: 'mod.html', role: 'moderator', label: 'модератор', selfreg: false, login: ['mod@pupikes.local', 'demo123'] },
      { file: 'admin.html', role: 'admin', label: 'админ', selfreg: false, login: ['admin@pupikes.local', 'bgmasters'] },
      { file: 'center.html', role: 'center', label: 'център', selfreg: false, login: ['center@pupikes.local', 'bgmasters'] },
    ];

    for (const r of ROLES) {
      // (а) входът зарежда без JS грешки + регистрация има само за owner/tech
      { const { c, p, errs } = await page();
        await p.goto(BASE + '/' + r.file, { waitUntil: 'networkidle' }); await p.waitForTimeout(250);
        const reg = await p.getByRole('button', { name: 'Регистрация', exact: false }).count();
        ok(r.file + ' зарежда без грешки', errs.length === 0, errs.join('|'));
        ok(r.file + ' регистрация ' + (r.selfreg ? 'ИМА' : 'НЯМА'), r.selfreg ? reg > 0 : reg === 0);
        await c.close(); }
      // (б) заключване на ролята: чужд (център/собственик) акаунт се отказва
      { const { c, p } = await page();
        const foreign = r.role === 'center' ? ['owner@pupikes.local', 'demo123'] : ['center@pupikes.local', 'bgmasters'];
        await p.goto(BASE + '/' + r.file, { waitUntil: 'networkidle' }); await p.waitForTimeout(200);
        await p.fill('#email', foreign[0]); await p.fill('#password', foreign[1]); await p.click('#go'); await p.waitForTimeout(500);
        const err = await txt(p, '#err'); const stillAuth = await p.locator('.auth').count();
        ok(r.file + ' отказва чужда роля', /не е за приложението/i.test(err) && stillAuth > 0, err);
        await c.close(); }
      // (в) правилната роля влиза и рендерира своето приложение
      { const { c, p, errs } = await page();
        await p.goto(BASE + '/' + r.file, { waitUntil: 'networkidle' }); await p.waitForTimeout(200);
        await p.fill('#email', r.login[0]); await p.fill('#password', r.login[1]); await p.click('#go'); await p.waitForTimeout(900);
        const nav = await p.locator('nav.tabs').count(); const roletag = (await txt(p, '.roletag')).toLowerCase();
        ok(r.file + ' правилният акаунт влиза (nav)', nav > 0);
        ok(r.file + ' роля-таг = ' + r.label, roletag.includes(r.label), roletag);
        ok(r.file + ' вход без JS грешки', errs.length === 0, errs.join('|'));
        await c.close(); }
    }

    // лончърът (index) — 5 връзки към 5-те приложения
    { const { c, p, errs } = await page();
      await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(250);
      const n = await p.locator('.applist a').count();
      ok('лончър: 5 връзки', n === 5, String(n));
      ok('лончър без JS грешки', errs.length === 0, errs.join('|'));
      await c.close(); }

    await browser.close();
  } catch (e) { try { if (browser) await browser.close(); } catch (_) {} stop(); console.error('✗ ТЕСТ ГРЕШКА:', e.message); process.exit(1); }

  stop();
  const passed = results.filter(r => r.pass).length;
  for (const r of results) console.log((r.pass ? '  ✓ ' : '  ✗ ') + r.name + (r.extra ? '  :: ' + r.extra : ''));
  console.log('\n== УЕБ/приложения: ' + passed + ' успешни, ' + (results.length - passed) + ' провалени ==');
  process.exit(results.every(r => r.pass) ? 0 : 1);
})();
