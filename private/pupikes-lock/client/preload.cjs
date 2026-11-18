'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('lock', {
  onState: (cb) => ipcRenderer.on('lock-state', (_e, d) => cb(d)),
  tryKey: (k) => ipcRenderer.send('try-key', k),
  onKeyResult: (cb) => ipcRenderer.on('key-result', (_e, ok) => cb(ok)),
});
