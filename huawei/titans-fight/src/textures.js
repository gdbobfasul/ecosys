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

// Генерира всички текстури за титан с дадена основна боя (hero / enemy).
// prefix = 'hero' или 'enemy'.
function buildTitan(scene, prefix, bodyColor, edgeColor) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // --- ТОРС ---
  g.clear();
  gradientRoundedRect(g, 4, 4, 56, 72, 16, shade(bodyColor, 30), shade(bodyColor, -40));
  // броня-акцент
  g.lineStyle(4, edgeColor, 0.9);
  g.strokeRoundedRect(4, 4, 56, 72, 16);
  // гръден детайл
  g.fillStyle(shade(bodyColor, 60), 0.6);
  g.fillTriangle(32, 16, 20, 44, 44, 44);
  g.generateTexture(`${prefix}_torso`, 64, 80);

  // --- ГЛАВА (със светещи очи) ---
  g.clear();
  gradientRoundedRect(g, 4, 4, 40, 40, 12, shade(bodyColor, 40), shade(bodyColor, -20));
  g.lineStyle(3, edgeColor, 0.9);
  g.strokeRoundedRect(4, 4, 40, 40, 12);
  // очи (светещи)
  g.fillStyle(0xffffff, 1);
  g.fillCircle(17, 24, 4);
  g.fillCircle(31, 24, 4);
  g.fillStyle(0xff4040, 1);
  g.fillCircle(17, 24, 2.2);
  g.fillCircle(31, 24, 2.2);
  // шлемов гребен
  g.fillStyle(edgeColor, 0.8);
  g.fillTriangle(24, 0, 18, 8, 30, 8);
  g.generateTexture(`${prefix}_head`, 48, 48);

  // --- ГОРНА РЪКА / РАМО (пивот горе) ---
  g.clear();
  gradientRoundedRect(g, 2, 2, 22, 46, 10, shade(bodyColor, 20), shade(bodyColor, -50));
  g.lineStyle(2.5, edgeColor, 0.7);
  g.strokeRoundedRect(2, 2, 22, 46, 10);
  g.generateTexture(`${prefix}_arm`, 26, 50);

  // --- ЮМРУК / ДЛАН ---
  g.clear();
  g.fillStyle(shade(bodyColor, 10), 1);
  g.fillCircle(14, 14, 13);
  g.lineStyle(2.5, edgeColor, 0.8);
  g.strokeCircle(14, 14, 13);
  g.fillStyle(shade(bodyColor, -40), 0.5);
  g.fillCircle(14, 17, 6);
  g.generateTexture(`${prefix}_fist`, 28, 28);

  // --- КРАК (пивот горе) ---
  g.clear();
  gradientRoundedRect(g, 2, 2, 22, 52, 9, shade(bodyColor, 10), shade(bodyColor, -60));
  g.lineStyle(2.5, edgeColor, 0.6);
  g.strokeRoundedRect(2, 2, 22, 52, 9);
  // стъпало
  g.fillStyle(shade(bodyColor, -30), 1);
  g.fillRoundedRect(0, 46, 30, 12, 4);
  g.generateTexture(`${prefix}_leg`, 32, 60);

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
