// Version: 1.0001
// audio.js — прихващане на звук от микрофона (getUserMedia) и извличане на акустични признаци
// с Web Audio API (AnalyserNode). БЕЗ AI, БЕЗ мрежа — всичко се смята на устройството.
// Връща вектор от признаци 0..1, който analyze.js сравнява с базата PROBLEMS (data.js).
//
// Признаци: rumble/lowmid/mid/highmid/high (честотни ленти), knock (тежко ритмично тропане),
// tick (бързо цъкане), squeal (устойчив писклив тон), grind (широколентово стържене),
// hiss (равномерно съскане), rough (пулсираща/неравна работа), loud (обща сила).

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function AC() { return window.AudioContext || window.webkitAudioContext; }

// Проверка за наличен микрофон/аудио стек.
export function micAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && AC());
}

// Записва ~durationMs, вика onLevel(0..1) на всеки кадър (за визуализация), после връща признаците.
// onLevel е по избор. Хвърля грешка при отказан/липсващ микрофон — викащият показва съобщение.
export async function analyzeMic(durationMs, onLevel) {
  if (!micAvailable()) throw new Error('no-mic');
  const dur = Math.max(2000, Math.min(8000, durationMs || 4500));
  let stream = null, ctx = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    ctx = new (AC())();
    const srcNode = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.0;   // без изглаждане — ловим импулсите (тропане/цъкане)
    srcNode.connect(analyser);

    const bins = analyser.frequencyBinCount;              // 2048
    const sr = ctx.sampleRate || 44100;
    const binHz = sr / analyser.fftSize;                  // ширина на бин в Hz
    const freq = new Uint8Array(bins);
    const time = new Uint8Array(analyser.fftSize);

    // граници на лентите → индекси на бинове
    const idx = (hz) => Math.max(0, Math.min(bins - 1, Math.round(hz / binHz)));
    const B = {
      rumble: [idx(20), idx(120)], lowmid: [idx(120), idx(400)], mid: [idx(400), idx(2000)],
      highmid: [idx(2000), idx(6000)], high: [idx(6000), Math.min(bins - 1, idx(16000))]
    };
    const bandAvg = (name) => { const [a, b] = B[name]; let s = 0, n = 0; for (let i = a; i <= b; i++) { s += freq[i]; n++; } return n ? s / n / 255 : 0; };
    // спектрална „плоскост" (шум срещу тон) в дадена лента: geomean/mean → 1=шум, ~0=чист тон
    const flatness = (name) => {
      const [a, b] = B[name]; let logSum = 0, lin = 0, n = 0;
      for (let i = a; i <= b; i++) { const v = freq[i] / 255 + 1e-6; logSum += Math.log(v); lin += v; n++; }
      if (!n) return 1; const gm = Math.exp(logSum / n), am = lin / n; return clamp01(gm / (am + 1e-6));
    };
    // остротата на върха в лента: max/avg → голямо = тесен силен тон (писък)
    const peakiness = (name) => {
      const [a, b] = B[name]; let mx = 0, s = 0, n = 0; for (let i = a; i <= b; i++) { const v = freq[i]; if (v > mx) mx = v; s += v; n++; } const av = n ? s / n : 0; return av > 4 ? clamp01((mx / (av + 1e-6) - 1) / 6) : 0;
    };

    // акумулатори през кадрите
    const acc = { rumble: 0, lowmid: 0, mid: 0, highmid: 0, high: 0 };
    const rmsSeq = [];                 // времева обвивка (сила по кадри) → за ритъм/грапавина
    let squealPersist = 0, hissPersist = 0, frames = 0;
    let lastLevel = 0;

    const start = ctx.currentTime;
    await new Promise((resolve) => {
      const tick = () => {
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(time);
        // RMS от времевата форма (0..1)
        let sq = 0; for (let i = 0; i < time.length; i++) { const d = (time[i] - 128) / 128; sq += d * d; }
        const rms = Math.sqrt(sq / time.length);
        rmsSeq.push(rms);
        lastLevel = clamp01(rms * 3);
        if (typeof onLevel === 'function') { try { onLevel(lastLevel); } catch (_) {} }

        acc.rumble += bandAvg('rumble'); acc.lowmid += bandAvg('lowmid'); acc.mid += bandAvg('mid');
        acc.highmid += bandAvg('highmid'); acc.high += bandAvg('high');
        // писък: тесен силен връх в highmid/high, който се задържа
        const pk = Math.max(peakiness('highmid'), peakiness('high'));
        if (pk > 0.45) squealPersist++;
        // съскане: широколентов шум (плосък спектър) в highmid, устойчив, без силна модулация
        if (flatness('highmid') > 0.55 && bandAvg('highmid') > 0.12) hissPersist++;
        frames++;

        if (ctx.currentTime - start >= dur / 1000) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // ── обобщаване на лентите ──
    const f = frames || 1;
    const rumble = clamp01(acc.rumble / f * 1.6);
    const lowmid = clamp01(acc.lowmid / f * 1.5);
    const mid = clamp01(acc.mid / f * 1.6);
    const highmid = clamp01(acc.highmid / f * 1.8);
    const high = clamp01(acc.high / f * 2.2);
    const loud = clamp01((rmsSeq.reduce((a, b) => a + b, 0) / f) * 3);

    // ── ритъм/грапавина от обвивката ──
    const mean = rmsSeq.reduce((a, b) => a + b, 0) / f;
    let varSum = 0; for (const v of rmsSeq) varSum += (v - mean) * (v - mean);
    const cv = mean > 0.01 ? Math.sqrt(varSum / f) / mean : 0;          // коеф. на вариация
    const rough = clamp01((cv - 0.15) * 1.4);                          // неравна работа/прекъсване

    // броене на пикове в обвивката → честота на ударите
    let peaks = 0; const thr = mean + Math.sqrt(varSum / f) * 0.8;
    for (let i = 1; i < rmsSeq.length - 1; i++) { if (rmsSeq[i] > thr && rmsSeq[i] >= rmsSeq[i - 1] && rmsSeq[i] > rmsSeq[i + 1]) peaks++; }
    const secs = dur / 1000; const peakRate = peaks / secs;            // удари в секунда
    // тежко тропане (knock): по-бавни удари + доминира ниската лента
    const lowDom = clamp01((rumble + lowmid) - (highmid + high) + 0.3);
    const knock = clamp01((peakRate >= 2 && peakRate <= 22 ? (peakRate / 22) : 0) * (0.4 + lowDom));
    // бързо цъкане (tick): по-чести удари + повече средна/висока лента
    const hiDom = clamp01((mid + highmid) - rumble + 0.2);
    const tick = clamp01((peakRate > 6 ? Math.min(1, peakRate / 30) : 0) * (0.4 + hiDom));

    const squeal = clamp01(squealPersist / f * 1.5);
    const hiss = clamp01(hissPersist / f * 1.4);
    // стържене (grind): широколентов, шумен (плосък) звук със сила в mid+high, но не чист тон
    const grind = clamp01(((mid + high) / 2) * (0.4 + flatnessAvg()) - squeal * 0.5);

    function flatnessAvg() { return clamp01((flatness('mid') + flatness('high')) / 2); }

    return {
      rumble, lowmid, mid, highmid, high, knock, tick, squeal, grind, hiss, rough, loud,
      _meta: { frames: f, peakRate: +peakRate.toFixed(2), durationMs: dur }
    };
  } finally {
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { if (ctx && ctx.close) ctx.close(); } catch (_) {}
  }
}
