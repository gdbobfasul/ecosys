// Достъп до цени — САМО безплатни публични API без ключове и без акаунти.
//
// Крипто (основен):  https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
// Крипто (резервен): https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
// Валути (FX):        https://open.er-api.com/v6/latest/USD
//
// Нито един от тези адреси НЕ изисква API ключ, токен или регистрация.

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

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
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
    // Резервен източник
    const d = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=' + meta.gecko + '&vs_currencies=usd');
    const p = d && d[meta.gecko] && d[meta.gecko].usd;
    if (isFinite(p)) return { value: p, source: 'CoinGecko' };
    throw new Error(tf('err_no_price', symbol));
  }
}

// Кеш на FX таблицата за кратко, за да не дъним публичния API.
let fxCache = { ts: 0, rates: null };

// Връща колко <quote> е равно на 1 USD (напр. EUR курс).
export async function fetchFxRate(quote) {
  const now = Date.now();
  if (!fxCache.rates || now - fxCache.ts > 60 * 1000) {
    const d = await fetchJson('https://open.er-api.com/v6/latest/USD');
    if (!d || d.result !== 'success' || !d.rates) throw new Error(t('err_fx_unavailable'));
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
