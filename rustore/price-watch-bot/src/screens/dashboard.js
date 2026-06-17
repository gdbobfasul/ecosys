// Табло — главен ON/OFF ключ, списък наблюдения, дневник, действия.
import { saveState, pushLog } from '../core/storage.js';
import { start, stop, checkNow, formatVal } from '../core/scheduler.js';

export function renderDashboard(root, state, go) {
  draw();

  function statusBadge(w) {
    if (w.paused) return '<span class="badge paused">на пауза</span>';
    if (w.error) return '<span class="badge err">грешка</span>';
    if (w.status === 'hit') return '<span class="badge hit">праг достигнат</span>';
    return '<span class="badge watching">следи</span>';
  }

  function watchRow(w) {
    const last = w.lastValue != null ? formatVal(w.lastValue) : '—';
    const src = w.lastSource ? ` · ${w.lastSource}` : '';
    return `
      <div class="card">
        <div class="row between">
          <div>
            <b>${w.symbol}</b> <span class="muted">${w.condition === 'below' ? '≤' : '≥'} ${w.target}</span>
            <div class="muted">последно: <span class="price">${last}</span>${src} · ${w.freq}</div>
            ${w.error ? `<div class="err-line">${w.error}</div>` : ''}
          </div>
          ${statusBadge(w)}
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn ghost sm" data-pause="${w.id}">${w.paused ? 'Пусни' : 'Пауза'}</button>
          <button class="btn ghost sm" data-del="${w.id}">Изтрий</button>
        </div>
      </div>`;
  }

  function logRows() {
    if (!state.log.length) return '<p class="muted">Дневникът е празен.</p>';
    return state.log.slice(0, 30).map(e => {
      const d = new Date(e.ts);
      const t = d.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
      return `<div class="log">${t} — ${e.text}</div>`;
    }).join('');
  }

  function draw() {
    root.innerHTML = `
      <div class="top"><div class="logo"></div><h1>Табло на робота</h1></div>
      <div class="pad" style="flex:1">
        <div class="card">
          <div class="row between">
            <div>
              <b>Главен ключ</b>
              <div class="muted">${state.masterOn ? 'Роботът следи цените' : 'Роботът е спрян'}</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="master" ${state.masterOn ? 'checked' : ''}/>
              <span class="slider"></span>
            </label>
          </div>
          <div class="row" style="margin-top:12px">
            <button class="btn ghost sm" id="checknow">Провери сега</button>
            <button class="btn ghost sm" id="addmore">+ Добави наблюдение</button>
          </div>
        </div>

        <h2 style="margin-top:18px">Наблюдения (${state.watches.length})</h2>
        ${state.watches.length ? state.watches.map(watchRow).join('') : '<p class="muted">Няма наблюдения. Натисни „+ Добави наблюдение".</p>'}

        <div class="card">
          <h2>Дневник</h2>
          ${logRows()}
        </div>
      </div>
      <div class="nav">
        <button class="on">Табло</button>
        <button id="navcfg">Настройки</button>
        <button id="navperm">Разрешения</button>
      </div>
    `;

    root.querySelector('#master').onchange = async (e) => {
      state.masterOn = e.target.checked;
      pushLog(state, state.masterOn ? '▶️ Роботът е пуснат' : '⏸️ Роботът е спрян');
      await saveState(state);
      if (state.masterOn) start(state, () => draw());
      else stop();
      draw();
    };

    root.querySelector('#checknow').onclick = async () => {
      pushLog(state, '🔄 Ръчна проверка…');
      await checkNow(state, () => draw());
      draw();
    };

    root.querySelector('#addmore').onclick = () => go('config');
    root.querySelector('#navcfg').onclick = () => go('config');
    root.querySelector('#navperm').onclick = () => go('permissions');

    root.querySelectorAll('[data-pause]').forEach(b => b.onclick = async () => {
      const w = state.watches.find(x => x.id === b.dataset.pause);
      if (w) { w.paused = !w.paused; await saveState(state); draw(); }
    });
    root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      state.watches = state.watches.filter(x => x.id !== b.dataset.del);
      await saveState(state); draw();
    });
  }
}
