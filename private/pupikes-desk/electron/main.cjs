'use strict';
// Главен процес на Pupikes Remote Desk (Electron).
// - Създава прозореца и зарежда интерфейса.
// - Дава списък с екрани за споделяне (desktopCapturer).
// - Изпълнява отдалечено управление на мишка/клавиатура (nut.js — по желание; ако липсва, само гледане+файлове).
// - Записва получените файлове на диска (диалог за запазване).
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, session, Menu, Tray, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const license = require('./license.cjs');
const wintype = require('./wintype.cjs');   // надеждно Unicode въвеждане (кирилица) през SendInput
const wintask = require('./wintask.cjs');   // авто-старт след вход в Windows чрез планирана задача

let win = null;
let tray = null;
app.isQuitting = false;   // true само при истински изход (от трея) — иначе затварянето крие прозореца

// Икона в системния трей: приложението остава във ФОН дори след затваряне на прозореца, за да стои
// закачено към сигналния сървър под своя номер и да е ГОТОВО да приеме връзка по всяко време (като AnyDesk).
function createTray() {
  if (tray) return;
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'tray.png'));
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip('Pupikes-Desk — готов за връзка');
    const show = () => { if (win) { win.show(); if (win.isMinimized()) win.restore(); win.focus(); } };
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Отвори Pupikes-Desk', click: show },
      { type: 'separator' },
      { label: 'Изход', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on('click', show);
  } catch (e) { console.log('Трей иконата не се зареди:', e && e.message); }
}

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
    show: false,   // показваме чак щом интерфейсът е нарисуван — иначе при студен старт се вижда черен прозорец
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
      // Да НЕ се заспива рендерът при минимизиране — иначе WebRTC/споделянето замръзва, когато
      // прозорецът на хоста се скрие (а ние нарочно го минимизираме при свързване, като AnyDesk).
      backgroundThrottling: false,
    },
  });
  win.setMenuBarVisibility(false);
  // Показваме прозореца едва когато съдържанието е готово (без черен проблясък при старт след вход).
  win.once('ready-to-show', () => { try { win.show(); } catch (_) {} });
  // ── САМО-ВЪЗСТАНОВЯВАНЕ срещу „черен екран / забито" при студен старт след вход в Windows ──
  // Ако рендерът угасне, забие или зареждането се провали (GPU/мрежа още не готови при autostart),
  // презареждаме сами — това, което правеше ръчно (затвори иконата → пусни пак), вече става автоматично.
  let healed = 0, relaunched = false;
  const heal = (why) => {
    try {
      if (!win || win.isDestroyed()) return;
      healed++;
      console.log('Авто-възстановяване (' + why + '), опит ' + healed);
      if (healed <= 3) {
        // Първо — меко: само презареждаме рендера (бързо, пази връзката/процеса).
        win.webContents.reload();
        if (!win.isVisible()) win.show();
      } else if (!relaunched) {
        // Ако пак забива — пълен рестарт на приложението (точно каквото правеше ръчно: затвори → пусни).
        relaunched = true;
        console.log('Авто-възстановяване: пълен рестарт на приложението.');
        app.isQuitting = true;
        app.relaunch();
        app.exit(0);
      }
    } catch (_) {}
  };
  win.webContents.on('render-process-gone', () => heal('render-process-gone'));
  win.webContents.on('unresponsive', () => heal('unresponsive'));
  win.webContents.on('did-fail-load', (_e, code) => { if (code !== -3) setTimeout(() => heal('did-fail-load ' + code), 1500); });
  // Успешно зареждане → нулираме брояча (следващ проблем пак може да се лекува).
  win.webContents.on('did-finish-load', () => { healed = 0; });
  // Предпазна мрежа: ако 8с след старт прозорецът още не е показан (не е стигнал ready-to-show) — покажи+презареди.
  setTimeout(() => { try { if (win && !win.isDestroyed() && !win.isVisible()) heal('no-show-timeout'); } catch (_) {} }, 8000);
  // Затварянето НЕ спира приложението — само скрива прозореца (остава във фон/трея, връзката живее).
  // Истински изход става само от менюто на трея („Изход") или при изключване на Windows.
  win.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  createTray();
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
  // Авто-старт при вход в Windows (планирана задача): ВКЛЮЧЕН по подразбиране — за да е машината винаги
  // достъпна за връзка, докато потребителят изрично не го изключи. При първо пускане го включваме и
  // запомняме. После пресъздаваме задачата с текущия път на .exe-то (portable може да се мести).
  (async () => {
    try {
      const st = store.readAll();
      if (st.autostart === undefined) { store.writeMerge({ autostart: true }); await wintask.enable(); }
      else if (st.autostart) { await wintask.enable(); }   // освежава пътя до .exe при всяко пускане
    } catch (_) {}
  })();
  createWindow();
  try { writeSharedConfig(); } catch (_) {}   // огледай конфига за нативната услуга (достъп преди login)
  ensureSecureService();                        // по подразбиране ВКЛЮЧЕНО: при админ се вдига сама (без клик); без админ — нищо
  // Докато машината е ЗАКЛЮЧЕНА, Electron не може да хваща защитения екран — затова пуска номера, за да го
  // поеме нативната услуга (агентът на Winlogon десктопа). При отключване renderer-ът се връща.
  try {
    powerMonitor.on('lock-screen', () => { try { if (win) win.webContents.send('power', 'lock'); } catch (_) {} });
    powerMonitor.on('unlock-screen', () => { try { if (win) win.webContents.send('power', 'unlock'); } catch (_) {} });
  } catch (_) {}
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
}   // край на single-instance else

// ── Авто-старт при вход в Windows (чрез планирана задача — виж wintask.cjs) ──
// Като AnyDesk: при свързване към този компютър скриваме прозореца на Pupikes-Desk (за да не пречи на
// отдалечения екран), а при прекъсване го връщаме. backgroundThrottling:false пази споделянето живо.
ipcMain.on('win-minimize', () => { try { if (win) win.minimize(); } catch (_) {} });
ipcMain.on('win-restore', () => { try { if (win) { if (win.isMinimized()) win.restore(); win.show(); } } catch (_) {} });
// Истината за състоянието е самата планирана задача (а не само запомненият флаг).
ipcMain.handle('autostart-get', async () => { try { return await wintask.isEnabled(); } catch (_) { return false; } });
ipcMain.handle('autostart-set', async (_e, on) => {
  on = !!on;
  let ok;
  try { ok = on ? await wintask.enable() : await wintask.disable(); } catch (_) { ok = false; }
  try { store.writeMerge({ autostart: on && ok }); } catch (_) {}
  // Връщаме реалното състояние (ако нямаше права/грешка — остава както е), за да е честен checkbox-ът.
  try { return await wintask.isEnabled(); } catch (_) { return on && ok; }
});

// ── лиценз/активация (само Windows) ──
ipcMain.handle('license-status', () => license.status());
ipcMain.handle('license-redeem', (_e, code) => license.redeemCode(code));
ipcMain.handle('license-activate', (_e, info) => license.activatePaid(info));
ipcMain.handle('open-paypal', () => { shell.openExternal('https://www.paypal.com/'); return license.CONFIG.PAYPAL_EMAIL; });
// Всеки път на изход (трей „Изход", Alt+F4 при истинско спиране, изключване на Windows) вдига флага,
// за да НЕ блокираме реалното затваряне с „крий вместо затвори".
app.on('before-quit', () => { app.isQuitting = true; });
// Приложението остава живо във фон (трея) дори без видим прозорец — спира само при истински изход.
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && app.isQuitting) app.quit(); });

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
  // ЗАКЛЮЧИ отдалечената машина (не локалната!) — Win+L не може да се препрати, затова изрична команда.
  // След заключване защитеният екран поема от нативната услуга (ако е инсталирана).
  if (ev.t === 'lock') { try { require('child_process').execFile('rundll32.exe', ['user32.dll,LockWorkStation'], { windowsHide: true }); } catch (_) {} return; }
  // ТЕКСТ (вкл. КИРИЛИЦА): по надеждния Unicode път (SendInput) — независим от подредбата на отсрещния.
  // Какъвто символ напишеш локално, такъв се въвежда тук — НЕ се налага да се сменя език на тази машина.
  if (ev.t === 'type' && ev.text) {
    if (wintype.typeText(ev.text)) return;                                   // успя през SendInput Unicode
    if (nutReady) { try { await nut.keyboard.type(ev.text); } catch (_) {} } // резервно (не-Windows)
    return;
  }
  // КОЛЕЛЦЕ: надеждно през native SendInput (работи и без nut.js, и в конзоли/истории).
  // Контролерът праща dy = sign(deltaY)*3 (dy<0 = нагоре). notches = -dy/3: нагоре → +1 (разгъва историята).
  if (ev.t === 'wheel') {
    const notches = -(Number(ev.dy) || 0) / 3;
    if (wintype.wheel(notches)) return;                         // успя през native
    if (nutReady) { try { if (ev.dy > 0) await nut.mouse.scrollDown(Math.abs(ev.dy)); else if (ev.dy < 0) await nut.mouse.scrollUp(Math.abs(ev.dy)); } catch (_) {} }  // резервно
    return;
  }
  if (!nutReady) return;
  try {
    const { mouse, keyboard, Point, Button, Key } = nut;
    if (ev.t === 'move') { await mouse.setPosition(new Point(Math.round(ev.x), Math.round(ev.y))); }
    else if (ev.t === 'down') { await mouse.setPosition(new Point(Math.round(ev.x), Math.round(ev.y))); await mouse.pressButton(ev.b === 2 ? Button.RIGHT : ev.b === 1 ? Button.MIDDLE : Button.LEFT); }
    else if (ev.t === 'up') { await mouse.releaseButton(ev.b === 2 ? Button.RIGHT : ev.b === 1 ? Button.MIDDLE : Button.LEFT); }
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

// ── Общ конфиг за нативната услуга (достъп преди login) ──
// Услугата върви като SYSTEM и НЕ вижда файла до .exe-то/userData. Затова огледваме номера+паролите+адреса
// в C:\ProgramData\PupikesDesk\config.json — общо място, което SYSTEM чете, а услугата ползва СЪЩИЯ номер.
// (install.cmd дава на Users права за запис върху папката, за да може приложението да пише тук.)
const DEFAULT_SIGNAL = 'wss://take.offbitch.com/desk/';
function writeSharedConfig() {
  try {
    if (process.platform !== 'win32') return;
    const st = store.readAll() || {};
    if (!st.id) return;
    const base = process.env.ProgramData || 'C:\\ProgramData';
    const dir = path.join(base, 'PupikesDesk');
    fs.mkdirSync(dir, { recursive: true });
    const cfg = { id: String(st.id), viewPassword: String(st.viewPassword || ''), fullPassword: String(st.fullPassword || ''), signal: DEFAULT_SIGNAL };
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
  } catch (_) {}   // ако папката е само за SYSTEM (услугата още не е давала права) — тихо пропускаме
}

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
    writeSharedConfig();   // огледай номера/паролите за нативната услуга
    return true;
  } catch (_) { return false; }
});

// ── Нативна услуга за достъп ПРЕДИ login (инсталира се от самото приложение — без ръчни команди) ──
// Приложението, пуснато КАТО АДМИНИСТРАТОР, копира вградената услуга на стабилно място и я регистрира
// (sc create, LocalSystem, auto-start). Ако не е с админ права → предлага да се пре-пусне с повишение (UAC).
const SVC_NAME = 'PupikesDeskSecure';
function runCmd(cmd, args) {
  const { execFile } = require('child_process');
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 25000 }, (err, so, se) =>
      resolve({ ok: !err, out: String(so || '') + String(se || '') }));
  });
}
async function isAdmin() { try { return (await runCmd('net', ['session'])).ok; } catch (_) { return false; } }
function bundledServiceExe() {
  // В пакета __dirname е ВЪТРЕ в app.asar; реалният файл (asarUnpack) е в app.asar.unpacked.
  const inAsar = path.join(__dirname, 'service', 'PupikesDeskService.exe');
  const unpacked = inAsar.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  try { if (fs.existsSync(unpacked)) return unpacked; } catch (_) {}
  return inAsar;
}
function copyServiceExe(src, dest) {
  // copyFileSync не минава през asar слоя (дава ENOENT) → четем с readFileSync (което минава) и пишем.
  try { fs.copyFileSync(src, dest); return; } catch (_) {}
  const buf = fs.readFileSync(src); fs.writeFileSync(dest, buf);
}
function serviceExeDest() { return path.join(process.env.ProgramData || 'C:\\ProgramData', 'PupikesDesk', 'PupikesDeskService.exe'); }

ipcMain.handle('secure-status', async () => {
  try {
    const r = await runCmd('sc', ['query', SVC_NAME]);
    if (!r.ok || /1060/.test(r.out)) return { installed: false, running: false };
    return { installed: true, running: /RUNNING/.test(r.out) };
  } catch (_) { return { installed: false, running: false }; }
});

function installLog(m) {
  try {
    const dir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'PupikesDesk');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'install.log'), new Date().toISOString().slice(11, 19) + '  ' + m + '\n');
  } catch (_) {}
}
async function doSecureInstall() {
  if (process.platform !== 'win32') return { ok: false, error: 'само за Windows' };
  installLog('--- инсталиране: старт ---');
  const admin = await isAdmin();
  installLog('администратор: ' + admin);
  if (!admin) { installLog('няма админ права → предлагам повишение'); return { ok: false, needAdmin: true }; }
  const dir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'PupikesDesk');
  fs.mkdirSync(dir, { recursive: true });
  await runCmd('icacls', [dir, '/grant', '*S-1-5-32-545:(OI)(CI)M', '/T']);
  const src = bundledServiceExe(), dest = serviceExeDest();
  installLog('копирам ' + src + ' (има го: ' + (fs.existsSync(src)) + ') → ' + dest);
  try { copyServiceExe(src, dest); installLog('копиран: ' + fs.existsSync(dest)); }
  catch (e) { installLog('КОПИРАНЕ НЕУСПЕХ: ' + e.message); return { ok: false, error: 'копиране на услугата: ' + e.message }; }
  try { writeSharedConfig(); } catch (_) {}
  const q = await runCmd('sc', ['query', SVC_NAME]);
  const exists = q.ok && !/1060/.test(q.out);
  const mk = exists
    ? await runCmd('sc', ['config', SVC_NAME, 'binPath=', dest, 'start=', 'auto', 'obj=', 'LocalSystem'])
    : await runCmd('sc', ['create', SVC_NAME, 'binPath=', dest, 'start=', 'auto', 'obj=', 'LocalSystem', 'DisplayName=', 'Pupikes-Desk Secure Access']);
  installLog((exists ? 'config' : 'create') + ': ok=' + mk.ok + ' | ' + mk.out.trim());
  // авто-рестарт при забиване (винаги-жива услуга преди login)
  await runCmd('sc', ['failure', SVC_NAME, 'reset=', '60', 'actions=', 'restart/5000/restart/5000/restart/10000']);
  const st = await runCmd('sc', ['start', SVC_NAME]);
  installLog('start: ok=' + st.ok + ' | ' + st.out.trim());
  const s = await runCmd('sc', ['query', SVC_NAME]);
  const running = /RUNNING/.test(s.out);
  installLog('краен статус: ' + (running ? 'RUNNING' : s.out.trim()));
  if (!mk.ok) return { ok: false, error: 'sc ' + (exists ? 'config' : 'create') + ': ' + mk.out.trim() };
  return { ok: true, running: running };
}

// АВТО-ВДИГАНЕ по подразбиране: услугата е ВКЛЮЧЕНА по подразбиране. При админ пускане се инсталира/обновява
// сама (БЕЗ клик по отметка). Без админ — не досаждаме с UAC; инсталираната версия я вдига инсталаторът.
async function ensureSecureService() {
  try {
    if (process.platform !== 'win32') return;
    const stt = store.readAll() || {};
    if (stt.securePref === false) { installLog('услугата е изключена от потребителя (за тест) — пропускам'); return; }
    const q = await runCmd('sc', ['query', SVC_NAME]);
    const installed = q.ok && !/1060/.test(q.out);
    if (!(await isAdmin())) {
      if (installed) await autoUpdateService();
      else installLog('услугата се иска (по подразбиране), но няма админ — ще се вдигне при админ пускане или от инсталатора');
      return;
    }
    if (!installed) { installLog('АВТО-инсталиране по подразбиране (админ, без клик)'); await doSecureInstall(); }
    else await autoUpdateService();
  } catch (_) {}
}

ipcMain.handle('secure-install', async () => {
  const r = await doSecureInstall();
  if (r && r.ok) { try { store.writeMerge({ securePref: true }); } catch (_) {} }
  return r;
});

ipcMain.handle('secure-uninstall', async () => {
  try {
    if (!(await isAdmin())) return { ok: false, needAdmin: true };
    await runCmd('sc', ['stop', SVC_NAME]);
    await runCmd('sc', ['delete', SVC_NAME]);
    try { store.writeMerge({ securePref: false }); } catch (_) {}   // изключено → не се вдига сама занапред
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e && e.message) }; }
});

// АВТО-ОБНОВЯВАНЕ на инсталираната услуга: при всяко пускане, ако вградената версия се различава от
// копието в ProgramData — спираме услугата, подменяме .exe-то и я пускаме пак. Без ръчно изключи/включи.
async function autoUpdateService() {
  try {
    if (process.platform !== 'win32') return;
    const q = await runCmd('sc', ['query', SVC_NAME]);
    if (!q.ok || /1060/.test(q.out)) return;            // услугата не е инсталирана → няма какво да обновяваме
    const src = bundledServiceExe(), dst = serviceExeDest();
    let same = false;
    try { const a = fs.readFileSync(src), b = fs.readFileSync(dst); same = (a.length === b.length && a.equals(b)); } catch (_) { same = false; }
    if (same) return;                                   // вече е последната версия
    if (!(await isAdmin())) { console.log('Услугата има нова версия — ще се обнови при пускане като администратор.'); return; }
    await runCmd('sc', ['stop', SVC_NAME]);
    let copied = false;
    for (let i = 0; i < 10 && !copied; i++) {           // .exe-то може да е заключено секунда след спиране
      try { fs.copyFileSync(src, dst); copied = true; } catch (_) { await new Promise((r) => setTimeout(r, 400)); }
    }
    try { writeSharedConfig(); } catch (_) {}
    await runCmd('sc', ['start', SVC_NAME]);
    console.log('Услугата е обновена до вградената версия: ' + (copied ? 'ОК' : 'копирането не успя'));
  } catch (_) {}
}

ipcMain.handle('secure-elevate', async () => {
  // пре-пуска приложението с администраторски права (UAC диалог)
  try {
    const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    const { spawn } = require('child_process');
    spawn('powershell', ['-NoProfile', '-Command', "Start-Process -FilePath '" + exe.replace(/'/g, "''") + "' -Verb RunAs"],
      { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
    app.isQuitting = true; setTimeout(() => { try { app.quit(); } catch (_) {} }, 500);
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e && e.message) }; }
});

// запазване на получен файл на диска
ipcMain.handle('save-file', async (_e, { name, bytes }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name || 'file' });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  return { ok: true, path: r.filePath };
});
