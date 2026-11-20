'use strict';
/* Pupikes Дом — уеб интерфейс за трите роли (собственик / майстор / център). */

// стабилни ключове за оборудване; показват се преведени, легаси стойности падат към себе си
const EQUIP = ['sockets', 'lamps', 'special_sockets', 'boilers', 'heaters', 'stoves', 'ac', 'tvs', 'computers', 'pro_equip', 'other_equip'];
const equipName = k => DICT['eq_' + k] ? t('eq_' + k) : String(k == null ? '' : k);
// преводими карти (ключ → t()); липсващ ключ → '' (за да работи „|| fallback")
const _tk = (prefix, k) => { const key = prefix + String(k); return DICT[key] ? t(key) : ''; };
const ROLE_BG = new Proxy({}, { get: (_, k) => _tk('role_', k) });
const ST_BG = new Proxy({}, { get: (_, k) => _tk('st_', k) });
const TRADE_BG = new Proxy({}, { get: (_, k) => _tk('trade_', k) });
const TRADES = () => [['power', t('trade_power')], ['water', t('trade_water')], ['software', t('trade_software')],
  ['hardware', t('trade_hardware')], ['medical', t('trade_medical')], ['pharmacy', t('trade_pharmacy')]];
const tradeOpts = sel => TRADES().map(([k, tx]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${tx}</option>`).join('');
// базов префикс — за хостинг под под-път (напр. /dom/ зад nginx). Локално (root) = ''.
const BASE = (() => { const p = location.pathname.replace(/\/[^/]*$/, ''); return p === '/' ? '' : p; })();
const fileUrl = name => BASE + '/api/files/' + encodeURIComponent(name) + '?token=' + encodeURIComponent(state.token);
const qrImg = slot => BASE + '/api/qrcodes/' + slot + '/image?token=' + encodeURIComponent(state.token);

// Коя роля е ТОВА приложение (owner/tech/moderator/admin/center). Задава се от входния HTML
// (window.PD_APP_ROLE). null = универсален вход (легаси). Публична регистрация има само в
// owner/tech приложенията. Ролята се проверява и от СЪРВЪРА (JWT) — тук е само за UX/заключване.
const APP_ROLE = (typeof window !== 'undefined' && window.PD_APP_ROLE) || null;
const APP_SELFREG = APP_ROLE === 'owner' || APP_ROLE === 'tech' || APP_ROLE === null;
const roleAppName = () => (APP_ROLE ? (_tk('role_', APP_ROLE) || '') : '');

let state = { token: localStorage.getItem('pd_token') || '', user: null, settings: null, ws: null, tab: '' };

/* ---------- API ---------- */
async function api(method, path, body, isForm) {
  const opt = { method, headers: {} };
  if (state.token) opt.headers.Authorization = 'Bearer ' + state.token;
  if (body && isForm) opt.body = body;
  else if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(BASE + '/api' + path, opt);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (t('error') + ' ' + res.status));
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
  // Заключване по приложение: ако акаунтът е с друга роля → изход (не пускаме в чуждо приложение).
  if (APP_ROLE && state.user && state.user.role !== APP_ROLE) { state.token = ''; localStorage.removeItem('pd_token'); state.user = null; return renderAuth(); }
  try { state.settings = (await api('GET', '/settings')).settings; } catch {}
  renderApp(); connectWS(); registerPush();
}

// push: обвивката (Capacitor/Electron) подава FCM токен → регистрираме устройството в бекенда.
// Работи и уеб: ако няма токен (браузър), просто не прави нищо.
async function registerDevice(token, platform) {
  if (!token || !state.token) return;
  try { await api('POST', '/device', { token, platform: platform || 'web' }); } catch (e) {}
}
async function registerPush() {
  if (window.PD_PUSH_TOKEN) registerDevice(window.PD_PUSH_TOKEN, window.PD_PLATFORM);
  // Нативна обвивка (Capacitor): поискай разрешение и регистрирай за FCM push.
  // В браузър (няма Capacitor) или без Firebase конфиг — тихо не прави нищо.
  try {
    const Cap = window.Capacitor;
    if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
    const PN = Cap.Plugins && Cap.Plugins.PushNotifications;
    if (!PN) return;
    PN.addListener('registration', tok => registerDevice(tok && tok.value, (Cap.getPlatform && Cap.getPlatform()) || 'android'));
    PN.addListener('registrationError', e => console.log('[push] registrationError', e && e.error));
    let perm = await PN.checkPermissions();
    if (perm.receive !== 'granted') perm = await PN.requestPermissions();
    if (perm.receive === 'granted') await PN.register();
  } catch (e) { /* няма Firebase/плъгин → без push, приложението работи */ }
}
// обвивката вика това, когато получи/обнови FCM токен
window.pdRegisterPush = (token, platform) => registerDevice(token, platform);

/* ---------- вход / регистрация ---------- */
function renderAuth() {
  let mode = 'login', role = (APP_ROLE === 'owner' || APP_ROLE === 'tech') ? APP_ROLE : 'owner';
  const draw = () => {
    $('#app').innerHTML = `
    <div class="auth">
      <div class="brand"><h1>Pupikes <b>Дом</b></h1>${APP_ROLE ? `<p class="roleline">${esc(roleAppName())}</p>` : ''}<p>${t('auth_tagline')}</p></div>
      <div class="row" style="justify-content:center;margin-bottom:10px">${langPickerHTML()}</div>
      <div class="card">
        <div class="tabsrow">
          <button data-m="login" class="${mode === 'login' ? 'on' : ''}">${t('auth_login_tab')}</button>
          ${APP_SELFREG ? `<button data-m="register" class="${mode === 'register' ? 'on' : ''}">${t('auth_register_tab')}</button>` : ''}
        </div>
        ${mode === 'register' && !APP_ROLE ? `
          <label>${t('auth_register_as')}</label>
          <div class="rolepick">
            <button data-r="owner" class="${role === 'owner' ? 'on' : ''}">${t('auth_role_owner')}</button>
            <button data-r="tech" class="${role === 'tech' ? 'on' : ''}">${t('auth_role_tech')}</button>
          </div>` : ''}
        <label>${t('f_email')}</label><input id="email" type="email" autocomplete="username">
        ${mode === 'register' ? `<label>${role === 'owner' ? t('f_username') : t('f_names')}</label><input id="name">
          <label>${t('f_phone')}</label><input id="phone">
          ${role === 'tech' ? `<label>${t('f_trade')}</label><select id="trade">${tradeOpts()}</select>
            <label>${t('f_rank_reg')}</label><select id="rank">${[1, 2, 3, 4, 5].map(n => '<option value="' + n + '">' + n + '</option>').join('')}</select>` : ''}` : ''}
        <label>${t('f_password')}</label><input id="password" type="password" autocomplete="current-password">
        <div class="err" id="err"></div>
        <button class="p" id="go" style="width:100%">${mode === 'login' ? t('auth_login_btn') : t('auth_register_btn')}</button>
      </div>
    </div>`;
    $('#app').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    $('#app').querySelectorAll('[data-r]').forEach(b => b.onclick = () => { role = b.dataset.r; draw(); });
    $('#go').onclick = submit;
    $('#password').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    const lp = $('#langpick'); if (lp) lp.onchange = e => setLang(e.target.value);
  };
  const submit = async () => {
    try {
      const email = $('#email').value.trim(), password = $('#password').value;
      let data;
      if (mode === 'login') data = await api('POST', '/login', { email, password });
      else data = await api('POST', '/register', { role, email, password, username: role === 'owner' ? $('#name').value : null, name: $('#name') ? $('#name').value : null, phone: $('#phone') ? $('#phone').value : null, trade: role === 'tech' && $('#trade') ? $('#trade').value : undefined, rank: role === 'tech' && $('#rank') ? $('#rank').value : undefined });
      if (APP_ROLE && data.user && data.user.role !== APP_ROLE) { $('#err').textContent = t('wrong_role_app', { role: roleAppName() }); return; }
      state.token = data.token; localStorage.setItem('pd_token', data.token); state.user = data.user;
      boot();
    } catch (e) { $('#err').textContent = e.message; }
  };
  draw();
}

/* ---------- приложение ---------- */
function logout() { state.token = ''; localStorage.removeItem('pd_token'); if (state.ws) try { state.ws.close(); } catch {} location.reload(); }

const TABS = () => ({
  owner: [['props', t('tab_props')], ['signals', t('tab_signals')], ['payments', t('tab_payments')], ['contracts', t('tab_contracts')]],
  tech: [['feed', t('tab_signals')], ['mine', t('tab_mine')], ['profile', t('tab_profile')], ['earnings', t('tab_earnings')], ['contracts', t('tab_contracts')]],
  center: [['clients', t('tab_clients')], ['techs', t('tab_techs')], ['emergency', t('tab_emergency')], ['problem', t('tab_problems')],
    ['pay_monthly', t('tab_pay_monthly')], ['pay_extra', t('tab_pay_extra')], ['qr', t('tab_qr')], ['contracts', t('tab_contracts')],
    ['staff', t('tab_staff')], ['requests', t('tab_requests')], ['accounting', t('tab_accounting')], ['settings', t('tab_settings')]],
  moderator: [['mclients', t('tab_my_objects')], ['msignals', t('tab_signals')], ['mtechs', t('tab_specialists')], ['mrequests', t('tab_requests')], ['mearn', t('tab_earn3')]],
  admin: [['aclients', t('tab_objects')], ['atechs', t('tab_techs')], ['aemergency', t('tab_emergency')], ['aproblem', t('tab_problems')], ['arequests', t('tab_requests')], ['aearn', t('tab_accounting')], ['astaff', t('tab_staff')]],
});

function renderApp() {
  const role = state.user.role;
  state.tab = TABS()[role][0][0];
  $('#app').innerHTML = `
    <header class="top">
      <span class="logo">Pupikes <b>Дом</b></span>
      <span class="roletag">${ROLE_BG[role]}</span>
      <span class="sp"></span>
      <span class="who">${esc(state.user.name || state.user.username || state.user.email)}</span>
      ${langPickerHTML()}
      <button class="sm ghost" id="logout">${t('logout')}</button>
    </header>
    <nav class="tabs" id="nav"></nav>
    <main id="content"></main>`;
  $('#logout').onclick = logout;
  $('#langpick').onchange = e => setLang(e.target.value);
  drawNav(); openTab(state.tab);
}
function drawNav() {
  $('#nav').innerHTML = TABS()[state.user.role].map(([k, label]) => `<button data-t="${k}" class="${k === state.tab ? 'on' : ''}">${label}</button>`).join('');
  $('#nav').querySelectorAll('[data-t]').forEach(b => b.onclick = () => openTab(b.dataset.t));
}
function openTab(t) { state.tab = t; drawNav(); const fn = TABMAP[state.user.role + ':' + t]; if (fn) fn(); }

/* ===================== СОБСТВЕНИК ===================== */
async function ownerProps() {
  const c = $('#content'); c.innerHTML = '<h2 class="sec">' + t('owner_props_title') + '</h2><div class="row"><button class="p" id="addP">' + t('owner_add_prop') + '</button></div><div class="spacer"></div><div id="list" class="grid"></div>';
  $('#addP').onclick = () => propForm();
  const { properties } = await api('GET', '/properties');
  $('#list').innerHTML = properties.map(p => `
    <div class="item" data-id="${p.id}">
      <div class="row"><h3>${esc(p.name || t('prop_default_name'))}</h3><span class="right muted">${esc(p.size || '')}</span></div>
      <div class="meta">${esc(p.address || t('no_address'))}${p.lat ? ' · 📍' + p.lat + ',' + p.lng : ''}</div>
      <div class="meta">${t('equipment')}: ${p.equipment.length ? p.equipment.map(e => esc((e.label || equipName(e.kind)) + ' ×' + e.count)).join(', ') : '—'}</div>
      <div class="big-actions">
        <button class="emerg" data-emg="${p.id}">${t('btn_emergency')}</button>
        <button class="prob" data-prb="${p.id}">${t('btn_problem')}</button>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="sm" data-equip="${p.id}">${t('equipment')}</button>
        <button class="sm ghost" data-del="${p.id}">${t('btn_delete_prop')}</button>
      </div>
    </div>`).join('') || `<p class="muted">${t('no_props_yet')}</p>`;
  c.querySelectorAll('[data-emg]').forEach(b => b.onclick = () => sendSignal(b.dataset.emg, 'emergency'));
  c.querySelectorAll('[data-prb]').forEach(b => b.onclick = () => sendSignal(b.dataset.prb, 'problem'));
  c.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => equipModal(b.dataset.equip, properties.find(x => x.id == b.dataset.equip)));
  c.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm(t('confirm_delete_prop'))) { await api('DELETE', '/properties/' + b.dataset.del); ownerProps(); } });
}
function propForm() {
  modal(t('modal_new_prop'), `
    <label>${t('f_name_desc')}</label><input id="pname">
    <div class="formgrid"><div><label>${t('f_size')}</label><input id="psize" placeholder="${t('ph_size')}"></div>
    <div><label>${t('f_location_geo')}</label><input id="ploc" placeholder="${t('ph_latlng')}"></div></div>
    <label>${t('f_exact_address')}</label><input id="paddr">
    <div class="spacer"></div><button class="p" id="save" style="width:100%">${t('save')}</button>`, (m, close) => {
    m.querySelector('#save').onclick = async () => {
      const loc = (m.querySelector('#ploc').value || '').split(',');
      await api('POST', '/properties', { name: m.querySelector('#pname').value, size: m.querySelector('#psize').value, address: m.querySelector('#paddr').value, lat: loc[0], lng: loc[1] });
      close(); ownerProps();
    };
  });
}
function equipModal(pid, prop) {
  const list = () => (prop.equipment || []).map(e => `<div class="row" style="border-bottom:1px solid var(--line);padding:6px 0"><span>${esc(e.label || equipName(e.kind))} ×${e.count}</span><button class="sm ghost right" data-rm="${e.id}">✕</button></div>`).join('') || `<p class="muted">${t('no_equipment')}</p>`;
  modal(t('equipment'), `
    <div id="eqlist">${list()}</div><hr style="border-color:var(--line)">
    <label>${t('f_kind')}</label><select id="ekind">${EQUIP.map(x => '<option value="' + x + '">' + esc(equipName(x)) + '</option>').join('')}</select>
    <div class="formgrid"><div><label>${t('f_note_opt')}</label><input id="elabel"></div><div><label>${t('f_count')}</label><input id="ecount" type="number" value="1" min="1"></div></div>
    <div class="spacer"></div><button class="p" id="add" style="width:100%">${t('add')}</button>`, (m, close) => {
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
  modal(emerg ? t('modal_emergency_signal') : t('modal_problem_signal'), `
    <label>${t('q_what_help')}</label><select id="strade">${tradeOpts('power')}</select>
    ${emerg ? `<p class="muted">${t('emergency_no_desc')}</p>`
            : `<label>${t('f_describe_problem')}</label><textarea id="desc" rows="4" placeholder="${t('ph_what_broken')}"></textarea>`}
    <div class="spacer"></div><button class="${emerg ? 'emerg' : 'prob'}" id="send" style="width:100%">${emerg ? t('btn_submit_emergency') : t('btn_submit_signal')}</button>`,
    (m, close) => {
      m.querySelector('#send').onclick = async () => {
        try {
          await api('POST', '/signals', { property_id: pid, type, trade: m.querySelector('#strade').value, description: emerg ? null : m.querySelector('#desc').value });
          close(); toast(emerg ? t('toast_emergency_sent') : t('toast_problem_sent'), t('techs_notified'), emerg ? 'emerg' : 'prob'); openTab('signals');
        } catch (e) { toast(t('error'), e.message, 'emerg'); }
      };
    });
}
async function ownerSignals() {
  const { signals } = await api('GET', '/signals');
  $('#content').innerHTML = '<h2 class="sec">' + t('my_signals_title') + '</h2><div class="grid">' + (signals.map(s => signalCard(s, 'owner')).join('') || `<p class="muted">${t('no_signals')}</p>`) + '</div>';
  wireSignalActions('owner');
}

/* ===================== МАЙСТОР ===================== */
function techBanner() {
  if (state.user.flagged) return `<div class="item" style="border-color:var(--bad)"><b style="color:var(--bad)">${t('tech_flagged_title')}</b><div class="muted">${t('tech_flagged_body')}</div></div><div class="spacer"></div>`;
  if (!state.user.approved) return `<div class="item" style="border-color:var(--warn)"><b style="color:var(--warn)">${t('tech_pending_title')}</b><div class="muted">${t('tech_pending_body')}</div></div><div class="spacer"></div>`;
  return '';
}
async function techFeed() {
  const { signals } = await api('GET', '/signals');
  $('#content').innerHTML = '<h2 class="sec">' + t('open_signals') + ' · ' + esc(TRADE_BG[state.user.trade] || '') + '</h2>' + techBanner() + '<div class="grid">' + (signals.map(s => signalCard(s, 'tech')).join('') || `<p class="muted">${t('no_open_signals')}</p>`) + '</div>';
  wireSignalActions();
}
async function techMine() {
  const { signals } = await api('GET', '/signals?scope=mine');
  $('#content').innerHTML = '<h2 class="sec">' + t('accepted_by_me') + '</h2>' + techBanner() + '<div class="grid">' + (signals.map(s => signalCard(s, 'tech-mine')).join('') || `<p class="muted">${t('no_accepted_signals')}</p>`) + '</div>';
  wireSignalActions();
}
async function techProfile() {
  const { profile, addresses } = await api('GET', '/profile');
  $('#content').innerHTML = `
    <h2 class="sec">${t('tech_profile_title')}</h2>
    ${techBanner()}
    <div class="item">
      <label>${t('f_trade')}</label><select id="ptrade">${tradeOpts(profile.trade)}</select>
      <label>${t('f_skills')}</label><textarea id="skills" rows="4">${esc(profile.skills || '')}</textarea>
      <div class="formgrid"><div><label>${t('f_main_location')}</label><input id="maddr" value="${esc(profile.main_address || '')}"></div>
      <div><label>${t('f_geo')}</label><input id="mloc" value="${profile.main_lat ? profile.main_lat + ',' + profile.main_lng : ''}"></div></div>
      <div class="spacer"></div><button class="p" id="saveProf">${t('btn_save_profile')}</button>
    </div>
    <div class="spacer"></div>
    <div class="item"><h3>${t('work_addresses')}</h3><div id="addrs">${addresses.map(a => `<div class="row" style="padding:5px 0;border-bottom:1px solid var(--line)"><span>${esc(a.label || '')} ${esc(a.address || '')}</span><button class="sm ghost right" data-rma="${a.id}">✕</button></div>`).join('') || `<p class="muted">${t('no_addresses')}</p>`}</div>
      <div class="formgrid"><div><label>${t('f_label')}</label><input id="alabel" placeholder="${t('ph_warehouse')}"></div><div><label>${t('f_address')}</label><input id="aaddr"></div></div>
      <div class="spacer"></div><button class="sm" id="addAddr" ${addresses.length >= 3 ? 'disabled' : ''}>${t('btn_add_address')}</button>
    </div>`;
  $('#saveProf').onclick = async () => { const loc = ($('#mloc').value || '').split(','); await api('PUT', '/profile', { skills: $('#skills').value, main_address: $('#maddr').value, main_lat: loc[0], main_lng: loc[1], trade: $('#ptrade').value }); toast(t('saved'), t('profile_updated')); };
  $('#addAddr').onclick = async () => { await api('POST', '/addresses', { label: $('#alabel').value, address: $('#aaddr').value }); techProfile(); };
  $('#content').querySelectorAll('[data-rma]').forEach(b => b.onclick = async () => { await api('DELETE', '/addresses/' + b.dataset.rma); techProfile(); });
}

/* ---------- обща карта на сигнал ---------- */
function signalCard(s, ctx) {
  const stp = s.type === 'emergency' ? 'emergency' : 'problem';
  const stName = s.type === 'emergency' ? t('sig_emergency') : t('sig_problem');
  const showStatus = ['tech', 'tech-mine', 'center', 'moderator', 'admin'].includes(ctx);
  return `<div class="item" data-id="${s.id}">
    <div class="row">
      <span class="pill ${stp}">${stName}</span>
      <span class="pill problem">${esc(TRADE_BG[s.trade] || s.trade || '')}</span>
      <span class="pill ${s.status}">${ST_BG[s.status] || s.status}</span>
      ${s.property_flagged ? `<span class="pill emergency">${t('flagged_property_pill')}</span>` : ''}
      <span class="right muted">#${s.id}</span>
    </div>
    <div class="meta" style="margin-top:6px"><b>${esc(s.property_name || '')}</b> · ${esc(s.address || '')}</div>
    ${s.description ? '<div class="meta">„' + esc(s.description) + '"</div>' : ''}
    <div class="meta">${t('owner_label')}: ${esc(s.owner_name || '')} · ${t('tel_label')} ${esc(s.owner_phone || '—')}</div>
    ${showStatus ? `<div class="meta">${s.owner_contract_signed ? t('contract_signed') : t('no_contract')} · ${s.owner_paid_month ? t('month_paid') : t('month_unpaid')}</div>` : ''}
    ${(['center', 'moderator', 'admin'].includes(ctx) && s.candidates && s.candidates.length) ? '<div class="meta">' + t('candidates_label') + ': ' + s.candidates.map(c => esc(c.name) + ' (' + t('rank_word') + ' ' + c.rank + ', ' + c.fee + ' ' + t('currency') + ', ' + c.eta_minutes + ' ' + t('min_abbr') + ')').join(' · ') + '</div>' : ''}
    ${s.tech_name ? '<div class="meta">' + t('assigned_label') + ': ' + esc(s.tech_name) + (s.eta_minutes ? ' · ' + t('until_word') + ' ' + s.eta_minutes + ' ' + t('min_abbr') : '') + '</div>' : ''}
    ${s.cost_status ? '<div class="meta">' + t('costs_transport') + ' ' + (s.transport_cost || 0) + ' + ' + t('plus_materials') + ' ' + (s.materials_cost || 0) + ' = <b>' + s.cost_total + ' ' + t('currency') + '</b>' + (s.materials_by_tech ? ' (' + t('materials_by_tech_note') + ')' : '') + (s.cost_mode ? ' · ' + t('payable_to_tech') + ': <b>' + s.cost_payable + ' ' + t('currency') + '</b>' + (s.cost_mode === 'transport' ? ' (' + t('only_fees_note') + ')' : '') : '') + ' · ' + costStatusBg(s) + '</div>' : ''}
    ${s.accepted_by && s.status !== 'resolved' ? '<div class="meta">' + (s.can_depart ? t('can_depart_yes') : t('can_depart_wait')) + '</div>' : ''}
    <div class="row" style="margin-top:8px">${signalButtons(s, ctx)}</div>
  </div>`;
}
function costStatusBg(s) {
  if (s.cost_status === 'cleared') return s.type === 'emergency' ? t('cost_client_after') : t('cost_paid_verified');
  return { pending: t('cost_pending_owner'), approved: t('cost_approved_wait'), rejected: t('cost_rejected') }[s.cost_status] || s.cost_status;
}
function costOversightButtons(s) {
  const role = state.user.role;
  let b = '';
  if (s.cost_status === 'pending' || s.cost_status === 'approved') b += `<button class="sm ghost" data-costreject="${s.id}">${t('btn_reject_costs')}</button> `;
  if (s.cost_status === 'approved') b += `<button class="p sm" data-costclear="${s.id}">${t('btn_costs_paid_verify')}</button> `;
  if (s.cost_status === 'cleared' && (role === 'center' || role === 'admin')) b += `<button class="sm ghost" data-costunclear="${s.id}">${t('btn_fix_can_depart')}</button> `;
  return b;
}
function signalButtons(s, ctx) {
  if (ctx === 'owner') {
    let b = '';
    if (s.cost_status === 'pending') {
      b += `<button class="p sm" data-costapprove="${s.id}" data-mode="full">${t('btn_approve_full', { amount: s.cost_total })}</button> `;
      if ((s.materials_cost || 0) > 0) b += `<button class="sm" data-costapprove="${s.id}" data-mode="transport">${t('btn_pay_fees_only', { amount: s.transport_cost || 0 })}</button> `;
    }
    if (s.accepted_by && s.status !== 'resolved') b += `<button class="p sm" data-resolve="${s.id}">${t('btn_mark_resolved')}</button> <button class="sm ghost" data-decline="${s.id}">${t('btn_decline_waiting')}</button>`;
    return b;
  }
  if (ctx === 'tech') return s.status === 'open' ? (s.i_volunteered ? `<span class="muted">${t('volunteered_wait')}</span>` : `<button class="p sm" data-volunteer="${s.id}">${t('btn_volunteer')}</button>`) : '';
  if (ctx === 'tech-mine') {
    if (s.status === 'resolved') return `<span class="muted">${t('st_resolved')}</span>`;
    if (s.accepted_by === state.user.id) {
      let b = '';
      if (!s.cost_status || s.cost_status === 'rejected') b += `<button class="p sm" data-cost="${s.id}" data-emg="${s.type === 'emergency' ? 1 : 0}">${t('btn_calc_costs')}</button> `;
      b += s.can_depart ? `<span class="muted">${t('you_can_depart')}</span>` : `<span class="muted">${t('wait_cost_approval')}</span>`;
      return b;
    }
    return s.accepted_by ? `<span class="muted">${t('another_assigned')}</span>` : `<span class="muted">${t('volunteered_wait2')}</span>`;
  }
  if (ctx === 'center') {
    let b = '';
    if (s.status !== 'resolved') b += `<button class="sm" data-assign="${s.id}">${t('btn_assign_tech')}</button> `;
    b += costOversightButtons(s);
    b += `<button class="sm ghost" data-flagprop="${s.property_id}" data-flagval="${s.property_flagged ? 0 : 1}">${s.property_flagged ? t('btn_unflag_prop') : t('btn_flag_prop')}</button>`;
    return b;
  }
  if (ctx === 'moderator') { let b = s.status === 'open' ? `<button class="sm" data-assign="${s.id}">${t('btn_assign_tech')}</button> ` : (s.accepted_by ? `<span class="muted">${t('engaged_no_change')}</span> ` : ''); return b + costOversightButtons(s); }
  if (ctx === 'admin') { let b = s.status !== 'resolved' ? `<button class="sm" data-assign="${s.id}">${s.accepted_by ? t('btn_reassign_tech') : t('btn_assign_tech')}</button> ` : ''; return b + costOversightButtons(s); }
  return '';
}
function wireSignalActions() {
  const c = $('#content');
  c.querySelectorAll('[data-volunteer]').forEach(b => b.onclick = () => volunteerModal(b.dataset.volunteer));
  c.querySelectorAll('[data-decline]').forEach(b => b.onclick = async () => { if (confirm(t('confirm_decline_tech'))) { try { await api('POST', '/signals/' + b.dataset.decline + '/decline'); } catch (e) { toast(t('error'), e.message, 'emerg'); } reloadTab(); } });
  c.querySelectorAll('[data-resolve]').forEach(b => b.onclick = async () => { if (confirm(t('confirm_resolve'))) { try { await api('POST', '/signals/' + b.dataset.resolve + '/resolve'); } catch (e) { toast(t('error'), e.message, 'emerg'); } reloadTab(); } });
  c.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => assignModal(b.dataset.assign));
  c.querySelectorAll('[data-flagprop]').forEach(b => b.onclick = async () => { try { await api('POST', '/admin/properties/' + b.dataset.flagprop + '/flag', { flagged: b.dataset.flagval === '1' }); } catch (e) { toast(t('error'), e.message, 'emerg'); } reloadTab(); });
  c.querySelectorAll('[data-cost]').forEach(b => b.onclick = () => costModal(b.dataset.cost, b.dataset.emg === '1'));
  c.querySelectorAll('[data-costapprove]').forEach(b => b.onclick = async () => { const tr = b.dataset.mode === 'transport'; if (confirm(tr ? t('confirm_pay_transport') : t('confirm_approve_all_costs'))) { try { await api('POST', '/signals/' + b.dataset.costapprove + '/cost/approve', { mode: b.dataset.mode }); } catch (e) { toast(t('error'), e.message, 'emerg'); } reloadTab(); } });
  c.querySelectorAll('[data-costreject]').forEach(b => b.onclick = async () => { if (confirm(t('confirm_reject_cost'))) { try { await api('POST', '/signals/' + b.dataset.costreject + '/cost/reject'); } catch (e) { toast(t('error'), e.message, 'emerg'); } reloadTab(); } });
  c.querySelectorAll('[data-costclear]').forEach(b => b.onclick = async () => { try { await api('POST', '/signals/' + b.dataset.costclear + '/cost/clear'); toast(t('verified_word'), t('costs_paid_toast')); } catch (e) { toast(t('error'), e.message, 'emerg'); } reloadTab(); });
  c.querySelectorAll('[data-costunclear]').forEach(b => b.onclick = async () => { if (confirm(t('confirm_unclear'))) { try { await api('POST', '/signals/' + b.dataset.costunclear + '/cost/unclear'); } catch (e) { toast(t('error'), e.message, 'emerg'); } reloadTab(); } });
}
function costModal(id, emerg) {
  modal(t('modal_calc_costs'), `
    <p class="muted">${emerg ? t('cost_note_emergency') : t('cost_note_problem')}</p>
    <div class="formgrid"><div><label>${t('f_transport')}</label><input id="tr" type="number" value="0"></div><div><label>${t('f_materials')}</label><input id="ma" type="number" value="0"></div></div>
    <label class="row" style="gap:6px"><input type="checkbox" id="byt"> ${t('chk_materials_self')}</label>
    <label>${t('f_note_optional')}</label><input id="nt">
    <div class="spacer"></div><button class="p" id="s" style="width:100%">${t('btn_send_cost_request')}</button>`, (m, close) => {
    m.querySelector('#s').onclick = async () => { try { await api('POST', '/signals/' + id + '/cost', { transport_cost: m.querySelector('#tr').value, materials_cost: m.querySelector('#ma').value, materials_by_tech: m.querySelector('#byt').checked, note: m.querySelector('#nt').value }); close(); toast(t('sent_word'), t('cost_request_sent')); reloadTab(); } catch (e) { toast(t('error'), e.message, 'emerg'); } };
  });
}
function volunteerModal(id) {
  modal(t('modal_volunteer'), `<p class="muted">${t('volunteer_note')}</p>
    <label>${t('f_eta_minutes')}</label><input id="eta" type="number" min="1" max="180" placeholder="60">
    <div class="spacer"></div><button class="p" id="acc" style="width:100%">${t('btn_volunteer')}</button>`, (m, close) => {
    m.querySelector('#acc').onclick = async () => { try { await api('POST', '/signals/' + id + '/volunteer', { eta_minutes: m.querySelector('#eta').value || 60 }); close(); toast(t('approved_word'), t('volunteer_sent')); reloadTab(); } catch (e) { toast(t('error'), e.message, 'emerg'); } };
  });
}
async function assignModal(id) {
  const ep = state.user.role === 'moderator' ? '/mod/techs' : '/admin/techs';
  const techs = (await api('GET', ep)).techs.filter(t => !t.flagged);
  if (!techs.length) return toast(t('no_specialists'), t('no_unflagged_specialists'), 'emerg');
  const sig = (await api('GET', '/signals/' + id)).signal;
  const cand = new Set((sig.candidates || []).map(c => c.tech_id));
  const tradeOf = t => t.trade || (t.profile && t.profile.trade);
  const rankOf = t => t.rank || (t.profile && t.profile.rank) || 1;
  techs.sort((a, b) => (cand.has(b.id) ? 1 : 0) - (cand.has(a.id) ? 1 : 0) || rankOf(b) - rankOf(a));
  modal(t('modal_assign_specialist'), `<p class="muted">${t('assign_note')}</p>
    <label>${t('f_specialist')}</label><select id="tech">${techs.map(tc => `<option value="${tc.id}">${cand.has(tc.id) ? '✅ ' : ''}${esc(tc.name || tc.email)} · ${TRADE_BG[tradeOf(tc)] || '—'} · ${t('rank_word')} ${rankOf(tc)} · ${tc.effective_fee || 0} ${t('currency')}${tc.approved === 0 ? ' ' + t('unapproved_paren') : ''}</option>`).join('')}</select>
    <label>${t('f_deadline_min')}</label><input id="eta" type="number" value="60" min="1" max="180">
    <div class="spacer"></div><button class="p" id="as" style="width:100%">${t('btn_assign_go')}</button>`, (m, close) => {
    m.querySelector('#as').onclick = async () => { try { await api('POST', '/signals/' + id + '/assign', { tech_id: m.querySelector('#tech').value, eta_minutes: m.querySelector('#eta').value }); close(); toast(t('assigned_word'), t('specialist_notified')); reloadTab(); } catch (e) { toast(t('error'), e.message, 'emerg'); } };
  });
}

/* ===================== ПЛАЩАНИЯ ===================== */
async function ownerPayments() {
  const { payments } = await api('GET', '/payments');
  $('#content').innerHTML = `<h2 class="sec">${t('tab_payments')}</h2><div class="row"><button class="gold" id="newPay">${t('btn_new_payment')}</button></div><div class="spacer"></div>
    <div class="grid">${payments.map(paymentCard).join('') || `<p class="muted">${t('no_payments')}</p>`}</div>`;
  $('#newPay').onclick = newPaymentFlow;
}
function paymentCard(p) {
  return `<div class="item"><div class="row">
    <span class="pill ${p.kind === 'monthly' ? 'open' : 'problem'}">${p.kind === 'monthly' ? t('pay_monthly_word') : t('pay_extra_word')}</span>
    ${p.period ? '<span class="pill locked">' + esc(p.period) + '</span>' : ''}
    ${p.verified ? `<span class="pill verified">${t('verified_pill')}</span>` : `<span class="pill open">${t('unverified_pill')}</span>`}
    ${p.locked ? `<span class="pill locked">${t('locked_pill')}</span>` : ''}
    <span class="right muted">#${p.id} · ${(p.created_at || '').slice(0, 10)}</span></div>
    <div class="meta">${t('qr_code_label')}: ${p.qr_slot ? '№' + p.qr_slot : '—'} ${p.amount ? ' · ' + t('amount_word') + ' ' + esc(p.amount) : ''}</div>
    ${p.proof_path ? `<div class="meta">${t('proof_attached_note')}</div>` : ''}
  </div>`;
}
async function newPaymentFlow() {
  const { qrcodes } = await api('GET', '/qrcodes');
  const active = qrcodes.filter(q => q.active && q.image_path);
  if (!active.length) return toast(t('no_qr'), t('no_qr_set'), 'emerg');
  let idx = 0;
  const curMonth = new Date().toISOString().slice(0, 7);
  modal(t('modal_new_payment'), `
    <div class="qrbox"><div id="qrwrap"></div></div>
    <div class="row" style="justify-content:center;margin-top:8px"><button class="sm" id="nextQr">${t('btn_next_qr')}</button></div>
    <label>${t('f_payment_kind')}</label><select id="kind"><option value="monthly">${t('opt_monthly')}</option><option value="extra">${t('opt_extra_service')}</option></select>
    <div id="periodWrap"><label>${t('f_which_month')}</label><input id="period" type="month" value="${curMonth}"></div>
    <div class="formgrid"><div><label>${t('f_amount_opt')}</label><input id="amount"></div><div><label>${t('f_note')}</label><input id="note"></div></div>
    <label>${t('f_upload_proof')}</label><input id="proof" type="file" accept="image/*,application/pdf">
    <div class="spacer"></div><button class="gold" id="pay" style="width:100%">${t('btn_record_payment')}</button>`, (m, close) => {
    const drawQr = () => { const q = active[idx]; m.querySelector('#qrwrap').innerHTML = `<img src="${qrImg(q.slot)}"><div class="muted">${t('qr_code_no')}${q.slot}${q.label ? ' · ' + esc(q.label) : ''}</div>`; };
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
      try { await api('POST', '/payments', fd, true); close(); toast(t('recorded_word'), t('payment_sent_verify')); ownerPayments(); }
      catch (e) { toast(t('error'), e.message, 'emerg'); }
    };
  });
}

/* ===================== ДОГОВОРИ ===================== */
async function contractsTab() {
  const { contracts } = await api('GET', '/contracts');
  const center = state.user.role === 'center';
  $('#content').innerHTML = `<h2 class="sec">${t('tab_contracts')}</h2>
    ${center ? '' : `<div class="row"><input type="file" id="cf" accept="image/*,application/pdf" style="max-width:260px"><button class="p" id="up">${t('btn_upload_contract')}</button></div><div class="spacer"></div><p class="muted">${t('contracts_center_only_note')}</p>`}
    <table class="tbl"><thead><tr><th>${t('th_no')}</th><th>${t('th_date')}</th>${center ? `<th>${t('th_who')}</th><th>${t('th_file')}</th>` : ''}<th>${t('th_status')}</th>${center ? '<th></th>' : ''}</tr></thead><tbody>
    ${contracts.map(c => `<tr>
      <td>${c.seq}</td><td>${(c.uploaded_at || '').slice(0, 10)}</td>
      ${center ? '<td>' + esc(c.who || '') + ' (' + ROLE_BG[c.who_role] + ')</td><td><a href="' + fileUrl(c.file_path) + '" target="_blank">' + esc(c.file_path) + '</a></td>' : ''}
      <td>${c.approved ? `<span class="pill verified">${t('approved_pill')}</span>` : `<span class="pill open">${t('waiting_pill')}</span>`}</td>
      ${center ? '<td>' + (c.approved ? '' : `<button class="p sm" data-appr="${c.id}">${t('approve')}</button>`) + '</td>' : ''}
    </tr>`).join('') || `<tr><td colspan="6" class="muted">${t('no_contracts')}</td></tr>`}
    </tbody></table>`;
  if (!center) $('#up').onclick = async () => { const f = $('#cf').files[0]; if (!f) return toast(t('choose_file')); const fd = new FormData(); fd.append('file', f); await api('POST', '/contracts', fd, true); toast(t('uploaded_word'), t('contract_saved')); contractsTab(); };
  if (center) $('#content').querySelectorAll('[data-appr]').forEach(b => b.onclick = async () => { await api('POST', '/admin/contracts/' + b.dataset.appr + '/approve'); toast(t('approved_masc_word'), t('contract_approved')); contractsTab(); });
}

/* ===================== ЦЕНТЪР ===================== */
async function centerClients() {
  const { clients } = await api('GET', '/admin/clients');
  const isCenter = state.user.role === 'center';
  const mods = isCenter ? (await api('GET', '/admin/staff')).staff.filter(s => s.role === 'moderator') : [];
  $('#content').innerHTML = `<h2 class="sec">${t('clients_title')}</h2>
    <table class="tbl"><thead><tr><th>ID</th><th>${t('th_name')}</th><th>${t('th_email')}</th><th>${t('th_properties')}</th><th>${t('th_contract')}</th><th>${t('th_paid_month')}</th><th>${t('th_moderator')}</th></tr></thead><tbody>
    ${clients.map(c => `<tr><td>${c.id}</td><td>${esc(c.username || c.name || '')}</td><td>${esc(c.email)}</td><td>${c.properties}</td>
      <td>${c.approved ? `<span class="pill verified">${t('signed_pill')}</span>` : `<span class="pill open">${t('no_word')}</span>`}</td>
      <td>${c.paid_month ? `<span class="pill verified">${t('yes_word')}</span>` : `<span class="pill open">${t('no_word')}</span>`}</td>
      <td>${isCenter ? `<select data-modof="${c.id}"><option value="">${t('none_dash')}</option>${mods.map(m => `<option value="${m.id}" ${c.moderator_id == m.id ? 'selected' : ''}>${esc(m.name || m.email)}</option>`).join('')}</select>` : esc(c.moderator ? (c.moderator.name || c.moderator.email) : '—')}</td>
    </tr>`).join('') || `<tr><td colspan="7" class="muted">${t('no_objects')}</td></tr>`}</tbody></table>`;
  if (isCenter) $('#content').querySelectorAll('[data-modof]').forEach(sel => sel.onchange = async () => { await api('POST', '/admin/clients/' + sel.dataset.modof + '/moderator', { moderator_id: sel.value || null }); toast(t('recorded_word'), t('moderator_assigned')); });
}
async function centerTechs() {
  const { techs } = await api('GET', '/admin/techs');
  const role = state.user.role, isCenter = role === 'center';
  $('#content').innerHTML = `<h2 class="sec">${t('tab_specialists')}</h2><div class="grid">${techs.map(tc => `
    <div class="item"><div class="row"><h3>${esc(tc.name || tc.email)}</h3>
      <span class="pill problem">${esc(TRADE_BG[tc.profile && tc.profile.trade] || '—')}</span>
      <span class="pill locked">${t('rank_word')} ${(tc.profile && tc.profile.rank) || 1}</span>
      ${tc.approved ? `<span class="pill verified">${t('approved_pill')}</span>` : `<span class="pill open">${t('unapproved_pill')}</span>`}
      ${tc.flagged ? `<span class="pill emergency">${t('flagged_pill')}</span>` : ''}
      ${tc.profile && tc.profile.multi_volunteer ? `<span class="pill verified">${t('pill_multi')}</span>` : ''}
      <span class="right muted">#${tc.id}</span></div>
    <div class="meta">${esc(tc.email)} · ${t('tel_label')} ${esc(tc.phone || '—')} · ${t('contracts_count_label')}: ${tc.contracts} · ${t('visits_count_label')}: ${tc.visits || 0}</div>
    <div class="meta">${t('fee_per_visit_label')}: <b>${tc.effective_fee || 0} ${t('currency')}</b>${tc.custom_fee ? ' ' + t('individual_paren') : ' ' + t('by_rank_paren')}</div>
    <div class="row" style="margin-top:8px">
      ${isCenter && !tc.approved ? `<button class="p sm" data-appruser="${tc.id}">${t('approve')}</button>` : ''}
      ${isCenter ? `<button class="sm" data-rank="${tc.id}">${t('btn_rank')}</button> <button class="sm" data-fee="${tc.id}">${t('btn_fee')}</button>` : ''}
      ${(role === 'admin' || role === 'moderator') ? `<button class="sm" data-feereq="${tc.id}">${t('btn_fee_request')}</button>` : ''}
      ${(role === 'center' || role === 'admin') ? `<button class="sm" data-multi="${tc.id}" data-allow="${tc.profile && tc.profile.multi_volunteer ? 0 : 1}">${tc.profile && tc.profile.multi_volunteer ? t('btn_multi_off') : t('btn_multi_on')}</button>` : ''}
      <button class="sm ghost" data-flaguser="${tc.id}" data-fv="${tc.flagged ? 0 : 1}">${tc.flagged ? t('btn_unflag') : t('btn_flag_problematic')}</button>
    </div></div>`).join('') || `<p class="muted">${t('no_specialists2')}</p>`}</div>`;
  wireTechActions(centerTechs);
}
function wireTechActions(reload) {
  const c = $('#content');
  c.querySelectorAll('[data-appruser]').forEach(b => b.onclick = async () => { await api('POST', '/admin/users/' + b.dataset.appruser + '/approve', { approved: true }); toast(t('approved_masc_word')); reload(); });
  c.querySelectorAll('[data-flaguser]').forEach(b => b.onclick = async () => { try { await api('POST', '/admin/users/' + b.dataset.flaguser + '/flag', { flagged: b.dataset.fv === '1' }); } catch (e) { toast(t('error'), e.message, 'emerg'); } reload(); });
  c.querySelectorAll('[data-rank]').forEach(b => b.onclick = async () => { const v = prompt(t('prompt_rank')); if (v === null) return; try { await api('POST', '/admin/users/' + b.dataset.rank + '/rank', { rank: parseInt(v) || 1, reset_fee: /r/i.test(v) }); toast(t('recorded_word')); } catch (e) { toast(t('error'), e.message, 'emerg'); } reload(); });
  c.querySelectorAll('[data-fee]').forEach(b => b.onclick = async () => { const v = prompt(t('prompt_fee')); if (v === null) return; await api('POST', '/admin/users/' + b.dataset.fee + '/visit-fee', { fee: parseFloat(v) || 0 }); toast(t('recorded_word')); reload(); });
  c.querySelectorAll('[data-feereq]').forEach(b => b.onclick = () => feeReqModal(b.dataset.feereq));
  c.querySelectorAll('[data-multi]').forEach(b => b.onclick = async () => { try { await api('POST', '/admin/users/' + b.dataset.multi + '/volunteer-override', { allow: b.dataset.allow === '1' }); toast(t('recorded_word')); } catch (e) { toast(t('error'), e.message, 'emerg'); } reload(); });
}
function feeReqModal(techId) {
  modal(t('modal_fee_request'), `<label>${t('f_proposed_amount')}</label><input id="amt" type="number"><label>${t('f_reason')}</label><input id="rsn"><div class="spacer"></div><button class="p" id="s" style="width:100%">${t('btn_send_to_center')}</button>`, (m, close) => {
    m.querySelector('#s').onclick = async () => { try { await api('POST', '/fee-requests', { tech_id: techId, amount: m.querySelector('#amt').value, reason: m.querySelector('#rsn').value }); close(); toast(t('sent_word'), t('fee_request_sent')); } catch (e) { toast(t('error'), e.message, 'emerg'); } };
  });
}
async function modTechs() {
  const { techs } = await api('GET', '/mod/techs');
  $('#content').innerHTML = `<h2 class="sec">${t('tab_specialists')}</h2><div class="grid">${techs.map(tc => `
    <div class="item"><div class="row"><h3>${esc(tc.name || tc.email)}</h3>
      <span class="pill problem">${esc(TRADE_BG[tc.trade] || '—')}</span>
      <span class="pill locked">${t('rank_word')} ${tc.rank || 1}</span>
      ${tc.approved ? `<span class="pill verified">${t('approved_pill')}</span>` : `<span class="pill open">${t('unapproved_pill')}</span>`}
      <span class="right muted">#${tc.id}</span></div>
    <div class="meta">${t('fee_per_visit_label')}: <b>${tc.effective_fee || 0} ${t('currency')}</b>${tc.custom_fee ? ' ' + t('individual_paren') : ' ' + t('by_rank_paren')}</div>
    <div class="row" style="margin-top:8px"><button class="sm" data-feereq="${tc.id}">${t('modal_fee_request')}</button></div>
    </div>`).join('') || `<p class="muted">${t('no_specialists2')}</p>`}</div>`;
  wireTechActions(modTechs);
}
async function requestsTab() {
  const { requests } = await api('GET', '/fee-requests');
  const isCenter = state.user.role === 'center';
  $('#content').innerHTML = `<h2 class="sec">${t('requests_title')}</h2>
    <table class="tbl"><thead><tr><th>#</th><th>${t('th_specialist')}</th><th>${t('th_amount')}</th><th>${t('th_reason')}</th><th>${t('th_from')}</th><th>${t('th_status')}</th>${isCenter ? '<th></th>' : ''}</tr></thead><tbody>
    ${requests.map(q => `<tr><td>${q.id}</td><td>${esc(q.tech_name || '')}</td><td>${q.amount} ${t('currency')}</td><td>${esc(q.reason || '')}</td><td>${esc(q.requester || '')} (${ROLE_BG[q.requester_role] || ''})</td>
      <td>${q.status === 'pending' ? `<span class="pill open">${t('waiting_pill')}</span>` : (q.status === 'approved' ? `<span class="pill verified">${t('approved_fem_pill')}</span>` : `<span class="pill emergency">${t('rejected_fem_pill')}</span>`)}</td>
      ${isCenter ? `<td>${q.status === 'pending' ? `<button class="p sm" data-appr="${q.id}">${t('approve')}</button> <button class="sm ghost" data-rej="${q.id}">${t('reject')}</button>` : ''}</td>` : ''}
    </tr>`).join('') || `<tr><td colspan="7" class="muted">${t('no_requests')}</td></tr>`}</tbody></table>`;
  if (isCenter) {
    $('#content').querySelectorAll('[data-appr]').forEach(b => b.onclick = async () => { await api('POST', '/fee-requests/' + b.dataset.appr + '/approve'); toast(t('approved_fem_word')); requestsTab(); });
    $('#content').querySelectorAll('[data-rej]').forEach(b => b.onclick = async () => { await api('POST', '/fee-requests/' + b.dataset.rej + '/reject'); toast(t('rejected_fem_word')); requestsTab(); });
  }
}
async function signalsTab(type, ctx) {
  const { signals } = await api('GET', type ? '/signals?type=' + type : '/signals');
  const title = type ? (type === 'emergency' ? t('emergency_signals_title') : t('problem_signals_title')) : t('my_objects_signals_title');
  $('#content').innerHTML = `<h2 class="sec">${title}</h2><div class="grid">${signals.map(s => signalCard(s, ctx)).join('') || `<p class="muted">${t('no_signals')}</p>`}</div>`;
  wireSignalActions();
}
async function centerPayments(kind) {
  const { payments } = await api('GET', '/payments?kind=' + kind);
  $('#content').innerHTML = `<h2 class="sec">${kind === 'monthly' ? t('tab_pay_monthly') : t('extra_payments_title')}</h2>
    <table class="tbl"><thead><tr><th>#</th><th>${t('th_owner')}</th><th>${t('th_period')}</th><th>QR</th><th>${t('th_proof')}</th><th>${t('th_status')}</th><th>${t('th_action')}</th></tr></thead><tbody>
    ${payments.map(p => `<tr>
      <td>${p.id}</td><td>${esc(p.owner_name || '')}</td><td>${esc(p.period || '—')}</td>
      <td>${p.locked ? ('№' + (p.qr_slot || '—')) : `<select data-slot="${p.id}"><option value="">—</option>${[1, 2, 3].map(s => `<option value="${s}" ${p.qr_slot == s ? 'selected' : ''}>№${s}</option>`).join('')}</select>`}</td>
      <td>${p.proof_path ? '<a href="' + fileUrl(p.proof_path) + '" target="_blank">📎</a>' : '—'}</td>
      <td>${p.verified ? `<span class="pill verified">${t('verified_pill')}</span>` : `<span class="pill open">${t('no_word')}</span>`}${p.locked ? ' <span class="pill locked">🔒</span>' : ''}</td>
      <td>${p.locked ? `<span class="muted">${t('locked_word')}</span>` : `<button class="p sm" data-verify="${p.id}">${t('btn_verify')}</button>`}</td>
    </tr>`).join('') || `<tr><td colspan="7" class="muted">${t('no_payments')}</td></tr>`}</tbody></table>`;
  $('#content').querySelectorAll('[data-slot]').forEach(sel => sel.onchange = async () => { try { await api('PUT', '/payments/' + sel.dataset.slot + '/method', { qr_slot: sel.value }); toast(t('qr_method_changed')); } catch (e) { toast(t('error'), e.message, 'emerg'); } });
  $('#content').querySelectorAll('[data-verify]').forEach(b => b.onclick = async () => { const sel = $('#content').querySelector('[data-slot="' + b.dataset.verify + '"]'); try { await api('POST', '/payments/' + b.dataset.verify + '/verify', { qr_slot: sel ? sel.value : null }); toast(t('verified_word'), t('payment_locked')); centerPayments(kind); } catch (e) { toast(t('error'), e.message, 'emerg'); } });
}
async function centerQR() {
  const { qrcodes } = await api('GET', '/qrcodes');
  const bySlot = s => qrcodes.find(q => q.slot === s);
  $('#content').innerHTML = `<h2 class="sec">${t('qr_title')}</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    ${[1, 2, 3].map(s => { const q = bySlot(s); return `<div class="item qrbox"><h3>${t('slot_no')}${s}</h3>
      ${q && q.image_path ? `<img src="${qrImg(s)}"><div class="muted">${esc(q.label || '')} ${q.active ? '' : t('hidden_paren')}</div>` : `<p class="muted">${t('empty_word')}</p>`}
      <div class="spacer"></div><input type="file" data-qf="${s}" accept="image/*"><input placeholder="${t('ph_label')}" data-ql="${s}" value="${esc(q ? q.label || '' : '')}" style="margin-top:6px">
      <div class="spacer"></div><button class="p sm" data-qs="${s}">${t('btn_save_slot')} ${s}</button> ${q ? `<button class="sm ghost" data-qd="${s}">${t('btn_hide')}</button>` : ''}</div>`; }).join('')}</div>`;
  $('#content').querySelectorAll('[data-qs]').forEach(b => b.onclick = async () => { const s = b.dataset.qs; const fd = new FormData(); const f = $('#content').querySelector('[data-qf="' + s + '"]').files[0]; if (f) fd.append('image', f); fd.append('label', $('#content').querySelector('[data-ql="' + s + '"]').value); fd.append('active', '1'); await api('POST', '/qrcodes/' + s, fd, true); toast(t('saved'), t('qr_slot_word') + ' ' + s); centerQR(); });
  $('#content').querySelectorAll('[data-qd]').forEach(b => b.onclick = async () => { await api('DELETE', '/qrcodes/' + b.dataset.qd); centerQR(); });
}
async function centerSettings() {
  const s = state.settings || (await api('GET', '/settings')).settings;
  $('#content').innerHTML = `<h2 class="sec">${t('settings_title')}</h2>
    <div class="item"><p class="muted">${t('settings_note')}</p>
    <div class="row"><b style="width:120px">${t('emergency_colon')}</b> <span class="muted">${esc(s.emergency_sound)}</span> <button class="sm" id="playE">${t('btn_listen')}</button></div>
    <div class="spacer"></div>
    <div class="row"><b style="width:120px">${t('problem_colon')}</b> <span class="muted">${esc(s.problem_sound)}</span> <button class="sm" id="playP">${t('btn_listen')}</button></div>
    </div>`;
  $('#playE').onclick = () => playSound('emergency');
  $('#playP').onclick = () => playSound('problem');
}

/* ===================== ПРИХОДИ / ИЗПЪЛНИТЕЛ ===================== */
async function techEarnings() {
  const e = await api('GET', '/my-earnings');
  $('#content').innerHTML = `<h2 class="sec">${t('my_earnings_title')}</h2>${techBanner()}
    <div class="item"><p class="muted">${t('earnings_note_tech')}</p>
    <div class="row"><b style="width:260px">${t('my_group_label')}</b> <span class="pill problem">${TRADE_BG[e.group] || '—'}</span> <span class="pill locked">${t('rank_word')} ${e.rank || 1}</span></div><div class="spacer"></div>
    <div class="row"><b style="width:260px">${t('fee_per_visit_label2')}</b> <span class="pill locked">${(e.visit_fee || 0).toFixed(2)} ${t('currency')}</span></div><div class="spacer"></div>
    <div class="row"><b style="width:260px">${t('this_month_label')}</b> ${e.month} ${t('visits_word')} · <span class="pill verified">${(e.month_total || 0).toFixed(2)} ${t('currency')}</span></div><div class="spacer"></div>
    <div class="row"><b style="width:260px">${t('total_all_label')}</b> ${e.visits} ${t('visits_word')} · <span class="pill verified">${(e.total || 0).toFixed(2)} ${t('currency')}</span></div>
    <div class="meta" style="margin-top:8px">${t('group_fee_note')}</div></div>`;
}

/* ===================== МОДЕРАТОР ===================== */
async function modClients() {
  const { clients } = await api('GET', '/mod/clients');
  $('#content').innerHTML = `<h2 class="sec">${t('tab_my_objects')}</h2>
    <div class="row"><button class="p" id="addO">${t('btn_new_object')}</button></div><div class="spacer"></div>
    <table class="tbl"><thead><tr><th>ID</th><th>${t('th_name')}</th><th>${t('th_email')}</th><th>${t('th_properties')}</th><th>${t('th_contract')}</th><th>${t('th_paid_month')}</th><th>${t('th_my_share')}</th></tr></thead><tbody>
    ${clients.map(c => `<tr><td>${c.id}</td><td>${esc(c.username || c.name || '')}</td><td>${esc(c.email)}</td><td>${c.properties}</td>
      <td>${c.approved ? `<span class="pill verified">${t('yes_word')}</span>` : `<span class="pill open">${t('no_word')}</span>`}</td>
      <td>${c.paid_month ? `<span class="pill verified">${t('yes_word')}</span>` : `<span class="pill open">${t('no_word')}</span>`}</td>
      <td>${(c.my_share || 0).toFixed(2)}</td></tr>`).join('') || `<tr><td colspan="7" class="muted">${t('no_objects_add')}</td></tr>`}</tbody></table>`;
  $('#addO').onclick = () => modNewOwner();
}
function modNewOwner() {
  modal(t('modal_new_object'), `<label>${t('f_email')}</label><input id="e"><label>${t('f_username')}</label><input id="u"><label>${t('f_phone')}</label><input id="ph"><label>${t('f_initial_password')}</label><input id="pw"><div class="spacer"></div><button class="p" id="s" style="width:100%">${t('create')}</button>`, (m, close) => {
    m.querySelector('#s').onclick = async () => { try { await api('POST', '/mod/clients', { email: m.querySelector('#e').value, username: m.querySelector('#u').value, phone: m.querySelector('#ph').value, password: m.querySelector('#pw').value }); close(); toast(t('created_word'), t('owner_login_note')); modClients(); } catch (err) { toast(t('error'), err.message, 'emerg'); } };
  });
}
async function modEarnings() {
  const e = await api('GET', '/mod/earnings');
  $('#content').innerHTML = `<h2 class="sec">${t('tab_earn3')}</h2>
    <div class="item"><p class="muted">${t('earnings_note_mod')}</p>
    <div class="row"><b style="width:240px">${t('this_month_label')}</b> <span class="pill verified">${e.month.toFixed(2)} ${t('currency')}</span></div><div class="spacer"></div>
    <div class="row"><b style="width:240px">${t('total_all_months')}</b> <span class="pill locked">${e.total.toFixed(2)} ${t('currency')}</span></div>
    <div class="meta" style="margin-top:8px">${t('verified_payments_count')} ${e.count}</div></div>`;
}

/* ===================== СМЕТКИ (център + админ) ===================== */
async function accountingTab() {
  const e = await api('GET', '/admin/earnings');
  const { rank_fees } = await api('GET', '/admin/rank-fees');
  const row = (l, v, cls) => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><b style="width:320px">${l}</b> <span class="pill ${cls}">${v.toFixed(2)} ${t('currency')}</span></div>`;
  $('#content').innerHTML = `<h2 class="sec">${t('accounting_title')}</h2>
    <div class="item"><p class="muted">${t('accounting_note')}</p>
      ${row(t('total_collected_monthly'), e.total_monthly, 'locked')}
      ${row(t('admin_share_label'), e.admin_share, 'verified')}
      ${row(t('moderators_share_label'), e.moderators_share, 'verified')}
      ${row(t('executors_label'), e.executors_total, 'verified')}
      ${row(t('operator_label'), e.operator_share, 'locked')}
    </div>
    <div class="spacer"></div>
    <div class="item"><h3>${t('rank_fee_title')}</h3>
      <table class="tbl"><thead><tr><th>${t('th_rank')}</th><th>${t('th_amount')}</th></tr></thead><tbody>${[1, 2, 3, 4, 5].map(n => `<tr><td>${n}</td><td>${rank_fees[n]} ${t('currency')}</td></tr>`).join('')}</tbody></table>
      <p class="muted" style="margin-top:8px">${t('accounting_footer')}</p>
    </div>`;
}

/* ===================== ЕКИП (модератори/админи) ===================== */
async function staffTab() {
  const { staff } = await api('GET', '/admin/staff');
  const isCenter = state.user.role === 'center';
  $('#content').innerHTML = `<h2 class="sec">${t('staff_title')}</h2>
    ${isCenter ? `<div class="row"><button class="p" id="addS">${t('btn_new_staff')}</button></div><div class="spacer"></div>` : ''}
    <table class="tbl"><thead><tr><th>ID</th><th>${t('th_role')}</th><th>${t('th_name')}</th><th>${t('th_email')}</th><th>${t('th_objects')}</th></tr></thead><tbody>
    ${staff.map(s => `<tr><td>${s.id}</td><td>${ROLE_BG[s.role]}</td><td>${esc(s.name || '')}</td><td>${esc(s.email)}</td><td>${s.role === 'moderator' ? (s.owners || 0) : '—'}</td></tr>`).join('') || `<tr><td colspan="5" class="muted">${t('none_word')}</td></tr>`}</tbody></table>`;
  if (isCenter) $('#addS').onclick = () => newStaff();
}
function newStaff() {
  modal(t('modal_new_staff'), `<label>${t('f_role')}</label><select id="r"><option value="moderator">${t('opt_moderator')}</option><option value="admin">${t('opt_admin')}</option></select><label>${t('f_names')}</label><input id="n"><label>${t('f_email')}</label><input id="e"><label>${t('f_password')}</label><input id="pw"><div class="spacer"></div><button class="p" id="s" style="width:100%">${t('create')}</button>`, (m, close) => {
    m.querySelector('#s').onclick = async () => { try { await api('POST', '/admin/staff', { role: m.querySelector('#r').value, name: m.querySelector('#n').value, email: m.querySelector('#e').value, password: m.querySelector('#pw').value }); close(); toast(t('created_word')); staffTab(); } catch (err) { toast(t('error'), err.message, 'emerg'); } };
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
    const ws = new WebSocket(proto + '://' + location.host + BASE + '/ws?token=' + encodeURIComponent(state.token));
    state.ws = ws;
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'new-signal') { playSound(m.sound); toast(m.sound === 'emergency' ? t('ws_emergency') : t('ws_problem'), (m.signal.address || '') + ' · ' + t('tel_label') + ' ' + (m.signal.owner_phone || '—'), m.sound === 'emergency' ? 'emerg' : 'prob'); refreshIfRelevant(); }
      else if (m.type === 'signal-assigned') { playSound(m.sound); toast(t('ws_assigned'), m.signal.address || '', m.sound === 'emergency' ? 'emerg' : 'prob'); refreshIfRelevant(); }
      else if (m.type === 'signal-accepted') { toast(t('ws_accepted'), m.signal.tech_name ? t('tech_prefix') + ' ' + m.signal.tech_name : ''); refreshIfRelevant(); }
      else if (m.type === 'signal-declined') { toast(t('ws_declined'), t('ws_declined_body')); refreshIfRelevant(); }
      else if (m.type === 'signal-resolved') { toast(t('ws_resolved'), ''); refreshIfRelevant(); }
      else if (m.type === 'new-payment') { toast(t('ws_new_payment'), m.payment.owner_name || ''); refreshIfRelevant(); }
      else if (m.type === 'payment-verified') { toast(t('ws_payment_verified'), ''); refreshIfRelevant(); }
      else if (m.type === 'cost-request') { toast(t('ws_cost_request'), (m.signal && m.signal.cost_total || '') + ' ' + t('currency')); refreshIfRelevant(); }
      else if (m.type && m.type.indexOf('cost-') === 0) { toast(t('ws_cost_updated'), ''); refreshIfRelevant(); }
    };
    ws.onclose = () => { setTimeout(() => { if (state.token) connectWS(); }, 3000); };
  } catch {}
}
function refreshIfRelevant() { const tb = state.tab; if (['signals', 'feed', 'mine', 'emergency', 'problem', 'payments', 'pay_monthly', 'pay_extra', 'msignals', 'aemergency', 'aproblem'].includes(tb)) reloadTab(); }

// прерисуване при смяна на език
window.__onLangChange = () => { if (state.token && state.user) renderApp(); else renderAuth(); };

boot();
