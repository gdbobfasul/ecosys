// Version: 1.0173
// ──────────────────────────────────────────────────────────────────────────
// token-protector — наблюдава токена on-chain и РЕАГИРА при зловредни модели.
//
// ПОЛИТИКА (по искане): АЛАРМА винаги · АВТО-PAUSE по избор (guardian ключ) ·
// БЕЗ авто-blacklist (само аларма — човек решава кого да блокира).
//
// Сигурност: pause() се вика със СПЕЦИАЛЕН guardian ключ (pauser), НЕ owner-а.
// Owner-ът (mint/теглене/смяна адреси) стои в студен/multisig ключ, никога тук.
// ──────────────────────────────────────────────────────────────────────────
'use strict';
const path = require('path');

module.exports = {
  network: process.env.TP_NETWORK || 'bscTestnet', // testnet първо!
  networksModule: path.join(__dirname, '..', 'token', 'config', 'networks.js'),
  globalEnv: path.join(__dirname, '..', 'configs', '.env'),

  // Адрес на токена (от .env TOKEN_CONTRACT_ADDRESS или --token). Pair се авто-открива.
  tokenAddress: process.env.TOKEN_CONTRACT_ADDRESS || '',
  pairAddress: process.env.TP_PAIR_ADDRESS || '', // ако е празно → factory.getPair(token, WBNB)

  pollSeconds: Number(process.env.TP_POLL || 12),  // колко често дърпа нови блокове

  // ── Прагове за детекция ──
  thresholds: {
    liquidityDropPct: Number(process.env.TP_LIQ_DROP || 25),   // ↓ резерви с N% между проверки → тежко
    dumpPctOfLiquidity: Number(process.env.TP_DUMP || 10),     // 1 продажба ≥ N% от пула
    whalePctOfSupply: Number(process.env.TP_WHALE || 3),       // адрес държи ≥ N% от supply
    botTransfersPerMin: Number(process.env.TP_BOT_RATE || 15), // ≥ N трансфера/мин от 1 адрес
    sniperWindowSec: Number(process.env.TP_SNIPE_WIN || 30),   // големи покупки в първите N сек след старт
  },

  // ── Авто-pause (по избор) — САМО за тежки събития ──
  autopause: {
    enabled: String(process.env.TP_AUTOPAUSE || 'false').toLowerCase() === 'true',
    // паузира при: източване на ликвидност ИЛИ единичен dump над тези прагове
    onLiquidityDropPct: Number(process.env.TP_PAUSE_LIQ || 30),
    onDumpPctOfLiquidity: Number(process.env.TP_PAUSE_DUMP || 20),
    cooldownSec: Number(process.env.TP_PAUSE_COOLDOWN || 600), // не паузирай пак веднага
  },

  // Адреси за пренебрегване (owner, pair, дистрибуция) — не са „заплаха".
  allowlist: (process.env.TP_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),

  alertDir: path.join(__dirname, 'alerts'),
  webhookUrl: process.env.TP_WEBHOOK || '', // по избор: Telegram/Discord/друг
};
