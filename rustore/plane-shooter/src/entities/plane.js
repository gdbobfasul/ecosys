// Самолетът на играча. Управление с докосване/влачене.
// Поддържа здраве, набор от отключени оръжия и активно оръжие.
import Phaser from 'phaser';
import { WEAPONS, WEAPON_ORDER } from '../weapons/weapons.js';

export default class Plane {
  constructor(scene) {
    this.scene = scene;
    const { width, height } = scene.scale;

    this.sprite = scene.physics.add.sprite(width / 2, height - 120, 'plane');
    this.sprite.setDepth(10);
    this.sprite.setCollideWorldBounds(true);
    // По-малък hitbox от спрайта — по-щадящ за играча.
    this.sprite.body.setSize(22, 30, true);
    this.sprite.owner = this;

    this.maxHealth = 100;
    this.health = 100;
    this.invuln = 0; // секунди неуязвимост след удар

    // Отключени оръжия — започваме само с куршуми.
    this.unlocked = new Set(['bullet']);
    this.weaponKey = 'bullet';
    this.lastFire = 0;

    // Ауспух (частици зад самолета).
    this.thruster = scene.add.particles(0, 0, 'spark', {
      speedY: { min: 60, max: 140 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 320,
      frequency: 30,
      tint: 0x66ddff,
      follow: this.sprite,
      followOffset: { x: 0, y: 20 }
    });
    this.thruster.setDepth(9);
  }

  unlock(key) {
    if (WEAPONS[key]) {
      this.unlocked.add(key);
      this.weaponKey = key; // авто-превключване към новото оръжие
    }
  }

  cycleWeapon() {
    const avail = WEAPON_ORDER.filter((k) => this.unlocked.has(k));
    if (avail.length <= 1) return;
    const idx = avail.indexOf(this.weaponKey);
    this.weaponKey = avail[(idx + 1) % avail.length];
  }

  get weapon() {
    return WEAPONS[this.weaponKey];
  }

  moveTo(x, y) {
    // Плавно следване на пръста, с леко завъртане за усещане.
    const dx = x - this.sprite.x;
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, x, 0.35);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, y, 0.35);
    this.sprite.setRotation(Phaser.Math.Clamp(dx * 0.02, -0.3, 0.3));
  }

  canFire(time) {
    return time - this.lastFire >= this.weapon.cooldown;
  }

  markFired(time) {
    this.lastFire = time;
  }

  hit(dmg) {
    if (this.invuln > 0) return false;
    this.health = Math.max(0, this.health - dmg);
    this.invuln = 1.2;
    return true;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  update(dt) {
    if (this.invuln > 0) {
      this.invuln -= dt;
      // Мигане при неуязвимост.
      this.sprite.setAlpha(0.4 + 0.4 * Math.sin(this.scene.time.now / 60));
    } else {
      this.sprite.setAlpha(1);
    }
  }

  destroy() {
    this.thruster.destroy();
    this.sprite.destroy();
  }
}
