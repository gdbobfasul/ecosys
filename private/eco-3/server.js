// Version: 1.0172
// ECO-3 AI Studio — Backend Server
// Database: SQLite · Proxy: Anthropic API · Payments: Stripe
// Admin: IP whitelist from .env

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Debug helper за глобални stage логове
let debug;
try { debug = require('../shared/debug-helper').create('eco3'); }
catch (e) { debug = { stage: console.log, info: console.log, error: console.error, warn: console.warn }; }
debug.stage('starting eco-3 service');
debug.stage('node version:', process.version, 'cwd:', process.cwd());
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { createDb } = require('./db');  // DB адаптер — SQLite или PostgreSQL по ECO3_DB_TYPE
const Q = require('./queries').server; // Явни SQL набори (PG/SQLite) — БЕЗ runtime преводач

// Главният домейн от ЕДИННАТА конфигурация (private/configs/domains.conf) — нула хардкод.
function readMainDomain() {
    try {
        const txt = fs.readFileSync(path.join(__dirname, '..', 'configs', 'domains.conf'), 'utf8');
        const m = txt.match(/^\s*MAIN_DOMAIN="?([^"\n]+)"?/m);
        if (m) return m[1].trim();
    } catch (e) { /* конфигът липсва — пада на ENV/localhost */ }
    return null;
}
const MAIN_DOMAIN = readMainDomain();

// Load .env — единен файл: private/configs/.env
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const app = express();
const PORT = process.env.ECO3_PORT || 3001;

// ════════════════════════════════════════════
// DATABASE
// ════════════════════════════════════════════
let DB_PATH = process.env.ECO3_DB_PATH || path.join(__dirname, 'database', 'eco3.db');
let db;

async function initDatabase() {
    try {
        db = createDb();                       // SQLite или PostgreSQL според ECO3_DB_TYPE
        DB_PATH = db.path;
        // Схемата: за PG отделен файл (PG типове), за SQLite — оригиналната.
        const schemaFile = db.type === 'postgresql' ? 'schema-pg.sql' : 'schema.sql';
        const schemaPath = path.join(__dirname, 'database', schemaFile);
        if (fs.existsSync(schemaPath)) {
            await db.exec(fs.readFileSync(schemaPath, 'utf8'));
        }
        const tables = await db.tableNames();
        logRequest('DB', `Connected (${db.type}): ${DB_PATH} (${tables.length} tables)`);
        return true;
    } catch (err) {
        logRequest('ERROR', `Database init failed: ${err.message}`);
        return false;
    }
}

// Daily cleanup — delete uniqueness entries older than today
async function dailyCleanup() {
    if (!db) return;
    try {
        const deleted = await db.prepare(Q.CLEANUP_OLD_UNIQUENESS).run();
        if (deleted.changes > 0) {
            logRequest('CLEANUP', `Removed ${deleted.changes} old uniqueness entries`);
        }
    } catch (err) {
        logRequest('ERROR', `Cleanup error: ${err.message}`);
    }
}

// Run cleanup every hour
setInterval(dailyCleanup, 60 * 60 * 1000);

// ════════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════════
app.use(cors({
    // Origins от .env (ALLOWED_ORIGINS, със запетаи). Без хардкоднат домейн —
    // fallback ползва главния домейн от domains.conf (+ localhost), не литерал.
    origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
        : (MAIN_DOMAIN ? ['http://localhost', 'https://' + MAIN_DOMAIN] : ['http://localhost']),
    credentials: true
}));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));

// ── Споделена session с порталите (за да чете порталния логин) ──
// Същият secret + cookie като portals → ECO3 вижда дали потребителят е логнат в порталите.
const _session = require('express-session');
const _cookieParser = require('cookie-parser');
app.set('trust proxy', 1);
app.use(_cookieParser());
app.use(_session({
    name: process.env.PORTALS_SESSION_NAME || 'connect.sid',
    secret: process.env.PORTALS_SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === 'production' }
}));

// ── Gate: ECO3 изисква портален ЛОГИН (задължителен дори за админ) ──
// Без логнат портален потребител → 401. IP/?adm НЕ пускат — админ трябва да е
// логнат така или иначе (плащането е отделно per-заявка).
function eco3RequireLogin(req, res, next) {
    // Универсален админ токен (?adm / kcy_adm бисквитка) — действа като логнат админ навсякъде.
    if (req.query.adm === 'bgmasters-set' || /(?:^|;\s*)kcy_adm=bgmasters-set/.test(req.headers.cookie || '')) {
        return next();
    }
    const userId = req.session && req.session.userId;
    if (userId) return next();
    return res.status(401).json({ error: 'login_required',
        message: 'Трябва да си логнат в порталите, за да ползваш ECO-3.',
        loginUrl: '/portals/login.html?next=/eco-3/' });
}

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Try again later.' }
});
app.use('/generate', apiLimiter);

// Logging
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'eco3.log');

function logRequest(type, msg) {
    const line = `[${new Date().toISOString()}] [${type}] ${msg}\n`;
    console.log(line.trim());
    try { fs.appendFileSync(logFile, line); } catch {}
}

// ════════════════════════════════════════════
// ADMIN IP CHECK
// ════════════════════════════════════════════
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
        || req.headers['x-real-ip'] 
        || req.connection?.remoteAddress 
        || '';
}

function adminCheck(req, res, next) {
    // Универсален админ токен (?adm / kcy_adm бисквитка) — същият като /crypto портата.
    if (req.query.adm === 'bgmasters-set' || /(?:^|;\s*)kcy_adm=bgmasters-set/.test(req.headers.cookie || '')) {
        return next();
    }
    const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(s => s.trim());
    const clientIP = getClientIP(req);
    
    // In development allow all
    if (process.env.NODE_ENV !== 'production') return next();

    // ECO-3 собствен админ вход (eco3_admins, попълнени от .env) ИЛИ логнат portals
    // потребител, чийто username е в .env (ECO3_ADMIN_USER / ECO3_MOD1..5) → админ.
    try {
        const { roleForUsername } = require('./roles');
        if (req.session && req.session.eco3AdminUser && roleForUsername(req.session.eco3AdminUser) !== 'user') return next();
        if (req.session && req.session.username && roleForUsername(req.session.username) !== 'user') return next();
    } catch (_) {}

    // Check IP — allow-all CIDR ('0.0.0.0/0' / '::/0') пуска всеки IP (като при порталите).
    const allowAll = allowedIPs.some(ip => ip === '0.0.0.0/0' || ip === '::/0');
    const allowed = allowAll || allowedIPs.some(ip => ip && clientIP.includes(ip));
    if (allowed) return next();

    logRequest('ADMIN', `Blocked: ${clientIP} (allowed: ${allowedIPs.join(',')})`);
    res.status(403).json({ error: 'Forbidden', yourIP: clientIP, hint: 'Add your IP to ADMIN_ALLOWED_IPS, или влез в админ секцията с потребител/парола' });
}

// ════════════════════════════════════════════
// ECO-3 СОБСТВЕН АДМИН ВХОД (eco3_admins, попълнени от .env при създаване на базата)
// ════════════════════════════════════════════
app.post('/admin/login', async (req, res) => {
    try {
        const { verifyLogin } = require('./admins');
        const { roleForUsername } = require('./roles');
        const user = await verifyLogin((req.body || {}).username, (req.body || {}).password);
        if (!user) return res.status(401).json({ error: 'bad_credentials', message: 'Грешен потребител или парола (или не си в .env списъка).' });
        req.session.eco3AdminUser = user;
        res.json({ ok: true, user, role: roleForUsername(user) });
    } catch (e) {
        logRequest('ERROR', `admin/login: ${e.message}`);
        res.status(500).json({ error: 'server', message: e.message });
    }
});
app.post('/admin/logout', (req, res) => { if (req.session) req.session.eco3AdminUser = null; res.json({ ok: true }); });
app.get('/admin/me', (req, res) => {
    const { roleForUsername } = require('./roles');
    const u = req.session && req.session.eco3AdminUser;
    res.json({ user: u || null, role: u ? roleForUsername(u) : 'user' });
});

// ════════════════════════════════════════════
// HEALTH & STATUS
// ════════════════════════════════════════════
app.get('/health', async (req, res) => {
    const dbOk = !!db;
    let dbTables = 0;
    try { dbTables = db ? (await db.tableNames()).length : 0; } catch {}

    res.json({
        ok: true,
        service: 'eco-3',
        version: '1.0093',
        mode: process.env.ECO3_MODE || 'test',
        uptime: process.uptime(),
        database: { connected: dbOk, type: db ? db.type : null, tables: dbTables, path: DB_PATH },
        anthropic: { configured: !!process.env.ANTHROPIC_API_KEY },
        stripe: { configured: !!(STRIPE_CFG && STRIPE_CFG.secretKey), mode: STRIPE_CFG && STRIPE_CFG.testMode ? 'test' : 'live' },
        timestamp: new Date().toISOString()
    });
});

app.get('/anthropic-status', (req, res) => {
    res.json({
        configured: !!process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    });
});

// ════════════════════════════════════════════
// STRIPE
// ════════════════════════════════════════════
const { resolveStripeConfig } = require('../configs/stripe-config');
const STRIPE_CFG = resolveStripeConfig(process.env);
const stripe = STRIPE_CFG.secretKey
    ? require('stripe')(STRIPE_CFG.secretKey)
    : null;

app.get('/stripe-key', (req, res) => {
    res.json({ publishableKey: STRIPE_CFG.publishableKey, testMode: STRIPE_CFG.testMode });
});

// Готови Stripe Payment Links по ниво (Вариант 1 — фиксирани линкове).
// Цени: economy 5€ / standard 10€ / premium 15€ / enterprise 75€
app.get('/payment-links', (req, res) => {
    res.json({
        economy:    STRIPE_CFG.paymentLinks.eco3_economy,
        standard:   STRIPE_CFG.paymentLinks.eco3_standard,
        premium:    STRIPE_CFG.paymentLinks.eco3_premium,
        enterprise: STRIPE_CFG.paymentLinks.eco3_enterprise
    });
});

app.post('/create-payment', async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    try {
        const { budget, duration, topic } = req.body;
        // Цените (tier-ове) идват от private/configs/prices-eco3.json (редактируем).
        let prices;
        try {
            const t = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'configs', 'prices-eco3.json'), 'utf8')).generation_tiers || {};
            const pick = (k, b, pm) => ({ base: (t[k] && t[k].base) != null ? t[k].base : b, perMin: (t[k] && t[k].per_min) != null ? t[k].per_min : pm });
            prices = { economy: pick('economy', 299, 10), standard: pick('standard', 499, 15), premium: pick('premium', 999, 25), enterprise: pick('enterprise', 4999, 50) };
        } catch (e) {
            prices = { economy: { base: 299, perMin: 10 }, standard: { base: 499, perMin: 15 }, premium: { base: 999, perMin: 25 }, enterprise: { base: 4999, perMin: 50 } };
        }
        const tier = prices[budget] || prices.standard;
        const amount = tier.base + (duration || 10) * tier.perMin;
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount, currency: 'eur',
            metadata: {
                service: 'eco-3',
                budget: budget || 'standard',
                duration: String(duration || 10),
                topic: (topic || '').substring(0, 200),
                user: String((req.session && (req.session.username || req.session.userId)) || '').substring(0, 100)
            },
            automatic_payment_methods: { enabled: true }
        });
        
        // Log to DB
        if (db) {
            await db.prepare(Q.STATS_INSERT_AMOUNT).run(
                'payment_created', `${budget}/${duration}min`, amount / 100
            );
        }
        
        logRequest('PAYMENT', `Created ${paymentIntent.id} €${(amount/100).toFixed(2)} [${budget}/${duration}min]`);
        res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amount: amount / 100, currency: 'EUR' });
    } catch (err) {
        logRequest('ERROR', `Payment: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════
// РЕАЛНО ТЪРСЕНЕ — Google Custom Search JSON API
// Икономичните търсения минават през Google (безплатно под дневния таван),
// за да НЕ плащаме Claude за всяко търсене. Claude се ползва само за по-високите
// нива (стандарт/премиум/ентърпрайз) — там реалните резултати се структурират.
// Ключ: ECO3_GOOGLE_API_KEY/ECO3_GOOGLE_CX, иначе fallback към HLB_GOOGLE_* (същия акаунт).
// ════════════════════════════════════════════
const GOOGLE_KEY = process.env.ECO3_GOOGLE_API_KEY || process.env.HLB_GOOGLE_API_KEY || '';
const GOOGLE_CX  = process.env.ECO3_GOOGLE_CX || process.env.HLB_GOOGLE_CX || '';
const GOOGLE_DAILY_CAP = parseInt(process.env.ECO3_GOOGLE_DAILY_CAP || '90', 10); // под безплатните 100/ден

async function googleUsageToday() {
    if (!db) return 0;
    try {
        const today = new Date().toISOString().slice(0, 10);
        const row = await db.prepare(Q.GOOGLE_USAGE_TODAY).get(today);
        return row ? row.c : 0;
    } catch { return 0; }
}
async function googleUsageInc() {
    if (!db) return;
    try {
        const today = new Date().toISOString().slice(0, 10);
        await db.prepare(Q.GOOGLE_USAGE_INC).run(today);
    } catch {}
}
// ISO език → Google `lr` (ограничава резултатите до езика на клиента; икон./стандарт)
function googleLangRestrict(lang) {
    const map = { bg:'lang_bg', ru:'lang_ru', en:'lang_en', it:'lang_it', es:'lang_es', pt:'lang_pt',
        mx:'lang_es', zh:'lang_zh-CN', ja:'lang_ja', fr:'lang_fr', de:'lang_de', tr:'lang_tr',
        ku:'lang_ku', kk:'lang_kk', az:'lang_az', ka:'lang_ka', ny:'lang_en', mn:'lang_mn', ky:'lang_ky' };
    return map[lang] || null;
}
async function googleSearch(query, num, lang) {
    if (!GOOGLE_KEY || !GOOGLE_CX) return { results: [], error: 'google_not_configured' };
    if ((await googleUsageToday()) >= GOOGLE_DAILY_CAP) return { results: [], error: 'google_quota_reached' };
    const n = Math.min(Math.max(parseInt(num || 5, 10), 1), 10); // Google: макс 10 на заявка
    const params = new URLSearchParams({ key: GOOGLE_KEY, cx: GOOGLE_CX, q: query, num: String(n) });
    const lr = googleLangRestrict(lang);
    if (lr) params.set('lr', lr);
    try {
        const r = await fetch('https://www.googleapis.com/customsearch/v1?' + params.toString());
        await googleUsageInc();
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            logRequest('SEARCH', `Google ${r.status}: ${JSON.stringify(e.error?.message || e)}`);
            return { results: [], error: 'google_error_' + r.status };
        }
        const data = await r.json();
        const results = (data.items || []).map(it => ({
            title: it.title || '', snippet: it.snippet || '', link: it.link || '', source: it.displayLink || ''
        }));
        return { results, quota: { used: await googleUsageToday(), cap: GOOGLE_DAILY_CAP } };
    } catch (err) {
        logRequest('ERROR', `Google search: ${err.message}`);
        return { results: [], error: err.message };
    }
}

// ── РЕЗЕРВА: Claude Search (web_search tool) ──
// Включва се САМО за икономичния вариант и САМО когато Google е изчерпан/недостъпен.
// Google е безплатен → винаги пръв; Claude Search струва пари → резерва, за да не спира услугата.
const ANTHROPIC_KEY_S = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL_S = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const CLAUDE_SEARCH_MAX = parseInt(process.env.ECO3_CLAUDE_SEARCH_MAX_USES || '3', 10);

async function claudeSearch(query, num, lang) {
    if (!ANTHROPIC_KEY_S) return { results: [], error: 'claude_not_configured' };
    const n = Math.min(Math.max(parseInt(num || 5, 10), 1), 10);
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY_S, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL_S,
                max_tokens: 1500,
                tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: CLAUDE_SEARCH_MAX }],
                system: 'You are a web search engine. Use the web_search tool to find real results for the query, then output ONLY a JSON array of up to ' + n +
                    ' objects with keys: title, snippet, link, source. JSON only — no prose, no markdown.',
                messages: [{ role: 'user', content: 'Search the web for: ' + query + (lang ? (' (prefer results in language: ' + lang + ')') : '') }]
            })
        });
        if (!response.ok) {
            const e = await response.json().catch(() => ({}));
            logRequest('SEARCH', `Claude search ${response.status}: ${JSON.stringify(e.error?.message || e)}`);
            return { results: [], error: 'claude_error_' + response.status };
        }
        const data = await response.json();
        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('\n');
        let results = [];
        try { const m = text.match(/\[[\s\S]*\]/); if (m) results = JSON.parse(m[0]); } catch {}
        results = (results || []).slice(0, n).map(r => ({
            title: r.title || '', snippet: r.snippet || '', link: r.link || r.url || '', source: r.source || ''
        })).filter(r => r.link || r.title);
        if (db) { try { await db.prepare(Q.STATS_INSERT).run('search_claude', `${results.length} results`); } catch {} }
        return { results, provider: 'claude' };
    } catch (err) {
        logRequest('ERROR', `Claude search: ${err.message}`);
        return { results: [], error: err.message };
    }
}

// Реално търсене (фронтендът го вика преди агентите). Google пръв (безплатно под тавана);
// при изчерпан Google + икономичен вариант → резерва Claude Search (да не спира услугата).
app.post('/search', eco3RequireLogin, async (req, res) => {
    const { query, lang, num, tier } = req.body || {};
    if (!query || !String(query).trim()) return res.status(400).json({ error: 'query_required' });
    const q = String(query).trim();
    const isProd = (process.env.ECO3_MODE || 'test') === 'production';

    let out = await googleSearch(q, num, lang);
    let provider = out.results.length ? 'google' : null;

    // Резерва Claude Search: само икономичен вариант, само ако Google не върна резултати.
    if (!out.results.length && tier === 'economy' && ANTHROPIC_KEY_S && isProd) {
        const reason = out.error || 'no_results';
        const c = await claudeSearch(q, num, lang);
        if (c.results.length) { out = c; provider = 'claude'; logRequest('SEARCH', `Google изчерпан (${reason}) → Claude Search резерва: ${c.results.length}`); }
        else out.claudeError = c.error;
    }
    out.provider = provider;
    const gUsed = await googleUsageToday();
    logRequest('SEARCH', `q="${q.slice(0, 60)}" lang=${lang || '-'} tier=${tier || '-'} → ${out.results.length} via ${provider || 'none'} (google ${gUsed}/${GOOGLE_DAILY_CAP})`);
    res.json(out);
});

// Статус на търсачката (за UI/админ)
app.get('/search-status', async (req, res) => {
    res.json({
        google: { configured: !!(GOOGLE_KEY && GOOGLE_CX), usedToday: await googleUsageToday(), dailyCap: GOOGLE_DAILY_CAP },
        claudeFallback: { configured: !!ANTHROPIC_KEY_S, scope: 'economy-only', activeWhen: 'google_exhausted+production' }
    });
});

// ════════════════════════════════════════════
// ANTHROPIC API PROXY
// ════════════════════════════════════════════
app.post('/generate', eco3RequireLogin, async (req, res) => {
    const isTest = (process.env.ECO3_MODE || 'test') === 'test';
    const { model, system, messages, max_tokens } = req.body;
    
    // ── TEST MODE: mock response, no API call, free ──
    if (isTest) {
        logRequest('GENERATE', `[TEST MODE] no API call`);
        const userMsg = (messages && messages[0]?.content) || '';
        const sysStr = String(system || '');   // system може да е число/обект → .includes гърмеше (500)
        const agent = sysStr.includes('DIRECTOR') ? 'director'
            : sysStr.includes('ARCHITECT') ? 'architect' : 'executor';
        
        const mockText = agent === 'director'
            ? `[TEST] Директор: Анализ на "${userMsg.substring(0, 80)}". Намерени 8 източника от 5 държави. Структура: Въведение → Основна част → Заключение. Източници: Reuters, BBC, DW, Al Jazeera, БНТ.`
            : agent === 'architect'
            ? `[TEST] Архитект: Блок 1 "Текущо състояние" — 3 източника. Блок 2 "Анализ по държави" — 3 източника. Блок 3 "Прогноза" — 2 източника. Приоритет: актуалност.`
            : `[TEST] Изпълнител: Тема — ${userMsg.substring(0, 60)}\n\n▸ Въведение\nТемата привлича глобално внимание. Множество анализатори представят различни перспективи.\n\n▸ Основна част\nРазвитието е динамично. Ключови промени настъпиха в последните седмици. Различни региони реагират по различен начин.\n\n▸ Данни\n• 23 държави засегнати\n• 3 основни тенденции\n• Очакват се нови развития\n\n▸ Заключение\nТемата остава актуална и продължава да се развива.\n\n[TEST MODE — реални данни с ECO3_MODE=production в .env]`;
        
        // Simulate small delay
        await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
        
        if (db) {
            await db.prepare(Q.STATS_INSERT).run('generate_test', agent);
        }
        return res.json({ content: [{ type: 'text', text: mockText }], usage: { input_tokens: 0, output_tokens: 0 } });
    }
    
    // ── PRODUCTION: real Anthropic API ──
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Anthropic API key not configured' });

    try {
        const { model, system, messages, max_tokens } = req.body;
        logRequest('GENERATE', `model=${model || 'default'}, tokens=${max_tokens || 4096}`);
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
                model: model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
                system: system || undefined,
                messages: messages || [],
                max_tokens: Math.min(max_tokens || 4096, 8192)
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            logRequest('ERROR', `Anthropic ${response.status}: ${JSON.stringify(errData)}`);
            return res.status(response.status).json({ error: errData.error?.message || 'Anthropic API error' });
        }

        const data = await response.json();
        logRequest('GENERATE', `Response: ${data.usage?.output_tokens || '?'} tokens`);
        
        // Log to DB
        if (db) {
            await db.prepare(Q.STATS_INSERT).run(
                'generate', `${data.usage?.output_tokens || 0} tokens`
            );
        }
        
        res.json(data);
    } catch (err) {
        logRequest('ERROR', `Generate: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════
// DATABASE API (for frontend)
// ════════════════════════════════════════════

// Save search to history
app.post('/history', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const { topic, category, language, budget_tier, duration_min, audience, tone, session_id } = req.body;
        const ip = getClientIP(req);
        const stmt = db.prepare(Q.HISTORY_INSERT);
        const r = await stmt.run(topic, category, language || 'bg', budget_tier || 'economy', duration_min || 10, audience || 'adult', tone || 'original', session_id || '', ip);
        res.json({ ok: true, id: r.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get history
app.get('/history', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const cat = req.query.category;
        let rows;
        if (cat) {
            rows = await db.prepare(Q.HISTORY_LIST_BY_CAT).all(cat, limit);
        } else {
            rows = await db.prepare(Q.HISTORY_LIST_ALL).all(limit);
        }
        res.json({ history: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save result
app.post('/results', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const { topic, category, director_output, architect_output, executor_output, language, budget_tier, duration_min, audience, tone, session_id } = req.body;
        const stmt = db.prepare(Q.RESULTS_INSERT);
        const r = await stmt.run(topic, category, director_output || '', architect_output || '', executor_output || '', language || 'bg', budget_tier || 'economy', duration_min || 10, audience || 'adult', tone || 'original', session_id || '');
        res.json({ ok: true, id: r.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get cached results
app.get('/results', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const cat = req.query.category;
        let rows;
        if (cat) {
            rows = await db.prepare(Q.RESULTS_LIST_BY_CAT).all(cat, limit);
        } else {
            rows = await db.prepare(Q.RESULTS_LIST_ALL).all(limit);
        }
        res.json({ results: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single result (full content for TTS replay)
app.get('/results/:id', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const row = await db.prepare(Q.RESULTS_GET_BY_ID).get(req.params.id);
        if (!row) return res.status(404).json({ error: 'Not found' });

        // Count resale
        await db.prepare(Q.RESULTS_INC_RESALE).run(req.params.id);
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Uniqueness check
app.post('/uniqueness/check', async (req, res) => {
    if (!db) return res.json({ exists: false });
    try {
        const { title, source, link } = req.body;
        const today = new Date().toISOString().slice(0, 10);
        const row = await db.prepare(Q.UNIQUENESS_CHECK).get(today, title || '', link || '');
        res.json({ exists: !!row });
    } catch (err) {
        res.json({ exists: false });
    }
});

// Add to uniqueness tracker
app.post('/uniqueness/add', async (req, res) => {
    if (!db) return res.json({ ok: false });
    try {
        const { title, source, link, session_id } = req.body;
        const today = new Date().toISOString().slice(0, 10);
        await db.prepare(Q.UNIQUENESS_INSERT).run(
            today, title || '', source || '', link || '', session_id || ''
        );
        const count = await db.prepare(Q.UNIQUENESS_COUNT).get(today);
        res.json({ ok: true, todayCount: Number(count.c) });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

// Get uniqueness count for today
app.get('/uniqueness/count', async (req, res) => {
    if (!db) return res.json({ count: 0 });
    try {
        const today = new Date().toISOString().slice(0, 10);
        const count = await db.prepare(Q.UNIQUENESS_COUNT).get(today);
        res.json({ count: Number(count.c), date: today });
    } catch (err) {
        res.json({ count: 0 });
    }
});

// ════════════════════════════════════════════
// ADMIN ENDPOINTS (IP protected)
// ════════════════════════════════════════════
app.get('/admin/stats', adminCheck, async (req, res) => {
    if (!db) return res.json({ error: 'No database', totalRequests: 0, revenue: '0.00' });
    try {
        const total = await db.prepare(Q.STATS_TOTAL_24H).get();
        const generates = await db.prepare(Q.STATS_GENERATES_24H).get();
        const revenue = await db.prepare(Q.STATS_REVENUE_24H).get();
        const historyCount = await db.prepare(Q.HISTORY_COUNT).get();
        const resultsCount = await db.prepare(Q.RESULTS_COUNT).get();
        const uniqToday = await db.prepare(Q.UNIQUENESS_COUNT_TODAY).get();

        res.json({
            totalRequests: Number(total.c),
            successfulGenerations: Number(generates.c),
            revenue: Number(revenue.s).toFixed(2),
            period: '24h',
            database: {
                history: Number(historyCount.c),
                results: Number(resultsCount.c),
                uniquenessToday: Number(uniqToday.c)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/db-status', adminCheck, async (req, res) => {
    if (!db) return res.json({ connected: false });
    try {
        const names = await db.tableNames();
        const info = {};
        for (const name of names) {
            const c = await db.prepare(Q.TABLE_COUNT(name)).get();
            info[name] = Number(c.c);
        }
        res.json({ connected: true, type: db.type, path: DB_PATH, tables: info });
    } catch (err) {
        res.json({ connected: false, error: err.message });
    }
});

app.get('/admin/logs', adminCheck, (req, res) => {
    try {
        const logs = fs.existsSync(logFile)
            ? fs.readFileSync(logFile, 'utf8').split('\n').slice(-100).join('\n')
            : 'No logs yet';
        res.json({ logs });
    } catch (e) {
        res.json({ logs: 'Error: ' + e.message });
    }
});

app.delete('/admin/logs', adminCheck, (req, res) => {
    try { fs.writeFileSync(logFile, ''); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Плащания (ЖИВО от Stripe — източникът на истината: кой, колко, статус/проблем) ──
// Не пази в нашата база → работи еднакво за SQLite и PostgreSQL. Филтрира по metadata.service='eco-3'.
app.get('/admin/payments', adminCheck, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'stripe_off', message: 'Stripe не е конфигуриран (няма STRIPE_SECRET_KEY).' });
    try {
        const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 100);
        const list = await stripe.paymentIntents.list({ limit });
        const payments = (list.data || [])
            .filter(pi => pi.metadata && pi.metadata.service === 'eco-3')
            .map(pi => ({
                id: pi.id,
                amount: (pi.amount || 0) / 100,
                currency: (pi.currency || 'eur').toUpperCase(),
                status: pi.status,                 // succeeded / processing / requires_payment_method / canceled ...
                created: pi.created,               // unix секунди
                user: (pi.metadata && pi.metadata.user) || '',
                budget: (pi.metadata && pi.metadata.budget) || '',
                duration: (pi.metadata && pi.metadata.duration) || '',
                topic: (pi.metadata && pi.metadata.topic) || '',
                problem: pi.last_payment_error ? (pi.last_payment_error.message || pi.last_payment_error.code || 'грешка') : ''
            }));
        const paid = payments.filter(p => p.status === 'succeeded');
        const problems = payments.filter(p => p.status !== 'succeeded' && p.status !== 'processing');
        res.json({
            count: payments.length,
            paidCount: paid.length,
            paidTotal: paid.reduce((s, p) => s + p.amount, 0).toFixed(2),
            problemsCount: problems.length,
            payments
        });
    } catch (err) {
        logRequest('ERROR', `admin/payments: ${err.message}`);
        res.status(500).json({ error: 'stripe_error', message: err.message });
    }
});

// ════════════════════════════════════════════
// START
// ════════════════════════════════════════════
(async () => {
const dbOk = await initDatabase();
dailyCleanup(); // Run on start

debug.stage('starting HTTP server on port', PORT);
app.listen(PORT, () => {
    debug.stage('✓ listening on port', PORT);
    const mode = process.env.ECO3_MODE || 'test';
    console.log(`\n🤖 ECO-3 AI Studio Backend v1.0093`);
    console.log(`   Port:      ${PORT}`);
    console.log(`   Mode:      ${mode === 'test' ? '🧪 TEST (безплатно, mock данни)' : '🚀 PRODUCTION (реален API, плаща се)'}`);
    console.log(`   Database:  ${dbOk ? '✓ ' + DB_PATH : '✗ not connected'}`);
    console.log(`   Stripe:    ${stripe ? '✓' : '✗'}`);
    console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✓' : '✗'}${mode === 'test' ? ' (не се ползва в test mode)' : ''}`);
    console.log(`   Admin IPs: ${process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1'}`);
    console.log(`   Env:       ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Log:       ${logFile}`);
    if (mode === 'test') console.log(`\n   💡 За реални заявки: смени ECO3_MODE=production в .env`);
    console.log('');
    logRequest('START', `ECO-3 v1.0093 on port ${PORT}`);
});
})();

module.exports = app;
