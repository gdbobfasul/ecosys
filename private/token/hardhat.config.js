// Version: 1.0093
require("@nomicfoundation/hardhat-toolbox");
const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200  // Low runs value for smaller contract size
      },
      evmVersion: "cancun"
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
