// Version: 1.0024
// once.js — политика „веднъж на пускане" за новите функции (Huawei 4.1 обогатяване).
// Всяка функция тегли данните си ЕДИН път за живота на процеса — при старт или при първото
// отваряне на таба — и повече не праща заявки, дори апът да стои отворен дни наред и
// потребителят да сменя табовете. Резултатът се пази и в localStorage като снимка, за да
// има какво да се покаже офлайн / при грешка. Повторно теглене е възможно САМО с ръчното
// „↻" на потребителя (forget + once).
// 11.09.2026: резултат с data.offline (вграденото офлайн издание, core/bundle.js) НЕ презаписва
// истинска снимка от предишно пускане — ако има такава, тя се връща (stale), защото е по-нова от пакета.
const mem = new Map();          // key → Promise (живее колкото процеса)
const PFX = 'newslator.once.';

// Последната записана снимка (офлайн резерв). { ts, data } | null
export function snapshot(key) {
  try { const r = localStorage.getItem(PFX + key); return r ? JSON.parse(r) : null; } catch (_) { return null; }
}

// Изпълнява loader-а само първия път за този ключ; после връща същото обещание.
export function once(key, loader) {
  if (mem.has(key)) return mem.get(key);
  const p = (async () => {
    try {
      const data = await loader();
      const snap = { ts: Date.now(), data };
      if (data && data.offline) {
        const real = snapshot(key);
        if (real && real.data && !real.data.offline) return Object.assign({ stale: true }, real);
        return snap;                                   // офлайн изданието не се пази като снимка
      }
      try { localStorage.setItem(PFX + key, JSON.stringify(snap)); } catch (_) {}
      return snap;
    } catch (e) {
      const old = snapshot(key);
      if (old) return Object.assign({ stale: true }, old);
      throw e;
    }
  })();
  mem.set(key, p);
  return p;
}

export function loaded(key) { return mem.has(key); }
// Само за ръчното „обнови" от потребителя.
export function forget(key) { mem.delete(key); }
