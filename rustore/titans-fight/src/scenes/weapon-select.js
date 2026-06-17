import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../main.js';
import { THEME } from '../theme.js';
import { WEAPONS, unlockedWeapons } from '../weapons.js';
import { LEVELS, getLevel } from '../levels.js';
import { makeButton, titleText } from '../ui.js';
import { buildArena } from '../backgrounds.js';

// Екран за избор на оръжие. Наличните оръжия зависят от достигнатото ниво
// (прогресия: нови оръжия се отключват с напредъка).
export class WeaponSelectScene extends Phaser.Scene {
  constructor() { super('weapon-select'); }

  create() {
    const levelId = this.registry.get('pendingLevel') || 1;
    const lvl = getLevel(levelId);
    buildArena(this, lvl.arena);

    titleText(this, GAME_W / 2, 64, 'ИЗБЕРИ ОРЪЖИЕ', 40, THEME.primaryHex);
    titleText(this, GAME_W / 2, 110, `НИВО ${lvl.id} — ${lvl.name}`, 20, THEME.accentHex);

    // Оръжията се отключват според НАЙ-ВИСОКОТО отключено ниво (прогрес), не само текущото.
    const unlockedLevel = this.registry.get('unlockedLevel') || 1;
    const available = unlockedWeapons(unlockedLevel);

    const all = Object.values(WEAPONS);
    const cols = all.length;
    const cellW = 168;
    const startX = GAME_W / 2 - ((cols - 1) * cellW) / 2;
    const y = 250;

    let selected = this.registry.get('selectedWeapon') || 'fists';
    if (!available.includes(selected)) selected = available[available.length - 1];

    const cards = [];
    all.forEach((w, i) => {
      const x = startX + i * cellW;
      const open = available.includes(w.key);
      const card = this._weaponCard(x, y, w, open, () => {
        if (!open) return;
        selected = w.key;
        cards.forEach(c => c.setSelected(c.key === selected));
        this.registry.set('selectedWeapon', selected);
      });
      card.setSelected(w.key === selected);
      cards.push(card);
    });

    this.registry.set('selectedWeapon', selected);

    makeButton(this, GAME_W / 2 - 130, GAME_H - 60, 220, 56, '◀ НАЗАД', () => {
      this.scene.start('menu');
    }, { color: 0x666, fontSize: '20px' });

    makeButton(this, GAME_W / 2 + 130, GAME_H - 60, 220, 56, 'БОЙ! ⚔', () => {
      this.registry.set('selectedWeapon', selected);
      this.scene.start('game', { level: lvl.id, weapon: selected });
    }, { color: THEME.good, fontSize: '22px' });
  }

  _weaponCard(x, y, w, open, onClick) {
    const cont = this.add.container(x, y);
    cont.key = w.key;
    const W = 152, H = 220;
    const bg = this.add.graphics();
    const icon = this.add.container(0, -40);
    this._drawWeaponIcon(icon, w);

    const name = this.add.text(0, 30, open ? w.name : '🔒 ' + w.name, {
      fontFamily: 'system-ui', fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    const stats = this.add.text(0, 64,
      open ? `Щета: ${w.damage}\nОбхват: ${w.type === 'throw' ? 'далечен' : w.reach}\nСкорост: ${(1000 / w.cooldown).toFixed(1)}/с`
           : `Отключи на\nниво ${w.unlockLevel}`,
      { fontFamily: 'system-ui', fontSize: '13px', color: '#d0d0d8', align: 'center' }
    ).setOrigin(0.5, 0);

    cont.add([bg, icon, name, stats]);
    cont.setAlpha(open ? 1 : 0.45);

    let sel = false;
    const redraw = () => {
      bg.clear();
      bg.fillStyle(0x000000, 0.45);
      bg.fillRoundedRect(-W / 2, -H / 2, W, H, 16);
      bg.lineStyle(sel ? 4 : 2, sel ? THEME.accent : 0xffffff, sel ? 1 : 0.3);
      bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 16);
      if (sel) {
        bg.fillStyle(THEME.accent, 0.12);
        bg.fillRoundedRect(-W / 2, -H / 2, W, H, 16);
      }
    };
    redraw();
    cont.setSelected = (s) => { sel = s; redraw(); };

    if (open) {
      cont.setSize(W, H);
      cont.setInteractive(new Phaser.Geom.Rectangle(-W / 2, -H / 2, W, H), Phaser.Geom.Rectangle.Contains);
      cont.on('pointerdown', onClick);
    }
    return cont;
  }

  // Мини-икона на оръжието, нарисувана с Graphics.
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
