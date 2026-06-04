// Version: 1.0171
// WhereNoBiz — карта на света по континенти (реална снимка + кликаеми зони).
// Фон: NASA „Blue Marble" (img/world.jpg) — обществено достояние (US gov), без права.
// Върху него стоят НЕвидими кликаеми зони по континент (highlight при посочване),
// плюс четим етикет и бадж с брой постове. Зоните са в екваториални координати
// 1000×520, така че приблизително лягат върху реалните континенти на снимката.

const WorldMap = (function () {
  'use strict';

  const IMG = 'img/world.jpg';

  // Кликаеми зони (hotspot) по континент върху платно 1000×520 (екваториален изглед).
  // d може да съдържа повече от едно под-очертание (Гренландия→Сев. Америка, Н. Зеландия→Океания).
  const REGIONS = [
    { id: 'North America', label: 'Северна Америка', cx: 196, cy: 150,
      d: 'M70 96 Q80 78 102 78 Q116 68 134 82 L126 96 Q160 86 186 82 Q255 66 330 80 ' +
         'Q364 90 352 116 L330 114 Q338 140 305 146 Q320 162 296 178 Q304 198 274 204 ' +
         'L264 226 Q260 202 250 197 Q237 207 227 192 Q242 177 220 170 Q207 152 187 154 ' +
         'Q170 162 156 150 Q150 126 152 106 Q110 92 82 90 Q72 90 70 96 Z ' +
         'M352 38 Q420 24 452 58 Q466 92 428 108 Q392 104 370 80 Q346 58 352 38 Z' },

    { id: 'South America', label: 'Южна Америка', cx: 328, cy: 336,
      d: 'M288 240 Q330 232 360 250 Q390 263 375 298 Q371 340 344 375 Q330 410 305 427 ' +
         'Q292 434 290 410 Q300 372 294 344 Q286 314 292 286 Q289 262 296 248 Q293 242 288 240 Z' },

    { id: 'Europe', label: 'Европа', cx: 525, cy: 116,
      d: 'M478 100 Q500 88 515 96 Q535 86 545 100 Q560 92 580 102 Q588 118 565 122 ' +
         'Q570 138 548 140 L540 152 Q532 138 520 138 Q500 142 495 128 Q478 132 472 116 Q470 105 478 100 Z' },

    { id: 'Russia', label: 'Русия', cx: 778, cy: 94,
      d: 'M590 126 Q618 76 692 72 Q792 58 888 68 Q942 72 958 96 Q960 122 918 126 ' +
         'Q838 134 758 126 Q678 132 626 124 Q598 126 590 126 Z' },

    { id: 'Africa', label: 'Африка', cx: 538, cy: 248,
      d: 'M470 148 Q525 140 590 152 Q605 160 600 175 Q620 200 638 233 Q628 270 595 318 ' +
         'Q576 344 556 345 Q545 349 542 334 Q537 302 540 272 Q523 252 518 234 ' +
         'Q498 236 476 230 Q452 220 452 196 Q456 168 470 148 Z' },

    { id: 'Asia', label: 'Азия', cx: 790, cy: 178,
      d: 'M605 132 Q700 124 820 128 Q905 132 938 150 Q940 158 905 158 Q915 175 885 172 ' +
         'Q895 192 865 188 Q840 204 815 196 Q800 218 778 212 Q770 230 758 217 L752 202 ' +
         'Q745 224 730 220 Q720 200 718 182 Q706 200 694 198 Q672 222 646 226 ' +
         'Q616 228 606 206 Q598 188 612 178 Q604 162 614 156 Q606 148 605 132 Z' },

    { id: 'Oceania', label: 'Океания', cx: 860, cy: 332,
      d: 'M812 300 Q860 292 900 305 Q930 315 922 340 Q910 365 875 365 Q840 372 818 358 ' +
         'Q800 345 805 325 Q804 308 812 300 Z ' +
         'M928 372 Q942 372 940 388 Q932 402 922 392 Q920 378 928 372 Z' },
  ];

  // Връща SVG стринг. counts = { 'Asia': 12, ... } (по избор) за бадж с брой постове.
  // ver = низ за cache-bust на снимката (по избор).
  function svg(counts, ver) {
    counts = counts || {};
    const v = ver ? ('?v=' + ver) : '';
    const regions = REGIONS.map(r => {
      const n = counts[r.id] || 0;
      const badge = n > 0
        ? `<g class="map-badge"><circle cx="${r.cx + 32}" cy="${r.cy - 22}" r="13" />
             <text x="${r.cx + 32}" y="${r.cy - 18}" text-anchor="middle">${n}</text></g>`
        : '';
      return `<g class="map-region" data-continent="${r.id}" tabindex="0" role="button" aria-label="${r.label}">
        <path d="${r.d}" />
        <text class="map-label" x="${r.cx}" y="${r.cy}" text-anchor="middle">${r.label}</text>
        ${badge}
      </g>`;
    }).join('');
    return `<svg viewBox="0 0 1000 520" xmlns="http://www.w3.org/2000/svg" class="world-map" preserveAspectRatio="xMidYMid slice">
      <image href="${IMG}${v}" x="0" y="0" width="1000" height="520" preserveAspectRatio="none"/>
      <rect x="0" y="0" width="1000" height="520" class="map-veil"/>
      ${regions}
    </svg>`;
  }

  // Закача клик/Enter на регионите → callback(continentId).
  function bind(container, onPick) {
    container.querySelectorAll('.map-region').forEach(g => {
      const pick = () => onPick(g.getAttribute('data-continent'));
      g.addEventListener('click', pick);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
  }

  return { svg, bind, REGIONS };
})();
