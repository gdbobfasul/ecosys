// Version: 1.0001
// Екран „За робота" — обяснение + безплатно активиране (всичко е безплатно).
import { el } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { APP_NAME } from '../config.js';
import { t } from '../core/i18n.js';

export function renderOnboarding(ctx) {
  const { state, go } = ctx;

  return el('div', { class: 'content' }, [
    el('div', { class: 'center' }, [
      el('div', {
        class: 'logo',
        style: 'width:64px;height:64px;border-radius:16px;margin:8px auto 14px;background:linear-gradient(135deg,var(--accent),var(--accent2))'
      }),
      el('h2', {}, APP_NAME)
    ]),
    el('p', { class: 'muted' }, t('onb_intro')),
    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [el('b', {}, t('onb_free_title')), el('span', { class: 'pill on' }, t('onb_included'))]),
      el('p', { class: 'muted' }, t('onb_free_desc'))
    ]),
    el('div', { class: 'gap' }),
    el('button', {
      class: 'btn primary',
      onclick: async () => {
        state.onboarded = true;
        pushLog(state, t('log_activated'));
        await saveState(state);
        go('permissions');
      }
    }, t('onb_activate')),
    el('div', { class: 'gap' }),
    el('p', { class: 'small center' }, t('onb_footer'))
  ]);
}
