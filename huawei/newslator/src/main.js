// Version: 1.0010
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('newslator'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
startPromoAds('newslator'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('newslator'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('newslator'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('newslator'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
// main.js — входна точка и рутер: език → начален екран → основен изглед с раздели
// (Новини / Държави / Настройки). Езикът може да се смени по всяко време с 🌐.
import { injectStyles } from './ui/styles.js';
import { el, clear } from './ui/dom.js';
import { applyDir, t, hasLangChosen } from './core/i18n.js';
import { loadState, saveState, defaultState } from './core/storage.js';
import { renderLanguage } from './screens/language.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderNews } from './screens/news.js';
import { renderCountries } from './screens/countries.js';
import { renderSettings } from './screens/settings.js';
import { privacyFooter } from './core/privacy.js';

const rootEl = document.getElementById('app');
let app = null;
let view = 'main';        // 'language' | 'onboarding' | 'main'
let tab = 'news';         // активен раздел в основния изглед
let forceLang = false;    // повторен избор на език (от 🌐)

function persist() { saveState(app); }

const nav = {
  go(target) { tab = target; render(); },
  persist,
  openLang() { forceLang = true; view = 'language'; render(); }
};

function topBar() {
  return el('div', { class: 'top' }, [
    el('div', { class: 'logo' }),
    el('h1', {}, t('app_name')),
    el('button', { class: 'icon-btn', title: t('language'), onclick: () => nav.openLang() }, '🌐')
  ]);
}

function tabBar() {
  const mk = (id, ic, labelKey) => el('button', {
    class: 'tab' + (tab === id ? ' active' : ''),
    onclick: () => { tab = id; render(); }
  }, [el('span', { class: 'ic' }, ic), el('span', {}, t(labelKey))]);
  return el('div', { class: 'tabbar' }, [
    mk('news', '📰', 'nav_news'),
    mk('countries', '🗺️', 'nav_countries'),
    mk('settings', '⚙️', 'nav_settings')
  ]);
}

function render() {
  clear(rootEl);

  // Повторен/първи избор на език.
  if (view === 'language' || !hasLangChosen()) {
    const repick = forceLang;
    renderLanguage(rootEl, {
      showCancel: repick,
      onChosen: () => { forceLang = false; view = app.onboarded ? 'main' : 'onboarding'; render(); },
      onCancel: () => { forceLang = false; view = 'main'; render(); }
    });
    return;
  }

  // Начален екран (веднъж).
  if (view === 'onboarding' || !app.onboarded) {
    renderOnboarding(rootEl, () => { app.onboarded = true; persist(); view = 'main'; tab = app.country ? 'news' : 'countries'; render(); });
    return;
  }

  // Основен изглед: лента + съдържание + долна навигация.
  rootEl.appendChild(topBar());
  const content = el('main', { class: 'content' });
  rootEl.appendChild(content);
  rootEl.appendChild(tabBar());

  if (tab === 'countries') {
    renderCountries(content, app.country, (code) => {
      app.country = code; persist();
      tab = 'news'; render();
    });
  } else if (tab === 'settings') {
    renderSettings(content, app, nav);
  } else {
    renderNews(content, app, nav);
  }

  // Линк към политиката за поверителност — най-отдолу на всеки екран (изискване 7.1 на магазините).
  content.appendChild(privacyFooter());
}

async function boot() {
  injectStyles();
  applyDir();
  try {
    app = await Promise.race([
      loadState(),
      new Promise((res) => setTimeout(() => res(defaultState()), 2500))
    ]);
  } catch (_) { app = defaultState(); }
  if (!app) app = defaultState();

  if (!hasLangChosen()) view = 'language';
  else if (!app.onboarded) view = 'onboarding';
  else { view = 'main'; tab = app.country ? 'news' : 'countries'; }
  render();
}

boot().catch((e) => {
  try {
    const msg = (e && e.message) ? e.message : t('err_unknown');
    rootEl.innerHTML = '<div style="padding:20px;font-family:sans-serif">' +
      '<h2>' + t('app_name') + '</h2><p>' + t('boot_error').replace('{0}', msg) + '</p></div>';
  } catch (_) {}
});
