// Version: 1.0027
// Достъп до цени — САМО безплатни публични API без ключове и без акаунти.
//
// Крипто (основен):  https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
// Крипто (резервен): https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
// Валути (FX):        https://open.er-api.com/v6/latest/USD
//
// Нито един от тези адреси НЕ изисква API ключ, токен или регистрация.
//
// 1.0027 (Huawei 3.1, 11.09.2026 — тестват от Китай): всички заявки минават през getJson от markets.js
// (CapacitorHttp → fetch → нашия relay, без AbortController, който чупи CapacitorHttp). Ако нищо не се
// отвори — стойност от вградения снимков пакет (core/snapshot.js) с източник „вграден пакет <дата>" и
// флаг stale (планировчикът тогава НЕ праща известие по стара цена).

import { t, tf } from './i18n.js';

// Поддържани крипто символи → Binance двойка + CoinGecko id.
export const CRYPTO = {
  BTC: { binance: 'BTCUSDT', gecko: 'bitcoin' },
  ETH: { binance: 'ETHUSDT', gecko: 'ethereum' },
  BNB: { binance: 'BNBUSDT', gecko: 'binancecoin' },
  SOL: { binance: 'SOLUSDT', gecko: 'solana' },
  XRP: { binance: 'XRPUSDT', gecko: 'ripple' },
  ADA: { binance: 'ADAUSDT', gecko: 'cardano' },
  DOGE: { binance: 'DOGEUSDT', gecko: 'dogecoin' }
};

// Често следени валути (спрямо USD база от open.er-api.com).
export const FX = ['EUR', 'GBP', 'JPY', 'RUB', 'CNY', 'TRY', 'BGN', 'CHF', 'INR', 'BRL'];

import { getJson } from './markets.js';
import { loadSnapshot } from './snapshot.js';

async function fetchJson(url, timeoutMs = 8000) {
  const d = await getJson(url, timeoutMs);
  if (d == null) throw new Error(t('err_generic'));
  return d;
}

// Стойност от вградения пакет (или null). kind: 'crypto' | 'fx'.
async function fromSnapshot(kind, symbol) {
  const s = await loadSnapshot();
  const v = s && s.watch && s.watch[kind] && s.watch[kind][symbol];
  return isFinite(v) ? { value: v, source: t('src_snapshot').replace('{0}', s.date || ''), stale: true } : null;
}

// Връща цена в USD за крипто символ. Опитва Binance, после CoinGecko.
export async function fetchCryptoPrice(symbol) {
  const meta = CRYPTO[symbol];
  if (!meta) throw new Error(tf('err_unknown_symbol', symbol));
  try {
    const d = await fetchJson('https://api.binance.com/api/v3/ticker/price?symbol=' + meta.binance);
    const p = parseFloat(d.price);
    if (isFinite(p)) return { value: p, source: 'Binance' };
    throw new Error(t('err_bad_value'));
  } catch (e) {
    // Резервни източници: огледалото на Binance → CoinGecko → вграденият пакет
    try {
      const d = await fetchJson('https://data-api.binance.vision/api/v3/ticker/price?symbol=' + meta.binance);
      const p = parseFloat(d.price);
      if (isFinite(p)) return { value: p, source: 'Binance' };
    } catch (_) { /* следващият */ }
    try {
      const d = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=' + meta.gecko + '&vs_currencies=usd');
      const p = d && d[meta.gecko] && d[meta.gecko].usd;
      if (isFinite(p)) return { value: p, source: 'CoinGecko' };
    } catch (_) { /* вграденият пакет */ }
    const snap = await fromSnapshot('crypto', symbol);
    if (snap) return snap;
    throw new Error(tf('err_no_price', symbol));
  }
}

// Кеш на FX таблицата за кратко, за да не дъним публичния API.
let fxCache = { ts: 0, rates: null };

// Връща колко <quote> е равно на 1 USD (напр. EUR курс).
export async function fetchFxRate(quote) {
  quote = String(quote || '').split('/').pop().trim().toUpperCase();   // приема и „USD/EUR"
  const now = Date.now();
  if (!fxCache.rates || now - fxCache.ts > 60 * 1000) {
    let d = null;
    try { d = await fetchJson('https://open.er-api.com/v6/latest/USD'); } catch (_) { d = null; }
    if (!d || d.result !== 'success' || !d.rates) {
      const snap = await fromSnapshot('fx', quote);
      if (snap) return snap;
      throw new Error(t('err_fx_unavailable'));
    }
    fxCache = { ts: now, rates: d.rates };
  }
  const r = fxCache.rates[quote];
  if (!isFinite(r)) throw new Error(tf('err_no_rate', quote));
  return { value: r, source: 'open.er-api.com' };
}

// Универсален четец за един watch.
export async function fetchValue(watch) {
  if (watch.kind === 'crypto') return fetchCryptoPrice(watch.symbol);
  if (watch.kind === 'fx') return fetchFxRate(watch.symbol);
  throw new Error(t('err_unknown_watch'));
}
