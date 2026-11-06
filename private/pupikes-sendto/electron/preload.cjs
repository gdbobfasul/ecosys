'use strict';
// Мост към главния процес — само нужното за десктоп версията на PupikesSendTo.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pupikesDesktop', {
  autostartGet: () => ipcRenderer.invoke('autostart-get'),
  autostartSet: (on) => ipcRenderer.invoke('autostart-set', !!on),
  minimize: () => ipcRenderer.send('win-minimize'),
  restore: () => ipcRenderer.send('win-restore'),
});
