// WhereNoBiz — детайл на пост: описание, линкове, снимки, потвърждение, доклад, телефон.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const T = (k, v) => (window.WNB_I18N ? WNB_I18N.t(k, v) : k);
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
        : `<div class="phone-box">📞 ${WNB.esc(T('post.phone_revealed'))} <button id="btnBuyPhone" class="ghost">${WNB.esc(T('post.view_phone', { fee: data.viewPhoneFee }))}</button></div>`;
    }

    $('#post').innerHTML = `
      <div class="post-country">${WNB.flag(p.country_code)} ${WNB.esc(p.country_code)}</div>
      <h1 class="post-title">${WNB.esc(p.title)}</h1>
      <div class="post-meta">${WNB.esc(T('post.by', { name: p.owner_name || T('post.anon') }))} · ✅ ${WNB.esc(T('post.confirmations', { n: p.confirm_count }))} · ✋ ${WNB.esc(T('post.disagreements', { n: p.unlike_count }))}</div>
      ${p.status !== 'approved' ? `<div class="status-badge">${WNB.esc(T('post.status', { s: p.status }))}</div>` : ''}
      <p class="post-desc">${WNB.esc(p.description) || ('<i>' + WNB.esc(T('post.no_desc')) + '</i>')}</p>
      ${links ? `<div class="post-section"><h4>${WNB.esc(T('post.similar_sites'))}</h4><ul class="link-list">${links}</ul></div>` : ''}
      ${imgs ? `<div class="post-section"><h4>${WNB.esc(T('post.photos'))}</h4><div class="img-grid">${imgs}</div></div>` : ''}
      ${phoneHtml}
      <div class="post-actions">
        <button id="actConfirm">${WNB.esc(T('post.act_confirm'))}</button>
        <button id="actReport" class="ghost">${WNB.esc(T('post.act_report'))}</button>
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
      alert(T('post.phone_alert', { phone: r.phone || '—' }));
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
        ? T('post.confirm_saved', { n: r.confirm_count })
        : T('post.dispute_saved', { n: r.unlike_count }), true);
      setTimeout(load, 700);
    } catch (e) {
      if (e.status === 401) location.href = 'login.html';
      else if (e.status === 402) msg($('#confirmMsg'), T('post.need_sub'), false);
      else msg($('#confirmMsg'), e.message, false);
    }
  }

  async function sendReport() {
    const body = { reason: $('#repReason').value.trim(), evidence_url: $('#repEvidence').value.trim() || undefined };
    if (!body.reason) { msg($('#reportMsg'), T('post.report_reason_required'), false); return; }
    try {
      await WNB.api(`/posts/${id}/report`, { method: 'POST', body });
      msg($('#reportMsg'), T('post.report_sent'), true);
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
      $('#post').innerHTML = `<div class="empty-line">${WNB.esc(T('browse.err', { msg: e.message }))}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    user = await WNB.mountNav('browse');
    $('#backLink').onclick = (e) => { e.preventDefault(); history.length > 1 ? history.back() : location.href = 'browse.html'; };
    $('#btnConfirm').onclick = () => sendConfirm('confirm');
    $('#btnDispute').onclick = () => sendConfirm('dispute');
    $('#btnReport').onclick = sendReport;
    if (!id) { $('#post').innerHTML = `<div class="empty-line">${WNB.esc(T('post.no_post'))}</div>`; return; }
    load();
  });
})();
