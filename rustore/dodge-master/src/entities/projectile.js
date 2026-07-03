// Version: 1.0001
// Снаряд + логика на „хвърлячите".
// Всеки тип има поведение: право/дъга/самонасочване, скорост, размер, щета, decal.
import Phaser from 'phaser';

// Дефиниции на типовете снаряди.
// speed   — базова скорост (умножава се по level.projSpeed)
// arc     — сила на „лоб"/дъгата (0 = право)
// spin    — върти ли се спрайтът
// homing  — лек самонасочващ фактор (0 = без)
// dmg     — щета по здравето
// decal   — ключ на петно при удар (или null)
// big     — едрина (за screen shake)
export const PROJECTILE_DEFS = {
  pellet:      { tex: 'p_pellet',     speed: 320, arc: 0.00, spin: false, homing: 0,    dmg: 1, decal: null,        big: false },
  bolt:        { tex: 'p_bolt',       speed: 430, arc: 0.00, spin: false, homing: 0,    dmg: 1, decal: null,        big: false, faceDir: true },
  stone:       { tex: 'p_stone',      speed: 250, arc: 0.18, spin: true,  homing: 0,    dmg: 1, decal: 'decal_dirt', big: false },
  dirt:        { tex: 'p_dirt',       speed: 200, arc: 0.30, spin: true,  homing: 0,    dmg: 1, decal: 'decal_dirt', big: false },
  mud:         { tex: 'p_mud',        speed: 150, arc: 0.40, spin: false, homing: 0,    dmg: 2, decal: 'decal_mud',  big: true },
  pot:         { tex: 'p_pot',        speed: 230, arc: 0.25, spin: true,  homing: 0,    dmg: 1, decal: 'decal_dirt', big: false, shatter: true },
  veg:         { tex: 'p_veg',        speed: 210, arc: 0.22, spin: true,  homing: 0,    dmg: 1, decal: 'decal_dirt', big: false },
  mahorka:     { tex: 'p_mahorka',    speed: 180, arc: 0.10, spin: true,  homing: 0,    dmg: 1, decal: null,        big: false, wobble: true },
  snowball:    { tex: 'p_snowball',   speed: 240, arc: 0.20, spin: false, homing: 0,    dmg: 1, decal: 'decal_snow', big: false },
  stick:       { tex: 'p_stick',      speed: 260, arc: 0.05, spin: true,  homing: 0,    dmg: 1, decal: null,        big: false },
  homingStone: { tex: 'p_homingStone',speed: 200, arc: 0.05, spin: true,  homing: 0.9,  dmg: 1, decal: 'decal_dirt', big: false }
};

export const PROJECTILE_TYPES = Object.keys(PROJECTILE_DEFS);

export default class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    super(scene, 0, 0, 'p_pellet');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(60);
    this.spawnT = 0;
    this.setActive(false).setVisible(false);
  }

  // Изстрелва снаряд от (sx,sy) към (tx,ty) с дадения тип и множител на скоростта.
  fire(type, sx, sy, tx, ty, speedMul, target) {
    const def = PROJECTILE_DEFS[type] || PROJECTILE_DEFS.pellet;
    this.def = def;
    this.type = type;
    this.target = target;       // за homing
    this.wobblePhase = Math.random() * Math.PI * 2;

    this.setTexture(def.tex);
    this.setPosition(sx, sy);
    this.setActive(true).setVisible(true).setAlpha(0);
    this.body.enable = true;

    const ang = Math.atan2(ty - sy, tx - sx);
    const spd = def.speed * speedMul;
    this.baseSpeed = spd;
    this.body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);

    // Хитбокс малко по-малък за честна игра
    const r = Math.max(this.width, this.height) * 0.32;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);

    if (def.faceDir) this.setRotation(ang);
    else this.setRotation(0);

    // Появата „избледнява" от warning-а
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 120 });

    // Дъга: симулираме „лоб" чрез временно увеличаване на размера
    // (като че идва отвисоко и пада) — лек scale tween.
    if (def.arc > 0) {
      this.setScale(1.5);
      this.scene.tweens.add({ targets: this, scale: 1, duration: 380, ease: 'Sine.out' });
    } else {
      this.setScale(1);
    }
    this.spawnT = this.scene.time.now;
  }

  preUpdate(t, dt) {
    super.preUpdate(t, dt);
    if (!this.active) return;
    const def = this.def;

    if (def.spin) this.rotation += 0.18 * (dt / 16.6);

    if (def.wobble) {
      // лъкатушене перпендикулярно на движението (махорка)
      this.wobblePhase += 0.02 * dt;
      const v = this.body.velocity;
      const perp = Math.atan2(v.y, v.x) + Math.PI / 2;
      const w = Math.sin(this.wobblePhase) * 40;
      this.body.velocity.x += Math.cos(perp) * w * (dt / 1000);
      this.body.velocity.y += Math.sin(perp) * w * (dt / 1000);
    }

    if (def.homing > 0 && this.target && this.target.active) {
      const ang = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      const cur = Math.atan2(this.body.velocity.y, this.body.velocity.x);
      const next = Phaser.Math.Angle.RotateTo(cur, ang, def.homing * (dt / 1000));
      const spd = this.baseSpeed;
      this.body.setVelocity(Math.cos(next) * spd, Math.sin(next) * spd);
    }
  }

  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.body.stop();
  }
}
