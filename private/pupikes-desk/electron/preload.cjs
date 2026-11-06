'use strict';
// Безопасен мост между интерфейса (renderer) и главния процес.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rd', {
  sources: () => ipcRenderer.invoke('sources'),
  screenSize: () => ipcRenderer.invoke('screen-size'),
  controlEnabled: () => ipcRenderer.invoke('control-enabled'),
  input: (ev) => ipcRenderer.send('input', ev),                 // контролерът праща входни събития → изпълняват се тук
  saveFile: (name, bytes) => ipcRenderer.invoke('save-file', { name, bytes }),
  getStateSync: () => ipcRenderer.sendSync('state-get-sync'),      // траен файл до приложението (номер/пароли/история)
  setState: (obj) => ipcRenderer.invoke('state-set', obj),
  autostartGet: () => ipcRenderer.invoke('autostart-get'),
  autostartSet: (on) => ipcRenderer.invoke('autostart-set', on),
  // нативна услуга за достъп ПРЕДИ login (инсталира се от приложението като администратор)
  secureStatus: () => ipcRenderer.invoke('secure-status'),
  secureInstall: () => ipcRenderer.invoke('secure-install'),
  secureUninstall: () => ipcRenderer.invoke('secure-uninstall'),
  secureElevate: () => ipcRenderer.invoke('secure-elevate'),
  winMinimize: () => ipcRenderer.send('win-minimize'),   // хост: скрий прозореца при свързване (като AnyDesk)
  winRestore: () => ipcRenderer.send('win-restore'),     // върни го при прекъсване
  onPower: (cb) => ipcRenderer.on('power', (_e, s) => { try { cb(s); } catch (_) {} }),  // заключване/отключване на екрана
  // лиценз/активация (само Windows)
  licenseStatus: () => ipcRenderer.invoke('license-status'),
  licenseRedeem: (code) => ipcRenderer.invoke('license-redeem', code),
  licenseActivate: (info) => ipcRenderer.invoke('license-activate', info),
  openPaypal: () => ipcRenderer.invoke('open-paypal'),
});
