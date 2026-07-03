// Version: 1.0001
// Табло — главен ON/OFF ключ, списък наблюдения, дневник, действия.
import { saveState, pushLog } from '../core/storage.js';
import { start, stop, checkNow, formatVal } from '../core/scheduler.js';
import { t, tf, getLang, languageByCode } from '../core/i18n.js';
import { topBar, bindTopBar } from '../ui/topbar.js';

export function renderDashboard(root, state, go) {
  draw();

  function statusBadge(w) {
    if (w.paused) return `<span class="badge paused">${t('badge_paused')}</span>`;
    if (w.error) return `<span class="badge err">${t('badge_error')}</span>`;
    if (w.status === 'hit') return `<span class="badge hit">${t('badge_hit')}</span>`;
    return `<span class="badge watching">${t('badge_watching')}</span>`;
  }

  function watchRow(w) {
    const last = w.lastValue != null ? formatVal(w.lastValue) : '—';
    const src = w.lastSource ? ` · ${w.lastSource}` : '';
    return `
      <div class="card">
        <div class="row between">
          <div>
            <b>${w.symbol}</b> <span class="muted">${w.condition === 'below' ? '≤' : '≥'} ${w.target}</span>
            <div class="muted">${t('dash_last')} <span class="price">${last}</span>${src} · ${t('freq_' + w.freq)}</div>
            ${w.error ? `<div class="err-line">${w.error}</div>` : ''}
          </div>
          ${statusBadge(w)}
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn ghost sm" data-pause="${w.id}">${w.paused ? t('resume') : t('pause')}</button>
          <button class="btn ghost sm" data-del="${w.id}">${t('delete')}</button>
        </div>
      </div>`;
  }

  function logRows() {
    if (!state.log.length) return `<p class="muted">${t('dash_log_empty')}</p>`;
    const locale = languageByCode(getLang()).voice;
    return state.log.slice(0, 30).map(e => {
      const d = new Date(e.ts);
      const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      return `<div class="log">${time} — ${e.text}</div>`;
    }).join('');
  }

  function draw() {
    root.innerHTML = `
      ${topBar(t('dash_title'))}
      <div class="pad" style="flex:1">
        <div class="card">
          <div class="row between">
            <div>
              <b>${t('dash_master')}</b>
              <div class="muted">${state.masterOn ? t('dash_on') : t('dash_off')}</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="master" ${state.masterOn ? 'checked' : ''}/>
              <span class="slider"></span>
            </label>
          </div>
          <div class="row" style="margin-top:12px">
            <button class="btn ghost sm" id="checknow">${t('dash_check_now')}</button>
            <button class="btn ghost sm" id="addmore">${t('dash_add_more')}</button>
          </div>
        </div>

        <h2 style="margin-top:18px">${tf('dash_watches_n', state.watches.length)}</h2>
        ${state.watches.length ? state.watches.map(watchRow).join('') : `<p class="muted">${t('dash_no_watches')}</p>`}

        <div class="card">
          <h2>${t('dash_log')}</h2>
          ${logRows()}
        </div>
      </div>
      <div class="nav">
        <button class="on">${t('nav_dashboard')}</button>
        <button id="navcfg">${t('nav_settings')}</button>
        <button id="navperm">${t('nav_permissions')}</button>
      </div>
    `;
    bindTopBar(root);

    root.querySelector('#master').onchange = async (e) => {
      state.masterOn = e.target.checked;
      pushLog(state, state.masterOn ? t('log_started') : t('log_stopped'));
      await saveState(state);
      if (state.masterOn) start(state, () => draw());
      else stop();
      draw();
    };

    root.querySelector('#checknow').onclick = async () => {
      pushLog(state, t('log_manual_check'));
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
