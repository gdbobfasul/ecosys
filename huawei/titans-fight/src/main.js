// Version: 1.0015
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('titans-fight'); // „Още от Pupikes" showcase
playIntro(); // кратко „Pupikes" интро при старт
startPromoAds('titans-fight'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('titans-fight'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('titans-fight'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('titans-fight'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
import Phaser from 'phaser';
import { BootScene } from './scenes/boot.js';
import { LanguageScene } from './scenes/language.js';
import { MenuScene } from './scenes/menu.js';
import { WeaponSelectScene } from './scenes/weapon-select.js';
import { GameScene } from './scenes/game.js';
import { LeaderboardScene } from './scenes/leaderboard.js';
import { THEME } from './theme.js';

// ----------------------------------------------------------------------------
// РАЗМЕРИ НА ИГРАТА
// ----------------------------------------------------------------------------
// Преди играта беше с фиксиран 960x540 и Scale.FIT, което на телефон оставяше
// огромни черни ленти (играта изглеждаше "малка"). Сега ползваме Scale.RESIZE:
// canvas-ът заема ЦЕЛИЯ екран на устройството, а логическата резолюция следва
// реалните пиксели на дисплея. Така играта е истински пълноекранна.
//
// GAME_W / GAME_H са ДИНАМИЧНИ — обновяват се при всяко преоразмеряване и при
// завъртане на телефона. Сцените се преначертават спрямо текущите стойности.

export let GAME_W = window.innerWidth || 960;
export let GAME_H = window.innerHeight || 540;

// Помощник: всички сцени викат това, за да вземат актуалния размер.
export function gameSize(scene) {
  const s = scene.scale.gameSize;
  return { w: s.width, h: s.height };
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: THEME.bgBottom,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: GAME_W,
    height: GAME_H,
    autoCenter: Phaser.Scale.NO_CENTER
  },
  render: {
    antialias: true,
    roundPixels: false
  },
  // По подразбиране Phaser следи само 1 показалец (мишка + 1 пръст). За да може
  // играчът да се движи И да удря ЕДНОВРЕМЕННО (multi-touch), добавяме показалци.
  input: {
    activePointers: 4
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1500 },
      debug: false
    }
  },
  scene: [BootScene, LanguageScene, MenuScene, WeaponSelectScene, GameScene, LeaderboardScene]
};

const game = new Phaser.Game(config);

// Достъп до играта от конзолата/тестове (безвредно за продукцията).
if (typeof window !== 'undefined') window.__TF_GAME = game;

// Поддържаме GAME_W/GAME_H синхронни с реалния размер на canvas-а.
game.scale.on('resize', (gameSize) => {
  GAME_W = gameSize.width;
  GAME_H = gameSize.height;
});
GAME_W = game.scale.gameSize.width;
GAME_H = game.scale.gameSize.height;

// Махаме надписа "ЗАРЕЖДАНЕ…" щом Phaser е готов.
game.events.once('ready', () => {
  const hint = document.getElementById('boot-hint');
  if (hint) hint.style.display = 'none';
});

export default game;
