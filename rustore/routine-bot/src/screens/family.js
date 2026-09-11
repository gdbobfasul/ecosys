// Version: 1.0023
// „Денят на семейството" — ПЪРВИЯТ екран след старта (нова сърцевина 1.0023, отговор на Huawei 4.3).
// Под-табове: Днес (табло „кой какво е свършил", одобрения, днешните събития) · Задачи (с точки,
// дни/дата, глас на родителя, одобрение) · Награди (седмична класация, размяна на точки, история) ·
// Календар (общ, 14 дни) · Хора и гласове (членове, запис на фрази, родителски PIN, обмен код/файл).
// Всичко е на устройството; мрежа не се ползва. Старите функции (робот, брифинг, навици) са в долната лента.
import { h, esc, clear, dayNames } from '../ui/dom.js';
import { t, tf, getLang } from '../core/i18n.js';
import { storage, KEYS } from '../core/storage.js';
import { scheduler } from '../core/scheduler.js';
import { toast } from '../core/notifier.js';
import * as F from '../core/family.js';
import { recordSupported, startRecording, stopRecording, cancelRecording, isRecording, playPhrase, MAX_PHRASES } from '../core/family-voice.js';

const TABS = [['today', '🏠', 'fam_tab_today'], ['tasks', '✅', 'fam_tab_tasks'], ['rewards', '🏆', 'fam_tab_rewards'], ['calendar', '📅', 'fam_tab_calendar'], ['people', '🎙', 'fam_tab_people']];
const EMOJIS = ['👧', '👦', '🧒', '👶', '👩', '👨', '👵', '👴'];
let curTab = 'today';
let pinUnlocked = false;
let redeemMember = '';

function fmtDate(ds, opts) {
  try { return new Date(ds + 'T12:00:00').toLocaleDateString(getLang(), opts); } catch (_) { return ds; }
}
function avatar(m) {
  return `<span class="avatar" style="background:${esc(m.color || '#334155')}33;border:2px solid ${esc(m.color || '#334155')}">${esc(m.emoji || '🙂')}</span>`;
}
function roleName(r) { return t(r === 'parent' ? 'fam_role_parent' : r === 'grand' ? 'fam_role_grand' : 'fam_role_child'); }
function locked(fam) { return !!fam.pin && !pinUnlocked; }

export async function renderFamily(root, { go }) {
  if (isRecording()) cancelRecording();
  const fam = await F.loadFamily();
  const state = await storage.get(KEYS.state, null);
  const el = h(`<div class="fam">
    <h1>👨‍👩‍👧 ${esc(t('fam_title'))}</h1>
    <p class="muted fam-sub">${esc(t('fam_sub'))}</p>
    <div id="fam-banner"></div>
    <div class="fam-tabs">${TABS.map(([k, ico, key]) => `<button data-ft="${k}" class="${k === curTab ? 'on' : ''}">${ico} ${esc(t(key))}</button>`).join('')}</div>
    <div id="fam-body"></div>
  </div>`);
  const refresh = async () => { const y = window.scrollY; clear(root); await renderFamily(root, { go }); window.scrollTo(0, y); };
  const commit = async (resched = false) => {
    await F.saveFamily(fam);
    if (resched) { try { await scheduler.reschedule(); } catch (_) {} }
  };
  const ctx = { fam, go, body: el.querySelector('#fam-body'), refresh, commit };

  const banner = el.querySelector('#fam-banner');
  if (fam.sample) {
    const b = h(`<div class="card fam-banner"><p class="muted">🧪 ${esc(t('fam_sample_note'))}</p>
      <button class="btn secondary tiny" id="fam-clear">🗑 ${esc(t('fam_sample_clear'))}</button></div>`);
    b.querySelector('#fam-clear').addEventListener('click', async () => {
      Object.assign(fam, F.emptyFamily());
      await commit(true); curTab = 'people'; refresh();
    });
    banner.appendChild(b);
  }
  if (!(state && state.onboarded)) {
    const s = h(`<button class="btn secondary small fam-setup">${esc(t('fam_setup_robot'))}</button>`);
    s.addEventListener('click', () => go('onboarding'));
    banner.appendChild(s);
  }
  el.querySelectorAll('.fam-tabs button').forEach((b) => b.addEventListener('click', () => { curTab = b.dataset.ft; clear(root); renderFamily(root, { go }); window.scrollTo(0, 0); }));

  root.appendChild(el);
  const R = { today: renderToday, tasks: renderTasks, rewards: renderRewards, calendar: renderCalendar, people: renderPeople }[curTab] || renderToday;
  R(ctx);
}

// ---------- Днес ----------
function renderToday(ctx) {
  const { fam, body, refresh, commit } = ctx;
  const ds = F.ymd(new Date());
  if (!fam.members.length) { body.appendChild(h(`<div class="card"><p class="muted">${esc(t('fam_empty_members'))}</p></div>`)); return; }

  const all = F.tasksForDate(fam, ds);
  const doneN = all.filter((x) => { const e = F.entryOf(fam, ds, x.id); return e && e.st === 'a'; }).length;
  const ptsToday = fam.members.reduce((a, m) => a + F.pointsBetween(fam, m.id, ds, ds), 0);
  const pct = all.length ? Math.round(100 * doneN / all.length) : 0;
  body.appendChild(h(`<div class="card fam-summary"><div class="fam-day-h" style="margin-top:0">${esc(fmtDate(ds, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
    <div>${esc(tf('fam_today_summary', doneN, all.length, ptsToday))}</div><div class="bar"><i style="width:${pct}%"></i></div></div>`));

  // Чакат одобрение
  const pend = F.pendingList(fam);
  if (pend.length) {
    const c = h(`<div class="card" id="fam-pending"><h2 style="margin-top:0">⏳ ${esc(t('fam_waiting_title'))}</h2></div>`);
    if (locked(fam)) {
      const pr = h(`<div class="row" style="gap:8px;margin-bottom:6px"><input id="fam-pin" type="password" inputmode="numeric" maxlength="4" placeholder="${esc(t('fam_pin_label'))}"><button class="btn small" id="fam-unlock">${esc(t('fam_pin_unlock'))}</button></div>`);
      pr.querySelector('#fam-unlock').addEventListener('click', () => {
        if (pr.querySelector('#fam-pin').value.trim() === fam.pin) { pinUnlocked = true; refresh(); }
        else toast(t('fam_pin_wrong'), '');
      });
      c.appendChild(pr);
    }
    pend.forEach((p) => {
      const m = p.member || { emoji: '🙂', name: '' };
      const title = p.task ? p.task.title : '';
      const row = h(`<div class="fam-task"><div class="fam-task-t">${esc(m.emoji)} <b>${esc(m.name)}</b> · ${esc(title)}
        <span class="fam-pts">+${esc(p.entry.pts || 0)} ${esc(t('fam_pts'))}</span>${p.date !== ds ? ` <span class="muted">${esc(fmtDate(p.date, { day: 'numeric', month: 'short' }))}</span>` : ''}</div>
        <div class="fam-task-a"><button class="btn tiny" data-ok ${locked(fam) ? 'disabled' : ''}>✓ ${esc(t('fam_approve'))}</button><button class="btn secondary tiny" data-no ${locked(fam) ? 'disabled' : ''}>↶ ${esc(t('fam_reject'))}</button></div></div>`);
      row.querySelector('[data-ok]').addEventListener('click', async () => { if (locked(fam)) return; F.approve(fam, p.date, p.taskId); await commit(); refresh(); });
      row.querySelector('[data-no]').addEventListener('click', async () => { if (locked(fam)) return; F.undo(fam, p.date, p.taskId); await commit(); refresh(); });
      c.appendChild(row);
    });
    body.appendChild(c);
  }

  // Днес в календара
  const evs = F.upcoming(fam, new Date(), 1).filter((e) => e.kind === 'event');
  if (evs.length) {
    const c = h(`<div class="card"><h2 style="margin-top:0">📅 ${esc(t('fam_today_events'))}</h2></div>`);
    evs.forEach((e) => c.appendChild(h(`<p style="margin:4px 0"><span class="pill">${esc(e.time || '—')}</span> ${esc(e.title)} <span class="muted">${esc(whoText(fam, e.memberIds))}</span></p>`)));
    body.appendChild(c);
  }

  // Табло: кой какво е свършил днес
  body.appendChild(h(`<h2>${esc(t('fam_board_title'))}</h2>`));
  fam.members.forEach((m) => {
    const tasks = F.tasksForDate(fam, ds, m.id);
    const ok = tasks.filter((x) => { const e = F.entryOf(fam, ds, x.id); return e && e.st === 'a'; }).length;
    const card = h(`<div class="card fam-member" data-member="${esc(m.id)}"><div class="fam-member-h">${avatar(m)}
      <div style="flex:1;min-width:0"><div class="nm">${esc(m.name)} <span class="muted" style="font-weight:400;font-size:13px">· ${esc(roleName(m.role))}</span></div>
      <div class="muted" style="font-size:13px">${esc(tf('fam_progress', ok, tasks.length))} · ${esc(tf('fam_points_today', F.pointsBetween(fam, m.id, ds, ds)))} · ${esc(tf('fam_balance', F.balanceOf(fam, m.id)))}</div>
      <div class="bar"><i style="width:${tasks.length ? Math.round(100 * ok / tasks.length) : 0}%;background:${esc(m.color || '')}"></i></div></div></div></div>`);
    if (!tasks.length) card.appendChild(h(`<p class="muted" style="margin:8px 0 0">${esc(t('fam_no_tasks_today'))}</p>`));
    tasks.forEach((task) => {
      const e = F.entryOf(fam, ds, task.id);
      const hasVoice = task.phraseId && fam.phrases.some((p) => p.id === task.phraseId);
      let status;
      if (e && e.st === 'a') status = `<span class="ok">${esc(t('fam_approved'))}</span><button class="fam-x" data-undo title="↶">↶</button>`;
      else if (e && e.st === 'p') status = `<span class="pill">${esc(t('fam_pending'))}</span>`;
      else status = `<button class="btn tiny" data-done>${esc(t('fam_done_btn'))}</button>`;
      const row = h(`<div class="fam-task"><span class="pill">${esc(task.time || '—')}</span>
        <div class="fam-task-t"><b>${esc(task.title)}</b>${task.points ? `<span class="fam-pts">+${esc(task.points)} ${esc(t('fam_pts'))}</span>` : ''}${hasVoice ? ' 🎙' : ''}</div>
        <div class="fam-task-a">${status}<button class="btn secondary tiny" data-say aria-label="${esc(t('fam_listen'))}">🔊</button></div></div>`);
      const bd = row.querySelector('[data-done]');
      if (bd) bd.addEventListener('click', async () => { F.markDone(fam, task, ds); await commit(); refresh(); });
      const bu = row.querySelector('[data-undo]');
      if (bu) bu.addEventListener('click', async () => { F.undo(fam, ds, task.id); await commit(); refresh(); });
      row.querySelector('[data-say]').addEventListener('click', () => F.announceTask(fam, task));
      card.appendChild(row);
    });
    body.appendChild(card);
  });
}

function whoText(fam, ids) {
  if (!ids || !ids.length) return '👨‍👩‍👧 ' + t('fam_all');
  return ids.map((id) => { const m = F.memberById(fam, id); return m ? m.emoji + ' ' + m.name : ''; }).filter(Boolean).join(', ');
}
function memberOptions(fam, sel) {
  return fam.members.map((m) => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(m.emoji + ' ' + m.name)}</option>`).join('');
}

// ---------- Задачи ----------
function renderTasks(ctx) {
  const { fam, body, refresh, commit } = ctx;
  if (!fam.members.length) { body.appendChild(h(`<div class="card"><p class="muted">${esc(t('fam_empty_members'))}</p></div>`)); return; }
  const DAYS = dayNames();
  const first = fam.members.find((m) => m.role === 'child') || fam.members[0];
  const form = h(`<div class="card" id="fam-task-form"><h2 style="margin-top:0">➕ ${esc(t('fam_add_task'))}</h2>
    <div class="field"><label>${esc(t('fam_f_member'))}</label><select id="ft-member">${memberOptions(fam, first.id)}</select></div>
    <div class="field"><label>${esc(t('fam_f_title'))}</label><input id="ft-title" maxlength="80"></div>
    <div class="fam-row2"><div class="field"><label>${esc(t('fam_f_time'))}</label><input id="ft-time" type="time" value="18:00"></div>
      <div class="field"><label>${esc(t('fam_f_points'))}</label><input id="ft-points" type="number" min="0" max="500" value="5"></div></div>
    <div class="field"><label>${esc(t('fam_f_days'))}</label><div class="chips" id="ft-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<span class="chip" data-d="${d}">${esc(DAYS[d])}</span>`).join('')}</div></div>
    <div class="field"><label>${esc(t('fam_f_date'))}</label><input id="ft-date" type="date"></div>
    <div class="field"><label>${esc(t('fam_f_voice'))}</label><select id="ft-voice"><option value="">🤖 ${esc(t('fam_voice_robot'))}</option>${fam.phrases.map((p) => `<option value="${esc(p.id)}">🎙 ${esc(p.title)}</option>`).join('')}</select></div>
    <label class="row" style="justify-content:flex-start;gap:8px;margin:10px 0"><input id="ft-appr" type="checkbox" checked style="width:auto"> ${esc(t('fam_f_approval'))}</label>
    <p class="error" id="ft-err"></p>
    <button class="btn" id="ft-add">${esc(t('add'))}</button></div>`);
  form.querySelectorAll('#ft-days .chip').forEach((c) => c.addEventListener('click', () => c.classList.toggle('on')));
  form.querySelector('#ft-add').addEventListener('click', async () => {
    const title = form.querySelector('#ft-title').value.trim();
    if (!title) { form.querySelector('#ft-err').textContent = t('fam_need_title'); return; }
    const days = [...form.querySelectorAll('#ft-days .chip.on')].map((c) => parseInt(c.dataset.d, 10));
    fam.tasks.push({ id: F.uid('t'), memberId: form.querySelector('#ft-member').value, title, time: form.querySelector('#ft-time').value || '',
      points: Math.max(0, parseInt(form.querySelector('#ft-points').value, 10) || 0), days, date: form.querySelector('#ft-date').value || '',
      phraseId: form.querySelector('#ft-voice').value || '', needsApproval: form.querySelector('#ft-appr').checked });
    await commit(true); toast(t('fam_task_added'), title); refresh();
  });
  body.appendChild(form);

  body.appendChild(h(`<h2>${esc(t('fam_tasks_list'))}</h2>`));
  fam.members.forEach((m) => {
    const list = fam.tasks.filter((x) => x.memberId === m.id).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    if (!list.length) return;
    const card = h(`<div class="card"><div class="fam-member-h">${avatar(m)}<div class="nm">${esc(m.name)}</div></div></div>`);
    list.forEach((task) => {
      const when = task.date ? fmtDate(task.date, { day: 'numeric', month: 'short' }) + ' · ' + t('fam_once')
        : (!task.days || !task.days.length) ? t('fam_every_day') : task.days.map((d) => DAYS[d]).join(' ');
      const ph = task.phraseId ? fam.phrases.find((p) => p.id === task.phraseId) : null;
      const row = h(`<div class="fam-task"><span class="pill">${esc(task.time || '—')}</span><div class="fam-task-t"><b>${esc(task.title)}</b>
        ${task.points ? `<span class="fam-pts">+${esc(task.points)} ${esc(t('fam_pts'))}</span>` : ''}<div class="muted" style="font-size:12px">${esc(when)}${ph ? ' · 🎙 ' + esc(ph.title) : ''}${task.needsApproval && m.role === 'child' ? ' · ⏳' : ''}</div></div>
        <button class="fam-x" data-del aria-label="${esc(t('delete'))}">✕</button></div>`);
      row.querySelector('[data-del]').addEventListener('click', async () => { fam.tasks = fam.tasks.filter((x) => x.id !== task.id); await commit(true); refresh(); });
      card.appendChild(row);
    });
    body.appendChild(card);
  });
}

// ---------- Награди ----------
function renderRewards(ctx) {
  const { fam, body, refresh, commit } = ctx;
  // Седмична класация
  const rank = F.ranking(fam);
  const max = Math.max(1, ...rank.map((r) => r.pts));
  const rc = h(`<div class="card" id="fam-ranking"><h2 style="margin-top:0">🏆 ${esc(t('fam_ranking_title'))}</h2></div>`);
  if (!rank.length || !rank.some((r) => r.pts > 0)) rc.appendChild(h(`<p class="muted">${esc(t('fam_ranking_empty'))}</p>`));
  rank.forEach((r, i) => {
    const medal = r.pts > 0 ? (['🥇', '🥈', '🥉'][i] || (i + 1) + '.') : '·';
    rc.appendChild(h(`<div class="fam-rank"><span class="medal">${medal}</span>${avatar(r.member)}<div class="grow"><div><b>${esc(r.member.name)}</b> <span class="muted" style="font-size:13px">${esc(tf('fam_week_pts', r.pts))}</span></div>
      <div class="bar"><i style="width:${Math.round(100 * r.pts / max)}%;background:${esc(r.member.color || '')}"></i></div></div></div>`));
  });
  body.appendChild(rc);

  // Награди и размяна
  if (!redeemMember || !F.memberById(fam, redeemMember)) redeemMember = (fam.members.find((m) => m.role === 'child') || fam.members[0] || {}).id || '';
  const who = F.memberById(fam, redeemMember);
  const bal = who ? F.balanceOf(fam, who.id) : 0;
  const wc = h(`<div class="card" id="fam-rewards"><h2 style="margin-top:0">🎁 ${esc(t('fam_rewards_title'))}</h2>
    ${fam.members.length ? `<div class="field"><label>${esc(t('fam_redeem_for'))}</label><div class="chips">${fam.members.map((m) => `<span class="chip ${m.id === redeemMember ? 'on' : ''}" data-m="${esc(m.id)}">${esc(m.emoji + ' ' + m.name)}</span>`).join('')}</div></div>
    <p><b>${esc(who ? who.name : '')}</b> — ${esc(tf('fam_balance', bal))}</p>` : `<p class="muted">${esc(t('fam_empty_members'))}</p>`}</div>`);
  wc.querySelectorAll('.chip[data-m]').forEach((c) => c.addEventListener('click', () => { redeemMember = c.dataset.m; refresh(); }));
  fam.rewards.forEach((rw) => {
    const can = who && bal >= rw.cost;
    const row = h(`<div class="fam-reward"><span class="em">${esc(rw.emoji || '🎁')}</span><div style="flex:1;min-width:0"><b>${esc(rw.title)}</b><div class="muted" style="font-size:13px">${esc(rw.cost)} ${esc(t('fam_pts'))}</div></div>
      <button class="btn tiny ${can ? '' : 'secondary'}" data-r>${esc(t('fam_redeem'))}</button><button class="fam-x" data-del aria-label="${esc(t('delete'))}">✕</button></div>`);
    row.querySelector('[data-r]').addEventListener('click', async () => {
      if (!who) return;
      if (!F.redeem(fam, who.id, rw)) { toast(t('fam_not_enough'), tf('fam_balance', bal)); return; }
      await commit(); toast(t('fam_redeemed'), (rw.emoji || '🎁') + ' ' + rw.title); refresh();
    });
    row.querySelector('[data-del]').addEventListener('click', async () => { if (locked(fam)) return; fam.rewards = fam.rewards.filter((x) => x.id !== rw.id); await commit(); refresh(); });
    wc.appendChild(row);
  });
  const add = h(`<div style="margin-top:12px"><h2>➕ ${esc(t('fam_add_reward'))}</h2><div class="fam-row2"><div class="field"><label>${esc(t('fam_f_reward'))}</label><input id="fr-title" maxlength="60"></div>
    <div class="field" style="max-width:120px"><label>${esc(t('fam_f_cost'))}</label><input id="fr-cost" type="number" min="1" max="9999" value="30"></div></div>
    <button class="btn secondary" id="fr-add">${esc(t('add'))}</button></div>`);
  add.querySelector('#fr-add').addEventListener('click', async () => {
    const title = add.querySelector('#fr-title').value.trim();
    if (!title) return;
    fam.rewards.push({ id: F.uid('r'), title, cost: Math.max(1, parseInt(add.querySelector('#fr-cost').value, 10) || 1), emoji: '🎁' });
    await commit(); toast(t('fam_reward_added'), title); refresh();
  });
  wc.appendChild(add);
  body.appendChild(wc);

  // История на наградите
  if (fam.redemptions.length) {
    const hc = h(`<div class="card" id="fam-history"><h2 style="margin-top:0">🧾 ${esc(t('fam_history'))}</h2></div>`);
    fam.redemptions.slice(0, 20).forEach((rd) => {
      const m = F.memberById(fam, rd.m);
      const row = h(`<div class="fam-task"><div class="fam-task-t">${esc(rd.emoji || '🎁')} <b>${esc(rd.title)}</b> · ${esc(m ? m.emoji + ' ' + m.name : '')}
        <div class="muted" style="font-size:12px">−${esc(rd.cost)} ${esc(t('fam_pts'))} · ${esc(new Date(rd.at).toLocaleDateString(getLang()))} · ${esc(t(rd.st === 'given' ? 'fam_given' : 'fam_asked'))}</div></div>
        ${rd.st !== 'given' && !locked(fam) ? `<button class="btn secondary tiny" data-g>${esc(t('fam_mark_given'))}</button>` : ''}</div>`);
      const g = row.querySelector('[data-g]');
      if (g) g.addEventListener('click', async () => { rd.st = 'given'; await commit(); refresh(); });
      hc.appendChild(row);
    });
    body.appendChild(hc);
  }
}

// ---------- Календар ----------
function renderCalendar(ctx) {
  const { fam, body, refresh, commit } = ctx;
  const today = F.ymd(new Date());
  const form = h(`<div class="card" id="fam-cal-form"><h2 style="margin-top:0">➕ ${esc(t('fam_add_event'))}</h2>
    <div class="field"><label>${esc(t('fam_f_event'))}</label><input id="fc-title" maxlength="80"></div>
    <div class="field"><label>${esc(t('fam_f_datetime'))}</label><div class="fam-row2"><input id="fc-date" type="date" value="${today}"><input id="fc-time" type="time" value="18:00"></div></div>
    <div class="field"><label>${esc(t('fam_f_who'))}</label><div class="chips" id="fc-who">${fam.members.map((m) => `<span class="chip" data-m="${esc(m.id)}">${esc(m.emoji + ' ' + m.name)}</span>`).join('')}</div></div>
    <button class="btn" id="fc-add">${esc(t('add'))}</button></div>`);
  form.querySelectorAll('#fc-who .chip').forEach((c) => c.addEventListener('click', () => c.classList.toggle('on')));
  form.querySelector('#fc-add').addEventListener('click', async () => {
    const title = form.querySelector('#fc-title').value.trim();
    const date = form.querySelector('#fc-date').value;
    if (!title || !date) return;
    fam.calendar.push({ id: F.uid('c'), date, time: form.querySelector('#fc-time').value || '', title, memberIds: [...form.querySelectorAll('#fc-who .chip.on')].map((c) => c.dataset.m) });
    await commit(); toast(t('fam_event_added'), title); refresh();
  });

  const list = h(`<div class="card" id="fam-cal-list"><h2 style="margin-top:0">📅 ${esc(t('fam_cal_title'))}</h2></div>`);
  const items = F.upcoming(fam, new Date(), 14);
  if (!items.length) list.appendChild(h(`<p class="muted">${esc(t('fam_cal_empty'))}</p>`));
  let lastDate = '';
  items.forEach((it) => {
    if (it.date !== lastDate) { lastDate = it.date; list.appendChild(h(`<div class="fam-day-h">${esc(fmtDate(it.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>`)); }
    const row = h(`<div class="fam-task"><span class="pill">${esc(it.time || '—')}</span><div class="fam-task-t">${it.kind === 'task' ? '✅ ' : ''}<b>${esc(it.title)}</b><div class="muted" style="font-size:12px">${esc(whoText(fam, it.memberIds))}</div></div>
      ${it.kind === 'event' ? `<button class="fam-x" data-del aria-label="${esc(t('delete'))}">✕</button>` : ''}</div>`);
    const d = row.querySelector('[data-del]');
    if (d) d.addEventListener('click', async () => { fam.calendar = fam.calendar.filter((x) => x.id !== it.id); await commit(); refresh(); });
    list.appendChild(row);
  });
  body.appendChild(list);
  body.appendChild(form);
}

// ---------- Хора и гласове ----------
function renderPeople(ctx) {
  const { fam, body, refresh, commit } = ctx;
  // Членове
  const mc = h(`<div class="card" id="fam-members"><h2 style="margin-top:0">👨‍👩‍👧 ${esc(t('fam_members_title'))}</h2></div>`);
  if (!fam.members.length) mc.appendChild(h(`<p class="muted">${esc(t('fam_empty_members'))}</p>`));
  fam.members.forEach((m) => {
    const row = h(`<div class="fam-task">${avatar(m)}<div class="fam-task-t"><b>${esc(m.name)}</b><div class="muted" style="font-size:12px">${esc(roleName(m.role))} · ${esc(tf('fam_balance', F.balanceOf(fam, m.id)))}</div></div>
      <button class="fam-x" data-del aria-label="${esc(t('delete'))}">✕</button></div>`);
    row.querySelector('[data-del]').addEventListener('click', async () => {
      if (locked(fam)) return;
      fam.members = fam.members.filter((x) => x.id !== m.id);
      fam.tasks = fam.tasks.filter((x) => x.memberId !== m.id);
      await commit(true); refresh();
    });
    mc.appendChild(row);
  });
  let pickEmoji = EMOJIS[0];
  const add = h(`<div style="margin-top:10px"><h2>➕ ${esc(t('fam_add_member'))}</h2>
    <div class="fam-row2"><div class="field"><label>${esc(t('fam_f_name'))}</label><input id="fm-name" maxlength="30"></div>
    <div class="field"><label>${esc(t('fam_f_role'))}</label><select id="fm-role"><option value="child">${esc(t('fam_role_child'))}</option><option value="parent">${esc(t('fam_role_parent'))}</option><option value="grand">${esc(t('fam_role_grand'))}</option></select></div></div>
    <div class="chips" id="fm-emoji">${EMOJIS.map((e, i) => `<span class="chip ${i === 0 ? 'on' : ''}" data-e="${e}">${e}</span>`).join('')}</div>
    <div class="spacer"></div><button class="btn secondary" id="fm-add">${esc(t('add'))}</button></div>`);
  add.querySelectorAll('#fm-emoji .chip').forEach((c) => c.addEventListener('click', () => {
    add.querySelectorAll('#fm-emoji .chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); pickEmoji = c.dataset.e;
  }));
  add.querySelector('#fm-add').addEventListener('click', async () => {
    const name = add.querySelector('#fm-name').value.trim();
    if (!name) return;
    fam.members.push({ id: F.uid('m'), name, emoji: pickEmoji, role: add.querySelector('#fm-role').value, color: F.colorFor(fam.members.length) });
    await commit(); toast(t('fam_member_added'), pickEmoji + ' ' + name); refresh();
  });
  mc.appendChild(add);
  body.appendChild(mc);

  // Гласове на родителите (запис на фрази)
  const vc = h(`<div class="card" id="fam-voices"><h2 style="margin-top:0">🎙 ${esc(t('fam_voices_title'))}</h2><p class="muted">${esc(t('fam_voices_note'))}</p>
    <div class="field"><label>${esc(t('fam_rec_title'))}</label><input id="fv-title" maxlength="50"></div>
    <div class="field"><label>${esc(t('fam_rec_by'))}</label><select id="fv-by">${memberOptions(fam, (fam.members.find((m) => m.role !== 'child') || {}).id)}</select></div>
    <button class="btn" id="fv-rec">${esc(t('fam_rec_start'))}</button><p class="muted" id="fv-status"></p><div id="fv-list"></div></div>`);
  const recBtn = vc.querySelector('#fv-rec'); const status = vc.querySelector('#fv-status');
  if (!recordSupported()) { recBtn.disabled = true; status.textContent = t('fam_rec_err'); }
  const finish = async () => {
    const r = await stopRecording();
    recBtn.textContent = t('fam_rec_start');
    if (!r.ok) { status.textContent = r.reason === 'short' ? t('fam_rec_short') : t('fam_rec_err'); return; }
    fam.phrases.unshift({ id: F.uid('p'), title: vc.querySelector('#fv-title').value.trim() || t('fam_voices_title'), by: vc.querySelector('#fv-by').value || '', dataUrl: r.dataUrl, mime: r.mime, ms: r.ms, at: Date.now() });
    fam.phrases = fam.phrases.slice(0, MAX_PHRASES);
    await commit(); toast(t('fam_rec_saved'), ''); refresh();
  };
  recBtn.addEventListener('click', async () => {
    if (isRecording()) { finish(); return; }
    const r = await startRecording({ onLimit: finish });
    if (!r.ok) { status.textContent = t('fam_rec_err'); return; }
    recBtn.textContent = t('fam_rec_stop'); status.textContent = '🔴 ' + t('fam_rec_recording');
  });
  const vl = vc.querySelector('#fv-list');
  if (!fam.phrases.length) vl.appendChild(h(`<p class="muted">${esc(t('fam_no_voices'))}</p>`));
  fam.phrases.forEach((p) => {
    const m = F.memberById(fam, p.by);
    const row = h(`<div class="fam-task"><button class="btn secondary tiny" data-play>▶</button><div class="fam-task-t"><b>${esc(p.title)}</b><div class="muted" style="font-size:12px">${esc(m ? m.emoji + ' ' + m.name : '')} · ${Math.max(1, Math.round((p.ms || 0) / 1000))} s</div></div>
      <button class="fam-x" data-del aria-label="${esc(t('delete'))}">✕</button></div>`);
    row.querySelector('[data-play]').addEventListener('click', () => playPhrase(p));
    row.querySelector('[data-del]').addEventListener('click', async () => {
      fam.phrases = fam.phrases.filter((x) => x.id !== p.id);
      fam.tasks.forEach((x) => { if (x.phraseId === p.id) x.phraseId = ''; });
      await commit(); refresh();
    });
    vl.appendChild(row);
  });
  body.appendChild(vc);

  // Родителски PIN
  const pc = h(`<div class="card" id="fam-pin-card"><div class="field" style="margin-top:0"><label>🔒 ${esc(t('fam_pin_set'))}</label>
    <div class="row" style="gap:8px"><input id="fp-pin" type="password" inputmode="numeric" maxlength="4" value=""><button class="btn small" id="fp-save">${esc(t('save'))}</button></div></div></div>`);
  pc.querySelector('#fp-save').addEventListener('click', async () => {
    if (locked(fam)) { toast(t('fam_pin_wrong'), ''); return; }
    const v = pc.querySelector('#fp-pin').value.replace(/\D/g, '').slice(0, 4);
    fam.pin = v; pinUnlocked = false; await commit(); toast(t('fam_pin_saved'), ''); refresh();
  });
  body.appendChild(pc);

  // Обмен между телефони (код / файл)
  const sc = h(`<div class="card" id="fam-share"><h2 style="margin-top:0">🔁 ${esc(t('fam_share_title'))}</h2><p class="muted">${esc(t('fam_share_note'))}</p>
    <label class="row" style="justify-content:flex-start;gap:8px;margin:6px 0"><input id="fs-voices" type="checkbox" style="width:auto"> ${esc(t('fam_with_voices'))}</label>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn secondary small" id="fs-copy">${esc(t('fam_export_code'))}</button><button class="btn secondary small" id="fs-file">${esc(t('fam_export_file'))}</button></div>
    <div class="spacer"></div><textarea id="fs-code" placeholder="${esc(t('fam_import_ph'))}"></textarea>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn small" id="fs-import">${esc(t('fam_import'))}</button><button class="btn secondary small" id="fs-fileb">${esc(t('fam_import_file'))}</button>
    <input id="fs-filein" type="file" accept=".txt,.json,text/plain,application/json" hidden></div></div>`);
  const code = () => F.exportCode(fam, sc.querySelector('#fs-voices').checked);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    try { const ta = sc.querySelector('#fs-code'); ta.value = text; ta.select(); document.execCommand('copy'); return true; } catch (_) {}
    return false;
  };
  sc.querySelector('#fs-copy').addEventListener('click', async () => { if (await copy(code())) toast(t('fam_copied'), ''); });
  sc.querySelector('#fs-file').addEventListener('click', async () => {
    const text = code();
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'family-day-' + F.ymd(new Date()) + '.txt'; document.body.appendChild(a); a.click(); a.remove(); } catch (_) {}
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (_) {}
    if (await copy(text)) toast(t('fam_copied'), '');
  });
  const doImport = async (text) => {
    const r = F.importCode(fam, text);
    if (!r) { toast(t('fam_import_bad'), ''); return; }
    await commit(true); toast(tf('fam_import_ok', r.members, r.tasks), ''); refresh();
  };
  sc.querySelector('#fs-import').addEventListener('click', () => doImport(sc.querySelector('#fs-code').value));
  const fin = sc.querySelector('#fs-filein');
  sc.querySelector('#fs-fileb').addEventListener('click', () => fin.click());
  fin.addEventListener('change', () => {
    const file = fin.files && fin.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => doImport(String(fr.result || ''));
    fr.readAsText(file);
  });
  body.appendChild(sc);
}
