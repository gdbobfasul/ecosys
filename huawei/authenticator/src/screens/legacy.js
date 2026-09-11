// Version: 1.0025
// legacy.js (екран) — „Наследство": (1) СЪЗДАЙ пакет — за кого, инструкции, кои раздели, парола на
// пакета (различна от master) + незашифрована подсказка → шифрован .json файл (записва/споделя);
// (2) ОТВОРИ пакет — файл + парола → инструкциите и броят записи, с бутон „Внеси в сейфа".
// Логиката е в core/legacy.js (PBKDF2 → AES-256-GCM, нищо не напуска устройството).
import { h, mount, toast, promptPassword } from '../ui/dom.js';
import { t, tf } from '../core/i18n.js';
import { session } from '../core/storage.js';
import { buildLegacyPackage, openLegacyPackage, importLegacyData, legacyInfo, LEGACY_TABS } from '../core/legacy.js';
import { pickTextFile } from '../core/filepick.js';

export function renderLegacy(root, nav) {
  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list', { main: 'security' }) }, '←'),
    h('h1', { text: t('legacy_title') }));

  const info = legacyInfo();
  const lastLine = h('p', { class: 'muted', style: 'font-size:.85em', text: tf('legacy_last', info.lastAt ? new Date(info.lastAt).toLocaleDateString() + (info.forWhom ? ' · ' + info.forWhom : '') : t('legacy_never')) });

  // --- Създаване ---
  const forWhom = h('input', { type: 'text', id: 'legacyFor', maxlength: '80', placeholder: 'Maria' });
  const instructions = h('textarea', { id: 'legacyText', maxlength: '4000', placeholder: t('legacy_instructions_ph'), style: 'min-height:110px' });
  const labelOf = { passwords: t('tab_passwords'), entries: t('main_tab_auth'), seeds: t('tab_crypto'), collection: t('sub_qr'), ssh: t('tab_ssh'), networks: t('tab_networks'), tokens: t('tab_tokens') };
  const checks = {};
  const checkRows = LEGACY_TABS.map((tb) => {
    const cnt = (session[tb] || []).filter((x) => x && !x.sample).length;
    const cb = h('input', { type: 'checkbox', style: 'width:auto;flex:0 0 auto;margin:0' }); cb.checked = cnt > 0; checks[tb] = cb;
    return h('label', { style: 'display:flex;align-items:center;gap:10px;margin:6px 0;font-weight:500;color:var(--text)' }, cb, h('span', { text: labelOf[tb] + ' (' + cnt + ')' }));
  });
  const pw = h('input', { type: 'password', id: 'legacyPw', autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const hint = h('input', { type: 'text', maxlength: '120' });
  const err = h('div', { class: 'err' });
  const create = async () => {
    err.textContent = '';
    const tabs = LEGACY_TABS.filter((tb) => checks[tb].checked);
    if (!tabs.length && !instructions.value.trim()) { err.textContent = t('legacy_empty'); return; }
    if (!pw.value || pw.value.length < 8) { err.textContent = t('legacy_pw_min'); return; }
    if (pw.value !== pw2.value) { err.textContent = t('passwords_mismatch'); return; }
    toast(t('exporting'));
    try {
      const r = await buildLegacyPackage({ tabs, instructions: instructions.value, password: pw.value, forWhom: forWhom.value, hint: hint.value });
      if (r.ok) { toast(tf('legacy_created', r.count)); pw.value = ''; pw2.value = ''; lastLine.textContent = tf('legacy_last', new Date().toLocaleDateString() + (forWhom.value ? ' · ' + forWhom.value : '')); }
      else err.textContent = r.reason === 'password' ? t('legacy_pw_min') : t('legacy_empty');
    } catch (e) { err.textContent = t('import_failed'); }
  };

  // --- Отваряне ---
  const opened = h('div', {});
  const open = async () => {
    try {
      const picked = await pickTextFile();
      if (!picked) return;
      if (!picked.text) { toast(t('import_empty')); return; }
      let res = { ok: false, reason: 'password' };
      while (!res.ok) {
        const p = await promptPassword(t('legacy_password'), t('unlock'), t('cancel'));
        if (p == null) return;
        res = await openLegacyPackage(picked.text, p);
        if (!res.ok && res.reason === 'format') { toast(t('legacy_not_package')); return; }
        if (!res.ok) toast(t('legacy_bad_password'));
      }
      const box = h('div', { class: 'entry', style: 'flex-direction:column;align-items:stretch;gap:8px;margin-top:10px' },
        h('div', { style: 'font-weight:700', text: '📦 ' + tf('legacy_opened', (res.forWhom ? res.forWhom + ' · ' : '') + (res.createdAt ? new Date(res.createdAt).toLocaleDateString() : '')) }),
        h('div', { class: 'muted', style: 'white-space:pre-wrap;user-select:text', text: res.instructions || '—' }),
        h('div', { class: 'muted', style: 'font-size:.85em', text: tf('legacy_contains', res.count) }),
        h('button', { class: 'btn accent', style: 'margin-top:4px', onclick: async () => {
          const r = await importLegacyData(res.data);
          if (r.ok) { toast(tf('legacy_imported', r.imported)); nav.go('list', { main: 'security' }); } else toast(t('import_failed'));
        }, text: '⬆ ' + t('legacy_import') }));
      mount(opened, box);
    } catch (e) { toast(t('import_failed')); }
  };

  mount(root, topbar, h('div', { class: 'content' },
    h('p', { class: 'muted', text: t('legacy_desc') }),
    lastLine,
    h('label', { text: t('legacy_for') }), forWhom,
    h('label', { text: t('legacy_instructions') }), instructions,
    h('label', { text: t('legacy_include') }), ...checkRows,
    h('label', { text: t('legacy_password') }), pw,
    h('label', { text: t('confirm_password') }), pw2,
    h('label', { text: t('legacy_hint') }), hint,
    err,
    h('button', { class: 'btn accent', id: 'legacyCreate', onclick: create, text: '📦 ' + t('legacy_create') }),
    h('h1', { style: 'font-size:1em;margin-top:26px', text: '📂 ' + t('legacy_open') }),
    h('p', { class: 'muted', style: 'font-size:.85em', text: t('legacy_open_desc') }),
    h('button', { class: 'btn ghost', onclick: open, text: '📂 ' + t('legacy_open') }),
    opened));
}
