// Визуални ефекти: viewmodel на оръжието (долу на екрана), дульно проблясване,
// проектили (за ракети/прашка), частици при удар.
import * as THREE from 'three';

// Viewmodel: малък модел, закачен за камерата, видим в долната част на екрана.
export function buildViewmodel(weaponKey, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: color || 0x444444 });

  if (weaponKey === 'rifle' || weaponKey === 'pistol') {
    const len = weaponKey === 'rifle' ? 0.9 : 0.4;
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), m);
    barrel.position.set(0.18, -0.22, -0.5);
    g.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x3a2a18 }));
    stock.position.set(0.18, -0.28, -0.1);
    g.add(stock);
  } else if (weaponKey === 'rocket' || weaponKey === 'missile') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 10), m);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.2, -0.24, -0.5);
    g.add(tube);
  } else if (weaponKey === 'slingshot') {
    const y = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.05), new THREE.MeshBasicMaterial({ color: 0x5b3a1e }));
    y.position.set(0.18, -0.25, -0.45);
    g.add(y);
    [-1, 1].forEach((s) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), new THREE.MeshBasicMaterial({ color: 0x5b3a1e }));
      arm.position.set(0.18 + s * 0.08, -0.1, -0.45);
      arm.rotation.z = s * 0.5;
      g.add(arm);
    });
  }

  // Дульно проблясване (скрито по подразбиране).
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0 })
  );
  flash.position.set(0.18, -0.22, -1.0);
  g.add(flash);
  g.userData.flash = flash;

  g.renderOrder = 999;
  return g;
}

export function muzzleFlash(viewmodel) {
  const f = viewmodel.userData.flash;
  if (!f) return;
  f.material.opacity = 1;
  f.scale.setScalar(1 + Math.random() * 0.6);
}

export function fadeFlash(viewmodel, dt) {
  const f = viewmodel.userData.flash;
  if (f && f.material.opacity > 0) {
    f.material.opacity = Math.max(0, f.material.opacity - dt * 8);
  }
}

// Активни проектили и частици се управляват от прост пул.
export class EffectsPool {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
    this.particles = [];
  }

  spawnProjectile(origin, dir, weapon, onHitTest) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(weapon.key === 'slingshot' ? 0.12 : 0.2, 6, 6),
      new THREE.MeshBasicMaterial({ color: weapon.key === 'slingshot' ? 0x777 : 0xffaa33 })
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      vel: dir.clone().multiplyScalar(weapon.projectileSpeed),
      gravity: weapon.gravity || 0,
      splash: weapon.splash || 0,
      life: 4,
      onHitTest
    });
  }

  impact(pos, color = 0xffaa33) {
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 4, 4),
        new THREE.MeshBasicMaterial({ color })
      );
      p.position.copy(pos);
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, vel: v, life: 0.6 });
    }
  }

  update(dt) {
    // Проектили
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.vel.y -= pr.gravity * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.life -= dt;
      const hit = pr.onHitTest ? pr.onHitTest(pr.mesh.position, pr.splash) : false;
      if (hit || pr.life <= 0 || pr.mesh.position.y < -5) {
        this.impact(pr.mesh.position.clone());
        this.scene.remove(pr.mesh);
        pr.mesh.geometry.dispose(); pr.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
    // Частици
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt;
      p.mesh.material.opacity = Math.max(0, p.life / 0.6);
      p.mesh.material.transparent = true;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose(); p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  clear() {
    [...this.projectiles, ...this.particles].forEach((o) => {
      this.scene.remove(o.mesh);
      o.mesh.geometry.dispose(); o.mesh.material.dispose();
    });
    this.projectiles = [];
    this.particles = [];
  }
}
