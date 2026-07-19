// Version: 1.0016
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('rustam'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
startPromoAds('rustam'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('rustam'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('rustam'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('rustam'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
// Входна точка на играта „Рустам".
// Рустам стои насред поле и бере краставици, които изскачат от земята. До всяка
// краставица започва да расте дупка (от малка точица нагоре); стигне ли пълен размер,
// от нея изскача къртица и прибира краставицата под земята. Рустам трябва да стигне
// краставицата НАВРЕМЕ. 10 нива — след 3-то къртиците (и дупките) стават по-малки,
// а Рустам има все по-малко време.
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
  // Аркадна физика — само за движението на Рустам (top-down, без гравитация).
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
