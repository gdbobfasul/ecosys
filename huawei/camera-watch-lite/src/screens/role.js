// Version: 1.0021
// role.js — ПЪРВИЯТ ЕКРАН на MotionSecurityHawk: кой държи този телефон?
//   • „Носещ"      — детето/възрастният, който излиза (телефонът върви с него);
//   • „Наблюдаващ" — родителят/роднината, който вижда картата и получава сигналите;
//   • „Само камера" — старият страж на камерата, без сдвояване.
// Сдвояване по КОД (наблюдаващият го създава, носещият го въвежда). Носещият дава изрично
// СЪГЛАСИЕ на екрана — без отметка не може да продължи. Кодът е и ключът за шифроване.

import { el, mount, toast } from '../ui/dom.js';
import { buildSectionBar } from '../ui/sections.js';
import { getHawkCfg, setHawkCfg, resetHawkData, DEFAULT_RELAY } from '../core/hawk-store.js';
import { generateCode, normalizeCode, cryptoAvailable } from '../core/hawk-crypto.js';
import { checkChannel } from '../core/hawk-channel.js';
import { t } from '../core/i18n.js';

export async function renderRole(root, { go }) {
  const cfg = getHawkCfg();
  let role = (cfg.role === 'wearer' || cfg.role === 'guardian') ? cfg.role : '';

  const codeIn = el('input', { type: 'text', value: cfg.code, placeholder: 'ABCD-EFGH', autocapitalize: 'characters', autocomplete: 'off', class: 'code-input' });
  const nameIn = el('input', { type: 'text', value: cfg.name, placeholder: t('hk_name_ph'), maxlength: '40' });
  const relayIn = el('input', { type: 'text', value: cfg.relayBase || DEFAULT_RELAY, placeholder: DEFAULT_RELAY, autocapitalize: 'none', autocomplete: 'off' });
  const consentCb = el('input', { type: 'checkbox' });
  consentCb.checked = !!cfg.consent;
  const statusEl = el('span', { class: 'pill' }, '');

  const wearerCard = el('button', { class: 'role-card', onclick: () => pick('wearer') }, [
    el('div', { class: 'role-ico' }, '🧒'),
    el('div', { class: 'role-name' }, t('hk_role_wearer')),
    el('div', { class: 'muted' }, t('hk_role_wearer_desc'))
  ]);
  const guardianCard = el('button', { class: 'role-card', onclick: () => pick('guardian') }, [
    el('div', { class: 'role-ico' }, '👁️'),
    el('div', { class: 'role-name' }, t('hk_role_guardian')),
    el('div', { class: 'muted' }, t('hk_role_guardian_desc'))
  ]);

  const codeHint = el('p', { class: 'muted' }, '');
  const genBtn = el('button', { class: 'btn ghost', onclick: () => { codeIn.value = generateCode(); } }, t('hk_gen_code'));
  const consentBox = el('div', { class: 'card consent' }, [
    el('h2', { text: t('hk_consent_title') }),
    el('p', { html: t('hk_consent_body') }),
    el('label', { class: 'toggle' }, [el('span', { text: t('hk_consent_check') }), consentCb])
  ]);
  const detail = el('div', { style: 'display:none' }, [
    el('div', { class: 'card' }, [
      el('label', { text: t('hk_code') }), codeIn, codeHint,
      el('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, [genBtn]),
      el('label', { text: t('hk_name') }), nameIn,
      el('details', {}, [
        el('summary', { class: 'muted' }, t('hk_advanced')),
        el('label', { text: t('pair_server') }), relayIn,
        el('p', { class: 'muted', text: t('hk_server_hint') })
      ])
    ]),
    consentBox,
    el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [
      el('button', { class: 'btn grow', onclick: save }, t('hk_start')),
      el('button', { class: 'btn ghost', onclick: check }, t('pair_check')),
      statusEl
    ])
  ]);

  function pick(r) {
    role = r;
    wearerCard.classList.toggle('cur', r === 'wearer');
    guardianCard.classList.toggle('cur', r === 'guardian');
    detail.style.display = '';
    consentBox.style.display = (r === 'wearer') ? '' : 'none';
    genBtn.style.display = (r === 'guardian') ? '' : 'none';
    codeHint.textContent = (r === 'guardian') ? t('hk_code_hint_guardian') : t('hk_code_hint_wearer');
    if (r === 'guardian' && !codeIn.value.trim()) codeIn.value = generateCode();
    try { detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
  }

  function readForm() {
    const code = normalizeCode(codeIn.value);
    if (code.length < 6) { toast(t('hk_code_short')); return null; }
    if (!cryptoAvailable()) { toast(t('hk_no_crypto')); return null; }
    return { code, relayBase: relayIn.value.trim() || DEFAULT_RELAY, name: nameIn.value.trim() };
  }

  async function check() {
    const f = readForm(); if (!f) return;
    setHawkCfg({ code: f.code, relayBase: f.relayBase });
    statusEl.className = 'pill'; statusEl.textContent = t('pair_checking');
    const r = await checkChannel();
    statusEl.className = 'pill ' + (r.ok ? 'on' : 'off');
    statusEl.textContent = r.ok ? t('pair_link_ok') : (t('pair_no_link') + (r.reason ? ' (' + r.reason + ')' : ''));
  }

  async function save() {
    if (!role) { toast(t('hk_pick_role')); return; }
    const f = readForm(); if (!f) return;
    if (role === 'wearer' && !consentCb.checked) { toast(t('hk_consent_required')); return; }
    const prev = getHawkCfg();
    if (prev.code !== f.code || prev.role !== role) resetHawkData(); // нова двойка/роля = чисти данни
    setHawkCfg({ role, code: f.code, relayBase: f.relayBase, name: f.name, consent: role === 'wearer' ? true : prev.consent });
    go('hawk');
  }

  const view = el('div', {}, [
    buildSectionBar('hawk', go),
    el('h1', { text: t('hk_title') }),
    el('p', { class: 'lead', text: t('hk_subtitle') }),
    el('p', { class: 'muted', text: t('hk_who_holds') }),
    el('div', { class: 'role-grid' }, [wearerCard, guardianCard]),
    detail,
    el('div', { class: 'card' }, [
      el('h2', { text: t('hk_how_title') }),
      el('ol', { class: 'how' }, [
        el('li', { text: t('hk_how_1') }), el('li', { text: t('hk_how_2') }),
        el('li', { text: t('hk_how_3') }), el('li', { text: t('hk_how_4') })
      ]),
      el('p', { class: 'notice', html: t('hk_privacy_note') })
    ]),
    el('div', { class: 'row', style: 'justify-content:center' }, [
      el('button', { class: 'btn ghost', onclick: () => { setHawkCfg({ role: 'camera' }); go('dashboard'); } }, t('hk_camera_only'))
    ])
  ]);
  mount(root, view);
  if (role) pick(role);
}
