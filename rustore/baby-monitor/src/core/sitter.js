// Version: 1.0027
// sitter.js — „BabySecuritySitter": двигателят на телефона ПРИ ДЕТЕТО (дете до 3 години).
//
//   1) Сценарий „приспиване": песен → тихи фрази с гласа на мама/тати (записи) → шум,
//      със силата, която плавно намалява (volStart → volEnd), докато детето заспи.
//   2) НАБЛЮДЕНИЕ на съня през микрофона: тихо / хленчи / плаче / дълга тишина.
//      При плач — ВЕДНАГА: реакция тук (фраза или песен) + сигнал към телефона на родителя
//      (+ снимка от камерата, ако е позволено).
//   3) Обратен канал: телефонът на родителя праща команди („пусни фраза", песен, шум, снимка,
//      сценарий отначало, стоп) — тук се изпълняват.
//   4) Пулс на състоянието към родителя на всеки 10 с (спи/буди се/плаче/тихо от X мин + фаза).
//
// Всичко работи на устройството; през релея минават само кратки съобщения и малка снимка.
// Модулът е на ниво приложение — продължава при смяна на екрана; екранът само го показва.

import { getSitter, getState, addEvent } from './storage.js';
import { startMeter, stopMeter, micSupported } from './noise-meter.js';
import { playSound, stopSound, setVolume, fadeVolume, SONG_KINDS, NOISE_KINDS } from './sounds.js';
import { playPhrase, stopPhrase } from './phrases.js';
import { sendAlert, sendFrame, pollCommands, getPairing, pairingConfigured } from './pairing.js';
import { startDeviceCamera, stopCamera, grabFrame, snapshotDataUrl, cameraSupported } from './camera.js';
import { t } from './i18n.js';

const APP = 'babysitter';
const STATUS_EVERY_MS = 10000;   // пулс към родителя
const CATALOG_EVERY_MS = 60000;  // списък на фразите към родителя (за бутоните „Говори")
const CALM_AFTER_MS = 20000;     // толкова тишина след плач/хленч = „отново тихо"
const FUSS_LOG_GAP_MS = 120000;  // хленч се записва най-много веднъж на 2 мин

// Състояние, което екранът чете.
const S = {
  running: false,
  phase: 'idle',        // 'idle' | 'lull' (приспиване) | 'watch' (наблюдава съня)
  step: null,           // 'song' | 'phrases' | 'noise' | null
  stepEndsAt: 0,        // кога свършва текущата стъпка (ms)
  stepInfo: '',         // напр. „2/3" кръг на фразите
  status: 'quiet',      // 'quiet' | 'fuss' | 'cry'
  level: 0,             // последно ниво на шума 0..100
  lastNoiseAt: 0,       // последен звук над „тихо"
  startedAt: 0,
  lastReactAt: 0,
  cries: 0,             // брой плачове тази нощ
  micOk: null,          // null (не е стартиран) | true | false
  micReason: '',
  relayOk: null,        // последна връзка с релея (null = не е сдвоен)
  lastCmd: ''           // последна изпълнена команда (за екрана)
};

let _listeners = [];
let _seq = 0;            // номер на сесията — старите обещания се отказват при стоп/рестарт
let _waiters = [];       // активни изчаквания (за да ги прекъснем)
let _statusTimer = null;
let _catalogTimer = null;
let _cmdTimer = null;
let _loudSince = 0;      // откога нивото е над прага на плача
let _fussSince = 0;      // откога е над прага на хленча
let _lastFussLogAt = 0;
let _silenceSent = false;
let _dim = null;         // елементът на затъмнения екран
let _wakeLock = null;

export function sitterState() { return S; }
export function sitterRunning() { return S.running; }

// Слушатели за промяна (екранът се обновява).
export function onSitterChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((f) => f !== fn); };
}
function emit() {
  if (_dim) _dim.txt.textContent = describe();
  for (const f of _listeners) { try { f(S); } catch (_) {} }
}

// Кратко описание на състоянието за екрана/затъмнения екран: „😴 Тихо · приспиване: песен".
export function describe() {
  const icon = S.status === 'cry' ? '😭' : S.status === 'fuss' ? '😟' : '😴';
  let phase = t('st_phase_' + S.phase);
  if (S.step) phase += ': ' + t('step_' + S.step) + (S.stepInfo ? ' ' + S.stepInfo : '');
  return icon + ' ' + t('st_' + S.status) + ' · ' + phase;
}

// Изчакване, което се прекъсва при stop()/рестарт.
function wait(ms) {
  return new Promise((resolve) => {
    const w = { resolve, id: setTimeout(() => { _waiters = _waiters.filter((x) => x !== w); resolve(); }, ms) };
    _waiters.push(w);
  });
}
function cancelWaits() {
  for (const w of _waiters) { clearTimeout(w.id); try { w.resolve(); } catch (_) {} }
  _waiters = [];
}

// Фразите по избрания ред (празен ред = всички по ред на запис).
export function orderedPhrases() {
  const st = getSitter();
  const order = st.scenario.phraseOrder || [];
  if (!order.length) return st.phrases.slice();
  const byId = new Map(st.phrases.map((p) => [p.id, p]));
  return order.map((id) => byId.get(id)).filter(Boolean);
}

// Фраза за реакция при плач: „мама е тук" → „спи, миличко" → „всичко е наред" → друга.
function reactionPhrase() {
  const ph = getSitter().phrases;
  for (const slot of ['here', 'sleep', 'ok', 'custom']) { const p = ph.find((x) => x.slot === slot); if (p) return p; }
  return ph[0] || null;
}

function log(type, label) {
  try { addEvent({ type, label, snapshot: null }); } catch (_) {}
}
function send(type, label) {
  if (!pairingConfigured()) return;
  sendAlert(APP, type, label).then((r) => { S.relayOk = !!r.ok; }).catch(() => { S.relayOk = false; });
}

// ---------------------------------------------------------------- сценарий „приспиване"
async function runScenario(seq) {
  const sc = getSitter().scenario;
  const vS = sc.volStart / 100, vE = sc.volEnd / 100, vMid = vS - (vS - vE) * 0.5;
  S.phase = 'lull'; emit();

  // 1) Песен — от volStart към средата.
  if (sc.song !== 'none' && SONG_KINDS.includes(sc.song) && sc.songMin > 0) {
    const sec = sc.songMin * 60;
    setStep('song', sec, '');
    setVolume(vS); playSound(sc.song); fadeVolume(vMid, sec);
    await wait(sec * 1000); if (seq !== _seq) return;
    stopSound();
  }

  // 2) Тихи фрази с гласа на родителя — няколко кръга с пауза между тях; силата пада бавно.
  const list = orderedPhrases();
  if (list.length && sc.phraseRounds > 0) {
    const rounds = sc.phraseRounds, gap = Math.max(3, sc.phraseGapSec);
    const total = rounds * list.length;
    setStep('phrases', total * gap + 5, '');
    let n = 0;
    for (let r = 0; r < rounds; r++) {
      for (const p of list) {
        n++;
        S.stepInfo = n + '/' + total; emit();
        const vol = vMid - (vMid - vE) * (n / total);
        await playPhrase(p, Math.max(0.15, vol)); if (seq !== _seq) return;
        await wait(gap * 1000); if (seq !== _seq) return;
      }
    }
  }

  // 3) Шум — от средата към volEnd, после плавно до нула.
  if (sc.noise !== 'none' && NOISE_KINDS.includes(sc.noise) && sc.noiseMin > 0) {
    const sec = sc.noiseMin * 60;
    setStep('noise', sec + 20, '');
    setVolume(Math.max(vE, vMid * 0.8)); playSound(sc.noise); fadeVolume(vE, sec);
    await wait(sec * 1000); if (seq !== _seq) return;
    fadeVolume(0, 20);
    await wait(20000); if (seq !== _seq) return;
    stopSound();
  }

  S.phase = 'watch'; setStep(null, 0, '');
  log('sitter_watch', t('evmsg_watch'));
  send('sitter_watch', t('evmsg_watch'));
}

function setStep(step, seconds, info) {
  S.step = step; S.stepEndsAt = step ? Date.now() + seconds * 1000 : 0; S.stepInfo = info || '';
  emit();
}

// ---------------------------------------------------------------- микрофон: плач / хленч / тишина
function onLevel(level) {
  if (!S.running) return;
  const now = Date.now();
  const rc = getSitter().react;
  S.level = level;
  const cryThr = rc.cryLevel, fussThr = Math.max(10, rc.cryLevel - 15), quietThr = Math.max(5, rc.cryLevel - 30);

  if (level >= quietThr) { S.lastNoiseAt = now; _silenceSent = false; }

  if (level >= cryThr) {
    if (!_loudSince) _loudSince = now;
    if (!_fussSince) _fussSince = now;
    if (now - _loudSince >= rc.crySeconds * 1000) {
      if (S.status !== 'cry') { S.status = 'cry'; onCry(now); }
      // Плачът продължава → нов сигнал + реакция след всяка пауза (родителят да не го пропусне).
      else if (now - S.lastReactAt >= rc.cooldownSec * 1000) onCry(now);
    }
  } else if (level >= fussThr) {
    _loudSince = 0;
    if (!_fussSince) _fussSince = now;
    if (now - _fussSince >= 2000 && S.status === 'quiet') {
      S.status = 'fuss';
      if (now - _lastFussLogAt > FUSS_LOG_GAP_MS) { _lastFussLogAt = now; log('fuss', t('evmsg_fuss')); send('fuss', t('evmsg_fuss')); }
    }
  } else {
    _loudSince = 0; _fussSince = 0;
    if (S.status !== 'quiet' && now - S.lastNoiseAt >= CALM_AFTER_MS) {
      S.status = 'quiet';
      log('calm', t('evmsg_calm')); send('calm', t('evmsg_calm'));
    }
  }

  // Дълга пълна тишина (по избор) — сигнал към родителя веднъж, докато не се чуе звук.
  if (rc.silenceAlertMin > 0 && !_silenceSent && S.lastNoiseAt && now - S.lastNoiseAt >= rc.silenceAlertMin * 60000) {
    _silenceSent = true;
    const label = t('evmsg_silence').replace('{0}', String(rc.silenceAlertMin));
    log('silence', label); send('silence', label);
  }
  emit();
}

// Плач → сигнал към родителя + реакция тук (с пауза между реакциите).
function onCry(now) {
  S.cries++;
  const rc = getSitter().react;
  log('cry', t('evmsg_cry'));
  send('cry', t('evmsg_cry'));
  if (rc.photoOnCry) takePhoto().then((url) => { if (url) sendFrame(url, t('evmsg_cry')); });
  if (now - S.lastReactAt < rc.cooldownSec * 1000) { emit(); return; }
  S.lastReactAt = now;
  react(rc.onCry);
  emit();
}

function react(kind) {
  const sc = getSitter().scenario;
  const vol = sc.volStart / 100;
  if (kind === 'phrase') {
    const p = reactionPhrase();
    if (p) { playPhrase(p, vol); log('reaction', t('react_phrase_label') + ': ' + phraseTitle(p)); return; }
    kind = 'song'; // няма записана фраза → песен
  }
  if (kind === 'song') {
    const song = sc.song !== 'none' ? sc.song : 'hush';
    if (S.phase !== 'lull') { setVolume(vol); playSound(song, 3); }
    log('reaction', t('react_song_label') + ': ' + t('snd_' + song));
  }
}

export function phraseTitle(p) {
  if (!p) return '';
  return p.title || t('slot_' + (p.slot || 'custom'));
}

// ---------------------------------------------------------------- снимка от камерата (по заявка / при плач)
let _photoBusy = false;
export async function takePhoto() {
  if (_photoBusy || !cameraSupported()) return null;
  _photoBusy = true;
  const video = document.createElement('video');
  video.muted = true; video.setAttribute('playsinline', '');
  let stream = null;
  try {
    const facing = getState().settings.cameraSource === 'back' ? 'back' : 'front';
    const r = await startDeviceCamera(video, { facing });
    if (!r.ok) return null;
    stream = r.stream;
    await new Promise((res) => setTimeout(res, 1200)); // да се нагласи експонацията
    const canvas = document.createElement('canvas');
    const f = grabFrame(video, canvas);
    return f.ok ? snapshotDataUrl(canvas, { maxW: 320, quality: 0.5 }) : null;
  } catch (_) { return null; }
  finally { try { stopCamera(stream, video); } catch (_) {} _photoBusy = false; }
}

// ---------------------------------------------------------------- команди от родителя
async function pollCmds() {
  if (!S.running) return;
  const r = await pollCommands();
  if (!S.running) return;
  S.relayOk = r.ok;
  for (const c of (r.commands || [])) { try { await execCommand(c); } catch (_) {} }
  emit();
  _cmdTimer = setTimeout(pollCmds, getPairing().pollSeconds * 1000);
}

async function execCommand(c) {
  const st = getSitter();
  const vol = st.scenario.volStart / 100;
  const type = String(c.type || ''), label = String(c.label || '');
  let done = '';
  if (type === 'phrase') {
    const p = st.phrases.find((x) => x.id === label) || st.phrases.find((x) => x.slot === label);
    if (p) { playPhrase(p, vol); done = t('react_phrase_label') + ': ' + phraseTitle(p); }
  } else if (type === 'song' && SONG_KINDS.includes(label)) {
    setVolume(vol); playSound(label, 5); done = t('react_song_label') + ': ' + t('snd_' + label);
  } else if (type === 'noise' && NOISE_KINDS.includes(label)) {
    setVolume(vol); playSound(label, 15); done = t('snd_' + label);
  } else if (type === 'stop') {
    stopSound(); stopPhrase(); done = t('cmd_stop');
  } else if (type === 'scenario') {
    restartScenario(); done = t('cmd_scenario');
  } else if (type === 'photo') {
    const url = await takePhoto();
    if (url) {
      await sendFrame(url, t('cmd_photo'));
      S.lastCmd = t('cmd_photo');
      log('photo', t('cmd_photo')); send('photo', t('cmd_photo')); // отделен тип → родителят дърпа кадъра
      return;
    }
    done = t('cmd_photo') + ' — ' + t('photo_failed');
  }
  if (!done) return;
  S.lastCmd = done;
  log('cmd', done);
  send('cmd', done);
}

// ---------------------------------------------------------------- пулс към родителя
function sendStatus() {
  if (!S.running || !pairingConfigured()) return;
  const quietMin = S.lastNoiseAt ? Math.floor((Date.now() - S.lastNoiseAt) / 60000) : 0;
  const left = S.stepEndsAt ? Math.max(0, Math.round((S.stepEndsAt - Date.now()) / 1000)) : 0;
  send('status', JSON.stringify({ s: S.status, l: S.level, q: quietMin, p: S.phase, st: S.step || '', left, c: S.cries, mic: S.micOk ? 1 : 0 }));
}
function sendCatalog() {
  if (!S.running || !pairingConfigured()) return;
  const items = [];
  let json = '[]';
  for (const p of getSitter().phrases) {
    items.push([p.id, p.slot, String(p.title || '').slice(0, 14)]);
    const j = JSON.stringify(items);
    if (j.length > 380) { items.pop(); break; }
    json = j;
  }
  send('catalog', json);
}

// ---------------------------------------------------------------- старт / стоп
export async function startSitter() {
  if (S.running) return { ok: true };
  _seq++;
  const seq = _seq;
  S.running = true; S.phase = 'idle'; S.step = null; S.status = 'quiet'; S.level = 0;
  S.startedAt = Date.now(); S.lastNoiseAt = Date.now(); S.lastReactAt = 0; S.cries = 0; S.lastCmd = '';
  _loudSince = 0; _fussSince = 0; _lastFussLogAt = 0; _silenceSent = false;

  // Микрофон — задължителен за наблюдението; без него сценарият пак върви, но казваме честно.
  if (micSupported()) {
    const r = await startMeter(onLevel);
    S.micOk = r.ok; S.micReason = r.ok ? '' : (r.reason || '');
  } else { S.micOk = false; S.micReason = 'unsupported'; }
  if (seq !== _seq) return { ok: false };

  log('sitter_start', t('evmsg_start'));
  send('sitter_start', t('evmsg_start'));
  sendStatus(); sendCatalog();
  _statusTimer = setInterval(sendStatus, STATUS_EVERY_MS);
  _catalogTimer = setInterval(sendCatalog, CATALOG_EVERY_MS);
  if (pairingConfigured()) pollCmds();
  emit();
  runScenario(seq);
  return { ok: true, mic: S.micOk };
}

export function restartScenario() {
  if (!S.running) return;
  _seq++;
  cancelWaits();
  stopSound(); stopPhrase();
  runScenario(_seq);
}

export function stopSitter() {
  if (!S.running) return;
  _seq++;
  S.running = false;
  cancelWaits();
  if (_statusTimer) { clearInterval(_statusTimer); _statusTimer = null; }
  if (_catalogTimer) { clearInterval(_catalogTimer); _catalogTimer = null; }
  if (_cmdTimer) { clearTimeout(_cmdTimer); _cmdTimer = null; }
  stopMeter(onLevel);
  stopSound(); stopPhrase();
  dimOff();
  const dur = Math.round((Date.now() - S.startedAt) / 60000);
  const label = t('evmsg_end').replace('{0}', String(dur)).replace('{1}', String(S.cries));
  log('sitter_end', label);
  send('sitter_end', label);
  S.phase = 'idle'; S.step = null; S.stepEndsAt = 0;
  emit();
}

// ---------------------------------------------------------------- затъмнен екран (телефонът лежи до детето)
export function dimOn(statusText) {
  dimOff();
  const txt = document.createElement('div');
  txt.className = 'dim-status';
  txt.textContent = statusText || '';
  const hint = document.createElement('div');
  hint.className = 'dim-hint';
  hint.textContent = t('dim_tap_exit');
  const ov = document.createElement('div');
  ov.className = 'dimscreen';
  ov.appendChild(txt); ov.appendChild(hint);
  let taps = 0, tapTimer = null;
  ov.addEventListener('click', () => {
    taps++;
    if (taps >= 2) { dimOff(); return; }
    hint.classList.add('show');
    clearTimeout(tapTimer); tapTimer = setTimeout(() => { taps = 0; hint.classList.remove('show'); }, 1500);
  });
  document.body.appendChild(ov);
  _dim = { ov, txt };
  try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then((l) => { _wakeLock = l; }).catch(() => {}); } catch (_) {}
}
export function dimUpdate(statusText) { if (_dim) _dim.txt.textContent = statusText || ''; }
export function dimOff() {
  if (_dim) { _dim.ov.remove(); _dim = null; }
  if (_wakeLock) { try { _wakeLock.release(); } catch (_) {} _wakeLock = null; }
}
export function dimActive() { return !!_dim; }
