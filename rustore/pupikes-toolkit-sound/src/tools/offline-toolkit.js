// Version: 1.0001
// 🧰 Инструменти — три напълно ОФЛАЙН, самостоятелни аудио инструмента върху Web Audio API:
//   1) Метроном — регулируем ритъм (40–240 удара/мин), размер на такта, визуален пулс,
//      точно планиран „клик" през осцилатор (акцент на първия удар).
//   2) Генератор на тон / камертон — избор на нота (A4=440 Hz и др.) или собствена честота,
//      непрекъснат синусов тон с регулиране на силата.
//   3) Таймер за интервали — работа/почивка в секунди, брой рундове, обратно броене
//      със звуков сигнал между фазите; последните настройки се пазят на устройството.
// БЕЗ мрежа, БЕЗ външни библиотеки — всичко се синтезира на устройството през Web Audio API.
// UI надписите са СТАТИЧНИ български текстови възли (runtime i18n ги превежда после);
// JS-ът само окабелява поведение. Алтернативните надписи на превключвателите и имената на
// фазите живеят като статични data-* атрибути, за да няма български низове, зашити в JS.

const LS_TIMER = 'pk_snd_tk_timer'; // последни настройки на таймера за интервали

function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// --- Един споделен AudioContext (създава се при първия жест на потребителя) ---
let _ac = null;
function ac() {
  if (!_ac) { const C = window.AudioContext || window.webkitAudioContext; _ac = new C(); }
  if (_ac.state === 'suspended') { try { _ac.resume(); } catch (e) {} }
  return _ac;
}

// Кратък сигнал: осцилатор + плавен спад на силата, за да няма пукане.
function beep(freq, dur, type, gainPeak) {
  const c = ac();
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gainPeak || 0.3, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.08));
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + (dur || 0.08) + 0.02);
}

export function render(root) {
  root.innerHTML = `
    <div class="tabs" id="tkTabs">
      <button class="tab active" data-tab="metro">Метроном</button>
      <button class="tab" data-tab="tone">Тон</button>
      <button class="tab" data-tab="timer">Интервали</button>
    </div>

    <!-- ============ 1) МЕТРОНОМ ============ -->
    <section data-panel="metro">
      <div class="tool-card">
        <label>Темпо (удари в минута)</label>
        <div class="row" style="align-items:center">
          <div style="flex:3"><input type="range" id="mBpm" min="40" max="240" step="1" value="100"></div>
          <div style="flex:1;text-align:center"><span class="sz" id="mBpmVal">100</span></div>
        </div>
        <div class="hint">Плъзни за 40–240 удара в минута. Точното планиране е през Web Audio API.</div>

        <label>Размер на такта</label>
        <select id="mBeats">
          <option value="1">Без акцент</option>
          <option value="2">2 / 4</option>
          <option value="3">3 / 4 (валс)</option>
          <option value="4" selected>4 / 4</option>
          <option value="6">6 / 8</option>
        </select>

        <div class="cmp" style="margin-top:16px">
          <div><div class="beat-dot" id="mDot"></div><div class="hint">визуален пулс</div></div>
          <div><div class="sz" id="mBeat">–</div><div class="hint">удар в такта</div></div>
        </div>

        <button class="btn" id="mToggle" data-start="▶ Старт" data-stop="■ Стоп" style="margin-top:16px">▶ Старт</button>
      </div>
    </section>

    <!-- ============ 2) ГЕНЕРАТОР НА ТОН / КАМЕРТОН ============ -->
    <section data-panel="tone" hidden>
      <div class="tool-card">
        <label>Нота (еталон за настройка)</label>
        <select id="tNote">
          <option value="261.63">До (C4)</option>
          <option value="293.66">Ре (D4)</option>
          <option value="329.63">Ми (E4)</option>
          <option value="349.23">Фа (F4)</option>
          <option value="392.00">Сол (G4)</option>
          <option value="440.00" selected>Ла (A4) — 440 Hz</option>
          <option value="493.88">Си (B4)</option>
          <option value="523.25">До (C5)</option>
          <option value="custom">Собствена честота…</option>
        </select>

        <label>Честота (Hz)</label>
        <div class="row" style="align-items:center">
          <div style="flex:3"><input type="range" id="tFreq" min="55" max="2000" step="1" value="440"></div>
          <div style="flex:1;text-align:center"><span class="sz" id="tFreqVal">440</span></div>
        </div>
        <div class="hint">Използвай Ла = 440 Hz за настройка на инструмент или избери своя честота.</div>

        <label>Сила на звука</label>
        <input type="range" id="tVol" min="0" max="100" step="1" value="40">

        <button class="btn" id="tToggle" data-start="▶ Пусни тона" data-stop="■ Спри тона" style="margin-top:16px">▶ Пусни тона</button>
        <div class="hint" style="margin-top:8px">Непрекъснат синусов тон — свири докато не го спреш.</div>
      </div>
    </section>

    <!-- ============ 3) ТАЙМЕР ЗА ИНТЕРВАЛИ ============ -->
    <section data-panel="timer" hidden>
      <div class="tool-card">
        <label>Работа (секунди)</label>
        <input type="number" id="iWork" min="1" max="3600" step="1" value="20" inputmode="numeric">
        <label>Почивка (секунди)</label>
        <input type="number" id="iRest" min="0" max="3600" step="1" value="10" inputmode="numeric">
        <label>Брой рундове</label>
        <input type="number" id="iRounds" min="1" max="99" step="1" value="8" inputmode="numeric">
        <div class="hint">Настройките се пазят на устройството за следващия път.</div>
      </div>

      <div class="tool-card">
        <div class="cmp">
          <div>
            <div class="sz" id="iPhase"
                 data-ready="Готов?" data-work="Работа" data-rest="Почивка"
                 data-done="Готово!" data-paused="Пауза">Готов?</div>
            <div class="hint">фаза</div>
          </div>
          <div><div class="sz" id="iTime">00:20</div><div class="hint">оставащо време</div></div>
          <div><div class="sz" id="iRound">0 / 8</div><div class="hint">рунд</div></div>
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn inline" id="iToggle" data-start="▶ Старт" data-pause="⏸ Пауза">▶ Старт</button>
          <button class="btn inline sec" id="iReset">↺ Нулирай</button>
        </div>
      </div>
    </section>
  `;

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => Array.from(root.querySelectorAll(s));

  // ---- Превключване на подразделите (спира всичко активно при напускане) ----
  $$('#tkTabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#tkTabs .tab').forEach((b) => b.classList.toggle('active', b === btn));
      const tab = btn.dataset.tab;
      $$('section[data-panel]').forEach((sec) => { sec.hidden = sec.dataset.panel !== tab; });
      stopMetro(); stopTone(); // не оставяй звук да свири на скрит таб
    });
  });

  // ===================== 1) МЕТРОНОМ =====================
  const mBpm = $('#mBpm'), mBpmVal = $('#mBpmVal'), mBeats = $('#mBeats');
  const mDot = $('#mDot'), mBeatEl = $('#mBeat'), mToggle = $('#mToggle');
  let mRunning = false, mTimer = null, mRaf = 0;
  let mNextTime = 0, mBeatIdx = 0;
  const mQueue = [];                       // предстоящи удари за визуализация
  const LOOKAHEAD = 0.1, TICK = 25;        // планиране 100 ms напред, проверка на 25 ms

  mBpm.addEventListener('input', () => { mBpmVal.textContent = mBpm.value; });

  function scheduleClick(beat, time) {
    const c = ac();
    const accent = (parseInt(mBeats.value, 10) > 1) && (beat === 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.32, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(g).connect(c.destination);
    osc.start(time);
    osc.stop(time + 0.05);
    mQueue.push({ beat, time });
  }

  function mScheduler() {
    const c = ac();
    const perBeat = 60 / parseInt(mBpm.value, 10);
    const beatsPer = Math.max(1, parseInt(mBeats.value, 10));
    while (mNextTime < c.currentTime + LOOKAHEAD) {
      scheduleClick(mBeatIdx % beatsPer, mNextTime);
      mNextTime += perBeat;
      mBeatIdx++;
    }
  }

  function mDraw() {
    const c = ac();
    while (mQueue.length && mQueue[0].time <= c.currentTime) {
      const b = mQueue.shift();
      mDot.classList.add('on');
      setTimeout(() => mDot.classList.remove('on'), 90);
      mBeatEl.textContent = String(b.beat + 1);
    }
    if (mRunning) mRaf = requestAnimationFrame(mDraw);
  }

  function startMetro() {
    if (mRunning) return;
    const c = ac();
    mRunning = true;
    mBeatIdx = 0;
    mNextTime = c.currentTime + 0.06;
    mQueue.length = 0;
    mTimer = setInterval(mScheduler, TICK);
    mRaf = requestAnimationFrame(mDraw);
    mToggle.textContent = mToggle.dataset.stop;
    mToggle.classList.add('sec');
  }
  function stopMetro() {
    mRunning = false;
    if (mTimer) { clearInterval(mTimer); mTimer = null; }
    if (mRaf) { cancelAnimationFrame(mRaf); mRaf = 0; }
    mQueue.length = 0;
    mDot.classList.remove('on');
    mBeatEl.textContent = '–';
    mToggle.textContent = mToggle.dataset.start;
    mToggle.classList.remove('sec');
  }
  mToggle.addEventListener('click', () => { mRunning ? stopMetro() : startMetro(); });

  // ===================== 2) ГЕНЕРАТОР НА ТОН =====================
  const tNote = $('#tNote'), tFreq = $('#tFreq'), tFreqVal = $('#tFreqVal');
  const tVol = $('#tVol'), tToggle = $('#tToggle');
  let tOsc = null, tGain = null;

  function curVol() { return (parseInt(tVol.value, 10) / 100) * 0.6; } // таван 0.6 срещу изкривяване

  function setFreq(hz) {
    tFreq.value = hz;
    tFreqVal.textContent = Math.round(hz);
    if (tOsc) tOsc.frequency.setTargetAtTime(hz, ac().currentTime, 0.01);
  }

  tNote.addEventListener('change', () => {
    if (tNote.value === 'custom') return;      // остави честотата, редактира се от плъзгача
    setFreq(parseFloat(tNote.value));
  });
  tFreq.addEventListener('input', () => {
    tFreqVal.textContent = tFreq.value;
    tNote.value = 'custom';
    if (tOsc) tOsc.frequency.setTargetAtTime(parseFloat(tFreq.value), ac().currentTime, 0.01);
  });
  tVol.addEventListener('input', () => {
    if (tGain) tGain.gain.setTargetAtTime(curVol(), ac().currentTime, 0.01);
  });

  function startTone() {
    if (tOsc) return;
    const c = ac();
    tOsc = c.createOscillator();
    tGain = c.createGain();
    tOsc.type = 'sine';
    tOsc.frequency.value = parseFloat(tFreq.value);
    tGain.gain.setValueAtTime(0.0001, c.currentTime);
    tGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, curVol()), c.currentTime + 0.03);
    tOsc.connect(tGain).connect(c.destination);
    tOsc.start();
    tToggle.textContent = tToggle.dataset.stop;
    tToggle.classList.add('sec');
  }
  function stopTone() {
    if (!tOsc) return;
    const c = ac();
    try {
      tGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.02);
      tOsc.stop(c.currentTime + 0.1);
    } catch (e) {}
    tOsc = null; tGain = null;
    tToggle.textContent = tToggle.dataset.start;
    tToggle.classList.remove('sec');
  }
  tToggle.addEventListener('click', () => { tOsc ? stopTone() : startTone(); });

  // ===================== 3) ТАЙМЕР ЗА ИНТЕРВАЛИ =====================
  const iWork = $('#iWork'), iRest = $('#iRest'), iRounds = $('#iRounds');
  const iPhaseEl = $('#iPhase'), iTimeEl = $('#iTime'), iRoundEl = $('#iRound'), iToggle = $('#iToggle'), iReset = $('#iReset');
  let iState = 'idle';        // idle | work | rest | done
  let iRunning = false, iTick = null;
  let iRound = 0, iEndAt = 0, iRemain = 0;

  // Възстанови последните настройки
  (function restore() {
    try {
      const s = JSON.parse(lsGet(LS_TIMER, 'null'));
      if (s) {
        if (s.work) iWork.value = s.work;
        if (s.rest != null) iRest.value = s.rest;
        if (s.rounds) iRounds.value = s.rounds;
      }
    } catch (e) {}
    resetTimer();
  })();

  function saveSettings() {
    lsSet(LS_TIMER, JSON.stringify({
      work: clampInt(iWork.value, 1, 3600, 20),
      rest: clampInt(iRest.value, 0, 3600, 10),
      rounds: clampInt(iRounds.value, 1, 99, 8)
    }));
  }
  [iWork, iRest, iRounds].forEach((el) => el.addEventListener('change', () => { saveSettings(); if (!iRunning) resetTimer(); }));

  function clampInt(v, lo, hi, dflt) {
    let n = parseInt(v, 10);
    if (!isFinite(n)) n = dflt;
    return Math.min(hi, Math.max(lo, n));
  }
  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function setPhaseLabel(key) { iPhaseEl.textContent = iPhaseEl.dataset[key] || ''; }

  function resetTimer() {
    stopTicker();
    iState = 'idle'; iRunning = false; iRound = 0;
    setPhaseLabel('ready');
    iTimeEl.textContent = fmt(clampInt(iWork.value, 1, 3600, 20));
    iRoundEl.textContent = '0 / ' + clampInt(iRounds.value, 1, 99, 8);
    iToggle.textContent = iToggle.dataset.start;
    iToggle.classList.remove('sec');
  }

  function enterPhase(state, seconds) {
    iState = state;
    setPhaseLabel(state === 'work' ? 'work' : 'rest');
    iRemain = seconds;
    iEndAt = performance.now() + seconds * 1000;
    iTimeEl.textContent = fmt(seconds);
    iRoundEl.textContent = iRound + ' / ' + clampInt(iRounds.value, 1, 99, 8);
    // Различен сигнал за начало на работа спрямо почивка
    if (state === 'work') beep(880, 0.12, 'square', 0.35); else beep(440, 0.12, 'sine', 0.3);
  }

  function nextPhase() {
    const rounds = clampInt(iRounds.value, 1, 99, 8);
    const rest = clampInt(iRest.value, 0, 3600, 10);
    if (iState === 'work') {
      if (iRound >= rounds) { finishTimer(); return; }
      if (rest > 0) { enterPhase('rest', rest); return; }
      iRound++; enterPhase('work', clampInt(iWork.value, 1, 3600, 20)); return;
    }
    if (iState === 'rest') {
      iRound++; enterPhase('work', clampInt(iWork.value, 1, 3600, 20)); return;
    }
  }

  function finishTimer() {
    stopTicker();
    iState = 'done'; iRunning = false;
    setPhaseLabel('done');
    iTimeEl.textContent = '00:00';
    iToggle.textContent = iToggle.dataset.start;
    iToggle.classList.remove('sec');
    // Тройна финална камбанка
    beep(1046, 0.15, 'sine', 0.4);
    setTimeout(() => beep(1318, 0.15, 'sine', 0.4), 180);
    setTimeout(() => beep(1568, 0.25, 'sine', 0.4), 360);
  }

  function tickFn() {
    const left = (iEndAt - performance.now()) / 1000;
    if (left <= 0) { nextPhase(); return; }
    iTimeEl.textContent = fmt(left);
  }
  function startTicker() { if (!iTick) iTick = setInterval(tickFn, 200); }
  function stopTicker() { if (iTick) { clearInterval(iTick); iTick = null; } }

  function startTimer() {
    ac(); // отключи звука с този жест
    if (iState === 'idle' || iState === 'done') {
      saveSettings();
      iRound = 1;
      enterPhase('work', clampInt(iWork.value, 1, 3600, 20));
    } else {
      // подновяване след пауза
      iEndAt = performance.now() + iRemain * 1000;
    }
    iRunning = true;
    startTicker();
    iToggle.textContent = iToggle.dataset.pause;
    iToggle.classList.add('sec');
  }
  function pauseTimer() {
    iRemain = Math.max(0, (iEndAt - performance.now()) / 1000);
    iRunning = false;
    stopTicker();
    setPhaseLabel('paused');
    iToggle.textContent = iToggle.dataset.start;
    iToggle.classList.remove('sec');
  }
  iToggle.addEventListener('click', () => { iRunning ? pauseTimer() : startTimer(); });
  iReset.addEventListener('click', resetTimer);
}
