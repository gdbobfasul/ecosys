// Version: 1.0021
// threat-words.js — ключови думи/изрази на 15-те езика, по които гласовият пазач разпознава:
//   help   — носещият вика за помощ;
//   threat — заплаха/принуда срещу носещия („ще те убия", „дай телефона", „качвай се в колата");
//   place  — следа НАКЪДЕ го водят (кола, гара, автобус, парк, гора, мазе, гараж…).
// Съпоставянето е по подниз в текста от разпознаването на реч (малки букви). Всичко на устройството.

export const THREAT_WORDS = {
  bg: {
    help: ['помощ', 'помогнете', 'помогни', 'спасете', 'спаси ме', 'полиция', 'викайте полиция', 'пусни ме', 'пуснете ме', 'остави ме', 'оставете ме', 'не ме пипай', 'мамо', 'татко', 'страх ме е', 'боли'],
    threat: ['ще те убия', 'ще те пребия', 'ще те нараня', 'дай телефона', 'дай ми телефона', 'дай парите', 'дай ми парите', 'млъкни', 'не мърдай', 'не викай', 'ела с мен', 'качвай се', 'качи се в колата', 'влизай в колата', 'тръгвай с мен', 'ще те заведа', 'нож', 'пистолет', 'ще те взема', 'ако кажеш на някого'],
    place: ['колата', 'кола', 'гарата', 'автобус', 'метро', 'парка', 'гората', 'мазето', 'гаража', 'блока', 'входа', 'реката', 'моста', 'тунела', 'строежа', 'магазина', 'спирката', 'училището', 'апартамента']
  },
  ru: {
    help: ['помогите', 'помоги', 'спасите', 'спаси меня', 'полиция', 'вызовите полицию', 'отпусти', 'отпустите', 'отстань', 'не трогай', 'мама', 'папа', 'мне страшно', 'больно'],
    threat: ['убью', 'я тебя убью', 'изобью', 'дай телефон', 'отдай телефон', 'дай деньги', 'отдай деньги', 'заткнись', 'не двигайся', 'не кричи', 'пойдём со мной', 'иди со мной', 'садись в машину', 'залезай в машину', 'я тебя отвезу', 'нож', 'пистолет', 'если скажешь кому'],
    place: ['машина', 'машину', 'вокзал', 'автобус', 'метро', 'парк', 'лес', 'подвал', 'гараж', 'подъезд', 'река', 'мост', 'туннель', 'стройка', 'магазин', 'остановка', 'школа', 'квартира']
  },
  uk: {
    help: ['допоможіть', 'допоможи', 'рятуйте', 'врятуй мене', 'поліція', 'викличте поліцію', 'відпусти', 'відпустіть', 'не чіпай', 'мамо', 'тату', 'мені страшно', 'боляче'],
    threat: ['уб\'ю', 'я тебе вб\'ю', 'поб\'ю', 'дай телефон', 'віддай телефон', 'дай гроші', 'віддай гроші', 'замовкни', 'не рухайся', 'не кричи', 'ходімо зі мною', 'сідай у машину', 'лізь у машину', 'я тебе відвезу', 'ніж', 'пістолет', 'якщо скажеш комусь'],
    place: ['машина', 'машину', 'вокзал', 'автобус', 'метро', 'парк', 'ліс', 'підвал', 'гараж', 'під\'їзд', 'річка', 'міст', 'тунель', 'будівництво', 'магазин', 'зупинка', 'школа', 'квартира']
  },
  en: {
    help: ['help', 'help me', 'somebody help', 'save me', 'police', 'call the police', 'let me go', 'let go of me', 'leave me alone', 'don\'t touch me', 'stop it', 'mom', 'mum', 'dad', 'i\'m scared', 'it hurts'],
    threat: ['i\'ll kill you', 'i will kill you', 'i\'ll hurt you', 'i will hurt you', 'give me the phone', 'give me your phone', 'give me the money', 'give me your money', 'shut up', 'don\'t move', 'don\'t scream', 'come with me', 'get in the car', 'get in', 'i\'ll take you', 'knife', 'gun', 'if you tell anyone'],
    place: ['the car', 'my car', 'the van', 'the station', 'the bus', 'the subway', 'the metro', 'the park', 'the woods', 'the forest', 'the basement', 'the garage', 'the river', 'the bridge', 'the tunnel', 'the building site', 'the shop', 'the store', 'the bus stop', 'the school', 'the apartment', 'the flat']
  },
  de: {
    help: ['hilfe', 'hilf mir', 'helft mir', 'rettet mich', 'polizei', 'ruft die polizei', 'lass mich los', 'lassen sie mich los', 'lass mich in ruhe', 'fass mich nicht an', 'hör auf', 'mama', 'papa', 'ich habe angst', 'es tut weh'],
    threat: ['ich bring dich um', 'ich bringe dich um', 'ich tu dir weh', 'gib mir das handy', 'gib mir dein handy', 'gib mir das geld', 'gib mir dein geld', 'halt die klappe', 'beweg dich nicht', 'schrei nicht', 'komm mit', 'komm mit mir', 'steig ein', 'steig ins auto', 'ich bring dich', 'messer', 'pistole', 'wenn du es jemandem sagst'],
    place: ['das auto', 'mein auto', 'der lieferwagen', 'der bahnhof', 'der bus', 'die u-bahn', 'der park', 'der wald', 'der keller', 'die garage', 'der fluss', 'die brücke', 'der tunnel', 'die baustelle', 'der laden', 'die haltestelle', 'die schule', 'die wohnung']
  },
  fr: {
    help: ['au secours', 'à l\'aide', 'aidez-moi', 'aide-moi', 'sauvez-moi', 'police', 'appelez la police', 'lâche-moi', 'lâchez-moi', 'laisse-moi', 'laissez-moi', 'ne me touche pas', 'arrête', 'maman', 'papa', 'j\'ai peur', 'ça fait mal'],
    threat: ['je vais te tuer', 'je te tue', 'je vais te faire mal', 'donne-moi le téléphone', 'donne-moi ton téléphone', 'donne-moi l\'argent', 'donne-moi ton argent', 'tais-toi', 'ferme-la', 'ne bouge pas', 'ne crie pas', 'viens avec moi', 'monte dans la voiture', 'monte', 'je t\'emmène', 'couteau', 'pistolet', 'si tu le dis à quelqu\'un'],
    place: ['la voiture', 'ma voiture', 'la camionnette', 'la gare', 'le bus', 'le métro', 'le parc', 'le bois', 'la forêt', 'la cave', 'le garage', 'la rivière', 'le pont', 'le tunnel', 'le chantier', 'le magasin', 'l\'arrêt', 'l\'école', 'l\'appartement']
  },
  es: {
    help: ['socorro', 'auxilio', 'ayuda', 'ayúdame', 'ayúdenme', 'sálvame', 'policía', 'llamen a la policía', 'suéltame', 'déjame', 'déjame en paz', 'no me toques', 'para', 'mamá', 'papá', 'tengo miedo', 'me duele'],
    threat: ['te voy a matar', 'te mato', 'te voy a hacer daño', 'dame el teléfono', 'dame el móvil', 'dame tu teléfono', 'dame el dinero', 'dame tu dinero', 'cállate', 'no te muevas', 'no grites', 'ven conmigo', 'vente conmigo', 'sube al coche', 'súbete al coche', 'te llevo', 'cuchillo', 'navaja', 'pistola', 'si se lo dices a alguien'],
    place: ['el coche', 'mi coche', 'la furgoneta', 'la estación', 'el autobús', 'el metro', 'el parque', 'el bosque', 'el sótano', 'el garaje', 'el río', 'el puente', 'el túnel', 'la obra', 'la tienda', 'la parada', 'el colegio', 'la escuela', 'el piso']
  },
  'es-MX': {
    help: ['auxilio', 'socorro', 'ayuda', 'ayúdame', 'ayúdenme', 'sálvame', 'policía', 'llamen a la policía', 'suéltame', 'déjame', 'déjame en paz', 'no me toques', 'ya', 'mamá', 'papá', 'tengo miedo', 'me duele'],
    threat: ['te voy a matar', 'te mato', 'te voy a lastimar', 'dame el teléfono', 'dame el celular', 'dame tu celular', 'dame el dinero', 'dame tu dinero', 'cállate', 'no te muevas', 'no grites', 'ven conmigo', 'vente conmigo', 'súbete al carro', 'sube al carro', 'te llevo', 'cuchillo', 'navaja', 'pistola', 'si le dices a alguien'],
    place: ['el carro', 'mi carro', 'la camioneta', 'la estación', 'el camión', 'el autobús', 'el metro', 'el parque', 'el bosque', 'el sótano', 'el garaje', 'el río', 'el puente', 'el túnel', 'la obra', 'la tienda', 'la parada', 'la escuela', 'el departamento']
  },
  it: {
    help: ['aiuto', 'aiutami', 'aiutatemi', 'salvatemi', 'polizia', 'chiamate la polizia', 'lasciami', 'lasciami andare', 'lasciami stare', 'non mi toccare', 'basta', 'mamma', 'papà', 'ho paura', 'mi fai male'],
    threat: ['ti ammazzo', 'ti uccido', 'ti faccio male', 'dammi il telefono', 'dammi il cellulare', 'dammi i soldi', 'stai zitto', 'stai zitta', 'non ti muovere', 'non urlare', 'vieni con me', 'sali in macchina', 'sali', 'ti porto', 'coltello', 'pistola', 'se lo dici a qualcuno'],
    place: ['la macchina', 'la mia macchina', 'il furgone', 'la stazione', 'l\'autobus', 'la metro', 'il parco', 'il bosco', 'la cantina', 'lo scantinato', 'il garage', 'il fiume', 'il ponte', 'il tunnel', 'il cantiere', 'il negozio', 'la fermata', 'la scuola', 'l\'appartamento']
  },
  pt: {
    help: ['socorro', 'ajuda', 'ajudem-me', 'ajuda-me', 'salvem-me', 'polícia', 'chamem a polícia', 'larga-me', 'larguem-me', 'deixa-me', 'deixa-me em paz', 'não me toques', 'pára', 'mãe', 'pai', 'tenho medo', 'dói'],
    threat: ['vou-te matar', 'eu mato-te', 'vou-te magoar', 'dá-me o telemóvel', 'dá-me o telefone', 'dá-me o dinheiro', 'cala-te', 'não te mexas', 'não grites', 'vem comigo', 'anda comigo', 'entra no carro', 'entra', 'eu levo-te', 'faca', 'pistola', 'se contares a alguém'],
    place: ['o carro', 'o meu carro', 'a carrinha', 'a estação', 'o autocarro', 'o metro', 'o parque', 'a mata', 'a floresta', 'a cave', 'a garagem', 'o rio', 'a ponte', 'o túnel', 'a obra', 'a loja', 'a paragem', 'a escola', 'o apartamento']
  },
  ar: {
    help: ['النجدة', 'ساعدوني', 'ساعدني', 'أنقذوني', 'أنقذني', 'الشرطة', 'اتصلوا بالشرطة', 'اتركني', 'اتركوني', 'ابتعد عني', 'لا تلمسني', 'توقف', 'ماما', 'أمي', 'بابا', 'أبي', 'أنا خائف', 'أنا خائفة', 'يؤلمني'],
    threat: ['سأقتلك', 'راح أقتلك', 'سأؤذيك', 'أعطني الهاتف', 'هات الهاتف', 'أعطني الجوال', 'أعطني المال', 'هات الفلوس', 'اسكت', 'اخرس', 'لا تتحرك', 'لا تصرخ', 'تعال معي', 'اركب السيارة', 'اطلع في السيارة', 'سآخذك', 'سكين', 'مسدس', 'إذا أخبرت أحداً'],
    place: ['السيارة', 'سيارتي', 'الشاحنة', 'المحطة', 'الباص', 'الحافلة', 'المترو', 'الحديقة', 'الغابة', 'القبو', 'الكراج', 'المرآب', 'النهر', 'الجسر', 'النفق', 'ورشة البناء', 'المتجر', 'الدكان', 'الموقف', 'المدرسة', 'الشقة']
  },
  hi: {
    help: ['बचाओ', 'मदद', 'मदद करो', 'मुझे बचाओ', 'पुलिस', 'पुलिस बुलाओ', 'छोड़ो', 'मुझे छोड़ो', 'छोड़ दो', 'मुझे मत छुओ', 'रुको', 'मम्मी', 'माँ', 'पापा', 'मुझे डर लग रहा है', 'दर्द हो रहा है'],
    threat: ['मार डालूँगा', 'जान से मार दूँगा', 'तुझे मार दूँगा', 'फोन दो', 'फोन दे', 'अपना फोन दो', 'पैसे दो', 'पैसे दे', 'चुप रहो', 'चुप', 'हिलना मत', 'चिल्लाना मत', 'मेरे साथ चलो', 'गाड़ी में बैठो', 'गाड़ी में चढ़ो', 'मैं तुझे ले जाऊँगा', 'चाकू', 'बंदूक', 'किसी को बताया तो'],
    place: ['गाड़ी', 'मेरी गाड़ी', 'वैन', 'स्टेशन', 'बस', 'मेट्रो', 'पार्क', 'जंगल', 'तहखाना', 'गैराज', 'नदी', 'पुल', 'सुरंग', 'निर्माण स्थल', 'दुकान', 'बस स्टॉप', 'स्कूल', 'फ्लैट']
  },
  ja: {
    help: ['助けて', 'たすけて', '誰か助けて', '助けてください', '警察', '警察を呼んで', '離して', '放して', 'やめて', '触らないで', 'ママ', 'お母さん', 'パパ', 'お父さん', '怖い', '痛い'],
    threat: ['殺すぞ', '殺す', '痛い目に', 'スマホをよこせ', '携帯をよこせ', '電話をよこせ', '金をよこせ', 'お金をよこせ', '黙れ', '動くな', '叫ぶな', '一緒に来い', 'ついて来い', '車に乗れ', '乗れ', '連れて行く', 'ナイフ', '包丁', '銃', '誰かに言ったら'],
    place: ['車', '俺の車', 'バン', '駅', 'バス', '地下鉄', '公園', '森', '林', '地下室', 'ガレージ', '川', '橋', 'トンネル', '工事現場', '店', 'バス停', '学校', 'アパート', 'マンション']
  },
  ky: {
    help: ['жардам', 'жардам бергиле', 'жардам бер', 'куткаргыла', 'мени куткар', 'милиция', 'полиция', 'милиция чакыргыла', 'коё бер', 'коё бергиле', 'тийбе', 'мага тийбе', 'токто', 'апа', 'ата', 'мен коркуп жатам', 'ооруп жатат'],
    threat: ['өлтүрөм', 'сени өлтүрөм', 'сабайм', 'телефонду бер', 'телефонуңду бер', 'акчаны бер', 'акчаңды бер', 'унчукпа', 'кыймылдаба', 'кыйкырба', 'мени менен жүр', 'машинага отур', 'машинага түш', 'сени алып кетем', 'бычак', 'тапанча', 'бирөөгө айтсаң'],
    place: ['машина', 'машинага', 'вокзал', 'автобус', 'метро', 'парк', 'токой', 'подвал', 'гараж', 'подъезд', 'дарыя', 'көпүрө', 'туннель', 'курулуш', 'дүкөн', 'аялдама', 'мектеп', 'батир']
  },
  'zh-Hant': {
    help: ['救命', '救救我', '幫幫我', '快來人', '警察', '報警', '叫警察', '放開我', '放手', '走開', '別碰我', '不要碰我', '住手', '媽媽', '爸爸', '我好怕', '好痛'],
    threat: ['我殺了你', '殺了你', '我會傷害你', '把手機給我', '手機拿來', '把錢給我', '錢拿來', '閉嘴', '不准動', '別動', '不准叫', '跟我走', '跟我來', '上車', '快上車', '我帶你走', '刀', '刀子', '槍', '你敢告訴別人'],
    place: ['車', '我的車', '車上', '貨車', '車站', '公車', '巴士', '捷運', '地鐵', '公園', '樹林', '森林', '地下室', '車庫', '河邊', '橋', '隧道', '工地', '商店', '公車站', '學校', '公寓']
  }
};

// Търси ключови изрази в текст. Връща { help:[], threat:[], place:[] } с намерените (може и празни).
// Проверява езика на апа И английски (много разпознавания връщат английски при смесена реч).
export function matchThreatWords(text, lang) {
  const out = { help: [], threat: [], place: [] };
  const low = String(text || '').toLowerCase();
  if (!low.trim()) return out;
  const sets = [THREAT_WORDS[lang], lang !== 'en' ? THREAT_WORDS.en : null].filter(Boolean);
  for (const set of sets) {
    for (const cat of ['help', 'threat', 'place']) {
      for (const w of set[cat]) if (low.includes(w) && !out[cat].includes(w)) out[cat].push(w);
    }
  }
  return out;
}

// Има ли сигнал за тревога (помощ или заплаха)?
export function isAlarming(m) { return !!(m && (m.help.length || m.threat.length)); }
