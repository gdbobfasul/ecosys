import Phaser from 'phaser';
// Преизползваеми UI помощници: бутони с glow, текст със сянка.
import { THEME } from './theme.js';

export function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
  const c = scene.add.container(x, y);
  const fill = opts.color ?? THEME.primary;
  const bg = scene.add.graphics();
  const draw = (hover) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 14);
    bg.fillStyle(fill, hover ? 1 : 0.88);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.lineStyle(2, 0xffffff, hover ? 0.9 : 0.4);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  };
  draw(false);
  const txt = scene.add.text(0, 0, label, {
    fontFamily: 'system-ui, sans-serif', fontSize: opts.fontSize || '22px',
    color: '#1a0a10', fontStyle: 'bold'
  }).setOrigin(0.5);
  c.add([bg, txt]);
  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerdown', () => {
    scene.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true });
    onClick && onClick();
  });
  c.setLabel = (t) => txt.setText(t);
  c.setEnabled = (en) => {
    c.alpha = en ? 1 : 0.4;
    if (en) c.setInteractive(); else c.disableInteractive();
  };
  return c;
}

export function titleText(scene, x, y, text, size, color) {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'system-ui, sans-serif', fontSize: size + 'px',
    color: color || '#ffffff', fontStyle: 'bold'
  }).setOrigin(0.5);
  t.setShadow(0, 4, '#000000', 8, true, true);
  return t;
}
