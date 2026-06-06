// WhereNoBiz — Админ панел (САМО на български, не се превежда).
// Само за role moderator/admin. Всичко върви срещу /api/wnb/moderation/*.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => (window.WNB ? WNB.esc(s) : String(s == null ? '' : s));
  const flag = c => (window.WNB ? WNB.flag(c) : '');

  const STATUS_BG = {
    pending_moderation: 'Чака одобрение', approved: 'Одобрен',
    rejected: 'Отказан', removed: 'Свален'
  };

  async function act(path, opts) {
    try { await WNB.api(path, opts); return true; }
    catch (e) { alert('Грешка: ' + e.message); return false; }
  }

  // ── Чакащи модерация ──
  async function loadPending() {
    const box = $('#tab-pending');
    box.innerHTML = '<div class="empty-note">Зареждам…</div>';
    try {
      const r = await WNB.api('/moderation/pending');
      const list = r.pending || [];
      $('#cntPending').textContent = list.length;
      if (!list.length) { box.innerHTML = '<div class="empty-note">Няма чакащи постове.</div>'; return; }
      box.innerHTML = '';
      list.forEach(p => {
        const el = document.createElement('div'); el.className = 'arow';
        el.innerHTML = `
          <div class="info">
            <div class="ttl">${flag(p.country_code)} ${esc(p.title)}</div>
            <div class="meta">страна: ${esc(p.country_code)} · от ${esc(p.owner_name || p.owner_email)} · подаден: ${new Date(p.submitted_at).toLocaleString('bg-BG')}</div>
            <div class="acts">
              <button class="ok">✅ Одобри</button>
              <button class="warn">❌ Откажи</button>
              <button class="danger">🗑️ Свали</button>
            </div>
          </div>`;
        const [a, rj, rm] = el.querySelectorAll('.acts button');
        a.onclick = async () => { if (await act(`/moderation/posts/${p.id}/approve`, { method: 'POST', body: {} })) loadPending(); };
        rj.onclick = async () => { const note = prompt('Причина за отказ (по избор):', '') ?? ''; if (await act(`/moderation/posts/${p.id}/reject`, { method: 'POST', body: { note } })) loadPending(); };
        rm.onclick = async () => { if (!confirm('Да свалиш ли този пост?')) return; const note = prompt('Бележка (по избор):', '') ?? ''; if (await act(`/moderation/posts/${p.id}/remove`, { method: 'POST', body: { note } })) loadPending(); };
        box.appendChild(el);
      });
    } catch (e) { box.innerHTML = '<div class="empty-note">Грешка: ' + esc(e.message) + '</div>'; }
  }

  // ── Доклади ──
  async function loadReports() {
    const box = $('#tab-reports');
    box.innerHTML = '<div class="empty-note">Зареждам…</div>';
    try {
      const r = await WNB.api('/moderation/reports');
      const list = r.reports || [];
      $('#cntReports').textContent = list.length;
      if (!list.length) { box.innerHTML = '<div class="empty-note">Няма отворени доклади.</div>'; return; }
      box.innerHTML = '';
      list.forEach(rep => {
        const el = document.createElement('div'); el.className = 'arow';
        const ev = rep.evidence_url ? ` · доказателство: <a href="${esc(rep.evidence_url)}" target="_blank" rel="noopener">линк</a>` : '';
        el.innerHTML = `
          <div class="info">
            <div class="ttl">Доклад за: ${flag(rep.country_code)} ${esc(rep.post_title || ('#' + rep.post_id))}</div>
            <div class="meta">подал: ${esc(rep.reporter_name || ('#' + rep.reporter_id))} · причина: ${esc(rep.reason || '—')}${ev}</div>
            <div class="acts">
              <button class="danger">⚠️ Валиден (свали поста)</button>
              <button class="ok">👍 Неоснователен</button>
            </div>
          </div>`;
        const [v, iv] = el.querySelectorAll('.acts button');
        v.onclick = async () => { if (!confirm('Валиден доклад: сваля поста. Продължи?')) return; const note = prompt('Бележка (по избор):', '') ?? ''; if (await act(`/moderation/reports/${rep.id}/resolve`, { method: 'POST', body: { valid: true, note } })) { loadReports(); loadPending(); } };
        iv.onclick = async () => { const note = prompt('Бележка (по избор):', '') ?? ''; if (await act(`/moderation/reports/${rep.id}/resolve`, { method: 'POST', body: { valid: false, note } })) loadReports(); };
        box.appendChild(el);
      });
    } catch (e) { box.innerHTML = '<div class="empty-note">Грешка: ' + esc(e.message) + '</div>'; }
  }

  // ── Всички ниши (потвърждения/несъгласия) ──
  async function loadAll() {
    const box = $('#allList');
    box.innerHTML = '<div class="empty-note">Зареждам…</div>';
    const qs = `sort=${$('#allSort').value}&order=${$('#allOrder').value}&status=${$('#allStatus').value}`;
    try {
      const r = await WNB.api('/moderation/posts?' + qs);
      const list = r.posts || [];
      if (!list.length) { box.innerHTML = '<div class="empty-note">Няма резултати.</div>'; return; }
      box.innerHTML = '';
      list.forEach(p => {
        const el = document.createElement('div'); el.className = 'arow';
        el.innerHTML = `
          <div class="info">
            <div class="ttl">${flag(p.country_code)} ${esc(p.title)} <span class="badge ${p.status}">${STATUS_BG[p.status] || p.status}</span></div>
            <div class="meta">✅ ${p.confirm_count || 0} потвърдени · 👎 ${p.unlike_count || 0} несъгласни · 🚩 ${p.report_count || 0} · от ${esc(p.owner_name || p.owner_email)}${p.owner_banned ? ' (БАНАТ)' : ''}</div>
            <div class="acts">
              ${p.status !== 'removed' ? '<button class="danger">🗑️ Свали</button>' : ''}
              ${!p.owner_banned ? '<button class="warn">🚫 Банни собственика</button>' : '<button class="ok">↩️ Раз-банни собственика</button>'}
            </div>
          </div>`;
        el.querySelectorAll('.acts button').forEach(b => {
          if (b.classList.contains('danger')) b.onclick = async () => { if (!confirm('Да свалиш ли „' + p.title + '"?')) return; const note = prompt('Бележка (по избор):', '') ?? ''; if (await act(`/moderation/posts/${p.id}/remove`, { method: 'POST', body: { note } })) loadAll(); };
          else if (!p.owner_banned) b.onclick = async () => { if (!confirm('Да банниш ли собственика?')) return; const reason = prompt('Причина за бан:', '') ?? ''; if (await act(`/moderation/users/${p.owner_id}/ban`, { method: 'POST', body: { reason } })) loadAll(); };
          else b.onclick = async () => { if (await act(`/moderation/users/${p.owner_id}/unban`, { method: 'POST', body: {} })) loadAll(); };
        });
        box.appendChild(el);
      });
    } catch (e) { box.innerHTML = '<div class="empty-note">Грешка: ' + esc(e.message) + '</div>'; }
  }

  // ── Банати ──
  async function loadUsers() {
    const box = $('#usersList');
    box.innerHTML = '<div class="empty-note">Зареждам…</div>';
    try {
      const r = await WNB.api('/moderation/users?banned=1');
      const list = r.users || [];
      if (!list.length) { box.innerHTML = '<div class="empty-note">Няма банати потребители.</div>'; return; }
      box.innerHTML = '';
      list.forEach(u => {
        const el = document.createElement('div'); el.className = 'arow';
        el.innerHTML = `
          <div class="info">
            <div class="ttl">${esc(u.display_name || u.email)} <span class="badge rejected">БАНАТ</span></div>
            <div class="meta">${esc(u.email)} · роля: ${esc(u.role)} · причина: ${esc(u.ban_reason || '—')}</div>
            <div class="acts"><button class="ok">↩️ Раз-банни</button></div>
          </div>`;
        el.querySelector('button').onclick = async () => { if (await act(`/moderation/users/${u.id}/unban`, { method: 'POST', body: {} })) loadUsers(); };
        box.appendChild(el);
      });
    } catch (e) { box.innerHTML = '<div class="empty-note">Грешка: ' + esc(e.message) + '</div>'; }
  }

  // Всички потребители (отделно от банатите) — само за админ/модератор.
  async function loadAllUsers() {
    const box = $('#allUsersList');
    box.innerHTML = '<div class="empty-note">Зареждам…</div>';
    try {
      const r = await WNB.api('/moderation/users'); // без ?banned=1 → ВСИЧКИ
      const list = r.users || [];
      if (!list.length) { box.innerHTML = '<div class="empty-note">Няма потребители.</div>'; return; }
      box.innerHTML = `<div class="meta" style="margin-bottom:8px">Общо: ${list.length}</div>`;
      list.forEach(u => {
        const banned = u.is_banned;
        const el = document.createElement('div'); el.className = 'arow';
        el.innerHTML = `
          <div class="info">
            <div class="ttl">${esc(u.display_name || u.email)} ${banned ? '<span class="badge rejected">БАНАТ</span>' : ''}</div>
            <div class="meta">${esc(u.email)} · роля: ${esc(u.role)} · регистриран: ${esc((u.created_at || '').slice(0, 10))}${banned ? ' · причина: ' + esc(u.ban_reason || '—') : ''}</div>
            <div class="acts">${banned ? '<button class="ok">↩️ Раз-банни</button>' : '<button class="warn">🚫 Банни</button>'}</div>
          </div>`;
        const btn = el.querySelector('button');
        if (banned) btn.onclick = async () => { if (await act(`/moderation/users/${u.id}/unban`, { method: 'POST', body: {} })) loadAllUsers(); };
        else btn.onclick = async () => { if (!confirm('Да банниш ли този потребител?')) return; const reason = prompt('Причина за бан:', '') ?? ''; if (await act(`/moderation/users/${u.id}/ban`, { method: 'POST', body: { reason } })) loadAllUsers(); };
        box.appendChild(el);
      });
    } catch (e) { box.innerHTML = '<div class="empty-note">Грешка: ' + esc(e.message) + '</div>'; }
  }

  function switchTab(name) {
    document.querySelectorAll('.atab').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.atab-panel').forEach(p => p.style.display = (p.id === 'tab-' + name) ? '' : 'none');
    if (name === 'pending') loadPending();
    else if (name === 'reports') loadReports();
    else if (name === 'all') loadAll();
    else if (name === 'allusers') loadAllUsers();
    else if (name === 'users') loadUsers();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await WNB.mountNav('admin');
    if (!user) { location.href = 'login.html'; return; }
    if (user.role !== 'moderator' && user.role !== 'admin') { $('#noAccess').style.display = ''; return; }
    $('#adminBody').style.display = '';
    // Роли: модератор вижда САМО модерация (чакащи + доклади); админ вижда всичко.
    const isAdmin = user.role === 'admin';
    if (!isAdmin) {
      ['all', 'allusers', 'users'].forEach(t => {
        const b = document.querySelector('.atab[data-tab="' + t + '"]');
        if (b) b.style.display = 'none';
      });
    }
    document.querySelectorAll('.atab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
    $('#allReload').onclick = loadAll;
    $('#allSort').onchange = loadAll; $('#allOrder').onchange = loadAll; $('#allStatus').onchange = loadAll;
    loadPending();  // зарежда брояча #cntPending
    loadReports();  // зарежда брояча #cntReports
    switchTab(isAdmin ? 'allusers' : 'pending'); // админ → потребители; модератор → чакащи
  });
})();
