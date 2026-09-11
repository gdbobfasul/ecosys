// Version: 1.0036
// notary.js (екран) — „Нотариус“: регистър и изповедник с ОТДЕЛЕН ПИН и шифроване на устройството.
//   Завещание — кой какво получава и защо / кой не и защо;
//   Сделки    — покупки, продажби, по-големи сделки (с резултат);
//   Признания — къде си сгрешил, какво си искал/искаш да направиш.
// Износ като шифрован файл; внос с ПИН-а на файла; разрешение Съветникът да чете (само отключен).
import { el, clear, toast } from '../ui/dom.js';
import * as N from '../core/notary.js';
import { t, tf } from '../core/i18n.js';

const TABS = [ ['will', 'nt_tab_will'], ['deals', 'nt_tab_deals'], ['confessions', 'nt_tab_conf'] ];
let _tab = 'will';

export function renderNotary(root) {
  clear(root);
  root.appendChild(el('h2', {}, t('screen_notary')));
  root.appendChild(el('p', { class: 'muted' }, t('nt_intro')));

  if (!N.cryptoAvailable()) { root.appendChild(el('div', { class: 'card' }, el('p', { class: 'warn-text' }, t('nt_no_crypto')))); return; }

  const body = el('div', {});
  function paint() {
    clear(body);
    if (!N.isSetUp()) renderSetup(body, paint);
    else if (!N.isOpen()) renderUnlock(body, paint);
    else renderOpen(body, paint);
  }
  paint();
  root.appendChild(body);
}

function pinInput(ph) { return el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: ph }); }

// ---------------- Създаване ----------------
function renderSetup(root, repaint) {
  const p1 = pinInput(t('nt_pin')), p2 = pinInput(t('nt_pin2'));
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('nt_setup_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('nt_setup_text')),
    el('label', {}, t('nt_pin')), p1,
    el('label', {}, t('nt_pin2')), p2,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: async () => {
      if (!N.validPin(p1.value)) { toast(t('nt_pin_short')); return; }
      if (p1.value !== p2.value) { toast(t('nt_pin_mismatch')); return; }
      if (await N.setup(p1.value)) { toast(t('nt_created')); repaint(); } else toast(t('nt_no_crypto'));
    } }, t('nt_create'))
  ]));
  root.appendChild(importCard(repaint));
}

// ---------------- Отключване ----------------
function renderUnlock(root, repaint) {
  const p = pinInput(t('nt_pin'));
  const msg = el('div', { class: 'err-text', style: 'min-height:18px;margin-top:6px;font-size:13px' });
  async function go() {
    const left = N.cooldownLeftMs();
    if (left > 0) { msg.textContent = tf('nt_cooldown', Math.ceil(left / 1000)); return; }
    if (await N.unlock(p.value)) { toast(t('nt_unlocked')); repaint(); }
    else { const l2 = N.cooldownLeftMs(); msg.textContent = l2 > 0 ? tf('nt_cooldown', Math.ceil(l2 / 1000)) : t('nt_wrong'); p.value = ''; }
  }
  p.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '🔒 ' + t('nt_unlock_title')),
    el('label', {}, t('nt_pin')), p,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: go }, t('nt_unlock')),
    msg,
    el('p', { class: 'muted', style: 'font-size:12px' }, t('nt_autolock'))
  ]));
  root.appendChild(importCard(repaint));
}

// Внос на шифрован файл (и при създаване, и при заключен/отключен регистър).
function importCard(repaint) {
  const p = pinInput(t('nt_import_pin'));
  return el('div', { class: 'card' }, [
    el('h3', {}, t('nt_import')),
    el('label', {}, t('nt_import_pin')), p,
    el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: async () => {
      if (!N.validPin(p.value)) { toast(t('nt_pin_short')); return; }
      const r = await N.importFromPickedFile(p.value);
      if (r.cancelled) return;
      if (!r.ok) { toast(r.reason === 'locked' ? t('nt_unlock_title') : t('nt_import_bad')); return; }
      toast(tf('nt_import_ok', r.added)); repaint();
    } }, t('nt_import'))
  ]);
}

// ---------------- Отключен регистър ----------------
function renderOpen(root, repaint) {
  const c = N.counts();
  let moreOpen = false;
  const moreHost = el('div', {});
  const allow = el('input', { type: 'checkbox', checked: N.advisorAllowed() });
  allow.addEventListener('change', () => { N.setAdvisorAllowed(allow.checked); toast(t('nt_saved')); });
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row spread' }, [
      el('span', { class: 'badge', style: 'background:var(--ok);color:#0b1020' }, '🔓 ' + t('nt_open_badge') + ' · ' + c.total),
      el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px', onclick: () => { N.lock(); toast(t('nt_locked_toast')); repaint(); } }, t('nt_lock'))
    ]),
    el('label', { class: 'toggle', style: 'margin-top:8px' }, [ el('span', { style: 'font-size:13px' }, t('nt_allow')), allow ]),
    el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' }, [
      el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px;flex:1', onclick: async () => {
        const r = await N.exportFile({ share: true });
        toast(r.ok ? tf('nt_export_ok', r.path) : tf('nt_export_fail', r.reason || ''));
      } }, t('nt_export')),
      el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px;flex:1', onclick: () => { moreOpen = !moreOpen; paintMore(); } }, t('nt_more'))
    ]),
    moreHost
  ]));
  function paintMore() {
    clear(moreHost);
    if (!moreOpen) return;
    const o = pinInput(t('nt_old_pin')), n1 = pinInput(t('nt_new_pin')), n2 = pinInput(t('nt_pin2'));
    moreHost.appendChild(el('div', { style: 'margin-top:10px' }, [
      el('h3', {}, t('nt_change_pin')),
      el('label', {}, t('nt_old_pin')), o, el('label', {}, t('nt_new_pin')), n1, el('label', {}, t('nt_pin2')), n2,
      el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: async () => {
        if (!N.validPin(n1.value)) { toast(t('nt_pin_short')); return; }
        if (n1.value !== n2.value) { toast(t('nt_pin_mismatch')); return; }
        if (await N.changePin(o.value, n1.value)) { toast(t('nt_pin_changed')); moreOpen = false; paintMore(); } else toast(t('nt_wrong'));
      } }, t('nt_change_pin')),
      importCard(repaint),
      el('button', { class: 'danger block', style: 'margin-top:8px', onclick: () => {
        if (!confirm(t('nt_wipe_q'))) return;
        N.wipe(); toast(t('nt_wiped')); repaint();
      } }, t('nt_wipe'))
    ]));
  }

  const strip = el('div', { class: 'row', style: 'gap:6px;overflow-x:auto;padding-bottom:6px;margin:8px 0;scrollbar-width:none' });
  const body = el('div', {});
  function paintTabs() {
    clear(strip);
    for (const [id, key] of TABS) {
      strip.appendChild(el('button', { class: id === _tab ? '' : 'secondary', style: 'font-size:13px;padding:8px 12px;white-space:nowrap;flex:none', onclick: () => { _tab = id; paintTabs(); } }, t(key) + ' · ' + c[id]));
    }
    clear(body);
    ({ will: renderWill, deals: renderDeals, confessions: renderConfessions })[_tab](body, repaint);
  }
  paintTabs();
  root.appendChild(strip);
  root.appendChild(body);
}

// Общ помощник: карта със списък + редакция/изтриване. fields = [{ key, label, type:'text'|'textarea'|'select', options }]
function listWithForm(root, kind, fields, requiredKey, addLabel, emptyKey, repaint, cardView) {
  let formOpen = false;
  const formHost = el('div', {});
  root.appendChild(el('button', { class: 'block', onclick: () => { formOpen = !formOpen; paintForm(); } }, addLabel));
  root.appendChild(formHost);
  function paintForm() { clear(formHost); if (formOpen) formHost.appendChild(form(null, () => { formOpen = false; repaint(); }, () => { formOpen = false; paintForm(); })); }

  function form(e, onSaved, onCancel) {
    const inputs = {};
    const kids = [];
    for (const f of fields) {
      let inp;
      if (f.type === 'textarea') inp = el('textarea', { placeholder: t(f.label), style: 'min-height:70px' }, e ? (e[f.key] || '') : '');
      else if (f.type === 'select') { inp = el('select', {}); for (const [v, lk] of f.options) inp.appendChild(el('option', { value: v, selected: e ? e[f.key] === v : v === f.options[0][0] }, t(lk))); }
      else inp = el('input', { type: 'text', placeholder: t(f.label), value: e ? (e[f.key] || '') : '' });
      inputs[f.key] = inp;
      kids.push(el('label', {}, t(f.label)), inp);
    }
    kids.push(el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [
      el('button', { class: 'grow', onclick: async () => {
        const vals = {}; for (const f of fields) vals[f.key] = inputs[f.key].value;
        if (!String(vals[requiredKey] || '').trim()) { toast(t('nt_need')); return; }
        const r = e ? await N.update(kind, e.id, vals) : await N.add(kind, vals);
        if (!r) { toast(t('nt_unlock_title')); return; }
        toast(t('nt_saved')); onSaved();
      } }, t('save')),
      el('button', { class: 'secondary grow', onclick: onCancel }, t('cancel'))
    ]));
    return el('div', { class: 'card', style: 'margin-top:8px' }, kids);
  }

  const items = N.list(kind);
  const list = el('div', { style: 'margin-top:10px' });
  if (!items.length) list.appendChild(el('p', { class: 'muted' }, t(emptyKey)));
  for (const e of items) {
    const wrap = el('div', { class: 'mem-item' });
    function view() {
      clear(wrap);
      for (const node of cardView(e)) if (node) wrap.appendChild(node);
      wrap.appendChild(el('div', { class: 'row', style: 'margin-top:8px;gap:8px' }, [
        el('button', { class: 'secondary', style: 'flex:1;font-size:12px;padding:6px 10px', onclick: () => { clear(wrap); wrap.appendChild(form(e, repaint, view)); } }, t('edit')),
        el('button', { class: 'secondary', style: 'flex:1;font-size:12px;padding:6px 10px', onclick: async () => {
          if (!confirm(t('nt_del_q'))) return;
          await N.remove(kind, e.id); toast(t('nt_deleted')); repaint();
        } }, t('delete'))
      ]));
    }
    view();
    list.appendChild(wrap);
  }
  root.appendChild(list);
}

const line = (label, val, style) => val ? el('div', { style: 'font-size:13px;' + (style || '') }, [ el('span', { class: 'muted' }, label + ': '), val ]) : null;

function renderWill(root, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('nt_w_intro')));
  listWithForm(root, 'will', [
    { key: 'person', label: 'nt_w_person' },
    { key: 'mode', label: 'nt_w_mode', type: 'select', options: [['gets', 'nt_w_gets'], ['excluded', 'nt_w_excl']] },
    { key: 'what', label: 'nt_w_what' },
    { key: 'why', label: 'nt_w_why', type: 'textarea' }
  ], 'person', t('nt_w_add'), 'nt_w_empty', repaint, (e) => [
    el('div', { class: 'row spread' }, [ el('span', { class: 'k' }, e.person || ''), el('span', { class: 'badge', style: e.mode === 'excluded' ? 'background:var(--err);color:#0b1020' : '' }, t(e.mode === 'excluded' ? 'nt_w_excl' : 'nt_w_gets')) ]),
    line(t('nt_w_what'), e.what), line(t('nt_w_why'), e.why, 'white-space:pre-wrap')
  ]);
}

function renderDeals(root, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('nt_d_intro')));
  const RES_COLOR = { gain: 'var(--ok)', loss: 'var(--err)', neutral: 'var(--muted)' };
  listWithForm(root, 'deals', [
    { key: 'kind', label: 'nt_d_kind', type: 'select', options: [['buy', 'nt_d_buy'], ['sell', 'nt_d_sell'], ['deal', 'nt_d_deal']] },
    { key: 'what', label: 'nt_d_what' },
    { key: 'amount', label: 'nt_d_amount' },
    { key: 'party', label: 'nt_d_party' },
    { key: 'date', label: 'nt_d_date' },
    { key: 'result', label: 'nt_d_result', type: 'select', options: [['neutral', 'nt_r_neutral'], ['gain', 'nt_r_gain'], ['loss', 'nt_r_loss']] },
    { key: 'note', label: 'nt_d_note', type: 'textarea' }
  ], 'what', t('nt_d_add'), 'nt_d_empty', repaint, (e) => [
    el('div', { class: 'row spread' }, [
      el('span', { class: 'badge' }, t('nt_d_' + (e.kind || 'deal')) + (e.date ? ' · ' + e.date : '')),
      el('span', { style: 'font-size:12px;font-weight:600;color:' + (RES_COLOR[e.result] || 'var(--muted)') }, t('nt_r_' + (e.result || 'neutral')))
    ]),
    el('div', { class: 'k' }, e.what || ''),
    line(t('nt_d_amount'), e.amount), line(t('nt_d_party'), e.party), line(t('nt_d_note'), e.note, 'white-space:pre-wrap')
  ]);
}

function renderConfessions(root, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('nt_c_intro')));
  listWithForm(root, 'confessions', [
    { key: 'text', label: 'nt_c_text', type: 'textarea' },
    { key: 'about', label: 'nt_c_about' },
    { key: 'wish', label: 'nt_c_wish', type: 'textarea' },
    { key: 'date', label: 'nt_c_date' }
  ], 'text', t('nt_c_add'), 'nt_c_empty', repaint, (e) => [
    el('div', { class: 'row spread' }, [ el('span', { class: 'badge' }, e.date || t('cp_no_date')), e.about ? el('span', { class: 'muted', style: 'font-size:12px' }, e.about) : null ]),
    el('div', { class: 'v', style: 'white-space:pre-wrap;color:var(--text)' }, e.text || ''),
    line(t('nt_c_wish'), e.wish, 'white-space:pre-wrap;color:var(--accent-2)')
  ]);
}
