// Version: 1.0021
// guardian.js — екран „Пазител" (първият екран на апа):
//   • статус + индикатор „пазителят е активен", последна активност, следваща проверка
//   • N часа без активност, M минути за отговор, часове за сън, местоположение (по избор)
//   • близки (име / телефон за SMS / идентификатор в нашия чат)
//   • тест „симулирай мълчание", преглед на сигнала, опашка „за ръчно изпращане"
//   • делегат за спешни съобщения, отговор на езика на подателя
//   • дневник на проверките
import { el, toast } from '../ui/dom.js';
import { getState, setState, uid } from '../core/storage.js';
import { t, tf, getLang } from '../core/i18n.js';
import { guardianStatus, nextAskTime, setGuardianEnabled, simulateSilence, composeAlert, getLocation, openSms, shareText, removePending, answerOk } from '../core/guardian.js';
import { detectLang, langNativeName } from '../core/lang-detect.js';

export function GuardianScreen({ navigate, render, openLanguage }) {
  const s = getState();
  const g = s.guardian;
  const root = el('div', {});
  const patchG = (p) => setState({ guardian: { ...getState().guardian, ...p } });

  const langBtn = el('button', { class: 'btn sm lang' }, t('lang_btn'));
  langBtn.addEventListener('click', () => { if (openLanguage) openLanguage(); });

  root.appendChild(el('div', { class: 'row between' }, [
    el('div', { class: 'brand' }, [el('div', { class: 'logo' }, '🛡️'), el('h1', {}, t('gd_title'))]),
    langBtn
  ]));
  root.appendChild(el('p', { class: 'muted' }, tf('gd_subtitle', g.hours)));

  // --- Статус ---
  const status = guardianStatus();
  const pillMap = {
    off: ['off', t('gd_status_off')],
    active: ['on', t('gd_status_active')],
    asking: ['away', t('gd_status_asking')],
    alerted: ['away', t('gd_status_alerted')]
  };
  const [pillCls, pillTxt] = pillMap[status];
  const sw = switchEl(g.enabled, (on) => {
    if (on && !(getState().guardian.contacts || []).length) toast(t('gd_no_contacts_warn'));
    setGuardianEnabled(on);
    render();
  });
  const statusCard = el('div', { class: 'card', style: g.enabled ? 'border-color:var(--accent)' : '' }, [
    el('div', { class: 'row between' }, [
      el('div', { class: 'grow' }, [
        el('div', { class: 'row' }, [el('strong', {}, t('gd_enable')), el('span', { class: 'pill ' + pillCls }, pillTxt)]),
        el('p', { class: 'muted', style: 'margin:6px 0 0' }, tf('gd_last_activity', new Date(g.lastActivity).toLocaleString(getLang()))),
        g.enabled ? el('p', { class: 'muted', style: 'margin:2px 0 0' }, tf('gd_next_check', new Date(nextAskTime(g)).toLocaleString(getLang()))) : null
      ]),
      sw
    ]),
    status === 'asking' ? el('button', { class: 'btn primary full', style: 'margin-top:10px', onClick: () => { answerOk(); render(); } }, t('gd_ask_yes')) : null,
    !(g.contacts || []).length ? el('p', { class: 'muted', style: 'color:var(--warn)' }, t('gd_no_contacts_warn')) : null,
    el('p', { class: 'muted', style: 'margin:8px 0 0' }, t('gd_bg_note'))
  ]);
  root.appendChild(statusCard);

  // --- Настройки: N часа, M минути, сън, име, местоположение ---
  const hours = numInput(g.hours, 1, 72);
  hours.addEventListener('change', () => { patchG({ hours: clamp(hours.value, 1, 72, 12) }); render(); });
  const grace = numInput(g.graceMinutes, 1, 120);
  grace.addEventListener('change', () => { patchG({ graceMinutes: clamp(grace.value, 1, 120, 15) }); render(); });
  const myName = el('input', { type: 'text', value: g.myName || '', placeholder: t('gd_my_name_ph') });
  myName.addEventListener('change', () => patchG({ myName: myName.value.trim() }));

  const sleepOn = el('input', { type: 'checkbox' });
  sleepOn.checked = !!(g.sleep && g.sleep.enabled);
  sleepOn.addEventListener('change', () => { patchG({ sleep: { ...getState().guardian.sleep, enabled: sleepOn.checked } }); render(); });
  const from = el('input', { type: 'time', value: (g.sleep && g.sleep.from) || '22:00' });
  const to = el('input', { type: 'time', value: (g.sleep && g.sleep.to) || '07:00' });
  from.addEventListener('change', () => patchG({ sleep: { ...getState().guardian.sleep, from: from.value } }));
  to.addEventListener('change', () => patchG({ sleep: { ...getState().guardian.sleep, to: to.value } }));

  const locOn = el('input', { type: 'checkbox' });
  locOn.checked = !!g.shareLocation;
  locOn.addEventListener('change', async () => {
    if (locOn.checked) {
      const loc = await getLocation(12000); // тук се появява системният въпрос за разрешение
      if (!loc) { locOn.checked = false; patchG({ shareLocation: false }); toast(t('gd_location_denied')); return; }
      patchG({ shareLocation: true });
      toast(loc.lat.toFixed(4) + ', ' + loc.lon.toFixed(4));
    } else patchG({ shareLocation: false });
  });

  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('gd_settings_title')),
    el('div', { class: 'row' }, [
      el('div', { class: 'grow' }, [el('label', {}, t('gd_hours')), hours]),
      el('div', { class: 'grow' }, [el('label', {}, t('gd_grace')), grace])
    ]),
    el('label', {}, t('gd_my_name')),
    myName,
    el('label', { class: 'row', style: 'margin-top:12px' }, [sleepOn, el('span', {}, ' ' + t('gd_sleep_enable'))]),
    sleepOn.checked ? el('div', { class: 'row' }, [
      el('div', { class: 'grow' }, [el('label', {}, t('rules_from')), from]),
      el('div', { class: 'grow' }, [el('label', {}, t('rules_to')), to])
    ]) : null,
    el('label', { class: 'row', style: 'margin-top:12px' }, [locOn, el('span', {}, ' ' + t('gd_location'))]),
    el('p', { class: 'muted', style: 'margin:4px 0 0' }, t('gd_location_note'))
  ]));

  // --- Близки ---
  const contactsCard = el('div', { class: 'card' }, [
    el('h2', {}, t('gd_contacts_title')),
    el('p', { class: 'muted' }, t('gd_contacts_note'))
  ]);
  if (!(g.contacts || []).length) contactsCard.appendChild(el('div', { class: 'empty' }, t('gd_contacts_empty')));
  (g.contacts || []).forEach((c) => contactsCard.appendChild(contactBox(c, patchG, render)));
  contactsCard.appendChild(el('button', { class: 'btn sm primary', style: 'margin-top:8px', onClick: () => {
    patchG({ contacts: [...(getState().guardian.contacts || []), { id: uid(), name: '', phone: '', pupikesId: '' }] });
    render();
  } }, t('gd_contact_add')));
  root.appendChild(contactsCard);

  // --- Тест + преглед на сигнала ---
  const preview = el('div', {});
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('gd_test_title')),
    el('p', { class: 'muted' }, t('gd_test_note')),
    el('div', { class: 'row wrap' }, [
      el('button', { class: 'btn primary', onClick: () => { simulateSilence(); render(); } }, t('gd_test')),
      el('button', { class: 'btn ghost', onClick: async () => {
        preview.textContent = '…';
        const txt = await composeAlert({ test: true });
        preview.textContent = '';
        preview.appendChild(el('div', { class: 'msg out', style: 'margin:8px 0;max-width:100%' }, txt));
        preview.appendChild(el('div', { class: 'row wrap' }, [
          el('button', { class: 'btn sm ghost', onClick: () => shareText(txt) }, t('gd_send_share'))
        ]));
      } }, t('gd_preview'))
    ]),
    preview
  ]));

  // --- Опашка „за ръчно изпращане" ---
  if ((g.pending || []).length) {
    const pc = el('div', { class: 'card', style: 'border-color:var(--warn)' }, [
      el('div', { class: 'row between' }, [
        el('h2', {}, t('gd_pending_title')),
        el('button', { class: 'btn sm danger', onClick: () => { patchG({ pending: [] }); render(); } }, t('clear'))
      ]),
      el('p', { class: 'muted' }, t('gd_send_pending'))
    ]);
    g.pending.slice().reverse().forEach((p) => {
      pc.appendChild(el('div', { class: 'logrow' }, [
        el('div', { class: 'row between' }, [
          el('strong', {}, '→ ' + (p.name || '?') + (p.phone ? ' · ' + p.phone : '')),
          el('span', { class: 'muted' }, new Date(p.at).toLocaleString(getLang()))
        ]),
        el('div', { class: 'muted', style: 'margin:4px 0' }, p.text),
        el('div', { class: 'row wrap' }, [
          p.phone ? el('button', { class: 'btn sm primary', onClick: () => openSms(p.phone, p.text) }, tf('gd_send_sms', p.name || p.phone)) : null,
          el('button', { class: 'btn sm ghost', onClick: () => shareText(p.text) }, t('gd_send_share')),
          el('button', { class: 'btn sm ghost', onClick: () => { removePending(p.id); render(); } }, t('delete'))
        ])
      ]));
    });
    root.appendChild(pc);
  }

  // --- Делегат за спешни ---
  root.appendChild(delegateCard(render));

  // --- Отговор на езика на подателя ---
  root.appendChild(langReplyCard(render));

  // --- Дневник на проверките ---
  const logCard = el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h2', {}, t('gd_log_title')),
      (g.log || []).length ? el('button', { class: 'btn sm danger', onClick: () => { patchG({ log: [] }); render(); } }, t('clear')) : null
    ])
  ]);
  if (!(g.log || []).length) logCard.appendChild(el('div', { class: 'empty' }, t('gd_log_empty')));
  else (g.log || []).slice(-40).reverse().forEach((e) => logCard.appendChild(el('div', { class: 'logrow row between' }, [
    el('span', {}, logLabel(e)),
    el('span', { class: 'muted' }, new Date(e.at).toLocaleString(getLang()))
  ])));
  root.appendChild(logCard);

  return root;
}

function logLabel(e) {
  const map = {
    asked: t('gd_log_asked'), ok: t('gd_log_ok'), alert: t('gd_log_alert'), sent: t('gd_log_sent'),
    pending: t('gd_log_pending'), forwarded: t('gd_log_forwarded'), on: t('on'), off: t('off')
  };
  const base = map[e.kind] || e.kind;
  return e.note ? base + ' · ' + e.note : base;
}

function contactBox(c, patchG, render) {
  const upd = (p) => patchG({ contacts: (getState().guardian.contacts || []).map((x) => (x.id === c.id ? { ...x, ...p } : x)) });
  const name = el('input', { type: 'text', value: c.name || '', placeholder: t('gd_contact_name') });
  const phone = el('input', { type: 'text', value: c.phone || '', placeholder: '+359…' });
  const pid = el('input', { type: 'text', value: c.pupikesId || '', placeholder: t('gd_contact_pupikes') });
  name.addEventListener('change', () => upd({ name: name.value.trim() }));
  phone.addEventListener('change', () => upd({ phone: phone.value.trim() }));
  pid.addEventListener('change', () => upd({ pupikesId: pid.value.trim() }));
  return el('div', { class: 'tpl' }, [
    el('label', {}, t('gd_contact_name')), name,
    el('label', {}, t('gd_contact_phone')), phone,
    el('label', {}, t('gd_contact_pupikes')), pid,
    el('div', { class: 'row between', style: 'margin-top:8px' }, [
      el('span', {}),
      el('button', { class: 'btn sm danger', onClick: () => {
        patchG({ contacts: (getState().guardian.contacts || []).filter((x) => x.id !== c.id) });
        render();
      } }, t('delete'))
    ])
  ]);
}

function delegateCard(render) {
  const d = getState().delegate || {};
  const patchD = (p) => setState({ delegate: { ...getState().delegate, ...p } });
  const on = el('input', { type: 'checkbox' });
  on.checked = !!d.enabled;
  on.addEventListener('change', () => { patchD({ enabled: on.checked }); render(); });
  const name = el('input', { type: 'text', value: d.name || '', placeholder: t('gd_contact_name') });
  const phone = el('input', { type: 'text', value: d.phone || '', placeholder: '+359…' });
  const pid = el('input', { type: 'text', value: d.pupikesId || '', placeholder: t('gd_contact_pupikes') });
  const kw = el('input', { type: 'text', value: d.keywords || '', placeholder: t('dg_kw_default') });
  const vip = el('input', { type: 'checkbox' });
  vip.checked = d.vip !== false;
  const reply = el('textarea', {}, d.reply || '');
  name.addEventListener('change', () => patchD({ name: name.value.trim() }));
  phone.addEventListener('change', () => patchD({ phone: phone.value.trim() }));
  pid.addEventListener('change', () => patchD({ pupikesId: pid.value.trim() }));
  kw.addEventListener('change', () => patchD({ keywords: kw.value }));
  vip.addEventListener('change', () => patchD({ vip: vip.checked }));
  reply.addEventListener('change', () => patchD({ reply: reply.value }));
  return el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [el('h2', {}, t('dg_title')), el('label', { class: 'row' }, [on, el('span', {}, ' ' + t('dg_enable'))])]),
    el('p', { class: 'muted' }, t('dg_note')),
    on.checked ? el('div', {}, [
      el('label', {}, t('dg_name')), name,
      el('label', {}, t('gd_contact_phone')), phone,
      el('label', {}, t('gd_contact_pupikes')), pid,
      el('label', {}, t('dg_keywords')), kw,
      el('label', { class: 'row', style: 'margin-top:10px' }, [vip, el('span', {}, ' ' + t('dg_vip'))]),
      el('label', {}, t('dg_reply')), reply,
      el('p', { class: 'muted' }, t('dg_reply_vars'))
    ]) : null
  ]);
}

// Пазим последния опит в полето за разпознаване между прерисуванията.
let _probe = '';
function langReplyCard(render) {
  const lr = getState().langReply || {};
  const on = el('input', { type: 'checkbox' });
  on.checked = lr.enabled !== false;
  on.addEventListener('change', () => { setState({ langReply: { ...getState().langReply, enabled: on.checked } }); render(); });
  const probe = el('input', { type: 'text', value: _probe, placeholder: t('demo_message_ph') });
  const out = el('p', { class: 'muted', style: 'margin:6px 0 0' }, '');
  const run = () => {
    _probe = probe.value;
    const code = detectLang(probe.value);
    out.textContent = tf('lr_detected', code ? langNativeName(code) : t('gd_unknown'));
  };
  probe.addEventListener('input', run);
  if (_probe) run();
  return el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [el('h2', {}, t('lr_title')), el('label', { class: 'row' }, [on, el('span', {}, ' ' + t('lr_enable'))])]),
    el('p', { class: 'muted' }, t('lr_note')),
    el('label', {}, t('lr_try')),
    probe,
    out
  ]);
}

function numInput(v, min, max) {
  return el('input', { type: 'number', value: String(v), min: String(min), max: String(max), style: 'width:100%;padding:11px 12px;border-radius:10px;background:var(--bg-soft);color:var(--text);border:1px solid #ffffff1f;font-size:0.95rem' });
}
function clamp(v, min, max, def) {
  const n = parseFloat(v);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function switchEl(checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'switch' }, [input, el('span', { class: 'track' }), el('span', { class: 'knob' })]);
}
