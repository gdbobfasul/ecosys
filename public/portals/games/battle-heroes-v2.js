/* KCY Portals — Battle Heroes v2 (video-базирано)
   Version: 1.0094

   Данни за всеки герой:
   - HP, имена, ходове (V/B), специални умения (4-буквена комбинация)
   - Папки за анимациите (Closes-Attacks и die-Damage)
   - Mapping от damageType към reaction видео файл (с fallback верига)

   Файлова структура на assets/animations/:
     Closes-Attacks/{Duel|HMM}/{side}-{role}-{...}/{side}-{role}-{anim}.webm
     die-Damage/{Duel|HMM}/{side}-{role}-blood-fire-ice-root-electricity-death/{side}-{role}-{anim}.webm
     static-280x340/{role}-{side}-{w}-{h}.png

   damageType (какво се причинява на целта):
     bleeds | inFire | iceblocks | roots | electricity |
     sword-hit | axe-hit | hammer-hit | snake-hit | dragon-hit | dies

   Fallback верига при липсващо видео — изпробват се по ред, ползва се първото намерено.
*/
(function (global) {
'use strict';

/* ── ДРАКОН (само в team/HMM) ── */
var DRAGON = {
    id: 'dragon', name: 'Дракон', hp: 110, mode: 'HMM',
    moves: [
        { key: 'v', name: 'Огън', type: 'magic', target: 'one',
          attackAnim: ['attack3', 'attack4', 'attack231', 'attack244', 'attack233', 'spits'],
          damageType: 'inFire', projectile: 'fire' },
        { key: 'b', name: 'Захапка', type: 'melee', target: 'one',
          attackAnim: ['attack1', 'attack2', 'attack11', 'attack143'],
          damageType: 'bleeds' },
    ],
    specials: [
        { name: 'Огнен дъх по всички', target: 'all',
          attackAnim: ['special', 'special-3', 'special-MassFire', 'special-MassFire2'],
          damageType: 'inFire', projectile: 'fire-wave', color: '#ff7b2a' },
    ],
    video: {
        attackFolder: '{side}-dragon-flies-1fire-bite-massFire',
        damageFolder: '{side}-dragon-blood-fire-ice-root-electricity-death',
        fileBase: '{side}-dragon',
        states: {
            idle: ['idle', 'Idle'],
            walks: ['walk', 'runs', 'flies'],
        },
        reactions: {
            'inFire':       ['inFire', 'onFire', 'burns-inFire', 'dies-fire'],
            'bleeds':       ['bleeds', 'bleeds2', 'bleedsMassive', 'axes', 'axehit'],
            'dies':         ['dies', 'dies2', 'dies-fire', 'electricity-death'],
            'iceblocks':    ['iceblocks', 'iceBlocks', 'ice', 'ice2'],
            'roots':        ['roots'],
            'electricity':  ['electricity', 'electricity-death'],
            'sword-hit':    ['hurt-by-swords', 'swords', 'axes', 'bleeds'],
            'axe-hit':      ['axes', 'axehit', 'bleeds'],
            'hammer-hit':   ['bleedsMassive', 'bleeds2', 'bleeds'],
            'snake-hit':    ['bleeds', 'bleeds2', 'bleedsMassive'],
            'dragon-hit':   ['inFire', 'onFire'],
        },
        size: { width: 880, height: 446 },  // максимална display ширина за HMM
    },
};

/* ── МАГЬОСНИК (и в двете игри, но с различни папки) ── */
var MAGE = {
    id: 'mage', name: 'Магьосник', hp: 80,
    moves: [
        { key: 'v', name: 'Огнено кълбо', type: 'magic', target: 'one',
          attackAnim: { left: ['fires-smallFireball', 'fires-bigFireball', 'fires', 'attack1'],
                        right: ['attack1', 'specialIce'] },  // right mage — leden!
          damageType: { left: 'inFire', right: 'iceblocks' } },
        { key: 'b', name: 'Корени', type: 'magic', target: 'one',
          attackAnim: ['root-attack', 'roots', 'attack2'],
          damageType: 'roots' },
    ],
    specials: [
        { name: 'Вледеняване на всички', target: 'all',
          attackAnim: ['special1', 'freezesAll', 'freezeAll', 'specialIce'],
          damageType: 'iceblocks', projectile: 'ice', color: '#7fd8ff', freeze: true },
        { name: 'Електрически вълни', target: 'all',
          attackAnim: ['special2', 'electricAll', 'specialElectricity'],
          damageType: 'electricity', projectile: 'lightning', color: '#5b9bff' },
    ],
    video: {
        // папките са РАЗЛИЧНИ за left/right — left = огън, right = лед
        attackFolder: {
            left: '{side}-mage-generatesFire-smallfire-roots-freezeAll-electricAll',  // duel left
            left_HMM: '{side}-mage-generatesFire-smallfireball-roots-freezeAll-electricAll',
            right: '{side}-mage-generatesICE-smallIceball-roots-freezeAll-electricAll',
        },
        damageFolder: '{side}-mage-blood-fire-ice-root-electricity-death',
        fileBase: '{side}-mage',
        states: {
            idle: ['idle'],
            // магьосниците не се местят, но имаме walks-fallback
            walks: ['idle'],
        },
        reactions: {
            'inFire':       ['inFire', 'firesurrounded'],
            'bleeds':       ['bleeds', 'dies-strange'],
            'dies':         ['dies', 'dies-strange', 'dies2'],
            'iceblocks':    ['iceblocks', 'icee', 'ice-blocks-strange'],
            'roots':        ['roots', 'Roots-suffer'],
            'electricity':  ['electricity', 'electricShock', 'suffers'],
            'sword-hit':    ['sword', 'swords', 'swords2', 'swords-strange', 'axes'],
            'axe-hit':      ['axes', 'axes21'],
            'hammer-hit':   ['hit', 'bleeds', 'suffers'],
            'snake-hit':    ['snake', 'bleeds', 'hammer', 'swords'],
            'dragon-hit':   ['dragon', 'dragon2', 'inFire'],
        },
        size: { width: 360, height: 410 },
    },
};

/* ── ДЖУДЖЕ (само HMM) ── */
var DWARF = {
    id: 'dwarf', name: 'Джудже', hp: 95, mode: 'HMM',
    moves: [
        { key: 'v', name: 'Удар с брадва', type: 'melee', target: 'one',
          attackAnim: ['attack1', 'attack2'],
          damageType: 'axe-hit' },
    ],
    specials: [],
    video: {
        attackFolder: '{side}-dwarf-runs-strike1-strike2',
        damageFolder: '{side}-dwarf-blood-fire-ice-root-electricity-death',
        fileBase: '{side}-dwarf',
        states: {
            idle: ['idle'],
            walks: ['walk', 'runs', 'runs-rolls'],
        },
        reactions: {
            'inFire':       ['inFire'],
            'bleeds':       ['axes', 'sword', 'bleeds'],
            'dies':         ['dies', 'dies2'],
            'iceblocks':    ['ice', 'iceblocks'],
            'roots':        ['roots'],
            'electricity':  ['electricity', 'electricity2'],
            'sword-hit':    ['sword', 'axes'],
            'axe-hit':      ['axes'],
            'hammer-hit':   ['hammer', 'hammer-strange'],
            'snake-hit':    ['snakes'],
            'dragon-hit':   ['inFire', 'axes'],  // няма dragon-hit, ползва inFire
        },
        size: { width: 320, height: 280 },
    },
};

/* ── РИЦАР (само HMM) ── */
var KNIGHT = {
    id: 'knight', name: 'Рицар', hp: 105, mode: 'HMM',
    moves: [
        { key: 'v', name: 'Меч', type: 'melee', target: 'one',
          attackAnim: ['attack1', 'attack2'],
          damageType: 'sword-hit' },
    ],
    specials: [],
    video: {
        attackFolder: '{side}-knight-march-1strike-2strike',
        damageFolder: '{side}-knight-blood-fire-ice-root-electricity-death',
        fileBase: '{side}-knight',
        states: {
            idle: ['idle'],
            walks: ['walks', 'walk', 'march'],
        },
        reactions: {
            'inFire':       ['inFire'],
            'bleeds':       ['bleeds', 'axes', 'axes-hit', 'hurt'],
            'dies':         ['dies'],
            'iceblocks':    ['iceblocks'],
            'roots':        ['roots'],
            'electricity':  ['electricity'],
            'sword-hit':    ['axes-hit', 'axes', 'bleeds'],
            'axe-hit':      ['axes', 'axes-hit'],
            'hammer-hit':   ['hammer', 'bleeds', 'hurt'],
            'snake-hit':    ['snakes'],
            'dragon-hit':   ['dragon', 'dragon-hit', 'inFire', 'fireballs'],
        },
        size: { width: 340, height: 320 },
    },
};

/* ── МЕЧОНОСЕЦ (само Duel) ── */
var SWORDSMAN = {
    id: 'swordsman', name: 'Мечоносец', hp: 100, mode: 'Duel',
    moves: [
        { key: 'v', name: 'Ръгане', type: 'melee', target: 'one',
          attackAnim: ['attack1', 'attack2'],
          damageType: 'sword-hit' },
        { key: 'b', name: 'Посичане', type: 'melee', target: 'one',
          attackAnim: ['attack2-topbottom', 'attack2'],
          damageType: 'sword-hit' },
    ],
    specials: [
        { name: 'Меле — нарязва на салата', target: 'one',
          attackAnim: ['special', 'special-melee'],
          damageType: 'sword-hit', color: '#ff3322', executeAt: 0.30 },
    ],
    video: {
        attackFolder: '{side}-swordsman-Walks-StrikeButcher-StrikeTop-Mellee',
        damageFolder: '{side}-swordsman-blood-fire-ice-root-electricity-death',
        fileBase: '{side}-swordsman',
        states: {
            idle: ['idle', 'walk', 'attack1'],
            walks: ['walk', 'run', 'walks'],
        },
        reactions: {
            'inFire':       ['inFire'],
            'bleeds':       ['bleeds', 'bleeds2', 'blood', 'in-blood'],
            'dies':         ['dies', 'sword-Death'],
            'iceblocks':    ['iceblocks'],
            'roots':        ['roots'],
            'electricity':  ['electricity', 'electricity-hit'],
            'sword-hit':    ['sword', 'swordhit', 'axes-swords', 'hitByAxesSwords', 'axeshit', 'axeshit-2'],
            'axe-hit':      ['axes-swords', 'axeshit', 'hitByAxesSwords'],
            'hammer-hit':   ['hammer', 'hammerhit'],
            'snake-hit':    ['snake', 'snakes'],
            'dragon-hit':   ['inFire'],  // няма, ползва огън
        },
        size: { width: 380, height: 380 },
    },
};

/* ── ЗМИЙСКА ЖЕНА (само Duel) ── */
var SNAKEWOMAN = {
    id: 'snakewoman', name: 'Змийска жена', hp: 88, mode: 'Duel',
    moves: [
        { key: 'v', name: 'Удар + ухапване', type: 'melee', target: 'one',
          attackAnim: ['attack1', 'attack2', 'attack2-1', 'attack2-2', 'snakesbyte'],
          damageType: 'snake-hit' },
        { key: 'b', name: 'Камшичен удар', type: 'melee', target: 'one',
          attackAnim: ['attack2', 'attack2-2'],
          damageType: 'bleeds' },
    ],
    specials: [
        { name: 'Хвърля всички змии', target: 'all',
          attackAnim: ['special', 'special-allsnakes'],
          damageType: 'snake-hit', projectile: 'snakes', color: '#3ad07a' },
    ],
    video: {
        attackFolder: '{side}-snakewoman-Runs-SlapSBite-Whip-AllSnakes',
        damageFolder: {
            left: '{side}-snakewoman-blood-fire-ice-root-electricity-death',
            right: '{side}-snake-blood-fire-ice-root-electricity-death',  // папката е "snake"!
        },
        // имената на damage файловете също се различават
        damageFileBase: {
            left: 'left-snakewoman',
            right: 'right-snakewoman',  // макар че папката е "snake", файловете са "snakewoman"
        },
        fileBase: '{side}-snakewoman',
        states: {
            idle: ['idle', 'idle-attack2', 'walk'],
            walks: ['walk', 'run', 'runs', 'jumps'],
        },
        reactions: {
            'inFire':       ['inFire'],
            'bleeds':       ['bleeds', 'snake-bleeds', 'hit'],
            'dies':         ['dies', 'dies1', 'dies2'],
            'iceblocks':    ['ice', 'iceblocks'],
            'roots':        ['roots'],
            'electricity':  ['electricity'],
            'sword-hit':    ['sword-hit', 'sword-hit2'],
            'axe-hit':      ['axe-hit'],
            'hammer-hit':   ['hit', 'bleeds'],
            'snake-hit':    ['bleeds', 'hit'],
            'dragon-hit':   ['inFire'],
        },
        size: { width: 360, height: 400 },
    },
};

/* ── ЧУКАР (само Duel) ── */
var HAMMERMAN = {
    id: 'hammerman', name: 'Чукар', hp: 115, mode: 'Duel',
    moves: [
        { key: 'v', name: 'Замах', type: 'melee', target: 'one',
          attackAnim: ['attack1', 'attack133'],
          damageType: 'hammer-hit' },
        { key: 'b', name: 'Смазващ удар', type: 'melee', target: 'one',
          attackAnim: ['attack2', 'attack211'],
          damageType: 'hammer-hit' },
    ],
    specials: [
        { name: 'Разцепва земята', target: 'all',
          attackAnim: ['special', 'special-hitsground'],
          damageType: 'hammer-hit', projectile: 'quake', color: '#caa45a' },
    ],
    video: {
        attackFolder: '{side}-hammer-Walks-StrikeAhead-StrikeAside-Ground',
        damageFolder: '{side}-hammer-blood-fire-ice-root-electricity-death',
        fileBase: '{side}-hammer',
        states: {
            idle: ['idle', 'walk'],
            walks: ['walks', 'walk'],
        },
        reactions: {
            'inFire':       ['inFire', 'inFlames'],
            'bleeds':       ['bleeds-seriosly', 'bleeds1', 'bleeds2', 'hit'],
            'dies':         ['dies'],
            'iceblocks':    ['freezes-iceblocks', 'iceblocks'],
            'roots':        ['roots'],
            'electricity':  ['electricity', 'electricity33'],
            'sword-hit':    ['sword-hit', 'swords', 'axes'],
            'axe-hit':      ['axes', 'swords'],
            'hammer-hit':   ['hit', 'bleeds1', 'bleeds-seriosly'],
            'snake-hit':    ['snakes'],
            'dragon-hit':   ['inFire', 'inFlames'],
        },
        size: { width: 380, height: 440 },
    },
};

/* ── Експорт ── */
global.BATTLE_HEROES = {
    // отборна битка (HMM): дракон, магьосник, джудже, рицар
    team: [DRAGON, MAGE, DWARF, KNIGHT],
    // дуел: мечоносец, магьосник, змийска жена, чукар
    duel: [SWORDSMAN, MAGE, SNAKEWOMAN, HAMMERMAN],
};

})(window);
