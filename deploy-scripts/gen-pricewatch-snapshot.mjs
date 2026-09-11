// Version: 1.0027
// gen-pricewatch-snapshot.mjs — ВГРАДЕН СНИМКОВ ПАКЕТ за Pupikes Toolkit Price Watch (Huawei 3.1, 11.09.2026:
// „Different modules such as Forex, World or Macro report no connection" — тестерите са в Китай, където
// Yahoo/Binance/CoinGecko не се отварят, а и нашият relay явно не стига). Образец: gen-market-history.mjs
// (Market Pulse 1.0021). Скриптът се пуска ПРИ БИЛД (или ръчно) от машина с пряк достъп и записва:
//   public/reference/pw-snapshot.json        — всичко, което табовете показват: котировки (акции, световни
//                                              индекси, суровини, макро, валути), фючърси, RSI, Fear & Greed
//                                              (+ 1 г. история), крипто индекси, топ 100 монети, тренд, цени
//                                              за наблюденията (крипто + валутни курсове спрямо USD).
//   public/reference/pw-history/<файл>.json  — ДНЕВНА история до 5 г. по символ за графиките:
//                                              { t0: ms на първия ден (UTC), c:[затваряния], d?:[отмествания в дни] }
// Апът ПЪРВО показва този пакет (с надпис „данни към <дата>"), а живите данни (пряко → relay) само го обновяват.
// Пише в ДВЕТЕ едиции (huawei + rustore), ако папката на апа съществува.
//   node deploy-scripts/gen-pricewatch-snapshot.mjs              — всичко
//   node deploy-scripts/gen-pricewatch-snapshot.mjs --no-history — само снимковия пакет (без историята)
//   --years=5  --out=<папка на апа>
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const NO_HIST = args.includes('--no-history');
const YEARS = parseInt(opt('years', '5'), 10) || 5;
const DAY = 86400000;
const SINCE = Date.now() - YEARS * 365 * DAY;
const APP_DIRS = opt('out', '') ? [path.resolve(opt('out', ''))]
  : ['huawei', 'rustore'].map((s) => path.join(ROOT, s, 'price-watch-bot')).filter((d) => fs.existsSync(d));

// Списъците са ЕДИН източник на истината — вземаме ги от самия ап.
const MK = await import('file://' + path.join(ROOT, 'huawei', 'price-watch-bot', 'src', 'core', 'markets.js').replace(/\\/g, '/'));
const CRYPTO = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', BNB: 'BNBUSDT', SOL: 'SOLUSDT', XRP: 'XRPUSDT', ADA: 'ADAUSDT', DOGE: 'DOGEUSDT' };   // = core/api.js CRYPTO
const FX = ['EUR', 'GBP', 'JPY', 'RUB', 'CNY', 'TRY', 'BGN', 'CHF', 'INR', 'BRL'];                                             // = core/api.js FX

function get(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (PupikesPriceWatch snapshot builder)', accept: 'application/json' } }, (res) => {
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
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const num = (x, p) => (x == null || !isFinite(x)) ? null : Number(Number(x).toPrecision(p || 6));
async function tryGet(label, url) {
  try { return await get(url); } catch (e) { console.log('   ✗ ' + label + ': ' + e.message.slice(0, 70)); return null; }
}
// Име на файла с историята (същото правило е в src/core/snapshot.js → histFile).
export const histFile = (sym) => String(sym).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Компактен запис: по една стойност на ДЕН (UTC).
function compact(series) {
  const byDay = new Map();
  for (const p of series) if (p.t >= SINCE && isFinite(p.close)) byDay.set(Math.floor(p.t / DAY), p.close);
  const days = [...byDay.keys()].sort((a, b) => a - b);
  if (days.length < 20) return null;
  const c = days.map((d) => num(byDay.get(d), 6));
  const o = { t0: days[0] * DAY, c };
  if (!days.every((d, i) => d === days[0] + i)) o.d = days.map((d) => d - days[0]);
  return o;
}
const HIST = {};   // файл → { sym, src, obj }
function keepHist(sym, src, series) {
  const o = compact(series); if (!o) return false;
  HIST[histFile(sym)] = { sym, src, obj: o }; return true;
}

const snap = { generated: new Date().toISOString(), date: ymd(Date.now()), quotes: {}, futures: [], rsi: [], fng: null, global: null, coins: [], trending: [], watch: { crypto: {}, fx: {} }, hist: [] };

// ── 1) Yahoo: акции, световни индекси, суровини, макро, валути (+ история 5 г.) ─────────────────
const yahooSyms = [];
for (const list of [MK.STOCKS, MK.WORLD, MK.COMMODITIES, MK.MACRO, MK.FOREX]) for (const s of list) if (!s.privateCo && !yahooSyms.includes(s.sym)) yahooSyms.push(s.sym);
console.log('Yahoo: ' + yahooSyms.length + ' символа');
for (const sym of yahooSyms) {
  const enc = encodeURIComponent(sym);
  const q = await tryGet(sym + ' котировка', 'https://query1.finance.yahoo.com/v8/finance/chart/' + enc + '?interval=1d&range=5d');
  const m = q && q.chart && q.chart.result && q.chart.result[0] && q.chart.result[0].meta;
  if (m && isFinite(m.regularMarketPrice)) {
    const price = m.regularMarketPrice, prev = m.chartPreviousClose || m.previousClose;
    snap.quotes[sym] = { price: num(price, 7), prev: num(prev, 7), changePct: prev ? num((price - prev) / prev * 100, 4) : null, currency: m.currency || 'USD', ts: (m.regularMarketTime || 0) * 1000 || Date.now() };
  }
  if (!NO_HIST) {
    const h = await tryGet(sym + ' история', 'https://query1.finance.yahoo.com/v8/finance/chart/' + enc + '?interval=1d&range=' + YEARS + 'y');
    const r0 = h && h.chart && h.chart.result && h.chart.result[0];
    const ts = (r0 && r0.timestamp) || [], cl = (r0 && r0.indicators && r0.indicators.quote && r0.indicators.quote[0] && r0.indicators.quote[0].close) || [];
    const series = []; for (let i = 0; i < ts.length; i++) if (cl[i] != null && isFinite(cl[i])) series.push({ t: ts[i] * 1000, close: cl[i] });
    keepHist(sym, 'yahoo', series);
  }
  console.log(' ' + (snap.quotes[sym] ? '✓' : '✗') + ' ' + sym.padEnd(10) + (snap.quotes[sym] ? String(snap.quotes[sym].price) : '') + (HIST[histFile(sym)] ? '  история ' + HIST[histFile(sym)].obj.c.length + ' д.' : ''));
  await sleep(250);
}

// ── 2) Binance фючърси (премия/фандинг, отворен интерес, лонг/шорт) + история от фючърсните свещи ──
console.log('Фючърси: ' + MK.FUT_COINS.length);
for (const sym of MK.FUT_COINS) {
  const pair = sym + 'USDT', base = 'https://fapi.binance.com';
  const prem = await tryGet(pair + ' premium', base + '/fapi/v1/premiumIndex?symbol=' + pair);
  if (!prem || prem.code || !isFinite(parseFloat(prem.markPrice))) { console.log(' ✗ ' + sym + ' няма фючърс'); continue; }
  const oi = await tryGet(pair + ' OI', base + '/fapi/v1/openInterest?symbol=' + pair);
  const ls = await tryGet(pair + ' L/S', base + '/futures/data/globalLongShortAccountRatio?symbol=' + pair + '&period=5m&limit=1');
  const mark = parseFloat(prem.markPrice);
  const oiQty = oi && oi.openInterest != null ? parseFloat(oi.openInterest) : null;
  snap.futures.push({ sym, mark: num(mark, 7), funding: prem.lastFundingRate != null ? num(parseFloat(prem.lastFundingRate) * 100, 4) : null, oiNotional: oiQty != null ? num(oiQty * mark, 5) : null, longShort: Array.isArray(ls) && ls[0] ? num(parseFloat(ls[0].longShortRatio), 4) : null });
  if (!NO_HIST) {
    const k = await tryGet(pair + ' свещи', base + '/fapi/v1/klines?symbol=' + pair + '&interval=1d&limit=1500');
    if (Array.isArray(k)) keepHist('F:' + sym, 'binance-futures', k.map((r) => ({ t: r[0], close: parseFloat(r[4]) })));
  }
  console.log(' ✓ ' + sym.padEnd(6) + mark);
  await sleep(200);
}

// ── 3) RSI(14) по монети и таймфреймове (Binance spot свещи) ───────────────────────────────────
for (const c of MK.RSI_COINS) {
  const cells = [];
  for (const tf of MK.RSI_TF) {
    const rows = await tryGet(c.pair + ' ' + tf.key, 'https://api.binance.com/api/v3/klines?symbol=' + c.pair + '&interval=' + tf.interval + '&limit=' + tf.limit);
    const closes = Array.isArray(rows) ? rows.map((r) => parseFloat(r[4])).filter((x) => isFinite(x)) : [];
    const v = MK.computeRSI(closes, 14);
    cells.push({ tf: tf.key, v: v == null ? null : num(v, 4) });
    await sleep(150);
  }
  snap.rsi.push({ sym: c.sym, cells });
  console.log(' ✓ RSI ' + c.sym + ' ' + cells.map((x) => x.tf + '=' + (x.v == null ? '—' : x.v.toFixed(1))).join(' '));
}

// ── 4) Fear & Greed (текущо + 1 г. история) ───────────────────────────────────────────────────
const fng = await tryGet('fear&greed', 'https://api.alternative.me/fng/?limit=365');
if (fng && Array.isArray(fng.data) && fng.data[0]) {
  const it = fng.data[0];
  snap.fng = { value: parseInt(it.value, 10), label: it.value_classification, ts: parseInt(it.timestamp, 10) * 1000,
    hist: fng.data.map((x) => [parseInt(x.timestamp, 10) * 1000, parseInt(x.value, 10)]).filter((x) => isFinite(x[0]) && isFinite(x[1])).reverse() };
  console.log(' ✓ Fear & Greed ' + snap.fng.value + ' (' + snap.fng.label + '), ' + snap.fng.hist.length + ' дни');
}

// ── 5) CoinGecko: глобални индекси, топ 100 монети (1ч/24ч/7д), тренд ─────────────────────────
const g = await tryGet('coingecko global', 'https://api.coingecko.com/api/v3/global');
const gd = g && g.data;
if (gd) {
  snap.global = { totalMcap: num(gd.total_market_cap && gd.total_market_cap.usd, 6), totalVol: num(gd.total_volume && gd.total_volume.usd, 6), mcapChg24h: num(gd.market_cap_change_percentage_24h_usd, 4),
    btcDom: num(gd.market_cap_percentage && gd.market_cap_percentage.btc, 4), ethDom: num(gd.market_cap_percentage && gd.market_cap_percentage.eth, 4), activeCoins: gd.active_cryptocurrencies, markets: gd.markets };
  console.log(' ✓ глобални индекси');
}
await sleep(1500);
const coins = await tryGet('coingecko markets', 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=1h,24h,7d&sparkline=false');
if (Array.isArray(coins)) {
  snap.coins = coins.map((c) => ({ id: c.id, symbol: c.symbol, name: c.name, current_price: num(c.current_price, 7), market_cap: num(c.market_cap, 6), total_volume: num(c.total_volume, 6),
    price_change_percentage_24h: num(c.price_change_percentage_24h, 4), price_change_percentage_1h_in_currency: num(c.price_change_percentage_1h_in_currency, 4),
    price_change_percentage_24h_in_currency: num(c.price_change_percentage_24h_in_currency, 4), price_change_percentage_7d_in_currency: num(c.price_change_percentage_7d_in_currency, 4) }));
  console.log(' ✓ топ ' + snap.coins.length + ' монети');
}
await sleep(1500);
const tr = await tryGet('coingecko trending', 'https://api.coingecko.com/api/v3/search/trending');
if (tr && Array.isArray(tr.coins)) {
  snap.trending = tr.coins.map((c) => c.item).filter(Boolean).map((it) => ({ name: it.name, sym: (it.symbol || '').toUpperCase(), rank: it.market_cap_rank || null, price: num(it.data && it.data.price, 6) }));
  console.log(' ✓ тренд ' + snap.trending.length);
}

// ── 6) Цени за наблюденията (екран „Наблюдение") ─────────────────────────────────────────────
for (const [sym, pair] of Object.entries(CRYPTO)) {
  const d = await tryGet(pair + ' ticker', 'https://api.binance.com/api/v3/ticker/price?symbol=' + pair);
  if (d && isFinite(parseFloat(d.price))) snap.watch.crypto[sym] = num(parseFloat(d.price), 7);
  if (!NO_HIST && !HIST[histFile('F:' + sym)]) {
    const k = await tryGet(pair + ' дневни', 'https://api.binance.com/api/v3/klines?symbol=' + pair + '&interval=1d&limit=1000');
    if (Array.isArray(k)) keepHist('F:' + sym, 'binance', k.map((r) => ({ t: r[0], close: parseFloat(r[4]) })));
  }
}
const er = await tryGet('open.er-api', 'https://open.er-api.com/v6/latest/USD');
if (er && er.rates) for (const q of FX) if (isFinite(er.rates[q])) snap.watch.fx[q] = num(er.rates[q], 7);
console.log(' ✓ наблюдения: ' + Object.keys(snap.watch.crypto).length + ' крипто, ' + Object.keys(snap.watch.fx).length + ' валути');

// ── Запис ──────────────────────────────────────────────────────────────────────────────────────
snap.hist = Object.keys(HIST).sort();
let histBytes = 0;
const snapJson = JSON.stringify(snap);
for (const app of APP_DIRS) {
  const ref = path.join(app, 'public', 'reference');
  const hdir = path.join(ref, 'pw-history');
  fs.mkdirSync(hdir, { recursive: true });
  fs.writeFileSync(path.join(ref, 'pw-snapshot.json'), snapJson, 'utf8');
  if (!NO_HIST) {
    histBytes = 0;
    for (const f of fs.readdirSync(hdir)) if (f.endsWith('.json') && !HIST[f.slice(0, -5)]) fs.unlinkSync(path.join(hdir, f));   // стари символи вън
    for (const [f, h] of Object.entries(HIST)) {
      const j = JSON.stringify(Object.assign({ sym: h.sym, src: h.src, to: ymd(h.obj.t0 + ((h.obj.d ? h.obj.d[h.obj.d.length - 1] : h.obj.c.length - 1)) * DAY) }, h.obj));
      histBytes += j.length; fs.writeFileSync(path.join(hdir, f + '.json'), j, 'utf8');
    }
  }
}
const total = (snapJson.length + histBytes) / 1048576;
console.log('\nГотово ' + snap.date + ': котировки ' + Object.keys(snap.quotes).length + ', фючърси ' + snap.futures.length + ', история ' + snap.hist.length +
  ' символа; пакет ' + (snapJson.length / 1024).toFixed(0) + ' KB + история ' + (histBytes / 1024).toFixed(0) + ' KB = ' + total.toFixed(2) + ' MB → ' + APP_DIRS.join(' | '));
if (total > 3) { console.log('⚠️ над 3 MB — намали --years'); process.exit(2); }
process.exit(Object.keys(snap.quotes).length ? 0 : 1);
