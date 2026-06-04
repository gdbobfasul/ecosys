// Version: 1.0171
// ERC20 индексатор + защитни механизми за един токен.
// ЧЕТЕ Transfer събитията през BSC RPC, трупа holders/обеми, проверява аларми.
// АВТОПАУЗА (по желание): единственото писане — и то с ОТДЕЛЕН guardian ключ
// (само pause, НЕ owner). Ако токенът не е деплойнат → стои в готовност, нищо не прави.
const { ethers } = require('ethers');

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function pause() external',
  'function NotExemptTradeTransferPausedUntil() view returns (uint256)',
];
const ZERO = '0x0000000000000000000000000000000000000000';
const isAddr = a => /^0x[a-fA-F0-9]{40}$/.test(a || '');

function createIndexer(cfg, db) {
  let provider, contract, supply = 0n, decimals = 18, timer = null, busy = false;

  const meta = {
    get: k => { const r = db.prepare('SELECT v FROM meta WHERE k=?').get(k); return r ? r.v : null; },
    set: (k, v) => db.prepare('INSERT INTO meta (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, String(v)),
  };
  function alert(level, kind, message) {
    db.prepare('INSERT INTO alerts (ts,level,kind,message) VALUES (?,?,?,?)')
      .run(Math.floor(Date.now() / 1000), level, kind, message);
    console.warn(`🚨 [${cfg.key}] ${level} ${kind}: ${message}`);
  }

  // АВТОПАУЗА — само ако е изрично включена И има guardian ключ (НЕ owner).
  async function autoPause(reason) {
    if (!cfg.autopause || !cfg.guardianKey) return;
    try {
      const wallet = new ethers.Wallet(cfg.guardianKey, provider);
      const tx = await contract.connect(wallet).pause();
      await tx.wait();
      alert('critical', 'autopause', `АВТОПАУЗА изпълнена (${reason}). tx=${tx.hash}`);
    } catch (e) { alert('error', 'autopause', `Автопауза неуспешна: ${e.message}`); }
  }

  function applyTransfer(ins, upBal, e) {
    const from = e.args.from, to = e.args.to, value = BigInt(e.args.value.toString());
    const now = Math.floor(Date.now() / 1000);
    ins.run(e.transactionHash, e.blockNumber, now, from, to, value.toString());
    // обнови баланси (груб модел: + към получателя, − от подателя)
    const bal = a => { const r = db.prepare('SELECT balance FROM holders WHERE addr=?').get(a); return r ? BigInt(r.balance) : 0n; };
    if (from !== ZERO) upBal.run(from, (bal(from) - value).toString(), now, now);
    if (to !== ZERO) upBal.run(to, (bal(to) + value).toString(), now, now);
    return value;
  }

  async function indexRange(from, to) {
    const ev = await contract.queryFilter('Transfer', from, to);
    const ins = db.prepare('INSERT INTO transfers (tx,block,ts,from_addr,to_addr,value) VALUES (?,?,?,?,?,?)');
    const upBal = db.prepare(`INSERT INTO holders (addr,balance,first_seen,last_seen) VALUES (?,?,?,?)
      ON CONFLICT(addr) DO UPDATE SET balance=excluded.balance, last_seen=excluded.last_seen`);
    for (const e of ev) {
      const value = applyTransfer(ins, upBal, e);
      // аларма: единичен голям трансфер (% от supply)
      if (supply > 0n && cfg.alertBigTransferPct > 0) {
        const pctBp = value * 10000n / supply; // basis points
        if (pctBp >= BigInt(Math.round(cfg.alertBigTransferPct * 100))) {
          const pct = (Number(pctBp) / 100).toFixed(2);
          alert('warning', 'big_transfer', `Голям трансфер ${pct}% от supply: ${e.args.from} → ${e.args.to}`);
          await autoPause(`голям трансфер ${pct}%`);
        }
      }
    }
    // аларма: твърде много трансфери за минута (груба честота)
    if (cfg.alertMaxTxPerMin > 0 && ev.length > 0) {
      const minAgo = Math.floor(Date.now() / 1000) - 60;
      const cnt = db.prepare('SELECT count(*) AS c FROM transfers WHERE ts >= ?').get(minAgo).c;
      if (cnt >= cfg.alertMaxTxPerMin) {
        alert('warning', 'tx_spike', `Скок в активността: ${cnt} трансфера/мин (праг ${cfg.alertMaxTxPerMin}).`);
        await autoPause(`скок ${cnt} tx/мин`);
      }
    }
    meta.set('last_block', to);
  }

  async function tick() {
    if (busy) return; busy = true;
    try {
      const head = await provider.getBlockNumber();
      const last = parseInt(meta.get('last_block') || String(head - 1), 10);
      if (head > last) await indexRange(last + 1, head);
    } catch (e) { console.error(`[${cfg.key}] tick грешка:`, e.message); }
    busy = false;
  }

  async function start() {
    if (cfg.type === 'multisig') {
      console.log(`⏸  [${cfg.key}] Multi-Sig е портфейл (не ERC20) — мониторингът на трансфери не важи; отделна логика предстои.`);
      return false;
    }
    if (!isAddr(cfg.address)) {
      console.log(`⏸  [${cfg.key}] токенът НЕ е деплойнат (няма адрес в .env) — индексаторът чака. Впиши адреса след деплой.`);
      return false;
    }
    provider = new ethers.JsonRpcProvider(cfg.rpc);
    contract = new ethers.Contract(cfg.address, ERC20_ABI, provider);
    try { supply = BigInt((await contract.totalSupply()).toString()); decimals = Number(await contract.decimals()); } catch (_) {}
    timer = setInterval(tick, cfg.pollMs); tick();
    console.log(`▶️  [${cfg.key}] индексатор стартиран срещу ${cfg.address} (autopause=${cfg.autopause && !!cfg.guardianKey})`);
    return true;
  }
  function stop() { if (timer) clearInterval(timer); }

  function stats() {
    const holders = db.prepare("SELECT count(*) AS c FROM holders WHERE balance NOT IN ('0','')").get().c;
    const buyersFromMint = db.prepare('SELECT count(DISTINCT to_addr) AS c FROM transfers WHERE from_addr=?').get(ZERO).c;
    const transfers = db.prepare('SELECT count(*) AS c FROM transfers').get().c;
    const day = Math.floor(Date.now() / 1000) - 86400;
    const newHolders24h = db.prepare('SELECT count(*) AS c FROM holders WHERE first_seen >= ?').get(day).c;
    const tx24h = db.prepare('SELECT count(*) AS c FROM transfers WHERE ts >= ?').get(day).c;
    return {
      token: cfg.key, name: cfg.name, deployed: isAddr(cfg.address),
      holders, buyersFromMint, transfers, newHolders24h, tx24h,
      lastBlock: meta.get('last_block'), supply: supply.toString(), decimals,
      autopause: cfg.autopause && !!cfg.guardianKey,
    };
  }

  return { start, stop, stats };
}

module.exports = { createIndexer };
