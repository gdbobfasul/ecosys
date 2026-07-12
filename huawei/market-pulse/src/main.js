// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('market-pulse');            // балонче „✨ KCY" + showcase (ненатрапчиво)
playIntro();                               // ЕКРАН 1: 2-3 сек интро „KCY Ecosystem" (кой е производителят)
startPromoAds('market-pulse');             // реклами — гейтнати по модел (платен → изкл)
mountHelp('market-pulse');                 // универсален бутон „Помощ"
mountPrivacyLink('market-pulse');          // footer линк към политиката (per-store)
mountLegalGate('market-pulse', { finance: true }); // ЕКРАН 3: задължителни предупреждения/политики + отметка „Разбрах и съм съгласен"
// Рутер. Ред: интро (1) → език (2) → легал-гейт (3, overlay изчаква езика) → табло.
import { injectStyles } from './ui/styles.js';
import { loadState, defaultState } from './core/storage.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderMarket } from './screens/market.js';
import { renderDetail } from './screens/detail.js';
import { renderLanguage } from './screens/language.js';
import { applyDir, t, hasLangChosen } from './core/i18n.js';

const root = document.getElementById('app');
let state = null;

function go(screen, params) {
  params = params || {};
  switch (screen) {
    case 'language': return renderLanguage(root, () => go('dashboard'));
    case 'dashboard': return renderDashboard(root, go);
    case 'market': return renderMarket(root, params.marketId, go);
    case 'detail': return renderDetail(root, params.marketId, params.instId, go);
    default: return renderDashboard(root, go);
  }
}

// Повторно отваряне на избора на език (от бутона 🌐 в таблото).
window.__mpOpenLang = () => go('language');

async function boot() {
  injectStyles();
  applyDir();
  try {
    state = await Promise.race([
      loadState(),
      new Promise((res) => setTimeout(() => res(defaultState()), 2500))
    ]);
  } catch (_) { state = defaultState(); }
  if (!state) state = defaultState();

  // ЕКРАН 2: първо стартиране → избор на език преди таблото. Легал-гейтът (екран 3) е overlay,
  // който сам изчаква избора на език и се показва след него.
  if (!hasLangChosen()) return go('language');
  go('dashboard');
}

boot().catch((e) => {
  try {
    if (root) {
      const msg = (e && e.message) ? e.message : (t('err_unknown') || 'error');
      root.innerHTML = '<div style="padding:20px;font-family:sans-serif"><h2>' + t('app_name') + '</h2><p>' + String(msg) + '</p></div>';
    }
  } catch (_) {}
});
