// Version: 1.0012
// HUD: DOM overlay върху canvas-а — мерник, виртуален джойстик, бутон огън,
// боеприпаси, ниво, точки, оставащи цели, таймер, оръжие, минимапа (радар с врагове).
import { THEME } from './theme.js';
import { t } from './core/i18n.js';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export class HUD {
  constructor(root) {
    this.root = root;
    this._build();
  }

  _build() {
    const a = THEME.accent;
    const a2 = THEME.accent2;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;font-family:' + THEME.fontStack + ';';
    el.innerHTML = `
      <!-- Мерник в центъра -->
      <div id="crosshair" style="position:fixed;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;">
        <div style="position:absolute;left:16px;top:0;width:2px;height:12px;background:${a2};"></div>
        <div style="position:absolute;left:16px;bottom:0;width:2px;height:12px;background:${a2};"></div>
        <div style="position:absolute;top:16px;left:0;height:2px;width:12px;background:${a2};"></div>
        <div style="position:absolute;top:16px;right:0;height:2px;width:12px;background:${a2};"></div>
      </div>

      <!-- Горен ляв инфо панел -->
      <div style="position:fixed;left:12px;top:12px;color:#dfe7ee;font-size:14px;line-height:1.5;text-shadow:0 1px 2px #000;">
        <div>${esc(t('hud_level'))} <span id="hud-level" style="color:${a};font-weight:700">1</span> / 100</div>
        <div>${esc(t('hud_target'))}: <span id="hud-target">—</span></div>
        <div>${esc(t('hud_weapon'))}: <span id="hud-weapon">—</span></div>
      </div>

      <!-- Горен десен: точки/таймер/останали -->
      <div style="position:fixed;right:12px;top:12px;text-align:right;color:#dfe7ee;font-size:14px;line-height:1.5;text-shadow:0 1px 2px #000;">
        <div>${esc(t('hud_score'))}: <span id="hud-score" style="color:${a2};font-weight:700">0</span></div>
        <div>${esc(t('hud_left'))}: <span id="hud-left">0</span></div>
        <div>${esc(t('hud_time'))}: <span id="hud-time">0</span>${esc(t('time_suffix'))}</div>
      </div>

      <!-- Минимапа (радар): горе вдясно под точките; играчът в центъра, враговете — червени точки -->
      <canvas id="hud-map" width="220" height="220"
              style="position:fixed;right:12px;top:86px;width:110px;height:110px;"></canvas>

      <!-- Боеприпаси долу вдясно над бутона -->
      <div id="hud-ammo" style="position:fixed;right:24px;bottom:140px;color:#fff;font-size:22px;font-weight:800;text-shadow:0 1px 3px #000;">—</div>

      <!-- Бутон ОГЪН (мобилно) -->
      <div id="fire-btn" style="position:fixed;right:24px;bottom:28px;width:96px;height:96px;border-radius:50%;
           background:rgba(239,83,80,0.35);border:3px solid ${THEME.danger};pointer-events:auto;
           display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;
           -webkit-user-select:none;user-select:none;">${esc(t('fire_btn'))}</div>

      <!-- Виртуален джойстик (мобилно) -->
      <div id="joy-base" style="position:fixed;display:none;width:120px;height:120px;border-radius:50%;
           border:2px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.06);margin:-60px 0 0 -60px;">
        <div id="joy-knob" style="position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;
             background:rgba(255,255,255,0.35);"></div>
      </div>

      <!-- Toast съобщения (ниво/презареждане) -->
      <div id="hud-toast" style="position:fixed;left:50%;top:30%;transform:translateX(-50%);color:#fff;
           font-size:26px;font-weight:800;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .3s;"></div>
    `;
    // ПОПРАВКА (играта не тръгваше): тук пишеше `root.appendChild` — глобално `root` НЯМА
    // (елементът е #app) → ReferenceError при ВСЕКИ старт на ниво → менюто вече е махнато
    // и остава само празната сцена („сивкаво-зеленикав екран, нищо не се случва").
    this.root.appendChild(el);
    this.el = el;

    this.refs = {
      level: el.querySelector('#hud-level'),
      target: el.querySelector('#hud-target'),
      weapon: el.querySelector('#hud-weapon'),
      score: el.querySelector('#hud-score'),
      left: el.querySelector('#hud-left'),
      time: el.querySelector('#hud-time'),
      ammo: el.querySelector('#hud-ammo'),
      map: el.querySelector('#hud-map'),
      fire: el.querySelector('#fire-btn'),
      joyBase: el.querySelector('#joy-base'),
      joyKnob: el.querySelector('#joy-knob'),
      toast: el.querySelector('#hud-toast'),
      crosshair: el.querySelector('#crosshair')
    };

    // На десктоп скриваме мобилните контроли.
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!touch) {
      this.refs.fire.style.display = 'none';
    }
  }

  onFire(cb) {
    const fire = this.refs.fire;
    fire.addEventListener('touchstart', (e) => { e.preventDefault(); cb(); }, { passive: false });
    fire.addEventListener('mousedown', (e) => { e.preventDefault(); cb(); });
  }

  set(values) {
    if (values.level != null) this.refs.level.textContent = values.level;
    if (values.target != null) this.refs.target.textContent = values.target;
    if (values.weapon != null) this.refs.weapon.textContent = values.weapon;
    if (values.score != null) this.refs.score.textContent = values.score;
    if (values.left != null) this.refs.left.textContent = values.left;
    if (values.time != null) this.refs.time.textContent = values.time;
    if (values.ammo != null) this.refs.ammo.textContent = values.ammo === 999 ? '∞' : values.ammo;
  }

  // Минимапа (радар): играчът е в центъра, гледаната посока сочи НАГОРЕ (завъртане по yaw),
  // живите врагове са червени точки. Извън обхвата RANGE → точката се залепя по ръба (пак
  // показва посоката). Рисува се всеки кадър от GameScene.update — само няколко дъги, евтино.
  drawMap(px, pz, yaw, targets) {
    const c = this.refs.map;
    if (!c) return;
    const ctx = this._mapCtx || (this._mapCtx = c.getContext('2d'));
    const W = c.width;
    const cx = W / 2, cy = W / 2, R = W / 2 - 6;
    const RANGE = 170; // игрови единици до ръба (спавнът е на 40–160 от играча)
    ctx.clearRect(0, 0, W, W);
    // фон + рамка
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,18,12,0.45)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
    // слаб вътрешен пръстен + кръст за ориентация
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
    // врагове: завъртаме световния офсет така, че forward (−sin yaw, −cos yaw) да е „нагоре"
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    for (const t of targets) {
      if (!t.alive) continue;
      const dx = t.x - px, dz = t.z - pz;
      const rightD = dx * cos - dz * sin;      // проекция върху „дясно"
      const fwdD = -dx * sin - dz * cos;       // проекция върху „напред"
      let mx = (rightD / RANGE) * R;
      let my = (-fwdD / RANGE) * R;            // напред = нагоре на екрана
      const len = Math.hypot(mx, my);
      if (len > R - 7) { mx *= (R - 7) / len; my *= (R - 7) / len; }
      ctx.beginPath(); ctx.arc(cx + mx, cy + my, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4040'; ctx.fill();
    }
    // играчът: светла стрелка в центъра, върхът сочи посоката на гледане (нагоре)
    ctx.fillStyle = '#eaf5ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11); ctx.lineTo(cx - 7, cy + 8); ctx.lineTo(cx + 7, cy + 8);
    ctx.closePath(); ctx.fill();
  }

  toast(text, ms = 1400) {
    this.refs.toast.textContent = text;
    this.refs.toast.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { this.refs.toast.style.opacity = '0'; }, ms);
  }

  showJoystick(x, y) {
    this.refs.joyBase.style.left = x + 'px';
    this.refs.joyBase.style.top = y + 'px';
    this.refs.joyBase.style.display = 'block';
  }
  moveJoystick(dx, dy, max) {
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, max);
    const kx = (dx / len) * cl;
    const ky = (dy / len) * cl;
    this.refs.joyKnob.style.left = (35 + kx) + 'px';
    this.refs.joyKnob.style.top = (35 + ky) + 'px';
  }
  hideJoystick() {
    this.refs.joyBase.style.display = 'none';
    this.refs.joyKnob.style.left = '35px';
    this.refs.joyKnob.style.top = '35px';
  }

  // Насложен екран „Как се играе": показва ДВЕТЕ зони (ляво = движение, дясно = оглеждане/
  // завъртане) + бутона ОГЪН. Затваря се с докосване/клик или сам след 12 секунди.
  // Играта отдолу НЕ е спряна (нива 1–50 са без часовник, така че нищо не се губи).
  showGuide(labels) {
    if (document.getElementById('fps-guide')) return;
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const ov = document.createElement('div');
    ov.id = 'fps-guide';
    ov.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:auto;background:rgba(4,10,16,.62);' +
      'font-family:' + THEME.fontStack + ';color:#eaf5ff;display:flex;flex-direction:column;';
    const zone = (txt, icon) =>
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;text-align:center;gap:10px">` +
      `<div style="font-size:44px">${icon}</div>` +
      `<div style="font-size:15px;font-weight:700;max-width:300px;line-height:1.45">${esc(txt)}</div></div>`;
    ov.innerHTML = touch
      ? `<div style="flex:1;display:flex">` +
          `<div style="flex:1;display:flex;border-right:2px dashed rgba(255,255,255,.35)">${zone(labels.move, '🕹️')}</div>` +
          `<div style="flex:1;display:flex">${zone(labels.look, '👀')}</div>` +
        `</div>` +
        `<div style="text-align:center;padding:0 18px 6px;font-size:14px;font-weight:700">🔫 ${esc(labels.fire)}</div>` +
        `<div style="text-align:center;padding:0 18px 26px;font-size:13px;opacity:.75">${esc(labels.dismiss)}</div>`
      : `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;text-align:center">` +
          `<div style="font-size:44px">⌨️🖱️</div>` +
          `<div style="font-size:16px;font-weight:700;max-width:520px;line-height:1.5">${esc(labels.desktop)}</div>` +
          `<div style="font-size:13px;opacity:.75">${esc(labels.dismiss)}</div>` +
        `</div>`;
    const close = () => { clearTimeout(tm); try { ov.remove(); } catch (e) {} };
    const tm = setTimeout(close, 12000);
    ov.addEventListener('pointerdown', close, { once: true });
    document.body.appendChild(ov);
  }

  dispose() {
    this.el.remove();
  }
}
