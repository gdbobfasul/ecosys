// Version: 1.0001
// camera.js — източник на видео: собствена камера на телефона (getUserMedia) ИЛИ
// „Друга камера“ (browser-playable поток по URL).
//
// ЧЕСТНО (важно):
//   • Собствената камера работи навсякъде, където има getUserMedia (телефон, dev браузър
//     с уебкамера). Headless среда НЯМА камера → връщаме грациозен отказ, не се сриваме.
//   • „Друга камера“ работи САМО ако потокът е възпроизводим в браузър и позволява CORS:
//       - MJPEG (multipart) или статичен/опресняващ се JPEG → зареждаме в <img>;
//       - HLS .m3u8 / progressive HTTP видео, което <video> разбира → зареждаме в <video>.
//     RTSP и произволни IP камери НЕ се поддържат директно от браузър — трябва сървър/
//     gateway, който транскодира към HLS/MJPEG. Това е документирано, не е скрито.
//
// Модулът е чиста логика около подадените <video>/<img>/<canvas> елементи.

// Стартира задната камера на телефона в подаден <video>.
// Връща { ok, stream } или { ok:false, reason }.
export async function startPhoneCamera(videoEl, { facingMode = 'environment' } = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return { ok: false, reason: 'Това устройство/среда не поддържа камера (няма getUserMedia).' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode }, audio: false
    });
    if (videoEl) {
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', '');
      videoEl.muted = true;
      try { await videoEl.play(); } catch (_) { /* автоплей понякога чака жест */ }
    }
    return { ok: true, stream };
  } catch (e) {
    const name = (e && e.name) || '';
    let reason = 'Не успях да отворя камерата.';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      reason = 'Достъпът до камерата е отказан. Разреши камерата за приложението и опитай пак.';
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      reason = 'Не открих камера на това устройство.';
    } else if (name === 'NotReadableError') {
      reason = 'Камерата е заета от друго приложение.';
    }
    return { ok: false, reason };
  }
}

// Спира всички пътеки на потока (освобождава камерата).
export function stopPhoneCamera(stream) {
  try {
    if (stream && typeof stream.getTracks === 'function') {
      for (const t of stream.getTracks()) { try { t.stop(); } catch (_) {} }
    }
  } catch (_) {}
}

// Стартира „Друга камера“ по URL. Връща { ok, mode, el } или { ok:false, reason }.
//   mode: 'video' (HLS/progressive) или 'image' (MJPEG/JPEG).
// videoEl и imgEl са двата кандидат-приемника; ползваме подходящия според URL-а.
export function startOtherCamera(url, { videoEl, imgEl } = {}) {
  const u = String(url || '').trim();
  if (!u) return { ok: false, reason: 'Не е въведен URL за „Друга камера“.' };
  let parsed;
  try { parsed = new URL(u); } catch (_) {
    return { ok: false, reason: 'Невалиден URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Поддържат се само http(s) потоци, възпроизводими в браузър. RTSP не се поддържа без сървър/gateway.' };
  }

  const lower = parsed.pathname.toLowerCase();
  const isVideoLike = lower.endsWith('.m3u8') || lower.endsWith('.mp4') ||
    lower.endsWith('.webm') || lower.endsWith('.ogg');

  if (isVideoLike && videoEl) {
    videoEl.crossOrigin = 'anonymous'; // нужно за четене на пиксели от canvas (CORS)
    videoEl.setAttribute('playsinline', '');
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.src = u;
    try { videoEl.play().catch(() => {}); } catch (_) {}
    return { ok: true, mode: 'video', el: videoEl };
  }

  // Иначе третираме като MJPEG/JPEG поток в <img>.
  if (imgEl) {
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = u;
    return { ok: true, mode: 'image', el: imgEl };
  }

  return { ok: false, reason: 'Няма приемник за потока.' };
}

export function stopOtherCamera({ videoEl, imgEl } = {}) {
  try { if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } } catch (_) {}
  try { if (imgEl) { imgEl.removeAttribute('src'); } } catch (_) {}
}

// Рисува текущия кадър от източник (<video> или <img>) в <canvas> с даден размер.
// Връща { ok, w, h } или { ok:false, reason }.
// При CORS-замърсен <img>/<video> drawImage минава, но getImageData по-късно хвърля —
// това се хваща в motion-detector/recognizer и се докладва честно.
export function grabFrame(srcEl, canvasEl, { maxW = 0 } = {}) {
  try {
    const natW = srcEl.videoWidth || srcEl.naturalWidth || srcEl.width || 0;
    const natH = srcEl.videoHeight || srcEl.naturalHeight || srcEl.height || 0;
    if (!natW || !natH) return { ok: false, reason: 'Още няма кадър от източника.' };

    let w = natW, h = natH;
    if (maxW && natW > maxW) {
      const scale = maxW / natW;
      w = Math.round(natW * scale);
      h = Math.round(natH * scale);
    }
    canvasEl.width = w;
    canvasEl.height = h;
    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(srcEl, 0, 0, w, h);
    return { ok: true, w, h };
  } catch (e) {
    return { ok: false, reason: 'Не успях да хвана кадър от източника.' };
  }
}

// Прави малък JPEG data URL от canvas (за снимка в журнала). Тих fail → null.
export function snapshotDataUrl(canvasEl, { maxW = 160, quality = 0.6 } = {}) {
  try {
    const sw = canvasEl.width, sh = canvasEl.height;
    if (!sw || !sh) return null;
    const scale = sw > maxW ? maxW / sw : 1;
    const tw = Math.max(1, Math.round(sw * scale));
    const th = Math.max(1, Math.round(sh * scale));
    const tmp = document.createElement('canvas');
    tmp.width = tw; tmp.height = th;
    tmp.getContext('2d').drawImage(canvasEl, 0, 0, tw, th);
    return tmp.toDataURL('image/jpeg', quality);
  } catch (_) {
    return null; // напр. CORS-замърсен canvas (cross-origin поток) — без снимка
  }
}
