// Version: 1.0056
// ============================================
// 🌐 GLOBAL CONFIGURATION - MOBILE VERSION
// ============================================

// ============================================
// 🪙 CRYPTO CONFIGURATION
// ============================================
export const CRYPTO_CONFIG = {
  // Treasury wallets
  TREASURY_WALLETS: {
    BTC: 'bc1q...your_btc_address',
    ETH: '0x...your_eth_address',
    BNB: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A',
    KCY_MEME: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A',
    KCY_AMS: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A'
  },
  
  // Token contracts
  TOKEN_ADDRESSES: {
    KCY_MEME: '0xYOUR_KCY_MEME_TOKEN_CONTRACT',
    KCY_AMS: '0xYOUR_KCY_AMS_TOKEN_CONTRACT'
  },
  
  // Pricing
  PRICING: {
    LOGIN: {
      USD: 5,
      EUR: 5,
      BTC: 0.0001,
      ETH: 0.002,
      BNB: 0.01,
      KCY_MEME: 1000,
      KCY_AMS: 500
    },
    EMERGENCY: {
      USD: 50,
      EUR: 50,
      BTC: 0.001,
      ETH: 0.02,
      BNB: 0.1,
      KCY_MEME: 10000,
      KCY_AMS: 5000
    }
  },
  
  // Network
  NETWORK: {
    CHAIN_ID: '0x38',
    CHAIN_NAME: 'BSC Mainnet',
    RPC_URL: 'https://bsc-dataseed.binance.org/'
  },
  
  // Rules
  RULES: {
    EXACT_AMOUNTS_ONLY: true,
    NO_PARTIAL_PAYMENTS: true,
    NO_REFUNDS_UNDER: 50,
    SUBSCRIPTION_DAYS: 30,
    PAYMENT_LOOKBACK_DAYS: 30
  }
};

// ============================================
// 📊 APP CONFIGURATION
// ============================================
export const APP_CONFIG = {
  MIN_AGE: 18,
  MAX_FILE_SIZE: 52428800, // 50MB
  FREE_MESSAGE_LIMIT: 10,
  SESSION_HOURS: 24,
  AUTO_LOGOUT_UTC: '04:00'
};
