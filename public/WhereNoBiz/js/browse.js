// WhereNoBiz — листване: континент → държави → липсващи бизнеси.
// Без континент в URL → показваме картата за избор.
// С континент → списък държави; всяка се разтваря и показва постовете (ранкнати).
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const continent = params.get('continent');

  // Разтваряне на държава → зарежда постовете ѝ веднъж.
  async function toggleCountry(row, code, name) {
    const open = row.classList.toggle('open');
    let body = row.querySelector('.country-posts');
    if (!open) { if (body) body.style.display = 'none'; return; }
    if (body) { body.style.display = ''; return; }

    body = document.createElement('div');
    body.className = 'country-posts';
    body.innerHTML = '<div class="loading">Зареждам…</div>';
    row.appendChild(body);
    try {
      const r = await WNB.api('/posts?country=' + encodeURIComponent(code));
      const posts = r.posts || [];
      if (!posts.length) {
        body.innerHTML = `<div class="empty-line">Още няма обяви за ${WNB.esc(name)}.
          <a href="new.html?country=${code}">Поствай първата ниша</a>.</div>`;
        return;
      }
      body.innerHTML = posts.map((p, i) => `
        <a class="biz-row" href="post.html?id=${p.id}">
          <span class="biz-rank">#${i + 1}</span>
          <span class="biz-title">${WNB.esc(p.title)}</span>
          <span class="biz-votes">✅ ${p.confirm_count}</span>
        </a>`).join('');
    } catch (e) {
      body.innerHTML = `<div class="empty-line">Грешка: ${WNB.esc(e.message)}</div>`;
    }
  }

  function countryRow(c) {
    const row = document.createElement('div');
    row.className = 'country-row';
    row.innerHTML = `
      <button class="country-head">
        <span class="flag">${WNB.flag(c.code)}</span>
        <span class="cname">${WNB.esc(c.name)}</span>
        <span class="cbadge">${c.postCount ? c.postCount + ' липсващи' : 'няма обяви'}</span>
        <span class="chev">▾</span>
      </button>`;
    row.querySelector('.country-head').onclick = () => toggleCountry(row, c.code, c.name);
    return row;
  }

  async function showCountries() {
    $('#title').textContent = '🔎 ' + (WNB.CONTINENT_BG[continent] || continent);
    $('#subtitle').textContent = 'Избери държава, за да видиш какви бизнеси още ги няма там.';
    try {
      const r = await WNB.api('/countries?continent=' + encodeURIComponent(continent));
      const list = r.countries || [];
      const wrap = $('#countryList');
      if (!list.length) { $('#empty').textContent = 'Няма държави в този континент.'; $('#empty').style.display = ''; return; }
      list.forEach(c => wrap.appendChild(countryRow(c)));
    } catch (e) {
      $('#empty').textContent = 'Грешка при зареждане: ' + e.message;
      $('#empty').style.display = '';
    }
  }

  async function showContinentPicker() {
    const box = $('#pickMap');
    box.style.display = '';
    let counts = {};
    try { (await WNB.api('/continents')).continents.forEach(c => counts[c.name] = c.postCount); } catch (_) {}
    box.innerHTML = WorldMap.svg(counts);
    WorldMap.bind(box, (cont) => { location.href = 'browse.html?continent=' + encodeURIComponent(cont); });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await WNB.mountNav('browse');
    if (continent) showCountries();
    else showContinentPicker();
  });
})();
