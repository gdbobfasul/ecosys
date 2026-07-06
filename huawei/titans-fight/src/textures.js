// Version: 1.0001
import Phaser from 'phaser';
// Процедурно генериране на ВСИЧКИ текстури в кода (без външни картинки).
// Използваме Phaser.Graphics + generateTexture, за да направим спрайтове за
// частите на титаните, оръжията, снарядите и частиците.
//
// Тялото на титана е съставено от отделни части (торс, глава, ръка, крак),
// за да можем да ги анимираме като ставни крайници (procedural rig).
//
// ЦЕЛ НА ДИЗАЙНА: всеки титан да изглежда като ОГРОМНО, древно, мистично
// същество — каменен/огнен/леден/бурен/сенчест/природен колос, а НЕ като
// драскулка от кутийки и кръгчета. Затова всяка част има:
//   - многослойно засенчване (не плоско),
//   - скален/брониран релеф (плочи, пукнатини, нитове),
//   - светещи руни и пукнатини в цвета на стихията,
//   - светещи очи и енергийна аура.

import { WEAPONS } from './weapons.js';

// ---------------------------------------------------------------------------
// ПОМОЩНИЦИ ЗА ЦВЯТ И ЗАСЕНЧВАНЕ
// ---------------------------------------------------------------------------

// Изсветлява/потъмнява цвят с дадена стъпка (-255..255).
function shade(color, amount) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const r = Phaser.Math.Clamp(Math.round(c.r + amount), 0, 255);
  const gg = Phaser.Math.Clamp(Math.round(c.g + amount), 0, 255);
  const b = Phaser.Math.Clamp(Math.round(c.b + amount), 0, 255);
  return Phaser.Display.Color.GetColor(r, gg, b);
}

// Смесва два цвята в съотношение t (0..1).
function mix(a, b, t) {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.IntegerToColor(a),
    Phaser.Display.Color.IntegerToColor(b),
    100, Math.round(t * 100)
  );
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

// Заоблен правоъгълник с ВЕРТИКАЛЕН градиент (Phaser няма native linear fill).
// Рисуваме на тънки хоризонтални резени, които се стесняват в краищата за заобляне.
function gradientRoundedRect(g, x, y, w, h, r, topColor, bottomColor) {
  const steps = Math.max(10, Math.floor(h / 2.5));
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const col = mix(topColor, bottomColor, t);
    const sliceY = y + t * h;
    const sliceH = (h / steps) + 1;
    let inset = 0;
    if (sliceY < y + r) inset = (1 - (sliceY - y) / r) * r * 0.5;
    else if (sliceY > y + h - r) inset = (1 - (y + h - sliceY) / r) * r * 0.5;
    g.fillStyle(col, 1);
    g.fillRect(x + inset, sliceY, w - inset * 2, sliceH);
  }
}

// Мек вътрешен блясък (rim light) — изсветляваща линия по горния ляв ръб,
// за да усетим обем и каменно/метално отражение.
function rimLight(g, x, y, w, h, r, color) {
  g.lineStyle(3, color, 0.35);
  g.beginPath();
  g.moveTo(x + r, y + 2);
  g.lineTo(x + w - r, y + 2);
  g.strokePath();
  g.lineStyle(2, color, 0.22);
  g.beginPath();
  g.moveTo(x + 2, y + r);
  g.lineTo(x + 2, y + h - r);
  g.strokePath();
}

// Светеща линия (руна/пукнатина) с ореол: рисуваме дебела мъглява линия отдолу
// и ярка тънка отгоре, за да "грее".
function glowStroke(g, pts, color, coreWidth) {
  // ореол
  g.lineStyle(coreWidth + 5, color, 0.18);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.strokePath();
  // ядро
  g.lineStyle(coreWidth, color, 0.95);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.strokePath();
  // ярко бяло сърце
  g.lineStyle(Math.max(1, coreWidth - 1.5), 0xffffff, 0.7);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.strokePath();
}

// Светеща точка с ореол (за очи, ядра, рунически камъни).
function glowDot(g, x, y, r, color) {
  g.fillStyle(color, 0.20); g.fillCircle(x, y, r * 2.0);
  g.fillStyle(color, 0.45); g.fillCircle(x, y, r * 1.4);
  g.fillStyle(color, 1);    g.fillCircle(x, y, r);
  g.fillStyle(0xffffff, 0.9); g.fillCircle(x, y, r * 0.45);
}

// Назъбена пукнатина между две точки (за светещи разломи по бронята/камъка).
function crackPath(x1, y1, x2, y2, segs, jitter) {
  const pts = [[x1, y1]];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jx = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 2 - 1;
    const jy = (Math.sin(i * 78.233) * 12345.678 % 1) * 2 - 1;
    pts.push([x1 + (x2 - x1) * t + jx * jitter, y1 + (y2 - y1) * t + jy * jitter]);
  }
  pts.push([x2, y2]);
  return pts;
}

// ---------------------------------------------------------------------------
// ПОМОЩНИЦИ ЗА ОРГАНИЧНИ ФОРМИ (силуети на същество, НЕ правоъгълници)
// ---------------------------------------------------------------------------
// Phaser.Graphics няма безие — кривите се приближават с много къси отсечки,
// смятани от sin/cos. Всичко тяло на титана се рисува като ЗАПЪЛНЕНИ полигони
// с назъбени/извити ръбове, за да чете като жива, мускулеста, скална плът.

// Запълва затворен полигон от точки [[x,y],...] с даден цвят.
function fillPoly(g, pts, color, alpha = 1) {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillPath();
}

// Очертава контура на полигон (за гравиран ръб/релеф).
function strokePoly(g, pts, width, color, alpha = 1, closed = true) {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (closed) g.closePath();
  g.strokePath();
}

// Запълва полигон с ВЕРТИКАЛЕН градиент чрез наслагване на резени (clip-режим
// през scissor не е наличен в make.graphics, затова чертаем самия силует на
// слоеве с леко свиване и потъмняване — създава обемна, "издута" плът).
// pts = външен контур; cx,cy = център за свиване навътре.
function fillPolyShaded(g, pts, cx, cy, topColor, botColor, layers = 7) {
  // Намираме min/max Y за нормализиране на засенчването по височина.
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  const span = Math.max(1, maxY - minY);
  // Чертаем от тъмната основа към светлия връх, всеки слой леко свит навътре,
  // така че по-светлите слоеве остават като централно "издуто" осветяване.
  for (let l = 0; l < layers; l++) {
    const t = l / (layers - 1);                 // 0 (външен/тъмен) → 1 (вътрешен/светъл)
    const k = t * 0.5;                          // свиване навътре към центъра
    const col = mix(botColor, topColor, t);
    const lp = pts.map(([px, py]) => {
      // по-високите точки получават повече от светлия цвят (горно осветяване)
      const hy = 1 - (py - minY) / span;
      const kk = k * (0.6 + hy * 0.8);
      return [px + (cx - px) * kk, py + (cy - py) * kk];
    });
    const c2 = mix(col, topColor, Math.min(1, t * 0.4));
    fillPoly(g, lp, c2, 1);
  }
}

// Дъга/извивка от точки — за рога, нокти, гръбни шипове.
// Връща масив [[x,y],...] по квадратична крива (3 котви) с n сегмента.
function arcPts(x0, y0, x1, y1, x2, y2, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * x1 + t * t * x2;
    const y = u * u * y0 + 2 * u * t * y1 + t * t * y2;
    pts.push([x, y]);
  }
  return pts;
}

// Извит, заострен ШИП/РОГ: дебел в основата, остър на върха. base сочи къде
// е "корена" (две точки), tip е върхът; bend огъва формата настрани.
function spike(g, bx, by, tipX, tipY, halfW, bend, fillCol, edgeCol) {
  // Управляваща точка по средата, изместена настрани за извивка.
  const mx = (bx + tipX) / 2 + bend;
  const my = (by + tipY) / 2;
  const left  = arcPts(bx - halfW, by, mx - halfW * 0.4 + bend, my, tipX, tipY, 8);
  const right = arcPts(tipX, tipY, mx + halfW * 0.4 + bend, my, bx + halfW, by, 8);
  const pts = left.concat(right);
  fillPoly(g, pts, fillCol, 1);
  strokePoly(g, pts, 2, edgeCol, 0.7);
  // лек блясък по гръбнака на шипа
  glowStroke(g, [[bx, by], [mx + bend * 0.5, my], [tipX, tipY]], shade(fillCol, 60), 1.2);
}

// ---------------------------------------------------------------------------
// СТИХИЙНИ ТЕМИ НА ТИТАНИТЕ
// ---------------------------------------------------------------------------
// Всяка тема дефинира палитра и характер на стихията. Тялото е каменно/брониран
// колос; цветовете на руните/очите/аурата задават стихията.
//   base  — основен цвят на "плътта"/камъка/бронята
//   edge  — цвят на ръбовете/гравюрите
//   rune  — цвят на светещите руни и пукнатини
//   eye   — цвят на очите
//   aura  — цвят на енергийната аура (за glow зад титана)
export const TITAN_THEMES = {
  // КАМЕНЕН колос — сив гранит, кехлибарени руни.
  stone:  { base: 0x6b6f76, edge: 0x9aa0a8, rune: 0xffb14a, eye: 0xffd060, aura: 0xffb14a },
  // ОГНЕН/МАГМЕН колос — обсидиан с нажежени магмени разломи.
  magma:  { base: 0x3a2622, edge: 0x7a4030, rune: 0xff5a1e, eye: 0xffd24a, aura: 0xff5a1e },
  // ЛЕДЕН колос — синкав лед/кристал, студено сияние.
  ice:    { base: 0x4a6b8c, edge: 0xbfe6ff, rune: 0x8fe8ff, eye: 0xd8f6ff, aura: 0x7cd8ff },
  // БУРЕН/МЪЛНИЕН колос — буреносно сиво-синьо с електрически руни.
  storm:  { base: 0x3c4466, edge: 0x9fb0e0, rune: 0xb088ff, eye: 0xe0d0ff, aura: 0xb088ff },
  // СЕНЧЕСТ колос — почти черен камък с виолетово-пурпурно сияние.
  shadow: { base: 0x2a2336, edge: 0x6a5a8a, rune: 0xc04cff, eye: 0xff5cf0, aura: 0xc04cff },
  // ПРИРОДЕН/МЪХЕСТ колос — древен камък обрасъл, изумрудени руни.
  nature: { base: 0x3a5236, edge: 0x7aa05a, rune: 0x6cff8a, eye: 0xb0ff70, aura: 0x6cff8a }
};

// ---------------------------------------------------------------------------
// ИЗГРАЖДАНЕ НА ЕДИН ТИТАН (комплект части под даден prefix)
// ---------------------------------------------------------------------------
// Запазваме СЪЩИТЕ ключове и размери като преди, за да не чупим rig-а:
//   ${prefix}_torso  120x150 (origin 0.5,0)
//   ${prefix}_head    84x88  (origin 0.5,1)
//   ${prefix}_arm     50x96  (origin 0.5,0.12)
//   ${prefix}_fist    56x56  (origin 0.5,0.5)
//   ${prefix}_leg     62x110 (origin 0.5,0)
//
// theme = обект от TITAN_THEMES (или съвместимо: {base, edge, rune, eye, aura}).
function buildTitan(scene, prefix, theme) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // МИТОЛОГИЧЕН ГОЛ ТИТАН — землиста МУСКУЛЕСТА кожа с каменни жили (не механо/демон).
  // Цветовете от theme стават: кожа (землист тон), жили (светещи разломи), очи.
  const skin   = theme.edge;                 // светъл землист кожен тон (варира по стихия)
  const base   = theme.base;                 // сянка/дълбочина на кожата
  const vein   = theme.rune;                 // светещи КАМЕННИ ЖИЛИ по кожата
  const eye     = theme.eye;
  const skinLt = shade(skin, 40);            // осветена кожа (мускулни хълбоци)
  const skinDk = shade(base, -10);           // сянка между мускулите
  const darker = shade(base, -70);           // контур
  const hair   = shade(base, -30);           // коса/брада (тъмна)

  // ---------------------------------------------------------------- ТОРС
  // ГОЛ мускулест мъжки торс: широки рамене (делтоиди) → гръден кош (2 pec-а) →
  // коремни мускули (six-pack) → тесен кръст → таз. Каменни ЖИЛИ вместо руни/ядро.
  g.clear();
  const TW = 120, TH = 150;
  const cxT = TW / 2;
  const torsoSil = [
    [18, 26],            // ляв делтоид (рамо)
    [10, 12], [34, 4],   // връх на рамото
    [cxT - 16, 12],      // трапец към врата
    [cxT + 16, 12],
    [TW - 34, 4], [TW - 10, 12],
    [TW - 18, 26],       // десен делтоид
    [TW - 20, 62],       // латерален гръден мускул
    [TW - 30, 104],      // стеснение към кръста (талия)
    [TW - 30, TH - 16],  // десен хълбок/таз
    [cxT + 12, TH - 4],
    [cxT - 12, TH - 4],
    [30, TH - 16],
    [30, 104],
    [20, 62]
  ];
  fillPolyShaded(g, torsoSil, cxT, 84, skinLt, darker, 8);
  strokePoly(g, torsoSil, 3, darker, 0.5);
  strokePoly(g, torsoSil, 1.5, shade(skin, 20), 0.6);

  // Гръдни мускули (2 заоблени pec-а) с бразда между тях
  const pecL = arcPts(cxT - 2, 34, 20, 48, 26, 84, 8).concat([[cxT - 4, 82], [cxT - 2, 34]]);
  const pecR = arcPts(cxT + 2, 34, TW - 20, 48, TW - 26, 84, 8).concat([[cxT + 4, 82], [cxT + 2, 34]]);
  fillPoly(g, pecL, skinLt, 0.45); fillPoly(g, pecR, skinLt, 0.45);
  strokePoly(g, pecL, 1.8, skinDk, 0.5); strokePoly(g, pecR, 1.8, skinDk, 0.5);
  g.lineStyle(2, skinDk, 0.55); g.beginPath(); g.moveTo(cxT, 40); g.lineTo(cxT, 86); g.strokePath(); // гръдна бразда
  // зърна (детайл)
  g.fillStyle(skinDk, 0.5); g.fillCircle(cxT - 15, 70, 2.4); g.fillCircle(cxT + 15, 70, 2.4);

  // КОРЕМНИ МУСКУЛИ (six-pack: 2 колони × 3 реда)
  g.lineStyle(2, skinDk, 0.5);
  g.beginPath(); g.moveTo(cxT, 88); g.lineTo(cxT, TH - 12); g.strokePath();          // linea alba
  [98, 112, 126].forEach((yy) => { g.beginPath(); g.moveTo(cxT - 22, yy); g.lineTo(cxT + 22, yy); g.strokePath(); });
  g.fillStyle(skinLt, 0.3);
  [[-11, 93], [11, 93], [-11, 105], [11, 105], [-11, 119], [11, 119]].forEach(([dx, yy]) => g.fillEllipse(cxT + dx, yy, 9, 6));
  g.fillStyle(darker, 0.5); g.fillCircle(cxT, 132, 2); // пъп

  // КАМЕННИ ЖИЛИ по кожата (светещи разломи — землист великан, не руни)
  glowStroke(g, crackPath(20, 40, 44, 70, 5, 5), vein, 1.6);
  glowStroke(g, crackPath(TW - 20, 40, TW - 44, 70, 5, 5), vein, 1.6);
  glowStroke(g, crackPath(cxT - 18, 96, cxT - 26, TH - 20, 5, 5), vein, 1.4);
  glowStroke(g, crackPath(cxT + 18, 96, cxT + 26, TH - 20, 5, 5), vein, 1.4);
  g.generateTexture(`${prefix}_torso`, TW, TH);

  // ---------------------------------------------------------------- ГЛАВА
  // ЧОВЕШКО лице на древен великан: чело, вежди, очи, нос, БРАДА и дълга КОСА.
  // origin (0.5,1): вратът сяда на торса → лицето долу, косата нагоре. Без рога/зъби.
  g.clear();
  const HW = 84, HH = 88;
  const cxH = HW / 2;

  // Дълга коса отзад (пада около лицето) — рисувана първо, зад главата
  fillPoly(g, [[cxH - 30, 16], [cxH - 36, 44], [cxH - 30, HH - 14], [cxH - 18, HH - 8],
               [cxH - 20, 40], [cxH - 14, 18]], hair, 1);
  fillPoly(g, [[cxH + 30, 16], [cxH + 36, 44], [cxH + 30, HH - 14], [cxH + 18, HH - 8],
               [cxH + 20, 40], [cxH + 14, 18]], hair, 1);

  // Силует на лицето (овал, стеснява се към брадичката)
  const face = [
    [cxH - 22, 34], [cxH - 24, 48], [cxH - 20, 62], [cxH - 12, HH - 18],
    [cxH, HH - 12], [cxH + 12, HH - 18], [cxH + 20, 62], [cxH + 24, 48],
    [cxH + 22, 34], [cxH + 14, 24], [cxH - 14, 24]
  ];
  fillPolyShaded(g, face, cxH, 52, skinLt, darker, 7);
  strokePoly(g, face, 2, darker, 0.45);

  // Коса отгоре (буйна, назад)
  fillPoly(g, [[cxH - 24, 34], [cxH - 20, 16], [cxH - 6, 8], [cxH + 8, 8],
               [cxH + 22, 16], [cxH + 24, 34], [cxH + 14, 24], [cxH - 14, 24]], hair, 1);
  g.lineStyle(1.5, shade(hair, -20), 0.5);
  [-14, -6, 2, 10].forEach((dx) => { g.beginPath(); g.moveTo(cxH + dx, 14); g.lineTo(cxH + dx * 1.3, 30); g.strokePath(); });

  // Вежди (изразителни)
  g.lineStyle(3, hair, 0.9);
  g.beginPath(); g.moveTo(cxH - 20, 44); g.lineTo(cxH - 6, 42); g.strokePath();
  g.beginPath(); g.moveTo(cxH + 6, 42); g.lineTo(cxH + 20, 44); g.strokePath();
  // Очи (човешки, леко светещи)
  g.fillStyle(0xffffff, 0.92); g.fillEllipse(cxH - 12, 50, 6, 4); g.fillEllipse(cxH + 12, 50, 6, 4);
  glowDot(g, cxH - 12, 50, 2.6, eye); glowDot(g, cxH + 12, 50, 2.6, eye);
  g.fillStyle(0x0a0a0a, 1); g.fillCircle(cxH - 12, 50, 1.4); g.fillCircle(cxH + 12, 50, 1.4);
  // Нос
  fillPoly(g, [[cxH, 50], [cxH - 4, 62], [cxH, 65], [cxH + 4, 62]], skinDk, 0.5);
  g.lineStyle(1.5, darker, 0.4); g.beginPath(); g.moveTo(cxH, 52); g.lineTo(cxH, 62); g.strokePath();
  // БРАДА (покрива долната част на лицето)
  fillPoly(g, [[cxH - 20, 62], [cxH - 16, HH - 8], [cxH, HH - 3], [cxH + 16, HH - 8],
               [cxH + 20, 62], [cxH + 12, 68], [cxH, 70], [cxH - 12, 68]], hair, 1);
  g.lineStyle(1.2, shade(hair, -25), 0.5);
  [-10, -3, 4, 11].forEach((dx) => { g.beginPath(); g.moveTo(cxH + dx, 66); g.lineTo(cxH + dx, HH - 6); g.strokePath(); });
  // мустак над устата
  g.fillStyle(hair, 0.9); g.fillEllipse(cxH, 64, 11, 3);
  // Каменна жила по слепоочието
  glowStroke(g, crackPath(cxH + 20, 40, cxH + 14, 56, 4, 3), vein, 1.3);
  g.generateTexture(`${prefix}_head`, HW, HH);

  // ------------------------------------------------------ ГОРНА РЪКА / РАМО
  // МУСКУЛЕСТА гола ръка: делтоид (рамо) → БИЦЕПС → предмишница → китка. Гладка
  // кожа с мускулно засенчване и жила; без шипове. Пивот ~0.12 (рамото горе).
  g.clear();
  const AW = 50, AH = 96;
  const cxA = AW / 2;
  const armSil = [
    [cxA - 20, 16],      // външен ръб на делтоида
    [cxA - 18, 4], [cxA + 4, 0], [cxA + 18, 6],  // рамо
    [cxA + 20, 22],      // делтоид
    [cxA + 16, 40],      // изпъкнал бицепс
    [cxA + 10, 52],      // лакът
    [cxA + 14, 70],      // предмишница
    [cxA + 11, AH - 6],  // китка
    [cxA - 9, AH - 4],
    [cxA - 13, 70],
    [cxA - 9, 52],
    [cxA - 16, 40],      // вътрешен бицепс
    [cxA - 18, 24]
  ];
  fillPolyShaded(g, armSil, cxA, AH * 0.34, skinLt, darker, 7);
  strokePoly(g, armSil, 2.2, darker, 0.45);
  // делтоидна и бицепсна бразда (мускулна дефиниция)
  g.lineStyle(1.6, skinDk, 0.5);
  g.beginPath(); g.moveTo(cxA - 4, 20); g.lineTo(cxA + 2, 40); g.strokePath();     // рамо→бицепс
  g.beginPath(); g.moveTo(cxA + 8, 40); g.lineTo(cxA + 4, 52); g.strokePath();     // бицепс връх
  g.fillStyle(skinLt, 0.28); g.fillEllipse(cxA + 2, 34, 8, 12);                    // осветен бицепс
  glowStroke(g, crackPath(cxA, 30, cxA + 2, AH - 14, 4, 3), vein, 1.3);
  g.generateTexture(`${prefix}_arm`, AW, AH);

  // ---------------------------------------------------------------- ЮМРУК
  // ЧОВЕШКИ свит юмрук: заоблена длан + 4 кокалчета отгоре + палец отстрани.
  // Без нокти/талони. origin центриран.
  g.clear();
  const FW = 56;
  const cxF = FW / 2, cyF = FW / 2;
  const palm = [
    [cxF - 16, cyF - 8], [cxF - 10, cyF - 16], [cxF + 12, cyF - 16],
    [cxF + 18, cyF - 6], [cxF + 18, cyF + 8], [cxF + 10, cyF + 16],
    [cxF - 10, cyF + 16], [cxF - 17, cyF + 6]
  ];
  fillPolyShaded(g, palm, cxF, cyF, skinLt, darker, 6);
  strokePoly(g, palm, 2, darker, 0.5);
  // 4 кокалчета (изпъкналости) на горния ръб
  g.fillStyle(skinLt, 0.5);
  [-11, -4, 3, 10].forEach((dx) => g.fillCircle(cxF + dx, cyF - 12, 3.2));
  g.lineStyle(1.4, skinDk, 0.5);
  [-7, 0, 7].forEach((dx) => { g.beginPath(); g.moveTo(cxF + dx, cyF - 14); g.lineTo(cxF + dx, cyF + 2); g.strokePath(); }); // пръсти
  // палец отстрани (заоблен, свит)
  fillPoly(g, [[cxF + 15, cyF - 2], [cxF + 24, cyF + 2], [cxF + 22, cyF + 10], [cxF + 14, cyF + 8]], skinLt, 1);
  strokePoly(g, [[cxF + 15, cyF - 2], [cxF + 24, cyF + 2], [cxF + 22, cyF + 10], [cxF + 14, cyF + 8]], 1.5, darker, 0.4);
  glowDot(g, cxF - 2, cyF - 12, 2, vein);
  g.generateTexture(`${prefix}_fist`, FW, FW);

  // ---------------------------------------------------------------- КРАК
  // ЧОВЕШКИ мускулест крак: бедро (quadriceps) → коляно НАПРЕД → прасец → глезен →
  // БОСО стъпало с пръсти. origin (0.5,0): бедрото горе. Права анатомия, не звярска.
  g.clear();
  const LW = 52, LH = 110;
  const cxL = (LW + 10) / 2;
  const legSil = [
    [cxL - 16, 4], [cxL + 16, 4],        // таз/бедро горе
    [cxL + 19, LH * 0.28],               // изпъкнало външно бедро (quadriceps)
    [cxL + 12, LH * 0.46],               // коляно
    [cxL + 15, LH * 0.6],                // прасец (calf)
    [cxL + 9, LH * 0.82],                // глезен
    [cxL + 20, LH - 4],                  // стъпало напред (пръсти)
    [cxL - 14, LH - 4],                  // пета
    [cxL - 8, LH * 0.82],                // вътрешен глезен
    [cxL - 13, LH * 0.6],                // вътрешен прасец
    [cxL - 10, LH * 0.46],
    [cxL - 18, LH * 0.28]                // вътрешно бедро
  ];
  fillPolyShaded(g, legSil, cxL, LH * 0.4, skinLt, darker, 8);
  strokePoly(g, legSil, 2.2, darker, 0.45);
  // мускулна дефиниция: quadriceps бразда + коляно + прасец
  g.lineStyle(1.6, skinDk, 0.5);
  g.beginPath(); g.moveTo(cxL - 2, 12); g.lineTo(cxL + 4, LH * 0.42); g.strokePath();  // бедрена бразда
  g.strokeCircle(cxL + 4, LH * 0.46, 6);                                                // капачка на коляното
  g.fillStyle(skinLt, 0.28); g.fillEllipse(cxL + 4, LH * 0.66, 7, 12);                 // осветен прасец
  // БОСО стъпало — пръсти отпред (заоблени, не нокти)
  g.fillStyle(skinLt, 1);
  [0, 6, 11, 15].forEach((dx, i) => g.fillCircle(cxL + 4 + dx, LH - 4, 3 - i * 0.4));
  g.lineStyle(1.4, darker, 0.4); g.beginPath(); g.moveTo(cxL - 12, LH - 6); g.lineTo(cxL + 18, LH - 6); g.strokePath();
  glowStroke(g, crackPath(cxL, 16, cxL + 2, LH * 0.55, 5, 4), vein, 1.3);
  g.generateTexture(`${prefix}_leg`, LW + 10, LH);

  g.destroy();
}

// Оръжия (държат се от юмрука; пивот в дръжката долу-ляво).
function buildWeapons(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // САБЯ
  g.clear();
  // острие (градиент)
  for (let i = 0; i < 110; i++) {
    const t = i / 109;
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(0xeaf6ff),
      Phaser.Display.Color.IntegerToColor(0x8ab4d8),
      109, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(18, 8 + i, 10 - t * 6, 2);
  }
  g.lineStyle(2, 0xffffff, 0.8);
  g.beginPath(); g.moveTo(23, 8); g.lineTo(20, 118); g.strokePath();
  // предпазител + дръжка
  g.fillStyle(WEAPONS.saber.color, 1);
  g.fillRect(8, 118, 30, 7);
  g.fillStyle(0x6a4a2a, 1);
  g.fillRect(20, 124, 7, 22);
  g.generateTexture('wpn_saber', 46, 150);

  // ЧУК
  g.clear();
  // дръжка
  g.fillStyle(0x6a4a2a, 1);
  g.fillRect(20, 30, 8, 110);
  g.lineStyle(2, 0x3a2a18, 1); g.strokeRect(20, 30, 8, 110);
  // глава на чука (метал градиент)
  gradientRoundedRect(g, 2, 4, 44, 36, 8, 0xe0c878, 0x8a6a2a);
  g.lineStyle(3, 0x5a3e16, 1);
  g.strokeRoundedRect(2, 4, 44, 36, 8);
  g.fillStyle(0xfff0c0, 0.5);
  g.fillRect(6, 8, 36, 6);
  g.generateTexture('wpn_hammer', 50, 146);

  // ГЮЛЕ (снаряд)
  g.clear();
  g.fillStyle(0x101014, 1);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0x44444c, 1);
  g.fillCircle(12, 12, 7);
  g.fillStyle(0x888890, 0.7);
  g.fillCircle(10, 10, 3);
  g.lineStyle(1.5, 0x000000, 0.6);
  g.strokeCircle(16, 16, 15);
  g.generateTexture('proj_cannonball', 32, 32);

  // БОМБА (снаряд)
  g.clear();
  g.fillStyle(0x1a1a20, 1);
  g.fillCircle(17, 19, 15);
  g.fillStyle(0x444450, 1);
  g.fillCircle(13, 15, 6);
  // фитил
  g.lineStyle(3, 0x8a6a2a, 1);
  g.beginPath(); g.moveTo(22, 7); g.lineTo(28, 1); g.strokePath();
  g.fillStyle(0xffaa20, 1); g.fillCircle(29, 1, 3);
  g.fillStyle(0xff4020, 1); g.fillCircle(29, 1, 1.6);
  g.lineStyle(1.5, 0x000000, 0.5);
  g.strokeCircle(17, 19, 15);
  g.generateTexture('proj_bomb', 36, 38);

  g.destroy();
}

// Меки кръгли частици (за искри, дим, взривове) с радиален gradient.
function buildParticles(scene) {
  // бяла мека точка
  let g = scene.make.graphics({ x: 0, y: 0, add: false });
  for (let r = 16; r > 0; r--) {
    const a = (r / 16);
    g.fillStyle(0xffffff, (1 - a) * 0.9 + 0.05);
    g.fillCircle(16, 16, r);
  }
  g.generateTexture('px_soft', 32, 32);
  g.destroy();

  // искра (малка ярка точка)
  g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('px_spark', 8, 8);
  g.destroy();

  // дим/прах (сив меки)
  g = scene.make.graphics({ x: 0, y: 0, add: false });
  for (let r = 16; r > 0; r--) {
    g.fillStyle(0xcfcfcf, (1 - r / 16) * 0.5);
    g.fillCircle(16, 16, r);
  }
  g.generateTexture('px_smoke', 32, 32);
  g.destroy();
}

// Текстура за слаб светлинен ореол (glow) зад титаните и при специален удар.
function buildGlow(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  for (let r = 64; r > 0; r--) {
    g.fillStyle(0xffffff, Math.pow(1 - r / 64, 2) * 0.5);
    g.fillCircle(64, 64, r);
  }
  g.generateTexture('px_glow', 128, 128);
  g.destroy();
}

// Главна функция — извиква се веднъж в BootScene.
// Генерира героя (играча) + по комплект части за ВСЯКА стихийна тема, така че
// различните нива да изправят играча срещу РАЗЛИЧНИ на вид титани.
export function generateTextures(scene, heroColor, heroEdge) {
  // Героят — топла "огнена" тема, но изграден със същата мистична техника.
  buildTitan(scene, 'hero', {
    base: heroColor, edge: heroEdge, rune: 0xffd24a, eye: 0xffe0a0, aura: heroColor
  });

  // Запазваме стария ключ 'enemy' (по подразбиране = каменен колос), за да не
  // се чупи нищо, което все още иска 'enemy_*'.
  buildTitan(scene, 'enemy', TITAN_THEMES.stone);

  // По комплект за всяка стихия: enemy_stone, enemy_magma, enemy_ice, ...
  for (const key of Object.keys(TITAN_THEMES)) {
    buildTitan(scene, `enemy_${key}`, TITAN_THEMES[key]);
  }

  buildWeapons(scene);
  buildParticles(scene);
  buildGlow(scene);
}
