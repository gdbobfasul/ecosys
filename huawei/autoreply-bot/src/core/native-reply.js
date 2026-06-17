// native-reply.js — JS мост към native Capacitor плъгина 'NotificationReply'.
//
// Деградира ЧЕСТНО: в браузър / без native слой методите връщат „не е налично",
// без да хвърлят и БЕЗ да симулират изпращане. Реалното изпращане става само на
// устройство с инсталиран native плъгин (виж native/notification-reply/) и даден
// „Notification access".
//
// Плъгинът се регистрира с @capacitor/core registerPlugin('NotificationReply').
// Импортът е защитен, за да върви и без @capacitor/core (чист браузър / тестове).

let _plugin = null;
let _tried = false;

// Регистрира плъгина веднъж (lazy). Връща обекта или null.
function getPlugin() {
  if (_tried) return _plugin;
  _tried = true;
  try {
    // Динамичен достъп: ако @capacitor/core е наличен, ползваме registerPlugin.
    const cap = (typeof window !== 'undefined' && window.Capacitor) ? window.Capacitor : null;
    if (cap && typeof cap.registerPlugin === 'function') {
      _plugin = cap.registerPlugin('NotificationReply');
    } else if (cap && cap.Plugins && cap.Plugins.NotificationReply) {
      _plugin = cap.Plugins.NotificationReply;
    } else {
      _plugin = null;
    }
  } catch (_) {
    _plugin = null;
  }
  return _plugin;
}

// Дали сме в нативна Capacitor среда И плъгинът е регистриран.
export function isNativeReplyAvailable() {
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    const native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    return native && !!getPlugin();
  } catch (_) {
    return false;
  }
}

// Целеви Android package имена.
export const TARGET_PKG = {
  whatsapp: 'com.whatsapp',
  viber: 'com.viber.voip',
  messenger: 'com.facebook.orca'
};

// Дали е даден „Notification access". В неподдържана среда → false (честно).
export async function isAccessGranted() {
  const p = getPlugin();
  if (!p || !isNativeReplyAvailable()) return false;
  try {
    const res = await p.isAccessGranted();
    return !!(res && res.value);
  } catch (_) {
    return false;
  }
}

// Отваря системния екран за „Notification access". Връща false, ако не е възможно.
export async function openAccessSettings() {
  const p = getPlugin();
  if (!p || !isNativeReplyAvailable()) return false;
  try {
    await p.openAccessSettings();
    return true;
  } catch (_) {
    return false;
  }
}

// Връща последните заловени съобщения от месинджърите (буфер на услугата).
// В неподдържана среда → празен списък.
export async function getRecent() {
  const p = getPlugin();
  if (!p || !isNativeReplyAvailable()) return { messages: [], connected: false, available: false };
  try {
    const res = await p.getRecent();
    return {
      messages: (res && res.messages) || [],
      connected: !!(res && res.connected),
      available: true
    };
  } catch (_) {
    return { messages: [], connected: false, available: false };
  }
}

// Абонира се за нови съобщения. Връща функция за отписване (no-op, ако няма плъгин).
export function onMessage(handler) {
  const p = getPlugin();
  if (!p || typeof p.addListener !== 'function') return () => {};
  let sub;
  try {
    sub = p.addListener('message', handler);
  } catch (_) {
    return () => {};
  }
  return () => {
    try {
      if (sub && typeof sub.remove === 'function') sub.remove();
      else if (sub && typeof sub.then === 'function') sub.then((s) => s && s.remove && s.remove());
    } catch (_) { /* ignore */ }
  };
}

// Direct-reply по конкретна нотификация (по нейния key, който идва от getRecent/onMessage).
// Хвърля при липсващ плъгин — извикващият трябва първо да провери isNativeReplyAvailable().
export async function replyTo({ key, text }) {
  const p = getPlugin();
  if (!p || !isNativeReplyAvailable()) {
    throw new Error('native-not-available');
  }
  const res = await p.reply({ key, text });
  return { ok: !!(res && res.ok), res };
}
