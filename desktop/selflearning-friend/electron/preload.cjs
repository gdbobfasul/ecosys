// preload.js — мост между Electron и renderer-а (минимален, контекстно изолиран).
//
// Маркираме честно, че сме десктоп КЛОНИНГ (SLF_DESKTOP) + излагаме ТЯСНО, типизирано
// агентско API (SLF_AGENT) към renderer-а. ВАЖНО: тук НЕ излагаме суров require/
// child_process/fs — само конкретни, именувани IPC извиквания. main процесът изпълнява;
// гейтът по кодова дума + потвърждението живеят в renderer-а (държи разковничето).
//
// Паметта остава localStorage на Electron — напълно отделна от телефона. Нищо от
// SLF_AGENT не съществува в телефонните билдове (rustore/huawei) — те нямат този preload.

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Тясно, типизирано API. Всеки метод е конкретен IPC канал — никакъв произволен достъп.
const agentApi = {
  // 1) Файлова система (в рамките на собственишки избрана базова папка)
  fs: {
    pickBaseDir: () => ipcRenderer.invoke('agent:fs:pickBaseDir'),
    getBaseDir: () => ipcRenderer.invoke('agent:fs:getBaseDir'),
    clearBaseDir: () => ipcRenderer.invoke('agent:fs:clearBaseDir'),
    list: (relPath) => ipcRenderer.invoke('agent:fs:list', String(relPath || '.')),
    read: (relPath) => ipcRenderer.invoke('agent:fs:read', String(relPath || '')),
    write: (relPath, content) =>
      ipcRenderer.invoke('agent:fs:write', String(relPath || ''), String(content == null ? '' : content))
  },
  // 2) Изпълнение на shell команди
  shell: {
    run: (command, opts) =>
      ipcRenderer.invoke('agent:shell:run', String(command || ''), {
        cwd: opts && opts.cwd ? String(opts.cwd) : '',
        timeoutMs: opts && opts.timeoutMs ? Number(opts.timeoutMs) : 60000
      })
  },
  // 3) SSH към машина (Linux/Windows)
  ssh: {
    listHosts: () => ipcRenderer.invoke('agent:ssh:listHosts'),
    saveHost: (host) => ipcRenderer.invoke('agent:ssh:saveHost', sanitizeHost(host)),
    deleteHost: (id) => ipcRenderer.invoke('agent:ssh:deleteHost', String(id || '')),
    run: (hostId, command) =>
      ipcRenderer.invoke('agent:ssh:run', String(hostId || ''), String(command || ''))
  },
  // 4) Playwright (интернет ровене / каране на уеб-апове)
  web: {
    crawl: (url, options) =>
      ipcRenderer.invoke('agent:web:crawl', String(url || ''), sanitizeWebOpts(options))
  },
  // 5) App Builder — скеле на нов апп + билд на APK (през РЕАЛНИЯ shell)
  builder: {
    pickDir: () => ipcRenderer.invoke('agent:builder:pickDir'),
    listApps: () => ipcRenderer.invoke('agent:builder:listApps'),
    scaffold: (opts) => ipcRenderer.invoke('agent:builder:scaffold', sanitizeScaffold(opts)),
    // Стриймнат билд: cwd (абсолютен), команда; парчета пристигат през onStreamData.
    runStream: (command, opts) =>
      ipcRenderer.invoke('agent:shell:stream', String(command || ''), sanitizeStreamOpts(opts)),
    // Абонамент за изхода на стрийма. Връща функция за отписване.
    onStreamData: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const listener = (_e, payload) => {
        const p = payload || {};
        cb({ runId: String(p.runId || ''), stream: String(p.stream || ''), chunk: String(p.chunk || '') });
      };
      ipcRenderer.on('agent:shell:stream:data', listener);
      return () => { try { ipcRenderer.removeListener('agent:shell:stream:data', listener); } catch (_) {} };
    }
  }
};

function sanitizeScaffold(o) {
  o = o || {};
  return {
    dir: String(o.dir || ''),
    appName: o.appName ? String(o.appName) : '',
    appId: o.appId ? String(o.appId) : '',
    force: o.force === true
  };
}

function sanitizeStreamOpts(o) {
  o = o || {};
  const out = {
    cwd: o.cwd ? String(o.cwd) : '',
    runId: o.runId ? String(o.runId) : '',
    timeoutMs: o.timeoutMs ? Number(o.timeoutMs) : 600000
  };
  if (o.env && typeof o.env === 'object') {
    out.env = {};
    for (const k of Object.keys(o.env)) out.env[String(k)] = String(o.env[k]);
  }
  return out;
}

// Чистим/типизираме входа от renderer-а, преди да тръгне по IPC (без сурови обекти).
function sanitizeHost(h) {
  h = h || {};
  return {
    id: h.id ? String(h.id) : '',
    label: h.label ? String(h.label) : '',
    host: String(h.host || ''),
    port: Number(h.port) || 22,
    username: String(h.username || ''),
    password: h.password ? String(h.password) : '',
    privateKeyPath: h.privateKeyPath ? String(h.privateKeyPath) : '',
    passphrase: h.passphrase ? String(h.passphrase) : ''
  };
}

function sanitizeWebOpts(o) {
  o = o || {};
  const actions = Array.isArray(o.actions) ? o.actions.slice(0, 20).map((a) => ({
    type: String(a.type || ''),
    selector: a.selector ? String(a.selector) : '',
    value: a.value != null ? String(a.value) : '',
    url: a.url ? String(a.url) : '',
    ms: a.ms ? Number(a.ms) : 0
  })) : [];
  return {
    channel: o.channel ? String(o.channel) : '',
    actions
  };
}

try {
  contextBridge.exposeInMainWorld('SLF_DESKTOP', true);
  contextBridge.exposeInMainWorld('SLF_DESKTOP_INFO', {
    platform: process.platform,
    isClone: true
  });
  contextBridge.exposeInMainWorld('SLF_AGENT', agentApi);
} catch (e) {
  // Ако context isolation е изключена по някаква причина — тих провал, апът работи.
  try {
    window.SLF_DESKTOP = true;
    window.SLF_AGENT = agentApi;
  } catch (_) {}
}
