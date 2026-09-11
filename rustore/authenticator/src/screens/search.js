// Version: 1.0000
// search.js — ГЛОБАЛНА търсачка през целия сейф. Търси „където и да е" (пример: „леджер" → пароли за
// сайтове, Ledger портфейл-ключове, адреси). Всеки резултат показва всичките си полета; всяко поле има
// бутон за КОПИРАНЕ (⧉), а тайните (парола/seed/ключ) са скрити зад „око" (👁) — но пак се копират.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { THEME } from '../theme.js';
import { searchVault, vaultItemCount } from '../core/vault-search.js';

export function renderSearch(root, nav) {
  const back = h('button', { class: 'icon-btn', title: t('back'), onclick: () => nav.go('list') }, '‹');
  const topbar = h('div', { class: 'topbar' }, back, h('h1', { text: t('search_all_title') || 'Търсене' }));
  const input = h('input', { placeholder: (t('search_all_ph') || 'Търси навсякъде') + ' (' + vaultItemCount() + ')', autofocus: true,
    oninput: (e) => { redraw(e.target.value); } });
  const results = h('div', {});
  const wrap = h('div', { class: 'content' }, input, results);
  mount(root, topbar, wrap);
  setTimeout(() => { try { input.focus(); } catch (_) {} }, 50);

  // едно поле-ред: етикет + стойност (тайните скрити) + „око" (ако тайно) + копиране
  function fieldRow(f) {
    const isSecret = f.secret;
    const valEl = h('span', { class: 'search-val', style: 'flex:1;word-break:break-all;font-family:' + (isSecret ? 'monospace' : 'inherit') },
      isSecret ? '••••••••' : f.value);
    let shown = !isSecret;
    const eye = isSecret ? h('button', { class: 'copy-btn', title: '👁', onclick: () => { shown = !shown; valEl.textContent = shown ? f.value : '••••••••'; } }, '👁') : null;
    const copy = h('button', { class: 'copy-btn', title: t('copy'), onclick: () => { copyText(f.value); toast(t('copied')); } }, '⧉');
    return h('div', { style: 'display:flex;align-items:center;gap:8px;padding:4px 0' },
      h('span', { class: 'muted', style: 'min-width:96px;font-size:.8em', text: f.label }),
      valEl, eye, copy);
  }

  function card(r) {
    const head = h('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:4px;cursor:pointer' },
      h('div', { style: 'font-size:18px' }, r.icon),
      h('div', { style: 'font-weight:700;flex:1', text: r.title }),
      h('button', { class: 'copy-btn', title: t('edit') || 'Отвори', onclick: () => nav.go(r.editScreen, r.raw) }, '›'));
    const box = h('div', { class: 'entry', style: 'flex-direction:column;align-items:stretch;gap:2px' },
      head, ...r.fields.map(fieldRow));
    return box;
  }

  function redraw(q) {
    const val = (q == null ? input.value : q) || '';
    if (!val.trim()) { mount(results, h('div', { class: 'center' }, h('div', { style: 'font-size:2.2em' }, '🔎'),
      h('p', { class: 'muted', text: t('search_all_hint') || 'Въведи дума — търси в пароли, портфейли, ключове, адреси, 2FA…' })));
      return; }
    const found = searchVault(val);
    if (!found.length) { mount(results, h('div', { class: 'center' }, h('div', { style: 'font-size:2.2em' }, '🤷'),
      h('p', { class: 'muted', text: (t('search_all_none') || 'Няма съвпадения за') + ' „' + val + '"' }))); return; }
    const count = h('div', { class: 'muted', style: 'font-size:.8em;margin:6px 0', text: (t('search_all_count') || 'Намерени') + ': ' + found.length });
    mount(results, count, ...found.map(card));
  }

  redraw('');
}
