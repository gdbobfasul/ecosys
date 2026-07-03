// Version: 1.0001
// Споделен рендер на ранг листа в стила на играта (Phaser Text в контейнер).
// Връща Phaser.GameObjects.Container, който извикващият може да добави/премести.
// Поддържа вертикално влачене (drag) за скрол, ако записите не се събират.
import Phaser from 'phaser';
import { THEME } from '../theme.js';

// scene      — Phaser сцена
// entries    — масив { name, score } (вече подреден намаляващо)
// opts.x/y   — горен ляв ъгъл на областта
// opts.width — ширина на областта
// opts.height— видима височина (за скрол маска)
// opts.highlightIndex — индекс (0-базиран) на ред за осветяване (или -1)
export function showLeaderboardList(scene, entries, opts) {
  const x = opts.x;
  const y = opts.y;
  const areaW = opts.width;
  const areaH = opts.height;
  const highlightIndex = (opts.highlightIndex == null) ? -1 : opts.highlightIndex;

  const rowH = 30;
  const container = scene.add.container(x, y);

  if (!entries.length) {
    const empty = scene.add.text(areaW / 2, areaH / 2, 'Все още няма резултати.', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#9fc8ff'
    }).setOrigin(0.5);
    container.add(empty);
    return container;
  }

  entries.forEach((row, i) => {
    const ry = i * rowH;
    const isMe = i === highlightIndex;

    if (isMe) {
      const bg = scene.add.graphics();
      bg.fillStyle(THEME.accent, 0.18).fillRoundedRect(0, ry, areaW, rowH - 4, 8);
      bg.lineStyle(1, THEME.accent, 0.9).strokeRoundedRect(0, ry, areaW, rowH - 4, 8);
      container.add(bg);
    }

    const color = isMe ? THEME.accentHex : '#dce8ff';
    const rankTxt = scene.add.text(8, ry + (rowH - 4) / 2, '#' + (i + 1), {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px',
      fontStyle: isMe ? 'bold' : 'normal', color
    }).setOrigin(0, 0.5);

    const nameTxt = scene.add.text(54, ry + (rowH - 4) / 2, String(row.name), {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px',
      fontStyle: isMe ? 'bold' : 'normal', color
    }).setOrigin(0, 0.5);
    // Дълги имена не бива да застъпват точките.
    nameTxt.setWordWrapWidth(areaW - 54 - 80);

    const scoreTxt = scene.add.text(areaW - 8, ry + (rowH - 4) / 2, String(row.score), {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px',
      fontStyle: 'bold', color
    }).setOrigin(1, 0.5);

    container.add([rankTxt, nameTxt, scoreTxt]);
  });

  const contentH = entries.length * rowH;

  // Маска, за да не излиза извън видимата област.
  const maskG = scene.make.graphics({ x: 0, y: 0, add: false });
  maskG.fillStyle(0xffffff);
  maskG.fillRect(x, y, areaW, areaH);
  const mask = maskG.createGeometryMask();
  container.setMask(mask);

  // Скрол чрез влачене, само ако съдържанието е по-високо от областта.
  if (contentH > areaH) {
    const minY = y - (contentH - areaH);
    const maxY = y;
    let dragging = false;
    let startPointerY = 0;
    let startContainerY = 0;

    const hit = scene.add.zone(x, y, areaW, areaH).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p) => {
      dragging = true;
      startPointerY = p.y;
      startContainerY = container.y;
    });
    scene.input.on('pointermove', (p) => {
      if (!dragging) return;
      let ny = startContainerY + (p.y - startPointerY);
      ny = Phaser.Math.Clamp(ny, minY, maxY);
      container.y = ny;
    });
    const stop = () => { dragging = false; };
    scene.input.on('pointerup', stop);
    scene.input.on('pointerupoutside', stop);

    // Авто-скрол до осветения ред, ако е извън видимото.
    if (highlightIndex >= 0) {
      const rowTop = highlightIndex * rowH;
      let target = y - rowTop + (areaH - rowH) / 2;
      target = Phaser.Math.Clamp(target, minY, maxY);
      container.y = target;
    }
  }

  return container;
}
