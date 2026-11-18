/* Чиста логика на клиентската сесия (без Electron) — за да е тестваема headless.
 * Състояния: waiting (чака активиране) · active (брои) · expired (заключен) ·
 * unlocked (отключен с ключ, без брояч). Оставащото време се пази устойчиво чрез state.cjs. */
'use strict';
const state = require('./state.cjs');

class Session {
  constructor({ onChange } = {}) {
    this.remainingSec = 0;
    this.status = 'waiting';
    this.onChange = onChange || (() => {});
  }

  /* при старт/рестарт — възстановяваме оставащото време */
  restore() {
    const st = state.loadState();
    if (st && st.remainingSec > 0) { this.remainingSec = st.remainingSec; this.status = 'active'; }
    else if (st && st.status === 'expired') { this.remainingSec = Math.max(0, st.remainingSec || 0); this.status = 'expired'; }
    else { this.remainingSec = 0; this.status = 'waiting'; }
    this._emit();
    return this.status;
  }

  grant(hours) {
    hours = Math.max(0, Math.floor(Number(hours) || 0));
    this.remainingSec = hours * 3600;
    this.status = this.remainingSec > 0 ? 'active' : 'waiting';
    this.save(); this._emit();
  }

  /* извиква се веднъж в секунда докато брои */
  tick() {
    if (this.status !== 'active' || this.remainingSec === -1) return;
    this.remainingSec--;
    if (this.remainingSec <= 0) { this.remainingSec = 0; this.status = 'expired'; this.save(); }
    this._emit();
  }

  /* заключване по сигнал от мастера (дори да остава време — пази се за по-късно) */
  lockNow() { this.status = 'expired'; this.save(); this._emit(); }

  /* отключване по сигнал от мастера */
  masterUnlock() {
    this.status = this.remainingSec > 0 ? 'active' : 'waiting';
    this.save(); this._emit();
  }

  /* отключване с уникалния код (краен случай) */
  codeUnlock(entered, code) {
    if (String(entered || '').trim().toUpperCase() === String(code).toUpperCase()) {
      this.status = 'unlocked'; this.remainingSec = -1; this.save(); this._emit(); return true;
    }
    return false;
  }

  save() { state.saveState(this.remainingSec, this.status); }
  snapshot() { return { remainingSec: this.remainingSec, status: this.status }; }
  _emit() { try { this.onChange(this.snapshot()); } catch {} }
}

module.exports = { Session };
