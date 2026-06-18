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

const NATIVE_CHANNELS = [
  { id: 'whatsapp', title: 'WhatsApp', ic: '🟢', pkg: 'com.whatsapp' },
  { id: 'viber', title: 'Viber', ic: '🟣', pkg: 'com.viber.voip' },
  { id: 'messenger', title: 'Facebook Messenger', ic: '🔵', pkg: 'com.facebook.orca' }
];

export function renderChannels(root, { navigate, rerender }) {
  root.appendChild(el('header', { class: 'page-head' }, [
    el('h1', {}, 'Канали / Връзки'),
    el('p', { class: 'lead' },
      'Тук виждаш КЪДЕ и КАК ботът се връзва за всеки канал. Статусите са реални — ' +
      'нищо не е „свързано" наужким. Правилата (базата знания) са еднакви за всички канали.')
  ]));

  // 1) Месинджъри (WhatsApp/Viber/Messenger) през Notification access.
  root.appendChild(messengersBlock(rerender));

  // 2) Нашият чат (KCY) — реална HTTP връзка.
  root.appendChild(kcyBlock(rerender));

  // 3) Демо чат (винаги работи).
  root.appendChild(localBlock(rerender));

  root.appendChild(el('div', { class: 'row gap' }, [
    el('button', { class: 'btn primary', onclick: () => navigate('chat') }, 'Тествай в демо чата →'),
    el('button', { class: 'btn ghost', onclick: () => navigate('dashboard') }, 'Към таблото')
  ]));
}

// Малък превключвател, който чете/пише плоско булево в channels[id].
function flatSwitch(id, onToggle) {
  const enabled = !!getState().channels[id];
  const input = el('input', { type: 'checkbox' });
  input.checked = enabled;
  input.addEventListener('change', () => onToggle(input.checked));
  return el('label', { class: 'switch' }, [input, el('span', {}, input.checked ? 'вкл.' : 'изкл.')]);
}

// --- Месинджъри ---------------------------------------------------------------
function messengersBlock(rerender) {
  const wrap = el('div', {});
  wrap.appendChild(el('h2', { style: 'margin-top:6px' }, '💬 Месинджъри'));

  wrap.appendChild(el('section', { class: 'card warn' }, [
    el('p', {},
      'WhatsApp, Viber и Facebook Messenger нямат безплатен официален начин трета страна да ' +
      'отговаря вместо теб. Единственият on-device начин е чрез системния „Notification access": ' +
      'ботът ЧЕТЕ входящите нотификации и отговаря през бутона „Reply" в самата нотификация — ' +
      'без да отваря приложението.'),
    el('p', { class: 'muted small' },
      'Работи само на реално устройство с NATIVE билд (опция 38, виж native/notification-reply/). ' +
      'Магазините ограничават този достъп, затова в магазинния билд може да не е наличен. ' +
      'Тук НЕ симулираме изпращане.')
  ]));

  // Общ статус на native слоя + бутон за разрешението.
  const accessPill = el('span', { class: 'pill pending' }, 'проверка…');
  const accessBtn = el('button', { class: 'btn tiny primary', style: 'margin-top:8px' }, 'Дай „Notification access"');
  accessBtn.addEventListener('click', async () => {
    const ok = await openAccessSettings();
    if (!ok) toast('Налично само на устройство с native билд (sideload APK).');
    else setTimeout(() => refreshAccess(), 1200);
  });

  const statusEls = {};
  function updateChannelStatus(id, kind) {
    const elx = statusEls[id];
    if (!elx) return;
    const map = {
      'no-native': ['pending', 'нужен е native билд'],
      'need-access': ['pending', 'дай „Notification access"'],
      ready: ['pending', 'готово — чака съобщение'],
      live: ['ok', 'свързан (виждам съобщения)'],
      off: ['fallback', 'изключен']
    };
    const [cls, txt] = map[kind] || ['pending', 'неизвестно'];
    elx.className = 'pill ' + cls;
    elx.textContent = txt;
  }

  async function refreshAccess() {
    if (!isNativeReplyAvailable()) {
      accessPill.className = 'pill pending';
      accessPill.textContent = 'нужен е native билд';
      accessBtn.disabled = true;
      for (const c of NATIVE_CHANNELS) {
        updateChannelStatus(c.id, getState().channels[c.id] ? 'no-native' : 'off');
      }
      return;
    }
    const granted = await isAccessGranted();
    accessPill.className = 'pill ' + (granted ? 'ok' : 'pending');
    accessPill.textContent = granted ? 'достъп даден' : 'няма достъп';
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
      el('strong', {}, '🔐 Notification access'),
      accessPill
    ]),
    el('p', { class: 'muted small' },
      'Едно системно разрешение, общо за трите месинджъра. Без него ботът не може да чете/отговаря.'),
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
          toast(on ? `${c.title}: авто-отговорът е включен` : `${c.title}: спрян`);
          rerender();
        })
      ]),
      el('p', { class: 'muted small' },
        `Пакет: ${c.pkg}. Авто-отговорът тръгва, щом дойде нотификация с бутон „Reply".`)
    ]));
  }

  refreshAccess();
  return wrap;
}

// --- Нашият чат (KCY) ---------------------------------------------------------
function kcyBlock(rerender) {
  const cfg = (getState().channels && getState().channels.kcy) || {};

  const statusEl = el('span', { class: 'pill pending' }, kcyConfigured(cfg) ? 'проверка…' : 'не е настроен');

  const baseInput = el('input', { class: 'input', type: 'text', value: cfg.baseUrl || '', placeholder: 'https://my.girl.place' });
  const phoneInput = el('input', { class: 'input', type: 'text', value: cfg.phone || '', placeholder: 'телефон (международен формат)' });
  const passInput = el('input', { class: 'input', type: 'text', value: cfg.password || '', placeholder: 'парола' });
  const tokenInput = el('input', { class: 'input', type: 'text', value: cfg.token || '', placeholder: 'готов Bearer токен (по избор)' });
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
    toast('Настройките за нашия чат са запазени.');
  };

  const testBtn = el('button', { class: 'btn tiny' }, 'Провери връзката');
  testBtn.addEventListener('click', async () => {
    save();
    statusEl.className = 'pill pending';
    statusEl.textContent = 'проверка…';
    const res = await kcyCheck(getState().channels.kcy);
    if (res.ok) {
      statusEl.className = 'pill ok';
      statusEl.textContent = 'свързан';
      toast(`Връзката работи. Намерени разговори: ${res.count}.`);
    } else {
      statusEl.className = 'pill fallback';
      statusEl.textContent = reasonShort(res.reason);
      toast('Връзката не успя: ' + (res.note || res.reason));
    }
  });

  const kcyToggle = (() => {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!cfg.enabled;
    input.addEventListener('change', () => {
      const on = input.checked;
      if (on && !kcyConfigured(readForm())) {
        toast('Първо въведи адрес и телефон/парола (или токен), после включи.');
        input.checked = false;
        return;
      }
      const cur = getState();
      // Записваме и формата, и флага наведнъж, за да не се губят неспазените полета.
      setState({ channels: { ...cur.channels, kcy: { ...readForm(), enabled: on } } });
      reloadChannels(rerender);
      toast(on ? 'KCY: авто-отговорът е включен' : 'KCY: спрян');
    });
    return el('label', { class: 'switch' }, [input, el('span', {}, '')]);
  })();

  // Асинхронна първоначална проверка, ако е настроен.
  if (kcyConfigured(cfg)) {
    (async () => {
      const res = await kcyCheck(cfg);
      statusEl.className = 'pill ' + (res.ok ? 'ok' : 'fallback');
      statusEl.textContent = res.ok ? 'свързан' : reasonShort(res.reason);
    })();
  }

  return el('div', {}, [
    el('h2', { style: 'margin-top:6px' }, '🤖 Нашият чат (KCY)'),
    el('section', { class: 'card' }, [
      el('div', { class: 'channel-head' }, [
        el('span', { class: 'channel-icon' }, '💠'),
        el('strong', {}, 'KCY чат'),
        statusEl,
        kcyToggle
      ]),
      el('p', { class: 'muted small' },
        'Реална HTTP връзка към НАШИЯ чат бекенд: ботът влиза с твоя акаунт, чете новите ' +
        'съобщения от разговорите и праща авто-отговор по СЪЩИТЕ FAQ правила. Отговаря само на ' +
        'хора, които вече са ти приятели в чата. Всичко се пази само на устройството.'),
      el('label', {}, 'Адрес на чата (base URL)'), baseInput,
      el('label', {}, 'Телефон'), phoneInput,
      el('label', {}, 'Парола'), passInput,
      el('label', {}, 'или: готов Bearer токен (вместо телефон+парола)'), tokenInput,
      el('label', {}, 'Проверявай за нови съобщения на (секунди)'), pollInput,
      el('div', { class: 'row gap', style: 'margin-top:10px' }, [
        el('button', { class: 'btn tiny primary', onclick: save }, 'Запази'),
        testBtn
      ]),
      el('p', { class: 'muted small', style: 'margin-top:8px' },
        'Бележка: в native билд заявките тръгват от origin „https://localhost" — чат бекендът трябва ' +
        'да го разрешава в ALLOWED_ORIGINS. При CORS/мрежова грешка тук ще видиш честно „няма връзка".')
    ])
  ]);
}

function reasonShort(reason) {
  return ({
    'not-configured': 'не е настроен',
    auth: 'грешен вход',
    'no-account': 'няма акаунт',
    network: 'няма връзка',
    forbidden: 'не е разрешено',
    http: 'грешка от сървъра',
    'bad-json': 'лош отговор'
  })[reason] || 'не е свързан';
}

// --- Демо чат -----------------------------------------------------------------
function localBlock(rerender) {
  return el('div', {}, [
    el('h2', { style: 'margin-top:6px' }, '🧪 Демо чат'),
    el('section', { class: 'card' }, [
      el('div', { class: 'channel-head' }, [
        el('span', { class: 'channel-icon' }, '💬'),
        el('strong', {}, 'Демо чат (в приложението)'),
        el('span', { class: 'pill ok' }, 'работи'),
        // local е винаги вкл. — показваме заключен превключвател.
        (() => {
          const input = el('input', { type: 'checkbox' });
          input.checked = true; input.disabled = true;
          return el('label', { class: 'switch' }, [input, el('span', {}, 'вкл.')]);
        })()
      ]),
      el('p', { class: 'muted small' },
        'Вграден sandbox за тестване на правилата. Не докосва системата. Тествай в таб „Демо чат".')
    ])
  ]);
}
