// RuStore стартер (rustore-release-bot-launch.cjs): осигурява ЕДИН браузър с debug порт (9222) и
// ПОСТОЯНЕН профил за RuStore (deploy-scripts/.rustore-profile), за да влезеш РЪЧНО само веднъж,
// а ботът после да се закача за същата сесия.
//
// ЕДИН браузър, ЕДНО логване: ако вече има отворен браузър на порт 9222 — преизползва го (без ново
// отваряне/затваряне/логване). Нов се пуска САМО ако няма никакъв.
// Пускане:  node deploy-scripts/rustore-release-bot-launch.cjs [URL]
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const PROFILE = path.resolve('deploy-scripts/.rustore-profile');
fs.mkdirSync(PROFILE, { recursive: true });
// адрес: подаден аргумент или конзолата на RuStore (списък с приложения)
const URL = process.argv[2] || 'https://console.rustore.ru/apps';

function portAlive(cb) {
  const req = http.get({ host: '127.0.0.1', port: 9222, path: '/json/version', timeout: 1500 }, (res) => {
    res.resume(); cb(res.statusCode === 200);
  });
  req.on('error', () => cb(false));
  req.on('timeout', () => { req.destroy(); cb(false); });
}

function spawnFresh() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  const bin = candidates.find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } });
  if (!bin) { console.log('Не намерих Chrome/Edge. Инсталирай Chrome или задай пътя ръчно.'); process.exit(1); }
  console.log('Няма отворен браузър — стартирам ЕДИН с debug порт 9222 (профил: ' + PROFILE + ').');
  console.log('→ Влез в RuStore САМО този първи път; после сесията се пази.');
  const child = spawn(bin, [
    '--remote-debugging-port=9222',
    '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check',
    URL
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('✓ Браузърът е отворен (PID ' + child.pid + ') на ' + URL + '. Оставяй го отворен между пусканията.');
}

portAlive((alive) => {
  if (alive) {
    console.log('✓ Вече има отворен браузър с твоята сесия (порт 9222) — ПРЕИЗПОЛЗВАМ го.');
    console.log('  Отвори приложението си в него: ' + URL);
    return;
  }
  spawnFresh();
});
