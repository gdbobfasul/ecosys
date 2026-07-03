// Version: 1.0001
// LeaderboardScene — цял топ-100 (само име + точки), достъпен от менюто.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { getTop } from '../leaderboard.js';
import { t } from '../core/i18n.js';

export default class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('Leaderboard');
  }

  init(data) {
    // Незадължително осветяване на ред (ред-индекс, 0-базиран) и заглавие.
    this.highlightIndex = data && Number.isInteger(data.highlightIndex) ? data.highlightIndex : -1;
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a2412, 0x1a2412, 0x0a0d08, 0x0a0d08, 1);
    bg.fillRect(0, 0, W, H);

    this.add.text(W / 2, H * 0.06, '🏆 ' + t('leaderboard'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '30px', color: THEME.primaryHex,
      fontStyle: 'bold', stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.06 + 28, t('board_sub'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#9a9', align: 'center'
    }).setOrigin(0.5);

    const rows = getTop(100);

    if (!rows.length) {
      this.add.text(W / 2, H * 0.45, t('no_results'), {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#cbb', align: 'center'
      }).setOrigin(0.5);
    } else {
      this.buildList(rows);
    }

    // Бутон „МЕНЮ"
    this.makeButton(W / 2, H * 0.95, t('menu'), () => this.scene.start('Menu'), 0x666666);
  }

  // Скролируем списък с резултати (mask + влачене).
  buildList(rows) {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const topY = H * 0.14;
    const bottomY = H * 0.90;
    const viewH = bottomY - topY;
    const rowH = 30;

    const container = this.add.container(0, 0);

    rows.forEach((r, i) => {
      const y = topY + i * rowH + rowH / 2;
      const isHi = i === this.highlightIndex;

      if (isHi) {
        const hl = this.add.rectangle(W / 2, y, W - 24, rowH - 4, THEME.accent, 0.25)
          .setStrokeStyle(2, THEME.accent, 0.9);
        container.add(hl);
      }

      const rankColor = i === 0 ? '#ffd24d' : i === 1 ? '#cfd0d0' : i === 2 ? '#d6985a' : '#9a9';
      const rank = this.add.text(28, y, String(i + 1), {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: rankColor, fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      const name = this.add.text(64, y, r.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: isHi ? THEME.primaryHex : '#fff'
      }).setOrigin(0, 0.5);
      const score = this.add.text(W - 24, y, String(r.score), {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: THEME.primaryHex, fontStyle: 'bold'
      }).setOrigin(1, 0.5);
      container.add([rank, name, score]);
    });

    // Маска, за да не излиза списъкът извън зоната.
    const maskG = this.make.graphics();
    maskG.fillRect(0, topY, W, viewH);
    container.setMask(maskG.createGeometryMask());

    // Скрол с влачене (touch/мишка), ако съдържанието е по-високо от зоната.
    const contentH = rows.length * rowH;
    const minY = Math.min(0, viewH - contentH);
    if (contentH > viewH) {
      let dragging = false, startPtr = 0, startY = 0;
      this.input.on('pointerdown', (p) => {
        if (p.y >= topY && p.y <= bottomY) { dragging = true; startPtr = p.y; startY = container.y; }
      });
      this.input.on('pointermove', (p) => {
        if (!dragging) return;
        container.y = Phaser.Math.Clamp(startY + (p.y - startPtr), minY, 0);
      });
      this.input.on('pointerup', () => { dragging = false; });
      this.input.on('pointerout', () => { dragging = false; });
      // Колелце на мишката (десктоп).
      this.input.on('wheel', (_p, _o, _dx, dy) => {
        container.y = Phaser.Math.Clamp(container.y - dy * 0.5, minY, 0);
      });

      // Подсказка за скрол, ако осветеният ред е извън видимото.
      if (this.highlightIndex >= 0) {
        const hiY = this.highlightIndex * rowH;
        if (hiY > viewH - rowH) container.y = Phaser.Math.Clamp(viewH - rowH - hiY, minY, 0);
      }
    }
  }

  makeButton(x, y, text, cb, color) {
    const rect = this.add.rectangle(x, y, 240, 44, color, 1).setStrokeStyle(2, 0x000000, 0.4)
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
