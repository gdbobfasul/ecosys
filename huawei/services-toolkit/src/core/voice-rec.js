// Version: 1.0021
// voice-rec.js — запис на гласов коментар от микрофона (за стъпките на „Видео инструкция").
// ДВА ПЪТЯ (като Auto Sound Diagnostics — EMUI WebView-ът на Huawei отказва getUserMedia дори при дадено
// разрешение):
//   1) НАТИВЕН (предпочитан в APK): window.PupikesNative.startRecord(сек) → Android AudioRecord → WAV в кеша
//      на апа → stopRecord() → getRecordBase64() → deleteRecord(). Мостът се вгражда от билда във всеки ап.
//   2) getUserMedia + MediaRecorder (браузър/устройства без моста).
// Разрешението RECORD_AUDIO се иска САМО при натискане на „Запиши глас" (android-permissions.txt).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nativeRec() {
  const n = window.PupikesNative;
  return !!(n && typeof n.startRecord === 'function' && typeof n.getRecordBase64 === 'function');
}
function webRec() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}
export function voiceAvailable() { return nativeRec() || webRec(); }

function b64ToBytes(b64) {
  const bin = atob(String(b64 || ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// Дължина на WAV (сек.) от заглавието: байтове данни / байтове в секунда.
function wavDuration(bytes) {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const byteRate = dv.getUint32(28, true);
    let p = 12;
    while (p + 8 <= bytes.length) {
      const id = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
      const size = dv.getUint32(p + 4, true);
      if (id === 'data') return byteRate ? Math.min(size, bytes.length - p - 8) / byteRate : 0;
      p += 8 + size;
    }
  } catch (e) {}
  return 0;
}
// Дължина на произволен звуков Blob (декодиране през OfflineAudioContext — без да се пуска звук).
export async function blobDuration(blob) {
  try {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ac = new OAC(1, 1, 44100);
    const buf = await ac.decodeAudioData(await blob.arrayBuffer());
    return buf.duration || 0;
  } catch (e) { return 0; }
}

// Започва запис (до maxSec). opts.raw = без потискане на ехо/шум (за „запиши синтеза" от високоговорителя).
// Връща { stop(): Promise<{ blob, mime, dur }>, running(): bool }. Грешки: 'denied' | 'nomic'.
export async function startVoice(maxSec, opts) {
  const max = Math.max(1, Math.min(30, Math.round(maxSec || 30)));
  if (nativeRec()) {
    const n = window.PupikesNative;
    let st = 'denied';
    try {
      const g = typeof n.ensureMic === 'function' ? n.ensureMic() : 'granted';
      st = n.startRecord(max);
      // Първи път: системният прозорец за разрешение е отворен → изчакваме потребителя (до ~25 сек.).
      if (st === 'denied' && g === 'requested') {
        for (let i = 0; i < 50 && st === 'denied'; i++) { await sleep(500); st = n.startRecord(max); }
      }
    } catch (e) { st = 'error'; }
    if (st === 'ok') {
      return {
        running: () => { try { return !!n.isRecording(); } catch (e) { return false; } },
        stop: async () => {
          try { n.stopRecord(); } catch (e) {}
          let b64 = '';
          try { b64 = n.getRecordBase64(); } catch (e) { b64 = ''; }
          try { n.deleteRecord(); } catch (e) {}
          if (!b64) throw new Error('empty');
          const bytes = b64ToBytes(b64);
          return { blob: new Blob([bytes], { type: 'audio/wav' }), mime: 'audio/wav', dur: wavDuration(bytes) };
        }
      };
    }
    if (st === 'denied') throw new Error('denied');
    if (!webRec()) throw new Error('nomic');
  }
  if (!webRec()) throw new Error('nomic');
  let stream;
  try {
    const raw = opts && opts.raw;
    stream = await navigator.mediaDevices.getUserMedia({ audio: raw ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : true });
  } catch (e) { throw new Error((e && e.name === 'NotAllowedError') ? 'denied' : 'nomic'); }
  const rec = new MediaRecorder(stream);
  const chunks = [];
  let on = true;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.addEventListener('stop', () => { on = false; res(); }); });
  rec.start(250);
  const auto = setTimeout(() => { try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {} }, max * 1000);
  return {
    running: () => on,
    stop: async () => {
      clearTimeout(auto);
      try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {}
      await stopped;
      try { stream.getTracks().forEach((tr) => tr.stop()); } catch (e) {}
      const mime = rec.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size) throw new Error('empty');
      return { blob, mime, dur: await blobDuration(blob) };
    }
  };
}
