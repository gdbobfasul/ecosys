'use strict';
/* Заключващ екран. applyState е глобална и за статичен преглед/снимка без Electron. */

const EXPIRED_MSG = 'а сега яд ли те е?';

function fmt(sec) {
  if (sec == null || sec < 0) return '00:00:00';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function applyState(st) {
  st = st || {};
  const expired = st.kind === 'expired';
  document.body.className = expired ? 'expired' : 'waiting';

  document.getElementById('big').textContent = expired ? EXPIRED_MSG : 'Изчаква активиране';
  document.getElementById('sub').textContent = expired
    ? 'Времето за ползване изтече. Машината е заключена.'
    : 'Машината чака да бъде активирана от оператора.';

  document.getElementById('seq').textContent = (st.seq != null ? st.seq : '—');
  document.getElementById('conn').textContent = st.masterConnected ? 'свързана с оператора' : 'няма връзка с оператора…';
  document.getElementById('conn').style.color = st.masterConnected ? '' : '#c0143c';

  const rb = document.getElementById('remainBox');
  if (expired && st.remainingSec > 0) { rb.classList.remove('hidden'); document.getElementById('remain').textContent = fmt(st.remainingSec); }
  else rb.classList.add('hidden');
}

/* подаване на ключ */
const form = document.getElementById('keyForm');
form.addEventListener('submit', e => {
  e.preventDefault();
  const v = document.getElementById('key').value;
  if (window.lock) window.lock.tryKey(v);
  else keyResult(false);                         // статичен режим
});
function keyResult(ok) {
  const msg = document.getElementById('keyMsg');
  if (ok) { msg.style.color = '#1a7f4b'; msg.textContent = 'Отключено.'; }
  else {
    msg.textContent = 'Грешен ключ.';
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    document.getElementById('key').select();
  }
}

if (window.lock) {
  window.lock.onState(applyState);
  window.lock.onKeyResult(keyResult);
}
