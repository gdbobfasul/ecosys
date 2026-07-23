// Version: 1.0013
// Игрова сцена: построява ниво, управлява спавн на цели, стрелба (hitscan +
// проектили), HUD (вкл. минимапа-радар), лимити време/боеприпаси, точки и преход към следващо ниво.
// Из нивото се пръскат 1–2 оръжейни pickup-а: доближиш ли ги, героят СМЕНЯ оръжието (изхвърля
// текущото) и получава боезапас за новото. Всяко оръжие поразява всяка цел (само усещането е различно).
import * as THREE from 'three';
import { applyAtmosphere } from '../engine/setup.js';
import { Terrain } from '../terrain.js';
import { Target } from '../targets.js';
import { generateLevel, ammoForWeapon } from '../level-generator.js';
import { WEAPONS } from '../weapons.js';
import { buildViewmodel, muzzleFlash, fadeFlash, EffectsPool } from '../engine/effects.js';
import { t, tf } from '../core/i18n.js';

// Атмосфера по биом.
const ATMO = {
  forest: { skyTop: 0x6fa8d6, skyBottom: 0xcfe3f0, fogColor: 0xbcd0dc, fogNear: 60, fogFar: 320, sunIntensity: 0.9 },
  field:  { skyTop: 0x7cc1ff, skyBottom: 0xeaf4ff, fogColor: 0xdfeaf2, fogNear: 80, fogFar: 360, sunIntensity: 1.0 },
  snow:   { skyTop: 0x9fc2dd, skyBottom: 0xf2f8ff, fogColor: 0xe8f1f8, fogNear: 40, fogFar: 240, sunIntensity: 0.85 },
  desert: { skyTop: 0xe7c98a, skyBottom: 0xfff2d6, fogColor: 0xf0dcae, fogNear: 70, fogFar: 340, sunIntensity: 1.1 },
  hills:  { skyTop: 0x6fa0c8, skyBottom: 0xd6e8f5, fogColor: 0xc7dcea, fogNear: 70, fogFar: 340, sunIntensity: 0.95 },
  marsh:  { skyTop: 0x7d96a0, skyBottom: 0xc2d2d0, fogColor: 0xaebfb8, fogNear: 35, fogFar: 200, sunIntensity: 0.75 },
  urban:  { skyTop: 0x8a93a0, skyBottom: 0xc8cfd8, fogColor: 0xb6bdc6, fogNear: 50, fogFar: 280, sunIntensity: 0.8 }
};

// Името на целта се взима от i18n по ключ tgt_<тип> (преведено на 15 езика).
function targetName(type) {
  return t('tgt_' + type);
}

export class GameScene {
  constructor(engine, controlsFactory, hud, onLevelEnd) {
    this.engine = engine;
    this.controlsFactory = controlsFactory;
    this.hud = hud;
    this.onLevelEnd = onLevelEnd;
    this.effects = new EffectsPool(engine.scene);
    this.raycaster = new THREE.Raycaster();
  }

  start(levelNum, totalScore = 0) {
    this.cleanup();
    this.config = generateLevel(levelNum);
    this.score = totalScore;
    this.levelScore = 0;
    this.spawned = 0;
    this.killed = 0;
    this.ammo = this.config.ammo;
    this.timeLeft = this.config.timeLimit;
    this.spawnTimer = 0;
    this.reloadCd = 0;
    this.targets = [];
    this.ended = false;

    // Терен + атмосфера
    this.terrain = new Terrain(this.engine.scene, this.config.biome, this.config.seed);
    applyAtmosphere(this.engine, ATMO[this.config.biome] || ATMO.field);

    // Камера/играч начална позиция — гарантирано НАД терена (а не вътре/под него).
    const cam = this.engine.camera;
    const groundY = this.terrain.heightAt(0, 0);
    cam.position.set(0, groundY + 1.7, 0);
    // Хоризонтален поглед напред (а не нагоре към небето/надолу в земята).
    cam.quaternion.identity();
    cam.rotation.set(0, 0, 0);

    // Контроли
    this.controls = this.controlsFactory(this.terrain, this.hud);
    this.controls.enabled = true;
    // Подравняваме контролите към текущата ориентация (yaw=0, pitch=0),
    // за да е първият кадър валиден дори преди първия touch/update.
    this.controls.yaw = 0;
    this.controls.pitch = 0;
    this.hud.onFire(() => this.controls.requestFire());

    // Viewmodel на оръжието
    const vm = buildViewmodel(this.config.weapon.key, this.config.weapon.color);
    cam.add(vm);
    this.engine.scene.add(cam);
    this.viewmodel = vm;

    this.hud.set({
      level: this.config.level,
      target: targetName(this.config.target),
      weapon: t('wpn_' + this.config.weapon.key),
      score: this.score,
      // Нива 1–50 (без времеви лимит) са „безкрайни/спокойни" → „останали" показва ∞ (нивото пак
      // приключва при избиване на целите, но броячът не плаши). 51+ показва реалния брой мишени.
      left: this.config.timeLimit > 0 ? this.config.count : '∞',
      time: this.config.timeLimit > 0 ? Math.ceil(this.timeLeft) : '∞',
      ammo: this.ammo
    });
    this.hud.toast(tf('level_toast', this.config.level, targetName(this.config.target))
      + (this.config.timeLimit > 0 ? '' : ' · ' + t('time_nolimit')));

    // Оръжейни pickup-и из нивото (смяна на оръжие при доближаване).
    this._spawnPickups();
    // Обяснение на управлението: насложен екран с двете зони (движение/оглеждане) и бутона
    // ОГЪН — показва се при първите 3 пускания (после играчът вече го знае).
    if (this.hud.showGuide) {
      let seen = 0;
      try { seen = parseInt(localStorage.getItem('fps.guide.seen') || '0', 10) || 0; } catch (e) {}
      if (seen < 3) {
        try { localStorage.setItem('fps.guide.seen', String(seen + 1)); } catch (e) {}
        this.hud.showGuide({
          move: t('guide_move'), look: t('guide_look'), fire: t('guide_fire'),
          desktop: t('guide_desktop'), dismiss: t('guide_dismiss')
        });
      }
    }
  }

  _spawnTarget() {
    if (this.spawned >= this.config.count) return;
    const aliveCount = this.targets.filter((t) => t.alive).length;
    if (aliveCount >= this.config.maxAlive) return;
    const t = new Target(this.engine.scene, this.terrain, this.config);
    this.targets.push(t);
    this.spawned++;
  }

  // Пръска 1–2 оръжейни pickup-а (различни от текущото оръжие) из нивото. Взимането им
  // СМЕНЯ оръжието на героя (изхвърля текущото) и презарежда боезапас за новото.
  _spawnPickups() {
    this.pickups = [];
    const others = Object.keys(WEAPONS).filter((k) => k !== this.config.weapon.key);
    // Разбъркваме (Fisher–Yates), за да не е винаги едно и също оръжие.
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = others[i]; others[i] = others[j]; others[j] = tmp;
    }
    const n = Math.min(2, others.length);
    for (let i = 0; i < n; i++) {
      const key = others[i];
      const ang = Math.random() * Math.PI * 2;
      const rad = 18 + Math.random() * 42;                          // 18–60 м от центъра
      const x = THREE.MathUtils.clamp(Math.cos(ang) * rad, -170, 170);
      const z = THREE.MathUtils.clamp(Math.sin(ang) * rad, -170, 170);
      this.pickups.push({ key, group: this._buildPickup(key, x, z), taken: false });
    }
  }

  // Видим pickup: сандък в цвета на оръжието + ярка сфера и вертикален лъч-маяк (да се засича
  // отдалеч). Върти се в update() за забележимост. Ползва само MeshBasic (без светлини), както играта.
  _buildPickup(weaponKey, x, z) {
    const g = new THREE.Group();
    const color = (WEAPONS[weaponKey] && WEAPONS[weaponKey].color) || 0x888888;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), new THREE.MeshBasicMaterial({ color }));
    crate.position.y = 0.5;
    g.add(crate);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0x66ffff }));
    orb.position.y = 1.3;
    g.add(orb);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 24, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x66ffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 12;
    g.add(beam);
    const gy = this.terrain.heightAt(x, z);
    g.position.set(x, isFinite(gy) ? gy : 0, z);
    this.engine.scene.add(g);
    return g;
  }

  // Смяна на оръжието на героя: изхвърля текущото (viewmodel), слага новото и дава боезапас
  // за него по същата прогресия по нива. Викa се при взимане на pickup.
  _switchWeapon(key) {
    if (!WEAPONS[key]) return;
    if (this.viewmodel) {
      this.engine.camera.remove(this.viewmodel);
      this.viewmodel.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    this.config.weapon = { key, ...WEAPONS[key] };
    const vm = buildViewmodel(key, this.config.weapon.color);
    this.engine.camera.add(vm);
    this.viewmodel = vm;
    this.reloadCd = 0;
    const d = (this.config.level - 1) / 99;
    this.ammo = ammoForWeapon(this.config.level, this.config.weapon, this.config.count, d);
    this.hud.set({ weapon: t('wpn_' + key), ammo: this.ammo });
    this.hud.toast(tf('weapon_picked', t('wpn_' + key)), 1200);
  }

  // Стрелба: hitscan (пушка/пистолет) или проектил (ракета/прашка).
  _fire() {
    if (this.reloadCd > 0) return;
    if (this.ammo <= 0) { this.hud.toast(t('no_ammo'), 800); return; }

    const w = this.config.weapon;
    if (this.ammo !== 999) this.ammo--;
    this.reloadCd = w.reload;
    muzzleFlash(this.viewmodel);
    this.hud.set({ ammo: this.ammo });

    const cam = this.engine.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    // Разсейване
    if (w.spread) {
      dir.x += (Math.random() - 0.5) * w.spread;
      dir.y += (Math.random() - 0.5) * w.spread;
      dir.normalize();
    }

    if (w.mode === 'hitscan') {
      this.raycaster.set(cam.position, dir);
      this.raycaster.far = 400;
      const meshes = this.targets.filter((t) => t.alive).map((t) => t.mesh);
      const hits = this.raycaster.intersectObjects(meshes, true);
      if (hits.length) {
        let obj = hits[0].object;
        while (obj && !obj.userData.target) obj = obj.parent;
        if (obj && obj.userData.target) {
          this._registerKill(obj.userData.target, hits[0].point);
        }
      }
    } else {
      // Проектил: при достигане до радиус на цел -> поражение (+splash).
      const origin = cam.position.clone().addScaledVector(dir, 1.0);
      this.effects.spawnProjectile(origin, dir, w, (pos, splash) => {
        let hit = false;
        for (const t of this.targets) {
          if (!t.alive) continue;
          const d = t.mesh.position.distanceTo(pos);
          if (d < t.hitRadius + (splash || 0) + 0.3) {
            this._registerKill(t, pos);
            hit = true;
            if (!splash) break; // без splash — само първата цел
          }
        }
        return hit;
      });
    }
  }

  _registerKill(target, point) {
    if (!target.alive) return;
    target.kill();
    this.effects.impact(point ? point.clone() : target.mesh.position.clone(), 0xff5533);
    target.dispose();
    this.killed++;
    this.score += this.config.pointsPerTarget;
    this.levelScore += this.config.pointsPerTarget;
    this.hud.set({ score: this.score, left: this.config.timeLimit > 0 ? Math.max(0, this.config.count - this.killed) : '∞' });
  }

  update(dt) {
    // Guard: ако сцената е приключила ИЛИ е разглобена (cleanup() занули controls/config),
    // не прави нищо — главният цикъл може да ни повика между cleanup() и следващия start().
    if (this.ended || !this.controls || !this.config) return;
    this.controls.update(dt);
    fadeFlash(this.viewmodel, dt);
    if (this.reloadCd > 0) this.reloadCd -= dt;

    // Спавн темп
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.config.spawnCadence;
      this._spawnTarget();
    }

    const playerPos = this.engine.camera.position;
    for (const t of this.targets) t.update(dt, playerPos);
    this.effects.update(dt);

    // Оръжейни pickup-и: въртим за видимост + взимане при близост (смяна на оръжие).
    if (this.pickups) {
      for (const pk of this.pickups) {
        if (pk.taken) continue;
        pk.group.rotation.y += dt * 1.5;
        const dx = pk.group.position.x - playerPos.x;
        const dz = pk.group.position.z - playerPos.z;
        if (dx * dx + dz * dz < 6.25) {                 // ~2.5 м радиус на взимане
          pk.taken = true;
          this.engine.scene.remove(pk.group);
          pk.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
          this._switchWeapon(pk.key);
        }
      }
    }

    // Минимапа: играч + живите цели като червени точки (върти се по посоката на гледане).
    if (this.hud.drawMap) this.hud.drawMap(playerPos.x, playerPos.z, this.controls.yaw, this.targets);

    // Огън
    if (this.controls.consumeFire()) this._fire();

    // Таймер: тече САМО ако нивото има лимит (нива 1–50 са без лимит → timeLimit = 0, HUD показва ∞)
    if (this.config.timeLimit > 0) {
      this.timeLeft -= dt;
      this.hud.set({ time: Math.max(0, Math.ceil(this.timeLeft)) });
    }

    // Край на нивото
    if (this.killed >= this.config.count) {
      this._end(true);
    } else if (this.config.timeLimit > 0 && this.timeLeft <= 0) {
      this._end(false);
    } else if (this.ammo === 0 && this.reloadCd <= 0 &&
               this.effects.projectiles.length === 0 &&
               this.config.weapon.mag !== 999) {
      // Свършиха боеприпасите и няма летящи проектили -> провал.
      this._end(false);
    }
  }

  _end(win) {
    if (this.ended) return;
    this.ended = true;
    this.controls.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock?.();
    const allDone = win && this.config.level >= 100;
    this.onLevelEnd({
      win,
      allDone,
      level: this.config.level,
      score: this.score
    });
  }

  cleanup() {
    if (this.controls) { this.controls.dispose(); this.controls = null; }
    if (this.viewmodel) {
      // Махаме viewmodel-а от камерата И освобождаваме геометрии/материали,
      // за да не се трупат при всеки рестарт.
      this.engine.camera.remove(this.viewmodel);
      this.viewmodel.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.viewmodel = null;
    }
    // Камерата се добавя към сцената при start(); махаме я тук, за да е
    // добавянето при следващия start() симетрично и чисто (без двойно водене).
    if (this.engine.camera.parent) this.engine.camera.removeFromParent();
    if (this.targets) { this.targets.forEach((t) => t.dispose()); this.targets = []; }
    // Невзетите оръжейни pickup-и се махат и освобождават (взетите вече са премахнати).
    if (this.pickups) {
      this.pickups.forEach((pk) => {
        if (pk.taken) return;
        this.engine.scene.remove(pk.group);
        pk.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      });
      this.pickups = [];
    }
    if (this.effects) this.effects.clear();
    if (this.terrain) { this.terrain.dispose(); this.terrain = null; }
  }
}
