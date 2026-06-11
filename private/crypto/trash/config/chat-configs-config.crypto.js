// КАРАНТИНА — изваден от private/chat/configs/config.js (нула крипто в чата).
// Не се зарежда от нищо. Backend-ът ползва configs/stripe-config за плащания.
// Запазено „за всеки случай".

const CRYPTO_CONFIG = {
  // Treasury wallets (where users send payments) - план addresses1.txt, от tangem
  TREASURY_WALLETS: {
    BTC: 'bc1qe9drdtvqzat4k98w8lavsk3856zett8c7vw46u',
    ETH: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A',
    BNB: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A',
    KCY_MEME: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A',
    KCY_AMS: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A'
  },

  // Token contract addresses (for BSC tokens)
  TOKEN_ADDRESSES: {
    KCY_MEME: '0xYOUR_KCY_MEME_TOKEN_CONTRACT',
    KCY_AMS: '0xYOUR_KCY_AMS_TOKEN_CONTRACT'
  },

  // EXACT payment amounts (NO summing, NO partial payments)
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

  // Blockchain explorers
  EXPLORERS: {
    BTC: 'https://blockchain.info',
    ETH: 'https://api.etherscan.io/api',
    BNB: 'https://api.bscscan.com/api'
  },

  // API Keys
  API_KEYS: {
    ETHERSCAN: 'YOUR_FREE_API_KEY',
    BSCSCAN: 'YOUR_FREE_API_KEY'
  },

  // Network settings
  NETWORK: {
    CHAIN_ID: '0x38',
    CHAIN_NAME: 'BSC Mainnet',
    RPC_URL: 'https://bsc-dataseed.binance.org/'
  },

  // Payment rules
  RULES: {
    EXACT_AMOUNTS_ONLY: true,
    NO_PARTIAL_PAYMENTS: true,
    NO_REFUNDS_UNDER: 50,
    SUBSCRIPTION_DAYS: 30,
    PAYMENT_LOOKBACK_DAYS: 30
  }
};
