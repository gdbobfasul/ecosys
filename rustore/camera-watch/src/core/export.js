// Version: 1.0020
// export.js — износ на файл (CSV/GIF) от устройството, без нова нативна зависимост:
//   1) Capacitor Filesystem + Share (ако плъгините са налични в билда);
//   2) Web Share API (navigator.share) — с файл или с текст;
//   3) резерва за текст: копиране в клипборда (интерфейсът показва и текста за ръчно копиране);
//      резерва за двоични данни: класическо сваляне (работи в браузър).
// Връща { ok, how } — how ∈ 'native' | 'share' | 'copied' | 'download' | 'none'.

function capPlugins() {
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() && cap.Plugins) return cap.Plugins;
  } catch (_) {}
  return null;
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function nativeSave(filename, bytes) {
  const P = capPlugins();
  if (!P || !P.Filesystem) return false;
  try {
    const res = await P.Filesystem.writeFile({ path: filename, data: bytesToBase64(bytes), directory: 'CACHE' });
    try { if (P.Share) await P.Share.share({ title: filename, url: res.uri }); } catch (_) {}
    return true;
  } catch (_) { return false; }
}

async function webShareFile(filename, bytes, mime) {
  try {
    if (typeof navigator === 'undefined' || !navigator.share || typeof File === 'undefined') return false;
    const file = new File([bytes], filename, { type: mime });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch (e) { return !!(e && e.name === 'AbortError'); }
}

async function webShareText(title, text) {
  try {
    if (typeof navigator === 'undefined' || !navigator.share) return false;
    await navigator.share({ title, text });
    return true;
  } catch (e) { return !!(e && e.name === 'AbortError'); }
}

export async function copyText(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (_) { return false; }
}

function webDownload(filename, bytes, mime) {
  try {
    const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return true;
  } catch (_) { return false; }
}

// Текстов файл (CSV). Резервата е клипбордът — винаги работи и в WebView.
export async function exportText(filename, text, mime = 'text/csv') {
  const bytes = new TextEncoder().encode(text);
  if (await nativeSave(filename, bytes)) return { ok: true, how: 'native' };
  if (await webShareFile(filename, bytes, mime)) return { ok: true, how: 'share' };
  if (await webShareText(filename, text)) return { ok: true, how: 'share' };
  if (await copyText(text)) return { ok: true, how: 'copied' };
  return { ok: false, how: 'none' };
}

// Двоичен файл (GIF).
export async function exportBytes(filename, bytes, mime) {
  if (await nativeSave(filename, bytes)) return { ok: true, how: 'native' };
  if (await webShareFile(filename, bytes, mime)) return { ok: true, how: 'share' };
  if (webDownload(filename, bytes, mime)) return { ok: true, how: 'download' };
  return { ok: false, how: 'none' };
}
