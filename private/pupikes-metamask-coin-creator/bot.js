#!/usr/bin/env node
// PupikesMetamaskCoinCreator — ТИ избираш само детайлите, ботът прави всичко: пуска, следи, пази, продава.
//   menu              → каталог с токените (всеки със своята специфичност) — избираш кой да пуснеш
//   create <id>       → пуска избрания токен (FeatureToken пресет) + задава защита на трезора на бота
//   list              → пуснатите токени в текущата мрежа
//   status <id>       → инфо + чакащи (задържани) трансфери
//   monitor [id]      → следи и ПАЗИ: авто-отменя подозрителни задържани трансфери ОТ трезора на бота
//   send <id> <addr> <amount>   → прехвърля
//   sell <id> <addr> <amount>   → продажба по всяко време
//   wallet            → адресът на работния портфейл (за MetaMask/зареждане с газ)
//   balance           → газ баланс на бота в текущата мрежа
//
// Мрежата се избира в config.json (activeNetwork). walletMode 'vault' = ползва wallet/ (създай с: node vault.js new).
const fs = require("fs");
const path = require("path");
const { ethers } = require(require.resolve("ethers", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../token"), __dirname] }));
const vault = require("./vault.js");

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
if (process.env.BOT_NETWORK) CFG.activeNetwork = process.env.BOT_NETWORK;   // override за тест
if (process.env.BOT_WALLETMODE) CFG.walletMode = process.env.BOT_WALLETMODE;
const CAT = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8")).tokens;
const ARTIFACT = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../token/artifacts/token/contracts/PupikesFeatureToken.sol/PupikesFeatureToken.json"), "utf8"));
const NET = CFG.networks[CFG.activeNetwork];
if (!NET) { console.error("Непозната мрежа в config.activeNetwork: " + CFG.activeNetwork); process.exit(1); }

function log(s) { console.log(new Date().toISOString().slice(11, 19) + "  " + s); }
function provider() { return new ethers.JsonRpcProvider(NET.rpc, { name: CFG.activeNetwork, chainId: NET.chainId }); }
function deployer() {
  if (CFG.walletMode === "vault") { if (!vault.exists()) { console.error("Няма работен портфейл — първо: node vault.js new"); process.exit(1); } return vault.loadOwner(provider()); }
  return new ethers.Wallet(CFG.keys.deployerKey, provider());
}
function guardianWallet() {
  if (CFG.walletMode === "vault") return vault.loadGuardian(provider());
  return new ethers.Wallet(CFG.keys.guardianKey, provider());
}
function findTok(id) { const t = CAT.find((x) => x.id === id); if (!t) { console.error("Няма такъв токен: " + id + ". Виж: node bot.js menu"); process.exit(1); } return t; }
function units(n, dec) { return ethers.parseUnits(String(n), dec); }
function fmt(n, dec) { return ethers.formatUnits(n, dec); }
function deployFile(id) { return path.join(__dirname, "deployments", CFG.activeNetwork + "-" + id + ".json"); }
function saveDeploy(id, d) { const f = deployFile(id); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2)); }
function loadDeploy(id) { try { return JSON.parse(fs.readFileSync(deployFile(id), "utf8")); } catch (_) { return null; } }
function explorerTx(h) { return NET.explorer ? NET.explorer + "/tx/" + h : h; }
function explorerAddr(a) { return NET.explorer ? NET.explorer + "/address/" + a : a; }

// ── MENU: каталог ──
function menu() {
  console.log("\n📋 PupikesMetamaskCoinCreator — каталог на токените (мрежа: " + CFG.activeNetwork + ")\n");
  for (const t of CAT) {
    const d = loadDeploy(t.id);
    console.log("  [" + t.id + "]  " + t.name + " (" + t.symbol + ")" + (d ? "  ✅ пуснат: " + d.address : ""));
    console.log("       " + t.special);
    console.log("       → " + t.why + "\n");
  }
  console.log("Пускане:  node bot.js create <id>     (напр. node bot.js create guard)");
  console.log("Всички наведнъж вече пуснати виж с:  node bot.js list\n");
}

// ── CREATE: пуска избрания токен ──
async function create(id) {
  const T = findTok(id);
  const w = deployer();
  const net = await provider().getNetwork();
  log("Пускам " + T.name + " (" + T.symbol + ") в " + CFG.activeNetwork + " (chainId " + net.chainId + ")");
  log("Деплойър/трезор: " + w.address);
  const bal = await provider().getBalance(w.address);
  log("Газ баланс: " + ethers.formatEther(bal) + " " + NET.currency);
  if (bal === 0n) { log("⛔ Няма газ. Зареди адреса " + w.address + " с " + NET.currency + (NET.faucet ? " от " + NET.faucet : "") + " и пробвай пак."); process.exit(1); }
  const p = T.params;
  const dec = T.decimals;
  const fundWallet = (p.fundFeeBps > 0) ? w.address : ethers.ZeroAddress; // фондът е трезорът на бота
  const params = [
    T.name, T.symbol, dec, units(T.supply, dec),
    units(p.defaultThresholdTokens, dec), p.defaultDelaySec,
    p.burnFeeBps, p.fundFeeBps, fundWallet,
    p.maxTxBps, p.maxWalletBps
  ];
  const F = new ethers.ContractFactory(ARTIFACT.abi, ARTIFACT.bytecode, w);
  const c = await F.deploy(params);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  // Защита на ТРЕЗОРА на бота: собственикът получава своя guard с пазач = guardian акаунта → monitor може да отменя кражби.
  const gAddr = guardianWallet().address;
  await ensureGuardianGas(w, gAddr);   // ботът сам зарежда пазача с малко газ (за да може да отменя кражби)
  const t2 = new ethers.Contract(addr, ARTIFACT.abi, deployer());
  await (await t2.setGuard(units(T.ownerGuard.thresholdTokens, dec), T.ownerGuard.delaySec, gAddr)).wait();
  saveDeploy(id, { id, address: addr, name: T.name, symbol: T.symbol, decimals: dec, supply: T.supply, deployer: w.address, guardian: gAddr, network: CFG.activeNetwork, chainId: Number(net.chainId), special: T.special, deployedAt: new Date().toISOString() });
  log("✅ ПУСНАТ: " + T.name + " (" + T.symbol + ") @ " + addr);
  log("   Специфичност: " + T.special);
  log("   🛡 Трезорът е защитен (пазач " + gAddr + ", праг " + T.ownerGuard.thresholdTokens + ")");
  log("   Explorer: " + explorerAddr(addr));
  log("   → Добави в MetaMask като custom token с адрес: " + addr);
  if (CFG.market && CFG.market.autoLiquidityOnCreate && NET.dex) { log("— Авто-ликвидност (по config)…"); await liquidity(id); }
  return addr;
}

// ── LAUNCH: пуска токена И попълва пазара с една команда ──
async function launch(id) {
  if (!loadDeploy(id)) await create(id);
  else log("Токенът вече е пуснат — само попълвам пазара.");
  const p = await readPrice(id).catch(() => null);
  if (p) { log("Вече има пазар за " + id + "."); await price(id); return; }
  await liquidity(id);   // ботът сам попълва ликвидността
}

// Пазачът трябва газ, за да отменя кражби. Ботът го зарежда от собственика при нужда.
async function ensureGuardianGas(ownerWallet, gAddr) {
  if (CFG.activeNetwork === "hardhat-local") return; // локално всички акаунти имат газ
  try {
    const min = ethers.parseEther(String(CFG.protect.minGuardianGas || "0.01"));
    const top = ethers.parseEther(String(CFG.protect.guardianGasTopUp || "0.02"));
    const gb = await provider().getBalance(gAddr);
    if (gb >= min) return;
    log("Зареждам пазача с газ (" + ethers.formatEther(top) + " " + NET.currency + ") за да може да отменя кражби…");
    await (await ownerWallet.sendTransaction({ to: gAddr, value: top })).wait();
    log("   ✅ Пазачът е зареден.");
  } catch (e) { log("   ⚠ не успях да заредя пазача с газ: " + (e.shortMessage || e.message || "").slice(0, 60) + " (зареди " + gAddr + " ръчно)"); }
}

// ── LIST ──
function list() {
  console.log("\nПуснати токени в " + CFG.activeNetwork + ":\n");
  let any = false;
  for (const t of CAT) { const d = loadDeploy(t.id); if (d) { any = true; console.log("  [" + t.id + "] " + d.name + " (" + d.symbol + ")  " + d.address); } }
  if (!any) console.log("  (още няма — пусни с: node bot.js create <id>)");
  console.log("");
}

function tokenAt(id, signer) { const d = loadDeploy(id); if (!d) { console.error("Токенът " + id + " не е пуснат в " + CFG.activeNetwork + ". Пусни: node bot.js create " + id); process.exit(1); } return { d, c: new ethers.Contract(d.address, ARTIFACT.abi, signer || provider()) }; }

// ── STATUS ──
async function status(id) {
  const { d, c } = tokenAt(id);
  log("Токен: " + (await c.name()) + " (" + (await c.symbol()) + ") @ " + d.address);
  log("Supply: " + fmt(await c.totalSupply(), d.decimals) + " · Owner: " + (await c.owner()));
  log("Баланс на трезора: " + fmt(await c.balanceOf(d.deployer), d.decimals) + " " + d.symbol);
  const pc = await c.pendingCount();
  log("Чакащи (задържани) трансфери общо: " + pc);
  const ids = await c.pendingIdsOf(d.deployer);
  for (const pid of ids) { const p = await c.pending(pid); if (p.active) log("   ⏳ #" + pid + " → " + p.to + "  " + fmt(p.amount, d.decimals) + "  изпълним след " + new Date(Number(p.executeAfter) * 1000).toISOString()); }
}

// ── SEND / SELL ──
async function send(id, to, amount) {
  const { d, c } = tokenAt(id, deployer());
  log("Пращам " + amount + " " + d.symbol + " → " + to);
  await (await c.transfer(to, units(amount, d.decimals))).wait();
  const pc = await c.pendingCount();
  const last = await c.pending(pc);
  if (last.active && last.to.toLowerCase() === to.toLowerCase()) log("⏳ ЗАДЪРЖАН (над прага) — id " + pc + ". Изпълни се сам след забавянето или отмени с guardian.");
  else log("✅ Пратено мигновено.");
}
async function sell(id, to, amount) {
  log("ПРОДАЖБА: " + amount + " → " + to + " (купувач/борса)");
  await send(id, to, amount);
  log("ℹ Ако е над Vault Guard прага, продажбата се задържа за сигурност — изпълни с executePending или намали прага с setGuard.");
}

// ── MONITOR: пази трезора на бота от кражба ──
async function monitor(id) {
  const g = guardianWallet();
  const ids = id ? [id] : CAT.filter((t) => loadDeploy(t.id)).map((t) => t.id);
  if (!ids.length) { log("Няма пуснати токени за наблюдение. Пусни с: node bot.js create <id>"); process.exit(0); }
  const allow = new Set((CFG.protect.allowlist || []).map((a) => a.toLowerCase()));
  log("🛡 НАБЛЮДЕНИЕ старт — пазя: " + ids.join(", ") + " (guardian " + g.address + ")");
  const watched = ids.map((tid) => { const { d, c } = tokenAt(tid, g); return { tid, d, c, seen: new Set() }; });
  async function scan() {
    for (const w of watched) {
      try {
        const pc = Number(await w.c.pendingCount());
        for (let pid = 1; pid <= pc; pid++) {
          if (w.seen.has(pid)) continue;
          const p = await w.c.pending(pid);
          if (!p.active) { w.seen.add(pid); continue; }
          const fromOwner = p.from.toLowerCase() === w.d.deployer.toLowerCase(); // пазим САМО трезора на бота
          const suspicious = fromOwner && !allow.has(p.to.toLowerCase());
          if (fromOwner) log("[" + w.tid + "] " + (suspicious ? "⚠ ПОДОЗРИТЕЛЕН" : "•") + " чакащ #" + pid + ": " + fmt(p.amount, w.d.decimals) + " " + w.d.symbol + " → " + p.to);
          if (suspicious && CFG.protect.autoCancelSuspicious) {
            try { await (await w.c.cancelPending(pid)).wait(); log("[" + w.tid + "]    🛑 ОТМЕНЕН (възможна кражба) — токените върнати в трезора."); w.seen.add(pid); }
            catch (e) { log("[" + w.tid + "]    ✗ не можах да отменя: " + (e.shortMessage || e.message || "").slice(0, 60)); }
          } else if (!suspicious) { w.seen.add(pid); }
        }
      } catch (e) { log("[" + w.tid + "] scan грешка: " + (e.shortMessage || e.message || "").slice(0, 80)); }
    }
  }
  await scan();
  setInterval(scan, (CFG.protect.pollSec || 10) * 1000);
}

async function walletCmd() {
  const w = deployer();
  const bal = await provider().getBalance(w.address).catch(() => 0n);
  console.log("\nРаботен портфейл (MetaMask акаунт на бота):");
  console.log("  Деплойър/трезор: " + w.address);
  console.log("  Пазач/guardian:  " + guardianWallet().address);
  console.log("  Газ баланс (" + CFG.activeNetwork + "): " + ethers.formatEther(bal) + " " + NET.currency);
  if (NET.faucet) console.log("  Зареди газ от: " + NET.faucet);
  console.log("  Сийд за MetaMask (за твоя достъп за продажба): wallet/SECRET-seed.txt\n");
}

// ══════════════ ПАЗАР (PancakeSwap): ликвидност, цена, търговия, продажба, теглене, съветник ══════════════
const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] path, address to, uint deadline) payable",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)",
  "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)"
];
const FACTORY_ABI = ["function getPair(address,address) view returns (address)"];
const PAIR_ABI = ["function getReserves() view returns (uint112,uint112,uint32)", "function token0() view returns (address)"];
function dex() { const d = NET.dex; if (!d) { console.error("Няма DEX за мрежата " + CFG.activeNetwork); process.exit(1); } return d; }
function deadline() { return Math.floor(Date.now() / 1000) + 600; }
function statsFile(id) { return path.join(__dirname, "deployments", CFG.activeNetwork + "-" + id + ".stats.json"); }

// Временно ИЗКЛЮЧВА guard-а на трезора, за да мине голяма owner-операция (ликвидност/продажба), после го връща.
async function withOwnerGuardOff(id, run) {
  const T = findTok(id); const d = loadDeploy(id); const w = deployer();
  const c = new ethers.Contract(d.address, ARTIFACT.abi, w);
  const gAddr = d.guardian;
  await (await c.setGuard(0, T.ownerGuard.delaySec, gAddr)).wait();       // изключи
  try { return await run(); }
  finally { await (await c.setGuard(units(T.ownerGuard.thresholdTokens, d.decimals), T.ownerGuard.delaySec, gAddr)).wait(); } // върни
}

async function getPairAddr(id) {
  const d = loadDeploy(id); const dx = dex();
  if (d.pair) return d.pair;
  const f = new ethers.Contract(dx.factory, FACTORY_ABI, provider());
  const pair = await f.getPair(d.address, dx.wbnb);
  return pair;
}

// Ботът сам решава колко ликвидност да сложи (по config.market + баланса си).
async function autoLiquidityAmounts(id) {
  const d = loadDeploy(id); const w = deployer(); const M = CFG.market || {};
  const bal = Number(ethers.formatEther(await provider().getBalance(w.address)));
  const reserve = Number(M.gasReserveBnb || 0.02);
  const tokenPct = Number(M.liquidityTokenPercent || 30);
  const tokens = Math.floor(Number(d.supply) * tokenPct / 100);
  let bnb;
  if (M.liquidityBnb === "auto") bnb = Math.max(0, (bal - reserve) * Number(M.autoBnbFraction || 0.5));
  else bnb = Number(M.liquidityBnbAmount || 0.02);
  bnb = Math.min(bnb, Math.max(0, bal - reserve));         // никога под резерва за газ
  bnb = Math.floor(bnb * 1e6) / 1e6;                        // закръгли
  return { bnb, tokens, bal, reserve };
}

// ── LIQUIDITY: пуска пазар (token + BNB). Без сумите → ботът ги попълва сам. ──
async function liquidity(id, bnbAmt, tokenAmt) {
  loadDeploy(id) || (console.error("Токенът " + id + " не е пуснат. Пусни: node bot.js create " + id), process.exit(1));
  if (bnbAmt === undefined || tokenAmt === undefined) {
    const a = await autoLiquidityAmounts(id);
    if (a.bnb <= 0) { log("⛔ Няма достатъчно " + NET.currency + " за ликвидност (баланс " + a.bal.toFixed(4) + ", резерв за газ " + a.reserve + "). Зареди портфейла " + deployer().address + "."); process.exit(1); }
    bnbAmt = a.bnb; tokenAmt = a.tokens;
    log("🤖 Ботът сам попълва ликвидност: " + bnbAmt + " " + NET.currency + " + " + tokenAmt.toLocaleString() + " токена (" + (CFG.market.liquidityTokenPercent) + "% от предлагането)");
  }
  const d = loadDeploy(id); const w = deployer(); const dx = dex();
  const c = new ethers.Contract(d.address, ARTIFACT.abi, w);
  const router = new ethers.Contract(dx.router, ROUTER_ABI, w);
  const tAmt = units(tokenAmt, d.decimals); const bAmt = ethers.parseEther(String(bnbAmt));
  log("Пускам ПАЗАР за " + d.symbol + " в " + dx.name + ": " + tokenAmt + " " + d.symbol + " + " + bnbAmt + " " + NET.currency);
  log("Одобрявам рутера…"); await (await c.approve(dx.router, tAmt)).wait();
  await withOwnerGuardOff(id, async () => {
    log("Добавям ликвидност…");
    await (await router.addLiquidityETH(d.address, tAmt, 0, 0, w.address, deadline(), { value: bAmt })).wait();
  });
  const pair = await getPairAddr(id);
  saveDeploy(id, { ...d, pair });
  log("✅ Пазарът е пуснат. Двойка (pair): " + pair);
  log("   Explorer: " + explorerAddr(pair));
  await price(id);
}

// ── PRICE: чете цената от пула ──
async function readPrice(id) {
  const d = loadDeploy(id); const dx = dex();
  const pair = await getPairAddr(id);
  if (!pair || pair === ethers.ZeroAddress) return null;
  const pc = new ethers.Contract(pair, PAIR_ABI, provider());
  const [r0, r1] = await pc.getReserves();
  const t0 = (await pc.token0()).toLowerCase();
  const tokenIsT0 = t0 === d.address.toLowerCase();
  const tokenRes = tokenIsT0 ? r0 : r1;   // токени в пула
  const bnbRes = tokenIsT0 ? r1 : r0;     // BNB (wbnb) в пула
  if (tokenRes === 0n) return null;
  const priceBnb = Number(ethers.formatEther(bnbRes)) / Number(fmt(tokenRes, d.decimals)); // BNB за 1 токен
  return { pair, priceBnb, tokenRes: fmt(tokenRes, d.decimals), bnbRes: ethers.formatEther(bnbRes) };
}
async function price(id) {
  const d = loadDeploy(id);
  const p = await readPrice(id);
  if (!p) { log("Още няма пазар за " + d.symbol + ". Пусни: node bot.js liquidity " + id + " <bnb> <tokens>"); return null; }
  const supply = Number(d.supply);
  const mcap = p.priceBnb * supply;
  log("💹 " + d.symbol + ": цена " + p.priceBnb.toPrecision(6) + " " + NET.currency + " / токен");
  log("   Пул: " + Number(p.tokenRes).toLocaleString() + " " + d.symbol + " + " + Number(p.bnbRes).toFixed(4) + " " + NET.currency + " (ликвидност)");
  log("   Пазарна капитализация ~ " + mcap.toFixed(4) + " " + NET.currency);
  return p;
}

// ── BUY (демо търсене): swap BNB → токени ──
async function buy(id, bnbAmt) {
  const d = loadDeploy(id); const w = deployer(); const dx = dex();
  const router = new ethers.Contract(dx.router, ROUTER_ABI, w);
  log("[демо] Купувам " + d.symbol + " за " + bnbAmt + " " + NET.currency + " (симулирам търсене)…");
  await (await router.swapExactETHForTokensSupportingFeeOnTransferTokens(0, [dx.wbnb, d.address], w.address, deadline(), { value: ethers.parseEther(String(bnbAmt)) })).wait();
  await price(id);
}

// ── SELL: продажба на токени → BNB (в портфейла на бота) ──
async function sell(id, tokenAmt) {
  const d = loadDeploy(id); const w = deployer(); const dx = dex();
  const p = await readPrice(id);
  if (!p) { log("Няма пазар за продажба. Първо: node bot.js liquidity " + id + " <bnb> <tokens>"); return; }
  const c = new ethers.Contract(d.address, ARTIFACT.abi, w);
  const router = new ethers.Contract(dx.router, ROUTER_ABI, w);
  const tAmt = units(tokenAmt, d.decimals);
  const bnbBefore = await provider().getBalance(w.address);
  log("ПРОДАЖБА: " + tokenAmt + " " + d.symbol + " → " + NET.currency + " (в портфейла на бота)");
  await (await c.approve(dx.router, tAmt)).wait();
  await withOwnerGuardOff(id, async () => {
    await (await router.swapExactTokensForETHSupportingFeeOnTransferTokens(tAmt, 0, [d.address, dx.wbnb], w.address, deadline())).wait();
  });
  const got = await provider().getBalance(w.address) - bnbBefore;
  log("✅ Продадено. Получени ~ " + ethers.formatEther(got) + " " + NET.currency + " (минус газ). Изтегли към твой акаунт с: node bot.js withdraw <сума> <адрес>");
  await price(id);
}

// ── BURN: изгаря токени от трезора (дефлация → цена нагоре) ──
async function burnCmd(id, tokenAmt) {
  const d = loadDeploy(id); const w = deployer();
  const c = new ethers.Contract(d.address, ARTIFACT.abi, w);
  log("🔥 Изгарям " + tokenAmt + " " + d.symbol + " от трезора (дефлация)…");
  await (await c.burn(units(tokenAmt, d.decimals))).wait();
  log("✅ Изгорени. Ново предлагане: " + fmt(await c.totalSupply(), d.decimals) + " " + d.symbol);
  await price(id);
}

// ── WITHDRAW: тегли BNB от бота към твой друг акаунт ──
async function withdraw(bnbAmt, to) {
  const w = deployer();
  if (!to || !ethers.isAddress(to)) { console.error("Дай валиден адрес: node bot.js withdraw <сума> <адрес>"); process.exit(1); }
  log("Тегля " + bnbAmt + " " + NET.currency + " → " + to);
  await (await w.sendTransaction({ to, value: ethers.parseEther(String(bnbAmt)) })).wait();
  log("✅ Изтеглено. Баланс на бота: " + ethers.formatEther(await provider().getBalance(w.address)) + " " + NET.currency);
}

// ── STATS: записва цената във времето + показва тренда ──
async function stats(id) {
  const d = loadDeploy(id); const p = await readPrice(id);
  if (!p) { log("Още няма пазар за статистика."); return; }
  let hist = []; try { hist = JSON.parse(fs.readFileSync(statsFile(id), "utf8")); } catch (_) {}
  hist.push({ t: new Date().toISOString(), priceBnb: p.priceBnb, bnbRes: Number(p.bnbRes), tokenRes: Number(p.tokenRes) });
  fs.writeFileSync(statsFile(id), JSON.stringify(hist, null, 2));
  const first = hist[0].priceBnb, last = p.priceBnb;
  const x = first > 0 ? (last / first) : 1;
  log("📊 " + d.symbol + " статистика (" + hist.length + " записа):");
  log("   Начална цена: " + first.toPrecision(6) + " " + NET.currency);
  log("   Текуща цена:  " + last.toPrecision(6) + " " + NET.currency + "  (× " + x.toFixed(2) + " спрямо старта)");
  log("   Цел: ≥ 5× → " + (x >= 5 ? "🎉 ПОСТИГНАТА!" : "остават × " + (5 / x).toFixed(2)));
}

// ── ADVISE: съветникът предлага легитимни ходове за качване на цената ──
async function advise(id) {
  const d = loadDeploy(id); const w = deployer();
  const c = new ethers.Contract(d.address, ARTIFACT.abi, provider());
  const p = await readPrice(id);
  const treasury = Number(fmt(await c.balanceOf(d.deployer), d.decimals));
  const supply = Number(fmt(await c.totalSupply(), d.decimals));
  console.log("\n🤖 Съветник за " + d.name + " (" + d.symbol + ")");
  if (!p) { console.log("  • Още няма пазар. Ход 1: пусни ликвидност — node bot.js liquidity " + id + " <bnb> <tokens>. Повече начална ликвидност = по-стабилна цена и доверие."); console.log(""); return; }
  let hist = []; try { hist = JSON.parse(fs.readFileSync(statsFile(id), "utf8")); } catch (_) {}
  const first = hist.length ? hist[0].priceBnb : p.priceBnb;
  const x = first > 0 ? p.priceBnb / first : 1;
  const treasuryPct = supply > 0 ? (treasury / supply) * 100 : 0;
  console.log("  Състояние: цена " + p.priceBnb.toPrecision(5) + " " + NET.currency + " (× " + x.toFixed(2) + " от старта); ликвидност " + Number(p.bnbRes).toFixed(3) + " " + NET.currency + "; трезор държи " + treasuryPct.toFixed(1) + "% от предлагането.");
  console.log("  Предложения (легитимни лостове; ти решаваш):");
  const props = [];
  if (treasuryPct > 50) props.push("🔥 Изгори част от трезора (напр. " + Math.round(treasury * 0.1).toLocaleString() + " " + d.symbol + " = 10%) → по-малко предлагане, по-висока оскъдност. node bot.js burn " + id + " <брой>");
  if (Number(p.bnbRes) < 1) props.push("💧 Добави още ликвидност (BNB+токени) → по-малко приплъзване, повече доверие. node bot.js liquidity " + id + " <bnb> <tokens>");
  props.push("🏦 Изкупуване: при спад купи обратно с BNB от фонда → подкрепя цената. node bot.js buy " + id + " <bnb>");
  if (x < 5) props.push("📈 Продавай ЧАСТИЧНО и постепенно (не всичко наведнъж) → взимаш печалба без да сринеш цената. node bot.js sell " + id + " <брой>");
  props.push("🎯 Реалният ръст идва от ТЪРСЕНЕ: полезност, общност, листване. Токеномиката (burn/ликвидност) само помага — не замества истинско търсене.");
  props.forEach((s, i) => console.log("   " + (i + 1) + ") " + s));
  console.log("  Цел ≥ 5×: " + (x >= 5 ? "🎉 постигната." : "продължи с горните ходове + реално търсене.") + "\n");
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
(async () => {
  try {
    if (cmd === "menu" || cmd === "catalog") { menu(); process.exit(0); }
    else if (cmd === "create") await create(a1);
    else if (cmd === "launch") await launch(a1);
    else if (cmd === "list") { list(); process.exit(0); }
    else if (cmd === "status") await status(a1);
    else if (cmd === "send") await send(a1, a2, a3);
    else if (cmd === "wallet" || cmd === "balance") await walletCmd();
    else if (cmd === "liquidity") await liquidity(a1, a2, a3);
    else if (cmd === "price") await price(a1);
    else if (cmd === "buy") await buy(a1, a2);
    else if (cmd === "sell") await sell(a1, a2);
    else if (cmd === "burn") await burnCmd(a1, a2);
    else if (cmd === "withdraw") await withdraw(a1, a2);
    else if (cmd === "stats") await stats(a1);
    else if (cmd === "advise") await advise(a1);
    else if (cmd === "monitor") { await monitor(a1); return; }
    else {
      console.log("Команди:");
      console.log("  menu | create <id> | list | status <id> | monitor [id] | wallet");
      console.log("  launch <id>                       — пуска токена И попълва пазара сам");
      console.log("  send <id> <addr> <amount>         — прехвърляне");
      console.log("  liquidity <id> [bnb] [tokens]     — пуска пазар (без суми → ботът ги попълва сам)");
      console.log("  price <id> | stats <id> | advise <id>   — цена / статистика / съвети");
      console.log("  buy <id> <bnb>                    — [демо] купи (симулира търсене)");
      console.log("  sell <id> <tokens>                — продай токени → BNB (в бота)");
      console.log("  burn <id> <tokens>                — изгори от трезора (дефлация)");
      console.log("  withdraw <bnb> <addr>             — тегли BNB към твой акаунт");
      process.exit(0);
    }
    if (cmd !== "monitor") process.exit(0);
  } catch (e) { console.error("ГРЕШКА:", e.shortMessage || e.message || e); process.exit(1); }
})();
