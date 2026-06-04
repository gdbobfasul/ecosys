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
    { id: 'North America', label: 'Сев. Америка', cx: 198, cy: 150,
      d: 'M60 95 Q70 78 95 80 Q110 70 130 85 L120 100 Q150 95 175 92 Q230 80 300 92 ' +
         'Q330 100 320 120 L300 118 Q310 140 285 145 Q300 160 280 175 Q295 195 270 200 ' +
         'L262 222 Q258 200 248 195 Q235 205 225 190 Q240 175 218 168 Q205 150 185 152 ' +
         'Q165 165 150 150 Q135 130 110 132 Q85 128 78 110 Q62 105 60 95 Z ' +
         'M335 55 Q380 45 400 70 Q410 95 385 105 Q360 100 345 82 Q330 68 335 55 Z' },

    { id: 'South America', label: 'Юж. Америка', cx: 320, cy: 330,
      d: 'M290 245 Q320 240 345 252 Q370 258 360 285 Q355 320 335 350 Q325 380 308 398 ' +
         'Q298 408 292 392 Q300 365 292 345 Q278 320 282 295 Q272 270 280 255 Q283 248 290 245 Z' },

    { id: 'Europe', label: 'Европа', cx: 525, cy: 116,
      d: 'M478 100 Q500 88 515 96 Q535 86 545 100 Q560 92 580 102 Q588 118 565 122 ' +
         'Q570 138 548 140 L540 152 Q532 138 520 138 Q500 142 495 128 Q478 132 472 116 Q470 105 478 100 Z' },

    { id: 'Africa', label: 'Африка', cx: 545, cy: 258,
      d: 'M470 165 Q520 158 560 168 Q600 162 620 180 Q635 200 618 215 Q628 230 605 240 ' +
         'Q600 275 575 305 Q558 335 540 345 Q525 352 520 335 Q512 305 510 280 Q492 270 495 245 ' +
         'Q475 235 480 210 Q462 200 468 180 Q466 170 470 165 Z' },

    { id: 'Asia', label: 'Азия', cx: 772, cy: 140,
      d: 'M600 100 Q650 86 720 92 Q820 82 900 95 Q945 100 950 125 Q940 145 905 150 ' +
         'Q915 168 885 168 Q895 188 865 185 Q840 200 815 192 Q800 215 778 210 Q770 228 758 215 ' +
         'L752 200 Q745 222 730 218 Q720 200 715 178 Q695 185 688 168 Q665 195 648 180 ' +
         'Q640 165 660 158 Q635 150 615 152 Q600 140 605 122 Q596 108 600 100 Z' },

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
