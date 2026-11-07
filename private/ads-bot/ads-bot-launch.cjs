// AdsBot — стартер (ads-bot-launch.cjs): ЕДИН браузър с debug порт 9225 и ПОСТОЯНЕН профил,
// ОТДЕЛЕН от job-bot (отделна самоличност/имейл за обявите — често измислени данни).
// Влизаш РЪЧНО веднъж в сайта за обяви / пощата, после ботът се закача за същата сесия.
//
// Профил: private/ads-bot/.ads-profile
// Пускане:  node private/ads-bot/ads-bot-launch.cjs [URL]
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const PORT = 9225;
const PROFILE = path.resolve('private/ads-bot/.ads-profile');
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
  console.log('Стартирам ЕДИН браузър с debug порт ' + PORT + ' (профил: ' + PROFILE + ').');
  console.log('→ Влез в сайта за обяви / пощата САМО този първи път; после сесията се пази.');
  const flags = ['--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--no-first-run', '--no-default-browser-check'];
  const proxy = process.env.ADSBOT_PROXY;
  if (proxy) { flags.push('--proxy-server=' + proxy); console.log('→ Излаз през прокси: ' + proxy); }
  flags.push(START_URL);
  const child = spawn(bin, flags, { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('✓ Браузърът е отворен (PID ' + child.pid + '). Влез и го остави отворен между пусканията.');
}
portAlive((alive) => {
  if (alive) { console.log('✓ Вече има отворен браузър с твоята сесия (порт ' + PORT + ') — ПРЕИЗПОЛЗВАМ го.'); return; }
  spawnFresh();
});
