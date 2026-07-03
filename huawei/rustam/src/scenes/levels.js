// Version: 1.0001
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

// holeGrowMs (скоростта на копаене на къртицата) сега ПЛАВНО намалява от ~2× по-бавно в
// началото (5200ms на ниво 1 = двойно повече време от старите 2600ms) до 1300ms на ниво 10.
// Кривата е почти линейна (стъпка ~430ms/ниво) → трудността расте плавно, а първите нива се
// минават лесно. Заедно с растящата скорост на Рустам (speedUp) и леко по-бързата база на ниво.
export const LEVELS = [
  { id: 1,  name: 'Градината',             quota: 8,  lives: 6, spawnEveryMs: [1600, 2400], maxActive: 1, holeGrowMs: 5200, moleSize: 46, holeSize: 52, accent: 0x6fae3a },
  { id: 2,  name: 'Лехите',                quota: 9,  lives: 6, spawnEveryMs: [1450, 2200], maxActive: 2, holeGrowMs: 4750, moleSize: 46, holeSize: 52, accent: 0x8fbe3a },
  { id: 3,  name: 'Ранна сутрин',          quota: 10, lives: 5, spawnEveryMs: [1300, 2000], maxActive: 2, holeGrowMs: 4300, moleSize: 46, holeSize: 52, accent: 0xb89a3a },
  { id: 4,  name: 'Бързата къртица',       quota: 12, lives: 5, spawnEveryMs: [1200, 1850], maxActive: 3, holeGrowMs: 3900, moleSize: 44, holeSize: 50, accent: 0xd0a83a },
  { id: 5,  name: 'Сухото поле',           quota: 13, lives: 5, spawnEveryMs: [1100, 1700], maxActive: 3, holeGrowMs: 3450, moleSize: 43, holeSize: 49, accent: 0xe0b34a },
  { id: 6,  name: 'Пладне',                quota: 15, lives: 4, spawnEveryMs: [1000, 1550], maxActive: 3, holeGrowMs: 3050, moleSize: 41, holeSize: 47, accent: 0xe0a23a },
  { id: 7,  name: 'Подземните тунели',     quota: 16, lives: 4, spawnEveryMs: [ 900, 1400], maxActive: 4, holeGrowMs: 2600, moleSize: 40, holeSize: 46, accent: 0xe0902b },
  { id: 8,  name: 'Нашествие',             quota: 18, lives: 4, spawnEveryMs: [ 820, 1300], maxActive: 4, holeGrowMs: 2150, moleSize: 38, holeSize: 44, accent: 0xd2702b },
  { id: 9,  name: 'Здрач',                 quota: 20, lives: 3, spawnEveryMs: [ 740, 1200], maxActive: 4, holeGrowMs: 1750, moleSize: 37, holeSize: 43, accent: 0xc8552b },
  { id: 10, name: 'Господарят на дупките', quota: 22, lives: 3, spawnEveryMs: [ 660, 1100], maxActive: 5, holeGrowMs: 1300, moleSize: 35, holeSize: 41, accent: 0xd0432b }
];

export const MAX_LEVEL = LEVELS.length;

// Връща конфигурацията на ниво по 1-базиран индекс (защитено).
export function getLevel(n) {
  const idx = Phaser.Math.Clamp(n, 1, MAX_LEVEL) - 1;
  return LEVELS[idx];
}
