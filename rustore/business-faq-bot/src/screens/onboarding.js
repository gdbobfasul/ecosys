// Version: 1.0001
// onboarding.js — обяснение + безплатно активиране.
import { el } from '../ui/dom.js';
import { setState } from '../core/storage.js';
import { t } from '../core/i18n.js';
import { langButton } from './lang-button.js';

export function renderOnboarding(root, { navigate, rerender }) {
  root.appendChild(el('div', { class: 'row between' }, [
    el('span', {}, ''),
    langButton(rerender)
  ]));

  root.appendChild(el('header', { class: 'hero' }, [
    el('div', { class: 'logo' }, '🤖'),
    el('h1', {}, t('app_name')),
    el('p', { class: 'lead' }, t('onb_lead'))
  ]));

  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('onb_what_title')),
    el('ul', { class: 'bullets' }, [
      el('li', {}, t('onb_b1')),
      el('li', {}, t('onb_b2')),
      el('li', {}, t('onb_b3')),
      el('li', {}, t('onb_b4')),
      el('li', {}, t('onb_b5'))
    ])
  ]));

  root.appendChild(el('section', { class: 'card cta' }, [
    el('p', {}, t('onb_cta_note')),
    el('button', {
      class: 'btn primary big',
      onclick: () => {
        setState({ activated: true });
        navigate('permissions');
      }
    }, t('onb_activate'))
  ]));

  root.appendChild(el('p', { class: 'muted small center' }, t('privacy_note')));
}
