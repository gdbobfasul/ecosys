// Version: 1.0093
/**
 * KCY Ecosystem - Централна Конфигурация
 *
 * ⚙️ Домейнът се взима ДИНАМИЧНО от текущия адрес — нищо не се хардкодва тук.
 */

// Android package ID — изведен от домейна (обратна нотация) + ".chat",
// както BASE_URL идва от origin. Нула хардкоднат идентификатор.
// take.offbitch.com → com.offbitch.take.chat
function kcyAndroidPackageId() {
    var host = (typeof window !== 'undefined' && window.location && window.location.hostname)
        ? window.location.hostname : '';
    if (!host) return '';
    return host.split('.').reverse().join('.') + '.chat';
}

const KCY_CONFIG = {
    // 🌐 BASE URL — ДИНАМИЧЕН: = домейнът, на който се отваря страницата.
    // Така всеки домейн сочи към СЕБЕ СИ (бекендите са proxy-нати на същия хост)
    // — нула хардкоднат домейн.
    BASE_URL: (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : "",
    
    // Blockchain Network Configuration
    network: {
        mainnet: {
            chainId: 56,
            name: "BSC Mainnet",
            rpc: "https://bsc-dataseed.binance.org/",
            explorer: "https://bscscan.com"
        },
        testnet: {
            chainId: 97,
            name: "BSC Testnet",
            rpc: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            explorer: "https://testnet.bscscan.com"
        }
    },
    
    // Contract Addresses (ОБНОВИ СЛЕД DEPLOY)
    contracts: {
        token: "0xadresnatokena",
        multisig: "0xmultisigaddress",
        brch1: "",
        brch1Pair: ""
    },
    
    // Project URLs (Относителни пътища)
    urls: {
        base: "/",
        token: "/crypto/token/",
        tokenAdmin: "/crypto/token/admin/scripts.html",
        brch1: "/crypto/brch1/",
        brch1Admin: "/crypto/brch1/admin/",
        multisig: "/crypto/multisig/",
        multisigAdmin: "/crypto/multisig/admin/",
        chat: "/chat/",
        chatDownload: "/chat/download/",
        chatAdmin: "/chat/admin/",
        eco3: "/eco-3/",
        eco3Admin: "/eco-3/admin/"
    },
    
    // 📱 Mobile App Download Links
    // ОБНОВИ ТЕЗИ ЛИНКОВЕ СЛЕД КАЧВАНЕ В APP STORES!
    mobileApp: {
        android: {
            playStore: "https://play.google.com/store/apps/details?id=" + kcyAndroidPackageId(),
            apkDirect: "/downloads/ams-chat.apk",
            fdroid: null,
            galaxyStore: null
        },
        ios: {
            appStore: "https://apps.apple.com/app/ams-chat/idXXXXXXXXX",
            testFlight: null
        },
        other: {
            huaweiAppGallery: null,
            amazonAppStore: null
        }
    },
    
    api: {
        token: "/api/token/",
        multisig: "/api/multisig/",
        chat: "/api/",
        eco3: "/api/eco3/"
    },
    
    social: {
        twitter: "https://twitter.com/kcy_ecosystem",
        telegram: "https://t.me/kcy_ecosystem",
        discord: "https://discord.gg/kcy",
        github: "https://github.com/kcy-ecosystem"
    },
    
    getNetworkConfig: function(isMainnet = true) {
        return isMainnet ? this.network.mainnet : this.network.testnet;
    },
    
    getContractAddress: function(contract) {
        return this.contracts[contract] || null;
    },
    
    getProjectUrl: function(project) {
        return this.urls[project] || '/';
    },
    
    getFullUrl: function(path) {
        return this.BASE_URL + path;
    },
    
    getAppLinks: function() {
        return {
            android: Object.entries(this.mobileApp.android)
                .filter(([_, url]) => url !== null)
                .reduce((acc, [key, url]) => ({ ...acc, [key]: url }), {}),
            ios: Object.entries(this.mobileApp.ios)
                .filter(([_, url]) => url !== null)
                .reduce((acc, [key, url]) => ({ ...acc, [key]: url }), {})
        };
    }
};

// Add aliases for backward compatibility with tests
const CRYPTO_CONFIG = {
    // ─── Адреси на портфейла на собственика (Tangem) — за крипто плащания на billing страницата ───
    // Това са РЕАЛНИТЕ адреси на собственика от Tangem. Към тях клиентите превеждат месечната такса.
    // ETH и BNB ползват един и същ EVM адрес (Tangem). BTC е на Bitcoin мрежата.
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
    PRICING: { 
        USD_PRICE: 9.99,
        BTC_CONFIRMATIONS: 6,
        ETH_CONFIRMATIONS: 12,
        LOGIN: {
            USD: 5,
            EUR: 5
        },
        EMERGENCY: {
            USD: 50,
            EUR: 50
        },
        ECO3: {
            BASIC: { USD: 2.99, EUR: 2.99 },
            STANDARD: { USD: 4.99, EUR: 4.99 },
            PREMIUM: { USD: 9.99, EUR: 9.99 },
            PER_MINUTE: { USD: 0.15, EUR: 0.15 }
        }
    }
};

const APP_CONFIG = {
    MIN_AGE: 18,
    MAX_FILE_SIZE: 52428800, // 50MB
    FREE_MESSAGE_LIMIT: 10
};

if (typeof window !== 'undefined') {
    window.KCY_CONFIG = KCY_CONFIG;
    window.CRYPTO_CONFIG = CRYPTO_CONFIG;
    window.APP_CONFIG = APP_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ...KCY_CONFIG,
        CRYPTO_CONFIG,
        APP_CONFIG
    };
}
