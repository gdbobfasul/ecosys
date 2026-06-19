// 10-те нива на играта — изцяло data-driven.
// Трудността расте монотонно:
//  - hp: здраве на противника
//  - speed: скорост на движение на AI
//  - aggression: вероятност AI да напада (0..1) + по-малки паузи
//  - reaction: реакционно време на AI в ms (по-малко = по-умен)
//  - weapons: с какви оръжия разполага противникът (нови оръжия се добавят с нивата)
//  - specialChance: шанс за специален/комбо удар
//  - arena: визуална тема на арената (фон се сменя всяко ниво)
//  - heroBonusHp: бонус живот за играча (леко расте, за да е честно)
//  - titan: стихия на противниковия титан (вид на колоса) — задава кой
//           процедурен комплект части се ползва: 'stone' | 'magma' | 'ice' |
//           'storm' | 'shadow' | 'nature'. Така всяко ниво изправя играча
//           срещу РАЗЛИЧЕН на вид мистичен титан.

export const LEVELS = [
  {
    id: 1, name: 'НОВАК', hp: 70, speed: 120, aggression: 0.30, reaction: 620,
    weapons: ['fists'], specialChance: 0.02, heroBonusHp: 0, titan: 'stone',
    arena: { name: 'Изгрев', top: '#3a1c2e', bottom: '#120612', accent: 0xff8a5c, sky: 'dawn' }
  },
  {
    id: 2, name: 'БОЕЦ', hp: 90, speed: 135, aggression: 0.38, reaction: 560,
    weapons: ['fists', 'saber'], specialChance: 0.04, heroBonusHp: 0, titan: 'stone',
    arena: { name: 'Пустиня', top: '#4a2e16', bottom: '#1a0e06', accent: 0xffc060, sky: 'desert' }
  },
  {
    id: 3, name: 'ВОИН', hp: 110, speed: 150, aggression: 0.46, reaction: 500,
    weapons: ['saber', 'hammer'], specialChance: 0.06, heroBonusHp: 10, titan: 'nature',
    arena: { name: 'Гора', top: '#0e3a24', bottom: '#04120a', accent: 0x4cff9e, sky: 'forest' }
  },
  {
    id: 4, name: 'ЕЛИТ', hp: 135, speed: 165, aggression: 0.54, reaction: 450,
    weapons: ['saber', 'hammer', 'cannonball'], specialChance: 0.08, heroBonusHp: 10, titan: 'stone',
    arena: { name: 'Канион', top: '#3a2210', bottom: '#160a04', accent: 0xff9a3c, sky: 'canyon' }
  },
  {
    id: 5, name: 'ЗВЯР', hp: 160, speed: 178, aggression: 0.60, reaction: 410,
    weapons: ['hammer', 'cannonball'], specialChance: 0.10, heroBonusHp: 20, titan: 'magma',
    arena: { name: 'Вулкан', top: '#4a1208', bottom: '#180404', accent: 0xff3b2b, sky: 'volcano' }
  },
  {
    id: 6, name: 'ПАЛАДИН', hp: 190, speed: 190, aggression: 0.66, reaction: 370,
    weapons: ['saber', 'hammer', 'cannonball', 'bomb'], specialChance: 0.12, heroBonusHp: 20, titan: 'ice',
    arena: { name: 'Леден връх', top: '#0e2a4a', bottom: '#04101c', accent: 0x6cd8ff, sky: 'ice' }
  },
  {
    id: 7, name: 'ВОЕВОДА', hp: 220, speed: 205, aggression: 0.72, reaction: 330,
    weapons: ['hammer', 'cannonball', 'bomb'], specialChance: 0.15, heroBonusHp: 30, titan: 'storm',
    arena: { name: 'Буря', top: '#1a1c3a', bottom: '#060818', accent: 0xb088ff, sky: 'storm' }
  },
  {
    id: 8, name: 'ТИТАН', hp: 255, speed: 220, aggression: 0.78, reaction: 290,
    weapons: ['saber', 'hammer', 'cannonball', 'bomb'], specialChance: 0.18, heroBonusHp: 30, titan: 'stone',
    arena: { name: 'Руини', top: '#2a2630', bottom: '#0c0a10', accent: 0xc0c0d0, sky: 'ruins' }
  },
  {
    id: 9, name: 'ПОВЕЛИТЕЛ', hp: 295, speed: 235, aggression: 0.85, reaction: 250,
    weapons: ['hammer', 'cannonball', 'bomb'], specialChance: 0.22, heroBonusHp: 40, titan: 'shadow',
    arena: { name: 'Бездна', top: '#2a0a3a', bottom: '#0a0414', accent: 0xff4ccf, sky: 'abyss' }
  },
  {
    id: 10, name: 'БОГ НА ВОЙНАТА', hp: 360, speed: 255, aggression: 0.92, reaction: 210,
    weapons: ['saber', 'hammer', 'cannonball', 'bomb'], specialChance: 0.28, heroBonusHp: 50, titan: 'storm',
    arena: { name: 'Небесен трон', top: '#3a2e0a', bottom: '#120e04', accent: 0xffd24a, sky: 'heaven' }
  }
];

export const HERO_BASE_HP = 100;
export const TOTAL_LEVELS = LEVELS.length;

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}
