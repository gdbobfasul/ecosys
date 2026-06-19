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

  const base = theme.base;
  const edge = theme.edge;
  const rune = theme.rune;
  const eye  = theme.eye;
  const dark   = shade(base, -55);
  const darker = shade(base, -90);
  const light  = shade(base, 55);

  // ---------------------------------------------------------------- ТОРС
  // Прегърбен гръден кош на КОЛОС: широки канари-рамене с гръбни шипове,
  // стесняване към тесен кръст, мускулно/скално плато с пукнатини и светещо
  // стихийно ядро в центъра. Леко асиметричен — жив, не машинен.
  g.clear();
  const TW = 120, TH = 150;
  const cxT = TW / 2;

  // Външен силует — прегърбен торс. Тръгваме от лявото рамо, по гръб надолу
  // до тесния кръст, после симетрично (с малка асиметрия) нагоре до дясно рамо.
  const torsoSil = [
    [14, 30],            // ляво рамо-канара
    [4, 14],             // връх на лявото рамо (по-високо)
    [30, 8],             // горна яка вляво
    [cxT - 14, 16],      // вдлъбнатина към врата
    [cxT + 14, 14],      // дясно врат
    [TW - 26, 6],        // дясна яка
    [TW - 4, 18],        // дясно рамо-канара (леко по-ниско → асиметрия)
    [TW - 12, 34],
    [TW - 22, 70],       // мускул на гръдния кош вдясно
    [TW - 30, 104],      // стесняване към кръста
    [TW - 36, TH - 12],  // десен хълбок
    [cxT + 10, TH - 4],  // долен ръб (тазобедрен)
    [cxT - 10, TH - 4],
    [34, TH - 12],       // ляв хълбок
    [28, 104],
    [22, 70],            // ляв гръден мускул
    [16, 40]
  ];
  // обемно засенчване (тъмен ръб → светло "издуто" ядро)
  fillPolyShaded(g, torsoSil, cxT, 78, light, darker, 8);
  // дълбок гравиран контур
  strokePoly(g, torsoSil, 4, darker, 0.55);
  strokePoly(g, torsoSil, 2.5, edge, 0.85);

  // гръбни шипове по двете рамене (извити навън)
  spike(g, 12, 22, -6, -2, 7, -4, dark, edge);
  spike(g, 26, 12, 18, -10, 6, -2, dark, edge);
  spike(g, TW - 12, 18, TW + 8, -2, 7, 4, dark, edge);
  spike(g, TW - 28, 10, TW - 18, -12, 6, 2, dark, edge);

  // гръдни плочи — два мускулни дяла (асиметрични криви), не V-кутия
  const pecL = arcPts(cxT - 4, 40, 22, 58, 30, 100, 8)
    .concat([[cxT - 6, 96], [cxT - 4, 40]]);
  const pecR = arcPts(cxT + 4, 40, TW - 22, 56, TW - 28, 100, 8)
    .concat([[cxT + 6, 96], [cxT + 4, 40]]);
  fillPoly(g, pecL, shade(base, 28), 0.5);
  fillPoly(g, pecR, shade(base, 28), 0.5);
  strokePoly(g, pecL, 2, darker, 0.4);
  strokePoly(g, pecR, 2, darker, 0.4);

  // мрежа от рунически пукнатини от ядрото нагоре/настрани (назъбени)
  glowStroke(g, crackPath(cxT, 72, 24, 22, 5, 6), rune, 2.2);
  glowStroke(g, crackPath(cxT, 72, TW - 22, 24, 5, 6), rune, 2.2);
  glowStroke(g, crackPath(cxT, 84, 34, TH - 16, 6, 7), rune, 2.2);
  glowStroke(g, crackPath(cxT, 84, TW - 32, TH - 16, 6, 7), rune, 2.2);

  // светещо стихийно ядро в гърдите (сърцето на колоса)
  glowDot(g, cxT, 74, 13, rune);
  // рунически камъни-нитове по плочите
  [[24, 38], [TW - 24, 36], [34, TH - 24], [TW - 34, TH - 24]].forEach(([nx, ny]) => {
    glowDot(g, nx, ny, 3, rune);
  });
  g.generateTexture(`${prefix}_torso`, TW, TH);

  // ---------------------------------------------------------------- ГЛАВА
  // Череп на рогат звяр: тежко чело, хлътнали яростни очи, заострена муцуна
  // с зъбата паст и големи извити назад рога. Асиметрично и заплашително.
  // origin (0.5,1): долният ръб на платното сяда върху врата на торса, затова
  // муцуната/челюстта са в долната половина, а рогата излизат нагоре.
  g.clear();
  const HW = 84, HH = 88;
  const cxH = HW / 2;

  // Голям извит рог вляво (изтеглен назад/нагоре) и вдясно — рисувани първи,
  // за да минат зад черепа.
  spike(g, 20, 30, 2, -6, 9, -10, dark, edge);
  spike(g, HW - 18, 28, HW - 2, -8, 9, 10, dark, edge);
  // вторични по-малки рогца над веждите
  spike(g, 30, 24, 22, 2, 5, -3, dark, edge);
  spike(g, HW - 30, 24, HW - 22, 2, 5, 3, dark, edge);

  // Силует на черепа: широко чело горе, стеснява се към заострена муцуна долу.
  const skull = [
    [cxH - 26, 26],      // ляво чело
    [cxH - 30, 40],      // скула
    [cxH - 22, 58],
    [cxH - 16, 70],      // стеснение към муцуната
    [cxH - 9, HH - 10],  // връх на муцуната вляво
    [cxH, HH - 4],       // зурла/брадичка (най-долу)
    [cxH + 9, HH - 10],
    [cxH + 17, 70],
    [cxH + 23, 58],
    [cxH + 31, 40],
    [cxH + 25, 26],      // дясно чело (леко по-малко → асиметрия)
    [cxH + 12, 18],      // гребен на черепа
    [cxH - 12, 18]
  ];
  fillPolyShaded(g, skull, cxH, 50, light, darker, 7);
  strokePoly(g, skull, 3.5, darker, 0.5);
  strokePoly(g, skull, 2, edge, 0.8);

  // тежка надочна вежда (костна греда) — хвърля сянка над очите
  const brow = [[cxH - 28, 40], [cxH - 6, 36], [cxH + 6, 36], [cxH + 28, 40],
                [cxH + 20, 48], [cxH, 45], [cxH - 20, 48]];
  fillPoly(g, brow, darker, 0.85);
  strokePoly(g, brow, 1.5, edge, 0.4);

  // хлътнали яростни очи (дълбоко в сянката, наклонени → гняв)
  g.fillStyle(0x05040a, 0.95);
  g.fillTriangle(cxH - 28, 50, cxH - 8, 48, cxH - 14, 60);
  g.fillTriangle(cxH + 28, 50, cxH + 8, 48, cxH + 14, 60);
  glowDot(g, cxH - 19, 53, 4.5, eye);
  glowDot(g, cxH + 19, 53, 4.5, eye);
  // ярка зеница-резка
  g.fillStyle(0xffffff, 0.9);
  g.fillTriangle(cxH - 24, 53, cxH - 14, 50, cxH - 15, 56);
  g.fillTriangle(cxH + 24, 53, cxH + 14, 50, cxH + 15, 56);

  // зъбата паст в муцуната (горни и долни кучешки зъби)
  g.fillStyle(0x09070e, 0.92);
  fillPoly(g, [[cxH - 12, 66], [cxH + 12, 66], [cxH + 8, HH - 12],
               [cxH, HH - 8], [cxH - 8, HH - 12]], 0x09070e, 0.92);
  g.fillStyle(0xf2ead8, 0.95);
  // горни зъби (надолу)
  [-9, -4, 1, 6].forEach((dx, i) => {
    const len = i % 2 ? 7 : 10;
    g.fillTriangle(cxH + dx - 2, 66, cxH + dx + 2, 66, cxH + dx, 66 + len);
  });
  // долни зъби (нагоре)
  [-7, -1, 5].forEach((dx) => {
    g.fillTriangle(cxH + dx - 2, HH - 9, cxH + dx + 2, HH - 9, cxH + dx, HH - 16);
  });

  // рунически белег на челото
  glowStroke(g, crackPath(cxH, 24, cxH, 34, 4, 1.5), rune, 1.8);
  glowDot(g, cxH, 22, 2.5, rune);
  // костни ребра по муцуната
  strokePoly(g, [[cxH - 14, 68], [cxH - 10, 74], [cxH - 6, 70]], 1.5, edge, 0.3, false);
  strokePoly(g, [[cxH + 14, 68], [cxH + 10, 74], [cxH + 6, 70]], 1.5, edge, 0.3, false);
  g.generateTexture(`${prefix}_head`, HW, HH);

  // ------------------------------------------------------ ГОРНА РЪКА / РАМО
  // Мускулеста звярска ръка: дебела канара-рамо горе (пивот ~0.12), стеснява
  // се към предмишницата, с няколко шипа и рунически разлом. Не цилиндър.
  g.clear();
  const AW = 50, AH = 96;
  const cxA = AW / 2;
  const armSil = [
    [cxA - 22, 14],      // външен ръб на рамото
    [cxA - 24, 4],       // връх на рамо-канарата
    [cxA - 6, 0],
    [cxA + 16, 2],       // горна яка
    [cxA + 22, 16],      // дясно рамо
    [cxA + 14, 40],      // стеснение към лакътя
    [cxA + 12, AH * 0.6],
    [cxA + 13, AH - 6],  // китка долу
    [cxA - 9, AH - 4],
    [cxA - 11, AH * 0.6],
    [cxA - 14, 42],
    [cxA - 20, 26]
  ];
  fillPolyShaded(g, armSil, cxA, AH * 0.4, light, darker, 7);
  strokePoly(g, armSil, 3, darker, 0.45);
  strokePoly(g, armSil, 2, edge, 0.8);
  // шипове по рамото и лакътя
  spike(g, cxA - 20, 12, cxA - 34, 2, 5, -3, dark, edge);
  spike(g, cxA + 18, 14, cxA + 30, 6, 5, 3, dark, edge);
  spike(g, cxA - 12, AH * 0.6, cxA - 22, AH * 0.6 + 8, 4, -2, dark, edge);
  // светещ камък на рамото + разлом по ръката
  glowDot(g, cxA, 14, 3.5, rune);
  glowStroke(g, crackPath(cxA, 30, cxA + 2, AH - 12, 5, 3), rune, 1.8);
  g.generateTexture(`${prefix}_arm`, AW, AH);

  // ---------------------------------------------------------------- ЮМРУК
  // Ноктеста лапа / канара-юмрук: грапава длан с няколко извити нокътя/талона
  // и светещи кокалчета. origin центриран.
  g.clear();
  const FW = 56;
  const cxF = FW / 2, cyF = FW / 2;
  // груба длан (неправилен многоъгълник, не кръг)
  const palm = [
    [cxF - 18, cyF - 6], [cxF - 12, cyF - 16], [cxF + 4, cyF - 18],
    [cxF + 16, cyF - 10], [cxF + 19, cyF + 4], [cxF + 12, cyF + 16],
    [cxF - 4, cyF + 18], [cxF - 16, cyF + 10]
  ];
  fillPolyShaded(g, palm, cxF, cyF, light, darker, 6);
  strokePoly(g, palm, 2.5, darker, 0.5);
  strokePoly(g, palm, 1.5, edge, 0.7);
  // извити нокти/талони, излизащи от горния ръб на лапата
  spike(g, cxF - 12, cyF - 14, cxF - 16, cyF - 28, 4, -2, dark, edge);
  spike(g, cxF - 2, cyF - 17, cxF - 3, cyF - 32, 4, 0, dark, edge);
  spike(g, cxF + 8, cyF - 15, cxF + 12, cyF - 29, 4, 2, dark, edge);
  // палец-нокът встрани
  spike(g, cxF + 16, cyF - 2, cxF + 28, cyF - 6, 4, 3, dark, edge);
  // светещи кокалчета
  [[cxF - 10, cyF - 8], [cxF - 1, cyF - 10], [cxF + 8, cyF - 7]].forEach(([kx, ky]) => {
    glowDot(g, kx, ky, 2.5, rune);
  });
  g.generateTexture(`${prefix}_fist`, FW, FW);

  // ---------------------------------------------------------------- КРАК
  // Дигитиграден звярски крак (обърнато коляно), стеснява се към глезена и
  // завършва с ноктеста/копитна стъпка. origin (0.5,0): бедрото горе, лапата
  // долу. Силно органична S-извивка, не прав стълб.
  g.clear();
  const LW = 52, LH = 110;
  const off = 5;                // платното е LW+10 широко; рисуваме с отместване
  const cxL = (LW + 10) / 2;
  // силует с обърнато коляно: бедро навън → коляно вътре → глезен навън → лапа
  const legSil = [
    [cxL - 16, 6],            // горна вътрешна част на бедрото
    [cxL - 20, 4],
    [cxL - 2, 2],            // тазобедрена става
    [cxL + 16, 6],          // външно бедро
    [cxL + 18, LH * 0.3],   // изпъкнало коляно навън
    [cxL + 6, LH * 0.5],    // прибиране навътре (обърнат стави)
    [cxL + 4, LH * 0.7],    // тънък глезен
    [cxL + 14, LH - 18],    // стъпване напред
    [cxL + 20, LH - 4],     // нокти отпред
    [cxL - 14, LH - 4],     // пета отзад
    [cxL - 10, LH - 18],
    [cxL - 6, LH * 0.7],    // вътрешен глезен
    [cxL - 8, LH * 0.5],
    [cxL - 18, LH * 0.32]   // вътрешно коляно/бедро
  ];
  fillPolyShaded(g, legSil, cxL, LH * 0.45, light, darker, 8);
  strokePoly(g, legSil, 3, darker, 0.45);
  strokePoly(g, legSil, 2, edge, 0.8);
  // петен шип (като при звяр)
  spike(g, cxL - 10, LH - 16, cxL - 22, LH - 22, 4, -3, dark, edge);
  // ноктести пръсти отпред на стъпката
  g.fillStyle(dark, 1);
  [0, 7, 14].forEach((dx) => {
    g.fillTriangle(cxL - 2 + dx, LH - 6, cxL + 4 + dx, LH - 6, cxL + 2 + dx, LH);
  });
  strokePoly(g, [[cxL - 2, LH - 6], [cxL + 18, LH - 6]], 1.5, edge, 0.4, false);
  // светещ камък на коляното + разлом по пищяла
  glowDot(g, cxL + 10, LH * 0.32, 4, rune);
  glowStroke(g, crackPath(cxL, 14, cxL + 2, LH - 22, 6, 4), rune, 1.8);
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
