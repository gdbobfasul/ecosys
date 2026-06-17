// MenuScene — заглавие, избор на ниво (отключени), старт.
// Прогресът се пази в localStorage (THEME.saveKey).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { LEVELS, MAX_LEVEL } from './levels.js';
import { loadProgress } from '../store/progress.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const prog = loadProgress();
    const unlocked = Phaser.Math.Clamp(prog.unlocked || 1, 1, MAX_LEVEL);

    // Фон градиент (прост)
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a2412, 0x1a2412, 0x0a0d08, 0x0a0d08, 1);
    bg.fillRect(0, 0, W, H);

    // Декоративна „летяща“ илюстрация: герой + няколко снаряда
    const hero = this.add.image(W / 2, H * 0.30, 'hero_straw').setScale(1.6);
    this.tweens.add({ targets: hero, y: H * 0.30 - 8, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
    ['p_stone', 'p_bolt', 'p_pot', 'p_snowball'].forEach((tex, i) => {
      const a = (i / 4) * Math.PI * 2;
      const img = this.add.image(W / 2 + Math.cos(a) * 90, H * 0.30 + Math.sin(a) * 70, tex);
      this.tweens.add({
        targets: img, angle: 360, yoyo: false, repeat: -1, duration: 3000 + i * 400
      });
    });

    // Заглавие
    this.add.text(W / 2, H * 0.46, THEME.titleText, {
      fontFamily: 'system-ui, sans-serif', fontSize: '42px', color: THEME.primaryHex,
      fontStyle: 'bold', stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.46 + 36, THEME.titleSub, {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#cbb'
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.53, 'Движи се и избягвай снарядите!', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#9a9'
    }).setOrigin(0.5);

    // Бутон „ИГРАЙ" (стартира последното отключено ниво)
    this.makeButton(W / 2, H * 0.60, `ИГРАЙ (НИВО ${unlocked})`, () => {
      this.scene.start('Game', { level: unlocked });
    }, THEME.accent);

    // Решетка с нивата 1..10
    this.add.text(W / 2, H * 0.66, 'ИЗБЕРИ НИВО', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#9a9'
    }).setOrigin(0.5);

    const cols = 5, cellW = 64, cellH = 50;
    const startX = W / 2 - (cols - 1) * cellW / 2;
    const startY = H * 0.70;
    LEVELS.forEach((lv, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = startX + col * cellW, y = startY + row * cellH;
      const isUnlocked = lv.id <= unlocked;
      const box = this.add.rectangle(x, y, 52, 40, isUnlocked ? lv.accent : 0x333333, isUnlocked ? 0.9 : 0.5)
        .setStrokeStyle(2, 0x000000, 0.5);
      const label = this.add.text(x, y, isUnlocked ? String(lv.id) : '🔒', {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#fff', fontStyle: 'bold'
      }).setOrigin(0.5);
      if (isUnlocked) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerover', () => box.setScale(1.08));
        box.on('pointerout', () => box.setScale(1));
        box.on('pointerdown', () => this.scene.start('Game', { level: lv.id }));
        label.setInteractive({ useHandCursor: true });
        label.on('pointerdown', () => this.scene.start('Game', { level: lv.id }));
      }
    });

    // Най-добър резултат
    this.add.text(W / 2, H * 0.93, `Най-добър резултат: ${prog.bestScore || 0}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#8a8'
    }).setOrigin(0.5);
  }

  makeButton(x, y, text, cb, color) {
    const w = 240, h = 48;
    const rect = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(2, 0x000000, 0.4)
      .setInteractive({ useHandCursor: true });
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#0a0d08', fontStyle: 'bold'
    }).setOrigin(0.5);
    rect.on('pointerover', () => rect.setScale(1.04));
    rect.on('pointerout', () => rect.setScale(1));
    rect.on('pointerdown', cb);
    t.setInteractive({ useHandCursor: true }).on('pointerdown', cb);
    return rect;
  }
}
