// Version: 1.0021
// guardian.js — ПАЗИТЕЛ: апът следи САМИЯ потребител (възрастен сам вкъщи, планинар, дете).
//
// Как работи (всичко на устройството):
//   1. Активност = докосвания в апа + отваряне на апа + съобщения, които потребителят САМ е
//      изпратил в нашия чат (двигателят ги вижда при обиколката на Pupikes канала).
//   2. Ако няма активност N часа (извън часовете за сън) → апът първо пита САМИЯ потребител:
//      екран „Добре ли си?" с голям бутон „Да", силен сигнал (WebAudio) + вибрация + известие.
//   3. Без отговор M минути → сигнал към близките с последно известно състояние (час на
//      последна активност, батерия, местоположение ако е разрешено) и кой е писал спешно
//      междувременно. Канали — същите, през които апът отговаря: нашият чат (автоматично),
//      direct-reply по последното известие от близкия в WhatsApp/Viber/Messenger
//      (автоматично, ако има „Notification access"); иначе сигналът чака в „за ръчно
//      изпращане" (SMS с готов текст / споделяне) + локално известие с текста.
//   4. Дневник на проверките + индикатор „пазителят е активен".
//
// ЧЕСТНО ОГРАНИЧЕНИЕ: апът няма фонова услуга (без нови плъгини). Часовникът тук работи, докато
// апът е отворен или е в паметта. Като резерва проверката се ПЛАНИРА като локално известие
// (плъгинът Local Notifications планира през системния будилник и се показва и при затворен ап):
// „Добре ли си?" в уречения час и „Няма отговор — отвори апа" след M минути. Сигналът се
// изпраща веднага щом апът отново работи (при отваряне, ако срокът е изтекъл).
import { getState, setState, uid } from './storage.js';
import { t, tf, getLang } from './i18n.js';
import { isWithinWindow, toMinutes } from './scheduler.js';
import { pupikesConfigured, pupikesSend } from './pupikes-chat.js';
import { isNativeReplyAvailable, isAccessGranted, getRecent, replyTo } from './native-reply.js';
import { toast } from '../ui/dom.js';

const TICK_MS = 30 * 1000;
const NOTIF_ASK = 777001;   // планирано известие „Добре ли си?"
const NOTIF_LATE = 777002;  // планирано известие „няма отговор"
const NOTIF_ALERT = 777003; // известие със самия сигнал (за който вземе телефона)

let _timer = null;
let _render = null;
let _installed = false;
let _lastMark = 0;
let _overlay = null;
let _audio = null;
let _beepTimer = null;
let _plannedFor = 0;
let _testMode = false;

// --- състояние ------------------------------------------------------------------
function G() { return getState().guardian; }
function patch(p) { setState({ guardian: { ...G(), ...p } }); }
function addLog(kind, note) {
  const cur = G();
  patch({ log: [...cur.log, { at: Date.now(), kind, note: note || '' }].slice(-200) });
}

export function guardianStatus() {
  const g = G();
  if (!g.enabled) return 'off';
  if (g.askedAt) return 'asking';
  if (g.alertedAt && g.lastActivity < g.alertedAt) return 'alerted';
  return 'active';
}

// --- активност ------------------------------------------------------------------
// Отбелязва активност на потребителя. Ако чакаме отговор — това Е отговорът (телефонът е пипнат).
export function markActivity(source) {
  const now = Date.now();
  if (now - _lastMark < 5000 && !G().askedAt) return; // не записваме на всяко докосване
  _lastMark = now;
  const g = G();
  const wasAsking = !!g.askedAt;
  patch({ lastActivity: now, askedAt: 0 });
  if (wasAsking) {
    addLog('ok', source || '');
    hideAsk();
    toast(t('gd_ok_toast'));
    if (_render) _render();
  }
  planNotifications();
}

// Активност от нашия чат: съобщения, изпратени от САМИЯ потребител след последната активност.
export function noteOwnMessages(messages) {
  let latest = 0;
  for (const m of messages || []) if (m && m.sent === true && (m.timestamp || 0) > latest) latest = m.timestamp || 0;
  if (latest && latest > G().lastActivity) {
    patch({ lastActivity: latest });
    if (G().askedAt) markActivity('chat');
  }
}

function installActivityTracking() {
  if (_installed || typeof document === 'undefined') return;
  _installed = true;
  const onTouch = () => markActivity('touch');
  document.addEventListener('pointerdown', onTouch, { passive: true });
  document.addEventListener('keydown', onTouch, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { markActivity('open'); tick(); }
  });
  window.addEventListener('focus', () => markActivity('open'));
}

// --- часове за сън / следваща проверка ---------------------------------------------
function inSleep(g, when) {
  const s = g.sleep;
  if (!s || !s.enabled) return false;
  return isWithinWindow(s.from || '22:00', s.to || '07:00', when || new Date());
}

// Кога най-рано ще попитаме: последна активност + N часа, отложено след края на съня.
export function nextAskTime(g) {
  const hours = Math.max(1, parseFloat(g.hours) || 12);
  let at = (g.lastActivity || Date.now()) + hours * 3600 * 1000;
  const d = new Date(at);
  if (inSleep(g, d)) {
    const end = toMinutes(g.sleep.to || '07:00');
    const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(end / 60), end % 60, 0, 0);
    if (e.getTime() <= at) e.setDate(e.getDate() + 1);
    at = e.getTime();
  }
  return at;
}

// --- известия (Local Notifications, без сървър) ------------------------------------------
function notifPlugin() {
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() && cap.Plugins && cap.Plugins.LocalNotifications) {
      return cap.Plugins.LocalNotifications;
    }
  } catch (_) {}
  return null;
}
async function notifGranted(p) {
  try { return (await p.checkPermissions()).display === 'granted'; } catch (_) { return false; }
}
async function cancelNotif(ids) {
  const p = notifPlugin();
  if (!p) return;
  try { await p.cancel({ notifications: ids.map((id) => ({ id })) }); } catch (_) {}
}
async function showNotif(id, title, body, at) {
  const p = notifPlugin();
  if (p) {
    if (!(await notifGranted(p))) return false;
    try {
      await p.schedule({ notifications: [{ id, title, body, schedule: { at: new Date(at || (Date.now() + 200)), allowWhileIdle: true } }] });
      return true;
    } catch (_) { return false; }
  }
  if (!at && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body }); return true; } catch (_) {}
  }
  return false;
}

// Планира резервните известия за следващата проверка (когато апът не е в паметта).
async function planNotifications() {
  const g = G();
  if (!g.enabled || g.askedAt) return;
  const at = nextAskTime(g);
  if (Math.abs(at - _plannedFor) < 60 * 1000) return; // същото време — не пренареждаме
  _plannedFor = at;
  await cancelNotif([NOTIF_ASK, NOTIF_LATE]);
  const grace = Math.max(1, parseInt(g.graceMinutes, 10) || 15) * 60 * 1000;
  await showNotif(NOTIF_ASK, t('gd_ask_title'), t('gd_notif_ask_body'), at);
  await showNotif(NOTIF_LATE, t('gd_notif_late_title'), t('gd_notif_late_body'), at + grace);
}

// --- „Добре ли си?" — екран, звук, вибрация --------------------------------------------
function ask() {
  const now = Date.now();
  patch({ askedAt: now });
  addLog('asked', _testMode ? 'test' : '');
  showAsk();
  startBeep();
  showNotif(NOTIF_ASK, t('gd_ask_title'), t('gd_notif_ask_body'));
  if (_render) _render();
}

function fmtLeft(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? (m + ':' + String(s % 60).padStart(2, '0')) : (s + ' s');
}

function showAsk() {
  if (_overlay || typeof document === 'undefined') return;
  const g = G();
  const since = new Date(g.lastActivity).toLocaleString(getLang());
  const left = document.createElement('div');
  const yes = document.createElement('button');
  yes.textContent = t('gd_ask_yes');
  yes.style.cssText = 'font-size:1.6rem;font-weight:800;padding:26px 20px;border-radius:20px;border:none;background:var(--accent);color:#06122b;width:100%;max-width:420px;cursor:pointer;box-shadow:0 8px 30px #0008';
  yes.addEventListener('click', () => markActivity('button'));
  _overlay = document.createElement('div');
  _overlay.id = 'guardian-ask';
  _overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:#0b1020f5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center';
  const h = document.createElement('div');
  h.style.cssText = 'font-size:2rem;font-weight:800';
  h.textContent = '🛡️ ' + t('gd_ask_title');
  const b = document.createElement('div');
  b.style.cssText = 'color:var(--muted);font-size:1rem;max-width:420px';
  b.textContent = tf('gd_ask_body', since);
  left.style.cssText = 'color:var(--warn);font-size:1.1rem;font-weight:700';
  _overlay.appendChild(h); _overlay.appendChild(b); _overlay.appendChild(yes); _overlay.appendChild(left);
  document.body.appendChild(_overlay);
  const upd = () => {
    const gg = G();
    if (!gg.askedAt || !_overlay) return;
    const grace = graceMs();
    left.textContent = tf('gd_ask_left', fmtLeft(gg.askedAt + grace - Date.now()));
  };
  upd();
  _overlay._iv = setInterval(upd, 1000);
}
function hideAsk() {
  stopBeep();
  if (_overlay) {
    try { clearInterval(_overlay._iv); } catch (_) {}
    _overlay.remove();
    _overlay = null;
  }
}
function graceMs() {
  const g = G();
  if (_testMode) return 60 * 1000; // тестът чака 60 секунди
  return Math.max(1, parseInt(g.graceMinutes, 10) || 15) * 60 * 1000;
}

function beepOnce() {
  try {
    if (!_audio) _audio = new (window.AudioContext || window.webkitAudioContext)();
    if (_audio.state === 'suspended') _audio.resume();
    const now = _audio.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = _audio.createOscillator();
      const gn = _audio.createGain();
      o.type = 'square';
      o.frequency.value = 880 + i * 220;
      gn.gain.setValueAtTime(0.0001, now + i * 0.25);
      gn.gain.exponentialRampToValueAtTime(0.6, now + i * 0.25 + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.2);
      o.connect(gn); gn.connect(_audio.destination);
      o.start(now + i * 0.25); o.stop(now + i * 0.25 + 0.22);
    }
  } catch (_) {}
  try { if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 600]); } catch (_) {}
}
function startBeep() {
  stopBeep();
  beepOnce();
  _beepTimer = setInterval(beepOnce, 4000);
}
function stopBeep() {
  if (_beepTimer) { clearInterval(_beepTimer); _beepTimer = null; }
  try { if (navigator.vibrate) navigator.vibrate(0); } catch (_) {}
}

// --- състояние на телефона за сигнала --------------------------------------------------
async function batteryText() {
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      return Math.round(b.level * 100) + '%' + (b.charging ? ' ⚡' : '');
    }
  } catch (_) {}
  return t('gd_unknown');
}

// Местоположение — САМО ако потребителят е включил „прилагай местоположение".
export function getLocation(timeoutMs) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => fin({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0) }),
        () => fin(null),
        { enableHighAccuracy: false, timeout: timeoutMs || 10000, maximumAge: 5 * 60 * 1000 }
      );
    } catch (_) { fin(null); }
    setTimeout(() => fin(null), (timeoutMs || 10000) + 500);
  });
}
function locationText(loc) {
  if (!loc) return t('gd_unknown');
  const la = loc.lat.toFixed(5), lo = loc.lon.toFixed(5);
  return la + ', ' + lo + (loc.acc ? ' (±' + loc.acc + ' m)' : '') + ' https://www.openstreetmap.org/?mlat=' + la + '&mlon=' + lo + '#map=16/' + la + '/' + lo;
}

// Съставя текста на сигнала към близките (за преглед и за изпращане).
export async function composeAlert(opts) {
  const g = G();
  const who = String(g.myName || '').trim() || t('gd_the_phone');
  const parts = [];
  if (opts && opts.test) parts.push(t('gd_alert_test'));
  parts.push(tf('gd_alert_head', who));
  parts.push(tf('gd_alert_last', new Date(g.lastActivity).toLocaleString(getLang())));
  parts.push(tf('gd_alert_batt', await batteryText()));
  if (g.shareLocation) parts.push(tf('gd_alert_loc', locationText(await getLocation(10000))));
  const urgent = (g.urgent || []).filter((u) => u.at >= g.lastActivity);
  if (urgent.length) {
    parts.push(tf('gd_alert_urgent', urgent.slice(-5).map((u) => u.sender + ' (' + new Date(u.at).toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' }) + ')').join(', ')));
  }
  parts.push(t('gd_alert_sent_by'));
  return parts.join(' ');
}

// --- изпращане до близък през наличните канали ------------------------------------------
function channelName(pkg) {
  return ({ 'com.whatsapp': 'WhatsApp', 'com.viber.voip': 'Viber', 'com.facebook.orca': 'Messenger' })[pkg] || pkg || '';
}

// Опитва автоматичните канали по ред. Връща { ok, via } или { ok:false }.
export async function sendToContact(contact, text) {
  const st = getState();
  // 1) нашият чат — напълно автоматично, ако е настроен и близкият има идентификатор
  const cfg = st.channels && st.channels.pupikes;
  const pid = String((contact && contact.pupikesId) || '').trim();
  if (pid && cfg && cfg.enabled !== false && pupikesConfigured(cfg)) {
    try {
      const r = await pupikesSend(cfg, { friendId: pid, text });
      if (r && r.ok) return { ok: true, via: t('chan_our_chat') };
    } catch (_) {}
  }
  // 2) месинджъри — direct-reply по последното известие от този човек (по име)
  const name = String((contact && contact.name) || '').trim().toLowerCase();
  if (name && isNativeReplyAvailable() && (await isAccessGranted())) {
    try {
      const rec = await getRecent();
      const cand = (rec.messages || []).filter((m) => m && m.canReply && m.key && String(m.sender || '').trim().toLowerCase() === name)
        .sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0))[0];
      if (cand) {
        const r = await replyTo({ key: cand.key, text });
        if (r && r.ok) return { ok: true, via: channelName(cand.pkg) };
      }
    } catch (_) {}
  }
  return { ok: false };
}

// Сигнал към ВСИЧКИ близки. Без автоматичен канал → опашка „за ръчно изпращане" + известие.
async function escalate(test) {
  const text = await composeAlert({ test });
  const g = G();
  const pending = [...(g.pending || [])];
  let auto = 0;
  for (const c of g.contacts || []) {
    const r = await sendToContact(c, text);
    if (r.ok) { auto++; addLog('sent', c.name + ' · ' + r.via); }
    else {
      pending.push({ id: uid(), at: Date.now(), name: c.name, phone: c.phone || '', text });
      addLog('pending', c.name);
    }
  }
  patch({ askedAt: 0, alertedAt: Date.now(), pending: pending.slice(-30) });
  addLog('alert', (test ? 'test · ' : '') + auto + '/' + (g.contacts || []).length);
  hideAsk();
  await cancelNotif([NOTIF_ASK, NOTIF_LATE]);
  await showNotif(NOTIF_ALERT, t('gd_alert_notif_title'), text);
  toast(t('gd_alert_notif_title'));
  _testMode = false;
  if (_render) _render();
}

// --- делегат: препращане на спешно съобщение --------------------------------------------
// Записва „кой е писал спешно" (влиза в сигнала) и праща съобщението на делегата.
export async function forwardToDelegate({ sender, channel, text }) {
  const st = getState();
  const d = st.delegate || {};
  const g = G();
  patch({ urgent: [...(g.urgent || []), { at: Date.now(), sender, channel, text }].slice(-50) });
  const chan = ({ pupikes: t('chan_our_chat'), whatsapp: 'WhatsApp', viber: 'Viber', messenger: 'Messenger', local: t('chan_demo') })[channel] || channel;
  const fwd = tf('dg_forward_text', sender, chan, text);
  const r = await sendToContact({ name: d.name, phone: d.phone, pupikesId: d.pupikesId }, fwd);
  if (r.ok) { addLog('forwarded', sender + ' → ' + d.name + ' · ' + r.via); return r; }
  const cur = G();
  patch({ pending: [...(cur.pending || []), { id: uid(), at: Date.now(), name: d.name, phone: d.phone || '', text: fwd, delegate: true }].slice(-30) });
  addLog('pending', d.name + ' ← ' + sender);
  await showNotif(NOTIF_ALERT + 1, tf('dg_notif_title', d.name), fwd);
  return { ok: false, pending: true };
}

// --- ръчно изпращане (SMS с готов текст / споделяне / копиране) -------------------------------
export function openSms(phone, text) {
  const num = String(phone || '').replace(/[^\d+]/g, '');
  const url = 'sms:' + num + '?body=' + encodeURIComponent(text);
  try { window.location.href = url; return true; } catch (_) { return false; }
}
export async function shareText(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return true; }
  } catch (_) {}
  try { await navigator.clipboard.writeText(text); toast(t('gd_copied')); return true; } catch (_) {}
  return false;
}
export function removePending(id) {
  patch({ pending: (G().pending || []).filter((p) => p.id !== id) });
}

// --- главният такт -----------------------------------------------------------------------
function tick() {
  const g = G();
  if (!g.enabled) { hideAsk(); return; }
  const now = Date.now();
  if (g.askedAt) {
    if (now - g.askedAt >= graceMs()) { escalate(_testMode); return; }
    if (!_overlay) { showAsk(); startBeep(); }
    return;
  }
  if (g.alertedAt && g.lastActivity < g.alertedAt) return; // вече сигнализирано — чакаме активност
  if (!(g.contacts || []).length) return;                  // няма кого да известява
  if (now >= nextAskTime(g)) ask();
  else planNotifications();
}

// Тест „симулирай мълчание": пита веднага; без отговор 60 с → тестов сигнал към близките.
export function simulateSilence() {
  _testMode = true;
  ask();
}

// Изрично „Добре съм" (от екрана).
export function answerOk() { markActivity('button'); }

// Включване/изключване от екрана.
export function setGuardianEnabled(on) {
  patch({ enabled: !!on, askedAt: 0, lastActivity: Date.now() });
  addLog(on ? 'on' : 'off', '');
  _plannedFor = 0;
  if (on) planNotifications();
  else { hideAsk(); cancelNotif([NOTIF_ASK, NOTIF_LATE]); }
}

// Стартира пазителя (еднократно). render() опреснява екрана при промяна.
export function startGuardian(render) {
  _render = render || _render;
  installActivityTracking();
  if (_timer) return;
  _timer = setInterval(tick, TICK_MS);
  tick();
}
