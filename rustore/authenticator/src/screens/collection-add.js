// Version: 1.0001
// collection-add.js — добавяне в таб „Колекция": качване или сканиране на QR код,
// + заглавие (до 256 знака). Пази се картинката (за повторно показване/сканиране)
// и декодираният текст. Полезно за QR от устройства (видеокамери и пр.).
import { h, mount, toast } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { addCollectionItem } from '../core/storage.js';

let activeStream = null, rafId = null;
function stopCamera() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (activeStream) { activeStream.getTracks().forEach((tr) => { try { tr.stop(); } catch (e) {} }); activeStream = null; }
}

// Намалява картинка до макс. 512px и връща PNG dataURL (QR остава четим).
function shrinkToDataURL(img) {
  const max = 512;
  let w = img.naturalWidth || img.width, hgt = img.naturalHeight || img.height;
  const scale = Math.min(1, max / Math.max(w, hgt));
  w = Math.round(w * scale); hgt = Math.round(hgt * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  c.getContext('2d').drawImage(img, 0, 0, w, hgt);
  return c.toDataURL('image/png');
}

async function loadJsQR() {
  let jsQR = null;
  try { jsQR = (await import('jsqr')).default; } catch (e) { jsQR = window.jsQR || null; }
  return jsQR;
}

export function renderCollectionAdd(root, nav) {
  stopCamera();
  let captured = { content: '', image: '' };

  const titleInput = h('input', { type: 'text', maxlength: '256', placeholder: t('title') });
  const preview = h('div', {});
  const status = h('div', { class: 'muted', style: 'text-align:center' }, '');
  const err = h('div', { class: 'err' });

  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => { stopCamera(); nav.go('list'); } }, '←'),
    h('h1', { text: t('col_add_title') })
  );

  function showPreview() {
    mount(preview, captured.image
      ? h('img', { src: captured.image, class: 'qrimg' })
      : null,
      captured.content ? h('p', { class: 'muted', style: 'word-break:break-all', text: captured.content }) : null);
  }

  // Качване на файл с картинка (QR).
  const fileInput = h('input', { type: 'file', accept: 'image/*' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
    if (!img) { URL.revokeObjectURL(url); return; }
    captured.image = shrinkToDataURL(img);
    const jsQR = await loadJsQR();
    if (jsQR) {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const found = jsQR(d.data, d.width, d.height);
      captured.content = found && found.data ? found.data : '';
    }
    URL.revokeObjectURL(url);
    status.textContent = captured.content ? t('decoded_ok') : '';
    showPreview();
  });

  // Сканиране с камера.
  const scanBtn = h('button', { class: 'btn ghost', onclick: startScan, text: '📷 ' + t('scan_qr') });
  const videoWrap = h('div', {});
  async function startScan() {
    stopCamera();
    const video = h('video', { id: 'scanvideo', playsinline: 'true', muted: 'true' });
    mount(videoWrap, video, h('p', { class: 'muted', style: 'text-align:center', text: t('scan_hint') }));
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = activeStream; await video.play();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const jsQR = await loadJsQR();
      if (!jsQR) return;
      const scan = () => {
        if (!activeStream) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(d.data, d.width, d.height);
          if (found && found.data) {
            captured.content = found.data;
            captured.image = canvas.toDataURL('image/png');
            stopCamera(); mount(videoWrap); status.textContent = t('decoded_ok'); showPreview();
            return;
          }
        }
        rafId = requestAnimationFrame(scan);
      };
      rafId = requestAnimationFrame(scan);
    } catch (e) { mount(videoWrap, h('p', { class: 'err', text: t('camera_denied') })); }
  }

  const save = async () => {
    const title = titleInput.value.trim();
    if (!title) { err.textContent = t('title_required'); return; }
    if (!captured.image && !captured.content) { err.textContent = t('qr_not_found'); return; }
    stopCamera();
    await addCollectionItem({ title, content: captured.content, image: captured.image });
    nav.go('list');
  };

  mount(root, topbar, h('div', { class: 'content' },
    h('label', { text: t('title') }), titleInput,
    h('div', { class: 'seg' },
      h('button', { class: 'on', onclick: () => fileInput.click() }, '🖼 ' + t('upload_file')),
      scanBtn
    ),
    fileInput, videoWrap, status, preview,
    err,
    h('button', { class: 'btn accent', onclick: save, text: t('save') }),
    h('button', { class: 'btn ghost', onclick: () => { stopCamera(); nav.go('list'); }, text: t('cancel') })
  ));
}
