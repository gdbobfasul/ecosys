// Дефиниция на трите оръжия и тяхното поведение.
// (1) bullet  – обикновен куршум, бърз огън, малка щета
// (2) bomb    – бомба, по-бавна, площна щета (splash)
// (3) missile – самонасочваща ракета, търси най-близкия враг
import { THEME } from '../theme.js';

export const WEAPONS = {
  bullet: {
    key: 'bullet',
    name: 'Куршуми',
    texture: 'bullet',
    cooldown: 220,     // ms между изстрелите
    speed: -620,       // нагоре
    damage: 1,
    splash: 0,
    homing: false,
    tint: THEME.accent
  },
  bomb: {
    key: 'bomb',
    name: 'Бомби',
    texture: 'bomb',
    cooldown: 620,
    speed: -380,
    damage: 3,
    splash: 70,        // радиус на площна щета
    homing: false,
    tint: 0xffb020
  },
  missile: {
    key: 'missile',
    name: 'Ракети',
    texture: 'missile',
    cooldown: 520,
    speed: -300,       // базова, после се коригира към целта
    damage: 2,
    splash: 30,
    homing: true,
    turnRate: 4.5,     // радиани/сек завъртане към целта
    tint: THEME.danger
  }
};

// Подреден списък за превключване (UI бутон „смени оръжие").
export const WEAPON_ORDER = ['bullet', 'bomb', 'missile'];
