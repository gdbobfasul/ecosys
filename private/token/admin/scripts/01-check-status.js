// Version: 1.0056
/**
 * СКРИПТ 1: Проверка на статус
 * Цел: View функции - четене на информация от контракта
 * Изпълнява се от: 0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9
 */

const { ethers } = require("hardhat");
const config = require("./admin-config");

async function main() {
    console.log("========================================");
    console.log("📊 ПРОВЕРКА НА СТАТУС НА ТОКЕНА");
    console.log("========================================\n");
    
    // Connect към токена
    const token = await ethers.getContractAt("KCY1Token", config.TOKEN_ADDRESS);
    const [signer] = await ethers.getSigners();
    
    console.log("🔗 Използван адрес:", signer.address);
    console.log("🪙 Token адрес:", config.TOKEN_ADDRESS);
    console.log("\n");
    
    try {
        // ========================================
        // 1. ОСНОВНА ИНФОРМАЦИЯ
        // ========================================
        console.log("📋 ОСНОВНА ИНФОРМАЦИЯ:");
        console.log("─────────────────────────────────────");
        
        const name = await token.name();
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const totalSupply = await token.totalSupply();
        
        console.log(`Име: ${name}`);
        console.log(`Символ: ${symbol}`);
        console.log(`Decimals: ${decimals}`);
        console.log(`Total Supply: ${ethers.formatEther(totalSupply)} токена`);
        console.log("\n");
        
        // ========================================
        // 2. OWNER И ADMIN ИНФОРМАЦИЯ
        // ========================================
        console.log("👤 OWNER И EXEMPT SLOTS:");
        console.log("─────────────────────────────────────");
        
        const owner = await token.owner();
        console.log(`Owner: ${owner}`);
        
        // Провери всички exempt slots
        for (let i = 1; i <= 10; i++) {
            const slotAddress = await token[`eAddr${i}`]();
            const isYourAddress = slotAddress.toLowerCase() === config.ADMIN_ADDRESS.toLowerCase();
            const marker = isYourAddress ? "✅ (ТИ)" : "";
            console.log(`Exempt Slot ${i}: ${slotAddress} ${marker}`);
        }
        
        const multiSig = await token.multiSigAddress();
        console.log(`Multi-Sig: ${multiSig || "Не е зададен"}`);
        console.log("\n");
        
        // ========================================
        // 3. ТВОЯТА ПОЗИЦИЯ
        // ========================================
        console.log("💼 ТВОЯТА ПОЗИЦИЯ:");
        console.log("─────────────────────────────────────");
        
        const yourBalance = await token.balanceOf(config.ADMIN_ADDRESS);
        console.log(`Баланс: ${ethers.formatEther(yourBalance)} токена`);
        
        const isOwner = owner.toLowerCase() === config.ADMIN_ADDRESS.toLowerCase();
        console.log(`Си Owner: ${isOwner ? "✅ ДА" : "❌ НЕ"}`);
        
        // Провери в кой exempt slot си
        let yourSlot = null;
        for (let i = 1; i <= 10; i++) {
            const slotAddress = await token[`eAddr${i}`]();
            if (slotAddress.toLowerCase() === config.ADMIN_ADDRESS.toLowerCase()) {
                yourSlot = i;
                break;
            }
        }
        console.log(`Exempt Slot: ${yourSlot ? `✅ Slot ${yourSlot}` : "❌ НЕ си в exempt slots"}`);
        console.log(`Имаш Admin права: ${yourSlot || isOwner ? "✅ ДА" : "❌ НЕ"}`);
        console.log("\n");
        
        // ========================================
        // 4. PAUSE & LOCK СТАТУС
        // ========================================
        console.log("🔒 PAUSE & LOCK СТАТУС:");
        console.log("─────────────────────────────────────");
        
        const pausedUntil = await token.NotExemptTradeTransferPausedUntil();
        const now = Math.floor(Date.now() / 1000);
        const isPaused = pausedUntil > now;
        
        if (isPaused) {
            const timeLeft = pausedUntil - now;
            const hoursLeft = Math.floor(timeLeft / 3600);
            console.log(`Trading: ⏸️  ПАУЗНАТО за още ${hoursLeft} часа`);
            console.log(`Пауза до: ${new Date(pausedUntil * 1000).toLocaleString()}`);
        } else {
            console.log(`Trading: ▶️  АКТИВНО`);
        }
        
        const exemptSlotsLocked = await token.exemptSlotsLocked();
        console.log(`Exempt Slots: ${exemptSlotsLocked ? "🔒 ЗАКЛЮЧЕНИ" : "🔓 Отключени"}`);
        
        const dexLocked = await token.dexAddressesLocked();
        console.log(`DEX Addresses: ${dexLocked ? "🔒 ЗАКЛЮЧЕНИ" : "🔓 Отключени"}`);
        
        const pairsLocked = await token.liquidityPairsLocked();
        console.log(`Liquidity Pairs: ${pairsLocked ? "🔒 ЗАКЛЮЧЕНИ" : "🔓 Отключени"}`);
        
        const cooldown = await token.mainAddressChangersCooldown();
        if (cooldown > now) {
            const cooldownLeft = cooldown - now;
            const hoursLeft = Math.floor(cooldownLeft / 3600);
            console.log(`Admin Cooldown: ⏰ Активен за още ${hoursLeft} часа`);
        } else {
            console.log(`Admin Cooldown: ✅ Неактивен`);
        }
        console.log("\n");
        
        // ========================================
        // 5. DEX ИНФОРМАЦИЯ
        // ========================================
        console.log("🔄 DEX ИНФОРМАЦИЯ:");
        console.log("─────────────────────────────────────");
        
        const router = await token.pncswpRouter();
        const factory = await token.pncswpFactory();
        
        console.log(`Router: ${router}`);
        console.log(`Factory: ${factory}`);
        
        // Опитай да намериш liquidity pair
        try {
            const factoryContract = await ethers.getContractAt(
                ["function getPair(address,address) view returns (address)"],
                factory
            );
            const wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // BSC Mainnet WBNB
            const pair = await factoryContract.getPair(config.TOKEN_ADDRESS, wbnb);
            
            if (pair === ethers.ZeroAddress) {
                console.log(`Liquidity Pair: ❌ Не е създаден`);
            } else {
                console.log(`Liquidity Pair: ${pair}`);
                const isLiquidityPair = await token.isLiquidityPair(pair);
                console.log(`Е exempt: ${isLiquidityPair ? "✅ ДА" : "❌ НЕ"}`);
            }
        } catch (error) {
            console.log(`Liquidity Pair: ⚠️  Не може да се провери`);
        }
        console.log("\n");
        
        // ========================================
        // 6. MINT PROPOSALS
        // ========================================
        console.log("🌱 MINT PROPOSALS:");
        console.log("─────────────────────────────────────");
        
        const proposalCount = await token.proposalCount();
        console.log(`Общо proposals: ${proposalCount}`);
        
        if (proposalCount > 0) {
            console.log("\nПоследните proposals:");
            for (let i = 0; i < Math.min(proposalCount, 5); i++) {
                const proposal = await token.mintProposals(i);
                const status = proposal.executed ? "✅ Изпълнен" : "⏳ Pending";
                console.log(`\nProposal ${i}:`);
                console.log(`  Amount: ${ethers.formatEther(proposal.amount)} токена`);
                console.log(`  Proposed: ${new Date(Number(proposal.proposedAt) * 1000).toLocaleString()}`);
                console.log(`  Execute after: ${new Date(Number(proposal.executeAfter) * 1000).toLocaleString()}`);
                console.log(`  Status: ${status}`);
            }
        } else {
            console.log("Няма mint proposals");
        }
        console.log("\n");
        
        // ========================================
        // 7. LAST MINT TIME
        // ========================================
        const lastMintTime = await token.lastMintTime();
        if (lastMintTime > 0) {
            console.log("⏰ ПОСЛЕДЕН MINT:");
            console.log("─────────────────────────────────────");
            console.log(`Дата: ${new Date(Number(lastMintTime) * 1000).toLocaleString()}`);
            
            const MINT_COOLDOWN = 7 * 24 * 60 * 60; // 1 седмица
            const nextMintTime = Number(lastMintTime) + MINT_COOLDOWN;
            if (nextMintTime > now) {
                const timeLeft = nextMintTime - now;
                const daysLeft = Math.floor(timeLeft / 86400);
                console.log(`Следващ mint възможен след: ${daysLeft} дни`);
            } else {
                console.log(`Следващ mint: ✅ Можеш да mint-неш веднага`);
            }
            console.log("\n");
        }
        
        // ========================================
        // РЕЗЮМЕ
        // ========================================
        console.log("========================================");
        console.log("✅ ПРОВЕРКАТА ЗАВЪРШИ УСПЕШНО");
        console.log("========================================");
        
    } catch (error) {
        console.error("\n❌ ГРЕШКА ПРИ ПРОВЕРКА:");
        console.error(error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
