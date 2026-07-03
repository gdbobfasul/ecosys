// Version: 1.0001
// Екран за активиране — обяснява концепцията и активира робота безплатно.
import { h, esc } from '../ui/dom.js';
import { APP_CONFIG } from '../config.js';
import { storage, KEYS } from '../core/storage.js';
import { t, tf } from '../core/i18n.js';

export function renderOnboarding(root, { go }) {
  const el = h(`
    <div>
      <div class="robot">🤖</div>
      <h1 class="center">${esc(t('onb_title'))}</h1>
      <p class="center muted">${esc(tf('onb_intro', APP_CONFIG.appName))}</p>

      <div class="card">
        <h2>${esc(t('onb_what_title'))}</h2>
        <p>${esc(t('onb_feat_morning'))}</p>
        <p>${esc(t('onb_feat_reminders'))}</p>
        <p>${esc(t('onb_feat_evening'))}</p>
        <p class="muted">${esc(t('onb_privacy'))}</p>
      </div>

      <button class="btn" id="activate">${esc(t('onb_activate'))}</button>
    </div>
  `);

  el.querySelector('#activate').addEventListener('click', async () => {
    const state = await storage.get(KEYS.state, {});
    state.onboarded = true;
    state.active = false; // включва се след конфигурация
    await storage.set(KEYS.state, state);
    go('config');
  });

  root.appendChild(el);
}
