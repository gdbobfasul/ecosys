// Version: 1.0001
// onboarding.js — екран „активирай“ (безплатно). Обяснява концепцията честно, после
// маркира activated=true и продължава към разрешения → конфиг → табло.

import { el, mount } from '../ui/dom.js';
import { loadSettings, saveSettings } from '../core/storage.js';
import { t } from '../core/i18n.js';

export async function renderOnboarding(root, { go }) {
  const view = el('div', {}, [
    el('div', { class: 'steps' }, [
      el('div', { class: 's active' }), el('div', { class: 's' }),
      el('div', { class: 's' }), el('div', { class: 's' })
    ]),
    el('h1', { text: t('ob_title') }),
    el('p', { text: t('ob_intro') }),

    el('div', { class: 'card' }, [
      el('h2', { text: t('ob_how_title') }),
      el('p', { html: t('ob_how_body') })
    ]),

    el('div', { class: 'notice' }, [
      el('span', { html: t('ob_honest') })
    ]),

    el('button', {
      class: 'btn', onclick: async () => {
        const s = await loadSettings();
        await saveSettings({ ...s, activated: true });
        go('permissions');
      }
    }, t('ob_activate'))
  ]);

  mount(root, view);
}
