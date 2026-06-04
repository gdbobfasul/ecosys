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
      d: 'M55 92 Q66 66 95 68 Q112 54 132 74 L122 94 Q158 82 185 80 Q255 64 330 80 ' +
         'Q364 90 352 116 L330 114 Q338 140 305 146 Q320 162 296 178 Q304 198 274 204 ' +
         'L264 226 Q260 202 250 197 Q237 207 227 192 Q242 177 220 170 Q207 152 187 154 ' +
         'Q167 167 152 152 Q137 132 112 134 Q85 130 80 108 Q58 102 55 92 Z ' +
         'M352 38 Q420 24 452 58 Q466 92 428 108 Q392 104 370 80 Q346 58 352 38 Z' },

    { id: 'South America', label: 'Южна Америка', cx: 322, cy: 336,
      d: 'M273 238 Q320 230 357 249 Q388 262 374 297 Q370 340 343 374 Q329 410 304 426 ' +
         'Q288 434 284 410 Q295 372 284 343 Q263 313 273 285 Q260 261 276 247 Q278 241 273 238 Z' },

    { id: 'Europe', label: 'Европа', cx: 525, cy: 116,
      d: 'M478 100 Q500 88 515 96 Q535 86 545 100 Q560 92 580 102 Q588 118 565 122 ' +
         'Q570 138 548 140 L540 152 Q532 138 520 138 Q500 142 495 128 Q478 132 472 116 Q470 105 478 100 Z' },

    { id: 'Russia', label: 'Русия', cx: 778, cy: 100,
      d: 'M592 118 Q620 96 690 98 Q780 88 880 94 Q935 96 955 112 Q958 126 920 128 ' +
         'Q840 134 760 126 Q680 132 630 124 Q600 122 592 118 Z' },

    { id: 'Africa', label: 'Африка', cx: 575, cy: 258,
      d: 'M500 165 Q550 158 590 168 Q630 162 650 180 Q665 200 648 215 Q658 230 635 240 ' +
         'Q630 275 605 305 Q588 335 570 345 Q555 352 550 335 Q542 305 540 280 Q522 270 525 245 ' +
         'Q505 235 510 210 Q492 200 498 180 Q496 170 500 165 Z' },

    { id: 'Asia', label: 'Азия', cx: 778, cy: 182,
      d: 'M605 132 Q700 124 820 128 Q905 132 938 150 Q940 158 905 158 Q915 175 885 172 ' +
         'Q895 192 865 188 Q840 204 815 196 Q800 218 778 212 Q770 230 758 217 L752 202 ' +
         'Q745 224 730 220 Q720 202 715 180 Q695 188 688 170 Q665 197 648 182 Q640 167 660 160 ' +
         'Q635 152 615 154 Q606 148 605 132 Z' },

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
