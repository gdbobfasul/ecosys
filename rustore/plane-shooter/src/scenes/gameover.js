// GameOverScene — екран за победа или загуба + рестарт.
import Phaser from 'phaser';
import { THEME } from '../theme.js';
import Starfield from '../gfx/starfield.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.won = !!data.won;
    this.finalScore = data.score || 0;
  }

  create() {
    const { width, height } = this.scale;
    this.stars = new Starfield(this);

    const title = this.add.text(width / 2, height * 0.32,
      this.won ? 'ПОБЕДА!' : 'КРАЙ НА ИГРАТА', {
        fontFamily: 'system-ui, sans-serif', fontSize: '40px', fontStyle: 'bold',
        color: this.won ? '#39d98a' : THEME.dangerHex
      }).setOrigin(0.5);
    title.setShadow(0, 0, this.won ? '#39d98a' : THEME.dangerHex, 18, true, true);

    this.add.text(width / 2, height * 0.32 + 56, 'Точки: ' + this.finalScore, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff'
    }).setOrigin(0.5);

    if (this.won) {
      this.add.text(width / 2, height * 0.46,
        'Премина всичките 10 нива!', {
          fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#9fc8ff'
        }).setOrigin(0.5);
    }

    this.makeButton(width / 2, height * 0.62, 'ОТНОВО', () => {
      this.scene.start('Game', { level: 0, score: 0, lives: 3 });
    });
    this.makeButton(width / 2, height * 0.62 + 78, 'МЕНЮ', () => {
      this.scene.start('Menu');
    });
  }

  makeButton(x, y, label, onClick) {
    const w = 200, h = 56;
    const g = this.add.graphics();
    g.fillStyle(THEME.primary, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    g.lineStyle(2, 0xffffff, 0.6).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    const txt = this.add.text(x, y, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff'
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: [g, txt], scaleX: 0.96, scaleY: 0.96, duration: 80, yoyo: true });
      this.time.delayedCall(90, onClick);
    });
  }

  update(time, delta) {
    this.stars.update(delta / 1000);
  }
}
