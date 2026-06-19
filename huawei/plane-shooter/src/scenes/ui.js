// UIScene — HUD отгоре върху играта: точки, здраве, животи, ниво,
// прогрес към квотата и бутон за смяна на оръжието.
import Phaser from 'phaser';
import { THEME } from '../theme.js';
import { WEAPONS } from '../weapons/weapons.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  init(data) {
    this.game_ = data.game; // референция към GameScene
  }

  create() {
    const { width, height } = this.scale;
    const font = { fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff' };

    this.scoreText = this.add.text(12, height - 26, '', font).setDepth(100);
    this.levelText = this.add.text(width - 12, height - 26, '', font).setOrigin(1, 0).setDepth(100);
    // Индикатор за щита (показва се само когато играчът има заряди).
    this.shieldText = this.add.text(12, 10, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#bfe6ff'
    }).setDepth(100);

    // Здравна лента.
    this.hpBar = this.add.graphics().setDepth(100);

    // Бутон за смяна на оръжието (долен десен ъгъл).
    this.weaponBtnBg = this.add.graphics().setDepth(100);
    this.weaponBtnText = this.add.text(width - 44, height - 70, '⚔', {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#fff'
    }).setOrigin(0.5).setDepth(101);
    this.weaponLabel = this.add.text(width - 44, height - 44, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: THEME.accentHex
    }).setOrigin(0.5).setDepth(101);

    const zone = this.add.zone(width - 44, height - 70, 60, 60).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (this.game_ && this.game_.player) this.game_.player.cycleWeapon();
    });
  }

  update() {
    const g = this.game_;
    if (!g || !g.player) return;
    const { width, height } = this.scale;

    this.scoreText.setText('Точки: ' + g.score);
    const q = Math.min(g.killed, g.level.quota);
    this.levelText.setText(`Ниво ${g.level.id}/10  ${q}/${g.level.quota}  ♥×${g.lives}`);

    // Индикатор за щита: брой заряди + цвят по сила.
    const sh = g.player.shield;
    if (sh > 0) {
      const col = sh >= 6 ? '#ffd166' : (sh >= 3 ? '#00e5ff' : '#6ea8ff');
      this.shieldText.setText('Щит ⛨×' + sh);
      this.shieldText.setColor(col);
      this.shieldText.setVisible(true);
    } else {
      this.shieldText.setVisible(false);
    }

    // Здравна лента горе.
    const pct = g.player.health / g.player.maxHealth;
    const bx = 12, by = height - 46, bw = width - 24, bh = 8;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.4).fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    this.hpBar.fillStyle(0x1a3a2a, 1).fillRect(bx, by, bw, bh);
    const col = pct > 0.5 ? 0x39d98a : (pct > 0.25 ? 0xffd166 : 0xff3b6b);
    this.hpBar.fillStyle(col, 1).fillRect(bx, by, bw * pct, bh);

    // Бутон за оръжие.
    this.weaponBtnBg.clear();
    this.weaponBtnBg.fillStyle(THEME.primary, 0.85).fillCircle(width - 44, height - 70, 28);
    this.weaponBtnBg.lineStyle(2, 0xffffff, 0.6).strokeCircle(width - 44, height - 70, 28);
    this.weaponLabel.setText(WEAPONS[g.player.weaponKey].name);
  }
}
