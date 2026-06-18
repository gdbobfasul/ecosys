// notifier.js — известия при сработило правило.
// На устройство: Capacitor Local Notifications (локални, on-device, без сървър/push).
// В браузър / без разрешение: fallback към in-page toast.
//
// Импортът на плъгина е динамичен/защитен, за да върви и в чист браузър (vite dev),
// където нативният плъгин липсва.

let LocalNotifications = null;
let pluginReady = false;

// СИНХРОНЕН достъп (без динамичен import, който увисва в Capacitor WebView и блокира
// екрани/известия). Плъгинът се взима от глобалния window.Capacitor.Plugins.
function loadPlugin() {
  if (pluginReady) return LocalNotifications;
  pluginReady = true;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && cap.Plugins && cap.Plugins.LocalNotifications) {
      LocalNotifications = cap.Plugins.LocalNotifications;
    }
  } catch (e) {
    LocalNotifications = null;
  }
  return LocalNotifications;
}

// Дали сме в нативна Capacitor среда.
function isNative() {
  return typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();
}

// Поисква разрешение за известия. Връща true/false.
export async function requestNotificationPermission() {
  const plugin = await loadPlugin();
  if (plugin && isNative()) {
    try {
      const res = await plugin.requestPermissions();
      return res.display === 'granted';
    } catch (e) {
      console.warn('notifier: requestPermissions се провали', e);
      return false;
    }
  }
  // Web fallback: ползваме браузърния Notification API, ако има.
  if (typeof Notification !== 'undefined') {
    try {
      const p = await Notification.requestPermission();
      return p === 'granted';
    } catch (_) {
      return false;
    }
  }
  return false;
}

// Показва известие за изпратен авто-отговор.
// onToast(msg) се ползва като визуален fallback в страницата.
export async function notifyAutoReply({ sender, reply }, onToast) {
  const title = 'Авто-отговор изпратен';
  const body = `→ ${sender}: ${reply}`;

  const plugin = await loadPlugin();
  if (plugin && isNative()) {
    try {
      const granted = (await plugin.checkPermissions()).display === 'granted';
      if (granted) {
        await plugin.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 1e6),
            title,
            body,
            schedule: { at: new Date(Date.now() + 200) }
          }]
        });
        return;
      }
    } catch (e) {
      console.warn('notifier: schedule се провали, fallback toast', e);
    }
  }

  // Web Notification (ако е разрешено) или in-page toast.
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
      return;
    } catch (_) { /* падаме към toast */ }
  }
  if (typeof onToast === 'function') onToast(body);
}
