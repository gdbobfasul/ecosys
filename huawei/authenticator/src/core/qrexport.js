// qrexport.js — „Експортирай всички": за всеки акаунт прави QR картинка (PNG) от
// неговия otpauth:// линк и ги пакетира в един .zip за сваляне.
import { buildOtpauthURI } from './otp.js';
import { zipStore } from './zip.js';
import { session } from './storage.js';

function dataURLtoBytes(durl) {
  const b64 = durl.split(',')[1] || '';
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

function sanitize(s) {
  return String(s || '').replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'acc';
}

// Връща { ok, count } или { ok:false, reason:'empty'|'nolib' }.
export async function exportAllQR() {
  const entries = session.entries;
  if (!entries.length) return { ok: false, reason: 'empty' };

  let QR;
  try { QR = (await import('qrcode')).default; } catch (e) { QR = null; }
  if (!QR) return { ok: false, reason: 'nolib' };

  const files = [];
  const used = {};
  for (const e of entries) {
    const uri = buildOtpauthURI(e);
    const durl = await QR.toDataURL(uri, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
    let base = sanitize((e.issuer ? e.issuer + '-' : '') + (e.account || 'acc'));
    let name = base, n = 1;
    while (used[name]) name = base + '_' + (++n);
    used[name] = 1;
    files.push({ name: name + '.png', data: dataURLtoBytes(durl) });
  }

  const blob = zipStore(files);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kcy-authenticator-qr.zip';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return { ok: true, count: files.length };
}
