// Version: 1.0001
import Phaser from 'phaser';
import { THEME } from '../theme.js';
import { WEAPONS, unlockedWeapons } from '../weapons.js';
import { getLevel } from '../levels.js';
import { makeButton, titleText } from '../ui.js';
import { buildArena } from '../backgrounds.js';
import { t, tf, weaponName, levelName } from '../core/i18n.js';

// Екран за избор на оръжие. Наличните оръжия зависят от достигнатото ниво.
// Отзивчив към размера на екрана.
export class WeaponSelectScene extends Phaser.Scene {
  constructor() { super('weapon-select'); }

  create() {
    const { width: W, height: H } = this.scale.gameSize;

    const levelId = this.registry.get('pendingLevel') || 1;
    const lvl = getLevel(levelId);
    buildArena(this, lvl.arena);

    titleText(this, W / 2, H * 0.10, t('choose_weapon'), Math.min(40, W * 0.07), THEME.primaryHex);
    titleText(this, W / 2, H * 0.18, tf('level_name_n', lvl.id, levelName(lvl.id)), 20, THEME.accentHex);

    const unlockedLevel = this.registry.get('unlockedLevel') || 1;
    const available = unlockedWeapons(unlockedLevel);

    const all = Object.values(WEAPONS);
    const portrait = H > W;
    const cols = portrait ? 3 : all.length;
    const cellW = Math.min(W / (cols + 0.3), 168);
    const gapX = cellW * 1.05;
    const rows = Math.ceil(all.length / cols);
    const startX = W / 2 - ((cols - 1) * gapX) / 2;
    const startY = H * 0.30;
    const gapY = H * 0.30;

    let selected = this.registry.get('selectedWeapon') || 'fists';
    if (!available.includes(selected)) selected = available[available.length - 1];

    const cards = [];
    all.forEach((w, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * gapX;
      const y = startY + row * gapY;
      const open = available.includes(w.key);
      const card = this._weaponCard(x, y, Math.min(cellW * 0.92, 152), w, open, () => {
        if (!open) return;
        selected = w.key;
        cards.forEach(c => c.setSelected(c.key === selected));
        this.registry.set('selectedWeapon', selected);
      });
      card.setSelected(w.key === selected);
      cards.push(card);
    });

    this.registry.set('selectedWeapon', selected);

    makeButton(this, W / 2 - 130, H - 56, 220, 56, t('back'), () => {
      this.scene.start('menu');
    }, { color: 0x6a7686, fontSize: '20px' });

    makeButton(this, W / 2 + 130, H - 56, 220, 56, t('fight'), () => {
      this.registry.set('selectedWeapon', selected);
      this.scene.start('game', { level: lvl.id, weapon: selected });
    }, { color: THEME.good, fontSize: '22px' });

    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  _onResize() { this.scene.restart(); }

  _weaponCard(x, y, cw, w, open, onClick) {
    const cont = this.add.container(x, y);
    cont.key = w.key;
    const CW = cw, H = cw * 1.45;
    const bg = this.add.graphics();
    const icon = this.add.container(0, -H * 0.18);
    this._drawWeaponIcon(icon, w);

    const wName = weaponName(w.key);
    const name = this.add.text(0, H * 0.14, open ? wName : '🔒 ' + wName, {
      fontFamily: 'system-ui', fontSize: '17px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    const reachTxt = w.type === 'throw' ? t('reach_ranged') : String(w.reach);
    const stats = this.add.text(0, H * 0.28,
      open ? `${t('weapon_damage')}: ${w.damage}\n${t('weapon_reach')}: ${reachTxt}\n${t('weapon_speed')}: ${(1000 / w.cooldown).toFixed(1)}/с`
           : tf('weapon_locked', w.unlockLevel),
      { fontFamily: 'system-ui', fontSize: '13px', color: '#d0d0d8', align: 'center' }
    ).setOrigin(0.5, 0);

    cont.add([bg, icon, name, stats]);
    cont.setAlpha(open ? 1 : 0.45);

    let sel = false;
    const redraw = () => {
      bg.clear();
      bg.fillStyle(0x101522, 0.7);
      bg.fillRoundedRect(-CW / 2, -H / 2, CW, H, 16);
      bg.lineStyle(sel ? 4 : 2, sel ? THEME.accent : 0xffffff, sel ? 1 : 0.35);
      bg.strokeRoundedRect(-CW / 2, -H / 2, CW, H, 16);
      if (sel) {
        bg.fillStyle(THEME.accent, 0.14);
        bg.fillRoundedRect(-CW / 2, -H / 2, CW, H, 16);
      }
    };
    redraw();
    cont.setSelected = (s) => { sel = s; redraw(); };

    if (open) {
      cont.setSize(CW, H);
      // Зона от (0,0): за Container Phaser добавя displayOrigin (= CW/2,H/2) към
      // локалната точка, затова правоъгълник от (-CW/2,-H/2) излиза изместен и
      // кликаемата площ не съвпада с картата (същият бъг като при бутоните).
      cont.setInteractive(new Phaser.Geom.Rectangle(0, 0, CW, H), Phaser.Geom.Rectangle.Contains);
      cont.on('pointerdown', onClick);
    }
    return cont;
  }

  _drawWeaponIcon(cont, w) {
    const g = this.add.graphics();
    if (w.key === 'fists') {
      g.fillStyle(0xffb08a, 1); g.fillCircle(0, 0, 22);
      g.lineStyle(3, 0xffffff, 0.5); g.strokeCircle(0, 0, 22);
    } else if (w.key === 'saber') {
      g.fillStyle(0xeaf6ff, 1); g.fillRect(-4, -40, 8, 64);
      g.fillStyle(0xc9a14a, 1); g.fillRect(-14, 24, 28, 8);
    } else if (w.key === 'hammer') {
      g.fillStyle(0x6a4a2a, 1); g.fillRect(-4, -20, 8, 56);
      g.fillStyle(0xe0c878, 1); g.fillRoundedRect(-26, -40, 52, 28, 6);
    } else if (w.key === 'cannonball') {
      g.fillStyle(0x101014, 1); g.fillCircle(0, 0, 24);
      g.fillStyle(0x888890, 0.7); g.fillCircle(-7, -7, 6);
    } else if (w.key === 'bomb') {
      g.fillStyle(0x1a1a20, 1); g.fillCircle(0, 4, 24);
      g.lineStyle(3, 0x8a6a2a, 1); g.beginPath(); g.moveTo(10, -16); g.lineTo(18, -26); g.strokePath();
      g.fillStyle(0xffaa20, 1); g.fillCircle(19, -27, 4);
    }
    cont.add(g);
  }
}
