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
    game.start(levelNum, totalScore);
  }

  // Главен цикъл
  const clock = new THREE.Clock();
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05); // ограничаваме скока при лаг
    if (game && !game.ended) game.update(dt);
    engine.renderer.render(engine.scene, engine.camera);
    requestAnimationFrame(loop);
  }
  loop();

  toMenu();
}

boot().catch((err) => {
  console.error(err);
  if (bootHint) bootHint.textContent = 'Грешка при зареждане: ' + err.message;
});
