// Локален лидерборд чрез sql.js (SQLite, компилиран към WASM, бунделнат локално).
// ПОВЕРИТЕЛНОСТ: съхранява САМО {name, points}. Без id, без външни ключове,
// без релации, без телефон/контакти/лични данни извън свободно въведеното име.
// Изцяло на устройството — БЕЗ сървър, БЕЗ мрежа.
//
// Персистенция: целият SQLite файл се сериализира (Uint8Array) и се пази в
// IndexedDB. При липса на IndexedDB пада към localStorage (base64).
//
// Резервен вариант: ако sql.js не се зареди (напр. WASM проблем), използваме
// лек localStorage store със същата схема (name+points) — виж _fallback.

import initSqlJs from 'sql.js';
// Vite разрешава ?url към финалния път на WASM актива (работи и под Capacitor).
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const DB_KEY = 'fpshunter_scores_db';   // IndexedDB / localStorage ключ
const TABLE = 'scores';

export class Leaderboard {
  constructor() {
    this.SQL = null;
    this.db = null;
    this.usingFallback = false;
  }

  async init() {
    try {
      this.SQL = await initSqlJs({ locateFile: () => wasmUrl });
      const saved = await this._load();
      this.db = saved ? new this.SQL.Database(saved) : new this.SQL.Database();
      // Единствена таблица: само две колони, без релации.
      this.db.run(`CREATE TABLE IF NOT EXISTS ${TABLE} (name TEXT, points INTEGER);`);
      await this._persist();
    } catch (err) {
      console.warn('[leaderboard] sql.js недостъпен, минавам на fallback:', err);
      this.usingFallback = true;
      this._fallbackLoad();
    }
  }

  // Вмъкване на резултат и класиране сред вече запазените.
  async addScore(name, points) {
    const clean = String(name || 'Играч').slice(0, 24).trim() || 'Играч';
    const pts = Math.max(0, Math.round(points));
    if (this.usingFallback) {
      this._fb.push({ name: clean, points: pts });
      this._fallbackSave();
    } else {
      const stmt = this.db.prepare(`INSERT INTO ${TABLE} (name, points) VALUES (?, ?);`);
      stmt.run([clean, pts]);
      stmt.free();
      await this._persist();
    }
    return this.rankOf(clean, pts);
  }

  // Топ-N подреден по точки (намаляващо).
  top(n = 10) {
    if (this.usingFallback) {
      return [...this._fb].sort((a, b) => b.points - a.points).slice(0, n);
    }
    const res = this.db.exec(`SELECT name, points FROM ${TABLE} ORDER BY points DESC LIMIT ${n};`);
    if (!res.length) return [];
    return res[0].values.map(([name, points]) => ({ name, points }));
  }

  // Ранг (1-базиран) на даден резултат сред всички.
  rankOf(name, points) {
    let better;
    if (this.usingFallback) {
      better = this._fb.filter((r) => r.points > points).length;
    } else {
      const res = this.db.exec(`SELECT COUNT(*) FROM ${TABLE} WHERE points > ${points};`);
      better = res.length ? res[0].values[0][0] : 0;
    }
    return better + 1;
  }

  // ---------- Персистенция чрез IndexedDB ----------
  async _persist() {
    if (this.usingFallback) return;
    const data = this.db.export(); // Uint8Array — целият SQLite файл
    try {
      await idbSet(DB_KEY, data);
    } catch {
      // localStorage резерв (base64)
      try { localStorage.setItem(DB_KEY, btoa(String.fromCharCode(...data))); } catch {}
    }
  }

  async _load() {
    try {
      const data = await idbGet(DB_KEY);
      if (data) return new Uint8Array(data);
    } catch {}
    try {
      const ls = localStorage.getItem(DB_KEY);
      if (ls) return Uint8Array.from(atob(ls), (c) => c.charCodeAt(0));
    } catch {}
    return null;
  }

  // ---------- Fallback (localStorage, SQLite-подобна схема name+points) ----------
  _fallbackLoad() {
    try {
      this._fb = JSON.parse(localStorage.getItem(DB_KEY + '_fb') || '[]');
    } catch { this._fb = []; }
  }
  _fallbackSave() {
    try { localStorage.setItem(DB_KEY + '_fb', JSON.stringify(this._fb)); } catch {}
  }
}

// --- Минимален IndexedDB key-value помощник (без библиотека) ---
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fpshunter', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const r = tx.objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
