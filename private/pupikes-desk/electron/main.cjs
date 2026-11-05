'use strict';
// Главен процес на Pupikes Remote Desk (Electron).
// - Създава прозореца и зарежда интерфейса.
// - Дава списък с екрани за споделяне (desktopCapturer).
// - Изпълнява отдалечено управление на мишка/клавиатура (nut.js — по желание; ако липсва, само гледане+файлове).
// - Записва получените файлове на диска (диалог за запазване).
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const license = require('./license.cjs');
const wintype = require('./wintype.cjs');   // надеждно Unicode въвеждане (кирилица) през SendInput

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
  // Махаме вграденото меню на Electron — иначе ускорителите му (Ctrl+R/F5 = презареди, Ctrl+W = затвори,
  // Ctrl+Shift+I = devtools…) ПРЕХВАЩАТ тези клавиши локално, вместо да се препратят на отдалечената машина.
  try { Menu.setApplicationMenu(null); } catch (_) {}
  win = new BrowserWindow({
    width: 1180, height: 760, backgroundColor: '#0f1115',
    title: 'Pupikes Remote Desk',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
      // Да НЕ се заспива рендерът при минимизиране — иначе WebRTC/споделянето замръзва, когато
      // прозорецът на хоста се скрие (а ние нарочно го минимизираме при свързване, като AnyDesk).
      backgroundThrottling: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// ЕДНА ИНСТАНЦИЯ: ако приложението вече върви (напр. стара + нова версия), вторият старт само
// фокусира вече отворения прозорец и излиза — за да няма два екземпляра, борещи се за един номер/екран.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

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
  // Авто-старт при включване на Windows (ако е включен от потребителя) — пре-регистрираме с текущия път
  // на .exe-то (за portable това е PORTABLE_EXECUTABLE_FILE, който е постоянен).
  try { const st = store.readAll(); if (st.autostart) applyAutostart(true); } catch (_) {}
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
}   // край на single-instance else

// ── Авто-старт при вход в Windows ──
const exePath = () => process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
function applyAutostart(on) { try { app.setLoginItemSettings({ openAtLogin: !!on, path: exePath(), args: [] }); } catch (_) {} }
// Като AnyDesk: при свързване към този компютър скриваме прозореца на Pupikes-Desk (за да не пречи на
// отдалечения екран), а при прекъсване го връщаме. backgroundThrottling:false пази споделянето живо.
ipcMain.on('win-minimize', () => { try { if (win) win.minimize(); } catch (_) {} });
ipcMain.on('win-restore', () => { try { if (win) { if (win.isMinimized()) win.restore(); win.show(); } } catch (_) {} });
ipcMain.handle('autostart-get', () => { try { return !!store.readAll().autostart; } catch (_) { return false; } });
ipcMain.handle('autostart-set', (_e, on) => { on = !!on; try { store.writeMerge({ autostart: on }); } catch (_) {} applyAutostart(on); return on; });

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
  if (!ev) return;
  // ТЕКСТ (вкл. КИРИЛИЦА): по надеждния Unicode път (SendInput) — независим от подредбата на отсрещния.
  // Какъвто символ напишеш локално, такъв се въвежда тук — НЕ се налага да се сменя език на тази машина.
  if (ev.t === 'type' && ev.text) {
    if (wintype.typeText(ev.text)) return;                                   // успя през SendInput Unicode
    if (nutReady) { try { await nut.keyboard.type(ev.text); } catch (_) {} } // резервно (не-Windows)
    return;
  }
  if (!nutReady) return;
  try {
    const { mouse, keyboard, Point, Button, Key } = nut;
    if (ev.t === 'move') { await mouse.setPosition(new Point(Math.round(ev.x), Math.round(ev.y))); }
    else if (ev.t === 'down') { await mouse.setPosition(new Point(Math.round(ev.x), Math.round(ev.y))); await mouse.pressButton(ev.b === 2 ? Button.RIGHT : ev.b === 1 ? Button.MIDDLE : Button.LEFT); }
    else if (ev.t === 'up') { await mouse.releaseButton(ev.b === 2 ? Button.RIGHT : ev.b === 1 ? Button.MIDDLE : Button.LEFT); }
    else if (ev.t === 'wheel') { if (ev.dy > 0) await mouse.scrollDown(Math.abs(ev.dy)); else if (ev.dy < 0) await mouse.scrollUp(Math.abs(ev.dy)); }
    else if (ev.t === 'key' && ev.key) { const k = mapKey(Key, ev.key); if (k != null) await keyboard.type(k); }
    else if (ev.t === 'combo' && ev.key) {
      // Комбинация с модификатори (Ctrl+C, Ctrl+V, Ctrl+A, Alt+Tab, Ctrl+Home…).
      const k = comboKey(Key, ev.key); if (k == null) return;
      const mods = [];
      if (ev.ctrl) mods.push(Key.LeftControl);
      if (ev.alt) mods.push(Key.LeftAlt);
      if (ev.shift) mods.push(Key.LeftShift);
      if (ev.meta) mods.push(Key.LeftSuper);
      try {
        for (const m of mods) await keyboard.pressKey(m);
        await keyboard.pressKey(k); await keyboard.releaseKey(k);
        for (const m of mods.slice().reverse()) await keyboard.releaseKey(m);
      } catch (_) {}
    }
  } catch (_) {}
});

// спец-клавиши (не-печатаеми) → nut Key
function mapKey(Key, name) {
  const M = { Enter: Key.Enter, Return: Key.Enter, Backspace: Key.Backspace, Tab: Key.Tab, Escape: Key.Escape, Delete: Key.Delete, Insert: Key.Insert, ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right, Home: Key.Home, End: Key.End, PageUp: Key.PageUp, PageDown: Key.PageDown, ' ': Key.Space, F1: Key.F1, F2: Key.F2, F3: Key.F3, F4: Key.F4, F5: Key.F5, F6: Key.F6, F7: Key.F7, F8: Key.F8, F9: Key.F9, F10: Key.F10, F11: Key.F11, F12: Key.F12 };
  return M[name] != null ? M[name] : null;
}
// главен клавиш за комбинация: букви/цифри + спец-клавишите (за Alt+Tab, Ctrl+Home и т.н.)
function comboKey(Key, name) {
  if (!name) return null;
  if (name.length === 1) {
    const c = name.toLowerCase();
    if (c >= 'a' && c <= 'z') return Key[c.toUpperCase()];
    if (c >= '0' && c <= '9') return Key['Num' + c];
  }
  return mapKey(Key, name);
}

// ── Трайно състояние ДО ПРИЛОЖЕНИЕТО (един файл pupikes-desk.json: номер, пароли, безплатен достъп,
// история, любими). Четене синхронно (за да е готов номерът още при зареждане); запис — с merge,
// за да не трие полетата на лиценза. Виж electron/store.cjs. ──
const store = require('./store.cjs');
ipcMain.on('state-get-sync', (e) => { e.returnValue = store.readAll(); });
// Лицензните полета (activated/method/uses/txn/sender/date) се управляват САМО от license.cjs.
// Интерфейсът праща цялото си (евентуално остаряло) копие при запис на история/любими/пароли — ако не
// ги премахнем, той би презаписал прясната активация обратно на false. Затова ги изрязваме тук.
const LICENSE_KEYS = ['activated', 'method', 'uses', 'txn', 'sender', 'date'];
ipcMain.handle('state-set', (_e, obj) => {
  try {
    const patch = Object.assign({}, obj || {});
    for (const k of LICENSE_KEYS) delete patch[k];
    store.writeMerge(patch);
    return true;
  } catch (_) { return false; }
});

// запазване на получен файл на диска
ipcMain.handle('save-file', async (_e, { name, bytes }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name || 'file' });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  return { ok: true, path: r.filePath };
});
