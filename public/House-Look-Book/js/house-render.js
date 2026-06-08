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
  // Помещения за МАЗЕ (подземните етажи) — различни от надземните стаи (т.4).
  const BASEMENT_ROOM_TYPES = [
    { id: 'garage',    name: 'Гараж',                    key: 'broom.garage',    color: '#c9ccd2' },
    { id: 'pantry1',   name: 'Килер 1',                  key: 'broom.pantry1',   color: '#dcd3c2' },
    { id: 'pantry2',   name: 'Килер 2',                  key: 'broom.pantry2',   color: '#d3cbb8' },
    { id: 'technical', name: 'Техническо помещение',     key: 'broom.technical', color: '#cdd6dc' },
    { id: 'materials', name: 'Склад строит. материали',  key: 'broom.materials', color: '#d8c9b0' },
    { id: 'tools',     name: 'Склад за инструменти',     key: 'broom.tools',     color: '#c7cdb8' },
    { id: 'foodstore', name: 'Килер за храна',           key: 'broom.foodstore', color: '#e0d4b8' },
    { id: 'pumproom',  name: 'Помпена станция',          key: 'broom.pumproom',  color: '#bcd2d8' },
    { id: 'heating',   name: 'Локално отопление',        key: 'broom.heating',   color: '#e6c9bc' },
    { id: 'heatpump',  name: 'Термопомпи',               key: 'broom.heatpump',  color: '#c2d6c8' },
  ];
  function roomType(id) { return ROOM_TYPES.find(r => r.id === id) || BASEMENT_ROOM_TYPES.find(r => r.id === id); }

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
    { id: 'trapezoid',name: 'Трапец',      key: 'shape.trapezoid' },
  ];
  // Брой стени (= брой странични изгледи) според формата.
  // Многоъгълник → колкото му са страните; заоблена форма → 4 (по посоки).
  const SHAPE_WALLS = { rect: 4, rounded: 4, circle: 4, oval: 4, crescent: 4, diamond: 4, triangle: 3, hex: 6, trapezoid: 4 };
  function wallsForShape(shape) { return SHAPE_WALLS[shape] || 4; }

  // Каталог мебели/уреди. def = подразбиращо се място ('center'|'wall') — може да се сменя.
  // rooms = за кои типове стаи се предлага първо (но всичко може да се добави навсякъде).
  const FURNITURE = [
    { id: 'bed',        name: 'Легло',            key: 'fn.bed',        def: 'center', rooms: ['bedroom', 'kids'] },
    { id: 'sofa',       name: 'Диван',            key: 'fn.sofa',       def: 'center', rooms: ['living'] },
    { id: 'sofaset',    name: 'Холна гарнитура',  key: 'fn.sofaset',    def: 'center', rooms: ['living'] },
    { id: 'armchair',   name: 'Фотьойл',          key: 'fn.armchair',   def: 'center', rooms: ['living'] },
    { id: 'coffee',     name: 'Холна маса',       key: 'fn.coffee',     def: 'center', rooms: ['living'] },
    { id: 'table',      name: 'Маса',             key: 'fn.table',      def: 'center', rooms: ['dining', 'kitchen', 'living'] },
    { id: 'chair',      name: 'Стол',             key: 'fn.chair',      def: 'center', rooms: ['dining', 'kitchen', 'office', 'kids'] },
    { id: 'desk',       name: 'Бюро',             key: 'fn.desk',       def: 'center', rooms: ['office', 'kids'] },
    { id: 'toilet',     name: 'Тоалетна чиния',   key: 'fn.toilet',     def: 'center', rooms: ['bathroom', 'toilet'] },
    { id: 'bathtub',    name: 'Вана',             key: 'fn.bathtub',    def: 'center', rooms: ['bathroom'] },
    { id: 'island',     name: 'Кухненски остров', key: 'fn.island',     def: 'center', rooms: ['kitchen'] },
    { id: 'tvstand',    name: 'ТВ шкаф',          key: 'fn.tvstand',    def: 'wall',   rooms: ['living', 'bedroom'] },
    { id: 'wardrobe',   name: 'Гардероб',         key: 'fn.wardrobe',   def: 'wall',   rooms: ['bedroom', 'kids', 'hall'] },
    { id: 'cabinet',    name: 'Вграден шкаф',     key: 'fn.cabinet',    def: 'wall',   rooms: [] },
    { id: 'shelves',    name: 'Рафтове',          key: 'fn.shelves',    def: 'wall',   rooms: ['living', 'office', 'kids'] },
    { id: 'nightstand', name: 'Нощно шкафче',     key: 'fn.nightstand', def: 'wall',   rooms: ['bedroom'] },
    { id: 'dresser',    name: 'Скрин',            key: 'fn.dresser',    def: 'wall',   rooms: ['bedroom'] },
    { id: 'sink',       name: 'Мивка',            key: 'fn.sink',       def: 'wall',   rooms: ['kitchen', 'bathroom', 'toilet'] },
    { id: 'stove',      name: 'Готварска печка',  key: 'fn.stove',      def: 'wall',   rooms: ['kitchen'] },
    { id: 'oven',       name: 'Вградена фурна',   key: 'fn.oven',       def: 'wall',   rooms: ['kitchen'] },
    { id: 'fridge',     name: 'Хладилник',        key: 'fn.fridge',     def: 'wall',   rooms: ['kitchen'] },
    { id: 'dishwasher', name: 'Съдомиялна',       key: 'fn.dishwasher', def: 'wall',   rooms: ['kitchen'] },
    { id: 'hood',       name: 'Аспиратор',        key: 'fn.hood',       def: 'wall',   rooms: ['kitchen'] },
    { id: 'shower',     name: 'Душ-кабина',       key: 'fn.shower',     def: 'wall',   rooms: ['bathroom'] },
    { id: 'washer',     name: 'Пералня',          key: 'fn.washer',     def: 'wall',   rooms: ['bathroom'] },
    { id: 'boiler',     name: 'Бойлер',           key: 'fn.boiler',     def: 'wall',   rooms: ['bathroom', 'kitchen'] },
    { id: 'shoecab',    name: 'Шкаф за обувки',   key: 'fn.shoecab',    def: 'wall',   rooms: ['hall'] },
    { id: 'coatrack',   name: 'Закачалка',        key: 'fn.coatrack',   def: 'wall',   rooms: ['hall'] },
  ];
  function furnitureItem(id) { return FURNITURE.find(f => f.id === id); }
  const WALL_MAX = 3, CENTER_MAX = 10;
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
      case 'trapezoid': return `<polygon points="${x + w * 0.2},${y} ${x + w * 0.8},${y} ${x + w},${y + h} ${x},${y + h}" fill="${fill}" ${st}/>`;
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
  // Като darken, но клампва нагоре до 255 — за по-светли стени/горни плоскости (f>1).
  function shade(hex, f) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#ccc');
    if (!m) return hex;
    const c = i => Math.min(255, Math.max(0, Math.round(parseInt(m[i], 16) * f))).toString(16).padStart(2, '0');
    return '#' + c(1) + c(2) + c(3);
  }
  const DEFAULT_FURN_COLOR = '#c2b9a8';

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
  // Брой/вид отвори на всеки етаж = ВЪНШНИТЕ врати/прозорци на този етаж (т.4,5);
  // мазетата се рисуват под земята (т.7); при params.roofOff покривът се маха (т.8).
  function elevation(params, side) {
    const floors = Math.min(params.limits?.maxFloors ?? 3, Math.max(params.limits?.minFloors ?? 1, params.floors || 1));
    const base = Math.max(0, +params.basements || 0);
    const wall = params.wallColor || '#e8d9c0';
    const accent = params.accentColor || '#3b6ea5';
    const bodyW = bodyWidthFor(params, side);
    const bodyX = (W - bodyW) / 2;
    const bodyH = floors * FLOOR_H;
    const topY = GROUND_Y - bodyH;
    const rooms = params.rooms || [];
    const winsTop = (typeof params.windowsPerFloor === 'number') ? params.windowsPerFloor : 2;
    // Отвори за ТАЗИ ФАСАДА (страна) за даден етаж; ако няма стаи → fallback по слайдъра.
    function ext(idx, fbW, fbD) {
      const fr = rooms[idx];
      if (fr && fr.length) { const e = facadeOpenings(fr, side); return { windows: e.windows, doors: e.doors }; }
      return { windows: fbW, doors: fbD };
    }

    let body = '';
    if (params.footprint === 'inverted') {
      const inset = 34;
      body += `<path d="M${bodyX + inset} ${GROUND_Y} L${bodyX} ${topY} L${bodyX + bodyW} ${topY} L${bodyX + bodyW - inset} ${GROUND_Y} Z" fill="${wall}" stroke="${darken(wall, 0.7)}" stroke-width="2"/>`;
    } else if (params.footprint === 'dome' && side === 'front') {
      body += `<path d="M${bodyX} ${GROUND_Y} L${bodyX} ${topY + 20} Q ${W / 2} ${topY - 60} ${bodyX + bodyW} ${topY + 20} L${bodyX + bodyW} ${GROUND_Y} Z" fill="${wall}" stroke="${darken(wall, 0.7)}" stroke-width="2"/>`;
    } else {
      body += `<rect x="${bodyX}" y="${topY}" width="${bodyW}" height="${bodyH}" fill="${wall}" stroke="${darken(wall, 0.7)}" stroke-width="2"/>`;
    }

    for (let f = 0; f < floors; f++) {
      const fy = GROUND_Y - (f + 1) * FLOOR_H;
      if (f > 0) body += `<line x1="${bodyX}" y1="${GROUND_Y - f * FLOOR_H}" x2="${bodyX + bodyW}" y2="${GROUND_Y - f * FLOOR_H}" stroke="${darken(wall, 0.7)}" stroke-width="1.5"/>`;
      // Врати се показват САМО ако са зададени по външна стена на стая (т.1,2).
      // Без fallback врата на партера — иначе изскача фантомна врата без зададена.
      const e = ext(base + f, winsTop, 0);
      const winCount = Math.max(0, Math.min(6, e.windows));
      const winW = 34, winH = 38, gap = winCount ? (bodyW - winCount * winW) / (winCount + 1) : 0;
      // Вратата излиза на ФАСАДАТА, чиято стена има врата (не винаги отпред) — т.2.
      const showDoor = (f === 0 && e.doors > 0);
      if (showDoor) {
        body += door(bodyX + bodyW / 2 - 18, GROUND_Y - 56, 36, 56, accent);
        if (winCount > 0) body += window_(bodyX + gap, fy + 14, winW, winH, accent);
        if (winCount > 1) body += window_(bodyX + bodyW - gap - winW, fy + 14, winW, winH, accent);
      } else {
        for (let i = 0; i < winCount; i++) body += window_(bodyX + gap + i * (winW + gap), fy + 16, winW, winH, accent);
      }
    }

    // ── Мазета под земята (всяко с малки външни прозорчета) ──
    const extraH = base * FLOOR_H;
    let bsmt = '';
    if (base > 0) {
      bsmt += `<rect x="0" y="${GROUND_Y}" width="${W}" height="${(H - GROUND_Y) + extraH}" fill="#d8cbb0"/>`; // пръст
      bsmt += `<rect x="${bodyX}" y="${GROUND_Y}" width="${bodyW}" height="${extraH}" fill="${darken(wall, 0.62)}" stroke="${darken(wall, 0.45)}" stroke-width="2"/>`;
      for (let b = 0; b < base; b++) {
        const by = GROUND_Y + b * FLOOR_H;                    // b=0 = точно под земята
        if (b > 0) bsmt += `<line x1="${bodyX}" y1="${by}" x2="${bodyX + bodyW}" y2="${by}" stroke="${darken(wall, 0.4)}" stroke-width="1.5"/>`;
        const e = ext(base - 1 - b, 1, 0);                    // rooms индекс на това мазе
        const wc = Math.max(0, Math.min(5, e.windows)), ww = 22, wh = 16, g = wc ? (bodyW - wc * ww) / (wc + 1) : 0;
        for (let i = 0; i < wc; i++) bsmt += `<rect x="${bodyX + g + i * (ww + g)}" y="${by + (FLOOR_H - wh) / 2}" width="${ww}" height="${wh}" fill="#cfe0ee" stroke="${accent}" stroke-width="1.5"/>`;
        bsmt += `<text x="${bodyX + 6}" y="${by + FLOOR_H - 6}" font-size="9" fill="#fff" opacity="0.6" font-family="system-ui,Arial">${esc(floorTitle(params, base - 1 - b))}</text>`;
      }
    }

    const roof = (params.roofOff || params.footprint === 'inverted') ? '' : roofShape(params, bodyX, bodyW, topY);
    const totalH = H + extraH;
    return `<svg viewBox="0 0 ${W} ${totalH}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
      groundAndSky() + extras(params) + bsmt + body + roof +
      `<text x="${W / 2}" y="${totalH - 12}" text-anchor="middle" font-family="system-ui,Arial" font-size="14" fill="#445">${esc(sideLabel(side))}</text></svg>`;
  }

  // ── „Всички етажи" (изглед ОТГОРЕ, когато покривът е махнат) — коя стая над коя ──
  // Външен дебел ЧЕРЕН контур = формата на сградата отгоре (footprint). Навътре —
  // концентрични рамки, по една на ЕТАЖ: най-горният етаж най-отвън, по-долните
  // навътре, до мазе -1/-2 най-вътре. Във всяка рамка стаите като квадратчета (т.8).
  function floorsStack(params) {
    const all = params.rooms || [];
    const b = Math.max(0, +params.basements || 0), nAll = all.length;
    // ред отвън→навътре = отгоре→надолу: горен етаж → партер → мазе -1 → мазе -2 …
    const order = [];
    for (let i = nAll - 1; i >= b; i--) order.push(i);   // надземни: горен → партер
    for (let i = 0; i < b; i++) order.push(i);            // мазета: -1, -2, … (най-вътре)
    if (!order.length) order.push(0);
    const PAL = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#a1887f', '#90a4ae', '#f06292', '#9575cd'];
    const colorFor = di => PAL[di % PAL.length];
    const nF = order.length;
    // силует на основата като outline (за изгледа отгоре)
    function fpOutline(x, y, w, h, sw, stroke) {
      const cx = x + w / 2, cy = y + h / 2;
      if (isCustom(params)) return `<path d="${customPath(params.customShape.pts, x, y, w, h)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
      switch (params.footprint) {
        case 'dome': case 'waterlily': return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(w / 2).toFixed(1)}" ry="${(h / 2).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
        case 'snail': return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(Math.min(w, h) / 2).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
        case 'lshape': return `<path d="M${x} ${y} H${(x + w * 0.58).toFixed(1)} V${(y + h * 0.52).toFixed(1)} H${x + w} V${y + h} H${x} Z" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
        default: return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
    }
    const BX = 16, BY = 40, BW = 244, BH = GROUND_Y - BY - 4;
    let inner = `<rect x="0" y="0" width="${W}" height="${H}" fill="#f4f7f9"/>`;
    inner += fpOutline(BX, BY, BW, BH, 4, '#111');       // дебел черен силует на сградата отгоре
    const margin = 9;
    const stepX = (BW / 2 - margin - 6) / nF, stepY = (BH / 2 - margin - 6) / nF;
    order.forEach((fi, di) => {
      const fr = all[fi] || [], col = colorFor(di);
      const ix = BX + margin + di * stepX, iy = BY + margin + di * stepY;
      const iw = Math.max(8, BW - 2 * (margin + di * stepX)), ih = Math.max(8, BH - 2 * (margin + di * stepY));
      inner += `<rect x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" rx="2" fill="none" stroke="${col}" stroke-width="2.2"/>`;
      const bandY = iy + 3, bandH = Math.max(8, Math.min(stepY - 4, ih - 6, 22));
      if (!fr.length) {                                    // празен етаж → само етикет в цвета
        inner += `<text x="${(ix + iw / 2).toFixed(1)}" y="${(bandY + bandH / 2 + 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="${col}" opacity="0.75" font-family="system-ui,Arial">${esc(floorTitle(params, fi))}</text>`;
        return;
      }
      const cellW = (iw - 6) / fr.length;
      fr.forEach((r, ci) => {
        const bx = ix + 3 + ci * cellW;
        inner += `<rect x="${(bx + 1).toFixed(1)}" y="${bandY.toFixed(1)}" width="${Math.max(4, cellW - 2).toFixed(1)}" height="${bandH.toFixed(1)}" rx="2" fill="none" stroke="${col}" stroke-width="1.6"/>`;
        const rt = roomType(r.type), nm = rt ? T(rt.key) : r.type;
        const fs = Math.max(6.5, Math.min(9, cellW * 0.26, bandH * 0.62));
        inner += `<text x="${(bx + cellW / 2).toFixed(1)}" y="${(bandY + bandH / 2 + fs * 0.34).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}" fill="#1a1a1a" font-family="system-ui,Arial">${esc(String(nm).slice(0, 9))}</text>`;
      });
    });
    // ── Легенда (дясно): цвят на етажа + имената на стаите в същия цвят ──
    const LX = 268; let ly = BY + 6;
    inner += `<text x="${LX}" y="${ly}" font-size="10.5" font-weight="bold" fill="#334" font-family="system-ui,Arial">Легенда (отгоре→долу)</text>`; ly += 16;
    order.forEach((fi, di) => {
      if (ly > GROUND_Y - 6) return;
      const col = colorFor(di);
      inner += `<rect x="${LX}" y="${ly - 9}" width="12" height="12" rx="2" fill="${col}"/>`;
      inner += `<text x="${LX + 17}" y="${ly}" font-size="10" font-weight="bold" fill="#223" font-family="system-ui,Arial">${esc(floorTitle(params, fi))}</text>`; ly += 12;
      const names = (all[fi] || []).map(r => { const rt = roomType(r.type); return rt ? T(rt.key) : r.type; });
      const txt = names.length ? names.join(', ') : '—';
      inner += `<text x="${LX + 17}" y="${ly}" font-size="8.5" fill="${col}" font-family="system-ui,Arial">${esc(txt.slice(0, 30))}</text>`; ly += 15;
    });
    inner += label(T('floorstack.label'));
    return svgFrame(inner);
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
    inner += label(floorTitle(params, floorIndex));
    return svgFrame(inner);
  }

  // Заглавие на етаж според разположението (мазета отдолу, надземни отгоре).
  // params.basements = брой подземни етажи (индекси 0..basements-1 в rooms са мазета).
  function floorTitle(params, idx) {
    const b = +(params && params.basements) || 0;
    const lvl = idx - b;
    if (lvl < 0) return T('floor.basement', { n: b + lvl + 1 }) || ('Мазе ' + (b + lvl + 1));
    return T('floorplan.label', { n: lvl + 1 });
  }

  // Съседство на стаите в плана (грид cols×rows като floorPlan). За всяка стая връща
  // масив bool по стена: true = ВЪТРЕШНА (граничи с друга стая), false = ВЪНШНА.
  // Мапва се само за 4-стенни форми; другите → всички външни. Стени: 0=горе,1=дясно,2=долу,3=ляво.
  function floorAdjacency(rooms) {
    rooms = rooms || [];
    const n = rooms.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const out = [];
    for (let i = 0; i < n; i++) {
      const nw = wallsForShape(rooms[i] && rooms[i].shape);
      if (nw !== 4) { out.push(new Array(nw).fill(false)); continue; }
      const col = i % cols;
      const up = i - cols >= 0;
      const down = i + cols < n;
      const left = col > 0;
      const right = col < cols - 1 && i + 1 < n;
      out.push([up, right, down, left]);   // 0=горе,1=дясно,2=долу,3=ляво
    }
    return out;
  }

  // Външни врати/прозорци на цял етаж (за фасадите) = сборът по ВЪНШНИТЕ стени.
  function floorExternals(rooms) {
    const adj = floorAdjacency(rooms);
    let doors = 0, windows = 0;
    (rooms || []).forEach((r, i) => {
      const walls = (r && r.walls) || [], flags = adj[i] || [];
      walls.forEach((w, wi) => {
        if (flags[wi]) return;             // вътрешна стена → не е на фасадата
        doors += Math.max(0, +(w && w.doors) || 0);
        windows += Math.max(0, +(w && w.windows) || 0);
      });
    });
    return { doors: doors, windows: windows };
  }

  // Отвори на ВЪНШНАТА стена на сградата за дадена страна (front/back/left/right).
  // Връзка „стена на стая → фасада": wall0=отзад, wall1=дясно, wall2=отпред, wall3=ляво.
  // При много стаи се броят само периметърните (външните) стени към тази посока (т.2).
  function facadeOpenings(rooms, side) {
    const wallIdx = { back: 0, right: 1, front: 2, left: 3 }[side];
    if (wallIdx == null) return { doors: 0, windows: 0 };
    const adj = floorAdjacency(rooms);
    let doors = 0, windows = 0;
    (rooms || []).forEach((r, i) => {
      const nw = wallsForShape(r && r.shape);
      if (wallIdx >= nw) return;                 // формата няма такава стена
      if ((adj[i] || [])[wallIdx]) return;       // вътрешна стена → не е на фасадата
      const w = (r.walls || [])[wallIdx] || {};
      doors += Math.max(0, +w.doors || 0);
      windows += Math.max(0, +w.windows || 0);
    });
    return { doors: doors, windows: windows };
  }

  // ── детайлен план на ЕДНА стая (отгоре) ──────────────────────────
  // Стени = N сегмента от периметъра (N = страните на формата). По стените:
  // врати (кафяв процеп) + прозорци (синя чертичка) + мебели „до стена". В центъра — мебели.
  // Стандартен отпечатък на мебел в план (px спрямо стая 290×230) — за да са
  // КАЧЕНИТЕ снимки оразмерени правилно СПРЯМО стандартните (легло > нощно шкафче).
  function furnitureSize(id) {
    const S = {
      bed:[54,40], sofa:[56,26], sofaset:[64,40], armchair:[26,26], coffee:[30,18],
      table:[40,28], chair:[16,16], desk:[38,20], toilet:[18,24], bathtub:[46,22], island:[46,26],
      tvstand:[40,14], wardrobe:[40,18], cabinet:[30,16], shelves:[34,14], nightstand:[16,14], dresser:[32,16],
      sink:[18,16], stove:[22,22], oven:[18,18], fridge:[24,26], dishwasher:[20,20], hood:[24,10],
      shower:[26,26], washer:[22,22], boiler:[16,20], shoecab:[26,14], coatrack:[14,22]
    };
    return S[id] || [28, 18];
  }
  function hashStr(s) { s = String(s); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  // Рисува една мебел в плана, центрирана в (cx,cy). Качена снимка → <image> с
  // отрязване по отпечатъка; иначе цветна кутийка. Размерът = стандартен × scale.
  function furnPlan(it, cx, cy, fillBox) {
    const fi = furnitureItem(it.type) || { name: it.type, key: '' };
    const sc = (it.scale && +it.scale > 0) ? Math.min(+it.scale, 2.5) : 1;
    const sz = furnitureSize(it.type), w = sz[0] * sc, h = sz[1] * sc, x = cx - w / 2, y = cy - h / 2;
    const nm = esc((fi.key ? T(fi.key) : fi.name).slice(0, 9));
    if (it.img) {
      const cid = 'fp' + Math.abs(hashStr(it.img + cx + 'x' + cy));
      return `<g><clipPath id="${cid}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/></clipPath>` +
        `<image href="${esc(it.img)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>` +
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="none" stroke="#7a8aa0" stroke-width="1.2"/>` +
        `<text x="${cx}" y="${y + h + 9}" text-anchor="middle" font-size="8" fill="#345" font-family="system-ui,Arial">${nm}</text></g>`;
    }
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${it.color || fillBox}" stroke="#9ab"/>` +
      `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="8" fill="#345" font-family="system-ui,Arial">${nm}</text></g>`;
  }

  // internal = bool[] по стена (true=вътрешна). Вътрешните врати/прозорци се рисуват
  // сиви/пунктирани, външните — кафяво/синьо плътно (т.4,5).
  function roomDetailPlan(room, internal) {
    const RX = 55, RY = 40, RW = 290, RH = 230;
    const n = wallsForShape(room && room.shape);
    const walls = (room && room.walls) || [];
    const items = (room && room.items) || [];
    const edges = [
      { ax: RX, ay: RY, bx: RX + RW, by: RY, len: RW, nx: 0, ny: 1 },
      { ax: RX + RW, ay: RY, bx: RX + RW, by: RY + RH, len: RH, nx: -1, ny: 0 },
      { ax: RX + RW, ay: RY + RH, bx: RX, by: RY + RH, len: RW, nx: 0, ny: -1 },
      { ax: RX, ay: RY + RH, bx: RX, by: RY, len: RH, nx: 1, ny: 0 },
    ];
    const total = 2 * (RW + RH), segLen = total / n;
    function ptAt(d) {
      d = ((d % total) + total) % total;
      for (const e of edges) { if (d <= e.len) { const t = d / e.len; return { x: e.ax + (e.bx - e.ax) * t, y: e.ay + (e.by - e.ay) * t, nx: e.nx, ny: e.ny }; } d -= e.len; }
      return { x: RX, y: RY, nx: 0, ny: 1 };
    }
    let inner = `<rect x="0" y="0" width="${W}" height="${H}" fill="#f4f7f9"/>`;
    inner += `<rect x="${RX}" y="${RY}" width="${RW}" height="${RH}" fill="#fff" stroke="#778" stroke-width="2"/>`;
    for (let i = 0; i < n; i++) {
      const m = ptAt(i * segLen + segLen / 2);
      const w = walls[i] || {};
      const ext = !(internal && internal[i]);          // външна стена?
      inner += `<text x="${m.x + m.nx * 13}" y="${m.y + m.ny * 13 + 3}" text-anchor="middle" font-size="11" fill="${ext ? '#9aa' : '#bbb'}" font-family="system-ui,Arial">${i + 1}${ext ? '' : '·в'}</text>`;
      const doors = Math.max(0, +w.doors || 0), windows = Math.max(0, +w.windows || 0), tot = doors + windows;
      const dCol = ext ? '#b5651d' : '#9aa3ad', wCol = ext ? '#2a86d8' : '#9fb0bd', dash = ext ? '' : ' stroke-dasharray="3 2"';
      for (let k = 0; k < tot; k++) {
        const p = ptAt(i * segLen + segLen * ((k + 1) / (tot + 1)));
        const isDoor = k < doors, ln = 11, ox = -p.ny, oy = p.nx;
        inner += `<line x1="${p.x - ox * ln}" y1="${p.y - oy * ln}" x2="${p.x + ox * ln}" y2="${p.y + oy * ln}" stroke="${isDoor ? dCol : wCol}" stroke-width="${isDoor ? 5 : 3}"${dash}/>`;
      }
      // Мебелите към стена i се редят ЕДИН ДО ДРУГ ПОКРАЙ стената (по дължината ѝ),
      // на малко разстояние навътре — не се трупат един зад друг (т.1,3).
      const wItems = items.filter(it => it.place === 'wall' && (it.wall || 0) === i).slice(0, 4);
      wItems.forEach((it, j) => {
        const p = ptAt(i * segLen + segLen * ((j + 1) / (wItems.length + 1)));   // точка ПО стената
        const inOff = 20;                                                         // малко навътре от стената
        inner += furnPlan(it, p.x + p.nx * inOff, p.y + p.ny * inOff, '#e8eef5');
      });
    }
    const center = items.filter(it => it.place === 'center');
    const cols = Math.max(1, Math.ceil(Math.sqrt(center.length || 1)));
    center.forEach((it, j) => {
      const cx = RX + RW / 2 + ((j % cols) - (cols - 1) / 2) * 64;
      const cy = RY + RH / 2 + (Math.floor(j / cols) - (Math.ceil(center.length / cols) - 1) / 2) * 50;
      inner += furnPlan(it, cx, cy, '#fff3df');
    });
    const rt = roomType(room && room.type);
    inner += label((rt ? T(rt.key) : (room && room.type) || '') + ' — ' + T('floorplan.room'));
    return svgFrame(inner);
  }

  // Груба височина на мебел (дял от стената) за страничните изгледи.
  function furnitureHeight(id) {
    if (['wardrobe', 'fridge', 'shelves', 'cabinet', 'shower', 'boiler', 'coatrack'].indexOf(id) > -1) return 0.82;
    if (['nightstand'].indexOf(id) > -1) return 0.36;
    return 0.52;
  }

  // ── страничен изглед на ЕДНА стена (отвътре) ─────────────────────
  // Показва вратите/прозорците на стената + мебелите „до тази стена".
  function wallElevation(room, w) {
    const walls = (room && room.walls) || [], items = (room && room.items) || [];
    const ww = walls[w] || { doors: 0, windows: 0 };
    const WX = 34, WY = 60, WW = W - 68, WH = 210, floorY = WY + WH;
    let inner = `<rect x="0" y="0" width="${W}" height="${H}" fill="#eef3f7"/>`;
    inner += `<rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" fill="#f7f3ea" stroke="#778" stroke-width="2"/>`;
    inner += `<line x1="${WX - 6}" y1="${floorY}" x2="${WX + WW + 6}" y2="${floorY}" stroke="#556" stroke-width="3"/>`;
    const doors = Math.max(0, +ww.doors || 0), windows = Math.max(0, +ww.windows || 0), openings = doors + windows;
    for (let k = 0; k < openings; k++) {
      const cx = WX + WW * ((k + 1) / (openings + 1));
      if (k < doors) {
        const dw = 36, dh = WH * 0.82;
        inner += `<rect x="${cx - dw / 2}" y="${floorY - dh}" width="${dw}" height="${dh}" rx="2" fill="#e7d3bf" stroke="#b5651d" stroke-width="2"/><circle cx="${cx + dw / 2 - 6}" cy="${floorY - dh / 2}" r="2.5" fill="#8a5a1d"/>`;
      } else {
        const wn = 46, wh = 46, wy = WY + WH * 0.26;
        inner += `<rect x="${cx - wn / 2}" y="${wy}" width="${wn}" height="${wh}" fill="#dff1ff" stroke="#2a86d8" stroke-width="2"/><line x1="${cx}" y1="${wy}" x2="${cx}" y2="${wy + wh}" stroke="#2a86d8"/><line x1="${cx - wn / 2}" y1="${wy + wh / 2}" x2="${cx + wn / 2}" y2="${wy + wh / 2}" stroke="#2a86d8"/>`;
      }
    }
    const wallItems = items.filter(it => it.place === 'wall' && (it.wall || 0) === w);
    const slotW = WW / Math.max(wallItems.length, 1);
    wallItems.forEach((it, j) => {
      const fi = furnitureItem(it.type) || { name: it.type, key: '' };
      const sc = (it.scale && +it.scale > 0) ? Math.min(+it.scale, 2.5) : 1;
      const fh = Math.min(WH * furnitureHeight(it.type) * sc, WH * 0.95);
      const fw = Math.min(Math.max(furnitureSize(it.type)[0] * sc, 28), slotW * 0.82, 90), cx = WX + slotW * (j + 0.5);
      const x = cx - fw / 2, y = floorY - fh, nm = esc((fi.key ? T(fi.key) : fi.name).slice(0, 8));
      if (it.img) {
        const cid = 'fe' + Math.abs(hashStr(it.img + cx + 'w' + w + j));
        inner += `<g><clipPath id="${cid}"><rect x="${x}" y="${y}" width="${fw}" height="${fh}" rx="3"/></clipPath>` +
          `<image href="${esc(it.img)}" x="${x}" y="${y}" width="${fw}" height="${fh}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>` +
          `<rect x="${x}" y="${y}" width="${fw}" height="${fh}" rx="3" fill="none" stroke="#5a7a95" stroke-width="1.5"/>` +
          `<text x="${cx}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#234" font-family="system-ui,Arial">${nm}</text></g>`;
      } else {
        inner += `<g><rect x="${x}" y="${y}" width="${fw}" height="${fh}" rx="3" fill="${it.color || '#cde0ef'}" stroke="#5a7a95" stroke-width="1.5"/><text x="${cx}" y="${floorY - fh / 2 + 3}" text-anchor="middle" font-size="9" fill="#234" font-family="system-ui,Arial">${nm}</text></g>`;
      }
    });
    const rt = roomType(room && room.type);
    inner += label((rt ? T(rt.key) : '') + ' — ' + T('wall.label', { n: w + 1 }));
    return svgFrame(inner);
  }

  // ── ПЕРСПЕКТИВЕН интериорен изглед (като снимка: дълбочина, не плосък) ──────
  // Едноточкова перспектива: под + таван + лява/дясна/задна стена сходят към
  // изчезваща точка. Мебелите са 3D блокчета (или качени снимки), оразмерени
  // според дълбочината И стандартния отпечатък (легло > нощно шкафче).
  // focusWall (число) → 3D изглед, в който ТАЗИ стена е задната (нейните врати/прозорци
  // + мебелите „до нея"). null → общ 3D изглед на стаята (задна стена = стена 1).
  function roomPerspective(room, focusWall) {
    const items = (room && room.items) || [], walls = (room && room.walls) || [];
    const rt = roomType(room && room.type);
    const fw = (typeof focusWall === 'number') ? focusWall : null;
    // Близка рамка (отворът към зрителя) и задна стена (по-малка, навътре).
    const NX0 = 18, NX1 = 382, NY0 = 26, NY1 = 332, BX0 = 150, BX1 = 250, BY0 = 122, BY1 = 230;
    const wallC = '#d8ccb6';                               // неутрални стени
    const floorC = shade(rt ? rt.color : '#e7dcc6', 0.92); // подът подсказва типа стая
    const nBL = [NX0, NY1], nBR = [NX1, NY1], fBL = [BX0, BY1], fBR = [BX1, BY1];
    const nTL = [NX0, NY0], nTR = [NX1, NY0], fTL = [BX0, BY0], fTR = [BX1, BY0];
    const poly = (pts, fill, st) => `<polygon points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="${fill}" stroke="${st || shade(fill, 0.72)}" stroke-width="1.2"/>`;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#26262b"/>`;   // тъмно извън стаята
    s += poly([nTL, nTR, fTR, fTL], shade(wallC, 1.12));   // таван (по-светъл)
    s += poly([nTL, fTL, fBL, nBL], shade(wallC, 0.8));    // лява стена (по-тъмна)
    s += poly([nTR, fTR, fBR, nBR], shade(wallC, 0.92));   // дясна стена
    s += poly([nBL, nBR, fBR, fBL], floorC);               // под
    s += `<rect x="${BX0}" y="${BY0}" width="${BX1 - BX0}" height="${BY1 - BY0}" fill="${wallC}" stroke="${shade(wallC, 0.72)}" stroke-width="1.2"/>`; // задна стена

    // Прозорец/врата на задната стена (фокусната стена, или стена 1 при общ изглед).
    const w0 = walls[fw == null ? 0 : fw] || {};
    if ((+w0.windows || 0) > 0) {
      const ww = (BX1 - BX0) * 0.42, wh = (BY1 - BY0) * 0.5, wx = (BX0 + BX1) / 2 - ww / 2, wy = BY0 + (BY1 - BY0) * 0.22;
      s += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="#bfe0f5" stroke="#7d97aa" stroke-width="1.5"/><line x1="${wx + ww / 2}" y1="${wy}" x2="${wx + ww / 2}" y2="${wy + wh}" stroke="#7d97aa"/><line x1="${wx}" y1="${wy + wh / 2}" x2="${wx + ww}" y2="${wy + wh / 2}" stroke="#7d97aa"/>`;
    }
    if ((+w0.doors || 0) > 0) {
      const dw = (BX1 - BX0) * 0.3, dh = (BY1 - BY0) * 0.78, dx = BX0 + 4, dy = BY1 - dh;
      s += `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="${shade(wallC, 0.7)}" stroke="${shade(wallC, 0.5)}" stroke-width="1.5"/>`;
    }

    // Точка по пода: u (0..1 ляво→дясно), v (0..1 близо→далеч) чрез билинейна интерполация.
    function floorPt(u, v) {
      const lx = nBL[0] + (fBL[0] - nBL[0]) * v, ly = nBL[1] + (fBL[1] - nBL[1]) * v;
      const rx = nBR[0] + (fBR[0] - nBR[0]) * v, ry = nBR[1] + (fBR[1] - nBR[1]) * v;
      return [lx + (rx - lx) * u, ly + (ry - ly) * u];
    }
    const depthScale = v => 1 - 0.56 * v;                  // близо 1 → далеч ~0.44

    // Разпределение: мебели „до стена" → към задната стена; „в центъра" → решетка по пода.
    const placed = [];
    // Мебелите на ФОКУСНАТА (задна) стена → покрай задната стена.
    const backIts = items.filter(it => it.place === 'wall' && (fw == null || (it.wall || 0) === fw));
    backIts.forEach((it, k) => { const u = backIts.length > 1 ? 0.16 + 0.68 * (k / (backIts.length - 1)) : 0.5; placed.push({ it, u, v: 0.9 }); });
    // Мебелите на ДРУГИТЕ стени → покрай ЛЯВАТА и ДЯСНАТА стена (т.11 — и страничните с мебели).
    if (fw != null) {
      const others = items.filter(it => it.place === 'wall' && (it.wall || 0) !== fw);
      const lefts = others.filter((_, i) => i % 2 === 0), rights = others.filter((_, i) => i % 2 === 1);
      lefts.forEach((it, k) => placed.push({ it, u: 0.1, v: lefts.length > 1 ? 0.42 + 0.44 * (k / (lefts.length - 1)) : 0.55 }));
      rights.forEach((it, k) => placed.push({ it, u: 0.9, v: rights.length > 1 ? 0.42 + 0.44 * (k / (rights.length - 1)) : 0.55 }));
    }
    const cen = items.filter(it => it.place === 'center');
    const cols = Math.max(1, Math.ceil(Math.sqrt(cen.length || 1)));
    const rows = Math.max(1, Math.ceil((cen.length || 1) / cols));
    cen.forEach((it, k) => {
      const col = k % cols, row = Math.floor(k / cols);
      const u = cols > 1 ? 0.26 + 0.48 * (col / (cols - 1)) : 0.5;
      const v = rows > 1 ? 0.32 + 0.42 * (row / (rows - 1)) : 0.52;
      placed.push({ it, u, v });
    });
    placed.sort((a, b) => b.v - a.v);                      // далечните първо (живописец)
    placed.forEach(p => { s += furnBlock(p.it, floorPt(p.u, p.v), depthScale(p.v)); });

    // Заглавие горе-ляво (полупрозрачно). При фокус добавя „стена N (3D)".
    const baseTitle = (rt ? T(rt.key) : (room && room.type) || '');
    const title = fw == null ? baseTitle : baseTitle + ' — ' + T('wall.label', { n: fw + 1 }) + ' (3D)';
    s += `<text x="14" y="20" font-family="system-ui,Arial" font-size="13" fill="#fff" opacity="0.85">${esc(title)}</text>`;
    return svgFrame(s);
  }

  // Едно мебелно тяло в перспектива: 3D блок (лице+горна+дясна плоскост) ИЛИ качена
  // снимка. base = допирната точка на пода (долен център). ds = мащаб по дълбочина.
  function furnBlock(it, base, ds) {
    const fi = furnitureItem(it.type) || { name: it.type, key: '' };
    const sc = (it.scale && +it.scale > 0 ? Math.min(+it.scale, 2.5) : 1) * ds;
    const fp = furnitureSize(it.type);
    const w = Math.max(10, fp[0] * 1.5 * sc), depth = Math.max(6, fp[1] * 0.7 * sc);
    const h = Math.max(10, furnitureHeight(it.type) * 150 * sc);
    const cx = base[0], by = base[1], x = cx - w / 2, topY = by - h;
    const col = it.color || DEFAULT_FURN_COLOR;
    const nm = esc((fi.key ? T(fi.key) : fi.name).slice(0, 10));
    const dx = depth * 0.7, dy = depth * 0.5;              // 3D отместване нагоре-надясно
    // Сянка на пода (за „кацане").
    let g = `<ellipse cx="${cx}" cy="${by}" rx="${(w / 2 + dx * 0.5).toFixed(1)}" ry="${Math.max(3, depth * 0.5).toFixed(1)}" fill="#0000003a"/>`;
    if (it.img) {
      // Качена снимка като ОБЕМНА ПЛОЧКА (от 3D редактора): ъгълът „свива" лицето
      // (перспективно), а дебелината се показва като страничен ръб от страната,
      // накъдето е завъртяно (знака на yaw). Без ротация → просто лице (както преди).
      const rot = it.rot || {};
      const yaw = (+rot.yaw || 0) * Math.PI / 180, pitch = (+rot.pitch || 0) * Math.PI / 180;
      const dep = Math.max(0, +rot.depth || 0) * 0.12 * sc;        // дебелина в px (мащабирана)
      const fw2 = Math.max(6, w * Math.max(0.22, Math.abs(Math.cos(yaw))));   // свито лице (хоризонтал)
      const fh2 = Math.max(6, h * Math.max(0.30, Math.abs(Math.cos(pitch)))); // свито лице (вертикал)
      const fx = cx - fw2 / 2, fyTop = by - fh2;
      const sideW = dep * Math.abs(Math.sin(yaw));                 // видима дебелина
      const cid = 'pp' + Math.abs(hashStr(it.img + cx + '_' + by));
      // страничната плоскост (ръбът) — отдясно при yaw>0, отляво при yaw<0
      if (sideW > 0.6) {
        const sx = yaw >= 0 ? fx + fw2 : fx - sideW;
        g += `<polygon points="${sx},${fyTop + Math.min(6, dep)} ${sx + sideW},${fyTop} ${sx + sideW},${by - 1} ${sx},${by}" fill="#4a4540"/>`;
      }
      g += `<clipPath id="${cid}"><rect x="${fx}" y="${fyTop}" width="${fw2}" height="${fh2}" rx="2"/></clipPath>` +
        `<image href="${esc(it.img)}" x="${fx}" y="${fyTop}" width="${fw2}" height="${fh2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>` +
        `<rect x="${fx}" y="${fyTop}" width="${fw2}" height="${fh2}" rx="2" fill="none" stroke="#0007" stroke-width="1"/>`;
      return `<g>${g}</g>`;
    }
    g += `<polygon points="${x + w},${topY} ${x + w + dx},${topY - dy} ${x + w + dx},${by - dy} ${x + w},${by}" fill="${shade(col, 0.68)}"/>` +      // дясна плоскост
      `<polygon points="${x},${topY} ${x + w},${topY} ${x + w + dx},${topY - dy} ${x + dx},${topY - dy}" fill="${shade(col, 1.16)}"/>` +              // горна плоскост
      `<rect x="${x}" y="${topY}" width="${w}" height="${h}" rx="1.5" fill="${col}" stroke="${shade(col, 0.55)}" stroke-width="1"/>` +                  // лице
      `<text x="${cx}" y="${by - 4}" text-anchor="middle" font-size="${Math.max(6, Math.round(8 * ds))}" fill="#fff" opacity="0.85" font-family="system-ui,Arial">${nm}</text>`;
    return `<g>${g}</g>`;
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

  return { SIDES, FOOTPRINTS, ROOFS, ROOM_TYPES, BASEMENT_ROOM_TYPES, ROOM_SHAPES, FURNITURE, wallsForShape, furnitureItem, WALL_MAX, CENTER_MAX, elevation, roofPlan, floorPlan, roomDetailPlan, wallElevation, roomPerspective, floorsStack, floorAdjacency, floorExternals, facadeOpenings, floorTitle };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HouseRender;
