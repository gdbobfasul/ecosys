// Version: 1.0086
/**
 * Admin Configuration File
 * Централизирани адреси за всички admin скриптове
 *
 * Адресите се зареждат от private/shared/js/addresses.js
 */

const ADDR = require("../../../shared/js/addresses");

module.exports = {
    // ============================================
    // MAIN ADDRESSES
    // ============================================

    // Deployed token contract address (попълни след deploy)
    TOKEN_ADDRESS: "0xadresnatokena",

    // Admin address (exempt slot) - Ledger bnb7
    ADMIN_ADDRESS: ADDR.LEDGER_HOLDERS.BNB7_ADMIN,

    // ============================================
    // NETWORK SPECIFIC ADDRESSES
    // ============================================

    // BSC Mainnet
    MAINNET: {
        PANCAKESWAP_ROUTER:  ADDR.MAINNET.ROUTER,
        PANCAKESWAP_FACTORY: ADDR.MAINNET.FACTORY,
        WBNB:                ADDR.MAINNET.WBNB
    },

    // BSC Testnet
    TESTNET: {
        PANCAKESWAP_ROUTER:  ADDR.TESTNET.ROUTER,
        PANCAKESWAP_FACTORY: ADDR.TESTNET.FACTORY,
        WBNB:                ADDR.TESTNET.WBNB
    },

    // ============================================
    // EXAMPLE ADDRESSES (за тестване)
    // ============================================

    EXAMPLE_ADDRESSES: {
        NEW_LEDGER_1: "0x1234567890123456789012345678901234567890",
        NEW_LEDGER_2: "0x2345678901234567890123456789012345678901",
        NEW_LEDGER_3: "0x3456789012345678901234567890123456789012",
        MULTI_SIG: "0xMultiSigContractAddress000000000000000000",
        SUSPICIOUS_ADDRESS: "0xSuspiciousAddress000000000000000000000000",
        BAD_ACTOR: "0xBadActorAddress00000000000000000000000000",
        LIQUIDITY_PAIR: "0xPairAddress0000000000000000000000000000000"
    }
};
