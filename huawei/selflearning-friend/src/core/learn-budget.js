// Version: 1.0001
// learn-budget.js — БЮДЖЕТ за дълбокото учене според УСТРОЙСТВОТО и лимита на базата.
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

// Лимит на базата (MB): от настройките, иначе по подразбиране според устройството.
export function maxDbMB() {
  const s = (getState().settings && getState().settings.learning) || {};
  if (typeof s.maxDbMB === 'number' && s.maxDbMB > 0) return s.maxDbMB;
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
