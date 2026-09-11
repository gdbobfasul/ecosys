// Version: 1.0093
require("@nomicfoundation/hardhat-toolbox");
const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    // ВАЖНО: „compilers" + „overrides" (при кратката форма version/settings Hardhat ИГНОРИРА overrides).
    // Настройките по подразбиране са същите като преди (runs 200, cancun) → артефактите на старите договори не се менят.
    compilers: [{
      version: "0.8.28",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200  // Low runs value for smaller contract size
        },
        evmVersion: "cancun"
      }
    }],
    // (11.09.2026) V2 договорите са с много защити → optimizer runs=1 САМО за тях, за да се съберат в
    // лимита от 24 576 байта. Старите договори (вкл. пуснатия HRVS) остават с непроменени настройки и артефакти.
    overrides: {
      "token/contracts/PupikesV2Base.sol": { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 1 }, viaIR: true, evmVersion: "cancun" } },
      "token/contracts/PupikesFeatureTokenV2.sol": { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 1 }, viaIR: true, evmVersion: "cancun" } },
      "token/contracts/PupikesSentinelTokenV2.sol": { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 1 }, viaIR: true, evmVersion: "cancun" } },
      "token/contracts/PupikesGuardTokenV2.sol": { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 1 }, viaIR: true, evmVersion: "cancun" } },
      "token/contracts/LpTimelock.sol": { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 1 }, viaIR: true, evmVersion: "cancun" } },
      "token/contracts/mocks/MockDexPairV2Test.sol": { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 1 }, viaIR: true, evmVersion: "cancun" } }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false  // Enforce size limits in testing
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [] // Add your private keys here for deployment
    },
    bscMainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [] // Add your private keys here for deployment
    }
  },
  paths: {
    // Разширяваме root до private/, за да е в обхват централният
    // configs/Addresses.sol (единствен източник за адресите), който
    // pupikes-meme-1.sol импортира през "../../configs/Addresses.sol".
    // Иначе Hardhat дава HH408 (import outside of project).
    root: path.join(__dirname, ".."),
    sources: "token/contracts",
    tests: "../tests/token",
    cache: "token/cache",
    artifacts: "token/artifacts"
  }
};
