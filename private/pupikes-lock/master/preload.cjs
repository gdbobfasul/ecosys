'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getClients: () => ipcRenderer.invoke('get-clients'),
  getInfo: () => ipcRenderer.invoke('get-info'),
  cmd: (p) => ipcRenderer.send('cmd', p),
  onClients: (cb) => ipcRenderer.on('clients', (_e, d) => cb(d)),
  onServerError: (cb) => ipcRenderer.on('server-error', (_e, d) => cb(d)),
});
