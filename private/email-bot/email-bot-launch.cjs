// EmailBot — стартер (email-bot-launch.cjs): осигурява ЕДИН браузър с debug порт 9223 и ПОСТОЯНЕН
// профил, за да влезеш РЪЧНО в пощата (Gmail или abv.bg) САМО ВЕДНЪЖ, а ботът после да се закача
// за същата сесия при всяко пускане.
//
// ВАЖНО: НЕ затваря и НЕ пуска браузъра наново, ако вече има отворен на порт 9223 — преизползва
// сесията (едно логване, без блокировки от много логвания). Профил: private/email-bot/.email-profile.
//
// Пускане:  node private/email-bot/email-bot-launch.cjs            (отваря Gmail)
//           node private/email-bot/email-bot-launch.cjs abv         (отваря abv.bg)
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const PROFILE = path.resolve('private/email-bot/.email-profile');
fs.mkdirSync(PROFILE, { recursive: true });
const WHICH = (process.argv[2] || 'gmail').toLowerCase();
const START_URL = WHICH === 'abv' ? 'https://www.abv.bg/' : 'https://mail.google.com/';

function portAlive(cb) {
  const req = http.get({ host: '127.0.0.1', port: 9223, path: '/json/version', timeout: 1500 }, (res) => { res.resume(); cb(res.statusCode === 200); });
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
  console.log('Няма отворен браузър — стартирам ЕДИН с debug порт 9223 (профил: ' + PROFILE + ').');
  console.log('→ Влез в пощата (парола) САМО този първи път; после сесията се пази.');
  const child = spawn(bin, ['--remote-debugging-port=9223', '--user-data-dir=' + PROFILE, '--no-first-run', '--no-default-browser-check', START_URL], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('✓ Браузърът е отворен (PID ' + child.pid + '). Логни се и го остави отворен между пусканията.');
}
portAlive((alive) => {
  if (alive) { console.log('✓ Вече има отворен браузър с твоята сесия (порт 9223) — ПРЕИЗПОЛЗВАМ го. Отвори пощата в него.'); return; }
  spawnFresh();
});
