// House-Look-Book — топ класация (топ N по лайкове; N идва от бекенда/config).
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  function row(p, rank) {
    const el = document.createElement('div');
    el.className = 'rank-row';
    const preview = p.composer_params
      ? HouseRender.elevation(Object.assign({}, p.composer_params, { limits: { minFloors: 1, maxFloors: 3 } }), 'front')
      : '<div class="no-svg">снимки</div>';
    el.innerHTML = `
      <div class="rank-num">#${rank}</div>
      <div class="rank-svg">${preview}</div>
      <div class="rank-info">
        <div class="house-card-title">${HLB.esc(p.title)}</div>
        <div class="house-card-meta">от ${HLB.esc(p.owner_name || 'анонимен')}</div>
      </div>
      <div class="rank-likes">❤️ ${p.like_count || 0}</div>`;
    return el;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await HLB.mountNav('rank');
    try {
      const r = await HLB.api('/proposals/ranking');
      const list = r.ranking || [];
      if (!list.length) { $('#empty').style.display = ''; return; }
      list.forEach((p, i) => $('#list').appendChild(row(p, i + 1)));
    } catch (e) {
      console.error(e);
      $('#empty').textContent = 'Грешка при зареждане.';
      $('#empty').style.display = '';
    }
  });
})();
