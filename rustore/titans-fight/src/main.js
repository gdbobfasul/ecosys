import Phaser from 'phaser';
import { BootScene } from './scenes/boot.js';
import { MenuScene } from './scenes/menu.js';
import { WeaponSelectScene } from './scenes/weapon-select.js';
import { GameScene } from './scenes/game.js';
import { THEME } from './theme.js';

// Базова логическа резолюция. Phaser.Scale.FIT мащабира към екрана,
// така че на телефон играта запълва дисплея без да чупим пропорциите.
export const GAME_W = 960;
export const GAME_H = 540;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: THEME.bgBottom,
  width: GAME_W,
  height: GAME_H,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    roundPixels: false
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1500 },
      debug: false
    }
  },
  scene: [BootScene, MenuScene, WeaponSelectScene, GameScene]
};

const game = new Phaser.Game(config);

// Махаме надписа "ЗАРЕЖДАНЕ…" щом Phaser е готов.
game.events.once('ready', () => {
  const hint = document.getElementById('boot-hint');
  if (hint) hint.style.display = 'none';
});

export default game;
