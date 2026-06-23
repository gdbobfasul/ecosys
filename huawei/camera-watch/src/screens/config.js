// config.js — настройки: източник (телефон/друга камера), чувствителност, класове за
// аларма, cooldown, нотификации. Записва се локално.

import { el, mount } from '../ui/dom.js';
import { loadSettings, saveSettings } from '../core/storage.js';
import { getPairing, setPairing, generatePairKey, checkPairing } from '../core/pairing.js';
import { t, tf } from '../core/i18n.js';

export async function renderConfig(root, { go }) {
  const s = await loadSettings();

  const otherWrap = el('div', { class: s.source === 'other' ? '' : 'spacer' });
  const otherUrl = el('input', { type: 'url', placeholder: t('cfg_other_url_ph'), value: s.otherUrl || '' });

  function renderOther() {
    otherWrap.innerHTML = '';
    if (s.source === 'other') {
      otherWrap.appendChild(el('label', { text: t('cfg_other_url') }));
      otherWrap.appendChild(otherUrl);
      otherWrap.appendChild(el('div', { class: 'notice warn', html: t('cfg_other_warn') }));
    }
  }
  renderOther();

  const sourceSel = el('select', {
    onchange: (e) => { s.source = e.target.value; renderOther(); }
  }, [
    el('option', { value: 'phone', text: t('cfg_source_phone'), selected: s.source === 'phone' }),
    el('option', { value: 'other', text: t('cfg_source_other'), selected: s.source === 'other' })
  ]);

  const sensVal = el('span', { class: 'muted', text: pct(s.sensitivity) });
  const sens = el('input', {
    type: 'range', min: '0.005', max: '0.2', step: '0.005', value: String(s.sensitivity),
    oninput: (e) => { s.sensitivity = parseFloat(e.target.value); sensVal.textContent = pct(s.sensitivity); }
  });

  const cdVal = el('span', { class: 'muted', text: tf('cfg_seconds', s.cooldownSec) });
  const cd = el('input', {
    type: 'range', min: '3', max: '60', step: '1', value: String(s.cooldownSec),
    oninput: (e) => { s.cooldownSec = parseInt(e.target.value, 10); cdVal.textContent = tf('cfg_seconds', s.cooldownSec); }
  });

  const pairingCard = buildPairingCard(go);

  const cbClassify = checkbox(s.classify, (v) => s.classify = v);
  const cbNotify = checkbox(s.notify, (v) => s.notify = v);
  const cbPerson = checkbox(s.watchPerson, (v) => s.watchPerson = v);
  const cbAnimal = checkbox(s.watchAnimal, (v) => s.watchAnimal = v);
  const cbOther = checkbox(s.watchOther, (v) => s.watchOther = v);

  const view = el('div', {}, [
    el('div', { class: 'steps' }, [
      el('div', { class: 's active' }), el('div', { class: 's active' }),
      el('div', { class: 's active' }), el('div', { class: 's' })
    ]),
    el('h1', { text: t('cfg_title') }),

    pairingCard,

    el('div', { class: 'card' }, [
      el('label', { text: t('cfg_source') }),
      sourceSel,
      otherWrap
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [el('label', { text: t('cfg_sensitivity'), class: 'grow' }), sensVal]),
      sens,
      el('p', { class: 'muted', text: t('cfg_sensitivity_hint') })
    ]),

    el('div', { class: 'card' }, [
      el('h2', { text: t('cfg_what_alarm') }),
      toggle(t('cfg_alarm_person'), cbPerson),
      toggle(t('cfg_alarm_animal'), cbAnimal),
      toggle(t('cfg_alarm_other'), cbOther),
      el('div', { class: 'spacer' }),
      toggle(t('cfg_classify'), cbClassify),
      el('p', { class: 'muted', text: t('cfg_classify_hint') })
    ]),

    el('div', { class: 'card' }, [
      toggle(t('cfg_local_notif'), cbNotify),
      el('div', { class: 'spacer' }),
      el('div', { class: 'row between' }, [el('label', { text: t('cfg_cooldown'), class: 'grow' }), cdVal]),
      cd
    ]),

    el('div', { class: 'row' }, [
      el('button', { class: 'btn ghost', onclick: () => go('permissions') }, t('back')),
      el('button', {
        class: 'btn grow', onclick: async () => {
          s.otherUrl = otherUrl.value.trim();
          await saveSettings(s);
          go('dashboard');
        }
      }, t('cfg_save_to_dashboard'))
    ])
  ]);

  mount(root, view);
}

// --- Сдвояване (2 телефона): страж (до камерата) ↔ наблюдаващ ---
function buildPairingCard(go) {
  const p = getPairing();
  const roleSel = el('select', {}, [
    optionEl('solo', t('pair_role_solo'), p.role),
    optionEl('monitor', t('pair_role_monitor'), p.role),
    optionEl('watcher', t('pair_role_watcher'), p.role)
  ]);
  const keyIn = el('input', { type: 'text', value: p.pairKey, placeholder: t('pair_key_ph'), autocapitalize: 'none', autocomplete: 'off' });
  const baseIn = el('input', { type: 'text', value: p.relayBase, placeholder: 'https://selflearning.bot.nu', autocapitalize: 'none', autocomplete: 'off' });
  const pollIn = el('input', { type: 'number', value: String(p.pollSeconds), min: '3' });
  const statusEl = el('span', { class: 'pill' }, '');

  return el('div', { class: 'card' }, [
    el('h2', { text: t('pair_title') }),
    el('p', { class: 'muted', text: t('pair_desc') }),
    el('label', { text: t('pair_role') }), roleSel,
    el('label', { text: t('pair_key') }), keyIn,
    el('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, [
      el('button', { class: 'btn ghost', onclick: () => { keyIn.value = generatePairKey(); } }, t('pair_gen_key'))
    ]),
    el('label', { text: t('pair_server') }), baseIn,
    el('label', { text: t('pair_poll') }), pollIn,
    el('div', { class: 'row', style: 'gap:8px;margin-top:10px;align-items:center' }, [
      el('button', {
        class: 'btn', onclick: () => {
          setPairing({ role: roleSel.value, pairKey: keyIn.value.trim(), relayBase: baseIn.value.trim(), pollSeconds: parseInt(pollIn.value, 10) || 6 });
          statusEl.className = 'pill on';
          statusEl.textContent = t('pair_saved');
        }
      }, t('save')),
      el('button', {
        class: 'btn ghost', onclick: async () => {
          setPairing({ role: roleSel.value, pairKey: keyIn.value.trim(), relayBase: baseIn.value.trim() });
          statusEl.className = 'pill';
          statusEl.textContent = t('pair_checking');
          const r = await checkPairing();
          statusEl.className = 'pill ' + (r.ok ? 'on' : 'off');
          statusEl.textContent = r.ok ? t('pair_link_ok') : (t('pair_no_link') + (r.reason ? ` (${r.reason})` : ''));
        }
      }, t('pair_check')),
      statusEl
    ])
  ]);
}

function optionEl(value, label, current) {
  const o = el('option', { value, text: label });
  if (value === current) o.setAttribute('selected', '');
  return o;
}

function pct(v) { return tf('cfg_pct_pixels', Math.round(v * 1000) / 10); }

function checkbox(checked, onChange) {
  const c = el('input', { type: 'checkbox' });
  c.checked = !!checked;
  c.addEventListener('change', () => onChange(c.checked));
  return c;
}

function toggle(labelText, checkboxEl) {
  return el('div', { class: 'toggle' }, [el('span', { text: labelText }), checkboxEl]);
}
