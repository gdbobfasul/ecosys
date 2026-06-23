// settings.js — настройки: език, авто-заключване, биометрия, смяна на парола,
// импорт/експорт и изтриване на сейфа.
import { h, mount, toast } from '../ui/dom.js';
import { t, tf, getLang, languageByCode } from '../core/i18n.js';
import {
  loadSettings, saveSettings, session, changePassword, addEntry, wipeVault
} from '../core/storage.js';
import {
  biometricAvailable, biometricVerify, biometricStorePassword, biometricClear
} from '../core/biometric.js';
import { exportAllQR } from '../core/qrexport.js';

const LOCK_OPTIONS = [0, 1, 5, 15, 30];

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

  // --- Авто-заключване ---
  const lockSel = h('select', { style: 'width:auto;margin:0',
    onchange: (e) => saveSettings({ autoLockMin: parseInt(e.target.value, 10) }) },
    ...LOCK_OPTIONS.map((m) => {
      const o = h('option', { value: String(m) }, m === 0 ? t('never') : tf('minutes', m));
      if (m === st.autoLockMin) o.setAttribute('selected', 'selected');
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

  // --- Експорт ---
  const doExport = () => {
    const data = JSON.stringify({ app: 'kcy-authenticator', version: 1, entries: session.entries }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kcy-authenticator-export.json';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  // --- Експорт на всички като QR картинки (.zip) ---
  const doExportAll = async () => {
    toast(t('exporting'));
    const r = await exportAllQR();
    if (!r.ok) toast(r.reason === 'empty' ? t('nothing_to_export') : t('import_failed'));
  };

  // --- Импорт ---
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.entries) ? parsed.entries : []);
        let n = 0;
        for (const it of list) {
          if (!it || !it.secret) continue;
          await addEntry({
            type: it.type || 'totp', issuer: it.issuer || '', account: it.account || it.name || '',
            secret: String(it.secret).toUpperCase(), algorithm: it.algorithm || 'SHA1',
            digits: it.digits || 6, period: it.period || 30, counter: it.counter || 0
          });
          n++;
        }
        toast(tf('import_done', n));
      } catch (e) { toast(t('import_failed')); }
      fileInput.value = '';
    };
    reader.readAsText(f);
  });

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

    h('h1', { style: 'font-size:1em;margin-top:22px', text: '⇄' }),
    h('p', { class: 'muted', text: t('export_warning') }),
    h('button', { class: 'btn ghost', onclick: doExport, text: '⬇ ' + t('export_json') }),
    h('button', { class: 'btn ghost', onclick: () => fileInput.click(), text: '⬆ ' + t('import_json') }),
    fileInput,

    h('p', { class: 'muted', style: 'margin-top:14px', text: t('export_all_desc') }),
    h('button', { class: 'btn ghost', onclick: doExportAll, text: '🗂 ' + t('export_all_qr') }),

    h('button', { class: 'btn ghost', style: 'margin-top:14px', onclick: () => nav.go('dups'), text: '🔍 ' + t('find_duplicates') }),

    h('button', { class: 'btn danger', style: 'margin-top:24px', onclick: wipe, text: t('wipe') })
  ));
}

function settingRow(label, control) {
  return h('div', { class: 'setting' }, h('div', { class: 'lbl', text: label }), control);
}
