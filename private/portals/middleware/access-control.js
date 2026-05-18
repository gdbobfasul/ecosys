// KCY Portals — Access Control Middleware
// Version: 1.0086
//
// 4 варианта за достъп до порталите (GAMES + SERVICES):
//   1. Платил си за текущия месец (запис в portal_monthly_payments)
//   2. URL параметър ?adm=bgmasters-set (показва admin бутоните + дава достъп)
//   3. Логнат като admin (username=admin, парола=admin123) — валидно САМО ако си първият user в DB
//   4. IP в whitelist (ADMIN_ALLOWED_IPS от .env + portal_ips от configs/ip-whitelist.json)
//
// Ако нито един вариант не върне true → redirect на /portals/billing.html
// (или 401/403 за API routes)

const fs = require('fs');
const path = require('path');

const ADM_URL_TOKEN = 'bgmasters-set';
const HARDCODED_ADMIN_USERNAME = 'admin';
const HARDCODED_ADMIN_PASSWORD = 'admin123';  // валидно САМО ако user.id === 1

// ─── IP whitelist ──────────────────────────────────────────────
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || '';
}

function loadPortalIPs() {
    try {
        const p = path.join(__dirname, '..', 'configs', 'ip-whitelist.json');
        return JSON.parse(fs.readFileSync(p, 'utf8')).portal_ips || [];
    } catch {
        return [];
    }
}

function isIpWhitelisted(req) {
    const envIPs = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(s => s.trim()).filter(Boolean);
    const portalIPs = loadPortalIPs();
    const allowed = [...envIPs, ...portalIPs];
    const clientIP = getClientIP(req);
    return allowed.some(ip => clientIP.includes(ip));
}

// ─── Current month helpers ─────────────────────────────────────
function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function hasPaidCurrentMonth(db, userId) {
    if (!userId) return false;
    const row = db.prepare(
        "SELECT id FROM portal_monthly_payments WHERE user_id = ? AND month = ?"
    ).get(userId, currentMonth());
    return !!row;
}

// ─── Admin-variant helpers ─────────────────────────────────────
function hasAdmUrlParam(req) {
    return req.query.adm === ADM_URL_TOKEN;
}

function isFirstUserAdmin(db, userId) {
    if (!userId) return false;
    // Hardcoded admin/admin123 е валиден САМО ако user с id=1 е username='admin'
    // (т.е. първият регистриран user е с username='admin')
    const first = db.prepare("SELECT id, username FROM portal_users ORDER BY id ASC LIMIT 1").get();
    if (!first) return false;
    return first.id === userId && first.username === HARDCODED_ADMIN_USERNAME;
}

// ─── Compute granted variants for the request ──────────────────
function computeAccess(req, db) {
    const userId = req.session?.userId;
    const variants = {
        paid:     hasPaidCurrentMonth(db, userId),
        adm_url:  hasAdmUrlParam(req),
        admin:    isFirstUserAdmin(db, userId),
        ip_white: isIpWhitelisted(req),
    };
    variants.granted = variants.paid || variants.adm_url || variants.admin || variants.ip_white;
    return variants;
}

// ─── Middleware: protect a portal page ─────────────────────────
function requirePortalAccess(req, res, next) {
    const db = req.app.locals.db;
    const userId = req.session?.userId;

    // Няма логин → към login
    if (!userId && !hasAdmUrlParam(req) && !isIpWhitelisted(req)) {
        const target = encodeURIComponent(req.originalUrl);
        return res.redirect(`/portals/login.html?next=${target}`);
    }

    const access = computeAccess(req, db);
    if (access.granted) {
        req.portalAccess = access;
        return next();
    }

    // Логнат е, но не е платил → billing page
    return res.redirect('/portals/billing.html');
}

// ─── Middleware: require login (без проверка за плащане) ───────
function requireLogin(req, res, next) {
    if (req.session?.userId) return next();
    const target = encodeURIComponent(req.originalUrl);
    return res.redirect(`/portals/login.html?next=${target}`);
}

// ─── API variant (JSON response instead of redirect) ───────────
function requirePortalAccessAPI(req, res, next) {
    const db = req.app.locals.db;
    if (!req.session?.userId && !hasAdmUrlParam(req) && !isIpWhitelisted(req)) {
        return res.status(401).json({ error: 'login_required' });
    }
    const access = computeAccess(req, db);
    if (access.granted) {
        req.portalAccess = access;
        return next();
    }
    return res.status(402).json({ error: 'payment_required', message: 'Платете месечната такса или използвайте admin достъп.' });
}

function requireLoginAPI(req, res, next) {
    if (req.session?.userId) return next();
    return res.status(401).json({ error: 'login_required' });
}

module.exports = {
    ADM_URL_TOKEN,
    HARDCODED_ADMIN_USERNAME,
    HARDCODED_ADMIN_PASSWORD,
    getClientIP,
    currentMonth,
    hasPaidCurrentMonth,
    hasAdmUrlParam,
    isFirstUserAdmin,
    isIpWhitelisted,
    computeAccess,
    requirePortalAccess,
    requirePortalAccessAPI,
    requireLogin,
    requireLoginAPI,
};
