import Phaser from 'phaser';
import { THEME } from '../theme.js';
import { getLevel, HERO_BASE_HP, TOTAL_LEVELS } from '../levels.js';
import { WEAPONS, unlockedWeapons } from '../weapons.js';
import { Titan } from '../entities/titan.js';
import { EnemyAI } from '../ai.js';
import { buildArena } from '../backgrounds.js';
import { makeButton, titleText, promptName } from '../ui.js';
import { addScore, lastName } from '../leaderboard.js';

// Главната бойна сцена.
export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  init(data) {
    this.levelId = data.level || 1;
    this.heroWeapon = data.weapon || 'fists';
  }

  // Текущ размер на екрана (живо).
  _size() { return this.scale.gameSize; }

  create() {
    const { width: W, height: H } = this._size();
    this.level = getLevel(this.levelId);
    this.over = false;

    // Бойната линия (земята). В портрет я вдигаме нагоре, за да стоят титаните
    // НАД сензорните контроли (иначе се крият зад бутоните долу).
    const portrait = H > W;
    this.groundY = portrait ? Math.round(H * 0.60) : Math.round(H - Math.max(70, H * 0.14));
    const arena = buildArena(this, this.level.arena, this.groundY);

    // --- ТИТАНИ ---
    // Раздалечени към двата края на екрана.
    const heroX = Math.round(W * 0.20);
    const enemyX = Math.round(W * 0.80);
    const heroHp = HERO_BASE_HP + this.level.heroBonusHp;
    this.hero = new Titan(this, heroX, this.groundY, {
      prefix: 'hero', facing: 1, hp: heroHp, color: THEME.heroBody, weapon: this.heroWeapon
    });
    this.enemy = new Titan(this, enemyX, this.groundY, {
      prefix: 'enemy', facing: -1, hp: this.level.hp, color: this.level.arena.accent,
      weapon: this.level.weapons[0]
    });

    this.ai = new EnemyAI(this, this.enemy, this.hero, this.level);

    // снаряди
    this.projectiles = [];

    // --- ЧАСТИЦИ ---
    this._setupParticles();

    // --- HUD + КОНТРОЛИ ---
    this.hudItems = [];
    this._buildHUD();
    this._setupControls();

    // intro
    this._announce(`НИВО ${this.level.id}\n${this.level.name}`, 1400);

    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Преоразмеряване: пренареждаме HUD и контролите без да прекъсваме боя.
    this.scale.on('resize', this._relayout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._relayout, this));
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
    const flash = this.add.image(x, y, 'px_glow').setTint(THEME.accent)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(58).setScale(big ? 1.6 : 0.9);
    this.tweens.add({ targets: flash, scale: 0, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
  }

  _shake(intensity, dur) {
    this.cameras.main.shake(dur || 120, intensity || 0.008);
  }

  // ---------------------------------------------------------------- HUD
  _buildHUD() {
    const { width: W } = this._size();
    // здравни ленти
    this.heroBar = this._healthBar(30, 26, false, 'ТИ');
    this.enemyBar = this._healthBar(W - 30, 26, true, this.level.name);

    // индикатор за ниво (по средата горе)
    this.levelLabel = titleText(this, W / 2, 30, `НИВО ${this.level.id}/${TOTAL_LEVELS}`, 20, THEME.accentHex)
      .setDepth(100);

    // комбо текст
    this.comboText = this.add.text(W / 2, 96, '', {
      fontFamily: 'system-ui', fontSize: '34px', color: THEME.accentHex, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100).setAlpha(0);

    // --- БУТОН ИЗХОД (ясно видим, горе вляво) ---
    this.exitBtn = makeButton(this, 88, 78, 132, 46, '✕ ИЗХОД', () => {
      this.scene.start('menu');
    }, { color: THEME.danger, fontSize: '18px' });
    this.exitBtn.setDepth(130);
  }

  _healthBar(x, y, mirror, label) {
    const w = Math.min(380, this._size().width * 0.40), h = 26;
    const cont = this.add.container(mirror ? x - w : x, y).setDepth(100);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5); bg.fillRoundedRect(0, 0, w, h, 8);
    bg.lineStyle(2, 0xffffff, 0.5); bg.strokeRoundedRect(0, 0, w, h, 8);
    const fill = this.add.graphics();
    const lbl = this.add.text(mirror ? w - 6 : 6, h + 4, label, {
      fontFamily: 'system-ui', fontSize: '16px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(mirror ? 1 : 0, 0);
    lbl.setShadow(0, 2, '#000', 4);
    cont.add([bg, fill, lbl]);
    cont._w = w; cont._h = h; cont._fill = fill; cont._mirror = mirror;
    cont._x = mirror ? x - w : x; cont._y = y;
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
      attack: 'SPACE', jump: 'W', altJump: 'UP', special: 'SHIFT',
      w1: 'ONE', w2: 'TWO', w3: 'THREE', w4: 'FOUR', w5: 'FIVE'
    });

    // Състояние на сензорните бутони за движение (държане).
    this.touch = { left: false, right: false };

    // Сензорни бутони (за телефон).
    this.controlButtons = [];
    this._touchButtons();

    // Лента за смяна на оръжие (само отключените)
    this._weaponSwitchBar();
  }

  // Светъл, контрастен кръгъл бутон. Поддържа задържане (за движение) и
  // мигновено действие (за удар/скок). Multi-touch е включен в config-а, така
  // че няколко бутона могат да са натиснати ЕДНОВРЕМЕННО.
  _circleButton(x, y, r, label, color, opts = {}) {
    const c = this.add.container(x, y).setDepth(120);
    const g = this.add.graphics();
    const drawn = (pressed) => {
      g.clear();
      // светъл пълнеж за добра видимост (преди беше твърде тъмно)
      g.fillStyle(0xffffff, pressed ? 0.30 : 0.16);
      g.fillCircle(0, 0, r);
      g.fillStyle(color, pressed ? 0.85 : 0.6);
      g.fillCircle(0, 0, r);
      g.lineStyle(4, 0xffffff, pressed ? 1 : 0.85);
      g.strokeCircle(0, 0, r);
    };
    drawn(false);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'system-ui', fontSize: (r * 0.8) + 'px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    t.setShadow(0, 2, '#000', 4);
    c.add([g, t]);
    c.setSize(r * 2, r * 2);
    // ВАЖНО: за интерактивен Container кръгъл hit-area (Phaser.Geom.Circle) НЕ
    // регистрира докосвания (потвърдено с тест) — затова ползваме правоъгълна
    // (квадратна) зона около кръга. Това беше причината бутоните да "не правят
    // нищо". Квадратната зона е и по-удобна за палеца.
    c.setInteractive(new Phaser.Geom.Rectangle(-r, -r, r * 2, r * 2), Phaser.Geom.Rectangle.Contains);
    c._draw = drawn;
    c._radius = r;
    c._color = color;
    this.controlButtons.push(c);
    return c;
  }

  _touchButtons() {
    const { width: W, height: H } = this._size();
    // Радиусите се събират в наличната ширина без застъпване дори на тесни телефони.
    const rMove = Phaser.Math.Clamp(W * 0.066, 38, 58);
    const rAtk = rMove + 8;
    const gap = 14;             // разстояние между съседни бутони
    const edge = 22;            // отстъп от ръба
    const by = H - Math.max(86, rAtk + 40);

    // --- ДВИЖЕНИЕ (долу вляво): ◀ и ▶ един до друг, без застъпване ---
    const lx = edge + rMove;
    const rx = lx + rMove * 2 + gap;
    const lb = this._circleButton(lx, by, rMove, '◀', THEME.primary);
    const rb = this._circleButton(rx, by, rMove, '▶', THEME.primary);
    lb._role = 'left'; rb._role = 'right';
    lb.on('pointerdown', () => { this.touch.left = true; lb._draw(true); });
    lb.on('pointerup', () => { this.touch.left = false; lb._draw(false); });
    lb.on('pointerout', () => { this.touch.left = false; lb._draw(false); });
    rb.on('pointerdown', () => { this.touch.right = true; rb._draw(true); });
    rb.on('pointerup', () => { this.touch.right = false; rb._draw(false); });
    rb.on('pointerout', () => { this.touch.right = false; rb._draw(false); });

    // --- ДЕЙСТВИЕ (долу вдясно): голяма ⚔ атака, ⤒ скок вляво от нея,
    //     ★ специален над атаката. Подредени така че да НЕ се застъпват. ---
    const ax = W - edge - rAtk;
    const atk = this._circleButton(ax, by, rAtk, '⚔', THEME.danger);
    atk._role = 'attack';
    atk.on('pointerdown', () => { atk._draw(true); this._heroAttack(false); });
    atk.on('pointerup', () => atk._draw(false));
    atk.on('pointerout', () => atk._draw(false));

    const jx = ax - rAtk - rMove - gap;
    const jmp = this._circleButton(jx, by, rMove, '⤒', THEME.good);
    jmp._role = 'jump';
    jmp.on('pointerdown', () => { jmp._draw(true); this._heroJump(); });
    jmp.on('pointerup', () => jmp._draw(false));
    jmp.on('pointerout', () => jmp._draw(false));

    const sy = by - rAtk - rMove - gap;
    const spc = this._circleButton(ax, sy, rMove, '★', THEME.accent);
    spc._role = 'special';
    spc.on('pointerdown', () => { spc._draw(true); this._heroAttack(true); });
    spc.on('pointerup', () => spc._draw(false));
    spc.on('pointerout', () => spc._draw(false));
  }

  _weaponSwitchBar() {
    const { width: W, height: H } = this._size();
    const unlockedLevel = this.registry.get('unlockedLevel') || 1;
    this.heroArsenal = unlockedWeapons(unlockedLevel);
    const spacing = Math.min(74, W / (this.heroArsenal.length + 1));
    const startX = W / 2 - ((this.heroArsenal.length - 1) * spacing) / 2;
    const y = H - 28;
    this.weaponBtns = [];
    this.heroArsenal.forEach((key, i) => {
      const w = WEAPONS[key];
      const btn = makeButton(this, startX + i * spacing, y, spacing - 8, 36, w.name.slice(0, 4), () => {
        this.hero.setWeapon(key);
        this._highlightWeapon(key);
      }, { color: key === this.heroWeapon ? THEME.accent : 0x88a0c0, fontSize: '12px' });
      btn._key = key;
      btn.setDepth(118);
      this.weaponBtns.push(btn);
    });
    this._highlightWeapon(this.heroWeapon);
  }

  // Пренарежда HUD/контролите при преоразмеряване (без рестарт на боя).
  _relayout() {
    [this.heroBar, this.enemyBar, this.levelLabel, this.comboText, this.exitBtn]
      .forEach(o => o && o.destroy());
    this.controlButtons.forEach(b => b.destroy());
    this.weaponBtns.forEach(b => b.destroy());
    this.controlButtons = [];
    this._buildHUD();
    this._touchButtons();
    this._weaponSwitchBar();
  }

  _highlightWeapon(key) {
    this.weaponBtns.forEach(b => b.alpha = b._key === key ? 1 : 0.6);
  }

  _heroJump() {
    if (this.hero.dead || this.over) return;
    if (this.hero.root.y >= this.groundY - 2) this.hero.body.setVelocityY(-780);
  }

  _heroAttack(special) {
    if (this.hero.dead || this.over) return;
    const now = this.time.now;
    this.hero.attack(now, () => this.resolveAttack(this.hero, this.enemy, special, now));
  }

  // ---------------------------------------------------------------- combat
  resolveAttack(attacker, defender, special, now) {
    const w = attacker.weapon;
    if (w.type === 'throw') {
      this._spawnProjectile(attacker, special);
      return;
    }
    const reachPt = attacker.getReachPoint();
    const dist = Math.abs(defender.x - attacker.x);
    if (dist <= w.reach && Math.abs(defender.y - attacker.y) < 200) {
      const dir = defender.x >= attacker.x ? 1 : -1;
      let dmg = w.damage;
      if (special) dmg = Math.round(dmg * 1.8);
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
    const px = attacker.x + dir * 60;
    const py = attacker.y - 150;
    const proj = this.physics.add.image(px, py, tex).setDepth(40).setScale(1.4);
    proj.body.setAllowGravity(true);
    proj.body.setGravityY((w.projGravity || 700) - 1500);
    proj.setVelocity(dir * w.projSpeed, -260);
    proj.setAngularVelocity(dir * 480);
    proj._weapon = w; proj._special = special; proj._owner = attacker; proj._dir = dir;
    proj._born = this.time.now;
    this.projectiles.push(proj);
    this.smokeEmitter.emitParticleAt(px, py, 2);
  }

  _afterHit(attacker, defender) {
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
    const target = owner === this.hero ? this.enemy : this.hero;
    const d = Math.hypot(target.x - x, (target.y - 100) - y);
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
    const { width: W } = this._size();

    // --- управление на героя ---
    const h = this.hero;
    if (!h.dead) {
      let vx = 0;
      const left = this.keys.left.isDown || this.keys.altLeft.isDown || this.touch.left;
      const right = this.keys.right.isDown || this.keys.altRight.isDown || this.touch.right;
      if (left && !right) { vx = -320; h.setFacing(-1); }
      else if (right && !left) { vx = 320; h.setFacing(1); }
      h.body.setVelocityX(vx);
      h.setWalking(vx !== 0 && h.root.y >= this.groundY - 4);

      if (Phaser.Input.Keyboard.JustDown(this.keys.attack)) this._heroAttack(this.keys.special.isDown);
      if (Phaser.Input.Keyboard.JustDown(this.keys.jump) || Phaser.Input.Keyboard.JustDown(this.keys.altJump)) this._heroJump();
      ['w1', 'w2', 'w3', 'w4', 'w5'].forEach((k, i) => {
        if (Phaser.Input.Keyboard.JustDown(this.keys[k]) && this.heroArsenal[i]) {
          h.setWeapon(this.heroArsenal[i]); this._highlightWeapon(this.heroArsenal[i]);
        }
      });
      if (vx === 0) h.setFacing(this.enemy.x >= h.x ? 1 : -1);
    }

    // --- AI ---
    this.ai.update(now, delta);

    // --- синхрон физика/визуал + граници ---
    [this.hero, this.enemy].forEach(t => {
      t.body.x = Phaser.Math.Clamp(t.body.x, 70, W - 70);
      t.syncToBody(this.groundY);
    });
    this.hero.glow.setPosition(0, -90);
    this.enemy.glow.setPosition(0, -90);

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
    const { width: W } = this._size();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.active) { this.projectiles.splice(i, 1); continue; }
      this.smokeEmitter.emitParticleAt(p.x, p.y, 1);
      const target = p._owner === this.hero ? this.enemy : this.hero;

      let hit = false;
      if (!target.dead && Math.hypot(target.x - p.x, (target.y - 120) - p.y) < 80) hit = true;
      if (p.y >= this.groundY - 6) hit = true;
      if (p.x < -40 || p.x > W + 40 || now - p._born > 4000) hit = true;

      if (hit) {
        if (p._weapon.key === 'bomb') {
          this._explode(p.x, p.y, p._weapon, p._owner, p._special);
        } else if (!target.dead && Math.hypot(target.x - p.x, (target.y - 120) - p.y) < 90) {
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
    const { width: W, height: H } = this._size();
    const t = titleText(this, W / 2, H / 2 - 40, text, 56, THEME.primaryHex).setDepth(200);
    t.setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 300, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, duration: 300, delay: dur, onComplete: () => t.destroy() });
  }

  // Точки за ранг листата.
  // Награждаваме напредъка по нива (основен дял), плюс бонус при победа и
  // оставащ живот на героя. Така по-високите нива и чистите победи водят.
  _computeScore(win) {
    const remainHp = Math.max(0, Math.round(this.hero.hp));
    const levelScore = (win ? this.level.id : this.level.id - 1) * 1000;
    const winBonus = win ? 500 : 0;
    return Math.max(0, levelScore + winBonus + remainHp * 5);
  }

  _finish(win) {
    if (this.over) return;
    this.over = true;
    this._shake(0.02, 400);
    const { width: W, height: H } = this._size();

    if (win) {
      const cur = this.registry.get('unlockedLevel') || 1;
      const next = Math.min(TOTAL_LEVELS, Math.max(cur, this.level.id + 1));
      this.registry.set('unlockedLevel', next);
      try { localStorage.setItem('tf_unlocked', String(next)); } catch (e) {}
    }

    // Изчисляваме точките за този бой (за ранг листата).
    this._finalScore = this._computeScore(win);

    this.time.delayedCall(700, () => {
      const overlay = this.add.graphics().setDepth(190);
      overlay.fillStyle(0x000000, 0.7); overlay.fillRect(0, 0, W, H);

      const isLast = win && this.level.id === TOTAL_LEVELS;
      const big = isLast ? 'ПОБЕДА!\nТИ СИ ШАМПИОН' : (win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ');
      titleText(this, W / 2, H / 2 - 130, big,
        isLast ? 48 : 64, win ? THEME.goodHex : THEME.dangerHex).setDepth(200);

      if (win && !isLast) {
        titleText(this, W / 2, H / 2 - 62,
          `Отключено ниво ${this.level.id + 1}!`, 22, THEME.accentHex).setDepth(200);
      }

      // Точки за този бой.
      titleText(this, W / 2, H / 2 - 24,
        `ТОЧКИ: ${this._finalScore}`, 26, '#ffffff').setDepth(200);

      const by = H / 2 + 50;
      const by2 = H / 2 + 124;
      if (win && !isLast) {
        makeButton(this, W / 2 - 150, by, 270, 58, 'СЛЕДВАЩО НИВО ▶', () => {
          this.registry.set('pendingLevel', this.level.id + 1);
          this.scene.start('weapon-select');
        }, { color: THEME.good }).setDepth(200);
      } else {
        makeButton(this, W / 2 - 150, by, 270, 58, win ? 'ПАК ▶' : 'ОПИТАЙ ПАК', () => {
          this.scene.restart();
        }, { color: THEME.primary }).setDepth(200);
      }
      makeButton(this, W / 2 + 150, by, 270, 58, 'МЕНЮ', () => {
        this.scene.start('menu');
      }, { color: 0x88a0c0 }).setDepth(200);

      // Бутон „🏆 ЗАПИШИ РЕЗУЛТАТА" — отваря поле за име, записва и показва листата.
      const saveBtn = makeButton(this, W / 2, by2, 380, 58, '🏆 ЗАПИШИ РЕЗУЛТАТА', () => {
        saveBtn.setEnabled(false);
        promptName(this, lastName(), (name) => {
          if (name == null) { saveBtn.setEnabled(true); return; } // отказ
          const { rank, total } = addScore(name, this._finalScore);
          const headline = rank > 0 ? `Ти си #${rank} от ${total}` : `Извън ТОП 100 (${total})`;
          this.scene.start('leaderboard', {
            highlightName: String(name).slice(0, 24).trim() || 'Играч',
            highlightScore: this._finalScore,
            headline
          });
        });
      }, { color: THEME.accent }).setDepth(200);
    });
  }

  shutdown() {
    this.hero && this.hero.destroy();
    this.enemy && this.enemy.destroy();
    this.projectiles.forEach(p => p.destroy && p.destroy());
    this.projectiles = [];
  }
}
