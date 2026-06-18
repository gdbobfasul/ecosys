// Калкулатори — заем, ДДС, лихва, проценти.
export const title = 'Калкулатори';

function money(n) {
  return (isFinite(n) ? n : 0).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function render(root) {
  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="loan">Заем</button>
      <button class="tab" data-tab="vat">ДДС</button>
      <button class="tab" data-tab="interest">Лихва</button>
      <button class="tab" data-tab="pct">Проценти</button>
    </div>

    <div class="tool-card" data-panel="loan">
      <label>Сума на заема</label><input type="number" id="lAmount" value="10000" />
      <label>Годишен лихвен процент (%)</label><input type="number" id="lRate" value="8" step="0.01" />
      <label>Срок (месеци)</label><input type="number" id="lMonths" value="60" />
      <button class="btn" id="loanBtn">Изчисли</button>
      <div class="out-block" id="loanOut" style="display:none"></div>
    </div>

    <div class="tool-card" data-panel="vat" style="display:none">
      <label>Държава (ставка ДДС)</label>
      <select id="vCountry">
        <option value="20">България — 20%</option>
        <option value="19">Германия — 19%</option>
        <option value="21">Нидерландия — 21%</option>
        <option value="22">Италия — 22%</option>
        <option value="21">Испания — 21%</option>
        <option value="20">Австрия — 20%</option>
        <option value="24">Гърция — 24%</option>
        <option value="25">Швеция — 25%</option>
        <option value="0">Друга / ръчно</option>
      </select>
      <label>ДДС ставка (%)</label><input type="number" id="vRate" value="20" step="0.1" />
      <label>Сума</label><input type="number" id="vAmount" value="100" />
      <label>Сумата е:</label>
      <select id="vMode">
        <option value="net">Без ДДС (добави ДДС)</option>
        <option value="gross">С ДДС (извади ДДС)</option>
      </select>
      <button class="btn" id="vatBtn">Изчисли</button>
      <div class="out-block" id="vatOut" style="display:none"></div>
    </div>

    <div class="tool-card" data-panel="interest" style="display:none">
      <label>Главница</label><input type="number" id="iPrincipal" value="5000" />
      <label>Годишен лихвен процент (%)</label><input type="number" id="iRate" value="5" step="0.01" />
      <label>Срок (години)</label><input type="number" id="iYears" value="3" step="0.1" />
      <label>Вид лихва</label>
      <select id="iType">
        <option value="compound">Сложна (капитализира се годишно)</option>
        <option value="simple">Проста</option>
      </select>
      <button class="btn" id="intBtn">Изчисли</button>
      <div class="out-block" id="intOut" style="display:none"></div>
    </div>

    <div class="tool-card" data-panel="pct" style="display:none">
      <label>Изчисление</label>
      <select id="pMode">
        <option value="of">X% от Y</option>
        <option value="iswhat">X е колко % от Y</option>
        <option value="change">Промяна от X до Y (%)</option>
      </select>
      <label id="pL1">Процент X</label><input type="number" id="pX" value="15" />
      <label id="pL2">Стойност Y</label><input type="number" id="pY" value="200" />
      <button class="btn" id="pctBtn">Изчисли</button>
      <div class="out-block" id="pctOut" style="display:none"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  root.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach((p) => {
        p.style.display = p.dataset.panel === t.dataset.tab ? 'block' : 'none';
      });
    });
  });

  // Заем
  $('#loanBtn').addEventListener('click', () => {
    const P = parseFloat($('#lAmount').value) || 0;
    const r = (parseFloat($('#lRate').value) || 0) / 100 / 12;
    const n = parseInt($('#lMonths').value, 10) || 1;
    const m = r > 0 ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
    const total = m * n, interest = total - P;
    const o = $('#loanOut'); o.style.display = 'block';
    o.innerHTML =
      `<div class="line"><span>Месечна вноска</span><span>${money(m)}</span></div>` +
      `<div class="line"><span>Обща лихва</span><span>${money(interest)}</span></div>` +
      `<div class="line"><span>Общо за връщане</span><span>${money(total)}</span></div>`;
  });

  // ДДС
  $('#vCountry').addEventListener('change', () => {
    const v = $('#vCountry').value;
    if (v !== '0') $('#vRate').value = v;
  });
  $('#vatBtn').addEventListener('click', () => {
    const rate = (parseFloat($('#vRate').value) || 0) / 100;
    const amt = parseFloat($('#vAmount').value) || 0;
    const mode = $('#vMode').value;
    let net, vat, gross;
    if (mode === 'net') { net = amt; vat = amt * rate; gross = net + vat; }
    else { gross = amt; net = amt / (1 + rate); vat = gross - net; }
    const o = $('#vatOut'); o.style.display = 'block';
    o.innerHTML =
      `<div class="line"><span>Без ДДС</span><span>${money(net)}</span></div>` +
      `<div class="line"><span>ДДС</span><span>${money(vat)}</span></div>` +
      `<div class="line"><span>С ДДС</span><span>${money(gross)}</span></div>`;
  });

  // Лихва
  $('#intBtn').addEventListener('click', () => {
    const P = parseFloat($('#iPrincipal').value) || 0;
    const r = (parseFloat($('#iRate').value) || 0) / 100;
    const y = parseFloat($('#iYears').value) || 0;
    const type = $('#iType').value;
    const total = type === 'compound' ? P * Math.pow(1 + r, y) : P * (1 + r * y);
    const interest = total - P;
    const o = $('#intOut'); o.style.display = 'block';
    o.innerHTML =
      `<div class="line"><span>Главница</span><span>${money(P)}</span></div>` +
      `<div class="line"><span>Натрупана лихва</span><span>${money(interest)}</span></div>` +
      `<div class="line"><span>Крайна сума</span><span>${money(total)}</span></div>`;
  });

  // Проценти
  function pctLabels() {
    const m = $('#pMode').value;
    if (m === 'of') { $('#pL1').textContent = 'Процент X'; $('#pL2').textContent = 'Стойност Y'; }
    else if (m === 'iswhat') { $('#pL1').textContent = 'Стойност X'; $('#pL2').textContent = 'Обща стойност Y'; }
    else { $('#pL1').textContent = 'Начална X'; $('#pL2').textContent = 'Крайна Y'; }
  }
  $('#pMode').addEventListener('change', pctLabels);
  $('#pctBtn').addEventListener('click', () => {
    const X = parseFloat($('#pX').value) || 0;
    const Y = parseFloat($('#pY').value) || 0;
    const m = $('#pMode').value;
    const o = $('#pctOut'); o.style.display = 'block';
    let label, val;
    if (m === 'of') { val = money(X / 100 * Y); label = `${X}% от ${Y} =`; }
    else if (m === 'iswhat') { val = (Y !== 0 ? (X / Y * 100) : 0).toFixed(2) + '%'; label = `${X} от ${Y} е`; }
    else { val = (X !== 0 ? ((Y - X) / X * 100) : 0).toFixed(2) + '%'; label = `Промяна ${X} → ${Y} =`; }
    o.innerHTML = `<div class="line"><span>${label}</span><span>${val}</span></div>`;
  });
  pctLabels();
}
