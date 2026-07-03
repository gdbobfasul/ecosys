// Version: 1.0001
// Бос — голям враг в края на боса-нива (5 и 10).
// Има здравна лента, движи се странично и стреля на вълни.
import Phaser from 'phaser';

export default class Boss {
  constructor(scene, level) {
    this.scene = scene;
    const { width } = scene.scale;

    // Здравето расте с номера на нивото.
    this.maxHp = Math.round(120 * level.enemyHpMul + level.id * 30);
    this.hp = this.maxHp;

    this.sprite = scene.physics.add.sprite(width / 2, -80, 'enemy2');
    this.sprite.setScale(2.4).setDepth(8).setTint(0xff5577);
    this.sprite.body.setSize(this.sprite.width * 0.7, this.sprite.height * 0.6, true);
    this.sprite.boss = this;
    this.sprite.enemyType = 99;
    this.sprite.score = 5000;

    this.dir = 1;
    this.speed = 90 + level.id * 6;
    this.fireCd = Math.max(420, 1100 - level.id * 60);
    this.lastShot = 0;
    this.entering = true;

    // Здравна лента (рисувана с Graphics).
    this.bar = scene.add.graphics().setDepth(50);
  }

  update(time, dt) {
    const { width } = this.scene.scale;

    if (this.entering) {
      this.sprite.y += 60 * dt;
      if (this.sprite.y >= 110) this.entering = false;
    } else {
      this.sprite.x += this.dir * this.speed * dt;
      if (this.sprite.x < 60) { this.sprite.x = 60; this.dir = 1; }
      if (this.sprite.x > width - 60) { this.sprite.x = width - 60; this.dir = -1; }
    }

    this.drawBar();
  }

  shouldShoot(time) {
    if (this.entering) return false;
    if (time - this.lastShot >= this.fireCd) {
      this.lastShot = time;
      return true;
    }
    return false;
  }

  hit(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this.scene.cameras.main.shake(60, 0.004);
    return this.hp <= 0;
  }

  drawBar() {
    const { width } = this.scene.scale;
    const w = width - 40, h = 8, x = 20, y = 14;
    this.bar.clear();
    this.bar.fillStyle(0x000000, 0.5).fillRect(x - 2, y - 2, w + 4, h + 4);
    this.bar.fillStyle(0x331018, 1).fillRect(x, y, w, h);
    const pct = this.hp / this.maxHp;
    this.bar.fillStyle(0xff3b6b, 1).fillRect(x, y, w * pct, h);
  }

  destroy() {
    this.bar.destroy();
    this.sprite.destroy();
  }
}
