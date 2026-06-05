// Version: 1.0173
// ──────────────────────────────────────────────────────────────────────────
// token-creator — ОРКЕСТРАТОР за създаване на токен (ethers, без MetaMask/UI).
//
// Прави цялата верига: deploy → (distribute) → добави ликвидност на PancakeSwap →
// регистрирай двойката → запиши адреса. БЕЗОПАСНО: testnet по подразбиране,
// dry-run, потвърждение, и ТВЪРДА защита за mainnet.
//
// Употреба:
//   node create-token.js                         # bscTestnet, с потвърждение
//   node create-token.js --dry-run               # само план + проверки, без tx
//   node create-token.js --yes                   # без интерактивно потвърждение
//   node create-token.js --skip-liquidity        # само deploy, без пул
//   node create-token.js --network bscMainnet --i-understand-mainnet   # РЕАЛНИ пари!
//
// PRIVATE_KEY се чете от ../configs/.env — само ЛОКАЛНО (никога на сървър).
// ──────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

let ethers;
try { ({ ethers } = require('ethers')); }
catch (e) { console.error('\n✗ Липсва ethers. Инсталирай: npm install (в token-creator) или ползвай root ethers.\n'); process.exit(2); }

const cfg = require('./config');
const { loadKey } = require('./lib/env');
const ABIS = require('./lib/abis');

// ── аргументи ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const network = val('--network', cfg.defaultNetwork);
const dryRun = has('--dry-run');
const autoYes = has('--yes');

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a.trim()); }));
}

function getNetworkConfig() {
  const mod = require(cfg.networksModule);
  let n = null;
  if (typeof mod.getNetworkConfig === 'function') n = mod.getNetworkConfig(network);
  if (!n && mod[network]) n = mod[network];
  if (!n && mod.networks && mod.networks[network]) n = mod.networks[network];
  if (!n) throw new Error(`Няма конфиг за мрежа "${network}" в ${cfg.networksModule}`);
  return n;
}

(async () => {
  console.log(`\n🪙  token-creator — мрежа: ${network}${dryRun ? '  (DRY-RUN)' : ''}\n`);

  // ── 0) Защита mainnet ──
  if (/main/i.test(network) && !has('--i-understand-mainnet')) {
    console.error('⛔ Mainnet деплой = РЕАЛНИ пари. Добави --i-understand-mainnet, ако наистина искаш.');
    console.error('   Препоръка: първо тествай на bscTestnet (по подразбиране).\n');
    process.exit(2);
  }

  // ── 1) Конфиг + ключ + artifact ──
  const net = getNetworkConfig();
  const { router: ROUTER, factory: FACTORY, WBNB, rpc, explorer } = net;
  if (!ROUTER || /^0x0+$/.test(ROUTER)) throw new Error(`Router адресът за ${network} е празен/нулев (виж shared/contracts/Addresses.sol)`);

  const { privateKey } = loadKey(cfg.globalEnv);
  if (!fs.existsSync(cfg.artifactPath)) {
    throw new Error(`Няма artifact: ${cfg.artifactPath}\n   Компилирай първо: cd ../token && npx hardhat compile`);
  }
  const artifact = JSON.parse(fs.readFileSync(cfg.artifactPath, 'utf8'));

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  // ── 2) Preflight проверки ──
  const chain = await provider.getNetwork();
  if (net.chainId && Number(chain.chainId) !== Number(net.chainId)) {
    throw new Error(`RPC chainId ${chain.chainId} ≠ очаквания ${net.chainId} за ${network}`);
  }
  const balance = await provider.getBalance(wallet.address);
  const bnbForLiq = ethers.parseEther(String(cfg.liquidity.bnb));
  const needGas = ethers.parseEther('0.01'); // груба резерва за газ
  const needTotal = (cfg.steps.addLiquidity && !has('--skip-liquidity')) ? bnbForLiq + needGas : needGas;

  console.log('── Preflight ──');
  console.log('  Деплойър:', wallet.address);
  console.log('  Баланс:  ', ethers.formatEther(balance), 'BNB');
  console.log('  Router:  ', ROUTER);
  console.log('  WBNB:    ', WBNB);
  console.log('  Explorer:', explorer);
  console.log('  Ликвидност:', cfg.liquidity.tokens, 'токена +', cfg.liquidity.bnb, 'BNB');
  if (balance < needTotal) {
    throw new Error(`Недостатъчен баланс: имаш ${ethers.formatEther(balance)} BNB, трябват ~${ethers.formatEther(needTotal)} BNB`);
  }
  console.log('  ✓ Баланс достатъчен\n');

  if (dryRun) { console.log('DRY-RUN: спирам преди транзакции. Всичко изглежда наред.\n'); process.exit(0); }

  if (!autoYes) {
    const a = await ask(`Продължавам с РЕАЛНИ транзакции на ${network}? [yes/N]: `);
    if (!/^y(es)?$/i.test(a)) { console.log('Отказано.'); process.exit(0); }
  }

  const result = { network, deployer: wallet.address, startedAt: new Date().toISOString(), steps: {} };
  const explorerTx = (h) => `${explorer}/tx/${h}`;

  // ── 3) Deploy ──
  console.log('\n[1] Деплой на', cfg.contractName, '...');
  const factoryC = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const token = await factoryC.deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  result.tokenAddress = tokenAddr;
  result.steps.deploy = { tx: token.deploymentTransaction()?.hash };
  console.log('    ✓ Токен:', tokenAddr);
  console.log('    ', `${explorer}/address/${tokenAddr}`);
  // запиши адреса РАНО (да не се губи дори ако следваща стъпка гръмне)
  saveResult(result);

  const tokenRW = new ethers.Contract(tokenAddr, artifact.abi, wallet);
  const erc20 = new ethers.Contract(tokenAddr, ABIS.ERC20, wallet);
  const decimals = await erc20.decimals().catch(() => 18);

  // ── 4) Разпределение (ако не е в конструктора) ──
  if (cfg.steps.distribute) {
    try {
      console.log('[2] distributeInitialAllocations() ...');
      const tx = await tokenRW.distributeInitialAllocations();
      await tx.wait(); result.steps.distribute = { tx: tx.hash };
      console.log('    ✓', explorerTx(tx.hash));
    } catch (e) { console.log('    ↻ пропуснато (вероятно в конструктора):', e.shortMessage || e.message); }
  }

  // ── 5) Добави ликвидност на PancakeSwap (създава KCY1/WBNB двойката) ──
  if (cfg.steps.addLiquidity && !has('--skip-liquidity')) {
    const router = new ethers.Contract(ROUTER, ABIS.ROUTER, wallet);
    const tokenAmount = ethers.parseUnits(String(cfg.liquidity.tokens), decimals);
    const slip = BigInt(Math.round((100 - cfg.liquidity.slippagePct) * 100));
    const minToken = (tokenAmount * slip) / 10000n;
    const minBNB = (bnbForLiq * slip) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + cfg.liquidity.deadlineMin * 60;

    console.log('[3] Approve на Router за', cfg.liquidity.tokens, 'токена ...');
    const ap = await erc20.approve(ROUTER, tokenAmount); await ap.wait();
    console.log('    ✓', explorerTx(ap.hash));

    console.log('[4] addLiquidityETH (', cfg.liquidity.tokens, 'токена +', cfg.liquidity.bnb, 'BNB) ...');
    const add = await router.addLiquidityETH(tokenAddr, tokenAmount, minToken, minBNB, wallet.address, deadline, { value: bnbForLiq });
    await add.wait(); result.steps.addLiquidity = { tx: add.hash };
    console.log('    ✓', explorerTx(add.hash));

    // ── 6) Намери и регистрирай двойката ──
    const factoryDex = new ethers.Contract(FACTORY, ABIS.FACTORY, provider);
    const pair = await factoryDex.getPair(tokenAddr, WBNB);
    result.pairAddress = pair;
    console.log('    ✓ Двойка KCY1/WBNB:', pair);

    if (cfg.steps.registerPair && pair && !/^0x0+$/.test(pair)) {
      try {
        console.log('[5] token.setLiquidityPair(pair, true) ...');
        const reg = await tokenRW.setLiquidityPair(pair, true);
        await reg.wait(); result.steps.registerPair = { tx: reg.hash };
        console.log('    ✓', explorerTx(reg.hash));
      } catch (e) { console.log('    ! setLiquidityPair гръмна:', e.shortMessage || e.message); }
    }
  }

  // ── 7) Запис + .env ред ──
  result.finishedAt = new Date().toISOString();
  saveResult(result);
  console.log('\n══════════════════════════════════════════════════');
  console.log('  ✅ ГОТОВО — токенът е създаден на', network);
  console.log('  Адрес:', tokenAddr);
  if (result.pairAddress) console.log('  Двойка:', result.pairAddress);
  console.log('  Explorer:', `${explorer}/address/${tokenAddr}`);
  console.log('\n  Добави в private/configs/.env (token-monitor):');
  console.log(`    TOKEN_CONTRACT_ADDRESS=${tokenAddr}`);
  console.log('══════════════════════════════════════════════════\n');

  function saveResult(r) {
    try {
      fs.mkdirSync(cfg.deploymentsDir, { recursive: true });
      fs.writeFileSync(path.join(cfg.deploymentsDir, `${network}-latest.json`), JSON.stringify(r, null, 2));
    } catch (_) {}
  }
})().catch((e) => { console.error('\n✗ token-creator гръмна:', e.shortMessage || e.message || e); process.exit(3); });
