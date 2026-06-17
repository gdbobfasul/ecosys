// Цели: нискополигонални модели от Three примитиви + поведение по тип.
// Всеки тип има собствено движение (наземно бягане, пълзене, летене, статично).
import * as THREE from 'three';

const mat = (color, flat = true) => new THREE.MeshLambertMaterial({ color, flatShading: flat });

// --- Конструктори на модели (нискополигонални) ---

function buildQuadruped(bodyColor, size = 1) {
  // общ модел за сърна/елен/глиган/вълк/заек — варира по мащаб/цвят
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4 * size, 0.8 * size, 0.7 * size), mat(bodyColor));
  body.position.y = 0.9 * size;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * size, 0.5 * size, 0.45 * size), mat(bodyColor));
  head.position.set(0.85 * size, 1.15 * size, 0);
  g.add(head);
  const legGeo = new THREE.CylinderGeometry(0.08 * size, 0.08 * size, 0.9 * size, 5);
  const legMat = mat(0x3a2a18);
  [[0.5, 0.3], [0.5, -0.3], [-0.5, 0.3], [-0.5, -0.3]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x * size, 0.45 * size, z * size);
    g.add(leg);
  });
  return g;
}

function buildDeer(color, antlers, size) {
  const g = buildQuadruped(color, size);
  if (antlers) {
    const am = mat(0x8a6a3a);
    [-1, 1].forEach((s) => {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.06 * size, 0.6 * size, 4), am);
      a.position.set(0.9 * size, 1.6 * size, 0.12 * size * s);
      a.rotation.z = -0.3 * s;
      g.add(a);
    });
  }
  return g;
}

function buildSnake() {
  const g = new THREE.Group();
  const segMat = mat(0x4b7a2e);
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.18 - i * 0.015, 8, 6), segMat);
    seg.position.set(i * 0.28, 0.2, 0);
    g.add(seg);
  }
  return g;
}

function buildGnome() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.7, 8), mat(0x2e5db0));
  body.position.y = 0.55; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xe8c39a));
  head.position.y = 1.0; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 8), mat(0xcc3333));
  hat.position.y = 1.35; g.add(hat);
  return g;
}

function buildSoldier() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.3), mat(0x4a5d3a));
  body.position.y = 1.0; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xc9a07a));
  head.position.y = 1.65; g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3a4630));
  helmet.position.y = 1.72; g.add(helmet);
  const legGeo = new THREE.BoxGeometry(0.18, 0.7, 0.2);
  [-0.13, 0.13].forEach((x) => {
    const leg = new THREE.Mesh(legGeo, mat(0x3a4630));
    leg.position.set(x, 0.35, 0); g.add(leg);
  });
  return g;
}

function buildTank() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.6), mat(0x5a6a3a));
  hull.position.y = 0.6; g.add(hull);
  const turret = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.0), mat(0x4a5a30));
  turret.position.y = 1.1; g.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8), mat(0x333));
  barrel.rotation.z = Math.PI / 2; barrel.position.set(1.0, 1.1, 0); g.add(barrel);
  [-0.7, 0.7].forEach((z) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.3), mat(0x222));
    track.position.set(0, 0.25, z); g.add(track);
  });
  return g;
}

function buildPlane() {
  const g = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 3.2, 10), mat(0x9aa3ad));
  fus.rotation.z = Math.PI / 2; g.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 4.0), mat(0x7d868f));
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.1), mat(0x7d868f));
  tail.position.set(-1.4, 0.4, 0); g.add(tail);
  return g;
}

function buildScarecrow() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), mat(0x6b4a26));
  pole.position.y = 0.9; g.add(pole);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), mat(0x6b4a26));
  arms.position.y = 1.3; g.add(arms);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xc9b06a));
  head.position.y = 1.7; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 8), mat(0x4a3a20));
  hat.position.y = 1.95; g.add(hat);
  return g;
}

function buildBalloon() {
  const g = new THREE.Group();
  const colors = [0xff5252, 0xffeb3b, 0x42a5f5, 0x66bb6a];
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat(colors[(Math.random() * 4) | 0]));
  b.scale.y = 1.25; g.add(b);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 6), mat(0x999));
  knot.position.y = -0.6; g.add(knot);
  return g;
}

// Профил по тип цел: фабрика на модел + параметри на движение.
const PROFILES = {
  rabbit:    { make: () => buildQuadruped(0xb9a48a, 0.45), move: 'ground', scale: 1, hop: true, fly: false },
  roe_deer:  { make: () => buildDeer(0xb07a3c, false, 0.9), move: 'ground', fly: false },
  red_deer:  { make: () => buildDeer(0x8a5a2a, true, 1.1), move: 'ground', fly: false },
  elk:       { make: () => buildDeer(0x6b4a2a, true, 1.3), move: 'ground', fly: false },
  boar:      { make: () => buildQuadruped(0x4a3a2a, 0.95), move: 'ground', fly: false },
  wolf:      { make: () => buildQuadruped(0x777777, 0.85), move: 'ground', fly: false },
  snake:     { make: () => buildSnake(), move: 'ground', fly: false, low: true },
  gnome:     { make: () => buildGnome(), move: 'ground', fly: false },
  soldier:   { make: () => buildSoldier(), move: 'ground', fly: false },
  scarecrow: { make: () => buildScarecrow(), move: 'static', fly: false },
  tank:      { make: () => buildTank(), move: 'ground', fly: false, slow: 0.5 },
  plane:     { make: () => buildPlane(), move: 'air', fly: true },
  balloon:   { make: () => buildBalloon(), move: 'air', fly: true, drift: true }
};

let _id = 0;

// Една цел: модел + логика на движение спрямо конфигурацията на нивото.
export class Target {
  constructor(scene, terrain, config) {
    this.scene = scene;
    this.terrain = terrain;
    this.config = config;
    this.type = config.target;
    this.alive = true;
    this.uid = ++_id;

    const profile = PROFILES[this.type] || PROFILES.roe_deer;
    this.profile = profile;
    this.mesh = profile.make();
    this.mesh.userData.target = this; // за raycast обратна връзка

    this._spawn();
    scene.add(this.mesh);
  }

  _spawn() {
    const R = 120; // радиус на спавн около играча
    const ang = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * R;
    this.x = Math.cos(ang) * dist;
    this.z = Math.sin(ang) * dist;
    this.heading = Math.random() * Math.PI * 2;
    this.turnTimer = 0;

    if (this.profile.move === 'air') {
      this.y = 30 + Math.random() * 40;
    } else {
      this.y = this.terrain.heightAt(this.x, this.z);
    }
    this._apply();
  }

  _apply() {
    let yOff = 0;
    if (this.profile.low) yOff = 0;
    this.mesh.position.set(this.x, this.y + yOff, this.z);
    this.mesh.rotation.y = -this.heading + Math.PI / 2;
  }

  // Радиус за hit detection (по-голям за големи цели).
  get hitRadius() {
    if (this.type === 'tank') return 2.5;
    if (this.type === 'plane') return 3.0;
    if (this.type === 'rabbit' || this.type === 'snake') return 0.6;
    return 1.2;
  }

  update(dt, playerPos) {
    if (!this.alive) return;
    const c = this.config;
    const move = this.profile.move;
    if (move === 'static') return;

    // Смяна на посока спрямо уклончивост.
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      this.turnTimer = 0.5 + Math.random() * (2.5 - c.evasiveness * 2);
      const flee = Math.atan2(this.z - playerPos.z, this.x - playerPos.x);
      // Смес от бягство от играча и случайно лъкатушене.
      this.heading = flee + (Math.random() - 0.5) * (1 - c.evasiveness) * 3;
    }

    let spd = c.speed * (this.profile.slow || 1);
    if (move === 'air') spd *= 1.4;

    this.x += Math.cos(this.heading) * spd * dt;
    this.z += Math.sin(this.heading) * spd * dt;

    // Държим целта в границите на терена (обръщане при ръба).
    const lim = 180;
    if (Math.abs(this.x) > lim || Math.abs(this.z) > lim) {
      this.heading += Math.PI;
      this.x = THREE.MathUtils.clamp(this.x, -lim, lim);
      this.z = THREE.MathUtils.clamp(this.z, -lim, lim);
    }

    if (move === 'ground') {
      this.y = this.terrain.heightAt(this.x, this.z);
      if (this.profile.hop) {
        this.y += Math.abs(Math.sin(performance.now() * 0.008)) * 0.4; // подскачане на заек
      }
    } else if (move === 'air') {
      if (this.profile.drift) this.y += Math.sin(performance.now() * 0.001 + this.uid) * 0.02;
    }
    this._apply();
  }

  kill() {
    this.alive = false;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
