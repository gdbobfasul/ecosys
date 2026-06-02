// WhereNoBiz — постване на нова „липсваща ниша".
// Концептуално това е „на сайта" (server-client модел): постване + плащане $20.
// За прототипа плащането е заглушка; постът отива за модерация.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  let createdPostId = null;
  let imgCount = 0;
  let maxImages = 30;

  function msg(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); el.style.display = ''; }

  // Пълни select-а с държави, групирани по континент.
  async function fillCountries(preselect) {
    const r = await WNB.api('/countries');
    const list = r.countries || [];
    const byCont = {};
    list.forEach(c => { (byCont[c.continent] = byCont[c.continent] || []).push(c); });
    const sel = $('#country');
    WNB.CONTINENTS.forEach(cont => {
      if (!byCont[cont]) return;
      const og = document.createElement('optgroup');
      og.label = (WNB.CONTINENT_BG[cont] || cont);
      byCont[cont].forEach(c => {
        const o = new Option(`${WNB.flag(c.code)} ${c.name}`, c.code);
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    if (preselect) sel.value = preselect;
  }

  async function submit(e) {
    e.preventDefault();
    const country_code = $('#country').value;
    const title = $('#title').value.trim();
    const description = $('#desc').value;
    const links = $('#links').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!country_code) { msg($('#formMsg'), 'Избери страна.', false); return; }
    if (!$('#ackLang').checked) { msg($('#formMsg'), 'Потвърди, че ще пишеш на официалния език на страната (иначе — бан).', false); return; }
    if (!title) { msg($('#formMsg'), 'Назови липсващия бизнес.', false); return; }
    try {
      const r = await WNB.api('/posts', { method: 'POST', body: { country_code, title, description, links } });
      createdPostId = r.post.id;
      msg($('#formMsg'), `Постнато! Такса за постване: $${r.fee} (заглушка). Постът чака модерация.`, true);
      $('#postForm').style.display = 'none';
      $('#imagesBox').style.display = '';
      $('#goPost').href = 'post.html?id=' + createdPostId;
    } catch (e2) {
      if (e2.status === 401) location.href = 'login.html';
      else msg($('#formMsg'), e2.message, false);
    }
  }

  async function upload() {
    const f = $('#imgInput').files[0];
    if (!f) { msg($('#imgMsg'), 'Избери снимка.', false); return; }
    if (imgCount >= maxImages) { msg($('#imgMsg'), `Лимит ${maxImages} снимки.`, false); return; }
    const fd = new FormData();
    fd.append('image', f);
    try {
      const r = await WNB.api(`/posts/${createdPostId}/images`, { method: 'POST', formData: fd });
      imgCount++;
      const img = document.createElement('img');
      img.src = r.image.url;
      $('#imgThumbs').appendChild(img);
      $('#imgInput').value = '';
      msg($('#imgMsg'), `Качено (${imgCount}/${maxImages}).`, true);
    } catch (e) {
      msg($('#imgMsg'), e.message, false);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await WNB.mountNav('new');
    if (!user) { $('#needLogin').style.display = ''; return; }
    $('#langWarn').style.display = '';
    $('#postForm').style.display = '';

    // Лимити/такси от бекенда config — взимаме ги от health/config endpoint? Тук четем от един пост-create отговор.
    // Описателните лимити идват от публичния config.json (огледало).
    try {
      const cfg = await (await fetch('config.json')).json();
      if (cfg && cfg.post) {
        $('#cntMax').textContent = cfg.post.maxDescriptionChars;
        $('#desc').maxLength = cfg.post.maxDescriptionChars;
        maxImages = cfg.post.maxImages;
        $('#imgMax').textContent = maxImages;
      }
      if (cfg && cfg.fees) $('#feeNote').textContent = `Постването струва $${cfg.fees.postUsd} (на сайта). За прототипа е заглушка.`;
    } catch (_) {}

    const pre = new URLSearchParams(location.search).get('country');
    await fillCountries(pre);

    $('#desc').addEventListener('input', () => { $('#cnt').textContent = $('#desc').value.length; });
    $('#postForm').addEventListener('submit', submit);
    $('#btnUpload').onclick = upload;
  });
})();
