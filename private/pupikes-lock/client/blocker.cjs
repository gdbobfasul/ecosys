/* Фонов пазач: спира стартирането на не-системни приложения.
 * Правило: разрешени са процеси в C:\Windows\ (системни) + изричен бял списък
 * (Edge, самият агент, деинсталатори). Всичко друго (игри, офис, странични програми,
 * вкл. антивирусни, инсталирани извън Windows) се третира като забранено.
 *
 * РЕЖИМИ: mode:'log' (само записва какво БИ спрял — безопасно по подразбиране) или
 * mode:'kill' (наистина затваря процесите). Операторът превключва на 'kill' в client.json.
 */
'use strict';
const { exec } = require('child_process');

const DEFAULT_ALLOW = [
  'explorer.exe', 'msedge.exe', 'msedgewebview2.exe',
  'searchhost.exe', 'searchapp.exe', 'startmenuexperiencehost.exe', 'shellexperiencehost.exe',
  'applicationframehost.exe', 'textinputhost.exe', 'systemsettings.exe', 'lockapp.exe',
  'msiexec.exe', 'unins000.exe', 'uninstall.exe',
  'pupikes-lock.exe', 'electron.exe',                      // самият агент (dev + билд)
];

let timer = null, opt = null;

function startBlocker(options) {
  opt = Object.assign({ enabled: true, mode: 'log', intervalMs: 3000, allow: [], log: () => {} }, options || {});
  opt.allowSet = new Set([...DEFAULT_ALLOW, ...(opt.allow || [])].map(s => s.toLowerCase()));
  if (!opt.enabled) { opt.log('[blocker] изключен'); return; }
  opt.log('[blocker] включен · режим=' + opt.mode);
  tick(); timer = setInterval(tick, opt.intervalMs);
}
function stopBlocker() { clearInterval(timer); }

function tick() {
  if (process.platform !== 'win32') return;
  const cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath | ConvertTo-Json -Compress"';
  exec(cmd, { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (e, out) => {
    if (e || !out) return;
    let arr; try { arr = JSON.parse(out); } catch { return; }
    if (!Array.isArray(arr)) arr = [arr];
    for (const p of arr) {
      const name = String(p.Name || ''); const px = String(p.ExecutablePath || '');
      if (!px) continue;                                   // системни без път — пропускаме
      const low = px.toLowerCase();
      if (low.startsWith('c:\\windows\\')) continue;       // системни
      if (opt.allowSet.has(name.toLowerCase())) continue;  // изрично разрешени
      if (opt.mode === 'kill') {
        try { process.kill(p.ProcessId); } catch { exec('taskkill /PID ' + p.ProcessId + ' /F', { windowsHide: true }); }
        opt.log('[blocker] спрян: ' + name + ' — ' + px);
      } else {
        opt.log('[blocker] БИ спрял: ' + name + ' — ' + px);
      }
    }
  });
}

module.exports = { startBlocker, stopBlocker, DEFAULT_ALLOW };
