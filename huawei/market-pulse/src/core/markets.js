// Version: 1.0016
// markets.js — ДЪРВОТО на пазарите. Всеки пазар е ОТДЕЛЕН.
//   • Крипто и Злато са ГЛОБАЛНИ (не зависят от държава).
//   • Борсови индекси и Имоти ЗАВИСЯТ ОТ ДЪРЖАВАТА → всеки инструмент носи country {code,flag,name}.
// Източник на данни за всеки инструмент (СМЕНЕНИ 2026-07-19 — старите спряха, виж analysis.js):
//   src:'gecko' → крипто: история от Binance klines (binance = двойка; CoinGecko days=365 е резерва)
//   src:'stooq' → злато/индекси/имоти: Yahoo Finance v8 chart (yahoo = символ; Stooq CSV вече
//                 връща анти-бот предизвикателство и е неизползваем — полето stooq остава за справка)
// Един и същ анализатор (analysis.js) работи върху ценовата серия на всеки инструмент.
export const MARKETS = [
  {
    id: 'crypto', icon: '🪙', labelKey: 'mk_crypto', byCountry: false, newsBase: 'crypto',
    instruments: [
      { id: 'bitcoin',     sym: 'BTC', name: 'Bitcoin',  src: 'gecko', binance: 'BTCUSDT' },
      { id: 'ethereum',    sym: 'ETH', name: 'Ethereum', src: 'gecko', binance: 'ETHUSDT' },
      { id: 'solana',      sym: 'SOL', name: 'Solana',   src: 'gecko', binance: 'SOLUSDT' },
      { id: 'sui',         sym: 'SUI', name: 'Sui',      src: 'gecko', binance: 'SUIUSDT' },
      { id: 'zcash',       sym: 'ZEC', name: 'Zcash',    src: 'gecko', binance: 'ZECUSDT' },
      { id: 'ripple',      sym: 'XRP', name: 'XRP',      src: 'gecko', binance: 'XRPUSDT' },
      { id: 'binancecoin', sym: 'BNB', name: 'BNB',      src: 'gecko', binance: 'BNBUSDT' },
      { id: 'cardano',     sym: 'ADA', name: 'Cardano',  src: 'gecko', binance: 'ADAUSDT' },
      { id: 'dogecoin',    sym: 'DOGE', name: 'Dogecoin', src: 'gecko', binance: 'DOGEUSDT' },
      { id: 'chainlink',   sym: 'LINK', name: 'Chainlink', src: 'gecko', binance: 'LINKUSDT' },
      { id: 'polkadot',    sym: 'DOT', name: 'Polkadot', src: 'gecko', binance: 'DOTUSDT' },
      { id: 'avalanche-2', sym: 'AVAX', name: 'Avalanche', src: 'gecko', binance: 'AVAXUSDT' },
      { id: 'the-open-network', sym: 'TON', name: 'Toncoin', src: 'gecko', binance: 'TONUSDT' },
      { id: 'tron',        sym: 'TRX', name: 'TRON', src: 'gecko', binance: 'TRXUSDT' }
    ]
  },
  {
    id: 'gold', icon: '🥇', labelKey: 'mk_gold', byCountry: false, newsBase: 'gold price',
    instruments: [
      { id: 'xauusd', sym: 'XAU/USD', name: 'Gold (spot)',   src: 'stooq', stooq: 'xauusd', yahoo: 'GC=F' },
      { id: 'xagusd', sym: 'XAG/USD', name: 'Silver (spot)', src: 'stooq', stooq: 'xagusd', yahoo: 'SI=F' },
      { id: 'xptusd', sym: 'XPT/USD', name: 'Platinum (spot)', src: 'stooq', stooq: 'xptusd', yahoo: 'PL=F' }
    ]
  },
  {
    id: 'stocks', icon: '📈', labelKey: 'mk_stocks', byCountry: true, newsBase: 'stock index',
    instruments: [
      { id: 'spx', sym: 'S&P 500',    name: 'S&P 500',      src: 'stooq', stooq: '^spx', yahoo: '^GSPC', country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'ndq', sym: 'NASDAQ',     name: 'Nasdaq Comp.', src: 'stooq', stooq: '^ndq', yahoo: '^IXIC', country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'dji', sym: 'Dow Jones',  name: 'Dow Jones',    src: 'stooq', stooq: '^dji', yahoo: '^DJI', country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'dax', sym: 'DAX',        name: 'DAX 40',       src: 'stooq', stooq: '^dax', yahoo: '^GDAXI', country: { code: 'DE', flag: '🇩🇪', name: 'Germany' } },
      { id: 'ukx', sym: 'FTSE 100',   name: 'FTSE 100',     src: 'stooq', stooq: '^ukx', yahoo: '^FTSE', country: { code: 'GB', flag: '🇬🇧', name: 'UK' } },
      { id: 'nkx', sym: 'Nikkei 225', name: 'Nikkei 225',   src: 'stooq', stooq: '^nkx', yahoo: '^N225', country: { code: 'JP', flag: '🇯🇵', name: 'Japan' } },
      { id: 'cac', sym: 'CAC 40',     name: 'CAC 40',       src: 'stooq', stooq: '^cac', yahoo: '^FCHI', country: { code: 'FR', flag: '🇫🇷', name: 'France' } },
      { id: 'shc', sym: 'Shanghai',   name: 'Shanghai Composite', src: 'stooq', stooq: '^shc', yahoo: '000001.SS', country: { code: 'CN', flag: '🇨🇳', name: 'China' } },
      { id: 'nifty', sym: 'Nifty 50', name: 'Nifty 50',     src: 'stooq', stooq: '^nsei', yahoo: '^NSEI', country: { code: 'IN', flag: '🇮🇳', name: 'India' } }
    ]
  },
  {
    id: 'realestate', icon: '🏢', labelKey: 'mk_realestate', byCountry: true, newsBase: 'real estate market',
    instruments: [
      { id: 'vnq',  sym: 'VNQ',  name: 'US Real Estate ETF (VNQ)', src: 'stooq', stooq: 'vnq.us', yahoo: 'VNQ',  country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'iyr',  sym: 'IYR',  name: 'US Real Estate ETF (IYR)', src: 'stooq', stooq: 'iyr.us', yahoo: 'IYR',  country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'iprp', sym: 'IPRP', name: 'Europe Property ETF',      src: 'stooq', stooq: 'iprp.uk', yahoo: 'IPRP.L', country: { code: 'EU', flag: '🇪🇺', name: 'Europe' } },
      { id: 'nrsw', sym: 'Swiss RE', name: 'Swiss Real Estate',    src: 'stooq', stooq: 'srealu.sw', yahoo: 'SRECHA.SW', country: { code: 'CH', flag: '🇨🇭', name: 'Switzerland' } }
    ]
  }
];

export function marketById(id) { return MARKETS.find((m) => m.id === id) || null; }
export function instrument(marketId, instId) {
  const m = marketById(marketId); if (!m) return null;
  return m.instruments.find((i) => i.id === instId) || null;
}
// Групиране по държава (за byCountry пазари) → [{country, items:[...]}].
export function groupByCountry(m) {
  if (!m) return [];
  if (!m.byCountry) return [{ country: null, items: m.instruments }];
  const map = {};
  for (const i of m.instruments) {
    const key = (i.country && i.country.code) || '—';
    if (!map[key]) map[key] = { country: i.country, items: [] };
    map[key].items.push(i);
  }
  return Object.keys(map).map((k) => map[k]);
}
// Заявка за новини за инструмента (+държава, ако зависи от нея).
export function newsQuery(m, inst) {
  const base = (m && m.newsBase) || '';
  if (m && m.id === 'crypto') return inst.name + ' crypto';
  if (m && m.id === 'gold') return inst.name + ' price';
  const c = inst.country ? (' ' + inst.country.name) : '';
  return inst.name + c + ' ' + base;
}
