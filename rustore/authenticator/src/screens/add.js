// add.js — нов акаунт: сканиране на QR код (камера + jsQR) ИЛИ ръчно въвеждане.
import { h, mount, toast } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { addEntry } from '../core/storage.js';
import { parseOtpauthURI } from '../core/otp.js';
import { base32Decode } from '../core/base32.js';

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

  // Три начина за въвеждане: камера, качване на файл с QR, ръчно (вкл. поставяне на линк).
  const MODES = [
    { key: 'scan', label: '📷 ' + t('scan_qr') },
    { key: 'upload', label: '🖼 ' + t('upload_file') },
    { key: 'manual', label: '⌨ ' + t('enter_manually') }
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
    else renderManual();
  }

  // Декодира QR код от качена картинка (jsQR върху пикселите).
  async function decodeImageFile(file) {
    let jsQR = null;
    try { jsQR = (await import('jsqr')).default; } catch (e) { jsQR = window.jsQR || null; }
    if (!jsQR) return null;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(d.data, d.width, d.height);
      return found && found.data ? found.data : null;
    } catch (e) { return null; } finally { URL.revokeObjectURL(url); }
  }

  function renderUpload() {
    const fileInput = h('input', { type: 'file', accept: 'image/*' });
    const status = h('p', { class: 'muted', style: 'text-align:center', text: t('scan_hint') });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      decodeImageFile(f).then((uri) => {
        const p = uri ? parseOtpauthURI(uri.trim()) : null;
        if (!p) { status.textContent = t('qr_not_found'); status.style.color = 'var(--danger)'; return; }
        addEntry({
          type: p.type, issuer: p.issuer, account: p.account, secret: p.secret.toUpperCase(),
          algorithm: p.algorithm, digits: p.digits, period: p.period, counter: p.counter
        }).then(() => nav.go('list'));
      });
    });
    mount(body, seg,
      h('p', { class: 'muted', style: 'text-align:center', text: t('upload_file') }),
      fileInput, status,
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
            if (found && found.data) {
              const p = parseOtpauthURI(found.data.trim());
              if (p) {
                stopCamera();
                addEntry({
                  type: p.type, issuer: p.issuer, account: p.account, secret: p.secret.toUpperCase(),
                  algorithm: p.algorithm, digits: p.digits, period: p.period, counter: p.counter
                }).then(() => nav.go('list'));
                return;
              }
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
