import { enforceLock } from './core/lock.js';
enforceLock(); // 4-дневно пробно заключване (виж core/lock.js)
// Дуел на ринга — самостоятелен мобилен билд (Vite + Capacitor).
// Вгражда оригиналния browser-движок (vanilla JS, DOM + WebM видеа) локално,
// без портали/бекенд/реклами/плащания. Работи офлайн.
import { THEME } from './theme.js';
import * as I18N from './core/i18n.js';
import { LANGUAGES, RTL_CODES } from './core/languages.js';

// Излагаме преводния слой на window ПРЕДИ да зареди движокът, за да може
// vanilla-JS движокът (battle-engine.js) да го ползва през window.DuelI18n.
// (Движокът е IIFE side-effect модул и не може да import-ва ES модули директно.)
window.DuelI18n = I18N;

// Тримата вендорнати модула излагат window.BATTLE_HEROES / startTerrainBg / BattleEngine.
// Зареждат се като side-effect (точно като оригиналните <script> тагове).
import './game/battle-heroes.js';
import './game/terrain-duel.js';
import './game/leaderboard.js';
import './game/battle-engine.js';

function applyDir() {
  // Дясно-наляво за арабски (целият документ).
  const rtl = RTL_CODES.indexOf(I18N.getLang()) > -1;
  document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', I18N.getLang());
}

function startEngine() {
  const arena = document.getElementById('arena');

  // Акцентът на темата (различен per-store) — приляга над движковия CSS.
  // Слага се веднъж.
  if (!document.getElementById('duel-theme-css')) {
    const css = document.createElement('style');
    css.id = 'duel-theme-css';
    css.textContent = `
      :root { --duel-accent: ${THEME.accent}; }
      .kbb-wrap { border-color: ${THEME.accent} !important;
                  box-shadow: 0 0 60px ${THEME.glow}, inset 0 0 80px rgba(0,0,0,.6) !important; }
      .kbb-go, .kbb-btn b { box-shadow: 0 0 14px ${THEME.glow}; }
      .kbb-card h1 { color: ${THEME.accentSoft} !important; }
    `;
    document.head.appendChild(css);
  }

  const eng = new window.BattleEngine({
    container: arena,
    // НЯМА slug → standalone: нула мрежови заявки (виж battle-engine.js).
    title: I18N.t('game_title'),
    levels: 10,
    teamSize: 1,
    heroPool: window.BATTLE_HEROES.duel,
    fieldWidth: 1280,
    fieldHeight: 960,
    mode: 'Duel',
    assetsPath: 'assets/animations/',   // локални vendorнати webm-и (public/assets/)
    bgScene: 1,
    standalone: true
  });
  eng.start();
}

/* ── Екран за избор на език (HTML overlay) ──
   Показва се ПРЕДИ менюто при първо стартиране. Решетка с местните имена на
   15-те езика. Изборът се пази в localStorage (ключ 'duel.lang'); при следващите
   стартирания се прескача. Достъпен е и по-късно през 🌐 бутона в менюто. */
function showLangPicker(onDone) {
  if (!document.getElementById('duel-lang-css')) {
    const css = document.createElement('style');
    css.id = 'duel-lang-css';
    css.textContent = [
      '#duel-lang{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'background:radial-gradient(ellipse at center,#241a1a 0%,#06060a 85%);padding:24px;box-sizing:border-box;overflow-y:auto;',
      'font-family:"Cinzel","Cormorant Garamond",Georgia,serif;-webkit-tap-highlight-color:transparent;}',
      '#duel-lang h2{color:#f8c450;font-size:30px;letter-spacing:2px;margin:0 0 22px;text-align:center;text-shadow:2px 2px 0 #000;}',
      '#duel-lang .duel-lang-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%;max-width:560px;}',
      '@media(min-width:560px){#duel-lang .duel-lang-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}',
      '#duel-lang button{min-height:60px;background:linear-gradient(180deg,#3a2a1a,#1a1208);color:#f0d896;',
      'border:2px solid #8a5a2a;border-radius:14px;font-family:inherit;font-size:20px;letter-spacing:.5px;cursor:pointer;',
      'box-shadow:0 4px 0 #000,inset 0 1px 0 rgba(255,200,120,.2);padding:8px 6px;}',
      '#duel-lang button:active{transform:translateY(2px);box-shadow:0 1px 0 #000;background:linear-gradient(180deg,#5a3a22,#2a1810);}'
    ].join('');
    document.head.appendChild(css);
  }

  const ov = document.createElement('div');
  ov.id = 'duel-lang';
  const h = document.createElement('h2');
  h.textContent = I18N.t('pick_lang');
  ov.appendChild(h);

  const grid = document.createElement('div');
  grid.className = 'duel-lang-grid';
  LANGUAGES.forEach((l) => {
    const b = document.createElement('button');
    b.textContent = l.native;
    if (RTL_CODES.indexOf(l.code) > -1) b.setAttribute('dir', 'rtl');
    b.addEventListener('click', () => {
      I18N.setLang(l.code);
      applyDir();
      ov.remove();
      onDone();
    });
    grid.appendChild(b);
  });
  ov.appendChild(grid);
  document.body.appendChild(ov);
}

function boot() {
  const hint = document.getElementById('boot-hint');
  if (hint) hint.remove();
  applyDir();

  // Първо стартиране → екран за избор на език; после движокът.
  // При следващите стартирания се прескача (hasLangChosen()).
  if (I18N.hasLangChosen()) {
    startEngine();
  } else {
    showLangPicker(startEngine);
  }
}

// Излагаме picker-а, за да може 🌐 бутонът в менюто да го отвори повторно.
// При повторен избор движокът се рестартира, за да се пречертае на новия език.
window.DuelOpenLangPicker = function () {
  showLangPicker(function () {
    startEngine();   // ново стартиране на движка → менюто се пречертава на новия език
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
