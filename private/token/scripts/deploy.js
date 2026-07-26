// Version: 1.0093
/**
 * @version v34
 */

const hre = require("hardhat");
const { getSigner, formatTokens, waitForTx, getExplorerUrl } = require("../utils/helpers");

async function main() {
  console.log("=== PUPIKES1 Token Deployment ===\n");
  
  const signer = await getSigner();
  const networkName = hre.network.name;
  
  console.log("🌐 Network:", networkName);
  console.log("🔑 Deployer:", signer.address);
  
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "BNB");
  console.log("");
  
  // Deploy
  console.log("📦 Deploying PUPIKES1Token...");
  const PUPIKES1 = await hre.ethers.getContractFactory("PUPIKES1Token");
  const token = await PUPIKES1.deploy();
  await token.waitForDeployment();
  
  const address = await token.getAddress();
  console.log("✅ Token deployed!");
  console.log("📄 Address:", address);
  console.log("");
  
  // Get distribution addresses from contract
  const distAddrs = await token.getDistributionAddresses();
  console.log("📋 Distribution Addresses (from contract):");
  console.log("  DEV:", distAddrs[0]);
  console.log("  Marketing:", distAddrs[1]);
  console.log("  Team:", distAddrs[2]);
  console.log("  Advisor:", distAddrs[3]);
  console.log("");
  
  // Initial balances
  const devBalance = await token.balanceOf(distAddrs[0]);
  const contractBalance = await token.balanceOf(address);
  
  console.log("💵 Initial Balances:");
  console.log("  DEV:", formatTokens(devBalance), "PUPIKES1");
  console.log("  Contract:", formatTokens(contractBalance), "PUPIKES1");
  console.log("");
  
  // Trading lock info
  const tradingEnabledTime = await token.tradingEnabledTime();
  const tradingDate = new Date(Number(tradingEnabledTime) * 1000);
  
  console.log("⏰ Trading locked for 48 hours");
  console.log("🕐 Trading enabled at:", tradingDate.toLocaleString());
  console.log("");
  
  console.log("📝 NEXT STEPS:");
  console.log("1. Update config/networks.js with token address:");
  console.log(`   tokenAddress: "${address}"`);
  console.log("");
  console.log("2. Run distribution:");
  console.log(`   npx hardhat run scripts/configure.js --network ${networkName}`);
  console.log("");
  console.log("3. Verify on explorer:");
  console.log(`   npx hardhat verify --network ${networkName} ${address}`);
  console.log("");
  
  const explorerUrl = await getExplorerUrl("address", address);
  console.log("🔗 View on explorer:");
  console.log(explorerUrl);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });