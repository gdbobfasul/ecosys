// временно (само четене): печата горните редове от списъка с версии на отворения RuStore таб
const path = require('path'); let PW;
for (const c of ['desktop/selflearning-friend/node_modules/playwright', 'node_modules/playwright']) { try { PW = require(path.resolve(c)); break; } catch (_) {} }
(async () => {
  const b = await PW.chromium.connectOverCDP('http://127.0.0.1:9222');
  let pg = null; for (const c of b.contexts()) for (const p of c.pages()) if (/console\.rustore\.ru/.test(p.url())) pg = p;
  await pg.waitForTimeout(3000);
  const txt = await pg.evaluate(() => { const m = document.querySelector('main') || document.body; return m.innerText || ''; });
  const rows = [...txt.matchAll(/(\d\.\d{4})\((\d+)\)\s+(\d\d\.\d\d\.\d{4})\s+([A-Za-z][A-Za-z ]+)/g)].slice(0, 3).map((m) => m[1] + ' ' + m[3] + ' ' + m[4].trim());
  console.log(rows.length ? rows.join(' | ') : 'няма редове: ' + txt.slice(0, 200).replace(/\s+/g, ' '));
  process.exit(0);
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
