'use strict';
/* Pupikes Дом — уеб интерфейс за трите роли (собственик / майстор / център). */

const EQUIP = ['Контакти', 'Лампи', 'Специални контакти', 'Бойлери', 'Отоплителни печки',
  'Готварски печки', 'Климатици', 'Телевизори', 'Компютри', 'Професионално оборудване', 'Друго оборудване'];
const ROLE_BG = { owner: 'собственик', tech: 'майстор', center: 'център', moderator: 'модератор', admin: 'админ' };
const ST_BG = { open: 'отворен', accepted: 'приет', assigned: 'възложен', resolved: 'приключен' };
const TRADES = [['power', 'Електричество (ток)'], ['water', 'Водопровод (вода)'],
  ['software', 'Компютри — софтуер'], ['hardware', 'Компютри — хардуер'],
  ['medical', 'Медицинска помощ'], ['pharmacy', 'Доставка на лекарства']];
const TRADE_BG = Object.fromEntries(TRADES);
const tradeOpts = sel => TRADES.map(([k, t]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t}</option>`).join('');
const fileUrl = name => '/api/files/' + encodeURIComponent(name) + '?token=' + encodeURIComponent(state.token);
const qrImg = slot => '/api/qrcodes/' + slot + '/image?token=' + encodeURIComponent(state.token);

let state = { token: localStorage.getItem('pd_token') || '', user: null, settings: null, ws: null, tab: '' };

/* ---------- API ---------- */
async function api(method, path, body, isForm) {
  const opt = { method, headers: {} };
  if (state.token) opt.headers.Authorization = 'Bearer ' + state.token;
  if (body && isForm) opt.body = body;
  else if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch('/api' + path, opt);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('Грешка ' + res.status));
  return data;
}

/* ---------- помощни ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(title, msg, cls) {
  const t = document.createElement('div'); t.className = 'toast ' + (cls || '');
  t.innerHTML = '<b>' + esc(title) + '</b>' + esc(msg || '');
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 7000);
}
function playSound(kind) { try { $(kind === 'emergency' ? '#sndEmergency' : '#sndProblem').play(); } catch {} }
function modal(title, html, onMount) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal"><h3>' + esc(title) + '</h3>' + html + '</div>';
  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
  const close = () => bg.remove();
  if (onMount) onMount(bg.querySelector('.modal'), close);
  return { el: bg.querySelector('.modal'), close };
}

/* ---------- старт ---------- */
async function boot() {
  if (!state.token) return renderAuth();
  try { const me = await api('GET', '/me'); state.user = me.user; }
  catch { state.token = ''; localStorage.removeItem('pd_token'); return renderAuth(); }
  try { state.settings = (await api('GET', '/settings')).settings; } catch {}
  renderApp(); connectWS();
}

/* ---------- вход / регистрация ---------- */
function renderAuth() {
  let mode = 'login', role = 'owner';
  const draw = () => {
    $('#app').innerHTML = `
    <div class="auth">
      <div class="brand"><h1>Pupikes <b>Дом</b></h1><p>поддръжка на ел. и ВиК системи</p></div>
      <div class="card">
        <div class="tabsrow">
          <button data-m="login" class="${mode === 'login' ? 'on' : ''}">Вход</button>
          <button data-m="register" class="${mode === 'register' ? 'on' : ''}">Регистрация</button>
        </div>
        ${mode === 'register' ? `
          <label>Регистрирам се като</label>
          <div class="rolepick">
            <button data-r="owner" class="${role === 'owner' ? 'on' : ''}">Собственик</button>
            <button data-r="tech" class="${role === 'tech' ? 'on' : ''}">Майстор</button>
          </div>` : ''}
        <label>Имейл</label><input id="email" type="email" autocomplete="username">
        ${mode === 'register' ? `<label>${role === 'owner' ? 'Потребителско име' : 'Имена'}</label><input id="name">
          <label>Телефон</label><input id="phone">
          ${role === 'tech' ? `<label>Специалност (група)</label><select id="trade">${tradeOpts()}</select>
            <label>Ранг (1–5; определя началната такса)</label><select id="rank">${[1, 2, 3, 4, 5].map(n => '<option value="' + n + '">' + n + '</option>').join('')}</select>` : ''}` : ''}
        <label>Парола</label><input id="password" type="password" autocomplete="current-password">
        <div class="err" id="err"></div>
        <button class="p" id="go" style="width:100%">${mode === 'login' ? 'Влез' : 'Създай профил'}</button>
      </div>
    </div>`;
    $('#app').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    $('#app').querySelectorAll('[data-r]').forEach(b => b.onclick = () => { role = b.dataset.r; draw(); });
    $('#go').onclick = submit;
    $('#password').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  };
  const submit = async () => {
    try {
      const email = $('#email').value.trim(), password = $('#password').value;
      let data;
      if (mode === 'login') data = await api('POST', '/login', { email, password });
      else data = await api('POST', '/register', { role, email, password, username: role === 'owner' ? $('#name').value : null, name: $('#name') ? $('#name').value : null, phone: $('#phone') ? $('#phone').value : null, trade: role === 'tech' && $('#trade') ? $('#trade').value : undefined, rank: role === 'tech' && $('#rank') ? $('#rank').value : undefined });
      state.token = data.token; localStorage.setItem('pd_token', data.token); state.user = data.user;
      boot();
    } catch (e) { $('#err').textContent = e.message; }
  };
  draw();
}

/* ---------- приложение ---------- */
function logout() { state.token = ''; localStorage.removeItem('pd_token'); if (state.ws) try { state.ws.close(); } catch {} location.reload(); }

const TABS = {
  owner: [['props', 'Имоти'], ['signals', 'Сигнали'], ['payments', 'Плащания'], ['contracts', 'Договори']],
  tech: [['feed', 'Сигнали'], ['mine', 'Моите'], ['profile', 'Профил'], ['earnings', 'Приходи'], ['contracts', 'Договори']],
  center: [['clients', 'Клиенти'], ['techs', 'Майстори'], ['emergency', 'Спешни'], ['problem', 'Проблеми'],
    ['pay_monthly', 'Месечни плащания'], ['pay_extra', 'Доп. плащания'], ['qr', 'QR кодове'], ['contracts', 'Договори'],
    ['staff', 'Екип'], ['requests', 'Заявки'], ['accounting', 'Сметки'], ['settings', 'Настройки']],
  moderator: [['mclients', 'Моите обекти'], ['msignals', 'Сигнали'], ['mtechs', 'Специалисти'], ['mrequests', 'Заявки'], ['mearn', 'Приходи (3%)']],
  admin: [['aclients', 'Обекти'], ['atechs', 'Майстори'], ['aemergency', 'Спешни'], ['aproblem', 'Проблеми'], ['arequests', 'Заявки'], ['aearn', 'Сметки'], ['astaff', 'Екип']],
};

function renderApp() {
  const role = state.user.role;
  state.tab = TABS[role][0][0];
  $('#app').innerHTML = `
    <header class="top">
      <span class="logo">Pupikes <b>Дом</b></span>
      <span class="roletag">${ROLE_BG[role]}</span>
      <span class="sp"></span>
      <span class="who">${esc(state.user.name || state.user.username || state.user.email)}</span>
      <button class="sm ghost" id="logout">Изход</button>
    </header>
    <nav class="tabs" id="nav"></nav>
    <main id="content"></main>`;
  $('#logout').onclick = logout;
  drawNav(); openTab(state.tab);
}
function drawNav() {
  $('#nav').innerHTML = TABS[state.user.role].map(([k, t]) => `<button data-t="${k}" class="${k === state.tab ? 'on' : ''}">${t}</button>`).join('');
  $('#nav').querySelectorAll('[data-t]').forEach(b => b.onclick = () => openTab(b.dataset.t));
}
function openTab(t) { state.tab = t; drawNav(); const fn = TABMAP[state.user.role + ':' + t]; if (fn) fn(); }

/* ===================== СОБСТВЕНИК ===================== */
async function ownerProps() {
  const c = $('#content'); c.innerHTML = '<h2 class="sec">Моите имоти</h2><div class="row"><button class="p" id="addP">+ Нов имот</button></div><div class="spacer"></div><div id="list" class="grid"></div>';
  $('#addP').onclick = () => propForm();
  const { properties } = await api('GET', '/properties');
  $('#list').innerHTML = properties.map(p => `
    <div class="item" data-id="${p.id}">
      <div class="row"><h3>${esc(p.name || 'Имот')}</h3><span class="right muted">${esc(p.size || '')}</span></div>
      <div class="meta">${esc(p.address || 'без адрес')}${p.lat ? ' · 📍' + p.lat + ',' + p.lng : ''}</div>
      <div class="meta">Оборудване: ${p.equipment.length ? p.equipment.map(e => esc((e.label || e.kind) + ' ×' + e.count)).join(', ') : '—'}</div>
      <div class="big-actions">
        <button class="emerg" data-emg="${p.id}">🚨 СПЕШЕН</button>
        <button class="prob" data-prb="${p.id}">🔧 ПРОБЛЕМ</button>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="sm" data-equip="${p.id}">Оборудване</button>
        <button class="sm ghost" data-del="${p.id}">Изтрий имота</button>
      </div>
    </div>`).join('') || '<p class="muted">Още няма имоти. Добави първия.</p>';
  c.querySelectorAll('[data-emg]').forEach(b => b.onclick = () => sendSignal(b.dataset.emg, 'emergency'));
  c.querySelectorAll('[data-prb]').forEach(b => b.onclick = () => sendSignal(b.dataset.prb, 'problem'));
  c.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => equipModal(b.dataset.equip, properties.find(x => x.id == b.dataset.equip)));
  c.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('Да изтрия ли имота?')) { await api('DELETE', '/properties/' + b.dataset.del); ownerProps(); } });
}
function propForm() {
  modal('Нов имот', `
    <label>Име/описание</label><input id="pname">
    <div class="formgrid"><div><label>Големина</label><input id="psize" placeholder="напр. 90 кв.м"></div>
    <div><label>Локация (гео)</label><input id="ploc" placeholder="lat,lng (по избор)"></div></div>
    <label>Точен адрес</label><input id="paddr">
    <div class="spacer"></div><button class="p" id="save" style="width:100%">Запази</button>`, (m, close) => {
    m.querySelector('#save').onclick = async () => {
      const loc = (m.querySelector('#ploc').value || '').split(',');
      await api('POST', '/properties', { name: m.querySelector('#pname').value, size: m.querySelector('#psize').value, address: m.querySelector('#paddr').value, lat: loc[0], lng: loc[1] });
      close(); ownerProps();
    };
  });
}
function equipModal(pid, prop) {
  const list = () => (prop.equipment || []).map(e => `<div class="row" style="border-bottom:1px solid var(--line);padding:6px 0"><span>${esc(e.label || e.kind)} ×${e.count}</span><button class="sm ghost right" data-rm="${e.id}">✕</button></div>`).join('') || '<p class="muted">Няма вписано оборудване.</p>';
  modal('Оборудване', `
    <div id="eqlist">${list()}</div><hr style="border-color:var(--line)">
    <label>Вид</label><select id="ekind">${EQUIP.map(x => '<option>' + x + '</option>').join('')}</select>
    <div class="formgrid"><div><label>Пояснение (по избор)</label><input id="elabel"></div><div><label>Брой</label><input id="ecount" type="number" value="1" min="1"></div></div>
    <div class="spacer"></div><button class="p" id="add" style="width:100%">Добави</button>`, (m, close) => {
    const refresh = async () => { const { properties } = await api('GET', '/properties'); prop.equipment = (properties.find(x => x.id == pid) || {}).equipment || []; m.querySelector('#eqlist').innerHTML = list(); wireRm(); };
    const wireRm = () => m.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { await api('DELETE', '/equipment/' + b.dataset.rm); await refresh(); });
    wireRm();
    m.querySelector('#add').onclick = async () => {
      await api('POST', '/properties/' + pid + '/equipment', { kind: m.querySelector('#ekind').value, label: m.querySelector('#elabel').value, count: m.querySelector('#ecount').value });
      await refresh(); ownerProps();
    };
  });
}
async function sendSignal(pid, type) {
  const emerg = type === 'emergency';
  modal(emerg ? '🚨 Спешен сигнал' : '🔧 Проблемен сигнал', `
    <label>Каква помощ е нужна?</label><select id="strade">${tradeOpts('power')}</select>
    ${emerg ? '<p class="muted">Спешният е без описание — майсторите от групата се известяват веднага с мелодия.</p>'
            : '<label>Опишете проблема</label><textarea id="desc" rows="4" placeholder="какво не работи..."></textarea>'}
    <div class="spacer"></div><button class="${emerg ? 'emerg' : 'prob'}" id="send" style="width:100%">${emerg ? 'Подай СПЕШЕН' : 'Подай сигнал'}</button>`,
    (m, close) => {
      m.querySelector('#send').onclick = async () => {
        try {
          await api('POST', '/signals', { property_id: pid, type, trade: m.querySelector('#strade').value, description: emerg ? null : m.querySelector('#desc').value });
          close(); toast(emerg ? '🚨 Спешен подаден' : '🔧 Проблем подаден', 'Майсторите от групата са известени.', emerg ? 'emerg' : 'prob'); openTab('signals');
        } catch (e) { toast('Грешка', e.message, 'emerg'); }
      };
    });
}
async function ownerSignals() {
  const { signals } = await api('GET', '/signals');
  $('#content').innerHTML = '<h2 class="sec">Моите сигнали</h2><div class="grid">' + (signals.map(s => signalCard(s, 'owner')).join('') || '<p class="muted">Няма сигнали.</p>') + '</div>';
  wireSignalActions('owner');
}

/* ===================== МАЙСТОР ===================== */
function techBanner() {
  if (state.user.flagged) return '<div class="item" style="border-color:var(--bad)"><b style="color:var(--bad)">Профилът ти е маркиран като проблемен.</b><div class="muted">Няма да получаваш и не можеш да приемаш поръчки. Свържи се с центъра.</div></div><div class="spacer"></div>';
  if (!state.user.approved) return '<div class="item" style="border-color:var(--warn)"><b style="color:var(--warn)">Договорът ти чака одобрение от центъра.</b><div class="muted">Разглеждаш сигналите, но за да приемаш — качи договор (таб „Договори") и изчакай одобрение.</div></div><div class="spacer"></div>';
  return '';
}
async function techFeed() {
  const { signals } = await api('GET', '/signals');
  $('#content').innerHTML = '<h2 class="sec">Отворени сигнали · ' + esc(TRADE_BG[state.user.trade] || '') + '</h2>' + techBanner() + '<div class="grid">' + (signals.map(s => signalCard(s, 'tech')).join('') || '<p class="muted">Няма отворени сигнали за твоята група.</p>') + '</div>';
  wireSignalActions();
}
async function techMine() {
  const { signals } = await api('GET', '/signals?scope=mine');
  $('#content').innerHTML = '<h2 class="sec">Приети от мен</h2>' + techBanner() + '<div class="grid">' + (signals.map(s => signalCard(s, 'tech-mine')).join('') || '<p class="muted">Нямаш приети сигнали.</p>') + '</div>';
  wireSignalActions();
}
async function techProfile() {
  const { profile, addresses } = await api('GET', '/profile');
  $('#content').innerHTML = `
    <h2 class="sec">Профил на майстора</h2>
    ${techBanner()}
    <div class="item">
      <label>Специалност (група)</label><select id="ptrade">${tradeOpts(profile.trade)}</select>
      <label>Умения / какво ремонтирам и поддържам</label><textarea id="skills" rows="4">${esc(profile.skills || '')}</textarea>
      <div class="formgrid"><div><label>Основна локация (адрес)</label><input id="maddr" value="${esc(profile.main_address || '')}"></div>
      <div><label>Гео (lat,lng)</label><input id="mloc" value="${profile.main_lat ? profile.main_lat + ',' + profile.main_lng : ''}"></div></div>
      <div class="spacer"></div><button class="p" id="saveProf">Запази профила</button>
    </div>
    <div class="spacer"></div>
    <div class="item"><h3>Работни адреси (до 3)</h3><div id="addrs">${addresses.map(a => `<div class="row" style="padding:5px 0;border-bottom:1px solid var(--line)"><span>${esc(a.label || '')} ${esc(a.address || '')}</span><button class="sm ghost right" data-rma="${a.id}">✕</button></div>`).join('') || '<p class="muted">Няма адреси.</p>'}</div>
      <div class="formgrid"><div><label>Етикет</label><input id="alabel" placeholder="напр. Склад"></div><div><label>Адрес</label><input id="aaddr"></div></div>
      <div class="spacer"></div><button class="sm" id="addAddr" ${addresses.length >= 3 ? 'disabled' : ''}>+ Добави адрес</button>
    </div>`;
  $('#saveProf').onclick = async () => { const loc = ($('#mloc').value || '').split(','); await api('PUT', '/profile', { skills: $('#skills').value, main_address: $('#maddr').value, main_lat: loc[0], main_lng: loc[1], trade: $('#ptrade').value }); toast('Запазено', 'Профилът е обновен.'); };
  $('#addAddr').onclick = async () => { await api('POST', '/addresses', { label: $('#alabel').value, address: $('#aaddr').value }); techProfile(); };
  $('#content').querySelectorAll('[data-rma]').forEach(b => b.onclick = async () => { await api('DELETE', '/addresses/' + b.dataset.rma); techProfile(); });
}

/* ---------- обща карта на сигнал ---------- */
function signalCard(s, ctx) {
  const stp = s.type === 'emergency' ? 'emergency' : 'problem';
  const stName = s.type === 'emergency' ? 'СПЕШЕН' : 'Проблем';
  const showStatus = ['tech', 'tech-mine', 'center', 'moderator', 'admin'].includes(ctx);
  return `<div class="item" data-id="${s.id}">
    <div class="row">
      <span class="pill ${stp}">${stName}</span>
      <span class="pill problem">${esc(TRADE_BG[s.trade] || s.trade || '')}</span>
      <span class="pill ${s.status}">${ST_BG[s.status] || s.status}</span>
      ${s.property_flagged ? '<span class="pill emergency">проблемен имот</span>' : ''}
      <span class="right muted">#${s.id}</span>
    </div>
    <div class="meta" style="margin-top:6px"><b>${esc(s.property_name || '')}</b> · ${esc(s.address || '')}</div>
    ${s.description ? '<div class="meta">„' + esc(s.description) + '"</div>' : ''}
    <div class="meta">Собственик: ${esc(s.owner_name || '')} · тел. ${esc(s.owner_phone || '—')}</div>
    ${showStatus ? `<div class="meta">${s.owner_contract_signed ? '✅ подписан договор' : '⛔ без одобрен договор'} · ${s.owner_paid_month ? '✅ платен месец' : '⛔ неплатен месец'}</div>` : ''}
    ${(['center', 'moderator', 'admin'].includes(ctx) && s.candidates && s.candidates.length) ? '<div class="meta">Одобрили (кандидати): ' + s.candidates.map(c => esc(c.name) + ' (ранг ' + c.rank + ', ' + c.fee + ' сома, ' + c.eta_minutes + ' мин)').join(' · ') + '</div>' : ''}
    ${s.tech_name ? '<div class="meta">Насочен: ' + esc(s.tech_name) + (s.eta_minutes ? ' · до ' + s.eta_minutes + ' мин' : '') + '</div>' : ''}
    ${s.cost_status ? '<div class="meta">Разходи: транспорт ' + (s.transport_cost || 0) + ' + материали ' + (s.materials_cost || 0) + ' = <b>' + s.cost_total + ' сома</b>' + (s.materials_by_tech ? ' (материалите ги купува специалистът)' : '') + (s.cost_mode ? ' · дължимо на специалиста: <b>' + s.cost_payable + ' сома</b>' + (s.cost_mode === 'transport' ? ' (само такси; материалите за сметка на собственика)' : '') : '') + ' · ' + costStatusBg(s) + '</div>' : ''}
    ${s.accepted_by && s.status !== 'resolved' ? '<div class="meta">' + (s.can_depart ? '✅ специалистът може да тръгне' : '⏳ изчаква разходите да се одобрят/платят') + '</div>' : ''}
    <div class="row" style="margin-top:8px">${signalButtons(s, ctx)}</div>
  </div>`;
}
function costStatusBg(s) {
  if (s.cost_status === 'cleared') return s.type === 'emergency' ? 'за сметка на клиента (след обслужване)' : '✅ платени и проверени';
  return { pending: 'чака одобрение от собственика', approved: 'одобрени — чакат плащане/проверка', rejected: '❌ отказани заради разходи' }[s.cost_status] || s.cost_status;
}
function costOversightButtons(s) {
  const role = state.user.role;
  let b = '';
  if (s.cost_status === 'pending' || s.cost_status === 'approved') b += `<button class="sm ghost" data-costreject="${s.id}">Откажи (разходи)</button> `;
  if (s.cost_status === 'approved') b += `<button class="p sm" data-costclear="${s.id}">Разходите платени (провери)</button> `;
  if (s.cost_status === 'cleared' && (role === 'center' || role === 'admin')) b += `<button class="sm ghost" data-costunclear="${s.id}">Поправи „може да тръгне"</button> `;
  return b;
}
function signalButtons(s, ctx) {
  if (ctx === 'owner') {
    let b = '';
    if (s.cost_status === 'pending') {
      b += `<button class="p sm" data-costapprove="${s.id}" data-mode="full">Одобри изцяло (${s.cost_total} сома)</button> `;
      if ((s.materials_cost || 0) > 0) b += `<button class="sm" data-costapprove="${s.id}" data-mode="transport">Плати само таксите (${s.transport_cost || 0} сома) — материалите за моя сметка</button> `;
    }
    if (s.accepted_by && s.status !== 'resolved') b += `<button class="p sm" data-resolve="${s.id}">Маркирай „решено"</button> <button class="sm ghost" data-decline="${s.id}">Откажи (чакам дълго)</button>`;
    return b;
  }
  if (ctx === 'tech') return s.status === 'open' ? (s.i_volunteered ? '<span class="muted">✅ одобрил си (чака насочване)</span>' : `<button class="p sm" data-volunteer="${s.id}">Одобри (готов съм)</button>`) : '';
  if (ctx === 'tech-mine') {
    if (s.status === 'resolved') return '<span class="muted">приключен</span>';
    if (s.accepted_by === state.user.id) {
      let b = '';
      if (!s.cost_status || s.cost_status === 'rejected') b += `<button class="p sm" data-cost="${s.id}" data-emg="${s.type === 'emergency' ? 1 : 0}">Изчисли разходи</button> `;
      b += s.can_depart ? '<span class="muted">✅ може да тръгнеш</span>' : '<span class="muted">⏳ чака одобрение/плащане на разходите</span>';
      return b;
    }
    return s.accepted_by ? '<span class="muted">насочен е друг</span>' : '<span class="muted">одобрил си — чака насочване</span>';
  }
  if (ctx === 'center') {
    let b = '';
    if (s.status !== 'resolved') b += `<button class="sm" data-assign="${s.id}">Възложи майстор</button> `;
    b += costOversightButtons(s);
    b += `<button class="sm ghost" data-flagprop="${s.property_id}" data-flagval="${s.property_flagged ? 0 : 1}">${s.property_flagged ? 'Отмаркирай имота' : 'Маркирай имота проблемен'}</button>`;
    return b;
  }
  if (ctx === 'moderator') { let b = s.status === 'open' ? `<button class="sm" data-assign="${s.id}">Възложи майстор</button> ` : (s.accepted_by ? '<span class="muted">ангажиран (не се сменя)</span> ' : ''); return b + costOversightButtons(s); }
  if (ctx === 'admin') { let b = s.status !== 'resolved' ? `<button class="sm" data-assign="${s.id}">${s.accepted_by ? 'Преназначи' : 'Възложи'} майстор</button> ` : ''; return b + costOversightButtons(s); }
  return '';
}
function wireSignalActions() {
  const c = $('#content');
  c.querySelectorAll('[data-volunteer]').forEach(b => b.onclick = () => volunteerModal(b.dataset.volunteer));
  c.querySelectorAll('[data-decline]').forEach(b => b.onclick = async () => { if (confirm('Да откажа ли майстора? (Отказът е само заради времето; сигналът пак става отворен.)')) { try { await api('POST', '/signals/' + b.dataset.decline + '/decline'); } catch (e) { toast('Грешка', e.message, 'emerg'); } reloadTab(); } });
  c.querySelectorAll('[data-resolve]').forEach(b => b.onclick = async () => { if (confirm('Потвърждаваш ли, че е решено? Това приключва задачата на майстора.')) { try { await api('POST', '/signals/' + b.dataset.resolve + '/resolve'); } catch (e) { toast('Грешка', e.message, 'emerg'); } reloadTab(); } });
  c.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => assignModal(b.dataset.assign));
  c.querySelectorAll('[data-flagprop]').forEach(b => b.onclick = async () => { try { await api('POST', '/admin/properties/' + b.dataset.flagprop + '/flag', { flagged: b.dataset.flagval === '1' }); } catch (e) { toast('Грешка', e.message, 'emerg'); } reloadTab(); });
  c.querySelectorAll('[data-cost]').forEach(b => b.onclick = () => costModal(b.dataset.cost, b.dataset.emg === '1'));
  c.querySelectorAll('[data-costapprove]').forEach(b => b.onclick = async () => { const tr = b.dataset.mode === 'transport'; if (confirm(tr ? 'Плащаш САМО таксите за придвижване; материалите остават за твоя сметка (сам ги купуваш). Продължаваш ли?' : 'Одобряваш ли всички разходи (транспорт + материали)? Плащаш ги и центърът ще ги провери.')) { try { await api('POST', '/signals/' + b.dataset.costapprove + '/cost/approve', { mode: b.dataset.mode }); } catch (e) { toast('Грешка', e.message, 'emerg'); } reloadTab(); } });
  c.querySelectorAll('[data-costreject]').forEach(b => b.onclick = async () => { if (confirm('Да откажа ли заявката заради разходите?')) { try { await api('POST', '/signals/' + b.dataset.costreject + '/cost/reject'); } catch (e) { toast('Грешка', e.message, 'emerg'); } reloadTab(); } });
  c.querySelectorAll('[data-costclear]').forEach(b => b.onclick = async () => { try { await api('POST', '/signals/' + b.dataset.costclear + '/cost/clear'); toast('Проверено', 'Разходите са платени — специалистът може да тръгне.'); } catch (e) { toast('Грешка', e.message, 'emerg'); } reloadTab(); });
  c.querySelectorAll('[data-costunclear]').forEach(b => b.onclick = async () => { if (confirm('Да отменя ли „може да тръгне" (грешно потвърдено)? Специалистът няма да може да тръгне до повторна проверка.')) { try { await api('POST', '/signals/' + b.dataset.costunclear + '/cost/unclear'); } catch (e) { toast('Грешка', e.message, 'emerg'); } reloadTab(); } });
}
function costModal(id, emerg) {
  modal('Изчисляване на разходи', `
    <p class="muted">${emerg ? 'Спешен: разходите са за сметка на клиента (дължат се след обслужване).' : 'Проблем: изпраща се за одобрение и плащане — тръгваш чак след проверка.'}</p>
    <div class="formgrid"><div><label>Транспорт (сома)</label><input id="tr" type="number" value="0"></div><div><label>Материали (сома)</label><input id="ma" type="number" value="0"></div></div>
    <label class="row" style="gap:6px"><input type="checkbox" id="byt"> материалите ги купувам аз (специалистът)</label>
    <label>Бележка (по избор)</label><input id="nt">
    <div class="spacer"></div><button class="p" id="s" style="width:100%">Изпрати заявката за разходи</button>`, (m, close) => {
    m.querySelector('#s').onclick = async () => { try { await api('POST', '/signals/' + id + '/cost', { transport_cost: m.querySelector('#tr').value, materials_cost: m.querySelector('#ma').value, materials_by_tech: m.querySelector('#byt').checked, note: m.querySelector('#nt').value }); close(); toast('Изпратено', 'Заявката за разходи е изпратена.'); reloadTab(); } catch (e) { toast('Грешка', e.message, 'emerg'); } };
  });
}
function volunteerModal(id) {
  modal('Одобрение (кандидатстване)', `<p class="muted">Заявяваш готовност. Модератор/център ще реши кой да отиде според сложността. Срок до 3 часа.</p>
    <label>След колко минути можеш да си там? (празно = до 60)</label><input id="eta" type="number" min="1" max="180" placeholder="60">
    <div class="spacer"></div><button class="p" id="acc" style="width:100%">Одобри (готов съм)</button>`, (m, close) => {
    m.querySelector('#acc').onclick = async () => { try { await api('POST', '/signals/' + id + '/volunteer', { eta_minutes: m.querySelector('#eta').value || 60 }); close(); toast('Одобрено', 'Готовността ти е изпратена.'); reloadTab(); } catch (e) { toast('Грешка', e.message, 'emerg'); } };
  });
}
async function assignModal(id) {
  const ep = state.user.role === 'moderator' ? '/mod/techs' : '/admin/techs';
  const techs = (await api('GET', ep)).techs.filter(t => !t.flagged);
  if (!techs.length) return toast('Няма специалисти', 'Няма немаркирани специалисти.', 'emerg');
  const sig = (await api('GET', '/signals/' + id)).signal;
  const cand = new Set((sig.candidates || []).map(c => c.tech_id));
  const tradeOf = t => t.trade || (t.profile && t.profile.trade);
  const rankOf = t => t.rank || (t.profile && t.profile.rank) || 1;
  techs.sort((a, b) => (cand.has(b.id) ? 1 : 0) - (cand.has(a.id) ? 1 : 0) || rankOf(b) - rankOf(a));
  modal('Насочи специалист', `<p class="muted">Избери кой да отиде (одобрилите „✅" са най-отгоре, по ранг).</p>
    <label>Специалист</label><select id="tech">${techs.map(t => `<option value="${t.id}">${cand.has(t.id) ? '✅ ' : ''}${esc(t.name || t.email)} · ${TRADE_BG[tradeOf(t)] || '—'} · ранг ${rankOf(t)} · ${t.effective_fee || 0} сома${t.approved === 0 ? ' (неодобрен)' : ''}</option>`).join('')}</select>
    <label>Срок (минути)</label><input id="eta" type="number" value="60" min="1" max="180">
    <div class="spacer"></div><button class="p" id="as" style="width:100%">Насочи</button>`, (m, close) => {
    m.querySelector('#as').onclick = async () => { try { await api('POST', '/signals/' + id + '/assign', { tech_id: m.querySelector('#tech').value, eta_minutes: m.querySelector('#eta').value }); close(); toast('Насочено', 'Специалистът е уведомен.'); reloadTab(); } catch (e) { toast('Грешка', e.message, 'emerg'); } };
  });
}

/* ===================== ПЛАЩАНИЯ ===================== */
async function ownerPayments() {
  const { payments } = await api('GET', '/payments');
  $('#content').innerHTML = `<h2 class="sec">Плащания</h2><div class="row"><button class="gold" id="newPay">+ Ново плащане</button></div><div class="spacer"></div>
    <div class="grid">${payments.map(paymentCard).join('') || '<p class="muted">Няма плащания.</p>'}</div>`;
  $('#newPay').onclick = newPaymentFlow;
}
function paymentCard(p) {
  return `<div class="item"><div class="row">
    <span class="pill ${p.kind === 'monthly' ? 'open' : 'problem'}">${p.kind === 'monthly' ? 'месечно' : 'допълнително'}</span>
    ${p.period ? '<span class="pill locked">' + esc(p.period) + '</span>' : ''}
    ${p.verified ? '<span class="pill verified">проверено</span>' : '<span class="pill open">непроверено</span>'}
    ${p.locked ? '<span class="pill locked">🔒 заключено</span>' : ''}
    <span class="right muted">#${p.id} · ${(p.created_at || '').slice(0, 10)}</span></div>
    <div class="meta">QR код: ${p.qr_slot ? '№' + p.qr_slot : '—'} ${p.amount ? ' · сума ' + esc(p.amount) : ''}</div>
    ${p.proof_path ? '<div class="meta">📎 приложено доказателство (вижда го само центърът)</div>' : ''}
  </div>`;
}
async function newPaymentFlow() {
  const { qrcodes } = await api('GET', '/qrcodes');
  const active = qrcodes.filter(q => q.active && q.image_path);
  if (!active.length) return toast('Няма QR код', 'Центърът още не е задал QR код за плащане.', 'emerg');
  let idx = 0;
  const curMonth = new Date().toISOString().slice(0, 7);
  modal('Ново плащане', `
    <div class="qrbox"><div id="qrwrap"></div></div>
    <div class="row" style="justify-content:center;margin-top:8px"><button class="sm" id="nextQr">Следващ QR код ▸</button></div>
    <label>Вид на плащането</label><select id="kind"><option value="monthly">Месечно</option><option value="extra">Допълнителна услуга</option></select>
    <div id="periodWrap"><label>За кой месец</label><input id="period" type="month" value="${curMonth}"></div>
    <div class="formgrid"><div><label>Сума (по избор)</label><input id="amount"></div><div><label>Бележка</label><input id="note"></div></div>
    <label>Качи доказателство (снимка/PDF) след успешно плащане</label><input id="proof" type="file" accept="image/*,application/pdf">
    <div class="spacer"></div><button class="gold" id="pay" style="width:100%">Отрази плащането</button>`, (m, close) => {
    const drawQr = () => { const q = active[idx]; m.querySelector('#qrwrap').innerHTML = `<img src="${qrImg(q.slot)}"><div class="muted">QR код №${q.slot}${q.label ? ' · ' + esc(q.label) : ''}</div>`; };
    drawQr();
    const kindSel = m.querySelector('#kind');
    kindSel.onchange = () => { m.querySelector('#periodWrap').style.display = kindSel.value === 'monthly' ? '' : 'none'; };
    m.querySelector('#nextQr').onclick = () => { idx = (idx + 1) % active.length; drawQr(); };
    m.querySelector('#pay').onclick = async () => {
      const fd = new FormData();
      fd.append('kind', kindSel.value); fd.append('qr_slot', active[idx].slot);
      if (kindSel.value === 'monthly') fd.append('period', m.querySelector('#period').value);
      fd.append('amount', m.querySelector('#amount').value); fd.append('note', m.querySelector('#note').value);
      const f = m.querySelector('#proof').files[0]; if (f) fd.append('proof', f);
      try { await api('POST', '/payments', fd, true); close(); toast('Записано', 'Плащането е изпратено за проверка.'); ownerPayments(); }
      catch (e) { toast('Грешка', e.message, 'emerg'); }
    };
  });
}

/* ===================== ДОГОВОРИ ===================== */
async function contractsTab() {
  const { contracts } = await api('GET', '/contracts');
  const center = state.user.role === 'center';
  $('#content').innerHTML = `<h2 class="sec">Договори</h2>
    ${center ? '' : '<div class="row"><input type="file" id="cf" accept="image/*,application/pdf" style="max-width:260px"><button class="p" id="up">Качи договор</button></div><div class="spacer"></div><p class="muted">Договорите ги вижда само центърът. Тук виждаш само статуса (одобрен/чака).</p>'}
    <table class="tbl"><thead><tr><th>№</th><th>Дата</th>${center ? '<th>Кой</th><th>Файл</th>' : ''}<th>Статус</th>${center ? '<th></th>' : ''}</tr></thead><tbody>
    ${contracts.map(c => `<tr>
      <td>${c.seq}</td><td>${(c.uploaded_at || '').slice(0, 10)}</td>
      ${center ? '<td>' + esc(c.who || '') + ' (' + ROLE_BG[c.who_role] + ')</td><td><a href="' + fileUrl(c.file_path) + '" target="_blank">' + esc(c.file_path) + '</a></td>' : ''}
      <td>${c.approved ? '<span class="pill verified">одобрен</span>' : '<span class="pill open">чака</span>'}</td>
      ${center ? '<td>' + (c.approved ? '' : '<button class="p sm" data-appr="' + c.id + '">Одобри</button>') + '</td>' : ''}
    </tr>`).join('') || `<tr><td colspan="6" class="muted">Няма договори.</td></tr>`}
    </tbody></table>`;
  if (!center) $('#up').onclick = async () => { const f = $('#cf').files[0]; if (!f) return toast('Избери файл'); const fd = new FormData(); fd.append('file', f); await api('POST', '/contracts', fd, true); toast('Качено', 'Договорът е записан (чака одобрение).'); contractsTab(); };
  if (center) $('#content').querySelectorAll('[data-appr]').forEach(b => b.onclick = async () => { await api('POST', '/admin/contracts/' + b.dataset.appr + '/approve'); toast('Одобрен', 'Договорът е одобрен.'); contractsTab(); });
}

/* ===================== ЦЕНТЪР ===================== */
async function centerClients() {
  const { clients } = await api('GET', '/admin/clients');
  const isCenter = state.user.role === 'center';
  const mods = isCenter ? (await api('GET', '/admin/staff')).staff.filter(s => s.role === 'moderator') : [];
  $('#content').innerHTML = `<h2 class="sec">Обекти (собственици)</h2>
    <table class="tbl"><thead><tr><th>ID</th><th>Име</th><th>Имейл</th><th>Имоти</th><th>Договор</th><th>Платен месец</th><th>Модератор</th></tr></thead><tbody>
    ${clients.map(c => `<tr><td>${c.id}</td><td>${esc(c.username || c.name || '')}</td><td>${esc(c.email)}</td><td>${c.properties}</td>
      <td>${c.approved ? '<span class="pill verified">подписан</span>' : '<span class="pill open">не</span>'}</td>
      <td>${c.paid_month ? '<span class="pill verified">да</span>' : '<span class="pill open">не</span>'}</td>
      <td>${isCenter ? `<select data-modof="${c.id}"><option value="">— няма —</option>${mods.map(m => `<option value="${m.id}" ${c.moderator_id == m.id ? 'selected' : ''}>${esc(m.name || m.email)}</option>`).join('')}</select>` : esc(c.moderator ? (c.moderator.name || c.moderator.email) : '—')}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="muted">Няма обекти.</td></tr>'}</tbody></table>`;
  if (isCenter) $('#content').querySelectorAll('[data-modof]').forEach(sel => sel.onchange = async () => { await api('POST', '/admin/clients/' + sel.dataset.modof + '/moderator', { moderator_id: sel.value || null }); toast('Записано', 'Отговорният модератор е назначен.'); });
}
async function centerTechs() {
  const { techs } = await api('GET', '/admin/techs');
  const role = state.user.role, isCenter = role === 'center';
  $('#content').innerHTML = `<h2 class="sec">Специалисти</h2><div class="grid">${techs.map(t => `
    <div class="item"><div class="row"><h3>${esc(t.name || t.email)}</h3>
      <span class="pill problem">${esc(TRADE_BG[t.profile && t.profile.trade] || '—')}</span>
      <span class="pill locked">ранг ${(t.profile && t.profile.rank) || 1}</span>
      ${t.approved ? '<span class="pill verified">одобрен</span>' : '<span class="pill open">неодобрен</span>'}
      ${t.flagged ? '<span class="pill emergency">проблемен</span>' : ''}
      <span class="right muted">#${t.id}</span></div>
    <div class="meta">${esc(t.email)} · тел. ${esc(t.phone || '—')} · договори: ${t.contracts} · посещения: ${t.visits || 0}</div>
    <div class="meta">Такса/посещение: <b>${t.effective_fee || 0} сома</b>${t.custom_fee ? ' (индивидуална)' : ' (по ранг)'}</div>
    <div class="row" style="margin-top:8px">
      ${isCenter && !t.approved ? `<button class="p sm" data-appruser="${t.id}">Одобри</button>` : ''}
      ${isCenter ? `<button class="sm" data-rank="${t.id}">Ранг</button> <button class="sm" data-fee="${t.id}">Такса</button>` : ''}
      ${(role === 'admin' || role === 'moderator') ? `<button class="sm" data-feereq="${t.id}">Заявка за такса</button>` : ''}
      <button class="sm ghost" data-flaguser="${t.id}" data-fv="${t.flagged ? 0 : 1}">${t.flagged ? 'Отмаркирай' : 'Маркирай проблемен'}</button>
    </div></div>`).join('') || '<p class="muted">Няма специалисти.</p>'}</div>`;
  wireTechActions(centerTechs);
}
function wireTechActions(reload) {
  const c = $('#content');
  c.querySelectorAll('[data-appruser]').forEach(b => b.onclick = async () => { await api('POST', '/admin/users/' + b.dataset.appruser + '/approve', { approved: true }); toast('Одобрен'); reload(); });
  c.querySelectorAll('[data-flaguser]').forEach(b => b.onclick = async () => { try { await api('POST', '/admin/users/' + b.dataset.flaguser + '/flag', { flagged: b.dataset.fv === '1' }); } catch (e) { toast('Грешка', e.message, 'emerg'); } reload(); });
  c.querySelectorAll('[data-rank]').forEach(b => b.onclick = async () => { const v = prompt('Нов ранг (1–5). Смяната е само на 28-мо и веднъж месечно. Добави „r" за нулиране на таксата по ранга (напр. 4r):'); if (v === null) return; try { await api('POST', '/admin/users/' + b.dataset.rank + '/rank', { rank: parseInt(v) || 1, reset_fee: /r/i.test(v) }); toast('Записано'); } catch (e) { toast('Грешка', e.message, 'emerg'); } reload(); });
  c.querySelectorAll('[data-fee]').forEach(b => b.onclick = async () => { const v = prompt('Индивидуална такса на посещение (сома; 0 = по ранг):'); if (v === null) return; await api('POST', '/admin/users/' + b.dataset.fee + '/visit-fee', { fee: parseFloat(v) || 0 }); toast('Записано'); reload(); });
  c.querySelectorAll('[data-feereq]').forEach(b => b.onclick = () => feeReqModal(b.dataset.feereq));
}
function feeReqModal(techId) {
  modal('Заявка за корекция на такса', `<label>Предложена сума (сома)</label><input id="amt" type="number"><label>Причина</label><input id="rsn"><div class="spacer"></div><button class="p" id="s" style="width:100%">Изпрати до центъра</button>`, (m, close) => {
    m.querySelector('#s').onclick = async () => { try { await api('POST', '/fee-requests', { tech_id: techId, amount: m.querySelector('#amt').value, reason: m.querySelector('#rsn').value }); close(); toast('Изпратено', 'Заявката чака одобрение от центъра.'); } catch (e) { toast('Грешка', e.message, 'emerg'); } };
  });
}
async function modTechs() {
  const { techs } = await api('GET', '/mod/techs');
  $('#content').innerHTML = `<h2 class="sec">Специалисти</h2><div class="grid">${techs.map(t => `
    <div class="item"><div class="row"><h3>${esc(t.name || t.email)}</h3>
      <span class="pill problem">${esc(TRADE_BG[t.trade] || '—')}</span>
      <span class="pill locked">ранг ${t.rank || 1}</span>
      ${t.approved ? '<span class="pill verified">одобрен</span>' : '<span class="pill open">неодобрен</span>'}
      <span class="right muted">#${t.id}</span></div>
    <div class="meta">Такса/посещение: <b>${t.effective_fee || 0} сома</b>${t.custom_fee ? ' (индивидуална)' : ' (по ранг)'}</div>
    <div class="row" style="margin-top:8px"><button class="sm" data-feereq="${t.id}">Заявка за корекция на такса</button></div>
    </div>`).join('') || '<p class="muted">Няма специалисти.</p>'}</div>`;
  wireTechActions(modTechs);
}
async function requestsTab() {
  const { requests } = await api('GET', '/fee-requests');
  const isCenter = state.user.role === 'center';
  $('#content').innerHTML = `<h2 class="sec">Заявки за корекция на такси</h2>
    <table class="tbl"><thead><tr><th>#</th><th>Специалист</th><th>Сума</th><th>Причина</th><th>От</th><th>Статус</th>${isCenter ? '<th></th>' : ''}</tr></thead><tbody>
    ${requests.map(q => `<tr><td>${q.id}</td><td>${esc(q.tech_name || '')}</td><td>${q.amount} сома</td><td>${esc(q.reason || '')}</td><td>${esc(q.requester || '')} (${ROLE_BG[q.requester_role] || ''})</td>
      <td>${q.status === 'pending' ? '<span class="pill open">чака</span>' : (q.status === 'approved' ? '<span class="pill verified">одобрена</span>' : '<span class="pill emergency">отказана</span>')}</td>
      ${isCenter ? `<td>${q.status === 'pending' ? `<button class="p sm" data-appr="${q.id}">Одобри</button> <button class="sm ghost" data-rej="${q.id}">Откажи</button>` : ''}</td>` : ''}
    </tr>`).join('') || `<tr><td colspan="7" class="muted">Няма заявки.</td></tr>`}</tbody></table>`;
  if (isCenter) {
    $('#content').querySelectorAll('[data-appr]').forEach(b => b.onclick = async () => { await api('POST', '/fee-requests/' + b.dataset.appr + '/approve'); toast('Одобрена'); requestsTab(); });
    $('#content').querySelectorAll('[data-rej]').forEach(b => b.onclick = async () => { await api('POST', '/fee-requests/' + b.dataset.rej + '/reject'); toast('Отказана'); requestsTab(); });
  }
}
async function signalsTab(type, ctx) {
  const { signals } = await api('GET', type ? '/signals?type=' + type : '/signals');
  const title = type ? (type === 'emergency' ? 'Спешни сигнали' : 'Проблемни сигнали') : 'Сигнали от моите обекти';
  $('#content').innerHTML = `<h2 class="sec">${title}</h2><div class="grid">${signals.map(s => signalCard(s, ctx)).join('') || '<p class="muted">Няма сигнали.</p>'}</div>`;
  wireSignalActions();
}
async function centerPayments(kind) {
  const { payments } = await api('GET', '/payments?kind=' + kind);
  $('#content').innerHTML = `<h2 class="sec">${kind === 'monthly' ? 'Месечни плащания' : 'Допълнителни плащания'}</h2>
    <table class="tbl"><thead><tr><th>#</th><th>Собственик</th><th>Период</th><th>QR</th><th>Доказ.</th><th>Статус</th><th>Действие</th></tr></thead><tbody>
    ${payments.map(p => `<tr>
      <td>${p.id}</td><td>${esc(p.owner_name || '')}</td><td>${esc(p.period || '—')}</td>
      <td>${p.locked ? ('№' + (p.qr_slot || '—')) : `<select data-slot="${p.id}"><option value="">—</option>${[1, 2, 3].map(s => `<option value="${s}" ${p.qr_slot == s ? 'selected' : ''}>№${s}</option>`).join('')}</select>`}</td>
      <td>${p.proof_path ? '<a href="' + fileUrl(p.proof_path) + '" target="_blank">📎</a>' : '—'}</td>
      <td>${p.verified ? '<span class="pill verified">проверено</span>' : '<span class="pill open">не</span>'}${p.locked ? ' <span class="pill locked">🔒</span>' : ''}</td>
      <td>${p.locked ? '<span class="muted">заключено</span>' : `<button class="p sm" data-verify="${p.id}">Провери</button>`}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="muted">Няма плащания.</td></tr>'}</tbody></table>`;
  $('#content').querySelectorAll('[data-slot]').forEach(sel => sel.onchange = async () => { try { await api('PUT', '/payments/' + sel.dataset.slot + '/method', { qr_slot: sel.value }); toast('Сменен QR метод'); } catch (e) { toast('Грешка', e.message, 'emerg'); } });
  $('#content').querySelectorAll('[data-verify]').forEach(b => b.onclick = async () => { const sel = $('#content').querySelector('[data-slot="' + b.dataset.verify + '"]'); try { await api('POST', '/payments/' + b.dataset.verify + '/verify', { qr_slot: sel ? sel.value : null }); toast('Проверено', 'Плащането е заключено.'); centerPayments(kind); } catch (e) { toast('Грешка', e.message, 'emerg'); } });
}
async function centerQR() {
  const { qrcodes } = await api('GET', '/qrcodes');
  const bySlot = s => qrcodes.find(q => q.slot === s);
  $('#content').innerHTML = `<h2 class="sec">QR кодове за плащане (до 3)</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    ${[1, 2, 3].map(s => { const q = bySlot(s); return `<div class="item qrbox"><h3>Слот №${s}</h3>
      ${q && q.image_path ? `<img src="${qrImg(s)}"><div class="muted">${esc(q.label || '')} ${q.active ? '' : '(скрит)'}</div>` : '<p class="muted">празен</p>'}
      <div class="spacer"></div><input type="file" data-qf="${s}" accept="image/*"><input placeholder="етикет" data-ql="${s}" value="${esc(q ? q.label || '' : '')}" style="margin-top:6px">
      <div class="spacer"></div><button class="p sm" data-qs="${s}">Запази слот ${s}</button> ${q ? `<button class="sm ghost" data-qd="${s}">Скрий</button>` : ''}</div>`; }).join('')}</div>`;
  $('#content').querySelectorAll('[data-qs]').forEach(b => b.onclick = async () => { const s = b.dataset.qs; const fd = new FormData(); const f = $('#content').querySelector('[data-qf="' + s + '"]').files[0]; if (f) fd.append('image', f); fd.append('label', $('#content').querySelector('[data-ql="' + s + '"]').value); fd.append('active', '1'); await api('POST', '/qrcodes/' + s, fd, true); toast('Запазено', 'QR слот ' + s); centerQR(); });
  $('#content').querySelectorAll('[data-qd]').forEach(b => b.onclick = async () => { await api('DELETE', '/qrcodes/' + b.dataset.qd); centerQR(); });
}
async function centerSettings() {
  const s = state.settings || (await api('GET', '/settings')).settings;
  $('#content').innerHTML = `<h2 class="sec">Настройки — мелодии за сигналите</h2>
    <div class="item"><p class="muted">Еднакви за сървъра и клиентските приложения.</p>
    <div class="row"><b style="width:120px">Спешен:</b> <span class="muted">${esc(s.emergency_sound)}</span> <button class="sm" id="playE">▶ Чуй</button></div>
    <div class="spacer"></div>
    <div class="row"><b style="width:120px">Проблем:</b> <span class="muted">${esc(s.problem_sound)}</span> <button class="sm" id="playP">▶ Чуй</button></div>
    </div>`;
  $('#playE').onclick = () => playSound('emergency');
  $('#playP').onclick = () => playSound('problem');
}

/* ===================== ПРИХОДИ / ИЗПЪЛНИТЕЛ ===================== */
async function techEarnings() {
  const e = await api('GET', '/my-earnings');
  $('#content').innerHTML = `<h2 class="sec">Моите приходи</h2>${techBanner()}
    <div class="item"><p class="muted">Само изчислителни сметки — фиксирана такса за групата ти, за всеки посетен (приключен) обект.</p>
    <div class="row"><b style="width:260px">Моята група:</b> <span class="pill problem">${TRADE_BG[e.group] || '—'}</span> <span class="pill locked">ранг ${e.rank || 1}</span></div><div class="spacer"></div>
    <div class="row"><b style="width:260px">Такса на посещение:</b> <span class="pill locked">${(e.visit_fee || 0).toFixed(2)} сома</span></div><div class="spacer"></div>
    <div class="row"><b style="width:260px">Този месец:</b> ${e.month} посещения · <span class="pill verified">${(e.month_total || 0).toFixed(2)} сома</span></div><div class="spacer"></div>
    <div class="row"><b style="width:260px">Общо (всички):</b> ${e.visits} посещения · <span class="pill verified">${(e.total || 0).toFixed(2)} сома</span></div>
    <div class="meta" style="margin-top:8px">Таксата по група се определя от центъра.</div></div>`;
}

/* ===================== МОДЕРАТОР ===================== */
async function modClients() {
  const { clients } = await api('GET', '/mod/clients');
  $('#content').innerHTML = `<h2 class="sec">Моите обекти</h2>
    <div class="row"><button class="p" id="addO">+ Нов обект (собственик)</button></div><div class="spacer"></div>
    <table class="tbl"><thead><tr><th>ID</th><th>Име</th><th>Имейл</th><th>Имоти</th><th>Договор</th><th>Платен месец</th><th>Мой дял (3%)</th></tr></thead><tbody>
    ${clients.map(c => `<tr><td>${c.id}</td><td>${esc(c.username || c.name || '')}</td><td>${esc(c.email)}</td><td>${c.properties}</td>
      <td>${c.approved ? '<span class="pill verified">да</span>' : '<span class="pill open">не</span>'}</td>
      <td>${c.paid_month ? '<span class="pill verified">да</span>' : '<span class="pill open">не</span>'}</td>
      <td>${(c.my_share || 0).toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Няма обекти. Добави първия.</td></tr>'}</tbody></table>`;
  $('#addO').onclick = () => modNewOwner();
}
function modNewOwner() {
  modal('Нов обект (собственик)', `<label>Имейл</label><input id="e"><label>Потребителско име</label><input id="u"><label>Телефон</label><input id="ph"><label>Начална парола</label><input id="pw"><div class="spacer"></div><button class="p" id="s" style="width:100%">Създай</button>`, (m, close) => {
    m.querySelector('#s').onclick = async () => { try { await api('POST', '/mod/clients', { email: m.querySelector('#e').value, username: m.querySelector('#u').value, phone: m.querySelector('#ph').value, password: m.querySelector('#pw').value }); close(); toast('Създаден', 'Собственикът влиза с имейл+парола.'); modClients(); } catch (err) { toast('Грешка', err.message, 'emerg'); } };
  });
}
async function modEarnings() {
  const e = await api('GET', '/mod/earnings');
  $('#content').innerHTML = `<h2 class="sec">Моите приходи (3%)</h2>
    <div class="item"><p class="muted">Само изчислителни сметки — 3% от проверените месечни такси на моите обекти.</p>
    <div class="row"><b style="width:240px">Този месец:</b> <span class="pill verified">${e.month.toFixed(2)} сома</span></div><div class="spacer"></div>
    <div class="row"><b style="width:240px">Общо (всички месеци):</b> <span class="pill locked">${e.total.toFixed(2)} сома</span></div>
    <div class="meta" style="margin-top:8px">Проверени плащания: ${e.count}</div></div>`;
}

/* ===================== СМЕТКИ (център + админ) ===================== */
async function accountingTab() {
  const e = await api('GET', '/admin/earnings');
  const { rank_fees } = await api('GET', '/admin/rank-fees');
  const row = (l, v, cls) => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><b style="width:320px">${l}</b> <span class="pill ${cls}">${v.toFixed(2)} сома</span></div>`;
  $('#content').innerHTML = `<h2 class="sec">Сметки (изчислителни)</h2>
    <div class="item"><p class="muted">Разпределение на проверените МЕСЕЧНИ такси. Само изчисление, не реални преводи.</p>
      ${row('Общо събрано (месечни):', e.total_monthly, 'locked')}
      ${row('Админ (1% от всички):', e.admin_share, 'verified')}
      ${row('Модератори (3% от своите):', e.moderators_share, 'verified')}
      ${row('Изпълнители (такса по ранг × посещения):', e.executors_total, 'verified')}
      ${row('Център/оператор (разликата):', e.operator_share, 'locked')}
    </div>
    <div class="spacer"></div>
    <div class="item"><h3>Такса по ранг (на посетен обект)</h3>
      <table class="tbl"><thead><tr><th>Ранг</th><th>Сума</th></tr></thead><tbody>${[1, 2, 3, 4, 5].map(n => `<tr><td>${n}</td><td>${rank_fees[n]} сома</td></tr>`).join('')}</tbody></table>
      <p class="muted" style="margin-top:8px">Индивидуалните корекции се правят в таб „Майстори" (само център), а модератор/админ подават „заявка за корекция".</p>
    </div>`;
}

/* ===================== ЕКИП (модератори/админи) ===================== */
async function staffTab() {
  const { staff } = await api('GET', '/admin/staff');
  const isCenter = state.user.role === 'center';
  $('#content').innerHTML = `<h2 class="sec">Екип (модератори и админи)</h2>
    ${isCenter ? '<div class="row"><button class="p" id="addS">+ Нов модератор/админ</button></div><div class="spacer"></div>' : ''}
    <table class="tbl"><thead><tr><th>ID</th><th>Роля</th><th>Име</th><th>Имейл</th><th>Обекти</th></tr></thead><tbody>
    ${staff.map(s => `<tr><td>${s.id}</td><td>${ROLE_BG[s.role]}</td><td>${esc(s.name || '')}</td><td>${esc(s.email)}</td><td>${s.role === 'moderator' ? (s.owners || 0) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Няма.</td></tr>'}</tbody></table>`;
  if (isCenter) $('#addS').onclick = () => newStaff();
}
function newStaff() {
  modal('Нов член на екипа', `<label>Роля</label><select id="r"><option value="moderator">Модератор</option><option value="admin">Админ</option></select><label>Имена</label><input id="n"><label>Имейл</label><input id="e"><label>Парола</label><input id="pw"><div class="spacer"></div><button class="p" id="s" style="width:100%">Създай</button>`, (m, close) => {
    m.querySelector('#s').onclick = async () => { try { await api('POST', '/admin/staff', { role: m.querySelector('#r').value, name: m.querySelector('#n').value, email: m.querySelector('#e').value, password: m.querySelector('#pw').value }); close(); toast('Създаден'); staffTab(); } catch (err) { toast('Грешка', err.message, 'emerg'); } };
  });
}

/* ---------- маршрути на табовете ---------- */
const TABMAP = {
  'owner:props': ownerProps, 'owner:signals': ownerSignals, 'owner:payments': ownerPayments, 'owner:contracts': contractsTab,
  'tech:feed': techFeed, 'tech:mine': techMine, 'tech:profile': techProfile, 'tech:earnings': techEarnings, 'tech:contracts': contractsTab,
  'center:clients': centerClients, 'center:techs': centerTechs, 'center:emergency': () => signalsTab('emergency', 'center'),
  'center:problem': () => signalsTab('problem', 'center'), 'center:pay_monthly': () => centerPayments('monthly'),
  'center:pay_extra': () => centerPayments('extra'), 'center:qr': centerQR, 'center:contracts': contractsTab,
  'center:staff': staffTab, 'center:requests': requestsTab, 'center:accounting': accountingTab, 'center:settings': centerSettings,
  'moderator:mclients': modClients, 'moderator:msignals': () => signalsTab(null, 'moderator'), 'moderator:mtechs': modTechs, 'moderator:mrequests': requestsTab, 'moderator:mearn': modEarnings,
  'admin:aclients': centerClients, 'admin:atechs': centerTechs, 'admin:aemergency': () => signalsTab('emergency', 'admin'),
  'admin:aproblem': () => signalsTab('problem', 'admin'), 'admin:arequests': requestsTab, 'admin:aearn': accountingTab, 'admin:astaff': staffTab,
};
function reloadTab() { openTab(state.tab); }

/* ---------- WebSocket известия ---------- */
function connectWS() {
  try {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(proto + '://' + location.host + '/ws?token=' + encodeURIComponent(state.token));
    state.ws = ws;
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'new-signal') { playSound(m.sound); toast(m.sound === 'emergency' ? '🚨 СПЕШЕН сигнал' : '🔧 Проблемен сигнал', (m.signal.address || '') + ' · тел. ' + (m.signal.owner_phone || '—'), m.sound === 'emergency' ? 'emerg' : 'prob'); refreshIfRelevant(); }
      else if (m.type === 'signal-assigned') { playSound(m.sound); toast('Възложен сигнал', m.signal.address || '', m.sound === 'emergency' ? 'emerg' : 'prob'); refreshIfRelevant(); }
      else if (m.type === 'signal-accepted') { toast('Сигнал приет', m.signal.tech_name ? 'Майстор: ' + m.signal.tech_name : ''); refreshIfRelevant(); }
      else if (m.type === 'signal-declined') { toast('Отказан майстор', 'Сигналът е пак отворен.'); refreshIfRelevant(); }
      else if (m.type === 'signal-resolved') { toast('Сигнал приключен', ''); refreshIfRelevant(); }
      else if (m.type === 'new-payment') { toast('Ново плащане', m.payment.owner_name || ''); refreshIfRelevant(); }
      else if (m.type === 'payment-verified') { toast('Плащане проверено', ''); refreshIfRelevant(); }
      else if (m.type === 'cost-request') { toast('Заявка за разходи', (m.signal && m.signal.cost_total || '') + ' сома'); refreshIfRelevant(); }
      else if (m.type && m.type.indexOf('cost-') === 0) { toast('Разходи — обновени', ''); refreshIfRelevant(); }
    };
    ws.onclose = () => { setTimeout(() => { if (state.token) connectWS(); }, 3000); };
  } catch {}
}
function refreshIfRelevant() { const t = state.tab; if (['signals', 'feed', 'mine', 'emergency', 'problem', 'payments', 'pay_monthly', 'pay_extra', 'msignals', 'aemergency', 'aproblem'].includes(t)) reloadTab(); }

boot();
