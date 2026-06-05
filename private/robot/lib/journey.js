// Version: 1.0173
// ──────────────────────────────────────────────────────────────────────────
// ДВИГАТЕЛ ЗА „РАБОТНИ СЦЕНАРИИ" (journeys) — робот като ЧОВЕК.
//
// Всяко приложение има файл в journeys/<app>.js, който описва сценарии (регистрация,
// вход, създаване, чат, админ одобри/откажи…) като поредица СТЪПКИ. Тук ги изпълняваме.
//
// Видове стъпки (обект с един от тези ключове):
//   { note }                         — само лог ред
//   { goto }                         — навигирай до base+път (хваща 4xx/5xx)
//   { fill, value }                  — попълни поле (value: низ или ctx=>низ)
//   { select, value }                — избери опция
//   { check }                        — чекни checkbox
//   { click }                        — натисни
//   { waitFor } / { wait: ms }       — изчакай селектор / милисекунди
//   { expect }                       — селекторът да е видим (иначе грешка)
//   { expectUrl }                    — текущият URL да съдържа низа
//   { api:{method,path,json}, expectStatus, saveAs, extract } — пряка API заявка
//   { run: async (page, ctx, h) }    — за по-сложни стъпки
//
// Стъпка, която гръмне → сценарият спира (следващите се „skip"); записва се находка.
// ──────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

// Прочита глобалния .env (за админ/мод данни) — пробва ROBOT_ENV_FILE, после стандартните пътища.
function loadEnv() {
  const candidates = [
    process.env.ROBOT_ENV_FILE,
    path.join(__dirname, '..', '..', 'configs', '.env'),       // repo / сървър: private/configs/.env
    '/var/www/kcy-ecosystem/private/configs/.env',
  ].filter(Boolean);
  for (const f of candidates) {
    try {
      const txt = fs.readFileSync(f, 'utf8');
      const env = {};
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
      return env;
    } catch (_) { /* пробвай следващия */ }
  }
  return {};
}

const resolve = (v, ctx) => (typeof v === 'function' ? v(ctx) : v);

function stepLabel(step) {
  const k = Object.keys(step)[0];
  const v = step[k];
  if (k === 'note') return v;
  if (k === 'api') return `api ${v.method || 'GET'} ${v.path}`;
  if (k === 'run') return step.label || 'run';
  return `${k} ${typeof v === 'string' ? v : ''}`.trim();
}

async function runStep(step, page, ctx, base, navTimeout) {
  if ('note' in step) return;

  if ('goto' in step) {
    const url = base + resolve(step.goto, ctx);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
    const s = resp ? resp.status() : 0;
    if (s >= 400) throw new Error(`${resolve(step.goto, ctx)} върна ${s}`);
    return;
  }
  if ('fill' in step) return page.fill(step.fill, String(resolve(step.value, ctx)), { timeout: navTimeout });
  if ('select' in step) return page.selectOption(step.select, String(resolve(step.value, ctx)), { timeout: navTimeout });
  if ('check' in step) return page.check(step.check, { timeout: navTimeout });
  if ('click' in step) return page.click(step.click, { timeout: navTimeout });
  if ('waitFor' in step) return page.waitForSelector(resolve(step.waitFor, ctx), { timeout: navTimeout });
  if ('wait' in step) return page.waitForTimeout(step.wait);

  if ('expect' in step) {
    const ok = await page.isVisible(resolve(step.expect, ctx)).catch(() => false);
    if (!ok) throw new Error(`не виждам ${resolve(step.expect, ctx)}`);
    return;
  }
  if ('expectUrl' in step) {
    const want = resolve(step.expectUrl, ctx);
    if (!page.url().includes(want)) throw new Error(`URL ${page.url()} не съдържа ${want}`);
    return;
  }

  if ('api' in step) {
    const a = step.api;
    const url = base + resolve(a.path, ctx);
    const opts = { timeout: navTimeout };
    if (a.json !== undefined) opts.data = resolve(a.json, ctx);
    if (a.headers) opts.headers = resolve(a.headers, ctx);   // напр. Authorization: Bearer <токен>
    const method = (a.method || 'GET').toLowerCase();
    const res = await page.request[method](url, opts);
    const status = res.status();
    let body = null;
    try { body = await res.json(); } catch (_) { /* не-JSON */ }
    if (step.expectStatus && status !== step.expectStatus) {
      throw new Error(`${a.method || 'GET'} ${resolve(a.path, ctx)} → ${status} (чаках ${step.expectStatus})${body && body.error ? ' / ' + body.error : ''}`);
    }
    if (step.saveAs && step.extract) ctx[step.saveAs] = step.extract(body, ctx);
    return;
  }

  if ('run' in step) return step.run(page, ctx, { base });

  throw new Error('непознат вид стъпка: ' + Object.keys(step).join(','));
}

// Изпълнява всички сценарии на едно журито; връща резултати + пише находки в sink.
async function runJourney(journey, page, ctx, base, navTimeout, sink, log) {
  const out = [];
  for (const sc of journey.scenarios) {
    log(`  ▶ ${sc.name}`);
    const steps = [];
    let failed = false;
    for (const step of sc.steps) {
      const label = stepLabel(step);
      if (failed) { steps.push({ step: label, skipped: true }); continue; }
      try {
        await runStep(step, page, ctx, base, navTimeout);
        steps.push({ step: label, ok: true });
      } catch (e) {
        const msg = (e.message || String(e)).split('\n')[0].slice(0, 200);
        steps.push({ step: label, ok: false, error: msg });
        sink.push({ ts: new Date().toISOString(), severity: 'error', kind: 'journey', app: journey.app, scenario: sc.name, targetUrl: page.url(), detail: `${label}: ${msg}` });
        failed = true;
        log(`     ✗ ${label} — ${msg}`);
      }
    }
    if (!failed) log(`     ✓ ${sc.name}`);
    out.push({ name: sc.name, ok: !failed, steps });
  }
  return out;
}

module.exports = { runJourney, loadEnv };
