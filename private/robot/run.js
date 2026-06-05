// Version: 1.0173
// ──────────────────────────────────────────────────────────────────────────
// KCY ТЕСТ РОБОT — Фаза 1 (MVP)
//
// Обхожда критичните пътища на всяко приложение с Playwright, лови клиентски
// грешки (console/изключения/мрежа/HTTP 4xx-5xx), пинга health endpoint-ите,
// и корелира със сървърния лог (/last-errors-bundle). Пише репорт + екранни
// снимки при грешка.
//
// Употреба:
//   node run.js                      # цел: prod, критични пътища (read-only)
//   node run.js --target vm          # срещу VM (самоподписан TLS се игнорира)
//   node run.js --all                # обходи ВСИЧКИ публични страници от tree.json
//   node run.js --include-admin      # включи и админ страниците (изискват достъп)
//   node run.js --headed             # с видим браузър
//   node run.js --app portals        # само едно приложение
//
// Безопасност: prod = само ЧЕТЕНЕ (без форми/писане). Fuzz/random идва в по-късна
// фаза и САМО срещу VM.
// ──────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const baseScenarios = require('./scenarios');
const { attachMonitor } = require('./lib/monitor');
const { fetchBundle, scanBundle } = require('./lib/server-log');
const { writeReport, stamp } = require('./lib/report');

// ── аргументи ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const targetName = val('--target', cfg.defaultTarget);
const target = cfg.TARGETS[targetName];
if (!target) { console.error(`Непозната цел: ${targetName}. Налични: ${Object.keys(cfg.TARGETS).join(', ')}`); process.exit(2); }
const onlyApp = val('--app', null);
const headed = has('--headed');

// ── списък сценарии ──────────────────────────────────────────────────────────
function scenariosFromTree(includeAdmin) {
  let tree;
  try { tree = JSON.parse(fs.readFileSync(cfg.treeJson, 'utf8')); }
  catch (e) { console.error(`Не мога да чета tree.json (${cfg.treeJson}). Пусни: node tree-gen.js`); return null; }
  const out = [];
  for (const g of tree.groups) {
    const paths = g.pages
      .filter((p) => p.type === 'page' || (includeAdmin && p.type === 'admin'))
      .map((p) => p.url);
    if (paths.length) out.push({ app: g.app, name: `${g.label} (от дървото)`, paths });
  }
  return out;
}

let scenarios = has('--all') ? scenariosFromTree(has('--include-admin')) : baseScenarios.slice();
if (!scenarios) process.exit(2);
if (onlyApp) scenarios = scenarios.filter((s) => s.app === onlyApp);
if (!scenarios.length) { console.error(`Няма сценарии за app=${onlyApp}`); process.exit(2); }

// ── главна логика ────────────────────────────────────────────────────────────
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    console.error('\n✗ Липсва Playwright. Инсталирай в private/robot/:');
    console.error('   npm install');
    console.error('   npx playwright install chromium\n');
    process.exit(2);
  }

  const startedAt = new Date();
  const runId = stamp(startedAt);
  const reportDir = path.join(cfg.reportsDir, runId);
  const shotsDir = path.join(reportDir, 'screenshots');
  fs.mkdirSync(shotsDir, { recursive: true });

  console.log(`\n🤖 KCY робот — цел: ${targetName} (${target.base})`);
  console.log(`   сценарии: ${scenarios.length}${onlyApp ? ` (само ${onlyApp})` : ''}  ·  режим: ${has('--all') ? 'пълно обхождане' : 'критични пътища'}\n`);

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ ignoreHTTPSErrors: target.ignoreHTTPSErrors });
  context.setDefaultTimeout(cfg.navTimeoutMs);

  const findings = [];
  let urlsChecked = 0;

  for (const sc of scenarios) {
    const page = await context.newPage();
    const ctx = { app: sc.app, scenario: sc.name, targetUrl: null };
    const scFindings = attachMonitor(page, () => ctx);
    let scHadError = false;

    for (const p of sc.paths) {
      const url = target.base + p;
      ctx.targetUrl = url;
      urlsChecked++;
      process.stdout.write(`   → ${p} ... `);
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.navTimeoutMs });
        const status = resp ? resp.status() : 0;
        if (status >= 400) {
          scFindings.push({ ts: new Date().toISOString(), ...ctx, severity: status >= 500 ? 'error' : 'warn', kind: 'http-main', status, detail: `главният документ върна ${status}` });
        }
        await page.waitForTimeout(cfg.settleMs); // изчакай да изскочат console грешки
        // лека проверка за съдържание
        const title = await page.title().catch(() => '');
        const bodyLen = await page.evaluate(() => (document.body ? document.body.innerText.length : 0)).catch(() => 0);
        if (status < 400 && bodyLen < 5 && !title) {
          scFindings.push({ ts: new Date().toISOString(), ...ctx, severity: 'warn', kind: 'empty', detail: 'страницата изглежда празна (без заглавие/съдържание)' });
        }
        console.log(status || 'ok');
      } catch (e) {
        scFindings.push({ ts: new Date().toISOString(), ...ctx, severity: 'error', kind: 'nav', detail: e.message.split('\n')[0].slice(0, 200) });
        console.log('✗ ' + e.message.split('\n')[0].slice(0, 60));
      }
      // екранна снимка при грешка по този адрес
      const hasErrNow = scFindings.some((f) => f.targetUrl === url && f.severity === 'error');
      if (hasErrNow) {
        scHadError = true;
        const safe = p.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root';
        try { await page.screenshot({ path: path.join(shotsDir, `${sc.app}-${safe}.png`), fullPage: false }); } catch (_) {}
      }
    }

    // health endpoint (GET, read-only)
    if (sc.health) {
      try {
        const r = await context.request.get(target.base + sc.health, { timeout: cfg.navTimeoutMs });
        if (!r.ok()) scFindings.push({ ts: new Date().toISOString(), app: sc.app, scenario: sc.name, targetUrl: target.base + sc.health, severity: 'error', kind: 'health', status: r.status(), detail: `health не е OK (${r.status()})` });
        else console.log(`   ♥ ${sc.health} → ${r.status()}`);
      } catch (e) {
        scFindings.push({ ts: new Date().toISOString(), app: sc.app, scenario: sc.name, targetUrl: target.base + sc.health, severity: 'error', kind: 'health', detail: e.message.slice(0, 150) });
      }
    }

    findings.push(...scFindings);
    await page.close();
  }

  await context.close();
  await browser.close();

  // ── корелация със сървърния лог ───────────────────────────────────────────
  const bundle = await fetchBundle(target.base, cfg.bundlePath);
  const serverLog = bundle.ok
    ? { ok: true, status: bundle.status, hits: scanBundle(bundle.text) }
    : { ok: false, status: bundle.status, error: bundle.error };
  if (bundle.ok) fs.writeFileSync(path.join(reportDir, 'last-errors-bundle.txt'), bundle.text, 'utf8');

  // ── репорт ────────────────────────────────────────────────────────────────
  const counts = {
    error: findings.filter((f) => f.severity === 'error').length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
  const data = {
    target: targetName, base: target.base, runId,
    startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(),
    scenarios: scenarios.length, urlsChecked, counts, findings, serverLog,
  };
  writeReport(reportDir, data);

  // ── обобщение в конзолата ─────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log(`Резултат: 🔴 ${counts.error} грешки  ·  🟡 ${counts.warn} предупреждения  ·  ℹ️ ${counts.info} очаквани 401/403  ·  ${urlsChecked} адреса`);
  for (const f of findings.filter((x) => x.severity === 'error')) {
    console.log(`  🔴 [${f.app}] ${f.kind} ${f.status || ''} ${f.targetUrl || ''} — ${(f.detail || f.resourceUrl || '').slice(0, 90)}`);
  }
  if (serverLog.ok && serverLog.hits.length) console.log(`  📋 сървърен лог: ${serverLog.hits.length} подозрителни реда (виж репорта)`);
  console.log(`\n📁 Репорт: ${reportDir}`);
  console.log('─'.repeat(60) + '\n');

  process.exitCode = counts.error > 0 ? 1 : 0;
})().catch((e) => { console.error('Робот гръмна:', e); process.exit(3); });
