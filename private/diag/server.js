// Version: 1.0173
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
const { exec, spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// VPS-ът НЕ достига частния LAN адрес на VM (192.168.x) — стига до него само през
// Tailscale. Затова, когато роботът върви ТУК (на сървъра) и целта е VM, му подаваме
// Tailscale IP-то на онлайн peer-а. Връща https://<100.x.x.x> или null.
function vmTailscaleUrl() {
    try {
        const out = execSync('tailscale status --json', { timeout: 5000 }).toString();
        const st = JSON.parse(out);
        for (const k of Object.keys(st.Peer || {})) {
            const p = st.Peer[k];
            if (p.Online && Array.isArray(p.TailscaleIPs)) {
                const ip4 = p.TailscaleIPs.find((x) => x.includes('.'));
                if (ip4) return 'https://' + ip4;
            }
        }
    } catch (e) { /* tailscale липсва/не върви */ }
    return null;
}

const PORT = process.env.DIAG_PORT || 4400;
// DIAG_HOST: 127.0.0.1 на VPS (само локално), 0.0.0.0 на VM (за Tailscale достъп от VPS).
const HOST = process.env.DIAG_HOST || '127.0.0.1';
const FLAGS_FILE = '/var/lib/kcy/debug-flags.json';
const DIAG_SCRIPT = '/usr/local/bin/kcy-diagnostics.sh';

// ── Тест робот (Playwright) ───────────────────────────────────────────────
// diag върви като root → може да пуска робота. Репортите отиват под
// /var/www/html/last-errors/robot/ (виждат се на /last-errors/robot/, IP-защитено).
const ROBOT_DIR = process.env.ROBOT_DIR || '/var/www/kcy-ecosystem/private/robot';
const ROBOT_REPORTS = '/var/www/html/last-errors/robot';
const ROBOT_LOGS = '/var/www/html/last-errors/robot-logs'; // 9-те робот лога (фази 1-4 + 5 приложения)
// Състояние на текущото пускане (едно в даден момент).
let robot = { running: false, runId: null, target: null, mode: null, startedAt: null, exitCode: null, reportDir: null, tail: [] };
const pushTail = (line) => { robot.tail.push(line); if (robot.tail.length > 60) robot.tail.shift(); };

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

        // POST /robot/run — пуска робота АСИНХРОННО (връща веднага; следиш със /robot/status)
        if (req.method === 'POST' && route === '/robot/run') {
            if (robot.running) return sendJSON(res, 409, { ok: false, error: 'Роботът вече върви', runId: robot.runId });
            const body = await readBody(req);
            const target = (body.target === 'vm') ? 'vm' : 'prod';
            // Режими: critical/all/crawl/fuzz (линкове/заявки) ИЛИ journey:<app> (работни
            // сценарии „като човек" — регистрация/вход/създай/админ модерация).
            const JOURNEY_APPS = ['portals', 'chat', 'eco3', 'hlb', 'wnb', 'fbp', 'services', 'games', 'failover', 'all'];
            const raw = String(body.mode || 'critical');
            const args = ['run.js', '--target', target];
            let mode = 'critical';
            if (raw.startsWith('journey:')) {
                const appj = raw.slice(8);
                if (!JOURNEY_APPS.includes(appj)) {
                    return sendJSON(res, 400, { ok: false, error: 'Непознато журито: ' + appj });
                }
                mode = raw; args.push('--journey', appj);
            } else if (['all', 'crawl', 'fuzz'].includes(raw)) {
                mode = raw;
                if (mode === 'fuzz' && target !== 'vm') {
                    return sendJSON(res, 400, { ok: false, error: 'Fuzz е разрушителен — позволен е САМО срещу VM.' });
                }
                if (mode === 'all') args.push('--all');
                else if (mode === 'crawl') args.push('--crawl');
                else if (mode === 'fuzz') args.push('--fuzz');
            }
            // иначе остава critical (без допълнителни аргументи)
            if (!fs.existsSync(path.join(ROBOT_DIR, 'run.js'))) {
                return sendJSON(res, 500, { ok: false, error: `Роботът не е инсталиран (${ROBOT_DIR}). Пусни 32-setup-robot.sh.` });
            }
            try { fs.mkdirSync(ROBOT_REPORTS, { recursive: true }); } catch (e) {}
            const runId = new Date().toISOString().replace(/[:.]/g, '-');
            const env = { ...process.env, ROBOT_NO_SANDBOX: '1', ROBOT_REPORTS_DIR: ROBOT_REPORTS, ROBOT_LOG_DIR: ROBOT_LOGS, ROBOT_TREE_JSON: '/var/www/html/tree/tree.json' };
            if (target === 'vm') {
                // Сървърът не достига 192.168.x — само през Tailscale.
                const vmUrl = vmTailscaleUrl();
                if (!vmUrl) {
                    return sendJSON(res, 400, { ok: false, error: 'VM не е достъпно от сървъра (няма онлайн Tailscale peer). За VM пусни робота локално, или избери prod (препраща към VM при онлайн VM).' });
                }
                env.ROBOT_VM_URL = vmUrl;
            }
            robot = { running: true, runId, target, mode, startedAt: new Date().toISOString(), exitCode: null, reportDir: null, tail: [], child: null };
            const child = spawn('node', args, { cwd: ROBOT_DIR, env });
            robot.child = child; // пази процеса → бутон „Спри робота" може да го убие
            const onData = (buf) => String(buf).split(/\r?\n/).forEach((l) => {
                if (!l.trim()) return;
                pushTail(l);
                const m = l.match(/Репорт:\s*(\S.*)$/);
                if (m) robot.reportDir = m[1].trim();
            });
            child.stdout.on('data', onData);
            child.stderr.on('data', onData);
            child.on('error', (e) => { pushTail('SPAWN ERROR: ' + e.message); robot.running = false; robot.exitCode = -1; });
            child.on('close', (code) => { robot.running = false; robot.exitCode = code; robot.child = null; pushTail(`✔ край (exit ${code})`); });
            return sendJSON(res, 200, { ok: true, started: true, runId, target, mode });
        }

        // POST /robot/stop — спира/убива заседнал робот и нулира състоянието (за бутона „Спри робота")
        if (req.method === 'POST' && route === '/robot/stop') {
            const wasRunning = robot.running;
            try {
                const c = robot.child;
                if (c && !c.killed) {
                    c.kill('SIGTERM');
                    setTimeout(() => { try { if (c && !c.killed) c.kill('SIGKILL'); } catch (e) {} }, 2500);
                }
            } catch (e) { /* вече е умрял */ }
            pushTail('⏹ спрян ръчно');
            robot.running = false;
            if (robot.exitCode == null) robot.exitCode = -2;
            robot.child = null;
            return sendJSON(res, 200, { ok: true, stopped: wasRunning });
        }

        // GET /robot/status — текущо състояние + последни редове
        if (req.method === 'GET' && route === '/robot/status') {
            return sendJSON(res, 200, {
                running: robot.running, runId: robot.runId, target: robot.target, mode: robot.mode,
                startedAt: robot.startedAt, exitCode: robot.exitCode, reportDir: robot.reportDir,
                tail: robot.tail.slice(-25),
            });
        }

        // POST /robot/tree-regen — регенерира дървото /tree (node tree-gen.js, PUBLIC_DIR=web root)
        if (req.method === 'POST' && route === '/robot/tree-regen') {
            const treeGen = path.join(ROBOT_DIR, 'tree-gen.js');
            if (!fs.existsSync(treeGen)) {
                return sendJSON(res, 500, { ok: false, error: `tree-gen.js липсва (${treeGen})` });
            }
            exec(`node "${treeGen}"`, { env: { ...process.env, PUBLIC_DIR: '/var/www/html' }, timeout: 30000 }, (err, stdout, stderr) => {
                if (err) return sendJSON(res, 500, { ok: false, error: err.message, stderr: String(stderr).slice(-300) });
                sendJSON(res, 200, { ok: true, out: String(stdout).trim().slice(-300) });
            });
            return;
        }

        // POST /robot-logs/clear — изпразва 9-те робот лога (фази 1-4 + 5 приложения)
        if (req.method === 'POST' && route === '/robot-logs/clear') {
            try {
                let cleared = 0;
                if (fs.existsSync(ROBOT_LOGS)) {
                    for (const f of fs.readdirSync(ROBOT_LOGS)) {
                        if (!f.endsWith('.log')) continue;
                        try { fs.writeFileSync(path.join(ROBOT_LOGS, f), ''); cleared++; } catch (e) {}
                    }
                }
                return sendJSON(res, 200, { ok: true, cleared });
            } catch (e) {
                return sendJSON(res, 500, { ok: false, error: e.message });
            }
        }

        // GET /robot/reports — списък минали репорти (от report.json)
        if (req.method === 'GET' && route === '/robot/reports') {
            const out = [];
            try {
                for (const id of fs.readdirSync(ROBOT_REPORTS)) {
                    const jf = path.join(ROBOT_REPORTS, id, 'report.json');
                    if (!fs.existsSync(jf)) continue;
                    try {
                        const r = JSON.parse(fs.readFileSync(jf, 'utf8'));
                        out.push({ id, startedAt: r.startedAt, target: r.target, mode: r.mode || '', counts: r.counts, urlsChecked: r.urlsChecked });
                    } catch (e) { /* пропусни счупен */ }
                }
            } catch (e) { /* няма папка още */ }
            out.sort((a, b) => String(b.id).localeCompare(String(a.id)));
            return sendJSON(res, 200, { reports: out.slice(0, 50) });
        }

        // DELETE /robot/reports/<id> — трий ЕДИН минал репорт (защита от path traversal)
        if (req.method === 'DELETE' && route.startsWith('/robot/reports/')) {
            const id = String(route.slice('/robot/reports/'.length)).replace(/[^0-9A-Za-z_-]/g, '');
            if (!id) return sendJSON(res, 400, { ok: false, error: 'няма валидно id' });
            try { fs.rmSync(path.join(ROBOT_REPORTS, id), { recursive: true, force: true }); return sendJSON(res, 200, { ok: true, deleted: id }); }
            catch (e) { return sendJSON(res, 500, { ok: false, error: e.message }); }
        }

        // POST /robot/reports/clear — трий ВСИЧКИ минали репорти
        if (req.method === 'POST' && route === '/robot/reports/clear') {
            let n = 0;
            try {
                for (const id of fs.readdirSync(ROBOT_REPORTS)) { fs.rmSync(path.join(ROBOT_REPORTS, id), { recursive: true, force: true }); n++; }
            } catch (e) { return sendJSON(res, 500, { ok: false, error: e.message }); }
            return sendJSON(res, 200, { ok: true, cleared: n });
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
