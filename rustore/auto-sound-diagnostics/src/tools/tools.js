// Version: 1.0001
// tools/tools.js — 🧰 Инструменти за собственика на автомобил. НАПЪЛНО ОФЛАЙН:
// без мрежа, без микрофон, без разрешения. Три инструмента, всеки смятан изцяло на
// устройството, с данни в localStorage:
//   1) Дневник за поддръжка  2) Справочник OBD-II кодове  3) Калкулатори за автомобил
// Модулът е самостоятелен — main.js само го закача в новия таб „Инструменти".
import { esc, copyText } from '../core/ui.js';

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
const OBD_CODES = [
  ['P0100', 'Неизправност във веригата на дебитомера за въздух (MAF)'],
  ['P0101', 'Дебитомерът за въздух (MAF) дава стойности извън обхвата'],
  ['P0113', 'Висок сигнал от датчика за температура на входящия въздух (IAT)'],
  ['P0128', 'Двигателят не достига работна температура — вероятно дефектен термостат'],
  ['P0131', 'Нисък сигнал от кислородния датчик (ламбда сонда), банка 1'],
  ['P0133', 'Бавен отклик на кислородния датчик (ламбда сонда), банка 1'],
  ['P0171', 'Прекалено бедна горивна смес, банка 1 (много въздух / малко гориво)'],
  ['P0172', 'Прекалено богата горивна смес, банка 1 (малко въздух / много гориво)'],
  ['P0174', 'Прекалено бедна горивна смес, банка 2'],
  ['P0201', 'Неизправност във веригата на инжектор — цилиндър 1'],
  ['P0300', 'Случайно прекъсване на запалването в няколко цилиндъра'],
  ['P0301', 'Прекъсване на запалването — цилиндър 1'],
  ['P0302', 'Прекъсване на запалването — цилиндър 2'],
  ['P0303', 'Прекъсване на запалването — цилиндър 3'],
  ['P0304', 'Прекъсване на запалването — цилиндър 4'],
  ['P0325', 'Неизправност във веригата на датчика за детонация (нок сензор)'],
  ['P0335', 'Неизправност на датчика за положение на коляновия вал (CKP)'],
  ['P0340', 'Неизправност на датчика за положение на разпределителния вал (CMP)'],
  ['P0401', 'Недостатъчен поток на рециркулация на отработени газове (EGR)'],
  ['P0420', 'Ниска ефективност на катализатора, банка 1'],
  ['P0430', 'Ниска ефективност на катализатора, банка 2'],
  ['P0442', 'Малък теч в системата за улавяне на бензинови пари (EVAP)'],
  ['P0455', 'Голям теч в системата за улавяне на бензинови пари (EVAP) — често хлабава капачка на резервоара'],
  ['P0500', 'Неизправност на датчика за скорост на автомобила (VSS)'],
  ['P0505', 'Неизправност в системата за управление на празния ход (RPM)'],
  ['P0562', 'Ниско напрежение в системата — вероятно слаб акумулатор или алтернатор'],
  ['P0700', 'Заявка за проверка на системата за управление на трансмисията'],
  ['P0715', 'Неизправност на датчика за обороти на входния вал на скоростите'],
];

// ---------- Форматиране ----------
function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }
function todayISO() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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
            <div class="hint" style="margin-top:2px">🗓️ ${esc(e.date || '—')} · 🛣️ ${esc(e.km || '—')} км</div>
            ${e.note ? `<div style="margin-top:6px;font-size:.9em">📝 ${esc(e.note)}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-weight:700;color:var(--accent-2)">${esc(money(Number(e.cost) || 0))} лв.</div>
            <button class="btn sec inline" data-del="${esc(e.id)}" style="margin-top:8px;padding:6px 12px;font-size:.85em">🗑️ Изтрий</button>
          </div>
        </div>
      </div>`)
    .join('');

  root.innerHTML = `
    <div class="tool-card">
      <label>🗓️ Дата</label>
      <input type="date" id="m_date" value="${esc(todayISO())}">
      <div class="row">
        <div>
          <label>🛣️ Километри</label>
          <input type="number" id="m_km" inputmode="numeric" placeholder="напр. 145000">
        </div>
        <div>
          <label>💰 Цена (лв.)</label>
          <input type="number" id="m_cost" inputmode="decimal" placeholder="напр. 120">
        </div>
      </div>
      <label>🔧 Тип обслужване</label>
      <input type="text" id="m_type" placeholder="напр. Смяна на масло и филтри" list="m_types">
      <datalist id="m_types">
        <option value="Смяна на масло и филтри"></option>
        <option value="Смяна на предни накладки"></option>
        <option value="Смяна на задни накладки"></option>
        <option value="Годишен технически преглед"></option>
        <option value="Смяна на антифриз"></option>
        <option value="Смяна на гуми"></option>
        <option value="Ремонт на ходова част"></option>
        <option value="Смяна на акумулатор"></option>
      </datalist>
      <label>📝 Бележка</label>
      <input type="text" id="m_note" placeholder="сервиз, части, гаранция…">
      <button class="btn" id="m_add">➕ Добави запис</button>
      <div id="m_err" class="status"></div>
    </div>

    <div class="out-block">
      <div class="line"><span>Общо записи</span><span>${entries.length}</span></div>
      <div class="line"><span>Общо похарчено</span><span>${esc(money(total))} лв.</span></div>
    </div>

    <div class="row" style="margin-top:12px">
      <button class="btn sec inline" id="m_copy" style="margin-top:0">📋 Копирай дневника</button>
    </div>

    <div style="margin-top:16px">
      ${rows || '<div class="empty">Няма записи още. Добави първото обслужване по-горе. 🚗</div>'}
    </div>`;

  const err = root.querySelector('#m_err');
  root.querySelector('#m_add').addEventListener('click', () => {
    const date = root.querySelector('#m_date').value || todayISO();
    const km = root.querySelector('#m_km').value.trim();
    const cost = root.querySelector('#m_cost').value.trim();
    const type = root.querySelector('#m_type').value.trim();
    const note = root.querySelector('#m_note').value.trim();
    if (!type) {
      err.className = 'status show err';
      err.textContent = 'Моля, попълни тип на обслужването.';
      return;
    }
    const list = load(LOG_KEY, []);
    list.push({ id: 'e' + Date.now() + Math.random().toString(36).slice(2, 6), date, km, type, note, cost });
    save(LOG_KEY, list);
    renderMaintLog(root);
  });

  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    const id = b.getAttribute('data-del');
    const list = load(LOG_KEY, []).filter((e) => e.id !== id);
    save(LOG_KEY, list);
    renderMaintLog(root);
  }));

  const copyBtn = root.querySelector('#m_copy');
  copyBtn.addEventListener('click', async () => {
    const list = load(LOG_KEY, []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!list.length) { err.className = 'status show err'; err.textContent = 'Няма какво да се копира.'; return; }
    let txt = 'ДНЕВНИК ЗА ПОДДРЪЖКА\n====================\n';
    for (const e of list) {
      txt += `${e.date} | ${e.km || '?'} км | ${e.type} | ${money(Number(e.cost) || 0)} лв.`;
      if (e.note) txt += ` | ${e.note}`;
      txt += '\n';
    }
    txt += `--------------------\nОБЩО: ${money(total)} лв. (${list.length} записа)\n`;
    const ok = await copyText(txt);
    err.className = 'status show ' + (ok ? 'ok' : 'err');
    err.textContent = ok ? 'Дневникът е копиран в клипборда. ✅' : 'Копирането не бе възможно.';
  });
}

// ==========================================================================
// 2) Справочник OBD-II кодове
// ==========================================================================
function renderObd(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>🔎 Търсене по код или дума</label>
      <input type="text" id="obd_q" placeholder="напр. P0300, катализатор, масло…" autocomplete="off">
      <div class="hint">Вграден офлайн списък с ${OBD_CODES.length} чести кода за диагностика (OBD-II). Работи без интернет.</div>
    </div>
    <div id="obd_list"></div>`;

  const listEl = root.querySelector('#obd_list');
  const draw = (q) => {
    const query = (q || '').trim().toLowerCase();
    const rows = OBD_CODES.filter(([code, desc]) =>
      !query || code.toLowerCase().includes(query) || desc.toLowerCase().includes(query));
    if (!rows.length) {
      listEl.innerHTML = '<div class="empty">Няма съвпадение. Провери кода или пробвай друга дума. 🔧</div>';
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
      <div style="font-weight:700;margin-bottom:6px">⛽ Разход на гориво</div>
      <div class="row">
        <div>
          <label>Изразходвано гориво (л)</label>
          <input type="number" id="f_l" inputmode="decimal" placeholder="напр. 42">
        </div>
        <div>
          <label>Изминат път (км)</label>
          <input type="number" id="f_km" inputmode="decimal" placeholder="напр. 560">
        </div>
      </div>
      <button class="btn" id="f_go">Изчисли разхода</button>
      <div id="f_out" class="out-block" hidden></div>
    </div>

    <div class="tool-card">
      <div style="font-weight:700;margin-bottom:6px">🛣️ Стойност на пътуване</div>
      <div class="row">
        <div>
          <label>Разстояние (км)</label>
          <input type="number" id="t_km" inputmode="decimal" placeholder="напр. 300">
        </div>
        <div>
          <label>Разход (л/100км)</label>
          <input type="number" id="t_cons" inputmode="decimal" placeholder="напр. 7.5">
        </div>
      </div>
      <label>Цена на горивото (лв./л)</label>
      <input type="number" id="t_price" inputmode="decimal" placeholder="напр. 2.60">
      <button class="btn" id="t_go">Изчисли стойността</button>
      <div id="t_out" class="out-block" hidden></div>
    </div>

    <div class="tool-card">
      <div style="font-weight:700;margin-bottom:6px">🛢️ Напомняне за смяна на масло</div>
      <div class="row">
        <div>
          <label>Текущи километри</label>
          <input type="number" id="o_cur" inputmode="numeric" placeholder="напр. 145000" value="${esc(oil.cur)}">
        </div>
        <div>
          <label>Интервал (км)</label>
          <input type="number" id="o_int" inputmode="numeric" placeholder="напр. 10000" value="${esc(oil.interval)}">
        </div>
      </div>
      <button class="btn" id="o_go">Изчисли следваща смяна</button>
      <div id="o_out" class="out-block" hidden></div>
    </div>`;

  // Разход на гориво
  root.querySelector('#f_go').addEventListener('click', () => {
    const l = parseFloat(root.querySelector('#f_l').value);
    const km = parseFloat(root.querySelector('#f_km').value);
    const out = root.querySelector('#f_out');
    if (!(l > 0) || !(km > 0)) { out.hidden = false; out.innerHTML = '<div class="line"><span>Въведи литри и километри над нула.</span><span>⚠️</span></div>'; return; }
    const per100 = (l / km) * 100;
    out.hidden = false;
    out.innerHTML = `
      <div class="line"><span>Изминат път</span><span>${esc(money(km))} км</span></div>
      <div class="line"><span>Изразходвано</span><span>${esc(money(l))} л</span></div>
      <div class="line"><span>Среден разход</span><span>${esc(money(per100))} л/100км</span></div>`;
  });

  // Стойност на пътуване
  root.querySelector('#t_go').addEventListener('click', () => {
    const km = parseFloat(root.querySelector('#t_km').value);
    const cons = parseFloat(root.querySelector('#t_cons').value);
    const price = parseFloat(root.querySelector('#t_price').value);
    const out = root.querySelector('#t_out');
    if (!(km > 0) || !(cons > 0) || !(price > 0)) { out.hidden = false; out.innerHTML = '<div class="line"><span>Попълни разстояние, разход и цена над нула.</span><span>⚠️</span></div>'; return; }
    const litres = (km / 100) * cons;
    const cost = litres * price;
    out.hidden = false;
    out.innerHTML = `
      <div class="line"><span>Нужно гориво</span><span>${esc(money(litres))} л</span></div>
      <div class="line"><span>Цена на литър</span><span>${esc(money(price))} лв.</span></div>
      <div class="line"><span>Обща стойност</span><span>${esc(money(cost))} лв.</span></div>`;
  });

  // Смяна на масло
  root.querySelector('#o_go').addEventListener('click', () => {
    const cur = parseFloat(root.querySelector('#o_cur').value);
    const interval = parseFloat(root.querySelector('#o_int').value);
    const out = root.querySelector('#o_out');
    if (!(cur >= 0) || !(interval > 0)) { out.hidden = false; out.innerHTML = '<div class="line"><span>Въведи текущи км и интервал над нула.</span><span>⚠️</span></div>'; return; }
    save(OIL_KEY, { cur: String(cur), interval: String(interval) });
    const next = cur + interval;
    out.hidden = false;
    out.innerHTML = `
      <div class="line"><span>Текущи километри</span><span>${esc(money(cur))} км</span></div>
      <div class="line"><span>Интервал</span><span>${esc(money(interval))} км</span></div>
      <div class="line"><span>Следваща смяна при</span><span>${esc(money(next))} км</span></div>`;
  });
}

// ==========================================================================
// Изглед „Инструменти" с под-табове
// ==========================================================================
const SUBTABS = [
  ['log', '📒 Дневник', renderMaintLog],
  ['obd', '🔍 OBD-II', renderObd],
  ['calc', '🧮 Калкулатори', renderCalc],
];

export function renderToolsView(container) {
  let active = 'log';
  try { const s = localStorage.getItem(SUBTAB_KEY); if (s && SUBTABS.some((t) => t[0] === s)) active = s; } catch (_) {}

  container.innerHTML = `
    <div class="hero" style="padding-bottom:10px"><h1>🧰 Инструменти</h1><p>Полезни офлайн инструменти за собственика на автомобил</p></div>
    <div class="tabs" id="tools_subtabs"></div>
    <div id="tools_body"></div>`;

  const tabsEl = container.querySelector('#tools_subtabs');
  const bodyEl = container.querySelector('#tools_body');

  const drawTabs = () => {
    tabsEl.innerHTML = SUBTABS.map(([id, label]) =>
      `<button class="tab${id === active ? ' active' : ''}" data-sub="${id}">${esc(label)}</button>`).join('');
    tabsEl.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => {
      active = b.getAttribute('data-sub');
      try { localStorage.setItem(SUBTAB_KEY, active); } catch (_) {}
      drawTabs();
      drawBody();
    }));
  };
  const drawBody = () => {
    const found = SUBTABS.find((t) => t[0] === active) || SUBTABS[0];
    found[2](bodyEl);
  };
  drawTabs();
  drawBody();
}
