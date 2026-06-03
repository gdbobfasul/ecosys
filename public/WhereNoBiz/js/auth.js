// WhereNoBiz — екран за вход/регистрация.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const T = (k, v) => (window.WNB_I18N ? WNB_I18N.t(k, v) : k);
  let mode = 'login';

  function setMode(m) {
    mode = m;
    $('#tabLogin').classList.toggle('on', m === 'login');
    $('#tabRegister').classList.toggle('on', m === 'register');
    $('#nameField').style.display = m === 'register' ? '' : 'none';
    $('#phoneField').style.display = m === 'register' ? '' : 'none';
    $('#btnSubmit').textContent = m === 'register' ? T('btn.submit_register') : T('btn.submit_login');
    hideMsg();
  }
  function showMsg(t, ok) { const e = $('#msg'); e.textContent = t; e.className = 'msg ' + (ok ? 'ok' : 'err'); e.style.display = ''; }
  function hideMsg() { $('#msg').style.display = 'none'; }

  async function submit() {
    const email = $('#email').value.trim();
    const password = $('#password').value;
    if (!email || !password) { showMsg(T('js.fill_login'), false); return; }
    try {
      if (mode === 'register') {
        await WNB.api('/register', { method: 'POST', body: {
          email, password,
          display_name: $('#display_name').value.trim() || undefined,
          phone: $('#phone').value.trim() || undefined,
        } });
      } else {
        await WNB.api('/login', { method: 'POST', body: { email, password } });
      }
      location.href = 'browse.html';
    } catch (e) { showMsg(e.message, false); }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await WNB.mountNav('login');
    if (user) { location.href = 'browse.html'; return; }
    $('#tabLogin').onclick = () => setMode('login');
    $('#tabRegister').onclick = () => setMode('register');
    $('#btnSubmit').onclick = submit;
    $('#password').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });
})();
