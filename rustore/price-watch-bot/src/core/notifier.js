// Известия. На устройство → @capacitor/local-notifications (LOCAL, без сървър/push).
// В браузъра → Web Notifications, ако са разрешени, иначе тих лог.
// Зарежда се динамично, за да върви и в чист уеб без Capacitor.

let localNotif = null;
let isNative = false;

async function getNative() {
  if (localNotif !== null) return localNotif;
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNative = Capacitor.isNativePlatform();
    if (isNative) {
      const mod = await import('@capacitor/local-notifications');
      localNotif = mod.LocalNotifications;
    } else {
      localNotif = false;
    }
  } catch {
    localNotif = false;
  }
  return localNotif;
}

// Иска разрешение за известия. Връща true/false.
export async function requestPermission() {
  const ln = await getNative();
  if (ln) {
    try {
      const res = await ln.requestPermissions();
      return res.display === 'granted';
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

export async function hasPermission() {
  const ln = await getNative();
  if (ln) {
    try {
      const res = await ln.checkPermissions();
      return res.display === 'granted';
    } catch {
      return false;
    }
  }
  if (typeof Notification !== 'undefined') return Notification.permission === 'granted';
  return false;
}

let idSeq = 1;

// Изпраща локално известие.
export async function notify(title, body) {
  const ln = await getNative();
  if (ln) {
    try {
      await ln.schedule({
        notifications: [{ id: idSeq++, title, body, schedule: { at: new Date(Date.now() + 500) } }]
      });
      return true;
    } catch {
      return false;
    }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body }); return true; } catch {}
  }
  return false;
}
