// Екран „Настрой робота" (config wizard) — добавяне на watch елементи.
import { CRYPTO, FX } from '../core/api.js';
import { saveState, pushLog } from '../core/storage.js';

let draft = null;

function newDraft() {
  return { kind: 'crypto', symbol: 'BTC', condition: 'below', target: '', freq: '1h' };
}

export function renderConfig(root, state, go) {
  if (!draft) draft = newDraft();
  draw();

  function symbolOptions() {
    const list = draft.kind === 'crypto' ? Object.keys(CRYPTO) : FX;
    return list.map(s => `<option value="${s}" ${draft.symbol === s ? 'selected' : ''}>${s}</option>`).join('');
  }

  function existingList() {
    if (!state.watches.length) return '<p class="muted">Още няма добавени наблюдения.</p>';
    return state.watches.map(w => `
      <div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div>${w.symbol} <span class="muted">${w.condition === 'below' ? '≤' : '≥'} ${w.target} · ${w.freq}</span></div>
        <button class="btn ghost sm" data-del="${w.id}">Изтрий</button>
      </div>`).join('');
  }

  function draw() {
    root.innerHTML = `
      <div class="top"><div class="logo"></div><h1>Настрой робота</h1></div>
      <div class="pad">
        <p>Добави какво да следи роботът. Можеш да добавиш няколко.</p>
        <div class="card">
          <label>Тип</label>
          <div class="grid">
            <div class="chip ${draft.kind === 'crypto' ? 'on' : ''}" data-kind="crypto">Крипто</div>
            <div class="chip ${draft.kind === 'fx' ? 'on' : ''}" data-kind="fx">Валута (FX)</div>
          </div>

          <label>${draft.kind === 'crypto' ? 'Монета (цена в USD)' : 'Валута (за 1 USD)'}</label>
          <select id="symbol">${symbolOptions()}</select>

          <label>Условие</label>
          <div class="grid">
            <div class="chip ${draft.condition === 'below' ? 'on' : ''}" data-cond="below">Падне под</div>
            <div class="chip ${draft.condition === 'above' ? 'on' : ''}" data-cond="above">Качи се над</div>
          </div>

          <label>Прагова стойност</label>
          <input id="target" type="number" inputmode="decimal" placeholder="напр. 60000" value="${draft.target}"/>

          <label>Честота на проверка</label>
          <select id="freq">
            <option value="15min" ${draft.freq === '15min' ? 'selected' : ''}>На 15 минути</option>
            <option value="1h" ${draft.freq === '1h' ? 'selected' : ''}>На 1 час</option>
            <option value="daily" ${draft.freq === 'daily' ? 'selected' : ''}>Веднъж дневно</option>
          </select>

          <button class="btn" id="add" style="margin-top:14px">Добави наблюдение</button>
          <p class="err-line" id="err"></p>
        </div>

        <div class="card">
          <h2>Текущи наблюдения (${state.watches.length})</h2>
          ${existingList()}
        </div>

        <button class="btn ghost" id="done">Продължи към разрешения</button>
      </div>
    `;

    root.querySelectorAll('[data-kind]').forEach(c => c.onclick = () => {
      draft.kind = c.dataset.kind;
      draft.symbol = draft.kind === 'crypto' ? 'BTC' : 'EUR';
      draw();
    });
    root.querySelectorAll('[data-cond]').forEach(c => c.onclick = () => { draft.condition = c.dataset.cond; draw(); });
    root.querySelector('#symbol').onchange = e => draft.symbol = e.target.value;
    root.querySelector('#target').oninput = e => draft.target = e.target.value;
    root.querySelector('#freq').onchange = e => draft.freq = e.target.value;

    root.querySelector('#add').onclick = async () => {
      const t = parseFloat(draft.target);
      const err = root.querySelector('#err');
      if (!isFinite(t) || t <= 0) { err.textContent = 'Въведи валидна прагова стойност.'; return; }
      const limit = 50;
      if (state.watches.length >= limit) {
        err.textContent = `Достигнат лимит (${limit}).`;
        return;
      }
      state.watches.push({
        id: 'w' + Date.now().toString(36),
        kind: draft.kind, symbol: draft.symbol, condition: draft.condition,
        target: t, freq: draft.freq, lastValue: null, lastCheck: null, status: 'watching', paused: false
      });
      pushLog(state, `➕ Добавено: ${draft.symbol} ${draft.condition === 'below' ? '≤' : '≥'} ${t}`);
      await saveState(state);
      draft = newDraft();
      draw();
    };

    root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      state.watches = state.watches.filter(w => w.id !== b.dataset.del);
      await saveState(state);
      draw();
    });

    root.querySelector('#done').onclick = () => go('permissions');
  }
}
