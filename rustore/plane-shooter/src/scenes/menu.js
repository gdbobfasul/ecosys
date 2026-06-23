// MenuScene — заглавен екран с градиентен фон, паралакс звезди и старт бутон.
import Phaser from 'phaser';
import { THEME } from '../theme.js';
import Starfield from '../gfx/starfield.js';
import { TOTAL_LEVELS } from './levels.js';
import { t, tf } from '../core/i18n.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const { width, height } = this.scale;
    this.stars = new Starfield(this);

    // Голям заглавен текст с glow.
    const title = this.add.text(width / 2, height * 0.26, THEME.titleText, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    title.setShadow(0, 0, THEME.accentHex, 18, true, true);

    this.add.text(width / 2, height * 0.26 + 38, THEME.titleSub, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: THEME.accentHex
    }).setOrigin(0.5);

    // Декоративен самолет.
    const plane = this.add.image(width / 2, height * 0.46, 'plane').setScale(1.6);
    this.tweens.add({
      targets: plane, y: plane.y - 12, duration: 1200,
      yoyo: true, repeat: -1, ease: 'Sine.inOut'
    });

    // Бутон СТАРТ.
    this.makeButton(width / 2, height * 0.62, t('start'), () => {
      this.scene.start('Game', { level: 0, score: 0, lives: 3 });
    });

    // Бутон РАНГ ЛИСТА.
    this.makeButton(width / 2, height * 0.62 + 72, t('lb_btn'), () => {
      this.scene.start('Leaderboard');
    });

    // Бутон „🌐 Език" — връща към екрана за избор на език.
    this.makeButton(width - 70, 26, t('lang_btn'), () => {
      this.scene.start('Language', { next: 'Menu' });
    });

    // Кратки инструкции.
    this.add.text(width / 2, height * 0.86,
      tf('instructions', TOTAL_LEVELS),
      {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#9fc8ff',
        align: 'center',
        lineSpacing: 6
      }).setOrigin(0.5);
  }

  makeButton(x, y, label, onClick) {
    const h = 58;
    const txt = this.add.text(x, y, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '24px',
      fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    // Ширината се адаптира към етикета (за по-дълги надписи като „Ранг листа").
    const w = Math.max(200, txt.width + 48);

    const g = this.add.graphics();
    g.fillStyle(THEME.primary, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    g.lineStyle(2, 0xffffff, 0.6).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    // Текстът трябва да е над графиката.
    this.children.bringToTop(txt);

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
