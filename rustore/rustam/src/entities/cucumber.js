// Version: 1.0001
// Краставица + нейната ДУПКА + КЪРТИЦА — една „плочка" на полето.
//
// Жизнен цикъл:
//   1. growing  — краставицата изскача от земята; ДО нея започва да расте дупка от
//                 малка точица до пълен размер за holeGrowMs. Това е времето, в което
//                 Рустам трябва да я набере.
//   2а. collected — Рустам стига навреме → краставицата се бере (точка), дупката изчезва.
//   2б. snatching — времето изтече → от дупката изскача КЪРТИЦА, дръпва краставицата
//                 под земята (пропусната) и потъва обратно.
//   3. done     — плочката е приключила и се маха от полето.
//
// Не ползва аркадна физика — досегът се мери по разстояние в GameScene (по-просто и точно).
import Phaser from 'phaser';
import { HOLE_TEX, MOLE_TEX } from '../gfx/textures.js';

export default class Cucumber {
  constructor(scene, x, y, opts) {
    this.scene = scene;
    this.x = x; this.y = y;
    this.growMs = opts.growMs;
    this.moleSize = opts.moleSize;
    this.holeSize = opts.holeSize;

    this.state = 'growing';   // growing | collected | snatching | done
    this.done = false;
    this.elapsed = 0;

    // Дупката е ДО краставицата (отстрани), не точно върху нея.
    const side = (Math.random() < 0.5 ? -1 : 1);
    this.holeX = x + side * (this.holeSize * 0.55 + 4);
    this.holeY = y + 8;

    // Дупка — почва като мъничка точица (расте в update). Зад краставицата по дълбочина.
    this.hole = scene.add.image(this.holeX, this.holeY, 'hole').setDepth(8);
    this._setHoleScale(0.04);

    // Краставицата изскача от земята (pop).
    this.cuke = scene.add.image(x, y, 'cuke').setDepth(12).setScale(0);
    scene.tweens.add({ targets: this.cuke, scale: 1, duration: 220, ease: 'Back.out' });

    // Малко пръст при изскачане.
    this._burst(x, y + 4, 'leafbit', 5);

    this.mole = null;
  }

  // Мащабира дупката спрямо текущия растеж r∈[0..1] към holeSize.
  _setHoleScale(r) {
    const targetW = this.holeSize * r;
    const ratio = targetW / HOLE_TEX;
    this.hole.setScale(ratio);
    this.hole.setAlpha(Math.min(1, 0.3 + r));
  }

  _burst(x, y, tex, n) {
    for (let i = 0; i < n; i++) {
      const p = this.scene.add.image(x, y, tex).setDepth(13).setScale(Math.random() * 0.7 + 0.4);
      const a = Math.random() * Math.PI * 2, d = Math.random() * 18 + 6;
      this.scene.tweens.add({
        targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0,
        duration: 320 + Math.random() * 160, ease: 'Quad.out', onComplete: () => p.destroy()
      });
    }
  }

  // Вика се всеки кадър от GameScene с изминалото време dt (ms).
  update(dt) {
    if (this.state !== 'growing') return;
    this.elapsed += dt;
    const r = Phaser.Math.Clamp(this.elapsed / this.growMs, 0, 1);
    this._setHoleScale(0.04 + r * 0.96);
    // Леко „треперене" на краставицата към края (тревога).
    if (r > 0.7) this.cuke.x = this.x + Math.sin(this.elapsed * 0.04) * (r - 0.7) * 6;
    if (r >= 1) this.beginSnatch();
  }

  // Дали Рустам може още да я набере.
  isCollectable() {
    return this.state === 'growing';
  }

  // Рустам стигна навреме.
  collect() {
    if (this.state !== 'growing') return false;
    this.state = 'collected';
    this._burst(this.cuke.x, this.cuke.y, 'leafbit', 8);
    this.scene.tweens.add({
      targets: this.cuke, y: this.cuke.y - 18, scale: 1.4, alpha: 0, duration: 200, ease: 'Quad.out',
      onComplete: () => this.cuke.destroy()
    });
    this.scene.tweens.add({
      targets: this.hole, alpha: 0, duration: 260,
      onComplete: () => { this.hole.destroy(); this.done = true; }
    });
    return true;
  }

  // Времето изтече — къртицата изскача и прибира краставицата.
  beginSnatch() {
    this.state = 'snatching';
    this.cuke.x = this.x; // спираме треперенето

    // Къртица изскача от дупката.
    this.mole = this.scene.add.image(this.holeX, this.holeY + 4, 'mole').setDepth(14).setScale(0);
    const moleRatio = this.moleSize / MOLE_TEX;
    this.scene.tweens.add({
      targets: this.mole, scaleX: moleRatio, scaleY: moleRatio, y: this.holeY - 4,
      duration: 200, ease: 'Back.out'
    });
    this._burst(this.holeX, this.holeY, 'dustbit', 7);

    // Краставицата се плъзга към дупката и потъва.
    this.scene.tweens.add({
      targets: this.cuke, x: this.holeX, y: this.holeY + 2, scale: 0.2, alpha: 0.5,
      delay: 150, duration: 300, ease: 'Quad.in',
      onComplete: () => this.cuke.destroy()
    });

    // Къртицата потъва обратно, после дупката се затваря → done.
    this.scene.tweens.add({
      targets: this.mole, scaleX: 0, scaleY: 0, y: this.holeY + 6,
      delay: 470, duration: 240, ease: 'Quad.in',
      onComplete: () => { if (this.mole) this.mole.destroy(); }
    });
    this.scene.tweens.add({
      targets: this.hole, scale: 0, alpha: 0,
      delay: 600, duration: 240,
      onComplete: () => { this.hole.destroy(); this.done = true; }
    });

    // Уведомяваме сцената (пропуск).
    if (typeof this.scene.onCucumberSnatched === 'function') this.scene.onCucumberSnatched(this);
  }

  // Аварийно махане (при рестарт/изход от сцената).
  destroyNow() {
    if (this.cuke && this.cuke.active) this.cuke.destroy();
    if (this.hole && this.hole.active) this.hole.destroy();
    if (this.mole && this.mole.active) this.mole.destroy();
    this.done = true;
  }
}
