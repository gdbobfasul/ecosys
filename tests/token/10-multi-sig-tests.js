// Version: 1.0056
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("10. Multi-Sig Functionality Tests", function() {
    let token;
    let multiSig;
    let owner, admin1, admin2, admin3, admin4, admin5;
    let msig1, msig2, msig3, msig4, msig5;
    let normal1, normal2;
    
    const COOLDOWN_48H = 48 * 3600;
    
    before(async function() {
        [owner, admin1, admin2, admin3, admin4, admin5, msig1, msig2, msig3, msig4, msig5, normal1, normal2] = await ethers.getSigners();
        
        // Deploy Token
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
        
        // Deploy Multi-Sig (3-of-5)
        const MultiSig = await ethers.getContractFactory("SimpleMultiSig");
        multiSig = await MultiSig.deploy(
            msig1.address,
            msig2.address,
            msig3.address,
            msig4.address,
            msig5.address
        );
        await multiSig.waitForDeployment();
        
        // Set multi-sig address in token
        await token.setMultiSigAddress(await multiSig.getAddress());
        
        // Wait for initial admin cooldown
        await time.increase(COOLDOWN_48H + 1);
    });
    
    // Helper function to execute multi-sig transaction
    async function executeMultiSig(functionName, args) {
        const data = token.interface.encodeFunctionData(functionName, args);
        const tx = await multiSig.connect(msig1).submitTransaction(
            await token.getAddress(),
            data
        );
        await tx.wait();
        
        const txId = Number(await multiSig.transactionCount()) - 1;
        await multiSig.connect(msig2).confirmTransaction(txId);
        await multiSig.connect(msig3).confirmTransaction(txId);
        
        return txId;
    }
    
    describe("10.1 Multi-Sig Basic Setup", function() {
        it("Should have 5 owners", async function() {
            const owners = await multiSig.getOwners();
            expect(owners.length).to.equal(5);
            expect(owners[0]).to.equal(msig1.address);
            expect(owners[4]).to.equal(msig5.address);
        });
        
        it("Should require 3 confirmations", async function() {
            expect(await multiSig.REQUIRED()).to.equal(3);
        });
        
        it("Should check if address is owner", async function() {
            expect(await multiSig.isOwner(msig1.address)).to.equal(true);
            expect(await multiSig.isOwner(normal1.address)).to.equal(false);
        });
    });
    
    describe("10.2 Multi-Sig ONLY Functions", function() {
        describe("10.2.1 removeFromBlacklist() - Only Multi-Sig", function() {
            it("Should allow Multi-Sig to remove from blacklist", async function() {
                // First blacklist someone (owner can do this)
                await token.setBlacklist(normal1.address, true);
                expect(await token.isBlacklisted(normal1.address)).to.equal(true);
                
                // Now remove via Multi-Sig
                await executeMultiSig("removeFromBlacklist", [normal1.address]);
                expect(await token.isBlacklisted(normal1.address)).to.equal(false);
            });
            
            it("Should NOT allow Owner to remove from blacklist", async function() {
                await token.setBlacklist(normal2.address, true);
                
                await expect(
                    token.removeFromBlacklist(normal2.address)
                ).to.be.revertedWith("Only multi-sig");
            });
            
            it("Should NOT allow Admin to remove from blacklist", async function() {
                await token.setBlacklist(normal2.address, true);
                
                await expect(
                    token.connect(admin1).removeFromBlacklist(normal2.address)
                ).to.be.revertedWith("Only multi-sig");
            });
            
            it("Should NOT allow Normal user to remove from blacklist", async function() {
                await expect(
                    token.connect(normal1).removeFromBlacklist(normal2.address)
                ).to.be.revertedWith("Only multi-sig");
            });
        });
        
        describe("10.2.2 removeMULTIFromBlacklist() - Only Multi-Sig", function() {
            it("Should allow Multi-Sig to remove multiple from blacklist", async function() {
                await token.setBlacklist(normal1.address, true);
                await token.setBlacklist(normal2.address, true);
                
                await executeMultiSig("removeMULTIFromBlacklist", [[normal1.address, normal2.address]]);
                
                expect(await token.isBlacklisted(normal1.address)).to.equal(false);
                expect(await token.isBlacklisted(normal2.address)).to.equal(false);
            });
            
            it("Should NOT allow Owner to remove multiple", async function() {
                await expect(
                    token.removeMULTIFromBlacklist([normal1.address])
                ).to.be.revertedWith("Only multi-sig");
            });
            
            it("Should NOT allow Admin to remove multiple", async function() {
                await expect(
                    token.connect(admin1).removeMULTIFromBlacklist([normal1.address])
                ).to.be.revertedWith("Only multi-sig");
            });
        });
        
        describe("10.2.3 unlockExemptSlots() - Only Multi-Sig", function() {
            it("Should allow Multi-Sig to unlock exempt slots", async function() {
                // First lock them
                await token.lockExemptSlotsForever();
                expect(await token.exemptSlotsLocked()).to.equal(true);
                
                // Unlock via Multi-Sig
                await executeMultiSig("unlockExemptSlots", []);
                expect(await token.exemptSlotsLocked()).to.equal(false);
            });
            
            it("Should NOT allow Owner to unlock exempt slots", async function() {
                await token.lockExemptSlotsForever();
                
                await expect(
                    token.unlockExemptSlots()
                ).to.be.revertedWith("Only multi-sig");
            });
            
            it("Should NOT allow Admin to unlock exempt slots", async function() {
                await expect(
                    token.connect(admin1).unlockExemptSlots()
                ).to.be.revertedWith("Only multi-sig");
            });
        });
        
        describe("10.2.4 unlockDEXAddresses() - Only Multi-Sig", function() {
            it("Should allow Multi-Sig to unlock DEX addresses", async function() {
                await token.lockDEXAddresses();
                expect(await token.dexAddressesLocked()).to.equal(true);
                
                await executeMultiSig("unlockDEXAddresses", []);
                expect(await token.dexAddressesLocked()).to.equal(false);
            });
            
            it("Should NOT allow Owner to unlock DEX", async function() {
                await token.lockDEXAddresses();
                
                await expect(
                    token.unlockDEXAddresses()
                ).to.be.revertedWith("Only multi-sig");
            });
            
            it("Should NOT allow Admin to unlock DEX", async function() {
                await expect(
                    token.connect(admin1).unlockDEXAddresses()
                ).to.be.revertedWith("Only multi-sig");
            });
        });
        
        describe("10.2.5 unlockLiquidityPairs() - Only Multi-Sig", function() {
            it("Should allow Multi-Sig to unlock liquidity pairs", async function() {
                await token.lockLiquidityPairsForever();
                expect(await token.liquidityPairsLocked()).to.equal(true);
                
                await executeMultiSig("unlockLiquidityPairs", []);
                expect(await token.liquidityPairsLocked()).to.equal(false);
            });
            
            it("Should NOT allow Owner to unlock pairs", async function() {
                await token.lockLiquidityPairsForever();
                
                await expect(
                    token.unlockLiquidityPairs()
                ).to.be.revertedWith("Only multi-sig");
            });
            
            it("Should NOT allow Admin to unlock pairs", async function() {
                await expect(
                    token.connect(admin1).unlockLiquidityPairs()
                ).to.be.revertedWith("Only multi-sig");
            });
        });
    });
    
    describe("10.3 Multi-Sig Bypass Tests", function() {
        describe("10.3.1 Multi-Sig Bypass: Exempt Slots Lock", function() {
            it("Should allow Multi-Sig to update slots even when locked", async function() {
                // Check if already locked from previous test
                const alreadyLocked = await token.exemptSlotsLocked();
                
                // Lock slots only if not already locked
                if (!alreadyLocked) {
                    await token.lockExemptSlotsForever();
                }
                expect(await token.exemptSlotsLocked()).to.equal(true);
                
                // Multi-Sig can still update (bypasses lock)
                await executeMultiSig("updateExemptSlot", [2, admin2.address]);
                
                // Verify update worked by checking the address directly
                expect(await token.eAddr2()).to.equal(admin2.address);
                
                // Unlock for cleanup
                await executeMultiSig("unlockExemptSlots", []);
            });
            
            it("Should NOT allow Owner to update when locked", async function() {
                // Check if already locked
                const alreadyLocked = await token.exemptSlotsLocked();
                
                // Lock only if not locked
                if (!alreadyLocked) {
                    await token.lockExemptSlotsForever();
                }
                
                await time.increase(COOLDOWN_48H + 1);
                
                await expect(
                    token.updateExemptSlot(6, admin3.address)
                ).to.be.revertedWith("Slots locked");
                
                // Cleanup
                await executeMultiSig("unlockExemptSlots", []);
            });
        });
        
        describe("10.3.2 Multi-Sig Bypass: Admin Cooldown", function() {
            it("Should allow Multi-Sig to call admin functions during cooldown", async function() {
                // First unlock pairs if locked
                const pairsLocked = await token.liquidityPairsLocked();
                if (pairsLocked) {
                    await executeMultiSig("unlockLiquidityPairs", []);
                }
                
                // Wait for any previous cooldowns
                await time.increase(COOLDOWN_48H + 1);
                
                const testPair1 = ethers.Wallet.createRandom().address;
                const testPair2 = ethers.Wallet.createRandom().address;
                
                // Trigger cooldown by setting liquidity pair (this HAS cooldown check!)
                await token.setLiquidityPair(testPair1, true);
                
                // Owner is now in cooldown (cannot call admin functions with cooldown)
                await expect(
                    token.setLiquidityPair(testPair2, true)
                ).to.be.revertedWith("Address changers cooldown");
                
                // But Multi-Sig CAN (bypasses cooldown)
                await executeMultiSig("setLiquidityPair", [testPair2, true]);
                
                // Verify it worked
                expect(await token.isLiquidityPair(testPair2)).to.equal(true);
                
                // Wait for cooldown to end
                await time.increase(COOLDOWN_48H + 1);
            });
        });
        
        describe("10.3.3 Multi-Sig Bypass: DEX Lock", function() {
            it("Should allow Multi-Sig to update DEX when locked", async function() {
                const newRouter = ethers.Wallet.createRandom().address;
                const newFactory = ethers.Wallet.createRandom().address;
                
                // Lock DEX
                await token.lockDEXAddresses();
                expect(await token.dexAddressesLocked()).to.equal(true);
                
                // Multi-Sig can still update
                await executeMultiSig("updateDEXAddresses", [newRouter, newFactory]);
                
                expect(await token.pncswpRouter()).to.equal(newRouter);
                expect(await token.pncswpFactory()).to.equal(newFactory);
                
                // Unlock for cleanup
                await executeMultiSig("unlockDEXAddresses", []);
            });
        });
        
        describe("10.3.4 Multi-Sig Bypass: Liquidity Pairs Lock", function() {
            it("Should allow Multi-Sig to set pairs when locked", async function() {
                const testPair = ethers.Wallet.createRandom().address;
                
                // Check if already locked
                const alreadyLocked = await token.liquidityPairsLocked();
                
                // Lock pairs only if not locked
                if (!alreadyLocked) {
                    await token.lockLiquidityPairsForever();
                }
                expect(await token.liquidityPairsLocked()).to.equal(true);
                
                // Multi-Sig can still set pairs
                await executeMultiSig("setLiquidityPair", [testPair, true]);
                
                expect(await token.isLiquidityPair(testPair)).to.equal(true);
                
                // Cleanup
                await executeMultiSig("unlockLiquidityPairs", []);
            });
        });
    });
    
    describe("10.4 Multi-Sig Can Control Admin Functions", function() {
        beforeEach(async function() {
            // Wait for any previous cooldowns
            await time.increase(COOLDOWN_48H + 1);
        });
        
        it("Should allow Multi-Sig to pause", async function() {
            await executeMultiSig("pause", []);
            expect(await token.isPaused()).to.equal(true);
            
            // Wait for pause to expire
            await time.increase(COOLDOWN_48H + 1);
        });
        
        it("Should allow Multi-Sig to set blacklist", async function() {
            await executeMultiSig("setBlacklist", [normal1.address, true]);
            expect(await token.isBlacklisted(normal1.address)).to.equal(true);
            
            // Cleanup
            await executeMultiSig("removeFromBlacklist", [normal1.address]);
        });
        
        it("Should allow Multi-Sig to update exempt slots (slots 2-5)", async function() {
            // Multi-Sig can update slots 2-5 (their controlled slots)
            await executeMultiSig("updateExemptSlot", [2, admin1.address]);
            
            // Verify by reading eAddr2 directly
            expect(await token.eAddr2()).to.equal(admin1.address);
            
            await time.increase(COOLDOWN_48H + 1);
        });
        
        it("Should allow Multi-Sig to lock/unlock slots", async function() {
            await executeMultiSig("lockExemptSlotsForever", []);
            expect(await token.exemptSlotsLocked()).to.equal(true);
            
            await executeMultiSig("unlockExemptSlots", []);
            expect(await token.exemptSlotsLocked()).to.equal(false);
        });
    });
    
    describe("10.5 Multi-Sig Security Tests", function() {
        it("Should require 3 confirmations to execute", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            const tx = await multiSig.connect(msig1).submitTransaction(
                await token.getAddress(),
                data
            );
            await tx.wait();
            
            const txId = Number(await multiSig.transactionCount()) - 1;
            
            // Only 1 confirmation (submitter auto-confirms)
            let txData = await multiSig.transactions(txId);
            expect(txData.confirmations).to.equal(1);
            expect(txData.executed).to.equal(false);
            
            // Add 2nd confirmation
            await multiSig.connect(msig2).confirmTransaction(txId);
            txData = await multiSig.transactions(txId);
            expect(txData.confirmations).to.equal(2);
            expect(txData.executed).to.equal(false);
            
            // Add 3rd confirmation - should auto-execute
            await multiSig.connect(msig3).confirmTransaction(txId);
            txData = await multiSig.transactions(txId);
            expect(txData.confirmations).to.equal(3);
            expect(txData.executed).to.equal(true);
            
            // Wait for pause to expire
            await time.increase(COOLDOWN_48H + 1);
        });
        
        it("Should NOT allow same owner to confirm twice", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            const tx = await multiSig.connect(msig1).submitTransaction(
                await token.getAddress(),
                data
            );
            await tx.wait();
            
            const txId = Number(await multiSig.transactionCount()) - 1;
            
            // Try to confirm again with same owner
            await expect(
                multiSig.connect(msig1).confirmTransaction(txId)
            ).to.be.revertedWith("Already confirmed");
        });
        
        it("Should NOT allow non-owner to submit transaction", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            
            await expect(
                multiSig.connect(normal1).submitTransaction(
                    await token.getAddress(),
                    data
                )
            ).to.be.revertedWith("Not owner");
        });
        
        it("Should NOT allow non-owner to confirm transaction", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            const tx = await multiSig.connect(msig1).submitTransaction(
                await token.getAddress(),
                data
            );
            await tx.wait();
            
            const txId = Number(await multiSig.transactionCount()) - 1;
            
            await expect(
                multiSig.connect(normal1).confirmTransaction(txId)
            ).to.be.revertedWith("Not owner");
        });
        
        it("Should NOT allow executing same transaction twice", async function() {
            const data = token.interface.encodeFunctionData("pause", []);
            const tx = await multiSig.connect(msig1).submitTransaction(
                await token.getAddress(),
                data
            );
            await tx.wait();
            
            const txId = Number(await multiSig.transactionCount()) - 1;
            
            // Get to 3 confirmations
            await multiSig.connect(msig2).confirmTransaction(txId);
            await multiSig.connect(msig3).confirmTransaction(txId);
            
            // Transaction is now executed
            const txData = await multiSig.transactions(txId);
            expect(txData.executed).to.equal(true);
            
            // Try to execute again
            await expect(
                multiSig.executeTransaction(txId)
            ).to.be.revertedWith("Already executed");
            
            // Wait for pause to expire
            await time.increase(COOLDOWN_48H + 1);
        });
    });
    
    describe("10.6 Multi-Sig Integration Tests", function() {
        it("Should work: Lock → Multi-Sig Unlock → Owner can update", async function() {
            // Check if already locked
            const alreadyLocked = await token.exemptSlotsLocked();
            
            // Owner locks slots only if not locked
            if (!alreadyLocked) {
                await token.lockExemptSlotsForever();
            }
            expect(await token.exemptSlotsLocked()).to.equal(true);
            
            // Owner cannot update (locked)
            await time.increase(COOLDOWN_48H + 1);
            await expect(
                token.updateExemptSlot(6, admin1.address)
            ).to.be.revertedWith("Slots locked");
            
            // Multi-Sig unlocks
            await executeMultiSig("unlockExemptSlots", []);
            expect(await token.exemptSlotsLocked()).to.equal(false);
            
            // Now owner CAN update
            await token.updateExemptSlot(6, admin1.address);
            expect(await token.eAddr6()).to.equal(admin1.address);
            
            await time.increase(COOLDOWN_48H + 1);
        });
        
        it("Should work: Multi-Sig can remove from blacklist that Owner added", async function() {
            // Owner adds to blacklist
            await token.setBlacklist(normal1.address, true);
            expect(await token.isBlacklisted(normal1.address)).to.equal(true);
            
            // Multi-Sig removes
            await executeMultiSig("removeFromBlacklist", [normal1.address]);
            expect(await token.isBlacklisted(normal1.address)).to.equal(false);
        });
    });
});
