// KCY Ecosystem — СИСТЕМНО меню (различно от ecosystem nav-а).
// За служебните/инструментални страници: System Status, Робот, Дърво.
// Дава: 🏠 Начало + връзки между 3-те страници + админ dropdown за прескачане
// между админските панели + "ЛОГНАТ АДМИН" бадж + бутон "изключи".
// Логиката за админ статуса/гост-режима е същата като в navigation.js
// (cookie kcy-guest-mode, /api/portals/ip-admin), за да е консистентно.
(function () {
  'use strict';

  // Връзки между служебните страници + начало.
  var TOOLS = [
    { href: '/',                          label: '🏠 Начало' },
    { href: '/shared/admin-status.html',  label: '🩺 Статус' },
    { href: '/shared/robot.html',         label: '🤖 Робот' },
    { href: '/tree/',                     label: '🌳 Дърво' }
  ];

  // Същите цели като админ дропдауна в navigation.js.
  var ADMIN = [
    { v: '/shared/admin-status.html',     t: '🩺 System Status' },
    { v: '/shared/robot.html',            t: '🤖 Робот (тест)' },
    { v: '/tree/',                        t: '🌳 Дърво на сайта' },
    { v: '',                              t: '──────────────', disabled: true },
    { v: '/token/admin/scripts.html',     t: '🪙 Token Admin' },
    { v: '/brch1/admin/',                 t: '💰 BRCH1 Admin' },
    { v: '/multisig/admin/',              t: '🔐 Multi-Sig Admin' },
    { v: '/chat/admin/index.html',        t: '💬 Chat Admin' },
    { v: '/eco-3/admin/',                 t: '🤖 ECO-3 Admin' },
    { v: '/portals/admin.html',           t: '🎮 Portals Admin' },
    { v: '/houselookbook/admin.html',     t: '🏠 House-Look-Book Admin' },
    { v: '/wherenobiz/admin.html',        t: '🌍 WhereNoBiz Admin' }
  ];

  var CSS = '' +
    '.kcy-sysnav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;' +
      'background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);color:#fff;' +
      'padding:10px 16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.3);}' +
    '.kcy-sysnav .brand{font-weight:700;margin-right:6px;white-space:nowrap;}' +
    '.kcy-sysnav a.tool{color:#e6edf3;text-decoration:none;padding:7px 12px;border-radius:7px;' +
      'font-size:14px;font-weight:600;background:rgba(255,255,255,.08);white-space:nowrap;transition:background .2s;}' +
    '.kcy-sysnav a.tool:hover{background:rgba(255,255,255,.18);}' +
    '.kcy-sysnav a.tool.on{background:#4fc3f7;color:#06222e;}' +
    '.kcy-sysnav .sys-admin{display:none;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap;}' +
    '.kcy-sysnav .sys-badge{font-size:12px;font-weight:700;white-space:nowrap;}' +
    '.kcy-sysnav .sys-toggle{padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.4);' +
      'background:transparent;color:#fff;cursor:pointer;font-size:12px;}' +
    '.kcy-sysnav .sys-toggle:hover{background:rgba(255,255,255,.15);}' +
    '.kcy-sysnav select{padding:7px 10px;border-radius:7px;border:none;font-size:13px;cursor:pointer;' +
      'background:#fff;color:#222;}';

  function isGuestMode() {
    return /(?:^|;\s*)kcy-guest-mode=1(?:;|$)/.test(document.cookie);
  }

  function build() {
    if (document.querySelector('.kcy-sysnav')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var here = location.pathname.replace(/\/+$/, '') || '/';

    var toolsHtml = TOOLS.map(function (l) {
      var h = l.href.replace(/\/+$/, '') || '/';
      var on = (h === here) ? ' on' : '';
      return '<a class="tool' + on + '" href="' + l.href + '">' + l.label + '</a>';
    }).join('');

    var optsHtml = ADMIN.map(function (o) {
      return '<option value="' + o.v + '"' + (o.disabled ? ' disabled' : '') + '>' + o.t + '</option>';
    }).join('');

    var nav = document.createElement('nav');
    nav.className = 'kcy-sysnav';
    nav.innerHTML =
      '<span class="brand">🚀 KCY</span>' +
      toolsHtml +
      '<span class="sys-admin" id="sysAdmin">' +
        '<span class="sys-badge" id="sysBadge">🔴 ЛОГНАТ АДМИН</span>' +
        '<button class="sys-toggle" id="sysToggle" title="Превключи между админ изглед и изглед като гост">изключи</button>' +
        '<select id="sysAdminSel" onchange="if(this.value) window.location.href=this.value">' +
          '<option value="">⚙️ Админ панели ▼</option>' +
          optsHtml +
        '</select>' +
      '</span>';

    if (document.body.firstChild) document.body.insertBefore(nav, document.body.firstChild);
    else document.body.appendChild(nav);

    setupToggle();
    checkIpAdmin();
    rewriteCrossApp();
  }

  // Кръстосаните линкове (чат/wnb/hlb) → отделните им домейни. Картата идва от
  // app-domains.js (генериран от domains.conf). Минава по целия документ (вкл. <option>).
  function rewriteCrossApp() {
    function go() { if (window.kcyRewriteCrossAppLinks) window.kcyRewriteCrossAppLinks(); }
    if (window.kcyRewriteCrossAppLinks) { go(); return; }
    var s = document.createElement('script');
    s.src = '/shared/js/app-domains.js?v=1.0193';
    s.onload = go;
    document.head.appendChild(s);
  }

  // "ЛОГНАТ АДМИН" + "изключи" — същата cookie (kcy-guest-mode) като navigation.js.
  function setupToggle() {
    var btn = document.getElementById('sysToggle');
    var badge = document.getElementById('sysBadge');
    if (!btn) return;
    if (isGuestMode()) {
      btn.textContent = 'включи';
      if (badge) { badge.textContent = '⚪ АДМИН ИЗКЛЮЧЕН (изглед като гост)'; badge.style.opacity = '.7'; }
    } else {
      btn.textContent = 'изключи';
      if (badge) { badge.textContent = '🔴 ЛОГНАТ АДМИН'; badge.style.opacity = '1'; }
    }
    btn.addEventListener('click', function () {
      if (isGuestMode()) document.cookie = 'kcy-guest-mode=; path=/; max-age=0';
      else document.cookie = 'kcy-guest-mode=1; path=/; max-age=86400';
      location.reload();
    });
  }

  // Показва админ блока САМО ако сървърът третира IP-то като админ.
  function checkIpAdmin() {
    var block = document.getElementById('sysAdmin');
    if (!block) return;
    fetch('/api/portals/ip-admin', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.ip_admin) {
          block.style.display = 'flex';
          try { sessionStorage.setItem('kcy-adm', 'bgmasters-set'); } catch (e) {}
        }
      })
      .catch(function () { /* не е админ IP — остава скрит */ });
  }

  // ── ГАРД (точка 4): системните страници (Статус/Робот/Дърво) са достъпни
  // САМО за ЛОГНАТ АДМИН (роля admin) И от позволен IP. Иначе — отказ/редирект.
  function guardAdminPage() {
    Promise.all([
      fetch('/api/portals/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('/api/portals/ip-admin', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      var me = res[0], ipa = res[1];
      var loggedAdmin = !!(me && me.logged_in && me.is_admin); // is_admin = роля admin (не модератор)
      var ipOk = !!(ipa && ipa.ip_admin);
      if (loggedAdmin && ipOk) return; // достъп разрешен
      if (!me || !me.logged_in) {
        // не си логнат → към порталс-логин
        location.href = '/portals/login.html?next=' + encodeURIComponent(location.pathname);
        return;
      }
      // логнат, но не админ ИЛИ грешен IP → отказ (без redirect-цикъл)
      document.body.innerHTML =
        '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:560px;margin:80px auto;padding:30px;text-align:center;color:#e6edf3;background:#16202b;border-radius:12px">' +
        '<h2>🔒 Само за администратор</h2>' +
        '<p>Тази страница е достъпна само за <b>логнат админ</b> и от <b>позволен IP адрес</b>.</p>' +
        (!loggedAdmin ? '<p>⛔ Не си логнат с админ профил.</p>' : '') +
        (!ipOk ? '<p>⛔ IP адресът ти не е в списъка.</p>' : '') +
        '<p style="margin-top:18px"><a href="/portals/login.html" style="color:#4fc3f7">Вход</a> &nbsp;·&nbsp; <a href="/" style="color:#4fc3f7">Начало</a></p></div>';
    });
  }

  function init() { guardAdminPage(); build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
