// Version: 1.0009
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
enforceLock();
mountEcosystem('fps-hunter'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
startPromoAds('fps-hunter'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('fps-hunter'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
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
import { showLanguage } from './scenes/language.js';
import { t, tf, hasLangChosen } from './core/i18n.js';

const root = document.getElementById('app');
const bootHint = document.getElementById('boot-hint');

async function boot() {
  // Текстът „Зареждане…" на избрания (или подразбиращ се) език.
  if (bootHint) bootHint.textContent = t('loading');
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
    try {
      if (hud) { hud.dispose(); hud = null; }
      if (game) { game.cleanup(); }
      // Камерата вече е извън сцената след cleanup(); връщаме я в неутрална поза.
      engine.camera.position.set(0, 1.7, 0);
      engine.camera.quaternion.identity();
      showMenu(root, leaderboard, (startLevel) => startLevel != null && startGame(startLevel, 0));
    } catch (err) {
      console.error('[toMenu] грешка при връщане към менюто', err);
      showErrorOverlay(root, err);
    }
  }

  // Краят на ниво е една и съща логика и при първи старт, и при рестарт —
  // дефинираме я веднъж, за да няма разминаване между двата пътя.
  function handleLevelEnd(result) {
    if (hud) { hud.dispose(); hud = null; }
    showGameOver(
      root, leaderboard, result,
      () => toMenu(),
      (lvl) => startGame(lvl, result.win ? result.score : 0) // при печалба пренасяме точките
    );
  }

  function startGame(levelNum, totalScore) {
    // ЦЕЛИЯТ старт е в try/catch (преди new HUD беше ОТВЪН → грешка в HUD оставаше
    // невидима: менюто е махнато, сцената празна, нищо не реагира).
    try {
      if (hud) hud.dispose();
      hud = new HUD(root);
      // GameScene се създава веднъж и се преизползва при рестарт; всеки път
      // освежаваме препратките към новия HUD и към обработчика за край на ниво.
      if (!game) {
        game = new GameScene(engine, controlsFactory, hud, handleLevelEnd);
      } else {
        game.hud = hud;
        game.onLevelEnd = handleLevelEnd;
      }
      game.start(levelNum, totalScore);
      blackProbe = 0; blackReported = false; // пре-армиране на диагностиката за това ниво
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
      ${t('err_title')}</div><pre style="white-space:pre-wrap;margin:0">${
        String(msg).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
      }</pre>
      <button id="err-back" style="margin-top:16px;padding:10px 22px;font-size:15px;border:none;
        border-radius:8px;background:#4fc3f7;color:#04121d;font-weight:700">${t('err_back')}</button>`;
    parent.appendChild(box);
    box.querySelector('#err-back').addEventListener('click', () => {
      box.remove();
      toMenu();
    });
  }

  // Диагностичен overlay при „черен екран без грешка" (нищо не се рисува / нулево платно).
  // Показва реалните числа, за да се установи причината директно на устройството.
  function showDiagOverlay(parent, calls, canvas, centerBlack) {
    const cam = engine.camera;
    const p = cam ? cam.position : { x: 0, y: 0, z: 0 };
    const lines = [
      'причина: ' + (centerBlack ? 'кадърът е ЧЕРЕН (рисува се, но черно)' :
        (canvas.width === 0 || canvas.height === 0) ? 'нулево платно' : 'нула тегления'),
      'draw calls: ' + calls,
      'canvas (буфер): ' + canvas.width + ' × ' + canvas.height,
      'canvas (CSS): ' + canvas.clientWidth + ' × ' + canvas.clientHeight,
      'window: ' + window.innerWidth + ' × ' + window.innerHeight,
      'documentElement: ' + document.documentElement.clientWidth + ' × ' + document.documentElement.clientHeight,
      'pixelRatio: ' + (window.devicePixelRatio || 1),
      'камера xyz: ' + p.x.toFixed(1) + ' / ' + p.y.toFixed(1) + ' / ' + p.z.toFixed(1),
      'scene.background: ' + (engine.scene && engine.scene.background ? '#' + engine.scene.background.getHexString() : 'няма')
    ];
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;inset:0;z-index:9999;background:#08121a;color:#cfe7ff;
      font-family:monospace;font-size:13px;line-height:1.7;padding:18px;overflow:auto;
      -webkit-user-select:text;user-select:text;`;
    box.innerHTML = `<div style="font-size:17px;color:#4fc3f7;margin-bottom:10px;font-weight:700">
      Диагностика на екрана</div><pre style="white-space:pre-wrap;margin:0">${lines.join('\n')}</pre>
      <button id="diag-back" style="margin-top:16px;padding:10px 22px;font-size:15px;border:none;
        border-radius:8px;background:#4fc3f7;color:#04121d;font-weight:700">${t('err_back')}</button>`;
    parent.appendChild(box);
    box.querySelector('#diag-back').addEventListener('click', () => { box.remove(); toMenu(); });
  }

  // Главен цикъл
  const clock = new THREE.Clock();
  let loopErrored = false;
  let blackProbe = 0;        // броим кадри докато тече игра, за да хванем „нищо не се рисува"
  let blackReported = false;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05); // ограничаваме скока при лаг
    if (!loopErrored) {
      try {
        // Синхронизирай размера на платното с реалния (поправя черен екран, когато
        // WebView-ът установи innerHeight чак няколко кадъра след старта).
        if (engine.syncSize) engine.syncSize();
        if (game && !game.ended) game.update(dt);
        engine.renderer.render(engine.scene, engine.camera);
        // ДИАГНОСТИКА: ако тече игра, но рендерът не прави НИТО едно теглене (draw call),
        // или платното е с нулев размер — вместо мълчалив черен екран показваме реалните
        // числа, за да се види причината директно на телефона.
        if (game && !game.ended && !blackReported) {
          if (++blackProbe >= 40) {
            const info = engine.renderer.info.render;
            const c = engine.renderer.domElement;
            const calls = info ? info.calls : -1;
            // РЕАЛНА проба за „черно": четем централния пиксел от платното. Така хващаме и
            // случая, в който рендерът ПРАВИ тегления и платното е с размер, но кадърът пак
            // излиза черен (напр. отказал шейдър за небе/невалидна камера) — който проверката
            // само по calls/размер пропускаше.
            let centerBlack = false;
            try {
              const gl = engine.renderer.getContext();
              const px = new Uint8Array(4);
              gl.readPixels((c.width / 2) | 0, (c.height / 2) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
              centerBlack = (px[0] + px[1] + px[2] < 12);
            } catch (_) { /* без четене → разчитаме на calls/размер */ }
            if (calls === 0 || c.width === 0 || c.height === 0 || centerBlack) {
              blackReported = true;
              showDiagOverlay(root, calls, c, centerBlack);
            }
          }
        }
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

  // При първо стартиране показваме избора на език ПРЕДИ менюто; после се пази
  // в localStorage и при следващите стартирания отиваме директно в менюто.
  if (hasLangChosen()) {
    toMenu();
  } else {
    showLanguage(root, () => toMenu());
  }
}

boot().catch((err) => {
  console.error(err);
  if (bootHint) bootHint.textContent = tf('boot_error', err.message);
});
