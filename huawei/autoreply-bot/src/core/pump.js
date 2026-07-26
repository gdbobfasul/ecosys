// Version: 1.0001
// pump.js — „двигателят" на реалните канали.
//
// Свързва входа от каналите с rule-engine-а и изпраща авто-отговорите:
//   • Pupikes (нашият чат)            — polling по HTTP (pupikes-chat.js)
//   • WhatsApp/Viber/Messenger    — push event от native плъгина (native-reply.js)
//
// Стартира се веднъж от main.js. Не дублира отговори (пази „seen"). Деградира
// честно: ако канал не е наличен/настроен, просто не прави нищо за него.

import { getState, setState, uid } from './storage.js';
import { t, tf } from './i18n.js';
import { decideReply } from './rule-engine.js';
import { notifyAutoReply } from './notifier.js';
import { toast } from '../ui/dom.js';
import { pupikesConfigured, pupikesFetchFriends, pupikesFetchConversation, pupikesSend, pupikesResetSession } from './pupikes-chat.js';
import { isNativeReplyAvailable, isAccessGranted, onMessage, replyTo } from './native-reply.js';

let _started = false;
let _pupikesTimer = null;
let _pupikesBusy = false;
let _unsubNative = null;

// Помощник: добавя ред в дневника.
function logReply({ channel, sender, incoming, reply, ruleId, mode }) {
  const cur = getState();
  setState({
    log: [...cur.log, {
      at: Date.now(), channel, sender, incoming, reply, ruleId, mode
    }]
  });
}

// Обработва едно входящо съобщение от РЕАЛЕН канал и (ако трябва) отговаря.
// deliver(reply) трябва да върне { ok } и сам да знае КЪДЕ да прати отговора.
async function processIncoming({ channel, sender, text }, deliver, onRendered) {
  const st = getState();
  if (!st.robotOn) return;
  if (st.channels && st.channels[channel] && st.channels[channel].enabled === false) return;

  const decision = decideReply({
    message: { sender, text },
    rules: st.rules,
    lists: st.lists,
    schedule: st.schedule,
    when: new Date()
  });
  if (!decision) return;

  let res;
  try {
    res = await deliver(decision.reply);
  } catch (e) {
    res = { ok: false, note: String(e && e.message ? e.message : e) };
  }

  if (res && res.ok) {
    logReply({
      channel, sender, incoming: text, reply: decision.reply,
      ruleId: decision.ruleId, mode: decision.mode
    });
    await notifyAutoReply({ sender: `${channelLabel(channel)} · ${sender}`, reply: decision.reply }, (msg) => toast(msg));
    if (typeof onRendered === 'function') onRendered(decision);
  } else {
    toast(tf('pump_send_failed', channelLabel(channel), (res && res.note) || t('err_unknown')));
  }
}

function channelLabel(id) {
  return ({ pupikes: t('chan_our_chat'), whatsapp: 'WhatsApp', viber: 'Viber', messenger: 'Messenger', local: t('chan_demo') })[id] || id;
}

// --- Pupikes polling --------------------------------------------------------------

// Един такт на Pupikes: намираме разговори с непрочетени → авто-отговор на новите
// ПОЛУЧЕНИ съобщения, на които още не сме отговаряли.
async function pupikesTick(render) {
  if (_pupikesBusy) return;
  const st = getState();
  const cfg = st.channels && st.channels.pupikes;
  if (!st.robotOn || !cfg || cfg.enabled === false || !pupikesConfigured(cfg)) return;

  _pupikesBusy = true;
  let didReply = false;
  try {
    const fr = await pupikesFetchFriends(cfg);
    if (!fr.ok) return; // статусът се вижда в екран „Връзки"

    // Само разговори с непрочетени съобщения (естественият сигнал за „ново").
    const pending = fr.friends.filter((f) => (parseInt(f.unread, 10) || 0) > 0);

    for (const friend of pending) {
      const friendId = String(friend.userId);
      const conv = await pupikesFetchConversation(cfg, friendId);
      if (!conv.ok) continue;

      const seenAll = getState().seen || {};
      const fseen = (seenAll.pupikes && seenAll.pupikes[friendId]) || { lastTs: 0, ids: [] };

      // Само ПОЛУЧЕНИ (sent === false), още необработени, в реда на пристигане.
      const incoming = conv.messages
        .filter((m) => m && m.sent === false)
        .filter((m) => !fseen.ids.includes(String(m.id)))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      if (incoming.length === 0) continue;

      // Отговаряме само на ПОСЛЕДНОТО получено (за да не спамим серия), но маркираме
      // всички като обработени, за да не ги пипаме пак.
      const last = incoming[incoming.length - 1];
      const senderName = friend.displayName || friend.fullName || friendId;

      await processIncoming(
        { channel: 'pupikes', sender: senderName, text: last.text },
        (reply) => pupikesSend(cfg, { friendId, text: reply })
      );
      didReply = true;

      let lastTs = fseen.lastTs;
      const ids = [...fseen.ids];
      for (const m of incoming) {
        ids.push(String(m.id));
        if ((m.timestamp || 0) > lastTs) lastTs = m.timestamp || 0;
      }
      const curSeen = getState().seen || {};
      const curPupikes = curSeen.pupikes || {};
      setState({
        seen: { ...curSeen, pupikes: { ...curPupikes, [friendId]: { lastTs, ids: ids.slice(-200) } } }
      });
    }

    if (didReply && typeof render === 'function') render();
  } finally {
    _pupikesBusy = false;
  }
}

function startPupikesPolling(render) {
  stopPupikesPolling();
  pupikesResetSession(); // нова настройка → нова сесия (re-login при нужда)
  const st = getState();
  const cfg = st.channels && st.channels.pupikes;
  const secs = Math.max(5, parseInt((cfg && cfg.pollSeconds) || 20, 10) || 20);
  // Веднага един такт, после на интервал.
  pupikesTick(render);
  _pupikesTimer = setInterval(() => pupikesTick(render), secs * 1000);
}

function stopPupikesPolling() {
  if (_pupikesTimer) { clearInterval(_pupikesTimer); _pupikesTimer = null; }
}

// --- Native месинджъри (push event) ------------------------------------------

function startNativeListener(render) {
  if (_unsubNative) { _unsubNative(); _unsubNative = null; }
  if (!isNativeReplyAvailable()) return;

  _unsubNative = onMessage(async (msg) => {
    // msg: { key, pkg, sender, text, postedAt, canReply }
    if (!msg || !msg.text) return;
    const channel = pkgToChannel(msg.pkg);
    if (!channel) return;
    const st = getState();
    if (st.channels && st.channels[channel] && st.channels[channel].enabled === false) return;

    await processIncoming(
      { channel, sender: msg.sender || t('sender_unknown'), text: msg.text },
      async (reply) => {
        const access = await isAccessGranted();
        if (!access) return { ok: false, note: t('core_no_access') };
        if (!msg.key || !msg.canReply) return { ok: false, note: t('core_no_reply_field') };
        try {
          const r = await replyTo({ key: msg.key, text: reply });
          return { ok: !!r.ok, note: r.ok ? '' : t('core_reply_failed') };
        } catch (e) {
          return { ok: false, note: String(e && e.message ? e.message : e) };
        }
      },
      () => { if (typeof render === 'function') render(); }
    );
  });
}

function pkgToChannel(pkg) {
  return ({
    'com.whatsapp': 'whatsapp',
    'com.viber.voip': 'viber',
    'com.facebook.orca': 'messenger'
  })[pkg] || null;
}

// --- Публично API -------------------------------------------------------------

// Стартира двигателя (еднократно). render() се вика при нов отговор, за да опресни UI.
export function startPump(render) {
  if (!_started) {
    _started = true;
    startNativeListener(render);
  }
  // Pupikes-таймерът се пуска/спира при всяка промяна в настройките.
  startPupikesPolling(render);
}

// Презарежда каналите след промяна в настройките (адрес/токен/интервал/вкл-изкл).
export function reloadChannels(render) {
  startNativeListener(render);
  startPupikesPolling(render);
}
