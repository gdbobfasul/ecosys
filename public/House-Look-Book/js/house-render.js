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
    { id: 'square',     name: 'Квадратна',                key: 'fp.square' },
    { id: 'rect',       name: 'Правоъгълна',              key: 'fp.rect' },
    { id: 'lshape',     name: 'L-образна',                key: 'fp.lshape' },
    { id: 'dome',       name: 'С купол',                  key: 'fp.dome' },
    { id: 'snail',      name: 'Като охлюв',               key: 'fp.snail' },
    { id: 'waterlily',  name: 'Водна лилия',              key: 'fp.waterlily' },
    { id: 'cabin',      name: 'Дървена колиба',           key: 'fp.cabin' },
    { id: 'inverted',   name: 'Обърната (покрив надолу)', key: 'fp.inverted' },
  ];

  const ROOFS = [
    { id: 'gabled',   name: 'Двускатен',  key: 'roof.gabled' },
    { id: 'flat',     name: 'Плосък',     key: 'roof.flat' },
    { id: 'dome',     name: 'Купол',      key: 'roof.dome' },
    { id: 'inverted', name: 'Обърнат',    key: 'roof.inverted' },
    { id: 'none',     name: 'Без покрив', key: 'roof.none' },
  ];

  // Типове стаи (за разпределението по етажи). key → за i18n; color → за плана.
  const ROOM_TYPES = [
    { id: 'living',   name: 'Хол',        key: 'room.living',   color: '#f3e1c0' },
    { id: 'bedroom',  name: 'Спалня',     key: 'room.bedroom',  color: '#cfe0f3' },
    { id: 'kitchen',  name: 'Кухня',      key: 'room.kitchen',  color: '#f7d9c0' },
    { id: 'bathroom', name: 'Баня',       key: 'room.bathroom', color: '#c0e8e0' },
    { id: 'toilet',   name: 'Тоалетна',   key: 'room.toilet',   color: '#e6e6ee' },
    { id: 'dining',   name: 'Трапезария', key: 'room.dining',   color: '#ecdcc4' },
    { id: 'kids',     name: 'Детска',     key: 'room.kids',     color: '#f3c9d9' },
    { id: 'office',   name: 'Кабинет',    key: 'room.office',   color: '#dccff3' },
    { id: 'hall',     name: 'Коридор',    key: 'room.hall',     color: '#e8e8e8' },
    { id: 'balcony',  name: 'Балкон',     key: 'room.balcony',  color: '#d4ead4' },
  ];
  function roomType(id) { return ROOM_TYPES.find(r => r.id === id); }

  // Форми на стаите в плана — не само правоъгълни (по желание на автора).
  const ROOM_SHAPES = [
    { id: 'rect',     name: 'Правоъгълна', key: 'shape.rect' },
    { id: 'rounded',  name: 'Заоблена',    key: 'shape.rounded' },
    { id: 'circle',   name: 'Кръгла',      key: 'shape.circle' },
    { id: 'oval',     name: 'Овална',      key: 'shape.oval' },
    { id: 'crescent', name: 'Полумесец',   key: 'shape.crescent' },
    { id: 'diamond',  name: 'Ромб',        key: 'shape.diamond' },
    { id: 'triangle', name: 'Триъгълна',   key: 'shape.triangle' },
    { id: 'hex',      name: 'Шестоъгълна', key: 'shape.hex' },
  ];
  // Рисува стая с дадена форма в правоъгълника (x,y,w,h), запълнена с fill.
  function roomShapeSvg(shape, x, y, w, h, fill) {
    const st = 'stroke="#778" stroke-width="1.5"';
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2, r = Math.min(rx, ry);
    switch (shape) {
      case 'rounded':  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.28}" fill="${fill}" ${st}/>`;
      case 'circle':   return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${st}/>`;
      case 'oval':     return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${st}/>`;
      case 'crescent': return `<path d="M ${cx} ${y} A ${rx} ${ry} 0 1 0 ${cx} ${y + h} A ${rx * 0.62} ${ry} 0 1 1 ${cx} ${y} Z" fill="${fill}" ${st}/>`;
      case 'diamond':  return `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" fill="${fill}" ${st}/>`;
      case 'triangle': return `<polygon points="${cx},${y} ${x + w},${y + h} ${x},${y + h}" fill="${fill}" ${st}/>`;
      case 'hex': { const q = w * 0.25; return `<polygon points="${x + q},${y} ${x + w - q},${y} ${x + w},${cy} ${x + w - q},${y + h} ${x + q},${y + h} ${x},${cy}" fill="${fill}" ${st}/>`; }
      case 'rect':
      default:         return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${st}/>`;
    }
  }

  // Custom форма (силует от снимка) — нормализирани точки 0..1 → SVG path в (x,y,w,h).
  function isCustom(p) { return p && p.footprint === 'custom' && p.customShape && Array.isArray(p.customShape.pts) && p.customShape.pts.length > 2; }
  function customPath(pts, x, y, w, h) {
    return 'M ' + pts.map(p => `${(x + p[0] * w).toFixed(1)} ${(y + p[1] * h).toFixed(1)}`).join(' L ') + ' Z';
  }

  // Геометрия на платното (в SVG единици). Едно фиксирано платно за всички изгледи.
  const W = 400;          // ширина на платното
  const H = 360;          // височина на платното
  const GROUND_Y = 320;   // нивото на земята
  const BODY_W = 220;     // ширина на тялото (фасадата)
  const FLOOR_H = 70;     // височина на един етаж

  // ── помощни ──────────────────────────────────────────────────────
  function esc(s) { return String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
  const T = (k, v) => (window.HLB_I18N ? HLB_I18N.t(k, v) : k);
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
    if (isCustom(params)) {
      shape = `<path d="${customPath(params.customShape.pts, 90, 75, 220, 200)}" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`;
    } else
    switch (params.footprint) {
      case 'rect':   shape = `<rect x="80" y="90" width="240" height="160" rx="4" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`; break;
      case 'lshape': shape = `<path d="M90 80 H230 V170 H310 V270 H90 Z" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`; break;
      case 'dome':
      case 'waterlily': shape = `<circle cx="200" cy="175" r="110" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`; break;
      case 'snail':  shape = `<path d="M200 175 m0 -100 a100 100 0 1 1 -1 0 M200 175 m0 -60 a60 60 0 1 0 1 0" fill="none" stroke="${darken(c, 0.6)}" stroke-width="6"/>`; break;
      default:       shape = `<rect x="100" y="75" width="200" height="200" rx="4" fill="${wall}" stroke="${darken(c, 0.6)}" stroke-width="2"/>`;
    }
    return svgFrame(`${groundAndSky(true)}${shape}${label(T('roofplan.label'))}`);
  }

  // ── план на етаж (отгоре): стаите като оцветени клетки в решетка ──────
  function floorPlan(params, floorIndex) {
    const rooms = ((params.rooms || [])[floorIndex]) || [];
    const PX = 40, PY = 64, PW = W - 80, PH = GROUND_Y - PY - 6;
    let inner = groundAndSky(true);
    inner += isCustom(params)
      ? `<path d="${customPath(params.customShape.pts, PX, PY, PW, PH)}" fill="#fff" stroke="#889" stroke-width="2"/>`
      : `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="#fff" stroke="#889" stroke-width="2"/>`;
    if (!rooms.length) {
      inner += `<text x="${W / 2}" y="${PY + PH / 2}" text-anchor="middle" font-family="system-ui,Arial" font-size="13" fill="#99a">${esc(T('floorplan.empty'))}</text>`;
    } else {
      const n = rooms.length;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cw = PW / cols, ch = PH / rows;
      for (let i = 0; i < n; i++) {
        const rt = roomType(rooms[i] && rooms[i].type) || { name: (rooms[i] && rooms[i].type) || '?', color: '#eee', key: '' };
        const cx = PX + (i % cols) * cw, cy = PY + Math.floor(i / cols) * ch;
        const lbl = rt.key ? T(rt.key) : rt.name;
        const shape = (rooms[i] && rooms[i].shape) || 'rect';
        inner += `<g>
          ${roomShapeSvg(shape, cx + 3, cy + 3, cw - 6, ch - 6, rt.color)}
          <text x="${cx + cw / 2}" y="${cy + ch / 2 + 4}" text-anchor="middle" font-family="system-ui,Arial" font-size="12" fill="#334">${esc(lbl)}</text>
        </g>`;
      }
    }
    inner += label(T('floorplan.label', { n: floorIndex + 1 }));
    return svgFrame(inner);
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
    return (window.HLB_I18N
      ? HLB_I18N.t('side.' + side)
      : ({ front: 'Отпред', back: 'Отзад', left: 'Отляво', right: 'Отдясно' }[side] || side));
  }

  return { SIDES, FOOTPRINTS, ROOFS, ROOM_TYPES, ROOM_SHAPES, elevation, roofPlan, floorPlan };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HouseRender;
