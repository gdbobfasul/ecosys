import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../main.js';
import { THEME } from '../theme.js';
import { getLevel, HERO_BASE_HP, TOTAL_LEVELS } from '../levels.js';
import { WEAPONS, unlockedWeapons } from '../weapons.js';
import { Titan } from '../entities/titan.js';
import { EnemyAI } from '../ai.js';
import { buildArena } from '../backgrounds.js';
import { makeButton, titleText } from '../ui.js';

// Главната бойна сцена.
export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  init(data) {
    this.levelId = data.level || 1;
    this.heroWeapon = data.weapon || 'fists';
  }

  create() {
    this.level = getLevel(this.levelId);
    this.over = false;

    const arena = buildArena(this, this.level.arena);
    this.groundY = arena.groundY;

    // --- ТИТАНИ ---
    const heroHp = HERO_BASE_HP + this.level.heroBonusHp;
    this.hero = new Titan(this, 220, this.groundY, {
      prefix: 'hero', facing: 1, hp: heroHp, color: THEME.heroBody, weapon: this.heroWeapon
    });
    this.enemy = new Titan(this, GAME_W - 220, this.groundY, {
      prefix: 'enemy', facing: -1, hp: this.level.hp, color: this.level.arena.accent,
      weapon: this.level.weapons[0]
    });

    // под (статичен) за двете тела
    this.ai = new EnemyAI(this, this.enemy, this.hero, this.level);

    // снаряди
    this.projectiles = [];

    // --- ЧАСТИЦИ ---
    this._setupParticles();

    // --- HUD ---
    this._buildHUD();

    // --- КОНТРОЛИ ---
    this._setupControls();

    // intro
    this._announce(`НИВО ${this.level.id}\n${this.level.name}`, 1400);

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // ---------------------------------------------------------------- particles
  _setupParticles() {
    this.impactEmitter = this.add.particles(0, 0, 'px_spark', {
      lifespan: 420, speed: { min: 120, max: 360 }, scale: { start: 1.4, end: 0 },
      quantity: 0, blendMode: 'ADD', emitting: false,
      tint: [0xffffff, THEME.accent, THEME.primary]
    }).setDepth(60);

    this.smokeEmitter = this.add.particles(0, 0, 'px_smoke', {
      lifespan: 700, speed: { min: 20, max: 80 }, scale: { start: 0.8, end: 1.8 },
      alpha: { start: 0.6, end: 0 }, quantity: 0, emitting: false
    }).setDepth(55);
  }

  _impact(x, y, big) {
    this.impactEmitter.emitParticleAt(x, y, big ? 26 : 12);
    this.smokeEmitter.emitParticleAt(x, y, big ? 8 : 3);
    // ярка светкавица
    const flash = this.add.image(x, y, 'px_glow').setTint(THEME.accent)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(58).setScale(big ? 1.6 : 0.9);
    this.tweens.add({ targets: flash, scale: 0, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
  }

  _shake(intensity, dur) {
    this.cameras.main.shake(dur || 120, intensity || 0.008);
  }

  // ---------------------------------------------------------------- HUD
  _buildHUD() {
    // здравни ленти
    this.heroBar = this._healthBar(30, 30, false, 'ТИ');
    this.enemyBar = this._healthBar(GAME_W - 30, 30, true, this.level.name);

    // индикатор за ниво
    titleText(this, GAME_W / 2, 34, `НИВО ${this.level.id}/${TOTAL_LEVELS}`, 20, THEME.accentHex)
      .setDepth(100);

    // комбо текст
    this.comboText = this.add.text(GAME_W / 2, 90, '', {
      fontFamily: 'system-ui', fontSize: '34px', color: THEME.accentHex, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100).setAlpha(0);
  }

  _healthBar(x, y, mirror, label) {
    const w = 380, h = 26;
    const cont = this.add.container(mirror ? x - w : x, y).setDepth(100);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5); bg.fillRoundedRect(0, 0, w, h, 8);
    const fill = this.add.graphics();
    const lbl = this.add.text(mirror ? w - 6 : 6, h + 4, label, {
      fontFamily: 'system-ui', fontSize: '16px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(mirror ? 1 : 0, 0);
    cont.add([bg, fill, lbl]);
    cont._w = w; cont._h = h; cont._fill = fill; cont._mirror = mirror;
    return cont;
  }

  _updateBar(bar, ratio) {
    const w = bar._w, h = bar._h;
    const fw = Math.max(0, ratio) * (w - 6);
    const color = ratio > 0.5 ? THEME.good : ratio > 0.25 ? THEME.accent : THEME.danger;
    bar._fill.clear();
    bar._fill.fillStyle(color, 1);
    if (bar._mirror) bar._fill.fillRoundedRect(w - 3 - fw, 3, fw, h - 6, 6);
    else bar._fill.fillRoundedRect(3, 3, fw, h - 6, 6);
  }

  // ---------------------------------------------------------------- controls
  _setupControls() {
    // Клавиатура (за тест в браузър)
    this.keys = this.input.keyboard.addKeys({
      left: 'A', right: 'D', altLeft: 'LEFT', altRight: 'RIGHT',
      attack: 'SPACE', jump: 'W', special: 'SHIFT',
      w1: 'ONE', w2: 'TWO', w3: 'THREE', w4: 'FOUR', w5: 'FIVE'
    });

    // Сензорни бутони (за телефон) — голям D-pad ляво, бутони за действие дясно.
    this.touch = { left: false, right: false };
    this._touchButtons();

    // Лента за смяна на оръжие (само отключените)
    this._weaponSwitchBar();
  }

  _touchButtons() {
    const mk = (x, y, r, label, color) => {
      const c = this.add.container(x, y).setDepth(120).setScrollFactor(0);
      const g = this.add.graphics();
      g.fillStyle(color, 0.28); g.fillCircle(0, 0, r);
      g.lineStyle(3, color, 0.7); g.strokeCircle(0, 0, r);
      const t = this.add.text(0, 0, label, { fontFamily: 'system-ui', fontSize: (r * 0.7) + 'px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      c.add([g, t]);
      c.setSize(r * 2, r * 2);
      c.setInteractive(new Phaser.Geom.Circle(0, 0, r), Phaser.Geom.Circle.Contains);
      return c;
    };

    const by = GAME_H - 80;
    // движение
    const lb = mk(80, by, 46, '◀', THEME.primary);
    const rb = mk(190, by, 46, '▶', THEME.primary);
    lb.on('pointerdown', () => this.touch.left = true);
    lb.on('pointerup', () => this.touch.left = false);
    lb.on('pointerout', () => this.touch.left = false);
    rb.on('pointerdown', () => this.touch.right = true);
    rb.on('pointerup', () => this.touch.right = false);
    rb.on('pointerout', () => this.touch.right = false);

    // действие
    const atk = mk(GAME_W - 90, by, 56, '⚔', THEME.danger);
    atk.on('pointerdown', () => this._heroAttack(false));
    const jmp = mk(GAME_W - 200, by, 42, '⤒', THEME.good);
    jmp.on('pointerdown', () => this._heroJump());
    const spc = mk(GAME_W - 90, by - 130, 38, '★', THEME.accent);
    spc.on('pointerdown', () => this._heroAttack(true));
  }

  _weaponSwitchBar() {
    const unlockedLevel = this.registry.get('unlockedLevel') || 1;
    this.heroArsenal = unlockedWeapons(unlockedLevel);
    const startX = GAME_W / 2 - ((this.heroArsenal.length - 1) * 70) / 2;
    this.weaponBtns = [];
    this.heroArsenal.forEach((key, i) => {
      const w = WEAPONS[key];
      const btn = makeButton(this, startX + i * 70, GAME_H - 30, 62, 36, w.name.slice(0, 4), () => {
        this.hero.setWeapon(key);
        this._highlightWeapon(key);
      }, { color: key === this.heroWeapon ? THEME.accent : 0x555, fontSize: '12px' });
      btn._key = key;
      this.weaponBtns.push(btn);
    });
    this._highlightWeapon(this.heroWeapon);
  }

  _highlightWeapon(key) {
    this.weaponBtns.forEach(b => b.alpha = b._key === key ? 1 : 0.55);
  }

  _heroJump() {
    if (this.hero.dead || this.over) return;
    if (this.hero.root.y >= this.groundY - 2) this.hero.body.setVelocityY(-680);
  }

  _heroAttack(special) {
    if (this.hero.dead || this.over) return;
    const now = this.time.now;
    this.hero.attack(now, () => this.resolveAttack(this.hero, this.enemy, special, now));
  }

  // ---------------------------------------------------------------- combat
  // Разрешава атака от attacker към defender. Ако оръжието е хвърлящо -> ражда снаряд.
  resolveAttack(attacker, defender, special, now) {
    const w = attacker.weapon;
    if (w.type === 'throw') {
      this._spawnProjectile(attacker, special);
      return;
    }
    // melee: проверка на обхват
    const reachPt = attacker.getReachPoint();
    const dist = Math.abs(defender.x - attacker.x);
    if (dist <= w.reach && Math.abs(defender.y - attacker.y) < 140) {
      const dir = defender.x >= attacker.x ? 1 : -1;
      let dmg = w.damage;
      if (special) dmg = Math.round(dmg * 1.8);
      // комбо бонус
      if (attacker.comboCount >= 3) dmg = Math.round(dmg * 1.25);
      defender.takeHit(dmg, dir, w.knockback * (special ? 1.5 : 1), now);
      this._impact(reachPt.x, reachPt.y, special || w.key === 'hammer');
      this._shake(special ? 0.02 : 0.01, special ? 220 : 120);
      this._afterHit(attacker, defender);
    }
  }

  _spawnProjectile(attacker, special) {
    const w = attacker.weapon;
    const dir = attacker.facing;
    const tex = w.key === 'bomb' ? 'proj_bomb' : 'proj_cannonball';
    const px = attacker.x + dir * 50;
    const py = attacker.y - 90;
    const proj = this.physics.add.image(px, py, tex).setDepth(40);
    proj.body.setAllowGravity(true);
    proj.body.setGravityY((w.projGravity || 700) - 1500); // компенсираме глобалната гравитация
    proj.setVelocity(dir * w.projSpeed, -260);
    proj.setAngularVelocity(dir * 480);
    proj._weapon = w; proj._special = special; proj._owner = attacker; proj._dir = dir;
    proj._born = this.time.now;
    this.projectiles.push(proj);
    // дим следа
    this.smokeEmitter.emitParticleAt(px, py, 2);
  }

  _afterHit(attacker, defender) {
    // комбо HUD само за играча
    if (attacker === this.hero && attacker.comboCount >= 2) {
      this.comboText.setText(`КОМБО x${attacker.comboCount}!`).setAlpha(1).setScale(0.6);
      this.tweens.add({ targets: this.comboText, scale: 1.1, alpha: 0, duration: 700, ease: 'Cubic.out' });
    }
  }

  _explode(x, y, w, owner, special) {
    this._impact(x, y, true);
    this._shake(0.03, 280);
    const flash = this.add.image(x, y, 'px_glow').setTint(0xff7020)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(58).setScale(2.4);
    this.tweens.add({ targets: flash, scale: 0, alpha: 0, duration: 360, onComplete: () => flash.destroy() });
    // площна щета
    const target = owner === this.hero ? this.enemy : this.hero;
    const d = Math.hypot(target.x - x, (target.y - 60) - y);
    if (d < (w.splash || 60)) {
      const dir = target.x >= x ? 1 : -1;
      let dmg = w.damage; if (special) dmg = Math.round(dmg * 1.6);
      target.takeHit(dmg, dir, w.knockback, this.time.now);
    }
  }

  // ---------------------------------------------------------------- loop
  update(time, delta) {
    if (this.over) return;
    const now = time;

    // --- управление на героя ---
    const h = this.hero;
    if (!h.dead) {
      let vx = 0;
      const left = this.keys.left.isDown || this.keys.altLeft.isDown || this.touch.left;
      const right = this.keys.right.isDown || this.keys.altRight.isDown || this.touch.right;
      if (left) { vx = -300; h.setFacing(-1); }
      else if (right) { vx = 300; h.setFacing(1); }
      h.body.setVelocityX(vx);
      h.setWalking(vx !== 0 && h.root.y >= this.groundY - 4);

      if (Phaser.Input.Keyboard.JustDown(this.keys.attack)) this._heroAttack(this.keys.special.isDown);
      if (Phaser.Input.Keyboard.JustDown(this.keys.jump)) this._heroJump();
      // смяна на оръжие с цифри
      ['w1', 'w2', 'w3', 'w4', 'w5'].forEach((k, i) => {
        if (Phaser.Input.Keyboard.JustDown(this.keys[k]) && this.heroArsenal[i]) {
          h.setWeapon(this.heroArsenal[i]); this._highlightWeapon(this.heroArsenal[i]);
        }
      });
      // героят гледа към противника, ако не се движи
      if (vx === 0) h.setFacing(this.enemy.x >= h.x ? 1 : -1);
    }

    // --- AI ---
    this.ai.update(now, delta);

    // --- синхрон физика/визуал + граници ---
    [this.hero, this.enemy].forEach(t => {
      t.body.x = Phaser.Math.Clamp(t.body.x, 60, GAME_W - 60);
      t.syncToBody(this.groundY);
    });
    // ореол следва титана
    this.hero.glow.setPosition(0, -40);
    this.enemy.glow.setPosition(0, -40);

    // --- снаряди ---
    this._updateProjectiles(now);

    // --- HUD ---
    this._updateBar(this.heroBar, this.hero.hp / this.hero.maxHp);
    this._updateBar(this.enemyBar, this.enemy.hp / this.enemy.maxHp);

    // --- край ---
    if (this.enemy.dead) this._finish(true);
    else if (this.hero.dead) this._finish(false);
  }

  _updateProjectiles(now) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.active) { this.projectiles.splice(i, 1); continue; }
      this.smokeEmitter.emitParticleAt(p.x, p.y, 1);
      const target = p._owner === this.hero ? this.enemy : this.hero;

      let hit = false;
      // удар в цел
      if (!target.dead && Math.hypot(target.x - p.x, (target.y - 70) - p.y) < 60) hit = true;
      // удар в земята
      if (p.y >= this.groundY - 6) hit = true;
      // извън екран / твърде стар
      if (p.x < -40 || p.x > GAME_W + 40 || now - p._born > 4000) hit = true;

      if (hit) {
        if (p._weapon.key === 'bomb') {
          this._explode(p.x, p.y, p._weapon, p._owner, p._special);
        } else if (!target.dead && Math.hypot(target.x - p.x, (target.y - 70) - p.y) < 70) {
          const dir = target.x >= p.x ? 1 : -1;
          let dmg = p._weapon.damage; if (p._special) dmg = Math.round(dmg * 1.6);
          target.takeHit(dmg, dir, p._weapon.knockback, now);
          this._impact(p.x, p.y, true); this._shake(0.018, 160);
        } else {
          this._impact(p.x, p.y, false);
        }
        p.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- end states
  _announce(text, dur) {
    const t = titleText(this, GAME_W / 2, GAME_H / 2 - 40, text, 56, THEME.primaryHex).setDepth(200);
    t.setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 300, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, duration: 300, delay: dur, onComplete: () => t.destroy() });
  }

  _finish(win) {
    if (this.over) return;
    this.over = true;
    this._shake(0.02, 400);

    // отключване на следващото ниво при победа
    if (win) {
      const cur = this.registry.get('unlockedLevel') || 1;
      const next = Math.min(TOTAL_LEVELS, Math.max(cur, this.level.id + 1));
      this.registry.set('unlockedLevel', next);
      try { localStorage.setItem('tf_unlocked', String(next)); } catch (e) {}
    }

    this.time.delayedCall(700, () => {
      // затъмняващ панел
      const overlay = this.add.graphics().setDepth(190);
      overlay.fillStyle(0x000000, 0.7); overlay.fillRect(0, 0, GAME_W, GAME_H);

      const isLast = win && this.level.id === TOTAL_LEVELS;
      const big = isLast ? 'ПОБЕДА!\nТИ СИ ШАМПИОН' : (win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ');
      titleText(this, GAME_W / 2, GAME_H / 2 - 90, big,
        isLast ? 48 : 64, win ? THEME.goodHex : THEME.dangerHex).setDepth(200);

      if (win && !isLast) {
        titleText(this, GAME_W / 2, GAME_H / 2 - 20,
          `Отключено ниво ${this.level.id + 1}!`, 22, THEME.accentHex).setDepth(200);
      }

      // бутони
      const by = GAME_H / 2 + 70;
      if (win && !isLast) {
        makeButton(this, GAME_W / 2 - 150, by, 270, 60, 'СЛЕДВАЩО НИВО ▶', () => {
          this.registry.set('pendingLevel', this.level.id + 1);
          this.scene.start('weapon-select');
        }, { color: THEME.good });
      } else {
        makeButton(this, GAME_W / 2 - 150, by, 270, 60, win ? 'ПАК ▶' : 'ОПИТАЙ ПАК', () => {
          this.scene.restart();
        }, { color: THEME.primary });
      }
      makeButton(this, GAME_W / 2 + 150, by, 270, 60, 'МЕНЮ', () => {
        this.scene.start('menu');
      }, { color: 0x666 });
    });
  }

  shutdown() {
    this.hero && this.hero.destroy();
    this.enemy && this.enemy.destroy();
    this.projectiles.forEach(p => p.destroy && p.destroy());
    this.projectiles = [];
  }
}
