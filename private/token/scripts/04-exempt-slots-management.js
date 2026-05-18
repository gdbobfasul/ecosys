// Version: 1.0056
/**
 * СКРИПТ 4: Exempt Slots управление
 * Цел: Добавяне/обновяване на exempt slots (admin адреси)
 * Изпълнява се от: 0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9
 */

const { ethers } = require("hardhat");
const config = require("./admin-config");

async function main() {
    console.log("========================================");
    console.log("🔧 EXEMPT SLOTS УПРАВЛЕНИЕ");
    console.log("========================================\n");
    
    const token = await ethers.getContractAt("KCY1Token", config.TOKEN_ADDRESS);
    const [signer] = await ethers.getSigners();
    
    console.log("🔗 Използван адрес:", signer.address);
    console.log("🪙 Token адрес:", config.TOKEN_ADDRESS);
    console.log("\n");
    
    // ========================================
    // ТЕКУЩИ EXEMPT SLOTS
    // ========================================
    console.log("📊 ТЕКУЩИ EXEMPT SLOTS:");
    console.log("─────────────────────────────────────");
    
    const owner = await token.owner();
    console.log(`Owner: ${owner}`);
    console.log("\nExempt Slots:");
    for (let i = 1; i <= 10; i++) {
        const addr = await token[`eAddr${i}`]();
        const isEmpty = addr === ethers.ZeroAddress;
        const isYou = addr.toLowerCase() === config.ADMIN_ADDRESS.toLowerCase();
        let marker = "";
        if (isYou) marker = " ✅ (ТИ)";
        else if (isEmpty) marker = " ⚠️ (ПРАЗЕН)";
        else if (i === 1 && addr === owner) marker = " 🔒 (OWNER - locked)";
        
        console.log(`  Slot ${i}: ${isEmpty ? "0x0000...0000" : addr}${marker}`);
    }
    console.log("\n");
    
    // Провери lock статус
    const slotsLocked = await token.exemptSlotsLocked();
    console.log(`🔒 Slots статус: ${slotsLocked ? "ЗАКЛЮЧЕНИ (locked forever)" : "Отключени (могат да се променят)"}`);
    console.log("\n");
    
    if (slotsLocked) {
        console.log("⚠️  EXEMPT SLOTS СА ЗАКЛЮЧЕНИ!");
        console.log("Само Multi-Sig може да unlock-не slots!");
        console.log("Функция: unlockExemptSlots()");
        console.log("\nНе можеш да променяш slots докато са заключени.");
        return;
    }
    
    // Провери cooldown
    const cooldown = await token.mainAddressChangersCooldown();
    const now = Math.floor(Date.now() / 1000);
    if (cooldown > now) {
        const timeLeft = cooldown - now;
        const hoursLeft = Math.floor(timeLeft / 3600);
        console.log("⏰ ADMIN COOLDOWN АКТИВЕН!");
        console.log(`Оставащо време: ${hoursLeft} часа`);
        console.log(`Cooldown до: ${new Date(cooldown * 1000).toLocaleString()}`);
        console.log("\nНе можеш да променяш slots докато cooldown е активен.");
        return;
    }
    
    // ========================================
    // ИЗБОР НА СЦЕНАРИЙ
    // ========================================
    console.log("🎯 НАЛИЧНИ СЦЕНАРИИ:");
    console.log("─────────────────────────────────────");
    console.log("1. ➕ Добавяне на НОВ Ledger в празен slot (6-10)");
    console.log("2. 🔄 Замяна на съществуващ адрес в slot (6-10)");
    console.log("3. 🔒 Заключване на exempt slots ЗАВИНАГИ");
    console.log("4. ℹ️  Само преглед (без промени)");
    console.log("\n");
    
    // Променливи за управление
    const SCENARIO = 1; // ПРОМЕНИ ТУК: 1-4
    
    // Нови Ledger адреси (примерни)
    const NEW_LEDGER_1 = "0x4444444444444444444444444444444444444444";
    const NEW_LEDGER_2 = "0x5555555555555555555555555555555555555555";
    const NEW_LEDGER_3 = "0x6666666666666666666666666666666666666666";
    
    if (SCENARIO === 1) {
        // ========================================
        // СЦЕНАРИЙ 1: ДОБАВЯНЕ НА НОВ LEDGER
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("➕ СЦЕНАРИЙ 1: ДОБАВЯНЕ НА НОВ LEDGER");
        console.log("═══════════════════════════════════════\n");
        
        // Настройки
        const TARGET_SLOT = 6; // ПРОМЕНИ ТУК: 6-10
        const NEW_ADDRESS = NEW_LEDGER_1; // ПРОМЕНИ ТУК
        
        try {
            console.log(`📋 Target Slot: ${TARGET_SLOT}`);
            console.log(`📋 Нов адрес: ${NEW_ADDRESS}`);
            console.log("\n");
            
            // Валидация
            if (TARGET_SLOT < 1 || TARGET_SLOT > 10) {
                throw new Error("Невалиден slot index! Трябва да е 1-10");
            }
            
            if (TARGET_SLOT === 1) {
                throw new Error("Slot 1 е OWNER и не може да се променя!");
            }
            
            if (TARGET_SLOT >= 2 && TARGET_SLOT <= 5) {
                console.log("⚠️  ВНИМАНИЕ: Slots 2-5 могат да се променят САМО от Multi-Sig!");
                console.log("Този скрипт ще се опита да промени slot, но може да fail-не.");
                console.log("\n");
            }
            
            // Провери текущ статус на slot
            const currentAddress = await token[`eAddr${TARGET_SLOT}`]();
            const isEmpty = currentAddress === ethers.ZeroAddress;
            
            console.log(`🔍 Текущ адрес в Slot ${TARGET_SLOT}:`);
            console.log(`   ${isEmpty ? "ПРАЗЕН (0x0000...0000)" : currentAddress}`);
            console.log("\n");
            
            if (!isEmpty) {
                console.log("⚠️  Slot НЕ е празен!");
                console.log("Този адрес ще бъде ЗАМЕНЕН с новия.");
                console.log("Сигурен ли си? (Промени SCENARIO = 2 за замяна)");
                console.log("\n");
            }
            
            console.log("📋 Какво ще се случи:");
            console.log(`  • Slot ${TARGET_SLOT} ще се обнови на: ${NEW_ADDRESS}`);
            console.log("  • Trading ще се ПАУЗНЕ за 48h автоматично!");
            console.log("  • Admin cooldown ще се активира за 48h!");
            console.log("  • Новият адрес ще получи admin права веднага");
            console.log("\n");
            
            console.log("🚀 Обновяване на exempt slot...");
            const tx = await token.updateExemptSlot(TARGET_SLOT, NEW_ADDRESS);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери новия статус
            const newAddress = await token[`eAddr${TARGET_SLOT}`]();
            const pausedUntil = await token.NotExemptTradeTransferPausedUntil();
            const newCooldown = await token.mainAddressChangersCooldown();
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШНО ОБНОВЕН!");
            console.log("═══════════════════════════════════════");
            console.log(`📌 Slot ${TARGET_SLOT}: ${newAddress}`);
            console.log(`⏸️  Trading паузнат до: ${new Date(Number(pausedUntil) * 1000).toLocaleString()}`);
            console.log(`⏰ Admin cooldown до: ${new Date(Number(newCooldown) * 1000).toLocaleString()}`);
            console.log("\n");
            
            console.log("📋 СЛЕДВАЩИ СТЪПКИ:");
            console.log("  1. ✅ Новият адрес има admin права веднага");
            console.log("  2. ⏸️  Trading е паузнат за 48h");
            console.log("  3. ⏰ Чакай 48h преди следваща промяна на slots");
            console.log("  4. 🔍 Провери с: npx hardhat run scripts/01-check-status.js");
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ ОБНОВЯВАНЕ:");
            
            if (error.message.includes("Only multi-sig for slots 1-5")) {
                console.error("⚠️  Slots 2-5 могат да се променят САМО от Multi-Sig!");
                console.error("💡 Използвай slot 6-10 вместо това.");
            } else if (error.message.includes("Slot 1 is owner")) {
                console.error("⚠️  Slot 1 е owner и НЕ може да се променя!");
            } else if (error.message.includes("Slots locked")) {
                console.error("⚠️  Exempt slots са заключени!");
                console.error("💡 Само Multi-Sig може да unlock-не.");
            } else if (error.message.includes("Not admin")) {
                console.error("⚠️  Нямаш admin права!");
            } else {
                console.error(error.message);
            }
            throw error;
        }
        
    } else if (SCENARIO === 2) {
        // ========================================
        // СЦЕНАРИЙ 2: ЗАМЯНА НА АДРЕС
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🔄 СЦЕНАРИЙ 2: ЗАМЯНА НА АДРЕС В SLOT");
        console.log("═══════════════════════════════════════\n");
        
        // Настройки
        const TARGET_SLOT = 7; // ПРОМЕНИ ТУК: 6-10
        const NEW_ADDRESS = NEW_LEDGER_2; // ПРОМЕНИ ТУК
        
        try {
            console.log(`📋 Target Slot: ${TARGET_SLOT}`);
            console.log(`📋 Нов адрес: ${NEW_ADDRESS}`);
            console.log("\n");
            
            // Провери текущ адрес
            const oldAddress = await token[`eAddr${TARGET_SLOT}`]();
            
            console.log("🔍 ТЕКУЩ СТАТУС:");
            console.log(`  Стар адрес: ${oldAddress}`);
            console.log(`  Нов адрес: ${NEW_ADDRESS}`);
            console.log("\n");
            
            console.log("⚠️  ВНИМАНИЕ:");
            console.log("  • Старият адрес ще ЗАГУБИ admin права!");
            console.log("  • Новият адрес ще ПОЛУЧИ admin права!");
            console.log("  • Trading ще се паузне за 48h!");
            console.log("  • Admin cooldown ще се активира за 48h!");
            console.log("\n");
            
            console.log("🚀 Замяна на адрес...");
            const tx = await token.updateExemptSlot(TARGET_SLOT, NEW_ADDRESS);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери новия статус
            const newAddress = await token[`eAddr${TARGET_SLOT}`]();
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШНА ЗАМЯНА!");
            console.log("═══════════════════════════════════════");
            console.log(`❌ Премахнат: ${oldAddress}`);
            console.log(`✅ Добавен: ${newAddress}`);
            console.log(`📌 Slot: ${TARGET_SLOT}`);
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ ЗАМЯНА:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 3) {
        // ========================================
        // СЦЕНАРИЙ 3: ЗАКЛЮЧВАНЕ ЗАВИНАГИ
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🔒 СЦЕНАРИЙ 3: LOCK EXEMPT SLOTS");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log("⚠️  КРИТИЧНО ПРЕДУПРЕЖДЕНИЕ!");
            console.log("─────────────────────────────────────");
            console.log("Това действие е НЕОБРАТИМО!");
            console.log("\n");
            
            console.log("📋 Какво ще се случи:");
            console.log("  • Exempt slots ще се ЗАКЛЮЧАТ ЗАВИНАГИ");
            console.log("  • НИКОЙ няма да може да променя slots");
            console.log("  • САМО Multi-Sig може да unlock-не");
            console.log("  • Текущите 10 адреса стават permanent");
            console.log("\n");
            
            console.log("🔍 Текущи exempt slots:");
            for (let i = 1; i <= 10; i++) {
                const addr = await token[`eAddr${i}`]();
                const isEmpty = addr === ethers.ZeroAddress;
                console.log(`  Slot ${i}: ${isEmpty ? "ПРАЗЕН ⚠️" : addr}`);
            }
            console.log("\n");
            
            // Провери за празни slots
            let hasEmpty = false;
            for (let i = 1; i <= 10; i++) {
                const addr = await token[`eAddr${i}`]();
                if (addr === ethers.ZeroAddress) {
                    hasEmpty = true;
                    break;
                }
            }
            
            if (hasEmpty) {
                console.log("⚠️  ВНИМАНИЕ: Имаш ПРАЗНИ slots!");
                console.log("Сигурен ли си че искаш да заключиш така?");
                console.log("Празните slots ще останат празни ЗАВИНАГИ!");
                console.log("\n");
            }
            
            console.log("💡 ПРЕПОРЪКА:");
            console.log("  • Попълни всички slots преди заключване");
            console.log("  • Провери адресите 2-3 пъти");
            console.log("  • Запази списък с всички slots offline");
            console.log("\n");
            
            console.log("🚀 Заключване на exempt slots...");
            const tx = await token.lockExemptSlotsForever();
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери lock статус
            const locked = await token.exemptSlotsLocked();
            
            console.log("═══════════════════════════════════════");
            console.log(`${locked ? "🔒" : "❌"} ${locked ? "УСПЕШНО ЗАКЛЮЧЕНИ!" : "ГРЕШКА!"}`);
            console.log("═══════════════════════════════════════");
            
            if (locked) {
                console.log("📋 РЕЗУЛТАТ:");
                console.log("  • Exempt slots са заключени ЗАВИНАГИ");
                console.log("  • Само Multi-Sig може да unlock-не");
                console.log("  • Функция за unlock: unlockExemptSlots()");
                console.log("\n");
                
                console.log("📌 ЗАКЛЮЧЕНИ АДРЕСИ:");
                for (let i = 1; i <= 10; i++) {
                    const addr = await token[`eAddr${i}`]();
                    console.log(`  Slot ${i}: ${addr}`);
                }
            }
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ ЗАКЛЮЧВАНЕ:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 4) {
        // ========================================
        // СЦЕНАРИЙ 4: САМО ПРЕГЛЕД
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("ℹ️  РЕЖИМ: САМО ПРЕГЛЕД");
        console.log("═══════════════════════════════════════\n");
        
        console.log("📚 ИНФОРМАЦИЯ ЗА EXEMPT SLOTS:");
        console.log("─────────────────────────────────────");
        console.log("\n🔢 SLOT ПРАВИЛА:");
        console.log("  • Slot 1: OWNER (НЕ може да се променя)");
        console.log("  • Slots 2-5: Само Multi-Sig може да променя");
        console.log("  • Slots 6-10: Admin може да променя");
        console.log("\n");
        
        console.log("⚠️  АВТОМАТИЧНИ ЕФЕКТИ:");
        console.log("  • updateExemptSlot() → Pause 48h");
        console.log("  • updateExemptSlot() → Admin cooldown 48h");
        console.log("  • lockExemptSlotsForever() → Lock завинаги");
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
