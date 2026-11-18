/* Устойчив запис на оставащото време (оцелява при рестарт/спиране на тока).
 *
 * ДВА записа (ping-pong): act0.json / act1.json. Новият запис се прави в ДРУГИЯ слот и
 * се синхронизира на диска (fsync); ЕДВА СЛЕД това старият се трие. Така във всеки момент
 * съществува поне един пълен валиден запис — дори токът да спре точно по време на запис.
 * Всеки запис носи контролна сума; при четене повреден запис се отхвърля и се взима
 * предишният валиден с най-голям брояч.
 */
'use strict';
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');

let files = null;
let last = { counter: 0 };

function init(dir) { files = [path.join(dir, 'act0.json'), path.join(dir, 'act1.json')]; last = { counter: 0 }; }
function sumOf(o) { return crypto.createHash('sha1').update(o.counter + '|' + o.remainingSec + '|' + o.status + '|' + o.ts).digest('hex'); }

function readSlot(f) {
  try { const o = JSON.parse(fs.readFileSync(f, 'utf8')); if (o && o.sum === sumOf(o)) return o; } catch {}
  return null;
}

function loadState() {
  if (!files) return null;
  const a = readSlot(files[0]), b = readSlot(files[1]);
  let best = null;
  for (const o of [a, b]) if (o && (!best || o.counter > best.counter)) best = o;
  if (best) { last = { counter: best.counter }; return { remainingSec: best.remainingSec, status: best.status, ts: best.ts }; }
  return null;
}

function saveState(remainingSec, status) {
  if (!files) return;
  const counter = (last.counter || 0) + 1;
  const rec = { counter, remainingSec, status, ts: Date.now() };
  rec.sum = sumOf(rec);
  const target = files[counter % 2], other = files[(counter + 1) % 2];
  try {
    const fd = fs.openSync(target, 'w');
    fs.writeSync(fd, JSON.stringify(rec));
    fs.fsyncSync(fd);            // гарантира, че е на диска преди да трием стария
    fs.closeSync(fd);
  } catch { return; }
  last = { counter };
  try { fs.unlinkSync(other); } catch {}   // новият е надеждно записан → трием по-предния
}

module.exports = { init, loadState, saveState };
