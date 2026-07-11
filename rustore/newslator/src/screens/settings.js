// Version: 1.0010
// Екран „Настройки“ — език на приложението (повторен избор!), държава, авто-превод,
// четене на глас, и кратко „Относно“ с уговорката за източниците.
import { el, clear } from '../ui/dom.js';
import { t, tf, getLang, languageByCode } from '../core/i18n.js';
import { countryByCode } from '../data/feeds.js';
import { ttsAvailable } from '../core/tts.js';
import { openPrivacy } from '../core/privacy.js';

function toggleCard(labelKey, descKey, getVal, onToggle) {
  const sw = el('div', { class: 'switch' + (getVal() ? ' on' : '') });
  const row = el('div', { class: 'card' }, [
    el('div', { class: 'toggle', onclick: () => { onToggle(); sw.className = 'switch' + (getVal() ? ' on' : ''); } }, [
      el('div', {}, [
        el('div', {}, t(labelKey)),
        el('div', { class: 'muted', style: 'font-size:13px;margin-top:3px' }, t(descKey))
      ]),
      sw
    ])
  ]);
  return row;
}

export function renderSettings(root, app, nav) {
  clear(root);
  root.appendChild(el('h2', {}, t('nav_settings')));

  // 🌐 Език на приложението — ВИНАГИ достъпен, за да се поправи сбъркан избор без преинсталиране.
  const curLang = languageByCode(getLang());
  root.appendChild(el('div', { class: 'card' }, [
    el('div', {}, t('set_language')),
    el('div', { class: 'muted', style: 'font-size:13px;margin:3px 0 10px' }, curLang.native),
    el('button', { class: 'btn block secondary', onclick: () => nav.openLang() }, '🌐 ' + t('language'))
  ]));

  // Държава
  const country = app.country ? countryByCode(app.country) : null;
  root.appendChild(el('div', { class: 'card' }, [
    el('div', {}, t('set_country')),
    el('div', { class: 'muted', style: 'font-size:13px;margin:3px 0 10px' }, country ? country.name : '—'),
    el('button', { class: 'btn block secondary', onclick: () => nav.go('countries') }, '🗺️ ' + t('choose_country'))
  ]));

  // Авто-превод
  root.appendChild(toggleCard('set_autotranslate', 'set_autotranslate_desc',
    () => app.settings.autoTranslate,
    () => { app.settings.autoTranslate = !app.settings.autoTranslate; nav.persist(); }));

  // Четене на глас (само ако устройството го поддържа)
  if (ttsAvailable()) {
    root.appendChild(toggleCard('set_tts', 'set_tts_desc',
      () => app.settings.tts,
      () => { app.settings.tts = !app.settings.tts; nav.persist(); }));
  }

  // Относно + уговорка за източниците
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_about')),
    el('div', { class: 'muted', style: 'font-size:13px;line-height:1.55' }, t('set_about_text')),
    el('div', { class: 'note' }, t('news_disclaimer')),
    el('button', { class: 'btn block secondary', style: 'margin-top:10px', onclick: openPrivacy }, '🔒 ' + t('privacy_policy'))
  ]));
}
