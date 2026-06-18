// Локални известия — само на устройство. БЕЗ push, БЕЗ сървър, БЕЗ FCM/HMS.
// На устройство: @capacitor/local-notifications.
// В браузъра: Web Notifications API (ако е разрешено), иначе тих лог.

let LN = null;
let isNative = false;

// СИНХРОНЕН достъп (без динамичен import, който увисва в Capacitor WebView и блокира
// екрана „Разрешения"/известията). Взимаме плъгина от глобалния window.Capacitor.Plugins.
function getLN() {
  if (LN !== null) return LN;
  LN = false;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    if (isNative && cap.Plugins && cap.Plugins.LocalNotifications) {
      LN = cap.Plugins.LocalNotifications;
    }
  } catch {
    LN = false;
  }
  return LN;
}

// Иска разрешение за известия. Връща true/false.
export async function requestNotifPermission() {
  const ln = await getLN();
  if (ln) {
    try {
      const r = await ln.requestPermissions();
      return r.display === 'granted';
    } catch {
      return false;
    }
  }
  // Уеб
  if (typeof Notification !== 'undefined') {
    try {
      const p = await Notification.requestPermission();
      return p === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

let webId = 1;

// Показва локално известие. title/body са вече готов текст.
export async function notify(title, body) {
  const ln = await getLN();
  if (ln) {
    try {
      await ln.schedule({
        notifications: [
          {
            id: Date.now() % 2147483647,
            title,
            body,
            schedule: { at: new Date(Date.now() + 500) }
          }
        ]
      });
      return true;
    } catch (e) {
      console.warn('[notifier] device notify fail', e);
      return false;
    }
  }
  // Уеб
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'mob-' + webId++ });
      return true;
    } catch {
      /* пада към лог */
    }
  }
  console.info('[notifier] (no permission) ' + title + ' — ' + body);
  return false;
}
