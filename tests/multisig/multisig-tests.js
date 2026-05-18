// Version: 1.0056
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleMultiSig - 3-of-5 Control Tests", function() {
    let multiSig;
    let token;
    let owner1, owner2, owner3, owner4, owner5;
    let nonOwner;
    
    beforeEach(async function() {
        [owner1, owner2, owner3, owner4, owner5, nonOwner] = await ethers.getSigners();
        
        // Deploy Multi-Sig
        const MultiSig = await ethers.getContractFactory("SimpleMultiSig");
        multiSig = await MultiSig.deploy(
            owner1.address,
            owner2.address,
            owner3.address,
            owner4.address,
            owner5.address
        );
        await multiSig.waitForDeployment();
        
        // Deploy KCY1 Token
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
        
        // Set multi-sig as the multi-sig address in token
        await token.setMultiSigAddress(await multiSig.getAddress());
        
        // Wait 48h for admin cooldown from setMultiSigAddress
        await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
        await ethers.provider.send("evm_mine");
    });
    
    describe("1. Multi-Sig Setup", function() {
        it("Should have correct owners", async function() {
            expect(await multiSig.owners(0)).to.equal(owner1.address);
            expect(await multiSig.owners(1)).to.equal(owner2.address);
            expect(await multiSig.owners(2)).to.equal(owner3.address);
            expect(await multiSig.owners(3)).to.equal(owner4.address);
            expect(await multiSig.owners(4)).to.equal(owner5.address);
        });
        
        it("Should require 3 confirmations", async function() {
            expect(await multiSig.REQUIRED()).to.equal(3);
        });
        
        it("Should start with 0 transactions", async function() {
            expect(await multiSig.transactionCount()).to.equal(0);
        });
    });
    
    describe("2. Transaction Submission", function() {
        it("Should allow owner to submit transaction", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            
            await expect(
                multiSig.connect(owner1).submitTransaction(
                    await token.getAddress(),
                    data
                )
            ).to.emit(multiSig, "TransactionSubmitted");
            
            expect(await multiSig.transactionCount()).to.equal(1);
        });
        
        it("Should NOT allow non-owner to submit", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            
            await expect(
                multiSig.connect(nonOwner).submitTransaction(
                    await token.getAddress(),
                    data
                )
            ).to.be.revertedWith("Not owner");
        });
    });
    
    describe("3. Transaction Confirmation", function() {
        let txId;
        
        beforeEach(async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            await multiSig.connect(owner1).submitTransaction(
                await token.getAddress(),
                data
            );
            txId = 0;
        });
        
        it("Should allow owners to confirm", async function() {
            await expect(
                multiSig.connect(owner2).confirmTransaction(txId)
            ).to.emit(multiSig, "TransactionConfirmed");
            
            const tx = await multiSig.transactions(txId);
            expect(tx.confirmations).to.equal(2);
        });
        
        it("Should NOT allow double confirmation", async function() {
            await multiSig.connect(owner2).confirmTransaction(txId);
            
            await expect(
                multiSig.connect(owner2).confirmTransaction(txId)
            ).to.be.revertedWith("Already confirmed");
        });
        
        it("Should NOT allow non-owner to confirm", async function() {
            await expect(
                multiSig.connect(nonOwner).confirmTransaction(txId)
            ).to.be.revertedWith("Not owner");
        });
    });
    
    describe("4. Transaction Execution", function() {
        it("Should execute after 3 confirmations", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            await multiSig.connect(owner1).submitTransaction(
                await token.getAddress(),
                data
            );
            const txId = 0;
            
            await multiSig.connect(owner2).confirmTransaction(txId);
            await multiSig.connect(owner3).confirmTransaction(txId);
            
            expect(await token.isPaused()).to.equal(true);
            
            const tx = await multiSig.transactions(txId);
            expect(tx.executed).to.equal(true);
        });
        
        it("Should NOT execute with only 2 confirmations", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            await multiSig.connect(owner1).submitTransaction(
                await token.getAddress(),
                data
            );
            const txId = 0;
            
            await multiSig.connect(owner2).confirmTransaction(txId);
            
            const tx = await multiSig.transactions(txId);
            expect(tx.executed).to.equal(false);
            expect(await token.isPaused()).to.equal(false);
        });
    });
    
    describe("5. Multi-Sig Controls KCY1 Functions", function() {
        
        // Wait 48h before EACH test (admin functions trigger cooldown)
        beforeEach(async function() {
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
        });
        
        async function executeMultiSigCall(functionName, args) {
            const data = token.interface.encodeFunctionData(functionName, args);
            await multiSig.connect(owner1).submitTransaction(
                await token.getAddress(),
                data
            );
            const txId = Number(await multiSig.transactionCount()) - 1;
            await multiSig.connect(owner2).confirmTransaction(txId);
            await multiSig.connect(owner3).confirmTransaction(txId);
        }
        
        it("Should pause token via multi-sig", async function() {
            await executeMultiSigCall("pause", []);
            // Check immediately - before time passes
            expect(await token.isPaused()).to.equal(true);
            // Wait 48h after pause for next admin function
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
        });
        
        it("Should update exempt slot via multi-sig", async function() {
            await executeMultiSigCall("updateExemptSlot", [2, owner2.address]);
            // Wait 48h after this admin action
            await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
            await ethers.provider.send("evm_mine");
        });
        
        it("Should set blacklist via multi-sig", async function() {
            await executeMultiSigCall("setBlacklist", [nonOwner.address, true]);
            expect(await token.isBlacklisted(nonOwner.address)).to.equal(true);
        });
        
        it("Should remove from blacklist via multi-sig", async function() {
            await token.setBlacklist(nonOwner.address, true);
            
            await executeMultiSigCall("removeFromBlacklist", [nonOwner.address]);
            expect(await token.isBlacklisted(nonOwner.address)).to.equal(false);
        });
        
        it("Should remove MULTI from blacklist via multi-sig", async function() {
            await token.setBlacklist(owner4.address, true);
            await token.setBlacklist(owner5.address, true);
            
            await executeMultiSigCall("removeMULTIFromBlacklist", [[owner4.address, owner5.address]]);
            
            expect(await token.isBlacklisted(owner4.address)).to.equal(false);
            expect(await token.isBlacklisted(owner5.address)).to.equal(false);
        });
        
        it("Should unlock exempt slots via multi-sig", async function() {
            await token.lockExemptSlotsForever();
            expect(await token.exemptSlotsLocked()).to.equal(true);
            
            await executeMultiSigCall("unlockExemptSlots", []);
            expect(await token.exemptSlotsLocked()).to.equal(false);
        });
        
        it("Should unlock DEX addresses via multi-sig", async function() {
            await token.lockDEXAddresses();
            expect(await token.dexAddressesLocked()).to.equal(true);
            
            await executeMultiSigCall("unlockDEXAddresses", []);
            expect(await token.dexAddressesLocked()).to.equal(false);
        });
        
        it("Should unlock liquidity pairs via multi-sig", async function() {
            await token.lockLiquidityPairsForever();
            expect(await token.liquidityPairsLocked()).to.equal(true);
            
            await executeMultiSigCall("unlockLiquidityPairs", []);
            expect(await token.liquidityPairsLocked()).to.equal(false);
        });
    });
    
    describe("6. Security Tests", function() {
        it("Should NOT allow executing same transaction twice", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            await multiSig.connect(owner1).submitTransaction(
                await token.getAddress(),
                data
            );
            const txId = 0;
            
            await multiSig.connect(owner2).confirmTransaction(txId);
            await multiSig.connect(owner3).confirmTransaction(txId);
            
            const tx = await multiSig.transactions(txId);
            expect(tx.executed).to.equal(true);
            
            await expect(
                multiSig.connect(owner4).confirmTransaction(txId)
            ).to.be.revertedWith("Already executed");
        });
    });
});
