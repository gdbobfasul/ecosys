// KCY Portals — Portal Services routes (НОВ файл — не пипа services.js)
// Version: 1.0156
// 7 услуги БЕЗ изкуствен интелект. Повечето работят изцяло в браузъра.
// Само "crypto" има нужда от backend — за валутните курсове.

const express = require('express');
const https = require('https');
const { requirePortalAccessAPI, requireLoginAPI } = require('../middleware/access-control');

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
    { slug: 'pdf-compress', title: 'Свиване на PDF',   icon: 'ZIP',  file: '/portals/services/pdf-compress.html', description: 'Намали размера на голям PDF (сканирани страници, големи снимки).' },
    { slug: 'charts',   title: 'Финансови графики',   icon: 'CHRT', file: '/portals/services/charts.html',   description: 'BTC RSI, Fibonacci, liquidation heatmap, S&P 500, индекси, BTC/ETH по периоди.' },
    { slug: 'watch20',  title: 'Наблюдавай 20 валути', icon: 'WTCH', file: '/portals/services/watch20.html',  description: '20 валути/крипто спрямо USD/USDC, прагове с известие и звук.' },
    { slug: 'ai-listing', title: 'AI обява за имот', icon: 'AI', file: '/portals/services/ai-listing.html', description: 'Генерирай обява за продажба на имот по няколко ключови думи чрез Claude AI (включено в месечния абонамент).' },
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
        // Външен API (CoinGecko/ER-API) може да лимитира/падне. Не чупим с 500 —
        // връщаме последните успешни курсове (остарели), а ако няма кеш → празно с 200.
        log('изход 3 -> външен срив: ' + err.message);
        if (ratesCache.data) {
            return res.json(Object.assign({}, ratesCache.data, { cached: true, stale: true }));
        }
        res.json({ updated: new Date().toISOString(), source: 'недостъпен', crypto: [], fiat: {}, degraded: true, message: err.message });
    }
});

// ── CoinMarketCap ранг (ТОЧНИТЕ номера от CMC). Кеш 15 мин. ──
// Ключ: process.env.CMC_API_KEY (Basic план — безплатно). БЕЗ ключ → връща празно
// (watch20 не показва бадж, вместо да лъже с друг източник).
let cmcCache = { map: null, ts: 0 };
function fetchCMC(apiKey) {
    return new Promise((resolve, reject) => {
        const opts = {
            host: 'pro-api.coinmarketcap.com',
            path: '/v1/cryptocurrency/listings/latest?limit=300&sort=market_cap',
            headers: { 'X-CMC_PRO_API_KEY': apiKey, 'Accept': 'application/json', 'User-Agent': 'KCY-Portals' },
        };
        https.get(opts, (r) => {
            let body = '';
            r.on('data', (c) => { body += c; });
            r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('invalid_json')); } });
        }).on('error', reject);
    });
}

// GET /api/portals/svc/crypto-ranks → { ranks: { BTC:1, ETH:2, ... }, source }
// Точните номера от CoinMarketCap (символ → cmc_rank). Нужен е CMC_API_KEY в .env.
router.get('/crypto-ranks', requireLoginAPI, async (req, res) => {
    const log = debug.scoped(req, 'portal-services/crypto-ranks');
    const key = process.env.CMC_API_KEY;
    if (!key) { log('няма CMC_API_KEY'); return res.json({ ranks: {}, source: 'none', message: 'CMC_API_KEY липсва в .env' }); }
    const now = Date.now();
    if (cmcCache.map && (now - cmcCache.ts) < 900000) {
        return res.json({ ranks: cmcCache.map, source: 'CoinMarketCap', cached: true });
    }
    try {
        const j = await fetchCMC(key);
        const list = (j && Array.isArray(j.data)) ? j.data : [];
        const ranks = {};
        list.forEach((c) => { const s = (c.symbol || '').toUpperCase(); if (s && c.cmc_rank && ranks[s] == null) ranks[s] = c.cmc_rank; });
        cmcCache = { map: ranks, ts: now };
        log('CMC ранг ок (' + Object.keys(ranks).length + ' символа)');
        res.json({ ranks: ranks, source: 'CoinMarketCap', cached: false });
    } catch (err) {
        log('CMC грешка: ' + err.message);
        res.status(502).json({ ranks: {}, source: 'CoinMarketCap', error: err.message });
    }
});

// ═══════════════════════════════════════════
// watch20 — потребителски предпочитания (20 слота + ценови прагове)
// Пазят се per акаунт (req.session.userId), не в браузъра. Две таблици:
// portal_watch_slots (избрана валута) + portal_watch_alerts (прагове).
// ═══════════════════════════════════════════
const WATCH_MAX_SLOTS = 20;
const WATCH_MAX_ALERTS = 20;

// GET /api/portals/svc/watch20/prefs — върни 20-те слота + техните прагове
// requireLoginAPI (НЕ requirePortalAccessAPI): тук трябва само ЛОГИН — без плащане
// и БЕЗ IP-whitelist bypass (иначе admin по IP минава без сесия → user_id празно).
router.get('/watch20/prefs', requireLoginAPI, (req, res) => {
    const log = debug.scoped(req, 'watch20/prefs GET');
    const db = req.app.locals.db;
    const userId = req.session.userId;
    log(`старт (user#${userId})`);

    const slotRows = db.prepare(
        "SELECT slot_index, sel FROM portal_watch_slots WHERE user_id = ? ORDER BY slot_index"
    ).all(userId);
    const alertRows = db.prepare(
        "SELECT slot_index, threshold FROM portal_watch_alerts WHERE user_id = ? ORDER BY slot_index, id"
    ).all(userId);

    const slots = [];
    for (let i = 0; i < WATCH_MAX_SLOTS; i++) {
        const row = slotRows.find((r) => r.slot_index === i);
        const alerts = alertRows.filter((a) => a.slot_index === i).map((a) => a.threshold);
        slots.push({ slot_index: i, sel: row ? row.sel : null, alerts });
    }
    res.json({ slots });
    log('изход 1 -> 200 OK');
});

// POST /api/portals/svc/watch20/prefs — замени ВСИЧКИ слотове + прагове на потребителя
// body: { slots: [ { sel: "FIAT:USD"|null, alerts: [число, …] }, … ] }
// requireLoginAPI: само логин (без плащане / без IP bypass) — нужен е валиден user_id.
router.post('/watch20/prefs', requireLoginAPI, (req, res) => {
    const log = debug.scoped(req, 'watch20/prefs POST');
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const incoming = (req.body && Array.isArray(req.body.slots)) ? req.body.slots : null;
    if (!incoming) {
        log('изход 1 -> 400 (липсва slots[])');
        return res.status(400).json({ error: 'bad_request', message: 'slots[] е задължителен' });
    }

    const delSlots = db.prepare("DELETE FROM portal_watch_slots WHERE user_id = ?");
    const delAlerts = db.prepare("DELETE FROM portal_watch_alerts WHERE user_id = ?");
    const insSlot = db.prepare("INSERT INTO portal_watch_slots (user_id, slot_index, sel) VALUES (?, ?, ?)");
    const insAlert = db.prepare("INSERT INTO portal_watch_alerts (user_id, slot_index, threshold) VALUES (?, ?, ?)");

    const save = db.transaction((rows) => {
        delSlots.run(userId);
        delAlerts.run(userId);
        const n = Math.min(rows.length, WATCH_MAX_SLOTS);
        for (let i = 0; i < n; i++) {
            const s = rows[i] || {};
            const sel = (typeof s.sel === 'string' && s.sel) ? s.sel : null;
            insSlot.run(userId, i, sel);
            const alerts = Array.isArray(s.alerts) ? s.alerts.slice(0, WATCH_MAX_ALERTS) : [];
            for (const a of alerts) {
                const val = Number(a);
                if (Number.isFinite(val)) insAlert.run(userId, i, val);
            }
        }
        return n;
    });

    try {
        const n = save(incoming);
        log(`изход 2 -> 200 OK (запазени ${n} слота)`);
        res.json({ ok: true });
    } catch (err) {
        log('изход 3 -> 500 ' + err.message);
        res.status(500).json({ error: 'save_failed', message: err.message });
    }
});

module.exports = router;
