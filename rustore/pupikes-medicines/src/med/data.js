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
  { key: 'dextromethorphan', name: 'Dextromethorphan', risk: 'danger', consequence: 'При злоупотреба/високи дози — халюцинации, объркване, сериозни ефекти.' },
  { key: 'hydrocodone', name: 'Hydrocodone', risk: 'opiate', consequence: 'Опиоид: зависимост; при предозиране — потисната дишане, кома.' },
  { key: 'methadone', name: 'Methadone', risk: 'opiate', consequence: 'Дълготраен опиоид: натрупване и спиране на дишането при предозиране.' },
  { key: 'dihydrocodeine', name: 'Dihydrocodeine', risk: 'opiate', consequence: 'Опиоид: сънливост, зависимост, респираторна депресия.' },
  { key: 'diazepam', name: 'Diazepam', risk: 'banned', consequence: 'Бензодиазепин (контролиран): зависимост; с опиати/алкохол — спиране на дишането.' },
  { key: 'alprazolam', name: 'Alprazolam', risk: 'banned', consequence: 'Бензодиазепин (контролиран): силна зависимост, опасна комбинация с депресанти.' },
  { key: 'clonazepam', name: 'Clonazepam', risk: 'banned', consequence: 'Бензодиазепин (контролиран): седация, зависимост, риск при предозиране.' },
  { key: 'phenobarbital', name: 'Phenobarbital', risk: 'banned', consequence: 'Барбитурат (контролиран): тесен безопасен диапазон; предозиране — кома, смърт.' },
  { key: 'diclofenac', name: 'Diclofenac', risk: 'danger', consequence: 'НСПВС: стомашно кървене, бъбречен и сърдечно-съдов риск при предозиране/дълга употреба.' },
  { key: 'naproxen', name: 'Naproxen', risk: 'danger', consequence: 'НСПВС: стомашно кървене и бъбречно увреждане при предозиране.' },
  { key: 'metamizole', name: 'Metamizole (Analgin)', risk: 'danger', consequence: 'Рядко — агранулоцитоза (тежък спад на белите клетки); забранен в редица държави.' },
  { key: 'warfarin', name: 'Warfarin', risk: 'danger', consequence: 'Антикоагулант: предозиране — тежки кръвоизливи. Иска редовен контрол.' }
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
    description: 'Комбинирано обезболяващо, съдържащо КОДЕИН (опиоид) — по лекарско предписание.' },
  { names: ['diclofenac', 'voltaren', 'olfen', 'волтарен'], title: 'Diclofenac (Волтарен)', active: ['diclofenac'],
    description: 'Нестероидно противовъзпалително (НСПВС). За болка и възпаление на стави/мускули; гел или таблетки.' },
  { names: ['naproxen', 'naprosyn', 'aleve'], title: 'Naproxen', active: ['naproxen'],
    description: 'НСПВС с по-дълго действие. За болка, възпаление и температура.' },
  { names: ['cetirizine', 'zyrtec', 'зиртек', 'alerid'], title: 'Cetirizine (Зиртек)', active: ['cetirizine'],
    description: 'Антихистамин за алергия, сърбеж, уртикария, хрема. По-малко приспива.' },
  { names: ['loratadine', 'claritine', 'кларитин'], title: 'Loratadine (Кларитин)', active: ['loratadine'],
    description: 'Антихистамин за алергия/сенна хрема, практически без сънливост.' },
  { names: ['omeprazole', 'losec', 'omez', 'омез'], title: 'Omeprazole (Омез/Лосек)', active: ['omeprazole'],
    description: 'Инхибитор на протонната помпа — намалява стомашната киселина; за парене/рефлукс/язва.' },
  { names: ['famotidine', 'quamatel', 'kvamatel'], title: 'Famotidine', active: ['famotidine'],
    description: 'Намалява стомашната киселина (H2-блокер); за парене и киселинност.' },
  { names: ['loperamide', 'imodium', 'имодиум'], title: 'Loperamide (Имодиум)', active: ['loperamide'],
    description: 'Спира диария, като забавя червата. Не при кървава диария/висока температура.' },
  { names: ['drotaverine', 'no-spa', 'nospa', 'но-шпа'], title: 'Drotaverine (No-Spa)', active: ['drotaverine'],
    description: 'Спазмолитик — отпуска гладката мускулатура; за спазми/колики в корема.' },
  { names: ['acetylcysteine', 'acc', 'ацц', 'fluimucil'], title: 'Acetylcysteine (АЦЦ)', active: ['acetylcysteine'],
    description: 'Разрежда храчките при кашлица със слуз. Пий с много вода.' },
  { names: ['activated charcoal', 'carbo', 'карбон', 'активен въглен'], title: 'Активен въглен', active: ['activated charcoal'],
    description: 'Свързва токсини в стомаха; при леко отравяне/подуване. При отравяне — потърси и лекар.' },
  { names: ['amoxicillin', 'amoxil', 'ospamox', 'амоксицилин'], title: 'Amoxicillin (антибиотик)', active: ['amoxicillin'],
    description: 'Антибиотик (пеницилин) — САМО по лекарско предписание. Изкарай пълния курс.' },
  { names: ['azithromycin', 'sumamed', 'azibiot', 'азитромицин'], title: 'Azithromycin (антибиотик)', active: ['azithromycin'],
    description: 'Антибиотик — САМО по лекарско предписание. Не спирай преждевременно.' }
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
