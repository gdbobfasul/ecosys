import Phaser from 'phaser';

// Данни за 10-те нива (data-driven трудност).
//
// Механика: краставици изскачат от земята. До всяка започва да расте ДУПКА — от
// малка точица постепенно се уголемява. Стигне ли пълен размер, от нея изскача
// КЪРТИЦА и прибира краставицата под земята (пропусната). Рустам трябва да я
// набере ПРЕДИ дупката да се напълни.
//
// Полета:
//  - id          : номер на нивото (1..10)
//  - name        : показвано име
//  - quota       : колко краставици трябва да набере, за да мине нивото
//  - lives       : колко пропускания (изядени от къртиците) се позволяват
//  - spawnEveryMs: [min,max] интервал между изскачащите краставици
//  - maxActive   : колко краставици може да има едновременно на полето
//  - holeGrowMs  : за колко време дупката расте до пълен размер = времето, в което
//                  Рустам трябва да стигне (по-малко = по-малко време)
//  - moleSize    : диаметър на къртицата (px). СЛЕД 3-то ниво намалява с 1-2 px на ниво.
//  - holeSize    : диаметър на дупката (px) = moleSize + малко (дупката е точно колкото
//                  трябва, за да се покаже къртицата) — значи и тя се смалява с moleSize.
//  - accent      : цвят за HUD/решетката (трудност)
//
// ЗАБЕЛЕЖКА за смаляването (искането на потребителя):
//   Нива 1-3: къртицата е едра (46 px). От ниво 4 нататък намалява с 1-2 px на всяко
//   следващо ниво: 44, 43, 41, 40, 38, 37, 35. Дупката следва къртицата (moleSize + 6),
//   а времето (holeGrowMs) също намалява — Рустам има все по-малко време.

export const LEVELS = [
  { id: 1,  name: 'Градината',             quota: 8,  lives: 6, spawnEveryMs: [1500, 2300], maxActive: 1, holeGrowMs: 2600, moleSize: 46, holeSize: 52, accent: 0x6fae3a },
  { id: 2,  name: 'Лехите',                quota: 9,  lives: 6, spawnEveryMs: [1400, 2100], maxActive: 2, holeGrowMs: 2450, moleSize: 46, holeSize: 52, accent: 0x8fbe3a },
  { id: 3,  name: 'Ранна сутрин',          quota: 10, lives: 5, spawnEveryMs: [1250, 1900], maxActive: 2, holeGrowMs: 2250, moleSize: 46, holeSize: 52, accent: 0xb89a3a },
  { id: 4,  name: 'Бързата къртица',       quota: 12, lives: 5, spawnEveryMs: [1150, 1750], maxActive: 3, holeGrowMs: 2050, moleSize: 44, holeSize: 50, accent: 0xd0a83a },
  { id: 5,  name: 'Сухото поле',           quota: 13, lives: 5, spawnEveryMs: [1050, 1600], maxActive: 3, holeGrowMs: 1900, moleSize: 43, holeSize: 49, accent: 0xe0b34a },
  { id: 6,  name: 'Пладне',                quota: 15, lives: 4, spawnEveryMs: [ 950, 1450], maxActive: 3, holeGrowMs: 1750, moleSize: 41, holeSize: 47, accent: 0xe0a23a },
  { id: 7,  name: 'Подземните тунели',     quota: 16, lives: 4, spawnEveryMs: [ 880, 1350], maxActive: 4, holeGrowMs: 1600, moleSize: 40, holeSize: 46, accent: 0xe0902b },
  { id: 8,  name: 'Нашествие',             quota: 18, lives: 4, spawnEveryMs: [ 800, 1250], maxActive: 4, holeGrowMs: 1450, moleSize: 38, holeSize: 44, accent: 0xd2702b },
  { id: 9,  name: 'Здрач',                 quota: 20, lives: 3, spawnEveryMs: [ 720, 1150], maxActive: 4, holeGrowMs: 1300, moleSize: 37, holeSize: 43, accent: 0xc8552b },
  { id: 10, name: 'Господарят на дупките', quota: 22, lives: 3, spawnEveryMs: [ 640, 1050], maxActive: 5, holeGrowMs: 1150, moleSize: 35, holeSize: 41, accent: 0xd0432b }
];

export const MAX_LEVEL = LEVELS.length;

// Връща конфигурацията на ниво по 1-базиран индекс (защитено).
export function getLevel(n) {
  const idx = Phaser.Math.Clamp(n, 1, MAX_LEVEL) - 1;
  return LEVELS[idx];
}
