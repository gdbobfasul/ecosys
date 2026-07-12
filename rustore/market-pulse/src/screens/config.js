// Version: 1.0001
// Екран „Настрой робота" (config wizard) — добавяне на watch елементи.
import { CRYPTO, FX } from '../core/api.js';
import { saveState, pushLog } from '../core/storage.js';
import { t, tf } from '../core/i18n.js';
import { topBar, bindTopBar } from '../ui/topbar.js';

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
    if (!state.watches.length) return `<p class="muted">${t('cfg_none_yet')}</p>`;
    return state.watches.map(w => `
      <div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div>${w.symbol} <span class="muted">${w.condition === 'below' ? '≤' : '≥'} ${w.target} · ${t('freq_' + w.freq)}</span></div>
        <button class="btn ghost sm" data-del="${w.id}">${t('delete')}</button>
      </div>`).join('');
  }

  function draw() {
    root.innerHTML = `
      ${topBar(t('cfg_title'))}
      <div class="pad">
        <p>${t('cfg_intro')}</p>
        <div class="card">
          <label>${t('cfg_type')}</label>
          <div class="grid">
            <div class="chip ${draft.kind === 'crypto' ? 'on' : ''}" data-kind="crypto">${t('cfg_crypto')}</div>
            <div class="chip ${draft.kind === 'fx' ? 'on' : ''}" data-kind="fx">${t('cfg_fx')}</div>
          </div>

          <label>${draft.kind === 'crypto' ? t('cfg_coin_label') : t('cfg_fx_label')}</label>
          <select id="symbol">${symbolOptions()}</select>

          <label>${t('cfg_condition')}</label>
          <div class="grid">
            <div class="chip ${draft.condition === 'below' ? 'on' : ''}" data-cond="below">${t('cfg_below')}</div>
            <div class="chip ${draft.condition === 'above' ? 'on' : ''}" data-cond="above">${t('cfg_above')}</div>
          </div>

          <label>${t('cfg_threshold')}</label>
          <input id="target" type="number" inputmode="decimal" placeholder="${t('cfg_threshold_ph')}" value="${draft.target}"/>

          <label>${t('cfg_freq')}</label>
          <select id="freq">
            <option value="15min" ${draft.freq === '15min' ? 'selected' : ''}>${t('freq_15min')}</option>
            <option value="1h" ${draft.freq === '1h' ? 'selected' : ''}>${t('freq_1h')}</option>
            <option value="daily" ${draft.freq === 'daily' ? 'selected' : ''}>${t('freq_daily')}</option>
          </select>

          <button class="btn" id="add" style="margin-top:14px">${t('cfg_add')}</button>
          <p class="err-line" id="err"></p>
        </div>

        <div class="card">
          <h2>${tf('cfg_current_n', state.watches.length)}</h2>
          ${existingList()}
        </div>

        <button class="btn ghost" id="done">${t('cfg_to_perms')}</button>
      </div>
    `;
    bindTopBar(root);

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
      const tgt = parseFloat(draft.target);
      const err = root.querySelector('#err');
      if (!isFinite(tgt) || tgt <= 0) { err.textContent = t('cfg_invalid'); return; }
      const limit = 50;
      if (state.watches.length >= limit) {
        err.textContent = tf('cfg_limit', limit);
        return;
      }
      state.watches.push({
        id: 'w' + Date.now().toString(36),
        kind: draft.kind, symbol: draft.symbol, condition: draft.condition,
        target: tgt, freq: draft.freq, lastValue: null, lastCheck: null, status: 'watching', paused: false
      });
      pushLog(state, tf('log_added', draft.symbol, draft.condition === 'below' ? '≤' : '≥', tgt));
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
