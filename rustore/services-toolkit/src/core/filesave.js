// Version: 1.0015
// filesave.js — НАДЕЖДНО записване на файл и на телефона, и в браузъра.
// ПРИЧИНА: в Android WebView (Capacitor) трикът `<a download>` НЕ записва нищо — WebView-ът
// го игнорира тихо (същият бъг, поправен и в authenticator). На телефона пишем РЕАЛЕН файл
// през Filesystem (кеша на апа) и веднага отваряме Споделяне, за да го запазиш където искаш.
// В браузъра — класическото сваляне. Плъгините се взимат СИНХРОННО от window.Capacitor.Plugins
// (динамичният import в WebView понякога увисва).

function capPlugins() {
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() && cap.Plugins) return cap.Plugins;
  } catch (e) {}
  return null;
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new TextEncoder().encode(String(data));
}

function webDownload(filename, data, mime) {
  const blob = (typeof Blob !== 'undefined' && data instanceof Blob)
    ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// Записва файл. Телефон: кеш + Споделяне; браузър: сваляне. Връща { ok, native }.
export async function saveFile(filename, data, mime) {
  const P = capPlugins();
  if (P && P.Filesystem) {
    try {
      const bytes = await toBytes(data);
      const res = await P.Filesystem.writeFile({ path: filename, data: bytesToBase64(bytes), directory: 'CACHE' });
      try { if (P.Share) await P.Share.share({ title: filename, url: res.uri }); } catch (e) { /* отказан share → файлът пак е записан */ }
      return { ok: true, native: true, uri: res.uri };
    } catch (e) { /* пада към web пътя */ }
  }
  webDownload(filename, data, mime);
  return { ok: true, native: false };
}
