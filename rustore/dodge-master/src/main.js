// Version: 1.0015
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('dodge-master'); // „Още от Pupikes" showcase
playIntro(); // кратко „Pupikes" интро при старт
startPromoAds('dodge-master'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('dodge-master'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('dodge-master'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('dodge-master'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
// Входна точка на играта EvadeArena.
// Top-down dodge/survival: човек в центъра, отвсякъде летят старовремски снаряди,
// играчът се движи свободно и ги избягва. 10 нива с нарастваща трудност.
import Phaser from 'phaser';
import BootScene from './scenes/boot.js';
import LanguageScene from './scenes/language.js';
import MenuScene from './scenes/menu.js';
import GameScene from './scenes/game.js';
import UIScene from './scenes/ui.js';
import GameOverScene from './scenes/gameover.js';
import LeaderboardScene from './scenes/leaderboard.js';

// Логическа резолюция на играта (портретен режим, типичен за телефон).
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0a0d08',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  // Scale.FIT + CENTER_BOTH -> вписва се в екрана при всякакво съотношение.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  // Аркадна физика (леки и бързи sprite-ове, без гравитация — top-down).
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  render: {
    antialias: true,
    roundPixels: false
  },
  scene: [BootScene, LanguageScene, MenuScene, GameScene, UIScene, GameOverScene, LeaderboardScene]
};

const game = new Phaser.Game(config);

// Махаме надписа „ЗАРЕЖДАНЕ" след старта на Phaser.
game.events.once('ready', () => {
  const hint = document.getElementById('boot-hint');
  if (hint) hint.remove();
});

export default game;
