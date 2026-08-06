require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
const path = require("path");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },

    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : [],
    },

    bsc: {
      url: "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : [],
    },
  },

  paths: {
    // Разширяваме root до private/, за да е в обхват централният
    // configs/Addresses.sol, който pupikes-meme-1.sol импортира през
    // "../../configs/Addresses.sol" (иначе HH408 import outside project).
    root: path.join(__dirname, ".."),
    sources: "multisig/contracts",
    tests: "../tests/multisig",
    cache: "multisig/cache",
    artifacts: "multisig/artifacts"
  },

  mocha: {
    timeout: 200000,
  },
};
