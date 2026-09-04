// Version: 1.0022
// Пазарен data-слой за обогатените табове (Фючърси, Greed, RSI, Stocks, Индекси, Списък).
// САМО безплатни публични API без ключове. НА NATIVE: CapacitorHttp (заобикаля CORS); таймаут през
// Promise.race (AbortController чупи fetch при CapacitorHttp — виж [[capacitorhttp-no-abortcontroller]]).

// Универсален JSON четец: първо CapacitorHttp (native, без CORS), после fetch (браузър/десктоп).
export async function getJson(url, timeoutMs) {
  const timeout = new Promise((res) => setTimeout(() => res(null), timeoutMs || 9000));
  const load = (async () => {
    try {
      const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
      if (CH && CH.get && /^https?:/i.test(url)) {
        const r = await CH.get({ url, headers: { accept: 'application/json' } });
        return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      }
    } catch (e) { /* пада към fetch */ }
    try { const r = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } }); return await r.json(); } catch (e) { return null; }
  })();
  return await Promise.race([load, timeout]);
}

// Малък кеш (за да не дъним публичните API при смяна на табове).
const CACHE = new Map();
export async function getJsonCached(url, ttlMs, timeoutMs) {
  const now = Date.now();
  const hit = CACHE.get(url);
  if (hit && now - hit.ts < (ttlMs || 60000)) return hit.data;
  const data = await getJson(url, timeoutMs);
  if (data != null) CACHE.set(url, { ts: now, data });
  return data;
}

// ── 3) FEAR & GREED (alternative.me, безплатно, без ключ) ──────────────────────────────────────
export async function fetchFearGreed() {
  const d = await getJsonCached('https://api.alternative.me/fng/?limit=1', 5 * 60000);
  const it = d && d.data && d.data[0];
  if (!it) return null;
  return { value: parseInt(it.value, 10), label: it.value_classification, ts: parseInt(it.timestamp, 10) * 1000 };
}

// ── 4) RSI от Binance klines ────────────────────────────────────────────────────────────────────
// Уилдъров RSI(14) от затварящите цени.
export function computeRSI(closes, period) {
  period = period || 14;
  if (!closes || closes.length < period + 1) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  let avgG = gain / period, avgL = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + (d > 0 ? d : 0)) / period;
    avgL = (avgL * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

// Binance интервали за исканите таймфреймове (RSI върху затваряния на този интервал).
export const RSI_TF = [
  { key: '4h', interval: '4h', limit: 200 },
  { key: '24h', interval: '1d', limit: 200 },
  { key: '1w', interval: '1w', limit: 200 },
  { key: '1M', interval: '1M', limit: 120 }
];
export const RSI_COINS = [
  { sym: 'BTC', pair: 'BTCUSDT' },
  { sym: 'ETH', pair: 'ETHUSDT' },
  { sym: 'ZEC', pair: 'ZECUSDT' }
];
export async function fetchRSIFor(pair, interval, limit) {
  const url = 'https://api.binance.com/api/v3/klines?symbol=' + pair + '&interval=' + interval + '&limit=' + (limit || 200);
  const rows = await getJsonCached(url, 3 * 60000);
  if (!Array.isArray(rows) || !rows.length) return null;
  const closes = rows.map((r) => parseFloat(r[4])).filter((x) => isFinite(x));
  return computeRSI(closes, 14);
}
export function rsiZone(v) { if (v == null) return 'na'; if (v >= 70) return 'overbought'; if (v <= 30) return 'oversold'; return 'neutral'; }

// ── 5) STOCKS (Yahoo Finance v8, безплатно) ──────────────────────────────────────────────────────
export const STOCKS = [
  { sym: '^GSPC', name: 'S&P 500' }, { sym: 'QQQ', name: 'Invesco QQQ' }, { sym: 'DIA', name: 'Dow Jones (DIA)' },
  { sym: 'IWM', name: 'Russell 2000 (IWM)' }, { sym: 'NVDA', name: 'NVIDIA' }, { sym: 'AAPL', name: 'Apple' },
  { sym: 'GOOGL', name: 'Alphabet' }, { sym: 'AMZN', name: 'Amazon' }, { sym: 'TSM', name: 'TSMC' },
  { sym: 'META', name: 'Meta' }, { sym: 'TSLA', name: 'Tesla' }, { sym: 'AMD', name: 'AMD' }, { sym: 'MSFT', name: 'Microsoft' },
  // Частни (pre-IPO) — няма публичен борсов курс; показваме последна широко съобщена оценка (ориентировъчно).
  { sym: 'OPENAI', name: 'OpenAI', privateCo: true, valuation: '≈ $500B (private)' },
  { sym: 'ANTHROPIC', name: 'Anthropic', privateCo: true, valuation: '≈ $183B (private)' }
];
export async function fetchStock(sym) {
  const meta = STOCKS.find((s) => s.sym === sym);
  if (meta && meta.privateCo) return { privateCo: true, valuation: meta.valuation };
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=5d';
  const d = await getJsonCached(url, 2 * 60000);
  const r = d && d.chart && d.chart.result && d.chart.result[0];
  const m = r && r.meta;
  if (!m) return null;
  const price = m.regularMarketPrice, prev = m.chartPreviousClose || m.previousClose;
  const chg = (price != null && prev) ? ((price - prev) / prev) * 100 : null;
  return { price, prev, changePct: chg, currency: m.currency || 'USD' };
}

// ── Още Yahoo списъци (същият fetchStock генерично) ──
export const WORLD = [
  { sym: '^GSPC', name: 'S&P 500' }, { sym: '^IXIC', name: 'Nasdaq' }, { sym: '^DJI', name: 'Dow Jones' }, { sym: '^RUT', name: 'Russell 2000' },
  { sym: '^N225', name: 'Nikkei 225' }, { sym: '^GDAXI', name: 'DAX' }, { sym: '^FTSE', name: 'FTSE 100' }, { sym: '^HSI', name: 'Hang Seng' },
  { sym: '^FCHI', name: 'CAC 40' }, { sym: '^STOXX50E', name: 'Euro Stoxx 50' }
];
export const COMMODITIES = [
  { sym: 'GC=F', name: 'Gold' }, { sym: 'SI=F', name: 'Silver' }, { sym: 'CL=F', name: 'WTI Oil' }, { sym: 'BZ=F', name: 'Brent Oil' },
  { sym: 'NG=F', name: 'Natural Gas' }, { sym: 'HG=F', name: 'Copper' }, { sym: 'PL=F', name: 'Platinum' }
];
export const MACRO = [
  { sym: '^VIX', name: 'VIX (volatility)' }, { sym: 'DX-Y.NYB', name: 'US Dollar Index (DXY)' }, { sym: '^TNX', name: 'US 10Y yield' },
  { sym: '^FVX', name: 'US 5Y yield' }, { sym: '^TYX', name: 'US 30Y yield' }
];
export const FOREX = [
  { sym: 'EURUSD=X', name: 'EUR/USD' }, { sym: 'GBPUSD=X', name: 'GBP/USD' }, { sym: 'JPY=X', name: 'USD/JPY' }, { sym: 'CHF=X', name: 'USD/CHF' },
  { sym: 'AUDUSD=X', name: 'AUD/USD' }, { sym: 'CAD=X', name: 'USD/CAD' }, { sym: 'CNY=X', name: 'USD/CNY' }, { sym: 'EURGBP=X', name: 'EUR/GBP' }
];

// Trending крипто (CoinGecko).
export async function fetchTrending() {
  const d = await getJsonCached('https://api.coingecko.com/api/v3/search/trending', 3 * 60000);
  const coins = d && d.coins;
  if (!Array.isArray(coins)) return null;
  return coins.map((c) => c.item).filter(Boolean).map((it) => ({ name: it.name, sym: (it.symbol || '').toUpperCase(), rank: it.market_cap_rank, price: it.data && it.data.price }));
}
// Топ печеливши/губещи за 24ч (от топ-100 по капитализация).
export async function fetchMovers() {
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h&sparkline=false';
  const arr = await getJsonCached(url, 90000);
  if (!Array.isArray(arr)) return null;
  const withChg = arr.filter((c) => typeof c.price_change_percentage_24h === 'number');
  const gainers = [...withChg].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 10);
  const losers = [...withChg].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 10);
  return { gainers, losers };
}

// ── 6) КРИПТО ИНДЕКСИ (CoinGecko /global — безплатно) ────────────────────────────────────────────
export async function fetchCryptoIndices() {
  const g = await getJsonCached('https://api.coingecko.com/api/v3/global', 3 * 60000);
  const d = g && g.data;
  if (!d) return null;
  const fg = await fetchFearGreed().catch(() => null);
  return {
    totalMcap: d.total_market_cap && d.total_market_cap.usd,
    totalVol: d.total_volume && d.total_volume.usd,
    mcapChg24h: d.market_cap_change_percentage_24h_usd,
    btcDom: d.market_cap_percentage && d.market_cap_percentage.btc,
    ethDom: d.market_cap_percentage && d.market_cap_percentage.eth,
    activeCoins: d.active_cryptocurrencies,
    markets: d.markets,
    fearGreed: fg
  };
}

// ── 7) СПИСЪК С ВАЛУТИ (CoinGecko /coins/markets — колони като CoinMarketCap) ────────────────────
export async function fetchCoinList(perPage) {
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=' +
    (perPage || 50) + '&page=1&price_change_percentage=1h,24h,7d&sparkline=false';
  const d = await getJsonCached(url, 90000);
  return Array.isArray(d) ? d : null;
}

// ── 2) ФЮЧЪРСИ/ЛИКВИДАЦИИ (Binance Futures — безплатен еквивалент на coinglass heatmap) ───────────
// Open interest + funding rate + long/short account ratio = натиск на пазара / риск от ликвидации.
export const FUT_COINS = ['BTC', 'ETH', 'ZEC', 'SOL', 'XRP', 'DOGE', 'BNB', 'NEAR', 'AAVE', 'LTC', 'ARB', 'ADA', 'AVAX', 'TRX', 'PEPE', 'ETC', 'SHIB', 'XAUT', 'PAXG', 'XMR'];
export async function fetchFutures(sym) {
  const pair = sym + 'USDT';
  const base = 'https://fapi.binance.com';
  const [prem, oi, ls] = await Promise.all([
    getJsonCached(base + '/fapi/v1/premiumIndex?symbol=' + pair, 60000),
    getJsonCached(base + '/fapi/v1/openInterest?symbol=' + pair, 60000),
    getJsonCached(base + '/futures/data/globalLongShortAccountRatio?symbol=' + pair + '&period=5m&limit=1', 60000)
  ]);
  if (!prem || prem.code) return null; // символът може да липсва във фючърсите
  const mark = parseFloat(prem.markPrice);
  const funding = prem.lastFundingRate != null ? parseFloat(prem.lastFundingRate) * 100 : null; // в %
  const oiQty = oi && oi.openInterest != null ? parseFloat(oi.openInterest) : null;
  const lsr = Array.isArray(ls) && ls[0] ? parseFloat(ls[0].longShortRatio) : null;
  return { sym, mark, funding, oiNotional: (oiQty != null && isFinite(mark)) ? oiQty * mark : null, longShort: lsr };
}
