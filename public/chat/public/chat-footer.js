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
  // Подредени по приоритет: Начало първо → основни функции → акаунт → приложение.
  // „Спешна помощ" се добавя ОТДЕЛНО най-накрая (виж build()).
  var LINKS = [
    { href: '/chat/public/index.html',       label: '🏠 Начало' },
    { href: '/chat/public/chat.html',        label: '💬 Чат' },
    { href: '/chat/public/search.html',      label: '🔍 Търсене' },
    { href: '/chat/public/matchmaking.html', label: '💞 Запознанства' },
    { href: '/chat/public/tasks.html',       label: '📋 Задачи' },
    { href: '/chat/public/signal.html',      label: '📢 Подай Обект' },
    { href: '/chat/public/profile.html',     label: '⚙️ Профил' },
    { href: '/chat/public/payment.html',     label: '💳 Плащане' },
    { href: '/chat/download/index.html',     label: '📱 Приложение' }
  ];

  var CSS = '' +
    '.ams-foot-menu{margin-top:28px;padding:16px;background:rgba(15,23,42,.6);' +
      'border-top:1px solid rgba(148,163,184,.25);display:flex;flex-wrap:wrap;gap:10px;' +
      'justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.ams-foot-menu a{color:#cbd5e1;text-decoration:none;font-size:13px;font-weight:600;' +
      'padding:6px 12px;border-radius:8px;background:rgba(148,163,184,.12)}' +
    '.ams-foot-menu a:hover{background:rgba(96,165,250,.25);color:#fff}' +
    '.ams-foot-menu a.cur{background:#2563eb;color:#fff}' +
    '.ams-authbar{position:fixed;top:8px;right:8px;z-index:9999;display:flex;gap:6px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.ams-authbar a{font-size:12px;font-weight:700;padding:6px 10px;border-radius:8px;' +
      'text-decoration:none;color:#fff;background:rgba(37,99,235,.92);box-shadow:0 1px 4px rgba(0,0,0,.35)}' +
    '.ams-authbar a.ams-in{background:rgba(22,163,74,.95)}' +
    '.ams-authbar .ams-who{font-size:12px;font-weight:700;padding:6px 10px;border-radius:8px;' +
      'color:#fff;background:rgba(71,85,105,.92);box-shadow:0 1px 4px rgba(0,0,0,.35);max-width:200px;' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ams-authbar a:hover{opacity:.88}' +
    // Бутон „Спешна помощ" в долното меню + потвърждаващ прозорец
    '.ams-foot-emg{font-size:13px;font-weight:800;padding:6px 14px;border-radius:8px;border:none;' +
      'cursor:pointer;color:#fff;background:#c62828}' +
    '.ams-foot-emg:hover{background:#e53935}' +
    '.ams-emg-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:10000;display:none;' +
      'align-items:center;justify-content:center;padding:16px}' +
    '.ams-emg-overlay.on{display:flex}' +
    '.ams-emg-box{background:#1f2937;color:#e5e7eb;max-width:480px;width:100%;border-radius:14px;' +
      'padding:22px;border:2px solid #c62828;box-shadow:0 10px 40px rgba(0,0,0,.5);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.ams-emg-box h2{color:#f87171;font-size:20px;font-weight:800;margin:0 0 10px}' +
    '.ams-emg-box p{font-size:14px;line-height:1.6;margin:0 0 10px}' +
    '.ams-emg-box .warn{font-weight:800;color:#fca5a5}' +
    '.ams-emg-status{font-size:13px;min-height:18px;margin:8px 0;color:#fcd34d}' +
    '.ams-emg-actions{display:flex;gap:10px;margin-top:8px}' +
    '.ams-emg-actions button{flex:1;padding:12px;border:none;border-radius:8px;font-weight:800;' +
      'font-size:16px;cursor:pointer}' +
    '.ams-emg-yes{background:#16a34a;color:#fff}.ams-emg-no{background:#4b5563;color:#fff}';

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

    buildAuthBadge();   // горе вдясно: индикатор за вход

    var here = location.pathname.replace(/\/+$/, '');
    var nav = document.createElement('nav');
    nav.className = 'ams-foot-menu';
    nav.innerHTML = LINKS.map(function (l) {
      var cur = l.href.replace(/\/+$/, '') === here ? ' class="cur"' : '';
      return '<a href="' + l.href + '"' + cur + '>' + l.label + '</a>';
    }).join('');
    // Бутон „Спешна помощ" — директно извикване, с потвърждение преди това.
    var emg = document.createElement('button');
    emg.type = 'button';
    emg.className = 'ams-foot-emg';
    emg.textContent = '🆘 Спешна помощ';
    emg.onclick = openEmergency;
    nav.appendChild(emg);

    document.body.appendChild(nav);

    // Контейнер за фирмения футър — kg-compliance.js го попълва най-отдолу.
    var footEl = document.querySelector('.kg-foot');
    if (!footEl) {
      footEl = document.createElement('footer');
      footEl.className = 'kg-foot';
      document.body.appendChild(footEl);
    }

    // Ако <body> е flex/grid (центрира съдържанието) → менюто и футърът да са
    // ПЪЛЕН РЕД най-отдолу, а не съседни колони (иначе изглеждат като 3-та колона).
    try {
      var cs = getComputedStyle(document.body);
      if (cs.display.indexOf('flex') >= 0 || cs.display.indexOf('grid') >= 0) {
        if (cs.display.indexOf('flex') >= 0) document.body.style.flexWrap = 'wrap';
        [nav, footEl].forEach(function (el) {
          el.style.width = '100%';
          el.style.flex = '0 0 100%';
          el.style.order = '999';
          el.style.gridColumn = '1 / -1';
        });
      }
    } catch (e) {}

    ensureCompliance();
  }

  // Горе вдясно на всяка чат страница: ако е логнат → линк към Профил;
  // ако НЕ е → линкове към Вход и Регистрация.
  function buildAuthBadge() {
    if (document.querySelector('.ams-authbar')) return;
    var token = null;
    try { token = localStorage.getItem('token'); } catch (e) {}
    var bar = document.createElement('div');
    bar.className = 'ams-authbar';
    if (token) {
      bar.innerHTML = '<span class="ams-who" id="amsAuthName"></span>' +
                      '<a class="ams-in" href="/chat/public/profile.html">⚙️ Профил</a>';
      document.body.appendChild(bar);
      // Показва КАТО КОГО е логнат — пълното име, дозарежда се от профила.
      fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (u) {
          var el = document.getElementById('amsAuthName');
          if (el && u && u.full_name) el.textContent = '👤 ' + u.full_name;
        }).catch(function () {});
    } else {
      bar.innerHTML = '<a href="/chat/public/index.html">🔑 Вход</a>' +
                      '<a href="/chat/register.html">📝 Регистрация</a>';
      document.body.appendChild(bar);
    }
  }

  // ── Спешна помощ: прозорец за потвърждение (НЕ browser-попъп) + изпращане ──
  function emgModal() {
    var ov = document.querySelector('.ams-emg-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'ams-emg-overlay';
    ov.innerHTML =
      '<div class="ams-emg-box">' +
        '<h2>🆘 Спешна помощ</h2>' +
        '<p>При натискане на <b>ДА</b> изпращате точната си локация до администратора, който може да ' +
          'сигнализира институции (Полиция, Бърза помощ, Болница), за да Ви се притекат на помощ. Възможно е ' +
          'първо да се свържат с Вас, за да потвърдят сигнала и местоположението Ви.</p>' +
        '<p>Това отнема 15 дни от абонамента (или ползва предплатеното за спешна помощ). Лимит: 1 път на месец.</p>' +
        '<p class="warn">Ако се нуждаете от спешна помощ — моля потвърдете с ДА!</p>' +
        '<div class="ams-emg-status"></div>' +
        '<div class="ams-emg-actions">' +
          '<button type="button" class="ams-emg-yes">ДА</button>' +
          '<button type="button" class="ams-emg-no">НЕ</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    var status = ov.querySelector('.ams-emg-status');
    ov.querySelector('.ams-emg-no').onclick = function () { ov.classList.remove('on'); };
    ov.querySelector('.ams-emg-yes').onclick = function () { sendEmergencyNow(status); };
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('on'); });
    return ov;
  }

  function openEmergency() {
    var ov = emgModal();
    ov.querySelector('.ams-emg-status').textContent = '';
    ov.classList.add('on');
  }

  function sendEmergencyNow(statusEl) {
    var token = null;
    try { token = localStorage.getItem('token'); } catch (e) {}
    if (!token) { statusEl.textContent = 'Трябва да си влязъл, за да подадеш сигнал за спешна помощ.'; return; }
    if (!navigator.geolocation) { statusEl.textContent = 'Устройството не поддържа локация.'; return; }
    statusEl.textContent = '⏳ Засичане на локация и изпращане...';
    navigator.geolocation.getCurrentPosition(function (pos) {
      fetch('/api/help/emergency', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok) {
            statusEl.innerHTML = '✅ Сигналът е изпратен! Администраторът е уведомен с локацията Ви. ' +
              (res.d.used_prepaid ? '(използвано е предплатеното за спешна помощ)' : '(отнети са 15 дни от абонамента)') +
              ' · ИД: ' + res.d.request_id;
          } else {
            statusEl.textContent = '⚠️ ' + (res.d.message || res.d.error || 'Неуспешно изпращане.');
          }
        }).catch(function () { statusEl.textContent = '⚠️ Грешка при изпращане. Опитай пак.'; });
    }, function (err) {
      statusEl.textContent = '⚠️ Няма достъп до локацията: ' + err.message;
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

// ── „Още от KCY Ecosystem" — плаващ бутон със ✕ (Version: 1.0005) ─────────────────────────
// Зарежда kcy-eco-web.js (копие на public/shared/kcy-eco-web.js, седи до този файл) САМО когато
// сайтът е отворен ВЪТРЕ в мобилното приложение (Capacitor) — посетителите в браузър не го виждат.
(function () {
  try {
    if (!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())) return;
    var me = document.querySelector('script[src*="chat-footer.js"]');
    var src = me ? me.getAttribute('src').replace(/chat-footer\.js.*$/, 'kcy-eco-web.js?v=1.0005') : '/chat/public/kcy-eco-web.js?v=1.0005';
    var s = document.createElement('script');
    s.src = src; s.setAttribute('data-kcy-app', 'chat');
    document.head.appendChild(s);
  } catch (e) {}
})();
