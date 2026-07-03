// Version: 1.0001
// notifier.js — локални известия (без сървър/push).
// На устройство: Capacitor Local Notifications. В браузър/без разрешение: in-page toast.
// Импортът на плъгина е динамичен/защитен, за да върви и в чист браузър (vite dev).

let LocalNotifications = null;
let pluginReady = false;

// СИНХРОНЕН достъп (без динамичен import, който увисва в WebView и блокира екрани/известия).
function loadPlugin() {
  if (pluginReady) return LocalNotifications;
  pluginReady = true;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && cap.Plugins && cap.Plugins.LocalNotifications) {
      LocalNotifications = cap.Plugins.LocalNotifications;
    }
  } catch (e) {
    LocalNotifications = null; // в браузъра е очаквано
  }
  return LocalNotifications;
}

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

export async function checkNotificationPermission() {
  const plugin = await loadPlugin();
  if (plugin && isNative()) {
    try {
      return (await plugin.checkPermissions()).display === 'granted';
    } catch (_) { return false; }
  }
  if (typeof Notification !== 'undefined') return Notification.permission === 'granted';
  return false;
}

// Показва известие (напр. „роботът отговори на въпрос").
export async function notify(title, body, onToast) {
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
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body }); return; } catch (_) { /* toast */ }
  }
  if (typeof onToast === 'function') onToast(`${title} — ${body}`);
}
