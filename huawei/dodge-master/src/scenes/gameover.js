// GameOverScene — екран за победа/загуба + бутони (напред/пак/меню).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { MAX_LEVEL } from './levels.js';
import { recordWin, recordScore } from '../store/progress.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.win = !!data.win;
    this.levelNum = data.level || 1;
    this.score = data.score || 0;
    this.dodges = data.dodges || 0;
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    // Записваме прогреса
    if (this.win) recordWin(this.levelNum, this.score);
    else recordScore(this.score);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8); bg.fillRect(0, 0, W, H);

    const title = this.win ? 'ОЦЕЛЯ!' : 'УЦЕЛЕН СИ!';
    const color = this.win ? THEME.accentHex : THEME.dangerHex;
    this.add.text(W / 2, H * 0.30, title, {
      fontFamily: 'system-ui, sans-serif', fontSize: '44px', color,
      fontStyle: 'bold', stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.40, `Ниво ${this.levelNum}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#fff'
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.46,
      `Точки: ${this.score}\nИзбегнати: ${this.dodges}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#cbb', align: 'center'
    }).setOrigin(0.5);

    let y = H * 0.58;
    // Бутон „напред" само ако е победа и има още нива
    if (this.win && this.levelNum < MAX_LEVEL) {
      this.makeButton(W / 2, y, `НАПРЕД (НИВО ${this.levelNum + 1})`, () => {
        this.scene.start('Game', { level: this.levelNum + 1 });
      }, THEME.accent);
      y += 60;
    } else if (this.win && this.levelNum >= MAX_LEVEL) {
      this.add.text(W / 2, y, 'Премина всички 10 нива! 🏆', {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: THEME.primaryHex
      }).setOrigin(0.5);
      y += 50;
    }

    this.makeButton(W / 2, y, this.win ? 'ИГРАЙ ПАК' : 'ОПИТАЙ ПАК', () => {
      this.scene.start('Game', { level: this.levelNum });
    }, THEME.primary);
    y += 60;

    this.makeButton(W / 2, y, 'МЕНЮ', () => {
      this.scene.start('Menu');
    }, 0x666666);
  }

  makeButton(x, y, text, cb, color) {
    const rect = this.add.rectangle(x, y, 240, 48, color, 1).setStrokeStyle(2, 0x000000, 0.4)
      .setInteractive({ useHandCursor: true });
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#0a0d08', fontStyle: 'bold'
    }).setOrigin(0.5);
    rect.on('pointerover', () => rect.setScale(1.04));
    rect.on('pointerout', () => rect.setScale(1));
    rect.on('pointerdown', cb);
    t.setInteractive({ useHandCursor: true }).on('pointerdown', cb);
  }
}
