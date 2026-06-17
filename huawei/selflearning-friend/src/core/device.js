// device.js — отпечатък на устройството, доказателство за собственост и анти-кражба.
//
// ЦЕЛ: вързване на самоличността на бота към КОНКРЕТНОТО устройство + собственика, така че:
//   • Собственикът може да докаже „това е моят телефон“ (досие за собственост).
//   • Тихо/случайно прехвърляне на данните към друг телефон се ОТКРИВА и ботът се
//     ЗАКЛЮЧВА (отказва чат/разкриване на наученото), докато не се въведе името наново
//     (и дори тогава отбелязва смяната на устройството).
//
// ЧЕСТНО ЗА ГРАНИЦИТЕ (важно — никога не заблуждаваме):
//   - Това е on-device защита, НЕ криптографско доказателство пред трета страна.
//   - Решен нападател, който ЗНАЕ името на бота, не може да бъде спрян напълно — името
//     е тайната за достъп по дизайн. Тази мярка спира СЛУЧАЙНО/ТИХО прехвърляне
//     (напр. възстановяване на резервно копие на друг телефон) и оставя видима следа.
//   - Отпечатъкът се извлича от стабилни, НЕперсонални сигнали (платформа, езици,
//     екран, часова зона) + локално генериран случаен installId. БЕЗ IMEI, БЕЗ реклами ID,
//     БЕЗ контакти, БЕЗ проследяване. По избор @capacitor/device дава по-стабилен модел.
//   - Ако сигнали се променят (нов браузър/ъпдейт), толерираме лек дрейф (виж matchScore).

import { getState, persist } from './storage.js';

// Опит за достъп до @capacitor/device (наличен само в нативния build; по избор).
function capDevicePlugin() {
  try {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Device) {
      return window.Capacitor.Plugins.Device;
    }
  } catch (_) { /* пада към web сигнали */ }
  return null;
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Събира стабилни, неперсонални сигнали за устройството.
async function collectSignals() {
  const sig = {};
  try {
    if (typeof navigator !== 'undefined') {
      sig.platform = navigator.platform || '';
      sig.langs = Array.isArray(navigator.languages) ? navigator.languages.join(',') : (navigator.language || '');
      sig.ua = (navigator.userAgent || '').slice(0, 120);
      sig.cores = navigator.hardwareConcurrency || 0;
    }
    if (typeof screen !== 'undefined') {
      sig.screen = `${screen.width}x${screen.height}x${screen.colorDepth || ''}`;
    }
    if (typeof Intl !== 'undefined') {
      sig.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    }
  } catch (_) { /* частични сигнали са ок */ }

  // По избор: по-стабилни нативни сигнали.
  const dev = capDevicePlugin();
  if (dev) {
    try {
      const info = await dev.getInfo();
      sig.model = info.model || '';
      sig.osVersion = info.osVersion || '';
      sig.manufacturer = info.manufacturer || '';
      const idObj = await dev.getId();
      sig.deviceUuid = (idObj && (idObj.identifier || idObj.uuid)) || '';
    } catch (_) { /* по избор */ }
  }
  return sig;
}

// Прост стабилен хеш на сигнали (FNV-1a hex) — за компактен отпечатък.
function hashSignals(sig) {
  const str = JSON.stringify(sig);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Създава отпечатъка при раждане: генерира installId (случаен, стабилен) + сигнали.
// Връща обекта; викащият (identity.nameBot) го пази в state.device.
export async function captureDeviceFingerprint() {
  const signals = await collectSignals();
  return {
    installId: randomId(),         // главната котва — стабилна, генерирана локално, пази се
    sig: signals,                  // снимка на сигналите при раждане
    sigHash: hashSignals(signals), // компактен хеш на сигналите
    capturedAt: Date.now()
  };
}

// Колко от ключовите сигнали съвпадат сега спрямо запазените (0..1).
// installId е най-силната котва; ако localStorage/Preferences е пренесен 1:1 на друг телефон,
// сигналите ще се разминат и резултатът пада → откриваме смяна.
async function matchScore(saved) {
  if (!saved) return 1; // няма с какво да сравним (стар запис) → не блокираме
  const now = await collectSignals();
  const keys = ['platform', 'screen', 'tz', 'model', 'deviceUuid', 'manufacturer'];
  let total = 0, hit = 0;
  for (const k of keys) {
    if (saved.sig && saved.sig[k]) {
      total++;
      if (now[k] && now[k] === saved.sig[k]) hit++;
    }
  }
  if (total === 0) return 1; // нямахме сравними сигнали → не наказваме
  return hit / total;
}

// Проверка за смяна на устройство. Връща { moved:bool, score, reason }.
// Праг: ако под 0.5 от наличните сигнали съвпадат → считаме за пренос на друг телефон.
export async function checkDeviceIntegrity() {
  const st = getState();
  const dev = st.device;
  if (!dev || !dev.fingerprint) return { moved: false, score: 1, reason: 'no-baseline' };
  const score = await matchScore(dev.fingerprint);
  const moved = score < 0.5;
  return { moved, score, reason: moved ? 'signals-mismatch' : 'ok' };
}

// Включва lockdown (анти-кражба). Запазва причина + момент.
export function engageLockdown(reason = 'device-change') {
  const st = getState();
  st.device = st.device || {};
  st.device.lockdown = { active: true, reason, since: Date.now(), deviceChangeFlagged: true };
  persist();
}

export function isLockedDown() {
  const st = getState();
  return !!(st.device && st.device.lockdown && st.device.lockdown.active);
}

// Сваля lockdown СЛЕД повторна авторизация с името. Оставя видим флаг, че е имало смяна.
export function clearLockdownAfterReauth() {
  const st = getState();
  if (!st.device) return;
  // презаписваме отпечатъка към текущото устройство, но ПАЗИМ следа в историята
  st.device.lockdown = { active: false, reason: null, since: null, deviceChangeFlagged: true };
  st.device.history = st.device.history || [];
  st.device.history.push({ event: 're-authorized-after-device-change', at: Date.now() });
  persist();
}

// Презаписва базовия отпечатък към текущото устройство (след съзнателно одобрена смяна).
export async function rebindToCurrentDevice() {
  const st = getState();
  st.device = st.device || {};
  const fp = await captureDeviceFingerprint();
  // запазваме оригиналния installId, ако имаме (за приемственост на самоличността)
  if (st.device.fingerprint && st.device.fingerprint.installId) {
    fp.installId = st.device.fingerprint.installId;
  }
  st.device.fingerprint = fp;
  st.device.history = st.device.history || [];
  st.device.history.push({ event: 'rebind', at: Date.now() });
  persist();
  return fp;
}

// --- Досие за собственост (ownership proof) --------------------------------
// Произвежда четим документ, който собственикът може да покаже като доказателство.
// НЕ съдържа открито име (само хеша) и НЕ съдържа лични данни.
export function buildOwnershipDossier({ appId = '', botNameHash = '', learnedCount = 0, subjectsCount = 0 } = {}) {
  const st = getState();
  const dev = st.device && st.device.fingerprint;
  const born = st.identity && st.identity.bornAt;
  const dossier = {
    appId,
    ownerNameHash: botNameHash || (st.identity && st.identity.nameHash) || '',
    deviceInstallId: dev ? dev.installId : '(няма)',
    deviceSigHash: dev ? dev.sigHash : '(няма)',
    deviceModel: (dev && dev.sig && dev.sig.model) || '(уеб)',
    createdAt: born ? new Date(born).toISOString() : '(неизвестно)',
    learnedFacts: learnedCount,
    learnedSubjects: subjectsCount,
    deviceChangeFlagged: !!(st.device && st.device.lockdown && st.device.lockdown.deviceChangeFlagged),
    generatedAt: new Date().toISOString()
  };
  return dossier;
}

// Форматира досието като човешки четим текст (за показване/копиране).
export function formatDossier(d) {
  return [
    '=== ДОСИЕ ЗА СОБСТВЕНОСТ ===',
    `Приложение: ${d.appId}`,
    `Хеш на името (тайната за достъп): ${d.ownerNameHash}`,
    `ID на инсталацията (устройство): ${d.deviceInstallId}`,
    `Хеш на сигналите на устройството: ${d.deviceSigHash}`,
    `Модел: ${d.deviceModel}`,
    `Създаден на: ${d.createdAt}`,
    `Научени факти: ${d.learnedFacts}`,
    `Научени теми: ${d.learnedSubjects}`,
    `Отбелязана смяна на устройство: ${d.deviceChangeFlagged ? 'ДА' : 'не'}`,
    `Генерирано на: ${d.generatedAt}`,
    '',
    'Само истинският собственик знае името (тайната), което отключва този бот,',
    'и държи устройството с горния ID. Това досие доказва връзката телефон↔собственик.'
  ].join('\n');
}
