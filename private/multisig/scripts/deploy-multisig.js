// Version: 1.0056
const { ethers } = require("hardhat");

async function main() {
    console.log("=".repeat(60));
    console.log("MULTI-SIG + KCY1 DEPLOYMENT");
    console.log("=".repeat(60));
    
    // Get signers
    const [deployer] = await ethers.getSigners();
    console.log("\nDeploying from:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
    
    // ========================================================================
    // STEP 1: COLLECT OWNER ADDRESSES
    // ========================================================================
    
    console.log("\n" + "=".repeat(60));
    console.log("STEP 1: Multi-Sig Owners");
    console.log("=".repeat(60));
    
    // TODO: REPLACE WITH YOUR REAL ADDRESSES!
    const owners = {
        trezor1: "0xYOUR_TREZOR_1_ADDRESS",      // Replace!
        trezor2: "0xYOUR_TREZOR_2_ADDRESS",      // Replace!
        tangem1: "0xYOUR_TANGEM_1_ADDRESS",      // Replace!
        tangem2: "0xYOUR_TANGEM_2_ADDRESS",      // Replace!
        metamask: "0xYOUR_METAMASK_ADDRESS"      // Replace!
    };
    
    // For testnet, use deployer address for all (testing only!)
    if (network.name === "hardhat" || network.name === "localhost") {
        console.log("\n⚠️  TESTNET MODE - Using deployer for all owners");
        owners.trezor1 = deployer.address;
        owners.trezor2 = deployer.address;
        owners.tangem1 = deployer.address;
        owners.tangem2 = deployer.address;
        owners.metamask = deployer.address;
    }
    
    console.log("\nOwners (3-of-5 required):");
    console.log("  Trezor 1:", owners.trezor1);
    console.log("  Trezor 2:", owners.trezor2);
    console.log("  Tangem 1:", owners.tangem1);
    console.log("  Tangem 2:", owners.tangem2);
    console.log("  MetaMask:", owners.metamask);
    
    // ========================================================================
    // STEP 2: DEPLOY MULTI-SIG
    // ========================================================================
    
    console.log("\n" + "=".repeat(60));
    console.log("STEP 2: Deploy Multi-Sig Contract");
    console.log("=".repeat(60));
    
    const MultiSig = await ethers.getContractFactory("SimpleMultiSig");
    const multiSig = await MultiSig.deploy(
        owners.trezor1,
        owners.trezor2,
        owners.tangem1,
        owners.tangem2,
        owners.metamask
    );
    
    await multiSig.waitForDeployment();
    const multiSigAddress = await multiSig.getAddress();
    
    console.log("\n✅ Multi-Sig deployed at:", multiSigAddress);
    console.log("   Threshold: 3-of-5 signatures required");
    
    // ========================================================================
    // STEP 3: DEPLOY KCY1 TOKEN FROM MULTI-SIG
    // ========================================================================
    
    console.log("\n" + "=".repeat(60));
    console.log("STEP 3: Deploy KCY1 Token");
    console.log("=".repeat(60));
    
    // IMPORTANT: KCY1 owner will be msg.sender (deployer)
    // We need to transfer ownership to multi-sig after deployment
    // BUT our KCY1 has immutable owner! So we deploy from deployer first
    
    console.log("\n⚠️  NOTE: KCY1 has immutable owner!");
    console.log("   We'll deploy with deployer as owner, then update exempt slots");
    console.log("   to include multi-sig address for control");
    
    const KCY1 = await ethers.getContractFactory("KCY1Token");
    const token = await KCY1.deploy();
    
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    
    console.log("\n✅ KCY1 Token deployed at:", tokenAddress);
    console.log("   Owner:", deployer.address);
    console.log("   Total Supply:", ethers.formatEther(await token.totalSupply()), "tokens");
    
    // ========================================================================
    // STEP 4: CONFIGURE TOKEN FOR MULTI-SIG CONTROL
    // ========================================================================
    
    console.log("\n" + "=".repeat(60));
    console.log("STEP 4: Configure Multi-Sig Control");
    console.log("=".repeat(60));
    
    // Option 1: Add multi-sig as exempt slot (gives it control via onlyOwner modifier)
    // Since onlyOwner checks: owner OR eAddr1-4
    console.log("\n📝 Adding multi-sig as exempt slot for control...");
    
    const tx1 = await token.updateExemptSlots([
        multiSigAddress,  // Multi-sig has control!
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress
    ]);
    await tx1.wait();
    
    console.log("✅ Multi-sig added as exempt slot");
    console.log("   Multi-sig can now control token via onlyOwner functions!");
    
    // ========================================================================
    // STEP 5: VERIFICATION INFO
    // ========================================================================
    
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    
    console.log("\n📋 Contract Addresses:");
    console.log("   Multi-Sig:", multiSigAddress);
    console.log("   KCY1 Token:", tokenAddress);
    
    console.log("\n🔐 Security Status:");
    console.log("   Token Owner:", await token.owner());
    console.log("   Multi-Sig Control:", "✅ Via exempt slot");
    
    const exemptData = await token.getExemptAddresses();
    console.log("\n🎯 Exempt Slots:");
    console.log("   eAddr1:", exemptData.slots[0], "(Multi-Sig)");
    console.log("   eAddr2:", exemptData.slots[1]);
    console.log("   eAddr3:", exemptData.slots[2]);
    console.log("   eAddr4:", exemptData.slots[3]);
    
    console.log("\n📝 Next Steps:");
    console.log("   1. Verify contracts on BSCScan");
    console.log("   2. Test multi-sig with pause()");
    console.log("   3. Lock slots/DEX/pairs when ready");
    console.log("   4. Use frontend to control token");
    
    console.log("\n🔗 Verify Commands:");
    console.log(`   npx hardhat verify --network ${network.name} ${multiSigAddress} "${owners.trezor1}" "${owners.trezor2}" "${owners.tangem1}" "${owners.tangem2}" "${owners.metamask}"`);
    console.log(`   npx hardhat verify --network ${network.name} ${tokenAddress}`);
    
    // Save deployment info
    const fs = require('fs');
    const deploymentInfo = {
        network: network.name,
        timestamp: new Date().toISOString(),
        contracts: {
            multiSig: multiSigAddress,
            token: tokenAddress
        },
        owners: owners,
        deployer: deployer.address
    };
    
    fs.writeFileSync(
        'deployment-info.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n💾 Deployment info saved to: deployment-info.json");
    console.log("\n" + "=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
