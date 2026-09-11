// Version: 1.0020
// House-Look-Book — „Моите проекти" (на устройството): списък на локалните проекти (HLB_LOCAL) с
// преглед (същият HouseRender), отваряне в конструктора, дублиране, изтриване, публикуване в
// галерията (по избор — иска акаунт и връзка; при липса НЕ блокира, проектът си остава тук).
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const T = (k, v) => (window.HLB_I18N ? HLB_I18N.t(k, v) : k);
  let user = null;

  function showMsg(text, ok) {
    const el = $('#msg');
    el.textContent = text;
    el.className = 'msg ' + (ok ? 'ok' : 'err');
    el.style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(HLB_I18N ? HLB_I18N.lang : undefined); } catch (e) { return ''; }
  }

  function card(p) {
    const el = document.createElement('div');
    el.className = 'house-card' + (p.sample ? ' is-sample' : '');
    const params = Object.assign({}, p.params || {}, { limits: { minFloors: 1, maxFloors: 3 } });
    let preview = '';
    try { preview = HouseRender.elevation(params, 'front'); } catch (e) { preview = '<div class="no-svg">🏠</div>'; }
    const title = HLB_LOCAL.titleOf(p, T);
    const rooms = (p.params && Array.isArray(p.params.rooms)) ? p.params.rooms.reduce((n, f) => n + (Array.isArray(f) ? f.length : 0), 0) : 0;
    const floors = (p.params && p.params.floors) || 1, bas = (p.params && p.params.basements) || 0;
    el.innerHTML = `
      <div class="house-card-svg">${preview}${p.sample ? `<span class="sample-badge">${HLB.esc(T('local.sample'))}</span>` : ''}</div>
      <div class="house-card-body">
        <div class="house-card-title">${HLB.esc(title)}</div>
        <div class="house-card-meta">${HLB.esc(T('local.updated', { date: fmtDate(p.updated || p.created) }))} · 🏢 ${floors}${bas ? '+' + bas : ''} · 🚪 ${rooms}</div>
        <div class="profile-actions">
          <a class="btn-sm" href="index.html?local=${encodeURIComponent(p.id)}">${HLB.esc(T('local.edit'))}</a>
          <button type="button" class="btn-sm submit" data-pub="${HLB.esc(p.id)}">${HLB.esc(T('local.publish'))}</button>
          <button type="button" class="btn-sm" data-dup="${HLB.esc(p.id)}">${HLB.esc(T('local.duplicate'))}</button>
          <button type="button" class="btn-sm danger" data-del="${HLB.esc(p.id)}">${HLB.esc(T('local.delete'))}</button>
        </div>
      </div>`;
    el.querySelector('[data-del]').onclick = () => { if (confirm(T('local.confirm_delete'))) { HLB_LOCAL.remove(p.id); render(); } };
    el.querySelector('[data-dup]').onclick = () => { HLB_LOCAL.duplicate(p.id); render(); };
    el.querySelector('[data-pub]').onclick = () => publish(p);
    return el;
  }

  // ☁️ Публикуване в галерията: POST /proposals (иска акаунт; сървърът минава модерация).
  async function publish(p) {
    const title = HLB_LOCAL.titleOf(p, T);
    if (!user) { showMsg(T('local.publish_login'), false); setTimeout(() => location.href = 'login.html', 1200); return; }
    try {
      await HLB.api('/proposals', { method: 'POST', body: { title, composer_params: p.params } });
      showMsg(T('local.published_ok'), true);
    } catch (e) {
      if (e.offline) showMsg(T('js.offline_local'), false);
      else if (e.status === 401) { showMsg(T('local.publish_login'), false); setTimeout(() => location.href = 'login.html', 1200); }
      else if (e.status === 402) showMsg(T('js.need_sub_propose'), false);
      else showMsg(e.message, false);
    }
  }

  function render() {
    const list = HLB_LOCAL.list();
    const grid = $('#grid');
    grid.innerHTML = '';
    $('#empty').style.display = list.length ? 'none' : '';
    $('#localCount').textContent = list.length ? T('local.count', { n: list.length }) : '';
    const hasS = HLB_LOCAL.hasSamples();
    $('#btnDelSamples').style.display = hasS ? '' : 'none';
    $('#samplesNote').style.display = hasS ? '' : 'none';
    list.forEach(p => grid.appendChild(card(p)));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('#btnDelSamples').onclick = () => { HLB_LOCAL.removeSamples(); render(); };
    // Списъкът се рисува ВЕДНАГА (локален, без мрежа); проверката за акаунт тече отделно.
    if (window.HLB_I18N && HLB_I18N.ready) { try { await HLB_I18N.ready; } catch (_) {} }
    render();
    try { user = await HLB.mountNav('local'); } catch (_) { user = null; }
  });
})();
