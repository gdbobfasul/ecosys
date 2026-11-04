// JobBot — стартер (job-bot-launch.cjs): осигурява ЕДИН браузър с debug порт 9224 и ПОСТОЯНЕН
// профил, за да влезеш РЪЧНО в сайта за работа / пощата САМО ВЕДНЪЖ, а ботът после да се
// закача за същата сесия при всяко пускане (едно логване, без блокировки).
//
// Профил: private/job-bot/.job-profile  (отделен от имейл-бота — може да ползваш отделна поща за работа).
//
// Пускане:  node private/job-bot/job-bot-launch.cjs                       (празен таб)
//           node private/job-bot/job-bot-launch.cjs https://www.jobs.bg/  (отваря даден сайт)
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const PORT = 9224;
const PROFILE = path.resolve('private/job-bot/.job-profile');
fs.mkdirSync(PROFILE, { recursive: true });
const START_URL = process.argv[2] || 'about:blank';

function portAlive(cb) {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: '/json/version', timeout: 1500 }, (res) => { res.resume(); cb(res.statusCode === 200); });
  req.on('error', () => cb(false));
  req.on('timeout', () => { req.destroy(); cb(false); });
}
function spawnFresh() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  const bin = candidates.find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } });
  if (!bin) { console.log('Не намерих Chrome/Edge. Инсталирай Chrome.'); process.exit(1); }
  console.log('Няма отворен браузър — стартирам ЕДИН с debug порт ' + PORT + ' (профил: ' + PROFILE + ').');
  console.log('→ Влез в сайта за работа / пощата (парола) САМО този първи път; после сесията се пази.');
  const flags = ['--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--no-first-run', '--no-default-browser-check'];
  const proxy = process.env.JOBBOT_PROXY;
  if (proxy) { flags.push('--proxy-server=' + proxy); console.log('→ Излаз през прокси: ' + proxy); }
  flags.push(START_URL);
  const child = spawn(bin, flags, { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('✓ Браузърът е отворен (PID ' + child.pid + '). Логни се и го остави отворен между пусканията.');
}
portAlive((alive) => {
  if (alive) { console.log('✓ Вече има отворен браузър с твоята сесия (порт ' + PORT + ') — ПРЕИЗПОЛЗВАМ го.'); return; }
  spawnFresh();
});
