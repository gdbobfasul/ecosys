// Игрова сцена: построява ниво, управлява спавн на цели, стрелба (hitscan +
// проектили), HUD, лимити време/боеприпаси, точки и преход към следващо ниво.
import * as THREE from 'three';
import { applyAtmosphere } from '../engine/setup.js';
import { Terrain } from '../terrain.js';
import { Target } from '../targets.js';
import { generateLevel } from '../level-generator.js';
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
      left: this.config.count,
      time: Math.ceil(this.timeLeft),
      ammo: this.ammo
    });
    this.hud.toast(tf('level_toast', this.config.level, targetName(this.config.target)));
  }

  _spawnTarget() {
    if (this.spawned >= this.config.count) return;
    const aliveCount = this.targets.filter((t) => t.alive).length;
    if (aliveCount >= this.config.maxAlive) return;
    const t = new Target(this.engine.scene, this.terrain, this.config);
    this.targets.push(t);
    this.spawned++;
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
    this.hud.set({ score: this.score, left: Math.max(0, this.config.count - this.killed) });
  }

  update(dt) {
    if (this.ended) return;
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

    // Огън
    if (this.controls.consumeFire()) this._fire();

    // Таймер
    this.timeLeft -= dt;
    this.hud.set({ time: Math.max(0, Math.ceil(this.timeLeft)) });

    // Край на нивото
    if (this.killed >= this.config.count) {
      this._end(true);
    } else if (this.timeLeft <= 0) {
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
    if (this.effects) this.effects.clear();
    if (this.terrain) { this.terrain.dispose(); this.terrain = null; }
  }
}
