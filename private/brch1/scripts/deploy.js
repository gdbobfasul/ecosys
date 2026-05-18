// =====================================================
// BeRicH 1 (BRCH1) — Interactive Deployment Wizard
// =====================================================
//
// Usage:
//   npm run deploy:testnet    (BSC Testnet — free, fake BNB)
//   npm run deploy:mainnet    (BSC Mainnet — real money!)
//
// What this script does:
//   1. Check deployer wallet balance
//   2. Deploy BeRicH1 contract
//   3. Create PancakeSwap pair (BRCH1/WBNB)
//   4. Set pair on token contract
//   5. Approve router to spend BRCH1
//   6. Add initial liquidity (100k BRCH1 + BNB)
//   7. Launch trading (setLaunched with 90s anti-snipe)
//   8. Save deployment info to deployment-<network>.json
// =====================================================

const { ethers, network, run } = require("hardhat");
const fs = require("fs");
const readline = require("readline");
const https = require("https");

// ============== NETWORK CONFIGURATIONS ==============
const NETWORKS = {
  bscTestnet: {
    name: "BSC Testnet",
    chainId: 97,
    FACTORY: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
    ROUTER:  "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
    WBNB:    "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    explorer: "https://testnet.bscscan.com",
    pancake:  "https://pancakeswap.finance/swap",
    faucet:   "https://testnet.bnbchain.org/faucet-smart",
    isTestnet: true,
    liquidityBNB: ethers.parseEther("0.001"), // 0.001 testnet BNB
  },
  bsc: {
    name: "BSC Mainnet",
    chainId: 56,
    FACTORY: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    ROUTER:  "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    WBNB:    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    explorer: "https://bscscan.com",
    pancake:  "https://pancakeswap.finance/swap",
    isTestnet: false,
    liquidityUSD: 200, // $200 worth of BNB
  },
};

// ============== PANCAKE ROUTER ABI ==============
const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)",
];

const FACTORY_ABI = [
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
];

// ============== HELPERS ==============
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function divider() {
  console.log(colors.dim + "─".repeat(60) + colors.reset);
}

function header(title) {
  console.log("");
  console.log(colors.bold + colors.cyan + "═".repeat(60) + colors.reset);
  console.log(colors.bold + colors.cyan + "  " + title + colors.reset);
  console.log(colors.bold + colors.cyan + "═".repeat(60) + colors.reset);
}

function step(num, total, title) {
  console.log("");
  console.log(colors.bold + colors.blue + `[${num}/${total}] ${title}` + colors.reset);
  divider();
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(colors.yellow + question + colors.reset, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function confirm(question, defaultYes = true) {
  const hint = defaultYes ? "(Y/n)" : "(y/N)";
  const answer = await prompt(`${question} ${hint}: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith("y");
}

// Fetch live BNB price for USD display (best-effort, no failure if offline)
function fetchBnbPrice() {
  return new Promise((resolve) => {
    const req = https.get(
      "https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT",
      { timeout: 5000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parseFloat(parsed.price));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function formatBnb(amount, bnbPrice = null) {
  const bnbStr = ethers.formatEther(amount);
  const bnbNum = parseFloat(bnbStr);
  if (bnbPrice) {
    const usd = (bnbNum * bnbPrice).toFixed(2);
    return `${bnbStr} BNB ($${usd})`;
  }
  return `${bnbStr} BNB`;
}

// Retry with exponential backoff
async function withRetry(fn, label, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      log(`  ⚠ Опит ${attempt}/${maxAttempts} неуспешен: ${err.message}`, "yellow");
      if (attempt === maxAttempts) {
        log(`  ✗ ${label} провали се след ${maxAttempts} опита`, "red");
        throw err;
      }
      const delay = 3000 * attempt;
      log(`  ⏱ Изчаквам ${delay/1000}s преди следващ опит...`, "dim");
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ============== MAIN ==============
async function main() {
  const net = network.name;
  const config = NETWORKS[net];

  if (!config) {
    log(`✗ Грешка: неподдържана мрежа "${net}"`, "red");
    log(`  Използвай: npm run deploy:testnet  или  npm run deploy:mainnet`, "dim");
    process.exit(1);
  }

  // Header
  console.clear();
  header(`🚀  BeRicH 1 (BRCH1) Deployment Wizard`);
  console.log("");
  log(`  Мрежа: ${colors.bold}${config.name}${colors.reset}`, "cyan");
  if (config.isTestnet) {
    log(`  ✓ Това е TESTNET — без реални пари, всички транзакции са безплатни`, "green");
  } else {
    log(`  ⚠ Това е MAINNET — реални пари, реални транзакции, необратимо!`, "red");
  }
  console.log("");

  // === Deployer info ===
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);
  const bnbPrice = config.isTestnet ? null : await fetchBnbPrice();

  log(`Deployer wallet:  ${deployer.address}`);
  log(`Баланс:           ${formatBnb(balance, bnbPrice)}`);
  if (bnbPrice) log(`BNB цена:         $${bnbPrice.toFixed(2)}`, "dim");

  // === Balance check ===
  const minBalance = config.isTestnet
    ? ethers.parseEther("0.05")
    : ethers.parseEther("0.35");

  if (balance < minBalance) {
    console.log("");
    log(`✗ Недостатъчен баланс! Необходим минимум: ${formatBnb(minBalance, bnbPrice)}`, "red");
    if (config.isTestnet) {
      log(`  Получи безплатно testnet BNB от:`, "yellow");
      log(`  ${config.faucet}`, "cyan");
    } else {
      log(`  Препоръчителен баланс: 0.40 BNB ($200 ликвидност + $50 gas + buffer)`, "yellow");
    }
    process.exit(1);
  }

  // === Pre-flight confirmation ===
  console.log("");
  log(`Какво ще се случи:`, "bold");
  log(`  1. Deploy на BeRicH1 контракта`);
  log(`  2. Създаване на PancakeSwap pair (BRCH1/WBNB)`);
  log(`  3. Set pair address на контракта`);
  log(`  4. Approve router за изразходване на BRCH1`);
  if (config.isTestnet) {
    log(`  5. Добавяне на ликвидност: 100,000 BRCH1 + 0.001 testnet BNB`);
  } else {
    log(`  5. Добавяне на ликвидност: 100,000 BRCH1 + ~$200 в BNB`);
  }
  log(`  6. Launch (setLaunched с 90s anti-snipe)`);
  log(`  7. Verify на BscScan`);
  log(`  8. Запис на deployment-${net}.json`);
  console.log("");

  const proceed = await confirm("Продължаваме ли?", true);
  if (!proceed) {
    log("Прекратено от потребителя.", "yellow");
    rl.close();
    return;
  }

  // ============== STEP 1: DEPLOY ==============
  step(1, 7, "Deploy на BeRicH1 контракта");

  const creatorWallet = deployer.address; // Единен wallet (по твой избор)
  log(`Creator wallet: ${creatorWallet}`);
  log(`(Този wallet ще е owner-а, ще получава такси, ще има unlimited holding)`, "dim");

  let token, tokenAddr;
  try {
    const Token = await ethers.getContractFactory("BeRicH1");
    log(`Изпращам deploy транзакцията...`, "dim");
    token = await withRetry(
      async () => {
        const t = await Token.deploy(creatorWallet);
        await t.waitForDeployment();
        return t;
      },
      "Deploy"
    );
    tokenAddr = await token.getAddress();
    log(`✓ Token deployed: ${colors.green}${tokenAddr}${colors.reset}`);
    log(`  Explorer: ${config.explorer}/address/${tokenAddr}`, "dim");
  } catch (err) {
    log(`✗ Deploy провали се: ${err.message}`, "red");
    rl.close();
    process.exit(1);
  }

  // ============== STEP 2: CREATE PAIR ==============
  step(2, 7, "Създаване на PancakeSwap pair");

  const factory = new ethers.Contract(config.FACTORY, FACTORY_ABI, deployer);
  let pairAddr;

  try {
    pairAddr = await factory.getPair(tokenAddr, config.WBNB);
    if (pairAddr === ethers.ZeroAddress) {
      log(`Pair все още не съществува, създавам...`, "dim");
      const tx = await withRetry(
        () => factory.createPair(tokenAddr, config.WBNB),
        "createPair"
      );
      await tx.wait();
      pairAddr = await factory.getPair(tokenAddr, config.WBNB);
    } else {
      log(`Pair вече съществува (от предишен опит?)`, "yellow");
    }
    log(`✓ Pair: ${colors.green}${pairAddr}${colors.reset}`);
  } catch (err) {
    log(`✗ Pair creation провали се: ${err.message}`, "red");
    rl.close();
    process.exit(1);
  }

  // ============== STEP 3: SET PAIR ON TOKEN ==============
  step(3, 7, "Set pair address на контракта");

  try {
    const tx = await withRetry(
      () => token.setPancakePair(pairAddr),
      "setPancakePair"
    );
    await tx.wait();
    log(`✓ Pair зададен на контракта`);
  } catch (err) {
    log(`✗ setPancakePair провали се: ${err.message}`, "red");
    log(`  Можеш да опиташ ръчно по-късно с: token.setPancakePair("${pairAddr}")`, "yellow");
    rl.close();
    process.exit(1);
  }

  // ============== STEP 4: APPROVE ROUTER ==============
  step(4, 7, "Approve router за изразходване на BRCH1");

  const liquidityTokens = ethers.parseEther("100000"); // 100,000 BRCH1
  try {
    const tx = await withRetry(
      () => token.approve(config.ROUTER, liquidityTokens),
      "approve"
    );
    await tx.wait();
    log(`✓ Approve completed (100,000 BRCH1 → router)`);
  } catch (err) {
    log(`✗ Approve провали се: ${err.message}`, "red");
    rl.close();
    process.exit(1);
  }

  // ============== STEP 5: ADD LIQUIDITY ==============
  step(5, 7, "Добавяне на initial liquidity");

  let bnbForLiquidity;
  if (config.isTestnet) {
    bnbForLiquidity = config.liquidityBNB;
    log(`Tokens:  100,000 BRCH1`);
    log(`BNB:     ${ethers.formatEther(bnbForLiquidity)} testnet BNB`);
  } else {
    // Mainnet: calculate BNB amount for $200
    if (!bnbPrice) {
      log(`⚠ Не можах да fetch-на BNB цена; използвам fallback $650`, "yellow");
    }
    const price = bnbPrice || 650;
    const bnbAmount = (config.liquidityUSD / price).toFixed(6);
    bnbForLiquidity = ethers.parseEther(bnbAmount);
    log(`Tokens:  100,000 BRCH1`);
    log(`BNB:     ${bnbAmount} BNB (~$${config.liquidityUSD} при цена $${price.toFixed(2)})`);
    log(`Стартова цена: $${(config.liquidityUSD / 100000).toFixed(6)} per BRCH1`);

    console.log("");
    const confirmLiq = await confirm("Потвърждаваш ли добавянето на ликвидността?", true);
    if (!confirmLiq) {
      log(`Прескачам добавянето на ликвидност.`, "yellow");
      log(`Можеш да го направиш по-късно през PancakeSwap UI:`, "dim");
      log(`  ${config.pancake}?outputCurrency=${tokenAddr}`, "cyan");
      log(`Прескачам и launch стъпката (имаш нужда от ликвидност преди launch).`, "yellow");
      await saveDeploymentInfo(net, config, tokenAddr, pairAddr, deployer.address, false);
      rl.close();
      return;
    }
  }

  const router = new ethers.Contract(config.ROUTER, ROUTER_ABI, deployer);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min

  try {
    const tx = await withRetry(
      async () => {
        return await router.addLiquidityETH(
          tokenAddr,
          liquidityTokens,
          0, // amountTokenMin (приемам всичко - няма slippage в инициалния pool)
          0, // amountETHMin
          deployer.address,
          deadline,
          { value: bnbForLiquidity }
        );
      },
      "addLiquidityETH"
    );
    const receipt = await tx.wait();
    log(`✓ Ликвидност добавена!`);
    log(`  Tx: ${receipt.hash}`, "dim");
    log(`  Explorer: ${config.explorer}/tx/${receipt.hash}`, "dim");
  } catch (err) {
    log(`✗ addLiquidity провали се: ${err.message}`, "red");
    log(`  Възможни причини:`, "yellow");
    log(`  - Недостатъчен BNB баланс`, "yellow");
    log(`  - Maxwallet check блокира pair-а (трябва да е exempt - проверявам в контракта)`, "yellow");
    rl.close();
    process.exit(1);
  }

  // ============== STEP 6: LAUNCH ==============
  step(6, 7, "Launch на trading (setLaunched с 90s anti-snipe)");

  try {
    const tx = await withRetry(
      () => token.setLaunched(90),
      "setLaunched"
    );
    await tx.wait();
    log(`✓ Trading стартиран!`);
    log(`  Първите 90 секунди: НЕ-buy период (anti-snipe)`);
    log(`  Следващите 10 минути: decay tax (99% → 50% → 15% → 6%)`);
    log(`  След това: normal 6% swap tax`);
  } catch (err) {
    log(`✗ setLaunched провали се: ${err.message}`, "red");
    log(`  Можеш да опиташ ръчно с: token.setLaunched(90)`, "yellow");
  }

  // ============== STEP 7: VERIFY ==============
  step(7, 7, "Verify контракта на BscScan");

  if (!process.env.BSCSCAN_API_KEY || process.env.BSCSCAN_API_KEY === "YOUR_BSCSCAN_API_KEY_HERE") {
    log(`⚠ BSCSCAN_API_KEY не е попълнен в .env файла`, "yellow");
    log(`  Можеш да verify-неш по-късно с:`, "dim");
    log(`  npx hardhat verify --network ${net} ${tokenAddr} "${creatorWallet}"`, "cyan");
  } else {
    try {
      log(`Изчаквам 30 секунди, преди да опитам verify (за да се пропагира bytecode-а)...`, "dim");
      await new Promise(r => setTimeout(r, 30000));
      await run("verify:verify", {
        address: tokenAddr,
        constructorArguments: [creatorWallet],
      });
      log(`✓ Verified на BscScan`);
    } catch (err) {
      if (err.message.toLowerCase().includes("already verified")) {
        log(`✓ Вече е verified`, "green");
      } else {
        log(`⚠ Verify провали се: ${err.message}`, "yellow");
        log(`  Можеш да опиташ ръчно с:`, "dim");
        log(`  npx hardhat verify --network ${net} ${tokenAddr} "${creatorWallet}"`, "cyan");
      }
    }
  }

  // ============== SAVE DEPLOYMENT INFO ==============
  await saveDeploymentInfo(net, config, tokenAddr, pairAddr, deployer.address, true);

  // ============== FINAL SUMMARY ==============
  console.log("");
  header(`✅  DEPLOYMENT COMPLETE`);
  console.log("");
  log(`Token:        ${tokenAddr}`, "green");
  log(`Pair:         ${pairAddr}`, "green");
  log(`Owner:        ${deployer.address}`, "green");
  console.log("");
  log(`BscScan:      ${config.explorer}/token/${tokenAddr}`, "cyan");
  log(`Pair info:    ${config.explorer}/address/${pairAddr}`, "cyan");
  log(`Pancake URL:  ${config.pancake}?outputCurrency=${tokenAddr}`, "cyan");
  console.log("");

  if (config.isTestnet) {
    log(`📌 Следващи стъпки на TESTNET:`, "bold");
    log(`  1. Опитай да купиш BRCH1 от PancakeSwap testnet (ще ти трябва testnet BNB)`);
    log(`  2. Опитай да продадеш — провери че tax е 6%`);
    log(`  3. Опитай wallet-to-wallet transfer — провери 0.001% tax`);
    log(`  4. Опитай да купиш повече от 1000 BRCH1 — трябва да revert-не`);
    log(`  5. Изчакай 365 дни и опитай halveAnnually() — или скочи времето с Hardhat`);
    log(`  Когато всичко работи, пусни: npm run deploy:mainnet`);
  } else {
    log(`📌 Следващи стъпки на MAINNET:`, "bold");
    log(`  1. Сподели в социалните мрежи (Twitter, Telegram)`);
    log(`  2. Изпрати link-а към PancakeSwap на купувачите`);
    log(`  3. По избор: запиши на BscScan описание + лого (token info update)`);
    log(`  4. Когато си готов: transferOwnership към Tangem wallet-а`);
    log(`  5. Помисли за liquidity lock (PinkLock / UNCX) за CMC trust`);
    log(`  6. Започни CMC application процеса`);
  }

  rl.close();
}

async function saveDeploymentInfo(net, config, tokenAddr, pairAddr, owner, launched) {
  const info = {
    network: net,
    networkName: config.name,
    chainId: config.chainId,
    deployedAt: new Date().toISOString(),
    tokenAddress: tokenAddr,
    pairAddress: pairAddr,
    owner: owner,
    launched: launched,
    explorer: `${config.explorer}/token/${tokenAddr}`,
    pancake: `${config.pancake}?outputCurrency=${tokenAddr}`,
  };
  const filename = `deployment-${net}.json`;
  fs.writeFileSync(filename, JSON.stringify(info, null, 2));
  log(`✓ Запазено в ${filename}`, "dim");
}

main().catch((err) => {
  log(`\n✗ Неочаквана грешка: ${err.message}`, "red");
  console.error(err);
  rl.close();
  process.exit(1);
});
