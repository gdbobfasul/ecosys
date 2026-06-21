// UIScene — HUD (оставащи пропуски, прогрес към целта, точки, ниво) + виртуален джойстик.
// Работи като overlay над GameScene.
import Phaser from 'phaser';
import { GAME_WIDTH } from '../main.js';
import { THEME } from '../theme.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  init(data) {
    this.levelNum = data.level;
    this.gameScene = data.game;
    this.maxLives = data.maxLives;
    this.quota = data.quota;
    this.joyVector = { x: 0, y: 0 };
  }

  create() {
    const W = GAME_WIDTH;

    // --- Оставащи пропуски (колко краставици може още да отмъкнат къртиците) ---
    // Показани като сърца — всяко загубено сърце = една изядена краставица.
    this.hearts = [];
    for (let i = 0; i < this.maxLives; i++) {
      const h = this.add.text(14 + i * 24, 12, '♥', {
        fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: THEME.dangerHex
      }).setDepth(100);
      this.hearts.push(h);
    }

    // --- Ниво ---
    this.add.text(W - 14, 12, `НИВО ${this.levelNum}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: THEME.primaryHex,
      fontStyle: 'bold'
    }).setOrigin(1, 0).setDepth(100);

    // --- Точки (общо набрани краставици в забега) ---
    this.scoreText = this.add.text(W - 14, 38, '🥒 0', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ffffff'
    }).setOrigin(1, 0).setDepth(100);

    // --- Лента за прогрес към целта (набрани / нужни) ---
    this.barBg = this.add.rectangle(W / 2, 20, W - 200, 12, 0x000000, 0.4)
      .setDepth(100).setStrokeStyle(1, 0xffffff, 0.2);
    this.barFill = this.add.rectangle(this.barBg.x - this.barBg.width / 2, 20, 1, 9, THEME.accent)
      .setOrigin(0, 0.5).setDepth(101);
    this.barText = this.add.text(W / 2, 38, `0 / ${this.quota}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#cde0bb'
    }).setOrigin(0.5, 0).setDepth(101);

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

    // Слушаме събития от GameScene.
    this.gameScene.events.on('livesChanged', this.updateLives, this);
    this.gameScene.events.on('progress', this.updateProgress, this);

    // Чистене при спиране.
    this.events.once('shutdown', () => {
      this.gameScene.events.off('livesChanged', this.updateLives, this);
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

  updateLives(cur) {
    this.hearts.forEach((h, i) => {
      h.setAlpha(i < cur ? 1 : 0.18);
    });
  }

  updateProgress(ratio, collected, quota, score) {
    const r = Phaser.Math.Clamp(ratio, 0, 1);
    this.barFill.width = Math.max(1, (this.barBg.width - 2) * r);
    if (this.barText) this.barText.setText(`${collected} / ${quota}`);
    if (this.scoreText) this.scoreText.setText(`🥒 ${score}`);
  }
}
