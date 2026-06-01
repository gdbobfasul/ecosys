// House-Look-Book — екран за вход/регистрация.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  let mode = 'login'; // 'login' | 'register'

  function setMode(m) {
    mode = m;
    $('#tabLogin').classList.toggle('on', m === 'login');
    $('#tabRegister').classList.toggle('on', m === 'register');
    $('#nameField').style.display = m === 'register' ? '' : 'none';
    $('#btnSubmit').textContent = m === 'register' ? 'Създай профил' : 'Вход';
    $('#password').setAttribute('autocomplete', m === 'register' ? 'new-password' : 'current-password');
    hideMsg();
  }

  function showMsg(text, ok) {
    const el = $('#msg');
    el.textContent = text;
    el.className = 'msg ' + (ok ? 'ok' : 'err');
    el.style.display = '';
  }
  function hideMsg() { $('#msg').style.display = 'none'; }

  async function submit() {
    const email = $('#email').value.trim();
    const password = $('#password').value;
    if (!email || !password) { showMsg('Попълни имейл и парола.', false); return; }
    try {
      if (mode === 'register') {
        await HLB.api('/register', { method: 'POST', body: { email, password, display_name: $('#display_name').value.trim() || undefined } });
      } else {
        await HLB.api('/login', { method: 'POST', body: { email, password } });
      }
      // Успех → към галерията.
      location.href = 'gallery.html';
    } catch (e) {
      showMsg(e.message, false);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await HLB.mountNav('login');
    if (user) { location.href = 'gallery.html'; return; } // вече логнат
    $('#tabLogin').onclick = () => setMode('login');
    $('#tabRegister').onclick = () => setMode('register');
    $('#btnSubmit').onclick = submit;
    $('#password').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });
})();
