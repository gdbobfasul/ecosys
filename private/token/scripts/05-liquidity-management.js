// Version: 1.0093
/**
 * СКРИПТ 5: Liquidity Pairs управление
 * Цел: Добавяне/управление на liquidity pairs
 * Изпълнява се от: 0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9
 */

const { ethers } = require("hardhat");
const config = require("./admin-config");

async function main() {
    console.log("========================================");
    console.log("💧 LIQUIDITY PAIRS УПРАВЛЕНИЕ");
    console.log("========================================\n");
    
    const token = await ethers.getContractAt("KCY1Token", config.TOKEN_ADDRESS);
    const [signer] = await ethers.getSigners();
    
    console.log("🔗 Използван адрес:", signer.address);
    console.log("🪙 Token адрес:", config.TOKEN_ADDRESS);
    console.log("\n");
    
    // ========================================
    // ПРОВЕРКА НА ТЕКУЩ СТАТУС
    // ========================================
    const pairsLocked = await token.liquidityPairsLocked();
    const cooldown = await token.mainAddressChangersCooldown();
    const now = Math.floor(Date.now() / 1000);
    
    console.log("📊 ТЕКУЩ СТАТУС:");
    console.log("─────────────────────────────────────");
    console.log(`🔒 Pairs locked: ${pairsLocked ? "ДА (заключени завинаги)" : "НЕ (могат да се променят)"}`);
    
    if (cooldown > now) {
        const timeLeft = cooldown - now;
        const hoursLeft = Math.floor(timeLeft / 3600);
        console.log(`⏰ Admin cooldown: Активен за още ${hoursLeft}h`);
    } else {
        console.log(`⏰ Admin cooldown: Неактивен`);
    }
    console.log("\n");
    
    if (pairsLocked) {
        console.log("⚠️  LIQUIDITY PAIRS СА ЗАКЛЮЧЕНИ!");
        console.log("Само Multi-Sig може да unlock-не!");
        console.log("Функция: unlockLiquidityPairs()");
        console.log("\nНе можеш да променяш pairs докато са заключени.");
        return;
    }
    
    if (cooldown > now) {
        console.log("⚠️  ADMIN COOLDOWN Е АКТИВЕН!");
        const timeLeft = cooldown - now;
        const hoursLeft = Math.floor(timeLeft / 3600);
        console.log(`Чакай още ${hoursLeft} часа преди промяна на pairs.`);
        console.log(`Cooldown до: ${new Date(cooldown * 1000).toLocaleString()}`);
        return;
    }
    
    // ========================================
    // ИЗБОР НА СЦЕНАРИЙ
    // ========================================
    console.log("🎯 НАЛИЧНИ СЦЕНАРИИ:");
    console.log("─────────────────────────────────────");
    console.log("1. 🔍 Намиране на текущ pair (автоматично)");
    console.log("2. ➕ Добавяне на НОВ pair");
    console.log("3. ➕ Добавяне на МНОГО pairs (batch)");
    console.log("4. ❌ Премахване на pair");
    console.log("5. 🔒 Заключване на pairs ЗАВИНАГИ");
    console.log("6. ℹ️  Само преглед");
    console.log("\n");
    
    // Променливи
    const SCENARIO = 1; // ПРОМЕНИ ТУК: 1-6
    
    // Адреси (примерни)
    const PAIR_ADDRESS = "0x7777777777777777777777777777777777777777";
    const BATCH_PAIRS = [
        "0x8888888888888888888888888888888888888888",
        "0x9999999999999999999999999999999999999999"
    ];
    
    if (SCENARIO === 1) {
        // ========================================
        // СЦЕНАРИЙ 1: НАМИРАНЕ НА ТЕКУЩ PAIR
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🔍 СЦЕНАРИЙ 1: НАМИРАНЕ НА PAIR");
        console.log("═══════════════════════════════════════\n");
        
        try {
            // Вземи factory address
            const factory = await token.pncswpFactory();
            console.log(`🏭 Factory: ${factory}`);
            
            // Connect към Factory
            const factoryContract = await ethers.getContractAt(
                ["function getPair(address,address) view returns (address)"],
                factory
            );
            
            // Вземи WBNB address (BSC Mainnet)
            const wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
            console.log(`💎 WBNB: ${wbnb}`);
            console.log("\n");
            
            console.log("🔍 Търсене на KCY1/WBNB pair...");
            const pair = await factoryContract.getPair(config.TOKEN_ADDRESS, wbnb);
            
            if (pair === ethers.ZeroAddress) {
                console.log("\n❌ PAIR НЕ Е СЪЗДАДЕН!");
                console.log("\n📋 СЛЕДВАЩИ СТЪПКИ:");
                console.log("  1. Отиди на PancakeSwap");
                console.log("  2. Добави liquidity (KCY1 + BNB)");
                console.log("  3. PancakeSwap ще създаде pair автоматично");
                console.log("  4. Върни се и пусни този скрипт отново");
                console.log("\n💡 ЛИНК:");
                console.log("  https://pancakeswap.finance/add");
                return;
            }
            
            console.log("\n✅ PAIR НАМЕРЕН!");
            console.log("═══════════════════════════════════════");
            console.log(`💧 Pair адрес: ${pair}`);
            console.log("\n");
            
            // Провери дали е вече добавен като exempt
            const isExempt = await token.isLiquidityPair(pair);
            console.log(`📋 Exempt статус: ${isExempt ? "✅ Вече е exempt" : "❌ НЕ е exempt"}`);
            
            if (!isExempt) {
                console.log("\n💡 СЛЕДВАЩА СТЪПКА:");
                console.log("  Добави pair като exempt с:");
                console.log(`  SCENARIO = 2 и PAIR_ADDRESS = "${pair}"`);
            } else {
                console.log("\n✅ Pair вече е настроен правилно!");
            }
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ НАМИРАНЕ:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 2) {
        // ========================================
        // СЦЕНАРИЙ 2: ДОБАВЯНЕ НА PAIR
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("➕ СЦЕНАРИЙ 2: ДОБАВЯНЕ НА PAIR");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log(`📋 Pair адрес: ${PAIR_ADDRESS}`);
            console.log("\n");
            
            // Провери текущ статус
            const isExempt = await token.isLiquidityPair(PAIR_ADDRESS);
            console.log(`Текущ статус: ${isExempt ? "✅ Вече е exempt" : "❌ НЕ е exempt"}`);
            
            if (isExempt) {
                console.log("\n⚠️  Pair вече е добавен като exempt!");
                return;
            }
            
            console.log("\n📋 Какво ще се случи:");
            console.log("  • Pair ще стане exempt (no fees, no limits)");
            console.log("  • Admin cooldown ще се активира за 48h");
            console.log("  • Pair ще може да приема liquidity");
            console.log("\n");
            
            console.log("🚀 Добавяне на pair...");
            const tx = await token.setLiquidityPair(PAIR_ADDRESS, true);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            // Провери новия статус
            const newStatus = await token.isLiquidityPair(PAIR_ADDRESS);
            const newCooldown = await token.mainAddressChangersCooldown();
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШНО ДОБАВЕН!");
            console.log("═══════════════════════════════════════");
            console.log(`💧 Pair: ${PAIR_ADDRESS}`);
            console.log(`📌 Статус: ${newStatus ? "EXEMPT" : "ГРЕШКА"}`);
            console.log(`⏰ Cooldown до: ${new Date(Number(newCooldown) * 1000).toLocaleString()}`);
            console.log("\n");
            
            console.log("📋 СЛЕДВАЩИ СТЪПКИ:");
            console.log("  1. ✅ Pair е готов за liquidity");
            console.log("  2. 💧 Можеш да добавяш/премахваш liquidity");
            console.log("  3. ⏰ Чакай 48h преди следваща промяна");
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ ДОБАВЯНЕ:");
            if (error.message.includes("Pairs locked")) {
                console.error("⚠️  Liquidity pairs са заключени!");
            } else if (error.message.includes("cooldown")) {
                console.error("⚠️  Admin cooldown е активен!");
            } else {
                console.error(error.message);
            }
            throw error;
        }
        
    } else if (SCENARIO === 3) {
        // ========================================
        // СЦЕНАРИЙ 3: BATCH ДОБАВЯНЕ
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("➕ СЦЕНАРИЙ 3: BATCH ДОБАВЯНЕ");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log(`📋 Брой pairs: ${BATCH_PAIRS.length}`);
            console.log("\nPairs:");
            BATCH_PAIRS.forEach((p, i) => {
                console.log(`  ${i + 1}. ${p}`);
            });
            console.log("\n");
            
            console.log("🔍 Проверка на текущ статус:");
            for (let i = 0; i < BATCH_PAIRS.length; i++) {
                const isExempt = await token.isLiquidityPair(BATCH_PAIRS[i]);
                const status = isExempt ? "✅ Вече exempt" : "❌ НЕ е exempt";
                console.log(`  ${i + 1}. ${status}`);
            }
            console.log("\n");
            
            console.log("🚀 Batch добавяне...");
            const tx = await token.setLiquidityPairBatch(BATCH_PAIRS, true);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log(`⛽ Gas използван: ${receipt.gasUsed.toString()}`);
            console.log("\n");
            
            console.log("═══════════════════════════════════════");
            console.log("✅ BATCH ЗАВЪРШИ!");
            console.log("═══════════════════════════════════════");
            console.log(`📊 Добавени: ${BATCH_PAIRS.length} pairs`);
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ BATCH:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 4) {
        // ========================================
        // СЦЕНАРИЙ 4: ПРЕМАХВАНЕ НА PAIR
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("❌ СЦЕНАРИЙ 4: ПРЕМАХВАНЕ НА PAIR");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log(`📋 Pair адрес: ${PAIR_ADDRESS}`);
            console.log("\n");
            
            // Провери текущ статус
            const isExempt = await token.isLiquidityPair(PAIR_ADDRESS);
            console.log(`Текущ статус: ${isExempt ? "✅ Е exempt" : "❌ НЕ е exempt"}`);
            
            if (!isExempt) {
                console.log("\n⚠️  Pair не е exempt!");
                return;
            }
            
            console.log("\n⚠️  ВНИМАНИЕ:");
            console.log("  • Pair ще ЗАГУБИ exempt статус");
            console.log("  • Ще се прилагат fees за трансфери");
            console.log("  • Може да наруши liquidity операциите");
            console.log("\n");
            
            console.log("🚀 Премахване на pair...");
            const tx = await token.setLiquidityPair(PAIR_ADDRESS, false);
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log("\n");
            
            console.log("═══════════════════════════════════════");
            console.log("✅ УСПЕШНО ПРЕМАХНАТ!");
            console.log("═══════════════════════════════════════");
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ ПРЕМАХВАНЕ:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 5) {
        // ========================================
        // СЦЕНАРИЙ 5: ЗАКЛЮЧВАНЕ ЗАВИНАГИ
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("🔒 СЦЕНАРИЙ 5: LOCK PAIRS ЗАВИНАГИ");
        console.log("═══════════════════════════════════════\n");
        
        try {
            console.log("⚠️  КРИТИЧНО ПРЕДУПРЕЖДЕНИЕ!");
            console.log("─────────────────────────────────────");
            console.log("Това действие е НЕОБРАТИМО!");
            console.log("\n");
            
            console.log("📋 Какво ще се случи:");
            console.log("  • Liquidity pairs ще се ЗАКЛЮЧАТ ЗАВИНАГИ");
            console.log("  • НЕ можеш да добавяш нови pairs");
            console.log("  • НЕ можеш да премахваш съществуващи");
            console.log("  • САМО Multi-Sig може да unlock-не");
            console.log("\n");
            
            console.log("💡 ПРЕПОРЪКА:");
            console.log("  • Добави всички нужни pairs ПРЕДИ lock");
            console.log("  • Провери дали pairs работят правилно");
            console.log("  • Запази списък с pairs offline");
            console.log("\n");
            
            console.log("🚀 Заключване на pairs...");
            const tx = await token.lockLiquidityPairsForever();
            console.log(`📝 Transaction Hash: ${tx.hash}`);
            console.log("⏳ Изчакване на потвърждение...");
            
            const receipt = await tx.wait();
            console.log(`✅ Потвърдено в блок: ${receipt.blockNumber}`);
            console.log("\n");
            
            // Провери lock статус
            const locked = await token.liquidityPairsLocked();
            
            console.log("═══════════════════════════════════════");
            console.log(`${locked ? "🔒" : "❌"} ${locked ? "УСПЕШНО ЗАКЛЮЧЕНИ!" : "ГРЕШКА!"}`);
            console.log("═══════════════════════════════════════");
            
            if (locked) {
                console.log("📋 РЕЗУЛТАТ:");
                console.log("  • Pairs са заключени ЗАВИНАГИ");
                console.log("  • Само Multi-Sig може да unlock-не");
                console.log("  • Функция: unlockLiquidityPairs()");
            }
            
        } catch (error) {
            console.error("\n❌ ГРЕШКА ПРИ ЗАКЛЮЧВАНЕ:");
            console.error(error.message);
            throw error;
        }
        
    } else if (SCENARIO === 6) {
        // ========================================
        // СЦЕНАРИЙ 6: САМО ПРЕГЛЕД
        // ========================================
        console.log("═══════════════════════════════════════");
        console.log("ℹ️  РЕЖИМ: САМО ПРЕГЛЕД");
        console.log("═══════════════════════════════════════\n");
        
        console.log("📚 ФУНКЦИИ ЗА LIQUIDITY PAIRS:");
        console.log("─────────────────────────────────────");
        console.log("\n1. setLiquidityPair(address, bool)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Добавя/премахва pair");
        console.log("   • Admin cooldown 48h след промяна");
        console.log("\n");
        
        console.log("2. setLiquidityPairBatch(address[], bool)");
        console.log("   • Права: onlyAdmin");
        console.log("   • Batch версия");
        console.log("\n");
        
        console.log("3. lockLiquidityPairsForever()");
        console.log("   • Права: onlyAdmin");
        console.log("   • Заключва ЗАВИНАГИ");
        console.log("\n");
        
        console.log("4. unlockLiquidityPairs()");
        console.log("   • Права: onlyMultiSig ⚠️");
        console.log("   • Отключва pairs");
        console.log("\n");
        
        console.log("💡 ЗА ИЗПЪЛНЕНИЕ:");
        console.log("  Промени SCENARIO = 1-5 и пусни отново");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
