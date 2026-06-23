// Екран „Разрешения" — иска САМО нужното, прозрачно, с обяснение за всяко.
import { requestPermission, hasPermission } from '../core/notifier.js';
import { saveState } from '../core/storage.js';
import { t } from '../core/i18n.js';
import { topBar, bindTopBar } from '../ui/topbar.js';

export function renderPermissions(root, state, go) {
  draw();

  async function draw() {
    const notifGranted = await hasPermission();
    state.permissions.notifications = notifGranted;
    root.innerHTML = `
      ${topBar(t('perm_title'))}
      <div class="pad">
        <p>${t('perm_intro')}</p>

        <div class="card">
          <div class="row between">
            <div style="flex:1">
              <b>${t('perm_notif_title')}</b>
              <div class="muted">${t('perm_notif_desc')}</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="notif" ${notifGranted ? 'checked' : ''}/>
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="card">
          <div class="row between">
            <div style="flex:1">
              <b>${t('perm_net_title')}</b>
              <div class="muted">${t('perm_net_desc')}</div>
            </div>
            <span class="badge watching">${t('perm_needed')}</span>
          </div>
        </div>

        <div class="card">
          <p class="muted">${t('perm_not_asked')}</p>
        </div>

        <button class="btn" id="next">${t('perm_done')}</button>
      </div>
    `;
    bindTopBar(root);

    root.querySelector('#notif').onchange = async (e) => {
      if (e.target.checked) {
        const ok = await requestPermission();
        state.permissions.notifications = ok;
        await saveState(state);
        if (!ok) draw();
      } else {
        // Не можем програмно да отнемем системно разрешение; само маркираме предпочитанието.
        state.permissions.notifications = false;
        await saveState(state);
      }
    };

    root.querySelector('#next').onclick = async () => {
      await saveState(state);
      go('dashboard');
    };
  }
}
