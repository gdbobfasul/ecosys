// Version: 1.0093
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
const Database = require('better-sqlite3');

// Load .env — единен файл: private/configs/.env
require('dotenv').config({ path: path.join(__dirname, '..', 'configs', '.env') });

const app = express();
const PORT = process.env.ECO3_PORT || 3001;

// ════════════════════════════════════════════
// DATABASE
// ════════════════════════════════════════════
const DB_PATH = process.env.ECO3_DB_PATH || path.join(__dirname, 'database', 'eco3.db');
let db;

function initDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        
        // Apply schema if exists
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            db.exec(schema);
        }
        
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        logRequest('DB', `Connected: ${DB_PATH} (${tables.length} tables)`);
        return true;
    } catch (err) {
        logRequest('ERROR', `Database init failed: ${err.message}`);
        return false;
    }
}

// Daily cleanup — delete uniqueness entries older than today
function dailyCleanup() {
    if (!db) return;
    try {
        const deleted = db.prepare("DELETE FROM eco3_uniqueness WHERE date < date('now')").run();
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
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : ['http://localhost', 'https://alsec.strangled.net'],
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

// ── Gate: ECO3 изисква портален логин (достъп), плащането е отделно per-заявка ──
// Достъпът до ECO3 = да си логнат в порталите. Admin URL/IP също пуска.
function eco3RequireLogin(req, res, next) {
    const userId = req.session && req.session.userId;
    const admUrl = req.query.adm === 'bgmasters-set';
    if (userId || admUrl) return next();
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
    const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(s => s.trim());
    const clientIP = getClientIP(req);
    
    // In development allow all
    if (process.env.NODE_ENV !== 'production') return next();
    
    // Check IP
    const allowed = allowedIPs.some(ip => clientIP.includes(ip));
    if (allowed) return next();
    
    logRequest('ADMIN', `Blocked: ${clientIP} (allowed: ${allowedIPs.join(',')})`);
    res.status(403).json({ error: 'Forbidden', yourIP: clientIP, hint: 'Add your IP to ADMIN_ALLOWED_IPS in .env' });
}

// ════════════════════════════════════════════
// HEALTH & STATUS
// ════════════════════════════════════════════
app.get('/health', (req, res) => {
    const dbOk = !!db;
    let dbTables = 0;
    try { dbTables = db?.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").get()?.c || 0; } catch {}
    
    res.json({
        ok: true,
        service: 'eco-3',
        version: '1.0093',
        mode: process.env.ECO3_MODE || 'test',
        uptime: process.uptime(),
        database: { connected: dbOk, tables: dbTables, path: DB_PATH },
        anthropic: { configured: !!process.env.ANTHROPIC_API_KEY },
        stripe: { configured: !!process.env.STRIPE_SECRET_KEY },
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
        const prices = {
            economy:   { base: 299,  perMin: 10 },
            standard:  { base: 499,  perMin: 15 },
            premium:   { base: 999,  perMin: 25 },
            enterprise:{ base: 4999, perMin: 50 }
        };
        const tier = prices[budget] || prices.standard;
        const amount = tier.base + (duration || 10) * tier.perMin;
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount, currency: 'eur',
            metadata: { service: 'eco-3', budget: budget || 'standard', duration: String(duration || 10), topic: (topic || '').substring(0, 200) },
            automatic_payment_methods: { enabled: true }
        });
        
        // Log to DB
        if (db) {
            db.prepare("INSERT INTO eco3_stats (event_type, details, amount_eur) VALUES (?, ?, ?)").run(
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
// ANTHROPIC API PROXY
// ════════════════════════════════════════════
app.post('/generate', eco3RequireLogin, async (req, res) => {
    const isTest = (process.env.ECO3_MODE || 'test') === 'test';
    const { model, system, messages, max_tokens } = req.body;
    
    // ── TEST MODE: mock response, no API call, free ──
    if (isTest) {
        logRequest('GENERATE', `[TEST MODE] no API call`);
        const userMsg = (messages && messages[0]?.content) || '';
        const agent = system?.includes('DIRECTOR') ? 'director' 
            : system?.includes('ARCHITECT') ? 'architect' : 'executor';
        
        const mockText = agent === 'director'
            ? `[TEST] Директор: Анализ на "${userMsg.substring(0, 80)}". Намерени 8 източника от 5 държави. Структура: Въведение → Основна част → Заключение. Източници: Reuters, BBC, DW, Al Jazeera, БНТ.`
            : agent === 'architect'
            ? `[TEST] Архитект: Блок 1 "Текущо състояние" — 3 източника. Блок 2 "Анализ по държави" — 3 източника. Блок 3 "Прогноза" — 2 източника. Приоритет: актуалност.`
            : `[TEST] Изпълнител: Тема — ${userMsg.substring(0, 60)}\n\n▸ Въведение\nТемата привлича глобално внимание. Множество анализатори представят различни перспективи.\n\n▸ Основна част\nРазвитието е динамично. Ключови промени настъпиха в последните седмици. Различни региони реагират по различен начин.\n\n▸ Данни\n• 23 държави засегнати\n• 3 основни тенденции\n• Очакват се нови развития\n\n▸ Заключение\nТемата остава актуална и продължава да се развива.\n\n[TEST MODE — реални данни с ECO3_MODE=production в .env]`;
        
        // Simulate small delay
        await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
        
        if (db) {
            db.prepare("INSERT INTO eco3_stats (event_type, details) VALUES (?, ?)").run('generate_test', agent);
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
            db.prepare("INSERT INTO eco3_stats (event_type, details) VALUES (?, ?)").run(
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
app.post('/history', (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const { topic, category, language, budget_tier, duration_min, audience, tone, session_id } = req.body;
        const ip = getClientIP(req);
        const stmt = db.prepare(
            "INSERT INTO eco3_search_history (topic, category, language, budget_tier, duration_min, audience, tone, session_id, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        const r = stmt.run(topic, category, language || 'bg', budget_tier || 'economy', duration_min || 10, audience || 'adult', tone || 'original', session_id || '', ip);
        res.json({ ok: true, id: r.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get history
app.get('/history', (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const cat = req.query.category;
        let rows;
        if (cat) {
            rows = db.prepare("SELECT * FROM eco3_search_history WHERE category = ? ORDER BY created_at DESC LIMIT ?").all(cat, limit);
        } else {
            rows = db.prepare("SELECT * FROM eco3_search_history ORDER BY created_at DESC LIMIT ?").all(limit);
        }
        res.json({ history: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save result
app.post('/results', (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const { topic, category, director_output, architect_output, executor_output, language, budget_tier, duration_min, audience, tone, session_id } = req.body;
        const stmt = db.prepare(
            "INSERT INTO eco3_results (topic, category, director_output, architect_output, executor_output, language, budget_tier, duration_min, audience, tone, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        const r = stmt.run(topic, category, director_output || '', architect_output || '', executor_output || '', language || 'bg', budget_tier || 'economy', duration_min || 10, audience || 'adult', tone || 'original', session_id || '');
        res.json({ ok: true, id: r.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get cached results
app.get('/results', (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const cat = req.query.category;
        let rows;
        if (cat) {
            rows = db.prepare("SELECT id, topic, category, language, budget_tier, duration_min, created_at FROM eco3_results WHERE category = ? ORDER BY created_at DESC LIMIT ?").all(cat, limit);
        } else {
            rows = db.prepare("SELECT id, topic, category, language, budget_tier, duration_min, created_at FROM eco3_results ORDER BY created_at DESC LIMIT ?").all(limit);
        }
        res.json({ results: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single result (full content for TTS replay)
app.get('/results/:id', (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    try {
        const row = db.prepare("SELECT * FROM eco3_results WHERE id = ?").get(req.params.id);
        if (!row) return res.status(404).json({ error: 'Not found' });
        
        // Count resale
        db.prepare("UPDATE eco3_results SET resale_count = resale_count + 1 WHERE id = ?").run(req.params.id);
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Uniqueness check
app.post('/uniqueness/check', (req, res) => {
    if (!db) return res.json({ exists: false });
    try {
        const { title, source, link } = req.body;
        const today = new Date().toISOString().slice(0, 10);
        const row = db.prepare(
            "SELECT id FROM eco3_uniqueness WHERE date = ? AND (title = ? OR link = ?) LIMIT 1"
        ).get(today, title || '', link || '');
        res.json({ exists: !!row });
    } catch (err) {
        res.json({ exists: false });
    }
});

// Add to uniqueness tracker
app.post('/uniqueness/add', (req, res) => {
    if (!db) return res.json({ ok: false });
    try {
        const { title, source, link, session_id } = req.body;
        const today = new Date().toISOString().slice(0, 10);
        db.prepare("INSERT INTO eco3_uniqueness (date, title, source, link, session_id) VALUES (?, ?, ?, ?, ?)").run(
            today, title || '', source || '', link || '', session_id || ''
        );
        const count = db.prepare("SELECT COUNT(*) as c FROM eco3_uniqueness WHERE date = ?").get(today);
        res.json({ ok: true, todayCount: count.c });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

// Get uniqueness count for today
app.get('/uniqueness/count', (req, res) => {
    if (!db) return res.json({ count: 0 });
    try {
        const today = new Date().toISOString().slice(0, 10);
        const count = db.prepare("SELECT COUNT(*) as c FROM eco3_uniqueness WHERE date = ?").get(today);
        res.json({ count: count.c, date: today });
    } catch (err) {
        res.json({ count: 0 });
    }
});

// ════════════════════════════════════════════
// ADMIN ENDPOINTS (IP protected)
// ════════════════════════════════════════════
app.get('/admin/stats', adminCheck, (req, res) => {
    if (!db) return res.json({ error: 'No database', totalRequests: 0, revenue: '0.00' });
    try {
        const total = db.prepare("SELECT COUNT(*) as c FROM eco3_stats WHERE created_at > datetime('now', '-24 hours')").get();
        const generates = db.prepare("SELECT COUNT(*) as c FROM eco3_stats WHERE event_type='generate' AND created_at > datetime('now', '-24 hours')").get();
        const revenue = db.prepare("SELECT COALESCE(SUM(amount_eur), 0) as s FROM eco3_stats WHERE event_type='payment_created' AND created_at > datetime('now', '-24 hours')").get();
        const historyCount = db.prepare("SELECT COUNT(*) as c FROM eco3_search_history").get();
        const resultsCount = db.prepare("SELECT COUNT(*) as c FROM eco3_results").get();
        const uniqToday = db.prepare("SELECT COUNT(*) as c FROM eco3_uniqueness WHERE date = date('now')").get();
        
        res.json({
            totalRequests: total.c,
            successfulGenerations: generates.c,
            revenue: revenue.s.toFixed(2),
            period: '24h',
            database: {
                history: historyCount.c,
                results: resultsCount.c,
                uniquenessToday: uniqToday.c
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/db-status', adminCheck, (req, res) => {
    if (!db) return res.json({ connected: false });
    try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
        const info = {};
        tables.forEach(t => {
            info[t.name] = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
        });
        res.json({ connected: true, path: DB_PATH, tables: info });
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

// ════════════════════════════════════════════
// START
// ════════════════════════════════════════════
const dbOk = initDatabase();
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

module.exports = app;
