// Version: 1.0001
import { enforceLock } from './core/lock.js';
enforceLock(); // 4-дневно пробно заключване (виж core/lock.js)
// HMM — Битка на терен (самостоятелно мобилно приложение, RUStore)
// Зарежда вградения двигател и пуска отборната (HMM) битка 3 срещу 3.
// Без portals backend, без мрежа: всичко е локално (offline).

// ВАЖЕН ред на импортите: i18n ПРЕДИ двигателя — i18n.js се изнася на
// window.HMM_I18N, а battle-engine.js (IIFE) чете преводите оттам по време на
// рендериране. Самият избор се пази в localStorage (ключ 'hmm.lang').
import './core/i18n.js';            // изнася window.HMM_I18N (t, tf, getLang, setLang…)
import './game/battle-heroes.js';   // дефинира window.BATTLE_HEROES
import './game/terrain-fight.js';   // дефинира window.startTerrainBg (жив терен)
import './game/leaderboard.js';     // дефинира window.HMMLeaderboard (локална ранг листа)
import './game/battle-engine.js';   // дефинира window.BattleEngine
import { ACCENT } from './theme.js';
import { t, hasLangChosen } from './core/i18n.js';
import { showLanguagePicker } from './core/language-picker.js';

function boot() {
  var arena = document.getElementById('arena');
  var hint = document.getElementById('boot-hint');
  if (hint) hint.style.display = 'none';

  var eng = new window.BattleEngine({
    container: arena,
    // НЕ подаваме title — двигателят ползва t('game_title') (локализирано).
    levels: 10,
    teamSize: 3,
    heroPool: window.BATTLE_HEROES.team,
    fieldWidth: 1920,
    fieldHeight: 2560,
    mode: 'HMM',
    // Относителен път — Vite/Capacitor зарежда от file:// чрез base './'
    assetsPath: 'assets/animations/',
    bgScene: 2,
    standalone: true
  });

  // 🌐 смяна на език от менюто: показва пикъра, после преначертава менюто на
  // новия език (играта е в състояние 'menu', когато бутонът е видим).
  eng.onChangeLang = function () {
    showLanguagePicker().then(function () { eng.drawMenu(); });
  };

  eng.start();

  // Лек акцент по темата (рамка на арената) — единствената визуална разлика по магазин.
  try {
    var wrap = arena.querySelector('.kbb-wrap');
    if (wrap) wrap.style.borderColor = ACCENT;
  } catch (e) {}
}

// При ПЪРВО стартиране (още няма избран език) показваме пикъра ПРЕДИ менюто.
// При следващи стартирания пропускаме директно към играта.
function startup() {
  // Локализирай boot-hint надписа (по подразбиране е руски).
  var hint = document.getElementById('boot-hint');
  if (hint) hint.textContent = t('loading');

  if (hasLangChosen()) {
    boot();
  } else {
    showLanguagePicker().then(boot);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startup);
} else {
  startup();
}
