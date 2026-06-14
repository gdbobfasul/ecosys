// AMS Chat — споделен футър за всички чат страници:
//   1) „footer menu" с всички страници, на които посетителят може да отиде;
//   2) контейнер за фирмения футър (kg-compliance.js: лога Visa/MC/Элкарт + данни на фирмата).
// Включвай само това на всяка страница:
//   <script src="/chat/public/chat-footer.js?v=1.0001"></script>
// Скриптът сам зарежда kg-compliance.js, ако страницата вече не го зарежда.
(function () {
  'use strict';
  if (window.__amsChatFooter) return;
  window.__amsChatFooter = true;

  // Всички страници, достъпни за посетителя.
  var LINKS = [
    { href: '/chat/public/chat.html',        label: '💬 Чат' },
    { href: '/chat/public/search.html',      label: '🔍 Търсене' },
    { href: '/chat/public/matchmaking.html', label: '💞 Запознанства' },
    { href: '/chat/public/tasks.html',       label: '📋 Задачи' },
    { href: '/chat/public/signal.html',      label: '📢 Подай сигнал' },
    { href: '/chat/public/profile.html',     label: '⚙️ Профил' },
    { href: '/chat/public/payment.html',     label: '💳 Плащане' },
    { href: '/chat/download/index.html',     label: '📱 Приложение' },
    { href: '/chat/public/index.html',       label: '🏠 Начало' }
  ];

  var CSS = '' +
    '.ams-foot-menu{margin-top:28px;padding:16px;background:rgba(15,23,42,.6);' +
      'border-top:1px solid rgba(148,163,184,.25);display:flex;flex-wrap:wrap;gap:10px;' +
      'justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.ams-foot-menu a{color:#cbd5e1;text-decoration:none;font-size:13px;font-weight:600;' +
      'padding:6px 12px;border-radius:8px;background:rgba(148,163,184,.12)}' +
    '.ams-foot-menu a:hover{background:rgba(96,165,250,.25);color:#fff}' +
    '.ams-foot-menu a.cur{background:#2563eb;color:#fff}';

  function ensureCompliance() {
    if (window.KGCompliance) return;                                   // вече е зареден
    if (document.querySelector('script[src*="kg-compliance"]')) return; // страницата сама го зарежда
    var s = document.createElement('script');
    s.src = '/shared/js/kg-compliance.js?v=1.0003';
    document.body.appendChild(s);
  }

  function build() {
    if (document.querySelector('.ams-foot-menu')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var here = location.pathname.replace(/\/+$/, '');
    var nav = document.createElement('nav');
    nav.className = 'ams-foot-menu';
    nav.innerHTML = LINKS.map(function (l) {
      var cur = l.href.replace(/\/+$/, '') === here ? ' class="cur"' : '';
      return '<a href="' + l.href + '"' + cur + '>' + l.label + '</a>';
    }).join('');
    document.body.appendChild(nav);

    // Контейнер за фирмения футър — kg-compliance.js го попълва най-отдолу.
    if (!document.querySelector('.kg-foot')) {
      var f = document.createElement('footer');
      f.className = 'kg-foot';
      document.body.appendChild(f);
    }

    ensureCompliance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
