// Version: 1.0001
// LanguageScene — избор на език при първо стартиране (и от менюто чрез бутона 🌐).
// Показва 15-те езика на екосистемата с родните им имена; изборът се пази и
// после се отваря менюто. Заглавието „Избери език" се изписва на текущия език.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { LANGUAGES, setLang, getLang, t } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

export default class LanguageScene extends Phaser.Scene {
  constructor() {
    super('Language');
  }

  init(data) {
    // Накъде да продължи след избор (по подразбиране менюто).
    this.next = (data && data.next) || 'Menu';
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2c4a1c, 0x2c4a1c, 0x0a0d08, 0x0a0d08, 1);
    bg.fillRect(0, 0, W, H);

    this.add.text(W / 2, H * 0.07, '🌐', {
      fontFamily: 'system-ui, sans-serif', fontSize: '40px'
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.13, t('pick_lang'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: THEME.primaryHex,
      fontStyle: 'bold', stroke: '#000', strokeThickness: 5, align: 'center'
    }).setOrigin(0.5);

    // Решетка с езиците (2 колони × ~8 реда), скролируема при нужда.
    const cur = getLang();
    const topY = H * 0.19;
    const bottomY = H * 0.85;   // долната граница на решетката — оставя място за бутона „Стартирай"
    const viewH = bottomY - topY;
    const cols = 2, btnW = 210, btnH = 48, gapX = 14, gapY = 12;
    const gridW = cols * btnW + (cols - 1) * gapX;
    const startX = W / 2 - gridW / 2 + btnW / 2;

    const container = this.add.container(0, 0);
    LANGUAGES.forEach((lang, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = startX + col * (btnW + gapX);
      const y = topY + btnH / 2 + row * (btnH + gapY);
      const isCur = lang.code === cur;
      const color = isCur ? THEME.accent : 0x2a3a1c;
      const rect = this.add.rectangle(x, y, btnW, btnH, color, 1)
        .setStrokeStyle(2, isCur ? 0xffffff : 0x000000, isCur ? 0.9 : 0.4)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, lang.native, {
        fontFamily: 'system-ui, sans-serif', fontSize: '17px',
        color: isCur ? '#0a0d08' : '#e6e6d8', fontStyle: 'bold'
      }).setOrigin(0.5);
      const pick = () => this.choose(lang.code);
      rect.on('pointerover', () => rect.setScale(1.04));
      rect.on('pointerout', () => rect.setScale(1));
      rect.on('pointerdown', pick);
      label.setInteractive({ useHandCursor: true }).on('pointerdown', pick);
      container.add([rect, label]);
    });

    // Скрол при влачене, ако решетката е по-висока от зоната.
    const rowsCount = Math.ceil(LANGUAGES.length / cols);
    const contentH = rowsCount * (btnH + gapY);
    const minY = Math.min(0, viewH - contentH);
    if (contentH > viewH) {
      const maskG = this.make.graphics();
      maskG.fillRect(0, topY, W, viewH);
      container.setMask(maskG.createGeometryMask());
      let dragging = false, startPtr = 0, startCy = 0;
      this.input.on('pointerdown', (p) => {
        if (p.y >= topY && p.y <= bottomY) { dragging = true; startPtr = p.y; startCy = container.y; }
      });
      this.input.on('pointermove', (p) => {
        if (dragging) container.y = Phaser.Math.Clamp(startCy + (p.y - startPtr), minY, 0);
      });
      this.input.on('pointerup', () => { dragging = false; });
      this.input.on('pointerout', () => { dragging = false; });
      this.input.on('wheel', (_p, _o, _dx, dy) => {
        container.y = Phaser.Math.Clamp(container.y - dy * 0.5, minY, 0);
      });
    }

    // Бутон „Стартирай" — продължава в играта с текущо избрания език.
    const startY = H * 0.905;
    const startBtn = this.add.rectangle(W / 2, startY, 220, 52, THEME.accent, 1)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });
    const startLabel = this.add.text(W / 2, startY, t('start_app'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px',
      color: '#0a0d08', fontStyle: 'bold'
    }).setOrigin(0.5);
    const go = () => this.choose(getLang());
    startBtn.on('pointerover', () => startBtn.setScale(1.04));
    startBtn.on('pointerout', () => startBtn.setScale(1));
    startBtn.on('pointerup', go);
    startLabel.setInteractive({ useHandCursor: true }).on('pointerup', go);

    // Версия на приложението — дребен сив текст най-долу.
    this.add.text(W / 2, H * 0.97, 'v' + APP_VERSION, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#8a8a7a'
    }).setOrigin(0.5);
  }

  choose(code) {
    setLang(code);
    this.scene.start(this.next);
  }
}
