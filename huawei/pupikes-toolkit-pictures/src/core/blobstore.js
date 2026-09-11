// Version: 1.0021
// blobstore.js — съхранение на файлове (Blob) на устройството в IndexedDB (самостоятелен помощник).
// localStorage е твърде малък за оригиналните снимки, затова байтовете стоят тук, а описанието (JSON)
// остава в localStorage. Ако IndexedDB липсва (частен режим/стар WebView) — пазим в паметта до затваряне.
//   putBlob(key, blob) · getBlob(key) → Blob|null · delBlob(key) · blobUsage() → { count, bytes }

const DB_NAME = 'pupikes-blobs';
const STORE = 'b';
const mem = new Map();
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      if (typeof indexedDB === 'undefined') { res(null); return; }
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore(STORE); } catch (e) {} };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((res) => {
    if (!db) { res(fn(null)); return; }
    try {
      const t = db.transaction(STORE, mode); const st = t.objectStore(STORE);
      const rq = fn(st);
      t.oncomplete = () => res(rq && 'result' in rq ? rq.result : undefined);
      t.onerror = () => res(undefined); t.onabort = () => res(undefined);
    } catch (e) { res(fn(null)); }
  }));
}

export async function putBlob(key, blob) {
  // Пазим като ArrayBuffer + тип — някои WebView-и не записват Blob в IndexedDB.
  const rec = { type: blob.type || 'application/octet-stream', buf: await blob.arrayBuffer() };
  let ok = false;
  await tx('readwrite', (st) => { if (!st) { mem.set(key, rec); ok = true; return null; } ok = true; return st.put(rec, key); });
  if (!ok) mem.set(key, rec);
}

export async function getBlob(key) {
  let rec = mem.get(key);
  if (!rec) rec = await tx('readonly', (st) => (st ? st.get(key) : null));
  if (!rec || !rec.buf) return null;
  return new Blob([rec.buf], { type: rec.type });
}

export async function delBlob(key) {
  mem.delete(key);
  await tx('readwrite', (st) => (st ? st.delete(key) : null));
}

export async function blobUsage(keys) {
  let count = 0, bytes = 0;
  for (const k of keys || []) { const b = await getBlob(k); if (b) { count++; bytes += b.size; } }
  return { count, bytes };
}
