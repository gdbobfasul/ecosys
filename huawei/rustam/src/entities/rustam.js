// Version: 1.0001
// Рустам — top-down градинар, който се движи свободно и бере краставици.
// Управление: виртуален джойстик (мобилно) или WASD/стрелки (десктоп) — виж game.js.
import Phaser from 'phaser';

export default class Rustam extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'rustam');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.baseSpeed = 252;        // px/сек — базова скорост (леко расте с нивото, виж setBaseSpeed)
    this.speed = this.baseSpeed; // текуща скорост — расте с всяка набрана краставица (speedUp)

    // Хитбоксът е по-малък от спрайта (заради фороскъсеното тяло) — за досега до краставиците.
    const body = this.body;
    body.setCircle(16, 16, 22);
    body.setCollideWorldBounds(true);

    this.setDepth(50);
    this._lastVx = 0;
  }

  // Движение по вектор (vx, vy в диапазон -1..1).
  move(vx, vy) {
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    this.setVelocity(vx * this.speed, vy * this.speed);
    // Лек „наклон" според посоката за живот в спрайта
    if (Math.abs(vx) > 0.05) this._lastVx = vx;
    this.setRotation(Phaser.Math.Clamp(vx, -1, 1) * 0.08);
  }

  stop() {
    this.setVelocity(0, 0);
    this.setRotation(0);
  }

  // Базова скорост за нивото (леко расте с номера му → по-късните нива не са „пеша").
  setBaseSpeed(v) {
    this.baseSpeed = v;
    if (this.speed < v) this.speed = v;
  }

  // Всяка набрана краставица го прави мъничко по-бърз (компенсира растящата трудност и това,
  // че за същото време изскачат повече краставици). Расте до таван над базата.
  speedUp(step = 5, cap = 130) {
    this.speed = Math.min(this.baseSpeed + cap, this.speed + step);
  }

  // Център на досега (главата/ръцете на героя).
  reachX() { return this.x; }
  reachY() { return this.y - 6; }
}
