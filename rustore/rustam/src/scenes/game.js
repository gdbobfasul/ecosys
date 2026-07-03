// Version: 1.0001
// GameScene — полето, Рустам, изскачащите краставици и къртиците.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { getLevel } from './levels.js';
import Rustam from '../entities/rustam.js';
import Cucumber from '../entities/cucumber.js';

// Граници на играта (полето) — под HUD-а. Числата са от логическата резолюция
// (GAME_WIDTH 480 × GAME_HEIGHT 854, виж main.js). НЕ ги четем от main.js НА MODULE-LOAD:
// main.js ↔ scenes е кръгов импорт → GAME_WIDTH е в TDZ при зареждане
// („Cannot access 'GAME_WIDTH' before initialization"). Затова са литерали тук.
const FIELD = { x: 16, y: 96, w: 480 - 32, h: 854 - 112 };
const COLLECT_RADIUS = 34;   // на какво разстояние Рустам бере краставицата

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelNum = Phaser.Math.Clamp((data && data.level) || 1, 1, 10);
    this.levelStartScore = (data && data.carryScore) || 0;  // точки в началото на нивото
  }

  create() {
    this.cfg = getLevel(this.levelNum);

    this.drawField();

    // Граници на света за движението на Рустам.
    this.physics.world.setBounds(FIELD.x, FIELD.y, FIELD.w, FIELD.h);

    this.rustam = new Rustam(this, GAME_WIDTH / 2, FIELD.y + FIELD.h * 0.62);
    // По-късните нива започват леко по-бързо (плавно компенсиране, +6 px/сек на ниво).
    this.rustam.setBaseSpeed(252 + (this.levelNum - 1) * 6);

    // Състояние.
    this.cukes = [];
    this.collected = 0;
    this.score = this.levelStartScore;     // натрупани краставици в този забег
    this.maxLives = this.cfg.lives;
    this.lives = this.cfg.lives;
    this.over = false;

    // Десктоп управление (по избор).
    this.keys = this.input.keyboard
      ? this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D',
          up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT' })
      : null;

    // HUD overlay.
    this.scene.launch('UI', {
      level: this.levelNum, game: this,
      maxLives: this.maxLives, quota: this.cfg.quota
    });
    this.uiScene = this.scene.get('UI');

    // Първоначален HUD.
    this.emitProgress();
    this.events.emit('livesChanged', this.lives);

    // Старт на изскачането.
    this.scheduleSpawn();

    // Чистене при спиране на сцената.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.spawnEvt) this.spawnEvt.remove(false);
      this.cukes.forEach((c) => c.destroyNow());
      this.cukes = [];
    });
  }

  // Поле: зелен фон + бразди + тревички.
  drawField() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x2c4a1c, 0x2c4a1c, 0x16280e, 0x16280e, 1);
    bg.fillRect(0, 0, W, H);
    // бразди (хоризонтални редове пръст)
    for (let i = 0; i < 9; i++) {
      const y = FIELD.y + 24 + i * (FIELD.h / 9);
      bg.fillStyle(0x3a5a24, 0.35); bg.fillRect(FIELD.x, y, FIELD.w, 8);
      bg.fillStyle(0x101c0a, 0.18); bg.fillRect(FIELD.x, y + 8, FIELD.w, 3);
    }
    // рамка на полето
    bg.lineStyle(2, 0x0a0d08, 0.5); bg.strokeRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    // тревички (украса, без колизия)
    for (let i = 0; i < 22; i++) {
      const x = FIELD.x + 10 + Math.random() * (FIELD.w - 20);
      const y = FIELD.y + 10 + Math.random() * (FIELD.h - 20);
      this.add.image(x, y, 'tuft').setDepth(1).setAlpha(0.5 + Math.random() * 0.3)
        .setScale(0.7 + Math.random() * 0.6);
    }
  }

  // Планира следващото изскачане със случаен интервал.
  scheduleSpawn() {
    if (this.over) return;
    const [mn, mx] = this.cfg.spawnEveryMs;
    const delay = Phaser.Math.Between(mn, mx);
    this.spawnEvt = this.time.delayedCall(delay, () => {
      this.trySpawn();
      this.scheduleSpawn();
    });
  }

  // Опитва да пусне нова краставица (ако има място и още има нужда).
  trySpawn() {
    if (this.over) return;
    if (this.collected >= this.cfg.quota) return;
    const growing = this.cukes.filter((c) => c.isCollectable()).length;
    if (growing >= this.cfg.maxActive) return;

    const pos = this.pickSpot();
    if (!pos) return;
    const c = new Cucumber(this, pos.x, pos.y, {
      growMs: this.cfg.holeGrowMs,
      moleSize: this.cfg.moleSize,
      holeSize: this.cfg.holeSize
    });
    this.cukes.push(c);
  }

  // Намира свободно място (далеч от другите краставици и от Рустам).
  pickSpot() {
    const pad = 40;
    for (let attempt = 0; attempt < 14; attempt++) {
      const x = FIELD.x + pad + Math.random() * (FIELD.w - pad * 2);
      const y = FIELD.y + pad + Math.random() * (FIELD.h - pad * 2);
      let ok = Math.hypot(x - this.rustam.x, y - this.rustam.y) > 70;
      if (ok) {
        for (const c of this.cukes) {
          if (!c.done && Math.hypot(x - c.x, y - c.y) < 64) { ok = false; break; }
        }
      }
      if (ok) return { x, y };
    }
    return null;
  }

  update(time, delta) {
    if (this.over) {
      if (this.rustam) this.rustam.stop();
      return;
    }

    // Вход: джойстик (мобилно) или клавиши (десктоп).
    let vx = 0, vy = 0;
    const joy = this.uiScene && this.uiScene.joyVector ? this.uiScene.joyVector : null;
    if (joy && (Math.abs(joy.x) > 0.001 || Math.abs(joy.y) > 0.001)) { vx = joy.x; vy = joy.y; }
    if (this.keys) {
      if (this.keys.left.isDown || this.keys.left2.isDown) vx = -1;
      else if (this.keys.right.isDown || this.keys.right2.isDown) vx = 1;
      if (this.keys.up.isDown || this.keys.up2.isDown) vy = -1;
      else if (this.keys.down.isDown || this.keys.down2.isDown) vy = 1;
    }
    if (vx !== 0 || vy !== 0) this.rustam.move(vx, vy);
    else this.rustam.stop();

    // Краставици: растеж + бране.
    const rx = this.rustam.reachX(), ry = this.rustam.reachY();
    for (const c of this.cukes) {
      c.update(delta);
      if (c.isCollectable() && Math.hypot(rx - c.x, ry - c.y) <= COLLECT_RADIUS) {
        this.collectCucumber(c);
      }
    }
    // Махаме приключилите.
    if (this.cukes.some((c) => c.done)) this.cukes = this.cukes.filter((c) => !c.done);
  }

  collectCucumber(c) {
    if (!c.collect()) return;
    this.collected += 1;
    this.score += 1;
    this.rustam.speedUp();                       // всяка краставица → мъничко по-бърз Рустам
    this.popText(c.x, c.y - 18, '+1', THEME.accentHex);
    this.emitProgress();
    if (this.collected >= this.cfg.quota) this.win();
  }

  // Вика се от Cucumber, когато къртицата отмъкне краставицата.
  onCucumberSnatched(_c) {
    if (this.over) return;
    this.lives = Math.max(0, this.lives - 1);
    this.events.emit('livesChanged', this.lives);
    this.cameras.main.shake(120, 0.006);
    if (this.lives <= 0) this.lose();
  }

  popText(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 600, ease: 'Quad.out',
      onComplete: () => t.destroy() });
  }

  emitProgress() {
    const ratio = this.cfg.quota > 0 ? this.collected / this.cfg.quota : 0;
    this.events.emit('progress', ratio, this.collected, this.cfg.quota, this.score);
  }

  win() {
    if (this.over) return;
    this.over = true;
    if (this.spawnEvt) this.spawnEvt.remove(false);
    this.rustam.stop();
    this.time.delayedCall(650, () => this.finish(true));
  }

  lose() {
    if (this.over) return;
    this.over = true;
    if (this.spawnEvt) this.spawnEvt.remove(false);
    this.rustam.stop();
    this.time.delayedCall(450, () => this.finish(false));
  }

  finish(win) {
    this.scene.stop('UI');
    this.scene.start('GameOver', {
      win,
      level: this.levelNum,
      score: this.score,
      collected: this.collected,
      quota: this.cfg.quota,
      levelStartScore: this.levelStartScore
    });
  }
}
