// Управление: мобилно (ляв виртуален джойстик за движение + влачене вдясно за
// оглеждане + бутон огън) и десктоп (WASD + mouse-look с pointer lock + клик огън).
import * as THREE from 'three';

export class Controls {
  constructor(camera, domElement, terrain, hud) {
    this.camera = camera;
    this.dom = domElement;
    this.terrain = terrain;
    this.hud = hud;

    this.yaw = 0;
    this.pitch = 0;
    this.move = { x: 0, y: 0 };  // нормализиран вектор от джойстика/WASD
    this.speed = 14;             // м/с придвижване
    this.keys = {};
    this.fireRequested = false;
    this.enabled = true;

    this._initDesktop();
    this._initTouch();
  }

  isTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  // ---------- Десктоп ----------
  _initDesktop() {
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    this._onMouseMove = (e) => {
      if (document.pointerLockElement !== this.dom) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this._clampPitch();
    };
    document.addEventListener('mousemove', this._onMouseMove);

    this.dom.addEventListener('click', () => {
      if (!this.isTouch() && document.pointerLockElement !== this.dom) {
        this.dom.requestPointerLock?.();
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.pointerLockElement === this.dom) {
        this.fireRequested = true;
      }
    });
  }

  _clampPitch() {
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  // ---------- Мобилно ----------
  _initTouch() {
    this.joyId = null;
    this.lookId = null;
    this.joyOrigin = { x: 0, y: 0 };

    const onStart = (e) => {
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.45;
        if (left && this.joyId === null) {
          this.joyId = t.identifier;
          this.joyOrigin = { x: t.clientX, y: t.clientY };
          this.hud?.showJoystick(t.clientX, t.clientY);
        } else if (!left && this.lookId === null) {
          // десният бутон огън се обработва от HUD; влаченето тук е оглеждане
          this.lookId = t.identifier;
          this.lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          const dx = t.clientX - this.joyOrigin.x;
          const dy = t.clientY - this.joyOrigin.y;
          const max = 60;
          const len = Math.hypot(dx, dy) || 1;
          const cl = Math.min(len, max);
          this.move.x = (dx / len) * (cl / max);
          this.move.y = (dy / len) * (cl / max);
          this.hud?.moveJoystick(dx, dy, max);
        } else if (t.identifier === this.lookId) {
          this.yaw -= (t.clientX - this.lookLast.x) * 0.005;
          this.pitch -= (t.clientY - this.lookLast.y) * 0.005;
          this._clampPitch();
          this.lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          this.joyId = null; this.move.x = 0; this.move.y = 0;
          this.hud?.hideJoystick();
        } else if (t.identifier === this.lookId) {
          this.lookId = null;
        }
      }
    };
    this.dom.addEventListener('touchstart', onStart, { passive: true });
    this.dom.addEventListener('touchmove', onMove, { passive: true });
    this.dom.addEventListener('touchend', onEnd, { passive: true });
    this.dom.addEventListener('touchcancel', onEnd, { passive: true });
  }

  // Бутонът "огън" (HUD) вика това.
  requestFire() { this.fireRequested = true; }

  consumeFire() {
    if (this.fireRequested) { this.fireRequested = false; return true; }
    return false;
  }

  update(dt) {
    if (!this.enabled) return;

    // WASD -> move вектор (десктоп)
    if (!this.isTouch()) {
      let mx = 0, my = 0;
      if (this.keys['KeyW']) my -= 1;
      if (this.keys['KeyS']) my += 1;
      if (this.keys['KeyA']) mx -= 1;
      if (this.keys['KeyD']) mx += 1;
      const len = Math.hypot(mx, my) || 1;
      this.move.x = mx / len * (mx || my ? 1 : 0);
      this.move.y = my / len * (mx || my ? 1 : 0);
    }

    // Прилагане на ориентацията към камерата (yaw около Y, pitch около X).
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    // Движение в равнината според yaw.
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const vel = new THREE.Vector3();
    vel.addScaledVector(forward, -this.move.y * this.speed * dt);
    vel.addScaledVector(right, this.move.x * this.speed * dt);

    this.camera.position.add(vel);

    // Държим играча в границите и на височината на терена + ръст.
    const lim = 185;
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -lim, lim);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -lim, lim);
    const ground = this.terrain.heightAt(this.camera.position.x, this.camera.position.z);
    this.camera.position.y = ground + 1.7;
  }

  dispose() {
    document.removeEventListener('mousemove', this._onMouseMove);
  }
}
