// Version: 1.0001
// HUD: DOM overlay върху canvas-а — мерник, виртуален джойстик, бутон огън,
// боеприпаси, ниво, точки, оставащи цели, таймер, оръжие.
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
    root.appendChild(el);
    this.el = el;

    this.refs = {
      level: el.querySelector('#hud-level'),
      target: el.querySelector('#hud-target'),
      weapon: el.querySelector('#hud-weapon'),
      score: el.querySelector('#hud-score'),
      left: el.querySelector('#hud-left'),
      time: el.querySelector('#hud-time'),
      ammo: el.querySelector('#hud-ammo'),
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

  dispose() {
    this.el.remove();
  }
}
