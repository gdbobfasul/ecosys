// Version: 1.0001
// filepick.js — НАДЕЖДНО избиране + четене на файл (споделен между апове с файлов импорт).
// ПРИЧИНА: в Android WebView (Capacitor) `<input type=file>` често връща ПРАЗЕН файл (size 0 chars 0)
// за файлове от Downloads/Drive (content:// URI, който WebView-ът не чете през FileReader). Затова на
// ТЕЛЕФОНА ползваме нативния @capawesome/capacitor-file-picker (чете реалното съдържание като base64).
// В БРАУЗЪР падаме към класическия input + FileReader.
//
// pickTextFile()            → { name, text, size } | null            (за .json/Aegis/2FAS/otpauth и т.н.)
// pickBinaryFile(accept)    → { name, dataUrl, base64, mimeType, size } | null   (за картинки/PDF)
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
async function nativePick(readData) {
  const { FilePicker } = await import('@capawesome/capacitor-file-picker');
  let res;
  try {
    try { window.__KCY_SUSPEND_LOCK__ = true; } catch (e) {}
    res = await FilePicker.pickFiles({ readData: readData, limit: 1 });
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
    const f = await nativePick(true);
    if (!f) return null;
    // С readData:true FilePicker връща съдържанието като base64 директно (не ни трябва Filesystem).
    const text = (f.data != null && f.data !== '') ? b64ToText(f.data) : '';
    return { name: f.name || 'file', text: text, size: f.size };
  }
  const w = await webInput('*/*', false);
  if (!w) return null;
  return { name: w.file.name, text: String(w.result || ''), size: w.file.size };
}

// Двоичен файл (картинка/PDF) → { name, dataUrl, base64, mimeType, size } или null.
export async function pickBinaryFile(accept) {
  if (isNative()) {
    const f = await nativePick(true);
    if (!f) return null;
    const mime = f.mimeType || 'application/octet-stream';
    const base64 = (f.data != null && f.data !== '') ? f.data : '';
    return { name: f.name || 'file', base64: base64, dataUrl: base64 ? ('data:' + mime + ';base64,' + base64) : '', mimeType: mime, size: f.size };
  }
  const w = await webInput(accept || '*/*', true);
  if (!w) return null;
  const dataUrl = String(w.result || '');
  const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : '';
  return { name: w.file.name, dataUrl: dataUrl, base64: base64, mimeType: w.file.type || '', size: w.file.size };
}
