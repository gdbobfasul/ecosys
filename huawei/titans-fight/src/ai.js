// AI контролер за противниковия титан.
// Поведението се скалира от данните на нивото (aggression, reaction, speed,
// specialChance, weapons). По-високите нива => по-кратка реакция, по-агресивно
// настъпление, по-чести смени на оръжие и специални удари.

import Phaser from 'phaser';

export class EnemyAI {
  constructor(scene, enemy, hero, level) {
    this.scene = scene;
    this.enemy = enemy;
    this.hero = hero;
    this.level = level;
    this.nextDecisionAt = 0;
    this.state = 'approach';   // approach | strike | retreat | wait
    this.weapons = level.weapons.slice();
  }

  // Избира ново оръжие на случаен принцип измежду наличните за нивото.
  _maybeSwitchWeapon() {
    // По-високите нива сменят оръжие по-често (тактика).
    const switchChance = 0.15 + this.level.aggression * 0.25;
    if (Math.random() < switchChance) {
      const w = Phaser.Utils.Array.GetRandom(this.weapons);
      this.enemy.setWeapon(w);
    }
  }

  update(now, dt) {
    const e = this.enemy, h = this.hero, lvl = this.level;
    if (e.dead || h.dead) { e.body.setVelocityX(0); e.setWalking(false); return; }

    const dist = h.x - e.x;
    const absDist = Math.abs(dist);
    const dir = dist >= 0 ? 1 : -1;
    e.setFacing(dir);

    // Решения се вземат на интервали ~ reaction time (по-малко = по-умен AI).
    if (now >= this.nextDecisionAt) {
      this.nextDecisionAt = now + Phaser.Math.Between(lvl.reaction * 0.6, lvl.reaction);

      const wantsAttack = Math.random() < lvl.aggression;
      const isThrow = e.weapon.type === 'throw';
      const inMeleeRange = absDist < e.weapon.reach * 0.9;
      const inThrowRange = absDist > 180 && absDist < 720;

      if (wantsAttack && ((isThrow && inThrowRange) || (!isThrow && inMeleeRange))) {
        this.state = 'strike';
      } else if (isThrow && absDist < 160) {
        // твърде близо за хвърляне -> отстъпи
        this.state = 'retreat';
      } else {
        this.state = 'approach';
      }
      this._maybeSwitchWeapon();
    }

    let vx = 0;
    const speed = lvl.speed;

    if (this.state === 'approach') {
      // приближаване към играча
      const stopAt = e.weapon.type === 'throw' ? 360 : e.weapon.reach * 0.7;
      if (absDist > stopAt) { vx = dir * speed; e.setWalking(true); }
      else { vx = 0; e.setWalking(false); }
    } else if (this.state === 'retreat') {
      vx = -dir * speed * 0.9; e.setWalking(true);
      if (absDist > 320) this.state = 'approach';
    } else if (this.state === 'strike') {
      e.setWalking(false);
      // изпълни атаката (game scene дава onConnect чрез callback по-долу)
      const started = e.attack(now, () => this.onAttackConnect(now));
      if (started) {
        // специален удар: усилена щета/ефект на по-високи нива
        this._isSpecial = Math.random() < lvl.specialChance;
        this.state = 'approach';
      }
    }

    e.body.setVelocityX(vx);
  }

  // Извиква се от Titan.attack в момента на контакт; делегира към GameScene.
  onAttackConnect(now) {
    this.scene.resolveAttack(this.enemy, this.hero, this._isSpecial, now);
    this._isSpecial = false;
  }
}
