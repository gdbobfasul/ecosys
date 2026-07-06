// Version: 1.0013
// settings.js — настройки: език, авто-заключване, биометрия, смяна на парола,
// импорт/експорт (всички варианти, същите като при бутона „+") и изтриване на сейфа.
import { h, mount, toast, showAlert, promptPassword } from '../ui/dom.js';
import { t, tf, getLang, languageByCode } from '../core/i18n.js';
import {
  loadSettings, saveSettings, session, changePassword, wipeVault, autoLockSeconds
} from '../core/storage.js';
import {
  biometricAvailable, biometricVerify, biometricStorePassword, biometricClear
} from '../core/biometric.js';
import { importJsonText, import2FASText, import2FASEncrypted, importOtpauthList, importPasswordsCsv, importSeedsJson, describeResult } from '../core/importer.js';
import { importAegisFile } from './aegis-import.js';
import { pickTextFile } from '../core/filepick.js';
import { exportJsonFile, exportAegisFile, export2FASFile, exportOtpauthListFile, exportGoogleQR, exportChromiumCsv, exportFirefoxCsv, exportSeedsJson } from '../core/exporter.js';
import { exportAllQR } from '../core/qrexport.js';

// Опции за авто-заключване при бездействие (В СЕКУНДИ; 0 = никога). По молба:
// 30 сек, 1 мин, 5 мин, 10 мин, 15 мин, 30 мин, 1 час, никога.
const LOCK_OPTIONS = [30, 60, 300, 600, 900, 1800, 3600, 0];
function lockLabel(sec) {
  if (sec === 0) return t('never');
  if (sec < 60) return tf('secs', sec);
  if (sec % 3600 === 0) return tf('hours', sec / 3600);
  return tf('minutes', sec / 60);
}

export function renderSettings(root, nav) {
  const st = loadSettings();

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list') }, '←'),
    h('h1', { text: t('settings_title') })
  );

  // --- Език ---
  const langRow = settingRow(t('language'),
    h('button', { class: 'btn ghost', style: 'width:auto;margin:0', onclick: () => nav.go('language') },
      languageByCode(getLang()).native));

  // --- Авто-заключване (секунди) ---
  const curLock = autoLockSeconds();
  const lockSel = h('select', { style: 'width:auto;margin:0',
    onchange: (e) => saveSettings({ autoLockSec: parseInt(e.target.value, 10) }) },
    ...LOCK_OPTIONS.map((sec) => {
      const o = h('option', { value: String(sec) }, lockLabel(sec));
      if (sec === curLock) o.setAttribute('selected', 'selected');
      return o;
    }));
  const lockRow = settingRow(t('autolock'), lockSel);

  // --- Заключване при смяна на приложението (загуба на фокус) ---
  // Включено (подразбиране) → заключва ВЕДНАГА при излизане на заден план.
  // Изключено → НЕ заключва при смяна; важи само таймаутът за бездействие
  // (изтече ли, докато си в друго приложение — заключва при връщането).
  const blurInput = h('input', { type: 'checkbox' });
  if (st.lockOnBlur !== false) blurInput.checked = true;
  blurInput.addEventListener('change', () => {
    saveSettings({ lockOnBlur: !!blurInput.checked });
    toast(blurInput.checked ? t('lock_on_blur_on') : t('lock_on_blur_off'));
  });
  const blurRow = settingRow(t('lock_on_blur'),
    h('label', { class: 'switch' }, blurInput, h('span', { class: 'track' }, h('span', { class: 'knob' }))));

  // --- Биометрия ---
  const bioInput = h('input', { type: 'checkbox' });
  if (st.biometric) bioInput.checked = true;
  bioInput.addEventListener('change', async () => {
    if (bioInput.checked) {
      const av = await biometricAvailable();
      if (!av) { bioInput.checked = false; toast('—'); return; }
      const ok = await biometricVerify(t('biometric_unlock'));
      if (!ok) { bioInput.checked = false; return; }
      await biometricStorePassword(session.password);
      saveSettings({ biometric: true });
    } else {
      await biometricClear();
      saveSettings({ biometric: false });
    }
  });
  const bioRow = settingRow(t('biometric_unlock'),
    h('label', { class: 'switch' }, bioInput, h('span', { class: 'track' }, h('span', { class: 'knob' }))));

  // --- Смяна на паролата ---
  const np = h('input', { type: 'password', autocomplete: 'new-password' });
  const np2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const npErr = h('div', { class: 'err' });
  const changePw = async () => {
    if (!np.value || np.value.length < 6) { npErr.textContent = t('password_min'); return; }
    if (np.value !== np2.value) { npErr.textContent = t('passwords_mismatch'); return; }
    await changePassword(np.value);
    if (loadSettings().biometric) await biometricStorePassword(np.value);
    np.value = ''; np2.value = ''; npErr.textContent = '';
    toast(t('password_changed'));
  };

  // --- ИМПОРТ (всички варианти; едни и същи като при бутона „+") ---
  async function runImport(promise) { toast(describeResult(await promise)); }

  // Импортът минава през НАДЕЖДНИЯ pickTextFile (нативен file-picker на телефон → чете реалното
  // съдържание; input в браузър), защото `<input type=file>` в Android WebView връщаше ПРАЗЕН файл.
  async function pickAndImport(kind) {
    // Дебъг: при неуспех/изключение показва ПОСТОЯНЕН диалог с диагностика (както при Aegis).
    const dbg = ['=== ' + kind + ' import debug ==='];
    try {
      const picked = await pickTextFile();
      if (!picked) return;
      dbg.push('file=' + (picked.name || '?') + ' size=' + (picked.size != null ? picked.size : '?') + ' chars=' + (picked.text ? picked.text.length : 0));
      if (!picked.text) { toast(t('import_empty')); showAlert('Import debug', dbg.join('\n')); return; }
      const text = picked.text;
      let res;
      if (kind === 'json') res = await importJsonText(text);
      else if (kind === 'otpauth') res = await importOtpauthList(text);
      else res = await import2FASText(text);
      dbg.push('result: ' + (res.ok ? 'ok imported=' + res.imported + ' dup=' + res.duplicates : 'reason=' + res.reason) + (res.detail ? ' detail=' + res.detail : ''));
      // Криптиран 2FAS (експорт С парола) → питаме за паролата и декриптираме (с повторни опити).
      while (kind === '2fas' && res && !res.ok && res.reason === 'encrypted') {
        const pw = await promptPassword(t('twofas_password_prompt'), t('save'), t('cancel'));
        if (pw == null) { dbg.push('encrypted: парола отказана'); return; }
        res = await import2FASEncrypted(text, pw);
        dbg.push('decrypt → ' + (res.ok ? 'ok imported=' + res.imported : 'reason=' + res.reason));
        if (res && !res.ok && res.reason === 'password') {
          toast(t('twofas_bad_password'));
          res = { ok: false, reason: 'encrypted' };   // питай пак
        }
      }
      toast(describeResult(res));
      if (res && !res.ok) showAlert('Import debug', dbg.join('\n'));   // дебъг при неуспех
    } catch (err) {
      dbg.push('EXCEPTION: ' + (err && (err.stack || err.message) || err));
      showAlert('Import debug', dbg.join('\n'));
    }
  }

  // --- ЕКСПОРТ (всички варианти) ---
  async function runExport(fn) {
    toast(t('exporting'));
    // Дебъг: при неуспех/изключение показва диагностика (както при импортите).
    const dbg = ['=== export debug ==='];
    try {
      const r = await fn();
      dbg.push('result: ' + JSON.stringify(r));
      if (!r || !r.ok) {
        toast(r && r.reason === 'empty' ? t('nothing_to_export') : t('import_failed'));
        if (!r || r.reason !== 'empty') showAlert('Export debug', dbg.join('\n'));   // празно = нормално, не дразним
        return;
      }
      toast(r.skipped ? tf('export_done_skip', r.count, r.skipped) : tf('export_done', r.count));
    } catch (err) {
      dbg.push('EXCEPTION: ' + (err && (err.stack || err.message) || err));
      showAlert('Export debug', dbg.join('\n'));
    }
  }

  // --- Помощни диалози „❓" (какво е 2FAS / какво е otpauth списък) ---
  // Потребителят трябва да ЗНАЕ кои приложения четат нашите експорти и откъде да ги свали.
  function openUrl(u) {
    try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url: u }); return; } } catch (e) {}
    try { window.open(u, '_blank'); } catch (e) { try { location.href = u; } catch (e2) {} }
  }
  function showHelp(title, ...kids) {
    const finish = () => { try { ov.remove(); } catch (e) {} };
    const box = h('div', { style: 'max-width:380px;width:100%;max-height:86vh;overflow:auto;background:#121a2b;border-radius:14px;padding:18px;box-sizing:border-box' },
      h('div', { style: 'color:#e6edf3;font-size:16px;font-weight:700;margin-bottom:10px', text: title }),
      ...kids,
      h('button', { class: 'btn', style: 'margin-top:14px', onclick: () => finish(), text: 'OK' }));
    const ov = h('div', { style: 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px' }, box);
    document.body.appendChild(ov);
  }
  function help2FAS() {
    showHelp(t('help_2fas_title'),
      // Обобщена 2FAS плочка (червен квадрат с бял надпис) — визуалният ориентир „кое приложение".
      h('div', { style: 'display:flex;justify-content:center;margin:6px 0 12px' },
        h('div', { style: 'width:110px;height:110px;border-radius:24px;background:#e01f3d;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:30px;font-family:system-ui,Segoe UI,Roboto,sans-serif' }, '2FAS')),
      h('p', { style: 'color:#cdd9e5;font-size:14px;line-height:1.55;margin:0 0 10px', text: t('help_2fas_text') }),
      h('button', { class: 'btn', style: 'background:#e01f3d', onclick: () => openUrl('https://2fas.com'), text: '⬇ ' + t('help_2fas_link') }));
  }
  function helpOtpauth() {
    showHelp(t('help_otpauth_title'),
      h('p', { style: 'color:#cdd9e5;font-size:14px;line-height:1.55;margin:0 0 8px', text: t('help_otpauth_text') }),
      h('p', { style: 'color:#8fa3c0;font-size:13px;line-height:1.5;margin:0;word-break:break-all', text: 'otpauth://totp/GitHub:alice?secret=ABC123&issuer=GitHub' }));
  }
  function helpBrowsers() {
    showHelp(t('help_browsers_title'),
      h('p', { style: 'color:#cdd9e5;font-size:14px;line-height:1.55;margin:0 0 10px', text: t('help_browsers_text') }),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
        h('button', { class: 'btn ghost', style: 'margin:0', onclick: () => openUrl('chrome://password-manager/passwords'), text: 'Chrome — chrome://password-manager' }),
        h('button', { class: 'btn ghost', style: 'margin:0', onclick: () => openUrl('edge://wallet/passwords/settings'), text: 'Edge — edge://wallet/passwords' }),
        h('button', { class: 'btn ghost', style: 'margin:0', onclick: () => openUrl('https://support.mozilla.org/kb/export-login-data-firefox'), text: 'Firefox — about:logins → Импорт/Експорт' })));
  }

  // Импорт на пароли от браузърен CSV (Chrome/Edge/Firefox) — авто-разпознаване на формата.
  async function pickAndImportPasswords() {
    const dbg = ['=== passwords CSV import ==='];
    try {
      const picked = await pickTextFile();
      if (!picked) return;
      dbg.push('file=' + (picked.name || '?') + ' chars=' + (picked.text ? picked.text.length : 0));
      if (!picked.text) { toast(t('import_empty')); showAlert('Import debug', dbg.join('\n')); return; }
      const res = await importPasswordsCsv(picked.text);
      dbg.push('result: ' + JSON.stringify(res));
      if (res.ok) toast(res.duplicates ? tf('pw_import_done_dups', res.imported, res.duplicates) : tf('pw_import_done', res.imported));
      else { toast(describeResult(res)); showAlert('Import debug', dbg.join('\n')); }
    } catch (err) {
      dbg.push('EXCEPTION: ' + (err && (err.stack || err.message) || err));
      showAlert('Import debug', dbg.join('\n'));
    }
  }
  // Импорт на крипто портфейли от наш .json бекъп.
  async function pickAndImportSeeds() {
    try {
      const picked = await pickTextFile();
      if (!picked || !picked.text) { if (picked) toast(t('import_empty')); return; }
      const res = await importSeedsJson(picked.text);
      if (res.ok) toast(res.duplicates ? tf('crypto_import_done_dups', res.imported, res.duplicates) : tf('crypto_import_done', res.imported));
      else toast(describeResult(res));
    } catch (err) { showAlert('Import debug', 'EXCEPTION: ' + (err && (err.message || err))); }
  }
  // Ред „бутон + ❓": главният бутон се разпъва, въпросителната отваря обяснението.
  function rowWithHelp(mainBtn, onHelp) {
    mainBtn.style.flex = '1 1 auto';
    mainBtn.style.margin = '0';
    return h('div', { style: 'display:flex;gap:8px;align-items:stretch;margin:6px 0' },
      mainBtn,
      h('button', { class: 'btn ghost', style: 'flex:0 0 52px;margin:0;padding:0;font-size:18px', onclick: onHelp, 'aria-label': '?' }, '❓'));
  }

  // --- Изтриване на сейфа ---
  const wipe = () => {
    if (!confirm(t('wipe_confirm'))) return;
    wipeVault();
    nav.start();
  };

  mount(root, topbar, h('div', { class: 'content' },
    langRow,
    lockRow,
    blurRow,
    bioRow,
    h('button', { class: 'btn ghost', onclick: () => nav.lock(), text: '🔒 ' + t('lock_now') }),

    h('h1', { style: 'font-size:1em;margin-top:22px', text: t('change_password') }),
    h('label', { text: t('new_password') }), np,
    h('label', { text: t('confirm_password') }), np2,
    npErr,
    h('button', { class: 'btn', onclick: changePw, text: t('change_password') }),

    // ── ИМПОРТ ──
    h('h1', { style: 'font-size:1em;margin-top:22px', text: '⬆ ' + t('import_title') }),
    h('button', { class: 'btn', onclick: () => nav.go('add'), text: '➕ ' + t('add_more_ways') }),
    h('button', { class: 'btn ghost', onclick: () => pickAndImport('json'), text: t('import_json') }),
    h('button', { class: 'btn ghost', onclick: () => importAegisFile(), text: t('import_aegis') }),
    rowWithHelp(h('button', { class: 'btn ghost', onclick: () => pickAndImport('2fas'), text: t('import_2fas') }), help2FAS),
    rowWithHelp(h('button', { class: 'btn ghost', onclick: () => pickAndImport('otpauth'), text: t('import_otpauth') }), helpOtpauth),
    h('p', { class: 'muted', style: 'font-size:.85em', text: t('import_aegis_hint') }),

    // ── ЕКСПОРТ ──
    h('h1', { style: 'font-size:1em;margin-top:22px', text: '⬇ ' + t('export_title') }),
    h('p', { class: 'muted', text: t('export_warning') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportJsonFile), text: t('export_json') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportAegisFile), text: t('export_aegis') }),
    rowWithHelp(h('button', { class: 'btn ghost', onclick: () => runExport(export2FASFile), text: t('export_2fas') }), help2FAS),
    rowWithHelp(h('button', { class: 'btn ghost', onclick: () => runExport(exportOtpauthListFile), text: t('export_otpauth') }), helpOtpauth),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportGoogleQR), text: t('export_google') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportAllQR), text: '🗂 ' + t('export_all_qr') }),
    h('p', { class: 'muted', style: 'font-size:.85em', text: t('export_all_desc') }),

    h('button', { class: 'btn ghost', style: 'margin-top:14px', onclick: () => nav.go('dups'), text: '🔍 ' + t('find_duplicates') }),

    // ── ПАРОЛИ ОТ/КЪМ БРАУЗЪР (Chrome / Edge / Firefox) ──
    h('h1', { style: 'font-size:1em;margin-top:22px', text: '🔑 ' + t('pw_section') }),
    rowWithHelp(h('button', { class: 'btn ghost', onclick: () => pickAndImportPasswords(), text: '⬆ ' + t('pw_import_csv') }), helpBrowsers),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportChromiumCsv), text: '⬇ ' + t('pw_export_chrome') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportFirefoxCsv), text: '⬇ ' + t('pw_export_firefox') }),
    h('button', { class: 'btn ghost', onclick: () => nav.go('dups', { mode: 'passwords' }), text: '🔍 ' + t('pw_find_dups') }),
    h('p', { class: 'muted', style: 'font-size:.85em', text: t('pw_section_desc') }),

    // ── КРИПТО ПОРТФЕЙЛИ (само локален бекъп) ──
    h('h1', { style: 'font-size:1em;margin-top:22px', text: '👛 ' + t('crypto_section') }),
    h('p', { class: 'muted', style: 'font-size:.85em;color:var(--danger)', text: t('crypto_backup_warning') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportSeedsJson), text: '⬇ ' + t('crypto_export') }),
    h('button', { class: 'btn ghost', onclick: () => pickAndImportSeeds(), text: '⬆ ' + t('crypto_import') }),

    h('button', { class: 'btn danger', style: 'margin-top:24px', onclick: wipe, text: t('wipe') })
  ));
}

function settingRow(label, control) {
  return h('div', { class: 'setting' }, h('div', { class: 'lbl', text: label }), control);
}
