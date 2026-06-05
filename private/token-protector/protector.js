// Version: 1.0173
// ──────────────────────────────────────────────────────────────────────────
// token-protector — наблюдава токена on-chain и реагира.
//   АЛАРМА винаги · АВТО-PAUSE по избор (guardian ключ) · БЕЗ авто-blacklist.
//
//   node protector.js                  # наблюдение + аларми (без pause, ако няма guardian)
//   node protector.js --once           # една проверка и изход (за тест/cron)
//   TP_AUTOPAUSE=true node protector.js # позволи авто-pause при тежки събития
// ──────────────────────────────────────────────────────────────────────────
'use strict';
let ethers;
try { ({ ethers } = require('ethers')); }
catch (e) { console.error('\n✗ Липсва ethers. npm install в token-protector.\n'); process.exit(2); }

const cfg = require('./config');
const ABIS = require('./lib/abis');
const { loadGuardian } = require('./lib/env');
const { alert } = require('./lib/alert');
const { runDetectors } = require('./lib/detectors');

const once = process.argv.includes('--once');

function getNet() {
  const mod = require(cfg.networksModule);
  let n = (typeof mod.getNetworkConfig === 'function' && mod.getNetworkConfig(cfg.network)) || mod[cfg.network] || (mod.networks && mod.networks[cfg.network]);
  if (!n) throw new Error(`Няма конфиг за мрежа ${cfg.network}`);
  return n;
}

(async () => {
  if (!cfg.tokenAddress) { console.error('✗ Няма TOKEN_CONTRACT_ADDRESS (в .env или TP). Деплойни токена първо (token-creator).'); process.exit(2); }
  const net = getNet();
  const provider = new ethers.JsonRpcProvider(net.rpc);
  const token = new ethers.Contract(cfg.tokenAddress, ABIS.TOKEN, provider);
  const factory = new ethers.Contract(net.factory, ABIS.FACTORY, provider);

  const [decimals, symbol, totalSupply] = await Promise.all([
    token.decimals().catch(() => 18), token.symbol().catch(() => 'TKN'), token.totalSupply(),
  ]);
  const fmt = (v) => ethers.formatUnits(v, decimals);

  // Открий pair-а (token/WBNB)
  let pairAddr = cfg.pairAddress || await factory.getPair(cfg.tokenAddress, net.WBNB).catch(() => '');
  let pair = null, tokenIsToken0 = true;
  if (pairAddr && !/^0x0+$/.test(pairAddr)) {
    pair = new ethers.Contract(pairAddr, ABIS.PAIR, provider);
    const t0 = await pair.token0().catch(() => '');
    tokenIsToken0 = t0.toLowerCase() === cfg.tokenAddress.toLowerCase();
  }

  const guardian = loadGuardian(cfg.globalEnv);
  const guardianWallet = guardian ? new ethers.Wallet(guardian, provider) : null;

  console.log(`\n🛡️  token-protector — ${symbol} @ ${cfg.tokenAddress} (${cfg.network})`);
  console.log(`   Пул: ${pairAddr || 'не е намерен още'} · supply: ${fmt(totalSupply)}`);
  console.log(`   Авто-pause: ${cfg.autopause.enabled ? (guardianWallet ? 'ВКЛ (guardian готов)' : 'ВКЛ, но НЯМА guardian ключ → само аларма') : 'изкл (само аларма)'}`);
  console.log(`   Политика: аларма винаги · pause по избор · БЕЗ авто-blacklist\n`);

  const allow = [...cfg.allowlist, cfg.tokenAddress.toLowerCase(), (pairAddr || '').toLowerCase()].filter(Boolean);
  const rateTracker = {};
  let lastBlock = await provider.getBlockNumber();
  let prevTokenReserve = null;
  let lastPauseTs = 0;

  async function tokenReserveNow() {
    if (!pair) return null;
    const r = await pair.getReserves();
    return tokenIsToken0 ? r[0] : r[1];
  }

  async function tick() {
    const current = await provider.getBlockNumber();
    if (current < lastBlock) { lastBlock = current; return; }
    let transfers = [];
    try {
      const logs = await token.queryFilter(token.filters.Transfer(), lastBlock + 1, current);
      transfers = logs.map(l => ({ from: l.args[0], to: l.args[1], value: l.args[2] }));
    } catch (e) { /* RPC лимит/хълцук — пропусни тоя tick */ }
    const tokenReserve = await tokenReserveNow().catch(() => prevTokenReserve);

    const findings = runDetectors({
      transfers, prevTokenReserve, tokenReserve, totalSupply, fmt,
      pairAddr: pairAddr || '', allow, th: cfg.thresholds, rateTracker, now: Date.now(),
    });

    for (const f of findings) {
      alert(cfg, f.severity === 'severe' ? 'SEVERE' : 'WARN', f.kind, f.msg, f.data);
    }

    // ── Авто-pause (само тежки, само с guardian, с cooldown) ──
    if (cfg.autopause.enabled && guardianWallet) {
      const trigger = findings.find(f => f.pauseable && (
        (f.kind === 'liquidity_drop' && f.data.dropPct >= cfg.autopause.onLiquidityDropPct) ||
        (f.kind === 'big_dump' && f.data.pctOfLiquidity >= cfg.autopause.onDumpPctOfLiquidity)
      ));
      if (trigger && (Date.now() - lastPauseTs) > cfg.autopause.cooldownSec * 1000) {
        try {
          if (!(await token.isPaused())) {
            alert(cfg, 'ACTION', 'auto_pause', `Паузирам токена (${trigger.kind})`, trigger.data);
            const tx = await token.connect(guardianWallet).pause();
            await tx.wait();
            lastPauseTs = Date.now();
            alert(cfg, 'ACTION', 'auto_pause_done', `Токенът е паузиран. tx: ${tx.hash}`, { tx: tx.hash });
          }
        } catch (e) { alert(cfg, 'WARN', 'auto_pause_failed', e.shortMessage || e.message); }
      }
    }

    lastBlock = current;
    prevTokenReserve = tokenReserve;
  }

  if (once) { await tick(); process.exit(0); }
  console.log(`Наблюдавам всеки ${cfg.pollSeconds}с… (Ctrl+C за спиране)\n`);
  await tick();
  setInterval(() => { tick().catch(e => console.error('tick грешка:', e.message)); }, cfg.pollSeconds * 1000);
})().catch(e => { console.error('\n✗ token-protector гръмна:', e.shortMessage || e.message || e); process.exit(3); });
