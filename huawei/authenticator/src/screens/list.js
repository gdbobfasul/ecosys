// Version: 1.0013
// list.js — главният екран след отключване, с четири таба:
//   „Аутентикация" (въртящи се кодове), „Колекция" (запазени QR кодове),
//   „Пароли" (заглавие/логин/парола/описание) и „Портфейли" (крипто акаунти по портфейл).
//   ВСИЧКИ са в шифрирания сейф — само на устройството, нищо не се качва.
import { h, mount, toast, copyText } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { THEME } from '../theme.js';
import { session, incrementCounter, seedCountFor } from '../core/storage.js';
import { generateCode, secondsRemaining } from '../core/otp.js';
import { WALLETS, walletByKey, maxForWallet } from '../core/wallets.js';

let tickTimer = null;
let activeTab = 'auth';       // запазва се между влизанията
let selectedWallet = null;    // в таб „Портфейли": избраният портфейл (null = решетката)
let pwdSort = 'name';         // подредба на паролите: 'name' (азбучно) | 'site' (по сайт)
let sshSort = 'ip';           // подредба на SSH: 'ip' (по хост/IP) | 'name' (по име)

export function renderList(root, nav) {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }

  const topbar = h('div', { class: 'topbar' },
    h('h1', { text: THEME.appName }),
    h('button', { class: 'icon-btn', title: t('settings_title'), onclick: () => nav.go('settings') }, '⚙️')
  );
  const container = h('div', { class: 'content' });
  const fab = h('button', { class: 'fab', onclick: fabAction }, '+');

  const tabs = [
    { key: 'auth', icon: '🔐', label: t('tab_auth') },
    { key: 'collection', icon: '🗂', label: t('tab_collection') },
    { key: 'passwords', icon: '🔑', label: t('tab_passwords') },
    { key: 'crypto', icon: '👛', label: t('tab_crypto') },
    { key: 'ssh', icon: '🖥', label: t('tab_ssh') },
    { key: 'networks', icon: '🌐', label: t('tab_networks') },
    { key: 'tokens', icon: '🪙', label: t('tab_tokens') }
  ];
  // Табовете вече са много → лентата е ХОРИЗОНТАЛНО ПЛЪЗГАЩА СЕ (flex-nowrap + overflow-x), а
  // всеки бутон е с фиксирана минимална ширина, за да не се смачкват.
  const tabbar = h('div', { class: 'tabbar', style: 'overflow-x:auto;flex-wrap:nowrap;justify-content:flex-start;-webkit-overflow-scrolling:touch' },
    ...tabs.map((tb) => h('button', {
      class: 'tab' + (activeTab === tb.key ? ' on' : ''),
      style: 'flex:0 0 auto;min-width:62px',
      onclick: () => { activeTab = tb.key; if (tb.key !== 'crypto') selectedWallet = null; draw(); }
    }, h('div', {}, tb.icon), h('div', { class: 'tablabel', text: tb.label })))
  );

  mount(root, topbar, container, fab, tabbar);

  function fabAction() {
    if (activeTab === 'auth') nav.go('add');
    else if (activeTab === 'collection') nav.go('collection-add');
    else if (activeTab === 'passwords') nav.go('password-edit');
    else if (activeTab === 'ssh') nav.go('ssh-edit');
    else if (activeTab === 'networks') nav.go('network-edit');
    else if (activeTab === 'tokens') nav.go('token-edit');
    else { // крипто: добавя за избрания портфейл (ако е избран), иначе подсказва
      if (!selectedWallet) { toast(t('crypto_pick_wallet')); return; }
      if (seedCountFor(selectedWallet) >= maxForWallet(selectedWallet)) { toast(t('crypto_limit_reached')); return; }
      nav.go('seed-edit', { wallet: selectedWallet });
    }
  }

  function draw() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    [...tabbar.children].forEach((b, i) => b.classList.toggle('on', tabs[i].key === activeTab));
    if (activeTab === 'auth') drawAuth();
    else if (activeTab === 'collection') drawCollection();
    else if (activeTab === 'passwords') drawPasswords();
    else if (activeTab === 'ssh') drawSsh();
    else if (activeTab === 'networks') drawNetworks();
    else if (activeTab === 'tokens') drawTokens();
    else drawCrypto();
  }

  // Сортиране: азбучно/числово, независимо от регистъра.
  function byText(a, b) { return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' }); }
  // Хост без протокол/www (за подредба на пароли „по сайт").
  function siteOf(p) {
    const u = String(p.url || p.title || '');
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; }
  }

  // ---------- Таб „Аутентикация" ----------
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

  // ---------- Таб „Колекция" ----------
  function drawCollection() {
    if (!session.collection.length) { mount(container, emptyBox('🗂', t('empty_col_title'), t('empty_col_desc'))); return; }
    const rows = session.collection.map((c) => {
      const thumb = c.image
        ? h('img', { src: c.image, style: 'width:42px;height:42px;border-radius:8px;object-fit:cover;background:#fff' })
        : h('div', { class: 'badge' }, '▦');
      const info = h('div', { class: 'info' }, h('div', { class: 'issuer', text: c.title || '—' }),
        h('div', { class: 'acct', text: c.content || '' }));
      const row = h('div', { class: 'entry', style: 'cursor:pointer' }, thumb, info, h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => nav.go('collection-view', c));
      return row;
    });
    mount(container, ...rows);
  }

  // ---------- Таб „Пароли" ----------
  function drawPasswords() {
    if (!session.passwords.length) { mount(container, emptyBox('🔑', t('empty_pwd_title'), t('empty_pwd_desc'))); return; }
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
    mount(container, sortBtn, ...rows);
  }

  // ---------- Таб „SSH" (отдалечен достъп) ----------
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

  // ---------- Таб „Мрежи" (EVM RPC) ----------
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

  // ---------- Таб „Токени" (custom ERC-20) ----------
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

  // ---------- Таб „Портфейли" (крипто акаунти по портфейл) ----------
  function drawCrypto() {
    if (!selectedWallet) return drawWalletGrid();
    return drawWalletAccounts(selectedWallet);
  }

  // Решетка от портфейли (плочки с икона + име + брой акаунти).
  function drawWalletGrid() {
    const note = h('p', { class: 'muted', style: 'font-size:.82em;text-align:center;margin:2px 0 12px', text: t('crypto_local_note') });
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:10px' },
      ...WALLETS.map((w) => {
        const cnt = seedCountFor(w.key);
        const name = w.isOther ? t('crypto_other') : w.name;
        const tile = h('button', {
          class: 'btn ghost',
          style: 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 8px;height:auto;margin:0;border-left:4px solid ' + w.color,
          onclick: () => { selectedWallet = w.key; draw(); }
        },
          h('div', { style: 'font-size:26px' }, w.icon),
          h('div', { style: 'font-weight:700', text: name }),
          h('div', { class: 'muted', style: 'font-size:.8em', text: cnt ? tf2('crypto_count', cnt, maxForWallet(w.key)) : t('crypto_add_here') }));
        return tile;
      }));
    mount(container, note, grid);
  }

  // Списък с акаунтите за избран портфейл + бутон „назад".
  function drawWalletAccounts(key) {
    const w = walletByKey(key);
    const name = w.isOther ? t('crypto_other') : w.name;
    const back = h('button', { class: 'btn ghost', style: 'margin:0 0 10px', onclick: () => { selectedWallet = null; draw(); } }, '← ' + t('crypto_all_wallets'));
    const head = h('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px' },
      h('div', { style: 'font-size:22px' }, w.icon),
      h('h1', { style: 'margin:0;font-size:1.1em', text: name }),
      h('div', { class: 'muted', style: 'margin-left:auto;font-size:.85em', text: tf2('crypto_count', seedCountFor(key), maxForWallet(key)) }));
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
