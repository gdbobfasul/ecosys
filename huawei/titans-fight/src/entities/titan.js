import Phaser from 'phaser';
import { WEAPONS } from '../weapons.js';

// Титан = ставен (articulated) боец, сглобен от процедурни части в Phaser.Container.
// Анимациите (ходене, замах, удар, получаване на щета) се правят процедурно
// чрез tween-ове на ъглите/позициите на крайниците — без spritesheet.
//
// Физиката е през невидимо arcade тяло на контейнера (за гравитация/сблъсък с пода).

export class Titan {
  constructor(scene, x, y, opts) {
    this.scene = scene;
    this.prefix = opts.prefix;          // 'hero' | 'enemy'
    this.facing = opts.facing || 1;     // 1 = надясно, -1 = наляво
    this.isHero = opts.prefix === 'hero';
    this.maxHp = opts.hp;
    this.hp = opts.hp;
    this.color = opts.color;

    // Текущо оръжие
    this.weaponKey = opts.weapon || 'fists';
    this.weapon = WEAPONS[this.weaponKey];

    // Състояние
    this.attacking = false;
    this.attackCooldownUntil = 0;
    this.hurtUntil = 0;
    this.dead = false;
    this.comboCount = 0;
    this.lastAttackAt = 0;

    this._build(x, y);
  }

  _build(x, y) {
    const s = this.scene;
    const p = this.prefix;

    // Контейнерът държи всички части. Пивотът е в "таза" (между краката).
    this.root = s.add.container(x, y);
    this.root.setDepth(10);

    // Светлинен ореол зад титана
    this.glow = s.add.image(0, -40, 'px_glow').setTint(this.color).setAlpha(0.25).setScale(1.4);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);

    // Крака (два) — пивот горе (origin 0.5, 0)
    this.legBack = s.add.image(8, -10, `${p}_leg`).setOrigin(0.5, 0).setScale(0.85);
    this.legFront = s.add.image(-8, -10, `${p}_leg`).setOrigin(0.5, 0);

    // Торс
    this.torso = s.add.image(0, -56, `${p}_torso`).setOrigin(0.5, 0);

    // Задна ръка (зад торса)
    this.armBack = s.add.image(14, -52, `${p}_arm`).setOrigin(0.5, 0.08).setScale(0.9);

    // Глава
    this.head = s.add.image(0, -58, `${p}_head`).setOrigin(0.5, 1);

    // Предна ръка + длан + оръжие (групирани, за да се движат заедно при замах)
    this.armFront = s.add.container(-14, -52);
    this.upperArm = s.add.image(0, 0, `${p}_arm`).setOrigin(0.5, 0.08);
    this.fist = s.add.image(0, 40, `${p}_fist`).setOrigin(0.5, 0.5);
    this.weaponSprite = s.add.image(2, 36, 'px_spark').setOrigin(0.5, 1).setVisible(false);
    this.armFront.add([this.upperArm, this.weaponSprite, this.fist]);

    // Ред на наслагване
    this.root.add([
      this.glow, this.legBack, this.armBack, this.torso,
      this.legFront, this.head, this.armFront
    ]);

    this._applyFacing();
    this._refreshWeaponSprite();

    // Физика: невидим спрайт-тяло за гравитация и под.
    this.body = s.physics.add.image(x, y - 40).setVisible(false);
    this.body.body.setSize(70, 150).setOffset(-35, -110);
    this.body.setMaxVelocity(400, 1400);

    // Лек "дишащ" idle bob
    this._idleTween = s.tweens.add({
      targets: this.torso, y: -54, duration: 900,
      yoyo: true, repeat: -1, ease: 'Sine.inOut'
    });
  }

  _applyFacing() {
    // Обръщаме целия контейнер по X според посоката.
    this.root.setScale(Math.abs(this.root.scaleX) * 1, this.root.scaleY || 1);
    this.root.scaleX = this.facing * Math.abs(this.root.scaleX || 1);
  }

  setFacing(dir) {
    if (dir !== this.facing) {
      this.facing = dir;
      this.root.scaleX = this.facing * Math.abs(this.root.scaleX || 1);
    }
  }

  setWeapon(key) {
    this.weaponKey = key;
    this.weapon = WEAPONS[key];
    this._refreshWeaponSprite();
  }

  _refreshWeaponSprite() {
    const w = this.weapon;
    if (w.key === 'saber') {
      this.weaponSprite.setTexture('wpn_saber').setVisible(true)
        .setOrigin(0.5, 0.92).setScale(0.9).setPosition(2, 40);
      this.fist.setVisible(true);
    } else if (w.key === 'hammer') {
      this.weaponSprite.setTexture('wpn_hammer').setVisible(true)
        .setOrigin(0.5, 0.92).setScale(0.9).setPosition(2, 40);
      this.fist.setVisible(true);
    } else {
      // юмруци / хвърляне -> няма държано оръжие, само юмрук
      this.weaponSprite.setVisible(false);
      this.fist.setVisible(true);
    }
  }

  // Връща световата X-позиция на върха на крайника/оръжието (за hit detection).
  getReachPoint() {
    const reach = this.weapon.type === 'throw' ? 70 : this.weapon.reach;
    return {
      x: this.root.x + this.facing * reach,
      y: this.root.y - 50
    };
  }

  get x() { return this.root.x; }
  get y() { return this.root.y; }

  // --- Анимация на ходене (леко полюшване на краката) ---
  setWalking(on) {
    if (on === this._walking) return;
    this._walking = on;
    if (this._walkTween) { this._walkTween.stop(); this._walkTween = null; }
    if (on) {
      this.legFront.angle = 0; this.legBack.angle = 0;
      this._walkTween = this.scene.tweens.add({
        targets: this.legFront, angle: 18, duration: 220,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
        onUpdate: () => { this.legBack.angle = -this.legFront.angle; }
      });
    } else {
      this.scene.tweens.add({ targets: [this.legFront, this.legBack], angle: 0, duration: 160 });
    }
  }

  // --- Атака: процедурен замах според типа оръжие ---
  // Връща true ако атаката е стартирала.
  attack(now, onConnect) {
    if (this.dead || this.attacking || now < this.attackCooldownUntil) return false;
    const w = this.weapon;
    this.attacking = true;
    this.attackCooldownUntil = now + w.cooldown;

    // комбо брояч (последователни бързи удари)
    if (now - this.lastAttackAt < 900) this.comboCount++;
    else this.comboCount = 1;
    this.lastAttackAt = now;

    const arm = this.armFront;
    arm.angle = 0;

    if (w.type === 'throw') {
      // замах за хвърляне: ръката отива назад после рязко напред
      this.scene.tweens.add({
        targets: arm, angle: 70, duration: w.windup, ease: 'Back.in',
        onComplete: () => {
          this.scene.tweens.add({
            targets: arm, angle: -60, duration: 120, ease: 'Cubic.out',
            onComplete: () => {
              if (onConnect) onConnect();   // тук се ражда снарядът
              this.scene.tweens.add({ targets: arm, angle: 0, duration: 180 });
              this.attacking = false;
            }
          });
        }
      });
    } else {
      // melee: завъртане на ръката надолу/напред с "windup"
      const swing = w.key === 'hammer' ? 130 : 95;
      this.scene.tweens.add({
        targets: arm, angle: -swing * 0.5, duration: w.windup, ease: 'Sine.in',
        onComplete: () => {
          this.scene.tweens.add({
            targets: arm, angle: swing, duration: 110, ease: 'Cubic.out',
            onComplete: () => {
              if (onConnect) onConnect();   // момент на удара
              this.scene.tweens.add({ targets: arm, angle: 0, duration: 200, ease: 'Sine.out' });
              this.attacking = false;
            }
          });
        }
      });
    }
    return true;
  }

  // Получаване на щета: трепване + червен флаш + отблъскване.
  takeHit(dmg, fromDir, knockback, now) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtUntil = now + 220;

    // червен флаш
    [this.torso, this.head, this.upperArm].forEach(part => {
      part.setTintFill(0xff5050);
      this.scene.time.delayedCall(120, () => part.clearTint());
    });

    // отблъскване
    if (this.body && this.body.body) {
      this.body.setVelocityX(fromDir * knockback);
      this.body.setVelocityY(-knockback * 0.45);
    }
    // трепване на контейнера
    this.scene.tweens.add({
      targets: this.root, x: this.root.x + fromDir * 8,
      duration: 60, yoyo: true
    });

    if (this.hp <= 0) this._die();
  }

  _die() {
    this.dead = true;
    this.setWalking(false);
    this._idleTween && this._idleTween.stop();
    // падане настрани
    this.scene.tweens.add({
      targets: this.root, angle: this.facing * -80, y: this.root.y + 10,
      alpha: 0.85, duration: 600, ease: 'Cubic.in'
    });
    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 400 });
  }

  // Синхронизира визуалния контейнер с физическото тяло.
  syncToBody(groundY) {
    if (!this.body) return;
    this.root.x = this.body.x;
    this.root.y = Math.min(this.body.y + 40, groundY);
    if (this.root.y >= groundY) {
      this.body.y = groundY - 40;
      if (this.body.body.velocity.y > 0) this.body.setVelocityY(0);
    }
  }

  destroy() {
    this._idleTween && this._idleTween.stop();
    this._walkTween && this._walkTween.stop();
    this.root.destroy();
    this.body && this.body.destroy();
  }
}
