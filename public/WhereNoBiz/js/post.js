// WhereNoBiz — детайл на пост: описание, линкове, снимки, потвърждение, доклад, телефон.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const id = new URLSearchParams(location.search).get('id');
  let user = null;
  let data = null;

  function msg(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); el.style.display = ''; }

  function renderPost() {
    const p = data.post;
    const links = (data.links || []).map(l =>
      `<li><a href="${WNB.esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow">${WNB.esc(l.label || l.url)}</a></li>`).join('');
    const imgs = (data.images || []).map(im => `<img src="${WNB.esc(im.url)}" alt="" loading="lazy">`).join('');

    // Телефон (наградата): показва се само ако е разкрит и зрителят има достъп.
    let phoneHtml = '';
    if (data.phoneAvailable) {
      phoneHtml = data.phone
        ? `<div class="phone-box">📞 <b>${WNB.esc(data.phone)}</b></div>`
        : `<div class="phone-box">📞 Телефонът е разкрит. <button id="btnBuyPhone" class="ghost">Виж телефона (плати $${data.viewPhoneFee})</button></div>`;
    }

    $('#post').innerHTML = `
      <div class="post-country">${WNB.flag(p.country_code)} ${WNB.esc(p.country_code)}</div>
      <h1 class="post-title">${WNB.esc(p.title)}</h1>
      <div class="post-meta">от ${WNB.esc(p.owner_name || 'анонимен')} · ✅ ${p.confirm_count} потвърждения · ✋ ${p.unlike_count} несъгласия</div>
      ${p.status !== 'approved' ? `<div class="status-badge">статус: ${WNB.esc(p.status)}</div>` : ''}
      <p class="post-desc">${WNB.esc(p.description) || '<i>без описание</i>'}</p>
      ${links ? `<div class="post-section"><h4>Подобни сайтове в други страни</h4><ul class="link-list">${links}</ul></div>` : ''}
      ${imgs ? `<div class="post-section"><h4>Снимки</h4><div class="img-grid">${imgs}</div></div>` : ''}
      ${phoneHtml}
      <div class="post-actions">
        <button id="actConfirm">✅ Потвърди / Гласувай</button>
        <button id="actReport" class="ghost">🚩 Докладвай</button>
      </div>`;

    const buy = $('#btnBuyPhone');
    if (buy) buy.onclick = buyPhone;
    $('#actConfirm').onclick = () => toggleBox('confirmBox');
    $('#actReport').onclick = () => toggleBox('reportBox');
  }

  function toggleBox(boxId) {
    if (!user) { location.href = 'login.html'; return; }
    const el = document.getElementById(boxId);
    el.style.display = el.style.display === 'none' ? '' : 'none';
    if (el.style.display !== 'none') el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function buyPhone() {
    try {
      const r = await WNB.api(`/posts/${id}/buy-phone`, { method: 'POST' });
      alert('Телефон: ' + (r.phone || '—'));
      load();
    } catch (e) {
      if (e.status === 401) location.href = 'login.html';
      else alert(e.message);
    }
  }

  async function sendConfirm(stance) {
    const body = {
      stance,
      where_could_develop: $('#where').value.trim(),
      why_missing: $('#why').value.trim(),
    };
    try {
      const r = await WNB.api(`/posts/${id}/confirm`, { method: 'POST', body });
      msg($('#confirmMsg'), stance === 'confirm'
        ? `Записано! Вече ✅ ${r.confirm_count} потвърждения.`
        : `Записано несъгласие. ✋ ${r.unlike_count}.`, true);
      setTimeout(load, 700);
    } catch (e) {
      if (e.status === 401) location.href = 'login.html';
      else if (e.status === 402) msg($('#confirmMsg'), 'Нужен е абонамент ($1/мес), за да гласуваш.', false);
      else msg($('#confirmMsg'), e.message, false);
    }
  }

  async function sendReport() {
    const body = { reason: $('#repReason').value.trim(), evidence_url: $('#repEvidence').value.trim() || undefined };
    if (!body.reason) { msg($('#reportMsg'), 'Опиши причината.', false); return; }
    try {
      await WNB.api(`/posts/${id}/report`, { method: 'POST', body });
      msg($('#reportMsg'), 'Докладът е подаден и чака модератор.', true);
    } catch (e) {
      if (e.status === 401) location.href = 'login.html';
      else msg($('#reportMsg'), e.message, false);
    }
  }

  async function load() {
    try {
      data = await WNB.api('/posts/' + id);
      renderPost();
    } catch (e) {
      $('#post').innerHTML = `<div class="empty-line">Грешка: ${WNB.esc(e.message)}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    user = await WNB.mountNav('browse');
    $('#backLink').onclick = (e) => { e.preventDefault(); history.length > 1 ? history.back() : location.href = 'browse.html'; };
    $('#btnConfirm').onclick = () => sendConfirm('confirm');
    $('#btnDispute').onclick = () => sendConfirm('dispute');
    $('#btnReport').onclick = sendReport;
    if (!id) { $('#post').innerHTML = '<div class="empty-line">Няма пост.</div>'; return; }
    load();
  });
})();
