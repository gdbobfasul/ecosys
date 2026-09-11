// Version: 1.0021
// guardian.js — екран „НАБЛЮДАВАЩ" (родителят/роднината).
//
// Получава шифрованите пакети на носещия: следата (карта на платно + „отвори в карти"),
// сигналите (ПОМОЩ, падане/удар, излизане от зона, глас: вик/ключови думи със запис и място)
// и потвържденията по задачата. Праща: задача („рецепта": къде, какво да направи, къде е домът),
// разрешена зона, гласово съобщение (изговаря се при носещия) и „къде си?".

import { el, mount, toast, fmtClock, fmtTime } from '../ui/dom.js';
import { buildSectionBar } from '../ui/sections.js';
import { getHawkCfg, loadTrail, appendTrail, clearTrail, loadAlerts, addAlert, clearAlerts, loadTask, saveTask, loadFence, saveFence } from '../core/hawk-store.js';
import { sendPacket, pullPackets } from '../core/hawk-channel.js';
import { getOnce, distanceM, fmtDistance, trailLength, geoUri, mapsUrl, parseLatLng } from '../core/geo.js';
import { drawTrail } from '../core/trail-map.js';
import { primeAlarm, playAlarm, flashScreen } from '../core/alarm.js';
import { notify } from '../core/notifier.js';
import { t, tf } from '../core/i18n.js';

const ONLINE_MS = 120000; // без пакет 2 мин. = „няма връзка"

let _teardown = null;
export function teardownGuardian() { if (_teardown) { try { _teardown(); } catch (_) {} _teardown = null; } }

export async function renderGuardian(root, { go }) {
  teardownGuardian();
  const cfg = getHawkCfg();
  let trail = loadTrail();
  let alerts = loadAlerts();
  let task = loadTask();
  let fence = loadFence();
  let last = trail.length ? trail[trail.length - 1] : null;
  let lastSeen = last ? last.ts : 0, wearerName = '';
  let running = true, pollTimer = null, lastPullOk = null;

  // --- DOM -----------------------------------------------------------------
  const codeBig = el('div', { class: 'code-big' }, cfg.code.replace(/^(.{4})(.+)$/, '$1-$2'));
  const linkPill = el('span', { class: 'pill' }, t('wat_connecting'));
  const seenEl = el('div', {}, '');
  const posEl = el('div', { class: 'muted' }, '');
  const posLinks = el('div', { class: 'row', style: 'gap:8px;margin-top:6px' });
  const canvas = el('canvas', { class: 'trail-map big' });
  const trailInfo = el('div', { class: 'muted' }, '');
  const alertList = el('div', {});
  const taskStatus = el('div', { class: 'muted' }, '');

  function setPill(p, ok, text) { p.className = 'pill ' + (ok === null ? '' : ok ? 'on' : 'off'); p.textContent = text; }
  function placeLinks(p) {
    if (!p || !Number.isFinite(p.lat)) return null;
    return el('span', { class: 'row', style: 'gap:6px;display:inline-flex' }, [
      el('a', { class: 'btn ghost small', href: geoUri(p, wearerName || t('hk_role_wearer')) }, t('hk_open_maps')),
      el('a', { class: 'btn ghost small', href: mapsUrl(p), target: '_blank', rel: 'noopener' }, t('hk_open_browser'))
    ]);
  }

  function renderStatus() {
    const online = lastSeen && Date.now() - lastSeen < ONLINE_MS;
    seenEl.innerHTML = '';
    seenEl.appendChild(el('span', { class: 'pill ' + (online ? 'on live' : 'off') }, online ? t('hk_wearer_online') : (lastSeen ? tf('hk_wearer_seen', fmtTime(lastSeen)) : t('hk_wearer_never'))));
    if (wearerName) seenEl.appendChild(el('span', { class: 'muted', style: 'margin-inline-start:8px' }, wearerName));
    posEl.textContent = last ? tf('hk_last_pos', last.lat.toFixed(5), last.lng.toFixed(5), last.acc || '?', fmtClock(last.ts)) : t('hk_no_pos');
    posLinks.innerHTML = ''; const pl = placeLinks(last); if (pl) posLinks.appendChild(pl);
  }
  function redraw() {
    drawTrail(canvas, { points: trail, here: last, target: task && task.state !== 'home' && task.state !== 'cancelled' ? task.dest : null, home: task && task.home ? task.home : null, fence, labels: { empty: t('hk_map_empty_g') } });
    trailInfo.textContent = trail.length ? tf('hk_trail_info', trail.length, fmtDistance(trailLength(trail)), last ? fmtClock(last.ts) : '—') : t('hk_map_empty_g');
  }
  const KIND_ICON = { help: '🆘', fall: '🤕', fence: '🚧', fence_back: '↩️', voice: '🎙️', arrived: '⚑', returning: '↩', home: '⌂', stopped: '⏹', ok: '👍', hello: '👋' };
  function renderAlerts() {
    alertList.innerHTML = '';
    if (!alerts.length) { alertList.appendChild(el('p', { class: 'muted', text: t('hk_alerts_none') })); return; }
    for (const a of alerts.slice(0, 30)) {
      const critical = a.kind === 'help' || a.kind === 'fall' || (a.kind === 'voice' && a.voiceKind !== 'manual') || a.kind === 'fence';
      const node = el('div', { class: 'alert' + (critical ? ' crit' : '') }, [
        el('div', { class: 'row between' }, [
          el('div', { class: 'label' }, (KIND_ICON[a.kind] || '•') + ' ' + kindLabel(a)),
          el('span', { class: 'time' }, fmtTime(a.ts))
        ]),
        a.text ? el('div', { class: 'muted', text: a.text }) : null,
        a.words && a.words.length ? el('div', { class: 'words' }, tf('hk_words', a.words.join(', '))) : null,
        a.transcript ? el('div', { class: 'muted', text: '„' + a.transcript.slice(0, 200) + '"' }) : null,
        a.audio ? el('audio', { controls: true, src: a.audio, preload: 'none', style: 'width:100%;margin-top:6px' }) : (a.audioDropped ? el('div', { class: 'muted', text: t('hk_audio_dropped') }) : null),
        el('div', { style: 'margin-top:6px' }, [placeLinks(a)])
      ]);
      alertList.appendChild(node);
    }
  }
  function kindLabel(a) {
    if (a.kind === 'voice') return a.voiceKind === 'keyword' ? t('hk_al_keyword') : (a.voiceKind === 'scream' ? t('hk_al_scream') : t('hk_al_recording'));
    return { help: t('hk_al_help'), fall: t('hk_al_fall'), fence: t('hk_al_fence'), fence_back: t('hk_al_fence_back'), arrived: t('hk_al_arrived'), returning: t('hk_al_returning'), home: t('hk_al_home'), stopped: t('hk_al_stopped'), ok: t('hk_al_ok'), hello: t('hk_al_hello') }[a.kind] || a.kind;
  }
  function renderTaskStatus() {
    if (!task || task.state === 'cancelled') { taskStatus.textContent = t('hk_task_none_g'); cancelBtn.style.display = 'none'; return; }
    const st = { sent: t('hk_ts_sent'), going: t('hk_ts_going'), arrived: t('hk_ts_arrived'), returning: t('hk_ts_returning'), home: t('hk_ts_home') }[task.state] || task.state;
    taskStatus.textContent = tf('hk_task_status', task.name, st);
    cancelBtn.style.display = task.state === 'home' ? 'none' : '';
  }

  // --- Входящи пакети --------------------------------------------------------
  function alarm(critical) { primeAlarm(); playAlarm(critical ? 'siren' : 'chime'); if (critical) flashScreen(); }
  async function handle(p) {
    const d = p.payload || {};
    lastSeen = Math.max(lastSeen, p.ts || Date.now());
    if (d.name) wearerName = String(d.name).slice(0, 40);
    const at = (d.lat != null && d.lng != null) ? { lat: d.lat, lng: d.lng } : (last ? { lat: last.lat, lng: last.lng } : {});
    if (p.type === 'pos') {
      const pts = Array.isArray(d.points) ? d.points : [];
      if (pts.length) { trail = appendTrail(pts); last = trail[trail.length - 1]; }
      return;
    }
    if (p.type === 'pong' || p.type === 'hello') {
      if (d.lat != null) { trail = appendTrail({ lat: d.lat, lng: d.lng, acc: d.acc || null, ts: d.ts || p.ts }); last = trail[trail.length - 1]; }
      if (p.type === 'hello') { alerts = [addAlert({ kind: 'hello', ts: p.ts, ...at }), ...alerts]; toast(t('hk_al_hello')); }
      return;
    }
    if (p.type === 'task_ack') { if (task && task.id === d.id && task.state === 'sent') { task.state = 'going'; saveTask(task); } return; }
    if (p.type === 'arrived' || p.type === 'returning' || p.type === 'home') {
      if (task && task.id === d.id) { task.state = p.type === 'arrived' ? 'arrived' : p.type === 'returning' ? 'returning' : 'home'; saveTask(task); }
      alerts = [addAlert({ kind: p.type, ts: p.ts, ...at, text: task ? task.name : '' }), ...alerts];
      notify(t('app_name'), kindLabel({ kind: p.type }) + (task ? ' — ' + task.name : '')); alarm(false);
      return;
    }
    if (p.type === 'help' || p.type === 'fall' || p.type === 'fence' || p.type === 'voice' || p.type === 'fence_back' || p.type === 'stopped' || p.type === 'ok') {
      const a = { kind: p.type, ts: p.ts, ...at };
      if (p.type === 'fall') a.text = tf('hk_fall_detected', d.g || '?') + (d.kind === 'impact' ? ' · ' + t('hk_impact') : '');
      if (p.type === 'fence') a.text = tf('hk_fence_out_g', fmtDistance(d.dist || 0));
      if (p.type === 'voice') { a.voiceKind = d.kind; a.words = d.words || []; a.transcript = d.transcript || ''; a.audio = d.audio || null; }
      alerts = [addAlert(a), ...alerts];
      const critical = p.type === 'help' || p.type === 'fall' || p.type === 'fence' || (p.type === 'voice' && d.kind !== 'manual');
      notify((critical ? '🔴 ' : '') + t('app_name'), kindLabel(a) + (a.words && a.words.length ? ': ' + a.words.join(', ') : ''));
      alarm(critical);
    }
  }
  async function poll() {
    if (!running) return;
    const r = await pullPackets();
    if (r.ok !== lastPullOk) { lastPullOk = r.ok; setPill(linkPill, r.ok, r.ok ? t('hk_link_ok') : (t('pair_no_link') + (r.reason ? ' (' + r.reason + ')' : ''))); }
    if (r.packets.length) { for (const p of r.packets) { try { await handle(p); } catch (_) {} } renderAlerts(); renderTaskStatus(); redraw(); }
    renderStatus();
    if (running) pollTimer = setTimeout(poll, cfg.pollSeconds * 1000);
  }

  // --- Изходящи: задача / зона / съобщение --------------------------------------
  const tName = el('input', { type: 'text', placeholder: t('hk_tf_name_ph'), maxlength: '80' });
  const tInstr = el('textarea', { placeholder: t('hk_tf_instr_ph'), maxlength: '400', rows: '3' });
  const tDest = el('input', { type: 'text', placeholder: '42.69770, 23.32190', autocapitalize: 'none' });
  const tHome = el('input', { type: 'text', placeholder: '42.69770, 23.32190', autocapitalize: 'none' });
  const tRadiusVal = el('span', { class: 'muted' }, '40 m');
  const tRadius = el('input', { type: 'range', min: '20', max: '300', step: '10', value: '40', oninput: (e) => { tRadiusVal.textContent = e.target.value + ' m'; } });
  const cancelBtn = el('button', { class: 'btn ghost', onclick: async () => { if (!task) return; task.state = 'cancelled'; saveTask(task); await sendPacket('task_cancel', { id: task.id }); renderTaskStatus(); redraw(); } }, t('hk_task_cancel'));
  function coordButtons(input) {
    return el('div', { class: 'row', style: 'gap:6px;margin-top:4px' }, [
      el('button', { class: 'btn ghost small', onclick: () => { if (!last) { toast(t('hk_no_pos')); return; } input.value = last.lat.toFixed(5) + ', ' + last.lng.toFixed(5); } }, t('hk_from_wearer')),
      el('button', { class: 'btn ghost small', onclick: async () => { toast(t('hk_locating')); const p = await getOnce(); if (!p) { toast(t('hk_gps_denied')); return; } input.value = p.lat.toFixed(5) + ', ' + p.lng.toFixed(5); } }, t('hk_from_me'))
    ]);
  }
  async function sendTask() {
    const dest = parseLatLng(tDest.value), home = parseLatLng(tHome.value);
    const name = tName.value.trim(), instruction = tInstr.value.trim();
    if (!name || !instruction) { toast(t('hk_tf_need_text')); return; }
    if (!dest) { toast(t('hk_tf_need_dest')); return; }
    task = { id: 't' + Date.now(), name, instruction, dest, home, radius: parseInt(tRadius.value, 10) || 40, state: 'sent', ts: Date.now() };
    saveTask(task); renderTaskStatus(); redraw();
    const r = await sendPacket('task', task);
    toast(r.ok ? t('hk_sent') : t('hk_queued'));
  }
  const fRadiusVal = el('span', { class: 'muted' }, '500 m');
  const fRadius = el('input', { type: 'range', min: '100', max: '5000', step: '100', value: String(fence ? fence.radius : 500), oninput: (e) => { fRadiusVal.textContent = fmtDistance(+e.target.value); } });
  fRadiusVal.textContent = fmtDistance(+fRadius.value);
  const fCenter = el('input', { type: 'text', placeholder: '42.69770, 23.32190', autocapitalize: 'none', value: fence ? fence.lat.toFixed(5) + ', ' + fence.lng.toFixed(5) : '' });
  async function sendFence(clear) {
    if (clear) { fence = null; saveFence(null); redraw(); const r = await sendPacket('fence', {}); toast(r.ok ? t('hk_sent') : t('hk_queued')); return; }
    const c = parseLatLng(fCenter.value);
    if (!c) { toast(t('hk_tf_need_dest')); return; }
    fence = { lat: c.lat, lng: c.lng, radius: parseInt(fRadius.value, 10) || 500, ts: Date.now() };
    saveFence(fence); redraw();
    const r = await sendPacket('fence', fence);
    toast(r.ok ? t('hk_sent') : t('hk_queued'));
  }
  const msgIn = el('input', { type: 'text', placeholder: t('hk_msg_ph'), maxlength: '400' });
  async function sendMsg() {
    const text = msgIn.value.trim(); if (!text) return;
    const r = await sendPacket('msg', { text }); msgIn.value = '';
    toast(r.ok ? t('hk_sent') : t('hk_queued'));
  }

  function stopAll() { running = false; if (pollTimer) clearTimeout(pollTimer); }
  _teardown = stopAll;

  // --- Изглед ---------------------------------------------------------------
  const view = el('div', {}, [
    buildSectionBar('hawk', go),
    el('div', { class: 'row between' }, [
      el('h1', { text: t('hk_title'), class: 'grow' }),
      el('button', { class: 'btn ghost', onclick: () => { stopAll(); go('role'); } }, t('settings'))
    ]),
    el('p', { class: 'lead', text: t('hk_guardian_sub') }),
    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [el('h2', { text: t('hk_pair_code_title'), style: 'margin:0', class: 'grow' }), linkPill]),
      codeBig,
      el('p', { class: 'muted', text: t('hk_pair_code_hint') })
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [el('h2', { text: t('hk_wearer_status'), style: 'margin:0', class: 'grow' }), seenEl]),
      posEl, posLinks,
      el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
        el('button', { class: 'btn secondary', onclick: async () => { const r = await sendPacket('ping', { ts: Date.now() }); toast(r.ok ? t('hk_ping_sent') : t('hk_queued')); } }, t('hk_ping'))
      ])
    ]),
    el('div', { class: 'card' }, [
      el('h2', { text: t('hk_map_title_g'), style: 'margin-top:0' }),
      canvas, trailInfo,
      el('div', { class: 'row', style: 'gap:8px;margin-top:6px' }, [
        el('button', { class: 'btn ghost small', onclick: () => { if (confirm(t('hk_clear_trail_q'))) { clearTrail(); trail = []; last = null; redraw(); renderStatus(); } } }, t('hk_clear_trail'))
      ])
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', { text: t('hk_alerts_title'), style: 'margin:0', class: 'grow' }),
        el('button', { class: 'btn ghost small', onclick: () => { if (confirm(t('hk_clear_alerts_q'))) { clearAlerts(); alerts = []; renderAlerts(); } } }, t('dash_clear'))
      ]),
      alertList
    ]),
    el('div', { class: 'card' }, [
      el('h2', { text: t('hk_task_compose'), style: 'margin-top:0' }),
      el('p', { class: 'muted', text: t('hk_task_compose_hint') }),
      taskStatus, cancelBtn,
      el('label', { text: t('hk_tf_name') }), tName,
      el('label', { text: t('hk_tf_instr') }), tInstr,
      el('label', { text: t('hk_tf_dest') }), tDest, coordButtons(tDest),
      el('label', { text: t('hk_tf_home') }), tHome, coordButtons(tHome),
      el('div', { class: 'row between' }, [el('label', { text: t('hk_tf_radius'), class: 'grow' }), tRadiusVal]), tRadius,
      el('p', { class: 'muted', text: t('hk_coords_hint') }),
      el('button', { class: 'btn', onclick: sendTask }, t('hk_task_send'))
    ]),
    el('div', { class: 'card' }, [
      el('h2', { text: t('hk_fence_title'), style: 'margin-top:0' }),
      el('p', { class: 'muted', text: t('hk_fence_hint') }),
      el('label', { text: t('hk_fence_center') }), fCenter, coordButtons(fCenter),
      el('div', { class: 'row between' }, [el('label', { text: t('hk_fence_radius'), class: 'grow' }), fRadiusVal]), fRadius,
      el('div', { class: 'row', style: 'gap:8px;margin-top:6px' }, [
        el('button', { class: 'btn', onclick: () => sendFence(false) }, t('hk_fence_send')),
        el('button', { class: 'btn ghost', onclick: () => sendFence(true) }, t('hk_fence_clear'))
      ])
    ]),
    el('div', { class: 'card' }, [
      el('h2', { text: t('hk_msg_title'), style: 'margin-top:0' }),
      el('p', { class: 'muted', text: t('hk_msg_hint') }),
      msgIn,
      el('div', { class: 'row', style: 'margin-top:6px' }, [el('button', { class: 'btn', onclick: sendMsg }, t('hk_msg_send'))])
    ]),
    el('p', { class: 'muted', html: t('hk_guardian_footer') })
  ]);
  mount(root, view);
  renderStatus(); renderAlerts(); renderTaskStatus(); redraw();
  const onResize = () => redraw();
  window.addEventListener('resize', onResize);
  window.addEventListener('pagehide', () => { stopAll(); window.removeEventListener('resize', onResize); }, { once: true });
  poll();
}
