// Version: 1.0010
// privacy.js — общ достъп до хостнатата политика за поверителност.
//  - openPrivacy(): отваря URL-а във външен браузър (изискване 7.1 на магазините).
//  - privacyFooter(): малък линк „Политика за поверителност“ за долния край на екран.
import { el } from '../ui/dom.js';
import { t } from './i18n.js';
import { STORE } from '../config.js';

export function openPrivacy() {
  const url = STORE && STORE.privacyUrl;
  if (!url) return;
  try {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.Browser && typeof cap.Plugins.Browser.open === 'function') {
      cap.Plugins.Browser.open({ url }); return;
    }
  } catch (_) {}
  try { window.open(url, '_system'); } catch (_) { try { window.open(url, '_blank'); } catch (e) {} }
}

export function privacyFooter() {
  return el('div', {
    class: 'privacy-footer',
    style: 'text-align:center;margin:22px 0 10px;font-size:12px'
  }, [
    el('a', {
      style: 'color:var(--muted,#888);text-decoration:underline;cursor:pointer',
      onclick: openPrivacy
    }, '🔒 ' + t('privacy_policy'))
  ]);
}
