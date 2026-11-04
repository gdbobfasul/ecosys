'use strict';
// Pupikes Remote Desk — логика в интерфейса.
// Роли: КОНТРОЛЕР (този, който се свързва) и ГОСТ (този, чийто екран се споделя).
// ДВЕ нива на достъп при госта:
//   • НАБЛЮДЕНИЕ  — парола 6 знака → само гледане на екрана (без управление, без файлове).
//   • ПЪЛЕН ДОСТЪП — парола 18 знака → гледане + мишка/клавиатура + файлове.
// Контролерът въвежда едната парола; тя определя нивото.

const $ = (id) => document.getElementById(id);
const rndDigits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const rndChars = (n) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };

// Signaling URL:
//  • зареден от сървър (http/https, напр. зад nginx /desk/) → извлечи от адреса:
//    същия хост + текущия под-път, с wss при https → телефон/браузър работи без настройка;
//  • инсталирано .exe (file://) → по подразбиране НАШИЯ публичен сървър, за да се намерят
//    два РАЗЛИЧНИ компютъра от кутията. (За локален тест: сложи 'rd.signal' в localStorage
//    = 'ws://localhost:9000' и пусни отделно `npm run signal`.)
const DEFAULT_PUBLIC_SIGNAL = 'wss://take.offbitch.com/desk/';
const SIGNAL_URL = localStorage.getItem('rd.signal') || (() => {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const base = location.pathname.replace(/\/[^/]*$/, '/'); // директорията на страницата (/desk/)
    return proto + '://' + location.host + base;
  }
  return DEFAULT_PUBLIC_SIGNAL;
})();
// ── Траен запис ──
// В .exe версията всичко идва от ЕДИН ФАЙЛ до приложението (pupikes-desk.json), който е АВТОРИТЕТЕН и
// може да се редактира на ръка: сменяш ли паролата/номера там → важат при следващо пускане; изтриеш ли
// файла → дава се нов номер/пароли. В уеб/мобилно — от localStorage.
const EL = !!(window.rd && window.rd.getStateSync);
let FS = {};
if (EL) { try { FS = window.rd.getStateSync() || {}; } catch (_) { FS = {}; } }
function stSave() { if (EL) { try { window.rd.setState(FS); } catch (_) {} } }
function getVal(k) { if (EL) return (FS[k] != null ? String(FS[k]) : undefined); const v = localStorage.getItem('rd.' + k); return v == null ? undefined : v; }
function setVal(k, v) { if (EL) { FS[k] = v; stSave(); } else { try { localStorage.setItem('rd.' + k, v); } catch (_) {} } }
function getArrK(k) { if (EL) return Array.isArray(FS[k]) ? FS[k] : []; try { return JSON.parse(localStorage.getItem('rd.' + k) || '[]'); } catch (_) { return []; } }
function setArrK(k, a) { if (EL) { FS[k] = a; stSave(); } else { try { localStorage.setItem('rd.' + k, JSON.stringify(a)); } catch (_) {} } }

// Номер на инсталацията: от файла (авторитетен). Липсва/невалиден → нов номер и запис.
let myId = getVal('id');
if (!myId || !/^\d{6,}$/.test(String(myId).replace(/\s/g, ''))) { myId = rndDigits(9); setVal('id', myId); }
else { myId = String(myId).replace(/\s/g, ''); }
let viewPass = getVal('viewPassword'); if (!viewPass) { viewPass = rndChars(6); setVal('viewPassword', viewPass); }
let fullPass = getVal('fullPassword'); if (!fullPass) { fullPass = rndChars(18); setVal('fullPassword', fullPass); }

$('myid').textContent = myId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
$('vpass').value = viewPass; $('fpass').value = fullPass; $('signal').value = SIGNAL_URL;
$('vpass').addEventListener('change', () => { viewPass = $('vpass').value.trim(); setVal('viewPassword', viewPass); });
$('fpass').addEventListener('change', () => { fullPass = $('fpass').value.trim(); setVal('fullPassword', fullPass); });
$('signal').addEventListener('change', () => { try { localStorage.setItem('rd.signal', $('signal').value.trim()); } catch (_) {} location.reload(); });
$('regen').onclick = () => { viewPass = rndChars(6); fullPass = rndChars(18); setVal('viewPassword', viewPass); setVal('fullPassword', fullPass); $('vpass').value = viewPass; $('fpass').value = fullPass; };

// НАШИЯТ TURN (coturn на сървъра, точка 89) е основната резерва при строг NAT; openrelay е втора резерва.
const TURN_HOST = 'take.offbitch.com', TURN_USER = 'pupikes', TURN_CRED = 'PupikesTurn2026';
const ICE = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:' + TURN_HOST + ':3478' },
  { urls: 'turn:' + TURN_HOST + ':3478?transport=udp', username: TURN_USER, credential: TURN_CRED },
  { urls: 'turn:' + TURN_HOST + ':3478?transport=tcp', username: TURN_USER, credential: TURN_CRED },
  { urls: 'turns:' + TURN_HOST + ':5349?transport=tcp', username: TURN_USER, credential: TURN_CRED },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
] };
const setStatus = (t) => { $('status').textContent = t; };
const setRole = (t) => { $('role').textContent = t; };
const log = (t) => { const d = document.createElement('div'); d.textContent = t; $('filelog').prepend(d); };

let ws = null, pc = null, ctrl = null, file = null, peer = null, role = null;
let lastConnPass = '';   // паролата, с която контролерът се свързва (за да я запишем в историята при успех)
let localStream = null;  // прихванатият екран на госта — спираме го при прекъсване, иначе блокира ново прихващане
let pendingIce = [];     // ICE кандидати, пристигнали преди remoteDescription — буферираме и ги добавяме после
async function flushIce() { if (!pc) return; for (const c of pendingIce.splice(0)) { try { await pc.addIceCandidate(c); } catch (_) {} } }
let idBlocked = false, idTakenTries = 0;   // ако номерът е зает на друг компютър → блокираме приложението

// Номерът е зает в момента → приложението не стартира с него (цял екран се блокира).
function showIdBlock() {
  let el = $('idblock');
  if (!el) {
    el = document.createElement('div'); el.id = 'idblock';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(10,12,16,.97);z-index:70;display:flex;align-items:center;justify-content:center;padding:24px;';
    el.innerHTML = '<div style="max-width:520px;text-align:center;background:#171a21;border:1px solid #272b36;border-radius:14px;padding:26px;">'
      + '<h2 style="margin:0 0 10px;color:#e3b341;">Номерът е зает</h2>'
      + '<p style="color:#9aa3b2;">Номер <b>' + myId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') + '</b> вече се ползва на друг компютър в момента. Този компютър не може да стартира с него.</p>'
      + '<p style="color:#9aa3b2;font-size:13px;">Смени номера (<code>id</code>) във файла <b>pupikes-desk.json</b> до приложението, или изтрий файла (ще се даде нов номер), и стартирай пак.</p>'
      + '<button id="idRetry" style="margin-top:12px;padding:10px 16px;border:0;border-radius:8px;background:#4c8bf5;color:#fff;font-weight:600;cursor:pointer;">Провери пак</button>'
      + '</div>';
    document.body.appendChild(el);
    el.querySelector('#idRetry').onclick = () => location.reload();
  }
  el.style.display = 'flex';
}
let grant = null;        // нивото, дадено на ТАЗИ връзка: 'view' | 'control'
let hostSize = null;

function connectSignal() {
  ws = new WebSocket(SIGNAL_URL);
  ws.onopen = () => { $('sig').className = 'dot on'; ws.send(JSON.stringify({ type: 'hello', id: myId })); };
  ws.onclose = () => { $('sig').className = 'dot'; if (!idBlocked) setTimeout(connectSignal, 2000); };
  ws.onerror = () => { $('sig').className = 'dot'; };
  ws.onmessage = async (e) => {
    let m; try { m = JSON.parse(e.data); } catch (_) { return; }
    if (m.type === 'hello-ok') { idTakenTries = 0; return; }   // регистрацията мина → номерът е наш
    if (m.type === 'error' && m.error === 'id-taken') {         // номерът е зает на друг компютър в момента
      idTakenTries++;
      try { ws.close(); } catch (_) {}
      if (idTakenTries > 2) { idBlocked = true; showIdBlock(); }   // (2 опита за случай на презареждане) → блокирай
      return;
    }
    if (m.type === 'error') { setStatus('Грешка: ' + (m.error === 'peer-offline' ? 'отсрещният не е онлайн' : m.error)); return; }
    if (m.type === 'bye') { teardown('Връзката е прекъсната от другия.'); return; }
    if (m.type === 'signal') await onSignal(m.from, m.data);
  };
}
const sig = (to, data) => ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'signal', to, data }));

// ── КОНТРОЛЕР: свързване към чужд номер ──
$('connect').onclick = async () => {
  const id = $('peerid').value.replace(/\D/g, '');
  if (id.length < 6) { setStatus('Въведи валиден номер (9 цифри).'); return; }
  cleanupPc();   // затвори евентуална предишна връзка, за да може ново свързване
  peer = id; role = 'controller'; grant = null; lastConnPass = $('peerpass').value.trim();
  pc = new RTCPeerConnection(ICE);
  pc.onicecandidate = (ev) => { if (ev.candidate) sig(peer, { kind: 'ice', candidate: ev.candidate }); };
  pc.ontrack = (ev) => {
    const v = $('screen'); v.srcObject = ev.streams[0]; v.muted = true; v.style.display = 'block';
    $('hint').style.display = 'none';
    v.play().catch(() => {});   // иначе Chromium показва само първия кадър („замръзнал" образ)
    v.onloadedmetadata = () => v.play().catch(() => {});
    applyGrantUI(v);
  };
  ctrl = pc.createDataChannel('ctrl'); setupCtrl(ctrl);
  file = pc.createDataChannel('file'); setupFile(file);
  pc.addTransceiver('video', { direction: 'recvonly' });
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  sig(peer, { kind: 'offer', sdp: offer, pass: $('peerpass').value.trim() });
  setStatus('Свързвам се с ' + id + '…'); showConnected();
};

// ── ГОСТ: някой се свързва с моя номер ──
async function onSignal(from, data) {
  if (data.kind === 'offer') {
    const p = (data.pass || '');
    let level = null;
    if (p && p === fullPass) level = 'control';
    else if (p && p === viewPass) level = 'view';
    if (!level) { sig(from, { kind: 'denied' }); setStatus('Отказан достъп (грешна парола) от ' + from); return; }
    cleanupPc();   // затвори евентуална предишна връзка, за да приемем нова
    peer = from; role = 'host'; grant = level; setRole(level === 'control' ? 'споделяш (пълен достъп)' : 'споделяш (само наблюдение)');
    pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (ev) => { if (ev.candidate) sig(peer, { kind: 'ice', candidate: ev.candidate }); };
    pc.ondatachannel = (ev) => { if (ev.channel.label === 'ctrl') { ctrl = ev.channel; setupCtrl(ctrl); } else if (ev.channel.label === 'file') { file = ev.channel; setupFile(file); } };
    // ПЪРВО приемаме офертата (има видео-трансивер recvonly), чак после добавяме екрана —
    // така кадрите тръгват по същия m-ред и образът не „замръзва".
    await pc.setRemoteDescription(data.sdp);
    const stream = await captureScreen();
    if (!stream) { setStatus('Не можах да взема екрана.'); return; }
    await flushIce();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
    sig(peer, { kind: 'answer', sdp: answer, level });
    setStatus('Свързан с ' + from + ' — ' + (level === 'control' ? 'пълен достъп' : 'само наблюдение') + '.'); showConnected();
  } else if (data.kind === 'answer') {
    grant = data.level || 'view';
    await pc.setRemoteDescription(data.sdp);
    await flushIce();
    setRole(grant === 'control' ? 'управляваш (пълен достъп)' : 'наблюдаваш (само четене)');
    setStatus(grant === 'control' ? 'Пълен достъп — можеш да управляваш и да пращаш файлове.' : 'Само наблюдение — гледаш екрана (без управление).');
    addHistory(peer, lastConnPass);   // успешна връзка → запиши в историята (с паролата)
  } else if (data.kind === 'denied') {
    teardown('Отсрещният отказа: грешна парола.');
  } else if (data.kind === 'bye') {
    teardown('Връзката е прекъсната от другия.');
  } else if (data.kind === 'ice') {
    if (pc && pc.remoteDescription && pc.remoteDescription.type) { try { await pc.addIceCandidate(data.candidate); } catch (_) {} }
    else pendingIce.push(data.candidate);   // още няма remoteDescription → буферирай
  }
}

// прилага нивото в интерфейса на контролера (управление + файлове само при 'control')
function applyGrantUI(video) {
  if (grant === 'control') { bindControl(video); $('filecard').style.display = 'block'; }
  else { $('filecard').style.display = 'none'; }    // наблюдение: само гледаш
}

async function captureScreen() {
  try {
    let stream;
    try {
      // МОДЕРЕН, СТАБИЛЕН път: в Electron главният процес сам избира екрана (setDisplayMediaRequestHandler),
      // така че няма диалог и потокът НЕ замръзва след няколко секунди (за разлика от стария desktopCapturer+getUserMedia).
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
    } catch (e1) {
      // Резервно (по-стари Electron): стар път с desktopCapturer id.
      if (window.rd && window.rd.sources) {
        const sources = await window.rd.sources();
        const scr = sources.find((s) => /screen|екран|entire|цял/i.test(s.name)) || sources[0];
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: scr.id, maxFrameRate: 15 } } });
      } else { throw e1; }
    }
    localStream = stream;
    stream.getVideoTracks().forEach((t) => { t.onended = () => setStatus('Споделянето на екрана спря.'); });
    const sz = (window.rd && window.rd.screenSize) ? await window.rd.screenSize() : { w: window.screen.width, h: window.screen.height };
    hostSize = sz;
    const announce = () => ctrl && ctrl.readyState === 'open' && ctrl.send(JSON.stringify({ t: 'meta', w: sz.w, h: sz.h }));
    setTimeout(announce, 800); setTimeout(announce, 2000);
    return stream;
  } catch (e) { console.error(e); return null; }
}
// запис на получен файл: Electron → системен диалог; браузър → сваляне
async function rdSaveFile(name, blobParts, mime) {
  if (window.rd && window.rd.saveFile) { const u8 = new Uint8Array(blobParts.reduce((a, p) => a + p.byteLength, 0)); let o = 0; for (const p of blobParts) { u8.set(new Uint8Array(p), o); o += p.byteLength; } const r = await window.rd.saveFile(name, Array.from(u8)); return r && r.ok ? ('запазено: ' + (r.path || name)) : 'отказано'; }
  const blob = new Blob(blobParts, { type: mime || 'application/octet-stream' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  const isWin = /Windows/i.test(navigator.userAgent), isAndroid = /Android/i.test(navigator.userAgent);
  const where = isAndroid ? ('папка „Download" на телефона → ' + name) : isWin ? ('C:\\Users\\<твоето име>\\Downloads\\' + name) : ('папка „Изтегляния"/Downloads → ' + name);
  return 'свалено: ' + name + ' · намира се в: ' + where;
}

// ── канал за УПРАВЛЕНИЕ (контролер → гост) ──
function setupCtrl(ch) {
  ch.onopen = async () => {
    if (role === 'host') {
      const sz = (window.rd && window.rd.screenSize) ? await window.rd.screenSize() : { w: window.screen.width, h: window.screen.height };
      const control = (window.rd && window.rd.controlEnabled) ? await window.rd.controlEnabled() : false;  // има ли nut.js
      ch.send(JSON.stringify({ t: 'meta', w: sz.w, h: sz.h, control }));
    }
  };
  ch.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch (_) { return; }
    if (m.t === 'meta') {
      hostSize = { w: m.w, h: m.h };
      // контролер: ако искаш пълен достъп, но отсрещният няма модул за управление → предупреди ясно
      if (role === 'controller' && grant === 'control' && m.control === false) {
        setStatus('⚠ Свързан си с пълен достъп, но отсрещният компютър НЯМА модул за управление (nut.js) — виждаш екрана, но мишка/клавиатура няма да действат там. Обнови приложението на онзи компютър.');
      }
      return;
    }
    // ГОСТЪТ изпълнява входа САМО ако връзката е с пълен достъп И има как (Electron nut.js)
    if (role === 'host' && grant === 'control' && window.rd && window.rd.input) window.rd.input(m);
  };
}

function bindControl(video) {
  const toHost = (clientX, clientY) => {
    const r = video.getBoundingClientRect(); const vw = video.videoWidth || r.width, vh = video.videoHeight || r.height;
    const scale = Math.min(r.width / vw, r.height / vh); const dw = vw * scale, dh = vh * scale;
    const ox = r.left + (r.width - dw) / 2, oy = r.top + (r.height - dh) / 2;
    let x = (clientX - ox) / scale, y = (clientY - oy) / scale;
    if (hostSize) { x = x * (hostSize.w / vw); y = y * (hostSize.h / vh); }
    return { x, y };
  };
  const send = (o) => ctrl && ctrl.readyState === 'open' && ctrl.send(JSON.stringify(o));
  video.onmousemove = (e) => { const p = toHost(e.clientX, e.clientY); send({ t: 'move', x: p.x, y: p.y }); };
  video.onmousedown = (e) => { e.preventDefault(); const p = toHost(e.clientX, e.clientY); send({ t: 'down', x: p.x, y: p.y, b: e.button }); };
  video.onmouseup = (e) => { e.preventDefault(); const p = toHost(e.clientX, e.clientY); send({ t: 'up', x: p.x, y: p.y, b: e.button }); };
  video.oncontextmenu = (e) => e.preventDefault();
  video.onwheel = (e) => { e.preventDefault(); send({ t: 'wheel', dy: Math.sign(e.deltaY) * 3 }); };
  video.tabIndex = 0;
  video.onkeydown = (e) => { e.preventDefault(); if (e.key.length === 1) send({ t: 'type', text: e.key }); else send({ t: 'key', key: e.key }); };
}

// ── канал за ФАЙЛОВЕ (само при пълен достъп) ──
let rx = null;
function setupFile(ch) {
  ch.binaryType = 'arraybuffer';
  ch.onopen = () => { if (grant === 'control') $('filecard').style.display = 'block'; };
  ch.onmessage = async (e) => {
    if (grant !== 'control') return;                 // наблюдение: не приема файлове
    if (typeof e.data === 'string') {
      const m = JSON.parse(e.data);
      if (m.f === 'meta') { rx = { name: m.name, mime: m.mime, parts: [], got: 0 }; log('↓ получавам: ' + m.name + ' (' + fmt(m.size) + ')'); }
      else if (m.f === 'end' && rx) { const msg = await rdSaveFile(rx.name, rx.parts, rx.mime); log('✓ ' + msg); rx = null; }
    } else if (rx) { rx.parts.push(e.data); rx.got += e.data.byteLength; }
  };
}
$('sendfile').onclick = () => $('filepick').click();
$('filepick').onchange = async (e) => {
  const f = e.target.files[0]; if (!f || !file || file.readyState !== 'open' || grant !== 'control') return;
  log('↑ изпращам: ' + f.name + ' (' + fmt(f.size) + ')');
  file.send(JSON.stringify({ f: 'meta', name: f.name, size: f.size, mime: f.type }));
  const buf = await f.arrayBuffer(); const CH = 16 * 1024;
  for (let o = 0; o < buf.byteLength; o += CH) { while (file.bufferedAmount > 4 * 1024 * 1024) await new Promise((r) => setTimeout(r, 20)); file.send(buf.slice(o, o + CH)); }
  file.send(JSON.stringify({ f: 'end' }));
  log('✓ изпратено: ' + f.name);
};
const fmt = (n) => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : (n / 1e3).toFixed(0) + ' KB';

function showConnected() { $('connect').style.display = 'none'; $('hang').style.display = 'block'; }
$('hang').onclick = () => { if (peer) sig(peer, { kind: 'bye' }); teardown('Прекъсна връзката.'); };
function teardown(msg) {
  try { pc && pc.close(); } catch (_) {}
  try { if (localStream) { localStream.getTracks().forEach((t) => t.stop()); } } catch (_) {}  // спри прихващането → ново свързване после работи
  localStream = null;
  pc = ctrl = file = null; peer = role = grant = null; hostSize = null; rx = null;
  const v = $('screen'); try { v.pause(); } catch (_) {} v.srcObject = null; v.style.display = 'none';
  $('hint').style.display = 'block';
  $('connect').style.display = 'block'; $('connect').disabled = false; $('hang').style.display = 'none'; $('filecard').style.display = 'none';
  setRole(''); setStatus(msg || '');
}
// Тихо почистване на предишна връзка (без да пипа интерфейса) — преди ново свързване.
function cleanupPc() {
  try { pc && pc.close(); } catch (_) {}
  try { if (localStream) localStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
  pc = ctrl = file = null; localStream = null; pendingIce = [];
}

// ── ЛИЦЕНЗ/АКТИВАЦИЯ (само Windows; телефонната версия е безплатна) ──
async function checkLicense() {
  if (!window.rd || !window.rd.licenseStatus) return;        // телефон/уеб → няма заключване
  const st = await window.rd.licenseStatus();
  $('lic').textContent = st.activated ? ('активирано' + (st.method === 'owner' ? ' (код)' : '')) : ('безплатни употреби: ' + Math.min(st.uses, st.freeUses) + '/' + st.freeUses);
  $('pwPrice').textContent = st.price; $('pwEmail').textContent = st.paypal;
  if (st.locked) showPaywall();
}
function showPaywall() { $('paywall').style.display = 'flex'; }
if ($('openCode')) $('openCode').onclick = () => { showPaywall(); const f = $('pwCode'); if (f) f.focus(); };
function hidePaywall() { $('paywall').style.display = 'none'; }
if ($('pwPay')) $('pwPay').onclick = async () => { const em = await window.rd.openPaypal(); $('pwStatus').textContent = 'Изпрати плащането към ' + em + ', после въведи транзакцията по-горе.'; };
if ($('pwActivate')) $('pwActivate').onclick = async () => {
  const r = await window.rd.licenseActivate({ txn: $('pwTxn').value, sender: $('pwSender').value });
  if (r.ok) { $('pwStatus').textContent = '✓ Активирано. Благодаря!'; setTimeout(() => { hidePaywall(); checkLicense(); }, 900); }
  else $('pwStatus').textContent = '✗ ' + r.error;
};
if ($('pwRedeem')) $('pwRedeem').onclick = async () => {
  const r = await window.rd.licenseRedeem($('pwCode').value);
  if (r.ok) { $('pwStatus').textContent = '✓ Отключено с код.'; setTimeout(() => { hidePaywall(); checkLicense(); }, 700); }
  else $('pwStatus').textContent = '✗ ' + r.error;
};

// ── Връзка/проблем: праща описанието към нашия сървър (записва се за собственика) ──
// HTTP базата идва от signaling адреса (wss→https); при .exe сочи публичния /desk/ сървър.
const httpBase = () => SIGNAL_URL.replace(/^ws/, 'http');
fetch(httpBase() + 'api/contact').then((r) => r.json()).then((d) => { if (d && d.contact) $('fbContact').textContent = d.contact; }).catch(() => {});
if ($('fbSend')) $('fbSend').onclick = async () => {
  const message = $('fbMsg').value.trim();
  if (!message) { $('fbStatus').textContent = 'Опиши проблема, за да го изпратиш.'; return; }
  $('fbStatus').textContent = 'Изпращам…';
  try {
    const r = await fetch(httpBase() + 'api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, email: $('fbEmail').value.trim() }) });
    const d = await r.json();
    if (d.ok) { $('fbStatus').textContent = '✓ Благодарим! Съобщението е изпратено.'; $('fbMsg').value = ''; }
    else $('fbStatus').textContent = '✗ ' + (d.error || 'грешка');
  } catch (_) { $('fbStatus').textContent = '✗ Няма връзка — пиши ни на ' + $('fbContact').textContent; }
};

// ── Копиране/поставяне с ДЕСЕН бутон + кратко известие ──
function toast(t) { const el = $('toast'); if (!el) return; el.textContent = t; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 1400); }
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch (_) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
  toast('✓ копирано');
}
function rightClickCopy(el, getVal) { if (!el) return; el.classList.add('copyable'); el.addEventListener('contextmenu', (e) => { e.preventDefault(); copyText(getVal()); }); }
function rightClickPaste(inp) { if (!inp) return; inp.addEventListener('contextmenu', async (e) => { e.preventDefault(); try { const t = await navigator.clipboard.readText(); if (t) { inp.value = t.trim(); toast('✓ поставено'); } } catch (_) {} }); }
rightClickCopy($('myid'), () => myId);              // суровите 9 цифри (без интервали)
rightClickCopy($('vpass'), () => $('vpass').value);
rightClickCopy($('fpass'), () => $('fpass').value);
rightClickPaste($('peerid')); rightClickPaste($('peerpass'));

// ── История на осъществените връзки + Любими (пазят се локално, заедно с паролата) ──
const LS = { hist: 'history', fav: 'favorites' };   // ключове във файла (или rd.* в localStorage за уеб)
const getArr = (k) => getArrK(k);
const setArr = (k, a) => setArrK(k, a);
function addHistory(id, pass) {
  if (!id) return;
  const h = getArr(LS.hist).filter((x) => !(x.id === id && x.pass === pass));
  h.unshift({ id, pass: pass || '', date: new Date().toISOString() });
  setArr(LS.hist, h.slice(0, 20)); renderConns();
}
const isFav = (id, pass) => getArr(LS.fav).some((x) => x.id === id && x.pass === pass);
function toggleFav(id, pass) {
  let f = getArr(LS.fav);
  if (isFav(id, pass)) f = f.filter((x) => !(x.id === id && x.pass === pass));
  else f.unshift({ id, pass: pass || '', date: new Date().toISOString() });
  setArr(LS.fav, f); renderConns();
}
function useConn(id, pass) { $('peerid').value = id; $('peerpass').value = pass || ''; $('connect').click(); }
function connRow(x, where) {
  const d = document.createElement('div'); d.className = 'conn';
  const idspan = document.createElement('span'); idspan.className = 'id'; idspan.textContent = String(x.id || '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'); d.appendChild(idspan);
  const star = document.createElement('button'); star.className = 'star'; star.textContent = isFav(x.id, x.pass) ? '★' : '☆'; star.title = 'любими'; star.onclick = () => toggleFav(x.id, x.pass); d.appendChild(star);
  const go = document.createElement('button'); go.className = 'go'; go.textContent = 'Свържи'; go.onclick = () => useConn(x.id, x.pass); d.appendChild(go);
  if (where === 'hist') { const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕'; del.title = 'премахни'; del.onclick = () => { setArr(LS.hist, getArr(LS.hist).filter((y) => !(y.id === x.id && y.pass === x.pass))); renderConns(); }; d.appendChild(del); }
  return d;
}
function renderConns() {
  const fav = getArr(LS.fav), hist = getArr(LS.hist);
  const fl = $('favList'); if (fl) { fl.innerHTML = ''; fav.forEach((x) => fl.appendChild(connRow(x, 'fav'))); $('favCard').style.display = fav.length ? 'block' : 'none'; }
  const hl = $('histList'); if (hl) { hl.innerHTML = ''; hist.forEach((x) => hl.appendChild(connRow(x, 'hist'))); $('histCard').style.display = hist.length ? 'block' : 'none'; }
}
if ($('histClear')) $('histClear').onclick = () => { setArr(LS.hist, []); renderConns(); };
renderConns();

connectSignal();
checkLicense();
