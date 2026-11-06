'use strict';
// Автоматично пускане след старт на Windows — без администратор, без UAC прозорци.
// Механизъм: запис в Run-ключа на ТЕКУЩИЯ потребител (HKCU). Windows пуска приложението при всеки
// вход в системата, във фон, преди да отвориш каквото и да е. Оцелява рестарт; чисто се вкл/изкл.
//   • „винаги готов за връзка" допълва трея (затварянето крие, не спира).
//   • Самият login/заключен екран (secure desktop) не може да се заснема с тази технология — за това
//     трябва нативен компонент на ниско ниво; тук гарантираме готовност веднага щом има потребителска сесия.
const { execFile } = require('child_process');

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const RUN_NAME = 'PupikesDesk';
// За portable това е постоянният път на .exe-то; за инсталираната версия — самото .exe.
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
  // /d <път> — reg приема пътя като отделен аргумент, затова интервалите не чупят нищо.
  await reg(['add', RUN_KEY, '/v', RUN_NAME, '/t', 'REG_SZ', '/d', exePath(), '/f']);
  return await isEnabled();
}

async function disable() {
  await reg(['delete', RUN_KEY, '/v', RUN_NAME, '/f']);
  return !(await isEnabled());
}

module.exports = { isEnabled, enable, disable, RUN_NAME };
