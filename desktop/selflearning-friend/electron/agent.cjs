// agent.cjs — „агентските суперсили" на десктоп клонинга (САМО десктоп).
//
// Тук живеят РЕАЛНИТЕ мощни действия, изпълнявани в main процеса на Electron (Node):
//   1) Файлова система — четене/писане/листване В РАМКИТЕ на собственишки избрана папка.
//   2) Изпълнение на shell команди — stdout/stderr/exit код обратно към renderer-а.
//   3) SSH към машина (Linux/Windows) — през ssh2; ключ ИЛИ парола, само локално.
//   4) Playwright — отваря URL, извлича текст/линкове/заглавие, кара малки скриптове.
//
// СИГУРНОСТ (важно): тук НЯМА гейт по кодова дума. Гейтът (отключен + кодова дума +
// изрично потвърждение „⚠ ОПАСНА команда") е В RENDERER-а (държи разковничето). main
// процесът само ИЗПЪЛНЯВА това, което гейтнатият UI поиска. Затова preload-ът излага
// тясно, типизирано API — никакъв суров require/child_process към renderer-а.
//
// ЧЕСТНО: тези мощи МОГАТ да четат/пишат/трият файлове и да пускат отдалечени команди.
// Единствената защита е кодовата дума + потвърждението в UI. Ползвай внимателно.
// Нищо от това НЕ съществува в телефонните приложения (rustore/huawei) — те остават
// непокътнати; това е чисто Electron-main код.

'use strict';

const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { spawn } = require('child_process');
const os = require('os');

// --- Локално съхранение на разрешения/креденшъли (само на този компютър) ----------
// Пазим: избраната базова папка (FS sandbox) + списък SSH хостове (с парола/ключ).
// Файлът е в userData на приложението — НЕ напуска машината, НЕ се синхронизира.
function configPath() {
  return path.join(app.getPath('userData'), 'agent-config.json');
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg || typeof cfg !== 'object') return defaultConfig();
    cfg.baseDir = typeof cfg.baseDir === 'string' ? cfg.baseDir : null;
    cfg.sshHosts = Array.isArray(cfg.sshHosts) ? cfg.sshHosts : [];
    return cfg;
  } catch (_) {
    return defaultConfig();
  }
}

function defaultConfig() {
  return { baseDir: null, sshHosts: [] };
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// --- Помощник: гарантира, че пътят е В рамките на собственишката базова папка --------
// Връща абсолютния безопасен път или хвърля грешка (отказ при изход извън sandbox).
function resolveInBase(relOrAbs) {
  const cfg = loadConfig();
  if (!cfg.baseDir) {
    throw new Error('Няма избрана базова папка. Първо избери папка, на която давам достъп.');
  }
  const base = path.resolve(cfg.baseDir);
  // Приемаме относителен (спрямо base) или абсолютен път.
  const target = path.resolve(base, relOrAbs || '.');
  const rel = path.relative(base, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Отказ: пътят е извън разрешената папка (' + base + ').');
  }
  return target;
}

// ============================ FS handlers =========================================

function registerFs() {
  // Собственикът ИЗБИРА (с диалог) базовата папка, на която дава достъп.
  ipcMain.handle('agent:fs:pickBaseDir', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const r = await dialog.showOpenDialog(win, {
      title: 'Избери папка, на която даваш достъп на агента',
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) {
      return { ok: false, canceled: true };
    }
    const cfg = loadConfig();
    cfg.baseDir = r.filePaths[0];
    saveConfig(cfg);
    return { ok: true, baseDir: cfg.baseDir };
  });

  ipcMain.handle('agent:fs:getBaseDir', async () => {
    return { ok: true, baseDir: loadConfig().baseDir };
  });

  ipcMain.handle('agent:fs:clearBaseDir', async () => {
    const cfg = loadConfig();
    cfg.baseDir = null;
    saveConfig(cfg);
    return { ok: true };
  });

  // Листва съдържанието на (под)папка в рамките на базата.
  ipcMain.handle('agent:fs:list', async (_e, relPath) => {
    try {
      const dir = resolveInBase(relPath || '.');
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const items = entries.map((d) => ({
        name: d.name,
        dir: d.isDirectory(),
        file: d.isFile()
      })).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
      return { ok: true, path: dir, items };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  });

  // Чете текстов файл (с лимит по размер, за да не пръснем паметта).
  ipcMain.handle('agent:fs:read', async (_e, relPath) => {
    try {
      const file = resolveInBase(relPath);
      const stat = await fsp.stat(file);
      if (!stat.isFile()) return { ok: false, reason: 'Това не е файл.' };
      const MAX = 2 * 1024 * 1024; // 2 MB
      if (stat.size > MAX) {
        return { ok: false, reason: 'Файлът е твърде голям (> 2 MB) за четене в агента.' };
      }
      const content = await fsp.readFile(file, 'utf8');
      return { ok: true, path: file, size: stat.size, content };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  });

  // Пише текстов файл (създава папки при нужда). ОПАСНО — презаписва!
  ipcMain.handle('agent:fs:write', async (_e, relPath, content) => {
    try {
      const file = resolveInBase(relPath);
      await fsp.mkdir(path.dirname(file), { recursive: true });
      await fsp.writeFile(file, String(content == null ? '' : content), 'utf8');
      const stat = await fsp.stat(file);
      return { ok: true, path: file, size: stat.size };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  });
}

// ============================ Shell command handler ===============================

function registerShell() {
  // Пуска shell команда, връща stdout/stderr/exit код. ОПАСНО — изпълнява реално.
  // cwd по избор е В рамките на базовата папка (ако има избрана), иначе userData.
  ipcMain.handle('agent:shell:run', async (_e, command, opts) => {
    return new Promise((resolve) => {
      try {
        const o = opts || {};
        let cwd;
        try {
          cwd = o.cwd ? resolveInBase(o.cwd) : (loadConfig().baseDir || os.tmpdir());
        } catch (_) {
          cwd = os.tmpdir();
        }
        const timeoutMs = Math.min(Math.max(Number(o.timeoutMs) || 60000, 1000), 600000);

        // Ползваме system shell (cmd.exe на Windows, sh иначе) с цялата команда.
        const isWin = process.platform === 'win32';
        const shell = isWin ? (process.env.COMSPEC || 'cmd.exe') : '/bin/sh';
        const args = isWin ? ['/d', '/s', '/c', String(command)] : ['-c', String(command)];

        const child = spawn(shell, args, { cwd, windowsHide: true });
        let stdout = '';
        let stderr = '';
        const MAX = 1 * 1024 * 1024; // 1 MB на поток
        let killed = false;

        const timer = setTimeout(() => {
          killed = true;
          try { child.kill('SIGKILL'); } catch (_) {}
        }, timeoutMs);

        child.stdout.on('data', (d) => { if (stdout.length < MAX) stdout += d.toString(); });
        child.stderr.on('data', (d) => { if (stderr.length < MAX) stderr += d.toString(); });
        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({ ok: false, reason: String(err.message || err), stdout, stderr, code: null });
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            ok: !killed && code === 0,
            timedOut: killed,
            code,
            stdout,
            stderr,
            cwd
          });
        });
      } catch (e) {
        resolve({ ok: false, reason: String(e.message || e) });
      }
    });
  });
}

// ============================ SSH handlers (ssh2) ==================================

function registerSsh() {
  // Запазва/чете локалния списък SSH хостове (парола/ключ ОСТАВАТ само на машината).
  ipcMain.handle('agent:ssh:listHosts', async () => {
    const hosts = loadConfig().sshHosts.map((h) => ({
      id: h.id, label: h.label, host: h.host, port: h.port, username: h.username,
      auth: h.password ? 'password' : (h.privateKeyPath ? 'key' : 'none')
    }));
    return { ok: true, hosts };
  });

  // Добавя/обновява хост. Креденшълите се пазят локално в agent-config.json.
  ipcMain.handle('agent:ssh:saveHost', async (_e, host) => {
    try {
      const cfg = loadConfig();
      const h = host || {};
      const entry = {
        id: h.id || ('ssh_' + Date.now().toString(36)),
        label: String(h.label || h.host || 'хост'),
        host: String(h.host || ''),
        port: Number(h.port) || 22,
        username: String(h.username || ''),
        password: h.password ? String(h.password) : '',
        privateKeyPath: h.privateKeyPath ? String(h.privateKeyPath) : '',
        passphrase: h.passphrase ? String(h.passphrase) : ''
      };
      if (!entry.host || !entry.username) {
        return { ok: false, reason: 'Трябват поне хост и потребител.' };
      }
      const idx = cfg.sshHosts.findIndex((x) => x.id === entry.id);
      if (idx >= 0) cfg.sshHosts[idx] = entry; else cfg.sshHosts.push(entry);
      saveConfig(cfg);
      return { ok: true, id: entry.id };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  });

  ipcMain.handle('agent:ssh:deleteHost', async (_e, id) => {
    const cfg = loadConfig();
    cfg.sshHosts = cfg.sshHosts.filter((x) => x.id !== id);
    saveConfig(cfg);
    return { ok: true };
  });

  // Свързва се към запазен хост и изпълнява команда. Връща stdout/stderr/код.
  // ОПАСНО — изпълнява реално на отдалечената машина.
  ipcMain.handle('agent:ssh:run', async (_e, hostId, command) => {
    let Client;
    try {
      ({ Client } = require('ssh2'));
    } catch (e) {
      return { ok: false, reason: 'ssh2 не е инсталиран (npm install ssh2).' };
    }
    const cfg = loadConfig();
    const h = cfg.sshHosts.find((x) => x.id === hostId);
    if (!h) return { ok: false, reason: 'Няма такъв запазен хост.' };

    const connCfg = {
      host: h.host,
      port: h.port || 22,
      username: h.username,
      readyTimeout: 20000
    };
    if (h.privateKeyPath) {
      try {
        connCfg.privateKey = fs.readFileSync(h.privateKeyPath);
        if (h.passphrase) connCfg.passphrase = h.passphrase;
      } catch (e) {
        return { ok: false, reason: 'Не мога да чета ключа: ' + String(e.message || e) };
      }
    } else if (h.password) {
      connCfg.password = h.password;
    } else {
      return { ok: false, reason: 'Хостът няма нито ключ, нито парола.' };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      let settled = false;
      const done = (r) => { if (!settled) { settled = true; try { conn.end(); } catch (_) {} resolve(r); } };

      conn.on('ready', () => {
        conn.exec(String(command), (err, stream) => {
          if (err) return done({ ok: false, reason: String(err.message || err) });
          let stdout = '';
          let stderr = '';
          const MAX = 1 * 1024 * 1024;
          stream.on('close', (code) => done({ ok: code === 0, code, stdout, stderr }));
          stream.on('data', (d) => { if (stdout.length < MAX) stdout += d.toString(); });
          stream.stderr.on('data', (d) => { if (stderr.length < MAX) stderr += d.toString(); });
        });
      });
      conn.on('error', (err) => done({ ok: false, reason: String(err.message || err) }));
      try {
        conn.connect(connCfg);
      } catch (e) {
        done({ ok: false, reason: String(e.message || e) });
      }
    });
  });
}

// ============================ Playwright handlers =================================

// Намира браузър за Playwright: 1) собственият chromium на Playwright (ако е свален),
// 2) PLAYWRIGHT_CHROMIUM_PATH env, 3) сочим към системен Chrome/Edge (channel).
function resolveBrowserLaunch(playwright) {
  // Опитваме просто chromium.launch() — Playwright сам намира свалените браузъри.
  // Ако няма свален браузър, ще паднем към executablePath от env, после към channel.
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  return launchOpts;
}

function registerPlaywright() {
  // Отваря URL headless, извлича заглавие/текст/линкове; по избор пуска малък скрипт
  // от действия (click/fill/waitFor/goto). За учене от уеб + каране на уеб-апове.
  ipcMain.handle('agent:web:crawl', async (_e, url, options) => {
    let chromium;
    try {
      ({ chromium } = require('playwright'));
    } catch (e1) {
      try {
        ({ chromium } = require('playwright-core'));
      } catch (e2) {
        return { ok: false, reason: 'playwright не е инсталиран (npm install playwright).' };
      }
    }
    const opts = options || {};
    let browser = null;
    try {
      const launchOpts = resolveBrowserLaunch();
      // Ако е зададен системен канал (chrome/msedge) — ползваме него (без сваляне).
      if (opts.channel) launchOpts.channel = opts.channel;
      try {
        browser = await chromium.launch(launchOpts);
      } catch (errLaunch) {
        // Втори опит: системен Edge/Chrome канал (често наличен на Windows).
        try { browser = await chromium.launch({ headless: true, channel: 'msedge' }); }
        catch (_) { browser = await chromium.launch({ headless: true, channel: 'chrome' }); }
      }

      const page = await browser.newPage();
      await page.goto(String(url), { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Малък скрипт от действия (по избор) — каране на уеб-апове.
      const actions = Array.isArray(opts.actions) ? opts.actions : [];
      const actionLog = [];
      for (const a of actions.slice(0, 20)) {
        try {
          if (a.type === 'goto') { await page.goto(String(a.url), { timeout: 30000 }); }
          else if (a.type === 'click') { await page.click(String(a.selector), { timeout: 10000 }); }
          else if (a.type === 'fill') { await page.fill(String(a.selector), String(a.value || ''), { timeout: 10000 }); }
          else if (a.type === 'waitFor') { await page.waitForSelector(String(a.selector), { timeout: 15000 }); }
          else if (a.type === 'wait') { await page.waitForTimeout(Math.min(Number(a.ms) || 500, 10000)); }
          actionLog.push({ ...a, ok: true });
        } catch (ae) {
          actionLog.push({ ...a, ok: false, reason: String(ae.message || ae) });
        }
      }

      const title = await page.title();
      const finalUrl = page.url();
      const text = (await page.evaluate(() => document.body ? document.body.innerText : '')).slice(0, 20000);
      const links = (await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).slice(0, 200).map((a) => ({
          text: (a.textContent || '').trim().slice(0, 120),
          href: a.href
        }))
      ));

      await browser.close();
      browser = null;
      return { ok: true, title, url: finalUrl, text, links, actionLog };
    } catch (e) {
      try { if (browser) await browser.close(); } catch (_) {}
      return { ok: false, reason: String(e.message || e) };
    }
  });
}

// ============================ App Builder handlers ================================
//
// „🏗 App Builder" — собственикът може да:
//   1) Скелетира НОВ минимален Vite + vanilla JS уеб-апп в избрана от него папка.
//   2) Билдва APK от съществуващ апп (напр. под repo/rustore/) през РЕАЛНИЯ shell.
//
// СИГУРНОСТ: тук НЯМА гейт (както и при другите мощи) — гейтът по кодова дума живее в
// renderer-а (confirmDangerous). Тези handler-и само ИЗПЪЛНЯВАТ поисканото. Папката за
// скеле собственикът ИЗБИРА с диалог (затова не е вързана към FS sandbox-а — той сам я
// посочва съзнателно). Билдът тече през избрана от него папка с апп.

// Намира корена на repo-то (.../2026-06-02-toks), за да предложим rustore/ аповете.
// Десктоп клонингът живее в <repo>/desktop/selflearning-friend/, така че се качваме 2 нива.
function repoRootGuess() {
  try {
    // app.getAppPath() сочи към ресурсите (dev: папката на проекта; prod: asar).
    const here = app.getAppPath();
    const up = path.resolve(here, '..', '..'); // selflearning-friend → desktop → repo
    return up;
  } catch (_) {
    return path.resolve(__dirname, '..', '..', '..');
  }
}

// Малък, ЧЕСТЕН Vite + vanilla JS шаблон (без външни зависимости отвъд vite).
function scaffoldFiles(appName, appId) {
  const safeName = String(appName || 'my-app').trim() || 'my-app';
  const pkgName = safeName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'my-app';
  const id = String(appId || ('com.example.' + pkgName.replace(/-/g, ''))).trim();

  const pkg = {
    name: pkgName,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    devDependencies: { vite: '^5.4.8' }
  };

  const capConfig = {
    appId: id,
    appName: safeName,
    webDir: 'dist',
    server: { androidScheme: 'https' },
    android: { allowMixedContent: false }
  };

  const indexHtml =
`<!doctype html>
<html lang="bg">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${safeName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;

  const mainJs =
`// main.js — входна точка на „${safeName}" (Vite + vanilla JS, без зависимости).
// Скелетирано от App Builder на десктоп клонинга. Free/local, без телеметрия.

const app = document.getElementById('app');

app.innerHTML = \`
  <main style="max-width:560px;margin:0 auto;padding:24px;
               font-family:system-ui,Segoe UI,Roboto,sans-serif">
    <h1>${safeName}</h1>
    <p>Здравей! Това е пресен Vite + vanilla JS апп.</p>
    <button id="count" type="button">Натиснат: 0</button>
  </main>
\`;

let n = 0;
const btn = document.getElementById('count');
btn.addEventListener('click', () => { n++; btn.textContent = 'Натиснат: ' + n; });
`;

  const viteConfig =
`// vite.config.js — относителна база, за да върви и опакован в Capacitor APK.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './'
});
`;

  const readme =
`# ${safeName}

Минимален Vite + vanilla JS апп, скелетиран от App Builder.

## Старт
\`\`\`
npm install
npm run dev      # дев сървър
npm run build    # → dist/
\`\`\`

## APK (Capacitor)
Изисква Android SDK + JDK на машината (ANDROID_HOME, JAVA_HOME).
\`\`\`
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
\`\`\`
APK: \`android/app/build/outputs/apk/debug/app-debug.apk\`

Free/local. Без IAP/GMS/HMS/Firebase, без телеметрия.
`;

  const gitignore = `node_modules\ndist\nandroid/app/build\n.gradle\n`;

  return [
    { rel: 'package.json', content: JSON.stringify(pkg, null, 2) + '\n' },
    { rel: 'capacitor.config.json', content: JSON.stringify(capConfig, null, 2) + '\n' },
    { rel: 'index.html', content: indexHtml },
    { rel: 'vite.config.js', content: viteConfig },
    { rel: 'src/main.js', content: mainJs },
    { rel: 'README.md', content: readme },
    { rel: '.gitignore', content: gitignore }
  ];
}

function registerBuilder() {
  // Собственикът избира ПРОИЗВОЛНА папка (диалог). За скеле/билд той посочва съзнателно,
  // затова тук НЕ ограничаваме до FS sandbox-а (но връщаме само абсолютния път).
  ipcMain.handle('agent:builder:pickDir', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const r = await dialog.showOpenDialog(win, {
      title: 'Избери папка (за скеле на нов апп или за билд на съществуващ)',
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return { ok: false, canceled: true };
    return { ok: true, dir: r.filePaths[0] };
  });

  // Изброява кандидат-апове под repo/rustore/ (имат package.json + capacitor.config.json).
  ipcMain.handle('agent:builder:listApps', async () => {
    try {
      const root = repoRootGuess();
      const out = [];
      for (const store of ['rustore', 'huawei']) {
        const storeDir = path.join(root, store);
        let entries;
        try { entries = await fsp.readdir(storeDir, { withFileTypes: true }); }
        catch (_) { continue; }
        for (const d of entries) {
          if (!d.isDirectory()) continue;
          const appDir = path.join(storeDir, d.name);
          const hasPkg = fs.existsSync(path.join(appDir, 'package.json'));
          const hasCap = fs.existsSync(path.join(appDir, 'capacitor.config.json'));
          if (hasPkg && hasCap) {
            out.push({ store, name: d.name, dir: appDir });
          }
        }
      }
      return { ok: true, root, apps: out };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  });

  // Скелетира нов апп в АБСОЛЮТНА папка (избрана от собственика). Отказва, ако вече има
  // package.json там (за да не презапишем съществуващ проект без да искаме).
  ipcMain.handle('agent:builder:scaffold', async (_e, opts) => {
    try {
      const o = opts || {};
      const dir = String(o.dir || '');
      if (!dir || !path.isAbsolute(dir)) {
        return { ok: false, reason: 'Трябва абсолютен път до папка (избери я с диалога).' };
      }
      await fsp.mkdir(dir, { recursive: true });
      if (fs.existsSync(path.join(dir, 'package.json')) && !o.force) {
        return { ok: false, reason: 'В тази папка вече има package.json. Избери празна папка.' };
      }
      const files = scaffoldFiles(o.appName, o.appId);
      const written = [];
      for (const f of files) {
        const target = path.join(dir, f.rel);
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.writeFile(target, f.content, 'utf8');
        written.push(f.rel);
      }
      return { ok: true, dir, files: written };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  });

  // Стриймнат shell run: емитва парчета stdout/stderr към renderer-а на живо,
  // после връща финалния код. cwd е АБСОЛЮТНА папка (избрана от собственика за билд).
  // ОПАСНО — изпълнява реално (билд командите). Гейтът е в renderer-а.
  ipcMain.handle('agent:shell:stream', async (e, command, opts) => {
    return new Promise((resolve) => {
      try {
        const o = opts || {};
        const runId = String(o.runId || ('run_' + Date.now().toString(36)));
        let cwd = o.cwd && path.isAbsolute(String(o.cwd)) ? String(o.cwd) : os.tmpdir();
        if (!fs.existsSync(cwd)) cwd = os.tmpdir();
        const timeoutMs = Math.min(Math.max(Number(o.timeoutMs) || 600000, 1000), 1800000);

        const isWin = process.platform === 'win32';
        const shell = isWin ? (process.env.COMSPEC || 'cmd.exe') : '/bin/sh';
        const args = isWin ? ['/d', '/s', '/c', String(command)] : ['-c', String(command)];

        // Билдовете искат Android/Java env — подаваме машинните стойности (опция 56 ги е сложила).
        const env = Object.assign({}, process.env);
        if (o.env && typeof o.env === 'object') {
          for (const k of Object.keys(o.env)) env[k] = String(o.env[k]);
        }

        const child = spawn(shell, args, { cwd, windowsHide: true, env });
        const sender = e.sender;
        const emit = (stream, chunk) => {
          try { if (!sender.isDestroyed()) sender.send('agent:shell:stream:data', { runId, stream, chunk }); } catch (_) {}
        };
        let killed = false;
        const timer = setTimeout(() => { killed = true; try { child.kill('SIGKILL'); } catch (_) {} }, timeoutMs);

        child.stdout.on('data', (d) => emit('stdout', d.toString()));
        child.stderr.on('data', (d) => emit('stderr', d.toString()));
        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({ ok: false, runId, reason: String(err.message || err), code: null, cwd });
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({ ok: !killed && code === 0, runId, timedOut: killed, code, cwd });
        });
      } catch (ex) {
        resolve({ ok: false, reason: String(ex.message || ex) });
      }
    });
  });
}

// Регистрира ВСИЧКИ агентски IPC handlers. Вика се веднъж при app.whenReady().
function registerAgentHandlers() {
  registerFs();
  registerShell();
  registerSsh();
  registerPlaywright();
  registerBuilder();
}

module.exports = { registerAgentHandlers };
