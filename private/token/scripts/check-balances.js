// Version: 1.0093
/**
 * @version v34
 */

const {
  displayNetworkInfo,
  getTokenContract,
  getAllBalances,
  displayBalances,
  getDistributionAddresses,
  getExplorerUrl
} = require("../utils/helpers");

async function main() {
  console.log("=== KCY1 Token Balance Check ===\n");
  
  await displayNetworkInfo();
  
  const token = await getTokenContract();
  const distAddrs = await getDistributionAddresses(token);
  const balances = await getAllBalances(token);
  
  console.log("📋 Distribution Addresses (from contract):");
  console.log("  DEV:", distAddrs.dev);
  console.log("  Marketing:", distAddrs.marketing);
  console.log("  Team:", distAddrs.team);
  console.log("  Advisor:", distAddrs.advisor);
  console.log("");
  
  await displayBalances(balances, distAddrs);
  
  // Additional info
  const distCompleted = await token.initialDistributionCompleted();
  const tradingEnabled = await token.isTradingEnabled();
  
  console.log("\n📊 Status:");
  console.log("  Distribution:", distCompleted ? "✅ Done" : "⏳ Pending");
  console.log("  Trading:", tradingEnabled ? "✅ Enabled" : "⏳ Locked");
  
  if (!tradingEnabled) {
    const timeLeft = await token.timeUntilTradingEnabled();
    const hours = Number(timeLeft) / 3600;
    console.log("  Time until trading:", hours.toFixed(2), "hours");
  }
  
  console.log("\n🔗 View on explorer:");
  console.log(await getExplorerUrl());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });