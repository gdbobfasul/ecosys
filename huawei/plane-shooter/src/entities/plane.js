// Version: 1.0001
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

    // --- ЩИТ (издържливост от артефакти) ---
    // Щитът поглъща удари ВМЕСТО здравето/живота. Всеки заряд = един погълнат удар.
    // Зарядите идват от артефакти, които играчът събира по пътя.
    this.shield = 0;          // текущи заряди на щита
    this.maxShield = 9;       // таван на зарядите
    // Балон около самолета — рисуван като отделен спрайт с пулсация.
    this.shieldBubble = scene.add.sprite(this.sprite.x, this.sprite.y, 'shield_bubble');
    this.shieldBubble.setDepth(11);
    this.shieldBubble.setVisible(false);
    this.shieldHitFlash = 0;  // секунди ярко проблясване при погълнат удар

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
    // Ако имаме щит — един заряд поглъща удара ВМЕСТО здравето.
    if (this.shield > 0) {
      this.shield--;
      this.invuln = 0.8;        // кратка неуязвимост, по-малка от тази при истински удар
      this.shieldHitFlash = 0.25;
      if (this.shield <= 0) this.shieldBubble.setVisible(false);
      return false;             // ударът е поет от щита — играчът не губи здраве/живот
    }
    this.health = Math.max(0, this.health - dmg);
    this.invuln = 1.2;
    return true;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  // Добавяме заряди към щита (от събран артефакт). Връща реално добавените.
  addShield(amount) {
    const before = this.shield;
    this.shield = Math.min(this.maxShield, this.shield + amount);
    if (this.shield > 0) this.shieldBubble.setVisible(true);
    return this.shield - before;
  }

  update(dt) {
    if (this.invuln > 0) {
      this.invuln -= dt;
      // Мигане при неуязвимост.
      this.sprite.setAlpha(0.4 + 0.4 * Math.sin(this.scene.time.now / 60));
    } else {
      this.sprite.setAlpha(1);
    }

    // --- Балон на щита: следва самолета, пулсира и сменя цвят според силата ---
    if (this.shield > 0) {
      const b = this.shieldBubble;
      b.setVisible(true);
      b.x = this.sprite.x;
      b.y = this.sprite.y;
      const t = this.scene.time.now / 1000;
      // Лека пулсация на размера.
      const pulse = 1 + 0.06 * Math.sin(t * 4);
      b.setScale(pulse);
      // Цвят/непрозрачност по сила: слаб=син, среден=циан, силен=златист.
      let tint, baseAlpha;
      if (this.shield >= 6) { tint = 0xffd166; baseAlpha = 0.55; }        // силен (златист)
      else if (this.shield >= 3) { tint = 0x00e5ff; baseAlpha = 0.45; }   // среден (циан)
      else { tint = 0x6ea8ff; baseAlpha = 0.34; }                          // слаб (син)
      // Лек блясък при току-що погълнат удар.
      if (this.shieldHitFlash > 0) {
        this.shieldHitFlash -= dt;
        tint = 0xffffff;
        baseAlpha = 0.85;
      }
      b.setTint(tint);
      b.setAlpha(baseAlpha + 0.08 * Math.sin(t * 6));
    } else {
      this.shieldBubble.setVisible(false);
    }
  }

  destroy() {
    this.thruster.destroy();
    this.shieldBubble.destroy();
    this.sprite.destroy();
  }
}
