// Version: 1.0012
// Генератор на 100 нива (data-driven / процедурно).
// За ниво N (1..100): избира тип цел (ескалация през ростера), мащабира
// брой/скорост/уклончивост/спавн темп, терен, лимити време/боеприпаси.
// Трудността расте монотонно.
import { weaponForTarget } from './weapons.js';

// Ростер на целите, подреден по нарастваща трудност.
// Всяко ниво има ЕДИН униформен тип цел.
const TARGET_ROSTER = [
  'rabbit',    // лесни, дребни
  'scarecrow', // статични отначало
  'roe_deer',
  'snake',
  'boar',
  'red_deer',
  'gnome',
  'balloon',
  'wolf',
  'elk',
  'soldier',
  'tank',
  'plane'
];

// Биоми по групи нива (за разнообразие).
const BIOME_CYCLE = ['forest', 'field', 'snow', 'desert', 'hills', 'marsh', 'urban'];

// Прост детерминиран PRNG (mulberry32) за повторяеми нива.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Изборът на цел ескалира: по-късните нива отключват по-трудни цели.
// Прозорец на достъпните цели расте с N; вътре в прозореца теглим по-трудните по-често.
function pickTarget(n, rand) {
  // Прозорец: на ниво 1 -> само първите 2; към 100 -> целият ростер.
  const unlocked = Math.min(
    TARGET_ROSTER.length,
    2 + Math.floor((n / 100) * (TARGET_ROSTER.length - 1))
  );
  // Bias към края на прозореца с напредване на нивото.
  const bias = 0.4 + 0.5 * (n / 100);
  const r = Math.pow(rand(), 1 - bias); // изместване нагоре
  const idx = Math.min(unlocked - 1, Math.floor(r * unlocked));
  return TARGET_ROSTER[idx];
}

// Генерира конфигурация за ниво N.
export function generateLevel(n) {
  const level = Math.max(1, Math.min(100, n | 0));
  const rand = rng(level * 2654435761);

  const target = pickTarget(level, rand);
  const weapon = weaponForTarget(target);
  const biome = BIOME_CYCLE[(level - 1) % BIOME_CYCLE.length];

  // Монотонно нарастваща трудност (0..1).
  const d = (level - 1) / 99;

  // Брой цели: расте 5 -> 24.
  const count = Math.round(5 + d * 19);

  // Скорост на целите (м/с): 1.5 -> 9.
  const speed = +(1.5 + d * 7.5 + rand() * 1.0).toFixed(2);

  // Уклончивост (колко рязко сменят посока) 0.1 -> 0.9.
  const evasiveness = +(0.1 + d * 0.8).toFixed(2);

  // Темп на спавн (секунди между вълни): 3.0 -> 0.8.
  const spawnCadence = +(3.0 - d * 2.2).toFixed(2);

  // Едновременно живи цели: 3 -> 9.
  const maxAlive = Math.round(3 + d * 6);

  // Лимит време (сек): първата ПОЛОВИНА от нивата (1–50) е БЕЗ лимит (0 = безкрайно) —
  // играчът се учи спокойно. От 51-во нагоре има лимит, но 10 ПЪТИ по-щедър от стария
  // (старият беше твърде кратък). Играта третира timeLimit <= 0 като „без часовник".
  const timeLimit = level <= 50 ? 0 : Math.round(40 + count * 2.5 - d * 15) * 10;

  // Боеприпаси: достатъчно + буфер, който се свива.
  const ammoBuffer = Math.round(8 - d * 5);
  const ammo = weapon.mag >= 999 ? 999 : count + Math.max(2, ammoBuffer);

  // Точки на цел: по-трудните цели струват повече.
  const targetIdx = TARGET_ROSTER.indexOf(target);
  const pointsPerTarget = 50 + targetIdx * 25 + Math.round(d * 50);

  return {
    level,
    target,
    weapon,            // {key, name, mode, ...}
    biome,
    seed: level * 99991 + 7,
    count,
    speed,
    evasiveness,
    spawnCadence,
    maxAlive,
    timeLimit,
    ammo,
    pointsPerTarget
  };
}

// Помощник: курирана схема цел-по-ниво (за документация/преглед).
export function levelScheme() {
  const out = [];
  for (let n = 1; n <= 100; n++) {
    const L = generateLevel(n);
    out.push({ level: n, target: L.target, weapon: L.weapon.key, biome: L.biome, count: L.count });
  }
  return out;
}
