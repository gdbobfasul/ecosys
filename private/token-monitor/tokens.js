// Version: 1.0171
// Конфигурация на токените за мониторинг (отделно за всеки). Адресите/RPC идват от
// .env — докато токенът не е деплойнат, адресът е празен и индексаторът стои в готовност.
// Всеки токен се пуска като ОТДЕЛЕН сървис с ОТДЕЛНА база (виж server.js / db.js).
const NAMES = { token: 'KCY-meme-1', brch1: 'BeRicH 1', multisig: 'Multi-Sig Wallet' };
const DEFAULT_PORT = { token: 3020, brch1: 3021, multisig: 3022 };

function isValidAddress(a) { return /^0x[a-fA-F0-9]{40}$/.test((a || '').trim()); }

function tokenConfig(key) {
  key = String(key || '').toLowerCase();
  const P = key.toUpperCase();
  const e = (k, d) => (process.env[`${P}_${k}`] || d || '').trim();
  return {
    key,
    name: NAMES[key] || key,
    // multisig = портфейл (не ERC20) → отделна логика; token/brch1 = ERC20 токени.
    type: key === 'multisig' ? 'multisig' : 'erc20',
    address: e('CONTRACT_ADDRESS'),
    rpc: e('RPC') || (process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.binance.org/').trim(),
    port: parseInt(e('MONITOR_PORT', String(DEFAULT_PORT[key] || 3020)), 10),
    pollMs: parseInt(e('MONITOR_POLL_MS', '15000'), 10),
    // ── аларми (прагове) ──
    alertBigTransferPct: parseFloat(e('ALERT_BIG_TRANSFER_PCT', '5')),   // % от supply за единичен трансфер
    alertMaxTxPerMin: parseInt(e('ALERT_MAX_TX_PER_MIN', '0'), 10),      // 0 = изключено
    // ── автопауза (опасно — нужен ключ) ──
    autopause: e('AUTOPAUSE', 'false') === 'true',
    guardianKey: e('GUARDIAN_KEY'),  // ОТДЕЛЕН pauser ключ, НЕ owner-ът!
    deployed: isValidAddress(e('CONTRACT_ADDRESS')),
  };
}

module.exports = { TOKENS: ['token', 'brch1', 'multisig'], tokenConfig, isValidAddress };
