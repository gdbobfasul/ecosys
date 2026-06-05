// Version: 1.0173
// Детектори: от трансферите в новите блокове + резервите на пула връщат находки.
// severity: 'warn' (аларма) | 'severe' (аларма + кандидат за авто-pause).
// pauseable: дали това събитие може да задейства авто-pause (само тежки).
'use strict';

const pct = (part, whole) => (whole > 0n ? Number((part * 10000n) / whole) / 100 : 0);

function runDetectors(ctx) {
  const out = [];
  const { transfers, prevTokenReserve, tokenReserve, totalSupply, fmt, pairAddr, allow, th, rateTracker, now } = ctx;
  const isAllowed = (a) => allow.includes((a || '').toLowerCase());
  const pair = (pairAddr || '').toLowerCase();

  // 1) Източване/спад на ликвидност (резервите на токена в пула падат рязко)
  if (prevTokenReserve != null && prevTokenReserve > 0n && tokenReserve != null && tokenReserve < prevTokenReserve) {
    const dropPct = pct(prevTokenReserve - tokenReserve, prevTokenReserve);
    if (dropPct >= th.liquidityDropPct) {
      out.push({ severity: 'severe', kind: 'liquidity_drop', pauseable: true, msg: `Ликвидността падна ${dropPct.toFixed(1)}%`, data: { dropPct } });
    }
  }

  for (const t of transfers) {
    const from = (t.from || '').toLowerCase();
    const to = (t.to || '').toLowerCase();
    const v = t.value;

    // 2) Голяма продажба = трансфер КЪМ pair-а
    if (to === pair && !isAllowed(from) && tokenReserve > 0n) {
      const p = pct(v, tokenReserve);
      if (p >= th.dumpPctOfLiquidity) {
        const severe = p >= th.dumpPctOfLiquidity * 2;
        out.push({ severity: severe ? 'severe' : 'warn', kind: 'big_dump', pauseable: severe, address: from,
          msg: `Голяма продажба: ${p.toFixed(1)}% от пула`, data: { from, pctOfLiquidity: p, amount: fmt(v) } });
      }
    }

    // 3) Голям приток към 1 адрес (концентрация/кит) — само аларма
    if (!isAllowed(to) && to !== pair && to !== '0x0000000000000000000000000000000000000000' && totalSupply > 0n) {
      const p = pct(v, totalSupply);
      if (p >= th.whalePctOfSupply) {
        out.push({ severity: 'warn', kind: 'whale_inflow', pauseable: false, address: to,
          msg: `Голям приток: ${p.toFixed(1)}% от supply към 1 адрес`, data: { to, pctOfSupply: p, amount: fmt(v) } });
      }
    }

    // 4) Висока честота (бот) — само аларма (кандидат за РЪЧЕН blacklist)
    if (!isAllowed(from)) {
      const arr = rateTracker[from] || (rateTracker[from] = []);
      arr.push(now);
      while (arr.length && now - arr[0] > 60000) arr.shift();
      if (arr.length === th.botTransfersPerMin) {
        out.push({ severity: 'warn', kind: 'bot_rate', pauseable: false, address: from,
          msg: `Висока честота: ${arr.length} трансфера/мин (възможен бот)`, data: { from, perMin: arr.length } });
      }
    }
  }
  return out;
}

module.exports = { runDetectors };
