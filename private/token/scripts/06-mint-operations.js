// Version: 1.0056
/**
 * СКРИПТ 6: Mint операции
 * Цел: Предлагане и изпълнение на mint (създаване на нови токени)
 * Изпълнява се от: 0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9
 */

const { ethers } = require("hardhat");
const config = require("./admin-config");

async function main() {
    console.log("========================================");
    console.log("🌱 MINT ОПЕРАЦИИ");
    console.log("========================================\n");
    
    const token = await ethers.getContractAt("KCY1Token", config.TOKEN_ADDRESS);
    const [signer] = await ethers.getSigners();
    
    console.log("🔗 Използван адрес:", signer.address);
    console.log("🪙 Token адрес:", config.TOKEN_ADDRESS);
    console.log("\n");
    
    // ========================================
    // ТЕКУЩ СТАТУС НА MINT СИСТЕМА
    // ========================================
    console.log("📊 MINT СИСТЕМА СТАТУС:");
    console.log("─────────────────────────────────────");
    
    const totalSupply = await token.totalSupply();
    const proposalCount = await token.proposalCount();
    const lastMintTime = await token.lastMintTime();
    const now = Math.floor(Date.now() / 1000);
    
    console.log(`📈 Total Supply: ${ethers.formatEther(totalSupply)} токена`);
    console.log(`📋 Общо proposals: ${proposalCount}`);
    
    if (lastMintTime > 0) {
        const lastMint = new Date(Number(lastMintTime) * 1000);
        console.log(`⏰ Последен mint: ${lastMint.toLocaleString()}`);
        
        const MINT_COOLDOWN = 7 * 24 * 60 * 60; // 1 седмица
        const nextMintTime = Number(lastMintTime) + MINT_COOLDOWN;
        
        if (nextMintTime > now) {
            const timeLeft = nextMintTime - now;
            const daysLeft = Math.floor(timeLeft / 86400);
            const hoursLeft = Math.floor((timeLeft % 86400) / 3600);
            console.log(`⏳ Mint cooldown: ${daysLeft}д ${hoursLeft}ч`);
            console.log(`✅ Следващ mint след: ${new Date(nextMintTime * 1000).toLocaleString()}`);
        } else {
            console.log(`✅ Mint cooldown: Неактивен - можеш да mint-неш веднага!`);
        }
    } else {
        console.log(`⏰ Последен mint: Никога`);
        console.log(`✅ Можеш да направиш първи mint веднага!`);
    }
    console.log("\n");
    
    // ========================================
    // ПРОВЕРКА НА PROPOSALS
    // ========================================
    if (proposalCount > 0) {
        console.log("📋 СЪЩЕСТВУВАЩИ PROPOSALS:");
        console.log("─────────────────────────────────────");
        
        for (let i = 0; i < proposalCount; i++) {
            const proposal = await token.mintProposals(i);
            const amount = ethers.formatEther(proposal.amount);
            const proposedAt = new Date(Number(proposal.proposedAt) * 1000);
            const executeAfter = new Date(Number(proposal.executeAfter) * 1000);
            const executed = proposal.executed;
            const canExecute = Number(proposal.executeAfter) <= now && !executed;
            
            console.log(`\nProposal ${i}:`);
            console.log(`  Amount: ${amount} токена`);
            console.log(`  Proposed: ${proposedAt.toLocaleString()}`);
            console.log(`  Execute after: ${executeAfter.toLocaleString()}`);
            console.log(`  Status: ${executed ? "✅ Изпълнен" : canExecute ? "⏳ Готов за изпълнение!" : "⏰ Изчаква timelock"}`);
        }
        console.log("\n");
    }
    
    // ========================================
    // ИЗБОР НА СЦЕНАРИЙ
    // ========================================
    console.log("🎯 НАЛИЧНИ СЦЕНАРИИ:");
    console.log("─────────────────────────────────────");
    console.log("1. 🌱 Предлагане на НОВ mint (propose)");
    console.log("2. ✅ Изпълнение на съществуващ proposal");
    console.log("3. 🔍 Проверка на всички proposals");
    console.log("4. ℹ️  Само преглед");
    console.log("\n");
    
    // Променливи
    const SCENARIO = 1; // ПРОМЕНИ ТУК: 1-4
    
    // Mint настройки
    const MINT_AMOUNT = ethers.parseEther("1000000"); // 1M токени (ПРОМЕНИ ТУК)
    const PROPOSAL_ID = 0; // За изпълнение (ПРОМЕНИ ТУК)
    
    if (SCENARIO === 1) {
        // ========================================
        // СЦЕНАРИЙ 1: ПРЕДЛАГАНЕ НА MINT
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🌱 СЦЕНАРИЙ 1: ПРЕДЛАГАНЕ НА MINT");
        console.log("═══════════════════════════════════════\n");
        
        try {
            // Провери cooldown
            const cooldown = await token.mainAddressChangersCooldown();
            if (cooldown > now) {
                const timeLeft = cooldown - now;
                const hoursLeft = Math.floor(timeLeft / 3600);
                throw new Error(`Admin cooldown е активен! Чакай още ${hoursLeft} часа.`);
            }
            
            // Провери mint cooldown
            if (lastMintTime > 0) {
                const MINT_COOLDOWN = 7 * 24 * 60 * 60;
                const nextMintTime = Number(lastMintTime) + MINT_COOLDOWN;
                if (nextMintTime > now) {
                    const timeLeft = nextMintTime - now;
                    const daysLeft = Math.floor(timeLeft / 86400);
                    throw new Error(`Mint cooldown е активен! Чакай още ${daysLeft} дни.`);
                }
            }
            
            const amountFormatted = ethers.formatEther(MINT_AMOUNT);
            console.log(`📋 Amount за mint: ${amountFormatted} токена`);
            console.log("\n");
            
            // Провери max mint amount
            const MAX_MINT = ethers.parseEther("5000000"); // 5M
            if (MINT_AMOUNT > MAX_MINT) {
                throw new Error(`Amount е прекалено голям! Max: 5,000,000 токена`);
            }
            
            console.log("📋 ИНФОРМАЦИЯ:");
            console.log("─────────────────────────────────────");
            console.log(`  • Amount: ${amountFormatted} токена`);
            console.log(`  • Max amount: 5,000,000 токена`);
            console.log(`  • Timelock: 1 ден (24 часа)`);
            console.log(`  • Mint cooldown: 1 седмица след изпълнение`);
            console.log("\n");
            
            console.log("📋 Какво ще се случи:");
            console.log("  1. Proposal ще се създаде");
            console.log("  2. Timelock от 1 ден ще започне");
            console.log("  3. След 1 ден можеш да изпълниш mint");
            console.log("  4. Токените отиват на deployer адрес");
            console.log("  5. Total supply се увеличава");
            console.log("\n");
            
            console.log("🚀 Предлагане на mint...");
            const tx = await token.proposeMint(MINT_AMOUNT);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Вземи новото proposal
            const newProposalCount = await token.proposalCount();
            const newProposal = await token.mintProposals(newProposalCount - 1n);
            const executeAfter = new Date(Number(newProposal.executeAfter) * 1000);
            
            console.log("═══════════════════════════════════════");
            console.log("✅ PROPOSAL СЪЗДАДЕН!");
            console.log("═══════════════════════════════════════");
            console.log(`📋 Proposal ID: ${newProposalCount - 1n}`);
            console.log(`🌱 Amount: ${amountFormatted} токена`);
            console.log(`⏰ Execute after: ${executeAfter.toLocaleString()}`);
            console.log("\n");
            
            console.log("📌 СЛЕДВАЩИ СТЪПКИ:");
            console.log(`  1. ⏰ Изчакай 1 ден (до ${executeAfter.toLocaleString()})`);
            console.log(`  2. 🚀 Изпълни proposal с SCENARIO = 2, PROPOSAL_ID = ${newProposalCount - 1n}`);
            console.log("  3. 🔍 Провери с: npx hardhat run scripts/06-mint-operations.js");
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ PROPOSE:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 2) {
        // ========================================
        // СЦЕНАРИЙ 2: ИЗПЪЛНЕНИЕ НА PROPOSAL
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("✅ СЦЕНАРИЙ 2: ИЗПЪЛНЕНИЕ НА MINT");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log(`📋 Proposal ID: ${PROPOSAL_ID}`);
            console.log("\n");
            
            // Провери cooldown
            const cooldown = await token.mainAddressChangersCooldown();
            if (cooldown > now) {
                const timeLeft = cooldown - now;
                const hoursLeft = Math.floor(timeLeft / 3600);
                throw new Error(`Admin cooldown е активен! Чакай още ${hoursLeft} часа.`);
            }
            
            // Вземи proposal
            if (PROPOSAL_ID >= proposalCount) {
                throw new Error(`Proposal ${PROPOSAL_ID} не съществува!`);
            }
            
            const proposal = await token.mintProposals(PROPOSAL_ID);
            
            if (proposal.executed) {
                throw new Error(`Proposal ${PROPOSAL_ID} вече е изпълнен!`);
            }
            
            const canExecute = Number(proposal.executeAfter) <= now;
            if (!canExecute) {
                const timeLeft = Number(proposal.executeAfter) - now;
                const hoursLeft = Math.floor(timeLeft / 3600);
                throw new Error(`Timelock още не е изтекъл! Чакай още ${hoursLeft} часа.`);
            }
            
            const amountFormatted = ethers.formatEther(proposal.amount);
            const oldTotalSupply = await token.totalSupply();
            const deployer = signer.address;
            
            console.log("📋 PROPOSAL ИНФОРМАЦИЯ:");
            console.log("─────────────────────────────────────");
            console.log(`  • Amount: ${amountFormatted} токена`);
            console.log(`  • Proposed: ${new Date(Number(proposal.proposedAt) * 1000).toLocaleString()}`);
            console.log(`  • Execute after: ${new Date(Number(proposal.executeAfter) * 1000).toLocaleString()}`);
            console.log(`  • Recipient: ${deployer}`);
            console.log("\n");
            
            console.log("📊 ПРЕДИ MINT:");
            console.log(`  • Total Supply: ${ethers.formatEther(oldTotalSupply)} токена`);
            console.log("\n");
            
            console.log("🚀 Изпълнение на mint...");
            const tx = await token.executeMint(PROPOSAL_ID);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери нов статус
            const newTotalSupply = await token.totalSupply();
            const newBalance = await token.balanceOf(deployer);
            const updatedProposal = await token.mintProposals(PROPOSAL_ID);
            
            console.log("═══════════════════════════════════════");
            console.log("✅ MINT ИЗПЪЛНЕН!");
            console.log("═══════════════════════════════════════");
            console.log(`🌱 Mint-нати: ${amountFormatted} токена`);
            console.log(`📈 Стар Total Supply: ${ethers.formatEther(oldTotalSupply)}`);
            console.log(`📈 Нов Total Supply: ${ethers.formatEther(newTotalSupply)}`);
            console.log(`💰 Твой баланс: ${ethers.formatEther(newBalance)} токена`);
            console.log(`✅ Proposal ${PROPOSAL_ID}: ${updatedProposal.executed ? "ИЗПЪЛНЕН" : "ГРЕШКА"}`);
            console.log("\n");
            
            console.log("📌 ВАЖНО:");
            console.log("  • Mint cooldown от 1 седмица започна!");
            console.log("  • Следващ mint възможен след 7 дни");
            console.log("  • Total supply се увеличи с mint amount");
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ EXECUTE:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 3) {
        // ========================================
        // СЦЕНАРИЙ 3: ПРОВЕРКА НА PROPOSALS
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🔍 СЦЕНАРИЙ 3: ПРОВЕРКА НА PROPOSALS");
        console.log("═══════════════════════════════════════\n");
        
        if (proposalCount === 0) {
            console.log("❌ Няма proposals!");
            console.log("\n💡 Създай proposal с SCENARIO = 1");
            return;
        }
        
        console.log(`📊 Общо proposals: ${proposalCount}\n`);
        
        for (let i = 0; i < proposalCount; i++) {
            const proposal = await token.mintProposals(i);
            const amount = ethers.formatEther(proposal.amount);
            const proposedAt = new Date(Number(proposal.proposedAt) * 1000);
            const executeAfter = new Date(Number(proposal.executeAfter) * 1000);
            const executed = proposal.executed;
            const canExecute = Number(proposal.executeAfter) <= now && !executed;
            
            console.log("═══════════════════════════════════════");
            console.log(`📋 PROPOSAL ${i}`);
            console.log("═══════════════════════════════════════");
            console.log(`🌱 Amount: ${amount} токена`);
            console.log(`📅 Proposed: ${proposedAt.toLocaleString()}`);
            console.log(`⏰ Execute after: ${executeAfter.toLocaleString()}`);
            
            if (executed) {
                console.log(`✅ Status: ИЗПЪЛНЕН`);
            } else if (canExecute) {
                console.log(`⏳ Status: ГОТОВ ЗА ИЗПЪЛНЕНИЕ!`);
                console.log(`💡 Изпълни с: SCENARIO = 2, PROPOSAL_ID = ${i}`);
            } else {
                const timeLeft = Number(proposal.executeAfter) - now;
                const hoursLeft = Math.floor(timeLeft / 3600);
                console.log(`⏰ Status: Timelock ${hoursLeft}h`);
            }
            console.log("\n");
        }
        
    } else if (SCENARIO === 4) {
        // ========================================
        // СЦЕНАРИЙ 4: САМО ПРЕГЛЕД
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("ℹ️  РЕЖИМ: САМО ПРЕГЛЕД");
        console.log("═══════════════════════════════════════\n");
        
        console.log("📚 MINT СИСТЕМА:");
        console.log("─────────────────────────────────────");
        console.log("\n1. proposeMint(uint256 amount)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Предлага mint на amount токени");
        console.log("   • Timelock: 1 ден (24 часа)");
        console.log("   • Max amount: 5,000,000 токена");
        console.log("\n");
        
        console.log("2. executeMint(uint256 proposalId)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Изпълнява одобрен proposal");
        console.log("   • След 1 ден от propose");
        console.log("   • Cooldown: 1 седмица между mints");
        console.log("\n");
        
        console.log("📋 ПРАВИЛА:");
        console.log("  • Max mint: 5M токени на proposal");
        console.log("  • Timelock: 1 ден преди execute");
        console.log("  • Cooldown: 1 седмица между mints");
        console.log("  • Токените отиват на deployer");
        console.log("\n");
        
        console.log("💡 ЗА ИЗПЪЛНЕНИЕ:");
        console.log("  Промени SCENARIO = 1, 2 или 3 и пусни отново");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
