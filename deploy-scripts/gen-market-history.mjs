// Version: 1.0021
// gen-market-history.mjs — ВГРАДЕНА ИСТОРИЯ на цените за Market Pulse (Huawei 3.1, 11.09.2026:
// тестерите са в Китай, където Binance/CoinGecko/Yahoo са блокирани → „3 yrs / 5 yrs ago / By date"
// показваха „No data connection"). Скриптът се пуска ПРИ БИЛД (или ръчно, веднъж) от машина с
// пряк достъп и записва 5 години ДНЕВНИ ЗАТВАРЯНИЯ за всеки инструмент от списъка на апа
// (huawei/market-pulse/src/core/markets.js — 50 криптовалути + злато/метали/индекси/имоти):
//   public/reference/history/<символ>.json   — компактно: { t0, c:[затваряния], d?:[отмествания в дни] }
//   public/reference/history/index.json      — какво има, докога, откъде.
// Източници (по ред, всеки е резерва на предишния):
//   крипто  → Binance klines (interval=1d, на партиди по 1000) → CoinGecko market_chart days=365
//   други   → Yahoo Finance v8 chart (range=6y, interval=1d)
// Пише в ДВЕТЕ едиции (huawei + rustore), ако папката на апа съществува.
//   node deploy-scripts/gen-market-history.mjs            — всички инструменти
//   node deploy-scripts/gen-market-history.mjs BTC ETH    — само избрани (по символ/ид)
//   --years=5  --out=<папка>  (по подразбиране 5 г. + 100 дни резерв за прозореца „5 г. назад")
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const only = args.filter((x) => !x.startsWith('--')).map((x) => x.toUpperCase());
const YEARS = parseInt(opt('years', '5'), 10) || 5;
const MARGIN_DAYS = 100;                        // прозорецът „5 г. назад" е 60 дни ПРЕДИ точката → резерв
const DAY = 86400000;
const SINCE = Date.now() - (YEARS * 365 + MARGIN_DAYS) * DAY;
const OUT_DIRS = opt('out', '') ? [path.resolve(opt('out', ''))]
  : ['huawei', 'rustore'].map((s) => path.join(ROOT, s, 'market-pulse')).filter((d) => fs.existsSync(d)).map((d) => path.join(d, 'public', 'reference', 'history'));

const MARKETS_FILE = path.join(ROOT, 'huawei', 'market-pulse', 'src', 'core', 'markets.js');
const { MARKETS } = await import('file://' + MARKETS_FILE.replace(/\\/g, '/'));

function get(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (PupikesMarketPulse history builder)', accept: 'application/json' } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + d.slice(0, 80)));
        try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('лош JSON')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayOf = (ms) => Math.floor(ms / DAY);
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

// ── Източници ──────────────────────────────────────────────────────────────────────────────
async function binanceDaily(pair) {
  const out = []; let start = SINCE;
  for (let i = 0; i < 4; i++) {
    const arr = await get('https://api.binance.com/api/v3/klines?symbol=' + pair + '&interval=1d&limit=1000&startTime=' + start);
    if (!Array.isArray(arr) || !arr.length) break;
    for (const k of arr) { const t = k[0], c = parseFloat(k[4]); if (isFinite(t) && isFinite(c)) out.push({ t, close: c }); }
    if (arr.length < 1000) break;
    start = arr[arr.length - 1][6] + 1;
    await sleep(250);
  }
  return out;
}
async function geckoDaily(id) {
  // безплатният CoinGecko дава най-много 365 дни назад (days=max → 401) — резерва за монети без Binance двойка
  const d = await get('https://api.coingecko.com/api/v3/coins/' + id + '/market_chart?vs_currency=usd&days=365');
  return ((d && d.prices) || []).map((p) => ({ t: p[0], close: p[1] })).filter((p) => isFinite(p.close));
}
async function yahooDaily(sym) {
  const d = await get('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=' + (YEARS + 1) + 'y&interval=1d');
  const r0 = d && d.chart && d.chart.result && d.chart.result[0];
  const ts = (r0 && r0.timestamp) || [];
  const closes = (r0 && r0.indicators && r0.indicators.quote && r0.indicators.quote[0] && r0.indicators.quote[0].close) || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) if (isFinite(ts[i]) && closes[i] != null && isFinite(closes[i])) out.push({ t: ts[i] * 1000, close: closes[i] });
  return out;
}

// ── Компактен запис: по един запис на ДЕН (UTC), t0 + отмествания в дни ───────────────────
function compact(series) {
  const byDay = new Map();
  for (const p of series) { if (p.t >= SINCE - 30 * DAY) byDay.set(dayOf(p.t), p.close); }   // последната стойност за деня печели
  const days = [...byDay.keys()].sort((a, b) => a - b);
  if (!days.length) return null;
  const c = days.map((d) => Number(byDay.get(d).toPrecision(6)));
  const contiguous = days.every((d, i) => d === days[0] + i);
  const o = { t0: days[0] * DAY, c };
  if (!contiguous) o.d = days.map((d) => d - days[0]);
  return { obj: o, from: days[0] * DAY, to: days[days.length - 1] * DAY, points: c.length };
}

function fileNameFor(m, inst) { return m.id === 'crypto' ? inst.sym : inst.id; }

// ── Главен цикъл ───────────────────────────────────────────────────────────────────────────
const index = { generated: ymd(Date.now()), years: YEARS, items: [] };
let ok = 0, fail = 0;
for (const m of MARKETS) {
  for (const inst of m.instruments) {
    const name = fileNameFor(m, inst);
    if (only.length && !only.includes(name.toUpperCase()) && !only.includes(inst.id.toUpperCase())) continue;
    let series = [], src = '';
    const tries = m.id === 'crypto'
      ? [inst.binance && ['binance', () => binanceDaily(inst.binance)], ['coingecko', () => geckoDaily(inst.id)]].filter(Boolean)
      : [['yahoo', () => yahooDaily(inst.yahoo || inst.stooq)]];
    for (const [label, fn] of tries) {
      try {
        const got = await fn();
        if (got.length >= 30) {
          // източникът е ОСТАРЯЛ (напр. двойката е спряна от борсата, както TON→GRAM 06.2026):
          // пазим старата история, но ДОБАВЯМЕ и следващия източник за последните дни
          const stale = got[got.length - 1].t < Date.now() - 30 * DAY;
          series = series.concat(got); src = src ? src + '+' + label : label;
          if (!stale) break;
          process.stdout.write('   ' + name + ': ' + label + ' спира на ' + ymd(got[got.length - 1].t) + ' → допълвам от следващия източник\n');
        }
      } catch (e) { process.stdout.write('   ' + name + ': ' + label + ' ✗ ' + e.message.slice(0, 60) + '\n'); }
      await sleep(400);
    }
    const c = series.length ? compact(series) : null;
    if (!c) { fail++; console.log(' ✗ ' + name + ' — няма данни от нито един източник'); continue; }
    const rec = Object.assign({ sym: inst.sym, name: inst.name || inst.sym, market: m.id, src, from: ymd(c.from), to: ymd(c.to) }, c.obj);
    const json = JSON.stringify(rec);
    for (const dir of OUT_DIRS) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name + '.json'), json, 'utf8'); }
    index.items.push({ file: name, sym: inst.sym, market: m.id, src, from: ymd(c.from), to: ymd(c.to), points: c.points });
    ok++;
    console.log(' ✓ ' + name.padEnd(10) + src.padEnd(9) + ymd(c.from) + ' → ' + ymd(c.to) + '  ' + c.points + ' т.  ' + (json.length / 1024).toFixed(1) + ' KB');
    await sleep(m.id === 'crypto' && src === 'coingecko' ? 2500 : 300);   // CoinGecko: ~30 заявки/мин
  }
}
if (!only.length || index.items.length) {
  // при частично пускане (избрани символи) — обнови само техните редове в стария индекс
  for (const dir of OUT_DIRS) {
    let old = null;
    try { old = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); } catch (_) {}
    const merged = only.length && old && Array.isArray(old.items)
      ? { generated: index.generated, years: YEARS, items: old.items.filter((i) => !index.items.some((n) => n.file === i.file)).concat(index.items) }
      : index;
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(merged), 'utf8');
  }
}
console.log('\nГотово: ' + ok + ' инструмента записани, ' + fail + ' без данни → ' + OUT_DIRS.join(' | '));
process.exit(fail && !ok ? 1 : 0);
