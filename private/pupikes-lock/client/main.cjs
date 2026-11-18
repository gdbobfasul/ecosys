/* Pupikes-Lock — КЛИЕНТСКИ АГЕНТ. Фон: връзка с мастера, устойчив брояч на платено време
 * (оцелява при рестарт/ток), заключване при изтичане, пазач на не-системни приложения. */
'use strict';
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, globalShortcut, nativeImage } = require('electron');
const path = require('path'); const fs = require('fs'); const os = require('os'); const crypto = require('crypto');
let WebSocket = null; try { WebSocket = require('ws'); } catch {}
const { startBlocker } = require('./blocker.cjs');
const state = require('./state.cjs');
const { Session } = require('./session.cjs');

const DEV = !!process.env.PL_DEV;                      // мек режим: заключващите прозорци не са kiosk
const SAVE_EVERY_MS = 120000;                          // устойчив запис на всеки 2 минути
const cfgFile = () => path.join(app.getPath('userData'), 'client.json');
const logFile = () => path.join(app.getPath('userData'), 'client.log');
let cfg = { code: null, masterUrl: 'ws://127.0.0.1:7711', blocker: { enabled: true, mode: 'log' } };

function log(s) { try { fs.appendFileSync(logFile(), new Date().toISOString() + ' ' + s + '\n'); } catch {} }
function loadCfg() {
  try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(cfgFile(), 'utf8'))); } catch {}
  if (!cfg.code) { cfg.code = genCode(); saveCfg(); }   // УНИКАЛЕН НЕПРОМЕНИМ код
}
function saveCfg() { try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2)); } catch {} }
function genCode() { const b = crypto.randomBytes(5).toString('hex').toUpperCase(); return 'PK-' + b.slice(0, 4) + '-' + b.slice(4, 8); }

let ws = null, seq = null, session = null, timer = null, reconnectT = null;
let lockWins = [], lockKind = 'waiting', uiStatus = null, tray = null, tickCount = 0;

/* ---------- връзка с мастера ---------- */
function connect() {
  if (!WebSocket) { log('ws липсва'); return; }
  try { ws = new WebSocket(cfg.masterUrl); } catch { return scheduleReconnect(); }
  ws.on('open', () => { log('свързан към ' + cfg.masterUrl); sendHello(); updateLock(); });
  ws.on('message', buf => { let m; try { m = JSON.parse(buf); } catch { return; } onMsg(m); });
  ws.on('close', () => { updateLock(); scheduleReconnect(); });
  ws.on('error', () => { try { ws.close(); } catch {} });
}
function scheduleReconnect() { clearTimeout(reconnectT); reconnectT = setTimeout(connect, 2500); }
function safeSend(m) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); } catch {} }
function sendHello() { const s = session.snapshot(); safeSend({ type: 'hello', code: cfg.code, host: os.hostname(), status: s.status, remainingSec: s.remainingSec }); }
function report() { const s = session.snapshot(); safeSend({ type: 'status', code: cfg.code, seq, status: s.status, remainingSec: s.remainingSec }); }

function onMsg(m) {
  if (m.type === 'welcome' || m.type === 'rename') { seq = m.seq; updateLock(); }
  else if (m.type === 'grant') { session.grant(m.hours); log('дадено време: ' + m.hours + 'ч'); }
  else if (m.type === 'lock') { session.lockNow(); log('заключено от мастера'); }
  else if (m.type === 'unlock') { session.masterUnlock(); log('отключено от мастера'); }
}

/* ---------- реакция на промяна в сесията ---------- */
function applySession(s) {
  if (s.status !== uiStatus) {
    uiStatus = s.status;
    if (s.status === 'active' || s.status === 'unlocked') hideLock();
    else if (s.status === 'expired') showLock('expired');
    else showLock('waiting');
    report();                                  // веднага при смяна на състоянието
  }
  updateLock();                                // оставащо време към екрана
  updateTray();
}

/* ---------- заключващи прозорци (на всеки екран) ---------- */
function showLock(kind) {
  lockKind = kind;
  if (DEV && kind === 'waiting') return;       // мек режим: не заключваме при чакане
  if (lockWins.length) { updateLock(); focusLocks(); return; }
  for (const d of screen.getAllDisplays()) {
    const base = { backgroundColor: '#f7c6d0', webPreferences: { preload: path.join(__dirname, 'preload.cjs') } };
    const opts = DEV
      ? Object.assign({ width: 860, height: 560, title: 'Pupikes-Lock (DEV)' }, base)      // безопасен прозорец за тест
      : Object.assign({ x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
          frame: false, fullscreen: true, kiosk: true, alwaysOnTop: true, skipTaskbar: true,
          closable: false, minimizable: false, maximizable: false, resizable: false, movable: false }, base);
    const w = new BrowserWindow(opts);
    if (!DEV) { try { w.setAlwaysOnTop(true, 'screen-saver'); } catch {} try { w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {} }
    w.loadFile(path.join(__dirname, 'renderer', 'lock.html'));
    w.on('close', e => { if (!app.__allowQuit && !DEV) e.preventDefault(); });
    if (!DEV) w.on('blur', () => { if (uiStatus === 'expired' || uiStatus === 'waiting') setTimeout(() => { try { w.show(); w.focus(); } catch {} }, 80); });
    w.webContents.on('did-finish-load', () => updateLock());
    lockWins.push(w);
    if (DEV) break;                            // в dev — само един прозорец
  }
  if (!DEV) registerLockShortcuts();
  focusLocks();
}
function hideLock() { unregisterLockShortcuts(); for (const w of lockWins) { try { w.destroy(); } catch {} } lockWins = []; }
function focusLocks() { for (const w of lockWins) { try { w.show(); w.focus(); if (w.moveTop) w.moveTop(); } catch {} } }
function updateLock() {
  const s = session ? session.snapshot() : { remainingSec: 0 };
  const payload = { kind: lockKind, seq, remainingSec: s.remainingSec, status: s.status, masterConnected: !!(ws && ws.readyState === 1) };
  for (const w of lockWins) { try { w.webContents.send('lock-state', payload); } catch {} }
}
function registerLockShortcuts() { for (const c of ['Alt+F4', 'CommandOrControl+W', 'CommandOrControl+Shift+Esc', 'CommandOrControl+Esc', 'Super', 'Alt+Tab']) { try { globalShortcut.register(c, () => {}); } catch {} } }
function unregisterLockShortcuts() { try { globalShortcut.unregisterAll(); } catch {} }

/* ---------- трей ---------- */
function updateTray() {
  if (!tray) return;
  const s = session ? session.status : '—';
  const txt = { waiting: 'чака активиране', active: 'активен', expired: 'ЗАКЛЮЧЕН', unlocked: 'отключен' }[s] || s;
  tray.setToolTip('Pupikes-Lock агент · ' + txt + (seq != null ? ' · №' + seq : ''));
}
function createTray() {
  const img = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOUlEQVR42mNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBQMAwAAG4wAAUjH6TkAAAAASUVORK5CYII=');
  tray = new Tray(img);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Pupikes-Lock агент', enabled: false },
    { type: 'separator' },
    { label: 'Изход (оператор)', click: () => { app.__allowQuit = true; app.quit(); } },
  ]));
  updateTray();
}

/* ---------- IPC от заключващия екран ---------- */
ipcMain.on('try-key', (ev, entered) => {
  const ok = session.codeUnlock(entered, cfg.code);
  if (ok) log('отключено с ключ');
  ev.reply('key-result', ok);
});

/* ---------- старт ---------- */
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.whenReady().then(() => {
    loadCfg();
    state.init(app.getPath('userData'));
    session = new Session({ onChange: applySession });

    try { app.setLoginItemSettings({ openAtLogin: true }); } catch {}
    createTray();

    session.restore();                          // ← рестарт/ток: продължаваме с оставащото време
    timer = setInterval(() => {
      session.tick();
      if (++tickCount % 15 === 0) report();      // статус към мастера на всеки 15с
      if (tickCount % Math.round(SAVE_EVERY_MS / 1000) === 0) session.save();  // устойчив запис на 2 мин
    }, 1000);
    setInterval(() => session.save(), SAVE_EVERY_MS);   // запазваме и когато не брои (expired/waiting)

    connect();
    startBlocker(Object.assign({ log }, cfg.blocker));
    log('агент стартиран · код ' + cfg.code + ' · възстановено състояние: ' + session.status + ' / ' + session.remainingSec + 'с');
  });
  app.on('before-quit', () => { try { if (session) session.save(); } catch {} });
  app.on('window-all-closed', () => { /* остава във фон */ });
}
