// Version: 1.0001
// Малка стойностна шумова функция (value noise) + fBm, написана inline.
// Без външни npm зависимости. Детерминирана чрез seed.
// Използва се за процедурален терен (heightfield).

// Прост хеш -> [0,1)
// Цялата аритметика е 32-битова чрез Math.imul/побитови оператори. Старата
// версия ползваше обикновено умножение по големи константи (напр. seed*2147483647),
// което в JS double губи целочислена точност и при някои seed-ове връщаше
// странни/нестабилни стойности (потенциален NaN надолу по веригата -> черен екран).
function hash2(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  // нормализиране към [0,1)
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  // smoothstep крива за интерполация
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Value noise в точка (x,y)
export function valueNoise(x, y, seed = 1337) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const v00 = hash2(xi, yi, seed);
  const v10 = hash2(xi + 1, yi, seed);
  const v01 = hash2(xi, yi + 1, seed);
  const v11 = hash2(xi + 1, yi + 1, seed);

  const sx = smooth(xf);
  const sy = smooth(yf);

  const top = lerp(v00, v10, sx);
  const bottom = lerp(v01, v11, sx);
  return lerp(top, bottom, sy); // [0,1)
}

// Фрактален шум (fractional Brownian motion) — натрупани октави.
export function fbm(x, y, seed = 1337, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm; // [0,1)
}
