// Version: 1.0024
// gen-med-db.mjs — ВГРАДЕНА ОФЛАЙН БАЗА за Pupikes Medicines (Huawei 3.1/4.1, 11.09.2026):
// ~500–600 най-разпространени лекарства (по брой Wikipedia статии) с имена на 15-те езика на екосистемата
// (генерично + търговски/чужди изписвания вкл. китайски, руски, латински), съставки, форма, кратко
// показание/дозировка от openFDA. Пише public/reference/med-db.json в huawei/ И rustore/ дървото.
// Източници (публични, безплатни): Wikidata (INN P2275, етикети + синоними), openFDA (локалната
// meds-db.json на апа, събрана от openFDA; липсващите — онлайн api.fda.gov, ако има мрежа).
// Кешът е в private/medikit-harvester/wd-cache/ (повторно пускане = без мрежа за вече взетите части).
//   node deploy-scripts/gen-med-db.mjs            — базата (med-db.json)
//   node deploy-scripts/gen-med-db.mjs --ocr      — + сваля вградения OCR пакет (tesseract.js + eng/bul/rus/chi_sim/chi_tra „fast" — best моделите са махнати за компактност)
//   node deploy-scripts/gen-med-db.mjs --top=600  — колко лекарства (по подразбиране 560)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const APP = 'pupikes-medicines';
const TREES = ['huawei', 'rustore'].map((s) => path.join(ROOT, s, APP)).filter((p) => fs.existsSync(p));
const CACHE = path.join(ROOT, 'private', 'medikit-harvester', 'wd-cache');
fs.mkdirSync(CACHE, { recursive: true });
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([a-z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const TOP = parseInt(args.top || '560', 10);
const UA = 'pupikes-med-db/1.0 (ltd.dai.grup@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- помощни ----------
function cached(name, fn) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return Promise.resolve(JSON.parse(fs.readFileSync(f, 'utf8')));
  return fn().then((v) => { fs.writeFileSync(f, JSON.stringify(v), 'utf8'); return v; });
}
async function sparql(q) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.json()).results.bindings;
    } catch (e) { if (i === 3) throw e; await sleep(2000 * (i + 1)); }
  }
  return [];
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9а-яёіїјљњ؀-ۿऀ-ॿ぀-ヿ一-鿿]+/gi, '');

// Вещества с INN, които НЕ са „лекарство в опаковка" (аминокиселини, газове, захари, наркотици без
// медицинска употреба…) — вадят се, за да остане мястото за истински лекарства.
const BLOCK = /^(carbon dioxide|phenol|lysergide|metamfetamine|amfetamine|glycerol|arginine|aspartic acid|tryptophan|histidine|phenylalanine|glutamic acid|glycine|alanine|leucine|isoleucine|valine|methionine|threonine|lysine|proline|serine|tyrosine|cysteine|glutamine|asparagine|ethanol|oxygen|nitrogen|water|sucrose|glucose|fructose|lactose|cocaine|diamorphine|tetrahydrocannabinol|psilocybine|xenon|helium|cholesterol|serotonin|histamine|acetylcholine|dopamine|noradrenaline|adrenaline|urea|sodium chloride.*|potassium chloride|calcium chloride|magnesium sulfate|sodium bicarbonate|hydrogen peroxide|formaldehyde|chloroform|diethyl ether|benzene|toluene|acetone|methanol|propofol|thiopental|curare|tubocurarine|muscarine|nicotine|strychnine|atropine|scopolamine|mescaline|dimethyltryptamine|ergotamine|ergometrine|acetic acid|citric acid|lactic acid|oleic acid|linoleic acid|stearic acid|palmitic acid|carnitine|creatine|taurine|inositol|choline|lecithin|starch|cellulose|gelatin|collagen|elastin|keratin|albumin|hemoglobin|ozone|argon|nitric oxide|carbon monoxide|hydrogen|chlorine|iodine|bromine|sulfur|phosphorus|selenium|zinc|copper|iron|magnesium|calcium|sodium|potassium|lithium|silver|gold|mercury|arsenic|lead|silicon|talc|kaolin|charcoal|paraffin|petrolatum|lanolin|beeswax|glycerin)$/i;
// Задължителни (често срещани ОТС/източно-европейски/азиатски марки) — влизат дори с малко статии.
const MUST = ['paracetamol', 'ibuprofen', 'acetylsalicylic acid', 'metamizole', 'diclofenac', 'naproxen', 'ketoprofen', 'nimesulide', 'cetirizine', 'loratadine', 'diphenhydramine', 'chloropyramine', 'clemastine', 'amoxicillin', 'clavulanic acid', 'azithromycin', 'ciprofloxacin', 'doxycycline', 'omeprazole', 'pantoprazole', 'ranitidine', 'famotidine', 'loperamide', 'drotaverine', 'ambroxol', 'acetylcysteine', 'bromhexine', 'pancreatin', 'simethicone', 'diosmectite', 'metformin', 'amlodipine', 'enalapril', 'lisinopril', 'losartan', 'bisoprolol', 'metoprolol', 'atorvastatin', 'simvastatin', 'salbutamol', 'budesonide', 'dexamethasone', 'prednisolone', 'hydrocortisone', 'diazepam', 'alprazolam', 'codeine', 'tramadol', 'morphine', 'ascorbic acid', 'cholecalciferol', 'folic acid', 'cyanocobalamin', 'levothyroxine', 'insulin', 'warfarin', 'clopidogrel', 'sildenafil', 'fluconazole', 'clotrimazole', 'nystatin', 'aciclovir', 'oseltamivir', 'chlorhexidine', 'povidone-iodine', 'xylometazoline', 'oxymetazoline', 'domperidone', 'metoclopramide', 'ondansetron', 'bisacodyl', 'lactulose', 'macrogol', 'activated charcoal', 'oral rehydration salts', 'validol', 'menthol', 'benzocaine', 'lidocaine', 'ketorolac', 'meloxicam', 'celecoxib', 'colchicine', 'allopurinol', 'furosemide', 'hydrochlorothiazide', 'spironolactone', 'nitroglycerin', 'glyceryl trinitrate', 'digoxin', 'amiodarone', 'sertraline', 'fluoxetine', 'escitalopram', 'amitriptyline', 'melatonin', 'zopiclone', 'valproic acid', 'carbamazepine', 'levetiracetam', 'gabapentin', 'pregabalin', 'metronidazole', 'nitrofurantoin', 'cefuroxime', 'cefixime', 'ceftriaxone', 'clarithromycin', 'erythromycin', 'levofloxacin', 'trimethoprim', 'sulfamethoxazole', 'fexofenadine', 'desloratadine', 'montelukast', 'salmeterol', 'fluticasone', 'beclometasone', 'ipratropium bromide', 'tiotropium bromide', 'theophylline', 'dextromethorphan', 'guaifenesin', 'pseudoephedrine', 'phenylephrine', 'chlorphenamine', 'promethazine', 'hydroxyzine', 'betahistine', 'cinnarizine', 'dimenhydrinate', 'meclozine', 'mebeverine', 'hyoscine butylbromide', 'esomeprazole', 'sucralfate', 'bismuth subsalicylate', 'magnesium hydroxide', 'aluminium hydroxide', 'calcium carbonate', 'ferrous sulfate', 'zinc sulfate', 'magnesium citrate', 'potassium iodide', 'retinol', 'tocopherol', 'thiamine', 'riboflavin', 'pyridoxine', 'nicotinamide', 'biotin', 'phytomenadione', 'glucosamine', 'chondroitin sulfate', 'benzydamine', 'chlorhexidine', 'miconazole', 'terbinafine', 'permethrin', 'benzyl benzoate', 'hydrogen peroxide', 'silver sulfadiazine', 'panthenol', 'dexpanthenol', 'zinc oxide', 'urea', 'salicylic acid', 'benzoyl peroxide', 'adapalene', 'isotretinoin', 'minoxidil', 'finasteride', 'tamsulosin', 'oxybutynin', 'tadalafil', 'ethinylestradiol', 'levonorgestrel', 'progesterone', 'estradiol', 'testosterone', 'clomifene', 'metoprolol', 'propranolol', 'atenolol', 'carvedilol', 'nebivolol', 'verapamil', 'diltiazem', 'nifedipine', 'ramipril', 'perindopril', 'valsartan', 'telmisartan', 'candesartan', 'indapamide', 'torasemide', 'rosuvastatin', 'ezetimibe', 'fenofibrate', 'acarbose', 'gliclazide', 'glimepiride', 'sitagliptin', 'empagliflozin', 'dapagliflozin', 'liraglutide', 'semaglutide', 'insulin glargine', 'insulin aspart', 'levodopa', 'donepezil', 'memantine', 'risperidone', 'quetiapine', 'olanzapine', 'haloperidol', 'lithium carbonate', 'bupropion', 'venlafaxine', 'duloxetine', 'mirtazapine', 'trazodone', 'clonazepam', 'lorazepam', 'zolpidem', 'phenobarbital', 'phenytoin', 'lamotrigine', 'topiramate', 'sumatriptan', 'methotrexate', 'azathioprine', 'ciclosporin', 'tacrolimus', 'hydroxychloroquine', 'sulfasalazine', 'mesalazine', 'infliximab', 'adalimumab', 'tamoxifen', 'letrozole', 'anastrozole', 'cisplatin', 'doxorubicin', 'cyclophosphamide', 'imatinib', 'heparin', 'enoxaparin', 'apixaban', 'rivaroxaban', 'dabigatran', 'tranexamic acid', 'epinephrine', 'norepinephrine', 'dobutamine', 'naloxone', 'flumazenil', 'activated charcoal', 'ethambutol', 'isoniazid', 'rifampicin', 'pyrazinamide', 'chloroquine', 'artemether', 'mefloquine', 'albendazole', 'mebendazole', 'praziquantel', 'ivermectin', 'zidovudine', 'lamivudine', 'tenofovir', 'efavirenz', 'ribavirin', 'sofosbuvir', 'valaciclovir', 'ganciclovir', 'vancomycin', 'gentamicin', 'amikacin', 'meropenem', 'piperacillin', 'linezolid', 'clindamycin', 'benzylpenicillin', 'phenoxymethylpenicillin', 'ampicillin', 'cefalexin', 'cefazolin', 'tetracycline', 'minocycline', 'moxifloxacin', 'ofloxacin', 'norfloxacin', 'chloramphenicol', 'tobramycin', 'timolol', 'latanoprost', 'dorzolamide', 'brimonidine', 'pilocarpine', 'tropicamide', 'tetryzoline', 'naphazoline', 'sodium cromoglicate', 'olopatadine', 'ketotifen', 'hyaluronic acid', 'carbomer', 'dexamethasone', 'tobramycin', 'ofloxacin', 'lidocaine', 'articaine', 'bupivacaine', 'ketamine', 'midazolam', 'fentanyl', 'oxycodone', 'buprenorphine', 'methadone', 'naltrexone', 'nicotine', 'varenicline', 'disulfiram', 'thiamine', 'orlistat', 'levocetirizine', 'rupatadine', 'bilastine', 'ebastine', 'mometasone', 'triamcinolone', 'clobetasol', 'betamethasone', 'methylprednisolone', 'fusidic acid', 'mupirocin', 'aciclovir', 'ketoconazole', 'econazole', 'tioconazole', 'griseofulvin', 'itraconazole', 'voriconazole', 'amphotericin b', 'caspofungin'];

// Ръчни допълнения: търговски имена / чужди изписвания за най-честите (Wikidata синонимите не покриват
// всички марки; тук са най-разпространените в Европа, Русия, Китай, Латинска Америка, Индия, Япония).
const EXTRA = {
  paracetamol: { en: ['Panadol', 'Tylenol', 'Calpol', 'Efferalgan', 'Doliprane', 'Dafalgan', 'Crocin', 'Dolo 650', 'acetaminophen'], bg: ['Панадол', 'Ефералган', 'Парацетамол'], ru: ['Панадол', 'Эффералган', 'Парацетамол', 'Цефекон'], zh: ['对乙酰氨基酚', '扑热息痛', '必理痛', '泰诺林'], 'zh-Hant': ['對乙醯氨基酚', '普拿疼', '撲熱息痛'], ja: ['カロナール', 'タイレノール', 'アセトアミノフェン'], hi: ['क्रोसिन', 'डोलो'], la: ['Paracetamolum'] },
  ibuprofen: { en: ['Nurofen', 'Advil', 'Brufen', 'Motrin', 'MIG', 'Ibuprom', 'Dolgit', 'Ibalgin'], bg: ['Нурофен', 'Ибупрофен'], ru: ['Нурофен', 'Ибупрофен', 'МИГ', 'Ибуклин'], zh: ['布洛芬', '芬必得', '美林'], 'zh-Hant': ['布洛芬', '芬必得'], ja: ['イブプロフェン', 'イブ', 'ブルフェン'], la: ['Ibuprofenum'] },
  'acetylsalicylic acid': { en: ['Aspirin', 'Aspirin Protect', 'Cardioaspirin', 'Thrombo ASS', 'Disprin', 'Ecotrin', 'Bayer'], bg: ['Аспирин', 'Ацетизал'], ru: ['Аспирин', 'Кардиомагнил', 'Тромбо АСС', 'Аспирин Кардио'], zh: ['阿司匹林', '拜阿司匹灵'], 'zh-Hant': ['阿斯匹靈', '阿司匹林'], ja: ['アスピリン', 'バファリン', 'バイアスピリン'], la: ['Acidum acetylsalicylicum'] },
  metamizole: { en: ['Analgin', 'Novalgin', 'Dipyrone', 'Baralgin', 'Novaminsulfon'], bg: ['Аналгин', 'Метамизол'], ru: ['Анальгин', 'Баралгин', 'Метамизол', 'Пенталгин'], zh: ['安乃近'], la: ['Metamizolum natricum'] },
  diclofenac: { en: ['Voltaren', 'Olfen', 'Diclac', 'Cataflam', 'Dicloberl', 'Diclofenac Kalium'], bg: ['Волтарен', 'Диклофенак', 'Диклак'], ru: ['Вольтарен', 'Диклофенак', 'Ортофен', 'Диклак'], zh: ['双氯芬酸', '扶他林'], 'zh-Hant': ['雙氯芬酸', '服他寧'], ja: ['ボルタレン', 'ジクロフェナク'] },
  naproxen: { en: ['Aleve', 'Naprosyn', 'Apranax', 'Nalgesin'], bg: ['Напроксен', 'Налгезин'], ru: ['Напроксен', 'Налгезин'], zh: ['萘普生'] },
  ketoprofen: { en: ['Ketonal', 'Fastum', 'Profenid', 'Oruvail'], bg: ['Кетонал', 'Фастум'], ru: ['Кетонал', 'Фастум гель', 'Кетопрофен'], zh: ['酮洛芬'] },
  nimesulide: { en: ['Nimesil', 'Aulin', 'Nise', 'Nimulid'], bg: ['Нимезил', 'Аулин'], ru: ['Нимесил', 'Найз', 'Нимесулид'], hi: ['निमुलिड', 'नाइस'] },
  cetirizine: { en: ['Zyrtec', 'Alerid', 'Zodac', 'Reactine', 'Cetrin'], bg: ['Зиртек', 'Цетиризин', 'Алерид'], ru: ['Зиртек', 'Зодак', 'Цетрин', 'Цетиризин'], zh: ['西替利嗪', '仙特明'], ja: ['ジルテック', 'セチリジン'] },
  loratadine: { en: ['Claritin', 'Clarityn', 'Lorano', 'Lomilan'], bg: ['Кларитин', 'Лоратадин'], ru: ['Кларитин', 'Лоратадин', 'Ломилан'], zh: ['氯雷他定', '开瑞坦'], ja: ['クラリチン', 'ロラタジン'] },
  amoxicillin: { en: ['Amoxil', 'Ospamox', 'Flemoxin', 'Flemoxin Solutab', 'Augmentin', 'Amoxiclav', 'Clamoxyl', 'Moxatag', 'amoxycillin'], bg: ['Амоксицилин', 'Оспамокс', 'Флемоксин', 'Аугментин'], ru: ['Амоксициллин', 'Флемоксин', 'Амоксиклав', 'Аугментин', 'Оспамокс'], zh: ['阿莫西林', '安灭菌', '阿莫西林克拉维酸钾'], 'zh-Hant': ['安莫西林', '阿莫西林'], ja: ['アモキシシリン', 'サワシリン', 'パセトシン'], la: ['Amoxicillinum'] },
  azithromycin: { en: ['Zithromax', 'Sumamed', 'Azitrox', 'Azibiot'], bg: ['Сумамед', 'Азитромицин'], ru: ['Сумамед', 'Азитромицин', 'Азитрокс', 'Хемомицин'], zh: ['阿奇霉素', '希舒美'], ja: ['ジスロマック', 'アジスロマイシン'] },
  ciprofloxacin: { en: ['Ciprobay', 'Cipro', 'Ciprinol', 'Ciprofloxacino', 'Ciproxin'], bg: ['Ципрофлоксацин', 'Ципринол'], ru: ['Ципрофлоксацин', 'Цифран', 'Ципролет'], zh: ['环丙沙星'], hi: ['सिप्लॉक्स', 'सिफ्रान'] },
  omeprazole: { en: ['Losec', 'Prilosec', 'Omez', 'Ultop', 'Omeprazol'], bg: ['Омепразол', 'Лосек', 'Омез'], ru: ['Омепразол', 'Омез', 'Ультоп', 'Лосек'], zh: ['奥美拉唑', '洛赛克'], ja: ['オメプラール', 'オメプラゾール'] },
  loperamide: { en: ['Imodium', 'Lopedium', 'Loperamid'], bg: ['Имодиум', 'Лоперамид'], ru: ['Имодиум', 'Лоперамид', 'Лопедиум'], zh: ['洛哌丁胺', '易蒙停'] },
  drotaverine: { en: ['No-Spa', 'No Spa', 'Nospa', 'Drotaverin'], bg: ['Но-Шпа', 'Дротаверин'], ru: ['Но-шпа', 'Дротаверин', 'Спазмол'] },
  ambroxol: { en: ['Lazolvan', 'Mucosolvan', 'Ambrobene', 'Ambroxol'], bg: ['Амброксол', 'Лазолван', 'Мукосолван'], ru: ['Лазолван', 'Амброксол', 'Амбробене', 'Амброгексал'], zh: ['氨溴索', '沐舒坦'] },
  acetylcysteine: { en: ['ACC', 'Fluimucil', 'NAC', 'Mucomyst'], bg: ['АЦЦ', 'Ацетилцистеин', 'Флуимуцил'], ru: ['АЦЦ', 'Ацетилцистеин', 'Флуимуцил'], zh: ['乙酰半胱氨酸', '富露施'] },
  pancreatin: { en: ['Mezym', 'Creon', 'Festal', 'Pancreatin', 'Panzynorm'], bg: ['Мезим', 'Креон', 'Панкреатин', 'Фестал'], ru: ['Мезим', 'Креон', 'Панкреатин', 'Фестал', 'Панзинорм'] },
  simethicone: { en: ['Espumisan', 'Simeticone', 'Gas-X', 'Infacol', 'Bobotic'], bg: ['Еспумизан', 'Симетикон'], ru: ['Эспумизан', 'Симетикон', 'Боботик', 'Саб симплекс'], zh: ['二甲硅油'] },
  diosmectite: { en: ['Smecta', 'Smectite', 'Diosmectite'], bg: ['Смекта', 'Диосмектит'], ru: ['Смекта', 'Неосмектин', 'Диосмектит'], zh: ['蒙脱石散', '思密达'] },
  chloropyramine: { en: ['Suprastin', 'Chloropyramin'], bg: ['Супрастин', 'Хлоропирамин'], ru: ['Супрастин', 'Хлоропирамин'] },
  clemastine: { en: ['Tavegil', 'Tavist'], bg: ['Тавегил'], ru: ['Тавегил', 'Клемастин'] },
  salbutamol: { en: ['Ventolin', 'Albuterol', 'Salamol', 'ProAir'], bg: ['Вентолин', 'Салбутамол'], ru: ['Вентолин', 'Сальбутамол', 'Саламол'], zh: ['沙丁胺醇', '万托林'], ja: ['サルタノール', 'ベネトリン'] },
  metformin: { en: ['Glucophage', 'Siofor', 'Metfogamma', 'Glumetza'], bg: ['Метформин', 'Сиофор', 'Глюкофаж'], ru: ['Метформин', 'Сиофор', 'Глюкофаж'], zh: ['二甲双胍', '格华止'], ja: ['メトホルミン', 'メトグルコ'] },
  amlodipine: { en: ['Norvasc', 'Amlodipin', 'Tenox', 'Istin'], bg: ['Амлодипин', 'Норваск', 'Тенокс'], ru: ['Амлодипин', 'Норваск', 'Нормодипин'], zh: ['氨氯地平', '络活喜'], ja: ['アムロジン', 'ノルバスク'] },
  enalapril: { en: ['Renitec', 'Enap', 'Vasotec', 'Enalapril Maleate'], bg: ['Еналаприл', 'Енап', 'Ренитек'], ru: ['Эналаприл', 'Энап', 'Ренитек'], zh: ['依那普利'] },
  bisoprolol: { en: ['Concor', 'Bisoprolol Fumarate'], bg: ['Конкор', 'Бисопролол'], ru: ['Конкор', 'Бисопролол', 'Бипрол'], zh: ['比索洛尔', '康忻'] },
  atorvastatin: { en: ['Lipitor', 'Sortis', 'Atoris', 'Torvacard'], bg: ['Аторвастатин', 'Сортис', 'Аторис'], ru: ['Аторвастатин', 'Липримар', 'Аторис'], zh: ['阿托伐他汀', '立普妥'], ja: ['リピトール', 'アトルバスタチン'] },
  diazepam: { en: ['Valium', 'Relanium', 'Seduxen', 'Diazepam'], bg: ['Диазепам', 'Валиум'], ru: ['Диазепам', 'Реланиум', 'Сибазон', 'Седуксен'], zh: ['地西泮', '安定'], ja: ['ジアゼパム', 'セルシン'] },
  alprazolam: { en: ['Xanax', 'Helex', 'Alprazolam'], bg: ['Ксанакс', 'Алпразолам'], ru: ['Ксанакс', 'Алпразолам', 'Алзолам'], zh: ['阿普唑仑', '佳静安定'], ja: ['ソラナックス', 'コンスタン'] },
  tramadol: { en: ['Tramal', 'Ultram', 'Tramadol Hydrochloride', 'Zaldiar'], bg: ['Трамадол', 'Трамал'], ru: ['Трамадол', 'Трамал', 'Залдиар'], zh: ['曲马多'] },
  codeine: { en: ['Codeine Phosphate', 'Co-codamol', 'Solpadeine', 'Nurofen Plus', 'Codipront'], bg: ['Кодеин', 'Солпадеин'], ru: ['Кодеин', 'Солпадеин', 'Терпинкод'], zh: ['可待因'] },
  'ascorbic acid': { en: ['Vitamin C', 'Ascorbic Acid', 'Redoxon', 'Celaskon'], bg: ['Витамин C', 'Аскорбинова киселина'], ru: ['Витамин C', 'Аскорбиновая кислота', 'Аскорбинка'], zh: ['维生素C', '抗坏血酸'], ja: ['ビタミンC', 'アスコルビン酸'] },
  cholecalciferol: { en: ['Vitamin D3', 'Vigantol', 'D-Cure', 'Colecalciferol'], bg: ['Витамин D3', 'Вигантол'], ru: ['Витамин D3', 'Аквадетрим', 'Вигантол'], zh: ['维生素D3', '胆钙化醇'] },
  xylometazoline: { en: ['Otrivin', 'Xylomet', 'Olynth', 'Snup'], bg: ['Отривин', 'Ксилометазолин'], ru: ['Отривин', 'Ксилометазолин', 'Снуп', 'Ксилен'], zh: ['赛洛唑啉'] },
  chlorhexidine: { en: ['Corsodyl', 'Chlorhexidine Gluconate', 'Hexoral'], bg: ['Хлорхексидин'], ru: ['Хлоргексидин', 'Гексикон'], zh: ['氯己定', '洗必泰'] },
  fluconazole: { en: ['Diflucan', 'Flucoral', 'Mycomax'], bg: ['Флуконазол', 'Дифлукан'], ru: ['Флуконазол', 'Дифлюкан', 'Флюкостат'], zh: ['氟康唑', '大扶康'] },
  aciclovir: { en: ['Zovirax', 'Acyclovir', 'Aciclovir', 'Virolex'], bg: ['Ацикловир', 'Зовиракс'], ru: ['Ацикловир', 'Зовиракс'], zh: ['阿昔洛韦', '无环鸟苷'], ja: ['ゾビラックス', 'アシクロビル'] },
  levothyroxine: { en: ['Euthyrox', 'L-Thyroxine', 'Synthroid', 'Letrox', 'Eltroxin'], bg: ['Еутирокс', 'Левотироксин', 'L-Тироксин'], ru: ['Эутирокс', 'L-Тироксин', 'Левотироксин'], zh: ['左甲状腺素', '优甲乐'] },
  sildenafil: { en: ['Viagra', 'Revatio', 'Sildenafil Citrate'], bg: ['Виагра', 'Силденафил'], ru: ['Виагра', 'Силденафил'], zh: ['西地那非', '万艾可'], ja: ['バイアグラ', 'シルデナフィル'] },
  domperidone: { en: ['Motilium', 'Domperidon'], bg: ['Мотилиум', 'Домперидон'], ru: ['Мотилиум', 'Домперидон', 'Мотилак'], zh: ['多潘立酮', '吗丁啉'] },
  dexamethasone: { en: ['Dexamethason', 'Decadron', 'Dexamethasone Sodium Phosphate'], bg: ['Дексаметазон'], ru: ['Дексаметазон'], zh: ['地塞米松'], ja: ['デカドロン', 'デキサメタゾン'] },
  prednisolone: { en: ['Prednisolon', 'Prednisone', 'Medrol', 'Deltacortril'], bg: ['Преднизолон', 'Медрол'], ru: ['Преднизолон', 'Медрол'], zh: ['泼尼松龙', '强的松'], ja: ['プレドニン', 'プレドニゾロン'] },
  validol: { en: ['Validol', 'Menthyl isovalerate'], bg: ['Валидол'], ru: ['Валидол', 'Ментола раствор в ментил изовалерате'] },
  'oral rehydration salts': { en: ['ORS', 'Rehydron', 'Hydrovit', 'Oralit', 'Electrolytes'], bg: ['Регидрон', 'Хидровит', 'Орални рехидратиращи соли'], ru: ['Регидрон', 'Регидратационные соли', 'Гидровит'], zh: ['口服补液盐'] },
  'activated charcoal': { en: ['Activated Carbon', 'Carbo Medicinalis', 'Norit'], bg: ['Активен въглен', 'Карбо медициналис'], ru: ['Активированный уголь', 'Уголь активированный', 'Карболонг'], zh: ['活性炭', '药用炭'] },
  'clavulanic acid': { en: ['Augmentin', 'Amoxiclav', 'Clavulanate', 'Co-amoxiclav', 'Amoxicillin Clavulanate'], bg: ['Аугментин', 'Амоксиклав'], ru: ['Аугментин', 'Амоксиклав', 'Клавуланат'], zh: ['克拉维酸', '安灭菌'] },
  bromhexine: { en: ['Bisolvon', 'Bromhexin'], bg: ['Бромхексин', 'Бизолвон'], ru: ['Бромгексин', 'Бизолвон'], zh: ['溴己新'] },
  dextromethorphan: { en: ['Robitussin DM', 'Delsym', 'Tussidex'], bg: ['Декстрометорфан'], ru: ['Декстрометорфан', 'Гликодин'], zh: ['右美沙芬'] },
  benzydamine: { en: ['Tantum Verde', 'Difflam'], bg: ['Тантум Верде', 'Бензидамин'], ru: ['Тантум Верде', 'Бензидамин'] },
  dexpanthenol: { en: ['Bepanthen', 'Panthenol', 'D-Panthenol'], bg: ['Бепантен', 'Пантенол', 'Декспантенол'], ru: ['Бепантен', 'Пантенол', 'Декспантенол', 'Д-пантенол'], zh: ['泛醇', '右泛醇'] },
  ondansetron: { en: ['Zofran', 'Ondansetron Hydrochloride'], bg: ['Ондансетрон', 'Зофран'], ru: ['Ондансетрон', 'Зофран', 'Латран'], zh: ['昂丹司琼', '枢复宁'] },
  lidocaine: { en: ['Xylocaine', 'Lignocaine', 'Lidocaine Hydrochloride', 'Emla'], bg: ['Лидокаин', 'Ксилокаин'], ru: ['Лидокаин', 'Ксилокаин', 'Версатис'], zh: ['利多卡因'], ja: ['キシロカイン', 'リドカイン'] },
  clopidogrel: { en: ['Plavix', 'Zyllt', 'Clopidogrel Bisulfate'], bg: ['Плавикс', 'Клопидогрел'], ru: ['Плавикс', 'Клопидогрел', 'Зилт'], zh: ['氯吡格雷', '波立维'] },
  warfarin: { en: ['Coumadin', 'Warfarin Sodium', 'Marevan'], bg: ['Варфарин', 'Синтром'], ru: ['Варфарин', 'Варфарекс'], zh: ['华法林'] },
  furosemide: { en: ['Lasix', 'Frusemide', 'Furosemid'], bg: ['Фуроземид', 'Лазикс'], ru: ['Фуросемид', 'Лазикс'], zh: ['呋塞米', '速尿'] },
  losartan: { en: ['Cozaar', 'Lorista', 'Losartan Potassium'], bg: ['Лозартан', 'Лориста', 'Козаар'], ru: ['Лозартан', 'Лориста', 'Лозап'], zh: ['氯沙坦', '科素亚'] },
  pantoprazole: { en: ['Controloc', 'Protonix', 'Nolpaza', 'Pantoprazol'], bg: ['Пантопразол', 'Контролок', 'Нолпаза'], ru: ['Пантопразол', 'Нольпаза', 'Контролок'], zh: ['泮托拉唑'] },
  esomeprazole: { en: ['Nexium', 'Emanera', 'Esomeprazol'], bg: ['Езомепразол', 'Нексиум', 'Еманера'], ru: ['Эзомепразол', 'Нексиум', 'Эманера'], zh: ['埃索美拉唑', '耐信'] },
  hyoscine: { en: ['Buscopan', 'Hyoscine Butylbromide', 'Scopolamine Butylbromide'], bg: ['Бускопан', 'Бускалисин'], ru: ['Бускопан', 'Гиосцина бутилбромид'], zh: ['丁溴东莨菪碱', '解痉灵'] },
  mebeverine: { en: ['Duspatalin', 'Colofac', 'Mebeverin'], bg: ['Дуспаталин', 'Мебеверин'], ru: ['Дюспаталин', 'Мебеверин', 'Спарекс'] },
  levocetirizine: { en: ['Xyzal', 'Levocetirizin'], bg: ['Ксизал', 'Левоцетиризин'], ru: ['Ксизал', 'Левоцетиризин', 'Супрастинекс'], zh: ['左西替利嗪'] },
  fexofenadine: { en: ['Allegra', 'Telfast', 'Fexofenadine Hydrochloride'], bg: ['Телфаст', 'Фексофенадин'], ru: ['Телфаст', 'Аллегра', 'Фексофенадин'], zh: ['非索非那定'], ja: ['アレグラ', 'フェキソフェナジン'] },
  montelukast: { en: ['Singulair', 'Montelukast Sodium'], bg: ['Сингулер', 'Монтелукаст'], ru: ['Сингуляр', 'Монтелукаст', 'Монтелар'], zh: ['孟鲁司特', '顺尔宁'], ja: ['シングレア', 'キプレス'] },
  budesonide: { en: ['Pulmicort', 'Symbicort', 'Budesonid', 'Rhinocort'], bg: ['Пулмикорт', 'Будезонид', 'Симбикорт'], ru: ['Пульмикорт', 'Будесонид', 'Симбикорт'], zh: ['布地奈德', '普米克'] },
  ranitidine: { en: ['Zantac', 'Ranitidin', 'Ranitidine Hydrochloride'], bg: ['Ранитидин', 'Зантак'], ru: ['Ранитидин', 'Зантак'], zh: ['雷尼替丁'] },
  famotidine: { en: ['Pepcid', 'Quamatel', 'Famotidin'], bg: ['Фамотидин', 'Квамател'], ru: ['Фамотидин', 'Квамател'], zh: ['法莫替丁'] },
  bisacodyl: { en: ['Dulcolax', 'Bisacodyl'], bg: ['Дулколакс', 'Бизакодил'], ru: ['Дульколакс', 'Бисакодил'], zh: ['比沙可啶'] },
  lactulose: { en: ['Duphalac', 'Lactulose', 'Normase'], bg: ['Дуфалак', 'Лактулоза'], ru: ['Дюфалак', 'Лактулоза', 'Нормазе'], zh: ['乳果糖', '杜密克'] },
  macrogol: { en: ['Forlax', 'Movicol', 'Miralax', 'PEG 4000', 'Macrogol 4000'], bg: ['Форлакс', 'Макрогол'], ru: ['Форлакс', 'Макрогол', 'Лавакол'], zh: ['聚乙二醇', '福松'] },
  metoclopramide: { en: ['Cerucal', 'Reglan', 'Primperan', 'Metoclopramid'], bg: ['Церукал', 'Метоклопрамид', 'Дегàн'], ru: ['Церукал', 'Метоклопрамид'], zh: ['甲氧氯普胺', '胃复安'] },
  metronidazole: { en: ['Flagyl', 'Metronidazol', 'Trichopol', 'Efloran'], bg: ['Метронидазол', 'Флагил', 'Трихопол'], ru: ['Метронидазол', 'Трихопол', 'Флагил'], zh: ['甲硝唑', '灭滴灵'] },
  doxycycline: { en: ['Vibramycin', 'Doxycyclin', 'Unidox', 'Doxycycline Hyclate'], bg: ['Доксициклин', 'Вибрамицин'], ru: ['Доксициклин', 'Юнидокс', 'Вибрамицин'], zh: ['多西环素', '强力霉素'] },
  clarithromycin: { en: ['Klacid', 'Klabax', 'Fromilid', 'Biaxin'], bg: ['Кларитромицин', 'Клацид', 'Фромилид'], ru: ['Кларитромицин', 'Клацид', 'Фромилид'], zh: ['克拉霉素'] },
  cefuroxime: { en: ['Zinnat', 'Zinacef', 'Aksef', 'Cefuroxime Axetil'], bg: ['Цефуроксим', 'Зинат', 'Аксеф'], ru: ['Цефуроксим', 'Зиннат', 'Аксеф'], zh: ['头孢呋辛'] },
  cefixime: { en: ['Suprax', 'Cefixim', 'Pancef'], bg: ['Цефиксим', 'Панцеф'], ru: ['Цефиксим', 'Супракс', 'Панцеф'], zh: ['头孢克肟'] },
  ceftriaxone: { en: ['Rocephin', 'Ceftriaxon', 'Lendacin'], bg: ['Цефтриаксон', 'Роцефин'], ru: ['Цефтриаксон', 'Роцефин', 'Лендацин'], zh: ['头孢曲松', '罗氏芬'] },
  nitrofurantoin: { en: ['Furadantin', 'Macrobid', 'Furagin'], bg: ['Нитрофурантоин', 'Фурадантин'], ru: ['Нитрофурантоин', 'Фурадонин', 'Фурагин'], zh: ['呋喃妥因'] },
  ketorolac: { en: ['Ketanov', 'Toradol', 'Ketorol', 'Ketorolac Tromethamine'], bg: ['Кеторолак', 'Кетанов'], ru: ['Кеторол', 'Кетанов', 'Кеторолак'], zh: ['酮咯酸'] },
  meloxicam: { en: ['Movalis', 'Mobic', 'Meloxicam'], bg: ['Мелоксикам', 'Мовалис'], ru: ['Мовалис', 'Мелоксикам', 'Амелотекс'], zh: ['美洛昔康', '莫比可'] },
  glyceryl_trinitrate: { en: ['Nitroglycerin', 'Nitroglycerine', 'Nitromint', 'Nitrolingual'], bg: ['Нитроглицерин', 'Нитроминт'], ru: ['Нитроглицерин', 'Нитроминт', 'Нитроспрей'], zh: ['硝酸甘油'] },
  mometasone: { en: ['Nasonex', 'Elocom', 'Elocon', 'Mometasone Furoate'], bg: ['Назонекс', 'Елоком', 'Мометазон'], ru: ['Назонекс', 'Элоком', 'Мометазон', 'Момат'], zh: ['莫米松', '内舒拿'] },
  clotrimazole: { en: ['Canesten', 'Clotrimazol', 'Candid'], bg: ['Канестен', 'Клотримазол'], ru: ['Клотримазол', 'Кандид', 'Канестен'], zh: ['克霉唑'], hi: ['कैंडिड', 'क्लोट्रिमाज़ोल'] },
  terbinafine: { en: ['Lamisil', 'Terbinafin', 'Terbinafine Hydrochloride'], bg: ['Ламизил', 'Тербинафин'], ru: ['Ламизил', 'Тербинафин', 'Экзифин'], zh: ['特比萘芬', '兰美抒'] },
  ferrous_sulfate: { en: ['Iron', 'Ferrous Sulphate', 'Tardyferon', 'Sorbifer', 'Ferro-Gradumet'], bg: ['Желязо', 'Сорбифер', 'Тардиферон'], ru: ['Сорбифер', 'Тардиферон', 'Железа сульфат', 'Фенюльс'], zh: ['硫酸亚铁'] },
  'magnesium citrate': { en: ['Magne B6', 'Magnesium', 'Magnerot', 'Magnesium Citrate'], bg: ['Магне B6', 'Магнезий'], ru: ['Магне B6', 'Магний', 'Магнелис', 'Магнерот'], zh: ['柠檬酸镁'] },
  ethinylestradiol: { en: ['Yasmin', 'Diane-35', 'Microgynon', 'Jeanine', 'Novynette', 'Regulon'], bg: ['Ясмин', 'Диане-35', 'Регулон'], ru: ['Ярина', 'Джес', 'Регулон', 'Новинет', 'Диане-35'], zh: ['炔雌醇'] },
  levonorgestrel: { en: ['Postinor', 'Plan B', 'Escapelle', 'Mirena', 'Levonelle'], bg: ['Постинор', 'Ескапел'], ru: ['Постинор', 'Эскапел', 'Мирена'], zh: ['左炔诺孕酮', '毓婷'] },
  tadalafil: { en: ['Cialis', 'Tadalafil'], bg: ['Циалис', 'Тадалафил'], ru: ['Сиалис', 'Тадалафил'], zh: ['他达拉非', '希爱力'] },
  sertraline: { en: ['Zoloft', 'Asentra', 'Sertraline Hydrochloride'], bg: ['Золофт', 'Сертралин'], ru: ['Золофт', 'Сертралин', 'Асентра', 'Стимулотон'], zh: ['舍曲林', '左洛复'], ja: ['ジェイゾロフト', 'セルトラリン'] },
  fluoxetine: { en: ['Prozac', 'Fluoxetin', 'Fluoxetine Hydrochloride'], bg: ['Прозак', 'Флуоксетин'], ru: ['Прозак', 'Флуоксетин', 'Флуоксетин Ланнахер'], zh: ['氟西汀', '百忧解'] },
  escitalopram: { en: ['Cipralex', 'Lexapro', 'Escitalopram Oxalate'], bg: ['Ципралекс', 'Есциталопрам'], ru: ['Ципралекс', 'Эсциталопрам', 'Селектра'], zh: ['艾司西酞普兰', '来士普'], ja: ['レクサプロ', 'エスシタロプラム'] },
  zopiclone: { en: ['Imovane', 'Zimovane', 'Zopiclon'], bg: ['Имован', 'Зопиклон'], ru: ['Имован', 'Зопиклон', 'Сомнол'] },
  zolpidem: { en: ['Stilnox', 'Ambien', 'Zolpidem Tartrate'], bg: ['Стилнокс', 'Золпидем'], ru: ['Санвал', 'Золпидем', 'Ивадал'], zh: ['唑吡坦', '思诺思'], ja: ['マイスリー', 'ゾルピデム'] },
  melatonin: { en: ['Circadin', 'Melatonin', 'Melaxen'], bg: ['Мелатонин', 'Циркадин'], ru: ['Мелаксен', 'Мелатонин', 'Циркадин'], zh: ['褪黑素', '褪黑激素'], ja: ['メラトニン'] },
  carbamazepine: { en: ['Tegretol', 'Finlepsin', 'Carbamazepin'], bg: ['Тегретол', 'Карбамазепин'], ru: ['Тегретол', 'Финлепсин', 'Карбамазепин'], zh: ['卡马西平', '得理多'] },
  valproic_acid: { en: ['Depakine', 'Depakote', 'Convulex', 'Sodium Valproate', 'Valproate'], bg: ['Депакин', 'Валпроат', 'Конвулекс'], ru: ['Депакин', 'Конвулекс', 'Вальпроевая кислота'], zh: ['丙戊酸', '德巴金'] },
  gabapentin: { en: ['Neurontin', 'Gabagamma', 'Tebantin'], bg: ['Габапентин', 'Невронтин'], ru: ['Габапентин', 'Нейронтин', 'Тебантин'], zh: ['加巴喷丁'] },
  pregabalin: { en: ['Lyrica', 'Pregabalin'], bg: ['Лирика', 'Прегабалин'], ru: ['Лирика', 'Прегабалин'], zh: ['普瑞巴林', '乐瑞卡'] },
  oseltamivir: { en: ['Tamiflu', 'Oseltamivir Phosphate'], bg: ['Тамифлу', 'Озелтамивир'], ru: ['Тамифлю', 'Осельтамивир', 'Номидес'], zh: ['奥司他韦', '达菲'], ja: ['タミフル', 'オセルタミビル'] },
  hydroxychloroquine: { en: ['Plaquenil', 'Hydroxychloroquine Sulfate'], bg: ['Плаквенил', 'Хидроксихлорохин'], ru: ['Плаквенил', 'Гидроксихлорохин'], zh: ['羟氯喹', '纷乐'] },
  betahistine: { en: ['Betaserc', 'Betahistin', 'Vestibo'], bg: ['Бетасерк', 'Бетахистин', 'Вестибо'], ru: ['Бетасерк', 'Бетагистин', 'Вестибо', 'Тагиста'], zh: ['倍他司汀', '敏使朗'] },
  cinnarizine: { en: ['Stugeron', 'Cinnarizin'], bg: ['Стугерон', 'Цинаризин'], ru: ['Стугерон', 'Циннаризин'] },
  dimenhydrinate: { en: ['Dramamine', 'Gravol', 'Dimenhydrinat'], bg: ['Драмамин', 'Дименхидринат'], ru: ['Драмина', 'Дименгидринат', 'Авиамарин'], zh: ['茶苯海明', '晕海宁'] },
  tetryzoline: { en: ['Visine', 'Tetrahydrozoline', 'Tetryzolin'], bg: ['Визин', 'Тетризолин'], ru: ['Визин', 'Тетризолин', 'Монтевизин'], zh: ['四氢唑啉'] },
  'sodium cromoglicate': { en: ['Cromolyn', 'Cromoglicic Acid', 'Lomudal', 'Opticrom'], bg: ['Кромогликат', 'Кромохексал'], ru: ['Кромогексал', 'Кромоглициевая кислота', 'Лекролин'], zh: ['色甘酸钠'] },
  'hyaluronic acid': { en: ['Hyaluronate', 'Hylo-Comod', 'Sodium Hyaluronate', 'Artelac'], bg: ['Хиалуронова киселина', 'Хиало-комод'], ru: ['Гиалуроновая кислота', 'Хило-Комод', 'Оксиал'], zh: ['透明质酸', '玻尿酸'] },
  timolol: { en: ['Timoptic', 'Timolol Maleate', 'Arutimol'], bg: ['Тимолол', 'Арутимол'], ru: ['Тимолол', 'Арутимол', 'Окумед'], zh: ['噻吗洛尔'] },
  latanoprost: { en: ['Xalatan', 'Latanoprost', 'Glaumax'], bg: ['Ксалатан', 'Латанопрост'], ru: ['Ксалатан', 'Латанопрост', 'Глаумакс'], zh: ['拉坦前列素', '适利达'] },
  tobramycin: { en: ['Tobrex', 'Tobradex', 'Tobramycin Sulfate'], bg: ['Тобрекс', 'Тобрамицин', 'Тобрадекс'], ru: ['Тобрекс', 'Тобрамицин', 'Тобрадекс'], zh: ['妥布霉素', '托百士'] },
  chloramphenicol: { en: ['Levomycetin', 'Chloromycetin', 'Chloramphenicol'], bg: ['Хлорамфеникол', 'Левомицетин'], ru: ['Левомицетин', 'Хлорамфеникол', 'Синтомицин'], zh: ['氯霉素'] },
  ivermectin: { en: ['Stromectol', 'Ivermectin', 'Ivermectol'], bg: ['Ивермектин'], ru: ['Ивермектин'], zh: ['伊维菌素'] },
  mebendazole: { en: ['Vermox', 'Mebendazol'], bg: ['Вермокс', 'Мебендазол'], ru: ['Вермокс', 'Мебендазол', 'Вормин'], zh: ['甲苯咪唑'] },
  albendazole: { en: ['Zentel', 'Albendazol', 'Nemozole'], bg: ['Зентел', 'Албендазол'], ru: ['Немозол', 'Альбендазол', 'Зентел'], zh: ['阿苯达唑', '肠虫清'] },
  nystatin: { en: ['Nystatin', 'Mycostatin', 'Nystatine'], bg: ['Нистатин'], ru: ['Нистатин'], zh: ['制霉菌素'] },
  miconazole: { en: ['Daktarin', 'Miconazol', 'Micatin'], bg: ['Дактарин', 'Миконазол'], ru: ['Микозолон', 'Миконазол', 'Дактарин'], zh: ['咪康唑', '达克宁'] },
  permethrin: { en: ['Nix', 'Permethrin', 'Elimite'], bg: ['Перметрин', 'Никс'], ru: ['Перметрин', 'Медифокс', 'Никс'], zh: ['氯菊酯'] },
  mupirocin: { en: ['Bactroban', 'Mupirocin'], bg: ['Бактробан', 'Мупироцин'], ru: ['Бактробан', 'Мупироцин', 'Супироцин'], zh: ['莫匹罗星', '百多邦'] },
  'fusidic acid': { en: ['Fucidin', 'Fusidic Acid', 'Fusidin'], bg: ['Фуцидин', 'Фузидинова киселина'], ru: ['Фуцидин', 'Фузидиевая кислота', 'Фузидерм'], zh: ['夫西地酸', '立思丁'] },
  'benzoyl peroxide': { en: ['Benzac', 'Baziron', 'Benzoyl Peroxide', 'PanOxyl'], bg: ['Бензоил пероксид', 'Базирон'], ru: ['Базирон АС', 'Бензоила пероксид'], zh: ['过氧化苯甲酰', '班赛'] },
  minoxidil: { en: ['Regaine', 'Rogaine', 'Minoxidil', 'Alopexy'], bg: ['Миноксидил', 'Регейн'], ru: ['Миноксидил', 'Регейн', 'Алерана'], zh: ['米诺地尔', '落健'] },
  tamsulosin: { en: ['Omnic', 'Flomax', 'Tamsulosin Hydrochloride'], bg: ['Омник', 'Тамсулозин'], ru: ['Омник', 'Тамсулозин', 'Фокусин'], zh: ['坦索罗辛', '哈乐'] },
  glucosamine: { en: ['Glucosamine Sulfate', 'Dona', 'Artra', 'Teraflex'], bg: ['Глюкозамин', 'Дона'], ru: ['Глюкозамин', 'Дона', 'Терафлекс', 'Артра'], zh: ['氨基葡萄糖', '维骨力'] },
  'chondroitin sulfate': { en: ['Chondroitin', 'Structum', 'Chondroxide'], bg: ['Хондроитин', 'Структум'], ru: ['Хондроитин', 'Структум', 'Хондроксид'], zh: ['硫酸软骨素'] },
  nicotine: { en: ['Nicorette', 'NicoDerm', 'Nicotinell', 'Nicotine Patch', 'Nicotine Gum'], bg: ['Никорет', 'Никотинов пластир'], ru: ['Никоретте', 'Никотинелл'], zh: ['尼古丁', '力克雷'] }
};

// ---------- 1) списък на лекарствата (Wikidata INN, по брой статии) ----------
async function innList() {
  const rows = await cached('inn-list.json', () => sparql('SELECT ?item ?n ?inn WHERE { ?item wdt:P2275 ?inn ; wikibase:sitelinks ?n . FILTER(?n >= 12) FILTER(lang(?inn)="en") } ORDER BY DESC(?n) LIMIT 1500'));
  const seen = new Set(); const list = [];
  for (const b of rows) { const q = b.item.value.split('/').pop(); if (seen.has(q)) continue; seen.add(q); list.push({ q, inn: b.inn.value.toLowerCase().trim(), n: parseInt(b.n.value, 10) }); }
  const must = new Set(MUST.map((s) => s.toLowerCase()));
  const keep = list.filter((x) => !BLOCK.test(x.inn) || must.has(x.inn));
  const top = keep.filter((x) => must.has(x.inn) || keep.indexOf(x) < TOP);
  // задължителните, които са под прага (n<12) — добавяме и тях с отделна заявка по етикет
  const have = new Set(top.map((x) => x.inn));
  const missing = MUST.filter((m) => !have.has(m.toLowerCase()));
  if (missing.length) {
    const vals = missing.map((m) => '"' + m.replace(/"/g, '') + '"@en').join(' ');
    const extra = await cached('inn-must.json', () => sparql(`SELECT ?item ?inn ?n WHERE { VALUES ?inn { ${vals} } ?item wdt:P2275 ?inn . OPTIONAL { ?item wikibase:sitelinks ?n } }`));
    for (const b of extra) { const q = b.item.value.split('/').pop(); if (seen.has(q)) continue; seen.add(q); top.push({ q, inn: b.inn.value.toLowerCase(), n: parseInt((b.n || {}).value || '0', 10) }); }
  }
  return top;
}

// ---------- 2) етикети + синоними на езиците на екосистемата ----------
const WD_LANGS = ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh', 'zh-hans', 'zh-hant', 'zh-tw', 'zh-cn', 'zh-hk', 'la'];
const LANG_MAP = { 'zh-hans': 'zh', 'zh-cn': 'zh', 'zh-hant': 'zh-Hant', 'zh-tw': 'zh-Hant', 'zh-hk': 'zh-Hant' };
async function labels(items) {
  const out = {};
  const B = 100;
  for (let i = 0; i < items.length; i += B) {
    const batch = items.slice(i, i + B);
    const vals = batch.map((x) => 'wd:' + x.q).join(' ');
    const langs = WD_LANGS.map((l) => '"' + l + '"').join(',');
    const rows = await cached('labels-' + i + '-' + batch[batch.length - 1].q + '.json', async () => {
      const L = await sparql(`SELECT ?item ?l ?d WHERE { VALUES ?item { ${vals} } ?item rdfs:label ?l . FILTER(lang(?l) IN (${langs})) OPTIONAL { ?item schema:description ?d FILTER(lang(?d)=lang(?l)) } }`);
      await sleep(400);
      const A = await sparql(`SELECT ?item ?a WHERE { VALUES ?item { ${vals} } ?item skos:altLabel ?a . FILTER(lang(?a) IN (${langs})) }`);
      await sleep(400);
      return { L, A };
    });
    for (const b of rows.L) { const q = b.item.value.split('/').pop(); const lg = LANG_MAP[b.l['xml:lang']] || b.l['xml:lang']; const o = out[q] = out[q] || { names: {}, desc: {} }; (o.names[lg] = o.names[lg] || []).unshift(b.l.value); if (b.d && b.d.value) o.desc[lg] = b.d.value; }
    for (const b of rows.A) { const q = b.item.value.split('/').pop(); const lg = LANG_MAP[b.a['xml:lang']] || b.a['xml:lang']; const o = out[q] = out[q] || { names: {}, desc: {} }; (o.names[lg] = o.names[lg] || []).push(b.a.value); }
    process.stdout.write(`  етикети ${Math.min(i + B, items.length)}/${items.length}\r`);
  }
  console.log('');
  return out;
}

// ---------- 3) openFDA: локалната база на апа + онлайн за липсващите ----------
function loadLocalFda() {
  // v1.0024: апът вече не носи meds-db.json → първо мастер копието на пълната база (private/medikit-harvester)
  const master = path.join(ROOT, 'private', 'medikit-harvester', 'meds-db.full.json');
  if (fs.existsSync(master)) { const j = JSON.parse(fs.readFileSync(master, 'utf8')); const idx = new Map(); for (const m of j.items || []) for (const nm of (m.names || [])) { const k = norm(nm); if (k && !idx.has(k)) idx.set(k, m); } return idx; }
  for (const t of TREES) { const f = path.join(t, 'public', 'reference', 'meds-db.json'); if (fs.existsSync(f)) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); const idx = new Map(); for (const m of j.items || []) for (const nm of (m.names || [])) { const k = norm(nm); if (k && !idx.has(k)) idx.set(k, m); } return idx; } }
  return new Map();
}
async function fdaOnline(name) {
  const f = path.join(CACHE, 'fda'); fs.mkdirSync(f, { recursive: true });
  const c = path.join(f, norm(name) + '.json');
  if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, 'utf8'));
  let rec = null;
  try {
    const q = encodeURIComponent(name);
    const url = 'https://api.fda.gov/drug/label.json?search=(openfda.generic_name:"' + q + '"+OR+openfda.substance_name:"' + q + '")&limit=1';
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) { const j = await r.json(); const x = j.results && j.results[0]; if (x) { const first = (a) => Array.isArray(a) && a.length ? String(a[0]) : ''; const o = x.openfda || {}; rec = { active: (o.substance_name || []).slice(0, 4), usage: first(x.indications_and_usage), dosage: first(x.dosage_and_administration), form: first(o.route) + ' ' + first(o.dosage_form), warnings: first(x.warnings) }; } }
    await sleep(350);
  } catch (_) { rec = null; }
  fs.writeFileSync(c, JSON.stringify(rec), 'utf8');
  return rec;
}
const FORM_RE = [['tablet', /\btablets?\b|\bcaplets?\b/i], ['capsule', /\bcapsules?\b/i], ['syrup', /\bsyrup\b|oral solution|oral suspension|elixir/i], ['injection', /\binject|\bvials?\b|\bampoule|\bampul/i], ['cream', /\bcream\b|\bointment\b|\bgel\b/i], ['drops', /\bdrops\b|ophthalmic|\botic\b/i], ['inhaler', /\binhal|\baerosol\b/i], ['spray', /\bspray\b|\bnasal\b/i], ['patch', /\bpatch\b|\btransdermal\b/i], ['suppository', /suppositor|\brectal\b/i], ['powder', /\bpowder\b|\bsachet\b|\bgranule/i], ['solution', /\bsolution\b|\binfusion\b/i]];
function guessForm(txt) { for (const [k, re] of FORM_RE) if (re.test(txt)) return k; return ''; }
// Съставки: INN-ът от Wikidata е ЕДИНИЧНО вещество → ако openFDA етикетът (може да е комбиниран продукт,
// напр. amoxicillin + clavulanate) го съдържа, оставяме само него; иначе съставките от етикета.
function pickActive(inn, fdaActive, enNames) {
  const a = (fdaActive || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
  const keys = [inn].concat(enNames || []).map(norm).filter((k) => k.length >= 4);
  if (!a.length) return [inn];
  if (a.some((s) => keys.some((k) => norm(s) === k || norm(s).startsWith(k) || k.startsWith(norm(s))))) return [inn];
  return a.slice(0, 4);
}
const short = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// ---------- 4) OCR пакет (вграден tesseract.js + езикови модели) ----------
const OCR_FILES = [
  ['tesseract.min.js', 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'],
  ['worker.min.js', 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js'],
  ['tesseract-core-simd-lstm.wasm.js', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract-core-lstm.wasm.js', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js'],
  ['lang/eng.traineddata.gz', 'https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz'],
  ['lang/bul.traineddata.gz', 'https://tessdata.projectnaptha.com/4.0.0_fast/bul.traineddata.gz'],
  ['lang/rus.traineddata.gz', 'https://tessdata.projectnaptha.com/4.0.0_fast/rus.traineddata.gz'],
  ['lang/chi_sim.traineddata.gz', 'https://tessdata.projectnaptha.com/4.0.0_fast/chi_sim.traineddata.gz'],
  ['lang/chi_tra.traineddata.gz', 'https://tessdata.projectnaptha.com/4.0.0_fast/chi_tra.traineddata.gz'],
];
async function ocrPack() {
  const first = path.join(TREES[0], 'public', 'ocr');
  for (const [rel, url] of OCR_FILES) {
    const f = path.join(first, rel); fs.mkdirSync(path.dirname(f), { recursive: true });
    if (fs.existsSync(f) && fs.statSync(f).size > 1000) continue;
    process.stdout.write('  OCR: ' + rel + ' … ');
    const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) { console.log('HTTP ' + r.status); continue; }
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log(Math.round(fs.statSync(f).size / 1024) + ' KB');
  }
  fs.writeFileSync(path.join(first, 'pack.json'), JSON.stringify({ engine: 'tesseract.js 5.1.1', model: 'tessdata_fast 4.0.0', langs: ['eng', 'bul', 'rus', 'chi_sim', 'chi_tra'] }), 'utf8');
  // огледало в другите дървета
  for (const t of TREES.slice(1)) { const dst = path.join(t, 'public', 'ocr'); fs.mkdirSync(path.join(dst, 'lang'), { recursive: true }); for (const [rel] of OCR_FILES.concat([['pack.json']])) { const s = path.join(first, rel), d = path.join(dst, rel); if (fs.existsSync(s) && (!fs.existsSync(d) || fs.statSync(d).size !== fs.statSync(s).size)) fs.copyFileSync(s, d); } }
  console.log('✓ OCR пакет в ' + TREES.map((t) => path.relative(ROOT, path.join(t, 'public', 'ocr'))).join(', '));
}

// ---------- главно ----------
(async () => {
  if (args.ocr) { await ocrPack(); if (!args.db) return; }
  console.log('1) Wikidata INN списък…');
  const list = await innList();
  console.log('   ' + list.length + ' лекарства');
  console.log('2) етикети и синоними (' + WD_LANGS.length + ' езика)…');
  const lab = await labels(list);
  console.log('3) openFDA (локална база + онлайн за липсващите)…');
  const local = loadLocalFda();
  const items = []; let online = 0;
  for (const x of list) {
    const L = lab[x.q] || { names: {}, desc: {} };
    const names = {};
    // без химични/IUPAC имена и кодове (скоби, много цифри, E300, формули) — те са шум за търсенето
    const add = (lg, v) => { v = String(v || '').trim(); if (!v || v.length > 40 || v.length < 3 || /^Q\d+$/.test(v) || /[()\[\],;:=]/.test(v) || (v.match(/\d/g) || []).length >= 2 || /^E\d{3}/.test(v) || /^[A-Z]\d+[A-Z]\d+/.test(v)) return; const a = names[lg] = names[lg] || []; if (!a.some((s) => s.toLowerCase() === v.toLowerCase())) a.push(v); };
    add('en', x.inn);
    for (const lg of Object.keys(L.names)) for (const v of L.names[lg].slice(0, 14)) add(lg, v);
    const ex = EXTRA[x.inn] || EXTRA[x.inn.replace(/ /g, '_')];
    if (ex) for (const lg of Object.keys(ex)) for (const v of ex[lg]) add(lg, v);
    // openFDA: по INN + по всяко английско име
    let fda = null;
    for (const nm of (names.en || [])) { const k = norm(nm); if (local.has(k)) { fda = local.get(k); break; } }
    if (!fda && !args.offline) { const o = await fdaOnline(x.inn); if (o) { fda = o; online++; } }
    const txt = [fda && fda.form, fda && fda.usage, fda && fda.dosage, L.desc.en].filter(Boolean).join(' ');
    const desc = {}; for (const lg of Object.keys(L.desc)) { const d = L.desc[lg]; if (d && !/^(chemical compound|medication|drug|pharmaceutical drug|化合物|химическое соединение|химично съединение)$/i.test(d)) desc[lg] = short(d, 90); }
    items.push({ id: x.inn.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), q: x.q, inn: x.inn, n: x.n, names, active: pickActive(x.inn, fda && fda.active, names.en || []), form: guessForm(txt), usage: short(fda && fda.usage, 260), dosage: short(fda && fda.dosage, 220), warn: short(fda && fda.warnings, 160), desc });
  }
  items.sort((a, b) => b.n - a.n);
  const out = { count: items.length, updated: new Date().toISOString().slice(0, 10), source: 'Wikidata (INN, labels/aliases in 20 languages) + openFDA drug labels', langs: ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh', 'zh-Hant', 'la'], items };
  const json = JSON.stringify(out);
  for (const t of TREES) { const f = path.join(t, 'public', 'reference', 'med-db.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, json, 'utf8'); console.log('✓ ' + path.relative(ROOT, f) + ' (' + items.length + ' лекарства, ' + Math.round(json.length / 1024) + ' KB, openFDA онлайн: ' + online + ')'); }
})().catch((e) => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
