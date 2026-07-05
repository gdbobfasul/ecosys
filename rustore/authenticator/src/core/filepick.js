// Version: 1.0001
// filepick.js — НАДЕЖДНО избиране + четене на ТЕКСТОВ файл (Aegis / 2FAS / otpauth / .json бекъп).
// ПРИЧИНА: в Android WebView (Capacitor) `<input type=file>` често връща ПРАЗЕН файл (size 0 chars 0)
// за файлове от Downloads/Drive — те идват като content:// URI, който WebView-ът не чете през
// FileReader. Затова на ТЕЛЕФОНА ползваме нативния @capawesome/capacitor-file-picker (чете реалното
// съдържание като base64). В БРАУЗЪР падаме към класическия input + FileReader.
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

// Връща { name, text } или null (отказ). Хвърля при реална грешка — викащият я лови и показва.
export async function pickTextFile() {
  if (isNative()) {
    const { FilePicker } = await import('@capawesome/capacitor-file-picker');
    // ВАЖНО: нативният picker изкарва апа на заден план → visibilitychange авто-заключва трезора →
    // записът на импорта пада с „locked". Затова СПИРАМЕ авто-заключването докато picker-ът е активен
    // (флагът се чете от main.js). Изчистваме със закъснение, за да покрием прехода при връщане.
    let res;
    try {
      try { window.__KCY_SUSPEND_LOCK__ = true; } catch (e) {}
      res = await FilePicker.pickFiles({ readData: true, limit: 1 });
    } finally {
      try { setTimeout(() => { window.__KCY_SUSPEND_LOCK__ = false; }, 500); } catch (e) {}
    }
    const f = res && res.files && res.files[0];
    if (!f) return null;                                  // потребителят отказа
    let text = '';
    if (f.data != null && f.data !== '') {
      text = b64ToText(f.data);                           // базовият път: съдържанието идва като base64
    } else if (f.path) {
      // Резерва: чети файла по path/URI през Filesystem (пак base64 → текст).
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const r = await Filesystem.readFile({ path: f.path });
        text = (typeof r.data === 'string') ? b64ToText(r.data) : String(r.data || '');
      } catch (e) { /* остава празно → викащият ще види празен файл */ }
    }
    return { name: f.name || 'file', text: text, size: f.size };
  }
  // Браузър: класически input + FileReader.
  return await new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '*/*'; inp.style.display = 'none';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) { resolve(null); return; }
      const r = new FileReader();
      r.onload = () => resolve({ name: f.name, text: String(r.result || ''), size: f.size });
      r.onerror = () => resolve(null);
      r.readAsText(f);
    });
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => { try { inp.remove(); } catch (e) {} }, 60000);
  });
}
