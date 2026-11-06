'use strict';
// Главен процес на PupikesSendTo (десктоп версия, Electron).
// Обвива съществуващата уеб-страница (web/index.html) като Windows приложение, което:
//   • стои във фон (икона в трея) — винаги готово да изпраща/получава файлове;
//   • затварянето само го скрива (не спира), за да е достъпно по всяко време;
//   • по желание се пуска автоматично след вход в Windows (planирана чрез Run-ключ, без администратор).
// Сигнализацията и трансферът са същите като в уеба — директно P2P през WebRTC + нашия сървър.
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell, session } = require('electron');
const path = require('path');
const wintask = require('./wintask.cjs');

let win = null, tray = null;
app.isQuitting = false;   // true само при истински изход (от трея/изключване на Windows)

function createTray() {
  if (tray) return;
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'tray.png'));
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip('PupikesSendTo — готов за трансфер на файлове');
    const show = () => { if (win) { win.show(); if (win.isMinimized()) win.restore(); win.focus(); } };
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Отвори PupikesSendTo', click: show },
      { type: 'separator' },
      { label: 'Изход', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on('click', show);
  } catch (e) { console.log('Трей иконата не се зареди:', e && e.message); }
}

function createWindow() {
  // Махаме вграденото меню на Electron (ускорителите Ctrl+R/F5… не трябва да пречат).
  try { Menu.setApplicationMenu(null); } catch (_) {}
  win = new BrowserWindow({
    width: 560, height: 840, backgroundColor: '#0f1115',
    title: 'PupikesSendTo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false,   // да не заспива WebRTC трансферът при скрит прозорец
    },
  });
  win.setMenuBarVisibility(false);
  // Затварянето крие прозореца (остава във фон/трея), не спира приложението.
  win.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
  // Външните връзки (ако има) се отварят в системния браузър, не вътре в приложението.
  win.webContents.setWindowOpenHandler(({ url }) => { try { shell.openExternal(url); } catch (_) {} return { action: 'deny' }; });
  win.loadFile(path.join(__dirname, '..', 'web', 'index.html'));
  createTray();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

  app.whenReady().then(() => {
    // Камерата (QR скенер) — разрешаваме заявките за media вътре в приложението.
    try { session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'media')); } catch (_) {}
    // Авто-старт след вход в Windows: ВКЛЮЧЕН по подразбиране (да е винаги готово), докато не се изключи.
    (async () => {
      try {
        const Store = require('./store.cjs');
        const st = Store.readAll();
        if (st.autostart === undefined) { Store.writeMerge({ autostart: true }); await wintask.enable(); }
        else if (st.autostart) { await wintask.enable(); }   // освежава пътя до .exe
      } catch (_) {}
    })();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && app.isQuitting) app.quit(); });

// ── прозорец: скрий/покажи (за да е като AnyDesk — може да работи във фон) ──
ipcMain.on('win-minimize', () => { try { if (win) win.minimize(); } catch (_) {} });
ipcMain.on('win-restore', () => { try { if (win) { if (win.isMinimized()) win.restore(); win.show(); } } catch (_) {} });

// ── авто-старт (планиран чрез Run-ключ) ──
ipcMain.handle('autostart-get', async () => { try { return await wintask.isEnabled(); } catch (_) { return false; } });
ipcMain.handle('autostart-set', async (_e, on) => {
  on = !!on;
  let ok;
  try { ok = on ? await wintask.enable() : await wintask.disable(); } catch (_) { ok = false; }
  try { const Store = require('./store.cjs'); Store.writeMerge({ autostart: on && ok }); } catch (_) {}
  try { return await wintask.isEnabled(); } catch (_) { return on && ok; }
});
