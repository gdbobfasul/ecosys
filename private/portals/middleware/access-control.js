// KCY Portals — Access Control Middleware
// Version: 1.0171
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
const { roleForUsername } = require('../roles');

const ADM_URL_TOKEN = 'bgmasters-set';
const HARDCODED_ADMIN_USERNAME = 'admin';
const HARDCODED_ADMIN_PASSWORD = 'admin123';  // legacy — вече НЕ се ползва за вход (виж roles.js)

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

// Guest-mode (бутон "изключи"): админът симулира обикновен посетител. Само за
// неговия браузър (cookie kcy-guest-mode=1). Когато е включен → НЕ се третира
// като админ (нито достъп, нито бадж).
function isGuestMode(req) {
    return !!(req.headers.cookie && /(?:^|;\s*)kcy-guest-mode=1(?:;|$)/.test(req.headers.cookie));
}

// "ЛОГНАТ АДМИН": ЛОГНАТ потребител, чийто username е .env админ/модератор
// (roles.js). НЕ зависи от IP — не можеш да си "логнат админ" без да си логнат.
// guest-mode го изключва (за тест като гост).
function isLoggedAdmin(req, db) {
    if (isGuestMode(req)) return false;
    const userId = req.session && req.session.userId;
    return isEnvStaff(db, userId);
}

function isIpWhitelisted(req) {
    // "Guest mode" toggle: ако админът е натиснал бутона "изключи админ достъп"
    // (cookie kcy-guest-mode=1), преструваме се че IP-то НЕ е позволено — така
    // админът вижда сайта като обикновен гост (редиректи към billing/login).
    // Само за неговия браузър (cookie); не пипа .env, не засяга други посетители.
    if (req.headers.cookie && /(?:^|;\s*)kcy-guest-mode=1(?:;|$)/.test(req.headers.cookie)) {
        return false;
    }
    const envIPs = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(s => s.trim()).filter(Boolean);
    const portalIPs = loadPortalIPs();
    const allowed = [...envIPs, ...portalIPs];
    // Allow-all CIDR — '0.0.0.0/0' или '::/0' разрешава всеки IP.
    // ВНИМАНИЕ: ползвай само за временно тестване. Маха IP защитата.
    if (allowed.some(ip => ip === '0.0.0.0/0' || ip === '::/0')) return true;
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

// Роля от .env (roles.js) по username на логнатия потребител: admin/moderator/user.
function userRole(db, userId) {
    if (!userId) return 'user';
    const u = db.prepare("SELECT username FROM portal_users WHERE id = ?").get(userId);
    return u ? roleForUsername(u.username) : 'user';
}
// Запазено име (ползва се в computeAccess / login response). Вече = .env админ.
function isFirstUserAdmin(db, userId) { return userRole(db, userId) === 'admin'; }
// Админ ИЛИ модератор от .env.
function isEnvStaff(db, userId) { return userRole(db, userId) !== 'user'; }

// ─── Compute granted variants for the request ──────────────────
function computeAccess(req, db) {
    const userId = req.session?.userId;
    const variants = {
        paid:     hasPaidCurrentMonth(db, userId),
        adm_url:  hasAdmUrlParam(req),
        admin:    isFirstUserAdmin(db, userId),
        ip_white: isIpWhitelisted(req),
    };
    // Достъп до портала (ЛОГИН Е ЗАДЪЛЖИТЕЛЕН — виж requirePortalAccess):
    //   1. платил си за текущия месец            → нормален достъп
    //   2. admin достъп — ЛОГНАТ като .env админ/модератор (НЕ по IP!)
    // IP whitelist вече НЕ дава достъп самостоятелно — не можеш да си "логнат
    // админ" без да си логнат. (variants.ip_white остава само за информация.)
    variants.admin_access = isLoggedAdmin(req, db);
    variants.granted = variants.paid || variants.admin_access;
    return variants;
}

// ─── Middleware: protect a portal page ─────────────────────────
function requirePortalAccess(req, res, next) {
    const db = req.app.locals.db;
    const userId = req.session?.userId;

    // ЛОГИНЪТ Е ЗАДЪЛЖИТЕЛЕН — без логин нямаш достъп, независимо от IP/админ.
    // (Така "ЛОГНАТ АДМИН" има смисъл: админ се познава само след логин.)
    if (!userId) {
        const target = encodeURIComponent(req.originalUrl);
        return res.redirect(`/portals/login.html?next=${target}`);
    }

    // Логнат си: достъп ако си платил ИЛИ си логнат админ/модератор (.env).
    const access = computeAccess(req, db);
    if (access.granted) {
        req.portalAccess = access;
        return next();
    }

    // Логнат, но обикновен и неплатил → billing page
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
    // ЛОГИНЪТ Е ЗАДЪЛЖИТЕЛЕН — без логин 401, независимо от IP.
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'login_required' });
    }
    const access = computeAccess(req, db);
    if (access.granted) {
        req.portalAccess = access;
        return next();
    }
    return res.status(402).json({ error: 'payment_required', message: 'Платете месечната такса или влезте с админ/модератор акаунт (.env).' });
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
    userRole,
    isEnvStaff,
    isIpWhitelisted,
    isGuestMode,
    isLoggedAdmin,
    computeAccess,
    requirePortalAccess,
    requirePortalAccessAPI,
    requireLogin,
    requireLoginAPI,
};
