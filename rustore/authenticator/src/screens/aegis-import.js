// Version: 1.0001
// aegis-import.js — споделен поток за импорт от Aegis файл (ползва се и от „+", и от Настройки).
// Aegis по подразбиране КРИПТИРА експорта → ако файлът е криптиран, питаме паролата и
// декриптираме (scrypt + AES-GCM); при грешна парола питаме пак. Плейн файловете влизат директно.
import { toast, promptPassword, showAlert } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { importAegisText, importAegisEncrypted, describeResult } from '../core/importer.js';

// Дебъг: показва ПОСТОЯНЕН диалог с цялата диагностика (за да се вижда защо не влизат записите).
function debugReport(dbg, res, err) {
  const lines = ['=== Aegis import debug ===', ...dbg];
  if (err) lines.push('EXCEPTION: ' + (err && (err.stack || err.message) || err));
  if (res) {
    lines.push('reason: ' + (res.reason || (res.ok ? 'ok' : '?')));
    if (res.detail) lines.push('detail: ' + res.detail);
    if (res.diag) lines.push('diag: ' + res.diag);
    if (res.imported != null) lines.push('imported: ' + res.imported + ', duplicates: ' + res.duplicates);
  }
  showAlert('Aegis debug', lines.join('\n'));
}

export function importAegisFile(file, after) {
  if (!file) return;
  const dbg = [];
  const reader = new FileReader();
  reader.onerror = () => debugReport(['FileReader.onerror: ' + (reader.error && reader.error.message)], null, reader.error);
  reader.onload = async () => {
    try {
      const text = reader.result;
      dbg.push('file=' + (file.name || '?') + ' size=' + (file.size != null ? file.size : (text ? text.length : '?')) + ' chars=' + (text ? text.length : 0));
      let res = await importAegisText(text);
      dbg.push('первый parse → ' + (res.ok ? 'ok imported=' + res.imported : 'reason=' + res.reason));
      // Криптиран → искаме парола (с повторни опити, докато не успее или не откаже).
      while (res && !res.ok && res.reason === 'encrypted') {
        const pw = await promptPassword(t('aegis_password_prompt'), t('save'), t('cancel'));
        if (pw == null) { dbg.push('парола отказана'); return; }   // отказ → нищо не показваме
        res = await importAegisEncrypted(text, pw);
        dbg.push('decrypt → ' + (res.ok ? 'ok imported=' + res.imported : 'reason=' + res.reason) + (res.diag ? ' [' + res.diag + ']' : ''));
        if (res && !res.ok && res.reason === 'password') {
          toast(t('aegis_bad_password'));
          // Грешна парола → покажи дебъга ВЕДНАГА (за да се види scrypt/slot следата), после питай пак.
          debugReport(dbg, res);
          res = { ok: false, reason: 'encrypted' };   // върни се към питане на парола
        }
      }
      toast(describeResult(res));
      // При всеки НЕуспех, който не е чиста грешна парола → покажи пълния дебъг.
      if (res && !res.ok) debugReport(dbg, res);
      if (after) { try { after(res); } catch (_) {} }
    } catch (err) {
      debugReport(dbg, null, err);   // необработено изключение → сега се ВИЖДА
    }
  };
  reader.readAsText(file);
}
