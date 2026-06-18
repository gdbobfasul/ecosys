// LeaderboardScene — самостоятелен екран с целия топ-100, достъпен от менюто.
import Phaser from 'phaser';
import { THEME } from '../theme.js';
import Starfield from '../gfx/starfield.js';
import { getTop } from '../leaderboard.js';
import { showLeaderboardList } from '../gfx/leaderboard_view.js';

export default class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('Leaderboard');
  }

  create() {
    const { width, height } = this.scale;
    this.stars = new Starfield(this);

    const title = this.add.text(width / 2, height * 0.08, '🏆 РАНГ ЛИСТА', {
      fontFamily: 'system-ui, sans-serif', fontSize: '30px', fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    title.setShadow(0, 0, THEME.accentHex, 16, true, true);

    this.add.text(width / 2, height * 0.08 + 36, 'Топ 100 • само устройството', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#9fc8ff'
    }).setOrigin(0.5);

    const top = getTop(100);
    const listX = width * 0.08;
    const listY = height * 0.18;
    const listW = width * 0.84;
    const listH = (height * 0.84) - listY;

    showLeaderboardList(this, top, {
      x: listX, y: listY, width: listW, height: listH, highlightIndex: -1
    });

    // Бутон обратно към менюто.
    this.makeButton(width / 2, height * 0.92, 'МЕНЮ', () => {
      this.scene.start('Menu');
    });
  }

  makeButton(x, y, label, onClick) {
    const w = 200, h = 52;
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
