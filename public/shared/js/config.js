// Version: 1.0056
/**
 * KCY Ecosystem - Централна Конфигурация
 * 
 * ⚙️ ВАЖНО: Промени BASE_URL ако сменяш домейна!
 */

const KCY_CONFIG = {
    // 🌐 BASE URL - ПРОМЕНИ САМО ТУК АКО СМЕНЯШ ДОМЕЙНА!
    BASE_URL: "https://alsec.strangled.net",
    
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
        multisig: "0xmultisigaddress"
    },
    
    // Project URLs (Относителни пътища)
    urls: {
        base: "/",
        token: "/token/",
        tokenAdmin: "/token/admin/scripts.html",
        multisig: "/multisig/",
        multisigAdmin: "/multisig/admin/",
        chat: "/chat/",
        chatDownload: "/chat/download/",
        chatAdmin: "/chat/admin/"
    },
    
    // 📱 Mobile App Download Links
    // ОБНОВИ ТЕЗИ ЛИНКОВЕ СЛЕД КАЧВАНЕ В APP STORES!
    mobileApp: {
        android: {
            playStore: "https://play.google.com/store/apps/details?id=net.strangled.alsec.chat",
            apkDirect: "https://alsec.strangled.net/downloads/ams-chat.apk",
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
        chat: "/api/chat/"
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

if (typeof window !== 'undefined') {
    window.KCY_CONFIG = KCY_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KCY_CONFIG;
}
