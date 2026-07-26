// scriptcheck.js — дневна проверка: фейлнала ли е някоя точка от старт менюто?
// Чете private/bug-bot/start-menu-logs/index.jsonl (реди се от deploy-scripts/lib/run-logger.sh:
// по един json ред на изпълнение {ts,opt,title,exit,errors,log}). Отчита провалите (изход≠0 ИЛИ
// грешки>0), маркира НОВИТЕ след последната проверка и обновява маркера — така bug-bot проверява
// „поне веднъж на ден". Пуска се самостоятелно (`node lib/scriptcheck.js`) или се вика от run.js.
'use strict';
const fs = require('fs');
const path = require('path');

const LOGDIR = path.join(__dirname, '..', 'start-menu-logs');
const INDEX = path.join(LOGDIR, 'index.jsonl');
const MARKER = path.join(LOGDIR, '.last-scriptcheck');

function loadRuns() {
  if (!fs.existsSync(INDEX)) return [];
  const out = [];
  for (const line of fs.readFileSync(INDEX, 'utf8').split('\n')) {
    const s = line.trim(); if (!s) continue;
    try { out.push(JSON.parse(s)); } catch (_) { /* пропусни повреден ред */ }
  }
  return out;
}
const parseTs = (t) => { const d = new Date(String(t || '').replace(' ', 'T')); return isNaN(d) ? 0 : d.getTime(); };
const isFail = (r) => (Number(r.exit) !== 0) || (Number(r.errors) > 0);

// Връща структурирания резултат (за run.js) + по избор печата на конзолата.
function runScriptCheck({ log, sinceDays = 7, quiet = false, updateMarker = true } = {}) {
  const say = (m) => { if (!quiet) (log ? log(m) : console.log(m)); };
  const runs = loadRuns();
  const now = Date.now();
  const findings = [];
  if (!runs.length) { say('   няма логнати изпълнения на старт менюто (още)'); return { findings, total: 0, fails: 0 }; }

  let lastCheck = 0;
  try { lastCheck = parseTs(fs.readFileSync(MARKER, 'utf8').trim()); } catch (_) {}

  const windowMs = sinceDays * 864e5;
  const recent = runs.filter((r) => now - parseTs(r.ts) <= windowMs);
  const fails = recent.filter(isFail);
  const fresh = fails.filter((r) => parseTs(r.ts) > lastCheck);

  say(`   изпълнения (${sinceDays} дни): ${recent.length} · провалени: ${fails.length}${fresh.length ? ` · НОВИ след последната проверка: ${fresh.length}` : ''}`);
  for (const r of fails) {
    const tag = parseTs(r.ts) > lastCheck ? 'НОВО ' : '';
    const line = `${tag}точка ${r.opt} „${r.title}" · ${r.ts} · изход=${r.exit} · грешки=${r.errors} · ${r.log}`;
    say(`   ${isFail(r) ? '✗' : '·'} ${line}`);
    findings.push({ ts: r.ts, severity: fresh.includes(r) ? 'warn' : 'info', kind: 'script-fail', app: `меню-точка-${r.opt}`, detail: line, logFile: r.log });
  }
  if (!fails.length) say('   ✓ няма фейлнали точки от старт менюто в този период');

  if (updateMarker) { try { fs.writeFileSync(MARKER, new Date().toISOString()); } catch (_) {} }
  return { findings, total: recent.length, fails: fails.length, fresh: fresh.length };
}

// Трябва ли да се пусне (изтекъл ли е денят)? За авто-повикване от run.js.
function isDueForCheck() {
  try { return (Date.now() - parseTs(fs.readFileSync(MARKER, 'utf8').trim())) > 864e5; } catch (_) { return true; }
}

module.exports = { runScriptCheck, isDueForCheck };

// Самостоятелно пускане
if (require.main === module) {
  const args = process.argv.slice(2);
  const days = (() => { const i = args.indexOf('--since'); return i >= 0 ? parseInt(args[i + 1], 10) || 7 : 7; })();
  console.log('━━━ Проверка: фейлнали точки от старт менюто ━━━');
  const r = runScriptCheck({ sinceDays: days, updateMarker: !args.includes('--no-ack') });
  console.log(`\n→ общо ${r.total} изпълнения · ${r.fails} провалени`);
  process.exit(r.fails > 0 ? 2 : 0);
}
