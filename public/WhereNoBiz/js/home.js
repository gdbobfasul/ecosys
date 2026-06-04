// WhereNoBiz — начален екран: карта по континенти + двата бутона.
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    await WNB.mountNav('home');

    // Брой одобрени постове по континент (за баджовете на картата).
    let counts = {};
    try {
      const r = await WNB.api('/continents');
      (r.continents || []).forEach(c => { counts[c.name] = c.postCount; });
    } catch (_) {}

    const box = document.getElementById('mapBox');
    box.innerHTML = WorldMap.svg(counts, '1.0164');
    // Клик на континент → листване на държавите в него.
    WorldMap.bind(box, (continent) => {
      location.href = 'browse.html?continent=' + encodeURIComponent(continent);
    });
  });
})();
