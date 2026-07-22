// Version: 1.0001
// data.js — офлайн резервна база с лекарства + списък с РИСКОВИ съставки за цветово открояване.
// Всичко е ориентировъчно/информативно (виж медицинския дисклеймър). Разширява се постепенно.

// Категории риск за съставките (за цвят + предупреждение):
//   opiate   — опиати/опиоиди (зависимост, респираторна депресия)
//   banned   — забранени/строго контролирани вещества
//   danger   — опасни при ПРЕДОЗИРАНЕ (сериозни последици)
// key = нормализирано име (малки букви, без интервали) → съвпадение по СЪДЪРЖАНЕ.
export const RISKY_INGREDIENTS = [
  { key: 'codeine', name: 'Codeine', risk: 'opiate', consequence: 'Опиоид: сънливост, зависимост; при предозиране — потисната дишане, кома.' },
  { key: 'morphine', name: 'Morphine', risk: 'opiate', consequence: 'Силен опиоид: при предозиране — спиране на дишането, смърт.' },
  { key: 'tramadol', name: 'Tramadol', risk: 'opiate', consequence: 'Опиоид: гърчове и респираторна депресия при високи дози.' },
  { key: 'oxycodone', name: 'Oxycodone', risk: 'opiate', consequence: 'Опиоид: висок риск от зависимост и предозиране.' },
  { key: 'fentanyl', name: 'Fentanyl', risk: 'opiate', consequence: 'Много силен опиоид: смъртоносен и в малки дози.' },
  { key: 'ephedrine', name: 'Ephedrine', risk: 'banned', consequence: 'Контролирано: сърдечни аритмии, високо кръвно; забранено в спорта.' },
  { key: 'pseudoephedrine', name: 'Pseudoephedrine', risk: 'banned', consequence: 'Контролирано в много държави; злоупотреба и сърдечен риск.' },
  { key: 'paracetamol', name: 'Paracetamol', risk: 'danger', consequence: 'При предозиране — тежко чернодробно увреждане (може смъртоносно). Не превишавай дозата.' },
  { key: 'acetaminophen', name: 'Acetaminophen', risk: 'danger', consequence: 'Същото като парацетамол: чернодробна недостатъчност при предозиране.' },
  { key: 'ibuprofen', name: 'Ibuprofen', risk: 'danger', consequence: 'Предозиране — стомашно кървене, бъбречно увреждане.' },
  { key: 'aspirin', name: 'Aspirin', risk: 'danger', consequence: 'Предозиране — кървене, шум в ушите, ацидоза.' },
  { key: 'acetylsalicylic', name: 'Acetylsalicylic acid', risk: 'danger', consequence: 'Аспирин: кървене и токсичност при предозиране.' },
  { key: 'diphenhydramine', name: 'Diphenhydramine', risk: 'danger', consequence: 'Антихистамин: сънливост; предозиране — сърдечни аритмии, делир.' },
  { key: 'dextromethorphan', name: 'Dextromethorphan', risk: 'danger', consequence: 'При злоупотреба/високи дози — халюцинации, объркване, сериозни ефекти.' }
];

// Малка офлайн база (резерв при липса на интернет/съвпадение онлайн). Разширяваме.
// active = списък съставки (за откроявания). description е кратко „за какво е".
export const OFFLINE_MEDS = [
  { names: ['paracetamol', 'acetaminophen', 'panadol', 'efferalgan', 'tylenol'], title: 'Paracetamol (Панадол/Ефералган)', active: ['paracetamol'],
    description: 'Обезболяващо и понижаващо температурата (аналгетик/антипиретик). За главоболие, болка, треска.' },
  { names: ['ibuprofen', 'nurofen', 'brufen', 'advil'], title: 'Ibuprofen (Нурофен/Бруфен)', active: ['ibuprofen'],
    description: 'Нестероидно противовъзпалително (НСПВС). За болка, възпаление и температура.' },
  { names: ['aspirin', 'aspirin protect', 'acetylsalicylic'], title: 'Aspirin (Аспирин)', active: ['acetylsalicylic'],
    description: 'Обезболяващо/противовъзпалително; в ниски дози — разреждане на кръвта.' },
  { names: ['analgin', 'metamizole', 'novalgin'], title: 'Analgin (Метамизол)', active: ['metamizole'],
    description: 'Силно обезболяващо и понижаващо температурата. В някои държави е ограничено.' },
  { names: ['nurofen plus', 'solpadeine', 'co-codamol'], title: 'Кодеин-съдържащо обезболяващо', active: ['codeine', 'paracetamol'],
    description: 'Комбинирано обезболяващо, съдържащо КОДЕИН (опиоид) — по лекарско предписание.' }
];

// Нормализира текст за търсене/съвпадение.
export function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9а-я]+/gi, '');
}

// Открива рискови съставки в даден текст/списък от съставки.
export function findRisky(text) {
  const n = norm(text);
  const out = [];
  for (const ing of RISKY_INGREDIENTS) {
    if (n.includes(ing.key)) out.push(ing);
  }
  return out;
}

// Търси в офлайн базата по име (съвпадение по съдържане в която и да е от имената).
export function offlineLookup(query) {
  const n = norm(query);
  if (!n) return null;
  for (const m of OFFLINE_MEDS) {
    if (m.names.some((nm) => { const k = norm(nm); return n.includes(k) || k.includes(n); })) return m;
  }
  return null;
}
