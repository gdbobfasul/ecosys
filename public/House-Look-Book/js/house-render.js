// "Подреди своя дом" — параметричен рендер на къща (SVG, схематично, БЕЗ 3D).
// Идея (от brief-а): човек сменя стотици варианти по форма/цвят; не е игра.
// Тук генерираме фасади (изгледи от всички страни) от параметри. Никакви реални
// снимки — всичко е наша векторна графика, затова е неограничено и наше.
//
// Публичен API:
//   HouseRender.elevation(params, side) -> SVG стринг за един изглед
//   HouseRender.roofPlan(params)        -> SVG стринг за покривен план (отгоре)
//   HouseRender.SIDES                    -> ['front','right','back','left']
//   HouseRender.FOOTPRINTS / ROOFS       -> налични форми/покриви (за UI)

const HouseRender = (function () {
  'use strict';

  const SIDES = ['front', 'right', 'back', 'left'];

  // Форми на основата (footprint). Авторът иска и щури варианти.
  const FOOTPRINTS = [
    { id: 'square',     name: 'Квадратна' },
    { id: 'rect',       name: 'Правоъгълна' },
    { id: 'lshape',     name: 'L-образна' },
    { id: 'dome',       name: 'С купол' },
    { id: 'snail',      name: 'Като охлюв' },
    { id: 'waterlily',  name: 'Водна лилия' },
    { id: 'cabin',      name: 'Дървена колиба' },
    { id: 'inverted',   name: 'Обърната (покрив надолу)' },
  ];

  const ROOFS = [
    { id: 'gabled',   name: 'Двускатен' },
    { id: 'flat',     name: 'Плосък' },
    { id: 'dome',     name: 'Купол' },
    { id: 'inverted', name: 'Обърнат' },
    { id: 'none',     name: 'Без покрив' },
  ];

  // Геометрия на платното (в SVG единици). Едно фиксирано платно за всички изгледи.
  const W = 400;          // ширина на платното
  const H = 360;          // височина на платното
  const GROUND_Y = 320;   // нивото на земята
  const BODY_W = 220;     // ширина на тялото (фасадата)
  const FLOOR_H = 70;     // височина на един етаж

  // ── помощни ──────────────────────────────────────────────────────
  function esc(s) { return String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
  function darken(hex, f) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#ccc');
    if (!m) return hex;
    const c = i => Math.max(0, Math.round(parseInt(m[i], 16) * f)).toString(16).padStart(2, '0');
    return '#' + c(1) + c(2) + c(3);
  }

  // Прозорец (рамка + кръст). x,y е горен ляв ъгъл.
  function window_(x, y, w, h, accent) {
    return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#dff1ff" stroke="${accent}" stroke-width="2"/>
      <line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${accent}" stroke-width="1.5"/>
      <line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${accent}" stroke-width="1.5"/>
    </g>`;
  }

  // Врата (само за фасадата отпред).
  function door(x, y, w, h, accent) {
    return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${darken(accent, 0.8)}" stroke="${darken(accent, 0.5)}" stroke-width="2"/>
      <circle cx="${x + w - 7}" cy="${y + h / 2}" r="2.5" fill="#ffd76a"/>
    </g>`;
  }

  // Екстри на двора (басейн / лодка / пристан) — схематично.
  function extras(params) {
    let out = '';
    const e = params.extras || {};
    if (e.pier)  out += `<rect x="20" y="${GROUND_Y - 4}" width="70" height="8" fill="#9c7a4d"/>`;
    if (e.pool)  out += `<rect x="295" y="${GROUND_Y - 14}" width="80" height="14" rx="4" fill="#43b3e0" stroke="#2e86b0" stroke-width="2"/>`;
    if (e.boat)  out += `<g transform="translate(28,${GROUND_Y - 22})"><path d="M0 8 L52 8 L44 20 L8 20 Z" fill="#c0563b"/><rect x="24" y="-14" width="3" height="22" fill="#7a4a30"/><path d="M27 -14 L46 2 L27 2 Z" fill="#f0f0f0"/></g>`;
    return out;
  }

  // Покрив върху тяло с дадена ширина и горен ръб topY.
  function roofShape(params, bodyX, bodyW, topY) {
    const c = params.roofColor || '#8a4b3b';
    const stroke = darken(c, 0.6);
    const x0 = bodyX, x1 = bodyX + bodyW, mid = bodyX + bodyW / 2;
    switch (params.roof) {
      case 'flat':
        return `<rect x="${x0 - 8}" y="${topY - 12}" width="${bodyW + 16}" height="12" fill="${c}" stroke="${stroke}" stroke-width="2"/>`;
      case 'dome':
        return `<path d="M${x0 - 6} ${topY} A ${bodyW / 2 + 6} ${bodyW / 2 + 6} 0 0 1 ${x1 + 6} ${topY} Z" fill="${c}" stroke="${stroke}" stroke-width="2"/>`;
      case 'inverted':
        // Обърнат покрив (V надолу) — щурата идея на автора.
        return `<path d="M${x0 - 10} ${topY - 34} L${mid} ${topY} L${x1 + 10} ${topY - 34} Z" fill="${c}" stroke="${stroke}" stroke-width="2"/>`;
      case 'none':
        return '';
      case 'gabled':
      default:
        return `<path d="M${x0 - 12} ${topY} L${mid} ${topY - 46} L${x1 + 12} ${topY} Z" fill="${c}" stroke="${stroke}" stroke-width="2"/>`;
    }
  }

  // Колко широко е тялото на даден изглед спрямо формата.
  function bodyWidthFor(params, side) {
    let w = BODY_W;
    if (params.footprint === 'rect')  w = (side === 'front' || side === 'back') ? 260 : 150;
    if (params.footprint === 'lshape') w = (side === 'left') ? 150 : BODY_W;
    if (params.footprint === 'cabin') w = 180;
    if (params.footprint === 'dome' || params.footprint === 'waterlily') w = 200;
    if (params.footprint === 'snail') w = 210;
    return w;
  }

  // ── основен изглед (една страна) ─────────────────────────────────
  function elevation(params, side) {
    const floors = Math.min(params.limits?.maxFloors ?? 3, Math.max(params.limits?.minFloors ?? 1, params.floors || 1));
    const wall = params.wallColor || '#e8d9c0';
    const accent = params.accentColor || '#3b6ea5';
    const bodyW = bodyWidthFor(params, side);
    const bodyX = (W - bodyW) / 2;
    const bodyH = floors * FLOOR_H;
    const topY = GROUND_Y - bodyH;

    let body = '';

    // Обърната форма: тялото е трапец (по-тясно долу) — само визуален намек.
    if (params.footprint === 'inverted') {
      const inset = 34;
      body += `<path d="M${bodyX + inset} ${GROUND_Y} L${bodyX} ${topY} L${bodyX + bodyW} ${topY} L${bodyX + bodyW - inset} ${GROUND_Y} Z" fill="${wall}" stroke="${darken(wall, 0.7)}" stroke-width="2"/>`;
    } else if (params.footprint === 'dome' && side === 'front') {
      body += `<path d="M${bodyX} ${GROUND_Y} L${bodyX} ${topY + 20} Q ${W / 2} ${topY - 60} ${bodyX + bodyW} ${topY + 20} L${bodyX + bodyW} ${GROUND_Y} Z" fill="${wall}" stroke="${darken(wall, 0.7)}" stroke-width="2"/>`;
    } else {
      body += `<rect x="${bodyX}" y="${topY}" width="${bodyW}" height="${bodyH}" fill="${wall}" stroke="${darken(wall, 0.7)}" stroke-width="2"/>`;
    }

    // Етажни линии + прозорци/врата
    const winsTop = (typeof params.windowsPerFloor === 'number') ? params.windowsPerFloor : 2;
    for (let f = 0; f < floors; f++) {
      const fy = GROUND_Y - (f + 1) * FLOOR_H;     // горен ръб на етаж f
      if (f > 0) body += `<line x1="${bodyX}" y1="${GROUND_Y - f * FLOOR_H}" x2="${bodyX + bodyW}" y2="${GROUND_Y - f * FLOOR_H}" stroke="${darken(wall, 0.7)}" stroke-width="1.5"/>`;

      const groundFloor = (f === 0);
      const winCount = Math.max(1, winsTop);
      const winW = 34, winH = 38;
      const gap = (bodyW - winCount * winW) / (winCount + 1);

      if (groundFloor && side === 'front') {
        // Партер отпред: врата по средата + прозорци встрани
        body += door(bodyX + bodyW / 2 - 18, GROUND_Y - 56, 36, 56, accent);
        body += window_(bodyX + gap, fy + 14, winW, winH, accent);
        if (winCount > 1) body += window_(bodyX + bodyW - gap - winW, fy + 14, winW, winH, accent);
      } else {
        for (let i = 0; i < winCount; i++) {
          const wx = bodyX + gap + i * (winW + gap);
          body += window_(wx, fy + 16, winW, winH, accent);
        }
      }
    }

    // Покрив (без за обърната долна форма, тя сама е "покрив надолу")
    const roof = params.footprint === 'inverted' ? '' : roofShape(params, bodyX, bodyW, topY);

    return svgFrame(`
      ${groundAndSky()}
      ${extras(params)}
      ${body}
      ${roof}
      ${label(sideLabel(side))}
    `);
  }

  // ── покривен план (отгоре) ───────────────────────────────────────
  function roofPlan(params) {
    const c = params.roofColor || '#8a4b3b';
    const wall = params.wallColor || '#e8d9c0';
    let shape;
    switch (params.footprint) {
      case 'rect':   shape = `<rect x="80" y="90" width="240" height="160" rx="4" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`; break;
      case 'lshape': shape = `<path d="M90 80 H230 V170 H310 V270 H90 Z" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`; break;
      case 'dome':
      case 'waterlily': shape = `<circle cx="200" cy="175" r="110" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`; break;
      case 'snail':  shape = `<path d="M200 175 m0 -100 a100 100 0 1 1 -1 0 M200 175 m0 -60 a60 60 0 1 0 1 0" fill="none" stroke="${darken(c, 0.6)}" stroke-width="6"/>`; break;
      default:       shape = `<rect x="100" y="75" width="200" height="200" rx="4" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`;
    }
    return svgFrame(`${groundAndSky(true)}${shape}${label('Покрив (отгоре)')}`);
  }

  // ── рамки/общи ───────────────────────────────────────────────────
  function svgFrame(inner) {
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  }
  function groundAndSky(plan) {
    if (plan) return `<rect x="0" y="0" width="${W}" height="${H}" fill="#f4f7f9"/>`;
    return `<rect x="0" y="0" width="${W}" height="${H}" fill="#eaf3fb"/>
            <rect x="0" y="${GROUND_Y}" width="${W}" height="${H - GROUND_Y}" fill="#cfe3c8"/>`;
  }
  function label(t) {
    return `<text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-family="system-ui,Arial" font-size="14" fill="#445">${esc(t)}</text>`;
  }
  function sideLabel(side) {
    return { front: 'Отпред', back: 'Отзад', left: 'Отляво', right: 'Отдясно' }[side] || side;
  }

  return { SIDES, FOOTPRINTS, ROOFS, elevation, roofPlan };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HouseRender;
