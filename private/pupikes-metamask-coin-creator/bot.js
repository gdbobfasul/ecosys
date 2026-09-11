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
//   autopilot <id> [bnb] [--all] [--vault <адрес>]  → ВСИЧКО само: MetaMask в Edge → чака превод → деплой → пазар → охрана
//   page <id> | index → (пре)генерира страницата на токена (https://pupikes.com/crypto/<slug>/ + admin/ + псевдоним /crypto/<символ>/) и индекса /crypto/
//   adopt <id> <адрес> → записва токен, пуснат от админ страницата (deployments + страници + private/crypto); без транзакции
//   block <id> <адрес…> | unblock <id> <адрес…> | blocked <id> → блокиране на адреси (само V2 договорите; MEV роботи — config protect.knownBots)
//   open <id> [сек]   → отваря търговията на V2 токен (ВЕДНЪЖ; ботът сам го прави след ликвидността, market.tradingDelaySec)
//   tg setup <botToken> <@канал> [--lang bg,en] | tg test | tg status | tg post "<текст>" [id] | tg weekly [id] | tg auto on|off
//                     → Telegram канал на токените (telegram.js, wallet/telegram.json); авто-постове при create/liquidity/burn/withdraw/ръст на цената
//   --vault <адрес|№> → работи с избран трезор от регистъра (wallet/vaults.json); по подразбиране текущия wallet/
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
// Всеки токен може да е различен контракт (поле "contract" в каталога/деплоя).
// (11.09.2026) НОВИ токени → PupikesFeatureTokenV2 (с блокиране на адреси). Запис в deployments/ БЕЗ поле contract = стар
// PupikesFeatureToken (пуснат преди V2) → artifactFor(d.contract) дава стария ABI (HRVS остава на своя договор/ABI).
const DEFAULT_CONTRACT = "PupikesFeatureTokenV2";
function catContract(T) { return (T && T.contract) || DEFAULT_CONTRACT; }   // договорът за НОВ деплой от каталога
function artifactFor(name) { const n = name || "PupikesFeatureToken"; return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../token/artifacts/token/contracts/" + n + ".sol/" + n + ".json"), "utf8")); }
function abiOf(d) { return artifactFor(d && d.contract).abi; }                 // ABI на ПУСНАТ токен (по записа му в deployments/)
function hasFn(abi, name) { return (abi || []).some((x) => x.type === "function" && x.name === name); }
const NET = CFG.networks[CFG.activeNetwork];
if (!NET) { console.error("Непозната мрежа в config.activeNetwork: " + CFG.activeNetwork); process.exit(1); }

let LOGFILE = null;   // autopilot → wallet/autopilot.log (всеки ред от дневника и в конзолата, и във файла)
function log(s) { const line = new Date().toISOString().slice(11, 19) + "  " + s; console.log(line); if (LOGFILE) { try { fs.appendFileSync(LOGFILE, new Date().toISOString().slice(0, 10) + " " + line + require("os").EOL); } catch (_) {} } }
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
function saveDeploy(id, d) { const f = deployFile(id); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2)); recordNow(id); }
function loadDeploy(id) { try { return JSON.parse(fs.readFileSync(deployFile(id), "utf8")); } catch (_) { return null; } }
// (11.09.2026) ЗАДЪЛЖИТЕЛЕН запис на всички публични данни за токена в private/crypto/<ИмеНаТокена>/ (record.js).
function recordNow(id, extra) {
  try {
    const { recordToken } = require("./record.js");
    const dep = loadDeploy(id); if (!dep) return null;
    const cat = CAT.find((t) => t.id === id) || null;
    let st = null; try { st = JSON.parse(fs.readFileSync(path.join(__dirname, "deployments", CFG.activeNetwork + "-" + id + ".stats.json"), "utf8")); } catch (_) {}
    const dir = recordToken({ dep, cat, stats: st, extra: extra || {}, network: Object.assign({ key: CFG.activeNetwork }, NET) });
    if (dir) console.log("   \u{1F5C2} Запис на токена: " + path.relative(path.resolve(__dirname, "../.."), dir).replace(/\\/g, "/") + "/");
    return dir;
  } catch (e) { console.log("  (записът в private/crypto не успя: " + (e.message || e) + ")"); return null; }
}
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
  const ART = artifactFor(catContract(T));   // ★ различен контракт според каталога (напр. PupikesSentinelTokenV2); липсва → PupikesFeatureTokenV2
  // PupikesFeatureToken/Sentinel приемат struct Params (един аргумент); guard-контрактът — позиционни.
  const F = new ethers.ContractFactory(ART.abi, ART.bytecode, w);
  const usesStruct = ART.abi.some((x) => x.type === "constructor" && (x.inputs || []).some((i) => (i.internalType || "").includes("Params")));
  const c = usesStruct
    ? await F.deploy({ name: T.name, symbol: T.symbol, decimals: dec, initialSupply: units(T.supply, dec),
        defaultThreshold: units(p.defaultThresholdTokens, dec), defaultDelay: p.defaultDelaySec,
        burnFeeBps: p.burnFeeBps, fundFeeBps: p.fundFeeBps, fundWallet, maxTxBps: p.maxTxBps, maxWalletBps: p.maxWalletBps })
    : await F.deploy(params);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  let deployTx = null, deployBlock = null;   // за „blocked <id>“ (събитията се четат от блока на деплоя)
  try { const dt = c.deploymentTransaction(); if (dt) { deployTx = dt.hash; const rc = await dt.wait(); deployBlock = rc ? rc.blockNumber : null; } } catch (_) {}
  // Защита на ТРЕЗОРА на бота: собственикът получава своя guard с пазач = guardian акаунта → monitor може да отменя кражби.
  const gAddr = guardianWallet().address;
  await ensureGuardianGas(w, gAddr);   // ботът сам зарежда пазача с малко газ (за да може да отменя кражби)
  const t2 = new ethers.Contract(addr, ART.abi, deployer());
  await (await t2.setGuard(units(T.ownerGuard.thresholdTokens, dec), T.ownerGuard.delaySec, gAddr)).wait();
  saveDeploy(id, { id, address: addr, name: T.name, symbol: T.symbol, decimals: dec, supply: T.supply, deployer: w.address, guardian: gAddr, network: CFG.activeNetwork, chainId: Number(net.chainId), special: T.special, contract: catContract(T), txHash: deployTx, deployBlock, deployedAt: new Date().toISOString() });
  log("✅ ПУСНАТ: " + T.name + " (" + T.symbol + ") @ " + addr);
  log("   Специфичност: " + T.special);
  log("   🛡 Трезорът е защитен (пазач " + gAddr + ", праг " + T.ownerGuard.thresholdTokens + ")");
  log("   Explorer: " + explorerAddr(addr));
  log("   → Добави в MetaMask като custom token с адрес: " + addr + "  (или бутона „Добави в MetaMask“ на страницата)");
  // (11.09.2026) Договор с блокиране (V2) → блокира известните MEV роботи (config protect.knownBots) ПРЕДИ ликвидността.
  let blockErr = null;
  if (hasFn(ART.abi, "setBlockedMany")) blockErr = await blockKnownBots(id, t2).then(() => null, (e) => e);
  else log("   ℹ Договорът " + catContract(T) + " няма блокиране на адреси — известните роботи не се блокират.");
  if (blockErr) {
    generatePage(id); generateIndex();
    throw new Error("Блокирането на известните роботи НЕ мина (" + String(blockErr.shortMessage || blockErr.message || blockErr).slice(0, 160) + "). Токенът е пуснат, но ликвидност НЕ пускам. Повтори: node bot.js block " + id + " " + knownBots().join(" ") + " — после liquidity.");
  }
  if (CFG.market && CFG.market.autoLiquidityOnCreate && NET.dex) { log("— Авто-ликвидност (по config)…"); await liquidity(id); }
  if (hasFn(ART.abi, "openTrading")) {
    const ts = await tradingState(loadDeploy(id)).catch(() => null);
    if (ts && ts.openAt === "closed") log("⚠ Търговията на " + T.symbol + " е ЗАТВОРЕНА до ликвидността (никой не може да купи/продаде). liquidity " + id + " я отваря сама " + Math.round(tradingDelay() / 60) + " мин. след добавянето; ръчно: node bot.js open " + id + ".");
  }
  generatePage(id); generateIndex();   // ботът сам публикува страницата на токена под public/crypto/<slug>/ + индекса
  log("   🌐 Страница: " + pageUrl(id));
  await tgNotify("create", { ctx: tgCtx(id) });
  return addr;
}

// ── PAGE: ботът генерира публична страница за токена под public/crypto/<slug>/index.html ──
// Публичен адрес: https://pupikes.com/crypto/<slug>/ (сървърът сервира public/ след деплой).
// (11.09.2026) Страницата показва ЖИВА статистика от веригата (live.js: цена в BNB и USD, токени и BNB в пула, общо/изгорени,
// трезор/фонд и %, капитализация, такси/лимити, охрана; 30 s; публични RPC с резервни; резерв stats.json до страницата),
// bg/en превключвател, QR, „Добави в MetaMask" (EIP-747), BscScan/PancakeSwap. До нея: admin/ (dapp — всяко действие се подписва
// в MetaMask на трезора; страницата няма ключове) и псевдоним по символ /crypto/<символ>/ (→ пренасочване) + /crypto/<символ>/admin/.
// JS източниците са в web/ (live.js, admin.js, admin.html, index-live.js) — генераторът ги копира.
const PUBLIC_BASE = "https://pupikes.com";
const ETHERS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js";
const QR_CDN = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
const DEAD_ADDR = "0x000000000000000000000000000000000000dEaD";
// BNB/USD = резервите на PancakeSwap v2 двойката USDT/WBNB (проверено 11.09.2026: factory.getPair(WBNB, USDT) = този адрес).
const USD_PAIRS = { 56: { pair: "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE", usdt: "0x55d398326f99059fF775485246999027B3197955" } };
// Резервни публични RPC за браузъра (първо е rpc от config.json; config може да добави networks.<мрежа>.publicRpcs).
const EXTRA_RPCS = { 56: ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.defibit.io", "https://bsc-rpc.publicnode.com", "https://1rpc.io/bnb"],
                     97: ["https://data-seed-prebsc-2-s1.bnbchain.org:8545", "https://bsc-testnet-rpc.publicnode.com"] };
function publicRpcs(netKey) {
  const n = CFG.networks[netKey || CFG.activeNetwork] || NET;
  const own = n.rpc && !/127\.0\.0\.1|localhost/.test(n.rpc) ? [n.rpc] : [];
  return [...new Set([].concat(n.publicRpcs || [], own, EXTRA_RPCS[n.chainId] || []))];
}
function webDir() { return path.join(__dirname, "web"); }
function shortHash(s) { return require("crypto").createHash("sha1").update(String(s)).digest("hex").slice(0, 10); }
function jsonForScript(o) { return JSON.stringify(o).replace(/</g, "\\u003c"); }
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function cryptoDir() { return path.resolve(__dirname, "../../public/crypto"); }
function pageSlug(id) { return slugify(findTok(id).name); }
function pageUrl(id) { return PUBLIC_BASE + "/crypto/" + pageSlug(id) + "/"; }
function adminUrl(id) { return pageUrl(id) + "admin/"; }
function lastStats(id) { try { const h = JSON.parse(fs.readFileSync(statsFile(id), "utf8")); return h.length ? h[h.length - 1] : null; } catch (_) { return null; } }
function dexSwapUrl(d) { const base = "https://pancakeswap.finance/swap?outputCurrency=" + d.address; return d.network === "bscTestnet" ? base + "&chain=bscTestnet" : base + "&chain=bsc"; }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
function netLabelOf(d) { return d.network === "bscMainnet" ? "BNB Smart Chain — Mainnet (chainId 56)" : d.network === "bscTestnet" ? "BNB Smart Chain — Testnet (chainId 97)" : d.network + " (chainId " + d.chainId + ")"; }
function netNameOf(d) { return d.network === "bscMainnet" ? "BNB Smart Chain" : d.network === "bscTestnet" ? "BNB Smart Chain Testnet" : d.network; }

// (11.09.2026) Telegram канал на токените (telegram.js): публичните данни за съобщенията + безопасно извикване (никога не спира бота).
function tgCtx(id) {
  const T = CAT.find((x) => x.id === id); const d = loadDeploy(id); if (!T || !d) return null;
  const p = T.params || {}; const pair = d.pair && d.pair !== ethers.ZeroAddress ? d.pair : null;
  return { id, name: d.name, symbol: d.symbol, address: d.address, network: d.network, chainId: Number(d.chainId), testnet: d.network !== "bscMainnet",
    netName: netNameOf(d), currency: NET.currency, explorer: NET.explorer || "", pageUrl: pageUrl(id), pair, swapUrl: pair ? dexSwapUrl(d) : null,
    sourcify: d.sourcify || null, supply: Number(d.supply), fundFeeBps: p.fundFeeBps || 0, burnFeeBps: p.burnFeeBps || 0,
    special: T.special, specialEn: (T.en || {}).special || T.special, specialRu: (T.ru || {}).special || null };
}
async function tgNotify(event, data) {
  try { const r = await require("./telegram.js").notify(event, data); if (r && r.msg) log(r.msg); return r; }
  catch (e) { log("  (Telegram: " + String(e.message || e).slice(0, 160) + ")"); return null; }
}

// Публичната конфигурация на токена (вгражда се в страницата и в админа). САМО публични данни — никакви ключове.
function pageCfg(id) {
  const T = findTok(id); const d = loadDeploy(id); const p = T.params || {};
  const up = USD_PAIRS[Number(d.chainId)] || null; const slug = pageSlug(id);
  const last = lastStats(id);
  return {
    id, name: T.name, symbol: T.symbol, decimals: d.decimals, address: d.address, chainId: Number(d.chainId), network: d.network, netName: netNameOf(d),
    currency: NET.currency, explorer: NET.explorer || "", rpcs: publicRpcs(d.network),
    pair: d.pair && d.pair !== ethers.ZeroAddress ? d.pair : null, wbnb: NET.dex ? NET.dex.wbnb : ethers.ZeroAddress,
    dex: NET.dex ? { router: NET.dex.router, factory: NET.dex.factory, name: NET.dex.name } : null,
    usdPair: up ? up.pair : null, usdt: up ? up.usdt : null,
    treasury: d.deployer, guardian: d.guardian || null, initialSupply: Number(d.supply),
    burnFeeBps: p.burnFeeBps || 0, fundFeeBps: p.fundFeeBps || 0, maxTxBps: p.maxTxBps || 0, maxWalletBps: p.maxWalletBps || 0,
    ownerGuard: T.ownerGuard || null, contract: d.contract || "PupikesFeatureToken",
    knownBots: knownBots(), deployBlock: Number.isInteger(d.deployBlock) ? d.deployBlock : null,
    hasTrading: hasFn(abiOf(d), "openTrading"), tradingDelaySec: tradingDelay(),   // затворена търговия до openTrading (V2)   // за секцията „Блокиране“ и „Създай нов токен“ в админа
    slug, pagePath: "/crypto/" + slug + "/", pageUrl: pageUrl(id), adminUrl: adminUrl(id), aliasPath: "/crypto/" + slugify(T.symbol) + "/",
    swapUrl: d.pair ? dexSwapUrl(d) : null,
    deployedIds: CAT.filter((t) => loadDeploy(t.id)).map((t) => t.id),
    last: last || null
  };
}

// public/crypto/<slug>/stats.json — последното записано състояние (резерв на live.js, ако веригата не отговаря) + история на цената.
function writePublicStats(id, snap) {
  const d = loadDeploy(id); if (!d) return null;
  let hist = []; try { hist = JSON.parse(fs.readFileSync(statsFile(id), "utf8")); } catch (_) {}
  const last = snap || (hist.length ? hist[hist.length - 1] : null);
  if (!last) return null;
  const out = Object.assign({ _note: "Последно записано състояние от веригата (резерв на страницата). Обновява: node bot.js stats " + id,
    network: d.network, chainId: Number(d.chainId), symbol: d.symbol, address: d.address, pair: d.pair || null, decimals: d.decimals, initialSupply: Number(d.supply) }, last,
    { history: hist.slice(-500).map((h) => ({ t: h.t, priceBnb: h.priceBnb, priceUsd: h.priceUsd == null ? null : h.priceUsd, tokenRes: h.tokenRes, bnbRes: h.bnbRes })) });
  const f = path.join(cryptoDir(), pageSlug(id), "stats.json");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(out, null, 1), "utf8");
  return f;
}

// public/crypto/<slug>/admin/ — index.html (от web/admin.html) + admin.js (копие) + artifact.js (ПУБЛИЧЕН ABI + bytecode + пресети).
function generateAdmin(id, cfg) {
  const dir = path.join(cryptoDir(), cfg.slug, "admin");
  fs.mkdirSync(dir, { recursive: true });
  // (11.09.2026) „Създай нов токен“ деплойва НОВИЯ договор (DEFAULT_CONTRACT = PupikesFeatureTokenV2, с блокиране);
  // ABI за действията = договорът на ТОЗИ токен (HRVS → стария PupikesFeatureToken, без блокиране).
  const featArt = artifactFor(DEFAULT_CONTRACT);
  const tokAbi = cfg.contract === DEFAULT_CONTRACT ? featArt.abi : artifactFor(cfg.contract).abi;
  const presets = CAT.filter((t) => catContract(t) === DEFAULT_CONTRACT)
    .map((t) => ({ id: t.id, name: t.name, symbol: t.symbol, decimals: t.decimals, supply: t.supply, special: t.special, params: t.params, ownerGuard: t.ownerGuard }));
  const artJs = "// Генерирано от PupikesMetamaskCoinCreator — ПУБЛИЧЕН ABI + bytecode на " + DEFAULT_CONTRACT + " и пресетите от каталога (без ключове/тайни).\n" +
    "// Ползва се от admin.js за действията и за „Създай нов токен“ (нов договор; договорът няма mint).\n" +
    "window.PUPIKES_ARTIFACT = " + JSON.stringify({ contract: DEFAULT_CONTRACT, tokenContract: cfg.contract, abi: tokAbi,
      deployAbi: cfg.contract === DEFAULT_CONTRACT ? null : featArt.abi, bytecode: featArt.bytecode, presets }) + ";\n";
  const adminJs = fs.readFileSync(path.join(webDir(), "admin.js"), "utf8");
  fs.writeFileSync(path.join(dir, "artifact.js"), artJs, "utf8");
  fs.writeFileSync(path.join(dir, "admin.js"), adminJs, "utf8");
  const html = fs.readFileSync(path.join(webDir(), "admin.html"), "utf8")
    .split("__GEN__").join("Version: 1.0002 · генерирано от PupikesMetamaskCoinCreator · " + cfg.address + " · " + new Date().toISOString())
    .split("__TITLE__").join(esc(cfg.name + " (" + cfg.symbol + ") — админ"))
    .split("__ETHERS__").join(ETHERS_CDN)
    .split("__BASE__").join("/crypto/" + cfg.slug + "/admin/")
    .split("__V__").join(shortHash(artJs + adminJs))
    .split("__CFG__").join(jsonForScript(cfg));
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
  log("   🔧 Админ: public/crypto/" + cfg.slug + "/admin/  → " + cfg.adminUrl);
  return html;
}

// Псевдоним по символ: /crypto/<символ>/ → пренасочва към /crypto/<slug>/; /crypto/<символ>/admin/ = същата админ страница.
// Не пипа папка, която не е създадена от бота (напр. ръчните /crypto/token/, /crypto/brch1/).
function writeSymbolAlias(cfg, adminHtml) {
  const a = slugify(cfg.symbol);
  if (!a || a === cfg.slug) return null;
  const dir = path.join(cryptoDir(), a), idx = path.join(dir, "index.html");
  if (fs.existsSync(dir) && !(fs.existsSync(idx) && /PupikesMetamaskCoinCreator/.test(fs.readFileSync(idx, "utf8")))) { log("   ↷ /crypto/" + a + "/ е заета от друга страница — псевдоним по символ пропуснат"); return null; }
  const to = "/crypto/" + cfg.slug + "/";
  const html = `<!-- PupikesMetamaskCoinCreator · псевдоним по символ ${cfg.symbol} → ${to} · ${cfg.address} -->
<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=${to}">
    <link rel="canonical" href="${cfg.pageUrl}">
    <title>${esc(cfg.symbol)} → ${esc(cfg.name)}</title>
    <script>location.replace(${JSON.stringify(to)} + location.search + location.hash);</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:40px;text-align:center">
    <p>→ <a href="${to}">${esc(cfg.name)} (${esc(cfg.symbol)})</a> · <a href="${to}admin/">админ</a></p>
</body>
</html>
`;
  fs.mkdirSync(path.join(dir, "admin"), { recursive: true });
  fs.writeFileSync(idx, html, "utf8");
  fs.writeFileSync(path.join(dir, "admin", "index.html"), adminHtml, "utf8");
  log("   🔗 Псевдоним: /crypto/" + a + "/ → " + to + " · админ: " + PUBLIC_BASE + "/crypto/" + a + "/admin/");
  return dir;
}

function generatePage(id) {
  const T = findTok(id); const d = loadDeploy(id);
  if (!d) { log("↷ страница пропусната — токенът " + id + " не е пуснат"); return null; }
  const TE = T.en || {};
  const slug = pageSlug(id);
  const dir = path.join(cryptoDir(), slug);
  const p = T.params || {}; const og = T.ownerGuard || {};
  const netLabel = netLabelOf(d);
  const isTest = /testnet/i.test(d.network);
  const scan = (a) => NET.explorer ? NET.explorer + "/address/" + a : "#";
  const explorer = NET.explorer ? NET.explorer + "/address/" + d.address : d.address;
  const explorerTok = NET.explorer ? NET.explorer + "/token/" + d.address : explorer;
  const explorerHost = (NET.explorer || "").replace(/^https?:\/\//, "") || "explorer";
  const created = (d.deployedAt || "").slice(0, 10);
  const st = lastStats(id);
  const hasMarket = !!(d.pair && d.pair !== ethers.ZeroAddress);
  const guarded = p.defaultThresholdTokens > 0 || og.thresholdTokens > 0;
  const sym = T.symbol, cur = NET.currency;
  const L = (bg, en) => '<span data-en="' + esc(en) + '">' + bg + "</span>";   // bg/en: live.js сменя съдържанието по data-en
  const mins = (s) => Math.round((s || 0) / 60);
  // характеристики според пресета
  const feats = [];
  if (guarded) feats.push([L("🛡 Защита от кражба (Vault Guard)", "🛡 Theft protection (Vault Guard)"), [
    L("Голям превод се <strong>задържа</strong>, не се изпълнява веднага", "A large transfer is <strong>held</strong>, not executed immediately"),
    L("Пазачът може да <strong>отмени</strong> подозрителен задържан превод", "The guardian can <strong>cancel</strong> a suspicious held transfer"),
    L("Праг за холдър: " + (p.defaultThresholdTokens || 0) + " " + sym + " · за трезора: " + (og.thresholdTokens || 0) + " " + sym, "Holder threshold: " + (p.defaultThresholdTokens || 0) + " " + sym + " · treasury: " + (og.thresholdTokens || 0) + " " + sym),
    L("Период на изчакване: " + mins(p.defaultDelaySec || og.delaySec) + " мин.", "Waiting period: " + mins(p.defaultDelaySec || og.delaySec) + " min")]]);
  if (p.burnFeeBps > 0) feats.push([L("🔥 Изгаряне при превод", "🔥 Burn on transfer"), [L((p.burnFeeBps / 100) + "% от всеки превод се изгаря", (p.burnFeeBps / 100) + "% of every transfer is burned"), L("Намаляващо предлагане → скъдност", "Shrinking supply → scarcity")]]);
  if (p.fundFeeBps > 0) feats.push([L("🏦 Фонд при превод", "🏦 Fund on transfer"), [L((p.fundFeeBps / 100) + "% от всеки превод към прозрачен фонд", (p.fundFeeBps / 100) + "% of every transfer goes to a transparent fund"), L("Захранва награди / обратно изкупуване", "Powers rewards / buybacks")]]);
  if (p.maxTxBps > 0 || p.maxWalletBps > 0) feats.push([L("🐋 Анти-кит лимити", "🐋 Anti-whale limits"), [
    (p.maxTxBps > 0 ? L("Макс. " + (p.maxTxBps / 100) + "% на превод", "Max " + (p.maxTxBps / 100) + "% per transfer") : "—"),
    (p.maxWalletBps > 0 ? L("Макс. " + (p.maxWalletBps / 100) + "% на портфейл", "Max " + (p.maxWalletBps / 100) + "% per wallet") : "—")]]);
  feats.push([L("⚙ Управление от бота", "⚙ Managed by the bot"), [
    L("Ботът следи задържаните трансфери в реално време", "The bot watches held transfers in real time"),
    L("Авто-отменя подозрителни изходящи преводи от трезора", "It auto-cancels suspicious outgoing transfers from the treasury"),
    L("Отчита статистика и предлага легитимни ходове", "It records statistics and suggests legitimate moves"),
    L("Защитата е срещу крадци — <strong>не</strong> срещу собственика", "The protection is against thieves — <strong>not</strong> against the owner")]]);
  const featBoxes = feats.map((f) => '                <div class="box">\n                    <h3>' + f[0] + "</h3>\n                    <ul>" +
    f[1].map((li) => "<li>" + li + "</li>").join("") + "</ul>\n                </div>").join("\n");
  const totalFee = ((p.burnFeeBps || 0) + (p.fundFeeBps || 0)) / 100;
  // начални стойности (без JS/преди първото четене) — от последния запис; live.js ги обновява от веригата
  const n0 = (x) => Math.round(Number(x)).toLocaleString("bg-BG");
  const sg = (x) => Number(Number(x).toPrecision(5)).toString();
  const priceTxt = st && st.priceBnb ? sg(st.priceBnb) + " " + cur : (hasMarket ? "—" : "няма пазар");
  const poolTxt = st && st.tokenRes != null ? n0(st.tokenRes) + " " + sym : (hasMarket ? "—" : "няма пазар");
  const supplyTxt = n0(st && st.totalSupply != null ? st.totalSupply : T.supply);
  const mcapTxt = st && st.priceBnb ? sg(st.priceBnb * (st.totalSupply != null ? st.totalSupply - (st.dead || 0) : Number(T.supply))) + " " + cur : "—";
  // файловете до страницата: live.js, stats.json, admin/, псевдоним по символ
  const cfg = pageCfg(id);
  fs.mkdirSync(dir, { recursive: true });
  const liveJs = fs.readFileSync(path.join(webDir(), "live.js"), "utf8");
  fs.writeFileSync(path.join(dir, "live.js"), liveJs, "utf8");
  writePublicStats(id);
  const adminHtml = generateAdmin(id, cfg);
  writeSymbolAlias(cfg, adminHtml);
  const row = (kBg, kEn, vid, init) => '                <tr><td class="k">' + L(kBg, kEn) + '</td><td class="v" id="' + vid + '">' + (init || "—") + "</td></tr>";
  const html = `<!-- Version: 1.0003 · генерирано от PupikesMetamaskCoinCreator · ${d.address} · ${new Date().toISOString()} -->
<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${esc(T.name)} (${sym}) — ${esc(T.special)}">
    <title>${esc(T.name)} (${sym})</title>
    <link rel="canonical" href="${pageUrl(id)}">
    <link rel="stylesheet" href="/shared/css/common.css?v=1.0115">
    <style>
        :root { --brand:#1f8a5b; --brand2:#0f5c3c; --ink:#16301f; --muted:#5a6b60; --card:#fff; --ground:#f4f8f5; --line:#dbe7de; }
        * { box-sizing:border-box; } body { margin:0; font-family:system-ui,"Segoe UI",Roboto,sans-serif; color:var(--ink); background:var(--ground); }
        .lang { position:fixed; top:12px; right:12px; z-index:50; background:rgba(255,255,255,.94); border:1px solid var(--line); border-radius:999px; padding:3px; box-shadow:0 4px 12px rgba(0,0,0,.14); }
        .lang button { border:0; background:transparent; padding:6px 12px; border-radius:999px; font-weight:700; cursor:pointer; color:var(--muted); font-size:.95em; }
        .lang button.on { background:var(--brand); color:#fff; }
        .hero { background:linear-gradient(135deg,var(--brand) 0%,var(--brand2) 100%); color:#fff; padding:80px 20px 90px; text-align:center; border-radius:0 0 30px 30px; }
        .hero .shield { font-size:4em; line-height:1; } .hero h1 { font-size:2.8em; margin:12px 0 6px; }
        .hero .sym { display:inline-block; background:rgba(255,255,255,.18); padding:4px 14px; border-radius:999px; font-weight:600; letter-spacing:1px; }
        .hero p { font-size:1.2em; opacity:.95; max-width:720px; margin:18px auto 0; }
        .net-badge { display:inline-block; margin-top:18px; background:#ffd84d; color:#4a3b00; font-weight:700; padding:6px 16px; border-radius:999px; font-size:.95em; }
        .container { max-width:1100px; margin:0 auto; padding:0 20px; }
        .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:22px; margin:-50px auto 14px; max-width:1100px; position:relative; }
        .stat-card { background:var(--card); padding:22px 20px; border-radius:16px; box-shadow:0 10px 30px rgba(20,48,31,.10); text-align:center; border:1px solid var(--line); }
        .stat-card h3 { color:var(--brand); font-size:1.45em; margin:0 0 4px; word-break:break-word; } .stat-card p { color:var(--muted); margin:0; font-size:1.02em; }
        .stat-card .sub { color:var(--ink); font-weight:600; min-height:1.3em; margin:0 0 6px; font-size:.95em; word-break:break-word; }
        .live-bar { text-align:center; color:var(--muted); margin:0 0 30px; font-size:.95em; min-height:1.3em; }
        section { margin:50px 0; } h2 { color:var(--brand2); font-size:1.7em; border-left:5px solid var(--brand); padding-left:12px; }
        .grid2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:22px; }
        .box { background:var(--card); padding:26px; border-radius:16px; box-shadow:0 5px 15px rgba(20,48,31,.08); border:1px solid var(--line); }
        .box h3 { color:var(--brand); margin:0 0 12px; font-size:1.3em; } .box ul { list-style:none; padding:0; margin:0; }
        .box li { padding:7px 0; color:#37483d; } .box li::before { content:"✓ "; color:var(--brand); font-weight:700; }
        .tscroll { overflow-x:auto; }
        .data-table { width:100%; border-collapse:collapse; background:var(--card); border-radius:16px; overflow:hidden; box-shadow:0 5px 15px rgba(20,48,31,.08); border:1px solid var(--line); }
        .data-table td { padding:13px 18px; border-bottom:1px solid var(--line); vertical-align:top; } .data-table tr:last-child td { border-bottom:none; }
        .data-table td.k { color:var(--muted); font-weight:600; width:34%; } .data-table td.v { font-family:ui-monospace,Consolas,monospace; word-break:break-word; } .data-table a { color:var(--brand); }
        .small-note { color:var(--muted); font-size:.92em; margin-top:10px; line-height:1.5; }
        .steps { counter-reset:s; padding:0; list-style:none; }
        .steps li { counter-increment:s; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 18px 18px 60px; margin-bottom:14px; position:relative; }
        .steps li::before { content:counter(s); position:absolute; left:16px; top:16px; width:30px; height:30px; background:var(--brand); color:#fff; border-radius:50%; display:grid; place-items:center; font-weight:700; }
        .note { background:#fff8e1; border:1px solid #ffe08a; border-radius:14px; padding:16px 18px; color:#5a4600; }
        footer { text-align:center; color:var(--muted); padding:40px 20px; font-size:.95em; } footer a { color:var(--brand); }
        .cta { display:inline-block; margin:6px; background:var(--brand); color:#fff; text-decoration:none; padding:12px 22px; border-radius:10px; font-weight:600; border:2px solid var(--brand); cursor:pointer; font-size:1em; } .cta.sec { background:transparent; color:var(--brand); }
        .cta.mm { background:#f6851b; border-color:#f6851b; }
        .mmrow { display:grid; grid-template-columns:1fr auto; gap:24px; align-items:center; } @media (max-width:700px) { .mmrow { grid-template-columns:1fr; } .hero h1 { font-size:2.1em; } }
        #qr { background:#fff; padding:10px; border-radius:12px; border:1px solid var(--line); display:inline-block; } #qr img, #qr canvas { display:block; }
        .addr { font-family:ui-monospace,Consolas,monospace; word-break:break-all; background:#eef5f0; padding:10px 12px; border-radius:10px; }
        #mmStatus { color:var(--muted); margin-top:8px; min-height:1.2em; }
    </style>
</head>
<body>
    <div class="lang" role="group" aria-label="Език / Language"><button type="button" data-lang="bg">BG</button><button type="button" data-lang="en">EN</button></div>
    <div class="hero">
        <div class="shield">${guarded ? "🛡" : "🪙"}</div>
        <h1>${esc(T.name)}</h1>
        <div class="sym">${sym}</div>
        <p>${L(esc(T.special), esc(TE.special || T.special))}</p>
        <div class="net-badge">⛓ ${L("Мрежа", "Network")}: ${netLabel}${isTest ? L(" — тестова версия", " — test version") : ""}</div>
    </div>
    <div class="container">
        <div class="stats">
            <div class="stat-card"><h3 id="vPrice">${priceTxt}</h3><div class="sub" id="vPriceUsd"></div><p>${L("Цена", "Price")}</p></div>
            <div class="stat-card"><h3 id="vPool">${poolTxt}</h3><div class="sub" id="vPoolBnb"></div><p>${L("Токени в пула", "Tokens in the pool")}</p></div>
            <div class="stat-card"><h3 id="vSupply">${supplyTxt}</h3><div class="sub" id="vBurnedTop"></div><p>${L("Общо токени", "Total supply")} (${sym})</p></div>
            <div class="stat-card"><h3 id="vMcap">${mcapTxt}</h3><div class="sub" id="vMcapUsd"></div><p>${L("Пазарна капитализация", "Market cap")}</p></div>
        </div>
        <div class="live-bar" id="liveStatus"></div>
        <section id="stats"><h2>${L("Статистика на живо", "Live statistics")}</h2>
            ${hasMarket ? "" : '<div class="box" style="margin-bottom:16px"><p style="margin:0;color:#37483d">' + L("Още няма пазар (ликвидност) за " + sym + ". Добавя се от админ страницата или с <code>node bot.js liquidity " + id + " &lt;bnb&gt; &lt;tokens&gt;</code>.", "There is no market (liquidity) for " + sym + " yet.") + "</p></div>"}
            <div class="tscroll"><table class="data-table">
${[
    row("Цена", "Price", "tPriceBnb"), row("Цена в USD", "Price in USD", "tPriceUsd"),
    row("Токени в пула", "Tokens in the pool", "tPoolTok"), row(cur + " в пула", cur + " in the pool", "tPoolBnb"), row("Ликвидност общо (USD)", "Total liquidity (USD)", "tPoolUsd"),
    row("Общо токени (сега)", "Total supply (now)", "tSupply"), row("Начално предлагане", "Initial supply", "tInitial", n0(d.supply) + " " + sym),
    row("Изгорени общо", "Burned in total", "tBurned"), row("На адрес 0x…dEaD", "At address 0x…dEaD", "tDead"),
    row("Трезор (създател)", "Treasury (creator)", "tTreasury"), row("Фонд", "Fund", "tFund"), row("В обращение (без трезор/фонд/пул)", "Circulating (excl. treasury/fund/pool)", "tCirc"),
    row("Пазарна капитализация", "Market cap", "tMcap"), row("Курс " + cur + "/USD", cur + "/USD rate", "tBnbUsd"),
    row("Такси при превод", "Transfer fees", "tFees"), row("Лимити", "Limits", "tLimits"), row("Охрана (Vault Guard)", "Guard (Vault Guard)", "tGuard"),
    row("Задържани преводи", "Held transfers", "tPending"), row("Собственик на договора", "Contract owner", "tOwner")
  ].concat(cfg.hasTrading ? [row("Търговия", "Trading", "tTrading", esc(tradeText(st && st.tradingOpenAt != null ? st.tradingOpenAt : (hasMarket ? null : "closed"), Math.floor(Date.now() / 1000)) || "—"))] : []).join("\n")}
            </table></div>
            <p class="small-note">${L("Числата се четат директно от веригата (договорът и PancakeSwap двойката) и се обновяват на всеки 30 s. Цена в USD = цена в " + cur + " × курса " + cur + "/USDT от PancakeSwap. Изгорени = начално предлагане − текущо + токените на 0x…dEaD.",
              "The numbers are read directly from the chain (the contract and the PancakeSwap pair) and refresh every 30 s. Price in USD = price in " + cur + " × the " + cur + "/USDT rate on PancakeSwap. Burned = initial supply − current supply + tokens at 0x…dEaD.")}</p>
            <p style="margin-top:16px">
                ${hasMarket ? '<a class="cta" href="' + dexSwapUrl(d) + '" target="_blank" rel="noopener">🥞 ' + L("Купи / продай в PancakeSwap", "Buy / sell on PancakeSwap") + "</a>" : ""}
                <a class="cta sec" href="${explorerTok}" target="_blank" rel="noopener">BscScan: ${L("токен и холдъри", "token &amp; holders")}</a>
                ${hasMarket ? '<a class="cta sec" href="' + scan(d.pair) + '" target="_blank" rel="noopener">' + L("Двойката в BscScan", "The pair on BscScan") + "</a>" : ""}
                ${hasMarket && !isTest ? '<a class="cta sec" href="https://dexscreener.com/bsc/' + d.pair + '" target="_blank" rel="noopener">' + L("Графика (DexScreener)", "Chart (DexScreener)") + "</a>" : ""}
            </p>
        </section>
        <section id="purpose"><h2>${L("Цел на токена", "Purpose of the token")}</h2>
            <div class="box"><p style="margin:0;color:#37483d;line-height:1.6">${L(esc(T.why), esc(TE.why || T.why))}</p></div>
        </section>
        <section id="metamask"><h2>${L("Добави в MetaMask", "Add to MetaMask")}</h2>
            <div class="box mmrow">
                <div>
                    <p style="margin:0 0 10px;color:#37483d">${L("Един бутон добавя <strong>" + sym + "</strong> в твоя MetaMask (мрежата се превключва/добавя автоматично — стандарт EIP-747). Или сканирай QR кода с адреса на договора.",
                      "One button adds <strong>" + sym + "</strong> to your MetaMask (the network is switched/added automatically — EIP-747 standard). Or scan the QR code with the contract address.")}</p>
                    <div class="addr" id="addrText">${d.address}</div>
                    <p style="margin:14px 0 0">
                        <button class="cta mm" id="addToMM" type="button">🦊 ${L("Добави " + sym + " в MetaMask", "Add " + sym + " to MetaMask")}</button>
                        <button class="cta sec" id="copyAddr" type="button">${L("Копирай адреса", "Copy the address")}</button>
                    </p>
                    <div id="mmStatus"></div>
                </div>
                <div style="text-align:center"><div id="qr" title="${esc(d.address)}"></div><div style="color:var(--muted);font-size:.9em;margin-top:6px">${L("QR: адрес на договора", "QR: contract address")}</div></div>
            </div>
        </section>
        <section id="features"><h2>${L("Характеристики", "Features")}</h2>
            <div class="grid2">
${featBoxes}
            </div>
        </section>
        <section id="data"><h2>${L("Данни за токена (on-chain)", "Token data (on-chain)")}</h2>
            <div class="tscroll"><table class="data-table">
                <tr><td class="k">${L("Име", "Name")}</td><td class="v">${esc(T.name)}</td></tr>
                <tr><td class="k">${L("Символ", "Symbol")}</td><td class="v">${sym}</td></tr>
                <tr><td class="k">${L("Десетични", "Decimals")}</td><td class="v">${T.decimals}</td></tr>
                <tr><td class="k">${L("Начално предлагане", "Initial supply")}</td><td class="v">${n0(T.supply)} ${sym}</td></tr>
                <tr><td class="k">${L("Адрес на договора", "Contract address")}</td><td class="v"><a href="${explorer}" target="_blank" rel="noopener">${d.address}</a></td></tr>
                <tr><td class="k">${L("Мрежа", "Network")}</td><td class="v">${netLabel}</td></tr>
                <tr><td class="k">${L("Договор", "Contract")}</td><td class="v">${d.contract || "PupikesFeatureToken"} ${L("(такси/лимити непроменяеми, без mint)", "(fees/limits immutable, no mint)")}</td></tr>
                <tr><td class="k">${L("Такси", "Fees")}</td><td class="v">${L("изгаряне", "burn")} ${(p.burnFeeBps || 0) / 100}% · ${L("фонд", "fund")} ${(p.fundFeeBps || 0) / 100}% (${L("общо", "total")} ${totalFee}%)</td></tr>
                <tr><td class="k">${L("Лимити", "Limits")}</td><td class="v">${p.maxTxBps > 0 ? L("макс. " + p.maxTxBps / 100 + "% на превод", "max " + p.maxTxBps / 100 + "% per transfer") : L("без лимит на превод", "no limit per transfer")} · ${p.maxWalletBps > 0 ? L("макс. " + p.maxWalletBps / 100 + "% на портфейл", "max " + p.maxWalletBps / 100 + "% per wallet") : L("без лимит на портфейл", "no limit per wallet")}</td></tr>
                <tr><td class="k">Vault Guard</td><td class="v">${guarded ? L("праг холдър " + (p.defaultThresholdTokens || 0) + " / трезор " + (og.thresholdTokens || 0) + " " + sym + ", изчакване " + mins(p.defaultDelaySec || og.delaySec) + " мин.", "threshold holder " + (p.defaultThresholdTokens || 0) + " / treasury " + (og.thresholdTokens || 0) + " " + sym + ", wait " + mins(p.defaultDelaySec || og.delaySec) + " min") : L("само за трезора: праг " + (og.thresholdTokens || 0) + " " + sym, "treasury only: threshold " + (og.thresholdTokens || 0) + " " + sym)}</td></tr>
                <tr><td class="k">${L("Трезор / деплойър", "Treasury / deployer")}</td><td class="v"><a href="${scan(d.deployer)}" target="_blank" rel="noopener">${d.deployer}</a></td></tr>
                <tr><td class="k">${L("Пазач (guardian)", "Guardian")}</td><td class="v">${d.guardian || "—"}</td></tr>
                ${hasMarket ? '<tr><td class="k">' + L("Двойка (PancakeSwap)", "Pair (PancakeSwap)") + '</td><td class="v"><a href="' + scan(d.pair) + '" target="_blank" rel="noopener">' + d.pair + "</a></td></tr>" : ""}
                <tr><td class="k">${L("Създаден", "Created")}</td><td class="v">${created}</td></tr>
                <tr><td class="k">Explorer</td><td class="v"><a href="${explorer}" target="_blank" rel="noopener">${explorerHost} ↗</a></td></tr>
            </table></div>
            <p style="margin-top:16px">
                <a class="cta" href="${explorer}" target="_blank" rel="noopener">${L("Виж в BscScan", "View on BscScan")}</a>
                ${hasMarket ? '<a class="cta" href="' + dexSwapUrl(d) + '" target="_blank" rel="noopener">PancakeSwap</a>' : ""}
                <a class="cta sec" href="/crypto/">${L("Всички токени", "All tokens")}</a>
            </p>
        </section>
        <section id="how"><h2>${L("Ръчно добавяне в MetaMask", "Adding to MetaMask manually")}</h2>
            <ol class="steps">
                <li>${L("Превключи мрежата на", "Switch the network to")} <strong>${netLabel}</strong>${isTest ? " (RPC: " + esc(NET.rpc) + ", chainId " + NET.chainId + ", " + NET.currency + ")" : ""}.</li>
                <li>${L("Избери <strong>Import tokens → Custom token</strong>.", "Choose <strong>Import tokens → Custom token</strong>.")}</li>
                <li>${L("Постави адреса:", "Paste the address:")} <code>${d.address}</code></li>
                <li>${L("Символът <strong>" + sym + "</strong> и " + T.decimals + " десетични се попълват автоматично — потвърди.", "The symbol <strong>" + sym + "</strong> and " + T.decimals + " decimals fill in automatically — confirm.")}</li>
            </ol>
            ${isTest ? '<div class="note">' + L("⚠ Това е <strong>тестова</strong> версия на мрежата. Токените нямат реална парична стойност — служат за проверка на функциите преди евентуален mainnet.", "⚠ This is a <strong>test</strong> network version. The tokens have no real monetary value — they are for testing the features before a possible mainnet.") + "</div>" : ""}
        </section>
        <section id="contact"><h2>${L("Контакти", "Contacts")}</h2>
            ${(() => { try { const m = fs.readFileSync(path.join(__dirname, ".env"), "utf8").match(/^TELEGRAM_CHANNEL=@?([A-Za-z0-9_]+)/m); return m ? '<p><a class="cta" href="https://t.me/' + m[1] + '" target="_blank" rel="noopener">✈️ Telegram: @' + m[1] + '</a></p>' : ""; } catch (_) { return ""; } })()}
            <form id="hrvsFb" style="display:grid;gap:10px;max-width:640px">
                <input id="fbName" type="text" maxlength="100" placeholder="${L("От кого (име)", "From (name)").replace(/<[^>]+>/g, "")}" style="padding:10px;border:1px solid #ccc;border-radius:8px">
                <input id="fbContact" type="text" maxlength="150" placeholder="Email / Telegram / phone" style="padding:10px;border:1px solid #ccc;border-radius:8px">
                <select id="fbTopic" style="padding:10px;border:1px solid #ccc;border-radius:8px">
                    <option value="Покупка / продажба">Покупка / продажба — Buying / selling</option>
                    <option value="Технически въпрос (MetaMask, PancakeSwap)">Технически въпрос — Technical question (MetaMask, PancakeSwap)</option>
                    <option value="Листване / партньорство">Листване / партньорство — Listing / partnership</option>
                    <option value="Реклама / медии">Реклама / медии — Advertising / media</option>
                    <option value="Сигнал за проблем">Сигнал за проблем — Report a problem</option>
                    <option value="Друго">Друго — Other</option>
                </select>
                <input id="fbOther" type="text" maxlength="120" placeholder="Тема / Subject" style="padding:10px;border:1px solid #ccc;border-radius:8px" hidden>
                <textarea id="fbMsg" rows="5" maxlength="4000" placeholder="Съобщение / Message" style="padding:10px;border:1px solid #ccc;border-radius:8px;resize:vertical"></textarea>
                <button class="cta" type="submit">📨 ${L("Изпрати", "Send")}</button>
                <div id="fbStatus" style="min-height:20px"></div>
            </form>
            <script>(function () {
                var f = document.getElementById("hrvsFb"), tp = document.getElementById("fbTopic"), ot = document.getElementById("fbOther"), st = document.getElementById("fbStatus");
                tp.addEventListener("change", function () { ot.hidden = tp.value !== "Друго"; });
                f.addEventListener("submit", function (e) {
                    e.preventDefault();
                    var msg = document.getElementById("fbMsg").value.trim(); if (!msg) { st.textContent = "✗ Напиши съобщение / Write a message"; return; }
                    var topic = tp.value === "Друго" ? (ot.value.trim() || "Друго") : tp.value;
                    var payload = { app: "hrvs-token", appName: "Pupikes Harvest (HRVS) — страница на токена", lang: "bg",
                        name: document.getElementById("fbName").value.trim(), contact: document.getElementById("fbContact").value.trim(),
                        title: "HRVS token: " + topic, body: msg };
                    st.textContent = "…";
                    fetch("/api/portals/bug-report/anon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
                        .then(function (r) { if (!r.ok) throw new Error(r.status); st.textContent = "✓ Изпратено, благодарим! / Sent, thank you!"; f.reset(); ot.hidden = true; })
                        .catch(function () { st.textContent = "✗ Грешка — опитай пак или пиши в Telegram / Error — try again or write on Telegram"; });
                });
            })();</script>
        </section>
    </div>
    <footer>${esc(T.name)} (${sym}) · ${L("публикувано от", "published by")} PupikesMetamaskCoinCreator · <a href="/crypto/">/crypto</a> · <a href="${pageUrl(id)}">${pageUrl(id).replace(/^https?:\/\//, "")}</a> · <a href="/crypto/${slug}/admin/" rel="nofollow">${L("админ", "admin")}</a></footer>
    <script>window.PUPIKES_TOKEN = ${jsonForScript(cfg)};</script>
    <script src="${QR_CDN}"></script>
    <script src="${ETHERS_CDN}"></script>
    <script src="live.js?v=${shortHash(liveJs)}"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
  log("   📄 Страница: public/crypto/" + slug + "/  → " + pageUrl(id));
  return path.join(dir, "index.html");
}

// ── INDEX: public/crypto/index.html — блокът между <!-- BOT-TOKENS:start/end --> изброява ВСИЧКИ токени на бота
//    (deployments/, всички мрежи) с ЖИВА цена/ликвидност (bot-tokens-live.js). Останалата част от страницата НЕ се пипа. ──
function allDeployments() {
  const dir = path.join(__dirname, "deployments");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.includes(".stats") && f.includes("-"))
    .map((f) => { try { const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); return d && d.address && d.id ? d : null; } catch (_) { return null; } })
    .filter(Boolean).filter((d) => d.network !== "hardhat-local")
    .sort((a, b) => (b.deployedAt || "").localeCompare(a.deployedAt || ""));
}
function generateIndex() {
  const idx = path.join(cryptoDir(), "index.html");
  if (!fs.existsSync(idx)) { log("↷ public/crypto/index.html липсва — индексът не е обновен"); return null; }
  const deps = allDeployments();
  const liveSrc = fs.readFileSync(path.join(webDir(), "index-live.js"), "utf8");
  fs.writeFileSync(path.join(cryptoDir(), "bot-tokens-live.js"), liveSrc, "utf8");
  const cards = deps.map((d) => {
    const T = CAT.find((t) => t.id === d.id) || { name: d.name, symbol: d.symbol, special: d.special || "" };
    const slug = slugify(T.name);
    const n = CFG.networks[d.network] || {};
    const expl = n.explorer ? n.explorer + "/address/" + d.address : "#";
    const isTest = /testnet/i.test(d.network);
    // страницата /crypto/<slug>/ е генерирана за ЕДИН деплой (активната мрежа) — линк само ако е за този адрес
    const pf = path.join(cryptoDir(), slug, "index.html");
    const pageOk = fs.existsSync(pf) && fs.readFileSync(pf, "utf8").includes(d.address);
    const adminOk = pageOk && fs.existsSync(path.join(cryptoDir(), slug, "admin", "index.html"));
    let st = null; try { const h = JSON.parse(fs.readFileSync(path.join(__dirname, "deployments", d.network + "-" + d.id + ".stats.json"), "utf8")); st = h[h.length - 1]; } catch (_) {}
    const cur = n.currency || "BNB";
    const price = st && st.priceBnb ? Number(st.priceBnb).toPrecision(4) + " " + cur : (d.pair ? "…" : "няма пазар");
    const liq = st && st.tokenRes != null ? Math.round(Number(st.tokenRes)).toLocaleString("bg-BG") + " " + T.symbol + " + " + Number(st.bnbRes).toFixed(4) + " " + cur : "…";
    const up = USD_PAIRS[Number(d.chainId)] || null;
    const liveAttrs = d.pair ? ' data-pair="' + d.pair + '" data-token="' + d.address + '" data-dec="' + (d.decimals || 18) + '" data-cur="' + cur + '" data-sym="' + esc(T.symbol) +
      '" data-wbnb="' + (n.dex ? n.dex.wbnb : "") + '" data-rpcs="' + publicRpcs(d.network).join(" ") + '" data-usdpair="' + (up ? up.pair : "") + '" data-usdt="' + (up ? up.usdt : "") + '"' : "";
    return `            <div class="project-card">
                <h2>${(d.special || "").slice(0, 2).trim() || "🪙"} ${esc(T.name)} (${T.symbol})</h2>
                <p>${esc(T.special || "")}</p>
                <p style="font-family:'Courier New',monospace;font-size:.85em;word-break:break-all;color:#555">${d.address}</p>
                <div style="margin-top: 16px;">
                    ${pageOk ? '<a href="/crypto/' + slug + '/" class="btn">Страница</a>' : ""}
                    ${adminOk ? '<a href="/crypto/' + slug + '/admin/" class="btn btn-admin">Админ</a>' : ""}
                    <a href="${expl}" class="btn btn-admin" target="_blank" rel="noopener">BscScan</a>
                    ${d.pair ? '<a href="' + dexSwapUrl(d) + '" class="btn btn-admin" target="_blank" rel="noopener">PancakeSwap</a>' : ""}
                </div>
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
                    <small style="color: #666;">⛓ ${isTest ? "BNB Testnet (тестова версия)" : "BNB Smart Chain"}<br><span class="bot-live"${liveAttrs}><span class="dot"></span>цена: <b class="lp">${price}</b>${d.pair ? '<br>пул: <b class="ll">' + liq + "</b>" : ""}</span><br>🛡 Vault Guard · пуснат ${(d.deployedAt || "").slice(0, 10)}</small>
                </div>
            </div>`;
  }).join("\n");
  const block = `<!-- BOT-TOKENS:start (генерира се от PupikesMetamaskCoinCreator — не редактирай ръчно) -->
        <h2 style="text-align: center; margin: 60px 0 30px; font-size: 2.2em;">🤖 Токени на бота (PupikesMetamaskCoinCreator)</h2>
        <div class="projects">
${cards || '            <div class="project-card"><h2>—</h2><p>Още няма пуснати токени.</p></div>'}
        </div>
        <script src="/crypto/bot-tokens-live.js?v=${shortHash(liveSrc)}"></script>
        <!-- BOT-TOKENS:end -->`;
  let html = fs.readFileSync(idx, "utf8");
  const re = /<!-- BOT-TOKENS:start[\s\S]*?<!-- BOT-TOKENS:end -->/;
  if (re.test(html)) html = html.replace(re, () => block);
  else {
    const anchor = "<!-- Admin Tools";
    const i = html.indexOf(anchor);
    if (i >= 0) html = html.slice(0, i) + block + "\n\n        " + html.slice(i);
    else html = html.replace(/<\/div>\s*<footer/i, (m) => block + "\n" + m);
  }
  fs.writeFileSync(idx, html, "utf8");
  log("   📄 Индекс: public/crypto/index.html (" + deps.length + " токена) → " + PUBLIC_BASE + "/crypto/");
  return idx;
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

function tokenAt(id, signer) { const d = loadDeploy(id); if (!d) { console.error("Токенът " + id + " не е пуснат в " + CFG.activeNetwork + ". Пусни: node bot.js create " + id); process.exit(1); } return { d, c: new ethers.Contract(d.address, artifactFor(d.contract).abi, signer || provider()) }; }

// ── STATUS ──
async function status(id) {
  const { d, c } = tokenAt(id);
  log("Токен: " + (await c.name()) + " (" + (await c.symbol()) + ") @ " + d.address);
  log("Supply: " + fmt(await c.totalSupply(), d.decimals) + " · Owner: " + (await c.owner()));
  log("Баланс на трезора: " + fmt(await c.balanceOf(d.deployer), d.decimals) + " " + d.symbol);
  const tr = await tradingState(d).catch((e) => ({ text: "не се прочете (" + String(e.shortMessage || e.message || e).slice(0, 60) + ")" }));
  log("Търговия: " + (tr ? tr.text : "няма такава функция (стар договор, пуснат преди 11.09.2026 — търговията винаги е отворена)"));
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
  try { fs.mkdirSync(path.join(__dirname, "wallet"), { recursive: true }); fs.writeFileSync(path.join(__dirname, "wallet", "monitor.pid"), String(process.pid)); process.on("exit", () => { try { fs.unlinkSync(path.join(__dirname, "wallet", "monitor.pid")); } catch (_) {} }); } catch (_) {}
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
  "function removeLiquidityETHSupportingFeeOnTransferTokens(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) returns (uint amountETH)",
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
  const c = new ethers.Contract(d.address, abiOf(d), w);
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
  const c = new ethers.Contract(d.address, abiOf(d), w);
  const router = new ethers.Contract(dx.router, ROUTER_ABI, w);
  const tAmt = units(tokenAmt, d.decimals); const bAmt = ethers.parseEther(String(bnbAmt));
  log("Пускам ПАЗАР за " + d.symbol + " в " + dx.name + ": " + tokenAmt + " " + d.symbol + " + " + bnbAmt + " " + NET.currency);
  // (11.09.2026) БЕЗОПАСНО добавяне — само през рутера, в ЕДНА транзакция (токени + BNB + LP), с минимуми 99% и симулация.
  // НИКОГА не се пращат токени/BNB направо в двойката с отделни транзакции: роботите ги прибират със skim (инцидент 11.09).
  const plan = await planLiquidity(id, tAmt, bAmt);
  if (!plan) return;
  tokenAmt = Number(fmt(plan.tAmt, d.decimals)); bnbAmt = Number(ethers.formatEther(plan.bAmt));
  if ((await c.allowance(w.address, dx.router)) < plan.tAmt) { log("Одобрявам рутера…"); await (await c.approve(dx.router, plan.tAmt)).wait(); }
  let liqTx = null;
  await withOwnerGuardOff(id, async () => {
    const sim = await router.addLiquidityETH.staticCall(d.address, plan.tAmt, plan.minT, plan.minB, w.address, deadline(), { value: plan.bAmt });
    log("Симулация ОК: " + fmt(sim[0], d.decimals) + " " + d.symbol + " + " + ethers.formatEther(sim[1]) + " " + NET.currency);
    log("Добавям ликвидност (една транзакция)…");
    liqTx = await router.addLiquidityETH(d.address, plan.tAmt, plan.minT, plan.minB, w.address, deadline(), { value: plan.bAmt }); await liqTx.wait();
  });
  // (11.09.2026) V2: ВЕДНАГА след успешната ликвидност → openTrading(market.tradingDelaySec) (веднъж; вече отворена → нищо)
  try { await openTradingIfNeeded(id); }
  catch (e) { log("⚠ ТЪРГОВИЯТА НЕ Е ОТВОРЕНА (" + String(e.shortMessage || e.message || e).slice(0, 120) + ") — отвори ръчно: node bot.js open " + id + "  (меню 73 → 8)"); }
  const pair = await getPairAddr(id);
  saveDeploy(id, { ...d, pair });
  log("✅ Пазарът е пуснат. Двойка (pair): " + pair);
  recordNow(id, { market: { pair, dex: (NET.dex && NET.dex.name) || "PancakeSwap v2", liquidityBnb: Number(bnbAmt), liquidityTokens: Number(tokenAmt), marketAt: new Date().toISOString() } });
  log("   Explorer: " + explorerAddr(pair));
  await tgNotify("liquidity", { ctx: tgCtx(id), bnb: Number(bnbAmt), tokens: Number(tokenAmt), pool: await readPrice(id).catch(() => null), tx: liqTx ? explorerTx(liqTx.hash) : null });
  await price(id);
  await stats(id).catch(() => {});   // първи запис на цената + обновена страница/индекс
}

// (11.09.2026) План за безопасно добавяне: нова двойка → подаденото съотношение; двойка с „прах“ (след пълно теглене) →
// оправя съотношението с нищожна сума (≤ 0.1%) + sync; истински пул → по ТЕКУЩАТА цена (рутерът взима оптималното).
async function planLiquidity(id, tAmt, bAmt) {
  const d = loadDeploy(id); const w = deployer();
  const c = new ethers.Contract(d.address, abiOf(d), w);
  const pairAddr = await getPairAddr(id);
  const full = (T, B) => ({ tAmt: T, bAmt: B, minT: T * 99n / 100n, minB: B * 99n / 100n });
  if (!pairAddr || pairAddr === ethers.ZeroAddress) return full(tAmt, bAmt);
  const pc = new ethers.Contract(pairAddr, PAIR_ABI.concat(["function sync()"]), w);
  const t0 = (await pc.token0()).toLowerCase() === d.address.toLowerCase();
  const rr = async () => { const [a, b] = await pc.getReserves(); return t0 ? { tok: a, bnb: b } : { tok: b, bnb: a }; };
  let r = await rr();
  if (r.tok === 0n || r.bnb === 0n) return full(tAmt, bAmt);
  if (r.bnb * 1000n < bAmt) {
    for (let k = 0; k < 3; k++) {
      r = await rr(); const need = r.bnb * tAmt / bAmt;
      if (r.tok * 1000n >= need * 995n && r.tok * 1000n <= need * 1005n) break;
      if (r.tok > need) { log("⛔ В двойката има повече токени от нужното за това съотношение — провери ръчно (не добавям)."); return null; }
      const add = need - r.tok;
      if (add * 1000n > tAmt) { log("⛔ Оправянето на цената иска " + fmt(add, d.decimals) + " токена (> 0.1%) — не добавям."); return null; }
      log("Двойката е с „прах“: оправям съотношението с " + fmt(add, d.decimals) + " " + d.symbol + " + sync");
      await (await c.transfer(pairAddr, add)).wait(); await (await pc.sync()).wait();
    }
    r = await rr(); const need = r.bnb * tAmt / bAmt;
    if (!(r.tok * 1000n >= need * 990n && r.tok * 1000n <= need * 1010n)) { log("⛔ Съотношението не се получи — не добавям."); return null; }
    return full(tAmt, bAmt);
  }
  let T = tAmt, B = tAmt * r.bnb / r.tok;
  if (B > bAmt) { B = bAmt; T = bAmt * r.tok / r.bnb; }
  log("Пулът има ликвидност — добавям по ТЕКУЩАТА цена: " + fmt(T, d.decimals) + " " + d.symbol + " + " + ethers.formatEther(B) + " " + NET.currency);
  return full(T, B);
}

// ── UNLIQUIDITY: тегли ликвидност (LP на трезора) — процент и порции; минимуми от резервите (−2% такса, −1% марж). ──
async function unliquidity(id, pct, portions) {
  const d = loadDeploy(id); if (!d) { console.error("Токенът " + id + " не е пуснат."); process.exit(1); }
  const dx = dex(); const w = deployer();
  const pairAddr = await getPairAddr(id);
  if (!pairAddr || pairAddr === ethers.ZeroAddress) { log("Няма двойка за " + d.symbol); return; }
  const pc = new ethers.Contract(pairAddr, PAIR_ABI.concat(["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)", "function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)"]), w);
  const router = new ethers.Contract(dx.router, ROUTER_ABI, w);
  const P = Math.min(100, Math.max(1, Number(pct || 100))); const N = Math.min(20, Math.max(1, Math.floor(Number(portions || 1))));
  const lp = await pc.balanceOf(w.address); const total = lp * BigInt(Math.round(P * 100)) / 10000n;
  if (total === 0n) { log("Трезорът няма LP за " + d.symbol); return; }
  if ((await pc.allowance(w.address, dx.router)) < total) { log("Одобрявам LP за рутера…"); await (await pc.approve(dx.router, total)).wait(); }
  const t0 = (await pc.token0()).toLowerCase() === d.address.toLowerCase();
  log("Тегля " + P + "% от ликвидността на " + d.symbol + " на " + N + " порции…");
  let left = total; const txs = [];
  for (let i = 1; i <= N; i++) {
    const part = i < N ? total / BigInt(N) : left; left -= part;
    const [a, b] = await pc.getReserves(); const ts = await pc.totalSupply();
    const tokOut = (t0 ? a : b) * part / ts, bnbOut = (t0 ? b : a) * part / ts;
    const tx = await router.removeLiquidityETHSupportingFeeOnTransferTokens(d.address, part, tokOut * 97n / 100n, bnbOut * 99n / 100n, w.address, deadline()); await tx.wait();
    txs.push(tx.hash); log("  порция " + i + "/" + N + ": ~" + fmt(tokOut, d.decimals) + " " + d.symbol + " + ~" + ethers.formatEther(bnbOut) + " " + NET.currency + " · " + explorerTx(tx.hash));
  }
  const tk = new ethers.Contract(d.address, abiOf(d), provider());
  log("✅ Изтеглено. Трезор: " + fmt(await tk.balanceOf(w.address), d.decimals) + " " + d.symbol + " · " + ethers.formatEther(await provider().getBalance(w.address)) + " " + NET.currency);
  if (P === 100) log("ℹ В двойката остава само „прах“ — следващото добавяне (liquidity " + id + " <bnb> <токени>) сам оправя цената, в една транзакция.");
  recordNow(id, { market: { lastRemoval: { pct: P, portions: N, at: new Date().toISOString(), txs } } });
  await stats(id).catch(() => {});
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
  const c = new ethers.Contract(d.address, abiOf(d), w);
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
  const c = new ethers.Contract(d.address, abiOf(d), w);
  log("🔥 Изгарям " + tokenAmt + " " + d.symbol + " от трезора (дефлация)…");
  const btx = await c.burn(units(tokenAmt, d.decimals)); await btx.wait();
  const tsNow = await c.totalSupply();
  log("✅ Изгорени. Ново предлагане: " + fmt(tsNow, d.decimals) + " " + d.symbol);
  await tgNotify("burn", { ctx: tgCtx(id), amount: Number(tokenAmt), totalSupply: Number(fmt(tsNow, d.decimals)), tx: explorerTx(btx.hash) });
  await price(id);
}

// ── WITHDRAW: тегли BNB от бота към твой друг акаунт ──
async function withdraw(bnbAmt, to) {
  const w = deployer();
  if (!to || !ethers.isAddress(to)) { console.error("Дай валиден адрес: node bot.js withdraw <сума> <адрес>"); process.exit(1); }
  log("Тегля " + bnbAmt + " " + NET.currency + " → " + to);
  const wtx = await w.sendTransaction({ to, value: ethers.parseEther(String(bnbAmt)) }); await wtx.wait();
  log("✅ Изтеглено. Баланс на бота: " + ethers.formatEther(await provider().getBalance(w.address)) + " " + NET.currency);
  const mine = CAT.filter((t) => { const dd = loadDeploy(t.id); return dd && dd.deployer && dd.deployer.toLowerCase() === w.address.toLowerCase(); }).map((t) => tgCtx(t.id));
  await tgNotify("withdraw", { tokens: mine, bnb: Number(bnbAmt), to, from: w.address, currency: NET.currency, explorer: NET.explorer || "", tx: explorerTx(wtx.hash) });
}

// ── SNAPSHOT: пълно състояние от веригата (цена, пул, предлагане, изгорени, трезор/фонд, охрана, такси, BNB/USD) ──
async function readBnbUsd() {
  const up = USD_PAIRS[NET.chainId]; if (!up || !NET.dex) return null;
  const pc = new ethers.Contract(up.pair, PAIR_ABI, provider());
  const [r0, r1] = await pc.getReserves();
  const usdIs0 = up.usdt.toLowerCase() < NET.dex.wbnb.toLowerCase();   // token0 = по-малкият адрес
  const u = Number(ethers.formatEther(usdIs0 ? r0 : r1)), b = Number(ethers.formatEther(usdIs0 ? r1 : r0));
  return b > 0 ? u / b : null;
}
async function readSnapshot(id) {
  const d = loadDeploy(id);
  const c = new ethers.Contract(d.address, artifactFor(d.contract).abi, provider());
  const n = (v) => Number(fmt(v, d.decimals)); const soft = (pr) => pr.catch(() => null);
  const p = await readPrice(id).catch(() => null);
  const r = await Promise.all([c.totalSupply(), c.balanceOf(DEAD_ADDR), c.balanceOf(d.deployer), soft(c.fundWallet()), soft(c.owner()), soft(c.guardOf(d.deployer)),
    soft(c.burnFeeBps()), soft(c.fundFeeBps()), soft(c.maxTxAmount()), soft(c.maxWalletAmount()), soft(c.defaultThreshold()), soft(c.defaultDelay()), soft(c.pendingCount())]);
  const fundW = r[3]; let fund = null;
  if (fundW && fundW !== ethers.ZeroAddress && fundW.toLowerCase() !== d.deployer.toLowerCase()) fund = n(await c.balanceOf(fundW));
  const bnbUsd = await readBnbUsd().catch(() => null);
  const ts = n(r[0]), dead = n(r[1]);
  const num = (x) => (x === null || x === undefined) ? null : Number(x);
  const trd = await tradingState(d).catch(() => null);
  return { t: new Date().toISOString(), priceBnb: p ? p.priceBnb : null, priceUsd: p && bnbUsd ? p.priceBnb * bnbUsd : null, bnbUsd,
    bnbRes: p ? Number(p.bnbRes) : null, tokenRes: p ? Number(p.tokenRes) : null,
    totalSupply: ts, dead, burned: Math.max(0, Number(d.supply) - ts) + dead, treasury: n(r[2]), fundWallet: fundW, fund, owner: r[4],
    guard: r[5] ? { threshold: n(r[5][0]), delay: Number(r[5][1]), guardian: r[5][2] } : null,
    burnFeeBps: num(r[6]), fundFeeBps: num(r[7]), maxTx: r[8] == null ? null : n(r[8]), maxWallet: r[9] == null ? null : n(r[9]),
    defaultThreshold: r[10] == null ? null : n(r[10]), defaultDelay: num(r[11]), pendingCount: num(r[12]), tradingOpenAt: trd ? trd.openAt : null };
}

// ── STATS: записва пълното състояние във времето + показва тренда; пише и public/crypto/<slug>/stats.json ──
async function stats(id) {
  const d = loadDeploy(id);
  if (!d) { log("Токенът " + id + " не е пуснат в " + CFG.activeNetwork + "."); return; }
  const s = await readSnapshot(id);
  const cur = NET.currency, usd = (x) => x == null ? "—" : "$" + (x >= 1 ? x.toFixed(2) : Number(x.toPrecision(4)));
  log("📦 " + d.symbol + ": общо " + s.totalSupply.toLocaleString() + " · изгорени " + s.burned.toLocaleString() + " · трезор " + s.treasury.toLocaleString() +
    (s.tokenRes != null ? " · в пула " + s.tokenRes.toLocaleString() + " " + d.symbol + " + " + s.bnbRes + " " + cur : "") + (s.bnbUsd ? " · 1 " + cur + " = " + usd(s.bnbUsd) : ""));
  if (s.tradingOpenAt !== null && s.tradingOpenAt !== undefined) log("   Търговия: " + tradeText(s.tradingOpenAt, Math.floor(Date.now() / 1000)));
  if (!s.priceBnb) { log("Още няма пазар за статистика на цената."); writePublicStats(id, s); generatePage(id); generateIndex(); return; }
  let hist = []; try { hist = JSON.parse(fs.readFileSync(statsFile(id), "utf8")); } catch (_) {}
  hist.push(s);
  fs.writeFileSync(statsFile(id), JSON.stringify(hist, null, 2));
  recordNow(id);
  const first = hist[0].priceBnb, last = s.priceBnb;
  const x = first > 0 ? (last / first) : 1;
  log("📊 " + d.symbol + " статистика (" + hist.length + " записа):");
  log("   Начална цена: " + first.toPrecision(6) + " " + cur);
  log("   Текуща цена:  " + last.toPrecision(6) + " " + cur + (s.priceUsd ? " (" + usd(s.priceUsd) + ")" : "") + "  (× " + x.toFixed(2) + " спрямо старта)");
  log("   Цел: ≥ 5× → " + (x >= 5 ? "🎉 ПОСТИГНАТА!" : "остават × " + (5 / x).toFixed(2)));
  await tgNotify("price", { ctx: tgCtx(id), s, hist });   // Telegram: само при ръст над прага (telegram.json priceAlertPct)
  generatePage(id); generateIndex();   // страницата + stats.json до нея показват текущото състояние
}

// ── ADOPT: записва в бота токен, пуснат ОТ АДМИН СТРАНИЦАТА (/crypto/<символ>/admin/ → „Създай нов токен“) ──
//   node bot.js adopt <id> <адрес> [--force]  → проверява договора във веригата (име/символ/такси спрямо каталога, собственик,
//   пазач, двойка), пише deployments/<мрежа>-<id>.json, private/crypto/<Име>/, публична + админ страница, индекс. Без транзакции.
async function adopt(id, addr) {
  const T = findTok(id);
  if (!addr || !ethers.isAddress(addr)) { console.error("Употреба: node bot.js adopt <id> <адрес на договора>   (id от каталога: node bot.js menu)"); process.exit(1); }
  addr = ethers.getAddress(addr);
  const pv = provider(); const net = await pv.getNetwork(); const force = !!flag("force");
  const code = await pv.getCode(addr);
  if (!code || code === "0x") throw new Error("На " + addr + " няма договор в " + CFG.activeNetwork + " (chainId " + net.chainId + "). Провери адреса и мрежата (config.activeNetwork).");
  // (11.09.2026) Договорът: от каталога (V2 по подразбиране); ако на адреса няма isBlocked (стар договор, напр. от стара
  // админ страница) → записва се като стария (без V2), за да получи верния ABI.
  let contractName = catContract(T);
  if (/V2$/.test(contractName)) {
    try { await new ethers.Contract(addr, artifactFor(contractName).abi, pv).isBlocked(ethers.ZeroAddress); }
    catch (e) {
      if (e && (e.code === "CALL_EXCEPTION" || e.code === "BAD_DATA")) { contractName = contractName.replace(/V2$/, ""); log("ℹ На адреса няма блокиране (isBlocked) — записвам го като стария договор " + contractName + "."); }
      else throw e;
    }
  }
  const c = new ethers.Contract(addr, artifactFor(contractName).abi, pv);
  const [name, symbol, dec, ts, owner] = await Promise.all([c.name(), c.symbol(), c.decimals(), c.totalSupply(), c.owner()]);
  log("Договор " + addr + ": „" + name + " (" + symbol + ")“, decimals " + dec + ", предлагане " + fmt(ts, dec) + ", собственик " + owner);
  if ((name !== T.name || symbol !== T.symbol) && !force) throw new Error("Договорът е „" + name + " (" + symbol + ")“, а [" + id + "] в каталога е „" + T.name + " (" + T.symbol + ")“. Грешен id? (--force = запиши въпреки това)");
  try { const [bf, ff] = await Promise.all([c.burnFeeBps(), c.fundFeeBps()]); if (Number(bf) !== T.params.burnFeeBps || Number(ff) !== T.params.fundFeeBps) log("⚠ Таксите на договора (burn " + bf + " / фонд " + ff + " bps) се различават от пресета [" + id + "]."); } catch (_) {}
  const prev = loadDeploy(id);
  if (prev && prev.address.toLowerCase() !== addr.toLowerCase() && !force) throw new Error("Вече има запис за [" + id + "] в " + CFG.activeNetwork + ": " + prev.address + " — не го презаписвам (--force, ако наистина искаш).");
  let gAddr = null; try { gAddr = (await c.guardOf(owner))[2]; } catch (_) {}
  let vaultAddr = null; try { if (CFG.walletMode !== "vault" || vault.exists()) vaultAddr = deployer().address; } catch (_) {}
  if (vaultAddr && vaultAddr.toLowerCase() !== owner.toLowerCase()) log("⚠ Собственикът " + owner + " НЕ е активният трезор на бота (" + vaultAddr + ") — ботът няма да може да подписва за този токен (избери трезора с --vault).");
  let pair = null;
  if (NET.dex) { try { const pa = await new ethers.Contract(NET.dex.factory, FACTORY_ABI, pv).getPair(addr, NET.dex.wbnb); if (pa !== ethers.ZeroAddress) pair = pa; } catch (_) {} }
  const same = prev && prev.address.toLowerCase() === addr.toLowerCase();
  const rec = Object.assign({}, same ? prev : {}, {
    id, address: addr, name, symbol, decimals: Number(dec), supply: same && prev.supply ? prev.supply : T.supply, deployer: owner,
    guardian: gAddr && gAddr !== ethers.ZeroAddress ? gAddr : ((same && prev.guardian) || null), network: CFG.activeNetwork, chainId: Number(net.chainId),
    special: T.special, contract: (same && prev.contract) || contractName, deployedAt: (same && prev.deployedAt) || new Date().toISOString(),
    source: same ? (prev.source || "bot") : "admin-page", adoptedAt: same ? prev.adoptedAt : new Date().toISOString() });
  if (pair) rec.pair = pair;
  saveDeploy(id, rec);
  log("✅ Записан: [" + id + "] " + name + " (" + symbol + ") @ " + addr + (pair ? " · двойка " + pair : " · още без пазар"));
  if (pair) await stats(id).catch((e) => { log("stats: " + (e.shortMessage || e.message || "").slice(0, 80)); generatePage(id); generateIndex(); });
  else { generatePage(id); generateIndex(); }
  log("   🌐 Страница: " + pageUrl(id) + "   🔧 Админ: " + adminUrl(id));
}

// ── ADVISE: съветникът предлага легитимни ходове за качване на цената ──
async function advise(id) {
  const d = loadDeploy(id); const w = deployer();
  const c = new ethers.Contract(d.address, abiOf(d), provider());
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

// ══════════════ БЛОКИРАНЕ НА АДРЕСИ (V2 договорите, 11.09.2026 — след MEV роботите по пула на HRVS) ══════════════
//   block <id> <адрес…> / unblock <id> <адрес…> — реални транзакции от трезора (собственика) през deployer();
//   blocked <id> — само четене (събития AddressBlocked + текущото isBlocked). Стар договор (HRVS) → ясно съобщение.
function knownBots() {
  return [...new Set(((CFG.protect && CFG.protect.knownBots) || []).map((a) => String(a).trim().toLowerCase()).filter((a) => ethers.isAddress(a)).map((a) => ethers.getAddress(a)))];
}
function noBlockMsg(d) { return "⛔ Договорът на " + d.symbol + " (" + (d.contract || "PupikesFeatureToken") + " @ " + d.address + ") няма блокиране (пуснат преди 11.09.2026); само новите токени (V2) го имат."; }
// Адреси, които НИКОГА не се блокират (адрес → причина): иначе търговията/управлението спира.
async function forbiddenAddrs(d, c) {
  const m = new Map(); const add = (a, why) => { if (a && ethers.isAddress(a) && a !== ethers.ZeroAddress) m.set(a.toLowerCase(), why); };
  add(d.address, "самият договор на токена");
  try { add(await c.fundWallet(), "фондът (таксата при превод отива там)"); } catch (_) {}
  try { add(await c.owner(), "собственикът на договора"); } catch (_) {}
  add(d.guardian, "пазачът на Vault Guard — той отменя кражбите от трезора");
  add(d.deployer, "трезорът (създател/собственик) — без него няма управление");
  let pair = d.pair || null;
  if (!pair && NET.dex) { try { pair = await new ethers.Contract(NET.dex.factory, FACTORY_ABI, provider()).getPair(d.address, NET.dex.wbnb); } catch (_) {} }
  add(pair, "двойката (pair) в " + (NET.dex ? NET.dex.name : "DEX") + " — блокирането ѝ спира търговията за ВСИЧКИ (никой не може да купи или продаде)");
  if (NET.dex) add(NET.dex.router, "рутерът на " + NET.dex.name + " — блокирането му спира продажбите и ликвидността за ВСИЧКИ");
  return m;
}
async function sendBlock(c, list, blocked) {
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100); let tx;
    if (part.length === 1) { await c.setBlocked.staticCall(part[0], blocked); tx = await c.setBlocked(part[0], blocked); }
    else { await c.setBlockedMany.staticCall(part, blocked); tx = await c.setBlockedMany(part, blocked); }
    log("   … изпратена " + explorerTx(tx.hash) + ", чакам потвърждение");
    const rc = await tx.wait();
    if (!rc || rc.status !== 1) throw new Error("транзакцията е неуспешна: " + tx.hash);
    log("   ✅ " + (blocked ? "Блокирани" : "Отблокирани") + ": " + part.length + " · блок " + rc.blockNumber);
  }
}
async function blockKnownBots(id, c) {
  const d = loadDeploy(id); const bots = knownBots();
  if (!bots.length) { log("   ℹ config protect.knownBots е празен — няма известни роботи за блокиране."); return; }
  const bad = await forbiddenAddrs(d, c);
  const list = bots.filter((a) => !bad.has(a.toLowerCase()));
  bots.filter((a) => bad.has(a.toLowerCase())).forEach((a) => log("   ↷ пропускам " + a + ": " + bad.get(a.toLowerCase())));
  if (!list.length) return;
  log("🚫 Блокирам " + list.length + " известни MEV робота (config protect.knownBots) — ПРЕДИ ликвидността…");
  await sendBlock(c, list, true);
}
async function blockCmd(id, addrs, blocked) {
  const d = loadDeploy(id); if (!d) { console.error("Токенът " + id + " не е пуснат в " + CFG.activeNetwork + "."); process.exit(1); }
  const abi = abiOf(d);
  if (!hasFn(abi, "setBlockedMany")) { log(noBlockMsg(d)); process.exit(1); }
  const list = [];
  for (const a of addrs || []) for (const x of String(a).split(/[\s,;]+/).filter(Boolean)) {
    if (!ethers.isAddress(x.toLowerCase())) { console.error("Невалиден адрес: " + x); process.exit(1); }
    const g = ethers.getAddress(x.toLowerCase()); if (!list.includes(g)) list.push(g);
  }
  if (!list.length) { console.error("Употреба: node bot.js " + (blocked ? "block" : "unblock") + " <id> <адрес> [адрес…]"); process.exit(1); }
  const w = deployer(); const c = new ethers.Contract(d.address, abi, w);
  const owner = await c.owner();
  if (owner === ethers.ZeroAddress) { log("⛔ Собствеността на договора е отказана (renounceOwnership) — блокирането вече не може да се сменя."); process.exit(1); }
  if (owner.toLowerCase() !== w.address.toLowerCase()) { log("⛔ Собственик на договора е " + owner + ", а активният трезор е " + w.address + " — само собственикът може да блокира (избери трезора с --vault)."); process.exit(1); }
  if (blocked) {
    const bad = await forbiddenAddrs(d, c);
    const refused = list.filter((a) => bad.has(a.toLowerCase()));
    if (refused.length) { refused.forEach((a) => log("⛔ ОТКАЗАНО " + a + ": " + bad.get(a.toLowerCase()) + ".")); log("Нищо не е изпратено — махни забранените адреси и повтори."); process.exit(1); }
  }
  const cur = await Promise.all(list.map((a) => c.isBlocked(a)));
  list.forEach((a, i) => { if (cur[i] === blocked) log("   ↷ " + a + " вече е " + (blocked ? "блокиран" : "свободен")); });
  const todo = list.filter((a, i) => cur[i] !== blocked);
  if (!todo.length) { log("Няма промяна за изпращане."); return; }
  log((blocked ? "🚫 Блокирам " : "✅ Отблокирам ") + todo.length + " адрес(а) в " + d.symbol + " (" + CFG.activeNetwork + ", трезор " + w.address + "):");
  todo.forEach((a) => log("   • " + a));
  await sendBlock(c, todo, blocked);
  const after = await Promise.all(todo.map((a) => c.isBlocked(a)));
  todo.forEach((a, i) => log("   " + (after[i] ? "🚫 блокиран " : "✅ свободен ") + a));
}
async function blockedCmd(id) {
  const d = loadDeploy(id); if (!d) { console.error("Токенът " + id + " не е пуснат в " + CFG.activeNetwork + "."); process.exit(1); }
  const abi = abiOf(d);
  if (!hasFn(abi, "isBlocked")) { log(noBlockMsg(d)); log("   Защитата при този договор: Vault Guard на трезора + добавяне на ликвидност само през рутера в една транзакция."); return; }
  const pv = provider(); const c = new ethers.Contract(d.address, abi, pv);
  const seen = new Map();
  const latest = await pv.getBlockNumber();
  const hasFrom = Number.isInteger(d.deployBlock);
  const from = hasFrom ? d.deployBlock : Math.max(0, latest - 200000);
  const stepN = Math.max(100, Number((CFG.protect && CFG.protect.logChunk) || 5000));
  let logsOk = true;
  log("Чета AddressBlocked на " + d.symbol + " от блок " + from + " до " + latest + (hasFrom ? "" : " (записът няма deployBlock — последните 200 000 блока)") + "…");
  for (let b = from; b <= latest; b += stepN) {
    try {
      const ev = await c.queryFilter(c.filters.AddressBlocked(), b, Math.min(latest, b + stepN - 1));
      for (const e of ev) seen.set(e.args.account.toLowerCase(), { account: e.args.account, blocked: e.args.blocked, block: e.blockNumber, tx: e.transactionHash });
    } catch (e) { logsOk = false; log("⚠ RPC не върна събитията (" + String(e.shortMessage || e.message || "").slice(0, 80) + ") — показвам текущото състояние на известните адреси."); break; }
  }
  for (const a of knownBots()) if (!seen.has(a.toLowerCase())) seen.set(a.toLowerCase(), { account: a, blocked: null, block: null, tx: null });
  const rows = [...seen.values()];
  const now = await Promise.all(rows.map((r) => c.isBlocked(r.account).catch(() => null)));
  console.log("");
  let n = 0;
  rows.forEach((r, i) => {
    if (now[i]) n++;
    console.log("  " + (now[i] ? "🚫 БЛОКИРАН " : now[i] === false ? "✅ свободен  " : "?  ") + r.account +
      (r.block != null ? "  (последно: " + (r.blocked ? "блокиран" : "отблокиран") + " в блок " + r.block + " · " + explorerTx(r.tx) + ")" : "  (config protect.knownBots, без събитие)"));
  });
  console.log("");
  log("Блокирани сега: " + n + " от " + rows.length + " проверени адреса" + (logsOk ? "" : " (събитията не са прочетени изцяло)") + ".");
}

// ══════════════ ЗАТВОРЕНА ТЪРГОВИЯ (V2, 11.09.2026): до openTrading никой извън трезора/фонда не купува и не продава ══════════════
//   Ботът вика openTrading(market.tradingDelaySec) веднага след успешната ликвидност; ръчно: open <id> [сек]. Само веднъж.
const MAX_U64 = (1n << 64n) - 1n;
function hm(sec) { return new Date(Number(sec) * 1000).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }); }
function dhm(sec) { return new Date(Number(sec) * 1000).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function tradeText(openAt, nowSec) {   // openAt: сек. | "closed" | null (договорът няма тази функция)
  if (openAt === null || openAt === undefined) return null;
  if (openAt === "closed") return "затворена (чака ликвидност)";
  if (nowSec >= openAt) return "отворена (от " + dhm(openAt) + ")";
  return "отваря се в " + hm(openAt) + " (след " + Math.ceil((openAt - nowSec) / 60) + " мин.)";
}
async function tradingState(d, pv) {
  const abi = abiOf(d); if (!hasFn(abi, "tradingOpenAt")) return null;
  pv = pv || provider(); const c = new ethers.Contract(d.address, abi, pv);
  const [at, blk] = await Promise.all([c.tradingOpenAt(), pv.getBlock("latest")]);
  const openAt = at === MAX_U64 ? "closed" : Number(at);
  const now = blk ? Number(blk.timestamp) : Math.floor(Date.now() / 1000);
  return { openAt, now, open: openAt !== "closed" && now >= openAt, text: tradeText(openAt, now) };
}
function tradingDelay(sec) {
  const v = (sec !== undefined && sec !== null && sec !== "") ? Number(sec) : Number(CFG.market && CFG.market.tradingDelaySec != null ? CFG.market.tradingDelaySec : 600);
  if (!Number.isInteger(v) || v < 0 || v > 86400) throw new Error("Забавянето за отваряне на търговията е цяло число секунди от 0 до 86400 (1 ден), а е: " + (sec != null && sec !== "" ? sec : CFG.market && CFG.market.tradingDelaySec));
  return v;
}
async function openTradingIfNeeded(id, sec) {
  const d = loadDeploy(id); const abi = abiOf(d);
  if (!hasFn(abi, "openTrading")) return null;   // стар договор — търговията винаги е отворена
  const st = await tradingState(d);
  if (st.openAt !== "closed") { log("   ℹ Търговията вече е " + st.text + " — не я отварям пак."); return st; }
  const delay = tradingDelay(sec);
  const c = new ethers.Contract(d.address, abi, deployer());
  await c.openTrading.staticCall(delay);
  const tx = await c.openTrading(delay); const rc = await tx.wait();
  if (!rc || rc.status !== 1) throw new Error("openTrading е неуспешна: " + tx.hash);
  const st2 = await tradingState(d);
  log("🔓 Търговията се отваря в " + hm(st2.openAt) + " (след " + Math.round(delay / 60) + " мин.) · openTrading " + explorerTx(tx.hash));
  return st2;
}
async function openCmd(id, sec) {
  const d = loadDeploy(id); if (!d) { console.error("Токенът " + id + " не е пуснат в " + CFG.activeNetwork + "."); process.exit(1); }
  if (!hasFn(abiOf(d), "openTrading")) { log("ℹ Договорът на " + d.symbol + " (" + (d.contract || "PupikesFeatureToken") + ") няма затворена търговия (пуснат преди 11.09.2026) — търговията му винаги е отворена."); return; }
  tradingDelay(sec);   // проверка на числото преди всичко
  const w = deployer(); const c = new ethers.Contract(d.address, abiOf(d), w); const owner = await c.owner();
  if (owner.toLowerCase() !== w.address.toLowerCase()) { log("⛔ Собственик на договора е " + owner + ", а активният трезор е " + w.address + " — само собственикът отваря търговията (избери трезора с --vault)."); process.exit(1); }
  const pair = NET.dex ? await getPairAddr(id).catch(() => null) : null;
  if (!pair || pair === ethers.ZeroAddress) log("⚠ Още няма двойка/ликвидност — отваряш търговията без пазар (обикновено ботът я отваря сам след liquidity).");
  await openTradingIfNeeded(id, sec);
}

// ══════════════ АВТОПИЛОТ: ти превеждаш BNB и гледаш; ботът прави всичко останало ══════════════
//   node bot.js autopilot <id> [bnbЗаЛиквидност] [--all] [--vault <адрес|№>] [--no-wallet]
//   (а) отваря Edge+MetaMask с трезора (при готов профил само отключва) и казва „Преведи BNB на този адрес";
//   (б) чака (проверка на RPC на 10 s) балансът да покрие газ + ликвидност (сума от аргумента, от терминала,
//       или --all = всичко над резерва за газ); (в) create (деплой + Vault Guard + страница); (г) liquidity;
//   (д) stats/price/advise + страница/индекс; (е) остава в monitor (охрана). Дневник: wallet/autopilot.log.
//   При грешка — честно съобщение и СПИРАНЕ (никакви повторни деплои; вече пуснат токен не се деплойва пак).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fE = (w) => Number(ethers.formatEther(w)).toFixed(5);
function ask(q) { return new Promise((res) => { const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res((a || "").trim()); }); }); }
function flag(name) {
  const i = process.argv.findIndex((a) => a === "--" + name || a.startsWith("--" + name + "="));
  if (i < 0) return null;
  const a = process.argv[i];
  if (a.includes("=")) return a.slice(a.indexOf("=") + 1);
  const nx = process.argv[i + 1];
  return (nx && !nx.startsWith("--")) ? nx : true;
}
// Избор на трезор от регистъра (wallet/vaults.json). --vault <адрес|№> за всички команди; автопилотът пита.
async function chooseVault(interactive) {
  const vf = flag("vault");
  if (vf && vf !== true) {
    const e = vault.findVault(vf);
    if (!e) throw new Error("Трезорът " + vf + " не е създаден от бота — няма сийд за него. Виж регистъра: node vault.js list");
    vault.useVault(e); return e;
  }
  const reg = vault.registry();
  if (interactive && reg.length > 1 && process.stdin.isTTY) {
    vault.printRegistry();
    const a = await ask("Кой трезор да ползва автопилотът? [номер или адрес; Enter = текущия wallet/]: ");
    if (a) { const e = vault.findVault(a); if (!e) throw new Error("Трезорът " + a + " не е създаден от бота — няма сийд за него."); vault.useVault(e); return e; }
  }
  return reg.find((r) => r.current) || null;
}
async function autopilot(id, bnbArg) {
  const T = findTok(id);
  fs.mkdirSync(path.join(__dirname, "wallet"), { recursive: true });
  LOGFILE = path.join(__dirname, "wallet", "autopilot.log");
  log("══════ АВТОПИЛОТ: " + T.name + " (" + T.symbol + ") · мрежа " + CFG.activeNetwork + " ══════");
  if (CFG.activeNetwork === "bscMainnet") log("⚠ РЕАЛНА МРЕЖА (mainnet) — реални пари. Всяка стъпка е в дневника wallet/autopilot.log.");
  const ve = await chooseVault(true);
  const w = deployer(); const gAddr = guardianWallet().address; const pv = provider();
  const already = loadDeploy(id);
  if (already) log("ℹ " + T.symbol + " ВЕЧЕ е пуснат в " + CFG.activeNetwork + " @ " + already.address + " — НЯМА да деплойвам повторно; продължавам с пазар/охрана.");
  if (already && already.deployer.toLowerCase() !== w.address.toLowerCase()) throw new Error("Записът deployments/" + CFG.activeNetwork + "-" + id + ".json е от друг трезор (" + already.deployer + "). Избери този трезор (--vault) или друг токен от каталога.");
  // (а) MetaMask прозорец
  let mm = null;
  if (!flag("no-wallet")) {
    try { const MM = require("./metamask.js"); mm = await MM.openReady({ log, vault: ve }); log("👁 MetaMask (" + mm.browser + ") показва трезора — раздели Tokens / Activity."); }
    catch (e) { log("⚠ MetaMask/Edge не се отвори: " + e.message + " — продължавам БЕЗ прозорец (ботът подписва сам; нищо не зависи от MetaMask)."); }
  }
  const stopAll = async () => { if (mm) await mm.close().catch(() => {}); process.exit(0); };
  process.on("SIGINT", stopAll);
  try {
    log("Трезор (акаунт #0): " + w.address + " · пазач (#1): " + gAddr);
    log("Мрежа: " + CFG.activeNetwork + " (chainId " + NET.chainId + ", " + NET.currency + ")" + (NET.explorer ? " · " + NET.explorer + "/address/" + w.address : ""));
    // (б) сума за ликвидност
    const all = !!flag("all");
    let liq = (bnbArg !== undefined && bnbArg !== null && bnbArg !== "") ? Number(bnbArg) : null;
    if (liq !== null && !(liq > 0)) throw new Error("Невалидна сума за ликвидност: " + bnbArg);
    if (liq === null && !all) {
      const a = process.stdin.isTTY ? await ask("Колко " + NET.currency + " за ликвидност? [число; Enter = ЦЯЛАТА налична сума над резерва за газ]: ") : "";
      if (a) { liq = Number(a); if (!(liq > 0)) throw new Error("Невалидна сума: " + a); }
    }
    const M = CFG.market || {}; const reserve = Number(M.gasReserveBnb || 0.02);
    const minLiq = ethers.parseEther(String(M.minLiquidityBnb || "0.001"));
    const minGuard = ethers.parseEther(String(CFG.protect.minGuardianGas || "0.01"));
    const topUp = ethers.parseEther(String(CFG.protect.guardianGasTopUp || "0.02"));
    async function need() {
      const fee = await pv.getFeeData(); const gp = fee.gasPrice || 1000000000n;
      const gasWei = gp * 6000000n;   // деплой (~3M газ) + setGuard + approve + addLiquidity + 2×setGuard — с марж
      const gb = await pv.getBalance(gAddr);
      const guardTop = (gb < minGuard && CFG.activeNetwork !== "hardhat-local") ? topUp : 0n;
      const bal = await pv.getBalance(w.address);
      const fixed = gasWei + guardTop + ethers.parseEther(String(reserve));
      let liqWei = liq !== null ? ethers.parseEther(String(liq)) : (bal > fixed ? bal - fixed : 0n);
      if (already && already.pair) liqWei = 0n;   // пазар вече има → ликвидност не трябва
      return { bal, total: fixed + liqWei, liqWei, gasWei, guardTop };
    }
    log("💰 Преведи " + NET.currency + " на този адрес: " + w.address + (NET.faucet ? "   (testnet кран: " + NET.faucet + ")" : ""));
    log("   Проверявам баланса на всеки 10 s (спри с Ctrl+C)…");
    let n = 0, last = null;
    while (true) {
      const r = await need().catch((e) => { log("RPC грешка: " + (e.shortMessage || e.message || "").slice(0, 80)); return null; });
      if (r) {
        const enough = liq !== null ? r.bal >= r.total : (already && already.pair ? r.bal >= r.total : r.liqWei >= minLiq);
        if (enough) { last = r; break; }
        if (n % 3 === 0) log("⏳ чакам… баланс " + fE(r.bal) + " / нужни " + fE(r.total) + " " + NET.currency + " (липсват " + fE(r.total > r.bal ? r.total - r.bal : 0n) + ": ликвидност " + fE(r.liqWei) + " + газ ~" + fE(r.gasWei) + (r.guardTop ? " + пазач " + fE(r.guardTop) : "") + " + резерв " + reserve + ")");
      }
      n++; await sleep(10000);
    }
    if (liq === null) liq = Math.floor(Number(ethers.formatEther(last.liqWei)) * 1e6) / 1e6;
    log("✅ Балансът стига: " + fE(last.bal) + " " + NET.currency + " → ликвидност " + liq + " " + NET.currency + (last.guardTop ? " (+ зареждане на пазача " + fE(last.guardTop) + ")" : ""));
    // (в) деплой + Vault Guard + страница
    if (!already) await create(id);
    const d = loadDeploy(id);
    if (!d) throw new Error("Деплоят не остави запис deployments/" + CFG.activeNetwork + "-" + id + ".json — спирам.");
    if (mm) { try { await mm.importTokens([d]); } catch (e) { log("ℹ токенът не се внесе в MetaMask: " + (e.message || "").slice(0, 60)); } }
    // (г) пазар
    if (await readPrice(id).catch(() => null)) log("ℹ Пазар за " + d.symbol + " вече има — пропускам ликвидността.");
    else if (liq > 0) { const tokens = Math.floor(Number(d.supply) * Number(M.liquidityTokenPercent || 30) / 100); await liquidity(id, liq, tokens); }
    else log("ℹ Ликвидност 0 — пазар не пускам (по-късно: node bot.js liquidity " + id + " <bnb> <tokens>).");
    // (д) статистика / цена / съвет / страница
    await stats(id).catch((e) => log("stats: " + (e.shortMessage || e.message || "").slice(0, 60)));
    await advise(id).catch(() => {});
    generatePage(id); generateIndex();
    log("📄 Страница на токена: " + pageUrl(id) + "   (жива след деплой на сайта)");
    if (mm) await mm.showActivity().catch(() => {});
    // (е) охрана
    log("🛡 Автопилотът остава в режим ОХРАНА (monitor) — авто-отменя подозрителни задържани преводи от трезора. Ctrl+C за спиране.");
    await monitor(id);
  } catch (e) {
    log("⛔ АВТОПИЛОТ СПРЯН: " + (e.shortMessage || e.message || e));
    log("   Нищо не е повторено автоматично (без втори деплой). Провери: node bot.js status " + id + "  ·  дневник: wallet/autopilot.log");
    if (mm) { log("   MetaMask прозорецът остава отворен — Ctrl+C за изход."); await new Promise(() => {}); }
    process.exit(1);
  }
}

// ── TG: Telegram канал на токените (telegram.js; wallet/telegram.json) ──
//   tg setup <botToken> <@канал|chat_id> [--lang bg|en|ru|bg,en] · tg test · tg status · tg post "<текст>" [id] [--force] · tg weekly [id] · tg auto on|off
async function tgCmd(sub, x, y) {
  const tg = require("./telegram.js");
  if (sub === "setup") {
    // (11.09.2026) Ключ/канал/език по подразбиране от .env в тази папка (извън git и деплоя): TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL, TELEGRAM_LANG.
    const E = {}; try { for (const l of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/); if (m) E[m[1]] = m[2]; } } catch (_) {}
    if (x && !y && !/^\d+:[\w-]{20,}$/.test(x)) { y = x; x = null; }
    x = x || E.TELEGRAM_BOT_TOKEN || null; y = y || E.TELEGRAM_CHANNEL || null;
    if (!x || !y) { console.error("Употреба: node bot.js tg setup [<botToken>] <@канал|chat_id> [--lang bg|en|ru|bg,en]  (ключът може да е в .env: TELEGRAM_BOT_TOKEN)"); process.exit(1); }
    const lang = flag("lang") || E.TELEGRAM_LANG; const r = await tg.setup(x, y, lang && lang !== true ? lang : null);
    log("✅ Telegram: бот @" + r.me.username + " · канал „" + (r.chat.title || r.chat.username || r.chat.id) + "“ (" + r.chat.type + ", id " + r.chat.id + ") · езици " + r.cfg.lang);
    log("   Записано в " + path.relative(__dirname, tg.cfgFile()).replace(/\\/g, "/") + " (извън git; token " + tg.mask(r.cfg.token) + ")");
    if (!r.canPost) log("⚠ Ботът НЕ може да публикува (статус: " + r.memberStatus + ") — канал → Administrators → Add admin → @" + r.me.username + " → право „Post messages“. После: tg test");
    else log("   Ботът е администратор с право да публикува. Провери: node bot.js tg test");
  } else if (sub === "test") {
    const r = await tg.test(); log("✅ Тестово съобщение изпратено в „" + r.cfg.chatTitle + "“ (message_id " + r.ids.join(",") + ")");
  } else if (sub === "status") {
    tg.statusLines().forEach((l) => console.log(l));
  } else if (sub === "post") {
    if (!x) { console.error('Употреба: node bot.js tg post "<текст>" [id на токен за линкове] [--force]'); process.exit(1); }
    const c = y ? tgCtx(y) : null;
    if (y && !c) throw new Error("Токенът " + y + " не е пуснат в " + CFG.activeNetwork + " — няма линкове за него.");
    const r = await tg.post(x, c, !!flag("force"));
    log("✅ Публикувано (message_id " + r.ids.join(",") + ")");
  } else if (sub === "weekly") {
    const ids = x ? [x] : CAT.filter((t) => loadDeploy(t.id)).map((t) => t.id);
    const items = [];
    for (const tid of ids) {
      if (!loadDeploy(tid)) { log("[" + tid + "] не е пуснат в " + CFG.activeNetwork + " — пропускам"); continue; }
      let s; try { s = await readSnapshot(tid); } catch (e) { log("[" + tid + "] веригата не отговори: " + (e.shortMessage || e.message || "").slice(0, 80)); continue; }
      let hist = []; try { hist = JSON.parse(fs.readFileSync(statsFile(tid), "utf8")); } catch (_) {}
      const change7 = tg.change7(hist, s);
      if (s.priceBnb) { hist.push(s); fs.writeFileSync(statsFile(tid), JSON.stringify(hist, null, 2)); recordNow(tid); }   // точка за следващата седмица
      items.push({ ctx: tgCtx(tid), s, change7 });
      log("[" + tid + "] " + (s.priceBnb ? "цена " + s.priceBnb.toPrecision(5) + " " + NET.currency + " · 7 дни: " + (change7 == null ? "няма данни" : change7.toFixed(1) + "%") : "без пазар"));
    }
    if (!items.length) { log("Няма пуснати токени за седмичната статистика в " + CFG.activeNetwork + "."); return; }
    const r = await tg.notify("weekly", { items });
    log(r.msg || (r.status === "off" ? tg.statusLines()[0] : "Telegram: " + r.status));
  } else if (sub === "auto") {
    if (x !== "on" && x !== "off") { console.error("Употреба: node bot.js tg auto on|off"); process.exit(1); }
    log("Telegram автоматични постове: " + (tg.setAuto(x === "on") ? "ВКЛ." : "ИЗКЛ."));
  } else {
    console.log("Telegram канал на токените (собствен канал; бот от @BotFather като администратор):");
    console.log("  tg setup <botToken> <@канал|chat_id> [--lang bg|en|ru|bg,en]   — проверява и записва wallet/telegram.json");
    console.log("  tg test | tg status | tg auto on|off");
    console.log('  tg post "<текст>" [id] [--force]   — пост + линкове на токена + предупреждение за риска');
    console.log("  tg weekly [id]                     — седмична статистика (за Scheduled Task; меню 76 → 5)");
  }
}

// аргументи без флаговете (--all, --vault X, --no-wallet, --lang X, --force)
const ARGS = process.argv.slice(2).filter((a, i, arr) => !a.startsWith("--") && !(i > 0 && (arr[i - 1] === "--vault" || arr[i - 1] === "--lang")));
const [cmd, a1, a2, a3] = ARGS;
(async () => {
  try {
    if (cmd !== "autopilot") await chooseVault(false);   // --vault <адрес|№> за всяка команда
    if (cmd === "menu" || cmd === "catalog") { menu(); process.exit(0); }
    else if (cmd === "record") { if (a1) recordNow(a1); else for (const f of fs.readdirSync(path.join(__dirname, "deployments"))) { const m = f.match(new RegExp("^" + CFG.activeNetwork + "-([a-z0-9-]+)\\.json$")); if (m) recordNow(m[1]); } process.exit(0); }
    else if (cmd === "autopilot") { await autopilot(a1, a2); return; }
    else if (cmd === "index") { generateIndex(); process.exit(0); }
    else if (cmd === "create") await create(a1);
    else if (cmd === "launch") await launch(a1);
    else if (cmd === "list") { list(); process.exit(0); }
    else if (cmd === "status") await status(a1);
    else if (cmd === "send") await send(a1, a2, a3);
    else if (cmd === "wallet" || cmd === "balance") await walletCmd();
    else if (cmd === "liquidity") await liquidity(a1, a2, a3);
    else if (cmd === "unliquidity") await unliquidity(a1, a2, a3);
    else if (cmd === "price") await price(a1);
    else if (cmd === "buy") await buy(a1, a2);
    else if (cmd === "sell") await sell(a1, a2);
    else if (cmd === "burn") await burnCmd(a1, a2);
    else if (cmd === "withdraw") await withdraw(a1, a2);
    else if (cmd === "stats") await stats(a1);
    else if (cmd === "adopt") await adopt(a1, a2);
    else if (cmd === "block" || cmd === "unblock") await blockCmd(a1, ARGS.slice(2), cmd === "block");
    else if (cmd === "blocked") await blockedCmd(a1);
    else if (cmd === "open") await openCmd(a1, a2);
    else if (cmd === "advise") await advise(a1);
    else if (cmd === "page") { generatePage(a1); generateIndex(); process.exit(0); }
    else if (cmd === "monitor") { await monitor(a1); return; }
    else if (cmd === "tg") await tgCmd(a1, a2, a3);
    else {
      console.log("Команди:");
      console.log("  menu | create <id> | list | status <id> | monitor [id] | wallet");
      console.log("  autopilot <id> [bnb] [--all]      — ВСИЧКО само: Edge+MetaMask → чака превод → деплой → пазар → охрана");
      console.log("  launch <id>                       — пуска токена И попълва пазара сам");
      console.log("  send <id> <addr> <amount>         — прехвърляне");
      console.log("  liquidity <id> [bnb] [tokens]     — пуска пазар (без суми → ботът ги попълва сам)");
      console.log("  price <id> | stats <id> | advise <id>   — цена / статистика / съвети");
      console.log("  page <id> | index                 — (пре)генерира страницата https://pupikes.com/crypto/<slug>/ (+ admin/, /crypto/<символ>/) и индекса /crypto/");
      console.log("  adopt <id> <адрес> [--force]      — запиши токен, пуснат от админ страницата (/crypto/<символ>/admin/ → „Създай нов токен“)");
      console.log("  block <id> <адрес…> | unblock <id> <адрес…> — блокира/отблокира адреси (само V2 договорите; не пипа двойката/рутера/трезора/пазача/фонда)");
      console.log("  blocked <id>                      — блокираните адреси (събития AddressBlocked + текущо isBlocked; само четене)");
      console.log("  open <id> [сек]                   — отвори търговията на V2 токен (веднъж; ботът сам го прави след ликвидността)");
      console.log("  --vault <адрес|№>                 — избран трезор от регистъра (node vault.js list); по подразбиране wallet/");
      console.log("  buy <id> <bnb>                    — [демо] купи (симулира търсене)");
      console.log("  sell <id> <tokens>                — продай токени → BNB (в бота)");
      console.log("  burn <id> <tokens>                — изгори от трезора (дефлация)");
      console.log("  withdraw <bnb> <addr>             — тегли BNB към твой акаунт");
      console.log("  tg setup <botToken> <@канал> [--lang bg,en] | tg test | tg status | tg auto on|off — Telegram канал на токените");
      console.log('  tg post "<текст>" [id] [--force] | tg weekly [id]  — пост в канала / седмична статистика (за Scheduled Task)');
      process.exit(0);
    }
    if (cmd !== "monitor" && cmd !== "autopilot") process.exit(0);
  } catch (e) { console.error("ГРЕШКА:", e.shortMessage || e.message || e); process.exit(1); }
})();
