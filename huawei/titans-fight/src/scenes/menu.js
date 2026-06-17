import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../main.js';
import { THEME } from '../theme.js';
import { LEVELS } from '../levels.js';
import { makeButton, titleText } from '../ui.js';
import { buildArena } from '../backgrounds.js';

// Главно меню + избор на ниво. Показва кои нива са отключени.
export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    // фон = арена на първото ниво за атмосфера
    buildArena(this, LEVELS[0].arena);

    // плакатен титан (декорация)
    this._decorTitan();

    titleText(this, GAME_W / 2, 80, THEME.titleText, 64, THEME.primaryHex);
    titleText(this, GAME_W / 2, 128, THEME.titleSub, 18, THEME.accentHex);

    const unlocked = this.registry.get('unlockedLevel') || 1;

    titleText(this, GAME_W / 2, 178, 'ИЗБЕРИ НИВО', 22, '#ffffff');

    // Решетка от 10 нива (2 реда по 5)
    const cols = 5, cellW = 150, cellH = 92;
    const startX = GAME_W / 2 - ((cols - 1) * cellW) / 2;
    const startY = 250;
    LEVELS.forEach((lvl, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * cellW;
      const y = startY + row * (cellH + 18);
      const open = lvl.id <= unlocked;
      const label = open ? `${lvl.id}\n${lvl.name}` : `🔒\n${lvl.name}`;
      const btn = makeButton(this, x, y, cellW - 18, cellH, label, () => {
        if (!open) return;
        this.registry.set('pendingLevel', lvl.id);
        this.scene.start('weapon-select');
      }, { color: open ? (lvl.id <= unlocked ? THEME.primary : 0x555) : 0x444, fontSize: '16px' });
      if (!open) btn.setEnabled(false);
    });

    titleText(this, GAME_W / 2, GAME_H - 28,
      'Докосни ниво за да започнеш • Победи противника, за да отключиш следващото', 13, '#cfcfd8');

    // бутон за нулиране на прогреса (полезно за тест)
    makeButton(this, GAME_W - 90, 40, 150, 44, 'НУЛИРАЙ', () => {
      try { localStorage.setItem('tf_unlocked', '1'); } catch (e) {}
      this.registry.set('unlockedLevel', 1);
      this.scene.restart();
    }, { color: THEME.danger, fontSize: '16px' });
  }

  _decorTitan() {
    // лек заден силует на боец
    const g = this.add.graphics().setDepth(-50).setAlpha(0.18);
    g.fillStyle(THEME.primary, 1);
    g.fillCircle(GAME_W - 180, 300, 90);
    g.fillRoundedRect(GAME_W - 230, 360, 100, 160, 20);
  }
}
