import Phaser from 'phaser';
import { THEME } from '../theme.js';
import { makeButton, titleText } from '../ui.js';
import { buildArena } from '../backgrounds.js';
import { LEVELS } from '../levels.js';
import { getTop } from '../leaderboard.js';
import { t } from '../core/i18n.js';

// Сцена „🏆 Ранг листа" — показва целия ТОП 100 (само име + точки).
// Достъпна от главното меню. С плавно влачене (скрол) на дълъг списък.
//
// Може да получи data:
//   { highlightName, highlightScore, headline } — за да освети текущия резултат
//     (използва се след края на боя) и да покаже „Ти си #N от M".
export class LeaderboardScene extends Phaser.Scene {
  constructor() { super('leaderboard'); }

  init(data) {
    this.highlightName = data && data.highlightName != null ? String(data.highlightName) : null;
    this.highlightScore = data && data.highlightScore != null ? data.highlightScore : null;
    this.headline = data && data.headline ? String(data.headline) : null;
  }

  create() {
    const { width: W, height: H } = this.scale.gameSize;

    // Фон = арена за атмосфера (същия стил като менюто).
    buildArena(this, LEVELS[0].arena);
    const dim = this.add.graphics().setDepth(1);
    dim.fillStyle(0x000000, 0.45);
    dim.fillRect(0, 0, W, H);

    titleText(this, W / 2, H * 0.08, t('board_title'), Math.min(44, W * 0.085), THEME.accentHex)
      .setDepth(10);

    // По желание: ред „Ти си #N от M" (подаден от края на боя).
    let topY = H * 0.18;
    if (this.headline) {
      titleText(this, W / 2, H * 0.15, this.headline, Math.min(24, W * 0.05), THEME.goodHex)
        .setDepth(10);
      topY = H * 0.22;
    }

    const rows = getTop(100);

    if (!rows.length) {
      titleText(this, W / 2, H / 2, t('no_results'),
        20, '#cfcfd8').setDepth(10);
    } else {
      this._buildList(rows, W, topY, H * 0.80);
    }

    // Бутон НАЗАД към менюто (долу по средата, ясно видим).
    makeButton(this, W / 2, H - 44, Math.min(240, W * 0.6), 52, t('board_back'), () => {
      this.scene.start('menu');
    }, { color: THEME.primary }).setDepth(50);

    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  // Изгражда скролируем списък с редовете в маскирана зона.
  _buildList(rows, W, top, bottom) {
    const listH = bottom - top;
    const rowH = 34;
    const listW = Math.min(560, W * 0.92);
    const x0 = W / 2 - listW / 2;

    // Контейнер, който ще влачим вертикално.
    const container = this.add.container(0, top).setDepth(8);

    rows.forEach((r, i) => {
      const y = i * rowH;
      const isHi = this.highlightName != null
        && r.name === this.highlightName
        && Number(r.score) === Number(this.highlightScore)
        && !this._usedHi;            // осветяваме само ПЪРВОТО съвпадение
      if (isHi) this._usedHi = true;

      const bg = this.add.graphics();
      bg.fillStyle(isHi ? THEME.accent : 0xffffff, isHi ? 0.30 : (i % 2 ? 0.06 : 0.12));
      bg.fillRoundedRect(x0, y, listW, rowH - 4, 8);
      if (isHi) {
        bg.lineStyle(2.5, THEME.accent, 1);
        bg.strokeRoundedRect(x0, y, listW, rowH - 4, 8);
      }

      const col = isHi ? '#fff8e0' : '#ffffff';
      const rank = this.add.text(x0 + 12, y + (rowH - 4) / 2, `${i + 1}.`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '16px',
        color: isHi ? THEME.accentHex : '#cfcfd8', fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      const nm = this.add.text(x0 + 56, y + (rowH - 4) / 2, r.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '17px',
        color: col, fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      const sc = this.add.text(x0 + listW - 14, y + (rowH - 4) / 2, String(r.score), {
        fontFamily: 'system-ui, sans-serif', fontSize: '17px',
        color: isHi ? THEME.accentHex : THEME.goodHex, fontStyle: 'bold'
      }).setOrigin(1, 0.5);

      container.add([bg, rank, nm, sc]);
    });

    const totalH = rows.length * rowH;

    // Маска, за да не излиза списъкът извън зоната.
    const maskG = this.make.graphics();
    maskG.fillRect(0, top, W, listH);
    container.setMask(maskG.createGeometryMask());

    // Влачене на списъка с пръст/мишка, ако е по-дълъг от зоната.
    if (totalH > listH) {
      const minY = top - (totalH - listH);
      const maxY = top;
      this.input.on('pointermove', (p) => {
        if (!p.isDown) return;
        container.y = Phaser.Math.Clamp(container.y + (p.position.y - p.prevPosition.y), minY, maxY);
      });
    }
  }

  _onResize() {
    this._usedHi = false;
    this.scene.restart({
      highlightName: this.highlightName,
      highlightScore: this.highlightScore,
      headline: this.headline
    });
  }
}
