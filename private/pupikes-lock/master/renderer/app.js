'use strict';
/* Мастер интерфейс. Работи и при липсващ window.api (за статичен преглед/снимка). */

const $ = s => document.querySelector(s);
const STNAME = { active: 'активен', expired: 'заключен', waiting: 'чака активиране', unlocked: 'отключен (с ключ)', offline: 'офлайн' };

function fmt(sec) {
  if (sec == null) return '—';
  if (sec < 0) return '∞ (с ключ)';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function renderClients(list) {
  const rows = $('#rows'); rows.innerHTML = '';
  $('#cnt').textContent = list.filter(c => c.online).length;
  $('#empty').style.display = list.length ? 'none' : 'block';
  for (const c of list) {
    const tr = document.createElement('tr');

    const tdSeq = document.createElement('td');
    tdSeq.innerHTML = '<div class="seqcell"><input type="number" value="' + (c.seq ?? '') + '" title="пореден номер"><button class="rn">⟳</button></div>';
    tdSeq.querySelector('.rn').onclick = () => cmd('rename', c.code, Number(tdSeq.querySelector('input').value));
    tdSeq.querySelector('input').addEventListener('keydown', e => { if (e.key === 'Enter') cmd('rename', c.code, Number(e.target.value)); });

    const tdCode = document.createElement('td'); tdCode.className = 'code'; tdCode.textContent = c.code;
    const tdHost = document.createElement('td'); tdHost.textContent = c.host || '—';

    const tdSt = document.createElement('td');
    tdSt.innerHTML = '<span class="st ' + c.status + '"><span class="dot"></span>' + (STNAME[c.status] || c.status) + '</span>';

    const tdRem = document.createElement('td'); tdRem.className = 'remain'; tdRem.textContent = fmt(c.remainingSec);

    const tdHours = document.createElement('td');
    tdHours.innerHTML = '<div class="hours"><input type="number" min="1" step="1" value="1" title="часове (кратно на 1ч)"><button class="p give">Дай</button></div>';
    tdHours.querySelector('.give').onclick = () => cmd('hours', c.code, Number(tdHours.querySelector('input').value));

    const tdAct = document.createElement('td');
    tdAct.innerHTML = '<div class="acts"><button class="lock">Заключи</button><button class="unlock">Отключи</button><button class="danger forget">Премахни</button></div>';
    tdAct.querySelector('.lock').onclick = () => cmd('lock', c.code);
    tdAct.querySelector('.unlock').onclick = () => cmd('unlock', c.code);
    tdAct.querySelector('.forget').onclick = () => cmd('forget', c.code);

    tr.append(tdSeq, tdCode, tdHost, tdSt, tdRem, tdHours, tdAct);
    rows.appendChild(tr);
  }
}

function cmd(action, code, value) { if (window.api) window.api.cmd({ action, code, value }); }

async function init() {
  if (!window.api) return;                     // статичен режим (без Electron)
  const info = await window.api.getInfo();
  $('#srv').textContent = (info.ips[0] ? info.ips.join(', ') : 'localhost') + ':' + info.port;
  renderClients(await window.api.getClients());
  window.api.onClients(renderClients);
  window.api.onServerError(msg => { $('#srv').textContent = 'ГРЕШКА: ' + msg; });
  setInterval(async () => { if (!window.__paused) renderClients(await window.api.getClients()); }, 1000);
}
init();
