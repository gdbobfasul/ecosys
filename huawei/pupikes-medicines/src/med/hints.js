// Version: 1.0024
// hints.js — ПОМОЩНИ НАДПИСИ от опаковката (искане 09.09.2026): дребният текст („за кожа", „капки за очи",
// „таблетки", „сироп за деца", „500 mg"…) насочва КАКЪВ ТИП е лекарството. Речниците са на 15-те езика на
// екосистемата + латински съкращения от опаковките. classify(text) → { form, route, audience, strength, tags }.
// Ползва се: показва ред „Тип" в резултата и подсказва при търсене в базата (предпочитай записи със същата форма).
const FORMS = {
  tablet: ['tablet', 'tablets', 'tabs', 'tab.', 'таблетк', 'таблетки', 'таблеток', 'tabletten', 'comprimé', 'comprimés', 'comprimidos', 'compresse', 'comprimidos', 'أقراص', 'गोलियाँ', 'गोली', '錠', '錠剤', 'таблетка', 'таблеткалар', '藥片', '片劑'],
  capsule: ['capsule', 'capsules', 'caps', 'капсул', 'kapseln', 'gélule', 'cápsulas', 'capsule', 'كبسولات', 'कैप्सूल', 'カプセル', 'капсула', '膠囊'],
  syrup: ['syrup', 'сироп', 'sirup', 'sirop', 'jarabe', 'sciroppo', 'xarope', 'شراب', 'सिरप', 'シロップ', 'сироп', '糖漿'],
  drops: ['drops', 'капки', 'капли', 'краплі', 'tropfen', 'gouttes', 'gotas', 'gocce', 'قطرات', 'बूँदें', '点眼', '点鼻', 'тамчы', '滴劑', '眼藥水'],
  cream: ['cream', 'ointment', 'gel', 'крем', 'мехлем', 'мазь', 'маз', 'salbe', 'creme', 'crème', 'pommade', 'crema', 'pomada', 'unguento', 'كريم', 'مرهم', 'क्रीम', 'मरहम', 'クリーム', '軟膏', 'крем', 'майлуу', '乳膏', '藥膏'],
  spray: ['spray', 'спрей', 'aerosol', 'аерозол', 'аэрозоль', 'vaporisateur', 'بخاخ', 'स्प्रे', 'スプレー', '噴霧'],
  injection: ['injection', 'инжекц', 'инъекц', 'ампул', 'ampoule', 'ampullen', 'injektion', 'inyectable', 'iniettabile', 'injetável', 'حقن', 'इंजेक्शन', '注射', 'ампула', '注射劑'],
  suppository: ['suppositor', 'супозитор', 'свечи', 'свещи', 'zäpfchen', 'suppositoire', 'supositorio', 'supposte', 'تحاميل', 'सपोसिटरी', '坐薬', '栓劑'],
  inhaler: ['inhaler', 'инхалатор', 'ингалятор', 'inhalator', 'inhalateur', 'inhalador', 'inalatore', 'بخاخ استنشاق', 'इनहेलर', '吸入', 'ингалятор', '吸入器'],
  patch: ['patch', 'пластир', 'пластырь', 'pflaster', 'timbre', 'parche', 'cerotto', 'adesivo', 'لصقة', 'पैच', 'パッチ', 'пластырь', '貼片'],
  powder: ['powder', 'sachet', 'прах', 'порошок', 'саше', 'pulver', 'poudre', 'polvo', 'polvere', 'pó', 'مسحوق', 'पाउडर', '粉末', 'порошок', '粉劑'],
  solution: ['solution', 'разтвор', 'раствор', 'розчин', 'lösung', 'solución', 'soluzione', 'solução', 'محلول', 'घोल', '液', 'эритме', '溶液']
};
const ROUTES = {
  skin: ['for external use', 'external use', 'topical', 'apply to the skin', 'on the skin', 'за външна употреба', 'върху кожата', 'за кожа', 'наружно', 'для наружного применения', 'на кожу', 'зовнішньо', 'для зовнішнього', 'äußerlich', 'zur äußerlichen anwendung', 'auf die haut', 'usage externe', 'sur la peau', 'uso externo', 'sobre la piel', 'uso topico', 'sulla pelle', 'uso tópico', 'na pele', 'للاستعمال الخارجي', 'على الجلد', 'बाहरी उपयोग', 'त्वचा पर', '外用', '皮膚', 'сырткы колдонуу', 'терige', '外用', '塗抹於皮膚'],
  eyes: ['eye drops', 'ophthalmic', 'for the eyes', 'капки за очи', 'за очи', 'глазные', 'для глаз', 'очні', 'augentropfen', 'für die augen', 'collyre', 'pour les yeux', 'gotas oftálmicas', 'para los ojos', 'collirio', 'per gli occhi', 'oftálmico', 'para os olhos', 'قطرة للعين', 'للعين', 'आँखों के लिए', 'आई ड्रॉप', '点眼', '目薬', 'көз үчүн', 'көз тамчы', '眼用', '眼藥水'],
  ears: ['ear drops', 'otic', 'for the ears', 'капки за уши', 'за уши', 'ушные', 'для ушей', 'вушні', 'ohrentropfen', 'für die ohren', 'gouttes auriculaires', 'pour les oreilles', 'gotas óticas', 'para los oídos', 'gocce auricolari', 'per le orecchie', 'para os ouvidos', 'قطرة للأذن', 'للأذن', 'कानों के लिए', '点耳', '耳', 'кулак үчүн', '耳用', '耳藥水'],
  nose: ['nasal', 'nose drops', 'for the nose', 'за нос', 'назален', 'капки за нос', 'назальный', 'для носа', 'назальні', 'nasentropfen', 'für die nase', 'nasal', 'pour le nez', 'para la nariz', 'nasale', 'per il naso', 'para o nariz', 'للأنف', 'नाक के लिए', '点鼻', '鼻', 'мурун үчүн', '鼻用', '鼻噴劑'],
  oral: ['oral use', 'for oral use', 'by mouth', 'swallow', 'за перорално', 'за прием през устата', 'приема се през устата', 'внутрь', 'для приёма внутрь', 'перорально', 'zum einnehmen', 'oral', 'voie orale', 'par voie orale', 'vía oral', 'por vía oral', 'uso orale', 'per via orale', 'via oral', 'عن طريق الفم', 'मौखिक', 'मुँह से', '経口', '内服', 'ооз аркылуу', '口服'],
  rectal: ['rectal', 'ректал', 'rektal', 'voie rectale', 'vía rectal', 'rettale', 'شرجي', 'गुदा', '直腸', '肛門', 'ректалдык', '直腸'],
  vaginal: ['vaginal', 'вагинал', 'vaginal', 'voie vaginale', 'vía vaginal', 'vaginale', 'مهبلي', 'योनि', '膣', 'кынга', '陰道'],
  inhalation: ['inhalation', 'inhale', 'за инхалация', 'ингаляц', 'інгаляц', 'zur inhalation', 'inhalation', 'inhalación', 'inalazione', 'inalação', 'استنشاق', 'साँस लेना', '吸入', 'дем алуу', '吸入']
};
const AUDIENCE = {
  children: ['for children', 'children', 'kids', 'pediatric', 'paediatric', 'baby', 'infant', 'за деца', 'детски', 'детям', 'детский', 'для детей', 'дитячий', 'для дітей', 'für kinder', 'kinder', 'pour enfants', 'enfants', 'para niños', 'niños', 'infantil', 'per bambini', 'bambini', 'para crianças', 'crianças', 'للأطفال', 'أطفال', 'बच्चों के लिए', 'बच्चों', '小児', '子供用', 'балдар үчүн', '兒童', '小兒'],
  adults: ['for adults', 'adults', 'adult', 'за възрастни', 'взрослым', 'для взрослых', 'дорослим', 'für erwachsene', 'erwachsene', 'pour adultes', 'adultes', 'para adultos', 'adultos', 'per adulti', 'adulti', 'للبالغين', 'वयस्कों के लिए', '成人', 'чоңдор үчүн', '成人']
};
const TAGS = {
  antibiotic: ['antibiotic', 'антибиотик', 'antibiotikum', 'antibiotique', 'antibiótico', 'antibiotico', 'مضاد حيوي', 'एंटीबायोटिक', '抗生物質', '抗生素'],
  painkiller: ['pain relief', 'painkiller', 'analgesic', 'обезболяващ', 'болкоуспокояващ', 'обезболивающ', 'знеболюваль', 'schmerzmittel', 'antalgique', 'analgésique', 'analgésico', 'analgesico', 'مسكن', 'दर्द निवारक', '鎮痛', '止痛'],
  fever: ['fever', 'antipyretic', 'при температура', 'жаропонижающ', 'жарознижуваль', 'fiebersenkend', 'fièvre', 'fiebre', 'febbre', 'febre', 'خافض للحرارة', 'बुखार', '解熱', '退燒'],
  allergy: ['allergy', 'antihistamine', 'при алергия', 'антихистамин', 'от аллергии', 'антигистамин', 'алергі', 'allergie', 'antihistaminikum', 'antihistaminique', 'alergia', 'antihistamínico', 'allergia', 'حساسية', 'एलर्जी', 'アレルギー', '過敏'],
  cough: ['cough', 'expectorant', 'при кашлица', 'от кашля', 'від кашлю', 'husten', 'toux', 'tos', 'tosse', 'سعال', 'खांसी', '咳', '咳嗽'],
  stomach: ['stomach', 'heartburn', 'digestion', 'за стомах', 'при киселини', 'желудок', 'изжога', 'шлунок', 'magen', 'sodbrennen', 'estomac', 'estómago', 'acidez', 'stomaco', 'estômago', 'معدة', 'पेट', '胃', '胃部'],
  vitamin: ['vitamin', 'витамин', 'vitamine', 'vitamina', 'فيتامين', 'विटामिन', 'ビタミン', '維生素'],
  heart: ['blood pressure', 'hypertension', 'кръвно налягане', 'хипертония', 'давление', 'гипертон', 'тиск', 'blutdruck', 'tension artérielle', 'presión arterial', 'pressione', 'pressão arterial', 'ضغط الدم', 'रक्तचाप', '血圧', '血壓'],
  diabetes: ['diabetes', 'диабет', 'zucker', 'diabète', 'سكري', 'मधुमेह', '糖尿', '糖尿病']
};
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ');
function findAll(dict, text) {
  const hits = [];
  for (const k of Object.keys(dict)) { let n = 0; for (const w of dict[k]) { if (w && text.includes(w.toLowerCase())) n++; } if (n) hits.push({ k, n }); }
  hits.sort((a, b) => b.n - a.n);
  return hits.map((h) => h.k);
}
// Сила (mg / g / ml / IU / %).
function strengthOf(text) {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s?(mg|мг|g|г|ml|мл|iu|ме|мкг|mcg|µg|%)(?:\/(\d+\s?(?:ml|мл|g|г)))?/i);
  return m ? m[0].replace(/\s+/g, ' ') : '';
}
export function classify(rawText) {
  const text = norm(rawText);
  if (!text) return null;
  const forms = findAll(FORMS, text), routes = findAll(ROUTES, text), aud = findAll(AUDIENCE, text), tags = findAll(TAGS, text);
  // Извод за пътя от формата, ако не е написан изрично.
  let route = routes[0] || '';
  const form = forms[0] || '';
  if (!route) { if (form === 'cream' || form === 'patch') route = 'skin'; else if (form === 'tablet' || form === 'capsule' || form === 'syrup' || form === 'powder') route = 'oral'; else if (form === 'inhaler') route = 'inhalation'; else if (form === 'suppository') route = 'rectal'; }
  return { form, route, audience: aud[0] || '', strength: strengthOf(text), tags: tags.slice(0, 3), confidence: Math.min(1, (forms.length + routes.length + aud.length + tags.length) / 4) };
}
// Човешки етикети на 15 езика за показване.
const LBL = {
  form: { tablet: { bg:'таблетки', ru:'таблетки', uk:'таблетки', en:'tablets', de:'Tabletten', fr:'comprimés', es:'comprimidos', 'es-MX':'tabletas', it:'compresse', pt:'comprimidos', ar:'أقراص', hi:'गोलियाँ', ja:'錠剤', ky:'таблеткалар', 'zh-Hant':'錠劑' },
    capsule: { bg:'капсули', ru:'капсулы', uk:'капсули', en:'capsules', de:'Kapseln', fr:'gélules', es:'cápsulas', 'es-MX':'cápsulas', it:'capsule', pt:'cápsulas', ar:'كبسولات', hi:'कैप्सूल', ja:'カプセル', ky:'капсулалар', 'zh-Hant':'膠囊' },
    syrup: { bg:'сироп', ru:'сироп', uk:'сироп', en:'syrup', de:'Sirup', fr:'sirop', es:'jarabe', 'es-MX':'jarabe', it:'sciroppo', pt:'xarope', ar:'شراب', hi:'सिरप', ja:'シロップ', ky:'сироп', 'zh-Hant':'糖漿' },
    drops: { bg:'капки', ru:'капли', uk:'краплі', en:'drops', de:'Tropfen', fr:'gouttes', es:'gotas', 'es-MX':'gotas', it:'gocce', pt:'gotas', ar:'قطرات', hi:'बूँदें', ja:'点滴薬', ky:'тамчылар', 'zh-Hant':'滴劑' },
    cream: { bg:'крем/мехлем', ru:'крем/мазь', uk:'крем/мазь', en:'cream/ointment', de:'Creme/Salbe', fr:'crème/pommade', es:'crema/pomada', 'es-MX':'crema/pomada', it:'crema/unguento', pt:'creme/pomada', ar:'كريم/مرهم', hi:'क्रीम/मरहम', ja:'クリーム/軟膏', ky:'крем/майлуу', 'zh-Hant':'乳膏/藥膏' },
    spray: { bg:'спрей', ru:'спрей', uk:'спрей', en:'spray', de:'Spray', fr:'spray', es:'aerosol', 'es-MX':'aerosol', it:'spray', pt:'spray', ar:'بخاخ', hi:'स्प्रे', ja:'スプレー', ky:'спрей', 'zh-Hant':'噴霧' },
    injection: { bg:'инжекция', ru:'инъекция', uk:'ін’єкція', en:'injection', de:'Injektion', fr:'injection', es:'inyección', 'es-MX':'inyección', it:'iniezione', pt:'injeção', ar:'حقنة', hi:'इंजेक्शन', ja:'注射', ky:'инъекция', 'zh-Hant':'注射' },
    suppository: { bg:'супозитории', ru:'свечи', uk:'свічки', en:'suppositories', de:'Zäpfchen', fr:'suppositoires', es:'supositorios', 'es-MX':'supositorios', it:'supposte', pt:'supositórios', ar:'تحاميل', hi:'सपोसिटरी', ja:'坐薬', ky:'суппозиторий', 'zh-Hant':'栓劑' },
    inhaler: { bg:'инхалатор', ru:'ингалятор', uk:'інгалятор', en:'inhaler', de:'Inhalator', fr:'inhalateur', es:'inhalador', 'es-MX':'inhalador', it:'inalatore', pt:'inalador', ar:'بخاخ استنشاق', hi:'इनहेलर', ja:'吸入器', ky:'ингалятор', 'zh-Hant':'吸入器' },
    patch: { bg:'пластир', ru:'пластырь', uk:'пластир', en:'patch', de:'Pflaster', fr:'patch', es:'parche', 'es-MX':'parche', it:'cerotto', pt:'adesivo', ar:'لصقة', hi:'पैच', ja:'パッチ', ky:'пластырь', 'zh-Hant':'貼片' },
    powder: { bg:'прах/саше', ru:'порошок/саше', uk:'порошок/саше', en:'powder/sachet', de:'Pulver/Beutel', fr:'poudre/sachet', es:'polvo/sobre', 'es-MX':'polvo/sobre', it:'polvere/bustina', pt:'pó/saqueta', ar:'مسحوق', hi:'पाउडर', ja:'粉末', ky:'порошок', 'zh-Hant':'粉劑' },
    solution: { bg:'разтвор', ru:'раствор', uk:'розчин', en:'solution', de:'Lösung', fr:'solution', es:'solución', 'es-MX':'solución', it:'soluzione', pt:'solução', ar:'محلول', hi:'घोल', ja:'液剤', ky:'эритме', 'zh-Hant':'溶液' } },
  route: { skin: { bg:'върху кожата (външно)', ru:'на кожу (наружно)', uk:'на шкіру (зовнішньо)', en:'on the skin (external)', de:'auf die Haut (äußerlich)', fr:'sur la peau (externe)', es:'sobre la piel (externo)', 'es-MX':'sobre la piel (externo)', it:'sulla pelle (esterno)', pt:'na pele (externo)', ar:'على الجلد (خارجي)', hi:'त्वचा पर (बाहरी)', ja:'皮膚に（外用）', ky:'териге (сырткы)', 'zh-Hant':'皮膚（外用）' },
    eyes: { bg:'за очи', ru:'для глаз', uk:'для очей', en:'for the eyes', de:'für die Augen', fr:'pour les yeux', es:'para los ojos', 'es-MX':'para los ojos', it:'per gli occhi', pt:'para os olhos', ar:'للعين', hi:'आँखों के लिए', ja:'目に', ky:'көз үчүн', 'zh-Hant':'眼用' },
    ears: { bg:'за уши', ru:'для ушей', uk:'для вух', en:'for the ears', de:'für die Ohren', fr:'pour les oreilles', es:'para los oídos', 'es-MX':'para los oídos', it:'per le orecchie', pt:'para os ouvidos', ar:'للأذن', hi:'कानों के लिए', ja:'耳に', ky:'кулак үчүн', 'zh-Hant':'耳用' },
    nose: { bg:'за нос', ru:'для носа', uk:'для носа', en:'for the nose', de:'für die Nase', fr:'pour le nez', es:'para la nariz', 'es-MX':'para la nariz', it:'per il naso', pt:'para o nariz', ar:'للأنف', hi:'नाक के लिए', ja:'鼻に', ky:'мурун үчүн', 'zh-Hant':'鼻用' },
    oral: { bg:'през устата', ru:'внутрь', uk:'внутрішньо', en:'by mouth', de:'zum Einnehmen', fr:'par voie orale', es:'por vía oral', 'es-MX':'por vía oral', it:'per via orale', pt:'via oral', ar:'عن طريق الفم', hi:'मुँह से', ja:'経口', ky:'ооз аркылуу', 'zh-Hant':'口服' },
    rectal: { bg:'ректално', ru:'ректально', uk:'ректально', en:'rectal', de:'rektal', fr:'voie rectale', es:'vía rectal', 'es-MX':'vía rectal', it:'rettale', pt:'via retal', ar:'شرجي', hi:'गुदा मार्ग', ja:'直腸', ky:'ректалдык', 'zh-Hant':'直腸' },
    vaginal: { bg:'вагинално', ru:'вагинально', uk:'вагінально', en:'vaginal', de:'vaginal', fr:'voie vaginale', es:'vía vaginal', 'es-MX':'vía vaginal', it:'vaginale', pt:'via vaginal', ar:'مهبلي', hi:'योनि मार्ग', ja:'膣', ky:'кынга', 'zh-Hant':'陰道' },
    inhalation: { bg:'инхалация', ru:'ингаляция', uk:'інгаляція', en:'inhalation', de:'Inhalation', fr:'inhalation', es:'inhalación', 'es-MX':'inhalación', it:'inalazione', pt:'inalação', ar:'استنشاق', hi:'साँस द्वारा', ja:'吸入', ky:'дем алуу', 'zh-Hant':'吸入' } },
  audience: { children: { bg:'за деца', ru:'для детей', uk:'для дітей', en:'for children', de:'für Kinder', fr:'pour enfants', es:'para niños', 'es-MX':'para niños', it:'per bambini', pt:'para crianças', ar:'للأطفال', hi:'बच्चों के लिए', ja:'小児用', ky:'балдар үчүн', 'zh-Hant':'兒童用' },
    adults: { bg:'за възрастни', ru:'для взрослых', uk:'для дорослих', en:'for adults', de:'für Erwachsene', fr:'pour adultes', es:'para adultos', 'es-MX':'para adultos', it:'per adulti', pt:'para adultos', ar:'للبالغين', hi:'वयस्कों के लिए', ja:'成人用', ky:'чоңдор үчүн', 'zh-Hant':'成人用' } },
  tag: { antibiotic: { bg:'антибиотик', ru:'антибиотик', uk:'антибіотик', en:'antibiotic', de:'Antibiotikum', fr:'antibiotique', es:'antibiótico', 'es-MX':'antibiótico', it:'antibiotico', pt:'antibiótico', ar:'مضاد حيوي', hi:'एंटीबायोटिक', ja:'抗生物質', ky:'антибиотик', 'zh-Hant':'抗生素' },
    painkiller: { bg:'обезболяващо', ru:'обезболивающее', uk:'знеболювальне', en:'painkiller', de:'Schmerzmittel', fr:'antalgique', es:'analgésico', 'es-MX':'analgésico', it:'analgesico', pt:'analgésico', ar:'مسكن', hi:'दर्द निवारक', ja:'鎮痛薬', ky:'ооруну басуучу', 'zh-Hant':'止痛藥' },
    fever: { bg:'при температура', ru:'жаропонижающее', uk:'жарознижувальне', en:'fever reducer', de:'fiebersenkend', fr:'contre la fièvre', es:'antipirético', 'es-MX':'antipirético', it:'antipiretico', pt:'antipirético', ar:'خافض للحرارة', hi:'बुखार कम करने वाला', ja:'解熱薬', ky:'ысытма түшүрүүчү', 'zh-Hant':'退燒藥' },
    allergy: { bg:'при алергия', ru:'от аллергии', uk:'від алергії', en:'for allergy', de:'gegen Allergie', fr:'contre l\'allergie', es:'para la alergia', 'es-MX':'para la alergia', it:'per l\'allergia', pt:'para alergia', ar:'للحساسية', hi:'एलर्जी के लिए', ja:'アレルギー用', ky:'аллергияга каршы', 'zh-Hant':'抗過敏' },
    cough: { bg:'при кашлица', ru:'от кашля', uk:'від кашлю', en:'for cough', de:'gegen Husten', fr:'contre la toux', es:'para la tos', 'es-MX':'para la tos', it:'per la tosse', pt:'para a tosse', ar:'للسعال', hi:'खांसी के लिए', ja:'咳止め', ky:'жөтөлгө каршы', 'zh-Hant':'止咳' },
    stomach: { bg:'за стомах', ru:'для желудка', uk:'для шлунка', en:'for the stomach', de:'für den Magen', fr:'pour l\'estomac', es:'para el estómago', 'es-MX':'para el estómago', it:'per lo stomaco', pt:'para o estômago', ar:'للمعدة', hi:'पेट के लिए', ja:'胃薬', ky:'ашказан үчүн', 'zh-Hant':'胃藥' },
    vitamin: { bg:'витамин', ru:'витамин', uk:'вітамін', en:'vitamin', de:'Vitamin', fr:'vitamine', es:'vitamina', 'es-MX':'vitamina', it:'vitamina', pt:'vitamina', ar:'فيتامين', hi:'विटामिन', ja:'ビタミン', ky:'витамин', 'zh-Hant':'維生素' },
    heart: { bg:'кръвно налягане/сърце', ru:'давление/сердце', uk:'тиск/серце', en:'blood pressure/heart', de:'Blutdruck/Herz', fr:'tension/cœur', es:'presión/corazón', 'es-MX':'presión/corazón', it:'pressione/cuore', pt:'pressão/coração', ar:'ضغط الدم/القلب', hi:'रक्तचाप/हृदय', ja:'血圧/心臓', ky:'кан басым/жүрөк', 'zh-Hant':'血壓/心臟' },
    diabetes: { bg:'диабет', ru:'диабет', uk:'діабет', en:'diabetes', de:'Diabetes', fr:'diabète', es:'diabetes', 'es-MX':'diabetes', it:'diabete', pt:'diabetes', ar:'سكري', hi:'मधुमेह', ja:'糖尿病', ky:'диабет', 'zh-Hant':'糖尿病' } }
};
export function describe(h, lang) {
  if (!h) return '';
  const L = (grp, k) => { const e = LBL[grp][k]; return e ? (e[lang] || e.en) : k; };
  const parts = [];
  if (h.form) parts.push(L('form', h.form));
  if (h.route) parts.push(L('route', h.route));
  if (h.audience) parts.push(L('audience', h.audience));
  if (h.strength) parts.push(h.strength);
  (h.tags || []).forEach((t) => parts.push(L('tag', t)));
  return parts.join(' · ');
}
// Tesseract езиков пакет по езика на приложението (четем дребния текст и на 15-те езика).
// v1.0023: КИТАЙСКИ (chi_sim + chi_tra) влиза, когато интерфейсът/подсказките са китайски или японски
// ИЛИ когато вече разчетеният текст съдържа CJK знаци (втори параметър). Пакетите eng/bul/rus/chi_sim/chi_tra
// са ВГРАДЕНИ в апа (public/ocr/lang) — работят без интернет (Huawei тестерите са в Китай).
export const OCR_LANG = { bg: 'bul', ru: 'rus', uk: 'ukr', en: 'eng', de: 'deu', fr: 'fra', es: 'spa', 'es-MX': 'spa', it: 'ita', pt: 'por', ar: 'ara', hi: 'hin', ja: 'jpn', ky: 'kir', 'zh-Hant': 'chi_tra' };
export const OCR_BUNDLED = ['eng', 'bul', 'rus', 'chi_sim', 'chi_tra'];
// v1.0024: „точният" модел (tessdata_best, 12,8 MB) беше пробван и МАХНАТ — апът остава компактен (бързите модели).
// Списъкът остава за съвместимост (езици с вграден best модел в public/ocr/lang-best).
export const OCR_BEST = [];   // празно: best моделът е махнат по искане за компактност (11.09)
const CJK_RE = /[぀-ヿ㐀-鿿]/;
export function hasCjk(text) { return CJK_RE.test(String(text || '')); }
export function ocrLangsFor(uiLang, text) {
  const extra = OCR_LANG[uiLang] || 'eng';
  const packs = ['eng', 'bul', 'rus'];
  if (!packs.includes(extra)) packs.push(extra);
  const wantCjk = uiLang === 'zh-Hant' || uiLang === 'ja' || String(uiLang).startsWith('zh') || hasCjk(text);
  if (wantCjk) { for (const p of ['chi_sim', 'chi_tra']) if (!packs.includes(p)) packs.push(p); }
  return packs.join('+');
}
// Само китайските пакети (+ английски за латинските имена) — за резервния CJK етап на сканирането.
export function ocrLangsCjk() { return 'chi_sim+chi_tra+eng'; }
