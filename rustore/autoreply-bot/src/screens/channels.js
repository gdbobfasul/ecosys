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
    el('h1', {}, 'Връзки / Канали')
  ]));
  root.appendChild(el('p', { class: 'muted' },
    'Тук виждаш КЪДЕ и КАК ботът се връзва към всеки канал. Нищо не е „свързано" наужким — ' +
    'статусите са реални.'));

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

  wrap.appendChild(el('h2', {}, '💬 Месинджъри'));
  const how = el('p', { class: 'muted' },
    'WhatsApp, Viber и Facebook Messenger нямат безплатен официален начин трета страна да ' +
    'отговаря вместо теб. Единственият on-device начин е чрез системния „Notification access": ' +
    'ботът ЧЕТЕ входящите нотификации и отговаря през бутона „Reply" в самата нотификация — ' +
    'без да отваря приложението. Работи само на реално устройство със sideload (native) билд. ' +
    'Магазините ограничават този достъп, затова в магазинния билд може да не е наличен.');
  wrap.appendChild(how);

  // Общ статус на native слоя + бутон за разрешението.
  const accessPill = el('span', { class: 'pill off' }, 'проверка…');
  const accessBtn = el('button', { class: 'btn sm primary', style: 'margin-top:6px' }, 'Дай „Notification access"');
  accessBtn.addEventListener('click', async () => {
    const ok = await openAccessSettings();
    if (!ok) toast('Налично само на устройство с native билд (sideload APK).');
    else setTimeout(() => refreshAccess(), 1200);
  });

  async function refreshAccess() {
    if (!isNativeReplyAvailable()) {
      accessPill.className = 'pill off';
      accessPill.textContent = 'нужен е native билд';
      accessBtn.disabled = true;
      for (const c of NATIVE_CHANNELS) updateChannelStatus(c.id, 'no-native');
      return;
    }
    const granted = await isAccessGranted();
    accessPill.className = 'pill ' + (granted ? 'on' : 'away');
    accessPill.textContent = granted ? 'достъп даден' : 'няма достъп';
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
      el('strong', {}, '🔐 Notification access'),
      accessPill
    ]),
    el('p', { class: 'muted', style: 'margin:6px 0' },
      'Едно системно разрешение, общо за трите месинджъра. Без него ботът не може да чете/отговаря.'),
    accessBtn
  ]));

  // Отделна карта за всеки месинджър със собствен статус + вкл/изкл.
  const statusEls = {};
  function updateChannelStatus(id, kind) {
    const elx = statusEls[id];
    if (!elx) return;
    const map = {
      'no-native': ['off', 'нужен е native билд'],
      'need-access': ['away', 'дай „Notification access"'],
      ready: ['away', 'готово — чака съобщение'],
      live: ['on', 'свързан (виждам съобщения)']
    };
    const [cls, txt] = map[kind] || ['off', 'неизвестно'];
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
        toast(on ? `${c.title}: авто-отговорът е включен` : `${c.title}: спрян`);
      },
      children: [
        el('p', { class: 'muted', style: 'margin:6px 0 0' },
          `Пакет: ${c.pkg}. Авто-отговорът тръгва, щом дойде нотификация с бутон „Reply".`)
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

  const statusEl = el('span', { class: 'pill off' }, kcyConfigured(cfg) ? 'проверка…' : 'не е настроен');

  const baseInput = el('input', { type: 'text', value: cfg.baseUrl || '', placeholder: 'https://my.girl.place' });
  const phoneInput = el('input', { type: 'text', value: cfg.phone || '', placeholder: 'телефон (международен формат)' });
  const passInput = el('input', { type: 'text', value: cfg.password || '', placeholder: 'парола' });
  const tokenInput = el('input', { type: 'text', value: cfg.token || '', placeholder: 'готов Bearer токен (по избор)' });
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
    toast('Настройките за нашия чат са запазени.');
  };

  const testBtn = el('button', { class: 'btn sm' }, 'Провери връзката');
  testBtn.addEventListener('click', async () => {
    save();
    statusEl.className = 'pill away';
    statusEl.textContent = 'проверка…';
    const res = await kcyCheck(getState().channels.kcy);
    if (res.ok) {
      statusEl.className = 'pill on';
      statusEl.textContent = 'свързан';
      toast(`Връзката работи. Намерени съобщения: ${res.count}.`);
    } else {
      statusEl.className = 'pill off';
      statusEl.textContent = reasonShort(res.reason);
      toast('Връзката не успя: ' + (res.note || res.reason));
    }
  });

  const enabled = !!(cfg.enabled);
  const body = [
    el('p', { class: 'muted' },
      'Това е НАШИЯТ чат. За разлика от месинджърите тук връзката е директна по HTTP към чат ' +
      'бекенда: ботът влиза с твоя акаунт, чете новите съобщения от разговорите и праща ' +
      'авто-отговор. Ботът отговаря само на хора, които вече са ти приятели в чата. ' +
      'Всичко се пази само на устройството.'),
    el('label', {}, 'Адрес на чата (base URL)'),
    baseInput,
    el('label', {}, 'Телефон'),
    phoneInput,
    el('label', {}, 'Парола'),
    passInput,
    el('label', {}, 'или: готов Bearer токен (вместо телефон+парола)'),
    tokenInput,
    el('label', {}, 'Проверявай за нови съобщения на (секунди)'),
    pollInput,
    el('div', { class: 'row', style: 'margin-top:10px' }, [
      el('button', { class: 'btn sm primary', onClick: save }, 'Запази'),
      testBtn
    ])
  ];

  // Асинхронна първоначална проверка на статуса, ако е настроен.
  if (kcyConfigured(cfg)) {
    (async () => {
      const res = await kcyCheck(cfg);
      statusEl.className = 'pill ' + (res.ok ? 'on' : 'off');
      statusEl.textContent = res.ok ? 'свързан' : reasonShort(res.reason);
    })();
  }

  return el('div', {}, [
    el('h2', {}, '🤖 Нашият чат (KCY)'),
    channelCard({
      ic: '💠',
      title: 'KCY чат',
      statusEl,
      enabled,
      onToggle: (on) => {
        if (on && !kcyConfigured(getState().channels.kcy)) {
          toast('Първо въведи адрес и идентификатор, после включи.');
          render();
          return;
        }
        const cur = getState();
        setState({ channels: { ...cur.channels, kcy: { ...(cur.channels.kcy || {}), enabled: on } } });
        reloadChannels(render);
        toast(on ? 'KCY: авто-отговорът е включен' : 'KCY: спрян');
      },
      children: body
    })
  ]);
}

function reasonShort(reason) {
  return ({
    'not-configured': 'не е настроен',
    auth: 'грешен токен',
    network: 'няма връзка',
    http: 'грешка от сървъра',
    'bad-json': 'лош отговор'
  })[reason] || 'не е свързан';
}

// --- Демо чат -----------------------------------------------------------------
function localBlock(render) {
  const st = getState();
  const enabled = !(st.channels && st.channels.local && st.channels.local.enabled === false);
  return el('div', {}, [
    el('h2', {}, '🧪 Демо чат'),
    channelCard({
      ic: '💬',
      title: 'Демо чат (в приложението)',
      statusEl: el('span', { class: 'pill on' }, 'работи'),
      enabled,
      onToggle: (on) => {
        const cur = getState();
        setState({ channels: { ...cur.channels, local: { ...(cur.channels.local || {}), enabled: on } } });
        toast(on ? 'Демо чатът е включен' : 'Демо чатът е спрян');
      },
      children: [
        el('p', { class: 'muted', style: 'margin:6px 0 0' },
          'Вграден sandbox за тестване на правилата. Не докосва системата. Тествай в таб „Demo".')
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
