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
    { href: '/chat/admin/admin-help.html',            cls: 'help',     label: '🆘 Спешна помощ<span class="hb" id="amsHelpBadge"></span>', adminOnly: 1 },
    { href: '/chat/admin/admin-signals.html',         cls: 'signals',  label: '📊 Сигнали' },
    { href: '/chat/admin/admin-matchmaking.html',     cls: 'match',    label: '💞 Запознанства' },
    { href: '/chat/admin/admin-tasks.html',           cls: 'tasks',    label: '📋 Задачи',                 adminOnly: 1 },
    { href: '/chat/admin/admin-verification.html',    cls: 'verify',   label: '🩺 Верификации<span class="vb" id="amsVerifyBadge"></span>', adminOnly: 1 },
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
    '.ams-adminnav .help{background:#c62828;}' +
    '.ams-adminnav a.help .hb{display:none;margin-left:7px;background:#fff;color:#c62828;border-radius:11px;padding:1px 8px;font-size:12px;font-weight:800;}' +
    '.ams-adminnav a.help.alarm .hb{display:inline-block;}' +
    '.ams-adminnav a.help.alarm{animation:amsBlink 1s steps(1) infinite;}' +
    '@keyframes amsBlink{0%,100%{background:#c62828;}50%{background:#ff7043;box-shadow:0 0 14px 3px rgba(229,57,53,.85);}}' +
    '.ams-adminnav .signals{background:#00897b;}' +
    '.ams-adminnav .match{background:#d81b60;}' +
    '.ams-adminnav .tasks{background:#00838f;}' +
    '.ams-adminnav .verify{background:#1565c0;}' +
    '.ams-adminnav a.verify .vb{display:none;margin-left:7px;background:#fff;color:#1565c0;border-radius:11px;padding:1px 8px;font-size:12px;font-weight:800;}' +
    '.ams-adminnav a.verify.has .vb{display:inline-block;}' +
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

    // Аларма за спешна помощ — само за админи (модераторите нямат линка).
    if (!isMod) startHelpAlarm();
    // Брояч на чакащи заявки за верификация (само за админи).
    if (!isMod) startVerifyBadge();
  }

  // ── Бадж „Верификации" (чакащи заявки) ───────────────────────────────────
  function pollVerify() {
    var token = null;
    try { token = localStorage.getItem('token'); } catch (e) {}
    var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    fetch('/api/admin/verification-requests?status=pending', { headers: headers, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var n = parseInt(d.pending_count, 10) || 0;
        var link = document.querySelector('.ams-adminnav a.verify');
        var badge = document.getElementById('amsVerifyBadge');
        if (!link) return;
        if (n > 0) { link.classList.add('has'); if (badge) badge.textContent = n; }
        else { link.classList.remove('has'); if (badge) badge.textContent = ''; }
      })
      .catch(function () {});
  }

  function startVerifyBadge() {
    pollVerify();
    setInterval(pollVerify, 30000);
  }

  // ── Аларма „Спешна помощ" ───────────────────────────────────────────────
  // Пита /api/admin/stats (евтин брояч helpRequests = нерешени). Докато има
  // нерешени → линкът мига + показва брой + кратък звук на линейка. Звукът се
  // пуска при НОВА заявка (увеличение) и като лек напомнящ сигнал на всеки ~60с,
  // за да не е досаден. Браузърите блокират авто-звук до първо докосване/клавиш —
  // затова отключваме AudioContext при първи жест на потребителя.
  var audioCtx = null, lastCount = -1, sinceBeep = 0;

  function armAudio() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && Ctx) audioCtx = new Ctx();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    window.removeEventListener('pointerdown', armAudio);
    window.removeEventListener('keydown', armAudio);
  }
  window.addEventListener('pointerdown', armAudio);
  window.addEventListener('keydown', armAudio);

  function playSiren() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') { audioCtx.resume(); }
      var t = audioCtx.currentTime;
      var tones = [880, 660, 880, 660], dur = 0.2;
      var g = audioCtx.createGain();
      g.connect(audioCtx.destination);
      var osc = audioCtx.createOscillator();
      osc.type = 'sine'; osc.connect(g);
      for (var i = 0; i < tones.length; i++) osc.frequency.setValueAtTime(tones[i], t + i * dur);
      var end = t + tones.length * dur;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.13, t + 0.04);
      g.gain.setValueAtTime(0.13, end - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.start(t); osc.stop(end + 0.02);
    } catch (e) {}
  }

  function applyAlarm(n) {
    var link = document.querySelector('.ams-adminnav a.help');
    var badge = document.getElementById('amsHelpBadge');
    if (!link) return;
    if (n > 0) {
      link.classList.add('alarm');
      if (badge) badge.textContent = n;
      var isNew = (lastCount >= 0 && n > lastCount);
      if (lastCount === -1 || isNew || sinceBeep <= 0) { playSiren(); sinceBeep = 5; } // ~60с при пол 12с
      sinceBeep--;
    } else {
      link.classList.remove('alarm');
      if (badge) badge.textContent = '';
      sinceBeep = 0;
    }
    lastCount = n;
  }

  function pollHelp() {
    var token = null;
    try { token = localStorage.getItem('token'); } catch (e) {}
    var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    fetch('/api/admin/stats', { headers: headers, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) applyAlarm(parseInt(d.helpRequests, 10) || 0); })
      .catch(function () {});
  }

  function startHelpAlarm() {
    pollHelp();
    setInterval(pollHelp, 12000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
