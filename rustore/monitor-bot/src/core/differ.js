// Version: 1.0001
// Diff + seen-store: помни последно видените item id-та локално и решава
// кои items са НОВИ и/или съвпадат с ключови думи.
//
// Състоянието на „видяното" се пази в самия монитор (monitor.seenIds), което
// се персистира през storage. Така няма облак и няма проследяване.

// Връща { newItems, matched, firstRun }
//  - newItems: items, които не са били виждани преди
//  - matched: подмножество според правилото (нов запис и/или ключова дума)
//  - firstRun: true при първа проверка (тогава не известяваме, само „заучаваме")
export function diffAndMatch(monitor, items) {
  const seen = new Set(monitor.seenIds || []);
  const firstRun = !monitor.seenIds; // никога не е проверяван

  const newItems = items.filter((it) => !seen.has(it.id));

  const kw = (monitor.keywords || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  function containsKeyword(it) {
    if (kw.length === 0) return true; // без ключови думи = всеки запис се брои
    const hay = (it.title + ' ' + (it.link || '')).toLowerCase();
    return kw.some((k) => hay.includes(k));
  }

  let matched;
  if (monitor.rule === 'keyword') {
    // Само ключова дума — независимо дали е „нов" (но обикновено комбинирано с new).
    matched = items.filter(containsKeyword);
  } else if (monitor.rule === 'new+keyword') {
    matched = newItems.filter(containsKeyword);
  } else {
    // 'new' (по подразбиране): просто нови записи.
    matched = newItems;
  }

  return { newItems, matched, firstRun };
}

// Записва текущите id-та като „видени" (запазваме до 500, за да не расте безкрайно).
export function rememberSeen(monitor, items) {
  const ids = items.map((it) => it.id);
  const prev = monitor.seenIds || [];
  const merged = [...ids, ...prev];
  const unique = [...new Set(merged)].slice(0, 500);
  monitor.seenIds = unique;
}
