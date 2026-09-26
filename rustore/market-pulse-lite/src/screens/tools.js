// Version: 1.0001
// tools.js — ЕКРАН „🧰 Инструменти": напълно ОФЛАЙН финансови калкулатори (чиста математика,
// без мрежа, без импорт на market/api модули). Три инструмента с вътрешни под-табове:
//   1) Сложна лихва   2) Кредит / ипотека   3) Размер на позиция / риск
// Всички изчисления са локални; последните въведени стойности се пазят в localStorage.

import { t, tf } from '../core/i18n.js';
import { liteLocked, liteRequire } from '../core/lite-gate.js';

const LS = {
  compound: 'mp_tools_compound',
  loan: 'mp_tools_loan',
  position: 'mp_tools_position',
};

// --- Помощни ---------------------------------------------------------------
function num(v) { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : 0; }
function money(x) {
  if (!isFinite(x)) x = 0;
  return x.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + t('tl_cur');
}
function qty(x) {
  if (!isFinite(x)) x = 0;
  return x.toLocaleString('bg-BG', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}
function load(key) { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
function save(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (_) {} }

// --- Стилове (вградени, съответстват на тъмната тема на приложението) -------
const C_CARD = 'background:#111a2b;border:1px solid #24314a;border-radius:16px;padding:16px;margin-bottom:14px';
const C_INP = 'width:100%;padding:11px;border-radius:10px;border:1px solid #26324a;background:#0b1220;color:#e6edf3;font-size:15px;box-sizing:border-box';
const C_LABEL = 'display:block;font-size:12px;color:#9aa7b4;margin:10px 0 4px';
const C_RES = 'display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:7px 0;border-top:1px solid #1b2333';
const C_BTN = 'width:100%;padding:13px;border:0;border-radius:12px;font-size:15px;font-weight:700;background:linear-gradient(135deg,#0a84ff,#3aa0ff);color:#fff;cursor:pointer;margin-top:12px';

function field(id, label, val, ph) {
  return '<label style="' + C_LABEL + '">' + label + '</label>' +
    '<input id="' + id + '" inputmode="decimal" style="' + C_INP + '" value="' + (val != null ? val : '') + '" placeholder="' + (ph || '') + '" />';
}
function resRow(k, v, color) {
  return '<div style="' + C_RES + '"><div style="font-size:13px;color:#cfd8e3">' + k + '</div>' +
    '<div style="font-size:15px;font-weight:700;color:' + (color || '#e6edf3') + '">' + v + '</div></div>';
}

// --- 1) Сложна лихва -------------------------------------------------------
function calcCompound(s) {
  const P = num(s.principal), rate = num(s.rate), years = Math.max(0, Math.round(num(s.years))), pm = num(s.monthly);
  const i = rate / 100 / 12, n = years * 12;
  let bal = P;
  const rows = [];
  for (let y = 1; y <= years; y++) {
    for (let mth = 0; mth < 12; mth++) { bal = bal * (1 + i) + pm; }
    rows.push({ year: y, bal: bal });
  }
  if (years === 0) bal = P;
  const contributed = P + pm * n;
  const profit = bal - contributed;
  return { fv: bal, contributed: contributed, profit: profit, rows: rows };
}
function renderCompound() {
  const s = load(LS.compound);
  return '<div id="mp-pane-compound">' +
    field('cmp-principal', t('tl_f_principal') + ' (' + t('tl_cur') + ')', s.principal != null ? s.principal : 1000, '1000') +
    field('cmp-rate', t('tl_f_rate_year'), s.rate != null ? s.rate : 8, '8') +
    field('cmp-years', t('tl_f_years'), s.years != null ? s.years : 10, '10') +
    field('cmp-monthly', t('tl_f_monthly') + ' (' + t('tl_cur') + ')', s.monthly != null ? s.monthly : 100, '100') +
    '<button id="cmp-go" style="' + C_BTN + '">' + t('tl_calc') + '</button>' +
    '<div id="cmp-out" style="margin-top:14px"></div>' +
    '</div>';
}
function bindCompound(root) {
  const get = (id) => root.querySelector('#' + id).value;
  const run = () => {
    const s = { principal: get('cmp-principal'), rate: get('cmp-rate'), years: get('cmp-years'), monthly: get('cmp-monthly') };
    save(LS.compound, s);
    const r = calcCompound(s);
    const bd = r.rows.length
      ? '<div style="font-size:12px;color:#9aa7b4;margin:12px 0 4px">' + t('tl_r_breakdown') + '</div>' +
        r.rows.map((x) => '<div style="' + C_RES + '"><div style="font-size:12px;color:#8b98a8">' + t('tl_r_year') + ' ' + x.year + '</div>' +
          '<div style="font-size:13px;color:#cfe0ff">' + money(x.bal) + '</div></div>').join('')
      : '';
    root.querySelector('#cmp-out').innerHTML =
      resRow(t('tl_r_fv'), money(r.fv), '#37d67a') +
      resRow(t('tl_r_contributed'), money(r.contributed)) +
      resRow(t('tl_r_profit'), money(r.profit), '#37d67a') + bd;
  };
  root.querySelector('#cmp-go').onclick = run;
  run();
}

// --- 2) Кредит / ипотека ---------------------------------------------------
function calcLoan(s) {
  const L = num(s.amount), rate = num(s.rate), N = Math.max(1, Math.round(num(s.months)));
  const i = rate / 100 / 12;
  let pay;
  if (i === 0) pay = L / N;
  else pay = L * i / (1 - Math.pow(1 + i, -N));
  const total = pay * N;
  const overpay = total - L;
  return { pay: pay, total: total, overpay: overpay, months: N };
}
function renderLoan() {
  const s = load(LS.loan);
  return '<div id="mp-pane-loan">' +
    field('ln-amount', t('tl_f_loan_amount') + ' (' + t('tl_cur') + ')', s.amount != null ? s.amount : 50000, '50000') +
    field('ln-rate', t('tl_f_rate_year'), s.rate != null ? s.rate : 6, '6') +
    field('ln-months', t('tl_f_months'), s.months != null ? s.months : 240, '240') +
    '<button id="ln-go" style="' + C_BTN + '">' + t('tl_calc') + '</button>' +
    '<div id="ln-out" style="margin-top:14px"></div>' +
    '</div>';
}
function bindLoan(root) {
  const get = (id) => root.querySelector('#' + id).value;
  const run = () => {
    const s = { amount: get('ln-amount'), rate: get('ln-rate'), months: get('ln-months') };
    save(LS.loan, s);
    const r = calcLoan(s);
    root.querySelector('#ln-out').innerHTML =
      resRow(t('tl_r_monthly_pay'), money(r.pay), '#37d67a') +
      resRow(t('tl_r_total_repay'), money(r.total)) +
      resRow(t('tl_r_overpay'), money(r.overpay), '#ff7a6b') +
      '<div style="font-size:11px;color:#6b7787;margin-top:8px">' + tf('tl_r_annuity', r.months) + '</div>';
  };
  root.querySelector('#ln-go').onclick = run;
  run();
}

// --- 3) Размер на позиция / риск ------------------------------------------
function calcPosition(s) {
  const cap = num(s.capital), riskPct = num(s.risk), entry = num(s.entry), stop = num(s.stop), target = num(s.target);
  const maxLoss = cap * riskPct / 100;
  const perUnit = Math.abs(entry - stop);
  const units = perUnit > 0 ? maxLoss / perUnit : 0;
  const posValue = units * entry;
  const hasTarget = s.target != null && String(s.target).trim() !== '' && target > 0;
  const rr = (hasTarget && perUnit > 0) ? Math.abs(target - entry) / perUnit : null;
  return { maxLoss: maxLoss, perUnit: perUnit, units: units, posValue: posValue, rr: rr };
}
function renderPosition() {
  const s = load(LS.position);
  return '<div id="mp-pane-position">' +
    field('ps-capital', t('tl_f_capital') + ' (' + t('tl_cur') + ')', s.capital != null ? s.capital : 10000, '10000') +
    field('ps-risk', t('tl_f_risk'), s.risk != null ? s.risk : 1, '1') +
    field('ps-entry', t('tl_f_entry'), s.entry != null ? s.entry : 100, '100') +
    field('ps-stop', t('tl_f_stop'), s.stop != null ? s.stop : 95, '95') +
    field('ps-target', t('tl_f_target'), s.target != null ? s.target : '', '110') +
    '<button id="ps-go" style="' + C_BTN + '">' + t('tl_calc') + '</button>' +
    '<div id="ps-out" style="margin-top:14px"></div>' +
    '</div>';
}
function bindPosition(root) {
  const get = (id) => root.querySelector('#' + id).value;
  const run = () => {
    const s = { capital: get('ps-capital'), risk: get('ps-risk'), entry: get('ps-entry'), stop: get('ps-stop'), target: get('ps-target') };
    save(LS.position, s);
    const r = calcPosition(s);
    const rrText = r.rr == null ? '—' : ('1 : ' + r.rr.toLocaleString('bg-BG', { maximumFractionDigits: 2 }));
    const rrColor = r.rr == null ? '#8b98a8' : (r.rr >= 2 ? '#37d67a' : (r.rr >= 1 ? '#e0b23a' : '#ff7a6b'));
    root.querySelector('#ps-out').innerHTML =
      resRow(t('tl_r_maxloss'), money(r.maxLoss), '#ff7a6b') +
      resRow(t('tl_r_risk_unit'), money(r.perUnit)) +
      resRow(t('tl_r_units'), qty(r.units), '#cfe0ff') +
      resRow(t('tl_r_pos_value'), money(r.posValue)) +
      resRow(t('tl_r_rr'), rrText, rrColor);
  };
  root.querySelector('#ps-go').onclick = run;
  run();
}

// --- Под-табове ------------------------------------------------------------
// pro:true → напреднал калкулатор, заключен в демо (Lite) под ключ „calc_pro".
const TABS = [
  { id: 'compound', icon: '📈', labelKey: 'tl_compound', render: renderCompound, bind: bindCompound },
  { id: 'loan', icon: '🏦', labelKey: 'tl_loan', render: renderLoan, bind: bindLoan, pro: true },
  { id: 'position', icon: '🎯', labelKey: 'tl_position', render: renderPosition, bind: bindPosition, pro: true },
];
function tabLocked(x) { return !!(x && x.pro) && liteLocked('calc_pro'); }

export function renderTools(root, go) {
  let active = TABS[0].id;
  try { const v = localStorage.getItem('mp_tools_tab'); if (v && TABS.some((x) => x.id === v)) active = v; } catch (_) {}
  // Ако запомненият таб е заключен → върни се към свободния (сложна лихва).
  if (tabLocked(TABS.find((x) => x.id === active))) active = TABS[0].id;

  function paint() {
    const tab = TABS.find((x) => x.id === active) || TABS[0];
    root.innerHTML =
      '<div style="max-width:560px;margin:0 auto;padding:14px 12px 90px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#e6edf3">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
          '<button id="tl-back" style="background:#141c2b;border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 13px system-ui;padding:7px 12px;cursor:pointer">‹ ' + t('back') + '</button>' +
          '<div style="font-weight:800;font-size:18px">🧰 ' + t('tools_card_title') + '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#e08a2b;background:#241a10;border:1px solid #4a361a;border-radius:10px;padding:8px 10px;margin-bottom:12px">' + t('tl_disc') + '</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">' +
          TABS.map((x) =>
            '<button class="tl-tab" data-id="' + x.id + '" style="flex:1;min-width:120px;padding:9px 8px;border-radius:10px;border:1px solid ' +
            (x.id === active ? '#0a84ff' : '#26324a') + ';background:' + (x.id === active ? '#12233c' : '#0b1220') +
            ';color:' + (x.id === active ? '#cfe0ff' : '#9aa7b4') + ';font:600 12px system-ui;cursor:pointer">' + x.icon + ' ' + t(x.labelKey) + (tabLocked(x) ? ' 🔒' : '') + '</button>'
          ).join('') +
        '</div>' +
        '<div style="' + C_CARD + '" id="tl-pane">' + tab.render() + '</div>' +
      '</div>';

    root.querySelector('#tl-back').onclick = () => go('dashboard');
    root.querySelectorAll('.tl-tab').forEach((b) => {
      b.onclick = () => {
        const id = b.getAttribute('data-id');
        const tx = TABS.find((x) => x.id === id);
        if (tabLocked(tx)) { liteRequire('calc_pro', () => {}); return; }   // заключен калкулатор → пълна версия
        active = id;
        try { localStorage.setItem('mp_tools_tab', active); } catch (_) {}
        paint();
      };
    });
    try { tab.bind(root); } catch (_) {}
  }

  paint();
}
