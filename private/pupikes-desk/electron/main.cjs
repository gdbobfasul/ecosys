'use strict';
// Главен процес на Pupikes Remote Desk (Electron).
// - Създава прозореца и зарежда интерфейса.
// - Дава списък с екрани за споделяне (desktopCapturer).
// - Изпълнява отдалечено управление на мишка/клавиатура (nut.js — по желание; ако липсва, само гледане+файлове).
// - Записва получените файлове на диска (диалог за запазване).
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const license = require('./license.cjs');

let win = null;

// ── отдалечено управление: опит да заредим nut.js (по желание) ──
let nut = null, nutReady = false;
(async () => {
  try {
    nut = require('@nut-tree-fork/nut-js');
    nut.mouse.config.autoDelayMs = 0;
    nut.keyboard.config.autoDelayMs = 0;
    nutReady = true;
    console.log('Отдалечено управление: nut.js е наличен ✓');
  } catch (_) { console.log('Отдалечено управление: nut.js липсва → само гледане и файлове (качи го с npm за пълен контрол).'); }
})();

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 760, backgroundColor: '#0f1115',
    title: 'Pupikes Remote Desk',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  license.recordUse();                 // брои тази употреба (освен ако вече е активирано)
  // МОДЕРНО прихващане на екрана: когато renderer-ът викне getDisplayMedia, главният процес сам избира
  // целия екран (без системен диалог). Този път е стабилен — не замръзва след няколко секунди.
  try {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] })
        .then((sources) => callback(sources && sources.length ? { video: sources[0] } : {}))
        .catch(() => callback({}));
    }, { useSystemPicker: false });
  } catch (e) { console.log('setDisplayMediaRequestHandler недостъпен (стар Electron) → резервният път ще се ползва.'); }
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// ── лиценз/активация (само Windows) ──
ipcMain.handle('license-status', () => license.status());
ipcMain.handle('license-redeem', (_e, code) => license.redeemCode(code));
ipcMain.handle('license-activate', (_e, info) => license.activatePaid(info));
ipcMain.handle('open-paypal', () => { shell.openExternal('https://www.paypal.com/'); return license.CONFIG.PAYPAL_EMAIL; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// списък с екрани/прозорци за споделяне
ipcMain.handle('sources', async () => {
  const src = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 240, height: 140 } });
  return src.map((s) => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL() }));
});

// размер на основния екран (за мащабиране на координатите от контролера)
ipcMain.handle('screen-size', async () => {
  if (nutReady) { try { return { w: await nut.screen.width(), h: await nut.screen.height() }; } catch (_) {} }
  const { screen } = require('electron'); const s = screen.getPrimaryDisplay().size; return { w: s.width, h: s.height };
});

ipcMain.handle('control-enabled', () => nutReady);

// отдалечено входно събитие (идва от контролера по data-канала; тук се изпълнява на машината-гост)
ipcMain.on('input', async (_e, ev) => {
  if (!nutReady) return;
  try {
    const { mouse, keyboard, Point, Button, Key } = nut;
    if (ev.t === 'move') { await mouse.setPosition(new Point(Math.round(ev.x), Math.round(ev.y))); }
    else if (ev.t === 'down') { await mouse.setPosition(new Point(Math.round(ev.x), Math.round(ev.y))); await mouse.pressButton(ev.b === 2 ? Button.RIGHT : ev.b === 1 ? Button.MIDDLE : Button.LEFT); }
    else if (ev.t === 'up') { await mouse.releaseButton(ev.b === 2 ? Button.RIGHT : ev.b === 1 ? Button.MIDDLE : Button.LEFT); }
    else if (ev.t === 'wheel') { if (ev.dy > 0) await mouse.scrollDown(Math.abs(ev.dy)); else if (ev.dy < 0) await mouse.scrollUp(Math.abs(ev.dy)); }
    else if (ev.t === 'type' && ev.text) { await keyboard.type(ev.text); }
    else if (ev.t === 'key' && ev.key) { const k = mapKey(Key, ev.key); if (k != null) await keyboard.type(k); }
  } catch (_) {}
});

function mapKey(Key, name) {
  const M = { Enter: Key.Enter, Backspace: Key.Backspace, Tab: Key.Tab, Escape: Key.Escape, Delete: Key.Delete, ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right, Home: Key.Home, End: Key.End, PageUp: Key.PageUp, PageDown: Key.PageDown, ' ': Key.Space };
  return M[name] != null ? M[name] : null;
}

// ── Трайно състояние ДО ПРИЛОЖЕНИЕТО (един файл pupikes-desk.json: номер, пароли, безплатен достъп,
// история, любими). Четене синхронно (за да е готов номерът още при зареждане); запис — с merge,
// за да не трие полетата на лиценза. Виж electron/store.cjs. ──
const store = require('./store.cjs');
ipcMain.on('state-get-sync', (e) => { e.returnValue = store.readAll(); });
ipcMain.handle('state-set', (_e, obj) => { try { store.writeMerge(obj || {}); return true; } catch (_) { return false; } });

// запазване на получен файл на диска
ipcMain.handle('save-file', async (_e, { name, bytes }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name || 'file' });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  return { ok: true, path: r.filePath };
});
