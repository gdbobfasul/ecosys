// Наблюдавай 20 валути и криптовалути — РЕАЛЕН инструмент за следене на курсове.
// Мобилно копие на услугата от портала (public/portals/services/watch20.html),
// но БЕЗ регистрация, БЕЗ бекенд, БЕЗ логин — всичко се пази ЛОКАЛНО на устройството
// (localStorage) и е „вечно" за притежателя на телефона: преживява рестарт на апа
// и се трие само ако потребителят промени настройките или деинсталира приложението.
//
// Какво прави:
//   • До 20 слота — във всеки следиш по една двойка спрямо USD/USDC.
//   • За всеки слот задаваш до 20 прагови стойности.
//   • Периодична проверка (на всеки 60 сек, докато инструментът е отворен):
//     когато курсът ПРЕМИНЕ праг — нагоре или надолу, дори при прескочена граница
//     между две проверки — се задейства известие + звукова мелодия, а кутийката светва.
//
// Източници на данни (БЕЗ ключ, БЕЗ акаунт, БЕЗ tracking — същият многоизточников
// fetch като в crypto-chart.js):
//   1) https://data-api.binance.vision  (публичен Binance proxy — работи и там,
//      където api.binance.com е блокиран; затова е ПЪРВИ)
//   2) https://api.binance.com           (резервен Binance хост)
//   3) https://api.coingecko.com         (последен резерв — крипто и фиат спрямо USD)
// Graceful fallback при офлайн: честно съобщение, без да чупи инструмента.
//
// Известия: Capacitor LocalNotifications (ако е наличен на устройството), иначе
// Web Notifications API; ако и двете липсват — деградира тихо (само визуално светване).
//
// Звуков сигнал: клиентът може да качи СВОЙ .mp3 (или .ogg/.wav) през input type=file —
// пази се локално като data URL в localStorage и се пуска при аларма. Дефолт = вграден
// кратък генериран сигнал (WebAudio beep), за да не тежи бандълът.

export const title = 'Наблюдавай 20 валути';

const SLOTS = 20;
const LS_KEY = 'st_watch20_v1';        // слотове + прагове (вечно, localStorage)
const LS_SOUND = 'st_watch20_sound_v1'; // персонализиран звук (data URL)
const CHECK_MS = 60000;                // период на проверка докато инструментът е активен

// ─────────────────────────────────────────────────────────────────────────
// Известия — Capacitor LocalNotifications на устройство, иначе Web Notifications.
// ВАЖНО: плъгинът се взима СИНХРОННО от глобалния window.Capacitor.Plugins —
// динамичният import('@capacitor/local-notifications') УВИСВА в Capacitor WebView
// и бутонът „Разреши известия" не правеше нищо. Същият синхронен подход като в
// другите апове (notifier.js на autoreply-bot / baby-monitor / camera-watch).
// ─────────────────────────────────────────────────────────────────────────
let _ln = null;        // null = неопитан, false = няма native, обект = LocalNotifications
let _lnReady = false;  // дали вече сме опитали да заредим плъгина

function getLocalNotifications() {
  if (_lnReady) return _ln;
  _lnReady = true;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && cap.Plugins && cap.Plugins.LocalNotifications) {
      _ln = cap.Plugins.LocalNotifications;
    } else {
      _ln = false;
    }
  } catch (_) {
    _ln = false;
  }
  return _ln;
}

async function requestNotifyPermission() {
  const ln = getLocalNotifications();
  if (ln) {
    try {
      // Capacitor връща { display: 'granted' | 'denied' | 'prompt' }
      const r = await ln.requestPermissions();
      return !!(r && r.display === 'granted');
    } catch (_) { /* падаме към web Notification */ }
  }
  if (typeof Notification !== 'undefined') {
    try { return (await Notification.requestPermission()) === 'granted'; }
    catch (_) { return false; }
  }
  return false;
}

let _webNotifId = 1;
async function sendNotify(title, body) {
  const ln = getLocalNotifications();
  if (ln) {
    try {
      await ln.schedule({
        notifications: [{ id: Date.now() % 2147483647, title, body, schedule: { at: new Date(Date.now() + 300) } }]
      });
      return true;
    } catch (_) { /* пада към уеб / тих */ }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag: 'w20-' + _webNotifId++ }); return true; }
    catch (_) { /* пада към тих */ }
  }
  return false; // тиха деградация — остава само визуалното светване
}

// ─────────────────────────────────────────────────────────────────────────
// Звуков сигнал — персонализиран (качен от потребителя, в localStorage) или
// вграден кратък WebAudio beep по подразбиране.
// ─────────────────────────────────────────────────────────────────────────
let _customSound = null; // data URL или null
let _audioEl = null;     // <audio> за персонализирания файл
let _audioCtx = null;    // WebAudio за дефолтния beep

function loadCustomSound() {
  try { _customSound = localStorage.getItem(LS_SOUND) || null; } catch (_) { _customSound = null; }
  return _customSound;
}
function saveCustomSound(dataUrl) {
  try { localStorage.setItem(LS_SOUND, dataUrl); _customSound = dataUrl; return true; }
  catch (_) { return false; } // напр. препълнен localStorage при много голям файл
}
function clearCustomSound() {
  try { localStorage.removeItem(LS_SOUND); } catch (_) {}
  _customSound = null;
}

function playDefaultBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    const now = _audioCtx.currentTime;
    // кратка двутонна мелодийка (ла → по-висока ла), общо ~0.5 сек
    [[880, 0], [1175, 0.18]].forEach(([freq, off]) => {
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + off);
      gain.gain.exponentialRampToValueAtTime(0.25, now + off + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.16);
      osc.connect(gain).connect(_audioCtx.destination);
      osc.start(now + off);
      osc.stop(now + off + 0.18);
    });
  } catch (_) { /* без звук — тиха деградация */ }
}

function playAlertSound() {
  if (_customSound) {
    try {
      if (!_audioEl) { _audioEl = new Audio(); }
      if (_audioEl.src !== _customSound) _audioEl.src = _customSound;
      _audioEl.currentTime = 0;
      const p = _audioEl.play();
      if (p && p.catch) p.catch(() => playDefaultBeep());
      return;
    } catch (_) { /* пада към beep */ }
  }
  playDefaultBeep();
}

// Браузърите/WebView блокират авто-звук без потребителски жест. След първи жест
// „отключваме" аудиото (тих пуск), за да свири после при аларма.
let _audioUnlocked = false;
function unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) { if (!_audioCtx) _audioCtx = new Ctx(); if (_audioCtx.state === 'suspended') _audioCtx.resume(); }
  } catch (_) {}
  if (_customSound) {
    try {
      if (!_audioEl) _audioEl = new Audio(_customSound);
      const v = _audioEl.volume; _audioEl.volume = 0;
      const p = _audioEl.play();
      if (p && p.then) p.then(() => { _audioEl.pause(); _audioEl.currentTime = 0; _audioEl.volume = v; }).catch(() => { _audioEl.volume = v; });
    } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Запазване/зареждане — ЛОКАЛНО (localStorage), вечно.
// ─────────────────────────────────────────────────────────────────────────
function blankSlots() {
  const arr = [];
  for (let i = 0; i < SLOTS; i++) arr.push({ sel: null, alerts: [] });
  return arr;
}
function loadSlots() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return blankSlots();
    const data = JSON.parse(raw);
    const arr = blankSlots();
    if (Array.isArray(data)) {
      for (let i = 0; i < SLOTS; i++) {
        const d = data[i];
        if (!d) continue;
        arr[i].sel = d.sel || null;
        arr[i].alerts = Array.isArray(d.alerts) ? d.alerts.map((v) => ({ val: +v })).filter((a) => isFinite(a.val)) : [];
      }
    }
    return arr;
  } catch (_) { return blankSlots(); }
}
function saveSlots(slots) {
  try {
    const data = slots.map((s) => ({ sel: s.sel || null, alerts: (s.alerts || []).map((a) => a.val) }));
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return true;
  } catch (_) { return false; }
}

// ─────────────────────────────────────────────────────────────────────────
// Списък валути/крипто — keyless, многоизточников.
// ─────────────────────────────────────────────────────────────────────────
const BINANCE_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

async function loadCurrencyList() {
  const list = [];
  // 1) фиат валути (спрямо USD) — fawazahmed0 безплатен currency-api, без ключ
  try {
    const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json', { cache: 'no-store' });
    if (r.ok) {
      const fiat = await r.json();
      Object.keys(fiat).forEach((code) => {
        if (code === 'usd') return;
        list.push({ code: code.toUpperCase(), name: fiat[code] || code.toUpperCase(), type: 'fiat' });
      });
    }
  } catch (_) { /* без фиат — продължаваме с крипто */ }

  // 2) крипто двойки спрямо USDC от Binance (резервен хост)
  for (const host of BINANCE_HOSTS) {
    try {
      const b = await fetch(`${host}/api/v3/exchangeInfo`, { cache: 'no-store' });
      if (!b.ok) continue;
      const info = await b.json();
      if (info && Array.isArray(info.symbols)) {
        const set = new Set();
        info.symbols.forEach((s) => { if (s.quoteAsset === 'USDC' && s.status === 'TRADING') set.add(s.baseAsset); });
        set.forEach((c) => list.push({ code: c, name: c + ' (крипто)', type: 'crypto' }));
        break;
      }
    } catch (_) { /* пробваме следващия хост */ }
  }
  list.sort((a, b) => a.code.localeCompare(b.code));
  return list;
}

// ─────────────────────────────────────────────────────────────────────────
// Курсове — само за избраните слотове (пестим заявки).
// ─────────────────────────────────────────────────────────────────────────
// CoinGecko id за резервен източник на крипто цена.
const CG_IDS = { BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', TRX: 'tron', DOT: 'polkadot', MATIC: 'matic-network', LTC: 'litecoin', AVAX: 'avalanche-2', LINK: 'chainlink', ATOM: 'cosmos', UNI: 'uniswap' };

function curKey(c) { return (c.type === 'fiat' ? 'FIAT:' : 'CRYPTO:') + c.code; }
function selLabel(sel) {
  if (!sel) return '';
  const parts = sel.split(':');
  return parts[0] === 'FIAT' ? (parts[1] + ' / USD') : (parts[1] + ' / USDC');
}
function fmtRate(v) {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1000) return v.toFixed(2);
  if (v >= 1) return v.toFixed(4);
  return v.toPrecision(4);
}

// Връща { rates: { sel: value }, ok: bool } за подадените селекции.
async function fetchRates(sels) {
  const rates = {};
  let anyOk = false;
  const fiat = sels.filter((s) => s.indexOf('FIAT:') === 0);
  const crypto = sels.filter((s) => s.indexOf('CRYPTO:') === 0);

  // ── фиат: 1 USD = X (база USD), една заявка покрива всичко ──
  if (fiat.length) {
    try {
      const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const usd = (d && d.usd) || {};
        fiat.forEach((sel) => {
          const code = sel.split(':')[1].toLowerCase();
          if (usd[code] != null) { rates[sel] = usd[code]; anyOk = true; }
        });
      }
    } catch (_) { /* фиат недостъпен */ }
  }

  // ── крипто: цена в USDC от Binance, с резервен CoinGecko ──
  for (const sel of crypto) {
    const base = sel.split(':')[1];
    let got = false;
    for (const host of BINANCE_HOSTS) {
      try {
        const pr = await fetch(`${host}/api/v3/ticker/price?symbol=${base}USDC`, { cache: 'no-store' });
        if (!pr.ok) continue;
        const pd = await pr.json();
        const px = parseFloat(pd.price);
        if (isFinite(px)) { rates[sel] = px; anyOk = true; got = true; break; }
      } catch (_) { /* следващ хост */ }
    }
    if (!got) {
      const cgId = CG_IDS[base];
      if (cgId) {
        try {
          const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, { cache: 'no-store' });
          if (r.ok) {
            const d = await r.json();
            const px = d && d[cgId] && d[cgId].usd;
            if (isFinite(px)) { rates[sel] = px; anyOk = true; }
          }
        } catch (_) { /* без този курс */ }
      }
    }
  }
  return { rates, ok: anyOk };
}

// ─────────────────────────────────────────────────────────────────────────
// Откриване на „пресичане" между предишната и текущата стойност (двупосочно).
// Понеже периодът е минута, курсът може да ПРЕСКОЧИ няколко прага наведнъж —
// затова за всеки праг гледаме дали попада между предишната и сегашната стойност.
// ─────────────────────────────────────────────────────────────────────────
function checkCrossings(slots, rates, prev) {
  const hits = []; // { idx, label, val, up, rate }
  slots.forEach((s, idx) => {
    if (!s.sel || !s.alerts || !s.alerts.length) return;
    const rate = rates[s.sel];
    if (rate == null) return;
    const p = prev[s.sel];
    if (p == null) return;       // първо засичане за тази двойка — само запомняме
    if (rate === p) return;
    const up = rate > p;
    s.alerts.forEach((a) => {
      const crossed = ((p - a.val) * (rate - a.val) < 0) || (rate === a.val && p !== a.val);
      if (crossed) hits.push({ idx, label: selLabel(s.sel), val: a.val, up, rate });
    });
  });
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────
// Рендер
// ─────────────────────────────────────────────────────────────────────────
export function render(root) {
  const slots = loadSlots();
  const prevRate = {};   // sel → последна видяна стойност (за пресичане)
  const liveRate = {};   // sel → текуща стойност (за показване)
  let currencies = [];
  let timer = null;
  let openModalIdx = -1;

  loadCustomSound();
  document.addEventListener('click', unlockAudio, { once: true });

  root.innerHTML = `
    <div class="notice" style="margin-bottom:14px">
      Следи до <b>20 двойки</b> спрямо USD/USDC. Курсове на живо от
      <b>Binance</b> / <b>CoinGecko</b> — безплатни публични API без ключ.
      Всичко се пази <b>локално на устройството</b> (вечно, без акаунт).
      Информативно — <b>не е финансов съвет</b>.
    </div>

    <div class="tool-card">
      <div class="tabs" style="margin-bottom:10px">
        <button class="btn inline" id="w20Notify" style="margin-top:0">🔔 Разреши известия</button>
        <button class="btn inline sec" id="w20Sound" style="margin-top:0">🎵 Сигнал</button>
        <button class="btn inline sec" id="w20Refresh" style="margin-top:0">↻ Опресни сега</button>
      </div>
      <div class="status" id="w20Status"></div>
    </div>

    <div class="grid" id="w20Grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))"></div>

    <!-- модал: прагове -->
    <div id="w20ModalBg" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:16px">
      <div class="tool-card" style="max-width:420px;width:100%;max-height:85vh;overflow:auto;margin:0">
        <h3 style="margin-bottom:6px">Прагове за известие <span id="w20MNum"></span></h3>
        <p class="hint" style="margin-bottom:12px">Добави до 20 стойности. Когато курсът ПРЕМИНЕ някоя (нагоре или надолу — дори при прескочена граница между две проверки), получаваш известие + сигнал, а кутийката светва.</p>
        <div id="w20ThrList"></div>
        <input type="number" id="w20ThrVal" step="any" placeholder="стойност (напр. 0.92)" />
        <button class="btn" id="w20AddThr">+ Добави стойност</button>
        <button class="btn sec" id="w20CloseModal">Затвори</button>
      </div>
    </div>

    <!-- модал: звуков сигнал -->
    <div id="w20SoundBg" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:16px">
      <div class="tool-card" style="max-width:420px;width:100%;max-height:85vh;overflow:auto;margin:0">
        <h3 style="margin-bottom:6px">Звуков сигнал при аларма</h3>
        <p class="hint" style="margin-bottom:12px">Качи СВОЙ .mp3 файл — пази се локално на устройството и свири при пресичане на праг. По подразбиране се ползва вграден кратък сигнал.</p>
        <div id="w20SoundState" class="readout" style="margin-top:0;margin-bottom:12px"></div>
        <label>Избери .mp3 (или .ogg / .wav)</label>
        <input type="file" id="w20SoundFile" accept="audio/*" />
        <button class="btn" id="w20TestSound">▶ Тествай сигнала</button>
        <button class="btn sec" id="w20ResetSound">↺ Върни вградения сигнал</button>
        <button class="btn sec" id="w20CloseSound">Затвори</button>
      </div>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#w20Status');
  const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };

  // ── рендер на грид от слотове ──
  // ВАЖНО за BUG 2: структурата на гридовете се изгражда ЕДНОКРАТНО (renderGrid).
  // Периодичното опресняване НЕ пресъздава DOM-а (за да не губи фокус полето и да
  // не се затваря падащото меню, докато потребителят пише) — вместо това updateRates()
  // обновява само числата/етикета/светването на място.
  function renderGrid() {
    const grid = $('#w20Grid');
    grid.innerHTML = '';
    for (let i = 0; i < SLOTS; i++) {
      const s = slots[i];
      const rate = s.sel ? liveRate[s.sel] : null;
      const card = document.createElement('div');
      card.className = 'tool-card w20Card' + (s._alerted ? ' w20-alerted' : '');
      card.dataset.idx = String(i);
      card.style.cssText = 'margin-bottom:0;padding:12px;position:relative';
      card.innerHTML = `
        <div style="position:absolute;top:8px;left:10px;font-size:.7em;color:var(--text-dim);font-weight:700">#${i + 1}</div>
        <div class="w20Rate" style="font-size:1.3em;font-weight:700;margin:16px 0 2px;color:var(--text)">${fmtRate(rate)}</div>
        <div class="w20Label" style="font-size:.78em;color:var(--text-dim);min-height:1em">${s.sel ? selLabel(s.sel) : 'не е избрана'}</div>
        <div style="position:relative;margin-top:8px">
          <input type="text" data-idx="${i}" class="w20Search" placeholder="търси валута/крипто…" value="${s.sel ? s.sel.split(':')[1] : ''}" style="padding-right:34px" autocomplete="off" />
          <button class="w20Bell" data-idx="${i}" title="Прагове" style="position:absolute;right:6px;top:7px;background:none;border:none;cursor:pointer;font-size:1.1em;padding:2px;color:${s.alerts && s.alerts.length ? 'var(--warn)' : 'var(--text-dim)'}">🔔</button>
          <div class="w20List" data-idx="${i}" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-2);border:1px solid var(--line);border-radius:10px;max-height:200px;overflow:auto;z-index:30;box-shadow:0 6px 18px rgba(0,0,0,.5)"></div>
        </div>
      `;
      grid.appendChild(card);
    }
    bindGrid();
  }

  // Обновява САМО динамичните данни в съществуващите кутийки (курс, етикет, светване,
  // цвят на звънчето), БЕЗ да пипа полето за търсене и падащото меню — така писането
  // не се прекъсва и менюто остава отворено (BUG 2).
  function updateRates() {
    const grid = $('#w20Grid');
    if (!grid) return;
    for (let i = 0; i < SLOTS; i++) {
      const card = grid.querySelector('.w20Card[data-idx="' + i + '"]');
      if (!card) continue;
      const s = slots[i];
      const rate = s.sel ? liveRate[s.sel] : null;
      const rateEl = card.querySelector('.w20Rate');
      const labelEl = card.querySelector('.w20Label');
      const bellEl = card.querySelector('.w20Bell');
      if (rateEl) rateEl.textContent = fmtRate(rate);
      if (labelEl) labelEl.textContent = s.sel ? selLabel(s.sel) : 'не е избрана';
      if (bellEl) bellEl.style.color = (s.alerts && s.alerts.length) ? 'var(--warn)' : 'var(--text-dim)';
      card.classList.toggle('w20-alerted', !!s._alerted);
    }
  }

  function bindGrid() {
    root.querySelectorAll('.w20Search').forEach((inp) => {
      const idx = +inp.dataset.idx;
      inp.addEventListener('focus', () => filterList(idx, inp.value));
      inp.addEventListener('input', () => filterList(idx, inp.value));
    });
    root.querySelectorAll('.w20Bell').forEach((b) => {
      b.addEventListener('click', () => openBell(+b.dataset.idx));
    });
  }

  function filterList(idx, q) {
    const box = root.querySelector('.w20List[data-idx="' + idx + '"]');
    if (!box) return;
    q = (q || '').toUpperCase().trim();
    const matches = currencies.filter((c) =>
      c.code.indexOf(q) > -1 || (c.name || '').toUpperCase().indexOf(q) > -1
    ).slice(0, 60);
    box.innerHTML = matches.map((c) =>
      `<div class="w20Pick" data-idx="${idx}" data-key="${curKey(c)}" style="padding:8px 10px;cursor:pointer;font-size:.85em;border-bottom:1px solid var(--line)">${c.code} <span style="color:var(--text-dim)">— ${c.type === 'fiat' ? 'валута / USD' : 'крипто / USDC'}</span></div>`
    ).join('') || '<div style="padding:8px 10px;color:var(--text-dim);font-size:.85em">няма съвпадения</div>';
    box.style.display = 'block';
    box.querySelectorAll('.w20Pick').forEach((d) => {
      d.addEventListener('click', () => {
        slots[idx].sel = d.dataset.key;
        slots[idx]._alerted = false;
        saveSlots(slots);
        box.style.display = 'none';
        // отразяваме избора в полето веднага (без пресъздаване на грида)
        const inp = root.querySelector('.w20Search[data-idx="' + idx + '"]');
        if (inp) inp.value = slots[idx].sel.split(':')[1];
        refreshAll();
      });
    });
  }

  // затваряне на отворен dropdown при клик навън
  function onDocClick(e) {
    if (!e.target.closest || !e.target.closest('.w20Search') && !e.target.closest('.w20List')) {
      root.querySelectorAll('.w20List').forEach((l) => { l.style.display = 'none'; });
    }
  }
  document.addEventListener('click', onDocClick);

  // ── модал: прагове ──
  function openBell(idx) {
    openModalIdx = idx;
    $('#w20MNum').textContent = '#' + (idx + 1);
    renderThrList();
    $('#w20ModalBg').style.display = 'flex';
  }
  function renderThrList() {
    const s = slots[openModalIdx];
    const box = $('#w20ThrList');
    if (!s.alerts || !s.alerts.length) { box.innerHTML = '<p class="hint" style="margin-bottom:10px">Няма зададени прагове.</p>'; return; }
    box.innerHTML = s.alerts.map((a, i) =>
      `<div class="out-block" style="margin-top:0;margin-bottom:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
        <span>= ${a.val}</span>
        <button class="w20DelThr btn sec inline" data-i="${i}" style="margin-top:0;padding:4px 10px">✕</button>
      </div>`
    ).join('');
    box.querySelectorAll('.w20DelThr').forEach((b) => {
      b.addEventListener('click', () => { slots[openModalIdx].alerts.splice(+b.dataset.i, 1); saveSlots(slots); renderThrList(); updateRates(); });
    });
  }
  $('#w20AddThr').addEventListener('click', () => {
    const v = parseFloat($('#w20ThrVal').value);
    if (isNaN(v)) return;
    const s = slots[openModalIdx];
    if (!s.alerts) s.alerts = [];
    if (s.alerts.length >= 20) return;
    s.alerts.push({ val: v });
    saveSlots(slots);
    $('#w20ThrVal').value = '';
    renderThrList();
    updateRates();
  });
  $('#w20CloseModal').addEventListener('click', () => { $('#w20ModalBg').style.display = 'none'; openModalIdx = -1; });

  // ── модал: звук ──
  function renderSoundState() {
    const box = $('#w20SoundState');
    box.textContent = _customSound ? 'Зададен е персонализиран сигнал (качен от вас).' : 'Използва се вграденият сигнал по подразбиране.';
  }
  $('#w20Sound').addEventListener('click', () => { renderSoundState(); $('#w20SoundBg').style.display = 'flex'; });
  $('#w20CloseSound').addEventListener('click', () => { $('#w20SoundBg').style.display = 'none'; });
  $('#w20TestSound').addEventListener('click', () => { unlockAudio(); playAlertSound(); });
  $('#w20ResetSound').addEventListener('click', () => { clearCustomSound(); renderSoundState(); setStatus('ok', 'Върнат е вграденият сигнал.'); });
  $('#w20SoundFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 1500000) { setStatus('err', 'Файлът е твърде голям (макс. ~1.5 MB за локално пазене). Избери по-кратък сигнал.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (saveCustomSound(String(reader.result))) {
        renderSoundState();
        setStatus('ok', 'Сигналът е запазен локално.');
      } else {
        setStatus('err', 'Не може да се запази (паметта е препълнена). Избери по-малък файл.');
      }
    };
    reader.onerror = () => setStatus('err', 'Грешка при четене на файла.');
    reader.readAsDataURL(file);
  });

  // ── известия ──
  $('#w20Notify').addEventListener('click', async () => {
    unlockAudio();
    const btn = $('#w20Notify');
    const prev = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Питам за разрешение…';
    let ok = false;
    try { ok = await requestNotifyPermission(); }
    finally { btn.disabled = false; btn.textContent = ok ? '🔔 Известията са разрешени' : prev; }
    setStatus(ok ? 'ok' : 'err', ok ? 'Известията са разрешени.' : 'Известията не са разрешени (ще светва само кутийката + звук).');
  });

  // ── цикъл на опресняване + проверка на прагове ──
  async function refreshAll() {
    const sels = Array.from(new Set(slots.map((s) => s.sel).filter(Boolean)));
    if (!sels.length) { setStatus('work', 'Избери поне една двойка, за да започне следенето.'); updateRates(); return; }
    setStatus('work', 'Опресняване…');
    const { rates, ok } = await fetchRates(sels);
    if (!ok) {
      setStatus('err', 'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.');
      updateRates();
      return;
    }
    Object.keys(rates).forEach((sel) => { liveRate[sel] = rates[sel]; });

    const hits = checkCrossings(slots, rates, prevRate);
    Object.keys(rates).forEach((sel) => { prevRate[sel] = rates[sel]; }); // запомняме за следваща проверка

    if (hits.length) {
      hits.forEach((h) => { slots[h.idx]._alerted = true; });
      const h0 = hits[0];
      const dir = h0.up ? '▲ нагоре над ' : '▼ надолу под ';
      const more = hits.length > 1 ? ' (+' + (hits.length - 1) + ' още)' : '';
      const msg = 'Слот #' + (h0.idx + 1) + ' (' + h0.label + ') ' + dir + fmtRate(h0.val) + ' — сега ' + fmtRate(h0.rate) + more;
      sendNotify('Праг пресечен', msg);
      playAlertSound();
      setStatus('ok', msg);
    } else {
      setStatus('ok', 'Обновено: ' + new Date().toLocaleTimeString('bg-BG'));
    }
    updateRates();
  }

  // ── старт ──
  renderGrid();
  setStatus('work', 'Зареждам списък валути/крипто…');
  loadCurrencyList().then((list) => {
    currencies = list;
    setStatus('ok', 'Заредени ' + list.length + ' валути/крипто. Избери двойки и задай прагове.');
    refreshAll();
    timer = setInterval(refreshAll, CHECK_MS);
  }).catch(() => {
    setStatus('err', 'Списъкът с валути не се зареди (офлайн?). Опитай „↻ Опресни сега".');
  });

  $('#w20Refresh').addEventListener('click', refreshAll);

  // почистване при напускане на инструмента (смяна на хеш-маршрут)
  function cleanup() {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('click', onDocClick);
    window.removeEventListener('hashchange', cleanup);
  }
  window.addEventListener('hashchange', cleanup);
}
