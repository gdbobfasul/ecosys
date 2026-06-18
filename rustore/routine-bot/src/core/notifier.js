// Известия. На устройство използва @capacitor/local-notifications.
// В браузър пада обратно към Web Notifications API (ако е разрешено),
// иначе към визуален „toast" в самото приложение.
// Мързелив импорт на плъгина — без top-level await (es2019).
let LocalNotifications = null;
let lnTried = false;
// СИНХРОНЕН достъп (без динамичен import, който увисва в WebView и блокира екрани/известия).
function ensureLN() {
  if (lnTried) return LocalNotifications;
  lnTried = true;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()
        && cap.Plugins && cap.Plugins.LocalNotifications) {
      LocalNotifications = cap.Plugins.LocalNotifications;
    }
  } catch (_) {
    LocalNotifications = null;
  }
  return LocalNotifications;
}

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export const notifier = {
  isNative,

  // Разрешения за известия.
  async requestPermission() {
    const LN = await ensureLN();
    if (LN) {
      const res = await LN.requestPermissions();
      return res.display === 'granted';
    }
    // Уеб
    if ('Notification' in window) {
      const p = await Notification.requestPermission();
      return p === 'granted';
    }
    return false;
  },

  async checkPermission() {
    const LN = await ensureLN();
    if (LN) {
      const res = await LN.checkPermissions();
      return res.display === 'granted';
    }
    if ('Notification' in window) return Notification.permission === 'granted';
    return false;
  },

  // Незабавно известие (използва се за „преглед на брифинга сега").
  async notifyNow(title, body) {
    const LN = await ensureLN();
    if (LN) {
      await LN.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 2_000_000_000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 500) }
        }]
      });
      return { delivered: 'native' };
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
      return { delivered: 'web' };
    }
    // Последен резерв: визуален toast вътре в приложението.
    toast(title, body);
    return { delivered: 'toast' };
  },

  // Планира известие за конкретно време (Date) или дневно повторение.
  // items: [{ id, title, body, at:Date, repeats:bool, every:'day' }]
  async scheduleAll(items) {
    const LN = await ensureLN();
    if (LN) {
      const notifications = items.map((it) => {
        const n = { id: it.id, title: it.title, body: it.body };
        if (it.repeats) {
          n.schedule = { on: hourMinuteOf(it.at), allowWhileIdle: true };
        } else {
          n.schedule = { at: it.at, allowWhileIdle: true };
        }
        return n;
      });
      await LN.schedule({ notifications });
      return { scheduled: 'native', count: items.length };
    }
    // Уеб: не можем да планираме надеждно при затворен таб.
    // scheduler.js държи setTimeout-и докато табът е отворен.
    return { scheduled: 'web-timers', count: items.length };
  },

  async cancelAll(ids) {
    const LN = await ensureLN();
    if (LN) {
      if (ids && ids.length) {
        await LN.cancel({ notifications: ids.map((id) => ({ id })) });
      } else {
        const pending = await LN.getPending();
        if (pending.notifications.length) {
          await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
        }
      }
    }
  }
};

function hourMinuteOf(date) {
  const d = new Date(date);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

// Прост вграден toast за уеб резерва.
export function toast(title, body) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(body || '')}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 4500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
