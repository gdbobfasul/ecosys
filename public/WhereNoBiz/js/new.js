// WhereNoBiz — постване на нова „липсваща ниша".
// Концептуално това е „на сайта" (server-client модел): постване + плащане $20.
// За прототипа плащането е заглушка; постът отива за модерация.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const T = (k, v) => (window.WNB_I18N ? WNB_I18N.t(k, v) : k);
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
      og.label = WNB.continentName(cont);
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
    if (!country_code) { msg($('#formMsg'), T('new.choose_country'), false); return; }
    if (!$('#ackLang').checked) { msg($('#formMsg'), T('new.ack_required'), false); return; }
    if (!title) { msg($('#formMsg'), T('new.name_required'), false); return; }
    try {
      const r = await WNB.api('/posts', { method: 'POST', body: { country_code, title, description, links } });
      createdPostId = r.post.id;
      msg($('#formMsg'), T('new.posted', { fee: r.fee }), true);
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
    if (!f) { msg($('#imgMsg'), T('new.choose_image'), false); return; }
    if (imgCount >= maxImages) { msg($('#imgMsg'), T('new.img_limit', { n: maxImages }), false); return; }
    const fd = new FormData();
    fd.append('image', f);
    try {
      const r = await WNB.api(`/posts/${createdPostId}/images`, { method: 'POST', formData: fd });
      imgCount++;
      const img = document.createElement('img');
      img.src = r.image.url;
      $('#imgThumbs').appendChild(img);
      $('#imgInput').value = '';
      msg($('#imgMsg'), T('new.uploaded', { n: imgCount, max: maxImages }), true);
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
      }
      $('#imagesH3').textContent = T('new.images_h3', { n: maxImages });
      if (cfg && cfg.fees) $('#feeNote').textContent = T('new.fee_note', { fee: cfg.fees.postUsd });
    } catch (_) {}

    const pre = new URLSearchParams(location.search).get('country');
    await fillCountries(pre);

    $('#desc').addEventListener('input', () => { $('#cnt').textContent = $('#desc').value.length; });
    $('#postForm').addEventListener('submit', submit);
    $('#btnUpload').onclick = upload;
  });
})();
