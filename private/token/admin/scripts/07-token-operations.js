// Version: 1.0056
/**
 * СКРИПТ 7: Token операции
 * Цел: Burn, withdraw и emergency операции
 * Изпълнява се от: 0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9
 */

const { ethers } = require("hardhat");
const config = require("./admin-config");

async function main() {
    console.log("========================================");
    console.log("🔥 TOKEN ОПЕРАЦИИ");
    console.log("========================================\n");
    
    const token = await ethers.getContractAt("KCY1Token", config.TOKEN_ADDRESS);
    const [signer] = await ethers.getSigners();
    
    console.log("🔗 Използван адрес:", signer.address);
    console.log("🪙 Token адрес:", config.TOKEN_ADDRESS);
    console.log("\n");
    
    // ========================================
    // ТЕКУЩ СТАТУС
    // ========================================
    console.log("📊 ТЕКУЩ СТАТУС:");
    console.log("─────────────────────────────────────");
    
    const totalSupply = await token.totalSupply();
    const yourBalance = await token.balanceOf(config.ADMIN_ADDRESS);
    const contractBalance = await token.balanceOf(config.TOKEN_ADDRESS);
    const bnbBalance = await ethers.provider.getBalance(config.TOKEN_ADDRESS);
    
    console.log(`📈 Total Supply: ${ethers.formatEther(totalSupply)} токена`);
    console.log(`💰 Твой баланс: ${ethers.formatEther(yourBalance)} токена`);
    console.log(`📦 Contract баланс: ${ethers.formatEther(contractBalance)} токена`);
    console.log(`💎 Contract BNB: ${ethers.formatEther(bnbBalance)} BNB`);
    console.log("\n");
    
    // ========================================
    // ИЗБОР НА СЦЕНАРИЙ
    // ========================================
    console.log("🎯 НАЛИЧНИ СЦЕНАРИИ:");
    console.log("─────────────────────────────────────");
    console.log("1. 🔥 Burn токени (от твоя баланс)");
    console.log("2. 📤 Withdraw токени от контракта");
    console.log("3. 💎 Withdraw BNB от контракта");
    console.log("4. 🚨 Rescue объркани токени");
    console.log("5. ℹ️  Само преглед");
    console.log("\n");
    
    // Променливи
    const SCENARIO = 1; // ПРОМЕНИ ТУК: 1-5
    
    // Настройки
    const BURN_AMOUNT = ethers.parseEther("100000"); // 100K (ПРОМЕНИ ТУК)
    const WITHDRAW_AMOUNT = ethers.parseEther("50000"); // 50K (ПРОМЕНИ ТУК)
    const RESCUE_TOKEN_ADDRESS = "0xAnotherTokenAddress00000000000000000000"; // (ПРОМЕНИ ТУК)
    const RESCUE_AMOUNT = ethers.parseEther("1000"); // (ПРОМЕНИ ТУК)
    
    if (SCENARIO === 1) {
        // ========================================
        // СЦЕНАРИЙ 1: BURN ТОКЕНИ
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🔥 СЦЕНАРИЙ 1: BURN ТОКЕНИ");
        console.log("═══════════════════════════════════════\n");
        
        try {
            const burnFormatted = ethers.formatEther(BURN_AMOUNT);
            console.log(`📋 Amount за burn: ${burnFormatted} токена`);
            console.log("\n");
            
            // Провери баланс
            if (yourBalance < BURN_AMOUNT) {
                throw new Error(`Нямаш достатъчно токени! Баланс: ${ethers.formatEther(yourBalance)}`);
            }
            
            const oldTotalSupply = await token.totalSupply();
            
            console.log("📊 ПРЕДИ BURN:");
            console.log("─────────────────────────────────────");
            console.log(`  • Твой баланс: ${ethers.formatEther(yourBalance)} токена`);
            console.log(`  • Total Supply: ${ethers.formatEther(oldTotalSupply)} токена`);
            console.log("\n");
            
            console.log("📋 Какво ще се случи:");
            console.log(`  • ${burnFormatted} токена ще се ИЗГОРЯТ`);
            console.log("  • Total Supply ще намалее");
            console.log("  • Токените са премахнати ЗАВИНАГИ");
            console.log("  • Не могат да се върнат!");
            console.log("\n");
            
            console.log("🚀 Изгаряне на токени...");
            const tx = await token.burn(BURN_AMOUNT);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери нов статус
            const newBalance = await token.balanceOf(config.ADMIN_ADDRESS);
            const newTotalSupply = await token.totalSupply();
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШНО ИЗГОРЕНИ!");
            console.log("═══════════════════════════════════════");
            console.log(`🔥 Изгорени: ${burnFormatted} токена`);
            console.log("\n");
            
            console.log("📊 СЛЕД BURN:");
            console.log("─────────────────────────────────────");
            console.log(`  • Твой баланс: ${ethers.formatEther(newBalance)} токена`);
            console.log(`  • Total Supply: ${ethers.formatEther(newTotalSupply)} токена`);
            console.log(`  • Намаление: ${ethers.formatEther(oldTotalSupply - newTotalSupply)} токена`);
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ BURN:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 2) {
        // ========================================
        // СЦЕНАРИЙ 2: WITHDRAW ТОКЕНИ ОТ CONTRACT
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("📤 СЦЕНАРИЙ 2: WITHDRAW ОТ КОНТРАКТА");
        console.log("═══════════════════════════════════════\n");
        
        try {
            const withdrawFormatted = ethers.formatEther(WITHDRAW_AMOUNT);
            console.log(`📋 Amount за withdraw: ${withdrawFormatted} токена`);
            console.log("\n");
            
            // Провери contract баланс
            if (contractBalance < WITHDRAW_AMOUNT) {
                throw new Error(`Контрактът няма достатъчно токени! Баланс: ${ethers.formatEther(contractBalance)}`);
            }
            
            const oldYourBalance = await token.balanceOf(config.ADMIN_ADDRESS);
            
            console.log("📊 ПРЕДИ WITHDRAW:");
            console.log("─────────────────────────────────────");
            console.log(`  • Contract баланс: ${ethers.formatEther(contractBalance)} токена`);
            console.log(`  • Твой баланс: ${ethers.formatEther(oldYourBalance)} токена`);
            console.log("\n");
            
            console.log("📋 Какво ще се случи:");
            console.log(`  • ${withdrawFormatted} токена ще се преместят`);
            console.log(`  • От: ${config.TOKEN_ADDRESS} (contract)`);
            console.log(`  • До: ${config.ADMIN_ADDRESS} (ти)`);
            console.log("  • Total Supply НЕ се променя");
            console.log("\n");
            
            console.log("🚀 Withdraw на токени...");
            const tx = await token.withdrawCirculationTokens(WITHDRAW_AMOUNT);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери нов статус
            const newContractBalance = await token.balanceOf(config.TOKEN_ADDRESS);
            const newYourBalance = await token.balanceOf(config.ADMIN_ADDRESS);
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШЕН WITHDRAW!");
            console.log("═══════════════════════════════════════");
            console.log(`📤 Withdraw-нати: ${withdrawFormatted} токена`);
            console.log("\n");
            
            console.log("📊 СЛЕД WITHDRAW:");
            console.log("─────────────────────────────────────");
            console.log(`  • Contract баланс: ${ethers.formatEther(newContractBalance)} токена`);
            console.log(`  • Твой баланс: ${ethers.formatEther(newYourBalance)} токена`);
            console.log(`  • Получил си: ${ethers.formatEther(newYourBalance - oldYourBalance)} токена`);
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ WITHDRAW:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 3) {
        // ========================================
        // СЦЕНАРИЙ 3: WITHDRAW BNB
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("💎 СЦЕНАРИЙ 3: WITHDRAW BNB");
        console.log("═══════════════════════════════════════\n");
        
        try {
            const bnbFormatted = ethers.formatEther(bnbBalance);
            console.log(`📋 BNB в контракта: ${bnbFormatted} BNB`);
            console.log("\n");
            
            if (bnbBalance === 0n) {
                throw new Error("Контрактът няма BNB!");
            }
            
            const oldBnbBalance = await ethers.provider.getBalance(config.ADMIN_ADDRESS);
            
            console.log("📊 ПРЕДИ WITHDRAW:");
            console.log("─────────────────────────────────────");
            console.log(`  • Contract BNB: ${bnbFormatted} BNB`);
            console.log(`  • Твой BNB: ${ethers.formatEther(oldBnbBalance)} BNB`);
            console.log("\n");
            
            console.log("📋 Какво ще се случи:");
            console.log(`  • ${bnbFormatted} BNB ще се преместят`);
            console.log(`  • От: ${config.TOKEN_ADDRESS} (contract)`);
            console.log(`  • До: ${config.ADMIN_ADDRESS} (ти)`);
            console.log("\n");
            
            console.log("🚀 Withdraw на BNB...");
            const tx = await token.withdrawBNB();
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери нов статус
            const newContractBnb = await ethers.provider.getBalance(config.TOKEN_ADDRESS);
            const newYourBnb = await ethers.provider.getBalance(config.ADMIN_ADDRESS);
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШЕН WITHDRAW!");
            console.log("═══════════════════════════════════════");
            console.log(`💎 Withdraw-нати: ${bnbFormatted} BNB`);
            console.log("\n");
            
            console.log("📊 СЛЕД WITHDRAW:");
            console.log("─────────────────────────────────────");
            console.log(`  • Contract BNB: ${ethers.formatEther(newContractBnb)} BNB`);
            console.log(`  • Твой BNB: ${ethers.formatEther(newYourBnb)} BNB (минус gas)`);
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ WITHDRAW BNB:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 4) {
        // ========================================
        // СЦЕНАРИЙ 4: RESCUE ОБЪРКАНИ ТОКЕНИ
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🚨 СЦЕНАРИЙ 4: RESCUE ТОКЕНИ");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log(`📋 Token адрес: ${RESCUE_TOKEN_ADDRESS}`);
            console.log(`📋 Amount: ${ethers.formatEther(RESCUE_AMOUNT)} токена`);
            console.log("\n");
            
            console.log("⚠️  ВНИМАНИЕ:");
            console.log("─────────────────────────────────────");
            console.log("Тази функция е за спасяване на токени");
            console.log("които са били изпратени по грешка към");
            console.log("контракта на KCY1 токена.");
            console.log("\n");
            
            console.log("❌ НЕ МОЖЕШ ДА RESCUE-НЕШ:");
            console.log("  • KCY1 токени (самият токен)");
            console.log("  • Използвай withdrawCirculationTokens()");
            console.log("\n");
            
            // Провери дали не е KCY1 token
            if (RESCUE_TOKEN_ADDRESS.toLowerCase() === config.TOKEN_ADDRESS.toLowerCase()) {
                throw new Error("Не можеш да rescue-неш KCY1! Използвай withdrawCirculationTokens()");
            }
            
            console.log("📋 Какво ще се случи:");
            console.log(`  • ${ethers.formatEther(RESCUE_AMOUNT)} токена ще се rescue-нат`);
            console.log(`  • От token: ${RESCUE_TOKEN_ADDRESS}`);
            console.log(`  • До: ${config.ADMIN_ADDRESS} (ти)`);
            console.log("\n");
            
            console.log("🚀 Rescue на токени...");
            const tx = await token.rescueTokens(RESCUE_TOKEN_ADDRESS, RESCUE_AMOUNT);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШЕН RESCUE!");
            console.log("═══════════════════════════════════════");
            console.log(`🚨 Rescue-нати: ${ethers.formatEther(RESCUE_AMOUNT)} токена`);
            console.log(`📋 Token: ${RESCUE_TOKEN_ADDRESS}`);
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ RESCUE:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 5) {
        // ========================================
        // СЦЕНАРИЙ 5: САМО ПРЕГЛЕД
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("ℹ️  РЕЖИМ: САМО ПРЕГЛЕД");
        console.log("═══════════════════════════════════════\n");
        
        console.log("📚 TOKEN ОПЕРАЦИИ:");
        console.log("─────────────────────────────────────");
        console.log("\n1. burn(uint256 amount)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Изгаря токени от твоя баланс");
        console.log("   • Total Supply намалява");
        console.log("   • НЕОБРАТИМО!");
        console.log("\n");
        
        console.log("2. withdrawCirculationTokens(uint256 amount)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Изтегля KCY1 токени от контракта");
        console.log("   • Total Supply НЕ се променя");
        console.log("\n");
        
        console.log("3. withdrawBNB()");
        console.log("   • Права: onlyAdmin");
        console.log("   • Изтегля BNB от контракта");
        console.log("   • За emergency случаи");
        console.log("\n");
        
        console.log("4. rescueTokens(address token, uint256 amount)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Спасява объркани токени");
        console.log("   • НЕ работи за KCY1 токени!");
        console.log("\n");
        
        console.log("💡 ЗА ИЗПЪЛНЕНИЕ:");
        console.log("  Промени SCENARIO = 1-4 и пусни отново");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
