// Входна точка: инициализира engine, лидерборд, контролите и оркестрира
// сцените меню -> игра -> край.
import * as THREE from 'three';
import { createEngine } from './engine/setup.js';
import { Controls } from './controls.js';
import { HUD } from './hud.js';
import { Leaderboard } from './leaderboard.js';
import { GameScene } from './scenes/game.js';
import { showMenu } from './scenes/menu.js';
import { showGameOver } from './scenes/gameover.js';

const root = document.getElementById('app');
const bootHint = document.getElementById('boot-hint');

async function boot() {
  const engine = createEngine(root);
  const leaderboard = new Leaderboard();
  await leaderboard.init();

  if (bootHint) bootHint.remove();

  // HUD се създава веднъж и се крие/показва според сцената.
  let hud = null;
  let game = null;

  const controlsFactory = (terrain, hudRef) =>
    new Controls(engine.camera, engine.renderer.domElement, terrain, hudRef);

  function toMenu() {
    if (hud) { hud.dispose(); hud = null; }
    if (game) { game.cleanup(); }
    engine.camera.position.set(0, 1.7, 0);
    showMenu(root, leaderboard, (startLevel) => startLevel != null && startGame(startLevel, 0));
  }

  function startGame(levelNum, totalScore) {
    if (hud) hud.dispose();
    hud = new HUD(root);
    if (!game) {
      game = new GameScene(engine, controlsFactory, hud, (result) => {
        if (hud) { hud.dispose(); hud = null; }
        showGameOver(
          root, leaderboard, result,
          () => toMenu(),
          (lvl) => startGame(lvl, result.win ? result.score : 0) // при печалба пренасяме точките
        );
      });
    } else {
      game.hud = hud;
      game.onLevelEnd = (result) => {
        if (hud) { hud.dispose(); hud = null; }
        showGameOver(
          root, leaderboard, result,
          () => toMenu(),
          (lvl) => startGame(lvl, result.win ? result.score : 0)
        );
      };
    }
    // Стартът на нивото е обвит в try/catch: ако нещо хвърли (генериране на
    // ниво, терен, контроли), вместо тих черен екран показваме ВИДИМ overlay
    // с текста на грешката — за да се вижда причината на устройството.
    try {
      game.start(levelNum, totalScore);
    } catch (err) {
      console.error('[startGame] грешка при старт на ниво', err);
      showErrorOverlay(root, err);
    }
  }

  // Видим overlay при грешка (вместо черен екран).
  function showErrorOverlay(parent, err) {
    const msg = (err && (err.stack || err.message)) || String(err);
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;inset:0;z-index:9999;background:#1a0808;color:#ffd2d2;
      font-family:monospace;font-size:13px;line-height:1.5;padding:18px;overflow:auto;
      -webkit-user-select:text;user-select:text;`;
    box.innerHTML = `<div style="font-size:18px;color:#ff6b6b;margin-bottom:10px;font-weight:700">
      Грешка при старт на нивото</div><pre style="white-space:pre-wrap;margin:0">${
        String(msg).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
      }</pre>
      <button id="err-back" style="margin-top:16px;padding:10px 22px;font-size:15px;border:none;
        border-radius:8px;background:#4fc3f7;color:#04121d;font-weight:700">Назад към менюто</button>`;
    parent.appendChild(box);
    box.querySelector('#err-back').addEventListener('click', () => {
      box.remove();
      toMenu();
    });
  }

  // Главен цикъл
  const clock = new THREE.Clock();
  let loopErrored = false;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05); // ограничаваме скока при лаг
    if (!loopErrored) {
      try {
        if (game && !game.ended) game.update(dt);
        engine.renderer.render(engine.scene, engine.camera);
      } catch (err) {
        // Грешка по време на игра/рендер: спираме цикъла и показваме причината,
        // вместо да рендираме мълчаливо черен екран кадър след кадър.
        loopErrored = true;
        console.error('[loop] грешка по време на игра', err);
        if (game) game.ended = true;
        showErrorOverlay(root, err);
      }
    }
    requestAnimationFrame(loop);
  }
  loop();

  toMenu();
}

boot().catch((err) => {
  console.error(err);
  if (bootHint) bootHint.textContent = 'Грешка при зареждане: ' + err.message;
});
