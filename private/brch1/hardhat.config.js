require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    bscTestnet: {
      url: "https://bsc-testnet.publicnode.com",
      chainId: 97,
      accounts: [PRIVATE_KEY],
      gasPrice: 10_000_000_000,
    },
    bsc: {
      url: "https://bsc-rpc.publicnode.com",
      chainId: 56,
      accounts: [PRIVATE_KEY],
      gasPrice: 3_000_000_000,
    },
  },
  etherscan: {
		apiKey: BSCSCAN_API_KEY,
  },
};