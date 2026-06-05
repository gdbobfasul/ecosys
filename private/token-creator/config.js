// Version: 1.0173
// ──────────────────────────────────────────────────────────────────────────
// token-creator — конфигурация на оркестратора за създаване на токен.
//
// БЕЗОПАСНОСТ: по подразбиране bscTestnet. Mainnet изисква изричен флаг
// (--network bscMainnet --i-understand-mainnet). PRIVATE_KEY се чете от
// ГЛОБАЛНИЯ .env (private/configs/.env) и стои само ЛОКАЛНО — никога на сървър.
// ──────────────────────────────────────────────────────────────────────────
'use strict';
const path = require('path');

module.exports = {
  // Мрежа по подразбиране (BSC testnet). Mainnet само с изричен флаг.
  defaultNetwork: 'bscTestnet',

  // Реюзваме готовия токен проект (контракт, artifacts, адреси на PancakeSwap).
  tokenProjectDir: path.join(__dirname, '..', 'token'),
  contractName: 'KCY1Token',
  // Hardhat artifact (abi + bytecode) — генерира се с `npx hardhat compile` в ../token.
  artifactPath: path.join(__dirname, '..', 'token', 'artifacts', 'contracts', 'kcy-meme-1.sol', 'KCY1Token.json'),
  // Мрежовите конфиги (router/factory/WBNB/rpc/explorer) идват от токен проекта.
  networksModule: path.join(__dirname, '..', 'token', 'config', 'networks.js'),

  // Глобалният .env (за PRIVATE_KEY) — само локално.
  globalEnv: path.join(__dirname, '..', 'configs', '.env'),

  // ── Начална ликвидност на PancakeSwap ──
  liquidity: {
    bnb: process.env.TC_LIQUIDITY_BNB || '0.05',        // колко BNB в пула (testnet: малко)
    tokens: process.env.TC_LIQUIDITY_TOKENS || '1000000', // колко токена в пула (в цели единици)
    slippagePct: Number(process.env.TC_SLIPPAGE || 1),  // толеранс при addLiquidity
    deadlineMin: 20,                                     // минути валидност на tx
  },

  // Записваме резултата тук + предлагаме ред за .env (TOKEN_CONTRACT_ADDRESS).
  deploymentsDir: path.join(__dirname, 'deployments'),

  // Стъпки след deploy (всяка може да се изключи с флаг).
  steps: {
    distribute: true,     // distributeInitialAllocations() (ако не е в конструктора)
    addLiquidity: true,   // router.addLiquidityETH → създава KCY1/WBNB двойката
    registerPair: true,   // token.setLiquidityPair(pair, true)
    recordAddress: true,  // запиши адреса + .env ред
  },
};
