// HuaweiReleaseBot — стартер (huawei-release-bot-launch.cjs): осигурява ЕДИН браузър с debug порт (9222)
// и ПОСТОЯНЕН профил, за да влезеш РЪЧНО (парола + капча) САМО ВЕДНЪЖ, а ботът после да се закача
// за същата сесия при всяко пускане.
//
// ВАЖНО (заради блокировки от много логвания): този стартер НЕ затваря и НЕ пуска браузъра наново,
// ако вече има отворен браузър на порт 9222. Преизползва съществуващата сесия → едно логване, без
// постоянни отваряния/затваряния. Нов прозорец се пуска САМО ако няма никакъв.
//
// Профилът се пази в deploy-scripts/.huawei-profile — логинът остава за следващите пускания.
// Пускане:  node deploy-scripts/huawei-release-bot-launch.cjs
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const PROFILE = path.resolve('deploy-scripts/.huawei-profile');
fs.mkdirSync(PROFILE, { recursive: true });
const AGC = 'https://developer.huawei.com/consumer/en/service/josp/agc/index.html#/myApp';

// проверка: има ли вече жив браузър с debug порт 9222 (значи сесията/логинът е наличен)
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
  console.log('→ Влез в Huawei (парола + капча) САМО този първи път; после сесията се пази.');
  const child = spawn(bin, [
    '--remote-debugging-port=9222',
    '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check',
    AGC
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('✓ Браузърът е отворен (PID ' + child.pid + '). Оставяй го отворен между пусканията.');
}

portAlive((alive) => {
  if (alive) {
    console.log('✓ Вече има отворен браузър с твоята сесия (порт 9222) — ПРЕИЗПОЛЗВАМ го.');
    console.log('  Няма ново логване и няма затваряне. Само отвори приложението (App information) в него.');
    return;   // не убиваме и не пускаме нов — пазим едно логване
  }
  spawnFresh();
});
