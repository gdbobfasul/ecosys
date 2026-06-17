// main.js — Electron обвивка за десктоп клонинга на „Самообучаващ се приятел".
//
// Зарежда построения Vite renderer (dist/index.html) в BrowserWindow.
// За да избегнем особеностите на file:// + ES модули, вдигаме мъничък ЛОКАЛЕН
// статичен сървър на 127.0.0.1 (само loopback, без външен достъп) и зареждаме оттам.
//
// ЧЕСТНО: няма мрежа навън за съхранение, няма акаунти, няма проследяване.
// Това е независим КЛОНИНГ — паметта му (localStorage на Electron) е отделна от телефона.

'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { registerAgentHandlers } = require('./agent.cjs');

const DIST_DIR = path.join(__dirname, '..', 'dist');

// Минимални MIME типове за статичните файлове на renderer-а.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

// Вдига loopback статичен сървър над DIST_DIR. Връща базовия URL (с порт).
function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

        // Нормализираме и пазим да не излезем извън DIST_DIR (path traversal).
        const safePath = path.normalize(path.join(DIST_DIR, urlPath));
        if (!safePath.startsWith(DIST_DIR)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }

        fs.readFile(safePath, (err, data) => {
          if (err) {
            // SPA fallback към index.html
            const indexFile = path.join(DIST_DIR, 'index.html');
            fs.readFile(indexFile, (e2, idx) => {
              if (e2) { res.writeHead(404); res.end('Not found'); return; }
              res.writeHead(200, { 'Content-Type': MIME['.html'] });
              res.end(idx);
            });
            return;
          }
          const ext = path.extname(safePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(data);
        });
      } catch (e) {
        res.writeHead(500); res.end('Server error');
      }
    });

    // Порт 0 → ОС избира свободен порт; слушаме само на loopback.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}/index.html`);
    });
    server.on('error', reject);
  });
}

let mainWindow = null;

async function createWindow() {
  const startUrl = await startStaticServer();

  mainWindow = new BrowserWindow({
    width: 420,           // телефонна ширина (resizable за десктоп удобство)
    height: 860,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#0b1020',
    title: 'Самообучаващ се приятел (десктоп)',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,   // никаква Node мощ в renderer-а
      contextIsolation: true,   // изолиран контекст (добра практика)
      sandbox: false            // preload-ът ползва require; renderer-ът остава без Node
    }
  });

  // Външни линкове → в системния браузър, не в апа.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Само ЕДНА инстанция (клонингът е заключен за 1 потребител).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Регистрираме агентските IPC handlers (FS/shell/SSH/Playwright) ПРЕДИ прозореца.
    // Гейтът по кодова дума живее в renderer-а; тук само изпълняваме поисканото.
    try { registerAgentHandlers(); } catch (e) { console.error('agent handlers:', e); }
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
