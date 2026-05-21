// Version: 1.0093
const { ethers } = require("hardhat");
const ADDR = require("../../shared/js/addresses");

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
    
    // Owners loaded from shared/js/addresses.js (план addresses1.txt)
    // 1 Trezor + 1 Tangem + 3 Ledger, 3-of-5
    const owners = {
        owner1_trezor:  ADDR.MULTISIG_OWNERS.OWNER_1_TREZOR,   // Trezor bnbvis
        owner2_tangem:  ADDR.MULTISIG_OWNERS.OWNER_2_TANGEM,   // Tangem BnB
        owner3_ledger1: ADDR.MULTISIG_OWNERS.OWNER_3_LEDGER1,  // Ledger bnb1
        owner4_ledger2: ADDR.MULTISIG_OWNERS.OWNER_4_LEDGER2,  // Ledger bnb2
        owner5_ledger3: ADDR.MULTISIG_OWNERS.OWNER_5_LEDGER3   // Ledger bnb3
    };

    // For hardhat/localhost, use deployer address for all (testing only!)
    if (network.name === "hardhat" || network.name === "localhost") {
        console.log("\n⚠️  LOCAL MODE - Using deployer for all owners");
        owners.owner1_trezor  = deployer.address;
        owners.owner2_tangem  = deployer.address;
        owners.owner3_ledger1 = deployer.address;
        owners.owner4_ledger2 = deployer.address;
        owners.owner5_ledger3 = deployer.address;
    }

    console.log("\nOwners (3-of-5 required):");
    console.log("  1. Trezor:  ", owners.owner1_trezor);
    console.log("  2. Tangem:  ", owners.owner2_tangem);
    console.log("  3. Ledger 1:", owners.owner3_ledger1);
    console.log("  4. Ledger 2:", owners.owner4_ledger2);
    console.log("  5. Ledger 3:", owners.owner5_ledger3);
    
    // ========================================================================
    // STEP 2: DEPLOY MULTI-SIG
    // ========================================================================
    
    console.log("\n" + "=".repeat(60));
    console.log("STEP 2: Deploy Multi-Sig Contract");
    console.log("=".repeat(60));
    
    const MultiSig = await ethers.getContractFactory("SimpleMultiSig");
    const multiSig = await MultiSig.deploy(
        owners.owner1_trezor,
        owners.owner2_tangem,
        owners.owner3_ledger1,
        owners.owner4_ledger2,
        owners.owner5_ledger3
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
    console.log(`   npx hardhat verify --network ${network.name} ${multiSigAddress} "${owners.owner1_trezor}" "${owners.owner2_tangem}" "${owners.owner3_ledger1}" "${owners.owner4_ledger2}" "${owners.owner5_ledger3}"`);
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
