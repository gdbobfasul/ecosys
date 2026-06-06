// AMS Chat — споделено админ меню (ЕДНО за всички админ-страници).
// Изглежда като лентата на admin.html: Маркирани · Всички · Потребители+съобщения ·
// Сигнали · Запознанства · Статични обекти · Плащане (ръчно) · Изход.
// Инжектира се под ecosystem хедъра (navigation.js). Пътищата са абсолютни →
// работи и от /chat/admin/, и от /chat/public/. Само български (служебна част).
(function () {
  'use strict';

  // adminOnly: 1 → скрива се за модератори (те правят само Сигнали/Запознанства/Статични).
  var LINKS = [
    { href: '/chat/admin/admin.html?view=flagged',    cls: 'flagged',  label: '🚩 Маркирани',              adminOnly: 1 },
    { href: '/chat/admin/admin.html?view=all',        cls: 'all',      label: 'Всички',                    adminOnly: 1 },
    { href: '/chat/admin/admin.html?view=messages',   cls: 'messages', label: 'Потребители + съобщения',   adminOnly: 1 },
    { href: '/chat/admin/admin-signals.html',         cls: 'signals',  label: '📊 Сигнали' },
    { href: '/chat/admin/admin-matchmaking.html',     cls: 'match',    label: '💞 Запознанства' },
    { href: '/chat/admin/admin-static-objects.html',  cls: 'static',   label: '📄 Статични обекти' },
    { href: '/chat/public/payment-override.html',     cls: 'payment',  label: '💳 Плащане (ръчно)',        adminOnly: 1 }
  ];

  var CSS = '' +
    '.ams-adminnav{display:flex;flex-wrap:wrap;gap:10px;align-items:center;' +
      'background:#fff;padding:14px 16px;border-radius:0 0 10px 10px;margin:0 0 20px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.10);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;}' +
    '.ams-adminnav a,.ams-adminnav button{padding:10px 16px;border:none;border-radius:8px;color:#fff;' +
      'cursor:pointer;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;transition:opacity .2s;white-space:nowrap;}' +
    '.ams-adminnav a:hover,.ams-adminnav button:hover{opacity:.85;}' +
    '.ams-adminnav .flagged{background:#e53935;}' +
    '.ams-adminnav .all{background:#1e88e5;}' +
    '.ams-adminnav .messages{background:#43a047;}' +
    '.ams-adminnav .signals{background:#00897b;}' +
    '.ams-adminnav .match{background:#d81b60;}' +
    '.ams-adminnav .static{background:#5e35b1;}' +
    '.ams-adminnav .payment{background:#8e24aa;}' +
    '.ams-adminnav .logout{background:#757575;margin-left:auto;}' +
    '.ams-adminnav a.on{outline:3px solid rgba(0,0,0,.22);outline-offset:1px;cursor:default;}';

  function build() {
    if (document.querySelector('.ams-adminnav')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Текущ маршрут (+ ?view= за бутоните на admin.html).
    var here = location.pathname.replace(/\/+$/, '') || '/';
    var view = (new URLSearchParams(location.search)).get('view') || '';

    // Модераторите не виждат админ-only бутоните.
    var isMod = false;
    try { isMod = localStorage.getItem('role') === 'moderator'; } catch (e) {}

    var bar = document.createElement('nav');
    bar.className = 'ams-adminnav';

    var html = '';
    LINKS.forEach(function (l) {
      if (isMod && l.adminOnly) return;
      var lp = l.href.split('?')[0].replace(/\/+$/, '');
      var lv = (l.href.split('view=')[1] || '');
      var on = (lp === here && (!lv || lv === view)) ? ' on' : '';
      html += '<a href="' + l.href + '" class="' + l.cls + on + '">' + l.label + '</a>';
    });
    html += '<button class="logout" id="amsAdminLogout">Изход</button>';
    bar.innerHTML = html;

    // Под ecosystem хедъра (.kcy-nav), иначе най-отгоре в body.
    var eco = document.querySelector('.kcy-nav');
    if (eco && eco.parentNode) eco.parentNode.insertBefore(bar, eco.nextSibling);
    else if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
    else document.body.appendChild(bar);

    var lo = document.getElementById('amsAdminLogout');
    if (lo) lo.onclick = function () {
      try { localStorage.removeItem('token'); localStorage.removeItem('userId'); localStorage.removeItem('role'); } catch (e) {}
      location.href = '/chat/admin/admin.html';
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
