// Version: 1.0023
// interactions.js — ВЗАИМОДЕЙСТВИЯ МЕЖДУ ДВЕ ЛЕКАРСТВА (Huawei 4.1, 11.09.2026): вградена таблица на
// най-честите клинично значими взаимодействия по ГРУПИ (НСПВС, антикоагуланти, SSRI, опиоиди,
// бензодиазепини, ACE/ARB, макролиди, статини, азоли, хинолони, катиони…). Имената (генерични, търговски,
// на 15 езика) се свеждат до INN през вградената база (meddb.js); после всяка двойка групи се проверява.
// Всичко на устройството. Резултат: тежест (high/mid/low) + механизъм (ключ за i18n why_*). Ориентировъчно.
import { resolveInn } from './meddb.js';
import { norm } from './data.js';

// Групи → INN имена (както в med-db.json: малки букви, английски INN).
const GROUPS = {
  nsaid: ['ibuprofen', 'diclofenac', 'naproxen', 'ketoprofen', 'dexketoprofen', 'nimesulide', 'meloxicam', 'piroxicam', 'ketorolac', 'celecoxib', 'etoricoxib', 'indometacin', 'indomethacin', 'aceclofenac', 'lornoxicam', 'metamizole', 'acetylsalicylic acid', 'flurbiprofen', 'mefenamic acid', 'etodolac', 'nabumetone'],
  aspirin: ['acetylsalicylic acid'],
  paracetamol: ['paracetamol'],
  anticoag: ['warfarin', 'acenocoumarol', 'phenprocoumon', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'heparin', 'heparin sodium', 'enoxaparin', 'dalteparin', 'nadroparin', 'fondaparinux'],
  antiplatelet: ['clopidogrel', 'ticagrelor', 'prasugrel', 'acetylsalicylic acid', 'dipyridamole', 'cilostazol'],
  ssri: ['sertraline', 'fluoxetine', 'escitalopram', 'citalopram', 'paroxetine', 'fluvoxamine', 'venlafaxine', 'duloxetine', 'desvenlafaxine', 'vortioxetine'],
  maoi: ['moclobemide', 'selegiline', 'rasagiline', 'phenelzine', 'tranylcypromine', 'linezolid', 'isocarboxazid'],
  opioid: ['codeine', 'tramadol', 'morphine', 'oxycodone', 'fentanyl', 'methadone', 'buprenorphine', 'hydrocodone', 'tapentadol', 'dihydrocodeine', 'pethidine', 'hydromorphone', 'tilidine'],
  tramadol: ['tramadol', 'pethidine', 'methadone', 'fentanyl'],
  benzo: ['diazepam', 'alprazolam', 'lorazepam', 'clonazepam', 'midazolam', 'bromazepam', 'oxazepam', 'temazepam', 'nitrazepam', 'zolpidem', 'zopiclone', 'zaleplon', 'phenobarbital', 'clobazam'],
  sedating: ['diphenhydramine', 'chloropyramine', 'clemastine', 'promethazine', 'hydroxyzine', 'dimenhydrinate', 'doxylamine', 'cyproheptadine', 'chlorphenamine', 'chlorpheniramine'],
  alcohol: ['alcohol', 'ethanol'],
  acei_arb: ['enalapril', 'lisinopril', 'ramipril', 'perindopril', 'captopril', 'fosinopril', 'quinapril', 'losartan', 'valsartan', 'telmisartan', 'candesartan', 'irbesartan', 'olmesartan', 'sacubitril'],
  ksparing: ['spironolactone', 'eplerenone', 'amiloride', 'triamterene', 'potassium chloride', 'potassium citrate', 'potassium'],
  diuretic: ['furosemide', 'torasemide', 'torsemide', 'bumetanide', 'hydrochlorothiazide', 'indapamide', 'chlortalidone', 'chlorothiazide'],
  methotrexate: ['methotrexate'],
  lithium: ['lithium carbonate', 'lithium'],
  macrolide: ['clarithromycin', 'erythromycin', 'azithromycin', 'roxithromycin', 'josamycin'],
  statin: ['simvastatin', 'atorvastatin', 'lovastatin', 'rosuvastatin', 'pravastatin', 'fluvastatin', 'pitavastatin'],
  azole: ['fluconazole', 'itraconazole', 'ketoconazole', 'voriconazole', 'posaconazole'],
  quinolone: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin', 'norfloxacin'],
  tetracycline: ['doxycycline', 'tetracycline', 'minocycline'],
  cation: ['calcium carbonate', 'calcium', 'ferrous sulfate', 'iron', 'ferrous fumarate', 'magnesium hydroxide', 'aluminium hydroxide', 'aluminum hydroxide', 'magnesium citrate', 'magnesium oxide', 'zinc sulfate', 'zinc', 'sucralfate', 'bismuth subsalicylate'],
  metronidazole: ['metronidazole', 'tinidazole', 'ornidazole'],
  ppi: ['omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'rabeprazole'],
  clopidogrel: ['clopidogrel'],
  nitrate: ['glyceryl trinitrate', 'nitroglycerin', 'isosorbide mononitrate', 'isosorbide dinitrate', 'molsidomine'],
  pde5: ['sildenafil', 'tadalafil', 'vardenafil', 'avanafil'],
  betablocker: ['bisoprolol', 'metoprolol', 'atenolol', 'propranolol', 'carvedilol', 'nebivolol', 'sotalol', 'timolol'],
  nondhp: ['verapamil', 'diltiazem'],
  beta2: ['salbutamol', 'salmeterol', 'formoterol', 'terbutaline', 'fenoterol', 'albuterol'],
  levothyroxine: ['levothyroxine', 'liothyronine'],
  theophylline: ['theophylline', 'aminophylline'],
  metformin: ['metformin'],
  corticosteroid: ['prednisolone', 'prednisone', 'dexamethasone', 'methylprednisolone', 'hydrocortisone', 'betamethasone', 'triamcinolone'],
  digoxin: ['digoxin'],
  qt: ['amiodarone', 'sotalol', 'haloperidol', 'ondansetron', 'domperidone', 'citalopram', 'escitalopram', 'hydroxyzine', 'azithromycin', 'clarithromycin', 'erythromycin', 'moxifloxacin', 'levofloxacin', 'fluconazole', 'quetiapine', 'methadone', 'chloroquine', 'hydroxychloroquine', 'donepezil'],
  triptan: ['sumatriptan', 'zolmitriptan', 'rizatriptan', 'eletriptan', 'naratriptan'],
  carbamazepine: ['carbamazepine', 'oxcarbazepine', 'phenytoin', 'phenobarbital', 'rifampicin', 'rifampin'],
  contraceptive: ['ethinylestradiol', 'levonorgestrel', 'desogestrel', 'drospirenone', 'norethisterone', 'dienogest', 'gestodene'],
  valproate: ['valproic acid', 'valproate'],
  sulfonylurea: ['gliclazide', 'glimepiride', 'glibenclamide', 'glyburide', 'glipizide']
};
// Правила: [група A, група B, тежест, механизъм]
const RULES = [
  ['nsaid', 'nsaid', 'high', 'gi_bleed'], ['nsaid', 'anticoag', 'high', 'bleeding'], ['nsaid', 'antiplatelet', 'mid', 'bleeding'], ['nsaid', 'ssri', 'mid', 'bleeding'],
  ['nsaid', 'acei_arb', 'mid', 'kidney'], ['nsaid', 'diuretic', 'mid', 'kidney'], ['nsaid', 'methotrexate', 'high', 'level_up'], ['nsaid', 'lithium', 'high', 'level_up'],
  ['nsaid', 'corticosteroid', 'mid', 'gi_bleed'], ['nsaid', 'alcohol', 'mid', 'gi_bleed'], ['nsaid', 'ksparing', 'mid', 'hyperkalaemia'],
  ['paracetamol', 'alcohol', 'mid', 'liver'], ['paracetamol', 'anticoag', 'low', 'bleeding'], ['paracetamol', 'paracetamol', 'high', 'overdose'], ['paracetamol', 'carbamazepine', 'low', 'liver'],
  ['anticoag', 'antiplatelet', 'high', 'bleeding'], ['anticoag', 'macrolide', 'mid', 'level_up'], ['anticoag', 'azole', 'high', 'level_up'], ['anticoag', 'metronidazole', 'high', 'level_up'],
  ['anticoag', 'quinolone', 'mid', 'level_up'], ['anticoag', 'ssri', 'mid', 'bleeding'], ['anticoag', 'carbamazepine', 'mid', 'effect_down'], ['anticoag', 'alcohol', 'mid', 'bleeding'],
  ['ssri', 'maoi', 'high', 'serotonin'], ['ssri', 'tramadol', 'high', 'serotonin'], ['ssri', 'opioid', 'mid', 'serotonin'], ['ssri', 'triptan', 'mid', 'serotonin'], ['ssri', 'lithium', 'mid', 'serotonin'], ['ssri', 'ssri', 'high', 'serotonin'],
  ['maoi', 'opioid', 'high', 'serotonin'], ['maoi', 'triptan', 'high', 'serotonin'], ['maoi', 'sedating', 'mid', 'sedation'],
  ['opioid', 'benzo', 'high', 'sedation'], ['opioid', 'alcohol', 'high', 'sedation'], ['opioid', 'sedating', 'mid', 'sedation'], ['opioid', 'opioid', 'high', 'sedation'],
  ['benzo', 'alcohol', 'high', 'sedation'], ['benzo', 'sedating', 'mid', 'sedation'], ['benzo', 'benzo', 'mid', 'sedation'], ['sedating', 'alcohol', 'mid', 'sedation'], ['sedating', 'sedating', 'mid', 'sedation'],
  ['acei_arb', 'ksparing', 'high', 'hyperkalaemia'], ['acei_arb', 'acei_arb', 'mid', 'hypotension'], ['acei_arb', 'lithium', 'mid', 'level_up'], ['ksparing', 'ksparing', 'high', 'hyperkalaemia'],
  ['diuretic', 'lithium', 'mid', 'level_up'], ['diuretic', 'digoxin', 'mid', 'level_up'],
  ['macrolide', 'statin', 'mid', 'muscle'], ['azole', 'statin', 'mid', 'muscle'], ['nondhp', 'statin', 'mid', 'muscle'],
  ['nondhp', 'betablocker', 'high', 'bradycardia'], ['nondhp', 'digoxin', 'mid', 'level_up'], ['betablocker', 'beta2', 'mid', 'bronchospasm'], ['betablocker', 'digoxin', 'low', 'bradycardia'],
  ['quinolone', 'cation', 'mid', 'absorption'], ['tetracycline', 'cation', 'mid', 'absorption'], ['levothyroxine', 'cation', 'mid', 'absorption'], ['levothyroxine', 'ppi', 'low', 'absorption'],
  ['quinolone', 'theophylline', 'high', 'level_up'], ['macrolide', 'theophylline', 'mid', 'level_up'], ['quinolone', 'corticosteroid', 'mid', 'muscle'],
  ['metronidazole', 'alcohol', 'high', 'disulfiram'], ['ppi', 'clopidogrel', 'mid', 'effect_down'], ['nitrate', 'pde5', 'high', 'hypotension'],
  ['qt', 'qt', 'mid', 'qt'], ['digoxin', 'macrolide', 'mid', 'level_up'],
  ['carbamazepine', 'macrolide', 'high', 'level_up'], ['carbamazepine', 'azole', 'mid', 'level_up'], ['carbamazepine', 'contraceptive', 'high', 'effect_down'], ['carbamazepine', 'valproate', 'mid', 'level_up'],
  ['carbamazepine', 'statin', 'low', 'effect_down'],
  ['metformin', 'alcohol', 'mid', 'lactic'], ['sulfonylurea', 'alcohol', 'mid', 'hypotension'], ['sulfonylurea', 'azole', 'mid', 'level_up'], ['sulfonylurea', 'nsaid', 'low', 'level_up'],
  ['corticosteroid', 'anticoag', 'low', 'bleeding'], ['lithium', 'lithium', 'high', 'level_up'], ['methotrexate', 'ppi', 'low', 'level_up'], ['methotrexate', 'macrolide', 'low', 'level_up']
];
const SEV = { high: 3, mid: 2, low: 1 };

// Групите, в които попада едно лекарство (по INN + активни съставки).
function groupsOf(innNames) {
  const keys = innNames.map((s) => norm(s));
  const out = [];
  for (const g of Object.keys(GROUPS)) { if (GROUPS[g].some((m) => keys.includes(norm(m)))) out.push(g); }
  return out;
}
// Ръчно: думи като „alcohol/алкохол/спирт/酒" → група alcohol без базата.
const ALCOHOL = /^(alcohol|ethanol|алкохол|алкоголь|спирт|вино|бира|водка|beer|wine|vodka|alkohol|alcool|酒|酒精|お酒|アルコール|कहवा|शराब|الكحول|خمر)$/i;

// Свежда произволно име до { name, inn, active[] } или null.
export async function resolveDrug(query) {
  const q = String(query || '').trim(); if (!q) return null;
  if (ALCOHOL.test(q)) return { name: q, inn: 'alcohol', active: ['alcohol'] };
  const r = await resolveInn(q);
  if (r) return { name: q, inn: r.inn, active: r.active, matched: r.name };
  // може да е директно INN от групите (например „potassium")
  const k = norm(q);
  for (const g of Object.keys(GROUPS)) for (const m of GROUPS[g]) if (norm(m) === k) return { name: q, inn: m, active: [m] };
  return null;
}

// Основна проверка: две имена → { a, b, hits:[{sev, why, ga, gb}], unknown:[имена] }.
export async function checkInteractions(nameA, nameB) {
  const a = await resolveDrug(nameA), b = await resolveDrug(nameB);
  const unknown = []; if (!a) unknown.push(nameA); if (!b) unknown.push(nameB);
  if (!a || !b) return { a, b, hits: [], unknown };
  const ga = groupsOf([a.inn].concat(a.active || [])), gb = groupsOf([b.inn].concat(b.active || []));
  // Един ред на механизъм — с НАЙ-ВИСОКАТА тежест (напр. tramadol+sertraline: high серотонин, не и mid).
  const byWhy = new Map();
  for (const [x, y, sev, why] of RULES) {
    const m1 = ga.includes(x) && gb.includes(y), m2 = ga.includes(y) && gb.includes(x);
    if (!m1 && !m2) continue;
    // същата група за двете (напр. nsaid+nsaid) е валидна само ако са РАЗЛИЧНИ лекарства или правилото е за дублиране
    if (x === y && a.inn === b.inn && why !== 'overdose') continue;
    const cur = byWhy.get(why);
    if (!cur || SEV[sev] > SEV[cur.sev]) byWhy.set(why, { sev, why, ga: x, gb: y });
  }
  const hits = Array.from(byWhy.values()).sort((p, q) => SEV[q.sev] - SEV[p.sev]);
  return { a, b, hits, unknown, groupsA: ga, groupsB: gb };
}
export const RULE_COUNT = RULES.length;
export const GROUP_COUNT = Object.keys(GROUPS).length;
