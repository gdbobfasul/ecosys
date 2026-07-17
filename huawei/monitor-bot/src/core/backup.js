// Version: 1.0013
// backup.js — КОНФИГУРАЦИЯТА ВЪВ ФАЙЛ, който ОЦЕЛЯВА деинсталация (по модела на
// selflearning-friend/recovery.js): мониторите + прокси адреса се записват в публичната
// папка Downloads/KCY/site-monitor-config.json (Directory.ExternalStorage). При нова
// инсталация апът намира файла и ПИТА дали да възстанови. Резерв: Documents на апа
// (видима, но се трие при деинсталация) — тогава го казваме честно.
//
// Плъгинът се взима СИНХРОННО от window.Capacitor.Plugins (НЕ динамичен import —
// отделният chunk понякога увисва в WebView, виж бележката в storage.js).

const DIR = 'KCY';
const FILE = 'site-monitor-config.json';
const PUBLIC_PATH = `Download/${DIR}/${FILE}`;

function fsPlugin() {
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    if (isNative && cap.Plugins && cap.Plugins.Filesystem) return cap.Plugins.Filesystem;
  } catch (_) { /* браузър */ }
  return null;
}
export function backupAvailable() { return !!fsPlugin(); }

function buildBundle(state) {
  return {
    app: 'monitor-bot',
    kind: 'sitemon-config',
    version: 1,
    exportedAt: new Date().toISOString(),
    proxyBase: state.proxyBase || '',
    monitors: (state.monitors || []).map((m) => ({ ...m, seenIds: [] })) // seen-store не се пренася
  };
}

// Записва конфигурацията. Връща { ok, path, survives, reason? }.
export async function backupNow(state) {
  const fs = fsPlugin();
  if (!fs) return { ok: false, reason: 'browser' };
  const data = JSON.stringify(buildBundle(state), null, 1);
  try {
    try { await fs.requestPermissions(); } catch (_) { /* може да не е нужно */ }
    await fs.writeFile({ path: PUBLIC_PATH, data, directory: 'EXTERNAL_STORAGE', encoding: 'utf8', recursive: true });
    return { ok: true, path: `Downloads/${DIR}/${FILE}`, survives: true };
  } catch (e1) {
    try {
      await fs.writeFile({ path: FILE, data, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
      return { ok: true, path: `Documents/${FILE}`, survives: false };
    } catch (e2) {
      return { ok: false, reason: String((e2 && e2.message) || (e1 && e1.message) || 'write-failed') };
    }
  }
}

// Чете запазената конфигурация (или null). Търси първо в Downloads/KCY, после в Documents.
export async function readBackup() {
  const fs = fsPlugin();
  if (!fs) return null;
  for (const attempt of [
    { path: PUBLIC_PATH, directory: 'EXTERNAL_STORAGE' },
    { path: FILE, directory: 'DOCUMENTS' }
  ]) {
    try {
      const r = await fs.readFile({ ...attempt, encoding: 'utf8' });
      const d = JSON.parse(typeof r.data === 'string' ? r.data : '');
      if (d && d.kind === 'sitemon-config' && Array.isArray(d.monitors)) return d;
    } catch (_) { /* пробвай следващото място */ }
  }
  return null;
}

// Възстановява от бъндъл в state (мониторите се СЛИВАТ по url — без дубли). Връща бройката.
export function applyBackup(state, bundle) {
  const have = new Set((state.monitors || []).map((m) => m.url));
  let added = 0;
  for (const m of bundle.monitors) {
    if (!m || !m.url || have.has(m.url)) continue;
    have.add(m.url);
    state.monitors.push({ ...m, lastCheck: null, lastMatch: null, lastError: null, seenIds: [] });
    added++;
  }
  if (bundle.proxyBase && !state.proxyBase) state.proxyBase = bundle.proxyBase;
  return added;
}

// ── Авто-бекъп: отложен запис след всяка промяна (fire-and-forget) ─────────────
let _t = null;
export function scheduleAutoBackup(state) {
  if (!fsPlugin()) return;
  if (_t) clearTimeout(_t);
  _t = setTimeout(() => { _t = null; backupNow(state).catch(() => {}); }, 3000);
}
