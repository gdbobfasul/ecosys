// Процедурно генериране на ВСИЧКИ текстури в кода (без външни файлове).
// Извиква се веднъж в BootScene. Прави:
//  - героя (глава + шапки + рамене + малко обувки) в няколко варианта на шапка
//  - всеки тип снаряд
//  - предупредителна стрелка (warning)
//  - петна/decals (кал, пръст)
//  - джойстик пръстен + палец
import { THEME } from '../theme.js';

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

export function generateTextures(scene) {
  generateHeroes(scene);
  generateProjectiles(scene);
  generateWarning(scene);
  generateDecals(scene);
  generateJoystick(scene);
  generateParticles(scene);
}

// ---- ГЕРОЙ (top-down, главата отгоре, рамене, малко обувки) ----
// Рисуваме герой в „почти отгоре" перспектива: голяма глава/шапка, рамене,
// и съвсем малко обувки на дъното (фороскъсено тяло).
const HAT_VARIANTS = ['none', 'straw', 'cap', 'fur', 'feather'];

function generateHeroes(scene) {
  HAT_VARIANTS.forEach((hat) => {
    const w = 64, h = 80;
    bake(scene, `hero_${hat}`, w, h, (g) => {
      const cx = w / 2;
      // Сянка под героя
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(cx, h - 8, 40, 14);

      // Рамене (наметало/туника) — широка трапеца под главата
      g.fillStyle(THEME.heroCloth, 1);
      g.beginPath();
      g.moveTo(cx - 22, h - 14);
      g.lineTo(cx - 16, 46);
      g.lineTo(cx + 16, 46);
      g.lineTo(cx + 22, h - 14);
      g.closePath();
      g.fillPath();
      // светъл ръб на раменете
      g.lineStyle(2, 0xffffff, 0.10);
      g.strokeEllipse(cx, 50, 36, 16);

      // Малко обувки на дъното (две тъмни елипси)
      g.fillStyle(0x2a1c12, 1);
      g.fillEllipse(cx - 9, h - 10, 12, 7);
      g.fillEllipse(cx + 9, h - 10, 12, 7);

      // Врат
      g.fillStyle(THEME.heroSkin, 1);
      g.fillRect(cx - 6, 38, 12, 12);

      // Глава (голяма, доминира кадъра — top-down)
      g.fillStyle(THEME.heroSkin, 1);
      g.fillCircle(cx, 26, 18);
      // лека сянка отдолу на лицето
      g.fillStyle(0x000000, 0.10);
      g.fillEllipse(cx, 33, 26, 12);
      // нос (връхче, видимо отгоре)
      g.fillStyle(0xd9a07a, 1);
      g.fillCircle(cx, 30, 3);

      // Шапка по варианти
      drawHat(g, cx, hat);
    });
  });
}

function drawHat(g, cx, hat) {
  switch (hat) {
    case 'straw': // сламена шапка с периферия
      g.fillStyle(0xd9b65a, 1);
      g.fillEllipse(cx, 22, 46, 30);
      g.fillStyle(0xc59a3a, 1);
      g.fillCircle(cx, 18, 13);
      g.lineStyle(1, 0x9c7a2a, 0.6);
      g.strokeEllipse(cx, 22, 46, 30);
      break;
    case 'cap': // плоска шапка/каскет
      g.fillStyle(0x4a5a6a, 1);
      g.fillEllipse(cx, 20, 40, 24);
      g.fillStyle(0x39485a, 1);
      g.fillCircle(cx, 17, 14);
      break;
    case 'fur': // кожена калпачка
      g.fillStyle(0x5a3a22, 1);
      g.fillCircle(cx, 18, 17);
      g.fillStyle(0x6e4a2e, 1);
      g.fillEllipse(cx, 12, 30, 12);
      break;
    case 'feather': // шапка с перо
      g.fillStyle(0x3a2a4a, 1);
      g.fillEllipse(cx, 20, 38, 22);
      g.fillStyle(0x2a1d38, 1);
      g.fillCircle(cx, 16, 13);
      g.fillStyle(0xd0432b, 1); // перо
      g.beginPath();
      g.moveTo(cx + 10, 14);
      g.lineTo(cx + 26, 2);
      g.lineTo(cx + 14, 16);
      g.closePath();
      g.fillPath();
      break;
    case 'none':
    default:
      // коса (тъмна шапчица от коса)
      g.fillStyle(0x3a2616, 1);
      g.fillEllipse(cx, 16, 32, 18);
      break;
  }
}

// ---- ПРОЕКТИЛИ ----
function generateProjectiles(scene) {
  // pellet — камъче от прашка (малко, сиво, кръгло)
  bake(scene, 'p_pellet', 14, 14, (g) => {
    g.fillStyle(0x8a8a8a, 1); g.fillCircle(7, 7, 6);
    g.fillStyle(0xbcbcbc, 1); g.fillCircle(5, 5, 2.4);
    g.lineStyle(1, 0x5a5a5a, 1); g.strokeCircle(7, 7, 6);
  });

  // bolt — арбалетна стрела (дълга, тясна, с връх и пера)
  bake(scene, 'p_bolt', 40, 12, (g) => {
    g.fillStyle(0x6b4a2a, 1); g.fillRect(8, 5, 24, 2.6); // дръжка
    g.fillStyle(0xcfd6dc, 1); // метален връх
    g.beginPath(); g.moveTo(40, 6); g.lineTo(30, 2); g.lineTo(30, 10); g.closePath(); g.fillPath();
    g.fillStyle(0xd0432b, 1); // пера
    g.fillTriangle(2, 6, 10, 1, 10, 5);
    g.fillTriangle(2, 6, 10, 11, 10, 7);
  });

  // stone — хвърлен камък (неравна сива форма)
  bake(scene, 'p_stone', 22, 20, (g) => {
    g.fillStyle(0x7d7468, 1);
    g.beginPath();
    g.moveTo(3, 9); g.lineTo(8, 2); g.lineTo(17, 3); g.lineTo(20, 11);
    g.lineTo(15, 18); g.lineTo(5, 16); g.closePath(); g.fillPath();
    g.fillStyle(0x9a9082, 0.7); g.fillCircle(9, 8, 3);
    g.lineStyle(1, 0x4a463e, 1);
    g.beginPath();
    g.moveTo(3, 9); g.lineTo(8, 2); g.lineTo(17, 3); g.lineTo(20, 11);
    g.lineTo(15, 18); g.lineTo(5, 16); g.closePath(); g.strokePath();
  });

  // dirt — буца пръст/кал (кафява, грапава)
  bake(scene, 'p_dirt', 24, 22, (g) => {
    g.fillStyle(0x5a3a1e, 1); g.fillCircle(12, 11, 10);
    g.fillStyle(0x6e4a28, 1); g.fillCircle(9, 8, 4);
    speckle(g, 24, 22, 0x3a2410, 26, 0.6);
  });

  // mud — голям калник (тъмен, голям, лъскав)
  bake(scene, 'p_mud', 36, 32, (g) => {
    g.fillStyle(0x4a3318, 1); g.fillEllipse(18, 16, 32, 28);
    g.fillStyle(0x5e4322, 1); g.fillEllipse(14, 12, 14, 10);
    g.fillStyle(0x2a1c0c, 0.5); g.fillEllipse(22, 22, 16, 10);
    speckle(g, 36, 32, 0x6e5230, 30, 0.5);
  });

  // pot — глинено гърне
  bake(scene, 'p_pot', 24, 26, (g) => {
    g.fillStyle(0xb5703a, 1);
    g.fillEllipse(12, 15, 20, 22);
    g.fillStyle(0x8a4f24, 1); g.fillRect(6, 2, 12, 5); // гърло
    g.fillStyle(0xd29257, 0.7); g.fillEllipse(9, 11, 6, 9);
    g.lineStyle(1, 0x6e3c1a, 1); g.strokeEllipse(12, 15, 20, 22);
  });

  // veg — гнил зеленчук (зеленикаво-кафяв)
  bake(scene, 'p_veg', 22, 22, (g) => {
    g.fillStyle(0x7a8a3a, 1); g.fillCircle(11, 12, 9);
    g.fillStyle(0x5a6a26, 1); g.fillCircle(8, 9, 3);
    g.fillStyle(0x3a4a18, 0.6); g.fillCircle(14, 15, 4); // гнило петно
    g.fillStyle(0x4a6a2a, 1); g.fillTriangle(11, 3, 8, -1, 14, -1); // дръжка
  });

  // mahorka — навита махорка/цигара
  bake(scene, 'p_mahorka', 28, 12, (g) => {
    g.fillStyle(0xd9c79a, 1); g.fillRoundedRect(2, 4, 24, 5, 2.5); // хартия
    g.fillStyle(0x6e4a22, 1); g.fillRect(20, 4, 6, 5); // тютюн край
    g.fillStyle(0x3a2a14, 1); g.fillRect(2, 4, 3, 5); // мундщук
  });

  // snowball — снежна топка
  bake(scene, 'p_snowball', 20, 20, (g) => {
    g.fillStyle(0xeaf4ff, 1); g.fillCircle(10, 10, 9);
    g.fillStyle(0xffffff, 1); g.fillCircle(7, 7, 3);
    g.fillStyle(0xc4d8ee, 0.6); g.fillCircle(13, 13, 4);
    g.lineStyle(1, 0xbcd0e8, 1); g.strokeCircle(10, 10, 9);
  });

  // stick — хвърлена пръчка (върти се)
  bake(scene, 'p_stick', 30, 10, (g) => {
    g.fillStyle(0x6e4a26, 1); g.fillRoundedRect(2, 3, 26, 4, 2);
    g.fillStyle(0x53371b, 1); g.fillRect(2, 3, 26, 1.5);
    g.fillStyle(0x4a6a2a, 1); g.fillCircle(27, 5, 2.5); // листо на края
  });

  // homingStone — камък със зеленикав ореол (самонасочващ)
  bake(scene, 'p_homingStone', 24, 24, (g) => {
    g.fillStyle(THEME.accent, 0.25); g.fillCircle(12, 12, 11);
    g.fillStyle(0x6a5a4a, 1); g.fillCircle(12, 12, 7);
    g.fillStyle(0x8a7a66, 0.8); g.fillCircle(10, 10, 3);
    g.lineStyle(1.5, THEME.accent, 0.9); g.strokeCircle(12, 12, 10);
  });
}

// ---- ПРЕДУПРЕЖДЕНИЕ (warning) — стрелка/триъгълник на ръба ----
function generateWarning(scene) {
  bake(scene, 'warn_arrow', 28, 28, (g) => {
    g.fillStyle(THEME.warning, 0.95);
    g.beginPath();
    g.moveTo(26, 14); g.lineTo(6, 4); g.lineTo(11, 14); g.lineTo(6, 24);
    g.closePath(); g.fillPath();
    g.lineStyle(2, 0x000000, 0.3);
    g.beginPath();
    g.moveTo(26, 14); g.lineTo(6, 4); g.lineTo(11, 14); g.lineTo(6, 24);
    g.closePath(); g.strokePath();
  });
}

// ---- DECALS / петна (остават по земята) ----
function generateDecals(scene) {
  bake(scene, 'decal_mud', 48, 48, (g) => {
    g.fillStyle(0x3a2810, 0.75); g.fillEllipse(24, 24, 40, 34);
    g.fillStyle(0x2a1c0c, 0.6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(24 + Math.cos(a) * 18, 24 + Math.sin(a) * 14, Math.random() * 4 + 2);
    }
    speckle(g, 48, 48, 0x1a1206, 40, 0.5);
  });
  bake(scene, 'decal_dirt', 40, 40, (g) => {
    g.fillStyle(0x4a3318, 0.6); g.fillEllipse(20, 20, 30, 26);
    speckle(g, 40, 40, 0x2a1c0c, 30, 0.5);
  });
  bake(scene, 'decal_snow', 40, 40, (g) => {
    g.fillStyle(0xeaf4ff, 0.6); g.fillEllipse(20, 20, 30, 26);
    g.fillStyle(0xffffff, 0.5); g.fillCircle(15, 16, 5);
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

// ---- ЧАСТИЦИ (малки точки за burst-ове) ----
function generateParticles(scene) {
  bake(scene, 'spark', 8, 8, (g) => {
    g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 3);
  });
  bake(scene, 'dustbit', 8, 8, (g) => {
    g.fillStyle(0x6e5230, 1); g.fillCircle(4, 4, 3);
  });
}

export { HAT_VARIANTS };
