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

  // ── „Всички етажи" (изглед ОТГОРЕ, когато покривът е махнат) ──
  // Голям квадрат: дебел ЧЕРЕН контур = покривът (най-външен, до ръбовете). Навътре по
  // ~2px — контур на всеки ЕТАЖ в свой цвят (горен най-отвън → мазе най-вътре). Стаите
  // се чертаят като ПЪЛНИ планове, които се ЗАСТЪПВАТ: най-дълбокото мазе най-отдолу,
  // горният етаж най-отгоре. Линии и надписи в цвета на етажа. Легендата е НАД изгледа.
  function floorsStack(params) {
    const all = params.rooms || [];
    const b = Math.max(0, +params.basements || 0), nAll = all.length;
    const order = [];                                     // физически отгоре→надолу
    for (let i = nAll - 1; i >= b; i--) order.push(i);    // надземни: горен → партер
    for (let i = 0; i < b; i++) order.push(i);            // мазета: -1 → най-дълбоко
    if (!order.length) order.push(0);
    const PAL = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#b45309', '#475569', '#db2777', '#7c3aed'];
    const colorFor = di => PAL[di % PAL.length];
    const nF = order.length;
    function fpOutline(x, y, w, h, sw, stroke) {
      const cx = x + w / 2, cy = y + h / 2;
      if (isCustom(params)) return `<path d="${customPath(params.customShape.pts, x, y, w, h)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
      switch (params.footprint) {
        case 'dome': case 'waterlily': return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(w / 2).toFixed(1)}" ry="${(h / 2).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
        case 'snail': return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(Math.min(w, h) / 2).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
        case 'lshape': return `<path d="M${x} ${y} H${(x + w * 0.58).toFixed(1)} V${(y + h * 0.52).toFixed(1)} H${x + w} V${y + h} H${x} Z" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
        default: return `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
    }
    // ── Легенда ОТГОРЕ ──
    const margin = 8, headH = 16, rowH = 22;
    const legendH = headH + nF * rowH + 6;
    let inner = `<text x="${margin}" y="12" font-size="11" font-weight="bold" fill="#334" font-family="system-ui,Arial">${esc(T('floorstack.legend'))}</text>`;
    order.forEach((fi, di) => {
      const ly = headH + di * rowH + 12, col = colorFor(di);
      inner += `<rect x="${margin}" y="${ly - 9}" width="12" height="12" rx="2" fill="${col}"/>`;
      inner += `<text x="${margin + 18}" y="${ly}" font-size="10.5" font-weight="bold" fill="${col}" font-family="system-ui,Arial">${esc(floorTitle(params, fi))}</text>`;
      const names = (all[fi] || []).map(r => { const rt = roomType(r.type); return rt ? T(rt.key) : r.type; });
      inner += `<text x="${margin + 18}" y="${ly + 10}" font-size="8.5" fill="#445" font-family="system-ui,Arial">${esc((names.join(', ') || '—').slice(0, 46))}</text>`;
    });
    // ── Голям квадрат отдолу (черен контур до ръбовете) ──
    const S = W - 2 * margin, BX = margin, BY = legendH, BW = S, BH = S, GAP = 2;
    inner += fpOutline(BX, BY, BW, BH, 4, '#111');                       // покрив (черно)
    order.forEach((fi, di) => {                                          // контур на всеки етаж (2px навътре)
      const ins = di * GAP;
      inner += fpOutline(BX + ins, BY + ins, BW - 2 * ins, BH - 2 * ins, 1.6, colorFor(di));
    });
    // планове на стаите — ЗАСТЪПЕНИ, най-дълбокото мазе ПЪРВО (отдоло), горен етаж последен (отгоре)
    const labels = [];
    for (let di = nF - 1; di >= 0; di--) {
      const fi = order[di], fr = all[fi] || [], col = colorFor(di);
      if (!fr.length) continue;
      const ins = di * GAP, fx = BX + ins, fy = BY + ins, fw = BW - 2 * ins, fh = BH - 2 * ins;
      const n = fr.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const cw = fw / cols, ch = fh / rows;
      fr.forEach((r, ci) => {                                            // план като преди: 2 стаи = половинки
        const cx = fx + (ci % cols) * cw, cy = fy + Math.floor(ci / cols) * ch;
        inner += `<rect x="${(cx + 1).toFixed(1)}" y="${(cy + 1).toFixed(1)}" width="${(cw - 2).toFixed(1)}" height="${(ch - 2).toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.5"/>`;
        const rt = roomType(r.type), nm = rt ? T(rt.key) : r.type;
        labels.push({ di, col, x: cx + cw / 2, y: cy + ch / 2, ch, nm: String(nm) });   // позицията съвпада с стаята
      });
    }
    // ── надписите НАД всички линии; вертикално отместване по етаж за по-малко застъпване ──
    labels.forEach(c => {
      const fs = Math.max(6.5, Math.min(11, c.ch * 0.22));
      const offY = (c.di - (nF - 1) / 2) * Math.min(11, c.ch / (nF + 1));
      inner += `<text x="${c.x.toFixed(1)}" y="${(c.y + offY + fs * 0.34).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}" fill="${c.col}" font-family="system-ui,Arial" stroke="#fff" stroke-width="2.4" paint-order="stroke" style="paint-order:stroke">${esc(c.nm.slice(0, 11))}</text>`;
    });
    const H2 = legendH + S + 22;
    inner += `<text x="${W / 2}" y="${(H2 - 7).toFixed(1)}" text-anchor="middle" font-family="system-ui,Arial" font-size="13" fill="#445">${esc(T('floorstack.label'))}</text>`;
    return `<svg viewBox="0 0 ${W} ${H2.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="${W}" height="${H2.toFixed(1)}" fill="#f4f7f9"/>${inner}</svg>`;
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
      // Маркер на ръба на стаята: врата (кафяв, дебел) / прозорец (син, тънък).
      // side: 0=горе,1=дясно,2=долу,3=ляво (стена wi → страна wi%4).
      const edgeMark = (side, rx, ry, rw, rh, k, total, isDoor) => {
        const col = isDoor ? '#b5651d' : '#2a86d8', sw = isDoor ? 4 : 2.4;
        const ln = Math.max(6, Math.min(rw, rh) * (isDoor ? 0.34 : 0.26)), t = (k + 1) / (total + 1);
        if (side === 0) { const x = rx + rw * t; return `<line x1="${(x - ln / 2).toFixed(1)}" y1="${ry.toFixed(1)}" x2="${(x + ln / 2).toFixed(1)}" y2="${ry.toFixed(1)}" stroke="${col}" stroke-width="${sw}"/>`; }
        if (side === 1) { const y = ry + rh * t; return `<line x1="${(rx + rw).toFixed(1)}" y1="${(y - ln / 2).toFixed(1)}" x2="${(rx + rw).toFixed(1)}" y2="${(y + ln / 2).toFixed(1)}" stroke="${col}" stroke-width="${sw}"/>`; }
        if (side === 2) { const x = rx + rw * t; return `<line x1="${(x - ln / 2).toFixed(1)}" y1="${(ry + rh).toFixed(1)}" x2="${(x + ln / 2).toFixed(1)}" y2="${(ry + rh).toFixed(1)}" stroke="${col}" stroke-width="${sw}"/>`; }
        const y = ry + rh * t; return `<line x1="${rx.toFixed(1)}" y1="${(y - ln / 2).toFixed(1)}" x2="${rx.toFixed(1)}" y2="${(y + ln / 2).toFixed(1)}" stroke="${col}" stroke-width="${sw}"/>`;
      };
      for (let i = 0; i < n; i++) {
        const room = rooms[i] || {};
        const rt = roomType(room.type) || { name: room.type || '?', color: '#eee', key: '' };
        const cx = PX + (i % cols) * cw, cy = PY + Math.floor(i / cols) * ch;
        const lbl = rt.key ? T(rt.key) : rt.name;
        const shape = room.shape || 'rect';
        const rx = cx + 3, ry = cy + 3, rw = cw - 6, rh = ch - 6;
        let marks = '';
        (room.walls || []).forEach((wl, wi) => {                    // врати/прозорци по стените на стаята
          const side = wi % 4, dN = Math.max(0, +(wl && wl.doors) || 0), wN = Math.max(0, +(wl && wl.windows) || 0), tot = dN + wN;
          for (let k = 0; k < tot; k++) marks += edgeMark(side, rx, ry, rw, rh, k, tot, k < dN);
        });
        inner += `<g>
          ${roomShapeSvg(shape, rx, ry, rw, rh, rt.color)}
          ${marks}
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
  // Кратко име на етажа („Етаж N" / „Мазе N") — за префикс пред стая.
  function floorShort(params, idx) {
    const b = +(params && params.basements) || 0, lvl = idx - b;
    if (lvl < 0) return T('floor.basement', { n: b + lvl + 1 });
    return T('floor.short', { n: lvl + 1 });
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

  // РАЗПОЗНАВАЕМ ТОП-ДАУН СИЛУЕТ на мебелта (изглед ОТГОРЕ) — вместо гол правоъгълник.
  // (x,y)=горе-ляво, w×h=отпечатък. Всеки тип чертае характерната си форма отгоре.
  function furnPlanShape(type, x, y, w, h, col) {
    col = col || DEFAULT_FURN_COLOR;
    const dk = shade(col, 0.6), lt = shade(col, 1.15), mid = shade(col, 0.85), cx = x + w / 2, cy = y + h / 2;
    const r = (xx, yy, ww, hh, f, rad) => `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.max(1, ww).toFixed(1)}" height="${Math.max(1, hh).toFixed(1)}" rx="${rad == null ? 2 : rad}" fill="${f}" stroke="${dk}" stroke-width="1"/>`;
    const ci = (a, b, rr, f) => `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${rr.toFixed(1)}" fill="${f}" stroke="${dk}" stroke-width="0.8"/>`;
    const el = (a, b, rx, ry, f) => `<ellipse cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${f}" stroke="${dk}" stroke-width="0.8"/>`;
    const ln = (x1, y1, x2, y2) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${dk}" stroke-width="0.8"/>`;
    let g = '';
    switch (type) {
      case 'bed':                                                            // матрак + възглавници горе + завивка
        g += r(x, y, w, h, col, 3);
        g += r(x + w * 0.08, y + h * 0.06, w * 0.36, h * 0.2, '#fff', 2) + r(x + w * 0.56, y + h * 0.06, w * 0.36, h * 0.2, '#fff', 2);
        g += r(x + w * 0.05, y + h * 0.34, w * 0.9, h * 0.6, lt, 2) + ln(x + w * 0.05, y + h * 0.34, x + w * 0.95, y + h * 0.34);
        break;
      case 'sofa': case 'sofaset': case 'armchair':                          // П-форма (облегалка+подлакътници+седалки)
        g += r(x, y, w, h * 0.32, mid, 3);                                   // облегалка (горе)
        g += r(x, y + h * 0.2, w * 0.16, h * 0.8, col, 3) + r(x + w * 0.84, y + h * 0.2, w * 0.16, h * 0.8, col, 3); // подлакътници
        g += r(x + w * 0.18, y + h * 0.38, w * 0.64, h * 0.56, lt, 3);       // седалка
        if (type !== 'armchair') g += ln(cx, y + h * 0.4, cx, y + h * 0.92);
        break;
      case 'table': case 'coffee':                                           // плот + столове наоколо (за table)
        g += r(x + w * 0.14, y + h * 0.14, w * 0.72, h * 0.72, col, 3);
        if (type === 'table') { g += r(x + w * 0.36, y - h * 0.02, w * 0.28, h * 0.12, mid, 2) + r(x + w * 0.36, y + h * 0.9, w * 0.28, h * 0.12, mid, 2) + r(x - w * 0.02, y + h * 0.36, w * 0.12, h * 0.28, mid, 2) + r(x + w * 0.9, y + h * 0.36, w * 0.12, h * 0.28, mid, 2); }
        break;
      case 'chair':
        g += r(x + w * 0.18, y + h * 0.28, w * 0.64, h * 0.64, col, 2) + r(x + w * 0.12, y + h * 0.06, w * 0.76, h * 0.16, mid, 2);
        break;
      case 'desk':
        g += r(x, y, w, h, col, 2) + r(x + w * 0.62, y + h * 0.1, w * 0.32, h * 0.8, mid, 2) + ln(x + w * 0.62, cy, x + w * 0.94, cy);
        break;
      case 'toilet':                                                         // казанче (правоъг.) + чиния (овал)
        g += r(x + w * 0.2, y, w * 0.6, h * 0.28, mid, 2);
        g += el(cx, y + h * 0.62, w * 0.32, h * 0.34, '#fff') + el(cx, y + h * 0.62, w * 0.2, h * 0.22, lt);
        break;
      case 'bathtub':                                                        // заоблен правоъг. + вътрешен овал (вода)
        g += r(x, y, w, h, '#fff', Math.min(w, h) * 0.28) + el(cx, cy + h * 0.06, w * 0.34, h * 0.32, shade('#cfe6f2', 1)) + ci(x + w * 0.16, y + h * 0.18, Math.max(1.5, w * 0.04), mid);
        break;
      case 'sink':
        g += r(x, y, w, h, col, 2) + el(cx, cy, w * 0.34, h * 0.3, '#fff') + ci(cx, y + h * 0.16, Math.max(1.2, w * 0.05), mid);
        break;
      case 'shower':                                                         // квадрат + четвърт-кръг (кабина) + отточник
        g += r(x, y, w, h, lt, 2) + `<path d="M${x} ${y} A ${w} ${h} 0 0 1 ${(x + w).toFixed(1)} ${(y + h).toFixed(1)}" fill="none" stroke="${dk}" stroke-width="1"/>` + ci(cx, cy, Math.max(1.4, w * 0.06), mid);
        break;
      case 'stove':                                                          // 4 котлона
        g += r(x, y, w, h, col, 2) + ci(x + w * 0.3, y + h * 0.3, w * 0.14, mid) + ci(x + w * 0.7, y + h * 0.3, w * 0.14, mid) + ci(x + w * 0.3, y + h * 0.7, w * 0.14, mid) + ci(x + w * 0.7, y + h * 0.7, w * 0.14, mid);
        break;
      case 'oven': case 'dishwasher':
        g += r(x, y, w, h, col, 2) + ln(x + 1.5, y + h * 0.2, x + w - 1.5, y + h * 0.2) + r(x + w * 0.1, y + h * 0.28, w * 0.8, h * 0.6, mid, 2);
        break;
      case 'washer':                                                         // люк (кръг)
        g += r(x, y, w, h, col, 2) + ci(cx, cy + h * 0.08, Math.min(w, h) * 0.3, lt) + ci(cx, cy + h * 0.08, Math.min(w, h) * 0.18, '#cfe6f2');
        break;
      case 'fridge':
        g += r(x, y, w, h, lt, 3) + ln(x + 1.5, cy, x + w - 1.5, cy) + r(x + w * 0.08, y + h * 0.12, w * 0.06, h * 0.24, mid, 2) + r(x + w * 0.08, y + h * 0.56, w * 0.06, h * 0.3, mid, 2);
        break;
      case 'wardrobe': case 'cabinet': case 'shoecab':                       // шкаф с врати
        g += r(x, y, w, h, col, 2) + ln(cx, y + 1.5, cx, y + h - 1.5) + ci(cx - w * 0.08, cy, Math.max(1, w * 0.03), dk) + ci(cx + w * 0.08, cy, Math.max(1, w * 0.03), dk);
        break;
      case 'nightstand': case 'dresser':                                     // чекмеджета (линии) + дръжки
        g += r(x, y, w, h, col, 2);
        { const rows = type === 'dresser' ? 3 : 2; for (let i = 1; i < rows; i++) g += ln(x + 1.5, y + h * i / rows, x + w - 1.5, y + h * i / rows); for (let i = 0; i < rows; i++) g += ci(cx, y + h * (i + 0.5) / rows, Math.max(1, w * 0.04), dk); }
        break;
      case 'shelves': case 'tvstand':
        g += r(x, y, w, h, col, 2); for (let i = 1; i <= 2; i++) g += ln(x + 1.5, y + h * i / 3, x + w - 1.5, y + h * i / 3);
        break;
      case 'island':
        g += r(x, y, w, h, col, 3) + r(x + w * 0.06, y + h * 0.06, w * 0.88, h * 0.88, lt, 2);
        break;
      case 'boiler':
        g += ci(cx, cy, Math.min(w, h) * 0.46, lt) + ci(cx, cy, Math.min(w, h) * 0.14, mid);
        break;
      case 'coatrack':                                                       // куки (точки) в кръг
        g += ci(cx, cy, Math.min(w, h) * 0.4, mid); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g += ci(cx + Math.cos(a) * w * 0.3, cy + Math.sin(a) * h * 0.3, Math.max(1, w * 0.04), dk); }
        break;
      case 'hood':
        g += r(x, y + h * 0.2, w, h * 0.6, mid, 3) + ln(x + w * 0.2, cy, x + w * 0.8, cy);
        break;
      default:
        g += r(x, y, w, h, col, 3) + ln(x + 2, cy, x + w - 2, cy);
    }
    return g;
  }

  // Рисува една мебел в плана, центрирана в (cx,cy). Качена снимка → <image> с
  // отрязване по отпечатъка; иначе РАЗПОЗНАВАЕМ топ-даун силует (не гол правоъгълник).
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
    return `<g>${furnPlanShape(it.type, x, y, w, h, it.color || fillBox)}` +
      `<text x="${cx}" y="${y + h + 8}" text-anchor="middle" font-size="8" fill="#345" font-family="system-ui,Arial">${nm}</text></g>`;
  }

  // internal = bool[] по стена (true=вътрешна). Вътрешните врати/прозорци се рисуват
  // сиви/пунктирани, външните — кафяво/синьо плътно (т.4,5).
  function roomDetailPlan(room, internal, floorLabel) {
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
    inner += label((floorLabel ? floorLabel + ' · ' : '') + (rt ? T(rt.key) : (room && room.type) || '') + ' — ' + T('floorplan.room'));
    return svgFrame(inner);
  }

  // ── БИБЛИОТЕКА С ФОРМИ на мебелите (НЕ кутии!) ────────────────────────────
  // Всяка мебел/уред се рисува с РАЗПОЗНАВАЕМ силует (тоалетна чиния, легло, гардероб…).
  // Паралелепипед остава САМО за наистина кутиестите (шкафове, хладилник, пералня…) —
  // и там с ВИДИМИ вратички/рафтове/дръжки. (x,y) = горе-ляво, w×h = габарит, подът е y+h.
  const BOXY = { wardrobe: 1, cabinet: 1, fridge: 1, dresser: 1, nightstand: 1, tvstand: 1, dishwasher: 1, washer: 1, oven: 1, stove: 1, boiler: 1, shoecab: 1, island: 1, shelves: 1 };

  function furnFace(type, x, y, w, h, col) {
    col = col || DEFAULT_FURN_COLOR;
    const dk = shade(col, 0.58), lt = shade(col, 1.18), mid = shade(col, 0.82);
    const cx = x + w / 2, by = y + h;
    const r = (xx, yy, ww, hh, fill, rx, sw) => `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.max(1, ww).toFixed(1)}" height="${Math.max(1, hh).toFixed(1)}" rx="${rx == null ? 2 : rx}" fill="${fill}" stroke="${dk}" stroke-width="${sw || 1}"/>`;
    const ln = (x1, y1, x2, y2, st, sw) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${st || dk}" stroke-width="${sw || 1.2}"/>`;
    const el2 = (ecx, ecy, rx, ry, fill, sw) => `<ellipse cx="${ecx.toFixed(1)}" cy="${ecy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" stroke="${dk}" stroke-width="${sw || 1}"/>`;
    const ci = (ccx, ccy, rr, fill, sw) => `<circle cx="${ccx.toFixed(1)}" cy="${ccy.toFixed(1)}" r="${rr.toFixed(1)}" fill="${fill}" stroke="${dk}" stroke-width="${sw || 1}"/>`;
    let g = '';
    switch (type) {
      case 'bed':         // табла + рамка + матрак + възглавница + завивка
        g += r(x, y, w * 0.10, h, mid, 3);                                                    // табла (ляво, високо)
        g += r(x + w * 0.06, by - h * 0.34, w * 0.94, h * 0.16, mid, 2);                      // рамка
        g += r(x + w * 0.08, by - h * 0.52, w * 0.90, h * 0.22, lt, 5);                       // матрак
        g += r(x + w * 0.11, by - h * 0.50, w * 0.16, h * 0.12, '#ffffff', 3);                // възглавница
        g += r(x + w * 0.30, by - h * 0.48, w * 0.66, h * 0.17, col, 4);                      // завивка
        g += r(x + w * 0.10, by - h * 0.18, w * 0.04, h * 0.18, dk, 1) + r(x + w * 0.90, by - h * 0.18, w * 0.04, h * 0.18, dk, 1); // крачета
        break;
      case 'sofa': case 'sofaset': case 'armchair': {                                        // облегалка + седалка + подлакътници
        g += r(x + w * 0.06, y, w * 0.88, h * 0.55, mid, 6);                                  // облегалка
        g += r(x, y + h * 0.30, w * 0.14, h * 0.55, col, 6);                                  // ляв подлакътник
        g += r(x + w * 0.86, y + h * 0.30, w * 0.14, h * 0.55, col, 6);                       // десен подлакътник
        g += r(x + w * 0.10, y + h * 0.48, w * 0.80, h * 0.30, lt, 5);                        // седалка (възглавници)
        if (type !== 'armchair') g += ln(cx, y + h * 0.50, cx, y + h * 0.76);                 // разделение на седалките
        g += r(x + w * 0.08, by - h * 0.10, w * 0.05, h * 0.10, dk, 1) + r(x + w * 0.87, by - h * 0.10, w * 0.05, h * 0.10, dk, 1); // крачета
        break;
      }
      case 'coffee': case 'table': {                                                         // плот + крака
        const topH = h * (type === 'coffee' ? 0.18 : 0.12), legW = Math.max(2, w * 0.05);
        g += r(x, y, w, topH, col, 3);                                                        // плот
        g += r(x + w * 0.06, y + topH, legW, h - topH, mid, 1);                               // ляв крак
        g += r(x + w * 0.94 - legW, y + topH, legW, h - topH, mid, 1);                        // десен крак
        break;
      }
      case 'chair':                                                                           // облегалка + седалка + крака
        g += r(x + w * 0.15, y, w * 0.12, h * 0.55, mid, 2);                                  // облегалка (странично)
        g += r(x, y + h * 0.45, w, h * 0.12, col, 3);                                         // седалка
        g += r(x + w * 0.08, y + h * 0.57, Math.max(2, w * 0.08), h * 0.43, mid, 1);
        g += r(x + w * 0.84, y + h * 0.57, Math.max(2, w * 0.08), h * 0.43, mid, 1);
        break;
      case 'desk': {                                                                          // плот + шкафче с чекмеджета + крак
        const topH = h * 0.10;
        g += r(x, y, w, topH, col, 2);                                                        // плот
        g += r(x + w * 0.62, y + topH, w * 0.34, h - topH, mid, 2);                           // шкафче
        g += ln(x + w * 0.64, y + h * 0.42, x + w * 0.94, y + h * 0.42) + ln(x + w * 0.64, y + h * 0.70, x + w * 0.94, y + h * 0.70); // чекмеджета
        g += ci(x + w * 0.79, y + h * 0.30, Math.max(1.4, w * 0.015), dk);                    // дръжка
        g += r(x + w * 0.04, y + topH, Math.max(2, w * 0.05), h - topH, mid, 1);              // крак
        break;
      }
      case 'toilet': {                                                                        // казанче + чиния + основа
        g += r(x + w * 0.22, y, w * 0.56, h * 0.34, lt, 4);                                   // казанче
        g += r(x + w * 0.30, y + h * 0.06, w * 0.40, h * 0.06, mid, 2);                       // бутон
        g += el2(cx, y + h * 0.58, w * 0.42, h * 0.20, '#ffffff');                            // седалка/чиния
        g += el2(cx, y + h * 0.58, w * 0.28, h * 0.12, lt);                                   // отвор на чинията
        g += r(x + w * 0.36, y + h * 0.72, w * 0.28, h * 0.28, '#ffffff', 4);                 // основа
        break;
      }
      case 'bathtub':                                                                         // вана: борд + корито + крачета + смесител
        g += r(x, y + h * 0.30, w, h * 0.58, '#ffffff', Math.min(14, h * 0.28), 1.4);         // корпус
        g += el2(cx, y + h * 0.42, w * 0.44, h * 0.13, shade('#cfe6f2', 1));                  // водна повърхност
        g += r(x + w * 0.06, by - h * 0.10, w * 0.06, h * 0.10, dk, 1) + r(x + w * 0.88, by - h * 0.10, w * 0.06, h * 0.10, dk, 1);
        g += ln(x + w * 0.12, y + h * 0.08, x + w * 0.12, y + h * 0.30, mid, 3) + ci(x + w * 0.12, y + h * 0.08, Math.max(2, w * 0.03), mid); // смесител
        break;
      case 'sink':                                                                            // мивка: смесител + купа + колона
        g += ln(cx, y + h * 0.02, cx, y + h * 0.18, mid, 3) + ci(cx, y + h * 0.02, Math.max(1.6, w * 0.05), mid); // смесител
        g += el2(cx, y + h * 0.30, w * 0.48, h * 0.16, '#ffffff', 1.4);                       // купа
        g += r(x + w * 0.36, y + h * 0.42, w * 0.28, h * 0.58, lt, 3);                        // колона
        break;
      case 'shower': {                                                                        // душ-кабина: рамка + стъкло + слушалка + корито
        g += r(x, y, w, h, 'none', 3, 2);                                                     // рамка
        g += `<rect x="${(x + 2).toFixed(1)}" y="${(y + 2).toFixed(1)}" width="${(w - 4).toFixed(1)}" height="${(h - 4).toFixed(1)}" rx="3" fill="#bfe0f5" opacity="0.45" stroke="none"/>`; // стъкло
        g += ln(cx, y + 3, cx, by - h * 0.10, mid, 1.6);                                      // отвор на вратата
        g += ln(x + w * 0.18, y + h * 0.08, x + w * 0.18, y + h * 0.22, mid, 2.4) + ci(x + w * 0.18, y + h * 0.24, Math.max(2, w * 0.05), mid); // слушалка
        g += r(x, by - h * 0.08, w, h * 0.08, lt, 3);                                         // корито
        break;
      }
      case 'coatrack': {                                                                      // закачалка: стойка + куки + основа
        g += r(cx - Math.max(1.5, w * 0.05), y + h * 0.04, Math.max(3, w * 0.10), h * 0.90, mid, 2); // стълб
        g += ln(cx, y + h * 0.10, x + w * 0.10, y + h * 0.22, dk, 2) + ln(cx, y + h * 0.10, x + w * 0.90, y + h * 0.22, dk, 2); // рамена
        g += ln(cx, y + h * 0.24, x + w * 0.22, y + h * 0.34, dk, 2) + ln(cx, y + h * 0.24, x + w * 0.78, y + h * 0.34, dk, 2);
        g += el2(cx, by - h * 0.03, w * 0.36, h * 0.05, mid);                                 // основа
        break;
      }
      case 'hood':                                                                            // аспиратор: комин + камбана
        g += r(cx - w * 0.10, y, w * 0.20, h * 0.45, mid, 1);                                 // комин
        g += `<polygon points="${(x).toFixed(1)},${(by).toFixed(1)} ${(x + w).toFixed(1)},${(by).toFixed(1)} ${(x + w * 0.72).toFixed(1)},${(y + h * 0.45).toFixed(1)} ${(x + w * 0.28).toFixed(1)},${(y + h * 0.45).toFixed(1)}" fill="${col}" stroke="${dk}"/>`;
        g += ln(x + w * 0.16, by - 2.5, x + w * 0.84, by - 2.5, lt, 1.6);                     // светеща лента
        break;
      case 'washer':                                                                          // пералня: люк (кръгла врата) + панел
        g += r(x, y, w, h, col, 3, 1.4);
        g += ln(x + 2, y + h * 0.18, x + w - 2, y + h * 0.18);                                // панел
        g += ci(x + w * 0.82, y + h * 0.09, Math.max(2, h * 0.05), lt);                       // копче
        g += ci(cx, y + h * 0.58, Math.min(w, h) * 0.30, mid, 2);                             // люк (външен)
        g += ci(cx, y + h * 0.58, Math.min(w, h) * 0.20, '#bfe0f5', 1.4);                     // стъкло
        break;
      case 'stove':                                                                           // печка: котлони/копчета + фурна с прозорец
        g += r(x, y, w, h, col, 2, 1.4);
        g += ci(x + w * 0.22, y + h * 0.09, Math.max(1.6, w * 0.045), dk) + ci(x + w * 0.42, y + h * 0.09, Math.max(1.6, w * 0.045), dk) + ci(x + w * 0.62, y + h * 0.09, Math.max(1.6, w * 0.045), dk) + ci(x + w * 0.82, y + h * 0.09, Math.max(1.6, w * 0.045), dk); // копчета
        g += r(x + w * 0.10, y + h * 0.26, w * 0.80, h * 0.52, '#3a3f46', 3);                 // врата на фурната
        g += r(x + w * 0.18, y + h * 0.34, w * 0.64, h * 0.30, '#5b6b7a', 2);                 // прозорец
        g += ln(x + w * 0.12, y + h * 0.22, x + w * 0.88, y + h * 0.22, dk, 2.4);             // дръжка
        break;
      case 'oven':                                                                            // фурна за вграждане
        g += r(x, y, w, h, col, 2, 1.4);
        g += ci(x + w * 0.2, y + h * 0.1, Math.max(1.6, h * 0.05), dk) + ci(x + w * 0.5, y + h * 0.1, Math.max(1.6, h * 0.05), dk) + ci(x + w * 0.8, y + h * 0.1, Math.max(1.6, h * 0.05), dk);
        g += ln(x + w * 0.10, y + h * 0.24, x + w * 0.90, y + h * 0.24, dk, 2.6);             // дръжка
        g += r(x + w * 0.10, y + h * 0.32, w * 0.80, h * 0.56, '#3a3f46', 3);                 // стъклена врата
        g += r(x + w * 0.18, y + h * 0.40, w * 0.64, h * 0.36, '#5b6b7a', 2);
        break;
      case 'fridge':                                                                          // хладилник: 2 врати + дръжки
        g += r(x, y, w, h, lt, 4, 1.4);
        g += ln(x + 1.5, y + h * 0.34, x + w - 1.5, y + h * 0.34, dk, 1.6);                   // граница фризер/хладилник
        g += r(x + w * 0.08, y + h * 0.08, Math.max(2, w * 0.05), h * 0.18, mid, 2);          // горна дръжка
        g += r(x + w * 0.08, y + h * 0.40, Math.max(2, w * 0.05), h * 0.30, mid, 2);          // долна дръжка
        break;
      case 'dishwasher':                                                                      // съдомиялна: панел + врата с дръжка
        g += r(x, y, w, h, col, 2, 1.4);
        g += ln(x + 2, y + h * 0.16, x + w - 2, y + h * 0.16);
        g += ci(x + w * 0.16, y + h * 0.08, Math.max(1.4, h * 0.035), dk) + ci(x + w * 0.30, y + h * 0.08, Math.max(1.4, h * 0.035), dk);
        g += ln(x + w * 0.10, y + h * 0.26, x + w * 0.90, y + h * 0.26, dk, 2.6);             // дръжка
        g += r(x + w * 0.10, y + h * 0.34, w * 0.80, h * 0.54, mid, 2);                       // врата
        break;
      case 'boiler':                                                                          // бойлер: легнал цилиндър + тръби
        g += r(x, y + h * 0.06, w, h * 0.70, lt, Math.min(16, h * 0.30), 1.4);                // корпус (заоблен)
        g += ci(x + w * 0.5, y + h * 0.41, Math.min(w, h) * 0.10, mid);                       // капак/термостат
        g += ln(x + w * 0.25, y + h * 0.76, x + w * 0.25, by, mid, 3) + ln(x + w * 0.75, y + h * 0.76, x + w * 0.75, by, mid, 3); // тръби
        break;
      case 'wardrobe':                                                                        // гардероб: корниз + 2 врати + дръжки + крачета
        g += r(x, y, w, h * 0.96, col, 2, 1.4);
        g += r(x - 1, y, w + 2, h * 0.05, mid, 1);                                            // корниз
        g += ln(cx, y + h * 0.05, cx, y + h * 0.96, dk, 1.6);                                 // разделение на вратите
        g += r(cx - w * 0.10, y + h * 0.42, Math.max(1.6, w * 0.035), h * 0.14, dk, 2);       // лява дръжка
        g += r(cx + w * 0.065, y + h * 0.42, Math.max(1.6, w * 0.035), h * 0.14, dk, 2);      // дясна дръжка
        g += r(x + w * 0.06, by - h * 0.04, w * 0.06, h * 0.04, dk, 1) + r(x + w * 0.88, by - h * 0.04, w * 0.06, h * 0.04, dk, 1);
        break;
      case 'cabinet': case 'shoecab':                                                         // шкаф: врати + рафт/клапи + дръжки
        g += r(x, y, w, h, col, 2, 1.4);
        if (type === 'cabinet') {
          g += ln(cx, y + 2, cx, by - 2, dk, 1.4);                                            // 2 врати
          g += ln(x + 2, y + h * 0.5, x + w - 2, y + h * 0.5, mid, 1);                        // рафт
          g += ci(cx - w * 0.08, y + h * 0.45, Math.max(1.4, w * 0.02), dk) + ci(cx + w * 0.08, y + h * 0.45, Math.max(1.4, w * 0.02), dk);
        } else {
          g += ln(x + 2, y + h * 0.5, x + w - 2, y + h * 0.5, dk, 1.2);                       // 2 клапи за обувки
          g += ln(x + w * 0.30, y + h * 0.28, x + w * 0.70, y + h * 0.28, dk, 2) + ln(x + w * 0.30, y + h * 0.78, x + w * 0.70, y + h * 0.78, dk, 2); // дръжки-канали
        }
        break;
      case 'shelves': {                                                                       // етажерка: отворени рафтове + книги
        g += r(x, y, w, h, 'none', 2, 1.6);
        for (let i = 1; i <= 3; i++) g += ln(x + 1.5, y + h * i / 4, x + w - 1.5, y + h * i / 4, dk, 1.4);
        const bookC = ['#a35d4e', '#4e7aa3', '#6da35d', '#a3934e'];
        for (let sh = 0; sh < 3; sh++) {
          for (let b = 0; b < 3; b++) {
            const bw = w * 0.10, bh = h * 0.16;
            g += r(x + w * (0.10 + b * 0.14 + sh * 0.04), y + h * (sh + 1) / 4 - bh, bw, bh, bookC[(sh + b) % 4], 1);
          }
        }
        break;
      }
      case 'nightstand': case 'dresser': {                                                    // чекмеджета с дръжки
        g += r(x, y, w, h * 0.96, col, 2, 1.4);
        const rows = type === 'dresser' ? 3 : 2;
        for (let i = 1; i < rows; i++) g += ln(x + 2, y + h * 0.96 * i / rows, x + w - 2, y + h * 0.96 * i / rows, dk, 1.2);
        for (let i = 0; i < rows; i++) g += r(cx - w * 0.10, y + h * 0.96 * (i + 0.5) / rows - 1.4, w * 0.20, 2.8, dk, 1.4);
        g += r(x + w * 0.06, by - h * 0.04, w * 0.06, h * 0.04, dk, 1) + r(x + w * 0.88, by - h * 0.04, w * 0.06, h * 0.04, dk, 1);
        break;
      }
      case 'tvstand':                                                                         // ТВ шкаф: нисък шкаф + телевизор отгоре
        g += r(x + w * 0.14, y, w * 0.72, h * 0.52, '#22262c', 2, 1.2);                       // телевизор
        g += r(x + w * 0.17, y + h * 0.03, w * 0.66, h * 0.44, '#39424e', 1);                 // екран
        g += r(cx - w * 0.03, y + h * 0.52, w * 0.06, h * 0.06, dk, 1);                       // столче
        g += r(x, y + h * 0.60, w, h * 0.40, col, 2, 1.4);                                    // шкаф
        g += ln(cx, y + h * 0.62, cx, by - 2, dk, 1.2);                                       // 2 вратички
        g += ci(cx - w * 0.06, y + h * 0.80, Math.max(1.4, w * 0.018), dk) + ci(cx + w * 0.06, y + h * 0.80, Math.max(1.4, w * 0.018), dk);
        break;
      case 'island':                                                                          // кухненски остров: плот с надвес + шкафове
        g += r(x + w * 0.04, y + h * 0.10, w * 0.92, h * 0.90, col, 2, 1.4);                  // тяло
        g += ln(x + w * 0.36, y + h * 0.12, x + w * 0.36, by - 2, dk, 1.2) + ln(x + w * 0.68, y + h * 0.12, x + w * 0.68, by - 2, dk, 1.2); // вратички
        g += r(x, y, w, h * 0.10, mid, 2);                                                    // плот (надвес)
        break;
      default:
        g += r(x, y, w, h, col, 3, 1.2);                                                      // непознат тип → кутия (последна резерва)
        g += ln(x + 2, y + h * 0.5, x + w - 2, y + h * 0.5, dk, 1);
    }
    return g;
  }

  // Груба височина на мебел (дял от стената) за страничните изгледи.
  function furnitureHeight(id) {
    if (['wardrobe', 'fridge', 'shelves', 'cabinet', 'shower', 'boiler', 'coatrack'].indexOf(id) > -1) return 0.82;
    if (['nightstand'].indexOf(id) > -1) return 0.36;
    return 0.52;
  }

  // ── страничен изглед на ЕДНА стена (отвътре) ─────────────────────
  // Показва вратите/прозорците на стената + мебелите „до тази стена".
  function wallElevation(room, w, floorLabel) {
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
        // РАЗПОЗНАВАЕМА ФОРМА на мебелта (не кутия!) — тоалетна чиния, легло, гардероб…
        inner += `<g>${furnFace(it.type, x, y, fw, fh, it.color || '#cde0ef')}<text x="${cx}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#234" font-family="system-ui,Arial">${nm}</text></g>`;
      }
    });
    const rt = roomType(room && room.type);
    inner += label((floorLabel ? floorLabel + ' · ' : '') + (rt ? T(rt.key) : '') + ' — ' + T('wall.label', { n: w + 1 }));
    return svgFrame(inner);
  }

  // ── ПЕРСПЕКТИВЕН интериорен изглед (като снимка: дълбочина, не плосък) ──────
  // Едноточкова перспектива: под + таван + лява/дясна/задна стена сходят към
  // изчезваща точка. Мебелите са 3D блокчета (или качени снимки), оразмерени
  // според дълбочината И стандартния отпечатък (легло > нощно шкафче).
  // focusWall (число) → 3D изглед, в който ТАЗИ стена е задната (нейните врати/прозорци
  // + мебелите „до нея"). null → общ 3D изглед на стаята (задна стена = стена 1).
  function roomPerspective(room, focusWall, floorLabel) {
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
      // __side дава на furnBlock накъде да „обърне" мебелта (лек наклон към стената).
      lefts.forEach((it, k) => placed.push({ it: { ...it, __side: 'left' }, u: 0.1, v: lefts.length > 1 ? 0.42 + 0.44 * (k / (lefts.length - 1)) : 0.55 }));
      rights.forEach((it, k) => placed.push({ it: { ...it, __side: 'right' }, u: 0.9, v: rights.length > 1 ? 0.42 + 0.44 * (k / (rights.length - 1)) : 0.55 }));
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
    const baseTitle = (floorLabel ? floorLabel + ' · ' : '') + (rt ? T(rt.key) : (room && room.type) || '');
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
    // РАЗПОЗНАВАЕМИ ФОРМИ вместо голи кутии: кутиестите мебели (шкафове, хладилник…)
    // пазят 3D плоскостите (горна+дясна) + ВИДИМИ вратички/рафтове/дръжки върху лицето;
    // всички останали (легло, тоалетна чиния, диван, вана…) се рисуват със силуета си.
    if (BOXY[it.type]) {
      g += `<polygon points="${x + w},${topY} ${x + w + dx},${topY - dy} ${x + w + dx},${by - dy} ${x + w},${by}" fill="${shade(col, 0.68)}"/>` +   // дясна плоскост
        `<polygon points="${x},${topY} ${x + w},${topY} ${x + w + dx},${topY - dy} ${x + dx},${topY - dy}" fill="${shade(col, 1.16)}"/>`;           // горна плоскост
    }
    g += furnFace(it.type, x, topY, w, h, col);                                              // лицето — с формата на мебелта
    g += `<text x="${cx}" y="${topY - 3}" text-anchor="middle" font-size="${Math.max(6, Math.round(8 * ds))}" fill="#fff" opacity="0.85" font-family="system-ui,Arial">${nm}</text>`;
    // Ориентация КЪМ СТЕНАТА: мебел до лявата/дясната стена се накланя леко към нея
    // (перспективен намек), за да изглежда опряна на стената, а не „гледаща" зрителя.
    const side = it.__side;
    if (side === 'left') return `<g transform="translate(${cx.toFixed(1)},${by.toFixed(1)}) skewY(-8) translate(${(-cx).toFixed(1)},${(-by).toFixed(1)})">${g}</g>`;
    if (side === 'right') return `<g transform="translate(${cx.toFixed(1)},${by.toFixed(1)}) skewY(8) translate(${(-cx).toFixed(1)},${(-by).toFixed(1)})">${g}</g>`;
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

  return { VERSION: '1.0014', SIDES, FOOTPRINTS, ROOFS, ROOM_TYPES, BASEMENT_ROOM_TYPES, ROOM_SHAPES, FURNITURE, wallsForShape, furnitureItem, WALL_MAX, CENTER_MAX, elevation, roofPlan, floorPlan, roomDetailPlan, wallElevation, roomPerspective, floorsStack, floorAdjacency, floorExternals, facadeOpenings, floorTitle, floorShort };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HouseRender;
