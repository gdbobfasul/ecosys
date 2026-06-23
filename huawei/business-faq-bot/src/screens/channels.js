// channels.js — екран „Канали / Връзки".
//
// ЧЕСТНО и ЯСНО показва КЪДЕ и КАК ботът се връзва за всеки канал. Нищо не е
// „свързано" наужким — статусите са реални:
//   • WhatsApp / Viber / Messenger — през Android „Notification access" (четене на
//     нотификации + direct-reply). Работи само в NATIVE билд (sideload APK). Тук
//     виждаш реалния статус (нужен native билд / дай достъп / готово / свързан) и
//     бутон към системния екран.
//   • Нашият чат (KCY) — реална HTTP връзка към чат бекенда. Настройваш адрес +
//     телефон/парола (или готов токен); ботът чете новите съобщения и авто-отговаря
//     през СЪЩИЯ FAQ rule-engine.
//   • Демо чат (local) — вграден sandbox, винаги работи (таб „Демо чат").
//
import { el, toast } from '../ui/dom.js';
import { getState, setState } from '../core/storage.js';
import {
  isNativeReplyAvailable, isAccessGranted, openAccessSettings, getRecent
} from '../core/native-reply.js';
import { kcyConfigured, kcyCheck } from '../core/kcy-chat.js';
import { reloadChannels } from '../core/pump.js';
import { t, tf } from '../core/i18n.js';

const NATIVE_CHANNELS = [
  { id: 'whatsapp', title: 'WhatsApp', ic: '🟢', pkg: 'com.whatsapp' },
  { id: 'viber', title: 'Viber', ic: '🟣', pkg: 'com.viber.voip' },
  { id: 'messenger', title: 'Facebook Messenger', ic: '🔵', pkg: 'com.facebook.orca' }
];

export function renderChannels(root, { navigate, rerender }) {
  root.appendChild(el('header', { class: 'page-head' }, [
    el('h1', {}, t('ch_title')),
    el('p', { class: 'lead' }, t('ch_lead'))
  ]));

  // 1) Месинджъри (WhatsApp/Viber/Messenger) през Notification access.
  root.appendChild(messengersBlock(rerender));

  // 2) Нашият чат (KCY) — реална HTTP връзка.
  root.appendChild(kcyBlock(rerender));

  // 3) Демо чат (винаги работи).
  root.appendChild(localBlock(rerender));

  root.appendChild(el('div', { class: 'row gap' }, [
    el('button', { class: 'btn primary', onclick: () => navigate('chat') }, t('kb_test_in_demo')),
    el('button', { class: 'btn ghost', onclick: () => navigate('dashboard') }, t('to_dashboard'))
  ]));
}

// Малък превключвател, който чете/пише плоско булево в channels[id].
function flatSwitch(id, onToggle) {
  const enabled = !!getState().channels[id];
  const input = el('input', { type: 'checkbox' });
  input.checked = enabled;
  input.addEventListener('change', () => onToggle(input.checked));
  return el('label', { class: 'switch' }, [input, el('span', {}, input.checked ? t('on') : t('off'))]);
}

// --- Месинджъри ---------------------------------------------------------------
function messengersBlock(rerender) {
  const wrap = el('div', {});
  wrap.appendChild(el('h2', { style: 'margin-top:6px' }, t('ch_messengers')));

  wrap.appendChild(el('section', { class: 'card warn' }, [
    el('p', {}, t('ch_messengers_warn')),
    el('p', { class: 'muted small' }, t('ch_messengers_warn2'))
  ]));

  // Общ статус на native слоя + бутон за разрешението.
  const accessPill = el('span', { class: 'pill pending' }, t('ch_access_checking'));
  const accessBtn = el('button', { class: 'btn tiny primary', style: 'margin-top:8px' }, t('ch_give_access'));
  accessBtn.addEventListener('click', async () => {
    const ok = await openAccessSettings();
    if (!ok) toast(t('ch_access_only_native'));
    else setTimeout(() => refreshAccess(), 1200);
  });

  const statusEls = {};
  function updateChannelStatus(id, kind) {
    const elx = statusEls[id];
    if (!elx) return;
    const map = {
      'no-native': ['pending', t('ch_st_no_native')],
      'need-access': ['pending', t('ch_st_need_access')],
      ready: ['pending', t('ch_st_ready')],
      live: ['ok', t('ch_st_live')],
      off: ['fallback', t('ch_st_off')]
    };
    const [cls, txt] = map[kind] || ['pending', t('ch_st_unknown')];
    elx.className = 'pill ' + cls;
    elx.textContent = txt;
  }

  async function refreshAccess() {
    if (!isNativeReplyAvailable()) {
      accessPill.className = 'pill pending';
      accessPill.textContent = t('ch_access_need_native');
      accessBtn.disabled = true;
      for (const c of NATIVE_CHANNELS) {
        updateChannelStatus(c.id, getState().channels[c.id] ? 'no-native' : 'off');
      }
      return;
    }
    const granted = await isAccessGranted();
    accessPill.className = 'pill ' + (granted ? 'ok' : 'pending');
    accessPill.textContent = granted ? t('ch_access_granted') : t('ch_access_none');
    accessBtn.disabled = false;

    let recent = { messages: [] };
    try { recent = await getRecent(); } catch (_) { /* ignore */ }
    const seenPkgs = new Set((recent.messages || []).map((m) => m.pkg));
    for (const c of NATIVE_CHANNELS) {
      if (!getState().channels[c.id]) updateChannelStatus(c.id, 'off');
      else if (!granted) updateChannelStatus(c.id, 'need-access');
      else if (seenPkgs.has(c.pkg)) updateChannelStatus(c.id, 'live');
      else updateChannelStatus(c.id, 'ready');
    }
  }

  wrap.appendChild(el('section', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('strong', {}, t('ch_notif_access')),
      accessPill
    ]),
    el('p', { class: 'muted small' }, t('ch_notif_access_hint')),
    accessBtn
  ]));

  for (const c of NATIVE_CHANNELS) {
    const statusEl = el('span', { class: 'pill pending' }, '…');
    statusEls[c.id] = statusEl;

    wrap.appendChild(el('section', { class: 'card' }, [
      el('div', { class: 'channel-head' }, [
        el('span', { class: 'channel-icon' }, c.ic),
        el('strong', {}, c.title),
        statusEl,
        flatSwitch(c.id, (on) => {
          setState({ channels: { ...getState().channels, [c.id]: on } });
          reloadChannels(rerender);
          toast(on ? tf('ch_toggle_on', c.title) : tf('ch_toggle_off', c.title));
          rerender();
        })
      ]),
      el('p', { class: 'muted small' }, tf('ch_pkg_note', c.pkg))
    ]));
  }

  refreshAccess();
  return wrap;
}

// --- Нашият чат (KCY) ---------------------------------------------------------
function kcyBlock(rerender) {
  const cfg = (getState().channels && getState().channels.kcy) || {};

  const statusEl = el('span', { class: 'pill pending' }, kcyConfigured(cfg) ? t('ch_access_checking') : t('ch_not_configured'));

  const baseInput = el('input', { class: 'input', type: 'text', value: cfg.baseUrl || '', placeholder: 'https://my.girl.place' });
  const phoneInput = el('input', { class: 'input', type: 'text', value: cfg.phone || '', placeholder: t('ch_phone_ph') });
  const passInput = el('input', { class: 'input', type: 'text', value: cfg.password || '', placeholder: t('ch_password_ph') });
  const tokenInput = el('input', { class: 'input', type: 'text', value: cfg.token || '', placeholder: t('ch_token_ph') });
  const pollInput = el('input', { class: 'input', type: 'text', value: String(cfg.pollSeconds || 20), placeholder: '20' });

  function readForm() {
    const cur = getState();
    return {
      ...(cur.channels.kcy || {}),
      baseUrl: baseInput.value.trim(),
      phone: phoneInput.value.trim(),
      password: passInput.value.trim(),
      token: tokenInput.value.trim(),
      pollSeconds: Math.max(5, parseInt(pollInput.value, 10) || 20)
    };
  }

  const save = () => {
    const cur = getState();
    setState({ channels: { ...cur.channels, kcy: readForm() } });
    reloadChannels(rerender);
    toast(t('ch_kcy_saved'));
  };

  const testBtn = el('button', { class: 'btn tiny' }, t('ch_check'));
  testBtn.addEventListener('click', async () => {
    save();
    statusEl.className = 'pill pending';
    statusEl.textContent = t('ch_access_checking');
    const res = await kcyCheck(getState().channels.kcy);
    if (res.ok) {
      statusEl.className = 'pill ok';
      statusEl.textContent = t('ch_connected');
      toast(tf('ch_check_ok', res.count));
    } else {
      statusEl.className = 'pill fallback';
      statusEl.textContent = reasonShort(res.reason);
      toast(tf('ch_check_fail', (res.note || res.reason)));
    }
  });

  const kcyToggle = (() => {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!cfg.enabled;
    input.addEventListener('change', () => {
      const on = input.checked;
      if (on && !kcyConfigured(readForm())) {
        toast(t('ch_kcy_need_config'));
        input.checked = false;
        return;
      }
      const cur = getState();
      // Записваме и формата, и флага наведнъж, за да не се губят неспазените полета.
      setState({ channels: { ...cur.channels, kcy: { ...readForm(), enabled: on } } });
      reloadChannels(rerender);
      toast(on ? t('ch_kcy_on') : t('ch_kcy_off'));
    });
    return el('label', { class: 'switch' }, [input, el('span', {}, '')]);
  })();

  // Асинхронна първоначална проверка, ако е настроен.
  if (kcyConfigured(cfg)) {
    (async () => {
      const res = await kcyCheck(cfg);
      statusEl.className = 'pill ' + (res.ok ? 'ok' : 'fallback');
      statusEl.textContent = res.ok ? t('ch_connected') : reasonShort(res.reason);
    })();
  }

  return el('div', {}, [
    el('h2', { style: 'margin-top:6px' }, t('ch_kcy_title')),
    el('section', { class: 'card' }, [
      el('div', { class: 'channel-head' }, [
        el('span', { class: 'channel-icon' }, '💠'),
        el('strong', {}, t('ch_kcy_name')),
        statusEl,
        kcyToggle
      ]),
      el('p', { class: 'muted small' }, t('ch_kcy_desc')),
      el('label', {}, t('ch_kcy_baseurl')), baseInput,
      el('label', {}, t('ch_phone')), phoneInput,
      el('label', {}, t('ch_password')), passInput,
      el('label', {}, t('ch_token')), tokenInput,
      el('label', {}, t('ch_poll')), pollInput,
      el('div', { class: 'row gap', style: 'margin-top:10px' }, [
        el('button', { class: 'btn tiny primary', onclick: save }, t('save')),
        testBtn
      ]),
      el('p', { class: 'muted small', style: 'margin-top:8px' }, t('ch_kcy_cors_note'))
    ])
  ]);
}

function reasonShort(reason) {
  return ({
    'not-configured': t('ch_not_configured'),
    auth: t('ch_r_auth'),
    'no-account': t('ch_r_no_account'),
    network: t('ch_r_network'),
    forbidden: t('ch_r_forbidden'),
    http: t('ch_r_http'),
    'bad-json': t('ch_r_bad_json')
  })[reason] || t('ch_r_not_connected');
}

// --- Демо чат -----------------------------------------------------------------
function localBlock(rerender) {
  return el('div', {}, [
    el('h2', { style: 'margin-top:6px' }, t('ch_demo_title')),
    el('section', { class: 'card' }, [
      el('div', { class: 'channel-head' }, [
        el('span', { class: 'channel-icon' }, '💬'),
        el('strong', {}, t('ch_demo_name')),
        el('span', { class: 'pill ok' }, t('ch_demo_works')),
        // local е винаги вкл. — показваме заключен превключвател.
        (() => {
          const input = el('input', { type: 'checkbox' });
          input.checked = true; input.disabled = true;
          return el('label', { class: 'switch' }, [input, el('span', {}, t('on'))]);
        })()
      ]),
      el('p', { class: 'muted small' }, t('ch_demo_desc'))
    ])
  ]);
}
