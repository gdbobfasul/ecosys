// House-Look-Book — екран за вход/регистрация.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const T = (k, v) => (window.HLB_I18N ? HLB_I18N.t(k, v) : k);
  let mode = 'login'; // 'login' | 'register'

  function setMode(m) {
    mode = m;
    $('#tabLogin').classList.toggle('on', m === 'login');
    $('#tabRegister').classList.toggle('on', m === 'register');
    $('#nameField').style.display = m === 'register' ? '' : 'none';
    $('#btnSubmit').textContent = m === 'register' ? T('btn.submit_register') : T('btn.submit_login');
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
    if (!email || !password) { showMsg(T('js.fill_login'), false); return; }
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

  document.addEventListener('DOMContentLoaded', () => {
    // Бутоните се връзват ВЕДНАГА (синхронно) — входът работи и при бърз клик (човек/робот).
    // Проверката „вече ли съм логнат" тече ОТДЕЛНО и не блокира формата.
    $('#tabLogin').onclick = () => setMode('login');
    $('#tabRegister').onclick = () => setMode('register');
    $('#btnSubmit').onclick = submit;
    $('#password').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    Promise.resolve(HLB.mountNav('login')).then(user => { if (user) location.href = 'gallery.html'; }).catch(() => {});
  });
})();
