import Phaser from 'phaser';

// Данни за 10-те нива (data-driven трудност).
// Всяко ниво е по-трудно: повече типове снаряди, по-бърз spawn, повече хвърлячи,
// по-стегнати шаблони, нови поведения (volley/ring/homing-lob).
//
// Полета:
//  - id            : номер на нивото (1..10)
//  - name          : показвано име
//  - arena         : ключ за фон/терен (виж gfx/arena.js)
//  - surviveMs     : колко време трябва да оцелее играчът, за да мине нивото
//  - spawnDelayMs  : [min,max] интервал между вълни (по-малък = по-често)
//  - throwers      : едновременни „хвърлячи" на ръба (повече = повече посоки)
//  - projSpeed     : множител на скоростта на снарядите
//  - projectiles   : кои типове снаряди са отключени
//  - patterns      : тегла на шаблоните (single/volley/ring/lob)
//  - accent        : цвят на акцента/трудността (за HUD)
//
// ПРОЕКТИЛИ (виж entities/projectile.js за поведение):
//  pellet  – камъче от прашка (бързо, право)
//  bolt    – арбалетна стрела (много бързо, право, тясно)
//  stone   – хвърлен камък (средно, леко дъга)
//  dirt    – буца пръст/кал (бавно, дъга, оставя петно)
//  mud     – голям калник (много бавно, голям, голямо петно)
//  pot     – глинено гърне (средно, дъга, „пръска" на парчета при удар)
//  veg     – гнил зеленчук (средно-бавно, дъга)
//  махорка – навита махорка/цигара (бавна, лъкатуши леко)
//  snowball– снежна топка (средна, дъга)
//  stick   – хвърлена пръчка (средна, върти се, право)
//  homingStone – камък с лек самонасочващ ефект (към играча)

export const LEVELS = [
  {
    id: 1, name: 'Селският мегдан', arena: 'meadow',
    surviveMs: 22000, spawnDelayMs: [900, 1300], throwers: 1, projSpeed: 0.85,
    projectiles: ['pellet', 'stone'],
    patterns: { single: 10, volley: 0, ring: 0, lob: 2 },
    accent: 0x6fae3a
  },
  {
    id: 2, name: 'Прашкарите', arena: 'meadow',
    surviveMs: 26000, spawnDelayMs: [780, 1150], throwers: 2, projSpeed: 0.95,
    projectiles: ['pellet', 'stone', 'dirt'],
    patterns: { single: 10, volley: 1, ring: 0, lob: 3 },
    accent: 0x8fbe3a
  },
  {
    id: 3, name: 'Калния път', arena: 'mud',
    surviveMs: 30000, spawnDelayMs: [700, 1050], throwers: 2, projSpeed: 1.0,
    projectiles: ['pellet', 'stone', 'dirt', 'mud', 'veg'],
    patterns: { single: 9, volley: 3, ring: 0, lob: 4 },
    accent: 0xb89a3a
  },
  {
    id: 4, name: 'Стрелците', arena: 'field',
    surviveMs: 33000, spawnDelayMs: [620, 950], throwers: 3, projSpeed: 1.1,
    projectiles: ['pellet', 'bolt', 'stone', 'dirt', 'veg'],
    patterns: { single: 8, volley: 4, ring: 1, lob: 4 },
    accent: 0xd0a83a
  },
  {
    id: 5, name: 'Пазарната глъч', arena: 'market',
    surviveMs: 36000, spawnDelayMs: [560, 880], throwers: 3, projSpeed: 1.18,
    projectiles: ['pellet', 'bolt', 'stone', 'dirt', 'mud', 'pot', 'veg'],
    patterns: { single: 7, volley: 5, ring: 2, lob: 5 },
    accent: 0xe0b34a
  },
  {
    id: 6, name: 'Зимната засада', arena: 'snow',
    surviveMs: 40000, spawnDelayMs: [500, 800], throwers: 4, projSpeed: 1.25,
    projectiles: ['pellet', 'bolt', 'stone', 'dirt', 'veg', 'snowball', 'stick', 'pot'],
    patterns: { single: 6, volley: 6, ring: 2, lob: 5 },
    accent: 0x9fd8ff
  },
  {
    id: 7, name: 'Кръстосан огън', arena: 'field',
    surviveMs: 44000, spawnDelayMs: [440, 720], throwers: 4, projSpeed: 1.32,
    projectiles: ['pellet', 'bolt', 'stone', 'dirt', 'mud', 'pot', 'stick', 'veg'],
    patterns: { single: 5, volley: 7, ring: 4, lob: 5 },
    accent: 0xe09a3a
  },
  {
    id: 8, name: 'Гнилата буря', arena: 'mud',
    surviveMs: 48000, spawnDelayMs: [400, 660], throwers: 5, projSpeed: 1.4,
    projectiles: ['pellet', 'bolt', 'stone', 'dirt', 'mud', 'pot', 'veg', 'mahorka'],
    patterns: { single: 4, volley: 8, ring: 5, lob: 6 },
    accent: 0xc77a2b
  },
  {
    id: 9, name: 'Обсадата', arena: 'market',
    surviveMs: 52000, spawnDelayMs: [350, 600], throwers: 6, projSpeed: 1.5,
    projectiles: ['pellet', 'bolt', 'stone', 'dirt', 'mud', 'pot', 'snowball', 'stick', 'homingStone'],
    patterns: { single: 3, volley: 9, ring: 7, lob: 6 },
    accent: 0xd0432b
  },
  {
    id: 10, name: 'Градушка от всичко', arena: 'snow',
    surviveMs: 60000, spawnDelayMs: [300, 520], throwers: 7, projSpeed: 1.6,
    projectiles: ['pellet', 'bolt', 'stone', 'dirt', 'mud', 'pot', 'veg', 'mahorka', 'snowball', 'stick', 'homingStone'],
    patterns: { single: 2, volley: 10, ring: 9, lob: 7 },
    accent: 0xff4d4d
  }
];

export const MAX_LEVEL = LEVELS.length;

// Връща конфигурацията на ниво по 1-базиран индекс (защитено).
export function getLevel(n) {
  const idx = Phaser.Math.Clamp(n, 1, MAX_LEVEL) - 1;
  return LEVELS[idx];
}
