// Version: 1.0016
// recovery.js — ПРЕНАСЯНЕ на настройки и знание ИЗВЪН приложението, за да ОЦЕЛЯВАТ деинсталация.
//
// Защо: на Android (особено Huawei/RuStore без Google) при деинсталация ОС-ът трие всичко
// приложенско (Preferences/localStorage). За да не се губят настройките и знанието, ги записваме
// във ФАЙЛ в публична папка Downloads/Pupikes (оцелява деинсталация) + предлагаме Споделяне (потребителят
// го премества където иска). При нова инсталация апът ПИТА и зарежда файла (изборът е на потребителя).
//
// Канали (по решение на собственика — опция „В"):
//   • Запис: Filesystem → Downloads/Pupikes/<име>.json (публично, оцелява); резерв Documents; + Share.
//   • Възстановяване: избор на файл през filepick (надеждно четене в WebView) ИЛИ авто-намиране в Downloads/Pupikes.
//
// Разпознаване на АДМИНА: бекъп файлът носи подписан админ-маркер (виж packs.adminMarker). Ако при
// зареждане маркерът е валиден → апът разпознава админа и отключва админските речници автоматично.
//
// Два вида бекъп:
//   • НАСТРОЙКИ (задължителни за пазене): сървър, лимит памет, език (UI+глас), заключване, автономност,
//     интереси/теми, и СПИСЪКА кои речници се ползват (за повторно сваляне).
//   • ЗНАНИЕ (по избор — иначе на сървъра): памет + теми + задачи.

import { getState, persist, onPersist } from './storage.js';
import { getLang, setLang } from './i18n.js';
import { pickTextFile } from './filepick.js';
import { mergeEntries } from './knowledge.js';
import {
  adminMarker, verifyAdminMarker, unlockAdminByMarker, seedAdminPacks, isAdminUnlocked,
  importBundledPack, importPackFromUrl, importFromCatalog, loadedThemes
} from './packs.js';

const DEFAULT_FOLDER = 'Pupikes';                 // подпапка в Downloads
const DEFAULT_SETTINGS_NAME = 'slf-settings'; // без .json
const DEFAULT_KNOWLEDGE_NAME = 'slf-knowledge';

// ── Нативни плъгини (динамичен import — грациозно null в браузър) ──────────────────────
async function fsMod() { try { return await import('@capacitor/filesystem'); } catch (_) { return null; } }
async function shareApi() { try { const m = await import('@capacitor/share'); return m.Share; } catch (_) { return null; } }
function isNative() {
  try { return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()); }
  catch (_) { return false; }
}

// Настройки за пренасяне (папка/имена/режим). Живеят в settings.recovery.
function recoveryCfg() {
  const r = (getState().settings && getState().settings.recovery) || {};
  return {
    dir: (r.dir || DEFAULT_FOLDER).replace(/[^A-Za-z0-9._-]/g, '') || DEFAULT_FOLDER,
    settingsName: (r.settingsName || DEFAULT_SETTINGS_NAME).replace(/[^A-Za-z0-9._-]/g, '') || DEFAULT_SETTINGS_NAME,
    knowledgeName: (r.knowledgeName || DEFAULT_KNOWLEDGE_NAME).replace(/[^A-Za-z0-9._-]/g, '') || DEFAULT_KNOWLEDGE_NAME,
    autoSave: !!r.autoSave,
    knowledgeTarget: r.knowledgeTarget === 'server' ? 'server' : 'file'  // къде се пази знанието
  };
}
export function getRecoveryCfg() { return recoveryCfg(); }
export function setRecoveryCfg(patch) {
  const st = getState();
  st.settings.recovery = { ...(st.settings.recovery || {}), ...patch };
  persist();
  return recoveryCfg();
}

// ── Изграждане на пакетите ─────────────────────────────────────────────────────────────
export function buildSettingsBundle() {
  const st = getState();
  return {
    app: 'selflearning-friend',
    kind: 'slf-settings',
    version: 1,
    exportedAt: new Date().toISOString(),
    admin: isAdminUnlocked() ? adminMarker() : null,   // разпознаване на админа
    uiLang: getLang(),
    settings: st.settings,          // сървър, памет, глас, заключване, автономност, речници (loadedThemes)…
    interests: st.interests || []
  };
}

export function buildKnowledgeBundle() {
  const st = getState();
  return {
    app: 'selflearning-friend',
    kind: 'slf-knowledge',
    version: 1,
    exportedAt: new Date().toISOString(),
    admin: isAdminUnlocked() ? adminMarker() : null,
    memory: st.memory || [],
    subjects: st.subjects || [],
    interests: st.interests || [],
    tasks: st.tasks || []
  };
}

// ── Запис на файл (публична папка Downloads/Pupikes + резерв + Share) ────────────────────────
async function writeFile(fileName, json) {
  const mod = await fsMod();
  if (!mod) return { ok: false, reason: 'Липсва Filesystem плъгинът (нужен билд с cap sync).' };
  const { Filesystem, Directory, Encoding } = mod;
  const cfg = recoveryCfg();
  const publicPath = `Download/${cfg.dir}/${fileName}`;
  // 1) опит: публична папка Downloads (оцелява деинсталация)
  try {
    try { await Filesystem.requestPermissions(); } catch (_) { /* може да не е нужно */ }
    await Filesystem.writeFile({ path: publicPath, data: json, directory: Directory.ExternalStorage, encoding: Encoding.UTF8, recursive: true });
    let uri = '';
    try { const u = await Filesystem.getUri({ path: publicPath, directory: Directory.ExternalStorage }); uri = u.uri; } catch (_) {}
    return { ok: true, path: `Downloads/${cfg.dir}/${fileName}`, uri, survives: true };
  } catch (e1) {
    // 2) резерв: папката Documents на апа (ВИДИМА, но се ТРИЕ при деинсталация)
    try {
      await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      let uri = '';
      try { const u = await Filesystem.getUri({ path: fileName, directory: Directory.Documents }); uri = u.uri; } catch (_) {}
      return { ok: true, path: `Documents/${fileName}`, uri, survives: false,
        reason: 'Нямаше достъп до Downloads → записах в Documents (трие се при деинсталация). Ползвай „Сподели", за да преместиш файла на сигурно.' };
    } catch (e2) {
      return { ok: false, reason: 'Записът се провали: ' + ((e2 && e2.message) || (e1 && e1.message) || 'неизвестно') };
    }
  }
}

async function finalizeSave(fileName, json, title, share) {
  if (!isNative()) {
    // Браузър (десктоп/тест): сваляне през blob
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { ok: true, path: '(сваляне в браузъра: ' + fileName + ')', survives: true };
    } catch (e) { return { ok: false, reason: 'Браузърният запис се провали.' }; }
  }
  const w = await writeFile(fileName, json);
  if (!w.ok) return w;
  let shared = false;
  if (share) {
    const Share = await shareApi();
    if (Share && w.uri) { try { await Share.share({ title, url: w.uri }); shared = true; } catch (_) { /* потребителят може да откаже */ } }
  }
  return { ...w, shared };
}

// Запис на НАСТРОЙКИТЕ (задължителният локален файл). Връща { ok, path, survives, shared, reason }.
export async function saveSettingsFile({ share = true } = {}) {
  const cfg = recoveryCfg();
  const json = JSON.stringify(buildSettingsBundle(), null, 2);
  const r = await finalizeSave(cfg.settingsName + '.json', json, 'Настройки (SLF)', share);
  if (r.ok) { const st = getState(); st.settings.recovery = { ...(st.settings.recovery || {}), lastSettingsSaveAt: new Date().toISOString(), lastSettingsPath: r.path }; persist(); }
  return r;
}

// Запис на ЗНАНИЕТО в локален файл (алтернатива на сървъра). Връща { ok, path, survives, shared, reason }.
export async function saveKnowledgeFile({ share = true } = {}) {
  const cfg = recoveryCfg();
  const json = JSON.stringify(buildKnowledgeBundle(), null, 2);
  const r = await finalizeSave(cfg.knowledgeName + '.json', json, 'Знание (SLF)', share);
  if (r.ok) { const st = getState(); st.settings.recovery = { ...(st.settings.recovery || {}), lastKnowledgeSaveAt: new Date().toISOString(), lastKnowledgePath: r.path }; persist(); }
  return r;
}

// ── Прилагане на зареден пакет (настройки и/или знание) ──────────────────────────────────
function mergeById(existing, incoming) {
  const out = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(out.map((x) => x && x.id));
  for (const it of (incoming || [])) { if (it && !seen.has(it.id)) { out.push(it); seen.add(it.id); } }
  return out;
}

export async function applyBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return { ok: false, reason: 'Файлът е празен или невалиден.' };
  const st = getState();
  const applied = [];
  let addedKnowledge = 0;

  // Настройки
  if (bundle.settings && typeof bundle.settings === 'object') {
    st.settings = { ...st.settings, ...bundle.settings };
    applied.push('настройки');
  }
  if (Array.isArray(bundle.interests) && bundle.interests.length) {
    st.interests = mergeById(st.interests, bundle.interests.map((x) => (typeof x === 'string' ? { id: x, name: x } : x)));
  }
  if (bundle.uiLang) { try { setLang(bundle.uiLang); } catch (_) {} }

  // Знание (памет/теми/задачи)
  if (Array.isArray(bundle.memory) && bundle.memory.length) { const r = mergeEntries(bundle.memory); addedKnowledge += r.added || 0; applied.push('знание'); }
  if (Array.isArray(bundle.subjects) && bundle.subjects.length) { st.subjects = mergeById(st.subjects, bundle.subjects); }
  if (Array.isArray(bundle.tasks) && bundle.tasks.length) { st.tasks = mergeById(st.tasks, bundle.tasks); }
  persist();

  // Разпознаване на АДМИНА през маркера → отключване на админските речници
  let admin = false;
  if (bundle.admin && verifyAdminMarker(bundle.admin)) {
    unlockAdminByMarker(bundle.admin);
    try { await seedAdminPacks(); } catch (_) {}
    admin = true; applied.push('админ речници');
  }

  // Повторно сваляне на речниците, които потребителят е ползвал (НЕ включва админските)
  let redownloaded = 0;
  const themes = loadedThemes();
  for (const th of themes) {
    try {
      let r = null;
      if (th.bundled) r = importBundledPack(th.bundled);
      else if (th.url) r = await importPackFromUrl(th.url);
      else if (th.theme) r = await importFromCatalog(th.theme);
      if (r && r.ok) redownloaded++;
    } catch (_) {}
  }

  // маркираме, че сме възстановили (за да не пита пак)
  st.settings.recovery = { ...(st.settings.recovery || {}), restoredAt: new Date().toISOString(), restorePrompted: true };
  persist();
  return { ok: true, applied, addedKnowledge, admin, redownloaded, kind: bundle.kind || '' };
}

// Възстановяване чрез ИЗБОР на файл (надеждно в WebView). Връща резултата на applyBundle.
export async function restoreFromPickedFile() {
  const f = await pickTextFile();
  if (!f) return { ok: false, cancelled: true };
  let data; try { data = JSON.parse(f.text); }
  catch (_) { return { ok: false, reason: 'Файлът не е валиден JSON.' }; }
  return applyBundle(data);
}

// ── Авто-намиране на бекъп в Downloads/Pupikes (за питане при нова инсталация) ───────────────
// Връща { found, settings?, knowledge? } със суровия JSON текст на всеки намерен файл.
export async function findLocalRecovery() {
  if (!isNative()) return { found: false };
  const mod = await fsMod(); if (!mod) return { found: false };
  const { Filesystem, Directory, Encoding } = mod;
  const cfg = recoveryCfg();
  const out = {};
  for (const [k, base] of [['settings', cfg.settingsName], ['knowledge', cfg.knowledgeName]]) {
    try {
      const r = await Filesystem.readFile({ path: `Download/${cfg.dir}/${base}.json`, directory: Directory.ExternalStorage, encoding: Encoding.UTF8 });
      if (r && r.data) out[k] = r.data;
    } catch (_) { /* няма такъв файл — нормално */ }
  }
  return { found: !!(out.settings || out.knowledge), files: out };
}

// Зарежда авто-намерените файлове (ако има) — първо настройки, после знание.
export async function applyLocalRecovery() {
  const f = await findLocalRecovery();
  if (!f.found) return { ok: false, reason: 'Няма намерен файл за възстановяване в Downloads.' };
  let res = { ok: false, applied: [], addedKnowledge: 0, admin: false, redownloaded: 0 };
  for (const key of ['settings', 'knowledge']) {
    if (!f.files[key]) continue;
    try { const data = JSON.parse(f.files[key]); const r = await applyBundle(data);
      res = { ok: true, applied: [...res.applied, ...(r.applied || [])], addedKnowledge: res.addedKnowledge + (r.addedKnowledge || 0), admin: res.admin || r.admin, redownloaded: res.redownloaded + (r.redownloaded || 0) };
    } catch (_) {}
  }
  return res;
}

// ── Триене на локалните файлове (за „изтрий при деинсталация" — ръчно, ОС не дава hook) ──
export async function deleteLocalFiles() {
  if (!isNative()) return { ok: false, reason: 'Само на устройство.' };
  const mod = await fsMod(); if (!mod) return { ok: false, reason: 'Липсва Filesystem плъгинът.' };
  const { Filesystem, Directory } = mod;
  const cfg = recoveryCfg();
  let deleted = 0;
  for (const base of [cfg.settingsName, cfg.knowledgeName]) {
    try { await Filesystem.deleteFile({ path: `Download/${cfg.dir}/${base}.json`, directory: Directory.ExternalStorage }); deleted++; } catch (_) {}
    try { await Filesystem.deleteFile({ path: `${base}.json`, directory: Directory.Documents }); } catch (_) {}
  }
  return { ok: true, deleted };
}

// ── АВТО-ЗАПИС: при всяка промяна на настройките пише ТИХО във файла (без Share), с малко
// забавяне (коалесира поредица от промени). Така файлът винаги е актуален и оцелява деинсталация
// (доколкото записът в Downloads успее — иначе резервът е в Documents). Включва се от settings.recovery.autoSave.
let _autoTimer = null;
let _autoSaving = false;   // предпазител против безкраен цикъл (нашите записи пак викат persist)
export function initAutoSave() {
  onPersist(() => {
    if (_autoSaving) return;                 // не реагирай на собствения си запис
    if (!recoveryCfg().autoSave) return;     // изключено → нищо
    if (_autoTimer) { try { clearTimeout(_autoTimer); } catch (_) {} }
    _autoTimer = setTimeout(async () => {
      _autoSaving = true;
      try {
        await saveSettingsFile({ share: false });
        if (recoveryCfg().knowledgeTarget === 'file') { await saveKnowledgeFile({ share: false }); }
      } catch (_) { /* тих неуспех — пробва пак при следваща промяна */ }
      finally { _autoSaving = false; }
    }, 3000);
  });
}

// Има ли смисъл да питаме при старт? (свежа инсталация: без име и без памет, и още непитано)
export function shouldPromptRestore() {
  const st = getState();
  const rec = (st.settings && st.settings.recovery) || {};
  if (rec.restorePrompted || rec.restoredAt) return false;
  const fresh = !(st.identity && st.identity.named) && !(Array.isArray(st.memory) && st.memory.length);
  return fresh;
}
export function markRestorePrompted() {
  const st = getState();
  st.settings.recovery = { ...(st.settings.recovery || {}), restorePrompted: true };
  persist();
}
