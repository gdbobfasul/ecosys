// Version: 1.0015
// ffm.js — общ зареждач на ffmpeg.wasm (ЕДНОНИШКОВ core, ВГРАДЕН в бандъла — без интернет).
// Ползва се от инструментите „Видео конвертор" и „Звуков конвертор".
// ВАЖНО: подаваме АБСОЛЮТНИ адреси на core файловете — worker-ът живее в assets/ и
// относителните пътища се чупят спрямо него.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreJsUrl from '@ffmpeg/core?url';
import coreWasmUrl from '@ffmpeg/core/wasm?url';

let _ff = null;
let _loading = null;

export async function getFFmpeg(onProgress) {
  if (_ff) { if (onProgress) attach(_ff, onProgress); return _ff; }
  if (!_loading) {
    _loading = (async () => {
      const ff = new FFmpeg();
      await ff.load({
        coreURL: new URL(coreJsUrl, document.baseURI).href,
        wasmURL: new URL(coreWasmUrl, document.baseURI).href
      });
      _ff = ff;
      return ff;
    })();
  }
  const ff = await _loading;
  if (onProgress) attach(ff, onProgress);
  return ff;
}

let _lastCb = null;
function attach(ff, cb) {
  if (_lastCb) { try { ff.off('progress', _lastCb); } catch (e) {} }
  _lastCb = ({ progress }) => { try { cb(Math.max(0, Math.min(1, progress || 0))); } catch (e) {} };
  ff.on('progress', _lastCb);
}

// dataURL/base64 → Uint8Array (входният файл за ffmpeg).
export function base64ToBytes(b64) {
  const clean = String(b64 || '').replace(/^data:[^,]*,/, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
