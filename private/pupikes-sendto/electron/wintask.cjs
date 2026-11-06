'use strict';
// Автоматично пускане след старт на Windows — без администратор, без UAC прозорци.
// Механизъм: запис в Run-ключа на ТЕКУЩИЯ потребител (HKCU). Windows пуска приложението при всеки
// вход в системата, във фон → винаги готово да получи файлове. Оцелява рестарт; чисто се вкл/изкл.
const { execFile } = require('child_process');

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const RUN_NAME = 'PupikesSendTo';
function exePath() { return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath; }

function reg(args) {
  return new Promise((resolve) => {
    execFile('reg', args, { windowsHide: true, timeout: 15000 },
      (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout || '') + String(stderr || '') }));
  });
}

async function isEnabled() {
  const r = await reg(['query', RUN_KEY, '/v', RUN_NAME]);
  return r.ok && new RegExp('\\b' + RUN_NAME + '\\b').test(r.out);
}
async function enable() {
  await reg(['add', RUN_KEY, '/v', RUN_NAME, '/t', 'REG_SZ', '/d', exePath(), '/f']);
  return await isEnabled();
}
async function disable() {
  await reg(['delete', RUN_KEY, '/v', RUN_NAME, '/f']);
  return !(await isEnabled());
}

module.exports = { isEnabled, enable, disable, RUN_NAME };
