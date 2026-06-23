// onboarding.js — обяснение + безплатно активиране.
import { el } from '../ui/dom.js';
import { setState } from '../core/storage.js';
import { t } from '../core/i18n.js';

export function OnboardingScreen({ navigate, openLanguage }) {
  const activate = () => {
    setState({ activated: true });
    navigate('rules'); // води към конфигуратора на правила
  };

  const langBtn = el('button', { class: 'btn sm lang' }, t('lang_btn'));
  langBtn.addEventListener('click', () => { if (openLanguage) openLanguage(); });

  return el('div', {}, [
    el('div', { class: 'row between' }, [
      el('div', { class: 'brand' }, [
        el('div', { class: 'logo' }, '🤖'),
        el('h1', {}, t('app_name'))
      ]),
      langBtn
    ]),
    el('p', { class: 'muted' }, t('onboard_tagline')),

    el('div', { class: 'card' }, [
      el('h2', {}, t('onboard_how_title')),
      el('p', {}, t('onboard_how_body')),
      el('p', { class: 'muted' }, t('onboard_channels_note'))
    ]),

    el('button', { class: 'btn primary full', onClick: activate }, t('onboard_activate'))
  ]);
}
