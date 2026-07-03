// Version: 1.0001
// channels.js — екран „Връзки / Канали".
//
// ЯСНО и ЧЕСТНО показва КЪДЕ и КАК се връзва ботът за всеки канал:
//   • WhatsApp / Viber / Messenger — през Android „Notification access" (чете
//     нотификации + direct-reply). Работи само в sideload native билд. Тук виждаш
//     реалния статус (свързан / нужно е разрешение / нужен е native билд) и бутон
//     за даване на разрешението. БЕЗ фалшиво „свързано".
//   • Нашият чат (KCY) — реална HTTP връзка към нашия чат бекенд. Настройваш адрес,
//     твой идентификатор и (по избор) токен; ботът чете нови съобщения и авто-отговаря.
//
import { el, toast } from '../ui/dom.js';
import { t, tf } from '../core/i18n.js';
import { getState, setState } from '../core/storage.js';
import { isNativeReplyAvailable, isAccessGranted, openAccessSettings, getRecent } from '../core/native-reply.js';
import { kcyConfigured, kcyCheck } from '../core/kcy-chat.js';
import { reloadChannels } from '../core/pump.js';

const NATIVE_CHANNELS = [
  { id: 'whatsapp', title: 'WhatsApp', ic: '🟢', pkg: 'com.whatsapp' },
  { id: 'viber', title: 'Viber', ic: '🟣', pkg: 'com.viber.voip' },
  { id: 'messenger', title: 'Facebook Messenger', ic: '🔵', pkg: 'com.facebook.orca' }
];

export function ChannelsScreen({ render }) {
  const root = el('div', {});

  root.appendChild(el('div', { class: 'brand' }, [
    el('div', { class: 'logo' }, '🔗'),
    el('h1', {}, t('ch_title'))
  ]));
  root.appendChild(el('p', { class: 'muted' }, t('ch_intro')));

  // --- Месинджъри (WhatsApp/Viber/Messenger) през Notification access ---
  root.appendChild(messengersBlock(render));

  // --- Нашият чат (KCY) ---
  root.appendChild(kcyBlock(render));

  // --- Демо чат (винаги работи) ---
  root.appendChild(localBlock(render));

  return root;
}

// Обща карта „включи/изключи" + статус-pill + съдържание.
function channelCard({ ic, title, statusEl, enabled, onToggle, children }) {
  const sw = switchEl(enabled, onToggle);
  return el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('div', { class: 'row' }, [el('span', { style: 'font-size:1.3rem' }, ic), el('strong', {}, title)]),
      el('div', { class: 'row' }, [statusEl, sw])
    ]),
    ...(children || [])
  ]);
}

// --- Месинджъри ---------------------------------------------------------------
function messengersBlock(render) {
  const wrap = el('div', {});

  wrap.appendChild(el('h2', {}, t('ch_messengers')));
  const how = el('p', { class: 'muted' }, t('ch_messengers_how'));
  wrap.appendChild(how);

  // Общ статус на native слоя + бутон за разрешението.
  const accessPill = el('span', { class: 'pill off' }, t('ch_status_checking'));
  const accessBtn = el('button', { class: 'btn sm primary', style: 'margin-top:6px' }, t('ch_grant_access'));
  accessBtn.addEventListener('click', async () => {
    const ok = await openAccessSettings();
    if (!ok) toast(t('ch_only_native_settings'));
    else setTimeout(() => refreshAccess(), 1200);
  });

  async function refreshAccess() {
    if (!isNativeReplyAvailable()) {
      accessPill.className = 'pill off';
      accessPill.textContent = t('ch_st_need_native');
      accessBtn.disabled = true;
      for (const c of NATIVE_CHANNELS) updateChannelStatus(c.id, 'no-native');
      return;
    }
    const granted = await isAccessGranted();
    accessPill.className = 'pill ' + (granted ? 'on' : 'away');
    accessPill.textContent = granted ? t('ch_st_access_granted') : t('ch_st_no_access');
    accessBtn.disabled = false;

    // Кои месинджъри реално са изпратили нотификация (т.е. „виждаме" ги).
    let recent = { messages: [], connected: false };
    try { recent = await getRecent(); } catch (_) { /* ignore */ }
    const seenPkgs = new Set((recent.messages || []).map((m) => m.pkg));
    for (const c of NATIVE_CHANNELS) {
      if (!granted) updateChannelStatus(c.id, 'need-access');
      else if (seenPkgs.has(c.pkg)) updateChannelStatus(c.id, 'live');
      else updateChannelStatus(c.id, 'ready');
    }
  }

  wrap.appendChild(el('div', { class: 'card', style: 'background:var(--bg-soft)' }, [
    el('div', { class: 'row between' }, [
      el('strong', {}, t('ch_notif_access')),
      accessPill
    ]),
    el('p', { class: 'muted', style: 'margin:6px 0' }, t('ch_notif_access_note')),
    accessBtn
  ]));

  // Отделна карта за всеки месинджър със собствен статус + вкл/изкл.
  const statusEls = {};
  function updateChannelStatus(id, kind) {
    const elx = statusEls[id];
    if (!elx) return;
    const map = {
      'no-native': ['off', t('ch_st_need_native')],
      'need-access': ['away', t('ch_st_need_grant')],
      ready: ['away', t('ch_st_ready')],
      live: ['on', t('ch_st_live')]
    };
    const [cls, txt] = map[kind] || ['off', t('ch_st_unknown')];
    elx.className = 'pill ' + cls;
    elx.textContent = txt;
  }

  for (const c of NATIVE_CHANNELS) {
    const st = getState();
    const enabled = !(st.channels && st.channels[c.id] && st.channels[c.id].enabled === false);
    const statusEl = el('span', { class: 'pill off' }, '…');
    statusEls[c.id] = statusEl;

    wrap.appendChild(channelCard({
      ic: c.ic,
      title: c.title,
      statusEl,
      enabled,
      onToggle: (on) => {
        const cur = getState();
        setState({ channels: { ...cur.channels, [c.id]: { ...(cur.channels[c.id] || {}), enabled: on } } });
        reloadChannels(render);
        toast(on ? tf('ch_toggle_on', c.title) : tf('ch_toggle_off', c.title));
      },
      children: [
        el('p', { class: 'muted', style: 'margin:6px 0 0' }, tf('ch_pkg_note', c.pkg))
      ]
    }));
  }

  refreshAccess();
  return wrap;
}

// --- Нашият чат (KCY) ---------------------------------------------------------
function kcyBlock(render) {
  const st = getState();
  const cfg = (st.channels && st.channels.kcy) || {};

  const statusEl = el('span', { class: 'pill off' }, kcyConfigured(cfg) ? t('ch_status_checking') : t('ch_status_not_configured'));

  const baseInput = el('input', { type: 'text', value: cfg.baseUrl || 'https://my.girl.place', placeholder: 'https://my.girl.place' });
  // Бързи бутони за двата домейна на нашия чат.
  const pickRow = el('div', { class: 'row', style: 'gap:6px;margin:4px 0' }, [
    el('button', { class: 'btn sm', onClick: () => { baseInput.value = 'https://my.girl.place'; } }, 'my.girl.place'),
    el('button', { class: 'btn sm', onClick: () => { baseInput.value = 'https://kaji.kak.si'; } }, 'kaji.kak.si')
  ]);
  const phoneInput = el('input', { type: 'text', value: cfg.phone || '', placeholder: t('ch_phone_ph') });
  const passInput = el('input', { type: 'text', value: cfg.password || '', placeholder: t('ch_password_ph') });
  const tokenInput = el('input', { type: 'text', value: cfg.token || '', placeholder: t('ch_token_ph') });
  const pollInput = el('input', { type: 'text', value: String(cfg.pollSeconds || 20), placeholder: '20' });

  const save = () => {
    const cur = getState();
    const next = {
      ...(cur.channels.kcy || {}),
      baseUrl: baseInput.value.trim(),
      phone: phoneInput.value.trim(),
      password: passInput.value.trim(),
      token: tokenInput.value.trim(),
      pollSeconds: Math.max(5, parseInt(pollInput.value, 10) || 20)
    };
    setState({ channels: { ...cur.channels, kcy: next } });
    reloadChannels(render);
    toast(t('ch_saved'));
  };

  const testBtn = el('button', { class: 'btn sm' }, t('ch_check'));
  testBtn.addEventListener('click', async () => {
    save();
    statusEl.className = 'pill away';
    statusEl.textContent = t('ch_status_checking');
    const res = await kcyCheck(getState().channels.kcy);
    if (res.ok) {
      statusEl.className = 'pill on';
      statusEl.textContent = t('ch_status_connected');
      toast(tf('ch_check_ok', res.count));
    } else {
      statusEl.className = 'pill off';
      statusEl.textContent = reasonShort(res.reason);
      toast(tf('ch_check_fail', res.note || res.reason));
    }
  });

  const enabled = !!(cfg.enabled);
  const body = [
    el('p', { class: 'muted' }, t('ch_kcy_note')),
    el('label', {}, t('ch_kcy_addr')),
    baseInput,
    pickRow,
    el('label', {}, t('ch_phone')),
    phoneInput,
    el('label', {}, t('ch_password')),
    passInput,
    el('label', {}, t('ch_token')),
    tokenInput,
    el('label', {}, t('ch_poll')),
    pollInput,
    el('div', { class: 'row', style: 'margin-top:10px' }, [
      el('button', { class: 'btn sm primary', onClick: save }, t('save')),
      testBtn
    ])
  ];

  // Асинхронна първоначална проверка на статуса, ако е настроен.
  if (kcyConfigured(cfg)) {
    (async () => {
      const res = await kcyCheck(cfg);
      statusEl.className = 'pill ' + (res.ok ? 'on' : 'off');
      statusEl.textContent = res.ok ? t('ch_status_connected') : reasonShort(res.reason);
    })();
  }

  return el('div', {}, [
    el('h2', {}, t('ch_kcy_title')),
    channelCard({
      ic: '💠',
      title: t('ch_kcy_name'),
      statusEl,
      enabled,
      onToggle: (on) => {
        if (on && !kcyConfigured(getState().channels.kcy)) {
          toast(t('ch_need_config'));
          render();
          return;
        }
        const cur = getState();
        setState({ channels: { ...cur.channels, kcy: { ...(cur.channels.kcy || {}), enabled: on } } });
        reloadChannels(render);
        toast(on ? t('ch_kcy_on') : t('ch_kcy_off'));
      },
      children: body
    })
  ]);
}

function reasonShort(reason) {
  return ({
    'not-configured': t('reason_not_configured'),
    auth: t('reason_auth'),
    network: t('reason_network'),
    http: t('reason_http'),
    'bad-json': t('reason_bad_json')
  })[reason] || t('reason_not_connected');
}

// --- Демо чат -----------------------------------------------------------------
function localBlock(render) {
  const st = getState();
  const enabled = !(st.channels && st.channels.local && st.channels.local.enabled === false);
  return el('div', {}, [
    el('h2', {}, t('ch_demo_title')),
    channelCard({
      ic: '💬',
      title: t('ch_demo_name'),
      statusEl: el('span', { class: 'pill on' }, t('ch_status_works')),
      enabled,
      onToggle: (on) => {
        const cur = getState();
        setState({ channels: { ...cur.channels, local: { ...(cur.channels.local || {}), enabled: on } } });
        toast(on ? t('ch_demo_on') : t('ch_demo_off'));
      },
      children: [
        el('p', { class: 'muted', style: 'margin:6px 0 0' }, t('ch_demo_note'))
      ]
    })
  ]);
}

function switchEl(checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'switch' }, [input, el('span', { class: 'track' }), el('span', { class: 'knob' })]);
}
