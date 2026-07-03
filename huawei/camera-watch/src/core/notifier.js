// Version: 1.0001
// notifier.js — локални нотификации при детекция.
//
// ПРИНЦИП: само ЛОКАЛНИ нотификации (никаква мрежа/push сървър/Firebase). Ползва
// @capacitor/local-notifications на нативен build; в браузър пада към Web Notification
// API. Ако нищо не е разрешено — тихо нищо (приложението пак показва в журнала на екрана).

let _ln = null;
let _lnTried = false;

async function getLocalNotifications() {
  if (_lnTried) return _ln;
  _lnTried = true;
  try {
    const mod = await import('@capacitor/local-notifications');
    if (mod && mod.LocalNotifications) _ln = mod.LocalNotifications;
  } catch (_) {
    _ln = null;
  }
  return _ln;
}

// Иска разрешение за нотификации. Връща { granted, via } ('native'|'web'|'none').
export async function requestNotificationPermission() {
  const ln = await getLocalNotifications();
  if (ln && typeof ln.requestPermissions === 'function') {
    try {
      const res = await ln.requestPermissions();
      const granted = res && (res.display === 'granted' || res.display === 'prompt-with-rationale');
      return { granted: !!granted, via: 'native' };
    } catch (_) { /* пада към web */ }
  }
  if (typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
    try {
      const perm = await Notification.requestPermission();
      return { granted: perm === 'granted', via: 'web' };
    } catch (_) {}
  }
  return { granted: false, via: 'none' };
}

// Текущ статус без да пита. Връща 'granted' | 'denied' | 'prompt' | 'unknown'.
export async function getNotificationStatus() {
  const ln = await getLocalNotifications();
  if (ln && typeof ln.checkPermissions === 'function') {
    try {
      const res = await ln.checkPermissions();
      return (res && res.display) || 'unknown';
    } catch (_) {}
  }
  if (typeof Notification !== 'undefined') {
    const p = Notification.permission;
    return p === 'default' ? 'prompt' : p;
  }
  return 'unknown';
}

// Праща локална нотификация. Тих fail (никога не хвърля).
export async function notify(title, body) {
  const ln = await getLocalNotifications();
  if (ln && typeof ln.schedule === 'function') {
    try {
      await ln.schedule({
        notifications: [{
          id: Date.now() % 2147483000,
          title,
          body,
          schedule: { at: new Date(Date.now() + 100) }
        }]
      });
      return true;
    } catch (_) { /* пада към web */ }
  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
      return true;
    }
  } catch (_) {}
  return false;
}
