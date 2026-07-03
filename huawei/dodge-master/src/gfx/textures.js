// Version: 1.0001
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

// Помощник: изсветлява (amt>0) или потъмнява (amt<0) hex цвят. amt ∈ [-1, 1].
function shade(hex, amt) {
  let r = (hex >> 16) & 255, gg = (hex >> 8) & 255, b = hex & 255;
  if (amt >= 0) { r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt; }
  else { const m = 1 + amt; r *= m; gg *= m; b *= m; }
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (cl(r) << 16) | (cl(gg) << 8) | cl(b);
}

function generateHeroes(scene) {
  HAT_VARIANTS.forEach((hat) => {
    const w = 64, h = 80;
    bake(scene, `hero_${hat}`, w, h, (g) => {
      const cx = w / 2;
      const cloth = THEME.heroCloth;
      const clothDark = shade(cloth, -0.30);
      const clothLite = shade(cloth, 0.22);
      const skin = THEME.heroSkin;

      // 1) Мека двуслойна сянка (по-плавен ръб)
      g.fillStyle(0x000000, 0.16); g.fillEllipse(cx, h - 7, 48, 17);
      g.fillStyle(0x000000, 0.28); g.fillEllipse(cx, h - 7, 34, 11);

      // 2) Плащ (тъмна основа) → туника (основен цвят) → централна гънка (светла)
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
      g.fillStyle(clothLite, 0.55); g.fillRect(cx - 2, 50, 4, h - 64); // централна гънка
      // диагонален rim-light по левия ръб (обем)
      g.lineStyle(2.5, 0xffffff, 0.12);
      g.beginPath(); g.moveTo(cx - 17, 50); g.lineTo(cx - 24, h - 14); g.strokePath();

      // 3) Рамене/пауплдрони (заоблени плочки със сянка)
      g.fillStyle(clothLite, 1);
      g.fillEllipse(cx - 17, 50, 18, 13); g.fillEllipse(cx + 17, 50, 18, 13);
      g.fillStyle(clothDark, 0.5);
      g.fillEllipse(cx - 17, 53, 16, 8); g.fillEllipse(cx + 17, 53, 16, 8);

      // 4) Обувки (двуслойни)
      g.fillStyle(0x2a1c12, 1); g.fillEllipse(cx - 9, h - 9, 13, 7); g.fillEllipse(cx + 9, h - 9, 13, 7);
      g.fillStyle(0x3e2a1a, 1); g.fillEllipse(cx - 9, h - 11, 9, 4); g.fillEllipse(cx + 9, h - 11, 9, 4);

      // 5) Врат
      g.fillStyle(shade(skin, -0.12), 1); g.fillRect(cx - 6, 40, 12, 10);

      // 6) Глава — обемно осветяване (сянка → база → highlight) + уши + нос
      g.fillStyle(shade(skin, -0.14), 1); g.fillCircle(cx, 27, 19);   // долна сянка
      g.fillStyle(skin, 1);              g.fillCircle(cx - 1, 25, 18); // осветена глава
      g.fillStyle(shade(skin, 0.20), 0.7); g.fillCircle(cx - 5, 21, 8); // highlight горе-ляво
      g.fillStyle(skin, 1); g.fillCircle(cx - 17, 26, 4); g.fillCircle(cx + 17, 26, 4); // уши
      g.fillStyle(0x000000, 0.10); g.fillEllipse(cx, 35, 24, 9);       // сянка под брадичката
      g.fillStyle(shade(skin, 0.06), 1); g.fillCircle(cx, 31, 3);      // нос (връхче)
      g.fillStyle(0x000000, 0.12); g.fillEllipse(cx, 33.5, 6, 2.5);    // сянка под носа

      // 7) Коса/шапка
      drawHat(g, cx, hat);
    });
  });
}

function drawHat(g, cx, hat) {
  switch (hat) {
    case 'straw': { // сламена шапка с периферия + плетеница и highlight
      g.fillStyle(0xb78f3a, 1); g.fillEllipse(cx, 23, 48, 31);        // сянка на периферията
      g.fillStyle(0xd9b65a, 1); g.fillEllipse(cx, 21, 46, 29);        // периферия
      g.fillStyle(0xc59a3a, 1); g.fillCircle(cx, 17, 14);             // купол
      g.fillStyle(0xe8cf86, 0.7); g.fillEllipse(cx - 4, 14, 12, 7);   // highlight
      g.lineStyle(1, 0x9c7a2a, 0.5);
      g.strokeEllipse(cx, 21, 46, 29); g.strokeEllipse(cx, 21, 30, 19);
      break;
    }
    case 'cap': { // каскет с козирка
      g.fillStyle(0x39485a, 1); g.fillEllipse(cx, 22, 42, 22);        // козирка (сянка)
      g.fillStyle(0x4a5a6a, 1); g.fillEllipse(cx, 20, 40, 22);        // козирка
      g.fillStyle(0x55687c, 1); g.fillCircle(cx, 16, 15);             // купол
      g.fillStyle(0x7d93a8, 0.7); g.fillEllipse(cx - 4, 12, 12, 7);   // highlight
      g.fillStyle(0x2f3c4a, 1); g.fillCircle(cx, 11, 2.5);            // копче
      break;
    }
    case 'fur': { // кожена калпачка с по-светъл кант
      g.fillStyle(0x4a2f1b, 1); g.fillCircle(cx, 19, 18);            // сянка
      g.fillStyle(0x5a3a22, 1); g.fillCircle(cx, 17, 16);            // калпак
      g.fillStyle(0x6e4a2e, 1); g.fillEllipse(cx, 11, 32, 13);      // кожен кант
      g.fillStyle(0x86603e, 0.8); g.fillEllipse(cx - 5, 9, 12, 6);  // highlight на канта
      speckle(g, 64, 40, 0x3a2414, 18, 0.4);                        // текстура на коча
      break;
    }
    case 'feather': { // шапка с перо
      g.fillStyle(0x2a1d38, 1); g.fillEllipse(cx, 21, 40, 23);       // периферия (сянка)
      g.fillStyle(0x3a2a4a, 1); g.fillEllipse(cx, 19, 38, 21);       // периферия
      g.fillStyle(0x46355a, 1); g.fillCircle(cx, 15, 14);            // купол
      g.fillStyle(0x6a5482, 0.7); g.fillEllipse(cx - 4, 11, 11, 6);  // highlight
      g.fillStyle(0xd0432b, 1);                                      // перо
      g.beginPath(); g.moveTo(cx + 10, 13); g.lineTo(cx + 27, 0); g.lineTo(cx + 13, 16); g.closePath(); g.fillPath();
      g.fillStyle(0xe8674f, 0.8);                                    // highlight на перото
      g.beginPath(); g.moveTo(cx + 12, 12); g.lineTo(cx + 24, 3); g.lineTo(cx + 14, 13); g.closePath(); g.fillPath();
      break;
    }
    case 'none':
    default: { // коса с блясък
      g.fillStyle(0x2e1d10, 1); g.fillEllipse(cx, 16, 34, 20);       // коса (сянка)
      g.fillStyle(0x3a2616, 1); g.fillEllipse(cx, 15, 32, 18);       // коса
      g.fillStyle(0x553920, 1); g.fillEllipse(cx - 5, 12, 12, 7);    // блясък/кичур
      break;
    }
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
