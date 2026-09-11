// Version: 1.0020
// House-Look-Book — ЛОКАЛЕН РЕЖИМ (без акаунт): проектите (форма, покрив, етажи, стаи, мебели)
// се пазят НА УСТРОЙСТВОТО в localStorage. Акаунтът е по избор — само за публикуване в галерията.
// Причина (Huawei 3.1, 11.09.2026): тестерите в Китай получаваха „failed to fetch" при вход/
// регистрация/качване и апът блокираше. Сега всичко в конструктора работи офлайн; сървърът е
// само за галерия/класация/публикуване.
//
// Ключове: hlb.local.projects.v1 (списък проекти), hlb.local.draft.v1 (текущата чернова на
// конструктора — възстановява се при следващо пускане), hlb.local.seeded.v1 (примерите са
// добавени веднъж; след изтриване НЕ се връщат).
const HLB_LOCAL = (function () {
  'use strict';

  const KEY = 'hlb.local.projects.v1';
  const DRAFT_KEY = 'hlb.local.draft.v1';
  const SEED_KEY = 'hlb.local.seeded.v1';

  function readAll() {
    try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeAll(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { console.warn('hlb-local: записът не успя', e); return false; }
  }
  function newId() { return 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // Стена с врати/прозорци (за примерните стаи).
  function W(doors, windows) { return { doors: doors || 0, windows: windows || 0 }; }
  function C(type) { return { type, place: 'center', wall: 0 }; }
  function WL(type, wall) { return { type, place: 'wall', wall: wall || 0 }; }
  function room(type, shape, walls, items) { return { type, shape: shape || 'rect', walls, items }; }

  // ПРИМЕРНИ ПРОЕКТИ при първо пускане — ясно маркирани „ПРИМЕР", с изтриване. Показват
  // веднага богат конструктор (мазе, етажи, стаи с мебели, екстри в двора) без акаунт и мрежа.
  function samples() {
    return [
      {
        id: 'sample-villa', sample: true, titleKey: 'sample.villa', title: '',
        params: {
          footprint: 'square', roof: 'gabled', floors: 2, basements: 1, roofOff: false,
          wallColor: '#e8d9c0', roofColor: '#8a4b3b', accentColor: '#3b6ea5', windowsPerFloor: 3,
          extras: { pool: true, boat: false, pier: false }, customShape: null,
          rooms: [
            [ room('garage', 'rect', [W(1, 0), W(0, 0), W(0, 1), W(0, 0)], [C('washer'), WL('boiler', 1), WL('shelves', 2)]),
              room('technical', 'rect', [W(1, 0), W(0, 0), W(0, 0), W(0, 0)], [WL('boiler', 1), WL('cabinet', 2)]) ],
            [ room('living', 'rect', [W(1, 0), W(0, 2), W(0, 1), W(0, 0)], [C('sofaset'), C('coffee'), WL('tvstand', 3), WL('shelves', 0)]),
              room('kitchen', 'rect', [W(1, 0), W(0, 1), W(0, 0), W(0, 0)], [C('island'), WL('fridge', 1), WL('stove', 2), WL('hood', 2), WL('sink', 2), WL('dishwasher', 1)]),
              room('dining', 'rounded', [W(1, 0), W(0, 2), W(0, 0), W(0, 0)], [C('table'), C('chair'), C('chair'), WL('cabinet', 3)]),
              room('toilet', 'rect', [W(1, 0), W(0, 0), W(0, 1), W(0, 0)], [WL('toilet', 2), WL('sink', 1)]) ],
            [ room('bedroom', 'rect', [W(1, 0), W(0, 1), W(0, 1), W(0, 0)], [C('bed'), WL('wardrobe', 3), WL('nightstand', 1), WL('dresser', 0)]),
              room('kids', 'rect', [W(1, 0), W(0, 1), W(0, 0), W(0, 0)], [C('bed'), C('desk'), C('chair'), WL('shelves', 3), WL('wardrobe', 2)]),
              room('bathroom', 'rect', [W(1, 0), W(0, 1), W(0, 0), W(0, 0)], [C('bathtub'), WL('sink', 1), WL('toilet', 2), WL('washer', 3)]),
              room('balcony', 'trapezoid', [W(1, 0), W(0, 0), W(0, 0), W(0, 0)], [C('chair'), C('table')]) ]
          ]
        }
      },
      {
        id: 'sample-cabin', sample: true, titleKey: 'sample.cabin', title: '',
        params: {
          footprint: 'cabin', roof: 'gabled', floors: 1, basements: 0, roofOff: false,
          wallColor: '#b98c5a', roofColor: '#5a3b2a', accentColor: '#2f6b4f', windowsPerFloor: 2,
          extras: { pool: false, boat: true, pier: true }, customShape: null,
          rooms: [
            [ room('living', 'rect', [W(1, 0), W(0, 2), W(0, 1), W(0, 0)], [C('sofa'), C('armchair'), C('coffee'), WL('shelves', 3), WL('coatrack', 0)]),
              room('kitchen', 'rect', [W(1, 0), W(0, 1), W(0, 0), W(0, 0)], [C('table'), C('chair'), C('chair'), WL('stove', 1), WL('sink', 1), WL('fridge', 2)]),
              room('bedroom', 'rounded', [W(1, 0), W(0, 1), W(0, 0), W(0, 0)], [C('bed'), WL('wardrobe', 2), WL('nightstand', 1)]),
              room('bathroom', 'rect', [W(1, 0), W(0, 1), W(0, 0), W(0, 0)], [WL('shower', 1), WL('sink', 2), WL('toilet', 3)]) ]
          ]
        }
      },
      {
        id: 'sample-dome', sample: true, titleKey: 'sample.dome', title: '',
        params: {
          footprint: 'dome', roof: 'dome', floors: 1, basements: 0, roofOff: false,
          wallColor: '#f2f2ee', roofColor: '#6b8fb5', accentColor: '#d97b3b', windowsPerFloor: 4,
          extras: { pool: false, boat: false, pier: false }, customShape: null,
          rooms: [
            [ room('living', 'circle', [W(1, 0), W(0, 1), W(0, 1), W(0, 1)], [C('sofaset'), C('coffee'), WL('tvstand', 2)]),
              room('office', 'rounded', [W(1, 0), W(0, 1), W(0, 0), W(0, 0)], [C('desk'), C('chair'), WL('shelves', 1), WL('cabinet', 3)]),
              room('bathroom', 'oval', [W(1, 0), W(0, 1), W(0, 0), W(0, 0)], [WL('shower', 1), WL('sink', 2), WL('toilet', 3), WL('washer', 0)]) ]
          ]
        }
      }
    ];
  }

  // Еднократно засяване на примерите (само ако никога не е правено).
  function seedOnce() {
    try {
      if (localStorage.getItem(SEED_KEY)) return;
      const list = readAll();
      if (!list.length) {
        const now = Date.now();
        writeAll(samples().map((s, i) => Object.assign(s, { created: now - i, updated: now - i })));
      }
      localStorage.setItem(SEED_KEY, '1');
    } catch (e) {}
  }

  function list() { return readAll().sort((a, b) => (b.updated || 0) - (a.updated || 0)); }
  function get(id) { return readAll().find(p => p.id === id) || null; }
  function count() { return readAll().length; }

  // Запис (нов или обновяване по id). Връща записа.
  function save(rec) {
    const all = readAll();
    const now = Date.now();
    let out;
    const i = rec.id ? all.findIndex(p => p.id === rec.id) : -1;
    if (i >= 0) {
      out = Object.assign({}, all[i], { title: rec.title != null ? rec.title : all[i].title, params: rec.params || all[i].params, updated: now, sample: false });
      delete out.titleKey;
      all[i] = out;
    } else {
      out = { id: rec.id || newId(), title: rec.title || '', params: rec.params || {}, created: now, updated: now, sample: false };
      all.push(out);
    }
    writeAll(all);
    return out;
  }
  function remove(id) { writeAll(readAll().filter(p => p.id !== id)); }
  function removeSamples() { writeAll(readAll().filter(p => !p.sample)); }
  function hasSamples() { return readAll().some(p => p.sample); }
  function duplicate(id) {
    const p = get(id); if (!p) return null;
    return save({ title: (p.title || '') + ' (2)', params: JSON.parse(JSON.stringify(p.params || {})) });
  }

  // Чернова на конструктора (текущото състояние) — за възстановяване след рестарт.
  function saveDraft(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.assign({ ts: Date.now() }, d))); } catch (e) {} }
  function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; } }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  // Заглавие за показване (примерите имат ключ за превод).
  function titleOf(p, T) {
    if (p.title) return p.title;
    if (p.titleKey && typeof T === 'function') return T(p.titleKey);
    return p.id;
  }

  seedOnce();
  return { list, get, count, save, remove, removeSamples, hasSamples, duplicate, saveDraft, loadDraft, clearDraft, titleOf, KEY, DRAFT_KEY };
})();
