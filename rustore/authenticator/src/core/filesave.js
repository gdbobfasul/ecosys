// Version: 1.0001
// filesave.js — НАДЕЖДНО записване на файл и на телефона, и в браузъра.
//
// ПРИЧИНА (защо експортът „не работеше"): в Android WebView (Capacitor) трикът `<a download>`
// НЕ записва нищо — WebView-ът го игнорира тихо. Затова на телефона пишем РЕАЛЕН файл през
// @capacitor/filesystem (в кеша на апа) и веднага отваряме Споделяне (@capacitor/share), за да
// го запазиш където искаш (Сваляния/Drive/Aegis/изпрати го). В браузъра падаме към класическото
// сваляне. data може да е текст (string) ИЛИ двоично (Uint8Array/Blob).

function isNative() {
  try {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  } catch (_) { return false; }
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return new TextEncoder().encode(String(data));
}

function webDownload(filename, data, mime) {
  const blob = (typeof Blob !== 'undefined' && data instanceof Blob)
    ? data
    : new Blob([data], { type: mime || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// Записва файл. На телефона: пише в кеша + отваря Споделяне. В браузъра: сваля.
// isText:true → текстов файл (UTF-8) без base64. Връща { ok, native, shared?, uri? }.
export async function saveFile(filename, data, mime, { isText = false } = {}) {
  if (isNative()) {
    try {
      const fsmod = await import('@capacitor/filesystem');
      const { Filesystem, Directory, Encoding } = fsmod;
      let writeOpts;
      if (isText && typeof data === 'string') {
        writeOpts = { path: filename, data, directory: Directory.Cache, encoding: Encoding.UTF8 };
      } else {
        const bytes = await toBytes(data);
        writeOpts = { path: filename, data: bytesToBase64(bytes), directory: Directory.Cache };
      }
      const res = await Filesystem.writeFile(writeOpts);
      let shared = false;
      try {
        const shmod = await import('@capacitor/share');
        await shmod.Share.share({ title: filename, text: filename, url: res.uri });
        shared = true;
      } catch (_) { /* без share/отказ → файлът пак е записан в кеша на апа */ }
      return { ok: true, native: true, shared, uri: res.uri };
    } catch (e) {
      try { webDownload(filename, data, mime); return { ok: true, native: false }; } catch (_) { return { ok: false, error: String(e) }; }
    }
  }
  webDownload(filename, data, mime);
  return { ok: true, native: false };
}
