// Version: 1.0001
// Героят: top-down човек, който се движи свободно и избягва снаряди.
// Управление: виртуален джойстик (мобилно) или WASD/стрелки (десктоп) — виж game.js.
import Phaser from 'phaser';
import { HAT_VARIANTS } from '../gfx/textures.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, hat) {
    const chosen = hat || HAT_VARIANTS[(Math.random() * HAT_VARIANTS.length) | 0];
    super(scene, x, y, `hero_${chosen}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.hat = chosen;
    this.speed = 230;            // px/сек
    this.invulnUntil = 0;        // i-frames след удар (ms)
    this.maxHealth = 5;
    this.health = this.maxHealth;

    // Хитбоксът е по-малък от спрайта — заради фороскъсеното тяло
    // ударите се броят основно по главата/раменете.
    const body = this.body;
    body.setCircle(15, 17, 12);
    body.setCollideWorldBounds(true);

    this.setDepth(50);
  }

  // Движение по вектор (vx, vy в диапазон -1..1).
  move(vx, vy) {
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    this.setVelocity(vx * this.speed, vy * this.speed);
    // Лек „наклон" според посоката за живот в спрайта
    this.setRotation(Phaser.Math.Clamp(vx, -1, 1) * 0.08);
  }

  stop() {
    this.setVelocity(0, 0);
  }

  // Връща true ако ударът е приет (не сме в i-frames).
  takeHit(now, dmg = 1) {
    if (now < this.invulnUntil) return false;
    this.health = Math.max(0, this.health - dmg);
    this.invulnUntil = now + 900; // ~0.9с неуязвимост
    // мигане
    this.scene.tweens.add({
      targets: this, alpha: 0.25, yoyo: true, repeat: 4, duration: 90,
      onComplete: () => this.setAlpha(1)
    });
    return true;
  }

  isDead() {
    return this.health <= 0;
  }
}
