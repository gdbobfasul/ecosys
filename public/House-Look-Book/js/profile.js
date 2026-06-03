// House-Look-Book — Моят профил: моите къщи (всеки статус) + редакция/подаване/триене.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const T = (k, v) => (window.HLB_I18N ? HLB_I18N.t(k, v) : k);

  function card(p) {
    const el = document.createElement('div');
    el.className = 'house-card';
    const preview = p.composer_params
      ? HouseRender.elevation(Object.assign({}, p.composer_params, { limits: { minFloors: 1, maxFloors: 3 } }), 'front')
      : `<div class="no-svg">${HLB.esc(T('card.uploaded'))}</div>`;
    const status = T('profile.status.' + p.status);
    const canSubmit = p.status === 'editing';
    el.innerHTML = `
      <div class="house-card-svg">${preview}</div>
      <div class="house-card-body">
        <div class="house-card-title">${HLB.esc(p.title)}</div>
        <div class="house-card-meta">${HLB.esc(status)} · ❤️ ${p.like_count || 0}</div>
        <div class="profile-actions">
          <a class="btn-sm" href="index.html?edit=${p.id}">${HLB.esc(T('profile.edit'))}</a>
          ${canSubmit ? `<button class="btn-sm submit" data-submit="${p.id}">${HLB.esc(T('profile.submit'))}</button>` : ''}
          <button class="btn-sm danger" data-del="${p.id}">${HLB.esc(T('profile.delete'))}</button>
        </div>
      </div>`;
    el.querySelector('[data-del]').onclick = () => del(p.id);
    const sb = el.querySelector('[data-submit]');
    if (sb) sb.onclick = () => submit(p.id);
    return el;
  }

  async function del(id) {
    if (!confirm(T('profile.confirm_delete'))) return;
    try { await HLB.api(`/proposals/${id}`, { method: 'DELETE' }); load(); }
    catch (e) { alert(e.message); }
  }

  async function submit(id) {
    try { await HLB.api(`/proposals/${id}/submit`, { method: 'POST' }); alert(T('profile.submitted')); load(); }
    catch (e) { alert(e.message); }
  }

  async function load() {
    try {
      const r = await HLB.api('/proposals/mine');
      const list = r.proposals || [];
      const grid = $('#grid');
      grid.innerHTML = '';
      if (!list.length) { $('#empty').style.display = ''; return; }
      $('#empty').style.display = 'none';
      list.forEach(p => grid.appendChild(card(p)));
    } catch (e) {
      $('#empty').textContent = T('profile.load_err');
      $('#empty').style.display = '';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await HLB.mountNav('profile');
    if (!user) { location.href = 'login.html'; return; }
    load();
  });
})();
