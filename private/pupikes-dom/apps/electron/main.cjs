'use strict';
/* Pupikes Дом — Център (десктоп обвивка). Зарежда хостнатата конзола на центъра
 * (URL-ът се записва от build.cjs в electron/url.json при билда). Център = сървърното
 * приложение: който го контролира, владее начина на работа. */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function targetUrl() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'url.json'), 'utf8'));
    if (j && j.url) return j.url;
  } catch (_) {}
  return 'https://take.offbitch.com/dom/center.html';
}

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 820, backgroundColor: '#141821',
    title: 'Pupikes Дом — Център',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  win.loadURL(targetUrl());
  // външни линкове → системен браузър
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
