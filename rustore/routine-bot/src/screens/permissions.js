// Version: 1.0002
// Екран „Разрешения" (стъпка 3) — САМО известия. GPS/локацията е премахната:
// времето работи по ИМЕ на град (управлява се в стъпка 1 „Сутрешен брифинг").
// В режим на редакция (от навигацията) показва и градовете за удобство.
import { h, esc } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { notifier } from '../core/notifier.js';
import { t } from '../core/i18n.js';

export async function renderPermissions(root, { go, isWizard }) {
  const perms = await storage.get(KEYS.perms, { notifications: false });

  const el = h(`
    <div>
      ${isWizard ? '<div class="steps"><span class="s on"></span><span class="s on"></span><span class="s on"></span></div>' : ''}
      <h1>${esc(t('perms_title'))}</h1>
      <p class="muted">${esc(t('perms_sub_notif'))}</p>

      <div class="card">
        <div class="row">
          <div><strong>${esc(t('perms_notif'))}</strong><div class="muted">${esc(t('perms_notif_desc'))}</div></div>
          <span id="notif-pill" class="pill off">${esc(t('perms_notif_off'))}</span>
        </div>
        <div class="spacer"></div>
        <button class="btn small" id="ask-notif">${esc(t('perms_notif_ask'))}</button>
      </div>

      <div id="cities-edit"></div>

      <button class="btn" id="done">${esc(isWizard ? t('perms_finish_wizard') : t('done_btn'))}</button>
    </div>
  `);

  const notifPill = el.querySelector('#notif-pill');
  function refreshPill() {
    notifPill.textContent = perms.notifications ? t('perms_notif_on') : t('perms_notif_off');
    notifPill.className = 'pill ' + (perms.notifications ? '' : 'off');
  }
  (async () => { perms.notifications = await notifier.checkPermission(); refreshPill(); })();

  el.querySelector('#ask-notif').addEventListener('click', async () => {
    perms.notifications = await notifier.requestPermission();
    await storage.set(KEYS.perms, perms);
    refreshPill();
  });

  el.querySelector('#done').addEventListener('click', async () => {
    if (isWizard) {
      const state = await storage.get(KEYS.state, {});
      state.active = true;
      state.onboarded = true;
      await storage.set(KEYS.state, state);
      const { scheduler } = await import('../core/scheduler.js');
      await scheduler.reschedule();
    }
    go('dashboard');
  });

  refreshPill();
  root.appendChild(el);

  // В режим на редакция (не съветник) — покажи и градовете за времето.
  if (!isWizard) {
    const { mountCities } = await import('./cities.js');
    await mountCities(el.querySelector('#cities-edit'));
  }
}
