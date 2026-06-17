// Планировчик на робота.
//
// В браузъра / preview: ползва setInterval (WEB_TICK_MS) и при всеки тик
// проверява кои watch-ове са „узрели" според своята честота.
//
// На устройство: същата логика върви, докато приложението е на преден план.
// ИСТИНСКИ фонов режим (когато екранът е угаснал) изисква foreground service
// или @capacitor/background-runner — виж scaffold-а в края на файла и README.

import { WEB_TICK_MS } from '../config.js';
import { fetchValue } from './api.js';
import { notify } from './notifier.js';
import { saveState, pushLog } from './storage.js';

// Честоти в милисекунди.
export const FREQ = {
  '15min': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  'daily': 24 * 60 * 60 * 1000
};

let timer = null;
let runningState = null;
let onUpdate = null;

function conditionMet(watch, value) {
  if (watch.condition === 'below') return value <= watch.target;
  if (watch.condition === 'above') return value >= watch.target;
  return false;
}

// Проверява един watch (ако е узрял). Връща true при промяна на състоянието.
async function checkWatch(state, watch, force = false) {
  const due = force || !watch.lastCheck || (Date.now() - watch.lastCheck) >= (FREQ[watch.freq] || FREQ['1h']);
  if (!due || watch.paused) return false;
  try {
    const { value, source } = await fetchValue(watch);
    watch.lastValue = value;
    watch.lastCheck = Date.now();
    watch.lastSource = source;
    watch.error = null;
    if (conditionMet(watch, value)) {
      if (watch.status !== 'hit') {
        watch.status = 'hit';
        const label = `${watch.symbol} ${watch.condition === 'below' ? '≤' : '≥'} ${watch.target}`;
        const msg = `${watch.symbol}: ${formatVal(value)} (${source})`;
        await notify('Цена-робот: праг достигнат', `${label} — сега ${msg}`);
        pushLog(state, `🔔 ${label} достигнат — стойност ${formatVal(value)}`);
      }
    } else {
      watch.status = 'watching';
    }
    return true;
  } catch (e) {
    watch.error = (e && e.message) || 'грешка';
    watch.lastCheck = Date.now();
    pushLog(state, `⚠️ ${watch.symbol}: ${watch.error}`);
    return true;
  }
}

export function formatVal(v) {
  if (!isFinite(v)) return '—';
  if (v >= 1000) return v.toLocaleString('bg-BG', { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

// Едно преминаване през всички watch-ове.
export async function tick(state, force = false) {
  if (!state.masterOn && !force) return;
  let changed = false;
  for (const w of state.watches) {
    const c = await checkWatch(state, w, force);
    changed = changed || c;
  }
  if (changed) {
    await saveState(state);
    if (onUpdate) onUpdate(state);
  }
}

// Стартира периодичния таймер (уеб/преден план).
export function start(state, updateCb) {
  runningState = state;
  onUpdate = updateCb;
  stop();
  // веднага едно преминаване, после на интервал
  tick(runningState).catch(() => {});
  timer = setInterval(() => {
    if (runningState && runningState.masterOn) tick(runningState).catch(() => {});
  }, WEB_TICK_MS);
}

export function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

// Ръчна незабавна проверка (бутон „провери сега").
export async function checkNow(state, updateCb) {
  await tick(state, true);
  if (updateCb) updateCb(state);
}

// --- Scaffold за истински фонов режим на устройство (TODO, документиран в README) ---
// @capacitor/background-runner стартира отделен JS контекст по график дори при угаснал екран.
// Тук е само скелетът; той изисква native plugin + runner-конфигурация в capacitor.config.json.
export async function registerBackgroundRunner() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;
    // TODO: при добавен '@capacitor/background-runner':
    //   const { BackgroundRunner } = await import('@capacitor/background-runner');
    //   await BackgroundRunner.dispatchEvent({ label: 'pwb.check', event: 'checkPrices', details: {} });
    // Логиката на checkPrices трябва да повтори tick() в runner контекста.
    return false;
  } catch {
    return false;
  }
}
