// КАРАНТИНА — изваден КРИПТО-ПОРТФЕЙЛЕН блок от public/shared/js/config.js.
// Фиат цените (LOGIN/EMERGENCY/ECO3 в USD/EUR) НЕ са крипто и ОСТАНАХА в оригинала
// под ново име PRICING_CONFIG. Тук е само крипто частта (адреси/потвърждения). Запазено „за всеки случай".

const CRYPTO_WALLETS = {
  // ─── Адреси на портфейла на собственика (Tangem) — за крипто плащания на billing страницата ───
  TANGEM_WALLETS: {
    BTC: "bc1qe9drdtvqzat4k98w8lavsk3856zett8c7vw46u",        // Tangem — Bitcoin
    ETH: "0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A",        // Tangem — Ethereum (EVM)
    BNB: "0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A"         // Tangem — BNB (BEP20, същият EVM адрес)
  },
  TREASURY_WALLETS: {
    BTC: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    ETH: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    BNB: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    USDT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
  },
  CONFIRMATIONS: {
    BTC_CONFIRMATIONS: 6,
    ETH_CONFIRMATIONS: 12
  }
};
