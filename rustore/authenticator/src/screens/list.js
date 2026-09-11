// Version: 1.0025
// list.js — главният екран след отключване. 08.09.2026 (по искане) — ДВА главни таба:
//   1) „Authenticator" — въртящите се 2FA кодове (всичко досегашно, непроменено);
//   2) „Passwords" — всичко за пазене на тайни, с ПОД-ТАБОВЕ:
//        Пароли · Портфейли (крипто; ~30 вградени + до 20 потребителски под-табове) · QR кодове ·
//        SSH · Мрежи · Токени.
//   3) „Защита" (11.09.2026, Huawei 4.1) — табло: Одит на сигурността (оценка + план), Проверка на
//        адрес (фишинг), Наследство (шифрован пакет за доверен човек), Конвертиране на ключове,
//        дубликати, търсене; броячи на сейфа; „Пробвай с пример"/„Махни примерите".
//   ВСИЧКО е в шифрирания сейф — само на устройството, нищо не се качва.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t, tf } from '../core/i18n.js';
import { THEME } from '../theme.js';
import { session, incrementCounter, seedCountFor } from '../core/storage.js';
import { lastAudit, gradeOf } from '../core/audit.js';
import { legacyInfo } from '../core/legacy.js';
import { addSamples, hasSamples, removeSamples } from '../core/samples.js';
import { generateCode, secondsRemaining } from '../core/otp.js';
import { allWallets, walletByKey, maxForWallet, addCustomWallet, renameCustomWallet, deleteCustomWallet, isCustomWallet, customWallets, MAX_CUSTOM_WALLETS } from '../core/wallets.js';
// Импорт/експорт на пароли от/към браузъри (Chrome/Edge/Firefox CSV — телефон и компютър) — и ТУК, в таб „Passwords".
import { pickTextFile } from '../core/filepick.js';
import { importPasswordsCsv, describeResult } from '../core/importer.js';
import { exportChromiumCsv, exportFirefoxCsv } from '../core/exporter.js';

let tickTimer = null;
let mainTab = 'auth';         // 'auth' | 'passwords' — запазва се между влизанията
let subTab = 'passwords';     // под-таб в „Passwords": passwords | crypto | collection | ssh | networks | tokens
let selectedWallet = null;    // в под-таб „Портфейли": избраният портфейл (null = решетката)
let pwdSort = 'name';         // подредба на паролите: 'name' (азбучно) | 'site' (по сайт)
let sshSort = 'ip';           // подредба на SSH: 'ip' (по хост/IP) | 'name' (по име)

export function renderList(root, nav, data) {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  // Връщане от редактор → същият под-таб (data.sub) / портфейл (data.wallet).
  if (data && data.sub) { mainTab = 'passwords'; subTab = data.sub; }
  if (data && data.wallet) { mainTab = 'passwords'; subTab = 'crypto'; selectedWallet = data.wallet; }
  if (data && data.main) mainTab = data.main;   // връщане от екраните на „Защита"

  const topbar = h('div', { class: 'topbar' },
    h('h1', { text: THEME.appName, style: 'font-size:1.05em' }),
    h('button', { class: 'icon-btn', title: t('search_all_title') || 'Търсене', onclick: () => nav.go('search') }, '🔎'),
    h('button', { class: 'icon-btn', title: t('settings_title'), onclick: () => nav.go('settings') }, '⚙️')
  );
  const container = h('div', { class: 'content' });
  const fab = h('button', { class: 'fab', onclick: fabAction }, '+');

  // ── Главни табове (2) ──
  const mainTabs = [
    { key: 'auth', icon: '🔐', label: t('main_tab_auth') },
    { key: 'passwords', icon: '🔑', label: t('main_tab_passwords') },
    { key: 'security', icon: '🩺', label: t('main_tab_security') }
  ];
  const tabbar = h('div', { class: 'tabbar' },
    ...mainTabs.map((tb) => h('button', {
      class: 'tab' + (mainTab === tb.key ? ' on' : ''),
      onclick: () => { mainTab = tb.key; draw(); }
    }, h('div', {}, tb.icon), h('div', { class: 'tablabel', text: tb.label })))
  );
  // ── Под-табове на „Passwords" (хоризонтално плъзгаща се лента над съдържанието) ──
  const subTabs = [
    { key: 'passwords', icon: '🔑', label: t('tab_passwords') },
    { key: 'crypto', icon: '👛', label: t('tab_crypto') },
    { key: 'collection', icon: '▦', label: t('sub_qr') },
    { key: 'ssh', icon: '🖥', label: t('tab_ssh') },
    { key: 'networks', icon: '🌐', label: t('tab_networks') },
    { key: 'tokens', icon: '🪙', label: t('tab_tokens') }
  ];
  const subbar = h('div', { class: 'subbar', style: 'display:flex;gap:6px;overflow-x:auto;flex-wrap:nowrap;padding:8px 12px;-webkit-overflow-scrolling:touch;border-bottom:1px solid var(--border);background:var(--bgCard)' },
    ...subTabs.map((sb) => h('button', {
      class: 'btn ghost' + (subTab === sb.key ? ' on' : ''),
      style: 'flex:0 0 auto;margin:0;padding:6px 12px;font-size:.85em;height:auto' + (subTab === sb.key ? ';border-color:var(--accent);color:var(--accent)' : ''),
      onclick: () => { subTab = sb.key; if (sb.key !== 'crypto') selectedWallet = null; draw(); }
    }, sb.icon + ' ' + sb.label))
  );

  mount(root, topbar, subbar, container, fab, tabbar);

  function fabAction() {
    if (mainTab === 'auth') return nav.go('add');
    if (mainTab === 'security') return nav.go('audit');
    if (subTab === 'collection') nav.go('collection-add');
    else if (subTab === 'passwords') nav.go('password-edit');
    else if (subTab === 'ssh') nav.go('ssh-edit');
    else if (subTab === 'networks') nav.go('network-edit');
    else if (subTab === 'tokens') nav.go('token-edit');
    else { // крипто: добавя за избрания портфейл (ако е избран), иначе подсказва
      if (!selectedWallet) { toast(t('crypto_pick_wallet')); return; }
      if (seedCountFor(selectedWallet) >= maxForWallet(selectedWallet)) { toast(t('crypto_limit_reached')); return; }
      nav.go('seed-edit', { wallet: selectedWallet });
    }
  }

  function draw() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    [...tabbar.children].forEach((b, i) => b.classList.toggle('on', mainTabs[i].key === mainTab));
    subbar.style.display = mainTab === 'passwords' ? 'flex' : 'none';
    [...subbar.children].forEach((b, i) => {
      const on = subTabs[i].key === subTab;
      b.classList.toggle('on', on);
      b.style.borderColor = on ? 'var(--accent)' : '';
      b.style.color = on ? 'var(--accent)' : '';
    });
    fab.style.display = mainTab === 'security' ? 'none' : '';
    if (mainTab === 'auth') return drawAuth();
    if (mainTab === 'security') return drawSecurity();
    if (subTab === 'collection') drawCollection();
    else if (subTab === 'passwords') drawPasswords();
    else if (subTab === 'ssh') drawSsh();
    else if (subTab === 'networks') drawNetworks();
    else if (subTab === 'tokens') drawTokens();
    else drawCrypto();
  }

  // Сортиране: азбучно/числово, независимо от регистъра.
  function byText(a, b) { return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' }); }
  // Хост без протокол/www (за подредба на пароли „по сайт").
  function siteOf(p) {
    const u = String(p.url || p.title || '');
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; }
  }

  // ---------- Таб „Authenticator" (2FA кодове) ----------
  function drawAuth() {
    let filter = '';
    let rows = [];
    const search = h('input', { placeholder: t('search_ph'), oninput: (e) => { filter = e.target.value.toLowerCase(); redraw(); } });
    const listEl = h('div', {});
    mount(container, session.entries.length ? search : null, listEl);

    function fmt(e, c) {
      if (e.type === 'steam') return c;
      if (c.length === 6) return c.slice(0, 3) + ' ' + c.slice(3);
      if (c.length === 8) return c.slice(0, 4) + ' ' + c.slice(4);
      return c;
    }
    function rowFor(e) {
      const code = h('div', { class: 'code' }, '••• •••');
      const ring = h('div', { class: 'ring', style: 'font-size:.85em;color:var(--textDim)' }, '');
      const badge = h('div', { class: 'badge' }, ((e.issuer || e.account || '?').trim().charAt(0) || '?').toUpperCase());
      code.addEventListener('click', () => {
        const c = code.textContent.replace(/\s/g, '');
        if (c && !c.includes('•')) { copyText(c); toast(t('copied')); }
      });
      const right = h('div', { class: 'right' });
      if (e.type === 'hotp') {
        right.appendChild(h('button', { class: 'hotp-next', title: t('next_code'),
          onclick: async (ev) => { ev.stopPropagation(); await incrementCounter(e.id); refresh(); } }, '↻'));
      } else { right.appendChild(ring); }
      const info = h('div', { class: 'info', style: 'cursor:pointer' },
        h('div', { class: 'issuer', text: e.issuer || e.account || '—' }),
        h('div', { class: 'acct', text: e.issuer ? (e.account || '') : '' }));
      info.addEventListener('click', () => nav.go('edit', e));
      badge.addEventListener('click', () => nav.go('edit', e));
      const rowEl = h('div', { class: 'entry' }, badge, info, h('div', {}, code), right);
      async function refresh() {
        try { code.textContent = fmt(e, await generateCode(e)); } catch (er) { code.textContent = '——————'; }
        if (e.type !== 'hotp') {
          const rem = secondsRemaining(e.period);
          ring.textContent = rem + 's';
          ring.style.color = rem <= 5 ? 'var(--danger)' : 'var(--textDim)';
        }
      }
      rowEl._refresh = refresh; refresh();
      return rowEl;
    }
    function redraw() {
      if (!session.entries.length) {
        mount(listEl, emptyBox('🔐', t('empty_title'), t('empty_desc')));
        rows = []; return;
      }
      const items = session.entries.filter((e) => !filter || ((e.issuer || '') + ' ' + (e.account || '')).toLowerCase().includes(filter));
      rows = items.map(rowFor);
      mount(listEl, ...rows);
    }
    redraw();
    tickTimer = setInterval(() => { rows.forEach((r) => { if (r._refresh) r._refresh(); }); }, 1000);
  }

  // ---------- Под-таб „QR кодове" (колекция: картинка + име + логин + парола) ----------
  function drawCollection() {
    if (!session.collection.length) { mount(container, emptyBox('▦', t('empty_col_title'), t('empty_col_desc'))); return; }
    const rows = session.collection.map((c) => {
      const thumb = c.image
        ? h('img', { src: c.image, style: 'width:42px;height:42px;border-radius:8px;object-fit:cover;background:#fff' })
        : h('div', { class: 'badge' }, '▦');
      const sub = [c.appName, c.login].filter(Boolean).join(' · ') || c.content || '';
      const info = h('div', { class: 'info' }, h('div', { class: 'issuer', text: c.title || '—' }),
        h('div', { class: 'acct', text: sub }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, thumb, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('collection-view', c));
      return row;
    });
    mount(container, ...rows);
  }

  // Лента за браузърите: импорт от Chrome/Edge/Firefox (CSV), експорт към тях, дубликати. Същите функции
  // както в Настройки — но тук, където са паролите (по искане 08.09.2026).
  function browserBar() {
    const importCsv = async () => {
      try {
        const picked = await pickTextFile();
        if (!picked) return;
        if (!picked.text) { toast(t('import_empty')); return; }
        const res = await importPasswordsCsv(picked.text);
        if (res.ok) { toast(res.duplicates ? tf2('pw_import_done_dups', res.imported, res.duplicates) : tf2('pw_import_done', res.imported)); draw(); }
        else toast(describeResult(res));
      } catch (err) { toast(t('import_failed')); }
    };
    const runExport = async (fn) => {
      toast(t('exporting'));
      try { const r = await fn(); if (!r || !r.ok) toast(r && r.reason === 'empty' ? t('nothing_to_export') : t('import_failed')); }
      catch (err) { toast(t('import_failed')); }
    };
    const b = (txt, fn) => h('button', { class: 'btn ghost', style: 'flex:0 0 auto;margin:0;padding:6px 10px;font-size:.82em;height:auto', onclick: fn }, txt);
    return h('div', { style: 'display:flex;gap:6px;overflow-x:auto;flex-wrap:nowrap;margin:0 0 8px;-webkit-overflow-scrolling:touch' },
      b('⬆ ' + t('pw_import_csv'), importCsv),
      b('⬇ ' + t('pw_export_chrome'), () => runExport(exportChromiumCsv)),
      b('⬇ ' + t('pw_export_firefox'), () => runExport(exportFirefoxCsv)),
      b('🔍 ' + t('pw_find_dups'), () => nav.go('dups', { mode: 'passwords' })));
  }

  // ---------- Под-таб „Пароли" ----------
  function drawPasswords() {
    if (!session.passwords.length) { mount(container, browserBar(), emptyBox('🔑', t('empty_pwd_title'), t('empty_pwd_desc'))); return; }
    // Превключвател на подредбата: по име (азбучно) ⇄ по сайт.
    const sortBtn = h('button', { class: 'btn ghost', style: 'margin:0 0 8px',
      onclick: () => { pwdSort = pwdSort === 'name' ? 'site' : 'name'; drawPasswords(); } },
      pwdSort === 'name' ? '🔤 ' + t('sort_by_name') : '🌐 ' + t('sort_by_site'));
    const sorted = [...session.passwords].sort((a, b) => pwdSort === 'site'
      ? (byText(siteOf(a), siteOf(b)) || byText(a.login, b.login))
      : byText(a.title || siteOf(a), b.title || siteOf(b)));
    const rows = sorted.map((p) => {
      const badge = h('div', { class: 'badge' }, ((p.title || siteOf(p) || '?').trim().charAt(0) || '?').toUpperCase());
      const info = h('div', { class: 'info' }, h('div', { class: 'issuer', text: p.title || siteOf(p) || '—' }),
        h('div', { class: 'acct', text: p.login || siteOf(p) || '' }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, badge, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('password-edit', p));
      return row;
    });
    mount(container, browserBar(), sortBtn, ...rows);
  }

  // ---------- Под-таб „SSH" (отдалечен достъп) ----------
  function drawSsh() {
    if (!session.ssh.length) { mount(container, emptyBox('🖥', t('empty_ssh_title'), t('empty_ssh_desc'))); return; }
    const sortBtn = h('button', { class: 'btn ghost', style: 'margin:0 0 8px',
      onclick: () => { sshSort = sshSort === 'ip' ? 'name' : 'ip'; drawSsh(); } },
      sshSort === 'ip' ? '🌐 ' + t('sort_by_ip') : '🔤 ' + t('sort_by_name'));
    const sorted = [...session.ssh].sort((a, b) => sshSort === 'name'
      ? byText(a.name || a.host, b.name || b.host)
      : (byText(a.host, b.host) || byText(a.name, b.name)));
    const rows = sorted.map((s) => {
      const badge = h('div', { class: 'badge' }, '🖥');
      const hostLine = (s.user ? s.user + '@' : '') + (s.host || '') + (s.port ? ':' + s.port : '');
      const info = h('div', { class: 'info' }, h('div', { class: 'issuer', text: s.name || s.host || '—' }),
        h('div', { class: 'acct', text: hostLine }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, badge, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('ssh-edit', s));
      return row;
    });
    mount(container, sortBtn, ...rows);
  }

  // ---------- Под-таб „Мрежи" (EVM RPC) ----------
  function drawNetworks() {
    if (!session.networks.length) { mount(container, emptyBox('🌐', t('empty_net_title'), t('empty_net_desc'))); return; }
    const sorted = [...session.networks].sort((a, b) => byText(a.name, b.name));
    const rows = sorted.map((n) => {
      const badge = h('div', { class: 'badge' }, '🌐');
      const sub = [n.currencySymbol, n.chainId ? 'chain ' + n.chainId : ''].filter(Boolean).join(' · ');
      const info = h('div', { class: 'info' }, h('div', { class: 'issuer', text: n.name || '—' }),
        h('div', { class: 'acct', text: sub || n.rpcUrl || '' }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, badge, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('network-edit', n));
      return row;
    });
    mount(container, ...rows);
  }

  // ---------- Под-таб „Токени" (custom ERC-20) ----------
  function drawTokens() {
    if (!session.tokens.length) { mount(container, emptyBox('🪙', t('empty_tok_title'), t('empty_tok_desc'))); return; }
    const sorted = [...session.tokens].sort((a, b) => byText(a.symbol || a.name, b.symbol || b.name));
    const rows = sorted.map((tk) => {
      const badge = h('div', { class: 'badge' }, ((tk.symbol || tk.name || '?').trim().charAt(0) || '?').toUpperCase());
      const sub = [tk.network, tk.decimals ? 'dec ' + tk.decimals : ''].filter(Boolean).join(' · ');
      const info = h('div', { class: 'info' }, h('div', { class: 'issuer', text: (tk.symbol || tk.name || '—') }),
        h('div', { class: 'acct', text: sub || tk.contractAddress || '' }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, badge, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('token-edit', tk));
      return row;
    });
    mount(container, ...rows);
  }

  // ---------- Под-таб „Портфейли" (крипто акаунти по портфейл) ----------
  function drawCrypto() {
    if (!selectedWallet) return drawWalletGrid();
    return drawWalletAccounts(selectedWallet);
  }

  // Решетка от портфейли: ~30 вградени + потребителските (до 20) + „Други" + плочка „Нов портфейл".
  // Портфейлите с акаунти се показват първи (после празните), за да е бързо намирането.
  function drawWalletGrid() {
    const note = h('p', { class: 'muted', style: 'font-size:.82em;text-align:center;margin:2px 0 12px', text: t('crypto_local_note') });
    const list = allWallets();
    const withCount = list.map((w) => ({ w, cnt: seedCountFor(w.key) }));
    withCount.sort((a, b) => (b.cnt > 0) - (a.cnt > 0));   // стабилно: първо с акаунти
    const tiles = withCount.map(({ w, cnt }) => {
      const name = w.isOther ? t('crypto_other') : w.name;
      return h('button', {
        class: 'btn ghost',
        style: 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 6px;height:auto;margin:0;border-left:4px solid ' + w.color,
        onclick: () => { selectedWallet = w.key; draw(); }
      },
        h('div', { style: 'font-size:24px' }, w.icon),
        h('div', { style: 'font-weight:700;font-size:.9em;text-align:center', text: name }),
        h('div', { class: 'muted', style: 'font-size:.78em', text: cnt ? tf2('crypto_count', cnt, maxForWallet(w.key)) : t('crypto_add_here') }));
    });
    // Плочка „+ Нов портфейл" (потребителски под-таб; до MAX_CUSTOM_WALLETS).
    const newTile = h('button', {
      class: 'btn ghost',
      style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:14px 6px;height:auto;margin:0;border:1px dashed var(--accent);color:var(--accent)',
      onclick: () => {
        if (customWallets().length >= MAX_CUSTOM_WALLETS) { toast(tf2('crypto_custom_limit', MAX_CUSTOM_WALLETS)); return; }
        const name = prompt(t('crypto_new_wallet_ph'));
        if (!name || !name.trim()) return;
        const w = addCustomWallet(name);
        if (!w) { toast(tf2('crypto_custom_limit', MAX_CUSTOM_WALLETS)); return; }
        selectedWallet = w.key; draw();
      }
    }, h('div', { style: 'font-size:24px' }, '＋'), h('div', { style: 'font-weight:700;font-size:.9em', text: t('crypto_new_wallet') }));
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:10px' }, newTile, ...tiles);
    mount(container, note, grid);
  }

  // Списък с акаунтите за избран портфейл + бутон „назад" (+ преименуване/изтриване за потребителските).
  function drawWalletAccounts(key) {
    const w = walletByKey(key);
    const name = w.isOther ? t('crypto_other') : w.name;
    const back = h('button', { class: 'btn ghost', style: 'margin:0 0 10px', onclick: () => { selectedWallet = null; draw(); } }, '← ' + t('crypto_all_wallets'));
    const head = h('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap' },
      h('div', { style: 'font-size:22px' }, w.icon),
      h('h1', { style: 'margin:0;font-size:1.1em', text: name }),
      h('div', { class: 'muted', style: 'margin-left:auto;font-size:.85em', text: tf2('crypto_count', seedCountFor(key), maxForWallet(key)) }));
    if (isCustomWallet(key)) {
      head.appendChild(h('button', { class: 'copy-btn', title: t('crypto_rename_wallet'), onclick: () => {
        const nm = prompt(t('crypto_new_wallet_ph'), w.name); if (nm && nm.trim()) { renameCustomWallet(key, nm); draw(); }
      } }, '✏️'));
      head.appendChild(h('button', { class: 'copy-btn', title: t('crypto_delete_wallet'), onclick: () => {
        if (seedCountFor(key) > 0) { toast(t('crypto_wallet_not_empty')); return; }
        if (!confirm(t('delete_confirm'))) return;
        deleteCustomWallet(key); selectedWallet = null; draw();
      } }, '🗑'));
    }
    const items = session.seeds.filter((s) => s.wallet === key);
    const kids = items.length ? items.map((s) => {
      const badge = h('div', { class: 'badge' }, (w.icon || '👛'));
      const info = h('div', { class: 'info' },
        h('div', { class: 'issuer', text: s.label || s.account || t('crypto_account') }),
        h('div', { class: 'acct', text: s.seedPhrase ? '•••• seed' : (s.publicAddress || s.account || '') }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, badge, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('seed-edit', s));
      return row;
    }) : [emptyBox(w.icon || '👛', tf2('crypto_empty_title', name), t('crypto_empty_desc'))];
    mount(container, back, head, ...kids);
  }

  // ---------- Таб „Защита" (табло, 11.09.2026) ----------
  function drawSecurity() {
    const res = lastAudit();
    const grade = gradeOf(res ? res.overall : null);
    const color = grade === 'good' ? 'var(--accent)' : grade === 'mid' ? 'var(--warn)' : grade === 'bad' ? 'var(--danger)' : 'var(--border)';
    const head = h('div', { class: 'entry', style: 'cursor:pointer;gap:14px', onclick: () => nav.go('audit') },
      h('div', { style: 'width:64px;height:64px;border-radius:50%;border:6px solid ' + color + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.3em;flex:0 0 auto;color:' + (res ? color : 'var(--textDim)') }, res && res.overall != null ? String(res.overall) : '—'),
      h('div', { class: 'info' },
        h('div', { class: 'issuer', text: t('sec_card_audit') }),
        h('div', { class: 'acct', style: 'white-space:normal', text: res ? tf('sec_last_audit', new Date(res.at).toLocaleTimeString()) : t('sec_score_none') }),
        res ? h('div', { class: 'acct', style: 'white-space:normal', text: '🔴 ' + res.sum.breached + ' · 🟠 ' + res.sum.weak + '/' + res.sum.reused + ' · 🟡 ' + res.sum.no2fa + '/' + res.sum.old }) : null),
      h('button', { class: 'btn accent', style: 'width:auto;margin:0;padding:8px 12px;font-size:.85em', text: t('sec_run') }));
    const sub = h('p', { class: 'muted', style: 'font-size:.85em;margin:0 0 10px', text: t('sec_subtitle') });
    const li = legacyInfo();
    const cards = [
      { id: 'url', icon: '🔗', title: t('sec_card_url'), desc: t('sec_card_url_desc'), go: () => nav.go('urlcheck') },
      { id: 'legacy', icon: '📦', title: t('sec_card_legacy'), desc: li.lastAt ? tf('legacy_last', new Date(li.lastAt).toLocaleDateString() + (li.forWhom ? ' · ' + li.forWhom : '')) : t('sec_card_legacy_desc'), go: () => nav.go('legacy') },
      { id: 'convert', icon: '🔄', title: t('sec_card_convert'), desc: t('sec_card_convert_desc'), go: () => nav.go('settings') },
      { id: 'dups', icon: '🔍', title: t('find_duplicates'), desc: t('dup_similar'), go: () => nav.go('dups', { mode: 'passwords' }) },
      { id: 'search', icon: '🔎', title: t('search_all_title'), desc: t('search_all_hint'), go: () => nav.go('search') },
      { id: 'add', icon: '➕', title: t('add_account'), desc: t('import_file_hint'), go: () => nav.go('add') }
    ];
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px' },
      ...cards.map((c) => h('button', { class: 'btn ghost sec-card', 'data-id': c.id, style: 'display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px;height:auto;margin:0;text-align:left', onclick: c.go },
        h('div', { style: 'font-size:22px' }, c.icon),
        h('div', { style: 'font-weight:700;font-size:.9em', text: c.title }),
        h('div', { class: 'muted', style: 'font-size:.74em;font-weight:400;white-space:normal', text: c.desc }))));
    // броячи на сейфа
    const counts = [
      ['🔐', t('main_tab_auth'), session.entries.length], ['🔑', t('tab_passwords'), session.passwords.length], ['👛', t('tab_crypto'), session.seeds.length],
      ['▦', t('sub_qr'), session.collection.length], ['🖥', t('tab_ssh'), session.ssh.length], ['🌐', t('tab_networks'), session.networks.length], ['🪙', t('tab_tokens'), session.tokens.length]];
    const stats = h('div', { style: 'display:flex;gap:6px;overflow-x:auto;flex-wrap:nowrap;margin-top:14px;padding-bottom:4px' },
      ...counts.map((c) => h('div', { class: 'entry', style: 'flex:0 0 auto;flex-direction:column;gap:0;padding:8px 12px;margin:0;align-items:center;min-width:74px' },
        h('div', { style: 'font-size:1.1em' }, c[0]), h('div', { style: 'font-weight:800' }, String(c[2])), h('div', { class: 'muted', style: 'font-size:.7em;white-space:nowrap', text: c[1] }))));
    const statsHead = h('div', { class: 'muted', style: 'font-size:.8em;margin-top:14px', text: t('sec_stats') });
    // примери: добави (ако сейфът е празен) / махни
    const empty = !session.passwords.length && !session.entries.length;
    const samplesBtn = hasSamples()
      ? h('button', { class: 'btn ghost', id: 'secSamplesRemove', style: 'margin-top:12px', onclick: async () => { await removeSamples(); toast(t('samples_removed')); draw(); }, text: '🧹 ' + t('samples_remove') })
      : (empty ? h('button', { class: 'btn ghost', id: 'secSamplesAdd', style: 'margin-top:12px', onclick: async () => { const n = await addSamples(); toast(tf('samples_added', n)); draw(); }, text: '🧪 ' + t('samples_try') }) : null);
    const note = h('p', { class: 'muted', style: 'font-size:.78em;text-align:center;margin-top:10px', text: t('crypto_local_note') });
    mount(container, sub, head, grid, statsHead, stats, samplesBtn, note);
  }

  function emptyBox(icon, title, desc) {
    return h('div', { class: 'center' },
      h('div', { style: 'font-size:2.6em' }, icon),
      h('h1', { text: title }),
      h('p', { class: 'muted', text: desc }));
  }
  // локален tf (за да не разчитаме на импорт извън t) — прости {0}/{1} замествания
  function tf2(key, a, b) {
    return String(t(key)).replace('{0}', a).replace('{1}', b === undefined ? '' : b);
  }

  draw();
}
