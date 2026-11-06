'use strict';
// PupikesSendTo — трансфер на файлове между 2 устройства по 6-цифрен код.
// Подателят генерира код и чака; получателят въвежда кода. Файлът върви директно P2P (WebRTC data channel).
// Сигнализацията е през сървъра (ws); при мобилния пакет SERVER сочи към нашия сървър.

const $ = (id) => document.getElementById(id);
const SERVER = window.PUPIKES_SERVER || '';   // ако е зададен (config.js) → има предимство
const PUBLIC_DEFAULT = 'wss://take.offbitch.com/sendto/';  // за мобилния APK / локален файл
const wsURL = () => {
  if (SERVER) return SERVER.replace(/^http/, 'ws');
  // Истински уеб от домейн (не localhost) → ползвай адреса на страницата (пази под-пътя /sendto/ зад nginx).
  const isWeb = (location.protocol === 'http:' || location.protocol === 'https:')
    && !/^(localhost|127\.|10\.|192\.168\.)/.test(location.hostname);
  if (isWeb) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const base = location.pathname.replace(/[^/]*$/, '');
    return proto + '://' + location.host + base;
  }
  return PUBLIC_DEFAULT;  // Capacitor/мобилно/файл → нашия публичен сървър (за да се намерят 2 устройства)
};
const rnd6 = () => String(Math.floor(100000 + Math.random() * 900000));
const rndId = () => 'r' + Math.random().toString(36).slice(2, 10);
// STUN (намиране на публичния адрес) + TURN (резервен релей при строг NAT, когато пряката P2P
// връзка не стане). Директната връзка се ползва винаги, когато е възможна; TURN е само резерва.
// НАШИЯТ TURN (coturn на сървъра, точка 89) е основната резерва; публичният openrelay е втора резерва.
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
let pendingIce = [];   // ICE кандидати, пристигнали преди да е зададено remoteDescription — буферираме и ги добавяме после
async function flushIce() { if (!pc) return; for (const c of pendingIce.splice(0)) { try { await pc.addIceCandidate(c); } catch (_) {} } }

// ── ДИАГНОСТИКА: броим какви ICE кандидати сме събрали, за да знаем къде се къса връзката ──
let diag = { host: 0, srflx: 0, relay: 0 };
function countCand(cand) {
  if (!cand) return;
  const s = (cand.candidate || '');
  if (/ typ host/.test(s)) diag.host++;
  else if (/ typ srflx/.test(s)) diag.srflx++;   // STUN проработи (виждаме публичния си адрес)
  else if (/ typ relay/.test(s)) diag.relay++;    // TURN проработи (има релеен кандидат)
}
function diagText() {
  const st = pc ? pc.iceConnectionState : 'няма';
  const turn = diag.relay > 0 ? 'TURN:да' : 'TURN:НЕ';
  const stun = diag.srflx > 0 ? 'STUN:да' : 'STUN:НЕ';
  return ` [състояние=${st} · кандидати host=${diag.host} ${stun} ${turn}]`;
}
function wirePc() {   // закача диагностика + okWatch при успех
  if (!pc) return;
  pc.oniceconnectionstatechange = () => {
    const st = pc.iceConnectionState;
    if (st === 'connected' || st === 'completed') okWatch();
    if (st === 'failed') setStatus('Връзката се провали (NAT/защитна стена).' + diagText(), mode === 'send' ? 's' : 'r');
  };
}
const fmt = (n) => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : (n / 1e3).toFixed(0) + ' KB';

let ws = null, myId = null, pc = null, chan = null, peer = null, mode = null;
let fileToSend = null, pendingReadyFrom = null;

// „Пазач": ако за 15с не се осъществи връзка, казваме го ясно (вместо да виси тихо).
let watchTimer = null;
const armWatch = (which) => { clearTimeout(watchTimer); watchTimer = setTimeout(() => {
  if (!pc || (pc.connectionState !== 'connected' && pc.iceConnectionState !== 'connected')) {
    setStatus('Връзката не се осъществи. Провери кода и опитай пак.' + diagText(), which);
  }
}, 15000); };
const okWatch = () => clearTimeout(watchTimer);

function connect(onOpen) {
  ws = new WebSocket(wsURL());
  ws.onopen = () => onOpen && onOpen();
  ws.onclose = () => {};
  ws.onmessage = async (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } await onMsg(m); };
}
const sig = (to, data) => ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'signal', to, data }));
const hello = (id) => { myId = id; ws.send(JSON.stringify({ type: 'hello', id })); };

async function onMsg(m) {
  if (m.type === 'error') {
    const MAP = {
      'peer-offline': 'Няма активен подател с този код. Провери кода или натисни „Изпрати" пак на другото устройство.',
      'code-not-found': 'Няма такъв код (или подателят е офлайн).',
      'id-taken': 'Този код е зает в момента — опитай пак.',
      'pair-busy': 'Това плащане се ползва от друга двойка устройства в момента. Едно плащане = една активна двойка за 1 час. Опитай отново по-късно' + (m.mins ? ' (след ~' + m.mins + ' мин.).' : '.'),
      'license-used-elsewhere': 'Тази транзакция се ползва от друго устройство в момента.'
    };
    setStatus(MAP[m.error] || ('Грешка: ' + m.error), mode === 'send' ? 's' : 'r');
    return;
  }
  if (m.type !== 'signal') return;
  const from = m.from, d = m.data;
  if (d.kind === 'ready') {                       // ПОДАТЕЛ: получателят е готов → прави offer
    peer = from; await makeOfferAndSend();
  } else if (d.kind === 'offer') {                // ПОЛУЧАТЕЛ: приеми, отговори
    peer = from; await acceptOffer(d.sdp);
  } else if (d.kind === 'answer') {
    await pc.setRemoteDescription(d.sdp);
    await flushIce();
  } else if (d.kind === 'ice') {
    if (pc && pc.remoteDescription && pc.remoteDescription.type) { try { await pc.addIceCandidate(d.candidate); } catch (_) {} }
    else pendingIce.push(d.candidate);   // още няма remoteDescription → буферирай
  }
}

// ── ПОДАТЕЛ ──
function startSend(file) {
  fileToSend = file; mode = 'send'; pendingIce = []; pc = null; diag = { host: 0, srflx: 0, relay: 0 };
  const code = rnd6();
  resetCodeDisplay();
  $('myCode').textContent = code;   // чисти 6 цифри; визуалните разстояния идват от CSS (letter-spacing),
                                    // за да се копира безпроблемно „123456" без интервали
  $('codeCard').classList.remove('hidden');
  showQR(code);                     // QR до кода — другото устройство може да го сканира
  setStatus('чакам получател…', 's');
  connect(() => hello(code));
}
async function makeOfferAndSend() {
  pc = new RTCPeerConnection(ICE); wirePc();
  pc.onicecandidate = (ev) => { if (ev.candidate) { countCand(ev.candidate); sig(peer, { kind: 'ice', candidate: ev.candidate }); } };
  chan = pc.createDataChannel('file'); chan.binaryType = 'arraybuffer';
  chan.onopen = () => { okWatch(); sendFile(); };
  // получателят праща потвърждение, че е свалил файла → скриваме цифрите/QR и пишем „успешно"
  chan.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m && m.f === 'done') showSuccess('s'); } catch (_) {} };
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  sig(peer, { kind: 'offer', sdp: offer });
  setStatus('свързвам се…', 's');
  armWatch('s');
}
async function sendFile() {
  const f = fileToSend; setStatus('изпращам ' + f.name + ' (' + fmt(f.size) + ')…', 's'); showBar('s');
  chan.send(JSON.stringify({ f: 'meta', name: f.name, size: f.size, mime: f.type }));
  const buf = await f.arrayBuffer();
  // ПО-БЪРЗО: едри парчета по 64 KB (вместо 16 KB) → 4× по-малко служебни пакети, без да чупим стари
  // WebRTC реализации (64 KB е гарантирано безопасната горна граница навсякъде, вкл. Android WebView).
  const CH = 64 * 1024;
  const HIGH = 8 * 1024 * 1024;              // пълним буфера до 8 MB преди да спрем
  chan.bufferedAmountLowThreshold = 1 * 1024 * 1024;   // продължаваме щом падне под 1 MB
  let sent = 0;
  for (let o = 0; o < buf.byteLength; o += CH) {
    // Изчакваме ПО СЪБИТИЕ (onbufferedamountlow), не със сън по 15 ms — така тръгваме веднага щом
    // има място, без да губим по такт на всяко парче. Това е същинското ускорение.
    if (chan.bufferedAmount > HIGH) {
      await new Promise((r) => { chan.onbufferedamountlow = () => { chan.onbufferedamountlow = null; r(); }; });
    }
    chan.send(buf.slice(o, o + CH)); sent += Math.min(CH, buf.byteLength - o); setBar('s', sent / buf.byteLength);
  }
  chan.send(JSON.stringify({ f: 'end' }));
  setStatus('✓ изпратено: ' + f.name, 's');
}

// ── ПОЛУЧАТЕЛ ──
function startRecv(code) {
  mode = 'recv'; pendingIce = []; pc = null; diag = { host: 0, srflx: 0, relay: 0 };
  connect(() => { hello(rndId()); setTimeout(() => sig(code, { kind: 'ready' }), 300); });
  setStatus('свързвам се с ' + code + '…', 'r');
  armWatch('r');
}
let rx = null;
async function acceptOffer(sdp) {
  pc = new RTCPeerConnection(ICE); wirePc();
  pc.onicecandidate = (ev) => { if (ev.candidate) { countCand(ev.candidate); sig(peer, { kind: 'ice', candidate: ev.candidate }); } };
  pc.ondatachannel = (ev) => {
    const ch = ev.channel; chan = ch; ch.binaryType = 'arraybuffer';
    ch.onopen = () => okWatch();
    ch.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const m = JSON.parse(e.data);
        if (m.f === 'meta') { rx = { name: m.name, mime: m.mime, size: m.size, parts: [], got: 0 }; setStatus('получавам ' + m.name + ' (' + fmt(m.size) + ')…', 'r'); showBar('r'); }
        else if (m.f === 'end' && rx) { finishRecv(); }
      } else if (rx) { rx.parts.push(e.data); rx.got += e.data.byteLength; if (rx.size) setBar('r', rx.got / rx.size); }
    };
  };
  await pc.setRemoteDescription(sdp);
  await flushIce();
  const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
  sig(peer, { kind: 'answer', sdp: ans });
}
function finishRecv() {
  const blob = new Blob(rx.parts, { type: rx.mime || 'application/octet-stream' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = rx.name; document.body.appendChild(a); a.click(); a.remove();
  // Браузърът не издава абсолютния път; затова казваме ясно КЪДЕ се е запазил по подразбиране.
  const isWin = /Windows/i.test(navigator.userAgent), isAndroid = /Android/i.test(navigator.userAgent), isMac = /Macintosh|Mac OS/i.test(navigator.userAgent);
  let where;
  if (isAndroid) where = 'папката „Download" на телефона (Files → Download → ' + rx.name + ')';
  else if (isWin) where = 'C:\\Users\\<твоето име>\\Downloads\\' + rx.name + '  (папка „Изтегляния")';
  else if (isMac) where = '/Users/<твоето име>/Downloads/' + rx.name;
  else where = 'папката „Изтегляния" / Downloads · ' + rx.name;
  setStatus('✓ Успешно! Получено и запазено: ' + rx.name + '\nНамира се в: ' + where, 'r');
  try { if (chan && chan.readyState === 'open') chan.send(JSON.stringify({ f: 'done' })); } catch (_) {}  // потвърди на подателя
  try { $('codeIn').value = ''; } catch (_) {}   // цифрите изчезват след успех
  rx = null;
}

// ── интерфейс ──
const setStatus = (t, which) => { $(which === 'r' ? 'rStatus' : 'sStatus').textContent = t; };
const showBar = (w) => { $(w === 'r' ? 'rBar' : 'sBar').style.display = 'block'; };
const setBar = (w, frac) => { $((w === 'r' ? 'rBar' : 'sBar')).firstElementChild.style.width = Math.round(frac * 100) + '%'; };

$('tabSend').onclick = () => { try { stopScan(); } catch (_) {} $('tabSend').classList.add('on'); $('tabRecv').classList.remove('on'); $('send').classList.remove('hidden'); $('recv').classList.add('hidden'); };
$('tabRecv').onclick = () => { $('tabRecv').classList.add('on'); $('tabSend').classList.remove('on'); $('recv').classList.remove('hidden'); $('send').classList.add('hidden'); };
$('drop').onclick = () => $('filepick').click();
$('drop').ondragover = (e) => { e.preventDefault(); $('drop').classList.add('has'); };
$('drop').ondrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pickFile(f); };
$('filepick').onchange = (e) => { const f = e.target.files[0]; if (f) pickFile(f); };
function pickFile(f) { $('drop').classList.add('has'); $('drop').innerHTML = f.name + '<br><small>' + fmt(f.size) + '</small>'; startSend(f); }
// Полето за код: чисти всичко освен цифри (вкл. интервали при пействане) и държи най-много 6.
$('codeIn').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
$('recvGo').onclick = () => { const c = $('codeIn').value.replace(/\D/g, ''); if (c.length !== 6) { setStatus('Въведи 6 цифри.', 'r'); return; } startRecv(c); };

// ── Връзка/проблем: прати описанието към сървъра (записва се за собственика) ──
// HTTP базата идва от същия адрес като ws (под-път /sendto/ зад nginx), или от нашия публичен сървър за мобилния пакет.
function httpBase() { return wsURL().replace(/^ws/, 'http'); }
const CONTACT_FALLBACK = 'kalaydzhievvaleri@gmail.com';
fetch(httpBase() + 'api/status').then((r) => r.json()).then((s) => { if (s && s.contact) $('fbContact').textContent = s.contact; }).catch(() => {});
$('fbSend').onclick = async () => {
  const message = $('fbMsg').value.trim();
  if (!message) { $('fbStatus').textContent = 'Опиши проблема, за да го изпратиш.'; return; }
  $('fbStatus').textContent = 'Изпращам…';
  try {
    const r = await fetch(httpBase() + 'api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, email: $('fbEmail').value.trim() }) });
    const d = await r.json();
    if (d.ok) { $('fbStatus').textContent = '✓ Благодарим! Съобщението е изпратено.'; $('fbMsg').value = ''; }
    else $('fbStatus').textContent = '✗ ' + (d.error || 'грешка');
  } catch (_) { $('fbStatus').textContent = '✗ Няма връзка със сървъра — пиши ни на ' + ($('fbContact').textContent || CONTACT_FALLBACK); }
};

// ── Безплатен достъп със специален код (owner) — винаги достъпно, не само на заключващия екран ──
$('openCode').onclick = () => { $('codeBox').classList.toggle('hidden'); if (!$('codeBox').classList.contains('hidden')) $('freeCode').focus(); };
$('redeemFree').onclick = async () => {
  const code = $('freeCode').value.trim();
  if (!code) { $('codeStatus').textContent = 'Въведи кода.'; return; }
  $('codeStatus').textContent = 'Проверявам…';
  try {
    const r = await fetch(httpBase() + 'api/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const d = await r.json();
    if (d.ok) { $('codeStatus').textContent = '✓ Отключено! Достъпът е безплатен на това устройство.'; }
    else $('codeStatus').textContent = '✗ ' + (d.error === 'грешен код' ? 'Грешен код.' : (d.error || 'грешка'));
  } catch (_) { $('codeStatus').textContent = '✗ Няма връзка със сървъра.'; }
};

// ── QR до кода (изпращане) + скенер (получаване) + авто-код от URL ──
// Адресът на самата страница (за URL в QR-а): при уеб — текущият адрес; при APK/файл — публичната страница.
function pageBase() {
  const isWeb = (location.protocol === 'http:' || location.protocol === 'https:')
    && !/^(localhost|127\.|10\.|192\.168\.)/.test(location.hostname);
  if (isWeb) return location.origin + location.pathname.replace(/[^/]*$/, '');
  return 'https://take.offbitch.com/sendto/';
}
function showQR(code) {
  const box = $('qrBox'); if (!box) return;
  try {
    const url = pageBase() + '?code=' + code;
    box.innerHTML = (window.PSQR) ? window.PSQR.svg(url, { ecl: 'M', scale: 5, border: 2, light: '#ffffff', dark: '#0b0f14' }) : '';
    const on = !!box.innerHTML; box.style.display = on ? 'flex' : 'none';
    const hint = $('qrHint'); if (hint) hint.style.display = on ? 'block' : 'none';
  } catch (_) { box.style.display = 'none'; }
}
function hideQR() { const b = $('qrBox'); if (b) { b.style.display = 'none'; b.innerHTML = ''; } const h = $('qrHint'); if (h) h.style.display = 'none'; }
function resetCodeDisplay() { const c = $('myCode'); if (c) { c.style.color = ''; c.style.fontSize = ''; c.style.letterSpacing = ''; } }
// при успех: цифрите изчезват, на тяхно място — „✓ успешно"
function showSuccess(which) {
  if (which === 's') {
    hideQR();
    const c = $('myCode'); if (c) { c.textContent = '✓ успешно'; c.style.color = 'var(--ok)'; c.style.fontSize = '30px'; c.style.letterSpacing = 'normal'; }
    setStatus('Файлът е изпратен и получен успешно.', 's');
  }
}

// QR скенер (получаване) — през вградения BarcodeDetector (Android WebView/Chrome); иначе остава ръчно въвеждане.
let scanStream = null, scanRAF = null, scanCanvas = null, scanCtx = null;
async function startScan() {
  const hasJsQR = (typeof window.jsQR === 'function');     // надежден декодер през canvas пиксели
  const hasBD = ('BarcodeDetector' in window);
  if (!hasJsQR && !hasBD) { setStatus('Скенерът не се поддържа на това устройство — въведи кода ръчно.', 'r'); return; }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const v = $('scanVid'); v.srcObject = scanStream; v.setAttribute('playsinline', ''); v.muted = true; await v.play();
    $('scanWrap').classList.remove('hidden');
    setStatus('насочи камерата към QR кода…', 'r');
    if (!scanCanvas) { scanCanvas = document.createElement('canvas'); scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true }); }
    let bd = null; if (hasBD) { try { bd = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) {} }
    const tick = async () => {
      if (!scanStream) return;
      const vw = v.videoWidth, vh = v.videoHeight;
      if (vw && vh) {
        if (hasJsQR) {   // ОСНОВЕН път: рисуваме кадъра на canvas и декодираме пикселите (работи на всеки WebView)
          try {
            scanCanvas.width = vw; scanCanvas.height = vh;
            scanCtx.drawImage(v, 0, 0, vw, vh);
            const img = scanCtx.getImageData(0, 0, vw, vh);
            const res = window.jsQR(img.data, vw, vh, { inversionAttempts: 'attemptBoth' });
            if (res && res.data) { onScanned(res.data); return; }
          } catch (_) {}
        }
        if (bd) {   // втори опит: вграденият BarcodeDetector (ако работи на устройството)
          try { const codes = await bd.detect(v); if (codes && codes.length) { onScanned(codes[0].rawValue); return; } } catch (_) {}
        }
      }
      scanRAF = requestAnimationFrame(tick);
    };
    tick();
  } catch (_) { setStatus('Няма достъп до камерата.', 'r'); stopScan(); }
}
function stopScan() {
  if (scanRAF) cancelAnimationFrame(scanRAF); scanRAF = null;
  try { if (scanStream) scanStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
  scanStream = null;
  const w = $('scanWrap'); if (w) w.classList.add('hidden');
  const v = $('scanVid'); if (v) { try { v.pause(); } catch (_) {} v.srcObject = null; }
}
function extractCode(raw) { const m = String(raw || '').match(/\d{6}/); return m ? m[0] : ''; }
function onScanned(raw) {
  const code = extractCode(raw); stopScan();
  if (code) { $('codeIn').value = code; startRecv(code); }
  else setStatus('QR кодът не съдържа валиден 6-цифрен код.', 'r');
}
if ($('scanBtn')) $('scanBtn').onclick = () => { if (scanStream) stopScan(); else startScan(); };
if ($('scanStop')) $('scanStop').onclick = stopScan;

// авто-код от URL (?code=123456): при сканиране браузърът отваря страницата с кода → отиваме на „Получи" и се свързваме
(function autoCodeFromUrl() {
  try {
    const c = (new URLSearchParams(location.search).get('code') || '').replace(/\D/g, '').slice(0, 6);
    if (c.length === 6) { $('tabRecv').click(); $('codeIn').value = c; setStatus('код от QR: ' + c + ' — свързвам се…', 'r'); setTimeout(() => startRecv(c), 400); }
  } catch (_) {}
})();

// ── САМО ДЕСКТОП (Windows приложение): настройка „Пускане след стартиране на Windows" ──
// window.pupikesDesktop идва от preload-а на Electron; в уеб/телефон го няма → картата остава скрита.
(function desktopSettings() {
  if (!window.pupikesDesktop) return;
  const card = $('desktopCard'); if (card) card.classList.remove('hidden');
  const cb = $('autostart'); if (!cb) return;
  window.pupikesDesktop.autostartGet().then((on) => { cb.checked = !!on; }).catch(() => {});
  cb.onchange = () => {
    cb.disabled = true;
    window.pupikesDesktop.autostartSet(cb.checked)
      .then((real) => { cb.checked = !!real; })
      .catch(() => {})
      .then(() => { cb.disabled = false; });
  };
})();
