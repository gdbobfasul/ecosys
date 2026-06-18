// Дуел на ринга — самостоятелен мобилен билд (Vite + Capacitor).
// Вгражда оригиналния browser-движок (vanilla JS, DOM + WebM видеа) локално,
// без портали/бекенд/реклами/плащания. Работи офлайн.
import { THEME } from './theme.js';

// Тримата вендорнати модула излагат window.BATTLE_HEROES / startTerrainBg / BattleEngine.
// Зареждат се като side-effect (точно като оригиналните <script> тагове).
import './game/battle-heroes.js';
import './game/terrain-duel.js';
import './game/leaderboard.js';
import './game/battle-engine.js';

function boot() {
  const arena = document.getElementById('arena');
  const hint = document.getElementById('boot-hint');
  if (hint) hint.remove();

  // Акцентът на темата (различен per-store) — приляга над движковия CSS.
  const css = document.createElement('style');
  css.textContent = `
    :root { --duel-accent: ${THEME.accent}; }
    .kbb-wrap { border-color: ${THEME.accent} !important;
                box-shadow: 0 0 60px ${THEME.glow}, inset 0 0 80px rgba(0,0,0,.6) !important; }
    .kbb-go, .kbb-btn b { box-shadow: 0 0 14px ${THEME.glow}; }
    .kbb-card h1 { color: ${THEME.accentSoft} !important; }
  `;
  document.head.appendChild(css);

  const eng = new window.BattleEngine({
    container: arena,
    // НЯМА slug → standalone: нула мрежови заявки (виж battle-engine.js).
    title: 'Дуел на ринга — 1 срещу 1',
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
