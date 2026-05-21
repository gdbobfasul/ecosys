// KCY Portals — Portal Services routes (НОВ файл — не пипа services.js)
// Version: 1.0093
// 7 услуги БЕЗ изкуствен интелект. Повечето работят изцяло в браузъра.
// Само "crypto" има нужда от backend — за валутните курсове.

const express = require('express');
const https = require('https');
const { requirePortalAccessAPI } = require('../middleware/access-control');

let debug;
try { debug = require('../../shared/debug-helper').create('portals'); }
catch (e) { debug = { scoped: () => () => {} }; }

const router = express.Router();

const PORTAL_SERVICES = [
    { slug: 'qr',       title: 'QR код',              icon: 'QR',   file: '/portals/services/qr.html',       description: 'Генерирай QR код от текст/URL ИЛИ разчети съществуващ QR — показва текста/линка.' },
    { slug: 'crypto',   title: 'Валутен конвертор',   icon: 'CUR',  file: '/portals/services/crypto.html',   description: 'Криптовалути и валути в долари — курсове по данни на CoinGecko.' },
    { slug: 'image',    title: 'Компресор на снимки', icon: 'IMG',  file: '/portals/services/image.html',    description: 'Намали размера на JPEG / PNG / WebP изображения.' },
    { slug: 'pdf',      title: 'PDF инструменти',     icon: 'PDF',  file: '/portals/services/pdf.html',      description: 'Сливане, разделяне и воден знак на PDF файлове.' },
    { slug: 'password', title: 'Генератор на пароли', icon: 'KEY',  file: '/portals/services/password.html', description: 'Силни пароли — няколко метода на генериране.' },
    { slug: 'calc',     title: 'Калкулатори',         icon: 'CALC', file: '/portals/services/calc.html',     description: 'Заем, лихва, ДДС, проценти — по държава.' },
    { slug: 'text',     title: 'Текстови инструменти', icon: 'TXT', file: '/portals/services/text.html',     description: 'Брояч на думи, форматиране, Base64.' },
];

// GET /api/portal-services/list — списък на услугите
router.get('/list', requirePortalAccessAPI, (req, res) => {
    const log = debug.scoped(req, 'portal-services/list');
    log('старт');
    res.json({ services: PORTAL_SERVICES });
    log('изход 1 -> 200 OK (' + PORTAL_SERVICES.length + ' услуги)');
});

// ── Курсове — CoinGecko (безплатно, без API ключ). Кеш 60 сек. ──
let ratesCache = { data: null, ts: 0 };

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'KCY-Portals' } }, (r) => {
            let body = '';
            r.on('data', (c) => { body += c; });
            r.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(new Error('invalid_json')); }
            });
        }).on('error', reject);
    });
}

// GET /api/portal-services/rates — крипто (USD) + фиат курсове
router.get('/rates', requirePortalAccessAPI, async (req, res) => {
    const log = debug.scoped(req, 'portal-services/rates');
    log('старт');
    const now = Date.now();
    if (ratesCache.data && (now - ratesCache.ts) < 60000) {
        log('изход 1 -> 200 OK (от кеш)');
        return res.json(Object.assign({}, ratesCache.data, { cached: true }));
    }
    try {
        // ~30 топ криптовалути по пазарна капитализация, цена в USD
        log('1 - заявка към CoinGecko (markets)');
        const markets = await fetchJSON(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1'
        );
        // фиатни валути спрямо USD
        log('2 - заявка към CoinGecko (фиат)');
        const fiat = await fetchJSON(
            'https://open.er-api.com/v6/latest/USD'
        );
        const crypto = (Array.isArray(markets) ? markets : []).map(function (c) {
            return { id: c.id, symbol: (c.symbol || '').toUpperCase(), name: c.name, usd: c.current_price };
        });
        const data = {
            updated: new Date().toISOString(),
            source: 'CoinGecko (крипто) + ER-API (фиат)',
            crypto: crypto,
            fiat: (fiat && fiat.rates) ? fiat.rates : {},
        };
        ratesCache = { data: data, ts: now };
        log('изход 2 -> 200 OK (свежи курсове, ' + crypto.length + ' крипто)');
        res.json(Object.assign({}, data, { cached: false }));
    } catch (err) {
        log('изход 3 -> 500 ' + err.message);
        res.status(500).json({ error: 'rates_failed', message: err.message });
    }
});

module.exports = router;
