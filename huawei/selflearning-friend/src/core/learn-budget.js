// Version: 1.0010
// learn-budget.js — БЮДЖЕТ за дълбокото учене според УСТРОЙСТВОТО, РЕАЛНИЯ ДИСК и лимита на базата.
//
// Идея (за да НЕ забива телефона):
//   • Телефон (Android/iOS) → ЛЕКИ обхождания + ТВЪРД таван от ХХ MB на локалната база.
//   • Десктоп (.exe) или свързан СЕРИОЗЕН сървър с ПОТВЪРДЕНИ параметри (features.deepCrawl)
//     → ДЪЛБОКИ обхождания (хиляди бележки), защото има диск/RAM.
//
// Лимитът в MB е настройваем (Настройки) и важи като СПИРАЧКА на обхождането: щом базата
// стигне лимита, обхождането спира (не пълним до счупване на localStorage/Preferences).

import { getState } from './storage.js';
import { serverLinkConfigured, serverFeatures } from './server-link.js';

// Какво устройство сме: 'mobile' (телефон), 'desktop' (.exe/Electron) или 'web' (dev браузър).
export function platformKind() {
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      const p = (typeof cap.getPlatform === 'function') ? cap.getPlatform() : '';
      return (p === 'android' || p === 'ios') ? 'mobile' : 'desktop';
    }
    if (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent || '')) return 'desktop';
  } catch (_) { /* без window/navigator */ }
  return 'web';
}

// Приблизителен размер на локалната база (байтове, UTF-8).
export function dbSizeBytes() {
  let json = '';
  try { json = JSON.stringify(getState()); } catch (_) { return 0; }
  try { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(json).length; } catch (_) { /* fallback */ }
  return json.length * 2; // груба оценка (кирилица ~2 байта/символ)
}
export function dbSizeMB() { return dbSizeBytes() / (1024 * 1024); }

// РЕАЛЕН капацитет на устройството (navigator.storage.estimate): колко МОЖЕ да поеме машината.
// Връща { quotaMB, usageMB, freeMB } или null (стар WebView). Кешира се за 60с.
let _capCache = null, _capAt = 0;
export async function diskCapacity() {
  if (_capCache && (Date.now() - _capAt) < 60000) return _capCache;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      const quotaMB = Math.floor((e.quota || 0) / (1024 * 1024));
      const usageMB = Math.floor((e.usage || 0) / (1024 * 1024));
      _capCache = { quotaMB, usageMB, freeMB: Math.max(0, quotaMB - usageMB) };
      _capAt = Date.now();
      return _capCache;
    }
  } catch (_) {}
  return null;
}

// ГОРНА ГРАНИЦА за плъзгача на общия лимит — според МАШИНАТА (тип + реална квота) и сървъра.
// Телефонът е най-стеснен (Preferences/localStorage не са безкраен диск), компютърът е широк,
// а свързан сървър (виртуалка/продъкшън) с обявено features.maxDbMB разширява тавана.
export async function machineMaxMB() {
  const k = platformKind();
  let cap = k === 'mobile' ? 128 : (k === 'desktop' ? 2048 : 64);
  const disk = await diskCapacity();
  if (disk && disk.quotaMB > 0) cap = Math.min(cap, Math.max(8, Math.floor(disk.quotaMB / 2)));
  try {
    if (serverLinkConfigured()) {
      const f = serverFeatures();
      if (f && Number(f.maxDbMB) > 0) cap = Math.max(cap, Math.floor(Number(f.maxDbMB)));
      else if (f && (f.deepCrawl === true || f.deep === true)) cap = Math.max(cap, 1024);
    }
  } catch (_) {}
  return cap;
}

// КЪДЕ живее базата (за показ в Настройки): локално според устройството; свързаният сървър
// (виртуалка/продъкшън) разширява бюджета, но данните остават локални — казваме го честно.
export function storageLocation() {
  const k = platformKind();
  const base = k === 'mobile' ? 'phone' : (k === 'desktop' ? 'desktop' : 'web');
  let server = false;
  try { server = !!serverLinkConfigured(); } catch (_) {}
  return { base, server, deep: deepAllowed() };
}

// Лимит на базата (MB): от настройките, иначе по подразбиране според устройството И
// свързания сървър. Свързан сериозен сървър (виртуалка/продъкшън) с обявен таван вдига
// лимита над телефонните 8 MB — затова на виртуалната „0/8 MB" вече става „0/512 MB" и т.н.
export function maxDbMB() {
  const s = (getState().settings && getState().settings.learning) || {};
  if (typeof s.maxDbMB === 'number' && s.maxDbMB > 0) return s.maxDbMB;
  // Свързан сървър с обявен features.maxDbMB → него (иначе deepCrawl → 512 MB).
  try {
    if (serverLinkConfigured()) {
      const f = serverFeatures();
      if (f && Number(f.maxDbMB) > 0) return Math.floor(Number(f.maxDbMB));
      if (f && (f.deepCrawl === true || f.deep === true)) return 512;
    }
  } catch (_) { /* без сървър → падни към устройството */ }
  const k = platformKind();
  if (k === 'mobile') return 8;     // телефон: пести — 8 MB по подразбиране
  if (k === 'desktop') return 256;  // десктоп: има място
  return 16;                        // dev/браузър
}
export function setMaxDbMB(mb) {
  const st = getState();
  st.settings.learning = { ...(st.settings.learning || {}), maxDbMB: Math.max(1, Math.round(Number(mb) || 0)) };
  return st.settings.learning.maxDbMB;
}

// ЛИМИТ НА ЕДНА ТЕМА (брой бележки) — плъзгач в Настройки. Спира трупането по конкретна
// тема, за да не изяде една тема целия общ лимит. По подразбиране според режима.
export function perTopicNotes() {
  const s = (getState().settings && getState().settings.learning) || {};
  if (typeof s.perTopicNotes === 'number' && s.perTopicNotes > 0) return s.perTopicNotes;
  return deepAllowed() ? 5000 : 600;
}
export function setPerTopicNotes(n) {
  const st = getState();
  st.settings.learning = { ...(st.settings.learning || {}), perTopicNotes: Math.max(20, Math.round(Number(n) || 0)) };
  return st.settings.learning.perTopicNotes;
}

// Позволено ли е ДЪЛБОКО обхождане (над лекия лимит): само десктоп ИЛИ свързан към сървър,
// който е ПОТВЪРДИЛ, че може да поеме (features.deepCrawl / features.deep).
export function deepAllowed() {
  if (platformKind() === 'desktop') return true;
  try {
    if (serverLinkConfigured()) {
      const f = serverFeatures();
      if (f && (f.deepCrawl === true || f.deep === true)) return true;
    }
  } catch (_) { /* без сървър */ }
  return false;
}

// СТРАТЕГИЯ на телефона при СЪЩИЯ таван MB (избор на клиента):
//   'deep'  → 1 ПО-ДЪЛБОКО обхождане (харчи повече от бюджета на ЕДНА тема).
//   'light' → МНОГО ПО-ЛЕКИ обхождания (по-малко на тема → събират се повече теми под тавана).
// По подразбиране 'light' (по-щадящо и по-разнообразно). Важи само когато НЕ е „сериозен" режим.
export function crawlMode() {
  const s = (getState().settings && getState().settings.learning) || {};
  return s.crawlMode === 'deep' ? 'deep' : 'light';
}
export function setCrawlMode(mode) {
  const st = getState();
  st.settings.learning = { ...(st.settings.learning || {}), crawlMode: (mode === 'deep' ? 'deep' : 'light') };
  return st.settings.learning.crawlMode;
}

// Кой AI ползва апът СЕГА (за изричен показ на нивото):
//   'server' → локален модел на свързан НОРМАЛЕН сървер (ниво 3);
//   'cloud'  → облачен Pollinations (телефон/ниво 1, или СЛАБ сървер/ниво 2);
//   'rules'  → без AI (само правила).
export function aiSource() {
  try {
    const t = (getState().settings && getState().settings.teacher) || {};
    if (serverLinkConfigured() && t.endpoint && t.approved) return { mode: 'server', label: 'сървърен модел (локален на сървъра)' };
  } catch (_) { /* без сървър */ }
  try { if (getState().settings && getState().settings.useAi) return { mode: 'cloud', label: 'облачен (Pollinations)' }; } catch (_) {}
  return { mode: 'rules', label: 'само правила (без AI)' };
}

// Бюджет за ЕДНО обхождане: цел брой бележки, таван заявки и ТВЪРД таван на базата (байтове).
// Тванът MB е ОБЩ (спирачка на базата) и важи при ВСЯКА стратегия; стратегията мени само колко
// взима ЕДНО обхождане (дълбоко по 1 тема vs леко по много теми).
export function learnBudget() {
  const deep = deepAllowed();
  const mb = maxDbMB();
  const maxDbBytes = mb * 1024 * 1024;
  if (deep) {
    // Десктоп/сериозен сървер — истинско дълбоко.
    return { deep: true, mode: 'deep', platform: platformKind(), targetNotes: 1000, maxRequests: 90, maxDbMB: mb, maxDbBytes };
  }
  // ТЕЛЕФОН/браузър — изборът на клиента при СЪЩИЯ таван MB.
  const mode = crawlMode();
  const targetNotes = mode === 'deep' ? 800 : 150;   // 1 дълбоко (800) vs леко по много теми (150)
  const maxRequests = mode === 'deep' ? 60 : 12;
  return { deep: false, mode, platform: platformKind(), targetNotes, maxRequests, maxDbMB: mb, maxDbBytes };
}
