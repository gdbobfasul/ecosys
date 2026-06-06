// AMS Chat — споделено админ меню (същите бутони като на admin.html).
// Инжектира лента с линкове към всички админ секции + Изход, на която и да е
// админ/служебна страница. Подрежда се ПОД ecosystem хедъра (navigation.js),
// ако той присъства. Пътищата са абсолютни → работят и от /chat/admin/, и от
// /chat/public/. Само български (служебна част, не се превежда).
(function () {
  'use strict';

  var LINKS = [
    { href: '/chat/admin/admin.html',                 cls: 'admin',    label: '🛠️ Админ панел' },
    { href: '/chat/admin/admin-signals.html',         cls: 'signals',  label: '📊 Сигнали' },
    { href: '/chat/admin/admin-matchmaking.html',     cls: 'match',    label: '💞 Запознанства' },
    { href: '/chat/admin/admin-static-objects.html',  cls: 'static',   label: '📄 Статични обекти' },
    { href: '/chat/public/payment-override.html',     cls: 'payment',  label: '💳 Плащане (ръчно)' }
  ];

  var CSS = '' +
    '.ams-adminnav{display:flex;flex-wrap:wrap;gap:10px;align-items:center;' +
      'background:#fff;padding:14px 16px;border-radius:10px;margin:0 0 20px;' +
      'box-shadow:0 2px 10px rgba(0,0,0,0.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;}' +
    '.ams-adminnav a,.ams-adminnav button{padding:10px 16px;border:none;border-radius:8px;color:#fff;' +
      'cursor:pointer;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;transition:opacity .2s;}' +
    '.ams-adminnav a:hover,.ams-adminnav button:hover{opacity:.85;}' +
    '.ams-adminnav .admin{background:#37474f;}' +
    '.ams-adminnav .signals{background:#00897b;}' +
    '.ams-adminnav .match{background:#d81b60;}' +
    '.ams-adminnav .static{background:#5e35b1;}' +
    '.ams-adminnav .payment{background:#8e24aa;}' +
    '.ams-adminnav .logout{background:#757575;margin-left:auto;}' +
    '.ams-adminnav a.on{outline:3px solid rgba(0,0,0,.25);outline-offset:1px;cursor:default;opacity:1;}';

  function build() {
    if (document.querySelector('.ams-adminnav')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var here = location.pathname.replace(/\/+$/, '');
    var bar = document.createElement('nav');
    bar.className = 'ams-adminnav';

    var html = '';
    LINKS.forEach(function (l) {
      var on = (l.href.replace(/\/+$/, '') === here) ? ' on' : '';
      html += '<a href="' + l.href + '" class="' + l.cls + on + '">' + l.label + '</a>';
    });
    html += '<button class="logout" id="amsAdminLogout">Изход</button>';
    bar.innerHTML = html;

    // Под ecosystem хедъра (ако има .kcy-nav), иначе най-отгоре в body.
    var eco = document.querySelector('.kcy-nav');
    if (eco && eco.parentNode) {
      eco.parentNode.insertBefore(bar, eco.nextSibling);
    } else if (document.body.firstChild) {
      document.body.insertBefore(bar, document.body.firstChild);
    } else {
      document.body.appendChild(bar);
    }

    var lo = document.getElementById('amsAdminLogout');
    if (lo) lo.onclick = function () {
      try { localStorage.removeItem('token'); localStorage.removeItem('userId'); } catch (e) {}
      location.href = '/chat/admin/admin.html';
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
