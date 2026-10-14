// Version: 1.0033
// tools.js — ЕКРАН „🧰 Инструменти": напълно ОФЛАЙН финансови калкулатори (чиста математика,
// без мрежа, без импорт на market/api модули). Три инструмента с вътрешни под-табове:
//   1) Сложна лихва   2) Кредит / ипотека   3) Размер на позиция / риск
// Всички изчисления са локални; последните въведени стойности се пазят в localStorage.

import { t, tf, getLang } from '../core/i18n.js';

const LS = {
  compound: 'mp_tools_compound',
  loan: 'mp_tools_loan',
  position: 'mp_tools_position',
  liq: 'mp_tools_liq',
  ruin: 'mp_tools_ruin',
};

// --- Помощни ---------------------------------------------------------------
function num(v) { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : 0; }
// ★ (07.10) ФИКС на Huawei 3.1 i18n-забележка: числата се форматираха твърдо с 'bg-BG' + „ лв",
//   затова при избран английски/др. част от съдържанието оставаше на български. Сега форматираме
//   по ТЕКУЩИЯ език (getLang) и без твърда валутна дума — калкулаторите са валута-неутрални.
function _loc() { try { return getLang() || 'en'; } catch (_) { return 'en'; } }
function money(x) {
  if (!isFinite(x)) x = 0;
  return x.toLocaleString(_loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function qty(x) {
  if (!isFinite(x)) x = 0;
  return x.toLocaleString(_loc(), { minimumFractionDigits: 0, maximumFractionDigits: 4 });
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
    field('cmp-principal', t('mpt_c_principal'), s.principal != null ? s.principal : 1000, '1000') +
    field('cmp-rate', t('mpt_rate'), s.rate != null ? s.rate : 8, '8') +
    field('cmp-years', t('mpt_c_years'), s.years != null ? s.years : 10, '10') +
    field('cmp-monthly', t('mpt_c_monthly'), s.monthly != null ? s.monthly : 100, '100') +
    '<button id="cmp-go" style="' + C_BTN + '">' + t('mpt_calc') + '</button>' +
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
      ? '<div style="font-size:12px;color:#9aa7b4;margin:12px 0 4px">' + t('mpt_c_breakdown') + '</div>' +
        r.rows.map((x) => '<div style="' + C_RES + '"><div style="font-size:12px;color:#8b98a8">' + tf('mpt_c_year', x.year) + '</div>' +
          '<div style="font-size:13px;color:#cfe0ff">' + money(x.bal) + '</div></div>').join('')
      : '';
    root.querySelector('#cmp-out').innerHTML =
      resRow(t('mpt_c_fv'), money(r.fv), '#37d67a') +
      resRow(t('mpt_c_contributed'), money(r.contributed)) +
      resRow(t('mpt_c_profit'), money(r.profit), '#37d67a') + bd;
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
    field('ln-amount', t('mpt_l_amount'), s.amount != null ? s.amount : 50000, '50000') +
    field('ln-rate', t('mpt_rate'), s.rate != null ? s.rate : 6, '6') +
    field('ln-months', t('mpt_l_months'), s.months != null ? s.months : 240, '240') +
    '<button id="ln-go" style="' + C_BTN + '">' + t('mpt_calc') + '</button>' +
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
      resRow(t('mpt_l_pay'), money(r.pay), '#37d67a') +
      resRow(t('mpt_l_total'), money(r.total)) +
      resRow(t('mpt_l_overpay'), money(r.overpay), '#ff7a6b') +
      '<div style="font-size:11px;color:#6b7787;margin-top:8px">' + tf('mpt_l_note', r.months) + '</div>';
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
    field('ps-capital', t('mpt_p_capital'), s.capital != null ? s.capital : 10000, '10000') +
    field('ps-risk', t('mpt_p_risk'), s.risk != null ? s.risk : 1, '1') +
    field('ps-entry', t('mpt_liq_entry'), s.entry != null ? s.entry : 100, '100') +
    field('ps-stop', t('mpt_p_stop'), s.stop != null ? s.stop : 95, '95') +
    field('ps-target', t('mpt_p_target'), s.target != null ? s.target : '', '110') +
    '<button id="ps-go" style="' + C_BTN + '">' + t('mpt_calc') + '</button>' +
    '<div id="ps-out" style="margin-top:14px"></div>' +
    '</div>';
}
function bindPosition(root) {
  const get = (id) => root.querySelector('#' + id).value;
  const run = () => {
    const s = { capital: get('ps-capital'), risk: get('ps-risk'), entry: get('ps-entry'), stop: get('ps-stop'), target: get('ps-target') };
    save(LS.position, s);
    const r = calcPosition(s);
    const rrText = r.rr == null ? '—' : ('1 : ' + r.rr.toLocaleString(_loc(), { maximumFractionDigits: 2 }));
    const rrColor = r.rr == null ? '#8b98a8' : (r.rr >= 2 ? '#37d67a' : (r.rr >= 1 ? '#e0b23a' : '#ff7a6b'));
    root.querySelector('#ps-out').innerHTML =
      resRow(t('mpt_p_maxloss'), money(r.maxLoss), '#ff7a6b') +
      resRow(t('mpt_p_perunit'), money(r.perUnit)) +
      resRow(t('mpt_p_units'), qty(r.units), '#cfe0ff') +
      resRow(t('mpt_p_posvalue'), money(r.posValue)) +
      resRow(t('mpt_p_rr'), rrText, rrColor);
  };
  root.querySelector('#ps-go').onclick = run;
  run();
}

// --- 4) Ликвидационна цена (сдвоява се с ликвидационната карта) -------------
function price(x) { if (!isFinite(x)) x = 0; return x.toLocaleString('en-US', { maximumFractionDigits: 6 }); }
function calcLiquidation(s) {
  const entry = num(s.entry), lev = Math.max(1, num(s.lev)), mmr = num(s.mmr) / 100;
  if (entry <= 0 || lev < 1) return null;
  const isShort = s.dir === 'short';
  const liq = isShort ? entry * (1 + 1 / lev - mmr) : entry * (1 - 1 / lev + mmr);
  const dist = Math.abs(entry - liq) / entry * 100;
  const move = Math.max(0, (1 / lev - mmr) * 100);
  return { liq: Math.max(0, liq), dist: dist, move: move };
}
function renderLiquidation() {
  const s = load(LS.liq);
  const dir = s.dir || 'long';
  return '<div id="mp-pane-liq">' +
    field('lq-entry', t('mpt_liq_entry'), s.entry != null ? s.entry : 100, '100') +
    field('lq-lev', t('mpt_liq_lev'), s.lev != null ? s.lev : 10, '10') +
    '<label style="' + C_LABEL + '">' + t('mpt_liq_dir') + '</label>' +
    '<select id="lq-dir" style="' + C_INP + '">' +
      '<option value="long"' + (dir === 'long' ? ' selected' : '') + '>' + t('mpt_liq_long') + '</option>' +
      '<option value="short"' + (dir === 'short' ? ' selected' : '') + '>' + t('mpt_liq_short') + '</option>' +
    '</select>' +
    field('lq-mmr', t('mpt_liq_mmr'), s.mmr != null ? s.mmr : 0.5, '0.5') +
    '<button id="lq-go" style="' + C_BTN + '">' + t('mpt_calc') + '</button>' +
    '<div id="lq-out" style="margin-top:14px"></div>' +
    '<div style="font-size:11px;color:#6b7787;margin-top:10px">' + t('mpt_liq_note') + '</div>' +
    '</div>';
}
function bindLiquidation(root) {
  const get = (id) => root.querySelector('#' + id).value;
  const run = () => {
    const s = { entry: get('lq-entry'), lev: get('lq-lev'), dir: get('lq-dir'), mmr: get('lq-mmr') };
    save(LS.liq, s);
    const r = calcLiquidation(s);
    if (!r) { root.querySelector('#lq-out').innerHTML = ''; return; }
    root.querySelector('#lq-out').innerHTML =
      resRow(t('mpt_liq_r_price'), price(r.liq), '#ff7a6b') +
      resRow(t('mpt_liq_r_dist'), r.dist.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' %') +
      resRow(t('mpt_liq_r_move'), r.move.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' %', '#e0b23a');
  };
  root.querySelector('#lq-go').onclick = run;
  run();
}

// --- 5) Риск от разорение (Monte-Carlo) — УНИКАЛНА функция: симулира хиляди серии сделки и дава
//        вероятността да разориш сметката при даден шанс за печалба, риск/сделка и съотношение R:R.
//        Чиста офлайн математика (без мрежа). „Разорение" = капиталът падне до 30% от началния. -----
function calcRuin(s) {
  const win = Math.min(100, Math.max(0, num(s.win))) / 100;
  const risk = Math.min(100, Math.max(0, num(s.risk))) / 100;
  const rr = Math.max(0, num(s.rr));
  const trades = Math.min(2000, Math.max(1, Math.round(num(s.trades))));
  if (risk <= 0 || rr <= 0) return null;
  const RUNS = 3000, RUIN = 0.30;
  let ruined = 0, ddSum = 0; const finals = [];
  for (let r = 0; r < RUNS; r++) {
    let eq = 1, peak = 1, maxdd = 0, dead = false;
    for (let i = 0; i < trades; i++) {
      eq *= (Math.random() < win) ? (1 + risk * rr) : (1 - risk);
      if (eq > peak) peak = eq;
      const dd = (peak - eq) / peak; if (dd > maxdd) maxdd = dd;
      if (eq <= RUIN) { dead = true; break; }
    }
    if (dead) ruined++; ddSum += maxdd; finals.push(eq);
  }
  finals.sort((a, b) => a - b);
  const median = finals[Math.floor(finals.length / 2)];
  const expectancy = (win * rr - (1 - win)) * risk * 100; // ~% на сделка
  return { ror: ruined / RUNS * 100, median: median, avgdd: ddSum / RUNS * 100, expectancy: expectancy };
}
function renderRuin() {
  const s = load(LS.ruin);
  return '<div id="mp-pane-ruin">' +
    field('rn-win', t('mpt_ruin_win'), s.win != null ? s.win : 50, '50') +
    field('rn-risk', t('mpt_ruin_risk'), s.risk != null ? s.risk : 2, '2') +
    field('rn-rr', t('mpt_ruin_rr'), s.rr != null ? s.rr : 2, '2') +
    field('rn-trades', t('mpt_ruin_trades'), s.trades != null ? s.trades : 100, '100') +
    '<button id="rn-go" style="' + C_BTN + '">' + t('mpt_calc') + '</button>' +
    '<div id="rn-out" style="margin-top:14px"></div>' +
    '<div style="font-size:11px;color:#6b7787;margin-top:10px">' + t('mpt_ruin_note') + '</div>' +
    '</div>';
}
function bindRuin(root) {
  const get = (id) => root.querySelector('#' + id).value;
  const run = () => {
    const s = { win: get('rn-win'), risk: get('rn-risk'), rr: get('rn-rr'), trades: get('rn-trades') };
    save(LS.ruin, s);
    const r = calcRuin(s);
    if (!r) { root.querySelector('#rn-out').innerHTML = ''; return; }
    const rorColor = r.ror < 5 ? '#37d67a' : (r.ror < 20 ? '#e0b23a' : '#ff7a6b');
    const expColor = r.expectancy >= 0 ? '#37d67a' : '#ff7a6b';
    root.querySelector('#rn-out').innerHTML =
      resRow(t('mpt_ruin_r_ror'), r.ror.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' %', rorColor) +
      resRow(t('mpt_ruin_r_median'), '×' + r.median.toLocaleString('en-US', { maximumFractionDigits: 2 }), r.median >= 1 ? '#37d67a' : '#ff7a6b') +
      resRow(t('mpt_ruin_r_avgdd'), r.avgdd.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' %', '#e0b23a') +
      resRow(t('mpt_ruin_r_exp'), r.expectancy.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' %', expColor);
  };
  root.querySelector('#rn-go').onclick = run;
  run();
}

// --- Под-табове (етикетите се взимат от i18n при всяко рисуване → реагират на смяна на език) -----
const TABS = [
  { id: 'compound', labelKey: 'mpt_tab_compound', render: renderCompound, bind: bindCompound },
  { id: 'loan', labelKey: 'mpt_tab_loan', render: renderLoan, bind: bindLoan },
  { id: 'position', labelKey: 'mpt_tab_position', render: renderPosition, bind: bindPosition },
  { id: 'liq', labelKey: 'mpt_tab_liq', render: renderLiquidation, bind: bindLiquidation },
  { id: 'ruin', labelKey: 'mpt_tab_ruin', render: renderRuin, bind: bindRuin },
];

export function renderTools(root, go) {
  let active = TABS[0].id;
  try { const v = localStorage.getItem('mp_tools_tab'); if (v && TABS.some((x) => x.id === v)) active = v; } catch (_) {}

  function paint() {
    const tab = TABS.find((x) => x.id === active) || TABS[0];
    root.innerHTML =
      '<div style="max-width:560px;margin:0 auto;padding:14px 12px 90px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#e6edf3">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
          '<button id="tl-back" style="background:#141c2b;border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 13px system-ui;padding:7px 12px;cursor:pointer">' + t('mpt_back') + '</button>' +
          '<div style="font-weight:800;font-size:18px">' + t('mpt_title') + '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#e08a2b;background:#241a10;border:1px solid #4a361a;border-radius:10px;padding:8px 10px;margin-bottom:12px">' + t('mpt_frame_note') + '</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">' +
          TABS.map((x) =>
            '<button class="tl-tab" data-id="' + x.id + '" style="flex:1;min-width:120px;padding:9px 8px;border-radius:10px;border:1px solid ' +
            (x.id === active ? '#0a84ff' : '#26324a') + ';background:' + (x.id === active ? '#12233c' : '#0b1220') +
            ';color:' + (x.id === active ? '#cfe0ff' : '#9aa7b4') + ';font:600 12px system-ui;cursor:pointer">' + t(x.labelKey) + '</button>'
          ).join('') +
        '</div>' +
        '<div style="' + C_CARD + '" id="tl-pane">' + tab.render() + '</div>' +
      '</div>';

    root.querySelector('#tl-back').onclick = () => go('dashboard');
    root.querySelectorAll('.tl-tab').forEach((b) => {
      b.onclick = () => {
        active = b.getAttribute('data-id');
        try { localStorage.setItem('mp_tools_tab', active); } catch (_) {}
        paint();
      };
    });
    try { tab.bind(root); } catch (_) {}
  }

  paint();
}
