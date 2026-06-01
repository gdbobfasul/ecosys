// House-Look-Book — галерия: скрол на одобрени къщи + лайк.
// Рендерът е същият HouseRender от конструктора (от composer_params).
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const PAGE = 12;
  let offset = 0;
  let user = null;
  let loading = false;
  let done = false;

  // Карта за едно предложение (SVG преглед + заглавие + лайк).
  function card(p) {
    const el = document.createElement('div');
    el.className = 'house-card';
    const preview = p.composer_params
      ? HouseRender.elevation(Object.assign({}, p.composer_params, { limits: { minFloors: 1, maxFloors: 3 } }), 'front')
      : '<div class="no-svg">Качени снимки</div>';
    el.innerHTML = `
      <div class="house-card-svg">${preview}</div>
      <div class="house-card-body">
        <div class="house-card-title">${HLB.esc(p.title)}</div>
        <div class="house-card-meta">от ${HLB.esc(p.owner_name || 'анонимен')}</div>
        <button class="like-btn" data-id="${p.id}">
          <span class="heart">🤍</span> <span class="cnt">${p.like_count || 0}</span>
        </button>
      </div>`;
    const btn = el.querySelector('.like-btn');
    btn.onclick = () => toggleLike(p.id, btn);
    if (user) markLiked(p.id, btn);
    return el;
  }

  async function markLiked(id, btn) {
    try {
      const r = await HLB.api(`/proposals/${id}/like`);
      if (r.liked) setHeart(btn, true);
    } catch (_) {}
  }

  function setHeart(btn, liked) {
    btn.classList.toggle('on', liked);
    btn.querySelector('.heart').textContent = liked ? '❤️' : '🤍';
  }

  async function toggleLike(id, btn) {
    if (!user) { location.href = 'login.html'; return; }
    const liked = btn.classList.contains('on');
    try {
      const r = liked
        ? await HLB.api(`/proposals/${id}/like`, { method: 'DELETE' })
        : await HLB.api(`/proposals/${id}/like`, { method: 'POST' });
      setHeart(btn, r.liked);
      btn.querySelector('.cnt').textContent = r.like_count;
    } catch (e) {
      if (e.status === 402) alert('Нужен е абонамент, за да лайкваш.');
      else if (e.status === 401) location.href = 'login.html';
      else alert(e.message);
    }
  }

  async function loadMore() {
    if (loading || done) return;
    loading = true;
    try {
      const r = await HLB.api(`/proposals?limit=${PAGE}&offset=${offset}`);
      const list = r.proposals || [];
      if (offset === 0 && list.length === 0) $('#empty').style.display = '';
      list.forEach(p => $('#grid').appendChild(card(p)));
      offset += list.length;
      if (list.length < PAGE) { done = true; $('#btnMore').style.display = 'none'; }
      else $('#btnMore').style.display = '';
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    user = await HLB.mountNav('gallery');
    if (!user) $('#needLogin').style.display = '';
    $('#btnMore').onclick = loadMore;
    // Безкраен скрол: дозарежда при достигане на дъното.
    window.addEventListener('scroll', () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) loadMore();
    });
    loadMore();
  });
})();
