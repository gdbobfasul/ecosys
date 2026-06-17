// channel-adapter.js — слой за канали за съобщения.
//
// ЧЕСТНО РЕЗЮМЕ (важно):
//   • `local`  — вграденият демо/sandbox чат. Работи СЕГА, изцяло on-device, тестваем.
//   • `whatsapp` / `viber` / `messenger` — реални адаптери ПРЕЗ native плъгина
//     'NotificationReply' (Kotlin NotificationListenerService + notification direct-reply).
//     Това е единственият БЕЗПЛАТЕН on-device начин за авто-отговор в тези приложения на
//     Android. Изисква: (1) NATIVE билд с плъгина (native/notification-reply/ + опция 38),
//     (2) системно разрешение „Notification access". Когато тези ги няма, адаптерът връща
//     ЧЕСТЕН статус „native-not-available" — НЕ симулираме изпращане.
//
//   Rule engine-ът е КАНАЛ-НЕЗАВИСИМ: дава отговор за всеки вход. Каналите само доставят
//   входа и (на устройство) изпращат изхода.

import {
  isNativeReplyAvailable,
  isAccessGranted,
  replyTo,
  TARGET_PKG
} from './native-reply.js';

// Обратна съвместимост: старият код вика NotificationReplyPlugin.* директно.
export const NotificationReplyPlugin = {
  isAvailable() { return isNativeReplyAvailable(); },
  async hasNotificationAccess() { return isAccessGranted(); },
  async openAccessSettings() {
    const { openAccessSettings } = await import('./native-reply.js');
    return openAccessSettings();
  },
  // pkg се пази за съвместимост, но реалното изпращане е по key на нотификацията.
  async reply({ key, text }) { return replyTo({ key, text }); }
};

const PKG = TARGET_PKG;

// Базов клас на адаптер.
class ChannelAdapter {
  constructor(id, title) {
    this.id = id;
    this.title = title;
  }
  // Дали този канал може реално да изпраща ОТГОВОРИ в текущата среда.
  canSend() { return false; }
  // Човешки статус за UI.
  status() { return { ready: false, note: 'неизвестно' }; }
  // Доставя отговор. local го показва в чата; останалите минават през native плъгина.
  async deliver(_payload) { throw new Error('not implemented'); }
}

// --- local: вграденият демо/sandbox чат (работи сега) -------------------------
class LocalAdapter extends ChannelAdapter {
  constructor() { super('local', 'Демо чат (в приложението)'); }
  canSend() { return true; }
  status() {
    return { ready: true, note: 'Работи сега — отговорите се показват в демо чата.' };
  }
  async deliver({ text }) {
    return { ok: true, channel: 'local', text, delivered: true };
  }
}

// --- whatsapp / viber / messenger: реално чрез native плъгин ------------------
class NotificationChannelAdapter extends ChannelAdapter {
  constructor(id, title) { super(id, title); this.pkg = PKG[id]; }

  canSend() { return isNativeReplyAvailable(); }

  status() {
    if (!isNativeReplyAvailable()) {
      return {
        ready: false,
        note: 'изисква native билд (опция 38) + „Notification access"'
      };
    }
    return { ready: true, note: 'native плъгин наличен — нужен е и „Notification access"' };
  }

  // НЕ симулираме изпращане.
  //   • Без native плъгин            → reason: 'native-not-available'
  //   • Без „Notification access"     → reason: 'no-access'
  //   • Без key на нотификация        → reason: 'no-target' (нямаме към кое да отговорим)
  //   • Иначе                         → реален direct-reply.
  async deliver({ text, key }) {
    if (!isNativeReplyAvailable()) {
      return {
        ok: false, channel: this.id, pending: true, reason: 'native-not-available',
        note: 'Изпращането изисква native NotificationReply плъгин + „Notification access". ' +
              'Виж native/notification-reply/.'
      };
    }
    const access = await isAccessGranted();
    if (!access) {
      return {
        ok: false, channel: this.id, pending: true, reason: 'no-access',
        note: 'Липсва „Notification access" в настройките на Android.'
      };
    }
    if (!key) {
      // Реалният direct-reply изисква нотификацията, на която отговаряме (нейния key).
      return {
        ok: false, channel: this.id, pending: true, reason: 'no-target',
        note: 'Няма заловена нотификация за отговор (нужен е key от getRecent/onMessage).'
      };
    }
    try {
      const res = await replyTo({ key, text });
      return { ok: !!res.ok, channel: this.id, native: true, key, res };
    } catch (e) {
      return {
        ok: false, channel: this.id, pending: true, reason: 'reply-failed',
        note: String(e && e.message ? e.message : e)
      };
    }
  }
}

const ADAPTERS = {
  local: new LocalAdapter(),
  whatsapp: new NotificationChannelAdapter('whatsapp', 'WhatsApp'),
  viber: new NotificationChannelAdapter('viber', 'Viber'),
  messenger: new NotificationChannelAdapter('messenger', 'Messenger')
};

export function getAdapter(id) {
  return ADAPTERS[id] || null;
}

export function allAdapters() {
  return Object.values(ADAPTERS);
}

export const CHANNEL_IDS = Object.keys(ADAPTERS);
