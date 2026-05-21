// Version: 1.0093
/**
 * СКРИПТ 2: Pause и контролни функции
 * Цел: Пауза на trading и общ контрол
 * Изпълнява се от: 0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9
 */

const { ethers } = require("hardhat");
const config = require("./admin-config");

async function main() {
    console.log("========================================");
    console.log("⏸️  PAUSE И КОНТРОЛ");
    console.log("========================================\n");
    
    const token = await ethers.getContractAt("KCY1Token", config.TOKEN_ADDRESS);
    const [signer] = await ethers.getSigners();
    
    console.log("🔗 Използван адрес:", signer.address);
    console.log("🪙 Token адрес:", config.TOKEN_ADDRESS);
    console.log("\n");
    
    // ========================================
    // ПРОВЕРКА НА ТЕКУЩ СТАТУС
    // ========================================
    console.log("📊 ТЕКУЩ СТАТУС:");
    console.log("─────────────────────────────────────");
    
    const pausedUntil = await token.NotExemptTradeTransferPausedUntil();
    const now = Math.floor(Date.now() / 1000);
    const isPaused = pausedUntil > now;
    
    if (isPaused) {
        const timeLeft = pausedUntil - now;
        const hoursLeft = Math.floor(timeLeft / 3600);
        console.log(`✅ Trading вече е ПАУЗНАТО`);
        console.log(`⏰ Оставащо време: ${hoursLeft} часа`);
        console.log(`📅 Пауза до: ${new Date(pausedUntil * 1000).toLocaleString()}`);
        console.log("\n⚠️  Няма нужда да паузваш отново!");
        return;
    }
    
    console.log(`▶️  Trading е АКТИВНО`);
    console.log("\n");
    
    // ========================================
    // ИЗБОР НА ДЕЙСТВИЕ
    // ========================================
    console.log("🎯 НАЛИЧНИ ДЕЙСТВИЯ:");
    console.log("─────────────────────────────────────");
    console.log("1. ⏸️  Пауза на trading за 48 часа");
    console.log("2. ℹ️  Само преглед (без промени)");
    console.log("\n");
    
    // Променливи за управление на сценария
    const ACTION = 1; // ПРОМЕНИ ТУК: 1 = pause, 2 = преглед
    
    if (ACTION === 1) {
        // ========================================
        // СЦЕНАРИЙ 1: ПАУЗА НА TRADING
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("⏸️  ИЗПЪЛНЕНИЕ: ПАУЗА НА TRADING");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log("📋 Какво ще се случи:");
            console.log("  • Normal users НЕ могат да трансферират");
            console.log("  • Exempt адресите МОГАТ да трансферират");
            console.log("  • Паузата е за 48 часа");
            console.log("  • Автоматично се отпаузва след изтичане");
            console.log("\n");
            
            console.log("🚀 Изпращам транзакция...");
            const tx = await token.pause();
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери новия статус
            const newPausedUntil = await token.NotExemptTradeTransferPausedUntil();
            const pauseDate = new Date(Number(newPausedUntil) * 1000);
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШНО ПАУЗНАТО!");
            console.log("═══════════════════════════════════════");
            console.log(`⏰ Пауза до: ${pauseDate.toLocaleString()}`);
            console.log(`⏳ Продължителност: 48 часа`);
            console.log("\n");
            
            console.log("📌 СЛЕДВАЩИ СТЪПКИ:");
            console.log("  1. ✅ Trading е спрян за normal users");
            console.log("  2. 🔍 Провери проблема който е довел до паузата");
            console.log("  3. ⏰ Изчакай автоматичното отпаузване след 48h");
            console.log("  4. 🔄 Или използвай Multi-Sig ако искаш по-ранно отпаузване");
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ ПАУЗА:");
            
            if (error.message.includes("Not admin")) {
                console.error("⚠️  Нямаш admin права!");
                console.error("💡 Провери дали адресът е в exempt slots:");
                console.error(`   Твоят адрес: ${config.ADMIN_ADDRESS}`);
                console.error("\n   Изпълни: npx hardhat run scripts/01-check-status.js");
            } else if (error.message.includes("Paused")) {
                console.error("⚠️  Trading вече е паузнато!");
            } else {
                console.error(error.message);
            }
            throw error;
        }
        
    } else if (ACTION === 2) {
        // ========================================
        // СЦЕНАРИЙ 2: САМО ПРЕГЛЕД
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("ℹ️  РЕЖИМ: САМО ПРЕГЛЕД");
        console.log("═══════════════════════════════════════\n");
        
        console.log("📊 ИНФОРМАЦИЯ ЗА PAUSE:");
        console.log("─────────────────────────────────────");
        console.log("Функция: pause()");
        console.log("Права: onlyAdmin");
        console.log("Продължителност: 48 часа (PAUSE_DURATION)");
        console.log("\n");
        
        console.log("📋 ЕФЕКТ:");
        console.log("  • NotExemptTradeTransferPausedUntil = block.timestamp + 48h");
        console.log("  • Normal users НЕ могат да трансферират");
        console.log("  • Exempt адресите МОГАТ да трансферират");
        console.log("  • Автоматично се отпаузва след 48h");
        console.log("\n");
        
        console.log("💡 ЗА ИЗПЪЛНЕНИЕ:");
        console.log("  Промени ACTION = 1 в кода и пусни отново");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
