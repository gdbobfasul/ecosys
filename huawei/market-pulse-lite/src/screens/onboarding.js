// Version: 1.0001
// Екран за активиране — обяснява какво прави роботът и го активира безплатно.
import { saveState, pushLog } from '../core/storage.js';
import { t } from '../core/i18n.js';
import { topBar, bindTopBar } from '../ui/topbar.js';

export function renderOnboarding(root, state, go) {
  root.innerHTML = `
    ${topBar(t('app_name'))}
    <div class="pad">
      <div class="center">
        <div class="big">🤖</div>
        <h2>${t('ob_headline')}</h2>
        <p>${t('ob_intro')}</p>
      </div>

      <div class="card">
        <h2>${t('ob_what_title')}</h2>
        <p>• ${t('ob_feat1')}<br/>
           • ${t('ob_feat2')}<br/>
           • ${t('ob_feat3')}</p>
        <p class="muted">${t('ob_privacy')}</p>
      </div>

      <button class="btn" id="activate">${t('ob_activate')}</button>
      <p class="muted center" style="margin-top:14px">${t('ob_all_free')}</p>
    </div>
  `;
  bindTopBar(root);

  root.querySelector('#activate').onclick = async () => {
    state.onboarded = true;
    pushLog(state, t('log_activated'));
    await saveState(state);
    go('config');
  };
}
