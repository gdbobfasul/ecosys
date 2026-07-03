// Version: 1.0001
// Процедурен фон/терен на арената, който се различава по ниво.
// Рисуваме директно в Graphics обект (не текстура), защото е статичен фон.
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';

// Палитри за различните типове арена.
const ARENAS = {
  meadow: { base: 0x2f4a1f, alt: 0x3a5a26, fleck: 0x4e7a32, border: 0x1c2e12 },
  mud:    { base: 0x3a2c18, alt: 0x4a3820, fleck: 0x5a4326, border: 0x241a0e },
  field:  { base: 0x5a4a22, alt: 0x6a5828, fleck: 0x7a6630, border: 0x352c14 },
  market: { base: 0x4a3f34, alt: 0x5a4d40, fleck: 0x6e5e4c, border: 0x2c241c },
  snow:   { base: 0xb8c6d0, alt: 0xcdd9e2, fleck: 0xe6eef4, border: 0x8a98a4 }
};

// Рисува арена за дадения ключ в подаден Graphics (g) обект.
// seed прави шарката детерминирана/повторяема.
export function drawArena(scene, key, g, seed = 1) {
  const a = ARENAS[key] || ARENAS.meadow;
  const W = GAME_WIDTH, H = GAME_HEIGHT;

  // Основа
  g.fillStyle(a.base, 1);
  g.fillRect(0, 0, W, H);

  // Псевдослучаен генератор (детерминиран по seed).
  let s = seed * 9973 + 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  // „Плочки"/петна с алтернативен цвят за текстура на терена
  g.fillStyle(a.alt, 0.5);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H;
    const r = rnd() * 26 + 10;
    g.fillEllipse(x, y, r, r * 0.7);
  }

  // Дребни „петънца"/камъчета
  g.fillStyle(a.fleck, 0.6);
  for (let i = 0; i < 160; i++) {
    g.fillCircle(rnd() * W, rnd() * H, rnd() * 2 + 0.6);
  }

  // Виньетка (тъмен ръб) — фокусира вниманието в центъра
  for (let i = 0; i < 6; i++) {
    g.lineStyle(14, a.border, 0.06 + i * 0.02);
    g.strokeRect(7 * i, 7 * i, W - 14 * i, H - 14 * i);
  }

  // Граница на „бойното поле"
  g.lineStyle(3, a.border, 0.9);
  g.strokeRect(4, 4, W - 8, H - 8);
}

export function arenaAccent(key) {
  return (ARENAS[key] || ARENAS.meadow).fleck;
}
