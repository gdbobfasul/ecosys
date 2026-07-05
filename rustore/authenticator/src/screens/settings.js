// Version: 1.0001
// settings.js — настройки: език, авто-заключване, биометрия, смяна на парола,
// импорт/експорт (всички варианти, същите като при бутона „+") и изтриване на сейфа.
import { h, mount, toast, showAlert } from '../ui/dom.js';
import { t, tf, getLang, languageByCode } from '../core/i18n.js';
import {
  loadSettings, saveSettings, session, changePassword, wipeVault, autoLockSeconds
} from '../core/storage.js';
import {
  biometricAvailable, biometricVerify, biometricStorePassword, biometricClear
} from '../core/biometric.js';
import { importJsonText, import2FASText, importOtpauthList, describeResult } from '../core/importer.js';
import { importAegisFile } from './aegis-import.js';
import { pickTextFile } from '../core/filepick.js';
import { exportJsonFile, exportAegisFile, export2FASFile, exportOtpauthListFile, exportGoogleQR } from '../core/exporter.js';
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
      if (kind === '2fas' && res && !res.ok && res.reason === 'encrypted') { toast(t('twofas_encrypted')); showAlert('Import debug', dbg.join('\n')); return; }
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

  // --- Изтриване на сейфа ---
  const wipe = () => {
    if (!confirm(t('wipe_confirm'))) return;
    wipeVault();
    nav.start();
  };

  mount(root, topbar, h('div', { class: 'content' },
    langRow,
    lockRow,
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
    h('button', { class: 'btn ghost', onclick: () => pickAndImport('2fas'), text: t('import_2fas') }),
    h('button', { class: 'btn ghost', onclick: () => pickAndImport('otpauth'), text: t('import_otpauth') }),
    h('p', { class: 'muted', style: 'font-size:.85em', text: t('import_aegis_hint') }),

    // ── ЕКСПОРТ ──
    h('h1', { style: 'font-size:1em;margin-top:22px', text: '⬇ ' + t('export_title') }),
    h('p', { class: 'muted', text: t('export_warning') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportJsonFile), text: t('export_json') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportAegisFile), text: t('export_aegis') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(export2FASFile), text: t('export_2fas') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportOtpauthListFile), text: t('export_otpauth') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportGoogleQR), text: t('export_google') }),
    h('button', { class: 'btn ghost', onclick: () => runExport(exportAllQR), text: '🗂 ' + t('export_all_qr') }),
    h('p', { class: 'muted', style: 'font-size:.85em', text: t('export_all_desc') }),

    h('button', { class: 'btn ghost', style: 'margin-top:14px', onclick: () => nav.go('dups'), text: '🔍 ' + t('find_duplicates') }),

    h('button', { class: 'btn danger', style: 'margin-top:24px', onclick: wipe, text: t('wipe') })
  ));
}

function settingRow(label, control) {
  return h('div', { class: 'setting' }, h('div', { class: 'lbl', text: label }), control);
}
