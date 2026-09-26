// Version: 1.0002
// tools/tools.js — 🧰 Инструменти за собственика на автомобил. НАПЪЛНО ОФЛАЙН:
// без мрежа, без микрофон, без разрешения. Три инструмента, всеки смятан изцяло на
// устройството, с данни в localStorage:
//   1) Дневник за поддръжка  2) Справочник OBD-II кодове  3) Калкулатори за автомобил
// Модулът е самостоятелен — main.js само го закача в новия таб „Инструменти".
// Всички видими надписи минават през T() (i18n-diag) на 15-те езика — без твърдо зашит текст.
import { esc, copyText } from '../core/ui.js';
import { liteRequire, liteLocked } from '../core/lite-gate.js';
import { T } from '../diag/i18n-diag.js';

const LOG_KEY = 'asd.tools.maintlog.v1';
const OIL_KEY = 'asd.tools.oil.v1';
const SUBTAB_KEY = 'asd.tools.subtab';

// ---------- localStorage помощници (безопасни) ----------
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (_) { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
}

// ---------- Вграден офлайн справочник за OBD-II кодове ----------
// [код, ключ за описание в i18n-diag] — описанието се превежда динамично с T().
const OBD_CODES = [
  ['P0100', 'asl_obd_P0100'],
  ['P0101', 'asl_obd_P0101'],
  ['P0113', 'asl_obd_P0113'],
  ['P0128', 'asl_obd_P0128'],
  ['P0131', 'asl_obd_P0131'],
  ['P0133', 'asl_obd_P0133'],
  ['P0171', 'asl_obd_P0171'],
  ['P0172', 'asl_obd_P0172'],
  ['P0174', 'asl_obd_P0174'],
  ['P0201', 'asl_obd_P0201'],
  ['P0300', 'asl_obd_P0300'],
  ['P0301', 'asl_obd_P0301'],
  ['P0302', 'asl_obd_P0302'],
  ['P0303', 'asl_obd_P0303'],
  ['P0304', 'asl_obd_P0304'],
  ['P0325', 'asl_obd_P0325'],
  ['P0335', 'asl_obd_P0335'],
  ['P0340', 'asl_obd_P0340'],
  ['P0401', 'asl_obd_P0401'],
  ['P0420', 'asl_obd_P0420'],
  ['P0430', 'asl_obd_P0430'],
  ['P0442', 'asl_obd_P0442'],
  ['P0455', 'asl_obd_P0455'],
  ['P0500', 'asl_obd_P0500'],
  ['P0505', 'asl_obd_P0505'],
  ['P0562', 'asl_obd_P0562'],
  ['P0700', 'asl_obd_P0700'],
  ['P0715', 'asl_obd_P0715'],
];

// ---------- Форматиране ----------
function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }
function todayISO() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Кратки локализирани единици.
function uKm() { return T('asl_u_km'); }
function uL() { return T('asl_u_l'); }
function uMoney() { return T('asl_u_money'); }

// ==========================================================================
// 1) Дневник за поддръжка
// ==========================================================================
function renderMaintLog(root) {
  const entries = load(LOG_KEY, []);
  const total = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const rows = entries
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((e) => `
      <div class="tool-card" style="padding:12px 14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="min-width:0">
            <div style="font-weight:700">${esc(e.type || '—')}</div>
            <div class="hint" style="margin-top:2px">🗓️ ${esc(e.date || '—')} · 🛣️ ${esc(e.km || '—')} ${esc(uKm())}</div>
            ${e.note ? `<div style="margin-top:6px;font-size:.9em">📝 ${esc(e.note)}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-weight:700;color:var(--accent-2)">${esc(money(Number(e.cost) || 0))} ${esc(uMoney())}</div>
            <button class="btn sec inline" data-del="${esc(e.id)}" style="margin-top:8px;padding:6px 12px;font-size:.85em">🗑️ ${esc(T('asl_del'))}</button>
          </div>
        </div>
      </div>`)
    .join('');

  root.innerHTML = `
    <div class="tool-card">
      <label>🗓️ ${esc(T('asl_date'))}</label>
      <input type="date" id="m_date" value="${esc(todayISO())}">
      <div class="row">
        <div>
          <label>🛣️ ${esc(T('asl_km_label'))}</label>
          <input type="number" id="m_km" inputmode="numeric" placeholder="${esc(T('asl_eg') + ' 145000')}">
        </div>
        <div>
          <label>💰 ${esc(T('asl_cost'))} (${esc(uMoney())})</label>
          <input type="number" id="m_cost" inputmode="decimal" placeholder="${esc(T('asl_eg') + ' 120')}">
        </div>
      </div>
      <label>🔧 ${esc(T('asl_service_type'))}</label>
      <input type="text" id="m_type" placeholder="${esc(T('asl_eg') + ' ' + T('asl_srv_oil'))}" list="m_types">
      <datalist id="m_types">
        <option value="${esc(T('asl_srv_oil'))}"></option>
        <option value="${esc(T('asl_srv_front_pads'))}"></option>
        <option value="${esc(T('asl_srv_rear_pads'))}"></option>
        <option value="${esc(T('asl_srv_inspection'))}"></option>
        <option value="${esc(T('asl_srv_coolant'))}"></option>
        <option value="${esc(T('asl_srv_tyres'))}"></option>
        <option value="${esc(T('asl_srv_chassis'))}"></option>
        <option value="${esc(T('asl_srv_battery'))}"></option>
      </datalist>
      <label>📝 ${esc(T('asl_note'))}</label>
      <input type="text" id="m_note" placeholder="${esc(T('asl_ph_note'))}">
      <button class="btn" id="m_add">➕ ${esc(T('asl_add_entry'))}</button>
      <div id="m_err" class="status"></div>
    </div>

    <div class="out-block">
      <div class="line"><span>${esc(T('asl_total_entries'))}</span><span>${entries.length}</span></div>
      <div class="line"><span>${esc(T('asl_total_spent'))}</span><span>${esc(money(total))} ${esc(uMoney())}</span></div>
    </div>

    <div class="row" style="margin-top:12px">
      <button class="btn sec inline" id="m_copy" style="margin-top:0">📋 ${esc(T('asl_copy_log'))}</button>
    </div>

    <div style="margin-top:16px">
      ${rows || `<div class="empty">${esc(T('asl_no_entries'))} 🚗</div>`}
    </div>`;

  const err = root.querySelector('#m_err');
  // Lite: запазването на записи в дневника е само в пълната версия.
  root.querySelector('#m_add').addEventListener('click', () => liteRequire('savelog', () => {
    const date = root.querySelector('#m_date').value || todayISO();
    const km = root.querySelector('#m_km').value.trim();
    const cost = root.querySelector('#m_cost').value.trim();
    const type = root.querySelector('#m_type').value.trim();
    const note = root.querySelector('#m_note').value.trim();
    if (!type) {
      err.className = 'status show err';
      err.textContent = T('asl_err_need_type');
      return;
    }
    const list = load(LOG_KEY, []);
    list.push({ id: 'e' + Date.now() + Math.random().toString(36).slice(2, 6), date, km, type, note, cost });
    save(LOG_KEY, list);
    renderMaintLog(root);
  }));

  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    const id = b.getAttribute('data-del');
    const list = load(LOG_KEY, []).filter((e) => e.id !== id);
    save(LOG_KEY, list);
    renderMaintLog(root);
  }));

  const copyBtn = root.querySelector('#m_copy');
  copyBtn.addEventListener('click', async () => {
    const list = load(LOG_KEY, []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!list.length) { err.className = 'status show err'; err.textContent = T('asl_nothing_copy'); return; }
    let txt = T('asl_log_header') + '\n====================\n';
    for (const e of list) {
      txt += `${e.date} | ${e.km || '?'} ${uKm()} | ${e.type} | ${money(Number(e.cost) || 0)} ${uMoney()}`;
      if (e.note) txt += ` | ${e.note}`;
      txt += '\n';
    }
    txt += `--------------------\n${T('asl_total_caps')}: ${money(total)} ${uMoney()} (${list.length} ${T('asl_entries_word')})\n`;
    const ok = await copyText(txt);
    err.className = 'status show ' + (ok ? 'ok' : 'err');
    err.textContent = ok ? (T('asl_copied_ok') + ' ✅') : T('asl_copy_fail');
  });
}

// ==========================================================================
// 2) Справочник OBD-II кодове
// ==========================================================================
function renderObd(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>🔎 ${esc(T('asl_obd_search'))}</label>
      <input type="text" id="obd_q" placeholder="${esc(T('asl_ph_obd'))}" autocomplete="off">
      <div class="hint">${esc(T('asl_obd_hint').replace('{0}', OBD_CODES.length))}</div>
    </div>
    <div id="obd_list"></div>`;

  const listEl = root.querySelector('#obd_list');
  const draw = (q) => {
    const query = (q || '').trim().toLowerCase();
    const rows = OBD_CODES
      .map(([code, key]) => [code, T(key)])
      .filter(([code, desc]) =>
        !query || code.toLowerCase().includes(query) || desc.toLowerCase().includes(query));
    if (!rows.length) {
      listEl.innerHTML = `<div class="empty">${esc(T('asl_obd_nomatch'))} 🔧</div>`;
      return;
    }
    listEl.innerHTML = rows.map(([code, desc]) => `
      <div class="tool-card" style="padding:12px 14px;margin-bottom:10px">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <div style="font-family:ui-monospace,monospace;font-weight:700;color:var(--accent-2);flex-shrink:0">${esc(code)}</div>
          <div style="font-size:.92em">${esc(desc)}</div>
        </div>
      </div>`).join('');
  };
  draw('');
  root.querySelector('#obd_q').addEventListener('input', (e) => draw(e.target.value));
}

// ==========================================================================
// 3) Калкулатори за автомобил
// ==========================================================================
function renderCalc(root) {
  const oil = load(OIL_KEY, { cur: '', interval: '10000' });
  root.innerHTML = `
    <div class="tool-card">
      <div style="font-weight:700;margin-bottom:6px">⛽ ${esc(T('asl_fuel_use'))}</div>
      <div class="row">
        <div>
          <label>${esc(T('asl_fuel_used'))} (${esc(uL())})</label>
          <input type="number" id="f_l" inputmode="decimal" placeholder="${esc(T('asl_eg') + ' 42')}">
        </div>
        <div>
          <label>${esc(T('asl_distance_traveled'))} (${esc(uKm())})</label>
          <input type="number" id="f_km" inputmode="decimal" placeholder="${esc(T('asl_eg') + ' 560')}">
        </div>
      </div>
      <button class="btn" id="f_go">${esc(T('asl_calc_consumption'))}</button>
      <div id="f_out" class="out-block" hidden></div>
    </div>

    <div class="tool-card">
      <div style="font-weight:700;margin-bottom:6px">🛣️ ${esc(T('asl_trip_cost'))}</div>
      <div class="row">
        <div>
          <label>${esc(T('asl_distance'))} (${esc(uKm())})</label>
          <input type="number" id="t_km" inputmode="decimal" placeholder="${esc(T('asl_eg') + ' 300')}">
        </div>
        <div>
          <label>${esc(T('asl_consumption'))} (${esc(T('asl_u_l100'))})</label>
          <input type="number" id="t_cons" inputmode="decimal" placeholder="${esc(T('asl_eg') + ' 7.5')}">
        </div>
      </div>
      <label>${esc(T('asl_fuel_price'))} (${esc(uMoney())}/${esc(uL())})</label>
      <input type="number" id="t_price" inputmode="decimal" placeholder="${esc(T('asl_eg') + ' 2.60')}">
      <button class="btn" id="t_go">${esc(T('asl_calc_cost'))}</button>
      <div id="t_out" class="out-block" hidden></div>
    </div>

    <div class="tool-card">
      <div style="font-weight:700;margin-bottom:6px">🛢️ ${esc(T('asl_oil_reminder'))}</div>
      <div class="row">
        <div>
          <label>${esc(T('asl_current_km'))}</label>
          <input type="number" id="o_cur" inputmode="numeric" placeholder="${esc(T('asl_eg') + ' 145000')}" value="${esc(oil.cur)}">
        </div>
        <div>
          <label>${esc(T('asl_interval'))} (${esc(uKm())})</label>
          <input type="number" id="o_int" inputmode="numeric" placeholder="${esc(T('asl_eg') + ' 10000')}" value="${esc(oil.interval)}">
        </div>
      </div>
      <button class="btn" id="o_go">${esc(T('asl_calc_next'))}</button>
      <div id="o_out" class="out-block" hidden></div>
    </div>`;

  // Разход на гориво
  root.querySelector('#f_go').addEventListener('click', () => {
    const l = parseFloat(root.querySelector('#f_l').value);
    const km = parseFloat(root.querySelector('#f_km').value);
    const out = root.querySelector('#f_out');
    if (!(l > 0) || !(km > 0)) { out.hidden = false; out.innerHTML = `<div class="line"><span>${esc(T('asl_err_fuel_km'))}</span><span>⚠️</span></div>`; return; }
    const per100 = (l / km) * 100;
    out.hidden = false;
    out.innerHTML = `
      <div class="line"><span>${esc(T('asl_distance_traveled'))}</span><span>${esc(money(km))} ${esc(uKm())}</span></div>
      <div class="line"><span>${esc(T('asl_used'))}</span><span>${esc(money(l))} ${esc(uL())}</span></div>
      <div class="line"><span>${esc(T('asl_avg_consumption'))}</span><span>${esc(money(per100))} ${esc(T('asl_u_l100'))}</span></div>`;
  });

  // Стойност на пътуване
  root.querySelector('#t_go').addEventListener('click', () => {
    const km = parseFloat(root.querySelector('#t_km').value);
    const cons = parseFloat(root.querySelector('#t_cons').value);
    const price = parseFloat(root.querySelector('#t_price').value);
    const out = root.querySelector('#t_out');
    if (!(km > 0) || !(cons > 0) || !(price > 0)) { out.hidden = false; out.innerHTML = `<div class="line"><span>${esc(T('asl_err_trip'))}</span><span>⚠️</span></div>`; return; }
    const litres = (km / 100) * cons;
    const cost = litres * price;
    out.hidden = false;
    out.innerHTML = `
      <div class="line"><span>${esc(T('asl_fuel_needed'))}</span><span>${esc(money(litres))} ${esc(uL())}</span></div>
      <div class="line"><span>${esc(T('asl_price_per_l'))}</span><span>${esc(money(price))} ${esc(uMoney())}</span></div>
      <div class="line"><span>${esc(T('asl_total_cost'))}</span><span>${esc(money(cost))} ${esc(uMoney())}</span></div>`;
  });

  // Смяна на масло
  root.querySelector('#o_go').addEventListener('click', () => {
    const cur = parseFloat(root.querySelector('#o_cur').value);
    const interval = parseFloat(root.querySelector('#o_int').value);
    const out = root.querySelector('#o_out');
    if (!(cur >= 0) || !(interval > 0)) { out.hidden = false; out.innerHTML = `<div class="line"><span>${esc(T('asl_err_oil'))}</span><span>⚠️</span></div>`; return; }
    save(OIL_KEY, { cur: String(cur), interval: String(interval) });
    const next = cur + interval;
    out.hidden = false;
    out.innerHTML = `
      <div class="line"><span>${esc(T('asl_current_km'))}</span><span>${esc(money(cur))} ${esc(uKm())}</span></div>
      <div class="line"><span>${esc(T('asl_interval'))}</span><span>${esc(money(interval))} ${esc(uKm())}</span></div>
      <div class="line"><span>${esc(T('asl_next_change_at'))}</span><span>${esc(money(next))} ${esc(uKm())}</span></div>`;
  });
}

// ==========================================================================
// Изглед „Инструменти" с под-табове
// ==========================================================================
const SUBTABS = [
  ['log', () => '📒 ' + T('asl_tab_log'), renderMaintLog],
  ['obd', () => '🔍 OBD-II', renderObd],
  ['calc', () => '🧮 ' + T('asl_tab_calc'), renderCalc],
];

export function renderToolsView(container) {
  let active = 'log';
  try { const s = localStorage.getItem(SUBTAB_KEY); if (s && SUBTABS.some((t) => t[0] === s)) active = s; } catch (_) {}
  // Lite: калкулаторите са заключени — не отваряй директно запазен таб „calc".
  if (active === 'calc' && liteLocked('calc')) active = 'log';

  container.innerHTML = `
    <div class="hero" style="padding-bottom:10px"><h1>🧰 ${esc(T('nav_tools'))}</h1><p>${esc(T('asl_tools_sub'))}</p></div>
    <div class="tabs" id="tools_subtabs"></div>
    <div id="tools_body"></div>`;

  const tabsEl = container.querySelector('#tools_subtabs');
  const bodyEl = container.querySelector('#tools_body');

  const drawTabs = () => {
    tabsEl.innerHTML = SUBTABS.map(([id, label]) =>
      `<button class="tab${id === active ? ' active' : ''}" data-sub="${id}">${esc(label())}</button>`).join('');
    tabsEl.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => {
      const id = b.getAttribute('data-sub');
      const go = () => {
        active = id;
        try { localStorage.setItem(SUBTAB_KEY, active); } catch (_) {}
        drawTabs();
        drawBody();
      };
      // Lite: пълните калкулатори са само в платената версия.
      if (id === 'calc') { liteRequire('calc', go); return; }
      go();
    }));
  };
  const drawBody = () => {
    const found = SUBTABS.find((t) => t[0] === active) || SUBTABS[0];
    found[2](bodyEl);
  };
  drawTabs();
  drawBody();
}
