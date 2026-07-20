// Version: 1.0173
// ──────────────────────────────────────────────────────────────────────────
// BugBot — Pupikes тест робот (Фаза 1 MVP)
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
const { writeReport, stamp, appendRobotLogs } = require('./lib/report');
const { extractLinksAndForms } = require('./lib/crawler');
const { makeRng, fuzzForms } = require('./lib/fuzz');
const { runJourney, loadEnv } = require('./lib/journey');
const { runSeed } = require('./lib/seed');
const filllog = require('../shared/debug-helper').create('filldata');

// Журита „като човек" — по едно на приложение (Фази 5+).
const JOURNEYS = {
  portals: require('./journeys/portals'),
  chat: require('./journeys/chat'),
  chatx: require('./journeys/chat-actions'),
  chatv: require('./journeys/chat-verify'),
  chatu: require('./journeys/chat-extra-user'),    // профил/търсене/запознанства/приятели/файлове
  chatadm: require('./journeys/chat-extra-admin'), // админ модерация (edit/ban/resolve/verify/override)
  eco3: require('./journeys/eco3'),
  eco3x: require('./journeys/eco3-extra'),          // конфиг/админ/плащане-guard/агенти/persistence
  hlb: require('./journeys/hlb'),
  hlbx: require('./journeys/hlb-actions'),          // харесвания/класация/доклади/изображения/бан
  wnb: require('./journeys/wnb'),
  wnbx: require('./journeys/wnb-actions'),          // потвърждения/доклади/резолюция/телефон/бан
  fbp: require('./journeys/fbp'),
  fbpx: require('./journeys/fbp-actions'),          // публична карта/wanted/услуги-части/коректност
  portalsx: require('./journeys/portals-extra'),    // плащания/модерация/админ триене/класация/услуги
  services: require('./journeys/services'),
  games: require('./journeys/games'),
  failover: require('./journeys/failover'),
  authenticator: require('./journeys/authenticator'), // ЛОКАЛНО: билд + собствен сървър (без прод)
};

// ── аргументи ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const populateMode = has('--populate');             // МАСОВ СИЙДЪР: стотици потребители + реални данни
const seedUsers = Number(val('--users', 100));      // брой персони (по подразбиране 100)
const actionsArg = val('--actions', 'all');         // chat,posts,images,portal | all
function parseActions(arg) {
  if (!arg || arg === 'all') return { chat: true, posts: true, images: true, portal: true };
  const s = new Set(arg.split(',').map((x) => x.trim()));
  return { chat: s.has('chat'), posts: s.has('posts'), images: s.has('images'), portal: s.has('portal') };
}
// Сийдърът пише МНОГО данни → по подразбиране срещу VM (тежко пълнене), освен ако
// --target е зададен изрично (потребителят избра „и двете чрез флаг --target").
const targetName = (populateMode && !has('--target')) ? 'vm' : val('--target', cfg.defaultTarget);
const target = cfg.TARGETS[targetName];
if (!target) { console.error(`Непозната цел: ${targetName}. Налични: ${Object.keys(cfg.TARGETS).join(', ')}`); process.exit(2); }
const onlyApp = val('--app', null);
const headed = has('--headed');
const crawlMode = has('--crawl');                 // Фаза 2: следва линковете (BFS)
const fuzzMode = has('--fuzz');                   // Фаза 3: попълва+изпраща форми (само VM)
const journeyArg = val('--journey', null);        // Фази 5+: работни сценарии по приложение (app|all)
const maxPages = Number(val('--max', 120));       // таван страници за crawl/fuzz
const maxDepth = Number(val('--depth', 3));       // дълбочина на crawl
const seed = Number(val('--seed', 0)) || (Date.now() & 0x7fffffff); // fuzz seed (възпроизводимост)

// Защита: fuzz е разрушителен → САМО срещу VM (target.allowFuzz).
if (fuzzMode && !target.allowFuzz) {
  console.error(`\n✗ Fuzz е позволен САМО срещу VM (--target vm). Целта „${targetName}" е защитена (само четене).\n`);
  process.exit(2);
}

// Валидация на --journey (app|all). Журитата СЪЗДАВАТ данни (регистрации/постове/модерация).
const journeyMode = !!journeyArg;
let selectedJourneys = [];
if (journeyMode) {
  if (journeyArg === 'all') selectedJourneys = Object.values(JOURNEYS);
  else if (JOURNEYS[journeyArg]) selectedJourneys = [JOURNEYS[journeyArg]];
  else { console.error(`Непознато журито: ${journeyArg}. Налични: ${Object.keys(JOURNEYS).join(', ')}, all`); process.exit(2); }
}

// ── списък сценарии ──────────────────────────────────────────────────────────
function scenariosFromTree(includeAdmin) {
  // Пробвай няколко места: ROBOT_TREE_JSON/cfg, после web root (tree-gen пише там на
  // сървъра), после repo public. Така работи и локално, и от prod без env промяна.
  const candidates = [cfg.treeJson, '/var/www/html/tree/tree.json', path.join(__dirname, '..', '..', 'public', 'tree', 'tree.json')];
  let tree = null;
  for (const f of candidates) {
    try { tree = JSON.parse(fs.readFileSync(f, 'utf8')); break; } catch (e) { /* пробвай следващия */ }
  }
  if (!tree) { console.error(`Не мога да чета tree.json (пробвах: ${candidates.join(', ')}). Пусни: node tree-gen.js`); return null; }
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
  filllog.info('robot старт');
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

  console.log(`\n🤖 Pupikes робот — цел: ${targetName} (${target.base})`);
  const modeLabel = populateMode ? `МАСОВ СИЙДЪР (${seedUsers} потребителя)` : journeyMode ? `работни сценарии: ${journeyArg}` : fuzzMode ? `fuzz (само VM, seed ${seed})` : crawlMode ? `crawler (BFS, макс ${maxPages}, дълбочина ${maxDepth})` : has('--all') ? 'пълно обхождане (дървото)' : 'критични пътища';
  console.log(`   ${populateMode ? `сийд: ${seedUsers} потребителя` : journeyMode ? `журита: ${selectedJourneys.length}` : crawlMode ? 'crawler' : `сценарии: ${scenarios.length}`}${onlyApp ? ` (само ${onlyApp})` : ''}  ·  режим: ${modeLabel}\n`);

  // Памет-безопасни флагове при пускане като root на сървъра (kcy-diag) —
  // ROBOT_NO_SANDBOX=1 ги включва: без sandbox (root), пести RAM на малък сървър.
  const launchArgs = process.env.ROBOT_NO_SANDBOX
    ? ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--disable-setuid-sandbox']
    : [];
  // Резерва (както в gen-screens): ако сваленият Playwright браузър липсва (дев машина),
  // пробвай системния Chrome, после Edge — иначе ясна инструкция за install.
  let browser = null;
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try { browser = await chromium.launch({ headless: !headed, args: launchArgs, channel }); break; }
    catch (e) { if (channel === 'msedge') throw e; }
  }
  const context = await browser.newContext({ ignoreHTTPSErrors: target.ignoreHTTPSErrors });
  context.setDefaultTimeout(cfg.navTimeoutMs);

  const findings = [];
  const forms = [];
  let fuzzData = null;
  let journeysData = null;
  let seedSummary = null;
  let urlsChecked = 0;

  // Посещава един адрес: навигира, проверява статус + съдържание, прави снимка при грешка.
  // Връща HTTP статуса (crawler-ът решава дали да вади линкове). Пише находки в `sink`.
  async function visit(page, url, ctx, sink, label) {
    ctx.targetUrl = url;
    urlsChecked++;
    const short = url.replace(target.base, '') || '/';
    process.stdout.write(`   → ${short} ... `);
    let status = 0;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.navTimeoutMs });
      status = resp ? resp.status() : 0;
      if (status >= 400) sink.push({ ts: new Date().toISOString(), ...ctx, severity: status >= 500 ? 'error' : 'warn', kind: 'http-main', status, detail: `главният документ върна ${status}` });
      await page.waitForTimeout(cfg.settleMs); // изчакай да изскочат console грешки
      const title = await page.title().catch(() => '');
      const bodyLen = await page.evaluate(() => (document.body ? document.body.innerText.length : 0)).catch(() => 0);
      if (status < 400 && bodyLen < 5 && !title) sink.push({ ts: new Date().toISOString(), ...ctx, severity: 'warn', kind: 'empty', detail: 'страницата изглежда празна (без заглавие/съдържание)' });
      console.log(status || 'ok');
    } catch (e) {
      sink.push({ ts: new Date().toISOString(), ...ctx, severity: 'error', kind: 'nav', detail: e.message.split('\n')[0].slice(0, 200) });
      console.log('✗ ' + e.message.split('\n')[0].slice(0, 60));
    }
    if (sink.some((f) => f.targetUrl === url && f.severity === 'error')) {
      const safe = (label || short).replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root';
      try { await page.screenshot({ path: path.join(shotsDir, `${ctx.app || 'p'}-${safe}.png`), fullPage: false }); } catch (_) {}
    }
    return status;
  }

  if (populateMode) {
    // ── МАСОВ СИЙДЪР: стотици потребители + реални данни (чат/постове/къщи/картинки/портал) ──
    const env = loadEnv();
    const actions = parseActions(actionsArg);
    const rng = makeRng(seed);
    console.log(`   👥 действия: ${Object.keys(actions).filter((k) => actions[k]).join(', ')}  ·  seed ${seed} (повторение: --populate --seed ${seed})\n`);
    try {
      seedSummary = await runSeed({ request: context.request, base: target.base, users: seedUsers, actions, env, rng, log: (m) => console.log(m) });
    } catch (e) {
      console.error('   ✗ Сийдърът гръмна:', (e.message || e));
      seedSummary = { errors: -1, fatal: (e.message || String(e)).slice(0, 200) };
    }
  } else if (journeyMode) {
    // ── Фази 5+: работни сценарии „като човек" по приложение ──
    const env = loadEnv();
    const runToken = startedAt.getTime().toString(36);
    journeysData = [];
    for (const jr of selectedJourneys) {
      await context.clearCookies().catch(() => {}); // чисто между приложенията
      const ctx = { runToken, runNum: startedAt.getTime() % 100000000 };
      // setup може да е async (журита с ЛОКАЛЕН сървър — напр. authenticator — вдигат
      // билд + мини сървър тук). Синхронните журита не се влияят от await.
      if (jr.setup) await jr.setup(ctx, env);
      console.log(`\n   ▣ ${jr.label}`);
      // Локално журито (jr.local) тества СОБСТВЕН сървър (ctx.localBase), не целта prod/vm.
      const jrBase = (jr.local && ctx.localBase) ? ctx.localBase : target.base;
      const page = await context.newPage();
      const ctxLabel = { app: jr.app, scenario: jr.label, targetUrl: null };
      const sink = attachMonitor(page, () => ctxLabel);
      const results = await runJourney(jr, page, ctx, jrBase, cfg.navTimeoutMs, sink, (m) => console.log(m));
      findings.push(...sink);
      await page.close();
      if (jr.teardown) { try { await jr.teardown(ctx); } catch (e) { /* чистенето не проваля рана */ } }
      journeysData.push({ app: jr.app, label: jr.label, scenarios: results });
      urlsChecked += results.reduce((s, r) => s + r.steps.length, 0);
    }
  } else if (fuzzMode) {
    // ── Фаза 3: fuzz (само VM) — попълва и изпраща формите с гранични/зловредни стойности ──
    const rng = makeRng(seed);
    const fuzzLog = [];
    const seedScn = scenariosFromTree(has('--include-admin')) || [];
    const seeds = [...new Set(seedScn.flatMap((s) => s.paths))].map((p) => target.base + p).slice(0, maxPages);
    const page = await context.newPage();
    const ctx = { app: 'fuzz', scenario: 'Fuzz', targetUrl: null };
    const sink = attachMonitor(page, () => ctx);
    console.log(`   seed: ${seed}  (за повторение: --fuzz --seed ${seed})`);
    for (const url of seeds) {
      await visit(page, url, ctx, sink);
      let actions = [];
      try { actions = await fuzzForms(page, rng, cfg.navTimeoutMs); } catch (_) {}
      if (actions.length) fuzzLog.push({ url, actions });
    }
    findings.push(...sink);
    await page.close();
    fuzzData = { seed, pages: fuzzLog };
    console.log(`   (fuzz-нати ${fuzzLog.length} страници с форми)`);
  } else if (crawlMode) {
    // ── Фаза 2: crawler — BFS от семената (дървото), следва откритите линкове ──
    const origin = new URL(target.base).origin;
    const seedScn = scenariosFromTree(has('--include-admin')) || [];
    const seeds = [...new Set(seedScn.flatMap((s) => s.paths))].map((p) => target.base + p);
    const visited = new Set();
    const queue = seeds.map((u) => ({ url: u, depth: 0 }));
    const page = await context.newPage();
    const ctx = { app: 'crawl', scenario: 'Crawler', targetUrl: null };
    const sink = attachMonitor(page, () => ctx);
    while (queue.length && visited.size < maxPages) {
      const { url, depth } = queue.shift();
      const clean = url.split('#')[0];
      if (visited.has(clean) || !clean.startsWith(origin)) continue;
      visited.add(clean);
      await visit(page, clean, ctx, sink);
      if (depth < maxDepth) {
        try {
          const { links, forms: pf } = await extractLinksAndForms(page, origin);
          for (const l of links) { const c = l.split('#')[0]; if (!visited.has(c)) queue.push({ url: c, depth: depth + 1 }); }
          for (const f of pf) forms.push({ page: clean, action: f.action, method: f.method, fields: f.fields });
        } catch (_) { /* страницата може да е навигирала — пропусни */ }
      }
    }
    findings.push(...sink);
    await page.close();
    console.log(`   (обходени ${visited.size} адреса · открити форми: ${forms.length})`);
  } else {
    for (const sc of scenarios) {
      const page = await context.newPage();
      const ctx = { app: sc.app, scenario: sc.name, targetUrl: null };
      const sink = attachMonitor(page, () => ctx);
      for (const p of sc.paths) await visit(page, target.base + p, ctx, sink, p);
      if (sc.health) {
        try {
          const r = await context.request.get(target.base + sc.health, { timeout: cfg.navTimeoutMs });
          if (!r.ok()) sink.push({ ts: new Date().toISOString(), app: sc.app, scenario: sc.name, targetUrl: target.base + sc.health, severity: 'error', kind: 'health', status: r.status(), detail: `health не е OK (${r.status()})` });
          else console.log(`   ♥ ${sc.health} → ${r.status()}`);
        } catch (e) {
          sink.push({ ts: new Date().toISOString(), app: sc.app, scenario: sc.name, targetUrl: target.base + sc.health, severity: 'error', kind: 'health', detail: e.message.slice(0, 150) });
        }
      }
      findings.push(...sink);
      await page.close();
    }
  }

  await context.close();
  await browser.close();

  // ── корелация със сървърния лог ───────────────────────────────────────────
  const bundle = await fetchBundle(target.base, cfg.bundlePath);
  const serverLog = bundle.ok
    ? { ok: true, status: bundle.status, hits: scanBundle(bundle.text) }
    : { ok: false, status: bundle.status, error: bundle.error };
  // Папката може да липсва (изтрита между старта и края — напр. „Трий всички" по време на
  // пускане, или почистване на /var/www/html). Пресъздаваме я и пишем БЕЗОПАСНО — репортът
  // не бива да се губи, нито роботът да гърми (exit 3) само заради опционален лог-файл.
  try { fs.mkdirSync(reportDir, { recursive: true }); } catch (e) { /* права/състезание — продължи */ }
  if (bundle.ok) { try { fs.writeFileSync(path.join(reportDir, 'last-errors-bundle.txt'), bundle.text, 'utf8'); } catch (e) { /* не е критично */ } }

  // ── репорт ────────────────────────────────────────────────────────────────
  const counts = {
    error: findings.filter((f) => f.severity === 'error').length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
  const data = {
    target: targetName, base: target.base, runId,
    mode: populateMode ? 'populate' : journeyMode ? `journey:${journeyArg}` : fuzzMode ? 'fuzz' : crawlMode ? 'crawl' : has('--all') ? 'all' : 'critical',
    startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(),
    scenarios: scenarios.length, urlsChecked, counts, findings, serverLog,
    forms, fuzz: fuzzData, journeys: journeysData, seed: seedSummary,
  };
  writeReport(reportDir, data);
  appendRobotLogs(data, cfg.robotLogDir); // 9-те робот лога (фази 1-4 + 5 приложения)

  // ── обобщение в конзолата ─────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  if (seedSummary) {
    const s = seedSummary;
    console.log('👥 МАСОВ СИЙДЪР — създадени данни:');
    console.log(`   💬 чат: ${s.chatUsers||0} потр · ${s.friends||0} контакта · ${s.messages||0} съобщения · ${s.match||0} мач-критерии · ${s.chatImages||0} картинки`);
    console.log(`   🌍 WNB: ${s.wnbUsers||0} потр · ${s.wnbPosts||0} поста${s.wnbApproved!=null?` (${s.wnbApproved} одобрени)`:''}`);
    console.log(`   🏠 HLB: ${s.hlbUsers||0} потр · ${s.hlbHouses||0} къщи${s.hlbApproved!=null?` (${s.hlbApproved} одобрени)`:''} · ${s.hlbImages||0} мебелни снимки`);
    console.log(`   🛠️ портал: ${s.portalUsers||0} потр · ECO-3 достъп: ${s.eco3||0}`);
    console.log(`   ⚠️ пропуснати заявки (грешки): ${s.errors||0}${s.fatal?` · ФАТАЛНО: ${s.fatal}`:''}`);
  }
  console.log(`Резултат: 🔴 ${counts.error} грешки  ·  🟡 ${counts.warn} предупреждения  ·  ℹ️ ${counts.info} очаквани 401/403  ·  ${urlsChecked} адреса`);
  for (const f of findings.filter((x) => x.severity === 'error')) {
    console.log(`  🔴 [${f.app}] ${f.kind} ${f.status || ''} ${f.targetUrl || ''} — ${(f.detail || f.resourceUrl || '').slice(0, 90)}`);
  }
  if (serverLog.ok && serverLog.hits.length) console.log(`  📋 сървърен лог: ${serverLog.hits.length} подозрителни реда (виж репорта)`);
  console.log(`\n📁 Репорт: ${reportDir}`);
  console.log('─'.repeat(60) + '\n');

  process.exitCode = counts.error > 0 ? 1 : 0;
})().catch((e) => { filllog.error('robot:', e && e.message); console.error('Робот гръмна:', e); process.exit(3); });
