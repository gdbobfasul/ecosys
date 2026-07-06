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

// ---- РУСТАМ (градинар — вижда се ЧОВЕК: глава, сламена шапка, риза, ДВЕ ръце
//      протегнати напред за бране, кошница на кръста, ботуши) ----
function generateRustam(scene) {
  const w = 72, h = 96;
  bake(scene, 'rustam', w, h, (g) => {
    const cx = w / 2;
    const cloth = THEME.heroCloth;                       // зелена риза
    const clothDark = shade(cloth, -0.34), clothLite = shade(cloth, 0.26);
    const skin = THEME.heroSkin, skinDark = shade(skin, -0.16);
    const pants = 0x6b4a2a, pantsDark = shade(pants, -0.3);

    // 1) Сянка на земята
    g.fillStyle(0x000000, 0.18); g.fillEllipse(cx, h - 6, 52, 16);
    g.fillStyle(0x000000, 0.26); g.fillEllipse(cx, h - 6, 34, 10);

    // 2) Крака + ботуши
    g.fillStyle(pantsDark, 1); g.fillRoundedRect(cx - 15, h - 30, 12, 22, 5); g.fillRoundedRect(cx + 3, h - 30, 12, 22, 5);
    g.fillStyle(pants, 1);     g.fillRoundedRect(cx - 14, h - 30, 10, 18, 5); g.fillRoundedRect(cx + 4, h - 30, 10, 18, 5);
    g.fillStyle(0x2a1c12, 1);  g.fillEllipse(cx - 9, h - 8, 15, 8); g.fillEllipse(cx + 9, h - 8, 15, 8);
    g.fillStyle(0x3e2a1a, 1);  g.fillEllipse(cx - 9, h - 10, 10, 4); g.fillEllipse(cx + 9, h - 10, 10, 4);

    // 3) Тяло (риза) — трапец с обем
    g.fillStyle(clothDark, 1);
    g.beginPath(); g.moveTo(cx - 22, h - 24); g.lineTo(cx - 17, 52); g.lineTo(cx + 17, 52); g.lineTo(cx + 22, h - 24); g.closePath(); g.fillPath();
    g.fillStyle(cloth, 1);
    g.beginPath(); g.moveTo(cx - 18, h - 26); g.lineTo(cx - 13, 55); g.lineTo(cx + 13, 55); g.lineTo(cx + 18, h - 26); g.closePath(); g.fillPath();
    g.fillStyle(clothLite, 0.5); g.fillRect(cx - 2, 57, 4, h - 84);
    // копчета
    g.fillStyle(0xe8cf86, 0.9); g.fillCircle(cx, 64, 1.6); g.fillCircle(cx, 74, 1.6); g.fillCircle(cx, 84, 1.6);

    // 4) РЪЦЕ протегнати НАПРЕД-ВСТРАНИ (за бране) — ръкав + длан
    g.fillStyle(cloth, 1);
    g.fillRoundedRect(cx - 30, 58, 14, 10, 5);          // ляв ръкав
    g.fillRoundedRect(cx + 16, 58, 14, 10, 5);          // десен ръкав
    g.fillStyle(skin, 1);
    g.fillCircle(cx - 30, 66, 6); g.fillCircle(cx + 30, 66, 6);   // длани
    g.fillStyle(skinDark, 0.4); g.fillCircle(cx - 30, 68, 4); g.fillCircle(cx + 30, 68, 4);

    // 5) Врат
    g.fillStyle(skinDark, 1); g.fillRect(cx - 6, 46, 12, 12);

    // 6) Глава (в профил-фас, с лице напред)
    g.fillStyle(skinDark, 1); g.fillCircle(cx, 34, 20);
    g.fillStyle(skin, 1);     g.fillCircle(cx - 1, 32, 19);
    g.fillStyle(shade(skin, 0.22), 0.6); g.fillCircle(cx - 6, 27, 8);
    g.fillStyle(skin, 1); g.fillCircle(cx - 18, 33, 4); g.fillCircle(cx + 18, 33, 4);   // уши
    // очи + вежди
    g.fillStyle(0x2a1a10, 1); g.fillCircle(cx - 7, 33, 2.2); g.fillCircle(cx + 7, 33, 2.2);
    g.lineStyle(2, 0x3a2616, 0.8);
    g.beginPath(); g.moveTo(cx - 11, 29); g.lineTo(cx - 4, 30); g.strokePath();
    g.beginPath(); g.moveTo(cx + 4, 30); g.lineTo(cx + 11, 29); g.strokePath();
    // нос + усмивка
    g.fillStyle(shade(skin, -0.08), 1); g.fillEllipse(cx, 38, 5, 4);
    g.lineStyle(2, 0x7a3b2a, 0.7); g.beginPath(); g.arc(cx, 40, 6, 0.15 * Math.PI, 0.85 * Math.PI); g.strokePath();
    // мустак (народен вид)
    g.fillStyle(0x3a2616, 1); g.fillEllipse(cx, 41, 13, 3);

    // 7) Сламена шапка (широка периферия + купол + панделка)
    g.fillStyle(0xb78f3a, 1); g.fillEllipse(cx, 27, 58, 26);
    g.fillStyle(0xd9b65a, 1); g.fillEllipse(cx, 25, 55, 24);
    g.fillStyle(0xc59a3a, 1); g.fillEllipse(cx, 18, 30, 22);       // купол
    g.fillStyle(0x8a5a2a, 0.85); g.fillRect(cx - 15, 20, 30, 4);   // панделка
    g.fillStyle(0xe8cf86, 0.7); g.fillEllipse(cx - 5, 14, 12, 7);  // highlight
    g.lineStyle(1, 0x9c7a2a, 0.5); g.strokeEllipse(cx, 25, 55, 24);
    // сламени щрихи по периферията
    g.lineStyle(1, 0xb78f3a, 0.5);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 20, 25 + Math.sin(a) * 9); g.lineTo(cx + Math.cos(a) * 27, 25 + Math.sin(a) * 12); g.strokePath(); }
  });
}

// ---- КРАСТАВИЦА (извита, наситено зелена, с редове брадавички и жълто връхче) ----
function generateCucumber(scene) {
  bake(scene, 'cuke', 40, 22, (g) => {
    const dark = 0x35611c, base = 0x5c9c30, lite = 0x8ecb4e;
    // извито тяло (крива като истинска краставица) — няколко припокрити елипси по дъга
    const pts = [[8, 13], [14, 10], [20, 9], [26, 10], [32, 13]];
    g.fillStyle(dark, 1); for (const [x, y] of pts) g.fillEllipse(x, y + 1.5, 12, 11);
    g.fillStyle(base, 1); for (const [x, y] of pts) g.fillEllipse(x, y, 11, 10);
    // тъмни надлъжни ивици (сортов белег)
    g.lineStyle(1.4, shade(base, -0.25), 0.6);
    g.beginPath(); g.moveTo(8, 10); g.lineTo(32, 10); g.strokePath();
    g.beginPath(); g.moveTo(8, 14); g.lineTo(32, 14); g.strokePath();
    // highlight отгоре
    g.fillStyle(lite, 0.8); for (const [x, y] of pts) g.fillEllipse(x - 1, y - 3, 6, 3);
    // брадавички в редове
    g.fillStyle(shade(base, -0.28), 0.85);
    for (const [x, y] of pts) { g.fillCircle(x - 2, y - 1, 0.9); g.fillCircle(x + 2, y + 2, 0.9); }
    g.fillStyle(shade(lite, 0.15), 0.8);
    for (const [x, y] of pts) g.fillCircle(x, y - 2, 0.7);
    // жълто връхче (цветна пъпка) + дръжка
    g.fillStyle(0xd8c24a, 1); g.fillCircle(6, 13, 2.4);
    g.fillStyle(0x4a6a2a, 1); g.fillRect(33, 11, 5, 3);
    g.lineStyle(1, dark, 0.5); g.strokeEllipse(20, 11, 27, 11);
  });
}

// ---- КЪРТИЦА (кадифена, голяма муцуна, ЛОПАТИ-лапи с нокти, малки очички) ----
function generateMole(scene) {
  bake(scene, 'mole', MOLE_TEX, 60, (g) => {
    const cx = MOLE_TEX / 2;
    const fur = 0x5b4636, furDark = shade(fur, -0.32), furLite = shade(fur, 0.20);
    // тяло (яйцевидно, надолу по-широко)
    g.fillStyle(furDark, 1); g.fillEllipse(cx, 36, 48, 44);
    g.fillStyle(fur, 1);     g.fillEllipse(cx, 33, 44, 40);
    g.fillStyle(furLite, 0.55); g.fillEllipse(cx - 7, 22, 20, 13);   // светлина отгоре
    speckle(g, MOLE_TEX, 60, furDark, 30, 0.35);
    // корем (по-светъл)
    g.fillStyle(shade(fur, 0.12), 0.5); g.fillEllipse(cx, 40, 24, 20);

    // ЛОПАТИ-лапи за копане (розово-кафяви) с нокти
    g.fillStyle(0xC79A82, 1);
    g.fillEllipse(cx - 20, 40, 16, 12); g.fillEllipse(cx + 20, 40, 16, 12);
    g.fillStyle(shade(0xC79A82, -0.2), 0.6);
    g.fillEllipse(cx - 20, 42, 12, 7); g.fillEllipse(cx + 20, 42, 12, 7);
    g.fillStyle(0xf3e6d6, 1); // нокти-острия
    for (let i = -1; i <= 1; i++) { g.fillTriangle(cx - 26 + i * 4, 46, cx - 28 + i * 4, 38, cx - 24 + i * 4, 38); }
    for (let i = -1; i <= 1; i++) { g.fillTriangle(cx + 26 + i * 4, 46, cx + 24 + i * 4, 38, cx + 28 + i * 4, 38); }

    // муцуна (голям розов конус-нос)
    g.fillStyle(0xe79bb0, 1); g.fillTriangle(cx, 12, cx - 9, 26, cx + 9, 26);
    g.fillStyle(0xd88aa0, 1); g.fillTriangle(cx, 14, cx - 6, 24, cx + 6, 24);
    g.fillStyle(0x8a5265, 1); g.fillCircle(cx, 15, 3);              // ноздра-връх
    g.fillStyle(0xf7c0d0, 0.7); g.fillCircle(cx - 2, 20, 2);        // highlight
    // мустачки
    g.lineStyle(1, 0xe8d6c2, 0.7);
    g.beginPath(); g.moveTo(cx - 4, 22); g.lineTo(cx - 16, 20); g.strokePath();
    g.beginPath(); g.moveTo(cx - 4, 24); g.lineTo(cx - 16, 25); g.strokePath();
    g.beginPath(); g.moveTo(cx + 4, 22); g.lineTo(cx + 16, 20); g.strokePath();
    g.beginPath(); g.moveTo(cx + 4, 24); g.lineTo(cx + 16, 25); g.strokePath();
    // очи (мънички, лъскави)
    g.fillStyle(0x0d0d0d, 1); g.fillCircle(cx - 8, 26, 2.4); g.fillCircle(cx + 8, 26, 2.4);
    g.fillStyle(0xffffff, 0.85); g.fillCircle(cx - 8.7, 25.2, 0.8); g.fillCircle(cx + 7.3, 25.2, 0.8);
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
