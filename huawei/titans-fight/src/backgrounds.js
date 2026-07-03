// Version: 1.0001
import Phaser from 'phaser';
// Процедурни фонове за арените. Всяко ниво има различна тема (sky), нарисувана
// изцяло с Graphics: градиентно небе, слънце/луна, силуети, земя.
// Връща Graphics обект, който GameScene поставя най-отзад.

import { GAME_W, GAME_H } from './main.js';

function vGradient(g, top, bottom) {
  const tc = Phaser.Display.Color.HexStringToColor(top);
  const bc = Phaser.Display.Color.HexStringToColor(bottom);
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(tc, bc, steps - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, (GAME_H / steps) * i, GAME_W, GAME_H / steps + 1);
  }
}

// Силует на планини/хълмове.
function ridge(g, baseY, amp, color, alpha) {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(0, GAME_H);
  let x = 0;
  g.lineTo(0, baseY);
  while (x <= GAME_W) {
    const y = baseY - Math.sin(x * 0.012) * amp - Math.random() * amp * 0.3;
    g.lineTo(x, y);
    x += 40;
  }
  g.lineTo(GAME_W, GAME_H);
  g.closePath();
  g.fillPath();
}

// groundOverride (по желание): къде да е "земята" по Y. На тесни телефони
// бойната линия се вдига нагоре, за да не стоят титаните зад контролите.
export function buildArena(scene, arena, groundOverride) {
  const g = scene.add.graphics();
  g.setDepth(-100);

  vGradient(g, arena.top, arena.bottom);

  const acc = arena.accent;

  // Небесно тяло (слънце/луна) според темата
  const sunY = 150, sunX = arena.sky === 'desert' ? 700 : 240;
  g.fillStyle(0xffffff, 0.06);
  g.fillCircle(sunX, sunY, 120);
  g.fillStyle(acc, 0.5);
  g.fillCircle(sunX, sunY, 60);
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(sunX, sunY, 40);

  // Звезди за тъмните теми
  if (['storm', 'abyss', 'ice', 'ruins', 'heaven'].includes(arena.sky)) {
    g.fillStyle(0xffffff, 0.7);
    for (let i = 0; i < 60; i++) {
      g.fillCircle(Math.random() * GAME_W, Math.random() * 240, Math.random() * 1.5 + 0.4);
    }
  }

  // Далечни планини (2 слоя за дълбочина)
  ridge(g, GAME_H * 0.62, 70, Phaser.Display.Color.HexStringToColor(arena.bottom).color, 0.8);
  ridge(g, GAME_H * 0.72, 50, 0x000000, 0.35);

  // Особености според темата
  if (arena.sky === 'volcano') {
    g.fillStyle(0xff5520, 0.4);
    g.fillTriangle(GAME_W * 0.5, GAME_H * 0.45, GAME_W * 0.3, GAME_H * 0.78, GAME_W * 0.7, GAME_H * 0.78);
  }
  if (arena.sky === 'forest') {
    g.fillStyle(0x06200f, 0.7);
    for (let i = 0; i < 8; i++) {
      const tx = 60 + i * 120;
      g.fillRect(tx - 4, GAME_H * 0.55, 8, 120);
      g.fillCircle(tx, GAME_H * 0.55, 36);
    }
  }

  // ЗЕМЯ / под (по-светъл акцентен ръб горе)
  const groundY = groundOverride != null ? groundOverride : GAME_H - 70;
  g.fillStyle(Phaser.Display.Color.HexStringToColor(arena.bottom).color, 1);
  g.fillRect(0, groundY, GAME_W, GAME_H - groundY);
  g.fillStyle(acc, 0.6);
  g.fillRect(0, groundY, GAME_W, 4);
  g.fillStyle(0x000000, 0.25);
  for (let x = 0; x < GAME_W; x += 28) {
    g.fillRect(x, groundY + 10, 14, 3);
  }

  return { graphics: g, groundY };
}
