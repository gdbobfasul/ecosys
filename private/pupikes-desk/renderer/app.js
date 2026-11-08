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
const SIGNAL_URL = (() => {
  const isFile = !(location.protocol === 'http:' || location.protocol === 'https:');   // .exe (file://)
  const host = location.hostname || '';
  const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/.test(host);
  // МОБИЛНО (Capacitor) сервира страницата от https://localhost → НЕ е истински сървър зад нея.
  const isCapacitor = !!(window.Capacitor || location.protocol === 'capacitor:' || isLocalHost);
  // „Локално обслужвана" = .exe (file://) ИЛИ мобилно/Capacitor (localhost). И в двата случая няма
  // сигнален сървър зад страницата → ползваме НАШИЯ публичен, иначе получаваме грешното „wss://localhost".
  const isLocalServed = isFile || isCapacitor;
  const stored = (() => { try { return localStorage.getItem('rd.signal'); } catch (_) { return null; } })();
  // Пренебрегваме локален/LAN адрес в .exe/мобилно (остатъчна тест-настройка) — иначе двете устройства кацат
  // на различни сървъри и никога не се намират. Винаги публичния, освен ако нарочно е зададен друг валиден.
  const localish = stored && /(localhost|127\.|192\.168\.|10\.|::1)/.test(stored);
  if (stored && !(isLocalServed && localish)) return stored;
  if (!isLocalServed) {
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
$('fpass').addEventListener('change', () => { fullPass = $('fpass').value.trim(); setVal('fullPassword', fullPass); showMyQr(); });
$('signal').addEventListener('change', () => { try { localStorage.setItem('rd.signal', $('signal').value.trim()); } catch (_) {} location.reload(); });
$('regen').onclick = () => { viewPass = rndChars(6); fullPass = rndChars(18); setVal('viewPassword', viewPass); setVal('fullPassword', fullPass); $('vpass').value = viewPass; $('fpass').value = fullPass; showMyQr(); };

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
// „Влязъл ли си" в отдалечения екран (щракнал си върху него) → клавиатурата отива натам. Щракане в наш
// елемент или минаване на локален прозорец → false (пишеш локално). Надеждно, не чрез крехкия DOM фокус.
let remoteActive = false;
function setRemoteActive(on) {
  const v = $('screen');
  const connCtl = role === 'controller' && grant === 'control' && v && v.style.display !== 'none';
  remoteActive = !!(connCtl && on);
  const b = $('kbbadge');
  if (!connCtl) { if (b) b.style.display = 'none'; return; }
  kbBadge(remoteActive);
}

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

let lockReleased = false;   // докато екранът е заключен → пускаме номера, за да го поеме нативната услуга
function connectSignal() {
  if (lockReleased) return;   // заключено: не се връзваме (услугата държи номера на защитения екран)
  ws = new WebSocket(SIGNAL_URL);
  ws.onopen = () => { $('sig').className = 'dot on'; ws.send(JSON.stringify({ type: 'hello', id: myId })); };
  ws.onclose = () => { $('sig').className = 'dot'; if (!idBlocked && !lockReleased) setTimeout(connectSignal, 2000); };
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
  let gotRelay = false;
  pc.onicecandidate = (ev) => { if (ev.candidate) { if (/ typ relay/.test(ev.candidate.candidate || '')) gotRelay = true; sig(peer, { kind: 'ice', candidate: ev.candidate }); } };
  pc.oniceconnectionstatechange = () => {
    const st = pc.iceConnectionState;
    if (st === 'failed') setStatus('⚠ Образът не мина (мрежа/NAT). ' + (gotRelay ? 'TURN релеят не помогна.' : 'Няма TURN релей — на различни мрежи е нужен. Пробвай двете устройства на една Wi-Fi.'));
    else if (st === 'disconnected') setStatus('Връзката прекъсна — опит за възстановяване…');
  };
  pc.ontrack = (ev) => {
    const v = $('screen'); v.srcObject = ev.streams[0]; v.muted = true; v.style.display = 'block';
    $('hint').style.display = 'none';
    $('stage').classList.add('playing');   // показва бутона „Уголеми екрана"
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

// ── „LOGIN-ЕКРАН" режим: отсрещната машина е ПРЕДИ вход (нативната услуга отговаря вместо приложението) ──
// Кадрите идват като JPEG през сигнала, а мишка/клавиатура се пращат обратно → услугата ги инжектира на
// защитения екран. Иска парола за ПЪЛЕН достъп.
let secureMode = false, securePeer = null;
$('connectSecure').onclick = () => {
  const id = $('peerid').value.replace(/\D/g, '');
  if (id.length < 6) { setStatus('Въведи валиден номер (9 цифри).'); return; }
  cleanupPc();
  secureMode = true; securePeer = id; peer = id; role = 'controller';
  try { if (window.rdSecureZoomReset) window.rdSecureZoomReset(); } catch (_) {}   // нов login изглед → нулирай зуума
  sig(id, { kind: 'secure-attach', pass: $('peerpass').value.trim() });
  setStatus('Свързвам се към login екрана на ' + id + '…'); showConnected();
};
function showSecureFrame(data) {
  const img = $('secureImg');
  img.src = 'data:image/jpeg;base64,' + data.jpeg;
  img.style.display = 'block';
  $('hint').style.display = 'none';
  $('stage').classList.add('playing');
}
function secureSendMouse(t, e, b) {
  const img = $('secureImg'); const r = img.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  sig(securePeer, { kind: 'input', t: t, x: x, y: y, b: (b === undefined ? 0 : b) });
}
(function secureInputWire() {
  const img = $('secureImg'); if (!img) return;
  let moveTs = 0;
  img.addEventListener('mousemove', (e) => { if (!secureMode) return; const now = Date.now(); if (now - moveTs < 60) return; moveTs = now; secureSendMouse('m', e); });
  img.addEventListener('mousedown', (e) => { if (!secureMode) return; e.preventDefault(); img.focus(); secureSendMouse('md', e, e.button === 2 ? 2 : 0); });
  img.addEventListener('mouseup', (e) => { if (!secureMode) return; e.preventDefault(); secureSendMouse('mu', e, e.button === 2 ? 2 : 0); });
  img.addEventListener('contextmenu', (e) => { if (secureMode) e.preventDefault(); });
  img.addEventListener('keydown', (e) => {
    if (!secureMode) return;
    e.preventDefault();
    const SPECIAL = { Enter: 13, Backspace: 8, Tab: 9, Escape: 27, Delete: 46, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35 };
    if (SPECIAL[e.key] !== undefined) { sig(securePeer, { kind: 'input', t: 'key', vk: SPECIAL[e.key] }); return; }
    if (e.key && e.key.length === 1) { sig(securePeer, { kind: 'input', t: 'type', text: e.key }); }
  });
})();

// ── ТЕЛЕФОН: пинч-зуум + плъзгане на LOGIN изгледа (малък е) + тап = клик, двоен тап = нулирай ──
// Мащабът е CSS transform; secureSendMouse ползва getBoundingClientRect → координатите остават верни
// при всякакъв зуум/плъзгане, затова кликът/писането продължават да уцелват правилната точка.
(function secureTouchZoom() {
  const img = $('secureImg'); if (!img) return;
  let scale = 1, tx = 0, ty = 0;
  function apply() { img.style.transformOrigin = '0 0'; img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
  function reset() { scale = 1; tx = 0; ty = 0; img.style.transform = ''; }
  window.rdSecureZoomReset = reset;
  let startDist = 0, startScale = 1, startTx = 0, startTy = 0, panX = 0, panY = 0, downX = 0, downY = 0, moved = false, lastTap = 0;
  img.addEventListener('touchstart', (e) => {
    if (!secureMode) return;
    if (e.touches.length === 2) { e.preventDefault(); const a = e.touches[0], b = e.touches[1]; startDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); startScale = scale; }
    else if (e.touches.length === 1) { e.preventDefault(); const t = e.touches[0]; downX = panX = t.clientX; downY = panY = t.clientY; startTx = tx; startTy = ty; moved = false; }
  }, { passive: false });
  img.addEventListener('touchmove', (e) => {
    if (!secureMode) return;
    if (e.touches.length === 2) {
      e.preventDefault(); const a = e.touches[0], b = e.touches[1]; const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      if (startDist > 0) { scale = Math.min(6, Math.max(1, startScale * (d / startDist))); if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; } apply(); }
      moved = true;
    } else if (e.touches.length === 1) {
      const t = e.touches[0]; const dx = t.clientX - downX, dy = t.clientY - downY; if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      if (scale > 1) { e.preventDefault(); tx = startTx + (t.clientX - panX); ty = startTy + (t.clientY - panY); apply(); }   // зуумнато → плъзгане
      else { e.preventDefault(); secureSendMouse('m', t); }                                                                 // мащаб 1 → движи мишката
    }
  }, { passive: false });
  img.addEventListener('touchend', (e) => {
    if (!secureMode) return;
    if (e.touches.length === 0 && !moved) {
      const now = Date.now();
      if (now - lastTap < 300) { reset(); lastTap = 0; return; }   // двоен тап → нулирай зуума
      lastTap = now;
      const t = e.changedTouches && e.changedTouches[0];
      if (t) { secureSendMouse('md', t, 0); secureSendMouse('mu', t, 0); }   // кратък тап → клик
    }
  }, { passive: false });
})();

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
    // Като AnyDesk: скрий прозореца на Pupikes-Desk, за да не пречи на отдалечения екран (връща се при прекъсване).
    if (window.rd && window.rd.winMinimize) setTimeout(() => { try { window.rd.winMinimize(); } catch (_) {} }, 700);
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
  } else if (data.kind === 'secure-ok') {
    setStatus('Свързан към login екрана — щракни в полето за парола, напиши паролата и натисни Enter.');
    try { $('secureImg').focus(); } catch (_) {}
  } else if (data.kind === 'secure-deny') {
    secureMode = false; securePeer = null; teardown('Отсрещният отказа: нужна е паролата за ПЪЛЕН достъп.');
  } else if (data.kind === 'frame') {
    if (secureMode) showSecureFrame(data);
  } else if (data.kind === 'secure-diag') {
    if (secureMode) setStatus('🔎 ' + (data.text || ''));   // диагностика от услугата (режим на заснемане)
  }
}

// прилага нивото в интерфейса на контролера (управление + файлове само при 'control')
function applyGrantUI(video) {
  if (grant === 'control') { bindControl(video); $('filecard').style.display = 'block'; if ($('pullfile')) $('pullfile').style.display = 'block'; if ($('lockRemote')) $('lockRemote').style.display = 'block'; }
  else { $('filecard').style.display = 'none'; if ($('lockRemote')) $('lockRemote').style.display = 'none'; }    // наблюдение: само гледаш
}
// Заключи ОТДАЛЕЧЕНАТА машина (Win+L заключва локалната) → после защитеният екран поема от услугата.
if ($('lockRemote')) $('lockRemote').onclick = () => { sendCtrl({ t: 'lock' }); setStatus('Изпратих заключване към отдалечената машина…'); };

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
    // Управляващият иска файл ОТ отсрещния → хостът отваря диалог за избор (ти го избираш през отдалечената мишка).
    if (m.t === 'pullFile') { if (role === 'host') { try { $('filepick').click(); } catch (_) {} } return; }
    // ГОСТЪТ изпълнява входа САМО ако връзката е с пълен достъп И има как (Electron nut.js)
    if (role === 'host' && grant === 'control' && window.rd && window.rd.input) window.rd.input(m);
  };
}

function bindControl(video) {
  // Локален зуум/местене на видеото (като YouTube: раздалечаване на два пръста = приближаване).
  let z = 1, tx = 0, ty = 0;
  function applyZoom() { video.style.transformOrigin = '0 0'; video.style.transform = (z > 1 || tx || ty) ? ('translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')') : ''; }
  function clampPan() { const W = video.clientWidth || 1, H = video.clientHeight || 1; tx = Math.min(0, Math.max(-(z - 1) * W, tx)); ty = Math.min(0, Math.max(-(z - 1) * H, ty)); }
  function resetZoom() { z = 1; tx = 0; ty = 0; applyZoom(); }
  video.__rdZoomReset = resetZoom;
  // Клиентска точка → координати на отсрещния екран (отчита локалния зуум: transform-origin 0 0).
  const toHost = (clientX, clientY) => {
    const rect = video.getBoundingClientRect();
    const lx = (clientX - rect.left) / z, ly = (clientY - rect.top) / z;   // точка в НЕзуумнатата кутия
    const boxW = rect.width / z, boxH = rect.height / z;
    const vw = video.videoWidth || boxW, vh = video.videoHeight || boxH;
    const fit = Math.min(boxW / vw, boxH / vh); const dw = vw * fit, dh = vh * fit;
    const ox = (boxW - dw) / 2, oy = (boxH - dh) / 2;
    let x = (lx - ox) / fit, y = (ly - oy) / fit;
    if (hostSize) { x = x * (hostSize.w / vw); y = y * (hostSize.h / vh); }
    return { x, y };
  };
  const send = (o) => ctrl && ctrl.readyState === 'open' && ctrl.send(JSON.stringify(o));
  video.onmousemove = (e) => { const p = toHost(e.clientX, e.clientY); send({ t: 'move', x: p.x, y: p.y }); };
  video.onmousedown = (e) => { e.preventDefault(); const p = toHost(e.clientX, e.clientY); send({ t: 'down', x: p.x, y: p.y, b: e.button }); };
  video.onmouseup = (e) => { e.preventDefault(); const p = toHost(e.clientX, e.clientY); send({ t: 'up', x: p.x, y: p.y, b: e.button }); };
  video.oncontextmenu = (e) => e.preventDefault();
  video.onwheel = (e) => { e.preventDefault(); send({ t: 'wheel', dy: Math.sign(e.deltaY) * 3 }); };
  // ДОПИР (телефон): един пръст = мишка (движение+ляв бутон). ДВА пръста: раздалечаване = зуум,
  // плъзгане при зуум = местене на изгледа, плъзгане без зуум = колелце на отсрещната машина.
  const tHost = (t) => toHost(t.clientX, t.clientY);
  let two = null;
  video.ontouchstart = (e) => {
    setRemoteActive(true); e.preventDefault();
    if (e.touches.length >= 2) {
      const a = e.touches[0], b = e.touches[1];
      two = { dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), z0: z, mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2, tx0: tx, ty0: ty, mode: null, sy: (a.clientY + b.clientY) / 2 };
      const p = tHost(a); send({ t: 'up', x: p.x, y: p.y, b: 0 });   // пусни евентуален задържан ляв бутон
      return;
    }
    two = null;
    const t = e.touches[0]; if (!t) return; const p = tHost(t); send({ t: 'move', x: p.x, y: p.y }); send({ t: 'down', x: p.x, y: p.y, b: 0 });
  };
  video.ontouchmove = (e) => {
    e.preventDefault();
    if (e.touches.length >= 2 && two) {
      const a = e.touches[0], b = e.touches[1];
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
      if (two.mode === null) {
        if (Math.abs(dist - two.dist) > 12) two.mode = 'zoom';
        else if (Math.abs(my - two.sy) > 14) two.mode = 'scroll';
      }
      if (two.mode === 'scroll' && z <= 1) {   // незуумнато → колелце на отсрещната машина
        const dy = two.sy - my; if (Math.abs(dy) > 6) { send({ t: 'wheel', dy: Math.sign(dy) * 3 }); two.sy = my; } return;
      }
      z = Math.min(6, Math.max(1, two.z0 * (dist / two.dist)));
      if (z <= 1.001) { z = 1; tx = 0; ty = 0; } else { tx = two.tx0 + (mx - two.mx); ty = two.ty0 + (my - two.my); clampPan(); }
      applyZoom();
      return;
    }
    const t = e.touches[0]; if (!t) return; const p = tHost(t); send({ t: 'move', x: p.x, y: p.y });
  };
  video.ontouchend = (e) => {
    e.preventDefault();
    if (e.touches.length < 2) two = null;
    const t = e.changedTouches && e.changedTouches[0];
    if (t && e.touches.length === 0) { const p = tHost(t); send({ t: 'up', x: p.x, y: p.y, b: 0 }); }
  };
  video.tabIndex = 0;
  video.onmousedown = ((orig) => (e) => { setRemoteActive(true); try { video.focus(); } catch (_) {} orig(e); })(video.onmousedown);
  setRemoteActive(true);   // при свързване веднага сме „в" екрана → клавиатурата пише на другата машина
}
// Значка над екрана: показва дали клавиатурата в момента пише на другата машина или локално.
function kbBadge(on) {
  const stage = $('stage'); if (!stage) return;
  let b = $('kbbadge');
  if (!b) { b = document.createElement('div'); b.id = 'kbbadge'; stage.appendChild(b); }
  b.style.display = 'block';
  b.className = on ? 'on' : '';
  const L = (window.RDI18N && window.RDI18N.cur) ? window.RDI18N.cur() : 'bg';
  b.textContent = (window.RDI18N) ? window.RDI18N.tr(L, on ? 'kbOn' : 'kbOff') : (on ? '⌨ пишеш на ДРУГАТА машина' : '⌨ щракни екрана, за да пишеш тук');
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
if ($('pullfile')) $('pullfile').onclick = () => { sendCtrl({ t: 'pullFile' }); log('⬇ Поисках файл от отсрещния — избери го в неговия прозорец (през отдалечената мишка).'); };
$('filepick').onchange = async (e) => {
  const f = e.target.files[0]; if (!f || !file || file.readyState !== 'open' || grant !== 'control') return;
  log('↑ изпращам: ' + f.name + ' (' + fmt(f.size) + ')');
  file.send(JSON.stringify({ f: 'meta', name: f.name, size: f.size, mime: f.type }));
  // ПО-БЪРЗО: 64 KB парчета (вместо 16 KB) + изчакване ПО СЪБИТИЕ, не със сън по такт — така не губим
  // по 20 ms на всяко парче и каналът върви с пълна скорост. 64 KB е безопасно навсякъде.
  const buf = await f.arrayBuffer(); const CH = 64 * 1024; const HIGH = 8 * 1024 * 1024;
  file.bufferedAmountLowThreshold = 1 * 1024 * 1024;
  for (let o = 0; o < buf.byteLength; o += CH) {
    if (file.bufferedAmount > HIGH) await new Promise((r) => { file.onbufferedamountlow = () => { file.onbufferedamountlow = null; r(); }; });
    file.send(buf.slice(o, o + CH));
  }
  file.send(JSON.stringify({ f: 'end' }));
  log('✓ изпратено: ' + f.name);
};
const fmt = (n) => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : (n / 1e3).toFixed(0) + ' KB';

function showConnected() { $('connect').style.display = 'none'; $('hang').style.display = 'block'; }
$('hang').onclick = () => { if (secureMode && securePeer) sig(securePeer, { kind: 'secure-bye' }); else if (peer) sig(peer, { kind: 'bye' }); teardown('Прекъсна връзката.'); };
function teardown(msg) {
  try { pc && pc.close(); } catch (_) {}
  try { if (localStream) { localStream.getTracks().forEach((t) => t.stop()); } } catch (_) {}  // спри прихващането → ново свързване после работи
  localStream = null;
  pc = ctrl = file = null; peer = role = grant = null; hostSize = null; rx = null;
  const v = $('screen'); try { v.pause(); } catch (_) {} v.srcObject = null; v.style.display = 'none';
  try { if (v.__rdZoomReset) v.__rdZoomReset(); } catch (_) {}   // нулирай локалния зуум
  try { document.body.classList.remove('kb-open'); } catch (_) {}   // скрий лентата с клавиши
  const si = $('secureImg'); if (si) { si.style.display = 'none'; si.src = ''; }   // изход от „login-екран" режима
  secureMode = false; securePeer = null;
  $('stage').classList.remove('playing'); exitCinema();   // изход от уголемения изглед
  if (window.rd && window.rd.winRestore) { try { window.rd.winRestore(); } catch (_) {} }   // хост: върни прозореца
  remoteActive = false;
  const kb = $('kbbadge'); if (kb) kb.style.display = 'none';
  $('hint').style.display = 'block';
  $('connect').style.display = 'block'; $('connect').disabled = false; $('hang').style.display = 'none'; $('filecard').style.display = 'none';
  if ($('lockRemote')) $('lockRemote').style.display = 'none';
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
const fmtId = (id) => String(id || '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
function connRow(x, where) {
  const d = document.createElement('div'); d.className = 'conn';
  const idspan = document.createElement('span'); idspan.className = 'id';
  idspan.textContent = x.name ? x.name : fmtId(x.id);   // показваме ИМЕТО, ако има (напр. „комп-бг-дом")
  if (x.name) idspan.title = fmtId(x.id);
  d.appendChild(idspan);
  const star = document.createElement('button'); star.className = 'star'; star.textContent = isFav(x.id, x.pass) ? '★' : '☆'; star.title = 'любими'; star.onclick = () => toggleFav(x.id, x.pass); d.appendChild(star);
  // ✎ на ВСЯКА връзка (любими и история): отваря редакция име/номер/парола; при история я прави именувана любима.
  const rn = document.createElement('button'); rn.className = 'star'; rn.textContent = '✎'; rn.title = 'промени име'; rn.onclick = () => openRename(x); d.appendChild(rn);
  const go = document.createElement('button'); go.className = 'go'; go.textContent = 'Свържи'; go.onclick = () => useConn(x.id, x.pass); d.appendChild(go);
  if (where === 'hist') { const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕'; del.title = 'премахни'; del.onclick = () => { setArr(LS.hist, getArr(LS.hist).filter((y) => !(y.id === x.id && y.pass === x.pass))); renderConns(); }; d.appendChild(del); }
  return d;
}
function renderConns() {
  const fav = getArr(LS.fav), hist = getArr(LS.hist);
  const fl = $('favList'); if (fl) { fl.innerHTML = ''; fav.forEach((x) => fl.appendChild(connRow(x, 'fav'))); }
  if ($('favCard')) $('favCard').style.display = 'block';   // винаги видим (за да стигаш бутона „Внеси от файл")
  const hl = $('histList'); if (hl) { hl.innerHTML = ''; hist.forEach((x) => hl.appendChild(connRow(x, 'hist'))); $('histCard').style.display = hist.length ? 'block' : 'none'; }
}
if ($('histClear')) $('histClear').onclick = () => { setArr(LS.hist, []); renderConns(); };

// ── Добавяне/редакция на любима връзка (име + номер + парола) — модал (Electron няма window.prompt) ──
let editTarget = null;   // {id,pass} на оригинала при РЕДАКЦИЯ; null при ДОБАВЯНЕ
function setModal(name, id, pass) { if ($('rnName')) $('rnName').value = name || ''; if ($('rnId')) $('rnId').value = id || ''; if ($('rnPass')) $('rnPass').value = pass || ''; }
function showRename() { const m = $('renameModal'); if (m) m.style.display = 'flex'; setTimeout(() => { if ($('rnName')) $('rnName').focus(); }, 50); }
function openAdd() { editTarget = null; setModal('', '', ''); showRename(); }
function openRename(x) { editTarget = { id: x.id, pass: x.pass }; setModal(x.name || '', x.id || '', x.pass || ''); showRename(); }
function closeRename() { const m = $('renameModal'); if (m) m.style.display = 'none'; editTarget = null; }
function doRename() {
  const name = ($('rnName') ? $('rnName').value : '').trim();
  const id = ($('rnId') ? $('rnId').value : '').replace(/\D/g, '');
  const pass = ($('rnPass') ? $('rnPass').value : '').trim();
  if (id.length < 6) { setStatus('Въведи валиден номер (поне 6 цифри).'); return; }
  let fav = getArr(LS.fav);
  if (editTarget) fav = fav.filter((y) => !(y.id === editTarget.id && y.pass === editTarget.pass));   // махни стария запис
  fav = fav.filter((y) => !(y.id === id && y.pass === pass));                                          // без дубликат
  fav.unshift({ id: id, pass: pass, name: name || '', date: new Date().toISOString() });
  setArr(LS.fav, fav); closeRename(); renderConns();
}
if ($('favAdd')) $('favAdd').onclick = openAdd;
if ($('renameOk')) $('renameOk').onclick = doRename;
if ($('renameCancel')) $('renameCancel').onclick = closeRename;
['rnName', 'rnId', 'rnPass'].forEach((id) => { const el = $(id); if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doRename(); } else if (e.key === 'Escape') closeRename(); }); });

// ── Внасяне/изнасяне на връзки от файл (същия формат като Windows config.json; може и МАСИВ за много връзки) ──
function normalizeConns(data) {
  // ВАЖНО: импортираме САМО СПИСЪК С ВРЪЗКИ (favorites/connections) — НИКОГА собствената самоличност
  // (id/пароли) на приложението-източник. Затова бар конфиг {id, fullPassword, …} НЕ се третира като
  // връзка и НЕ пипа номера на текущото приложение (той се сменя само ръчно в главния конфиг при старт).
  // Връзките може да са в масив, или в полетата favorites/connections/history на целия конфиг —
  // събираме от ВСИЧКИ тях (връзка = чужд номер+парола), но НИКОГА самото top-level id/пароли.
  let arr = [];
  if (Array.isArray(data)) arr = data;
  else if (data && typeof data === 'object') {
    for (const key of ['favorites', 'connections', 'history']) {
      if (Array.isArray(data[key])) arr = arr.concat(data[key]);
    }
  }
  const out = [];
  for (const x of arr) {
    if (!x || typeof x !== 'object') continue;
    const id = String(x.id || '').replace(/\D/g, '');
    const pass = String(x.pass || x.fullPassword || x.viewPassword || '');
    if (id.length < 6) continue;
    if (out.some((y) => y.id === id && y.pass === pass)) continue;   // без дубликати
    out.push({ id, pass, name: x.name || '' });
  }
  return out;
}
function importConns(text) {
  let data; try { data = JSON.parse(text); } catch (_) { setStatus('Файлът не е валиден JSON.'); return; }
  const incoming = normalizeConns(data);
  if (!incoming.length) { setStatus('Във файла няма валидни връзки (трябва номер + парола).'); return; }
  const fav = getArr(LS.fav);
  for (const c of incoming) {
    const ex = fav.find((y) => y.id === c.id && y.pass === c.pass);
    if (ex) { if (c.name) ex.name = c.name; } else fav.unshift({ id: c.id, pass: c.pass, name: c.name || '', date: new Date().toISOString() });
  }
  setArr(LS.fav, fav); renderConns(); setStatus('Внесени ' + incoming.length + ' връзки от файла.');
}
if ($('favImport')) $('favImport').onclick = () => { const f = $('favFile'); if (f) f.click(); };
if ($('favFile')) $('favFile').onchange = (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) { setStatus('Не е избран файл.'); return; }
  setStatus('Чета „' + (file.name || 'файл') + '"…');
  const r = new FileReader();
  r.onerror = () => { setStatus('Грешка при четене на файла.'); e.target.value = ''; };
  r.onload = () => { importConns(String(r.result || '')); e.target.value = ''; };
  try { r.readAsText(file); } catch (_) { setStatus('Файлът не може да се прочете на това устройство.'); }
};
function exportConns() {
  const fav = getArr(LS.fav).map((x) => ({ name: x.name || '', id: x.id, pass: x.pass }));
  const blob = new Blob([JSON.stringify(fav, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pupikes-desk-vръзки.json'; a.click();
  setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (_) {} }, 3000);
}
if ($('favExport')) $('favExport').onclick = exportConns;
renderConns();

// ── Клавиатура (контролер → гост): лови се ГЛОБАЛНО, докато управляваш, за да не зависи от фокуса
//    върху видеото. Писане в НАШИ полета (вход за номер/парола/обратна връзка) остава локално. ──
const MOD_KEYS = { Control: 1, Shift: 1, Alt: 1, Meta: 1, CapsLock: 1, OS: 1, AltGraph: 1, ContextMenu: 1, Dead: 1 };
window.addEventListener('keydown', (e) => {
  // Клавишите отиват към ДРУГАТА машина САМО когато си „влязъл" в екрана ѝ (щракнал си върху него).
  if (!remoteActive || role !== 'controller' || grant !== 'control') return;
  const v = $('screen'); if (!v || v.style.display === 'none') return;
  if (MOD_KEYS[e.key]) { e.preventDefault(); return; }   // сам модификатор — не пращаме нищо
  e.preventDefault();
  const send = (o) => ctrl && ctrl.readyState === 'open' && ctrl.send(JSON.stringify(o));
  // AltGr (Ctrl+Alt на някои подредби) дава печатаем символ → третираме го като ТЕКСТ, не като шорткът.
  const altGr = e.getModifierState && e.getModifierState('AltGraph');
  const hasMod = !altGr && (e.ctrlKey || e.metaKey || e.altKey);
  if (e.key.length === 1 && !hasMod) {
    // Печатаем символ (вкл. КИРИЛИЦА, главни букви, символи; Shift вече е вграден в символа) → Unicode текст.
    send({ t: 'type', text: e.key });
  } else {
    // ВСИЧКО друго — спец-клавиш и/или с модификатор — върви с ВСИЧКИ модификатори (вкл. Shift):
    // Ctrl+C, Ctrl+V, Alt+Tab, Shift+Enter (нов ред вместо submit!), Shift+стрелка, Ctrl+Home, F5…
    send({ t: 'combo', key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey });
  }
});
// Щракане в НАШИЯ интерфейс (извън екрана) или минаване на локален прозорец → спираме препращането (пишеш локално).
document.addEventListener('mousedown', (e) => { if (e.target !== $('screen')) setRemoteActive(false); }, true);
window.addEventListener('blur', () => setRemoteActive(false));
// След минимизиране/скриване Chromium спира декодирането на видеото → при връщане го пускаме пак,
// за да не остане „замръзнало".
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { const v = $('screen'); if (v && v.srcObject) v.play().catch(() => {}); }
});
window.addEventListener('focus', () => { const v = $('screen'); if (v && v.srcObject) v.play().catch(() => {}); });

// Авто-старт при включване на Windows (само .exe; в уеб/мобилно скриваме реда).
if (window.rd && window.rd.autostartGet) {
  window.rd.autostartGet().then((on) => { if ($('autostart')) $('autostart').checked = !!on; }).catch(() => {});
  if ($('autostart')) $('autostart').onchange = () => { window.rd.autostartSet($('autostart').checked); };
} else { const row = $('autostartRow'); if (row) row.style.display = 'none'; }

// ── Услуга за достъп ПРЕДИ login (инсталира се от приложението; иска администратор) ──
(function secureSvcWire() {
  if (!(window.rd && window.rd.secureStatus)) return;
  const row = $('secureRow'), cb = $('secureSvc'), st = $('secureStatus');
  if (!cb) return;
  if (row) row.style.display = 'flex';
  // Обновява САМО отметката; НЕ трие статуса (иначе съобщението за грешка изчезваше веднага).
  function refresh(keepMsg) {
    window.rd.secureStatus().then((s) => {
      cb.checked = !!(s && s.installed);
      if (!keepMsg) { if (s && s.installed) st.textContent = s.running ? 'услугата работи ✓' : 'инсталирана (спряна)'; }
    }).catch(() => {});
  }
  refresh(false);
  setTimeout(() => refresh(false), 1500);   // услугата може да се чете малко след старта/инсталирането
  setTimeout(() => refresh(false), 5000);
  cb.onchange = async () => {
    cb.disabled = true;
    try {
      if (cb.checked) {
        const r = await window.rd.secureInstall();
        if (r && r.needAdmin) { st.textContent = 'нужни са администраторски права — пускам с повишение…'; cb.checked = false; await window.rd.secureElevate(); return; }
        st.textContent = (r && r.ok) ? (r.running ? 'готово — услугата работи ✓' : 'инсталирана, но не тръгна (виж service.log)') : ('✗ ' + ((r && r.error) || 'грешка'));
        if (!(r && r.ok)) cb.checked = false;
      } else {
        const r = await window.rd.secureUninstall();
        if (r && r.needAdmin) { st.textContent = 'нужни са администраторски права — пускам с повишение…'; cb.checked = true; await window.rd.secureElevate(); return; }
        st.textContent = (r && r.ok) ? 'услугата е махната' : 'грешка при махане';
      }
    } catch (e) { st.textContent = '✗ ' + (e && e.message ? e.message : e); } finally { cb.disabled = false; refresh(true); }
  };
})();

// ── Уголемен изглед (кино): целият прозорец = отдалеченият екран; горе само тънка лента с бутон за връщане ──
function enterCinema() { document.body.classList.add('cinema'); const r = $('role'), cr = $('cinemaRole'); if (cr && r) cr.textContent = r.textContent; }
function exitCinema() { document.body.classList.remove('cinema'); }
if ($('cinemaBtn')) $('cinemaBtn').onclick = enterCinema;
if ($('cinemaExit')) $('cinemaExit').onclick = exitCinema;

// изпращане по канала за управление (ползва се и от писането на телефон)
function sendCtrl(o) { try { return ctrl && ctrl.readyState === 'open' && ctrl.send(JSON.stringify(o)); } catch (_) { return false; } }
// ── ТЕЛЕФОН: лента с клавиши (AnyDesk-стил) + системна клавиатура (кирилица/латиница) + диктовка ──
// Системната клавиатура дава БУКВИТЕ (и двете азбуки, през Unicode 'type'); лентата дава специалните
// клавиши (стрелки/Ctrl/Shift/Alt/Esc/Tab/Enter), ЦИФРИ и F-клавиши, които системната няма. Лентата се
// показва/скрива и „върти" редове (↻). В баш: ↑/↓ = история, Ctrl+C и т.н. се интерпретират правилно.
(function mobileKeyboard() {
  const inp = $('mobileInput');
  const VK = { Escape:27, Tab:9, Enter:13, Backspace:8, Delete:46, ArrowLeft:37, ArrowUp:38, ArrowRight:39, ArrowDown:40, Home:36, End:35, PageUp:33, PageDown:34, F1:112,F2:113,F3:114,F4:115,F5:116,F6:117,F7:118,F8:119,F9:120,F10:121,F11:122,F12:123 };
  const mods = { ctrl:false, shift:false, alt:false };
  function clearMods() { mods.ctrl = mods.shift = mods.alt = false; document.querySelectorAll('#keybar .mod').forEach((b) => b.classList.remove('on')); }
  const inSecure = () => (typeof secureMode !== 'undefined' && secureMode && typeof securePeer !== 'undefined' && securePeer);
  // СПЕЦИАЛЕН клавиш (по име като DOM e.key)
  function sendKey(key) {
    if (inSecure()) { if (VK[key] !== undefined) sig(securePeer, { kind:'input', t:'key', vk: VK[key] }); }
    else sendCtrl({ t:'combo', key, ctrl:mods.ctrl, alt:mods.alt, shift:mods.shift, meta:false });
    clearMods();
  }
  // ПЕЧАТАЕМ знак (цифра/символ/буква); с Ctrl/Alt → комбинация (Shift е вграден в самия знак)
  function sendChar(ch) {
    if (inSecure()) sig(securePeer, { kind:'input', t:'type', text: ch });
    else if (mods.ctrl || mods.alt) sendCtrl({ t:'combo', key: ch, ctrl:mods.ctrl, alt:mods.alt, shift:mods.shift, meta:false });
    else sendCtrl({ t:'type', text: ch });
    clearMods();
  }
  const focusKbd = () => { try { inp && inp.focus(); } catch (_) {} };
  // Системната клавиатура (скритото поле): буквите идват тук → към машината знак по знак.
  if (inp) {
    inp.addEventListener('input', (e) => { const t = e.target.value; if (t) { for (const ch of t) sendChar(ch); e.target.value = ''; } });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendKey('Enter'); }
      else if (e.key === 'Backspace' && !e.target.value) { e.preventDefault(); sendKey('Backspace'); }
    });
  }
  const oldBtn = $('mobileType'); if (oldBtn) oldBtn.onclick = () => { document.body.classList.add('kb-open'); focusKbd(); };   // „⌨ Пиши" отваря и лентата, и системната клавиатура

  const bar = $('keybar'); if (!bar) return;
  // pointerdown + preventDefault: клавишът действа веднага И не отнема фокуса от скритото поле, затова
  // системната клавиатура остава отворена, докато ползваш стрелките/модификаторите едновременно.
  const onPress = (el, fn) => { if (!el) return; el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); }); };

  bar.querySelectorAll('.mod').forEach((b) => onPress(b, () => { const m = b.getAttribute('data-mod'); mods[m] = !mods[m]; b.classList.toggle('on', mods[m]); }));
  onPress($('kbKeyboard'), focusKbd);

  // Страници: контроли / цифри / F-клавиши (бутонът ↻ ги върти, като на AnyDesk)
  const PAGES = [
    [ {k:'Escape',l:'Esc'},{k:'Tab',l:'Tab'},{k:'ArrowLeft',l:'←'},{k:'ArrowUp',l:'↑'},{k:'ArrowDown',l:'↓'},{k:'ArrowRight',l:'→'},{k:'Home',l:'Home'},{k:'End',l:'End'},{k:'Delete',l:'Del'},{k:'Backspace',l:'⌫'},{k:'Enter',l:'⏎'} ],
    [ {c:'1'},{c:'2'},{c:'3'},{c:'4'},{c:'5'},{c:'6'},{c:'7'},{c:'8'},{c:'9'},{c:'0'},{c:'-'},{c:'='},{k:'Backspace',l:'⌫'},{k:'Enter',l:'⏎'} ],
    [ {k:'F1',l:'F1'},{k:'F2',l:'F2'},{k:'F3',l:'F3'},{k:'F4',l:'F4'},{k:'F5',l:'F5'},{k:'F6',l:'F6'},{k:'F7',l:'F7'},{k:'F8',l:'F8'},{k:'F9',l:'F9'},{k:'F10',l:'F10'},{k:'F11',l:'F11'},{k:'F12',l:'F12'} ]
  ];
  let page = 0; const pageBox = $('kbPage');
  function renderPage() {
    if (!pageBox) return; pageBox.innerHTML = '';
    for (const key of PAGES[page]) {
      const btn = document.createElement('button');
      if (key.c !== undefined) { btn.textContent = key.c; onPress(btn, () => sendChar(key.c)); }
      else { btn.textContent = key.l; onPress(btn, () => sendKey(key.k)); }
      pageBox.appendChild(btn);
    }
  }
  onPress($('kbRotate'), () => { page = (page + 1) % PAGES.length; renderPage(); });
  renderPage();

  // Показване/скриване на лентата (плаващ бутон ⌨ отваря, ✕ скрива)
  onPress($('keybarToggle'), () => { document.body.classList.add('kb-open'); focusKbd(); });
  onPress($('kbHide'), () => { document.body.classList.remove('kb-open'); clearMods(); try { inp && inp.blur(); } catch (_) {} });

  // Диктовка (глас → текст): праща разпознатото като писане към машината.
  const micBtn = $('kbMic'); let rec = null;
  if (micBtn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) onPress(micBtn, () => setStatus('Това устройство няма гласово разпознаване.'));
    else onPress(micBtn, () => {
      if (rec) { try { rec.stop(); } catch (_) {} return; }
      rec = new SR();
      try { rec.lang = (typeof RDI18N !== 'undefined' && RDI18N.pick && /^bg/.test(RDI18N.pick())) ? 'bg-BG' : (navigator.language || 'bg-BG'); } catch (_) { rec.lang = 'bg-BG'; }
      rec.interimResults = false; rec.continuous = false;
      rec.onresult = (ev) => { let txt = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) txt += ev.results[i][0].transcript; txt = txt.trim(); if (txt) for (const ch of txt) sendChar(ch); };
      rec.onerror = (ev) => setStatus('Диктовка: ' + (ev && ev.error ? ev.error : 'грешка'));
      rec.onend = () => { micBtn.classList.remove('rec'); rec = null; };
      micBtn.classList.add('rec'); setStatus('Слушам… говори.');
      try { rec.start(); } catch (_) { micBtn.classList.remove('rec'); rec = null; }
    });
  }
})();

// ── QR за връзка: твоят номер + парола за ПЪЛЕН достъп (на нов ред) → другото устройство го сканира ──
function showMyQr() {
  const box = $('myQr'); if (!box || !window.PSQR) return;
  // Формат: ред1 = номер, ред2 = парола за ПЪЛЕН достъп, ред3 = парола за НАБЛЮДЕНИЕ.
  // При сканиране другото устройство има и двете и човекът избира как да се върже.
  const data = myId + '\n' + fullPass + '\n' + viewPass;
  // МАЛКО иконче (пести място в главния прозорец); клик → уголемяване в модал, за да се разчете/сканира.
  // тиха зона 4 модула (стандарт) + ЧИСТО ЧЕРНО → сканира се надеждно
  try { box.innerHTML = window.PSQR.svg(data, { ecl: 'M', scale: 3, border: 4, light: '#ffffff', dark: '#000000' }); } catch (_) {}
  box.onclick = () => openQrBig(data);
}
function openQrBig(data) {
  const m = $('qrModal'), big = $('qrBig'); if (!m || !big || !window.PSQR) return;
  // ECC = Q (повече корекция, по-лесно хващане от скенер) + тиха зона 4 + чисто черно
  try { big.innerHTML = window.PSQR.svg(data, { ecl: 'Q', scale: 9, border: 4, light: '#ffffff', dark: '#000000' }); } catch (_) {}
  m.style.display = 'flex';
}
// клик някъде в модала го затваря
(function () { const m = $('qrModal'); if (m) m.onclick = () => { m.style.display = 'none'; }; })();
// ── Скенер: сканираш чужд QR → попълва номер+парола и се свързва за секунда ──
let scanStream = null, scanRAF = null, scanCanvas = null, scanCtx = null;
async function startScan() {
  const hasJsQR = (typeof window.jsQR === 'function'), hasBD = ('BarcodeDetector' in window);
  if (!hasJsQR && !hasBD) { setStatus('Скенерът не се поддържа тук — въведи номер и парола ръчно.'); return; }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    const v = $('scanVid'); v.srcObject = scanStream; v.setAttribute('playsinline', ''); v.muted = true; await v.play();
    $('scanWrap').classList.remove('hidden'); setStatus('насочи камерата към QR кода…');
    if (!scanCanvas) { scanCanvas = document.createElement('canvas'); scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true }); }
    let bd = null; if (hasBD) { try { bd = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) {} }
    let bdBusy = false, frames = 0;
    const tick = () => {                         // СИНХРОНЕН — BarcodeDetector НЕ блокира jsQR
      if (!scanStream) return;
      const vw = v.videoWidth, vh = v.videoHeight;
      if (vw && vh) {
        frames++;
        // jsQR ПРЪВ (вграден, детерминиран). Таван 1280px.
        if (hasJsQR) {
          try {
            const maxW = 1280, sc = vw > maxW ? maxW / vw : 1, cw = Math.round(vw * sc), ch = Math.round(vh * sc);
            scanCanvas.width = cw; scanCanvas.height = ch;
            scanCtx.drawImage(v, 0, 0, cw, ch);
            const img = scanCtx.getImageData(0, 0, cw, ch);
            // яркост (извадка) — ако е ~0, canvas-ът лови ЧЕРЕН кадър (беля на WebView), не е проблем в jsQR
            let s = 0, n = 0; for (let i = 0; i < img.data.length; i += 4000) { s += img.data[i]; n++; }
            const avg = n ? Math.round(s / n) : 0;
            const res = window.jsQR(img.data, cw, ch, { inversionAttempts: 'attemptBoth' });
            if (res && res.data) { onScanned(res.data); return; }
            if ((frames % 8) === 1) setStatus('скенер: кадър ' + cw + '×' + ch + ' · яркост ' + avg + (avg < 8 ? ' (ЧЕРНО!)' : '') + ' · търся QR…');
          } catch (e) { if ((frames % 8) === 1) setStatus('скенер грешка: ' + (e && e.message || e)); }
        } else if ((frames % 8) === 1) { setStatus('jsQR не е зареден'); }
        // native детектор — ВТОРИ, неблокиращ (ако jsQR не хване)
        if (bd && !bdBusy) { bdBusy = true; bd.detect(v).then((codes) => { bdBusy = false; if (codes && codes.length && scanStream) onScanned(codes[0].rawValue); }).catch(() => { bdBusy = false; }); }
      }
      scanRAF = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) { setStatus('Няма достъп до камерата: ' + (e && e.message || e)); stopScan(); }
}
function stopScan() {
  if (scanRAF) cancelAnimationFrame(scanRAF); scanRAF = null;
  try { if (scanStream) scanStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
  scanStream = null; const w = $('scanWrap'); if (w) w.classList.add('hidden');
  const v = $('scanVid'); if (v) { try { v.pause(); } catch (_) {} v.srcObject = null; }
}
let scannedFull = '', scannedView = '';
function onScanned(raw) {
  stopScan();
  const parts = String(raw || '').split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
  const id = (parts[0] || '').replace(/\D/g, ''); scannedFull = parts[1] || ''; scannedView = parts[2] || '';
  if (id.length < 6) { setStatus('QR кодът не съдържа валидни данни за връзка.'); return; }
  $('peerid').value = id;
  if (scannedFull && scannedView) {
    // има и двете пароли → човекът избира достъпа
    $('scanChoice').classList.remove('hidden');
    setStatus('Сканирано: номер ' + id.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') + ' — избери как да се свържеш.');
  } else {
    $('peerpass').value = scannedFull || scannedView || '';   // само една парола → направо
    $('connect').click();
  }
}
// „Пълен достъп" / „Само гледане" се показват САМО след сканиране на QR с двете пароли; попълват съответната
// сканирана парола и свързват. Ако няма сканирана парола (напр. бутонът е натиснат без ново сканиране) —
// НЕ трием вече въведената парола, а ползваме нея.
function connectWith(pass) { $('scanChoice').classList.add('hidden'); if (pass) $('peerpass').value = pass; $('connect').click(); }
if ($('connFull')) $('connFull').onclick = () => connectWith(scannedFull);
if ($('connView')) $('connView').onclick = () => connectWith(scannedView);
if ($('scanConnect')) $('scanConnect').onclick = () => { $('scanChoice').classList.add('hidden'); if (scanStream) stopScan(); else startScan(); };
if ($('scanStop')) $('scanStop').onclick = stopScan;
showMyQr();

connectSignal();
// Заключване/отключване на екрана → пусни/върни номера, за да поеме/освободи нативната услуга (достъп преди login).
if (window.rd && window.rd.onPower) {
  window.rd.onPower((s) => {
    if (s === 'lock') { lockReleased = true; try { if (ws) ws.close(); } catch (_) {} }
    else { lockReleased = false; connectSignal(); }
  });
}
checkLicense();
