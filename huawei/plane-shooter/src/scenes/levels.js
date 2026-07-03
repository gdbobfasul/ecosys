// Version: 1.0001
// ДАННОВО-ОРИЕНТИРАНИ НИВА.
// Точно 10 нива. Всяко следващо е по-трудно — кодирано ясно в полетата:
//  - spawnInterval: по-малък = по-чести врагове
//  - enemySpeed:    по-голям = по-бързи врагове
//  - enemyHpMul:    множител на здравето на враговете
//  - enemyTypes:    кои типове се появяват (0 малък, 1 среден, 2 тежък)
//  - obstacles:     активни препятствия ('asteroid', 'mine')
//  - enemyFireMul:  колко често стрелят враговете (по-голям = повече огън)
//  - pattern:       геометрия на вълните ('random' | 'vformation' | 'sine' | 'sweep')
//  - quota:         колко врага трябва да убиеш, за да завършиш нивото
//  - boss:          ако true -> в края на нивото идва бос
//  - reward:        оръжие, което се отключва при завършване (null = нищо)
// Виждаме монотонно нарастване на трудността от ниво 1 към ниво 10.

// ПЛАВНА крива: ранните нива са леки (единични врагове, „random" = по 2; малко огън), а гъстите
// формации („vformation" = 5, „sweep" = 4) идват ЕДВА от средата нататък — иначе на ниво 3-4 вече
// имаше неспирни рояци при слабо оръжие. Здравето/скоростта/огънят растат плавно, а от ниво 8
// самолетът получава МЕГА-МИНА (виж game.js), затова финалните нива са по-проходими, не отчайващи.
export const LEVELS = [
  {
    id: 1, name: 'Тренировка',
    spawnInterval: 1600, enemySpeed: 80, enemyHpMul: 1.0,
    enemyTypes: [0], obstacles: [], enemyFireMul: 0.0,
    pattern: 'random', quota: 12, boss: false, reward: null
  },
  {
    id: 2, name: 'Първи рояк',
    spawnInterval: 1450, enemySpeed: 90, enemyHpMul: 1.0,
    enemyTypes: [0], obstacles: ['asteroid'], enemyFireMul: 0.1,
    pattern: 'random', quota: 14, boss: false, reward: 'bomb'
  },
  {
    id: 3, name: 'Астероиден пояс',
    spawnInterval: 1300, enemySpeed: 100, enemyHpMul: 1.1,
    enemyTypes: [0, 1], obstacles: ['asteroid'], enemyFireMul: 0.2,
    pattern: 'random', quota: 16, boss: false, reward: null
  },
  {
    id: 4, name: 'Среден натиск',
    spawnInterval: 1180, enemySpeed: 112, enemyHpMul: 1.2,
    enemyTypes: [0, 1], obstacles: ['asteroid', 'mine'], enemyFireMul: 0.32,
    pattern: 'random', quota: 18, boss: false, reward: 'missile'
  },
  {
    id: 5, name: 'Минно поле',
    spawnInterval: 1060, enemySpeed: 124, enemyHpMul: 1.35,
    enemyTypes: [0, 1], obstacles: ['mine'], enemyFireMul: 0.45,
    pattern: 'sine', quota: 22, boss: true, reward: null
  },
  {
    id: 6, name: 'Строй „V"',
    spawnInterval: 960, enemySpeed: 138, enemyHpMul: 1.5,
    enemyTypes: [0, 1], obstacles: ['asteroid', 'mine'], enemyFireMul: 0.58,
    pattern: 'vformation', quota: 26, boss: false, reward: null
  },
  {
    id: 7, name: 'Тежка ескадра',
    spawnInterval: 870, enemySpeed: 152, enemyHpMul: 1.7,
    enemyTypes: [0, 1, 2], obstacles: ['asteroid', 'mine'], enemyFireMul: 0.72,
    pattern: 'sine', quota: 30, boss: false, reward: null
  },
  {
    id: 8, name: 'Кръстосан огън',
    spawnInterval: 790, enemySpeed: 166, enemyHpMul: 1.9,
    enemyTypes: [1, 2], obstacles: ['mine'], enemyFireMul: 0.88,
    pattern: 'sweep', quota: 34, boss: false, reward: null
  },
  {
    id: 9, name: 'Хаос',
    spawnInterval: 700, enemySpeed: 185, enemyHpMul: 2.2,
    enemyTypes: [0, 1, 2], obstacles: ['asteroid', 'mine'], enemyFireMul: 1.05,
    pattern: 'sweep', quota: 40, boss: false, reward: null
  },
  {
    id: 10, name: 'Финален бос',
    spawnInterval: 620, enemySpeed: 205, enemyHpMul: 2.6,
    enemyTypes: [0, 1, 2], obstacles: ['asteroid', 'mine'], enemyFireMul: 1.3,
    pattern: 'sweep', quota: 46, boss: true, reward: null
  }
];

export const TOTAL_LEVELS = LEVELS.length;
