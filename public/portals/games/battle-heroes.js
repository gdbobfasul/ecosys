/* Pupikes Portals — Battle Heroes (дефиниции + рисуване)
   Version: 1.0093
   7 героя, нарисувани с canvas форми. Координатна система: центриран в (0,0),
   стъпил на земята около y=+40, височина ~80px. facing се прави от engine-а.
*/
(function (global) {
'use strict';

function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ── рисувателни части ── */
function head(ctx, skin) {
    ctx.fillStyle = skin || '#ffd9a8';
    ctx.beginPath(); ctx.arc(0, -28, 11, 0, 7); ctx.fill();
}
function body(ctx, color) {
    ctx.fillStyle = color;
    rr(ctx, -12, -16, 24, 34, 7); ctx.fill();
}
function legs(ctx, color) {
    ctx.fillStyle = color || '#2c3e50';
    rr(ctx, -10, 18, 8, 22, 3); ctx.fill();
    rr(ctx, 2, 18, 8, 22, 3); ctx.fill();
}

/* ── ДРАКОН ── */
function drawDragon(ctx) {
    // криле
    ctx.fillStyle = '#3a6b3a';
    ctx.beginPath();
    ctx.moveTo(-6, -18); ctx.lineTo(-34, -34); ctx.lineTo(-28, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, -10); ctx.lineTo(-30, 6); ctx.lineTo(-24, 18); ctx.closePath(); ctx.fill();
    // тяло
    var g = ctx.createLinearGradient(-14, 0, 14, 0);
    g.addColorStop(0, '#2e7d32'); g.addColorStop(.5, '#5cb85c'); g.addColorStop(1, '#2e7d32');
    ctx.fillStyle = g;
    rr(ctx, -14, -14, 28, 36, 10); ctx.fill();
    // корем
    ctx.fillStyle = '#cfe8b0';
    rr(ctx, -7, -6, 14, 24, 6); ctx.fill();
    // шия + глава
    ctx.fillStyle = '#5cb85c';
    rr(ctx, 4, -34, 12, 22, 6); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, -34, 12, 9, 0, 0, 7); ctx.fill();
    // рога
    ctx.fillStyle = '#e8e0c0'; ctx.strokeStyle = '#e8e0c0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(12, -42); ctx.lineTo(8, -52); ctx.stroke();
    // око
    ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(20, -36, 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(21, -36, 1.4, 0, 7); ctx.fill();
    // крака
    ctx.fillStyle = '#2e7d32';
    rr(ctx, -10, 18, 9, 16, 3); ctx.fill();
    rr(ctx, 3, 18, 9, 16, 3); ctx.fill();
    // опашка
    ctx.strokeStyle = '#5cb85c'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, 14); ctx.quadraticCurveTo(-30, 20, -26, 34); ctx.stroke();
}

/* ── МАГЬОСНИК ── */
function drawMage(ctx) {
    legs(ctx, '#3a2c5a');
    // мантия
    ctx.fillStyle = '#5a3a9a';
    ctx.beginPath();
    ctx.moveTo(-14, 22); ctx.lineTo(-10, -14); ctx.lineTo(10, -14); ctx.lineTo(14, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7b5cc0';
    rr(ctx, -10, -16, 20, 20, 6); ctx.fill();
    head(ctx);
    // брада
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.moveTo(-7, -24); ctx.lineTo(7, -24); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill();
    // островърха шапка
    ctx.fillStyle = '#3a2c5a';
    ctx.beginPath(); ctx.moveTo(-13, -34); ctx.lineTo(13, -34); ctx.lineTo(2, -58); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(2, -58, 3, 0, 7); ctx.fill();
    // тояга
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(14, 30); ctx.lineTo(18, -30); ctx.stroke();
    ctx.fillStyle = '#46c8ff'; ctx.shadowColor = '#46c8ff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(18, -33, 6, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
}

/* ── ДЖУДЖЕ (dwarf) ── */
function drawDwarf(ctx) {
    legs(ctx, '#3a2a1a');
    body(ctx, '#8a4a2a');
    // ризница
    ctx.fillStyle = '#7d8a96';
    rr(ctx, -11, -10, 22, 14, 4); ctx.fill();
    head(ctx);
    // голяма брада
    ctx.fillStyle = '#c8702a';
    ctx.beginPath(); ctx.moveTo(-10, -26); ctx.lineTo(10, -26); ctx.lineTo(6, -2); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill();
    // шлем
    ctx.fillStyle = '#5a6b78';
    ctx.beginPath(); ctx.arc(0, -32, 12, Math.PI, 0); ctx.fill();
    ctx.fillRect(-12, -33, 24, 4);
    // брадва
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(15, 26); ctx.lineTo(17, -16); ctx.stroke();
    ctx.fillStyle = '#b0bcc6';
    ctx.beginPath();
    ctx.moveTo(17, -18); ctx.quadraticCurveTo(34, -14, 30, 2);
    ctx.quadraticCurveTo(24, -6, 17, -4); ctx.closePath(); ctx.fill();
}

/* ── РИЦАР ── */
function drawKnight(ctx) {
    legs(ctx, '#4a5560');
    // броня
    var g = ctx.createLinearGradient(-13, 0, 13, 0);
    g.addColorStop(0, '#8a96a4'); g.addColorStop(.5, '#d0d8e0'); g.addColorStop(1, '#8a96a4');
    ctx.fillStyle = g;
    rr(ctx, -13, -16, 26, 36, 7); ctx.fill();
    // герб
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, 0); ctx.lineTo(0, 12); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
    // шлем
    ctx.fillStyle = '#b0bcc6';
    rr(ctx, -10, -40, 20, 22, 6); ctx.fill();
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(-7, -32, 14, 4);
    // перо
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(8, -52, 2, -58); ctx.quadraticCurveTo(-2, -50, 0, -40); ctx.fill();
    // щит
    ctx.fillStyle = '#5a6b78';
    ctx.beginPath();
    ctx.moveTo(-22, -8); ctx.lineTo(-10, -10); ctx.lineTo(-10, 14); ctx.lineTo(-16, 22); ctx.lineTo(-22, 14); ctx.closePath(); ctx.fill();
    // меч
    ctx.strokeStyle = '#e8eef2'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(15, 24); ctx.lineTo(20, -26); ctx.stroke();
    ctx.strokeStyle = '#c8a020'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(10, 16); ctx.lineTo(22, 16); ctx.stroke();
}

/* ── МЪЖ С МЕЧ (дуел) ── */
function drawSwordsman(ctx) {
    legs(ctx, '#3a2c20');
    body(ctx, '#7d3a2a');
    ctx.fillStyle = '#5a2c1a';
    rr(ctx, -12, -14, 24, 12, 4); ctx.fill();
    head(ctx);
    // коса
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath(); ctx.arc(0, -30, 11, Math.PI, 0); ctx.fill();
    // лента на челото
    ctx.fillStyle = '#c0392b'; ctx.fillRect(-11, -32, 22, 4);
    // дълъг меч
    ctx.strokeStyle = '#eef2f5'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(14, 30); ctx.lineTo(26, -34); ctx.stroke();
    ctx.strokeStyle = '#c8a020'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(9, 18); ctx.lineTo(21, 16); ctx.stroke();
}

/* ── ЖЕНА СЪС ЗМИИ (дуел) ── */
function drawSnakeWoman(ctx) {
    legs(ctx, '#1a3a2a');
    // рокля
    ctx.fillStyle = '#1f7a4a';
    ctx.beginPath();
    ctx.moveTo(-14, 22); ctx.lineTo(-9, -14); ctx.lineTo(9, -14); ctx.lineTo(14, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2aa86a';
    rr(ctx, -9, -16, 18, 18, 6); ctx.fill();
    head(ctx, '#e8c9a0');
    // змии-коса
    ctx.strokeStyle = '#2aa86a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 7, -34);
        ctx.quadraticCurveTo(i * 14 - 6, -46, i * 10 + 4, -52);
        ctx.stroke();
        ctx.fillStyle = '#2aa86a';
        ctx.beginPath(); ctx.arc(i * 10 + 4, -52, 3, 0, 7); ctx.fill();
    }
    // очи
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-3, -28, 1.6, 0, 7); ctx.arc(4, -28, 1.6, 0, 7); ctx.fill();
}

/* ── МЪЖ С ЧУК (дуел) ── */
function drawHammerman(ctx) {
    legs(ctx, '#2c2c2c');
    body(ctx, '#4a4a52');
    // мускули/рамене
    ctx.fillStyle = '#5a5a64';
    ctx.beginPath(); ctx.arc(-12, -10, 8, 0, 7); ctx.arc(12, -10, 8, 0, 7); ctx.fill();
    head(ctx);
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath(); ctx.arc(0, -30, 11, Math.PI, 0); ctx.fill();
    // огромен чук
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(14, 32); ctx.lineTo(22, -22); ctx.stroke();
    var g = ctx.createLinearGradient(14, -36, 34, -36);
    g.addColorStop(0, '#9aa4ae'); g.addColorStop(.5, '#d8dee4'); g.addColorStop(1, '#7a848e');
    ctx.fillStyle = g;
    rr(ctx, 12, -38, 26, 22, 5); ctx.fill();
    ctx.fillStyle = '#6a747e'; ctx.fillRect(12, -32, 26, 4);
}

/* ── ДЕФИНИЦИИ ── */
// special.apply(eng, attacker, foes) — foes = живите противници
function dmgAll(eng, foes, amount, color) {
    foes.forEach(function (f) {
        f.hp -= amount;
        eng.burst(f.x, f.y, color, 14);
    });
}

/* ── ДЕФИНИЦИИ ──
   Damage система (battle-engine смята реалните щети):
     type 'melee' → обикновен удар, 0-10% от макс HP на целта
     type 'magic' → магия, 10-20% от макс HP на целта
     специални    → 30-40% от макс HP на целта
   specials: масив — някои герои имат по 2 (всеки със своя 4-буквена комбинация).
*/

var DRAGON = {
    id: 'dragon', name: 'Дракон', hp: 110, draw: drawDragon,
    moves: [
        { key: 'v', name: 'Огън', type: 'magic', target: 'one', anim: 'fire' },
        { key: 'b', name: 'Захапка', type: 'melee', target: 'one', anim: 'bite' },
    ],
    specials: [
        { name: 'Огнен дъх по всички', target: 'all', anim: 'fire-all', color: '#ff7b2a' },
    ],
};
var MAGE = {
    id: 'mage', name: 'Магьосник', hp: 80, draw: drawMage,
    moves: [
        { key: 'v', name: 'Огнено кълбо', type: 'magic', target: 'one', anim: 'fireball' },
        { key: 'b', name: 'Корени', type: 'magic', target: 'one', anim: 'roots' },
    ],
    specials: [
        { name: 'Вледеняване на всички', target: 'all', anim: 'freeze-all', color: '#7fd8ff', freeze: true },
        { name: 'Електрически сфери', target: 'all', anim: 'orbs-all', color: '#5b9bff' },
    ],
};
var DWARF = {
    id: 'dwarf', name: 'Джудже', hp: 95, draw: drawDwarf,
    moves: [
        { key: 'v', name: 'Удар с брадва', type: 'melee', target: 'one', anim: 'axe' },
    ],
    specials: [],
};
var KNIGHT = {
    id: 'knight', name: 'Рицар', hp: 105, draw: drawKnight,
    moves: [
        { key: 'v', name: 'Меч', type: 'melee', target: 'one', anim: 'sword' },
    ],
    specials: [],
};
var SWORDSMAN = {
    id: 'swordsman', name: 'Мечоносец', hp: 100, draw: drawSwordsman,
    moves: [
        { key: 'v', name: 'Ръгане', type: 'melee', target: 'one', anim: 'thrust' },
        { key: 'b', name: 'Посичане', type: 'melee', target: 'one', anim: 'slash' },
    ],
    specials: [
        // нарязва на салата — убива целта ако е на ≤30% от макс HP
        { name: 'Меле — нарязва на салата', target: 'one', anim: 'mince', color: '#ff3322', executeAt: 0.30 },
    ],
};
var SNAKEWOMAN = {
    id: 'snakewoman', name: 'Змийска жена', hp: 88, draw: drawSnakeWoman,
    moves: [
        { key: 'v', name: 'Удар + ухапване', type: 'melee', target: 'one', anim: 'snakebite' },
        { key: 'b', name: 'Камшичен удар', type: 'melee', target: 'one', anim: 'whip' },
    ],
    specials: [
        { name: 'Хвърля всички змии', target: 'all', anim: 'snakes-all', color: '#3ad07a' },
    ],
};
var HAMMERMAN = {
    id: 'hammerman', name: 'Чукар', hp: 115, draw: drawHammerman,
    moves: [
        { key: 'v', name: 'Замах', type: 'melee', target: 'one', anim: 'swing' },
        { key: 'b', name: 'Смазващ удар', type: 'melee', target: 'one', anim: 'crush' },
    ],
    specials: [
        { name: 'Разцепва земята', target: 'all', anim: 'quake-all', color: '#caa45a' },
    ],
};

global.BATTLE_HEROES = {
    // отборна битка: дракон, магьосник, джудже, рицар
    team: [DRAGON, MAGE, DWARF, KNIGHT],
    // дуел: мечоносец, магьосник, змийска жена, чукар
    duel: [SWORDSMAN, MAGE, SNAKEWOMAN, HAMMERMAN],
};

})(window);
