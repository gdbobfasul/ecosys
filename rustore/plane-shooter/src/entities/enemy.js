// Враг. Типът (0/1/2) определя текстура, здраве и точки.
// Движението зависи от pattern-а на нивото.
import Phaser from 'phaser';

const TYPE_STATS = [
  { texture: 'enemy0', baseHp: 1, score: 100, fire: false },
  { texture: 'enemy1', baseHp: 3, score: 200, fire: true },
  { texture: 'enemy2', baseHp: 6, score: 400, fire: true }
];

export default class Enemy {
  static spawn(scene, group, x, type, level) {
    const stats = TYPE_STATS[type] || TYPE_STATS[0];
    const sprite = group.create(x, -40, stats.texture);
    sprite.setDepth(8);
    sprite.enemyType = type;
    sprite.hp = Math.ceil(stats.baseHp * level.enemyHpMul);
    sprite.maxHp = sprite.hp;
    sprite.score = stats.score;
    sprite.canFire = stats.fire;
    sprite.baseX = x;
    sprite.spawnTime = scene.time.now;
    sprite.pattern = level.pattern;
    sprite.body.setSize(sprite.width * 0.6, sprite.height * 0.6, true);
    sprite.setVelocityY(level.enemySpeed);
    sprite.lastShot = scene.time.now + Phaser.Math.Between(300, 1500);
    return sprite;
  }

  // Хоризонтално движение според pattern-а (вертикалната скорост е зададена).
  static steer(sprite, time) {
    const t = (time - sprite.spawnTime) / 1000;
    switch (sprite.pattern) {
      case 'sine':
        sprite.x = sprite.baseX + Math.sin(t * 2.2) * 90;
        break;
      case 'sweep':
        sprite.x = sprite.baseX + Math.sin(t * 1.3) * 140;
        break;
      // 'vformation' и 'random' се движат основно право надолу.
      default:
        break;
    }
  }
}

export { TYPE_STATS };
