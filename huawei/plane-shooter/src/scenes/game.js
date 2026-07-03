// Version: 1.0001
// GameScene — основната игрова логика.
// Отговаря за: спавн на врагове/препятствия, оръжия, колизии, бос,
// прогрес на нивото и преминаване нагоре по 10-те нива.
import Phaser from 'phaser';
import { THEME } from '../theme.js';
import Starfield from '../gfx/starfield.js';
import Plane from '../entities/plane.js';
import Enemy from '../entities/enemy.js';
import Boss from '../entities/boss.js';
import { LEVELS, TOTAL_LEVELS } from './levels.js';
import { WEAPONS } from '../weapons/weapons.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelIndex = data.level || 0;
    this.score = data.score || 0;
    this.lives = data.lives != null ? data.lives : 3;
    // Запазваме отключените оръжия между нивата (подава се от предишно ниво).
    this.carryWeapons = data.weapons || ['bullet'];
    // Пренасяме и натрупания щит между нивата.
    this.carryShield = data.shield || 0;
  }

  create() {
    const { width, height } = this.scale;
    this.level = LEVELS[this.levelIndex];
    this.killed = 0;
    this.levelComplete = false;
    this.bossActive = false;
    this.boss = null;

    this.stars = new Starfield(this);

    // Играч + пренасяне на отключените оръжия.
    this.player = new Plane(this);
    this.carryWeapons.forEach((k) => this.player.unlocked.add(k));
    this.player.weaponKey = this.carryWeapons[this.carryWeapons.length - 1];
    // Възстановяваме пренесения щит.
    if (this.carryShield > 0) this.player.addShield(this.carryShield);

    // От ниво 8 нататък главният самолет получава МЕГА-МИНА — мощно оръжие срещу гъстите рояци
    // (взривява 8–10 близки врага наведнъж). Прави го активно оръжие; играчът пак може да цикли.
    if (this.level.id >= 8) {
      this.player.unlock('megamine');
      this.player.weaponKey = 'megamine';
    }

    // Групи (с физика).
    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.obstacles = this.physics.add.group();
    this.powerups = this.physics.add.group();
    // Артефакти за щит — носят се по полето, играчът ги събира с прелитане.
    this.artifacts = this.physics.add.group();

    // Частици за експлозии.
    this.explosions = this.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 260 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 480,
      emitting: false
    });
    this.explosions.setDepth(20);

    // Управление: следваме показалеца (touch/мишка).
    this.pointerActive = false;
    this.input.on('pointerdown', (p) => { this.pointerActive = true; this.targetX = p.x; this.targetY = p.y; });
    this.input.on('pointermove', (p) => { if (p.isDown) { this.targetX = p.x; this.targetY = p.y; } });
    this.input.on('pointerup', () => { this.pointerActive = false; });

    // Колизии.
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletEnemy, null, this);
    this.physics.add.overlap(this.bullets, this.obstacles, this.onBulletObstacle, null, this);
    this.physics.add.overlap(this.player.sprite, this.enemies, this.onPlayerEnemy, null, this);
    this.physics.add.overlap(this.player.sprite, this.obstacles, this.onPlayerObstacle, null, this);
    this.physics.add.overlap(this.player.sprite, this.enemyBullets, this.onPlayerEnemyBullet, null, this);
    this.physics.add.overlap(this.player.sprite, this.powerups, this.onPlayerPowerup, null, this);
    this.physics.add.overlap(this.player.sprite, this.artifacts, this.onPlayerArtifact, null, this);

    // Таймери за спавн.
    this.spawnTimer = this.time.addEvent({
      delay: this.level.spawnInterval,
      loop: true,
      callback: () => this.spawnWave()
    });
    if (this.level.obstacles.length > 0) {
      this.obstacleTimer = this.time.addEvent({
        delay: 1800,
        loop: true,
        callback: () => this.spawnObstacle()
      });
    }

    // Таймер за артефакти (щит). Появяват се по-често на по-трудните нива,
    // за да може играчът да оцелее от ~ниво 5 нататък със събиране на щитове.
    // levelIndex 0..9; на ниво 5 (index 4) интервалът вече е забележимо по-кратък.
    const artifactDelay = Phaser.Math.Clamp(9000 - this.levelIndex * 700, 4200, 9000);
    this.artifactTimer = this.time.addEvent({
      delay: artifactDelay,
      loop: true,
      callback: () => this.spawnArtifact()
    });
    // Първи артефакт малко по-рано, за да усети играчът механиката.
    this.time.delayedCall(2500, () => this.spawnArtifact());

    // Стартираме HUD сцената отгоре.
    this.scene.launch('UI', { game: this });
    this.ui = this.scene.get('UI');

    // Кратко известие за нивото.
    this.flashBanner(`НИВО ${this.level.id}\n${this.level.name}`);
  }

  // --- Спавн на вълна врагове според pattern-а ---
  spawnWave() {
    if (this.levelComplete || this.bossActive) return;
    const { width } = this.scale;
    const types = this.level.enemyTypes;
    const pick = () => types[Phaser.Math.Between(0, types.length - 1)];

    if (this.level.pattern === 'vformation') {
      const cx = Phaser.Math.Between(80, width - 80);
      for (let i = -2; i <= 2; i++) {
        const x = Phaser.Math.Clamp(cx + i * 36, 30, width - 30);
        Enemy.spawn(this, this.enemies, x, pick(), this.level);
      }
    } else if (this.level.pattern === 'sweep') {
      for (let i = 0; i < 4; i++) {
        const x = Phaser.Math.Between(30, width - 30);
        Enemy.spawn(this, this.enemies, x, pick(), this.level);
      }
    } else {
      const n = this.level.pattern === 'sine' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const x = Phaser.Math.Between(30, width - 30);
        Enemy.spawn(this, this.enemies, x, pick(), this.level);
      }
    }
  }

  spawnObstacle() {
    if (this.levelComplete) return;
    const { width } = this.scale;
    const kind = this.level.obstacles[Phaser.Math.Between(0, this.level.obstacles.length - 1)];
    const x = Phaser.Math.Between(30, width - 30);
    const o = this.obstacles.create(x, -40, kind === 'mine' ? 'mine' : 'asteroid');
    o.setDepth(7);
    o.kind = kind;
    o.hp = kind === 'mine' ? 4 : 6;
    if (kind === 'asteroid') {
      o.setVelocityY(Phaser.Math.Between(90, 150));
      o.setAngularVelocity(Phaser.Math.Between(-120, 120));
    } else {
      o.setVelocityY(70);
      o.canFire = true;
      o.lastShot = this.time.now + 600;
    }
  }

  // --- Огън на играча ---
  fire(time) {
    if (!this.player.canFire(time)) return;
    this.player.markFired(time);
    const w = this.player.weapon;
    const b = this.bullets.create(this.player.sprite.x, this.player.sprite.y - 24, w.texture);
    b.setDepth(9).setTint(w.tint);
    b.weapon = w.key;
    b.damage = w.damage;
    b.splash = w.splash;
    b.fullSplash = !!w.fullSplash;
    b.homing = w.homing;
    if (w.key === 'megamine') b.setScale(1.6);   // по-едър заряд визуално
    b.turnRate = w.turnRate || 0;
    if (w.homing) {
      b.setVelocity(0, w.speed);
    } else {
      b.setVelocityY(w.speed);
    }
  }

  // --- Колизии ---
  onBulletEnemy(bullet, enemy) {
    this.applyBulletHit(bullet, enemy.x, enemy.y);
    // Бос е отделен спрайт, но може да е в групата enemies? Не — бос е директен.
    enemy.hp -= bullet.damage;
    this.spawnHitSpark(enemy.x, enemy.y);
    if (enemy.hp <= 0) {
      this.score += enemy.score;
      this.killed++;
      this.boom(enemy.x, enemy.y, 0xff7a7a);
      this.maybeDropPowerup(enemy.x, enemy.y);
      enemy.destroy();
      this.checkLevelProgress();
    }
    this.consumeBullet(bullet);
  }

  onBulletObstacle(bullet, obs) {
    this.applyBulletHit(bullet, obs.x, obs.y);
    obs.hp -= bullet.damage;
    this.spawnHitSpark(obs.x, obs.y);
    if (obs.hp <= 0) {
      this.score += 50;
      this.boom(obs.x, obs.y, 0xcccccc);
      obs.destroy();
    }
    this.consumeBullet(bullet);
  }

  // Splash щета за бомби/ракети/мега-мини. fullSplash (мега-мина) нанася ПЪЛНА щета на всички в
  // радиуса (мете цял рояк наведнъж); иначе — половин щета (бомба/ракета).
  applyBulletHit(bullet, x, y) {
    if (bullet.splash > 0) {
      const big = !!bullet.fullSplash;
      const splashDmg = big ? bullet.damage : Math.ceil(bullet.damage / 2);
      this.boom(x, y, big ? 0xff5a3b : 0xffc04d, big ? 3.0 : 1.4);
      if (big) this.cameras.main.shake(160, 0.01);
      this.enemies.getChildren().forEach((e) => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) <= bullet.splash) {
          e.hp -= splashDmg;
          if (e.hp <= 0) {
            this.score += e.score; this.killed++;
            this.boom(e.x, e.y, 0xff7a7a); e.destroy();
            this.checkLevelProgress();
          }
        }
      });
      // Splash и по боса.
      if (this.boss && Phaser.Math.Distance.Between(x, y, this.boss.sprite.x, this.boss.sprite.y) <= bullet.splash) {
        if (this.boss.hit(splashDmg)) this.onBossDead();
      }
    }
  }

  consumeBullet(bullet) {
    // Бомбите/ракетите изчезват при удар; куршумите също (просто).
    bullet.destroy();
  }

  onPlayerEnemy(planeSprite, enemy) {
    if (this.player.hit(20)) {
      this.boom(enemy.x, enemy.y, 0xff7a7a);
      enemy.destroy();
      this.cameras.main.shake(120, 0.01);
      this.checkLives();
    }
  }

  onPlayerObstacle(planeSprite, obs) {
    if (this.player.hit(25)) {
      this.cameras.main.shake(120, 0.012);
      this.checkLives();
    }
  }

  onPlayerEnemyBullet(planeSprite, eb) {
    eb.destroy();
    if (this.player.hit(12)) {
      this.cameras.main.shake(80, 0.008);
      this.checkLives();
    }
  }

  onPlayerPowerup(planeSprite, pu) {
    const kind = pu.kind;
    pu.destroy();
    if (kind === 'health') {
      this.player.heal(30);
      this.flashBanner('+ ЗДРАВЕ');
    } else {
      this.player.unlock(kind); // 'bomb' | 'missile'
      this.flashBanner('НОВО ОРЪЖИЕ:\n' + WEAPONS[kind].name);
    }
  }

  maybeDropPowerup(x, y) {
    // Малък шанс за капсула; типът зависи от това какво още не сме отключили.
    if (Phaser.Math.FloatBetween(0, 1) > 0.12) {
      // По-чест дроп на здраве при ниско здраве.
      if (this.player.health < 40 && Phaser.Math.FloatBetween(0, 1) < 0.5) {
        return this.dropPowerup(x, y, 'health');
      }
      return;
    }
    if (!this.player.unlocked.has('bomb')) return this.dropPowerup(x, y, 'bomb');
    if (!this.player.unlocked.has('missile')) return this.dropPowerup(x, y, 'missile');
    this.dropPowerup(x, y, 'health');
  }

  dropPowerup(x, y, kind) {
    const texMap = { bomb: 'pu_bomb', missile: 'pu_missile', health: 'pu_health' };
    const pu = this.powerups.create(x, y, texMap[kind]);
    pu.kind = kind;
    pu.setDepth(8).setVelocityY(120);
    this.tweens.add({ targets: pu, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
  }

  // --- Артефакти за щит ---
  // Три типа с различна сила:
  //   crystal — слаб щит (+1 заряд)
  //   orb     — среден щит (+3 заряда)
  //   star    — силен/рядък щит (+6 заряда, на практика пълно поле)
  // На по-високите нива по-силните артефакти стават малко по-вероятни.
  spawnArtifact() {
    if (this.levelComplete) return;
    const { width } = this.scale;
    const r = Phaser.Math.FloatBetween(0, 1);
    // Тежест на типовете расте леко с нивото (повече помощ след ниво 5).
    const hard = this.levelIndex >= 4;
    let kind;
    if (r < (hard ? 0.10 : 0.06)) kind = 'star';        // рядък
    else if (r < (hard ? 0.42 : 0.32)) kind = 'orb';    // среден
    else kind = 'crystal';                               // чест

    const texMap = { crystal: 'art_crystal', orb: 'art_orb', star: 'art_star' };
    const x = Phaser.Math.Between(40, width - 40);
    const a = this.artifacts.create(x, -30, texMap[kind]);
    a.kind = kind;
    a.setDepth(8);
    // Леко странично полюшване, за да изглежда като носещ се по пътя артефакт.
    a.setVelocity(Phaser.Math.Between(-30, 30), Phaser.Math.Between(70, 110));
    a.body.setAllowGravity(false);
    // Пулсация + бавно завъртане за „жив" вид.
    this.tweens.add({ targets: a, scale: 1.25, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: a, angle: 360, duration: 4000, repeat: -1 });
  }

  onPlayerArtifact(planeSprite, art) {
    const kind = art.kind;
    const amounts = { crystal: 1, orb: 3, star: 6 };
    const tints = { crystal: 0x6ea8ff, orb: 0x00e5ff, star: 0xffd166 };
    const names = { crystal: 'ЩИТ +1', orb: 'ЩИТ +3', star: 'СИЛЕН ЩИТ!' };
    const added = this.player.addShield(amounts[kind] || 1);
    art.destroy();
    // Ефект при събиране.
    this.boom(planeSprite.x, planeSprite.y, tints[kind] || 0x66ddff, 1.1);
    this.flashBanner(added > 0 ? names[kind] : 'ЩИТЪТ Е ПЪЛЕН');
  }

  // --- Прогрес на нивото ---
  checkLevelProgress() {
    if (this.levelComplete || this.bossActive) return;
    if (this.killed >= this.level.quota) {
      if (this.level.boss) {
        this.startBoss();
      } else {
        this.completeLevel();
      }
    }
  }

  startBoss() {
    this.bossActive = true;
    this.spawnTimer.paused = true;
    this.boss = new Boss(this, this.level);
    this.flashBanner('БОС!');
    // Колизии с боса.
    this.physics.add.overlap(this.bullets, this.boss.sprite, (bullet) => {
      this.applyBulletHit(bullet, this.boss.sprite.x, this.boss.sprite.y);
      const dead = this.boss.hit(bullet.damage);
      this.spawnHitSpark(bullet.x, bullet.y);
      this.consumeBullet(bullet);
      if (dead) this.onBossDead();
    }, null, this);
    this.physics.add.overlap(this.player.sprite, this.boss.sprite, () => {
      if (this.player.hit(30)) { this.cameras.main.shake(150, 0.014); this.checkLives(); }
    }, null, this);
  }

  onBossDead() {
    if (!this.boss) return;
    this.score += this.boss.sprite.score;
    const bx = this.boss.sprite.x, by = this.boss.sprite.y;
    this.boom(bx, by, 0xffd166, 3);
    this.cameras.main.shake(300, 0.02);
    this.boss.destroy();
    this.boss = null;
    this.bossActive = false;
    this.completeLevel();
  }

  completeLevel() {
    if (this.levelComplete) return;
    this.levelComplete = true;
    this.spawnTimer.paused = true;
    if (this.obstacleTimer) this.obstacleTimer.paused = true;
    if (this.artifactTimer) this.artifactTimer.paused = true;

    // Награда: отключване на ново оръжие.
    if (this.level.reward) this.player.unlock(this.level.reward);

    const isLast = this.levelIndex >= TOTAL_LEVELS - 1;
    this.time.delayedCall(900, () => {
      this.scene.stop('UI');
      if (isLast) {
        this.scene.start('GameOver', { won: true, score: this.score });
      } else {
        // Към следващото ниво, пренасяме точки/животи/оръжия.
        this.scene.start('Game', {
          level: this.levelIndex + 1,
          score: this.score,
          lives: this.lives,
          weapons: Array.from(this.player.unlocked),
          shield: this.player.shield
        });
      }
    });
    this.flashBanner(isLast ? 'ПОБЕДА!' : `НИВО ${this.level.id} ЗАВЪРШЕНО`);
  }

  checkLives() {
    if (this.player.health > 0) return;
    this.lives--;
    if (this.lives <= 0) {
      this.scene.stop('UI');
      this.scene.start('GameOver', { won: false, score: this.score });
    } else {
      // Респаун на същото ниво с пълно здраве.
      this.player.health = this.player.maxHealth;
      this.player.invuln = 2.0;
      this.flashBanner('ОСТАВАТ ' + this.lives + ' ЖИВОТА');
    }
  }

  // --- Визуални ефекти ---
  boom(x, y, tint, scale = 1) {
    this.explosions.setParticleTint(tint);
    this.explosions.emitParticleAt(x, y, Math.round(14 * scale));
  }

  spawnHitSpark(x, y) {
    this.explosions.setParticleTint(0xffffff);
    this.explosions.emitParticleAt(x, y, 4);
  }

  flashBanner(text) {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height * 0.4, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '30px', fontStyle: 'bold',
      color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setDepth(60);
    t.setShadow(0, 0, THEME.accentHex, 14, true, true);
    this.tweens.add({
      targets: t, alpha: 0, y: t.y - 30, duration: 1400, ease: 'Cubic.out',
      onComplete: () => t.destroy()
    });
  }

  // --- Главен цикъл ---
  update(time, delta) {
    const dt = delta / 1000;
    this.stars.update(dt);
    this.player.update(dt);

    // Движение на играча.
    if (this.pointerActive && this.targetX != null) {
      this.player.moveTo(this.targetX, Math.min(this.targetY, this.scale.height - 60));
    }
    // Авто-огън (винаги стреля).
    if (!this.levelComplete) this.fire(time);

    // Насочване на ракетите към най-близкия враг/бос.
    this.bullets.getChildren().forEach((b) => {
      if (b.homing) this.homeMissile(b, dt);
      if (b.y < -40 || b.y > this.scale.height + 40) b.destroy();
    });

    // Движение/огън на враговете.
    this.enemies.getChildren().forEach((e) => {
      Enemy.steer(e, time);
      if (e.canFire && this.level.enemyFireMul > 0 && time > e.lastShot) {
        e.lastShot = time + Phaser.Math.Between(900, 2200) / this.level.enemyFireMul;
        this.enemyShoot(e.x, e.y);
      }
      if (e.y > this.scale.height + 50) e.destroy();
    });

    // Препятствия-турели стрелят.
    this.obstacles.getChildren().forEach((o) => {
      if (o.canFire && time > o.lastShot) {
        o.lastShot = time + 1500;
        this.enemyShoot(o.x, o.y);
      }
      if (o.y > this.scale.height + 60) o.destroy();
    });

    // Чисти вражеските куршуми.
    this.enemyBullets.getChildren().forEach((eb) => {
      if (eb.y > this.scale.height + 30 || eb.y < -30) eb.destroy();
    });
    this.powerups.getChildren().forEach((pu) => {
      if (pu.y > this.scale.height + 30) pu.destroy();
    });
    // Чисти артефактите, които са напуснали екрана (държим страничната граница).
    this.artifacts.getChildren().forEach((a) => {
      if (a.y > this.scale.height + 40) a.destroy();
      else if (a.x < 16 || a.x > this.scale.width - 16) a.setVelocityX(-a.body.velocity.x);
    });

    // Бос.
    if (this.boss) {
      this.boss.update(time, dt);
      if (this.boss.shouldShoot(time)) {
        // Бос стреля ветрило.
        for (let a = -2; a <= 2; a++) {
          this.enemyShoot(this.boss.sprite.x, this.boss.sprite.y + 20, a * 0.25);
        }
      }
    }
  }

  homeMissile(b, dt) {
    const target = this.nearestTarget(b.x, b.y);
    if (!target) return;
    const ang = Phaser.Math.Angle.Between(b.x, b.y, target.x, target.y);
    const cur = Math.atan2(b.body.velocity.y, b.body.velocity.x);
    const next = Phaser.Math.Angle.RotateTo(cur, ang, b.turnRate * dt);
    const speed = 380;
    b.setVelocity(Math.cos(next) * speed, Math.sin(next) * speed);
    b.setRotation(next + Math.PI / 2);
  }

  nearestTarget(x, y) {
    let best = null, bestD = Infinity;
    this.enemies.getChildren().forEach((e) => {
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    });
    if (this.boss) {
      const d = Phaser.Math.Distance.Between(x, y, this.boss.sprite.x, this.boss.sprite.y);
      if (d < bestD) { bestD = d; best = this.boss.sprite; }
    }
    return best;
  }

  enemyShoot(x, y, angleOffset = 0) {
    const eb = this.enemyBullets.create(x, y + 14, 'ebullet');
    eb.setDepth(8);
    const speed = 220;
    const ang = Math.PI / 2 + angleOffset; // надолу + отклонение
    eb.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
  }
}
