import { mountLangGate as __mountLangGate } from './core/lang-gate.js';
import { LANGUAGES as __LG_L, getLang as __LG_G, setLang as __LG_S } from './core/i18n.js';
__mountLangGate({ languages: __LG_L, current: __LG_G(), setLang: __LG_S });
// Version: 1.0024
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
import { enforceLicense } from './core/license.js';
enforceLock();
mountEcosystem('newslator'); // „Още от Pupikes" showcase
playIntro(); // кратко „Pupikes" интро при старт
startPromoAds('newslator'); // реклами: старт (след интрото) + среда + край (PUPIKES_END_AD)
mountHelp('newslator'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('newslator'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('newslator'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
enforceLicense('newslator', 'rustore'); // лицензен гейт СЛЕД езика (rustore билд)
// main.js — входна точка и рутер: език → начален екран → основен изглед с раздели
// (Табло / Новини / Държави / Запазени / Инструменти / Настройки). Езикът може да се смени по всяко време с 🌐.
// 11.09.2026 (v1.0024): ПЪРВИЯТ ЕКРАН Е ТАБЛО (screens/dashboard.js) с карти за всички функции;
// ако потребителят още не е избрал държава, се предлага такава по езика (feeds.suggestCountry),
// за да не е празно нищо още от първото пускане.
import { injectStyles } from './ui/styles.js';
import { el, clear } from './ui/dom.js';
import { applyDir, t, hasLangChosen, getLang } from './core/i18n.js';
import { loadState, saveState, defaultState } from './core/storage.js';
import { suggestCountry } from './data/feeds.js';
import { renderLanguage } from './screens/language.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderHome } from './screens/dashboard.js';
import { renderNews } from './screens/news.js';
import { renderCountries } from './screens/countries.js';
import { renderSaved } from './screens/saved.js';
import { renderSettings } from './screens/settings.js';
import { renderTools, loadDigest, checkKeywords, setActiveTool } from './screens/tools.js';
import { privacyFooter } from './core/privacy.js';

const rootEl = document.getElementById('app');
let app = null;
let view = 'main';        // 'language' | 'onboarding' | 'main'
let tab = 'home';         // активен раздел в основния изглед
let forceLang = false;    // повторен избор на език (от 🌐)
let pendingQuery = '';    // търсене, подадено от таблото → таб „Новини"

function persist() { saveState(app); }

const nav = {
  go(target) { tab = target; render(); },
  // от таблото: търсене в „Новини" / конкретен под-таб на „Инструменти"
  search(q) { pendingQuery = q; tab = 'news'; render(); },
  tool(k) { setActiveTool(k); tab = 'tools'; render(); },
  persist,
  openLang() { forceLang = true; view = 'language'; render(); }
};

// Държава има ВИНАГИ: избраната от потребителя или предложена по езика (countryAuto=true до избор).
function ensureCountry() {
  if (app.country) return;
  app.country = suggestCountry(getLang());
  app.countryAuto = true;
  persist();
}

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
    mk('home', '🏠', 'nav_home'),
    mk('news', '📰', 'nav_news'),
    mk('countries', '🗺️', 'nav_countries'),
    mk('saved', '⭐', 'nav_saved'),
    mk('tools', '🧰', 'nav_tools'),
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
    renderOnboarding(rootEl, () => { app.onboarded = true; persist(); view = 'main'; tab = 'home'; render(); });
    return;
  }

  // Основен изглед: лента + съдържание + долна навигация.
  ensureCountry();
  rootEl.appendChild(topBar());
  const content = el('main', { class: 'content' });
  rootEl.appendChild(content);
  rootEl.appendChild(tabBar());

  if (tab === 'countries') {
    renderCountries(content, app, nav, (code) => {
      app.country = code; app.countryAuto = false; persist();
      tab = 'news'; render();
    });
  } else if (tab === 'home') {
    renderHome(content, app, nav);
  } else if (tab === 'saved') {
    renderSaved(content, app, nav);
  } else if (tab === 'tools') {
    renderTools(content, app, nav);
  } else if (tab === 'settings') {
    renderSettings(content, app, nav);
  } else {
    const q = pendingQuery; pendingQuery = '';
    renderNews(content, app, nav, { query: q });
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
  else { view = 'main'; tab = 'home'; }
  render();
  // Дайджест + ключови думи: ЕДНО фоново теглене на пускане (след първия екран), после
  // само от кеша — никакви повторни заявки, колкото и време да стои отворен апът.
  if (app.onboarded && (app.country || (app.following || []).length)) {
    setTimeout(() => { loadDigest(app).then(() => checkKeywords(app)).catch(() => {}); }, 4000);
  }
}

boot().catch((e) => {
  try {
    const msg = (e && e.message) ? e.message : t('err_unknown');
    rootEl.innerHTML = '<div style="padding:20px;font-family:sans-serif">' +
      '<h2>' + t('app_name') + '</h2><p>' + t('boot_error').replace('{0}', msg) + '</p></div>';
  } catch (_) {}
});
