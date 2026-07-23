// Version: 1.0002
// filepick.js — НАДЕЖДНО избиране + четене на файл (споделен между апове с файлов импорт).
// ПРИЧИНА: в Android WebView (Capacitor) `<input type=file>` често връща ПРАЗЕН файл (size 0 chars 0)
// за файлове от Downloads/Drive (content:// URI, който WebView-ът не чете през FileReader). Затова на
// ТЕЛЕФОНА ползваме нативния @capawesome/capacitor-file-picker (чете реалното съдържание като base64).
// В БРАУЗЪР падаме към класическия input + FileReader.
//
// v1.0002: РЕЗЕРВНО ЧЕТЕНЕ — ако нативният picker върне запис БЕЗ `data` (случва се при по-големи
// медийни файлове/някои доставчици: .aac, .m4a и т.н. „избира се, но не се зарежда"), опитваме да
// прочетем байтовете от `path`/`blob` (fetch + Capacitor.convertFileSrc). Ако и това не стане →
// хвърляме ЯСНА грешка (за да не е „тихо нищо"). Подаваме и `types` към нативния picker.
//
// pickTextFile()            → { name, text, size } | null            (за .json/Aegis/2FAS/otpauth и т.н.)
// pickBinaryFile(accept)    → { name, dataUrl, base64, mimeType, size } | null   (за картинки/аудио/PDF)
//
// И двете вдигат window.__KCY_SUSPEND_LOCK__ около нативния picker — той изкарва апа на заден план,
// а някои апове авто-заключват при background (виж main.js), което би счупило операцията.
function isNative() {
  try { return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()); }
  catch (e) { return false; }
}
function b64ToText(b64) {
  const bin = atob(String(b64 || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
// ArrayBuffer → base64 (на части, за да не пръсне стека при по-големи файлове).
function bufToB64(buf) {
  const bytes = new Uint8Array(buf); let bin = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}
// accept ('audio/*','image/*','*/*') → списък типове за нативния picker (по избор).
function typesFor(accept) {
  const a = String(accept || '').trim();
  if (!a || a === '*/*') return undefined;
  return a.split(',').map((s) => s.trim()).filter(Boolean);
}
// РЕЗЕРВНО четене на байтове, когато нативният picker не върне `data`.
async function readBytesFallback(f) {
  // 1) уеб blob (в браузър/на някои платформи)
  try { if (f.blob && f.blob.arrayBuffer) return bufToB64(await f.blob.arrayBuffer()); } catch (e) {}
  // 2) път през WebView-достъпен URL (file:// → http://localhost чрез convertFileSrc)
  const path = f.path || f.webPath;
  if (path) {
    const urls = [];
    try { if (window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function') urls.push(window.Capacitor.convertFileSrc(path)); } catch (e) {}
    urls.push(path);
    for (const u of urls) {
      try { const r = await fetch(u); if (r.ok) { const b = await r.arrayBuffer(); if (b && b.byteLength) return bufToB64(b); } } catch (e) {}
    }
  }
  return '';
}
async function nativePick(readData, accept) {
  const { FilePicker } = await import('@capawesome/capacitor-file-picker');
  let res;
  const opts = { readData: readData, limit: 1 };
  const types = typesFor(accept); if (types) opts.types = types;
  try {
    try { window.__KCY_SUSPEND_LOCK__ = true; } catch (e) {}
    res = await FilePicker.pickFiles(opts);
  } finally {
    try { setTimeout(() => { window.__KCY_SUSPEND_LOCK__ = false; }, 500); } catch (e) {}
  }
  return res && res.files && res.files[0];
}
function webInput(accept, asData) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept || '*/*'; inp.style.display = 'none';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) { resolve(null); return; }
      const r = new FileReader();
      r.onload = () => resolve({ file: f, result: r.result });
      r.onerror = () => resolve(null);
      if (asData) r.readAsDataURL(f); else r.readAsText(f);
    });
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => { try { inp.remove(); } catch (e) {} }, 60000);
  });
}

// Текстов файл → { name, text, size } или null.
export async function pickTextFile() {
  if (isNative()) {
    const f = await nativePick(true, '*/*');
    if (!f) return null;
    let b64 = (f.data != null && f.data !== '') ? f.data : '';
    if (!b64) b64 = await readBytesFallback(f);       // резервно четене
    const text = b64 ? b64ToText(b64) : '';
    return { name: f.name || 'file', text: text, size: f.size };
  }
  const w = await webInput('*/*', false);
  if (!w) return null;
  return { name: w.file.name, text: String(w.result || ''), size: w.file.size };
}

// Двоичен файл (картинка/аудио/PDF) → { name, dataUrl, base64, mimeType, size } или null.
// Хвърля ЯСНА грешка, ако файлът е избран, но съдържанието не може да се прочете (за да не е тихо).
export async function pickBinaryFile(accept) {
  if (isNative()) {
    const f = await nativePick(true, accept);
    if (!f) return null;
    const mime = f.mimeType || 'application/octet-stream';
    let base64 = (f.data != null && f.data !== '') ? f.data : '';
    if (!base64) base64 = await readBytesFallback(f);   // резервно четене (напр. .aac/.m4a без data)
    if (!base64) throw new Error('Файлът „' + (f.name || '') + '" не можа да се прочете от това хранилище. Опитай да го копираш локално или избери друг.');
    return { name: f.name || 'file', base64: base64, dataUrl: 'data:' + mime + ';base64,' + base64, mimeType: mime, size: f.size };
  }
  const w = await webInput(accept || '*/*', true);
  if (!w) return null;
  const dataUrl = String(w.result || '');
  const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : '';
  return { name: w.file.name, dataUrl: dataUrl, base64: base64, mimeType: w.file.type || '', size: w.file.size };
}
