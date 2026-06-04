// Version: 1.0172
// KCY Ecosystem — Diag Helper Service
//
// Малка standalone услуга която:
//   • Регенерира diagnostic логовете когато admin-status страницата ги поиска
//   • Управлява per-service DEBUG flags
//
// Без external dependencies — само Node stdlib (http, child_process, fs).
// Стартира на 127.0.0.1:4400. Nginx ще proxy /api/diag/* → 127.0.0.1:4400/
//
// Endpoints:
//   GET  /health                 → {"ok":true}
//   POST /regen                  → стартира kcy-diagnostics.sh
//   GET  /debug-flags            → връща current flags
//   POST /debug-flags            → задава flag (body: {"service":"chat","enabled":true})

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.DIAG_PORT || 4400;
// DIAG_HOST: 127.0.0.1 на VPS (само локално), 0.0.0.0 на VM (за Tailscale достъп от VPS).
const HOST = process.env.DIAG_HOST || '127.0.0.1';
const FLAGS_FILE = '/var/lib/kcy/debug-flags.json';
const DIAG_SCRIPT = '/usr/local/bin/kcy-diagnostics.sh';

// Гарантирай че директорията съществува
try { fs.mkdirSync(path.dirname(FLAGS_FILE), { recursive: true }); } catch (e) {}

// Default flags
function loadFlags() {
    try {
        return JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf8'));
    } catch (e) {
        // Default: всичко включено
        return { chat: true, eco3: true, portals: true };
    }
}

function saveFlags(flags) {
    fs.writeFileSync(FLAGS_FILE, JSON.stringify(flags, null, 2));
}

function sendJSON(res, code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname.replace(/^\/api\/diag/, ''); // премахни prefix ако има

    try {
        // GET /health
        if (req.method === 'GET' && (route === '/health' || route === '/')) {
            return sendJSON(res, 200, { ok: true, service: 'kcy-diag', port: PORT });
        }

        // GET /bundle — всички логове concatenated (public-достъпен ако env е true)
        if (req.method === 'GET' && route === '/bundle') {
            const LOG_DIR = '/var/www/html/last-errors';
            try {
                const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log') || f === 'status.json').sort();
                let out = `KCY Diagnostics Bundle\nGenerated: ${new Date().toISOString()}\nHostname: ${require('os').hostname()}\n\n`;
                for (const f of files) {
                    out += `═══════════════════════════════════════════════════\n`;
                    out += `  ${f}\n`;
                    out += `═══════════════════════════════════════════════════\n`;
                    try {
                        out += fs.readFileSync(path.join(LOG_DIR, f), 'utf8');
                    } catch (e) { out += `(грешка при четене: ${e.message})`; }
                    out += '\n\n';
                }
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(out);
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Bundle error: ' + e.message);
            }
            return;
        }

        // POST /regen — стартира diagnostics скрипта
        if (req.method === 'POST' && route === '/regen') {
            const start = Date.now();
            exec(`bash ${DIAG_SCRIPT}`, { timeout: 30000 }, (err, stdout, stderr) => {
                const duration = Date.now() - start;
                if (err) {
                    return sendJSON(res, 500, {
                        ok: false,
                        error: err.message,
                        stderr: stderr.slice(-500),
                        duration_ms: duration
                    });
                }
                sendJSON(res, 200, { ok: true, duration_ms: duration });
            });
            return;
        }

        // POST /clear — изпразва (truncate) всички .log файлове в /var/www/html/last-errors/
        if (req.method === 'POST' && route === '/clear') {
            const LOG_DIR = '/var/www/html/last-errors';
            try {
                const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log'));
                let cleared = 0;
                for (const f of files) {
                    try { fs.writeFileSync(path.join(LOG_DIR, f), ''); cleared++; } catch (e) {}
                }
                return sendJSON(res, 200, { ok: true, cleared });
            } catch (e) {
                return sendJSON(res, 500, { ok: false, error: e.message });
            }
        }

        // GET /debug-flags
        if (req.method === 'GET' && route === '/debug-flags') {
            return sendJSON(res, 200, loadFlags());
        }

        // POST /debug-flags — задай flag
        if (req.method === 'POST' && route === '/debug-flags') {
            const body = await readBody(req);
            if (!body.service || typeof body.enabled !== 'boolean') {
                return sendJSON(res, 400, { error: 'Required: service (string), enabled (boolean)' });
            }
            const flags = loadFlags();
            flags[body.service] = body.enabled;
            saveFlags(flags);
            return sendJSON(res, 200, { ok: true, flags });
        }

        sendJSON(res, 404, { error: 'Not found', route });
    } catch (e) {
        sendJSON(res, 500, { error: e.message });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`[kcy-diag] listening on ${HOST}:${PORT}`);
    console.log(`[kcy-diag] flags file: ${FLAGS_FILE}`);
    console.log(`[kcy-diag] diag script: ${DIAG_SCRIPT}`);
});

process.on('SIGTERM', () => { console.log('[kcy-diag] SIGTERM, exiting'); process.exit(0); });
process.on('SIGINT', () => { console.log('[kcy-diag] SIGINT, exiting'); process.exit(0); });
