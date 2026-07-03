// Version: 1.0001
// UIScene — HUD (здраве, прогрес, точки, ниво) + виртуален джойстик.
// Работи като overlay над GameScene.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { tf } from '../core/i18n.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  init(data) {
    this.levelNum = data.level;
    this.gameScene = data.game;
    this.joyVector = { x: 0, y: 0 };
  }

  create() {
    const W = GAME_WIDTH;

    // --- Сърца (здраве) ---
    this.hearts = [];
    const maxH = this.gameScene.player.maxHealth;
    for (let i = 0; i < maxH; i++) {
      const h = this.add.text(14 + i * 26, 14, '♥', {
        fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: THEME.dangerHex
      }).setDepth(100);
      this.hearts.push(h);
    }

    // --- Ниво ---
    this.add.text(W - 14, 14, tf('level_n', this.levelNum), {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: THEME.primaryHex,
      fontStyle: 'bold'
    }).setOrigin(1, 0).setDepth(100);

    // --- Точки ---
    this.scoreText = this.add.text(W - 14, 40, '0', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff'
    }).setOrigin(1, 0).setDepth(100);

    // --- Лента за прогрес (оцеляване) ---
    this.barBg = this.add.rectangle(W / 2, 18, W - 220, 10, 0x000000, 0.35)
      .setDepth(100).setStrokeStyle(1, 0xffffff, 0.2);
    this.barFill = this.add.rectangle(this.barBg.x - this.barBg.width / 2, 18, 1, 8, THEME.accent)
      .setOrigin(0, 0.5).setDepth(101);

    // --- Виртуален джойстик (динамичен: появява се където докоснеш) ---
    this.joyBase = this.add.image(0, 0, 'joy_base').setDepth(95).setVisible(false).setScrollFactor(0);
    this.joyThumb = this.add.image(0, 0, 'joy_thumb').setDepth(96).setVisible(false).setScrollFactor(0);
    this.joyId = null;
    this.joyRadius = 52;

    this.input.addPointer(2);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    // Слушаме събития от GameScene
    this.gameScene.events.on('healthChanged', this.updateHealth, this);
    this.gameScene.events.on('progress', this.updateProgress, this);

    // Чистене при спиране
    this.events.once('shutdown', () => {
      this.gameScene.events.off('healthChanged', this.updateHealth, this);
      this.gameScene.events.off('progress', this.updateProgress, this);
    });
  }

  onDown(pointer) {
    if (this.joyId !== null) return;
    this.joyId = pointer.id;
    this.joyOrigin = { x: pointer.x, y: pointer.y };
    this.joyBase.setPosition(pointer.x, pointer.y).setVisible(true);
    this.joyThumb.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  onMove(pointer) {
    if (pointer.id !== this.joyId) return;
    let dx = pointer.x - this.joyOrigin.x;
    let dy = pointer.y - this.joyOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > this.joyRadius) { dx = dx / len * this.joyRadius; dy = dy / len * this.joyRadius; }
    this.joyThumb.setPosition(this.joyOrigin.x + dx, this.joyOrigin.y + dy);
    this.joyVector.x = dx / this.joyRadius;
    this.joyVector.y = dy / this.joyRadius;
  }

  onUp(pointer) {
    if (pointer.id !== this.joyId) return;
    this.joyId = null;
    this.joyVector.x = 0; this.joyVector.y = 0;
    this.joyBase.setVisible(false);
    this.joyThumb.setVisible(false);
  }

  updateHealth(cur) {
    this.hearts.forEach((h, i) => {
      h.setAlpha(i < cur ? 1 : 0.18);
    });
  }

  updateProgress(ratio, score) {
    const r = Phaser.Math.Clamp(ratio, 0, 1);
    this.barFill.width = Math.max(1, (this.barBg.width - 2) * r);
    if (this.scoreText) this.scoreText.setText(String(score));
  }
}
