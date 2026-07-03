// Version: 1.0001
// aegis-import.js — споделен поток за импорт от Aegis файл (ползва се и от „+", и от Настройки).
// Aegis по подразбиране КРИПТИРА експорта → ако файлът е криптиран, питаме паролата и
// декриптираме (scrypt + AES-GCM); при грешна парола питаме пак. Плейн файловете влизат директно.
import { toast, promptPassword } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { importAegisText, importAegisEncrypted, describeResult } from '../core/importer.js';

export function importAegisFile(file, after) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const text = reader.result;
    let res = await importAegisText(text);
    // Криптиран → искаме парола (с повторни опити, докато не успее или не откаже).
    while (res && !res.ok && res.reason === 'encrypted') {
      const pw = await promptPassword(t('aegis_password_prompt'), t('save'), t('cancel'));
      if (pw == null) return;                       // отказ → нищо не показваме
      res = await importAegisEncrypted(text, pw);
      if (res && !res.ok && res.reason === 'password') {
        toast(t('aegis_bad_password'));
        res = { ok: false, reason: 'encrypted' };   // върни се към питане на парола
      }
    }
    toast(describeResult(res));
    if (after) { try { after(res); } catch (_) {} }
  };
  reader.readAsText(file);
}
