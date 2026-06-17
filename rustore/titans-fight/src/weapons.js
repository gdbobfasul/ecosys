// Дефиниции на оръжията.
// Всяко оръжие има: обхват (reach), щета (damage), скорост на замах (cooldown),
// тип (melee / throw), и визуални параметри за процедурната графика.
// `unlockLevel` = от кое ниво нататък оръжието е отключено за играча (прогресия).

export const WEAPONS = {
  fists: {
    key: 'fists',
    name: 'ЮМРУЦИ',
    type: 'melee',
    reach: 90,
    damage: 7,
    cooldown: 360,      // ms между ударите
    windup: 90,         // забавяне преди да удари
    knockback: 160,
    color: 0xffb08a,
    desc: 'Бързи, но слаби. Винаги налични.',
    unlockLevel: 1
  },
  saber: {
    key: 'saber',
    name: 'САБЯ',
    type: 'melee',
    reach: 150,
    damage: 12,
    cooldown: 430,
    windup: 120,
    knockback: 200,
    color: 0xd8f0ff,
    desc: 'Голям обхват, добра щета.',
    unlockLevel: 1
  },
  hammer: {
    key: 'hammer',
    name: 'ЧУК',
    type: 'melee',
    reach: 135,
    damage: 22,
    cooldown: 720,
    windup: 260,
    knockback: 340,
    color: 0xc9a14a,
    desc: 'Бавен, но смазващ. Голям отблъск.',
    unlockLevel: 2
  },
  cannonball: {
    key: 'cannonball',
    name: 'ГЮЛЕ',
    type: 'throw',
    reach: 9999,
    damage: 16,
    cooldown: 820,
    windup: 140,
    knockback: 220,
    projSpeed: 560,
    projGravity: 700,
    color: 0x3a3a44,
    desc: 'Хвърля се по дъга. Среден обсег.',
    unlockLevel: 3
  },
  bomb: {
    key: 'bomb',
    name: 'БОМБА',
    type: 'throw',
    reach: 9999,
    damage: 28,
    cooldown: 1150,
    windup: 200,
    knockback: 380,
    projSpeed: 480,
    projGravity: 820,
    splash: 130,        // радиус на взрива
    color: 0x222227,
    desc: 'Експлозия с площна щета. Бавно презареждане.',
    unlockLevel: 5
  }
};

// Подреден списък (за UI и за индексиране).
export const WEAPON_ORDER = ['fists', 'saber', 'hammer', 'cannonball', 'bomb'];

// Връща списък от оръжия, отключени до и вкл. дадено ниво.
export function unlockedWeapons(level) {
  return WEAPON_ORDER.filter(k => WEAPONS[k].unlockLevel <= level);
}
