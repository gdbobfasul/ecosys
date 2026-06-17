// HMM — Битка на терен (самостоятелно мобилно приложение, RUStore)
// Зарежда вградения двигател и пуска отборната (HMM) битка 3 срещу 3.
// Без portals backend, без мрежа: всичко е локално (offline).

import './game/battle-heroes.js';   // дефинира window.BATTLE_HEROES
import './game/terrain-fight.js';   // дефинира window.startTerrainBg (жив терен)
import './game/battle-engine.js';   // дефинира window.BattleEngine
import { ACCENT } from './theme.js';

function boot() {
  var arena = document.getElementById('arena');
  var hint = document.getElementById('boot-hint');
  if (hint) hint.style.display = 'none';

  var eng = new window.BattleEngine({
    container: arena,
    title: 'Битка на терен — 3 срещу 3',
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
  eng.start();

  // Лек акцент по темата (рамка на арената) — единствената визуална разлика по магазин.
  try {
    var wrap = arena.querySelector('.kbb-wrap');
    if (wrap) wrap.style.borderColor = ACCENT;
  } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
