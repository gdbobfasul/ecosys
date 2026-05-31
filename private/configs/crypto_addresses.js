// Version: 1.0094
/**
 * ЦЕНТРАЛЕН ФАЙЛ С КРИПТО АДРЕСИ — единствено място за дефиниции на портфейли.
 * ============================================================================
 * Тук стоят ВСИЧКИ адреси на крипто портфейли, използвани в проекта, разпределени
 * по проекти. Всички приложения трябва да четат адресите ОТТУК, за да не се
 * дублират и да се поддържат на едно място.
 *
 * Хардуерни портфейли (източник на адресите):
 *   - Trezor  (2 адреса): bnbvis, bnbhdn
 *   - Tangem  (1 EVM адрес + Bitcoin): BnB/Eth (един EVM) + Btc
 *   - Ledger  (7 адреса): bnb1 .. bnb7   (bnb7 е admin за token admin скриптовете)
 *
 * ВАЖНО:
 *   - ETH и BNB на Tangem ползват ЕДИН И СЪЩ EVM адрес (0x58ec...).
 *   - BTC е на Bitcoin мрежата (отделен адрес bc1q...).
 *   - Тези адреси НЕ се сменят без изрично разрешение от собственика.
 *
 * Този файл е CommonJS (Node). За браузърни приложения експортът е и към window.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1) ИЗТОЧНИЦИ — суровите адреси по хардуерен портфейл (single source of truth)
// ─────────────────────────────────────────────────────────────────────────────
const TREZOR = {
    bnbvis: "0xB6CFeed7d42Aa6689faf0b9eB284f2737ac32053", // Trezor — bnbvis
    bnbhdn: "0xD2D7f9C7aFC2Ae8D4063bcb68E133E98fC2F824d"  // Trezor — bnbhdn
};

const TANGEM = {
    BnB: "0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A",    // Tangem — BNB (BEP20, EVM)
    Eth: "0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A",    // Tangem — ETH (същият EVM адрес)
    Btc: "bc1qe9drdtvqzat4k98w8lavsk3856zett8c7vw46u"     // Tangem — Bitcoin
};

const METAMASK = {
    creator: "0x567c1c5e9026E04078F9b92DcF295A58355f60c7" // MetaMask — създател на brch1 и други токени
};

const LEDGER = {
    bnb1: "0x35a57ac45952fd10d73f6b412368db9a6E4886e8", // Ledger — bnb1
    bnb2: "0x35e089F98a263CEDbC23f50946AF9A4fe06Ab083", // Ledger — bnb2
    bnb3: "0xb2FEBFb8705B2bD1F9B50bA6f0011C55073b5900", // Ledger — bnb3
    bnb4: "0x9FE5E19fff564775084b5561b0FE2A99184548C3", // Ledger — bnb4
    bnb5: "0x679ceE1e6f82890364FBdF3dcE2974ce19A41c1b", // Ledger — bnb5
    bnb6: "0x24787F86ddDA9D7C32AdD314b1F196b79C5ED247", // Ledger — bnb6
    bnb7: "0xE1B06c3886B08A5642D9eaD69e95a133e4cF39B9"  // Ledger — bnb7 (admin за token admin скриптове)
};

// ─────────────────────────────────────────────────────────────────────────────
// 2) РАЗПРЕДЕЛЕНИЕ ПО ПРОЕКТИ
// ─────────────────────────────────────────────────────────────────────────────
const PROJECTS = {

    // ── Чат: уеб страница + мобилно приложение ──
    // Приемат плащания към Tangem портфейла (BTC / ETH / BNB).
    chat: {
        wallets: {
            BTC: TANGEM.Btc,
            ETH: TANGEM.Eth,
            BNB: TANGEM.BnB
        },
        _source: "Tangem (BTC / ETH / BNB)"
    },

    // ── Портали (игри + услуги) — billing страницата ──
    // Месечната такса се превежда към Tangem портфейла (BTC / ETH / BNB).
    portals: {
        wallets: {
            BTC: TANGEM.Btc,
            ETH: TANGEM.Eth,
            BNB: TANGEM.BnB
        },
        _source: "Tangem (BTC / ETH / BNB)"
    },

    // ── Multisig (3-of-5 owners) ──
    // 1 Trezor + 1 Tangem + 3 Ledger
    multisig: {
        owners: [
            TREZOR.bnbvis, // 1) Trezor bnbvis
            TANGEM.BnB,    // 2) Tangem BnB
            LEDGER.bnb1,   // 3) Ledger bnb1
            LEDGER.bnb2,   // 4) Ledger bnb2
            LEDGER.bnb3    // 5) Ledger bnb3
        ],
        threshold: 3,
        _source: "1 Trezor (bnbvis) + 1 Tangem (BnB) + 3 Ledger (bnb1-3)"
    },

    // ── kcy-meme-1 токен ──
    // Холдъри: седемте Ledger + 2 Trezor + 1 Tangem.
    // СЪЗДАТЕЛ (deployer/creator) = Tangem (на първо място).
    kcy_meme_1: {
        creator: TANGEM.BnB, // създателят е Tangem
        holders: [
            TANGEM.BnB,    // Tangem (creator)
            TREZOR.bnbvis, // Trezor bnbvis
            TREZOR.bnbhdn, // Trezor bnbhdn
            LEDGER.bnb1,   // Ledger bnb1
            LEDGER.bnb2,   // Ledger bnb2
            LEDGER.bnb3,   // Ledger bnb3
            LEDGER.bnb4,   // Ledger bnb4
            LEDGER.bnb5,   // Ledger bnb5
            LEDGER.bnb6,   // Ledger bnb6
            LEDGER.bnb7    // Ledger bnb7
        ],
        _source: "7 Ledger + 2 Trezor + 1 Tangem (creator = Tangem)"
    },

    // ── brch1 токен ──
    // Създава се от MetaMask адрес (creator), после ще се ползва Tangem.
    brch1: {
        deployer_metamask: METAMASK.creator, // MetaMask — с този адрес се създава brch1 (и други токени)
        future_owner: TANGEM.BnB,            // Tangem — ще се ползва след създаването
        _note: "Създава се от MetaMask (0x567c...), после се ползва Tangem (0x58ec...). " +
               "От MetaMask адреса ще се създават и други токени."
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3) ЕКСПОРТ
// ─────────────────────────────────────────────────────────────────────────────
const CRYPTO_ADDRESSES = { TREZOR, TANGEM, LEDGER, METAMASK, PROJECTS };

// Node (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CRYPTO_ADDRESSES;
}
// Браузър (по желание, ако се зареди като <script>)
if (typeof window !== 'undefined') {
    window.CRYPTO_ADDRESSES = CRYPTO_ADDRESSES;
}
