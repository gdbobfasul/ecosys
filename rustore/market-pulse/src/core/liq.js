// Version: 1.0030
// liq.js — ЛИКВИДАЦИОННА ТОПЛИННА КАРТА (образователна) без платени API.
//
// Как се строи картата (стандартен, публично известен модел за „liquidation levels"):
//   • Текуща цена            → api.binance.com/api/v3/ticker/24hr
//   • Общ отворен интерес OI → fapi.binance.com/fapi/v1/openInterest  (мащабира сумите в $)
//   • Скорошни свещи (обем)  → api.binance.com/api/v3/klines  (къде са отваряни позиции)
// За всяка скорошна свещ (входна цена E, тегло = изтъргуван обем) и за честите ливъридж нива
// (10x/25x/50x/100x) се смятат ЦЕНИТЕ НА ЛИКВИДАЦИЯ: лонговете се ликвидират НАДОЛУ на
// E·(1−1/L), шортовете НАГОРЕ на E·(1+1/L). Тези суми се трупат в ценови кошчета → топлинна
// карта: най-ярко-жълтото кошче = най-много насъбрана ликвидност (най-силният „магнит").
//
// Посока (по искане на потребителя): цената гравитира към ПО-ГОЛЕМИЯ ликвиден басейн. Ако
// повече ликвидност се е насъбрала НАД цената → уклон НАГОРЕ (към нивото на пика горе); ако
// повече е НАДОЛУ → уклон НАДОЛУ. Вероятността расте с превеса на по-голямата страна и се
// калибрира спрямо ИСТОРИЯТА (в колко от миналите случаи цената наистина е тръгнала натам).
//
// ВАЖНО: това е ОБРАЗОВАТЕЛЕН модел, НЕ инвестиционен съвет. Ликвидационните карти на платените
// услуги ползват собствени данни; тук е разумно приближение от публични безплатни данни.

import { httpGetJson } from './net.js';
import { loadState, saveState } from './storage.js';
import { notify } from './notifier.js';
import { t, tf } from './i18n.js';

const SPOT = 'https://api.binance.com';
const FAPI = 'https://fapi.binance.com';

// Каталог валути (символ, борсова двойка, име). Потребителят добавя от този списък.
export const COIN_CATALOG = [
  { sym: 'BTC',  pair: 'BTCUSDT',  name: 'Bitcoin' },
  { sym: 'ETH',  pair: 'ETHUSDT',  name: 'Ethereum' },
  { sym: 'UNI',  pair: 'UNIUSDT',  name: 'Uniswap' },
  { sym: 'ZEC',  pair: 'ZECUSDT',  name: 'Zcash' },
  { sym: 'LTC',  pair: 'LTCUSDT',  name: 'Litecoin' },
  { sym: 'SOL',  pair: 'SOLUSDT',  name: 'Solana' },
  { sym: 'ADA',  pair: 'ADAUSDT',  name: 'Cardano' },
  { sym: 'DOGE', pair: 'DOGEUSDT', name: 'Dogecoin' },
  { sym: 'BNB',  pair: 'BNBUSDT',  name: 'BNB' },
  { sym: 'XRP',  pair: 'XRPUSDT',  name: 'XRP' },
  { sym: 'TRX',  pair: 'TRXUSDT',  name: 'TRON' },
  { sym: 'LINK', pair: 'LINKUSDT', name: 'Chainlink' },
  { sym: 'AVAX', pair: 'AVAXUSDT', name: 'Avalanche' },
  { sym: 'DOT',  pair: 'DOTUSDT',  name: 'Polkadot' },
  { sym: 'MATIC',pair: 'MATICUSDT',name: 'Polygon' },
  { sym: 'ATOM', pair: 'ATOMUSDT', name: 'Cosmos' },
  { sym: 'NEAR', pair: 'NEARUSDT', name: 'NEAR' },
  { sym: 'APT',  pair: 'APTUSDT',  name: 'Aptos' },
  { sym: 'ARB',  pair: 'ARBUSDT',  name: 'Arbitrum' },
  { sym: 'OP',   pair: 'OPUSDT',   name: 'Optimism' },
  { sym: 'INJ',  pair: 'INJUSDT',  name: 'Injective' },
  { sym: 'SUI',  pair: 'SUIUSDT',  name: 'Sui' },
  { sym: 'TON',  pair: 'TONUSDT',  name: 'Toncoin' },
  { sym: 'XLM',  pair: 'XLMUSDT',  name: 'Stellar' },
  { sym: 'BCH',  pair: 'BCHUSDT',  name: 'Bitcoin Cash' },
  { sym: 'ETC',  pair: 'ETCUSDT',  name: 'Ethereum Classic' },
  { sym: 'FIL',  pair: 'FILUSDT',  name: 'Filecoin' },
  { sym: 'AAVE', pair: 'AAVEUSDT', name: 'Aave' },
  { sym: 'SHIB', pair: '1000SHIBUSDT', name: 'Shiba Inu', mult: 1000 },
  { sym: 'PEPE', pair: '1000PEPEUSDT', name: 'Pepe', mult: 1000 }
];

export const DEFAULT_COINS = ['BTC', 'ETH', 'UNI', 'ZEC', 'LTC', 'SOL', 'ADA', 'DOGE'];

// Ливъридж нива и тежести (ретейлът клони към висок ливъридж → 100x е най-тежък).
const LEVERAGE = [ { L: 100, w: 0.34 }, { L: 50, w: 0.28 }, { L: 25, w: 0.22 }, { L: 10, w: 0.16 } ];
const BINS = 41;          // брой ценови кошчета в картата
const RANGE = 0.28;       // ±28% около текущата цена
const KLIMIT = 500;       // скорошни свещи (500 × 4h ≈ 83 дни входни цени)
const HORIZON = 3;        // хоризонт за исторически бектест (дни напред)
const HIST_MAX = 420;     // пази до ~14 месеца дневни снимки на валута

export function coinBySym(sym) { return COIN_CATALOG.find((c) => c.sym === sym) || null; }

// ── Извличане на данни ──────────────────────────────────────────────────────
async function fetchTicker(pair) {
  const j = await httpGetJson(SPOT + '/api/v3/ticker/24hr?symbol=' + pair, 9000);
  return { price: parseFloat(j.lastPrice), chg: parseFloat(j.priceChangePercent), high: parseFloat(j.highPrice), low: parseFloat(j.lowPrice) };
}
async function fetchOI(pair) {
  try {
    const j = await httpGetJson(FAPI + '/fapi/v1/openInterest?symbol=' + pair, 9000);
    const oi = parseFloat(j.openInterest);
    return isFinite(oi) ? oi : null;
  } catch (_) { return null; }
}
async function fetchKlines(pair) {
  const j = await httpGetJson(SPOT + '/api/v3/klines?symbol=' + pair + '&interval=4h&limit=' + KLIMIT, 12000);
  // [openTime, open, high, low, close, volume, ...]
  return j.map((k) => ({ hi: parseFloat(k[2]), lo: parseFloat(k[3]), cl: parseFloat(k[4]), vol: parseFloat(k[5]) }));
}
async function fetchDaily(pair, limit) {
  const j = await httpGetJson(SPOT + '/api/v3/klines?symbol=' + pair + '&interval=1d&limit=' + (limit || 400), 12000);
  return j.map((k) => ({ t: k[0], hi: parseFloat(k[2]), lo: parseFloat(k[3]), cl: parseFloat(k[4]), vol: parseFloat(k[5]) }));
}

// ── Смятане на картата ──────────────────────────────────────────────────────
// hl = полуразпад на давността В БРОЙ СВЕЩИ (4h живо → 90 ≈ 15 дни; дневен бекфил → 20 дни).
function computeHeatmap(price, klines, oiNotional, hl) {
  const lo = price * (1 - RANGE), hi = price * (1 + RANGE);
  const step = (hi - lo) / BINS;
  const bins = [];
  for (let i = 0; i < BINS; i++) bins.push({ price: lo + step * (i + 0.5), long: 0, short: 0 });
  const idxOf = (p) => { const i = Math.floor((p - lo) / step); return (i < 0 || i >= BINS) ? -1 : i; };

  // Давност-претегляне: скорошните позиции тежат повече (старите вече са затворени/ликвидирани),
  // за да отразява картата ТЕКУЩОТО позициониране, а не входове отпреди месеци.
  // Последната свещ (i = n−1) е най-скорошна.
  const n = klines.length, HL = hl || 90;
  for (let i = 0; i < n; i++) {
    const c = klines[i];
    const entry = (c.hi + c.lo + c.cl) / 3;      // типична цена на свещта = входна цена
    const decay = Math.pow(0.5, (n - 1 - i) / HL);
    const notional = c.vol * entry * decay;       // изтъргуван обем в $ × давност = отворени позиции сега
    if (!isFinite(notional) || notional <= 0) continue;
    for (const lv of LEVERAGE) {
      const wl = notional * lv.w;
      const li = idxOf(entry * (1 - 1 / lv.L));   // лонг ликвидация НАДОЛУ
      if (li >= 0) bins[li].long += wl;
      const si = idxOf(entry * (1 + 1 / lv.L));   // шорт ликвидация НАГОРЕ
      if (si >= 0) bins[si].short += wl;
    }
  }

  // Обща сума на кошче + максимум за нормиране на яркостта.
  let maxTot = 0, sumTot = 0;
  for (const b of bins) { b.total = b.long + b.short; if (b.total > maxTot) maxTot = b.total; sumTot += b.total; }
  for (const b of bins) b.bright = maxTot > 0 ? b.total / maxTot : 0;   // 0..1 яркост

  // Мащаб в $: ако имаме OI notional, разпределяме го по дела на кошчето.
  if (oiNotional && sumTot > 0) for (const b of bins) b.usd = oiNotional * (b.total / sumTot);

  // Най-ярко кошче (най-силният магнит) + клъстери над/под цената.
  let brightest = bins[0];
  for (const b of bins) if (b.total > brightest.total) brightest = b;

  let massAbove = 0, massBelow = 0, peakAbove = null, peakBelow = null;
  for (const b of bins) {
    if (b.price >= price) { massAbove += b.total; if (!peakAbove || b.total > peakAbove.total) peakAbove = b; }
    else { massBelow += b.total; if (!peakBelow || b.total > peakBelow.total) peakBelow = b; }
  }
  const totMass = massAbove + massBelow || 1;
  const upShare = massAbove / totMass;            // дял на ликвидността НАД цената

  return { bins, brightest, price, oiNotional: oiNotional || null,
    massAbove, massBelow, upShare,
    peakAbove: peakAbove ? peakAbove.price : null,
    peakBelow: peakBelow ? peakBelow.price : null };
}

// ── История (дневни снимки) + вероятностен анализ ───────────────────────────
function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function ensureLiq(state) {
  if (!state.liq) state.liq = {};
  if (!Array.isArray(state.liq.coins)) state.liq.coins = DEFAULT_COINS.slice();
  if (!state.liq.hist) state.liq.hist = {};
  if (!state.liq.notify) state.liq.notify = {};
  if (!state.liq.lastNotify) state.liq.lastNotify = {};
  return state.liq;
}

// Сее прокси-история от дневните свещи ВЕДНЪЖ (ако историята е къса и не е бекфилвана).
async function maybeBackfill(sym, c) {
  const state = await loadState();
  const liq = ensureLiq(state);
  if (!liq.backfilled) liq.backfilled = {};
  const arr = liq.hist[sym] || [];
  if (arr.length >= 20 || liq.backfilled[sym]) return;
  try {
    const seeded = await backfillHistory(sym, c);
    if (seeded.length) {
      liq.hist[sym] = seeded;
      liq.backfilled[sym] = true;
      await saveState(state);
    }
  } catch (_) { /* тих пропуск — историята ще се трупа напред */ }
}

// Записва дневна снимка (една на ден на валута).
async function recordSnapshot(sym, h) {
  const state = await loadState();
  const liq = ensureLiq(state);
  const arr = liq.hist[sym] || (liq.hist[sym] = []);
  const dk = dayKey(Date.now());
  const side = h.upShare >= 0.5 ? 'up' : 'dn';
  const snap = { d: dk, ts: Date.now(), price: h.price, up: h.peakAbove, dn: h.peakBelow, magnet: h.brightest.price, side, upShare: h.upShare };
  if (arr.length && arr[arr.length - 1].d === dk) arr[arr.length - 1] = snap;   // презаписва днешната
  else arr.push(snap);
  if (arr.length > HIST_MAX) arr.splice(0, arr.length - HIST_MAX);
  await saveState(state);
  return arr;
}

// Бекфил на ПРОКСИ-история от дневните свещи (за да има история „месеци назад" още от
// първото отваряне). За всеки минал ден смятаме картата „към този ден" (прозорец от предните
// дни, същият ливъридж модел) → магнит/пикове/страна + цена на затваряне тогава. Няма исторически
// OI (не се продава безплатно) → без $ мащаб; редовете са самосъгласувани за анализа.
async function backfillHistory(sym, c) {
  const daily = await fetchDaily(c.pair, 400);
  const W = 120;          // прозорец от предни дни за „картата към ден D"
  const HLd = 20;         // полуразпад 20 дни
  const START = Math.min(30, daily.length - 1);
  const out = [];
  for (let d = START; d < daily.length; d++) {
    const win = daily.slice(Math.max(0, d - W), d + 1);
    const price = daily[d].cl;
    if (!isFinite(price) || price <= 0) continue;
    const h = computeHeatmap(price, win, null, HLd);
    const side = h.upShare >= 0.5 ? 'up' : 'dn';
    out.push({ d: dayKey(daily[d].t), ts: daily[d].t, price, up: h.peakAbove, dn: h.peakBelow, magnet: h.brightest.price, side, upShare: h.upShare });
  }
  return out;
}

// Исторически процент на успеваемост за дадена страна: в колко от миналите случаи
// цената след HORIZON дни наистина се е движила НАТАМ, накъдето сочеше магнитът.
function backtest(hist, side) {
  if (!hist || hist.length < HORIZON + 3) return null;
  let hit = 0, tot = 0;
  for (let i = 0; i < hist.length - HORIZON; i++) {
    if (hist[i].side !== side) continue;
    const then = hist[i].price, later = hist[i + HORIZON].price;
    if (!isFinite(then) || !isFinite(later)) continue;
    tot++;
    if (side === 'up' && later > then) hit++;
    else if (side === 'dn' && later < then) hit++;
  }
  return tot >= 4 ? { rate: hit / tot, n: tot } : null;
}

// Крайна вероятност: превес на по-голямата ликвидна страна, калибриран с историята.
export function predict(h, hist) {
  const side = h.upShare >= 0.5 ? 'up' : 'dn';
  const share = side === 'up' ? h.upShare : (1 - h.upShare);   // 0.5..1 превес на страната
  const ratioProb = 0.5 + (share - 0.5) * 0.7;                 // 50%..85% от превеса
  const bt = backtest(hist, side);
  let prob = ratioProb;
  if (bt) prob = ratioProb * 0.5 + bt.rate * 0.5;              // смес с историята
  prob = Math.max(0.5, Math.min(0.9, prob));
  return { side, prob, target: side === 'up' ? h.peakAbove : h.peakBelow, hist: bt };
}

// ── Публично: пълен анализ на една валута ───────────────────────────────────
export async function analyze(sym) {
  const c = coinBySym(sym);
  if (!c) throw new Error('unknown coin');
  const [tk, klines] = await Promise.all([ fetchTicker(c.pair), fetchKlines(c.pair) ]);
  const oi = await fetchOI(c.pair);
  const price = tk.price;
  // 1000SHIB/1000PEPE двойките дават цена ×1000 → нормализираме към реалната.
  const disp = c.mult ? price / c.mult : price;
  const oiNotional = oi != null ? oi * price : null;
  const h = computeHeatmap(price, klines, oiNotional);
  await maybeBackfill(sym, c);                 // сее прокси-история от дневните свещи (веднъж)
  const hist = await recordSnapshot(sym, h);   // upsert-ва днешната снимка върху историята
  const pred = predict(h, hist);
  return { sym, name: c.name, mult: c.mult || 1, disp, tk, h, hist, pred };
}

// ── Известия (периодично, докато приложението работи) ───────────────────────
const LIQ_NOTIFY_MS = 60 * 60 * 1000;    // проверка на всеки час
const MIN_GAP_MS = 6 * 60 * 60 * 1000;   // но известие не по-често от 6 часа на валута
let liqTimer = null;

export function arrow(side) { return side === 'up' ? '↑' : '↓'; }

async function notifyTick() {
  let state;
  try { state = await loadState(); } catch (_) { return; }
  const liq = ensureLiq(state);
  const syms = Object.keys(liq.notify).filter((s) => liq.notify[s]);
  for (const sym of syms) {
    const last = liq.lastNotify[sym] || 0;
    if (Date.now() - last < MIN_GAP_MS) continue;
    try {
      const r = await analyze(sym);
      const dir = r.pred.side === 'up' ? t('lq_up') : t('lq_down');
      const tgt = r.pred.target != null ? fmtPrice(r.pred.target / (r.mult || 1)) : '—';
      const body = tf('lq_notif_body', r.sym, fmtPrice(r.disp), dir, tgt, Math.round(r.pred.prob * 100));
      await notify(t('lq_notif_title'), body);
      const s2 = await loadState(); ensureLiq(s2).lastNotify[sym] = Date.now(); await saveState(s2);
    } catch (_) { /* тих пропуск при мрежов проблем */ }
  }
}

export function startLiqNotifier() {
  if (liqTimer) return;
  setTimeout(() => { notifyTick().catch(() => {}); }, 8000);   // веднъж скоро след старт
  liqTimer = setInterval(() => { notifyTick().catch(() => {}); }, LIQ_NOTIFY_MS);
}

export async function setNotify(sym, on) {
  const state = await loadState();
  const liq = ensureLiq(state);
  liq.notify[sym] = !!on;
  if (on) liq.lastNotify[sym] = 0;             // позволи скоро първо известие
  await saveState(state);
}
export async function isNotify(sym) { const s = await loadState(); return !!ensureLiq(s).notify[sym]; }

export async function getCoins() { const s = await loadState(); return ensureLiq(s).coins.slice(); }
export async function addCoin(sym) {
  const s = await loadState(); const liq = ensureLiq(s);
  if (coinBySym(sym) && liq.coins.indexOf(sym) < 0) { liq.coins.push(sym); await saveState(s); }
  return liq.coins.slice();
}
export async function removeCoin(sym) {
  const s = await loadState(); const liq = ensureLiq(s);
  const i = liq.coins.indexOf(sym);
  if (i >= 0 && liq.coins.length > 1) { liq.coins.splice(i, 1); delete liq.notify[sym]; await saveState(s); }
  return liq.coins.slice();
}
export async function getHist(sym) { const s = await loadState(); return (ensureLiq(s).hist[sym] || []).slice(); }

// ── Форматиране на цена (адаптивно според мащаба) ───────────────────────────
export function fmtPrice(p) {
  if (p == null || !isFinite(p)) return '—';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toPrecision(3);
}
