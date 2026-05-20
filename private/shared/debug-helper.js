// Version: 1.0091
// KCY Ecosystem — Debug helper за services
//
// Пише в:
//   1. console (отива в journalctl)
//   2. /var/www/html/last-errors/<service>-errors.log (append, минимални stage логове)
//   3. /var/www/html/last-errors/services-errors.log (cross-cutting "started"/"crashed")
//
// debug.stage() може да се изключи от admin-status страницата (per service flag).
// Default: всичко включено.

const fs = require('fs');
const path = require('path');

const FLAGS_FILE = '/var/lib/kcy/debug-flags.json';
const LOG_DIR = '/var/www/html/last-errors';
const MAX_LINES = 200;

const SERVICE_LOG = {
    'chat': 'chat-errors.log',
    'eco3': 'eco3-errors.log',
    'portals': 'portal-errors.log'
};

function isEnabled(service) {
    try { return JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf8'))[service] !== false; }
    catch { return true; }
}

function trim(file) {
    try {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        if (lines.length > MAX_LINES) {
            fs.writeFileSync(file, lines.slice(-MAX_LINES).join('\n'));
        }
    } catch {}
}

function appendLog(filename, line) {
    try {
        if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
        const file = path.join(LOG_DIR, filename);
        fs.appendFileSync(file, line + '\n');
        trim(file);
    } catch {}
}

function fmt(args) {
    return args.map(a => {
        if (a === null || a === undefined) return String(a);
        if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
        return String(a);
    }).join(' ');
}

function create(serviceName) {
    const logFile = SERVICE_LOG[serviceName] || `${serviceName}-errors.log`;

    return {
        stage(...args) {
            if (!isEnabled(serviceName)) return;
            const ts = new Date().toISOString().slice(11, 19);
            console.log(`[${ts} DEBUG/${serviceName}]`, ...args);
            const isoTs = new Date().toISOString();
            appendLog(logFile, `[${isoTs}] [DEBUG] ${fmt(args)}`);
        },
        info(...args) {
            const ts = new Date().toISOString().slice(11, 19);
            console.log(`[${ts} INFO/${serviceName}]`, ...args);
            const isoTs = new Date().toISOString();
            appendLog(logFile, `[${isoTs}] [INFO] ${fmt(args)}`);
        },
        warn(...args) {
            const ts = new Date().toISOString().slice(11, 19);
            console.warn(`[${ts} WARN/${serviceName}]`, ...args);
            const isoTs = new Date().toISOString();
            appendLog(logFile, `[${isoTs}] [WARN] ${fmt(args)}`);
            // Warns също се отбелязват в services-errors.log
            appendLog('services-errors.log', `[${isoTs}] [WARN/${serviceName}] ${fmt(args)}`);
        },
        error(...args) {
            const ts = new Date().toISOString().slice(11, 19);
            console.error(`[${ts} ERROR/${serviceName}]`, ...args);
            const isoTs = new Date().toISOString();
            appendLog(logFile, `[${isoTs}] [ERROR] ${fmt(args)}`);
            // Errors задължително отиват и в services-errors.log
            appendLog('services-errors.log', `[${isoTs}] [ERROR/${serviceName}] ${fmt(args)}`);
        }
    };
}

module.exports = { create, isEnabled };
