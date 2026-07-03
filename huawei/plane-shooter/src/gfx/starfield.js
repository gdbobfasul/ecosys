// Version: 1.0001
// Паралакс звезден фон с три слоя на различна скорост + градиент на небето.
import { THEME } from '../theme.js';

export default class Starfield {
  constructor(scene) {
    this.scene = scene;
    const { width, height } = scene.scale;

    // Градиентен фон (рисуван като Canvas текстура, изпъва се на целия екран).
    const key = 'sky-' + THEME.store;
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, 8, height);
      const ctx = tex.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, THEME.bgTop);
      g.addColorStop(1, THEME.bgBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, height);
      tex.refresh();
    }
    this.sky = scene.add.image(width / 2, height / 2, key)
      .setDisplaySize(width, height)
      .setDepth(-100);

    // Три слоя звезди с различни скорости и размери.
    this.layers = [];
    const configs = [
      { count: 40, speed: 20, scale: 0.4, alpha: 0.5 },
      { count: 28, speed: 45, scale: 0.7, alpha: 0.75 },
      { count: 16, speed: 90, scale: 1.1, alpha: 1.0 }
    ];
    configs.forEach((cfg) => {
      const group = [];
      for (let i = 0; i < cfg.count; i++) {
        const s = scene.add.image(
          Phaser_rand(width),
          Phaser_rand(height),
          'star'
        ).setScale(cfg.scale).setAlpha(cfg.alpha).setDepth(-90).setTint(THEME.star);
        group.push(s);
      }
      this.layers.push({ group, speed: cfg.speed });
    });
  }

  update(dt) {
    const h = this.scene.scale.height;
    const w = this.scene.scale.width;
    for (const layer of this.layers) {
      for (const s of layer.group) {
        s.y += layer.speed * dt;
        if (s.y > h + 4) {
          s.y = -4;
          s.x = Phaser_rand(w);
        }
      }
    }
  }
}

// Малка локална случайна стойност (за да не зависим от глобален Phaser тук).
function Phaser_rand(max) {
  return Math.random() * max;
}
