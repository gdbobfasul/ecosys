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

export const LEVELS = [
  {
    id: 1, name: 'Тренировка',
    spawnInterval: 1500, enemySpeed: 80, enemyHpMul: 1.0,
    enemyTypes: [0], obstacles: [], enemyFireMul: 0.0,
    pattern: 'random', quota: 12, boss: false, reward: null
  },
  {
    id: 2, name: 'Първи рояк',
    spawnInterval: 1300, enemySpeed: 95, enemyHpMul: 1.0,
    enemyTypes: [0], obstacles: ['asteroid'], enemyFireMul: 0.15,
    pattern: 'random', quota: 16, boss: false, reward: 'bomb'
  },
  {
    id: 3, name: 'Астероиден пояс',
    spawnInterval: 1150, enemySpeed: 110, enemyHpMul: 1.15,
    enemyTypes: [0, 1], obstacles: ['asteroid'], enemyFireMul: 0.3,
    pattern: 'vformation', quota: 20, boss: false, reward: null
  },
  {
    id: 4, name: 'Строй „V"',
    spawnInterval: 1000, enemySpeed: 125, enemyHpMul: 1.3,
    enemyTypes: [0, 1], obstacles: ['asteroid', 'mine'], enemyFireMul: 0.45,
    pattern: 'vformation', quota: 24, boss: false, reward: 'missile'
  },
  {
    id: 5, name: 'Минно поле',
    spawnInterval: 900, enemySpeed: 140, enemyHpMul: 1.5,
    enemyTypes: [0, 1], obstacles: ['mine'], enemyFireMul: 0.6,
    pattern: 'sine', quota: 26, boss: true, reward: null
  },
  {
    id: 6, name: 'Вълнов фронт',
    spawnInterval: 820, enemySpeed: 155, enemyHpMul: 1.7,
    enemyTypes: [1, 2], obstacles: ['asteroid', 'mine'], enemyFireMul: 0.75,
    pattern: 'sine', quota: 30, boss: false, reward: null
  },
  {
    id: 7, name: 'Тежка ескадра',
    spawnInterval: 740, enemySpeed: 170, enemyHpMul: 2.0,
    enemyTypes: [1, 2], obstacles: ['asteroid', 'mine'], enemyFireMul: 0.9,
    pattern: 'sweep', quota: 34, boss: false, reward: null
  },
  {
    id: 8, name: 'Кръстосан огън',
    spawnInterval: 660, enemySpeed: 185, enemyHpMul: 2.3,
    enemyTypes: [1, 2], obstacles: ['mine'], enemyFireMul: 1.1,
    pattern: 'sweep', quota: 38, boss: false, reward: null
  },
  {
    id: 9, name: 'Хаос',
    spawnInterval: 560, enemySpeed: 205, enemyHpMul: 2.7,
    enemyTypes: [0, 1, 2], obstacles: ['asteroid', 'mine'], enemyFireMul: 1.3,
    pattern: 'sweep', quota: 44, boss: false, reward: null
  },
  {
    id: 10, name: 'Финален бос',
    spawnInterval: 500, enemySpeed: 225, enemyHpMul: 3.2,
    enemyTypes: [0, 1, 2], obstacles: ['asteroid', 'mine'], enemyFireMul: 1.6,
    pattern: 'sweep', quota: 50, boss: true, reward: null
  }
];

export const TOTAL_LEVELS = LEVELS.length;
