// Version: 1.0001
// Логика на „хвърлячите": решава ОТКЪДЕ, КАКВО и в КАКЪВ ШАБЛОН лети.
// Шаблони: single (един), volley (залп 3-5 един след друг), ring (обкръжение),
// lob (дъгов към текущата позиция). Преди всеки изстрел показва warning на ръба.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';

// Връща точка на ръба на екрана под даден ъгъл от центъра.
function edgePoint(angle, margin = 24) {
  const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
  const hw = GAME_WIDTH / 2 + margin, hh = GAME_HEIGHT / 2 + margin;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // Намираме пресичането на лъча с правоъгълника
  const tx = cos !== 0 ? hw / Math.abs(cos) : Infinity;
  const ty = sin !== 0 ? hh / Math.abs(sin) : Infinity;
  const tmin = Math.min(tx, ty);
  return { x: cx + cos * tmin, y: cy + sin * tmin };
}

// Избира тип шаблон според теглата в level.patterns.
function pickPattern(patterns, rng) {
  const total = patterns.single + patterns.volley + patterns.ring + patterns.lob;
  let r = rng.frac() * total;
  if ((r -= patterns.single) < 0) return 'single';
  if ((r -= patterns.volley) < 0) return 'volley';
  if ((r -= patterns.ring) < 0) return 'ring';
  return 'lob';
}

export default class Thrower {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.rng = new Phaser.Math.RandomDataGenerator([String(Date.now())]);
  }

  randType() {
    const list = this.level.projectiles;
    return list[(this.rng.frac() * list.length) | 0];
  }

  // Стартира една „вълна" според шаблона. target = играчът (за прицел).
  spawnWave(target) {
    const pattern = pickPattern(this.level.patterns, this.rng);
    switch (pattern) {
      case 'volley': return this.volley(target);
      case 'ring':   return this.ring(target);
      case 'lob':    return this.lob(target);
      case 'single':
      default:       return this.single(target);
    }
  }

  // Един снаряд от случаен ръб към текущата позиция на играча (с лек разсейл).
  single(target) {
    const ang = this.rng.frac() * Math.PI * 2;
    const from = edgePoint(ang);
    const t = this.randType();
    const spread = Phaser.Math.FloatBetween(-26, 26);
    this._telegraph(from, () => {
      this.scene.launch(t, from.x, from.y, target.x + spread, target.y + spread, target);
    });
  }

  // Залп: 3-5 снаряда от един ръб, ветрилообразно.
  volley(target) {
    const ang = this.rng.frac() * Math.PI * 2;
    const from = edgePoint(ang);
    const n = 3 + ((this.rng.frac() * 3) | 0); // 3..5
    const t = this.randType();
    this._telegraph(from, () => {
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 36;
        this.scene.time.delayedCall(i * 90, () => {
          this.scene.launch(t, from.x, from.y, target.x + off, target.y + off, target);
        });
      }
    });
  }

  // Пръстен/обкръжение: снаряди от всички страни едновременно към центъра/играча.
  ring(target) {
    const count = 6 + ((this.rng.frac() * 4) | 0); // 6..9
    const base = this.rng.frac() * Math.PI * 2;
    const t = this.randType();
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push(edgePoint(base + (i / count) * Math.PI * 2));
    }
    // Показваме всички warning-и, после изстрелваме наведнъж.
    points.forEach((p) => this._telegraph(p, null, 520));
    this.scene.time.delayedCall(520, () => {
      const aimX = target.x, aimY = target.y;
      points.forEach((p) => this.scene.launch(t, p.x, p.y, aimX, aimY, target));
    });
  }

  // Дъгов снаряд директно към текущата позиция (по-голяма заплаха при големи снаряди).
  lob(target) {
    const ang = this.rng.frac() * Math.PI * 2;
    const from = edgePoint(ang);
    // Предпочитаме „дъгови" типове ако са отключени
    const arcTypes = this.level.projectiles.filter((p) =>
      ['stone', 'dirt', 'mud', 'pot', 'veg', 'snowball'].includes(p));
    const t = arcTypes.length ? arcTypes[(this.rng.frac() * arcTypes.length) | 0] : this.randType();
    this._telegraph(from, () => {
      this.scene.launch(t, from.x, from.y, target.x, target.y, target);
    }, 460);
  }

  // Показва предупредителна стрелка на ръба, сочеща навътре; после cb().
  _telegraph(from, cb, delay = 380) {
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const ang = Math.atan2(cy - from.y, cx - from.x);
    // Притискаме warning-а малко вътре в екрана, за да се вижда
    const wx = Phaser.Math.Clamp(from.x, 16, GAME_WIDTH - 16);
    const wy = Phaser.Math.Clamp(from.y, 16, GAME_HEIGHT - 16);
    const warn = this.scene.add.image(wx, wy, 'warn_arrow')
      .setRotation(ang).setDepth(70).setAlpha(0).setScale(0.7);
    this.scene.tweens.add({
      targets: warn, alpha: 1, scale: 1.1, yoyo: true, repeat: 1,
      duration: delay / 2.5,
      onComplete: () => warn.destroy()
    });
    if (cb) this.scene.time.delayedCall(delay, cb);
  }
}
