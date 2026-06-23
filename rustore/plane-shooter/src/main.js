// Входна точка на играта.
// Тук конфигурираме Phaser и регистрираме сцените.
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
  backgroundColor: '#05060f',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  // Scale.FIT + CENTER_BOTH -> вписва се в екрана при всякакво съотношение.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  // Аркадна физика (леки и бързи sprite-ове, без гравитация).
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  // Изглаждане + плътен пиксел рейшо за резки glow ефекти.
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
