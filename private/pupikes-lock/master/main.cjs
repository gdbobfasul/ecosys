/* Pupikes-Lock — МАСТЕР (Electron обвивка около server.cjs). */
'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path'); const fs = require('fs'); const os = require('os');
const { LockServer } = require('./server.cjs');

const PORT = 7711;
let win = null, server = null;

const dataFile = () => path.join(app.getPath('userData'), 'clients.json');
function loadStore() { try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch { return { nextSeq: 1, clients: {} }; } }
function saveStore() { try { fs.writeFileSync(dataFile(), JSON.stringify(server.store, null, 2)); } catch {} }

function pushList() { if (win && !win.isDestroyed()) win.webContents.send('clients', server.list()); }
function localIps() { const n = os.networkInterfaces(); const out = []; for (const k in n) for (const a of n[k] || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address); return out; }

ipcMain.handle('get-clients', () => server.list());
ipcMain.handle('get-info', () => ({ port: PORT, ips: localIps() }));
ipcMain.on('cmd', (_ev, p) => server.cmd(p));

function createWin() {
  win = new BrowserWindow({
    width: 1040, height: 700, title: 'Pupikes-Lock — Мастер', backgroundColor: '#12151b',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  server = new LockServer({
    store: loadStore(), saveStore,
    onChange: (kind, data) => {
      if (kind === 'list') pushList();
      else if (kind === 'error' && win) win.webContents.send('server-error', data);
    },
  });
  try { server.start(PORT); } catch (e) { /* грешката идва и през onChange */ }
  createWin();
});
app.on('window-all-closed', () => app.quit());
