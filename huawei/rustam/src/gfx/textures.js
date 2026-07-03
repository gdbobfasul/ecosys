// Version: 1.0001
// Процедурно генериране на ВСИЧКИ текстури в кода (без външни файлове).
// Извиква се веднъж в BootScene. Прави: Рустам (герой), краставица, къртица,
// дупка (базов размер, после се мащабира), джойстик, частици, тревичка.
import { THEME } from '../theme.js';

// Базови размери на текстурите, които после се мащабират по ниво (виж entities/cucumber.js).
export const HOLE_TEX = 64;   // дупката се рисува в 64x44, мащабира се до holeSize
export const MOLE_TEX = 64;   // къртицата се рисува в 64x56, мащабира се до moleSize

// Помощник: рисува през Graphics и го „запича" в текстура с дадено име/размер.
function bake(scene, key, w, h, draw) {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

// Лек шум/зърнистост чрез много малки полупрозрачни точки.
function speckle(g, w, h, color, count, alpha) {
  g.fillStyle(color, alpha);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    g.fillCircle(x, y, Math.random() * 1.4 + 0.4);
  }
}

// Изсветлява (amt>0) или потъмнява (amt<0) hex цвят. amt ∈ [-1, 1].
function shade(hex, amt) {
  let r = (hex >> 16) & 255, gg = (hex >> 8) & 255, b = hex & 255;
  if (amt >= 0) { r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt; }
  else { const m = 1 + amt; r *= m; gg *= m; b *= m; }
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (cl(r) << 16) | (cl(gg) << 8) | cl(b);
}

export function generateTextures(scene) {
  generateRustam(scene);
  generateCucumber(scene);
  generateMole(scene);
  generateHole(scene);
  generateJoystick(scene);
  generateParticles(scene);
  generateTuft(scene);
}

// ---- РУСТАМ (top-down градинар със сламена шапка) ----
function generateRustam(scene) {
  const w = 64, h = 80;
  bake(scene, 'rustam', w, h, (g) => {
    const cx = w / 2;
    const cloth = THEME.heroCloth;
    const clothDark = shade(cloth, -0.30);
    const clothLite = shade(cloth, 0.22);
    const skin = THEME.heroSkin;

    // 1) Мека сянка
    g.fillStyle(0x000000, 0.16); g.fillEllipse(cx, h - 7, 48, 17);
    g.fillStyle(0x000000, 0.28); g.fillEllipse(cx, h - 7, 34, 11);

    // 2) Тяло (тъмна основа → риза → светла гънка)
    g.fillStyle(clothDark, 1);
    g.beginPath();
    g.moveTo(cx - 26, h - 12); g.lineTo(cx - 18, 44);
    g.lineTo(cx + 18, 44); g.lineTo(cx + 26, h - 12);
    g.closePath(); g.fillPath();
    g.fillStyle(cloth, 1);
    g.beginPath();
    g.moveTo(cx - 18, h - 14); g.lineTo(cx - 13, 48);
    g.lineTo(cx + 13, 48); g.lineTo(cx + 18, h - 14);
    g.closePath(); g.fillPath();
    g.fillStyle(clothLite, 0.55); g.fillRect(cx - 2, 50, 4, h - 64);
    g.lineStyle(2.5, 0xffffff, 0.12);
    g.beginPath(); g.moveTo(cx - 17, 50); g.lineTo(cx - 24, h - 14); g.strokePath();

    // 3) Рамене
    g.fillStyle(clothLite, 1);
    g.fillEllipse(cx - 17, 50, 18, 13); g.fillEllipse(cx + 17, 50, 18, 13);
    g.fillStyle(clothDark, 0.5);
    g.fillEllipse(cx - 17, 53, 16, 8); g.fillEllipse(cx + 17, 53, 16, 8);

    // 4) Ботуши
    g.fillStyle(0x2a1c12, 1); g.fillEllipse(cx - 9, h - 9, 13, 7); g.fillEllipse(cx + 9, h - 9, 13, 7);
    g.fillStyle(0x3e2a1a, 1); g.fillEllipse(cx - 9, h - 11, 9, 4); g.fillEllipse(cx + 9, h - 11, 9, 4);

    // 5) Врат
    g.fillStyle(shade(skin, -0.12), 1); g.fillRect(cx - 6, 40, 12, 10);

    // 6) Глава
    g.fillStyle(shade(skin, -0.14), 1); g.fillCircle(cx, 27, 19);
    g.fillStyle(skin, 1);               g.fillCircle(cx - 1, 25, 18);
    g.fillStyle(shade(skin, 0.20), 0.7); g.fillCircle(cx - 5, 21, 8);
    g.fillStyle(skin, 1); g.fillCircle(cx - 17, 26, 4); g.fillCircle(cx + 17, 26, 4); // уши
    g.fillStyle(0x000000, 0.10); g.fillEllipse(cx, 35, 24, 9);
    g.fillStyle(shade(skin, 0.06), 1); g.fillCircle(cx, 31, 3);   // нос
    g.fillStyle(0x000000, 0.12); g.fillEllipse(cx, 33.5, 6, 2.5);
    // мустак (народен вид)
    g.fillStyle(0x3a2616, 1); g.fillEllipse(cx, 34, 12, 3);

    // 7) Сламена шапка
    g.fillStyle(0xb78f3a, 1); g.fillEllipse(cx, 23, 50, 32);        // сянка на периферията
    g.fillStyle(0xd9b65a, 1); g.fillEllipse(cx, 21, 48, 30);        // периферия
    g.fillStyle(0xc59a3a, 1); g.fillCircle(cx, 16, 15);             // купол
    g.fillStyle(0xe8cf86, 0.7); g.fillEllipse(cx - 4, 13, 13, 7);   // highlight
    g.lineStyle(1, 0x9c7a2a, 0.5);
    g.strokeEllipse(cx, 21, 48, 30); g.strokeEllipse(cx, 21, 31, 20);
  });
}

// ---- КРАСТАВИЦА (зелена, грапава, с дръжка) ----
function generateCucumber(scene) {
  // Рисувана хоризонтално, ~30x16.
  bake(scene, 'cuke', 32, 18, (g) => {
    const dark = 0x3f6e22, base = 0x5c9c30, lite = 0x82c24a;
    g.fillStyle(dark, 1); g.fillEllipse(16, 10, 28, 13);          // долна сянка
    g.fillStyle(base, 1); g.fillEllipse(16, 9, 27, 12);           // тяло
    g.fillStyle(lite, 0.8); g.fillEllipse(12, 7, 12, 5);          // highlight
    // брадавички (грапавини)
    g.fillStyle(shade(base, -0.22), 0.9);
    for (let i = 0; i < 9; i++) {
      const x = 5 + Math.random() * 22, y = 5 + Math.random() * 8;
      g.fillCircle(x, y, Math.random() * 1.1 + 0.6);
    }
    g.fillStyle(shade(lite, 0.2), 0.8);
    for (let i = 0; i < 6; i++) g.fillCircle(6 + Math.random() * 20, 6 + Math.random() * 6, 0.6);
    g.fillStyle(0x4a6a2a, 1); g.fillRect(28, 8, 4, 2.4);          // дръжка
    g.lineStyle(1, dark, 0.6); g.strokeEllipse(16, 9, 27, 12);
  });
}

// ---- КЪРТИЦА (кафява, муцунка, лапички) — базов размер MOLE_TEX ----
function generateMole(scene) {
  bake(scene, 'mole', MOLE_TEX, 56, (g) => {
    const cx = MOLE_TEX / 2;
    const fur = 0x5b4636, furDark = shade(fur, -0.30), furLite = shade(fur, 0.18);
    // тяло
    g.fillStyle(furDark, 1); g.fillEllipse(cx, 34, 46, 40);
    g.fillStyle(fur, 1);     g.fillEllipse(cx, 31, 42, 36);
    g.fillStyle(furLite, 0.6); g.fillEllipse(cx - 6, 22, 18, 12);
    speckle(g, MOLE_TEX, 56, furDark, 26, 0.4);
    // лапи (за копане)
    g.fillStyle(shade(fur, 0.05), 1);
    g.fillEllipse(cx - 17, 40, 12, 9); g.fillEllipse(cx + 17, 40, 12, 9);
    g.fillStyle(0xe8d6c2, 1); // нокти
    for (let i = -1; i <= 1; i++) { g.fillTriangle(cx - 20 + i * 3, 44, cx - 22 + i * 3, 38, cx - 18 + i * 3, 38); }
    for (let i = -1; i <= 1; i++) { g.fillTriangle(cx + 14 + i * 3, 44, cx + 12 + i * 3, 38, cx + 16 + i * 3, 38); }
    // муцунка
    g.fillStyle(0xe79bb0, 1); g.fillTriangle(cx, 16, cx - 7, 26, cx + 7, 26); // розов нос-конус
    g.fillStyle(0xc97890, 1); g.fillCircle(cx, 18, 3);
    // очи (мънички)
    g.fillStyle(0x111111, 1); g.fillCircle(cx - 7, 24, 2.2); g.fillCircle(cx + 7, 24, 2.2);
    g.fillStyle(0xffffff, 0.8); g.fillCircle(cx - 7.6, 23.3, 0.7); g.fillCircle(cx + 6.4, 23.3, 0.7);
  });
}

// ---- ДУПКА (тъмна яма със землен ръб) — базов размер HOLE_TEX, мащабира се ----
function generateHole(scene) {
  bake(scene, 'hole', HOLE_TEX, 44, (g) => {
    const cx = HOLE_TEX / 2, cy = 22;
    // изровена пръст около (ръб)
    g.fillStyle(0x4a3219, 1); g.fillEllipse(cx, cy, 60, 40);
    g.fillStyle(0x5e4022, 1); g.fillEllipse(cx, cy - 1, 54, 35);
    speckle(g, HOLE_TEX, 44, 0x3a2410, 40, 0.5);
    // самата дупка (тъмна яма с дълбочина)
    g.fillStyle(0x140d06, 1); g.fillEllipse(cx, cy, 40, 26);
    g.fillStyle(0x000000, 1); g.fillEllipse(cx, cy + 1, 30, 18);
    // лек ръб-светлина горе
    g.lineStyle(2, 0x7a5230, 0.6); g.strokeEllipse(cx, cy, 40, 26);
  });
}

// ---- ВИРТУАЛЕН ДЖОЙСТИК ----
function generateJoystick(scene) {
  bake(scene, 'joy_base', 120, 120, (g) => {
    g.fillStyle(0xffffff, 0.06); g.fillCircle(60, 60, 56);
    g.lineStyle(3, 0xffffff, 0.18); g.strokeCircle(60, 60, 54);
  });
  bake(scene, 'joy_thumb', 64, 64, (g) => {
    g.fillStyle(THEME.primary, 0.55); g.fillCircle(32, 32, 28);
    g.lineStyle(3, 0xffffff, 0.4); g.strokeCircle(32, 32, 26);
  });
}

// ---- ЧАСТИЦИ (пръст/искри за burst-ове) ----
function generateParticles(scene) {
  bake(scene, 'spark', 8, 8, (g) => { g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 3); });
  bake(scene, 'dustbit', 8, 8, (g) => { g.fillStyle(0x6e5230, 1); g.fillCircle(4, 4, 3); });
  bake(scene, 'leafbit', 8, 8, (g) => { g.fillStyle(0x5c9c30, 1); g.fillCircle(4, 4, 3); });
}

// ---- ТРЕВИЧКА (украса по полето) ----
function generateTuft(scene) {
  bake(scene, 'tuft', 18, 14, (g) => {
    g.lineStyle(2, 0x3f6e22, 0.9);
    g.beginPath(); g.moveTo(9, 14); g.lineTo(5, 2); g.strokePath();
    g.beginPath(); g.moveTo(9, 14); g.lineTo(9, 0); g.strokePath();
    g.beginPath(); g.moveTo(9, 14); g.lineTo(13, 3); g.strokePath();
  });
}
