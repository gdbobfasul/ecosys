// WhereNoBiz — схематична карта на света по континенти (SVG, кликаема).
// Не е географски точна — само разпознаваеми блокове за избор на континент.
// Всеки регион носи data-continent и реагира на клик (виж home.js / browse.js).

const WorldMap = (function () {
  'use strict';

  // Груби форми на континентите върху платно 1000×520.
  const REGIONS = [
    { id: 'North America', label: 'Сев. Америка', cx: 175, cy: 150,
      d: 'M70 70 L250 55 L270 130 L210 175 L235 230 L175 250 L120 200 L95 140 Z' },
    { id: 'South America', label: 'Юж. Америка', cx: 290, cy: 360,
      d: 'M250 270 L320 265 L340 330 L305 420 L270 445 L255 380 L240 320 Z' },
    { id: 'Europe', label: 'Европа', cx: 520, cy: 130,
      d: 'M470 80 L580 75 L590 130 L545 165 L490 160 L465 120 Z' },
    { id: 'Africa', label: 'Африка', cx: 540, cy: 290,
      d: 'M485 185 L605 185 L630 255 L575 360 L520 365 L495 280 L480 225 Z' },
    { id: 'Asia', label: 'Азия', cx: 740, cy: 165,
      d: 'M600 80 L900 70 L930 150 L860 215 L760 230 L660 205 L620 150 Z' },
    { id: 'Oceania', label: 'Океания', cx: 845, cy: 350,
      d: 'M790 300 L905 295 L920 355 L860 390 L795 370 Z' },
  ];

  // Връща SVG стринг. counts = { 'Asia': 12, ... } (по избор) за бадж с брой постове.
  function svg(counts) {
    counts = counts || {};
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
    return `<svg viewBox="0 0 1000 520" xmlns="http://www.w3.org/2000/svg" class="world-map">
      <rect x="0" y="0" width="1000" height="520" class="map-ocean" rx="14"/>
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
