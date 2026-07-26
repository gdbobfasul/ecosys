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
  { key: 'warfarin', name: 'Warfarin', risk: 'danger', consequence: 'Антикоагулант: предозиране — тежки кръвоизливи. Иска редовен контрол.' },
  { key: 'pregabalin', name: 'Pregabalin', risk: 'banned', consequence: 'Контролиран: седация, зависимост; с опиати — потисната дишане.' },
  { key: 'gabapentin', name: 'Gabapentin', risk: 'danger', consequence: 'Седация и зависимост; опасна комбинация с опиати/алкохол.' },
  { key: 'zolpidem', name: 'Zolpidem', risk: 'banned', consequence: 'Сънотворно (контролирано): зависимост, объркване, падания.' },
  { key: 'zopiclone', name: 'Zopiclone', risk: 'banned', consequence: 'Сънотворно (контролирано): зависимост; седация с депресанти.' },
  { key: 'promethazine', name: 'Promethazine', risk: 'danger', consequence: 'Антихистамин/седатив: силна сънливост; предозиране — аритмии, гърчове.' },
  { key: 'amitriptyline', name: 'Amitriptyline', risk: 'danger', consequence: 'Трицикличен антидепресант: предозиране — животозастрашаващи аритмии.' },
  { key: 'digoxin', name: 'Digoxin', risk: 'danger', consequence: 'Сърдечен гликозид с тесен диапазон: лесно предозиране, опасни аритмии.' },
  { key: 'lithium', name: 'Lithium', risk: 'danger', consequence: 'Тесен безопасен диапазон: тремор, объркване, бъбречна/тиреоидна токсичност.' },
  { key: 'methotrexate', name: 'Methotrexate', risk: 'danger', consequence: 'Цитостатик: тежка токсичност при грешна честота (седмично, НЕ дневно).' },
  { key: 'colchicine', name: 'Colchicine', risk: 'danger', consequence: 'Тесен диапазон: предозиране — тежка, понякога смъртоносна токсичност.' },
  { key: 'isotretinoin', name: 'Isotretinoin', risk: 'danger', consequence: 'Тежки вродени малформации при бременност; строг лекарски контрол.' },
  { key: 'ketorolac', name: 'Ketorolac', risk: 'danger', consequence: 'Силно НСПВС: висок риск от кървене/бъбречно увреждане; кратък курс.' },
  { key: 'clenbuterol', name: 'Clenbuterol', risk: 'banned', consequence: 'Забранено в спорта: сърдечни аритмии, тремор, опасно за сърцето.' },
  { key: 'sildenafil', name: 'Sildenafil', risk: 'danger', consequence: 'С нитрати (сърдечни) — опасно спадане на кръвното. Не комбинирай.' },
  { key: 'insulin', name: 'Insulin', risk: 'danger', consequence: 'Предозиране — тежка хипогликемия (загуба на съзнание, гърчове).' }
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
  { names: ['loperamide', 'imodium', 'имодиум', 'lopex', 'lopedium'], title: 'Loperamide (Имодиум)', active: ['loperamide'],
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
    description: 'Антибиотик — САМО по лекарско предписание. Не спирай преждевременно.' },
  { names: ['ketoprofen', 'ketonal', 'кетонал', 'oki'], title: 'Ketoprofen (Кетонал)', active: ['ketoprofen'],
    description: 'НСПВС за болка и възпаление на стави/мускули. Приемай след храна.' },
  { names: ['meloxicam', 'movalis', 'мовалис'], title: 'Meloxicam (Мовалис)', active: ['meloxicam'],
    description: 'НСПВС с дълго действие, за стави. По лекарско указание при хронична болка.' },
  { names: ['nimesulide', 'nimesil', 'aulin'], title: 'Nimesulide (Нимезил)', active: ['nimesulide'],
    description: 'НСПВС за болка/възпаление. Кратък курс — има чернодробен риск.' },
  { names: ['pantoprazole', 'controloc', 'nolpaza', 'нолпаза'], title: 'Pantoprazole (Нолпаза)', active: ['pantoprazole'],
    description: 'Инхибитор на протонната помпа — намалява стомашната киселина; за рефлукс/язва.' },
  { names: ['esomeprazole', 'nexium', 'нексиум'], title: 'Esomeprazole (Нексиум)', active: ['esomeprazole'],
    description: 'Намалява стомашната киселина; за парене, рефлукс, язва.' },
  { names: ['metoclopramide', 'cerucal', 'церукал', 'degan'], title: 'Metoclopramide (Церукал)', active: ['metoclopramide'],
    description: 'Против гадене и повръщане; ускорява изпразването на стомаха.' },
  { names: ['domperidone', 'motilium', 'мотилиум'], title: 'Domperidone (Мотилиум)', active: ['domperidone'],
    description: 'Против гадене/повръщане и тежест в стомаха.' },
  { names: ['ondansetron', 'zofran', 'осетрон'], title: 'Ondansetron (Зофран)', active: ['ondansetron'],
    description: 'Силно средство против гадене/повръщане; често след операция/химиотерапия.' },
  { names: ['simethicone', 'espumisan', 'еспумизан'], title: 'Simethicone (Еспумизан)', active: ['simethicone'],
    description: 'Против газове и подуване — разгражда мехурчетата в червата.' },
  { names: ['mebeverine', 'duspatalin', 'дуспаталин'], title: 'Mebeverine (Дуспаталин)', active: ['mebeverine'],
    description: 'Спазмолитик за раздразнено черво/спазми в корема.' },
  { names: ['bisacodyl', 'dulcolax', 'дулколакс'], title: 'Bisacodyl (Дулколакс)', active: ['bisacodyl'],
    description: 'Разслабително при запек. Кратка употреба; пий вода.' },
  { names: ['lactulose', 'duphalac', 'дюфалак'], title: 'Lactulose (Дюфалак)', active: ['lactulose'],
    description: 'Меко разслабително при запек; действа за 1–2 дни.' },
  { names: ['ambroxol', 'ambrobene', 'амбробене', 'mucosolvan'], title: 'Ambroxol (Амбробене)', active: ['ambroxol'],
    description: 'Разрежда храчките при кашлица със слуз. Пий с много вода.' },
  { names: ['bromhexine', 'bisolvon', 'бромхексин'], title: 'Bromhexine (Бромхексин)', active: ['bromhexine'],
    description: 'Отхрачващо при кашлица със слуз.' },
  { names: ['xylometazoline', 'otrivin', 'отривин', 'olynth'], title: 'Xylometazoline (Отривин)', active: ['xylometazoline'],
    description: 'Капки/спрей за запушен нос. Не повече от 5–7 дни (риск от привикване).' },
  { names: ['fexofenadine', 'telfast', 'allegra'], title: 'Fexofenadine (Телфаст)', active: ['fexofenadine'],
    description: 'Антихистамин за алергия без сънливост.' },
  { names: ['desloratadine', 'aerius', 'аериус'], title: 'Desloratadine (Аериус)', active: ['desloratadine'],
    description: 'Антихистамин за алергия/хрема, практически без сънливост.' },
  { names: ['salbutamol', 'ventolin', 'вентолин'], title: 'Salbutamol (Вентолин)', active: ['salbutamol'],
    description: 'Инхалатор за бронхоспазъм/астма — разширява дихателните пътища. По лекарско указание.' },
  { names: ['prednisolone', 'prednizolon', 'преднизолон'], title: 'Prednisolone (Преднизолон)', active: ['prednisolone'],
    description: 'Кортикостероид за силно възпаление/алергия. САМО по лекарско предписание; не спирай рязко.' },
  { names: ['dexamethasone', 'dexamethason', 'дексаметазон'], title: 'Dexamethasone (Дексаметазон)', active: ['dexamethasone'],
    description: 'Силен кортикостероид. Само по лекарско предписание.' },
  { names: ['metformin', 'siofor', 'glucophage', 'сиофор'], title: 'Metformin (Сиофор)', active: ['metformin'],
    description: 'При диабет тип 2 — понижава кръвната захар. По лекарско указание.' },
  { names: ['atorvastatin', 'atoris', 'sortis', 'аторвастатин'], title: 'Atorvastatin (Аторис)', active: ['atorvastatin'],
    description: 'Понижава холестерола. По лекарско предписание, дълготрайно.' },
  { names: ['amlodipine', 'norvasc', 'амлодипин'], title: 'Amlodipine (Амлодипин)', active: ['amlodipine'],
    description: 'За високо кръвно налягане — разширява съдовете. По лекарско указание.' },
  { names: ['enalapril', 'enap', 'енап', 'renitec'], title: 'Enalapril (Енап)', active: ['enalapril'],
    description: 'За високо кръвно/сърдечна недостатъчност (АСЕ-инхибитор). По лекарско указание.' },
  { names: ['losartan', 'lorista', 'лориста'], title: 'Losartan (Лориста)', active: ['losartan'],
    description: 'За високо кръвно налягане. По лекарско указание.' },
  { names: ['bisoprolol', 'concor', 'конкор'], title: 'Bisoprolol (Конкор)', active: ['bisoprolol'],
    description: 'Бета-блокер за кръвно/сърце. Не спирай рязко; по лекарско указание.' },
  { names: ['furosemide', 'lasix', 'фуроземид'], title: 'Furosemide (Фуроземид)', active: ['furosemide'],
    description: 'Силно отводняващо (диуретик); при отоци/сърдечна недостатъчност. По лекарско указание.' },
  { names: ['ciprofloxacin', 'ciprinol', 'ципринол'], title: 'Ciprofloxacin (антибиотик)', active: ['ciprofloxacin'],
    description: 'Антибиотик (флуорохинолон) — САМО по лекарско предписание.' },
  { names: ['doxycycline', 'doxycyclin', 'доксициклин'], title: 'Doxycycline (антибиотик)', active: ['doxycycline'],
    description: 'Антибиотик — само по предписание. Не лягай веднага след прием; пази се от слънце.' },
  { names: ['metronidazole', 'flagyl', 'метронидазол'], title: 'Metronidazole (антибиотик)', active: ['metronidazole'],
    description: 'Антибиотик/антипаразитно — само по предписание. Без алкохол по време на курса.' },
  { names: ['clarithromycin', 'klacid', 'клацид'], title: 'Clarithromycin (антибиотик)', active: ['clarithromycin'],
    description: 'Антибиотик — само по предписание. Внимание при други лекарства (взаимодействия).' },
  { names: ['nystatin', 'нистатин', 'fungicidin'], title: 'Nystatin (противогъбично)', active: ['nystatin'],
    description: 'Против гъбички (кандида) в устата/червата.' },
  { names: ['fluconazole', 'diflucan', 'флуконазол'], title: 'Fluconazole (противогъбично)', active: ['fluconazole'],
    description: 'Против гъбични инфекции. По лекарско указание.' },
  { names: ['dexpanthenol', 'bepanthen', 'бепантен'], title: 'Bepanthen (Декспантенол)', active: ['dexpanthenol'],
    description: 'Крем за раздразнена/суха кожа, малки рани, обрив от пелени.' },
  { names: ['oral rehydration', 'hydrovit', 'rehydron', 'регидрон'], title: 'Орални рехидратиращи соли', active: ['electrolytes'],
    description: 'Възстановяват течности и соли при диария/повръщане. Разтваряй в чиста вода.' }
];

// Нормализира текст за търсене/съвпадение.
export function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9а-яёіїјљњ]+/gi, '');
}

// Кирилица → латиница (за да може кирилско име на опаковка да съвпадне с латинската база).
// Изборът ц→c, к→k, х→h е нарочен: после фонетичното сгъване по-долу ги изравнява с латинските.
const CYR2LAT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ё: 'e', і: 'i', ї: 'i', ј: 'y', љ: 'l', њ: 'n', ђ: 'd', ћ: 'c', џ: 'dz' };
export function translitCyr(s) {
  return String(s || '').toLowerCase().replace(/[а-яёіїјљњђћџ]/g, (ch) => (CYR2LAT[ch] !== undefined ? CYR2LAT[ch] : ch));
}
// Фонетичен ключ: изравнява латинските/транслитерирани варианти на едно и също лекарствено име
// (c↔к, x↔кс, ph↔ф, y↔и, th↔т, двойни букви). Така „diclofenac" и „диклофенак" стават еднакви.
function phon(s) {
  return String(s || '').toLowerCase()
    .replace(/ph/g, 'f').replace(/th/g, 't').replace(/x/g, 'ks').replace(/c/g, 'k').replace(/y/g, 'i').replace(/w/g, 'v')
    .replace(/(.)\1+/g, '$1');
}
const latin = (s) => norm(translitCyr(s));

// Частично съвпадение (НАСОЧЕНО: name=DB-име, q=прочетено):
//  • цялото DB-име се съдържа в прочетеното → приемаме (име сред OCR-шум: „diclofenac"⊂„…diclofenac…");
//  • прочетеното е ЧАСТ от името → само ако е префикс ИЛИ ≥70% от него („loperamid"⊂„loperamide").
// Така се пуска истинското име, но се отхвърлят общи морфеми („erate"⊂„valerate" = фалшиво).
function partial(name, q) {
  if (name.length < 5 || q.length < 5) return false;
  if (q.includes(name)) return true;
  if (name.startsWith(q)) return true;
  return name.includes(q) && q.length >= 0.7 * name.length;
}
// Оценка на съвпадение име↔заявка: 2 = ТОЧНО, 1 = частично, 0 = няма.
// Ниво 1: пряко (нормализирано). Ниво 2: фонетично (латиница ↔ транслитерирана кирилица) — така
// кирилско „диклофенак" улучва латинското „diclofenac". И двете ниво минават през `partial` (≥5, префикс/припокриване).
// префикс с ≤2 знака разлика (падежни/суфиксни окончания: „loperamid(e)", „азитромицин(а)") = ТОЧНО
function nearEq(a, b) {
  return Math.min(a.length, b.length) >= 5 && Math.abs(a.length - b.length) <= 2 && (a.startsWith(b) || b.startsWith(a));
}
export function matchScore(name, query) {
  const k = norm(name), nq = norm(query);
  if (!k || !nq) return 0;
  if (k === nq || nearEq(k, nq)) return 2;
  if (partial(k, nq)) return 1;
  const pk = phon(latin(name)), pq = phon(latin(query));
  if (pk && pq) {
    if (pk === pq || nearEq(pk, pq)) return 2;
    if (partial(pk, pq)) return 1;
  }
  return 0;
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

// Търси в офлайн базата по име — предпочита ТОЧНО съвпадение пред частично (пази от шум).
export function offlineLookup(query) {
  if (!norm(query)) return null;
  let partial = null;
  for (const m of OFFLINE_MEDS) {
    let best = 0;
    for (const nm of m.names) { const s = matchScore(nm, query); if (s > best) best = s; }
    if (best === 2) return m;
    if (best === 1 && !partial) partial = m;
  }
  return partial;
}
