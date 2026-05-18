// Manual verify скрипт - извикваш го ако автоматичното verify в deploy.js провали се
//
// Usage:
//   npm run verify:testnet
//   npm run verify:mainnet

const { run, network } = require("hardhat");
const fs = require("fs");

async function main() {
  const net = network.name;
  const filename = `deployment-${net}.json`;

  if (!fs.existsSync(filename)) {
    console.log(`✗ Не намирам ${filename}`);
    console.log(`  Първо трябва да направиш deploy преди да можеш да verify-неш.`);
    process.exit(1);
  }

  const info = JSON.parse(fs.readFileSync(filename, "utf8"));
  console.log(`Verifying ${info.tokenAddress} на ${info.networkName}...`);

  try {
    await run("verify:verify", {
      address: info.tokenAddress,
      constructorArguments: [info.owner],
    });
    console.log(`✓ Verified успешно!`);
    console.log(`  ${info.explorer}#code`);
  } catch (err) {
    if (err.message.toLowerCase().includes("already verified")) {
      console.log(`✓ Вече е verified`);
    } else {
      console.log(`✗ Verify провали се: ${err.message}`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
