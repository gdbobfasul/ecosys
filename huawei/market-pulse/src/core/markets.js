// Version: 1.0002
// markets.js — ДЪРВОТО на пазарите. Всеки пазар е ОТДЕЛЕН.
//   • Крипто и Злато са ГЛОБАЛНИ (не зависят от държава).
//   • Борсови индекси и Имоти ЗАВИСЯТ ОТ ДЪРЖАВАТА → всеки инструмент носи country {code,flag,name}.
// Източник на данни за всеки инструмент:
//   src:'gecko' → CoinGecko (крипто; id = CoinGecko id)
//   src:'stooq' → Stooq дневен CSV (злато/индекси/имоти; stooq = символ)
// Един и същ анализатор (analysis.js) работи върху ценовата серия на всеки инструмент.
export const MARKETS = [
  {
    id: 'crypto', icon: '🪙', labelKey: 'mk_crypto', byCountry: false, newsBase: 'crypto',
    instruments: [
      { id: 'bitcoin',     sym: 'BTC', name: 'Bitcoin',  src: 'gecko' },
      { id: 'ethereum',    sym: 'ETH', name: 'Ethereum', src: 'gecko' },
      { id: 'solana',      sym: 'SOL', name: 'Solana',   src: 'gecko' },
      { id: 'sui',         sym: 'SUI', name: 'Sui',      src: 'gecko' },
      { id: 'zcash',       sym: 'ZEC', name: 'Zcash',    src: 'gecko' },
      { id: 'ripple',      sym: 'XRP', name: 'XRP',      src: 'gecko' },
      { id: 'binancecoin', sym: 'BNB', name: 'BNB',      src: 'gecko' },
      { id: 'cardano',     sym: 'ADA', name: 'Cardano',  src: 'gecko' },
      { id: 'dogecoin',    sym: 'DOGE', name: 'Dogecoin', src: 'gecko' },
      { id: 'chainlink',   sym: 'LINK', name: 'Chainlink', src: 'gecko' },
      { id: 'polkadot',    sym: 'DOT', name: 'Polkadot', src: 'gecko' },
      { id: 'avalanche-2', sym: 'AVAX', name: 'Avalanche', src: 'gecko' },
      { id: 'the-open-network', sym: 'TON', name: 'Toncoin', src: 'gecko' },
      { id: 'tron',        sym: 'TRX', name: 'TRON', src: 'gecko' }
    ]
  },
  {
    id: 'gold', icon: '🥇', labelKey: 'mk_gold', byCountry: false, newsBase: 'gold price',
    instruments: [
      { id: 'xauusd', sym: 'XAU/USD', name: 'Gold (spot)',   src: 'stooq', stooq: 'xauusd' },
      { id: 'xagusd', sym: 'XAG/USD', name: 'Silver (spot)', src: 'stooq', stooq: 'xagusd' },
      { id: 'xptusd', sym: 'XPT/USD', name: 'Platinum (spot)', src: 'stooq', stooq: 'xptusd' }
    ]
  },
  {
    id: 'stocks', icon: '📈', labelKey: 'mk_stocks', byCountry: true, newsBase: 'stock index',
    instruments: [
      { id: 'spx', sym: 'S&P 500',    name: 'S&P 500',      src: 'stooq', stooq: '^spx', country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'ndq', sym: 'NASDAQ',     name: 'Nasdaq Comp.', src: 'stooq', stooq: '^ndq', country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'dji', sym: 'Dow Jones',  name: 'Dow Jones',    src: 'stooq', stooq: '^dji', country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'dax', sym: 'DAX',        name: 'DAX 40',       src: 'stooq', stooq: '^dax', country: { code: 'DE', flag: '🇩🇪', name: 'Germany' } },
      { id: 'ukx', sym: 'FTSE 100',   name: 'FTSE 100',     src: 'stooq', stooq: '^ukx', country: { code: 'GB', flag: '🇬🇧', name: 'UK' } },
      { id: 'nkx', sym: 'Nikkei 225', name: 'Nikkei 225',   src: 'stooq', stooq: '^nkx', country: { code: 'JP', flag: '🇯🇵', name: 'Japan' } },
      { id: 'cac', sym: 'CAC 40',     name: 'CAC 40',       src: 'stooq', stooq: '^cac', country: { code: 'FR', flag: '🇫🇷', name: 'France' } },
      { id: 'shc', sym: 'Shanghai',   name: 'Shanghai Composite', src: 'stooq', stooq: '^shc', country: { code: 'CN', flag: '🇨🇳', name: 'China' } },
      { id: 'nifty', sym: 'Nifty 50', name: 'Nifty 50',     src: 'stooq', stooq: '^nsei', country: { code: 'IN', flag: '🇮🇳', name: 'India' } }
    ]
  },
  {
    id: 'realestate', icon: '🏢', labelKey: 'mk_realestate', byCountry: true, newsBase: 'real estate market',
    instruments: [
      { id: 'vnq',  sym: 'VNQ',  name: 'US Real Estate ETF (VNQ)', src: 'stooq', stooq: 'vnq.us',  country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'iyr',  sym: 'IYR',  name: 'US Real Estate ETF (IYR)', src: 'stooq', stooq: 'iyr.us',  country: { code: 'US', flag: '🇺🇸', name: 'USA' } },
      { id: 'iprp', sym: 'IPRP', name: 'Europe Property ETF',      src: 'stooq', stooq: 'iprp.uk', country: { code: 'EU', flag: '🇪🇺', name: 'Europe' } },
      { id: 'nrsw', sym: 'Swiss RE', name: 'Swiss Real Estate',    src: 'stooq', stooq: 'srealu.sw', country: { code: 'CH', flag: '🇨🇭', name: 'Switzerland' } }
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
