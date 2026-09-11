// Version: 1.0021
// vframe.js — кадри от видео БЕЗ ffmpeg: <video> + canvas (декодерът на телефона, бързо и без увисване).
// Ползва се от „Видео инструкция" (кадрите на урока) и от „Видео инструменти" → „Кадър → снимка (JPG)".
// ПРИЧИНА (11.09.2026): в ffmpeg.wasm `-ss 2.5 -i in -frames:v 1 out.jpg` никога не завършваше —
// кадърът вече се взима от вградения декодер на WebView-а; ffmpeg остава само като резерва.

// MIME по разширение (за Blob-а на <video>; празно = браузърът сам разпознава).
export function videoMime(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m ? m[1] : '';
  return ({ mp4: 'video/mp4', m4v: 'video/mp4', '3gp': 'video/3gpp', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo', ogv: 'video/ogg' })[ext] || '';
}

// Зарежда <video> от адрес; изпълнява се, когато първият кадър е наличен (loadeddata).
export function loadVideo(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    let done = false;
    let to = null;
    const fail = (why) => { if (done) return; done = true; clearTimeout(to); reject(new Error(why)); };
    to = setTimeout(() => fail('timeout'), timeoutMs || 9000);
    v.addEventListener('loadeddata', () => {
      if (done) return;
      if (!v.videoWidth || !v.videoHeight) { fail('no-video'); return; }
      done = true; clearTimeout(to); resolve(v);
    });
    v.addEventListener('error', () => fail('decode'));
    v.src = url;
  });
}

// Прескача до секунда t и изчаква кадъра (seeked). Предпазен таймер — никога не виси.
export function seekVideo(v, t) {
  return new Promise((resolve) => {
    const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    const target = Math.max(0, dur ? Math.min(dur - 0.04, t) : t);
    if (Math.abs(v.currentTime - target) < 0.002 && v.readyState >= 2) { resolve(); return; }
    let done = false;
    const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); resolve(); };
    v.addEventListener('seeked', fin);
    setTimeout(fin, 3000);
    try { v.currentTime = target; } catch (e) { fin(); }
  });
}

export function canvasBlob(c, type, q) {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), type, q));
}

// Видео (Blob) → кадър в секунда `at` → JPEG Blob. Хвърля грешка, ако декодерът не може.
export async function grabFrameJPEG(blob, at) {
  const url = URL.createObjectURL(blob);
  let v = null;
  try {
    v = await loadVideo(url);
    await seekVideo(v, Math.max(0, +at || 0));
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return await canvasBlob(c, 'image/jpeg', 0.92);
  } finally {
    try { if (v) { v.removeAttribute('src'); v.load(); } } catch (e) {}
    URL.revokeObjectURL(url);
  }
}
