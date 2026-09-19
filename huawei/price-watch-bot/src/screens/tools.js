// Version: 1.0001
// Таб „🧰 Инструменти" — напълно ОФЛАЙН помощни калкулатори за пазаруване.
// НЯМА мрежа: всичко се смята локално в браузъра; списъкът и бюджетът се пазят в localStorage.
// Модулно: не пипа наблюдението/пазарните табове. UI-ят е статичен български текст (runtime i18n
// го превежда по-късно чрез DOM инжекция); JS-ът само окача поведение и localStorage.

const LS_LIST = 'pwb.tools.list.v1';
const LS_BUDGET = 'pwb.tools.budget.v1';

// ── дребни помощници (без български низове) ──
function num(v) { const n = parseFloat(String(v == null ? '' : v).replace(',', '.').trim()); return isFinite(n) ? n : NaN; }
function money(n) { return (isFinite(n) ? n : 0).toFixed(2) + ' лв'; }
function lsGet(k, d) { try { const s = localStorage.getItem(k); return s == null ? d : JSON.parse(s); } catch (_) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ── единица → нормализирана база (кг / л / бр) ──
const UNIT_BASE = { kg: 'лв/кг', g: 'лв/кг', l: 'лв/л', ml: 'лв/л', pc: 'лв/бр' };
function normQty(qty, unit) { if (unit === 'g' || unit === 'ml') return qty / 1000; return qty; }

let styled = false;
function injectToolsStyles() {
  if (styled) return; styled = true;
  const css = `
  .tool-card .mkt-h{margin:0 0 12px}
  .tool-card label{margin:8px 0 3px}
  .uc-row{gap:6px;margin:6px 0}
  .uc-row .uc-name{flex:1.4}
  .uc-row .uc-price,.uc-row .uc-qty{flex:1}
  .uc-row .uc-unit{flex:0 0 74px;width:74px}
  .uc-row .uc-del{flex:0 0 auto;width:auto;padding:9px 11px}
  .uc-best td{background:rgba(46,160,67,.18)!important;font-weight:700}
  .dc-out .row,.sl-tot .row{padding:6px 0;border-bottom:1px dashed var(--line)}
  .dc-warn{margin-top:10px;color:#fff;background:var(--hit);border-radius:10px;padding:9px 12px;font-weight:600;text-align:center}
  .sl-item{padding:9px 0;border-bottom:1px solid var(--line)}
  .sl-item.bought .sl-nm{text-decoration:line-through;opacity:.55}
  .sl-item .sl-nm{flex:1}
  .sl-item .sl-sum{font-variant-numeric:tabular-nums;margin:0 8px}
  .sl-item .sl-del{width:auto;padding:7px 10px}
  .tool-copied{color:var(--ok);font-size:12px;margin-top:8px;text-align:center}
  `;
  const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
}

// ── СТАТИЧЕН български шаблон (текстовите възли се превеждат от runtime i18n) ──
const TEMPLATE = `
<div class="card tool-card">
  <div class="mkt-h">⚖️ Сравнение на единична цена</div>
  <p class="muted">Въведи няколко продукта с цена и количество — приложението пресмята цената за единица (лв/кг, лв/л, лв/бр) и отбелязва най-изгодния.</p>
  <div id="uc-rows">
    <div class="uc-row row">
      <input class="uc-name" placeholder="Продукт" />
      <input class="uc-price" inputmode="decimal" placeholder="Цена лв" />
      <input class="uc-qty" inputmode="decimal" placeholder="Кол." />
      <select class="uc-unit">
        <option value="kg">кг</option>
        <option value="g">г</option>
        <option value="l">л</option>
        <option value="ml">мл</option>
        <option value="pc">бр</option>
      </select>
      <button class="btn ghost sm uc-del" type="button">✕</button>
    </div>
    <div class="uc-row row">
      <input class="uc-name" placeholder="Продукт" />
      <input class="uc-price" inputmode="decimal" placeholder="Цена лв" />
      <input class="uc-qty" inputmode="decimal" placeholder="Кол." />
      <select class="uc-unit">
        <option value="kg">кг</option>
        <option value="g">г</option>
        <option value="l">л</option>
        <option value="ml">мл</option>
        <option value="pc">бр</option>
      </select>
      <button class="btn ghost sm uc-del" type="button">✕</button>
    </div>
  </div>
  <div class="row" style="gap:8px;margin-top:8px">
    <button class="btn ghost sm uc-add" type="button">＋ Добави продукт</button>
    <button class="btn sm uc-calc" type="button">Изчисли</button>
  </div>
  <div class="mkt-scroll" style="margin-top:10px">
    <table class="mkt-table uc-res" hidden>
      <thead><tr><th>Продукт</th><th>Единична цена</th></tr></thead>
      <tbody id="uc-out"></tbody>
    </table>
  </div>
  <p class="muted uc-legend" hidden>★ = най-изгодна единична цена</p>
</div>

<div class="card tool-card">
  <div class="mkt-h">🏷️ Калкулатор за отстъпки</div>
  <p class="muted">Попълни старата цена и <b>или</b> новата цена, <b>или</b> процента отстъпка — другото се пресмята.</p>
  <label>Стара цена (лв)</label>
  <input id="dc-old" inputmode="decimal" placeholder="напр. 40" />
  <label>Нова цена (лв) — по избор</label>
  <input id="dc-new" inputmode="decimal" placeholder="напр. 30" />
  <label>Отстъпка (%) — по избор</label>
  <input id="dc-pct" inputmode="decimal" placeholder="напр. 25" />
  <button class="btn dc-calc" type="button" style="margin-top:12px">Изчисли</button>
  <div class="dc-out" hidden style="margin-top:12px">
    <div class="row between"><span>Крайна цена:</span><b id="dc-final">—</b></div>
    <div class="row between"><span>Спестявате:</span><b id="dc-save" class="up">—</b></div>
    <div class="row between"><span>Отстъпка:</span><b id="dc-perc">—</b></div>
  </div>
</div>

<div class="card tool-card">
  <div class="mkt-h">🧺 Списък за пазаруване с бюджет</div>
  <p class="muted">Добавяй артикули с цена и брой, задай бюджет и следи оставащата сума. Отметни купеното, изтрий или копирай списъка. Пази се на устройството.</p>
  <label>Бюджет (лв)</label>
  <input id="sl-budget" inputmode="decimal" placeholder="напр. 100" />
  <div class="row" style="gap:6px;margin-top:8px">
    <input id="sl-name" placeholder="Артикул" style="flex:1.6" />
    <input id="sl-price" inputmode="decimal" placeholder="Цена" style="flex:1" />
    <input id="sl-qty" inputmode="decimal" placeholder="Бр." value="1" style="flex:0 0 64px;width:64px" />
    <button class="btn sm sl-add" type="button">＋</button>
  </div>
  <div id="sl-items" style="margin-top:8px"></div>
  <div class="sl-tot" style="margin-top:10px">
    <div class="row between"><span>Общо:</span><b id="sl-total">0.00 лв</b></div>
    <div class="row between"><span>Бюджет:</span><b id="sl-bud">0.00 лв</b></div>
    <div class="row between"><span>Остава:</span><b id="sl-left">0.00 лв</b></div>
  </div>
  <div id="sl-warn" class="dc-warn" hidden>Надхвърлен бюджет!</div>
  <div class="row" style="gap:8px;margin-top:12px">
    <button class="btn ghost sm sl-copy" type="button">Копирай списъка</button>
    <button class="btn ghost sm sl-clear" type="button">Изчисти</button>
  </div>
  <div class="tool-copied" id="sl-copied" hidden>Копирано ✓</div>
</div>
`;

// ── Инструмент 1: сравнение на единична цена ──
function wireUnit(root) {
  const rows = root.querySelector('#uc-rows');
  const out = root.querySelector('#uc-out');
  const table = root.querySelector('.uc-res');
  const legend = root.querySelector('.uc-legend');

  function bindDel(row) {
    const b = row.querySelector('.uc-del');
    if (b) b.addEventListener('click', () => { if (rows.children.length > 1) row.remove(); else row.querySelectorAll('input').forEach((i) => (i.value = '')); });
  }
  rows.querySelectorAll('.uc-row').forEach(bindDel);

  root.querySelector('.uc-add').addEventListener('click', () => {
    const clone = rows.firstElementChild.cloneNode(true);
    clone.querySelectorAll('input').forEach((i) => (i.value = ''));
    const sel = clone.querySelector('.uc-unit'); if (sel) sel.selectedIndex = 0;
    rows.appendChild(clone); bindDel(clone);
  });

  root.querySelector('.uc-calc').addEventListener('click', () => {
    const items = [];
    rows.querySelectorAll('.uc-row').forEach((r, i) => {
      const price = num(r.querySelector('.uc-price').value);
      const qty = num(r.querySelector('.uc-qty').value);
      const unit = r.querySelector('.uc-unit').value;
      const name = (r.querySelector('.uc-name').value || '').trim() || ('#' + (i + 1));
      if (isFinite(price) && isFinite(qty) && qty > 0) {
        items.push({ name, unitPrice: price / normQty(qty, unit), label: UNIT_BASE[unit] || 'лв' });
      }
    });
    if (!items.length) { table.hidden = true; legend.hidden = true; return; }
    let best = Infinity; items.forEach((it) => { if (it.unitPrice < best) best = it.unitPrice; });
    out.innerHTML = items.map((it) => {
      const isBest = it.unitPrice === best;
      return '<tr class="' + (isBest ? 'uc-best' : '') + '"><td>' + esc(it.name) + '</td><td>' +
        it.unitPrice.toFixed(2) + ' ' + esc(it.label) + (isBest ? ' ★' : '') + '</td></tr>';
    }).join('');
    table.hidden = false; legend.hidden = items.length < 2;
  });
}

// ── Инструмент 2: калкулатор за отстъпки ──
function wireDiscount(root) {
  const oldEl = root.querySelector('#dc-old');
  const newEl = root.querySelector('#dc-new');
  const pctEl = root.querySelector('#dc-pct');
  const outEl = root.querySelector('.dc-out');
  root.querySelector('.dc-calc').addEventListener('click', () => {
    const oldP = num(oldEl.value);
    if (!isFinite(oldP) || oldP <= 0) { outEl.hidden = true; return; }
    const newP = num(newEl.value);
    const pct = num(pctEl.value);
    let final, perc;
    if (isFinite(newP)) { final = newP; perc = (oldP - newP) / oldP * 100; }
    else if (isFinite(pct)) { perc = pct; final = oldP * (1 - pct / 100); }
    else { outEl.hidden = true; return; }
    const save = oldP - final;
    root.querySelector('#dc-final').textContent = money(final);
    root.querySelector('#dc-save').textContent = money(save);
    root.querySelector('#dc-perc').textContent = (isFinite(perc) ? perc.toFixed(1) : '0.0') + '%';
    outEl.hidden = false;
  });
}

// ── Инструмент 3: списък за пазаруване с бюджет ──
function wireList(root) {
  const budEl = root.querySelector('#sl-budget');
  const nameEl = root.querySelector('#sl-name');
  const priceEl = root.querySelector('#sl-price');
  const qtyEl = root.querySelector('#sl-qty');
  const itemsBox = root.querySelector('#sl-items');
  const warnEl = root.querySelector('#sl-warn');
  const copiedEl = root.querySelector('#sl-copied');

  let items = lsGet(LS_LIST, []); if (!Array.isArray(items)) items = [];
  const savedBudget = lsGet(LS_BUDGET, '');
  if (savedBudget !== '' && savedBudget != null) budEl.value = savedBudget;

  function persist() { lsSet(LS_LIST, items); }

  function render() {
    itemsBox.innerHTML = items.map((it) =>
      '<div class="sl-item row between' + (it.bought ? ' bought' : '') + '" data-id="' + it.id + '">' +
        '<label class="row" style="gap:8px;flex:1;margin:0">' +
          '<input type="checkbox" class="sl-chk" style="width:auto" ' + (it.bought ? 'checked' : '') + ' />' +
          '<span class="sl-nm">' + esc(it.name) + ' <span class="muted">× ' + it.qty + '</span></span>' +
        '</label>' +
        '<span class="sl-sum">' + money(it.price * it.qty) + '</span>' +
        '<button class="btn ghost sm sl-del" type="button">🗑</button>' +
      '</div>'
    ).join('');
    itemsBox.querySelectorAll('.sl-item').forEach((row) => {
      const id = row.getAttribute('data-id');
      row.querySelector('.sl-chk').addEventListener('change', () => {
        const it = items.find((x) => String(x.id) === id); if (it) { it.bought = !it.bought; persist(); render(); }
      });
      row.querySelector('.sl-del').addEventListener('click', () => {
        items = items.filter((x) => String(x.id) !== id); persist(); render();
      });
    });
    recalc();
  }

  function recalc() {
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const budget = num(budEl.value); const b = isFinite(budget) ? budget : 0;
    root.querySelector('#sl-total').textContent = money(total);
    root.querySelector('#sl-bud').textContent = money(b);
    const left = b - total;
    const leftEl = root.querySelector('#sl-left');
    leftEl.textContent = money(left);
    leftEl.className = left < 0 ? 'down' : 'up';
    warnEl.hidden = !(b > 0 && total > b);
  }

  function add() {
    const name = (nameEl.value || '').trim();
    const price = num(priceEl.value);
    let qty = num(qtyEl.value); if (!isFinite(qty) || qty <= 0) qty = 1;
    if (!name || !isFinite(price)) return;
    items.push({ id: Date.now() + '' + Math.floor(Math.random() * 1000), name, price, qty, bought: false });
    persist();
    nameEl.value = ''; priceEl.value = ''; qtyEl.value = '1';
    render(); nameEl.focus();
  }

  root.querySelector('.sl-add').addEventListener('click', add);
  [nameEl, priceEl, qtyEl].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); }));
  budEl.addEventListener('input', () => { lsSet(LS_BUDGET, budEl.value); recalc(); });

  root.querySelector('.sl-copy').addEventListener('click', () => {
    const lines = items.map((it) => (it.bought ? '[x] ' : '[ ] ') + it.name + ' × ' + it.qty + ' — ' + money(it.price * it.qty));
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const budget = num(budEl.value);
    lines.push('———');
    lines.push('Общо: ' + money(total));
    if (isFinite(budget) && budget > 0) lines.push('Бюджет: ' + money(budget) + '  Остава: ' + money(budget - total));
    const text = lines.join('\n');
    const done = () => { copiedEl.hidden = false; setTimeout(() => { copiedEl.hidden = true; }, 1800); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done)); }
      else fallbackCopy(text, done);
    } catch (_) { fallbackCopy(text, done); }
  });

  root.querySelector('.sl-clear').addEventListener('click', () => {
    items = []; persist(); render();
  });

  render();
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    if (done) done();
  } catch (_) {}
}

// ── Вход ──
export function renderTools(body) {
  injectToolsStyles();
  body.innerHTML = TEMPLATE;
  wireUnit(body);
  wireDiscount(body);
  wireList(body);
}
