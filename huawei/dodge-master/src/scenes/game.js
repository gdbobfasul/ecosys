// GameScene — самата игра: арена, играч, хвърлячи, снаряди, сблъсъци, прогрес.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { getLevel } from './levels.js';
import { drawArena } from '../gfx/arena.js';
import Player from '../entities/player.js';
import Projectile from '../entities/projectile.js';
import Thrower from '../entities/thrower.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelNum = data && data.level ? data.level : 1;
    this.level = getLevel(this.levelNum);
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    this.physics.world.setBounds(0, 0, W, H);

    // --- Арена (фон по ниво) ---
    const bg = this.add.graphics().setDepth(0);
    drawArena(this, this.level.arena, bg, this.levelNum * 7 + 3);

    // Слой за петна/decals (под играча и снарядите)
    this.decals = this.add.group();

    // --- Играч в центъра ---
    this.player = new Player(this, W / 2, H * 0.62);

    // --- Pool за снаряди ---
    this.projectiles = this.add.group({
      classType: Projectile, maxSize: 80, runChildUpdate: true
    });

    // Сблъсък играч <-> снаряд
    this.physics.add.overlap(this.player, this.projectiles, this.onHit, null, this);

    // --- Хвърлячи ---
    this.thrower = new Thrower(this, this.level);

    // --- Състояние/прогрес ---
    this.elapsed = 0;            // изминало време в нивото (ms)
    this.dodges = 0;            // брой избегнати снаряди (за score)
    this.score = 0;
    this.cleared = false;
    this.dead = false;

    // Управление от клавиатура (десктоп)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    // Виртуален джойстик (мобилно/мишка) — създаваме в UIScene и слушаме оттам
    this.scene.launch('UI', { level: this.levelNum, game: this });
    this.ui = this.scene.get('UI');

    // Планираме вълните
    this.scheduleNext();

    // Кратко „GO" известие
    this.showBanner(`НИВО ${this.levelNum}\n${this.level.name}`);
  }

  // Изстрелва снаряд от pool-а (извиква се от Thrower).
  launch(type, sx, sy, tx, ty, target) {
    if (this.dead || this.cleared) return;
    const p = this.projectiles.get();
    if (!p) return;
    p.fire(type, sx, sy, tx, ty, this.level.projSpeed, target);
  }

  scheduleNext() {
    if (this.dead || this.cleared) return;
    const [mn, mx] = this.level.spawnDelayMs;
    const delay = Phaser.Math.Between(mn, mx);
    this.spawnTimer = this.time.delayedCall(delay, () => {
      // Брой едновременни хвърлячи -> няколко вълни наведнъж
      for (let i = 0; i < this.level.throwers; i++) {
        this.time.delayedCall(i * 80, () => {
          if (!this.dead && !this.cleared) this.thrower.spawnWave(this.player);
        });
      }
      this.scheduleNext();
    });
  }

  onHit(player, proj) {
    if (!proj.active) return;
    const def = proj.def;
    const now = this.time.now;
    const accepted = player.takeHit(now, def.dmg);
    // Импакт ефекти
    this.impact(proj);
    proj.kill();
    if (accepted) {
      this.cameras.main.shake(def.big ? 220 : 120, def.big ? 0.012 : 0.006);
      this.events.emit('healthChanged', player.health, player.maxHealth);
      if (player.isDead()) this.lose();
    }
  }

  // Визуален удар: петно (decal) + частици.
  impact(proj) {
    const def = proj.def;
    if (def.decal) {
      const d = this.add.image(proj.x, proj.y, def.decal)
        .setDepth(5).setAlpha(0.9)
        .setScale(def.big ? 1.2 : 0.8)
        .setRotation(Math.random() * Math.PI);
      this.decals.add(d);
      // Ограничаваме броя петна за производителност
      if (this.decals.getLength() > 26) {
        const oldest = this.decals.getChildren()[0];
        if (oldest) oldest.destroy();
      }
    }
    // Частици (искри/прах)
    const tex = def.decal ? 'dustbit' : 'spark';
    const burst = this.add.particles(proj.x, proj.y, tex, {
      speed: { min: 40, max: 160 }, lifespan: 360, quantity: def.big ? 16 : 8,
      scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, emitting: false
    }).setDepth(65);
    burst.explode();
    this.time.delayedCall(400, () => burst.destroy());

    if (def.shatter) {
      // Гърнето се „пръска" на парчета
      const sh = this.add.particles(proj.x, proj.y, 'p_stone', {
        speed: { min: 60, max: 200 }, lifespan: 500, quantity: 6,
        scale: { start: 0.5, end: 0 }, rotate: { min: 0, max: 360 }, emitting: false
      }).setDepth(65);
      sh.explode();
      this.time.delayedCall(560, () => sh.destroy());
    }
  }

  update(time, delta) {
    if (this.dead) return;

    // --- Вход за движение ---
    let vx = 0, vy = 0;
    // Клавиатура
    if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
    // Джойстик (от UIScene)
    if (this.ui && this.ui.joyVector && (this.ui.joyVector.x || this.ui.joyVector.y)) {
      vx = this.ui.joyVector.x; vy = this.ui.joyVector.y;
    }
    if (vx || vy) this.player.move(vx, vy);
    else this.player.stop();

    // --- Чистене на излезли извън екрана снаряди + броене на „избегнати" ---
    const pad = 60;
    this.projectiles.getChildren().forEach((p) => {
      if (!p.active) return;
      if (p.x < -pad || p.x > GAME_WIDTH + pad || p.y < -pad || p.y > GAME_HEIGHT + pad) {
        p.kill();
        this.dodges++;
        this.score += 10;
      }
    });

    // --- Прогрес по време ---
    this.elapsed += delta;
    this.score += delta * 0.01; // оцеляването дава точки
    this.events.emit('progress', this.elapsed / this.level.surviveMs, Math.floor(this.score));

    if (!this.cleared && this.elapsed >= this.level.surviveMs) {
      this.win();
    }
  }

  showBanner(text) {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '34px', color: THEME.primaryHex,
      align: 'center', fontStyle: 'bold', stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(200).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, duration: 300, yoyo: true, hold: 800,
      onComplete: () => t.destroy()
    });
  }

  win() {
    if (this.cleared || this.dead) return;
    this.cleared = true;
    if (this.spawnTimer) this.spawnTimer.remove(false);
    this.finishScore = Math.floor(this.score);
    this.time.delayedCall(700, () => {
      this.scene.stop('UI');
      this.scene.start('GameOver', {
        win: true, level: this.levelNum, score: this.finishScore, dodges: this.dodges
      });
    });
    this.showBanner('ОЦЕЛЯ!');
  }

  lose() {
    if (this.dead) return;
    this.dead = true;
    if (this.spawnTimer) this.spawnTimer.remove(false);
    this.player.stop();
    this.finishScore = Math.floor(this.score);
    this.cameras.main.shake(300, 0.02);
    this.time.delayedCall(800, () => {
      this.scene.stop('UI');
      this.scene.start('GameOver', {
        win: false, level: this.levelNum, score: this.finishScore, dodges: this.dodges
      });
    });
  }
}
