// Version: 1.0001
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
  },
  // МЕГА-МИНА — отключва се от ниво 8 (виж game.js). ОГРОМЕН радиус на взрив (≈150px), който
  // мете 8–10 близки вражески самолета наведнъж. Така главният самолет компенсира гъстите рояци
  // на финалните нива. По-дълъг кулдаун (мощно, но не тривиализиращо). fullSplash = пълна щета
  // на ВСИЧКИ в радиуса (не половин), за да реже сигурно цял рояк.
  megamine: {
    key: 'megamine',
    name: 'Мега-мини',
    texture: 'bomb',
    cooldown: 820,
    speed: -340,
    damage: 10,
    splash: 150,
    fullSplash: true,
    homing: false,
    tint: 0xff3b3b
  }
};

// Подреден списък за превключване (UI бутон „смени оръжие").
export const WEAPON_ORDER = ['bullet', 'bomb', 'missile', 'megamine'];
