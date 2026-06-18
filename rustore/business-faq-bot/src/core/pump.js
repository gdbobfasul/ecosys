// pump.js — „двигателят" на РЕАЛНИТЕ канали за business-faq-bot.
//
// Свързва входа от каналите със собствения FAQ rule-engine (respond.js) и
// изпраща авто-отговорите:
//   • KCY (нашият чат)            — polling по HTTP (kcy-chat.js)
//   • WhatsApp/Viber/Messenger    — push event от native плъгина (native-reply.js)
//
// Демо чатът (local) НЕ минава оттук — той си остава ръчният sandbox в екран „Демо".
//
// Стартира се веднъж от main.js. Не дублира отговори (пази „seen" в storage).
// Деградира честно: ако канал не е наличен/настроен/изключен, просто не прави нищо
// за него — БЕЗ да симулира успех.

import { getState, setState, persist } from './storage.js';
import { respond } from './respond.js';
import { notify } from './notifier.js';
import { toast } from '../ui/dom.js';
import {
  kcyConfigured, kcyFetchFriends, kcyFetchConversation, kcySend, kcyResetSession
} from './kcy-chat.js';
import { isNativeReplyAvailable, isAccessGranted, onMessage, replyTo } from './native-reply.js';

let _started = false;
let _kcyTimer = null;
let _kcyBusy = false;
let _unsubNative = null;

function channelLabel(id) {
  return ({ kcy: 'Нашият чат', whatsapp: 'WhatsApp', viber: 'Viber', messenger: 'Messenger' })[id] || id;
}

// Дали даден РЕАЛЕН канал е включен в настройките.
function channelEnabled(id) {
  const ch = getState().channels || {};
  if (id === 'kcy') return !!(ch.kcy && ch.kcy.enabled);
  return !!ch[id]; // whatsapp/viber/messenger са плоски булеви
}

// Добавя ред в дневника (същият формат като respond.js: t, q, kind, label),
// но обогатен с канал/подател/отговор за екран „Табло".
function logRealReply({ channel, sender, incoming, reply, kind, label }) {
  const s = getState();
  s.log.unshift({
    t: Date.now(),
    q: String(incoming || '').slice(0, 200),
    kind,
    label: label || null,
    channel,
    sender: sender ? String(sender).slice(0, 60) : null,
    reply: String(reply || '').slice(0, 200)
  });
  if (s.log.length > 200) s.log.length = 200;
  persist();
}

// Обработва едно входящо съобщение от РЕАЛЕН канал и (ако трябва) отговаря.
// deliver(reply) праща отговора по канала и връща { ok, note? }.
async function processIncoming({ channel, sender, text }) {
  if (!getState().robotOn) return false;
  if (!channelEnabled(channel)) return false;

  // Прокарваме входа през СОБСТВЕНИЯ FAQ rule-engine на това приложение.
  const r = respond(text); // { reply, kind, entry? }
  if (!r || !r.reply) return false;

  let res;
  try {
    res = await deliverWrap(channel, r.reply, arguments[0]);
  } catch (e) {
    res = { ok: false, note: String(e && e.message ? e.message : e) };
  }

  if (res && res.ok) {
    logRealReply({
      channel, sender, incoming: text, reply: r.reply,
      kind: r.kind, label: r.entry ? r.entry.label : null
    });
    await notify(`Авто-отговор · ${channelLabel(channel)}`, r.reply, (m) => toast(m));
    return true;
  }
  toast(`Авто-отговор по ${channelLabel(channel)} не мина: ${(res && res.note) || 'неизвестна грешка'}`);
  return false;
}

// Wrapper, който знае КЪДЕ да достави отговора според канала.
async function deliverWrap(channel, reply, msg) {
  if (channel === 'kcy') {
    return kcySend(getState().channels.kcy, { friendId: msg.friendId, text: reply });
  }
  // native месинджъри: direct-reply по key на нотификацията
  const access = await isAccessGranted();
  if (!access) return { ok: false, note: 'няма „Notification access"' };
  if (!msg.key || !msg.canReply) return { ok: false, note: 'нотификацията няма поле за отговор' };
  try {
    const r = await replyTo({ key: msg.key, text: reply });
    return { ok: !!r.ok, note: r.ok ? '' : 'direct-reply неуспешен' };
  } catch (e) {
    return { ok: false, note: String(e && e.message ? e.message : e) };
  }
}

// --- KCY polling --------------------------------------------------------------

// Един такт: намираме разговори с непрочетени → авто-отговор на новите ПОЛУЧЕНИ
// съобщения, на които още не сме отговаряли.
async function kcyTick(rerender) {
  if (_kcyBusy) return;
  const cfg = getState().channels && getState().channels.kcy;
  if (!getState().robotOn || !cfg || cfg.enabled === false || !kcyConfigured(cfg)) return;

  _kcyBusy = true;
  let didReply = false;
  try {
    const fr = await kcyFetchFriends(cfg);
    if (!fr.ok) return; // статусът се вижда в екран „Канали"

    const pending = fr.friends.filter((f) => (parseInt(f.unread, 10) || 0) > 0);

    for (const friend of pending) {
      const friendId = String(friend.userId);
      const conv = await kcyFetchConversation(cfg, friendId);
      if (!conv.ok) continue;

      const seenAll = getState().seen || {};
      const fseen = (seenAll.kcy && seenAll.kcy[friendId]) || { lastTs: 0, ids: [] };

      // Само ПОЛУЧЕНИ (sent === false), още необработени, по реда на пристигане.
      const incoming = conv.messages
        .filter((m) => m && m.sent === false)
        .filter((m) => !fseen.ids.includes(String(m.id)))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      if (incoming.length === 0) continue;

      // Отговаряме само на ПОСЛЕДНОТО получено (за да не спамим), но маркираме
      // всички като обработени, за да не ги пипаме пак.
      const last = incoming[incoming.length - 1];
      const senderName = friend.displayName || friend.fullName || friendId;

      const ok = await processIncoming({ channel: 'kcy', sender: senderName, text: last.text, friendId });
      if (ok) didReply = true;

      let lastTs = fseen.lastTs;
      const ids = [...fseen.ids];
      for (const m of incoming) {
        ids.push(String(m.id));
        if ((m.timestamp || 0) > lastTs) lastTs = m.timestamp || 0;
      }
      const curSeen = getState().seen || {};
      const curKcy = curSeen.kcy || {};
      setState({
        seen: { ...curSeen, kcy: { ...curKcy, [friendId]: { lastTs, ids: ids.slice(-200) } } }
      });
    }

    if (didReply && typeof rerender === 'function') rerender();
  } finally {
    _kcyBusy = false;
  }
}

function startKcyPolling(rerender) {
  stopKcyPolling();
  kcyResetSession(); // нова настройка → нова сесия (re-login при нужда)
  const cfg = getState().channels && getState().channels.kcy;
  if (!cfg) return;
  const secs = Math.max(5, parseInt(cfg.pollSeconds || 20, 10) || 20);
  kcyTick(rerender); // веднага един такт
  _kcyTimer = setInterval(() => kcyTick(rerender), secs * 1000);
}

function stopKcyPolling() {
  if (_kcyTimer) { clearInterval(_kcyTimer); _kcyTimer = null; }
}

// --- Native месинджъри (push event) ------------------------------------------

function pkgToChannel(pkg) {
  return ({
    'com.whatsapp': 'whatsapp',
    'com.viber.voip': 'viber',
    'com.facebook.orca': 'messenger'
  })[pkg] || null;
}

function startNativeListener(rerender) {
  if (_unsubNative) { _unsubNative(); _unsubNative = null; }
  if (!isNativeReplyAvailable()) return;

  _unsubNative = onMessage(async (msg) => {
    // msg: { key, pkg, sender, text, postedAt, canReply }
    if (!msg || !msg.text) return;
    const channel = pkgToChannel(msg.pkg);
    if (!channel) return;
    if (!channelEnabled(channel)) return;

    const ok = await processIncoming({
      channel, sender: msg.sender || '(непознат)', text: msg.text,
      key: msg.key, canReply: msg.canReply
    });
    if (ok && typeof rerender === 'function') rerender();
  });
}

// --- Публично API -------------------------------------------------------------

// Стартира двигателя (еднократно за native слушателя). rerender() опреснява UI.
export function startPump(rerender) {
  if (!_started) {
    _started = true;
    startNativeListener(rerender);
  }
  startKcyPolling(rerender);
}

// Презарежда каналите след промяна в настройките (адрес/токен/интервал/вкл-изкл).
export function reloadChannels(rerender) {
  startNativeListener(rerender);
  startKcyPolling(rerender);
}
