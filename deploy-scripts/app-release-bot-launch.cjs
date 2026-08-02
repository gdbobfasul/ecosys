// AppReleaseBot — стартер (app-release-bot-launch.cjs): стартира твоя Chrome с включен debug порт
// (9222) и ПОСТОЯНЕН профил, за да влезеш РЪЧНО (парола + капча) веднъж, а ботът после да се
// закача за същата сесия.
// Профилът се пази в deploy-scripts/.huawei-profile — логинът остава за следващите пускания.
//
// Пускане:  node deploy-scripts/app-release-bot-launch.cjs
// После: влез в AppGallery Connect, отвори приложението (Distribute → App information),
// и в друг терминал:  node deploy-scripts/app-release-bot.cjs newslator
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

const PROFILE = path.resolve('deploy-scripts/.huawei-profile');
fs.mkdirSync(PROFILE, { recursive: true });

// Затвори всеки ПРЕДИШЕН debug-браузър със същия профил/порт (за да стартираме ЧИСТ ВИДИМ прозорец
// всеки път). Логинът се пази в профила (.huawei-profile) — НЕ се налага нов вход/капча.
try {
  execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter (\\"Name=\'chrome.exe\' OR Name=\'msedge.exe\'\\") | Where-Object { $_.CommandLine -match \'huawei-profile\' -or $_.CommandLine -match \'remote-debugging-port=9222\' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }"', { stdio: 'ignore', timeout: 15000 });
  console.log('↻ затворих предишни debug-браузъри (ако е имало) — стартирам чист видим прозорец.');
} catch (_) {}
const AGC = 'https://developer.huawei.com/consumer/en/service/josp/agc/index.html#/myApp';

// намери Chrome (Windows типични пътища) или Edge
const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];
let bin = candidates.find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } });
if (!bin) { console.log('Не намерих Chrome/Edge. Инсталирай Chrome или задай пътя ръчно.'); process.exit(1); }

console.log('Стартирам браузър с debug порт 9222 (профил: ' + PROFILE + ')');
console.log('→ Влез в Huawei (парола + капча), отвори приложението, после пусни бота.');
const child = spawn(bin, [
  '--remote-debugging-port=9222',
  '--user-data-dir=' + PROFILE,
  '--no-first-run', '--no-default-browser-check',
  AGC
], { detached: true, stdio: 'ignore' });
child.unref();
console.log('✓ Браузърът е отворен (PID ' + child.pid + '). Този терминал може да се затвори.');
