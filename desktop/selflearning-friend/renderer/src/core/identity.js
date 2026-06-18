// identity.js — раждане (кръщаване) и заключване за 1 потребител.
//
// Концепция: името на бота Е тайната за достъп (РАЗКОВНИЧЕ). При раждане собственикът
// избира име/кодова дума (напр. „Пешо“). Пазим SHA-256 хеш на нормализираното име (НЕ
// открито). На всяко отваряне ботът пита „Как се казвам?“ и допуска само този, който
// въведе точното име. Грешни опити → дружелюбен отказ, лимит + cooldown.
//
// ВАЖНО (промяна): кодовата дума Е САМО ЕДНА ДУМА (без интервали). НЯМА подсказка —
// забравиш ли я, единственият изход е „Започни отначало“ (factory reset). Това е
// съзнателно: подсказката отслабваше тайната.

import { getState, setState, persist } from './storage.js';
import { captureDeviceFingerprint, clearLockdownAfterReauth, rebindToCurrentDevice } from './device.js';

// Нормализация: trim + малки букви. БЕЗ интервали — кодовата дума е една дума.
function normalize(name) {
  return String(name || '').trim().toLowerCase();
}

// Проверка „една дума“: непразно, без вътрешни интервали/whitespace.
// Връща { ok, reason } — reason е готово за показване на български.
export function validateSingleWord(name) {
  const raw = String(name || '').trim();
  if (raw.length < 2) return { ok: false, reason: 'Кодовата дума трябва да е поне 2 знака.' };
  if (raw.length > 24) return { ok: false, reason: 'Кодовата дума е твърде дълга (макс. 24 знака).' };
  if (/\s/.test(raw)) return { ok: false, reason: 'Само една дума, без интервали.' };
  return { ok: true };
}

// SHA-256 (hex) през Web Crypto, ако е наличен; иначе синхронен fallback (FNV-1a).
// И двата са детерминистични локално — достатъчно за лок на устройство (НЕ е банкова тайна).
export async function hashName(name) {
  const norm = normalize(name);
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const data = new TextEncoder().encode('slf:' + norm);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) { /* пада към fallback */ }
  return 'fnv:' + fnv1a('slf:' + norm);
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function isNamed() {
  return !!getState().identity.named;
}

// Кръщаване на бота (еднократно — раждането). Връща обновеното състояние.
// Изисква ЕДНА дума (без интервали). НЕ пази подсказка.
// opts.dataMode: 'personal' | 'impersonal' — глобален избор за лични данни (виж privacy.js).
export async function nameBot(name, opts = {}) {
  const v = validateSingleWord(name);
  if (!v.ok) throw new Error(v.reason);
  const norm = normalize(name);
  const nameHash = await hashName(norm);
  const id = getState().identity;
  const dataMode = (opts && opts.dataMode === 'impersonal') ? 'impersonal' : 'personal';
  // Анти-кражба: при раждането вързваме самоличността към устройството (отпечатък).
  let fingerprint = null;
  try { fingerprint = await captureDeviceFingerprint(); } catch (_) { /* по избор */ }
  const prevDevice = getState().device || {};
  // В безличен режим изключваме гласовия профил (лична биометрия) още при раждането.
  const st0 = getState();
  if (dataMode === 'impersonal' && st0.settings && st0.settings.voice && st0.settings.voice.profile) {
    st0.settings.voice.profile.enabled = false;
  }
  setState({
    identity: {
      ...id,
      named: true,
      nameHash,
      nameHint: null,      // БЕЗ подсказка — забравиш ли думата, остава само reset
      avatarSeed: avatarSeedFrom(norm),
      bornAt: Date.now(),
      dataMode
    },
    lock: { unlockedAt: Date.now(), failCount: 0, cooldownUntil: null },
    device: {
      ...prevDevice,
      fingerprint,
      lockdown: { active: false, reason: null, since: null, deviceChangeFlagged: false },
      history: Array.isArray(prevDevice.history) ? prevDevice.history : []
    }
  });
  return getState();
}

// Стабилен seed за лицето на героя (числа от името).
function avatarSeedFrom(norm) {
  let s = 0;
  for (let i = 0; i < norm.length; i++) s = (s * 31 + norm.charCodeAt(i)) >>> 0;
  return s;
}

// Дали в момента сме отключени (валидна сесия и без изтекла неактивност).
export function isUnlocked() {
  const st = getState();
  if (!st.identity.named) return false;
  const { unlockedAt } = st.lock;
  if (!unlockedAt) return false;
  if (!st.settings.askOnReopen) return true;
  const idleMs = (st.settings.inactivityMin || 10) * 60 * 1000;
  return (Date.now() - unlockedAt) < idleMs;
}

// Подновяване на „жива“ сесия при активност.
export function touchSession() {
  const st = getState();
  if (!st.identity.named || !st.lock.unlockedAt) return;
  st.lock.unlockedAt = Date.now();
  persist();
}

// Изрично заключване (бутон „Заключи“).
export function lock() {
  const st = getState();
  st.lock.unlockedAt = null;
  persist();
}

// Дали сме в cooldown (твърде много грешни опити).
export function cooldownRemainingMs() {
  const until = getState().lock.cooldownUntil;
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

// Опит за отключване с въведено име. Връща { ok, reason, attemptsLeft, cooldownMs }.
export async function tryUnlock(name) {
  const st = getState();
  const cd = cooldownRemainingMs();
  if (cd > 0) return { ok: false, reason: 'cooldown', cooldownMs: cd };

  const given = await hashName(name);
  if (given === st.identity.nameHash) {
    st.lock.unlockedAt = Date.now();
    st.lock.failCount = 0;
    st.lock.cooldownUntil = null;
    persist();
    // Ако е имало lockdown заради смяна на устройство — правилното име го сваля,
    // но оставяме видим флаг, че е имало смяна (честност + следа).
    let deviceChanged = false;
    if (st.device && st.device.lockdown && st.device.lockdown.active) {
      deviceChanged = true;
      clearLockdownAfterReauth();
      try { await rebindToCurrentDevice(); } catch (_) { /* по избор */ }
    }
    return { ok: true, deviceChanged };
  }

  // Грешен опит.
  st.lock.failCount = (st.lock.failCount || 0) + 1;
  const max = st.settings.maxAttempts || 5;
  let cooldownMs = 0;
  if (st.lock.failCount >= max) {
    cooldownMs = (st.settings.cooldownMin || 2) * 60 * 1000;
    st.lock.cooldownUntil = Date.now() + cooldownMs;
    st.lock.failCount = 0; // нулираме брояча след активиран cooldown
  }
  persist();
  return {
    ok: false,
    reason: cooldownMs ? 'cooldown' : 'wrong',
    attemptsLeft: cooldownMs ? 0 : (max - st.lock.failCount),
    cooldownMs
  };
}

// Проверка дали въведената дума СЪВПАДА с кодовата дума на бота (разковничето).
// Ползва се от гейта на агентските суперсили — НЕ отключва сесия, само сравнява.
// Връща true/false. (Същата логика като commands.wordMatches, но изнесена за preload-а.)
export async function verifyCodeWord(word) {
  const st = getState();
  if (!st.identity || !st.identity.nameHash) return false;
  const given = await hashName(word);
  return given === st.identity.nameHash;
}

// Смяна на кодовата дума (re-key). Изисква ТЕКУЩАТА дума за потвърждение + новата
// да е една дума. Връща { ok, reason }. Викащият подава вече валидирания текущ word
// (командният слой гейтва), но проверяваме пак за сигурност.
export async function rekeyName(currentWord, newWord) {
  const st = getState();
  if (!st.identity.named) return { ok: false, reason: 'Още не съм кръстен.' };
  const cur = await hashName(currentWord);
  if (cur !== st.identity.nameHash) {
    return { ok: false, reason: 'Грешна текуща кодова дума.' };
  }
  const v = validateSingleWord(newWord);
  if (!v.ok) return { ok: false, reason: v.reason };
  const norm = normalize(newWord);
  st.identity.nameHash = await hashName(norm);
  st.identity.nameHint = null;
  st.identity.avatarSeed = avatarSeedFrom(norm);
  st.lock.unlockedAt = Date.now();
  persist();
  return { ok: true };
}
