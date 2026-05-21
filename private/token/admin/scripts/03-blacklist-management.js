// Version: 1.0093
/**
 * СКРИПТ 3: Blacklist управление
 * Цел: Добавяне/проверка на blacklist адреси
 * Изпълнява се от: 0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9
 */

const { ethers } = require("hardhat");
const config = require("./admin-config");

async function main() {
    console.log("========================================");
    console.log("🚫 BLACKLIST УПРАВЛЕНИЕ");
    console.log("========================================\n");
    
    const token = await ethers.getContractAt("KCY1Token", config.TOKEN_ADDRESS);
    const [signer] = await ethers.getSigners();
    
    console.log("🔗 Използван адрес:", signer.address);
    console.log("🪙 Token адрес:", config.TOKEN_ADDRESS);
    console.log("\n");
    
    // ========================================
    // ИЗБОР НА СЦЕНАРИЙ
    // ========================================
    console.log("🎯 НАЛИЧНИ СЦЕНАРИИ:");
    console.log("─────────────────────────────────────");
    console.log("1. 🚫 Добавяне на ЕДИН адрес в blacklist");
    console.log("2. 🚫 Добавяне на НЯКОЛКО адреса (batch)");
    console.log("3. 🔍 Проверка дали адрес е в blacklist");
    console.log("4. ℹ️  Само преглед (без промени)");
    console.log("\n");
    
    // Променливи за управление
    const SCENARIO = 1; // ПРОМЕНИ ТУК: 1-4
    
    // Адреси за blacklist (примерни)
    const SINGLE_ADDRESS = "0x1234567890123456789012345678901234567890";
    const BATCH_ADDRESSES = [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333"
    ];
    const CHECK_ADDRESS = "0x1234567890123456789012345678901234567890";
    
    if (SCENARIO === 1) {
        // ========================================
        // СЦЕНАРИЙ 1: ЕДИН АДРЕС В BLACKLIST
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🚫 СЦЕНАРИЙ 1: BLACKLIST ЕДИН АДРЕС");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log(`📋 Адрес за blacklist: ${SINGLE_ADDRESS}`);
            console.log("\n");
            
            // Провери текущ статус
            const isBanned = await token.isBlacklisted(SINGLE_ADDRESS);
            console.log(`Текущ статус: ${isBanned ? "🚫 Вече е blacklisted" : "✅ НЕ е blacklisted"}`);
            
            if (isBanned) {
                console.log("\n⚠️  Адресът вече е в blacklist!");
                console.log("💡 За премахване от blacklist се изисква Multi-Sig!");
                return;
            }
            
            console.log("\n🚀 Добавяне в blacklist...");
            const tx = await token.setBlacklist(SINGLE_ADDRESS, true);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери новия статус
            const newStatus = await token.isBlacklisted(SINGLE_ADDRESS);
            console.log("═══════════════════════════════════════");
            console.log(`✅ УСПЕШНО ${newStatus ? "ДОБАВЕН" : "ГРЕШКА"}!`);
            console.log("═══════════════════════════════════════");
            console.log(`🚫 Адрес: ${SINGLE_ADDRESS}`);
            console.log(`📌 Статус: ${newStatus ? "BLACKLISTED" : "НЕ е в blacklist"}`);
            console.log("\n");
            
            console.log("📋 ЕФЕКТ:");
            console.log("  • Адресът НЕ може да transfer-ва");
            console.log("  • Адресът НЕ може да receive-ва");
            console.log("  • Адресът НЕ може да approve");
            console.log("\n");
            
            console.log("⚠️  ВАЖНО:");
            console.log("  • Само Multi-Sig може да премахне от blacklist!");
            console.log("  • Функция за премахване: removeFromBlacklist()");
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ BLACKLIST:");
            if (error.message.includes("Not admin")) {
                console.error("⚠️  Нямаш admin права!");
            } else {
                console.error(error.message);
            }
            throw error;
        }
        
    } else if (SCENARIO === 2) {
        // ========================================
        // СЦЕНАРИЙ 2: BATCH BLACKLIST
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🚫 СЦЕНАРИЙ 2: BATCH BLACKLIST");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log(`📋 Брой адреси за blacklist: ${BATCH_ADDRESSES.length}`);
            console.log("\nАдреси:");
            BATCH_ADDRESSES.forEach((addr, i) => {
                console.log(`  ${i + 1}. ${addr}`);
            });
            console.log("\n");
            
            // Провери текущ статус на всички
            console.log("🔍 Проверка на текущ статус:");
            for (let i = 0; i < BATCH_ADDRESSES.length; i++) {
                const isBanned = await token.isBlacklisted(BATCH_ADDRESSES[i]);
                const status = isBanned ? "🚫 Вече blacklisted" : "✅ НЕ е blacklisted";
                console.log(`  ${i + 1}. ${status}`);
            }
            console.log("\n");
            
            console.log("🚀 Добавяне в blacklist (batch)...");
            const tx = await token.setBlacklistBatch(BATCH_ADDRESSES, true);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери новите статуси
            console.log("🔍 Проверка на нов статус:");
            for (let i = 0; i < BATCH_ADDRESSES.length; i++) {
                const isBanned = await token.isBlacklisted(BATCH_ADDRESSES[i]);
                const status = isBanned ? "🚫 BLACKLISTED" : "❌ ГРЕШКА";
                console.log(`  ${i + 1}. ${status}`);
            }
            console.log("\n");
            
            console.log("═══════════════════════════════════════");
            console.log("✅ BATCH BLACKLIST ЗАВЪРШИ!");
            console.log("═══════════════════════════════════════");
            console.log(`📊 Добавени: ${BATCH_ADDRESSES.length} адреса`);
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ BATCH BLACKLIST:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 3) {
        // ========================================
        // СЦЕНАРИЙ 3: ПРОВЕРКА НА АДРЕС
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🔍 СЦЕНАРИЙ 3: ПРОВЕРКА НА BLACKLIST");
        console.log("═══════════════════════════════════════\n");
        
        console.log(`📋 Проверка на адрес: ${CHECK_ADDRESS}`);
        console.log("\n");
        
        const isBanned = await token.isBlacklisted(CHECK_ADDRESS);
        
        console.log("═══════════════════════════════════════");
        console.log(`${isBanned ? "🚫" : "✅"} РЕЗУЛТАТ`);
        console.log("═══════════════════════════════════════");
        console.log(`Адрес: ${CHECK_ADDRESS}`);
        console.log(`Статус: ${isBanned ? "🚫 В BLACKLIST" : "✅ НЕ е в blacklist"}`);
        console.log("\n");
        
        if (isBanned) {
            console.log("📋 ИНФОРМАЦИЯ:");
            console.log("  • Адресът е блокиран за трансфери");
            console.log("  • Само Multi-Sig може да го премахне");
            console.log("  • Функция: removeFromBlacklist()");
        } else {
            console.log("📋 ИНФОРМАЦИЯ:");
            console.log("  • Адресът може нормално да трансферира");
            console.log("  • Може да бъде добавен в blacklist с:");
            console.log("    setBlacklist() или setBlacklistBatch()");
        }
        
    } else if (SCENARIO === 4) {
        // ========================================
        // СЦЕНАРИЙ 4: САМО ПРЕГЛЕД
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("ℹ️  РЕЖИМ: САМО ПРЕГЛЕД");
        console.log("═══════════════════════════════════════\n");
        
        console.log("📚 ФУНКЦИИ ЗА BLACKLIST:");
        console.log("─────────────────────────────────────");
        console.log("\n1. setBlacklist(address, bool)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Добавя/премахва ЕДИН адрес");
        console.log("   • Параметри:");
        console.log("     - address: Адресът");
        console.log("     - bool: true = добави, false = премахни");
        console.log("\n");
        
        console.log("2. setBlacklistBatch(address[], bool)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Добавя/премахва МНОГО адреси");
        console.log("   • По-ефективно за много адреси");
        console.log("\n");
        
        console.log("3. removeFromBlacklist(address)");
        console.log("   • Права: onlyMultiSig ⚠️");
        console.log("   • Премахва адрес от blacklist");
        console.log("   • САМО Multi-Sig може да извика!");
        console.log("\n");
        
        console.log("4. removeMULTIFromBlacklist(address[])");
        console.log("   • Права: onlyMultiSig ⚠️");
        console.log("   • Batch версия на горната");
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
