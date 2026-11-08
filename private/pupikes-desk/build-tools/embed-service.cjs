#!/usr/bin/env node
/*
 * Компилира нативната Windows услуга (service-winlogon/PupikesDeskService.cs) с ВГРАДЕНИЯ .NET Framework
 * компилатор (csc.exe — има го на всеки Windows, без инсталации) и я ВГРАЖДА в приложението:
 *   • electron/service-b64.txt            — base64 на .exe-то (винаги се чете, не зависи от asar разопаковане)
 *   • electron/service/PupikesDeskService.exe — разопакованото копие (asarUnpack път)
 *
 * Пуска се АВТОМАТИЧНО преди `npm run dist` (виж "predist" в package.json), за да НЕ се окаже, че билдът
 * носи СТАРА услуга (точно този пропуск правеше „Login-екран" да не работи: услугата се блъскаше с
 * приложението за същия номер на сигнала). Нищо ръчно — минава през менюто/билда.
 *
 * Безопасно: ако не сме на Windows или csc липсва (друга машина) → предупреждава и ОСТАВЯ наличния
 * service-b64.txt, за да НЕ чупи билда. При реална грешка в компилацията → спира с код 1 (да се види).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'service-winlogon', 'PupikesDeskService.cs');
const EXE = path.join(ROOT, 'service-winlogon', 'PupikesDeskService.exe');
const B64 = path.join(ROOT, 'electron', 'service-b64.txt');
const UNPACK_DIR = path.join(ROOT, 'electron', 'service');
const UNPACK_EXE = path.join(UNPACK_DIR, 'PupikesDeskService.exe');

function warn(m) { console.log('  [embed-service] ! ' + m); }
function info(m) { console.log('  [embed-service] ' + m); }

function findCsc() {
  const win = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
  const cands = [
    path.join(win, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    path.join(win, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
  ];
  for (const c of cands) { try { if (fs.existsSync(c)) return c; } catch (_) {} }
  return null;
}

function embedFromExe() {
  const buf = fs.readFileSync(EXE);
  fs.writeFileSync(B64, buf.toString('base64'));
  try { fs.mkdirSync(UNPACK_DIR, { recursive: true }); fs.writeFileSync(UNPACK_EXE, buf); } catch (e) { warn('не копирах в electron/service: ' + e.message); }
  info('вградена услуга: ' + buf.length + ' б → service-b64.txt (' + fs.statSync(B64).size + ' base64) + electron/service/');
}

function main() {
  if (process.platform !== 'win32') { warn('не сме на Windows — пропускам компилирането, оставям наличния service-b64.txt'); return; }
  const csc = findCsc();
  if (!csc) { warn('csc.exe липсва (.NET Framework) — пропускам, оставям наличния service-b64.txt'); return; }
  info('компилирам нативната услуга с ' + csc);
  try {
    execFileSync(csc, [
      '-nologo', '-target:exe', '-platform:x64', '-out:' + EXE,
      '-reference:System.dll', '-reference:System.Core.dll', '-reference:System.ServiceProcess.dll',
      '-reference:System.Drawing.dll', '-reference:System.Web.Extensions.dll',
      SRC,
    ], { stdio: ['ignore', 'inherit', 'inherit'] });
  } catch (e) {
    console.error('  [embed-service] ГРЕШКА при компилиране на услугата — билдът спира, за да не носи стара услуга.');
    process.exit(1);
  }
  if (!fs.existsSync(EXE)) { console.error('  [embed-service] ГРЕШКА: csc не произведе .exe'); process.exit(1); }
  embedFromExe();
}

main();
