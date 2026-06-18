import Phaser from 'phaser';
// Процедурно генериране на ВСИЧКИ текстури в кода (без външни картинки).
// Използваме Phaser.Graphics + generateTexture, за да направим спрайтове за
// частите на титаните, оръжията, снарядите и частиците.
//
// Тялото на титана е съставено от отделни части (торс, глава, ръка, крак),
// за да можем да ги анимираме като ставни крайници (procedural rig).

import { WEAPONS } from './weapons.js';

// Малък помощник: рисува заоблен правоъгълник със вертикален градиент чрез
// насложени линии (Phaser Graphics няма native linear gradient за fill).
function gradientRoundedRect(g, x, y, w, h, r, topColor, bottomColor) {
  const steps = Math.max(8, Math.floor(h / 3));
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(topColor),
      Phaser.Display.Color.IntegerToColor(bottomColor),
      steps - 1, i
    );
    const col = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    const sliceY = y + t * h;
    const sliceH = (h / steps) + 1;
    // Леко стесняване към краищата за заобляне
    let inset = 0;
    if (sliceY < y + r) inset = (1 - (sliceY - y) / r) * r * 0.5;
    else if (sliceY > y + h - r) inset = (1 - (y + h - sliceY) / r) * r * 0.5;
    g.fillStyle(col, 1);
    g.fillRect(x + inset, sliceY, w - inset * 2, sliceH);
  }
}

// Изсветлява/потъмнява цвят.
function shade(color, amount) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const r = Phaser.Math.Clamp(Math.round(c.r + amount), 0, 255);
  const gg = Phaser.Math.Clamp(Math.round(c.g + amount), 0, 255);
  const b = Phaser.Math.Clamp(Math.round(c.b + amount), 0, 255);
  return Phaser.Display.Color.GetColor(r, gg, b);
}

// Генерира всички текстури за ВНУШИТЕЛЕН, брониран титан с дадена основна боя.
// prefix = 'hero' или 'enemy'. Частите са едри, с метален градиент, заварени
// ръбове, нитове, шипове и светещи очи — за да изглеждат като истински титани,
// а не като драскулки.
function buildTitan(scene, prefix, bodyColor, edgeColor) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const dark = shade(bodyColor, -70);
  const light = shade(bodyColor, 70);

  // ---------------------------------------------------------------- ТОРС
  // Едър, бронирован гръден кош с пауплдрони, плочи и светещо ядро.
  g.clear();
  const TW = 120, TH = 150;
  // основна броня (вертикален метален градиент)
  gradientRoundedRect(g, 10, 6, TW - 20, TH - 16, 26, light, dark);
  // широки рамене / пауплдрони
  gradientRoundedRect(g, 0, 4, 40, 50, 18, light, shade(bodyColor, -30));
  gradientRoundedRect(g, TW - 40, 4, 40, 50, 18, light, shade(bodyColor, -30));
  // дебел заварен ръб
  g.lineStyle(5, edgeColor, 0.95);
  g.strokeRoundedRect(10, 6, TW - 20, TH - 16, 26);
  g.lineStyle(4, edgeColor, 0.85);
  g.strokeRoundedRect(0, 4, 40, 50, 18);
  g.strokeRoundedRect(TW - 40, 4, 40, 50, 18);
  // гръдни плочи (V-образен мускул/броня)
  g.fillStyle(shade(bodyColor, 40), 0.7);
  g.fillTriangle(TW / 2, 34, 30, 92, TW - 30, 92);
  g.lineStyle(3, edgeColor, 0.5);
  g.strokeTriangle(TW / 2, 34, 30, 92, TW - 30, 92);
  // светещо ядро в гърдите
  g.fillStyle(0xffffff, 0.95); g.fillCircle(TW / 2, 70, 11);
  g.fillStyle(edgeColor, 0.9); g.fillCircle(TW / 2, 70, 7);
  // нитове по бронята
  g.fillStyle(light, 0.9);
  [[26, 30], [TW - 26, 30], [26, TH - 30], [TW - 26, TH - 30]].forEach(([nx, ny]) => g.fillCircle(nx, ny, 4));
  // долен колан/плоча
  g.fillStyle(dark, 0.8);
  g.fillRoundedRect(20, TH - 34, TW - 40, 22, 8);
  g.generateTexture(`${prefix}_torso`, TW, TH);

  // ---------------------------------------------------------------- ГЛАВА
  // Боен шлем с гребен/рога, забрало и яростно светещи очи.
  g.clear();
  const HW = 84, HH = 88;
  gradientRoundedRect(g, 12, 14, HW - 24, HH - 22, 18, light, dark);
  g.lineStyle(4, edgeColor, 0.95);
  g.strokeRoundedRect(12, 14, HW - 24, HH - 22, 18);
  // забрало (тъмна лента за очите)
  g.fillStyle(0x0a0a12, 0.92);
  g.fillRoundedRect(16, 38, HW - 32, 22, 8);
  // светещи яростни очи
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(28, 50, 40, 44, 40, 56);
  g.fillTriangle(HW - 28, 50, HW - 40, 44, HW - 40, 56);
  g.fillStyle(0xff3020, 1);
  g.fillTriangle(30, 50, 39, 46, 39, 54);
  g.fillTriangle(HW - 30, 50, HW - 39, 46, HW - 39, 54);
  // централен гребен на шлема
  g.fillStyle(edgeColor, 0.95);
  g.fillTriangle(HW / 2, 0, HW / 2 - 9, 22, HW / 2 + 9, 22);
  // странични рога
  g.fillStyle(edgeColor, 0.9);
  g.fillTriangle(14, 22, 2, 6, 22, 18);
  g.fillTriangle(HW - 14, 22, HW - 2, 6, HW - 22, 18);
  // челюст/брадичка
  g.fillStyle(dark, 1);
  g.fillRoundedRect(22, HH - 26, HW - 44, 16, 6);
  g.generateTexture(`${prefix}_head`, HW, HH);

  // ------------------------------------------------------ ГОРНА РЪКА / РАМО
  // Дебела, мускулеста бронирана ръка (пивот горе) с наплечник и лента.
  g.clear();
  const AW = 50, AH = 96;
  gradientRoundedRect(g, 6, 4, AW - 12, AH - 8, 16, light, dark);
  g.lineStyle(4, edgeColor, 0.85);
  g.strokeRoundedRect(6, 4, AW - 12, AH - 8, 16);
  // наплечник горе
  gradientRoundedRect(g, 2, 2, AW - 4, 30, 14, light, shade(bodyColor, -20));
  g.lineStyle(3.5, edgeColor, 0.9);
  g.strokeRoundedRect(2, 2, AW - 4, 30, 14);
  // ленти/стави по ръката
  g.fillStyle(dark, 0.7);
  g.fillRoundedRect(8, AH * 0.55, AW - 16, 8, 4);
  g.generateTexture(`${prefix}_arm`, AW, AH);

  // ---------------------------------------------------------------- ЮМРУК
  // Голям брониран юмрук с кокалчета.
  g.clear();
  const FW = 56;
  g.fillStyle(shade(bodyColor, 20), 1);
  g.fillRoundedRect(6, 10, FW - 12, FW - 18, 12);
  g.lineStyle(4, edgeColor, 0.9);
  g.strokeRoundedRect(6, 10, FW - 12, FW - 18, 12);
  // кокалчета
  g.fillStyle(light, 0.95);
  for (let k = 0; k < 4; k++) g.fillCircle(13 + k * 10, 14, 4);
  // палец
  g.fillStyle(shade(bodyColor, -10), 1);
  g.fillRoundedRect(FW - 16, 20, 12, 18, 6);
  g.generateTexture(`${prefix}_fist`, FW, FW);

  // ---------------------------------------------------------------- КРАК
  // Масивен брониран крак с наколенник и тежко стъпало (пивот горе).
  g.clear();
  const LW = 52, LH = 110;
  gradientRoundedRect(g, 8, 4, LW - 16, LH - 28, 14, light, dark);
  g.lineStyle(4, edgeColor, 0.8);
  g.strokeRoundedRect(8, 4, LW - 16, LH - 28, 14);
  // наколенник
  g.fillStyle(light, 0.95); g.fillCircle(LW / 2, LH * 0.46, 11);
  g.lineStyle(3, edgeColor, 0.85); g.strokeCircle(LW / 2, LH * 0.46, 11);
  // тежко метално стъпало
  g.fillStyle(dark, 1);
  g.fillRoundedRect(2, LH - 30, LW + 6, 26, 8);
  g.lineStyle(3, edgeColor, 0.7);
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
export function generateTextures(scene, heroColor, heroEdge) {
  buildTitan(scene, 'hero', heroColor, heroEdge);
  // Противникът е по-студен/тъмен оттенък за контраст.
  buildTitan(scene, 'enemy', 0x8a4a6a, 0xffc0e0);
  buildWeapons(scene);
  buildParticles(scene);
  buildGlow(scene);
}
