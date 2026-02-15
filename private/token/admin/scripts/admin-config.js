// Version: 1.0056
/**
 * Admin Configuration File
 * Централизирани адреси за всички admin скриптове
 */

module.exports = {
    // ============================================
    // MAIN ADDRESSES
    // ============================================
    
    // Deployed token contract address
    TOKEN_ADDRESS: "0xadresnatokena",
    
    // Admin address (exempt slot)
    ADMIN_ADDRESS: "0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9",
    
    // ============================================
    // NETWORK SPECIFIC ADDRESSES
    // ============================================
    
    // BSC Mainnet
    MAINNET: {
        PANCAKESWAP_ROUTER: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        PANCAKESWAP_FACTORY: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
        WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
    },
    
    // BSC Testnet
    TESTNET: {
        PANCAKESWAP_ROUTER: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
        PANCAKESWAP_FACTORY: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
        WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"
    },
    
    // ============================================
    // EXAMPLE ADDRESSES (за тестване)
    // ============================================
    
    EXAMPLE_ADDRESSES: {
        // Нови Ledger адреси за exempt slots
        NEW_LEDGER_1: "0x1234567890123456789012345678901234567890",
        NEW_LEDGER_2: "0x2345678901234567890123456789012345678901",
        NEW_LEDGER_3: "0x3456789012345678901234567890123456789012",
        
        // Multi-Sig адрес (примерен)
        MULTI_SIG: "0xMultiSigContractAddress000000000000000000",
        
        // Blacklist примери
        SUSPICIOUS_ADDRESS: "0xSuspiciousAddress000000000000000000000000",
        BAD_ACTOR: "0xBadActorAddress00000000000000000000000000",
        
        // Liquidity pair (примерен, ще се създаде от PancakeSwap)
        LIQUIDITY_PAIR: "0xPairAddress0000000000000000000000000000000"
    }
};
