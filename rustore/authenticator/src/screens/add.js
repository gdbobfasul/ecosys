// Version: 1.0011
// add.js — нов акаунт: сканиране на QR код (камера + jsQR) ИЛИ ръчно въвеждане.
import { h, mount, toast, showAlert, promptPassword } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { addEntry } from '../core/storage.js';
import { parseOtpauthURI } from '../core/otp.js';
import { base32Decode } from '../core/base32.js';
import { importQRData, importJsonText, import2FASText, import2FASEncrypted, importOtpauthList, isImportableQR, describeResult } from '../core/importer.js';
import { importAegisFile } from './aegis-import.js';
import { pickTextFile, pickBinaryFile } from '../core/filepick.js';

let activeStream = null;
let rafId = null;

function stopCamera() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (activeStream) {
    activeStream.getTracks().forEach((tr) => { try { tr.stop(); } catch (e) {} });
    activeStream = null;
  }
}

export function renderAdd(root, nav) {
  stopCamera();
  let mode = 'manual';

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => { stopCamera(); nav.go('list'); } }, '←'),
    h('h1', { text: t('add_title') })
  );

  const body = h('div', { class: 'content' });

  // ВСИЧКИ начини за добавяне/импорт на ЕДНО място (по молба — нищо да не е скрито само в
  // Настройки): камера, QR от изображение, ръчно/otpauth, файл (.json бекъп ИЛИ Aegis).
  const MODES = [
    { key: 'scan', label: '📷 ' + t('scan_qr') },
    { key: 'upload', label: '🖼 ' + t('upload_file') },
    { key: 'manual', label: '⌨ ' + t('enter_manually') },
    { key: 'file', label: '📁 ' + t('import_file') }
  ];
  const seg = h('div', { class: 'seg' },
    ...MODES.map((m) => h('button', { onclick: () => setMode(m.key) }, m.label))
  );

  function setMode(m) {
    mode = m;
    [...seg.children].forEach((b, i) => b.classList.toggle('on', MODES[i].key === m));
    stopCamera();
    if (m === 'scan') renderScan();
    else if (m === 'upload') renderUpload();
    else if (m === 'file') renderFile();
    else renderManual();
  }

  // Декодира QR код от картинка, подадена като dataURL (jsQR върху пикселите).
  async function decodeImageDataUrl(dataUrl) {
    let jsQR = null;
    try { jsQR = (await import('jsqr')).default; } catch (e) { jsQR = window.jsQR || null; }
    if (!jsQR) return null;
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(d.data, d.width, d.height);
      return found && found.data ? found.data : null;
    } catch (e) { return null; }
  }

  // Импортира декодиран QR низ (единичен otpauth ИЛИ Google миграция) през обединения импортер;
  // показва КОЛКО кода и ПО КАКЪВ начин (+ дубликати) и навигира при успех. Връща res.
  async function runImport(promise) {
    const res = await promise;
    toast(describeResult(res));
    if (res && res.ok && res.imported > 0) nav.go('list');
    return res;
  }

  function renderUpload() {
    // Картинката минава през НАДЕЖДНИЯ pickBinaryFile (нативен picker на телефон → чете реалните
    // байтове; input в браузър), защото `<input type=file>` в Android WebView връщаше ПРАЗЕН файл.
    const status = h('p', { class: 'muted', style: 'text-align:center', text: t('scan_hint') });
    async function pickAndDecode() {
      const dbg = ['=== QR image import debug ==='];
      try {
        const picked = await pickBinaryFile('image/*');
        if (!picked) return;                                // отказ
        dbg.push('file=' + (picked.name || '?') + ' size=' + (picked.size != null ? picked.size : '?') + ' mime=' + (picked.mimeType || '?') + ' dataUrlChars=' + (picked.dataUrl ? picked.dataUrl.length : 0));
        if (!picked.dataUrl) { status.textContent = t('import_empty'); status.style.color = 'var(--danger)'; showAlert('Import debug', dbg.join('\n')); return; }
        const uri = await decodeImageDataUrl(picked.dataUrl);
        dbg.push('qr: ' + (uri ? ('decoded chars=' + uri.length) : 'NOT FOUND'));
        if (!uri) { status.textContent = t('qr_not_found'); status.style.color = 'var(--danger)'; return; }
        const res = await runImport(importQRData(uri));
        dbg.push('result: ' + (res && res.ok ? 'ok imported=' + res.imported + ' dup=' + res.duplicates : 'reason=' + (res && res.reason)));
        if (res && !res.ok) showAlert('Import debug', dbg.join('\n'));   // дебъг при неуспех
      } catch (err) {
        dbg.push('EXCEPTION: ' + (err && (err.stack || err.message) || err));
        showAlert('Import debug', dbg.join('\n'));
      }
    }
    mount(body, seg,
      h('button', { class: 'btn', onclick: pickAndDecode, text: '🖼 ' + t('upload_file') }),
      status,
      h('button', { class: 'btn ghost', onclick: () => setMode('manual'), text: t('enter_manually') })
    );
  }

  // ---- Импорт от файл: .json бекъп / Aegis / 2FAS / otpauth списък ----
  // Всичко минава през НАДЕЖДНИЯ pickTextFile (нативен file-picker на телефон → чете реалното
  // съдържание; input в браузър), защото `<input type=file>` в Android WebView връщаше ПРАЗЕН файл.
  function renderFile() {
    async function pickAndImport(kind) {
      // Дебъг: при неуспех/изключение показва ПОСТОЯНЕН диалог с диагностика (както при Aegis).
      const dbg = ['=== ' + kind + ' import debug ==='];
      try {
        const picked = await pickTextFile();
        if (!picked) return;                                  // отказ
        dbg.push('file=' + (picked.name || '?') + ' size=' + (picked.size != null ? picked.size : '?') + ' chars=' + (picked.text ? picked.text.length : 0));
        if (!picked.text) { toast(t('import_empty')); showAlert('Import debug', dbg.join('\n')); return; }
        const text = picked.text;
        let res;
        if (kind === 'json') res = await importJsonText(text);
        else if (kind === 'otpauth') res = await importOtpauthList(text);
        else res = await import2FASText(text);
        dbg.push('result: ' + (res.ok ? 'ok imported=' + res.imported + ' dup=' + res.duplicates : 'reason=' + res.reason) + (res.detail ? ' detail=' + res.detail : ''));
        // Криптиран 2FAS (експорт С парола) → питаме за паролата и декриптираме (с повторни опити).
        while (kind === '2fas' && res && !res.ok && res.reason === 'encrypted') {
          const pw = await promptPassword(t('twofas_password_prompt'), t('save'), t('cancel'));
          if (pw == null) { dbg.push('encrypted: парола отказана'); return; }
          res = await import2FASEncrypted(text, pw);
          dbg.push('decrypt → ' + (res.ok ? 'ok imported=' + res.imported : 'reason=' + res.reason));
          if (res && !res.ok && res.reason === 'password') {
            toast(t('twofas_bad_password'));
            res = { ok: false, reason: 'encrypted' };   // питай пак
          }
        }
        toast(describeResult(res));
        if (res && res.ok && res.imported > 0) nav.go('list');
        else if (res && !res.ok) showAlert('Import debug', dbg.join('\n'));   // дебъг при неуспех
      } catch (err) {
        dbg.push('EXCEPTION: ' + (err && (err.stack || err.message) || err));
        showAlert('Import debug', dbg.join('\n'));
      }
    }
    mount(body, seg,
      h('p', { class: 'muted', style: 'text-align:center', text: t('import_file_hint') }),
      h('button', { class: 'btn', onclick: () => pickAndImport('json'), text: '⬆ ' + t('import_json') }),
      h('button', { class: 'btn', onclick: () => importAegisFile((res) => { if (res && res.ok && res.imported > 0) nav.go('list'); }), text: '⬆ ' + t('import_aegis') }),
      h('button', { class: 'btn', onclick: () => pickAndImport('2fas'), text: '⬆ ' + t('import_2fas') }),
      h('button', { class: 'btn', onclick: () => pickAndImport('otpauth'), text: '⬆ ' + t('import_otpauth') }),
      h('p', { class: 'muted', style: 'font-size:.85em', text: t('import_aegis_hint') }),
      h('button', { class: 'btn ghost', onclick: () => setMode('manual'), text: t('enter_manually') })
    );
  }

  // ---- Ръчно въвеждане ----
  function renderManual() {
    const issuer = h('input', { type: 'text' });
    const account = h('input', { type: 'text' });
    const secret = h('input', { type: 'text', autocapitalize: 'characters', spellcheck: 'false' });
    const type = h('select', {},
      h('option', { value: 'totp' }, t('type_totp')),
      h('option', { value: 'hotp' }, t('type_hotp')),
      h('option', { value: 'steam' }, t('type_steam'))
    );
    const algorithm = h('select', {},
      h('option', { value: 'SHA1' }, 'SHA1'),
      h('option', { value: 'SHA256' }, 'SHA256'),
      h('option', { value: 'SHA512' }, 'SHA512')
    );
    const digits = h('input', { type: 'number', value: '6', min: '4', max: '10' });
    const period = h('input', { type: 'number', value: '30', min: '5', max: '120' });
    const counter = h('input', { type: 'number', value: '0', min: '0' });
    const err = h('div', { class: 'err' });

    const uri = h('input', { type: 'text', placeholder: 'otpauth://…', spellcheck: 'false' });
    uri.addEventListener('input', () => {
      const p = parseOtpauthURI(uri.value.trim());
      if (p) {
        issuer.value = p.issuer; account.value = p.account; secret.value = p.secret;
        type.value = p.type; algorithm.value = p.algorithm;
        digits.value = p.digits; period.value = p.period; counter.value = p.counter;
        toast('otpauth ✓');
      }
    });

    const adv = h('div', { style: 'display:none' },
      h('label', { text: t('algorithm') }), algorithm,
      h('div', { class: 'row' },
        h('div', {}, h('label', { text: t('digits') }), digits),
        h('div', {}, h('label', { text: t('period') }), period)
      ),
      h('label', { text: t('counter') }), counter
    );
    const advToggle = h('button', { class: 'btn ghost', onclick: () => { adv.style.display = adv.style.display === 'none' ? 'block' : 'none'; } }, t('advanced'));

    const save = async () => {
      const s = secret.value.replace(/\s/g, '');
      if (!s || base32Decode(s).length === 0) { err.textContent = t('invalid_secret'); return; }
      await addEntry({
        type: type.value,
        issuer: issuer.value.trim(),
        account: account.value.trim(),
        secret: s.toUpperCase(),
        algorithm: algorithm.value,
        digits: parseInt(digits.value, 10) || 6,
        period: parseInt(period.value, 10) || 30,
        counter: parseInt(counter.value, 10) || 0
      });
      nav.go('list');
    };

    mount(body, seg,
      h('label', { text: t('paste_uri') }), uri,
      h('label', { text: t('issuer') }), issuer,
      h('label', { text: t('account') }), account,
      h('label', { text: t('secret') }), secret,
      h('label', { text: t('type') }), type,
      advToggle, adv,
      err,
      h('button', { class: 'btn accent', onclick: save, text: t('save') }),
      h('button', { class: 'btn ghost', onclick: () => nav.go('list'), text: t('cancel') })
    );
  }

  // ---- Сканиране на QR код ----
  function renderScan() {
    const video = h('video', { id: 'scanvideo', playsinline: 'true', muted: 'true' });
    const status = h('p', { class: 'muted', style: 'text-align:center', text: t('scan_hint') });
    mount(body, seg, video, status,
      h('button', { class: 'btn ghost', onclick: () => setMode('manual'), text: t('enter_manually') })
    );

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (stream) => {
        activeStream = stream;
        video.srcObject = stream;
        await video.play();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let jsQR = null;
        try { jsQR = (await import('jsqr')).default; } catch (e) { jsQR = window.jsQR || null; }
        if (!jsQR) { status.textContent = 'jsQR ?'; return; }

        const scan = () => {
          if (!activeStream) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height);
            if (found && found.data && isImportableQR(found.data)) {
              stopCamera();
              runImport(importQRData(found.data));   // единичен otpauth ИЛИ Google миграция (много акаунта)
              return;
            }
          }
          rafId = requestAnimationFrame(scan);
        };
        rafId = requestAnimationFrame(scan);
      })
      .catch(() => { status.textContent = t('camera_denied'); status.style.color = 'var(--danger)'; });
  }

  mount(root, topbar, body);
  setMode('manual');
}
