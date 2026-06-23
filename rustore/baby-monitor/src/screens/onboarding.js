// onboarding.js — посрещане + безплатно „активиране“ на наетия робот.
import { el } from '../ui/dom.js';
import { safetyBanner } from '../ui/widgets.js';
import { setState } from '../core/storage.js';
import { t } from '../core/i18n.js';

export function renderOnboarding(root, ctx) {
  root.appendChild(el('div', { class: 'hero' }, [
    el('div', { class: 'logo' }, '👶'),
    el('h1', {}, t('app_title')),
    el('p', { class: 'muted' }, t('ob_tagline'))
  ]));

  root.appendChild(safetyBanner());

  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('ob_what_title')),
    el('ul', {}, [
      el('li', {}, t('ob_li_motion')),
      el('li', {}, t('ob_li_stranger')),
      el('li', {}, t('ob_li_left')),
      el('li', {}, t('ob_li_notify'))
    ]),
    el('p', { class: 'muted small' }, t('ob_note'))
  ]));

  root.appendChild(el('button', { class: 'btn wide', onclick: () => {
    setState({ activated: true, activatedAt: Date.now() });
    ctx.navigate('config');
  } }, t('ob_activate')));
}
