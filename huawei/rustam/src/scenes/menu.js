// MenuScene — заглавие, избор на ниво (отключени), старт.
// Прогресът се пази в localStorage (THEME.saveKey).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { LEVELS, MAX_LEVEL } from './levels.js';
import { loadProgress } from '../store/progress.js';
import { getTop } from '../leaderboard.js';
import { t, tf } from '../core/i18n.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const prog = loadProgress();
    const unlocked = Phaser.Math.Clamp(prog.unlocked || 1, 1, MAX_LEVEL);

    // Фон градиент.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2c4a1c, 0x2c4a1c, 0x0a0d08, 0x0a0d08, 1);
    bg.fillRect(0, 0, W, H);

    // Декор: Рустам в средата, краставици наоколо и една подаваща се къртица.
    const hero = this.add.image(W / 2, H * 0.30, 'rustam').setScale(1.7);
    this.tweens.add({ targets: hero, y: H * 0.30 - 8, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const c = this.add.image(W / 2 + Math.cos(a) * 96, H * 0.30 + Math.sin(a) * 72, 'cuke').setScale(1.2);
      this.tweens.add({ targets: c, angle: i % 2 ? 8 : -8, yoyo: true, repeat: -1, duration: 1200 + i * 150 });
    }
    const mole = this.add.image(W * 0.74, H * 0.36, 'mole').setScale(0.5).setAngle(6);
    this.tweens.add({ targets: mole, y: H * 0.36 - 6, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });

    // Заглавие.
    this.add.text(W / 2, H * 0.46, THEME.titleText, {
      fontFamily: 'system-ui, sans-serif', fontSize: '46px', color: THEME.primaryHex,
      fontStyle: 'bold', stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.46 + 38, THEME.titleSub, {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#cbb'
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.53, t('tagline'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#bcd9a0', align: 'center'
    }).setOrigin(0.5);

    // Бутон „ИГРАЙ" (стартира последното отключено ниво).
    this.makeButton(W / 2, H * 0.60, tf('play_level', unlocked), () => {
      this.scene.start('Game', { level: unlocked, carryScore: 0 });
    }, THEME.accent);

    // Решетка с нивата 1..10.
    this.add.text(W / 2, H * 0.66, t('choose_level'), {
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
        box.on('pointerdown', () => this.scene.start('Game', { level: lv.id, carryScore: 0 }));
        label.setInteractive({ useHandCursor: true });
        label.on('pointerdown', () => this.scene.start('Game', { level: lv.id, carryScore: 0 }));
      }
    });

    // Бутон „🏆 РАНГ ЛИСТА".
    this.makeButton(W / 2, H * 0.88, '🏆 ' + t('leaderboard'), () => {
      this.scene.start('Leaderboard');
    }, THEME.primary, 200, 42);

    // Бутон „🌐 Език" — връща към екрана за избор на език.
    this.makeButton(W - 70, 26, t('lang_btn'), () => {
      this.scene.start('Language', { next: 'Menu' });
    }, 0x3a4a2c, 124, 34);

    // Най-добър резултат + водач.
    const top = getTop(1);
    const leader = top.length ? '  •  ' + tf('leader', top[0].name, top[0].score) : '';
    this.add.text(W / 2, H * 0.94, tf('best_score', prog.bestScore || 0) + leader, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#8a8', align: 'center'
    }).setOrigin(0.5);
  }

  makeButton(x, y, text, cb, color, bw, bh) {
    const w = bw || 240, h = bh || 48;
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
