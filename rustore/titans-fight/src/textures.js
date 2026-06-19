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
  // Масивен каменно-брониран гръден кош: широки рамене (пауплдрони), гръдни
  // плочи, светещо ядро между тях и мрежа от рунически пукнатини.
  g.clear();
  const TW = 120, TH = 150;

  // основен блок на торса (вертикален каменен градиент: светъл връх → тъмна основа)
  gradientRoundedRect(g, 10, 6, TW - 20, TH - 16, 26, light, darker);
  // вътрешна сянка по краищата (обем)
  g.lineStyle(8, darker, 0.5);
  g.strokeRoundedRect(13, 9, TW - 26, TH - 22, 23);
  // широки тежки рамене / пауплдрони
  gradientRoundedRect(g, -2, 2, 44, 54, 20, light, dark);
  gradientRoundedRect(g, TW - 42, 2, 44, 54, 20, light, dark);
  // дебел гравиран ръб по цялата броня
  g.lineStyle(5, edge, 0.9);
  g.strokeRoundedRect(10, 6, TW - 20, TH - 16, 26);
  g.lineStyle(4, edge, 0.85);
  g.strokeRoundedRect(-2, 2, 44, 54, 20);
  g.strokeRoundedRect(TW - 42, 2, 44, 54, 20);
  rimLight(g, 10, 6, TW - 20, TH - 16, 26, light);

  // гръдни плочи (V-образен релеф на броня/мускул)
  g.fillStyle(shade(base, 35), 0.65);
  g.fillTriangle(TW / 2, 34, 28, 96, TW - 28, 96);
  g.lineStyle(3, edge, 0.5);
  g.strokeTriangle(TW / 2, 34, 28, 96, TW - 28, 96);

  // рунически пукнатини, тръгващи от ядрото нагоре и встрани
  glowStroke(g, [[TW / 2, 70], [TW / 2 - 18, 40], [22, 24]], rune, 2.5);
  glowStroke(g, [[TW / 2, 70], [TW / 2 + 18, 40], [TW - 22, 24]], rune, 2.5);
  glowStroke(g, [[TW / 2, 80], [TW / 2 - 10, 112], [30, TH - 22]], rune, 2.5);
  glowStroke(g, [[TW / 2, 80], [TW / 2 + 10, 112], [TW - 30, TH - 22]], rune, 2.5);

  // светещо ядро в гърдите (сърцето на стихията)
  glowDot(g, TW / 2, 72, 12, rune);

  // рунически камъни (нитове) по бронята
  [[18, 28], [TW - 18, 28], [22, TH - 28], [TW - 22, TH - 28]].forEach(([nx, ny]) => {
    glowDot(g, nx, ny, 3.5, rune);
  });

  // долен брониран колан/плоча
  gradientRoundedRect(g, 18, TH - 36, TW - 36, 24, 9, dark, darker);
  g.lineStyle(3, edge, 0.6);
  g.strokeRoundedRect(18, TH - 36, TW - 36, 24, 9);
  g.generateTexture(`${prefix}_torso`, TW, TH);

  // ---------------------------------------------------------------- ГЛАВА
  // Древен шлем/лик: гребен, странични рога, тъмно забрало с яростно светещи
  // очи и рунически белег на челото.
  g.clear();
  const HW = 84, HH = 88;
  gradientRoundedRect(g, 12, 14, HW - 24, HH - 22, 18, light, darker);
  g.lineStyle(8, darker, 0.45);
  g.strokeRoundedRect(15, 17, HW - 30, HH - 28, 15);
  g.lineStyle(4, edge, 0.9);
  g.strokeRoundedRect(12, 14, HW - 24, HH - 22, 18);
  rimLight(g, 12, 14, HW - 24, HH - 22, 18, light);

  // централен гребен на шлема
  gradientRoundedRect(g, HW / 2 - 6, -2, 12, 26, 4, edge, dark);
  g.fillStyle(edge, 0.95);
  g.fillTriangle(HW / 2, -6, HW / 2 - 9, 18, HW / 2 + 9, 18);
  // странични извити рога
  g.fillStyle(edge, 0.92);
  g.fillTriangle(14, 24, 0, 2, 24, 18);
  g.fillTriangle(HW - 14, 24, HW, 2, HW - 24, 18);
  g.lineStyle(2, shade(edge, 40), 0.6);
  g.strokeTriangle(14, 24, 0, 2, 24, 18);
  g.strokeTriangle(HW - 14, 24, HW, 2, HW - 24, 18);

  // тъмно забрало (процеп за очите)
  g.fillStyle(0x07060c, 0.95);
  g.fillRoundedRect(16, 40, HW - 32, 22, 8);
  // яростно светещи очи (резки, не кръгчета)
  glowDot(g, 30, 51, 5, eye);
  glowDot(g, HW - 30, 51, 5, eye);
  g.fillStyle(0xffffff, 0.95);
  g.fillTriangle(24, 51, 36, 47, 36, 55);
  g.fillTriangle(HW - 24, 51, HW - 36, 47, HW - 36, 55);
  g.fillStyle(eye, 1);
  g.fillTriangle(26, 51, 35, 48, 35, 54);
  g.fillTriangle(HW - 26, 51, HW - 35, 48, HW - 35, 54);

  // рунически белег на челото
  glowStroke(g, [[HW / 2, 30], [HW / 2, 38]], rune, 2);
  glowDot(g, HW / 2, 27, 2.5, rune);

  // тежка челюст/брадичка
  gradientRoundedRect(g, 22, HH - 28, HW - 44, 18, 7, dark, darker);
  g.lineStyle(2.5, edge, 0.5);
  g.strokeRoundedRect(22, HH - 28, HW - 44, 18, 7);
  g.generateTexture(`${prefix}_head`, HW, HH);

  // ------------------------------------------------------ ГОРНА РЪКА / РАМО
  // Дебела каменна ръка (пивот горе) с наплечник, рунически разлом по дължината
  // и стави.
  g.clear();
  const AW = 50, AH = 96;
  gradientRoundedRect(g, 6, 4, AW - 12, AH - 8, 16, light, darker);
  g.lineStyle(6, darker, 0.4);
  g.strokeRoundedRect(9, 7, AW - 18, AH - 14, 13);
  g.lineStyle(4, edge, 0.85);
  g.strokeRoundedRect(6, 4, AW - 12, AH - 8, 16);
  rimLight(g, 6, 4, AW - 12, AH - 8, 16, light);
  // тежък наплечник горе
  gradientRoundedRect(g, 0, 0, AW, 32, 14, light, dark);
  g.lineStyle(3.5, edge, 0.9);
  g.strokeRoundedRect(0, 0, AW, 32, 14);
  glowDot(g, AW / 2, 15, 3.5, rune);
  // рунически разлом по ръката
  glowStroke(g, [[AW / 2, 34], [AW / 2 - 4, AH * 0.6], [AW / 2 + 2, AH - 10]], rune, 2);
  // ставна лента
  g.fillStyle(darker, 0.8);
  g.fillRoundedRect(8, AH * 0.56, AW - 16, 8, 4);
  g.generateTexture(`${prefix}_arm`, AW, AH);

  // ---------------------------------------------------------------- ЮМРУК
  // Голям каменен юмрук с рунически кокалчета.
  g.clear();
  const FW = 56;
  gradientRoundedRect(g, 6, 10, FW - 12, FW - 18, 12, light, darker);
  g.lineStyle(4, edge, 0.85);
  g.strokeRoundedRect(6, 10, FW - 12, FW - 18, 12);
  rimLight(g, 6, 10, FW - 12, FW - 18, 12, light);
  // светещи кокалчета
  for (let k = 0; k < 4; k++) glowDot(g, 13 + k * 10, 15, 3, rune);
  // палец
  gradientRoundedRect(g, FW - 16, 20, 12, 18, 6, light, dark);
  g.lineStyle(2.5, edge, 0.6);
  g.strokeRoundedRect(FW - 16, 20, 12, 18, 6);
  g.generateTexture(`${prefix}_fist`, FW, FW);

  // ---------------------------------------------------------------- КРАК
  // Масивен каменен крак с наколенник, рунически разлом и тежко стъпало.
  g.clear();
  const LW = 52, LH = 110;
  gradientRoundedRect(g, 8, 4, LW - 16, LH - 28, 14, light, darker);
  g.lineStyle(6, darker, 0.4);
  g.strokeRoundedRect(11, 7, LW - 22, LH - 34, 11);
  g.lineStyle(4, edge, 0.8);
  g.strokeRoundedRect(8, 4, LW - 16, LH - 28, 14);
  rimLight(g, 8, 4, LW - 16, LH - 28, 14, light);
  // рунически разлом по пищяла
  glowStroke(g, [[LW / 2, 14], [LW / 2 - 3, LH * 0.4], [LW / 2 + 2, LH - 36]], rune, 2);
  // наколенник (рунически камък)
  gradientRoundedRect(g, LW / 2 - 11, LH * 0.46 - 11, 22, 22, 11, light, dark);
  g.lineStyle(3, edge, 0.85); g.strokeCircle(LW / 2, LH * 0.46, 11);
  glowDot(g, LW / 2, LH * 0.46, 4, rune);
  // тежко каменно стъпало
  gradientRoundedRect(g, 2, LH - 30, LW + 6, 26, 8, dark, darker);
  g.lineStyle(3, edge, 0.7);
  g.strokeRoundedRect(2, LH - 30, LW + 6, 26, 8);
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
