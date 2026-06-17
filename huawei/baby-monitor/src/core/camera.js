// camera.js — камера на живо + хващане на кадри.
//
// ПРИНЦИПИ:
//   • on-device; камерата на телефона през getUserMedia. Без качване на видео никъде.
//   • Графично пада: ако камерата е отказана/липсва (напр. headless dev), казваме честно
//     и приложението пак тръгва (просто без наблюдение).
//   • „Друга камера“ по избор: само browser-playable поток (HLS/HTTP MJPEG/.m3u8/.mp4),
//     който <video> може да изсвири директно + CORS позволява четене на пиксели.
//     RTSP НЕ се поддържа от браузъра — честно го документираме (нужен е gateway/transcode).

// Стартира камерата на телефона в подаден <video>.
// facing: 'front' (потребителска) | 'back' (environment).
// Връща { ok, stream } или { ok:false, reason }.
export async function startDeviceCamera(videoEl, { facing = 'front' } = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return { ok: false, reason: 'Това устройство/среда не поддържа камера (няма getUserMedia).' };
  }
  const facingMode = facing === 'back' ? 'environment' : 'user';
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

// „Друга камера“: зарежда browser-playable поток по URL в подаден <video>.
// ВАЖНО (честно): браузърът може да чете пиксели само ако:
//   1) URL-ът е поток, който <video> може да изсвири (HTTP MJPEG, .mp4, HLS .m3u8 при поддръжка), и
//   2) сървърът връща CORS (Access-Control-Allow-Origin), иначе canvas се „опетнява“ и
//      движението/детекцията спират да четат пиксели.
// RTSP (повечето IP камери) НЕ работи директно в браузър — нужен е gateway/transcode.
export async function startUrlCamera(videoEl, url) {
  const u = String(url || '').trim();
  if (!u) return { ok: false, reason: 'Не е зададен URL за другата камера.' };
  if (/^rtsp:/i.test(u)) {
    return {
      ok: false,
      reason: 'RTSP не се поддържа от браузъра. Нужен е gateway/транскодиране до HLS/MJPEG.'
    };
  }
  try {
    videoEl.srcObject = null;
    videoEl.crossOrigin = 'anonymous'; // нужно, за да можем да четем пиксели (ако CORS позволи)
    videoEl.setAttribute('playsinline', '');
    videoEl.muted = true;
    videoEl.src = u;
    await new Promise((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(new Error('load')); };
      function cleanup() {
        videoEl.removeEventListener('loadeddata', ok);
        videoEl.removeEventListener('error', bad);
      }
      videoEl.addEventListener('loadeddata', ok, { once: true });
      videoEl.addEventListener('error', bad, { once: true });
      setTimeout(bad, 8000);
    });
    try { await videoEl.play(); } catch (_) {}
    return { ok: true, stream: null };
  } catch (e) {
    return { ok: false, reason: 'Не успях да заредя потока от URL. Провери адреса/CORS/формата.' };
  }
}

// Спира всички пътеки на потока (освобождава камерата).
export function stopCamera(stream, videoEl) {
  try {
    if (stream && typeof stream.getTracks === 'function') {
      for (const t of stream.getTracks()) { try { t.stop(); } catch (_) {} }
    }
  } catch (_) {}
  try {
    if (videoEl) {
      videoEl.srcObject = null;
      if (videoEl.src) { videoEl.removeAttribute('src'); videoEl.load(); }
    }
  } catch (_) {}
}

// Рисува текущия кадър от <video> в подаден <canvas>. Връща { ok, w, h } или { ok:false }.
export function grabFrame(videoEl, canvasEl) {
  try {
    const w = videoEl.videoWidth || 0;
    const h = videoEl.videoHeight || 0;
    if (!w || !h) return { ok: false, reason: 'Още няма кадър от камерата.' };
    canvasEl.width = w; canvasEl.height = h;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, w, h);
    return { ok: true, w, h };
  } catch (e) {
    // Често: „опетнен“ canvas от cross-origin поток без CORS.
    return { ok: false, reason: 'Не успях да хвана кадър (възможно cross-origin без CORS).' };
  }
}

// Прави JPEG dataURL снимка от canvas (за дневника). Малък размер за пестене на място.
export function snapshotDataUrl(canvasEl, { maxW = 320, quality = 0.6 } = {}) {
  try {
    const sw = canvasEl.width, sh = canvasEl.height;
    if (!sw || !sh) return null;
    const scale = Math.min(1, maxW / sw);
    const tw = Math.max(1, Math.round(sw * scale));
    const th = Math.max(1, Math.round(sh * scale));
    const tmp = document.createElement('canvas');
    tmp.width = tw; tmp.height = th;
    tmp.getContext('2d').drawImage(canvasEl, 0, 0, tw, th);
    return tmp.toDataURL('image/jpeg', quality);
  } catch (_) {
    return null; // напр. опетнен canvas
  }
}

// Има ли изобщо камера на тази среда (за graceful guard в headless).
export function cameraSupported() {
  return typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';
}
