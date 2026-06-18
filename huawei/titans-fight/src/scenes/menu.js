import Phaser from 'phaser';
import { THEME } from '../theme.js';
import { LEVELS } from '../levels.js';
import { makeButton, titleText } from '../ui.js';
// Ранг листата (само за справка тук — сцената е регистрирана в main.js).
import { buildArena } from '../backgrounds.js';

// Главно меню + избор на ниво. Показва кои нива са отключени.
// Изцяло отзивчиво към размера на екрана (телефон портрет/пейзаж).
export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const { width: W, height: H } = this.scale.gameSize;

    // фон = арена на първото ниво за атмосфера
    buildArena(this, LEVELS[0].arena);

    titleText(this, W / 2, H * 0.10, THEME.titleText, Math.min(64, W * 0.10), THEME.primaryHex);
    titleText(this, W / 2, H * 0.18, THEME.titleSub, 18, THEME.accentHex);

    const unlocked = this.registry.get('unlockedLevel') || 1;

    titleText(this, W / 2, H * 0.26, 'ИЗБЕРИ НИВО', 22, '#ffffff');

    // Решетка от 10 нива — адаптивен брой колони според ширината.
    const portrait = H > W;
    const cols = portrait ? 2 : 5;
    const rows = Math.ceil(LEVELS.length / cols);
    const cellW = Math.min(W / (cols + 0.4), 190);
    const cellH = Math.min((H * 0.5) / rows, 96);
    const gapX = cellW * 1.08;
    const gapY = cellH * 1.18;
    const gridW = (cols - 1) * gapX;
    const startX = W / 2 - gridW / 2;
    const startY = H * 0.34;

    LEVELS.forEach((lvl, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * gapX;
      const y = startY + row * gapY;
      const open = lvl.id <= unlocked;
      const label = open ? `${lvl.id}  ${lvl.name}` : `🔒 ${lvl.name}`;
      const btn = makeButton(this, x, y, cellW, cellH * 0.86, label, () => {
        if (!open) return;
        this.registry.set('pendingLevel', lvl.id);
        this.scene.start('weapon-select');
      }, { color: open ? THEME.primary : 0x556070, fontSize: '17px' });
      if (!open) btn.setEnabled(false);
    });

    titleText(this, W / 2, H - 30,
      'Докосни ниво за да започнеш • Победи противника, за да отключиш следващото',
      Math.min(14, W * 0.026), '#cfcfd8');

    // Бутон „🏆 Ранг листа" (горе вляво) — отваря целия ТОП 100.
    makeButton(this, 96, 40, 168, 44, '🏆 РАНГ ЛИСТА', () => {
      this.scene.start('leaderboard');
    }, { color: THEME.accent, fontSize: '15px' });

    // бутон за нулиране на прогреса (полезно за тест)
    makeButton(this, W - 86, 40, 150, 44, 'НУЛИРАЙ', () => {
      try { localStorage.setItem('tf_unlocked', '1'); } catch (e) {}
      this.registry.set('unlockedLevel', 1);
      this.scene.restart();
    }, { color: THEME.danger, fontSize: '16px' });

    // Преначертаване при преоразмеряване/завъртане.
    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  _onResize() {
    // Просто рестартираме сцената с новия размер.
    this.scene.restart();
  }
}
