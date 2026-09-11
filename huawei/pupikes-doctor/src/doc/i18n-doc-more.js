// Version: 1.0022
// i18n-doc-more.js — допълва i18n-doc.js/body.js до ВСИЧКИТЕ 15 езика (11.09.2026, Huawei „multilingual
// environment"): досега надписите на Doctor бяха само bg/ru/en (другите падаха на английски).
// Ред на езиците във всеки масив: uk, de, fr, es, it, pt, ar, hi, ja, ky, zh-Hant (es-MX пада към es).
const L = ['uk', 'de', 'fr', 'es', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh-Hant'];
const row = (a) => { const o = {}; L.forEach((l, i) => { o[l] = a[i]; }); return o; };
const map = (src) => { const o = {}; for (const k in src) o[k] = row(src[k]); return o; };

// Ключове на S в i18n-doc.js
export const S_MORE = map({
  tagline: ['Сфотографуй проблему або опиши скарги → можливі збіги', 'Problem fotografieren oder Beschwerden beschreiben → mögliche Treffer', 'Photographiez le problème ou décrivez les symptômes → correspondances possibles', 'Fotografía el problema o describe los síntomas → posibles coincidencias', 'Fotografa il problema o descrivi i sintomi → possibili corrispondenze', 'Fotografe o problema ou descreva os sintomas → possíveis correspondências', 'صوّر المشكلة أو صف الأعراض ← تطابقات محتملة', 'समस्या की फ़ोटो लें या लक्षण बताएं → संभावित मिलान', '問題を撮影するか症状を入力 → 可能性のある一致', 'Көйгөйдү сүрөткө тарт же белгилерди жаз → мүмкүн болгон дал келүүлөр', '拍下問題或描述症狀 → 可能的相符情況'],
  photo_btn: ['📷 Сфотографуй проблему', '📷 Problem fotografieren', '📷 Photographier le problème', '📷 Fotografiar el problema', '📷 Fotografa il problema', '📷 Fotografar o problema', '📷 صوّر المشكلة', '📷 समस्या की फ़ोटो लें', '📷 問題を撮影', '📷 Көйгөйдү сүрөткө тарт', '📷 拍下問題'],
  area_label: ['Ділянка', 'Bereich', 'Zone', 'Zona', 'Zona', 'Zona', 'المنطقة', 'क्षेत्र', '部位', 'Аймак', '部位'],
  size_label: ['Розмір проблеми', 'Größe des Problems', 'Taille du problème', 'Tamaño del problema', 'Dimensione del problema', 'Tamanho do problema', 'حجم المشكلة', 'समस्या का आकार', '問題の大きさ', 'Көйгөйдүн өлчөмү', '問題大小'],
  pain_label: ['Біль', 'Schmerz', 'Douleur', 'Dolor', 'Dolore', 'Dor', 'الألم', 'दर्द', '痛み', 'Оору', '疼痛'],
  freq_label: ['Частота болю', 'Häufigkeit des Schmerzes', 'Fréquence de la douleur', 'Frecuencia del dolor', 'Frequenza del dolore', 'Frequência da dor', 'تكرار الألم', 'दर्द की आवृत्ति', '痛みの頻度', 'Оорунун жыштыгы', '疼痛頻率'],
  text_ph: ['Опиши скарги (напр. набрякло, болить при русі…)', 'Beschwerden beschreiben (z. B. geschwollen, schmerzt bei Bewegung…)', 'Décrivez les symptômes (ex. gonflé, douleur au mouvement…)', 'Describe los síntomas (p. ej. hinchado, duele al moverse…)', 'Descrivi i sintomi (es. gonfio, fa male muovendosi…)', 'Descreva os sintomas (ex. inchado, dói ao mover…)', 'صف الأعراض (مثلًا: تورم، ألم عند الحركة…)', 'लक्षण बताएं (जैसे सूजन, हिलने पर दर्द…)', '症状を入力（例：腫れている、動かすと痛い…）', 'Белгилерди жаз (мис. шишкен, кыймылдаганда ооруйт…)', '描述症狀（例如：腫脹、活動時疼痛…）'],
  analyze_btn: ['🔎 Аналізувати', '🔎 Analysieren', '🔎 Analyser', '🔎 Analizar', '🔎 Analizza', '🔎 Analisar', '🔎 تحليل', '🔎 विश्लेषण', '🔎 分析', '🔎 Талдоо', '🔎 分析'],
  analyzing: ['Аналізую…', 'Analyse läuft…', 'Analyse…', 'Analizando…', 'Analisi…', 'A analisar…', 'جارٍ التحليل…', 'विश्लेषण हो रहा है…', '分析中…', 'Талдоодо…', '分析中…'],
  no_match: ['Немає чіткого збігу — опиши докладніше або зверніться до лікаря.', 'Kein klarer Treffer — mehr Details angeben oder einen Arzt fragen.', 'Aucune correspondance claire — ajoutez des détails ou consultez un médecin.', 'Sin coincidencia clara — añade detalles o consulta a un médico.', 'Nessuna corrispondenza chiara — aggiungi dettagli o consulta un medico.', 'Sem correspondência clara — acrescente detalhes ou consulte um médico.', 'لا تطابق واضح — أضف تفاصيل أو استشر طبيبًا.', 'कोई स्पष्ट मिलान नहीं — और विवरण दें या डॉक्टर से सलाह लें।', '明確な一致なし — 詳細を追加するか医師に相談してください。', 'Так дал келүү жок — кененирээк жаз же дарыгерге кайрыл.', '沒有明確相符 — 請補充細節或諮詢醫師。'],
  res_title: ['Можливі збіги', 'Mögliche Treffer', 'Correspondances possibles', 'Posibles coincidencias', 'Possibili corrispondenze', 'Possíveis correspondências', 'التطابقات المحتملة', 'संभावित मिलान', '可能性のある一致', 'Мүмкүн болгон дал келүүлөр', '可能的相符情況'],
  res_advice: ['Що робити', 'Was tun', 'Que faire', 'Qué hacer', 'Cosa fare', 'O que fazer', 'ماذا تفعل', 'क्या करें', '対処法', 'Эмне кылуу керек', '該怎麼做'],
  res_seedoctor: ['Коли до лікаря', 'Wann zum Arzt', 'Quand consulter', 'Cuándo ir al médico', 'Quando andare dal medico', 'Quando ir ao médico', 'متى تراجع الطبيب', 'डॉक्टर के पास कब जाएं', '受診の目安', 'Качан дарыгерге', '何時就醫'],
  disclaimer_title: ['⚕️ Важливо — прочитай', '⚕️ Wichtig — bitte lesen', '⚕️ Important — à lire', '⚕️ Importante — lee', '⚕️ Importante — leggi', '⚕️ Importante — leia', '⚕️ مهم — اقرأ', '⚕️ महत्वपूर्ण — पढ़ें', '⚕️ 重要 — お読みください', '⚕️ Маанилүү — оку', '⚕️ 重要 — 請閱讀'],
  disclaimer_body: ['Цей застосунок НЕ ставить діагноз і НЕ пропонує реальне лікування. Зверніться до лікаря або іншого фахівця. Інформація тут суто інформативна. У невідкладному випадку негайно зверніться по медичну допомогу. Якщо випадок не терміновий — використовуйте інформацію орієнтовно та на власний ризик.', 'Diese App stellt KEINE Diagnose und bietet KEINE echte Behandlung. Wenden Sie sich an einen Arzt oder eine andere Fachkraft. Die Informationen hier sind rein informativ. Im Notfall sofort medizinische Hilfe holen. Ist der Fall nicht dringend, können Sie die Informationen als grobe Orientierung auf eigenes Risiko nutzen.', 'Cette application NE pose PAS de diagnostic et NE propose PAS de vrai traitement. Consultez un médecin ou un autre professionnel. Les informations sont purement informatives. En urgence, demandez immédiatement une aide médicale. Si le cas n’est pas urgent, utilisez ces informations à titre indicatif et à vos risques.', 'Esta app NO diagnostica y NO ofrece un tratamiento real. Consulta a un médico u otro profesional. La información es puramente informativa. En una emergencia busca ayuda médica de inmediato. Si no es urgente, puedes usar la información como orientación bajo tu responsabilidad.', 'Questa app NON fa diagnosi e NON offre un vero trattamento. Rivolgiti a un medico o a un altro professionista. Le informazioni sono puramente informative. In emergenza cerca subito aiuto medico. Se il caso non è urgente, usa le informazioni come orientamento a tuo rischio.', 'Esta app NÃO diagnostica e NÃO oferece tratamento real. Consulte um médico ou outro profissional. A informação é meramente informativa. Em emergência procure ajuda médica imediata. Se o caso não for urgente, use a informação como orientação por sua conta e risco.', 'هذا التطبيق لا يُشخّص ولا يقدّم علاجًا حقيقيًا. راجع طبيبًا أو مختصًا آخر. المعلومات هنا للاطلاع فقط. في الحالات الطارئة اطلب المساعدة الطبية فورًا. إذا لم تكن الحالة عاجلة فاستخدم المعلومات كإرشاد تقريبي وعلى مسؤوليتك.', 'यह ऐप निदान नहीं करती और वास्तविक उपचार नहीं देती। डॉक्टर या अन्य विशेषज्ञ से संपर्क करें। यहाँ की जानकारी केवल सूचनात्मक है। आपात स्थिति में तुरंत चिकित्सा सहायता लें। यदि मामला अत्यावश्यक नहीं है, तो जानकारी को अपनी ज़िम्मेदारी पर मोटे मार्गदर्शन के रूप में उपयोग करें।', 'このアプリは診断を行わず、実際の治療も提供しません。医師や専門家に相談してください。ここの情報は参考情報のみです。緊急時は直ちに医療機関へ。緊急でない場合は、自己責任で大まかな目安としてご利用ください。', 'Бул колдонмо диагноз койбойт жана чыныгы дарылоону сунуштабайт. Дарыгерге же башка адиске кайрыл. Бул жердеги маалымат таанышуу үчүн гана. Шашылыш учурда дароо медициналык жардам ал. Эгер шашылыш болбосо, маалыматты болжолдуу багыт катары өз жоопкерчилигиңде колдон.', '本應用程式不做診斷，也不提供實際治療。請諮詢醫師或其他專業人員。此處資訊僅供參考。緊急情況請立即尋求醫療協助。若非緊急，可自行承擔風險將資訊作為粗略參考。'],
  disclaimer_agree: ['Зрозуміло — лише інформативно', 'Verstanden — nur zur Information', 'Compris — à titre informatif seulement', 'Entendido — solo información', 'Capito — solo informativo', 'Entendi — apenas informativo', 'فهمت — للمعلومات فقط', 'समझ गया — केवल जानकारी', '理解しました — 情報提供のみ', 'Түшүндүм — маалымат үчүн гана', '我了解 — 僅供參考'],
  disclaimer_cont: ['Продовжити', 'Weiter', 'Continuer', 'Continuar', 'Continua', 'Continuar', 'متابعة', 'जारी रखें', '続ける', 'Улантуу', '繼續'],
  ptype_label: ['Тип болю', 'Art des Schmerzes', 'Type de douleur', 'Tipo de dolor', 'Tipo di dolore', 'Tipo de dor', 'نوع الألم', 'दर्द का प्रकार', '痛みの種類', 'Оорунун түрү', '疼痛類型'],
  mode_symptoms: ['🩺 Ознаки / фото', '🩺 Symptome / Foto', '🩺 Symptômes / photo', '🩺 Síntomas / foto', '🩺 Sintomi / foto', '🩺 Sintomas / foto', '🩺 الأعراض / صورة', '🩺 लक्षण / फ़ोटो', '🩺 症状／写真', '🩺 Белгилер / сүрөт', '🩺 症狀／照片'],
  mode_body: ['🧍 Де болить', '🧍 Wo es wehtut', '🧍 Où ça fait mal', '🧍 Dónde duele', '🧍 Dove fa male', '🧍 Onde dói', '🧍 أين يؤلم', '🧍 कहाँ दर्द है', '🧍 痛む場所', '🧍 Кайсы жер ооруйт', '🧍 哪裡痛'],
  body_pick_type: ['Обери фігуру', 'Figur wählen', 'Choisir une silhouette', 'Elige una figura', 'Scegli una figura', 'Escolha uma figura', 'اختر الشكل', 'आकृति चुनें', '人物を選択', 'Фигураны танда', '選擇人形'],
  body_tap_hint: ['Торкнись частини тіла, де болить.', 'Tippe auf die Körperstelle, die schmerzt.', 'Touchez la partie du corps qui fait mal.', 'Toca la parte del cuerpo que duele.', 'Tocca la parte del corpo che fa male.', 'Toque na parte do corpo que dói.', 'المس جزء الجسم الذي يؤلم.', 'शरीर के उस हिस्से को छुएँ जहाँ दर्द है।', '痛む体の部位をタップしてください。', 'Ооруган дене бөлүгүн бас.', '點選疼痛的身體部位。'],
  body_more_zones: ['Інші зони:', 'Weitere Bereiche:', 'Autres zones :', 'Otras zonas:', 'Altre zone:', 'Outras zonas:', 'مناطق أخرى:', 'अन्य क्षेत्र:', 'その他の部位：', 'Башка аймактар:', '其他部位：'],
  body_causes_title: ['Можливі причини болю тут', 'Mögliche Ursachen für Schmerzen hier', 'Causes possibles de la douleur ici', 'Posibles causas del dolor aquí', 'Possibili cause del dolore qui', 'Possíveis causas da dor aqui', 'الأسباب المحتملة للألم هنا', 'यहाँ दर्द के संभावित कारण', 'この部位の痛みの考えられる原因', 'Бул жердеги оорунун мүмкүн себептери', '此處疼痛的可能原因'],
  body_redflag: ['⚠️ Терміново — звернись по допомогу, якщо:', '⚠️ Notfall — Hilfe holen, wenn:', '⚠️ Urgence — demandez de l’aide si :', '⚠️ Urgente — busca ayuda si:', '⚠️ Urgente — chiedi aiuto se:', '⚠️ Urgente — procure ajuda se:', '⚠️ طارئ — اطلب المساعدة إذا:', '⚠️ आपात — मदद लें यदि:', '⚠️ 緊急 — 次の場合は助けを求めて：', '⚠️ Шашылыш — жардам сура, эгер:', '⚠️ 緊急 — 若有以下情況請求助：']
});

// Опции (AREA/SIZE/PAIN/PAINTYPE/FREQ) — ключ = английският етикет.
export const OPT_MORE = map({
  'Skin': ['Шкіра', 'Haut', 'Peau', 'Piel', 'Pelle', 'Pele', 'الجلد', 'त्वचा', '皮膚', 'Тери', '皮膚'],
  'Soft tissue / bruise': ['М’які тканини / забій', 'Weichgewebe / Prellung', 'Tissu mou / contusion', 'Tejido blando / contusión', 'Tessuti molli / contusione', 'Tecido mole / contusão', 'أنسجة رخوة / كدمة', 'नरम ऊतक / चोट', '軟部組織／打撲', 'Жумшак ткань / көгөрүү', '軟組織／瘀傷'],
  'Muscle': ['М’яз', 'Muskel', 'Muscle', 'Músculo', 'Muscolo', 'Músculo', 'عضلة', 'मांसपेशी', '筋肉', 'Булчуң', '肌肉'],
  'Joint': ['Суглоб', 'Gelenk', 'Articulation', 'Articulación', 'Articolazione', 'Articulação', 'مفصل', 'जोड़', '関節', 'Муун', '關節'],
  'Bone': ['Кістка', 'Knochen', 'Os', 'Hueso', 'Osso', 'Osso', 'عظم', 'हड्डी', '骨', 'Сөөк', '骨骼'],
  'Nerve (numbness)': ['Нерв (оніміння)', 'Nerv (Taubheit)', 'Nerf (engourdissement)', 'Nervio (entumecimiento)', 'Nervo (intorpidimento)', 'Nervo (dormência)', 'عصب (خدر)', 'नस (सुन्नपन)', '神経（しびれ）', 'Нерв (уюп калуу)', '神經（麻木）'],
  'Bite / sting': ['Укус / ужалення', 'Biss / Stich', 'Morsure / piqûre', 'Mordedura / picadura', 'Morso / puntura', 'Mordida / picada', 'عضة / لسعة', 'काटना / डंक', '咬傷／刺傷', 'Чагуу / саюу', '咬傷／螫傷'],
  'Head': ['Голова', 'Kopf', 'Tête', 'Cabeza', 'Testa', 'Cabeça', 'الرأس', 'सिर', '頭', 'Баш', '頭部'],
  'Eye': ['Око', 'Auge', 'Œil', 'Ojo', 'Occhio', 'Olho', 'العين', 'आँख', '目', 'Көз', '眼睛'],
  'Ear': ['Вухо', 'Ohr', 'Oreille', 'Oído', 'Orecchio', 'Ouvido', 'الأذن', 'कान', '耳', 'Кулак', '耳朵'],
  'Mouth / tooth / throat': ['Рот / зуб / горло', 'Mund / Zahn / Hals', 'Bouche / dent / gorge', 'Boca / diente / garganta', 'Bocca / dente / gola', 'Boca / dente / garganta', 'الفم / السن / الحلق', 'मुँह / दाँत / गला', '口／歯／喉', 'Ооз / тиш / тамак', '口／牙／喉'],
  'Chest': ['Груди', 'Brust', 'Poitrine', 'Pecho', 'Torace', 'Peito', 'الصدر', 'छाती', '胸', 'Көкүрөк', '胸部'],
  'Abdomen': ['Живіт', 'Bauch', 'Abdomen', 'Abdomen', 'Addome', 'Abdómen', 'البطن', 'पेट', '腹部', 'Курсак', '腹部'],
  'Back': ['Спина / поперек', 'Rücken', 'Dos', 'Espalda', 'Schiena', 'Costas', 'الظهر', 'पीठ', '背中', 'Жон / бел', '背部'],
  'Pelvis / groin': ['Таз / пах', 'Becken / Leiste', 'Bassin / aine', 'Pelvis / ingle', 'Bacino / inguine', 'Pélvis / virilha', 'الحوض / الفخذ', 'श्रोणि / जांघ का जोड़', '骨盤／鼠径部', 'Жамбаш / чат', '骨盆／鼠蹊'],
  'Arm / shoulder': ['Рука / плече', 'Arm / Schulter', 'Bras / épaule', 'Brazo / hombro', 'Braccio / spalla', 'Braço / ombro', 'الذراع / الكتف', 'बाँह / कंधा', '腕／肩', 'Кол / ийин', '手臂／肩膀'],
  'Hand / wrist': ['Кисть / зап’ясток', 'Hand / Handgelenk', 'Main / poignet', 'Mano / muñeca', 'Mano / polso', 'Mão / pulso', 'اليد / المعصم', 'हाथ / कलाई', '手／手首', 'Алакан / билек', '手／手腕'],
  'Leg / thigh': ['Нога / стегно', 'Bein / Oberschenkel', 'Jambe / cuisse', 'Pierna / muslo', 'Gamba / coscia', 'Perna / coxa', 'الساق / الفخذ', 'टाँग / जाँघ', '脚／太もも', 'Бут / сан', '腿／大腿'],
  'Knee': ['Коліно', 'Knie', 'Genou', 'Rodilla', 'Ginocchio', 'Joelho', 'الركبة', 'घुटना', '膝', 'Тизе', '膝蓋'],
  'Foot / ankle': ['Стопа / гомілка', 'Fuß / Knöchel', 'Pied / cheville', 'Pie / tobillo', 'Piede / caviglia', 'Pé / tornozelo', 'القدم / الكاحل', 'पैर / टखना', '足／足首', 'Таман / шыйрак', '腳／腳踝'],
  'Other': ['Інше', 'Sonstiges', 'Autre', 'Otro', 'Altro', 'Outro', 'أخرى', 'अन्य', 'その他', 'Башка', '其他'],
  'Spot / very small': ['Цятка / дуже малий', 'Punkt / sehr klein', 'Point / très petit', 'Punto / muy pequeño', 'Puntino / molto piccolo', 'Ponto / muito pequeno', 'نقطة / صغير جدًا', 'बिंदु / बहुत छोटा', '点／とても小さい', 'Чекит / өтө кичине', '小點／非常小'],
  'Coin-sized': ['З монету', 'Münzgroß', 'Taille d’une pièce', 'Del tamaño de una moneda', 'Come una moneta', 'Do tamanho de uma moeda', 'بحجم عملة', 'सिक्के जितना', '硬貨大', 'Тыйындай', '硬幣大小'],
  'Small': ['Малий', 'Klein', 'Petit', 'Pequeño', 'Piccolo', 'Pequeno', 'صغير', 'छोटा', '小さい', 'Кичине', '小'],
  'Medium': ['Середній', 'Mittel', 'Moyen', 'Mediano', 'Medio', 'Médio', 'متوسط', 'मध्यम', '中くらい', 'Орточо', '中等'],
  'Palm-sized': ['З долоню', 'Handflächengroß', 'Taille d’une paume', 'Del tamaño de una palma', 'Come un palmo', 'Do tamanho de uma palma', 'بحجم كف اليد', 'हथेली जितना', '手のひら大', 'Алакандай', '手掌大小'],
  'Large': ['Великий', 'Groß', 'Grand', 'Grande', 'Grande', 'Grande', 'كبير', 'बड़ा', '大きい', 'Чоң', '大'],
  'Very large / whole limb': ['Дуже великий / уся кінцівка', 'Sehr groß / ganze Gliedmaße', 'Très grand / tout le membre', 'Muy grande / toda la extremidad', 'Molto grande / intero arto', 'Muito grande / todo o membro', 'كبير جدًا / الطرف كله', 'बहुत बड़ा / पूरा अंग', 'とても大きい／四肢全体', 'Өтө чоң / бүт мүчө', '非常大／整個肢體'],
  'None': ['Немає', 'Keine', 'Aucune', 'Ninguno', 'Nessuno', 'Nenhuma', 'لا يوجد', 'नहीं', 'なし', 'Жок', '無'],
  'Mild': ['Слабкий', 'Leicht', 'Légère', 'Leve', 'Lieve', 'Leve', 'خفيف', 'हल्का', '軽い', 'Жеңил', '輕微'],
  'Moderate': ['Помірний', 'Mäßig', 'Modérée', 'Moderado', 'Moderato', 'Moderada', 'متوسط', 'मध्यम', '中程度', 'Орточо', '中度'],
  'Severe': ['Сильний', 'Stark', 'Forte', 'Fuerte', 'Forte', 'Forte', 'شديد', 'तेज़', '強い', 'Катуу', '嚴重'],
  'Unbearable': ['Нестерпний', 'Unerträglich', 'Insupportable', 'Insoportable', 'Insopportabile', 'Insuportável', 'لا يُحتمل', 'असहनीय', '耐えがたい', 'Чыдагыс', '無法忍受'],
  'Sharp': ['Гострий', 'Stechend', 'Aiguë', 'Agudo', 'Acuto', 'Aguda', 'حاد', 'तीखा', '鋭い', 'Курч', '尖銳'],
  'Dull': ['Тупий', 'Dumpf', 'Sourde', 'Sordo', 'Sordo', 'Surda', 'كليل', 'हल्का भारीपन', '鈍い', 'Мокок', '鈍痛'],
  'Burning': ['Пекучий', 'Brennend', 'Brûlante', 'Ardiente', 'Bruciante', 'Ardente', 'حارق', 'जलन', '焼けるような', 'Ачышкан', '灼熱'],
  'Stabbing': ['Колючий', 'Stichartig', 'Lancinante', 'Punzante', 'Trafittivo', 'Em pontada', 'طاعن', 'चुभन', '刺すような', 'Сайган', '刺痛'],
  'Throbbing': ['Пульсуючий', 'Pochend', 'Pulsatile', 'Pulsátil', 'Pulsante', 'Latejante', 'نابض', 'धड़कता', 'ズキズキ', 'Согуп ооруган', '抽痛'],
  'Cramping': ['Спазматичний', 'Krampfartig', 'Crampes', 'Cólico / calambre', 'Crampiforme', 'Em cólica', 'تشنجي', 'ऐंठन', 'けいれん性', 'Тартылган', '痙攣性'],
  'Tingling': ['Поколювання', 'Kribbeln', 'Fourmillements', 'Hormigueo', 'Formicolio', 'Formigueiro', 'وخز', 'झुनझुनी', 'チクチク／しびれ', 'Чымырган', '刺麻'],
  'Itching': ['Свербіж', 'Juckreiz', 'Démangeaison', 'Picor', 'Prurito', 'Comichão', 'حكة', 'खुजली', 'かゆみ', 'Кычышуу', '搔癢'],
  'Constant': ['Постійний', 'Ständig', 'Constante', 'Constante', 'Costante', 'Constante', 'مستمر', 'लगातार', '常に', 'Дайыма', '持續'],
  'On movement': ['При русі', 'Bei Bewegung', 'Au mouvement', 'Al moverse', 'Al movimento', 'Ao mover', 'عند الحركة', 'हिलने पर', '動かすと', 'Кыймылдаганда', '活動時'],
  'On touch/pressure': ['При дотику/тиску', 'Bei Berührung/Druck', 'Au toucher/pression', 'Al tocar/presionar', 'Al tocco/pressione', 'Ao toque/pressão', 'عند اللمس/الضغط', 'छूने/दबाने पर', '触る／押すと', 'Тийгенде/басканда', '觸碰／按壓時'],
  'In the morning': ['Вранці', 'Morgens', 'Le matin', 'Por la mañana', 'Al mattino', 'De manhã', 'في الصباح', 'सुबह', '朝に', 'Эртең менен', '早晨'],
  'At night': ['Уночі', 'Nachts', 'La nuit', 'Por la noche', 'Di notte', 'À noite', 'في الليل', 'रात में', '夜に', 'Түнкүсүн', '夜間'],
  'When eating': ['Під час їжі', 'Beim Essen', 'En mangeant', 'Al comer', 'Mangiando', 'Ao comer', 'عند الأكل', 'खाते समय', '食事のとき', 'Тамактанганда', '進食時'],
  'On breathing/cough': ['При диханні/кашлі', 'Beim Atmen/Husten', 'En respirant/toussant', 'Al respirar/toser', 'Respirando/tossendo', 'Ao respirar/tossir', 'عند التنفس/السعال', 'साँस/खाँसी पर', '呼吸／咳のとき', 'Дем алганда/жөтөлгөндө', '呼吸／咳嗽時'],
  'In episodes': ['Нападами', 'Anfallsweise', 'Par crises', 'A episodios', 'A episodi', 'Por episódios', 'على شكل نوبات', 'दौरों में', '発作的に', 'Ыгы-ыгы менен', '陣發性']
});

// Имена на състоянията — ключ = condition.id
export const COND_MORE = map({
  bruise: ['Забій / синець', 'Prellung / Bluterguss', 'Contusion / bleu', 'Moretón / contusión', 'Livido / contusione', 'Hematoma / contusão', 'كدمة', 'चोट / नील', '打撲／あざ', 'Көгөрүү', '瘀傷'],
  fracture: ['Можливий перелом', 'Möglicher Bruch', 'Fracture possible', 'Posible fractura', 'Possibile frattura', 'Possível fratura', 'كسر محتمل', 'संभावित फ्रैक्चर', '骨折の可能性', 'Сынык болушу мүмкүн', '可能骨折'],
  sprain: ['Розтягнення / підвертання', 'Verstauchung', 'Entorse', 'Esguince', 'Distorsione', 'Entorse', 'التواء', 'मोच', '捻挫', 'Чоюлуу', '扭傷'],
  cut: ['Поріз / рана', 'Schnittwunde', 'Coupure / plaie', 'Corte / herida', 'Taglio / ferita', 'Corte / ferida', 'جرح قطعي', 'कट / घाव', '切り傷', 'Кесилген жара', '割傷'],
  burn: ['Опік', 'Verbrennung', 'Brûlure', 'Quemadura', 'Ustione', 'Queimadura', 'حرق', 'जलना', 'やけど', 'Күйүк', '燒燙傷'],
  bite: ['Укус комахи', 'Insektenstich', 'Piqûre d’insecte', 'Picadura de insecto', 'Puntura d’insetto', 'Picada de inseto', 'لدغة حشرة', 'कीड़े का काटना', '虫刺され', 'Курт-кумурска чагуусу', '蟲咬'],
  rash: ['Висип / алергія', 'Ausschlag / Allergie', 'Éruption / allergie', 'Sarpullido / alergia', 'Eruzione / allergia', 'Erupção / alergia', 'طفح / حساسية', 'चकत्ते / एलर्जी', '発疹／アレルギー', 'Бөртпө / аллергия', '皮疹／過敏'],
  infection: ['Шкірна інфекція', 'Hautinfektion', 'Infection cutanée', 'Infección de la piel', 'Infezione cutanea', 'Infeção da pele', 'عدوى جلدية', 'त्वचा संक्रमण', '皮膚感染', 'Тери инфекциясы', '皮膚感染'],
  swelling: ['Набряк', 'Schwellung', 'Gonflement', 'Hinchazón', 'Gonfiore', 'Inchaço', 'تورم', 'सूजन', '腫れ', 'Шишик', '腫脹'],
  nosebleed: ['Носова кровотеча', 'Nasenbluten', 'Saignement de nez', 'Sangrado nasal', 'Epistassi', 'Sangramento nasal', 'نزيف الأنف', 'नाक से खून', '鼻血', 'Мурундан кан агуу', '流鼻血'],
  blister: ['Пухир', 'Blase', 'Ampoule', 'Ampolla', 'Vescica', 'Bolha', 'بثرة / فقاعة', 'छाला', '水ぶくれ', 'Көбүк', '水泡'],
  abrasion: ['Садно', 'Schürfwunde', 'Écorchure', 'Raspadura', 'Abrasione', 'Esfoladela', 'سحجة', 'खरोंच / छिलना', '擦り傷', 'Сыйрылуу', '擦傷'],
  boil: ['Фурункул / абсцес', 'Furunkel / Abszess', 'Furoncle / abcès', 'Forúnculo / absceso', 'Foruncolo / ascesso', 'Furúnculo / abcesso', 'دمّل / خراج', 'फोड़ा / फुंसी', 'おでき／膿瘍', 'Чыйкан / ириңдөө', '癤／膿瘍'],
  eczema: ['Екзема / дерматит', 'Ekzem / Dermatitis', 'Eczéma / dermatite', 'Eccema / dermatitis', 'Eczema / dermatite', 'Eczema / dermatite', 'إكزيما / التهاب جلد', 'एक्ज़िमा / डर्मेटाइटिस', '湿疹／皮膚炎', 'Экзема / дерматит', '濕疹／皮膚炎'],
  psoriasis: ['Псоріаз', 'Schuppenflechte', 'Psoriasis', 'Psoriasis', 'Psoriasi', 'Psoríase', 'صدفية', 'सोरायसिस', '乾癬', 'Псориаз', '乾癬'],
  fungal: ['Грибкова інфекція', 'Pilzinfektion', 'Infection fongique', 'Infección por hongos', 'Infezione fungina', 'Infeção fúngica', 'عدوى فطرية', 'फंगल संक्रमण', '真菌感染', 'Козу карын инфекциясы', '黴菌感染'],
  hives: ['Кропив’янка', 'Nesselsucht', 'Urticaire', 'Urticaria', 'Orticaria', 'Urticária', 'شرى', 'पित्ती', 'じんましん', 'Эсекирик', '蕁麻疹'],
  sunburn: ['Сонячний опік', 'Sonnenbrand', 'Coup de soleil', 'Quemadura solar', 'Scottatura solare', 'Queimadura solar', 'حروق الشمس', 'धूप से जलना', '日焼け', 'Күнгө күйүү', '曬傷'],
  frostbite: ['Обмороження', 'Erfrierung', 'Gelure', 'Congelación', 'Congelamento', 'Queimadura pelo frio', 'قضمة الصقيع', 'शीतदंश', '凍傷', 'Үшүк', '凍傷'],
  dislocation: ['Вивих суглоба', 'Gelenkverrenkung', 'Luxation', 'Luxación', 'Lussazione', 'Luxação', 'خلع مفصل', 'जोड़ का उतरना', '脱臼', 'Муун чыгуу', '關節脫位'],
  muscle_strain: ['Розтягнення м’яза', 'Muskelzerrung', 'Élongation musculaire', 'Distensión muscular', 'Stiramento muscolare', 'Distensão muscular', 'شد عضلي', 'मांसपेशी खिंचाव', '肉離れ', 'Булчуң чоюлуусу', '肌肉拉傷'],
  ingrown_nail: ['Врослий ніготь', 'Eingewachsener Nagel', 'Ongle incarné', 'Uña encarnada', 'Unghia incarnita', 'Unha encravada', 'ظفر ناشب', 'नाखून का अंदर बढ़ना', '巻き爪', 'Тырмак өсүп кирүү', '嵌甲']
});

// Зони на фигурата — ключ = id на зоната (body.js)
export const ZONE_MORE = map({
  head: ['Голова', 'Kopf', 'Tête', 'Cabeza', 'Testa', 'Cabeça', 'الرأس', 'सिर', '頭', 'Баш', '頭部'],
  face: ['Обличчя / око', 'Gesicht / Auge', 'Visage / œil', 'Cara / ojo', 'Viso / occhio', 'Rosto / olho', 'الوجه / العين', 'चेहरा / आँख', '顔／目', 'Бет / көз', '臉／眼'],
  ear: ['Вухо', 'Ohr', 'Oreille', 'Oído', 'Orecchio', 'Ouvido', 'الأذن', 'कान', '耳', 'Кулак', '耳朵'],
  throat: ['Горло / шия', 'Hals / Nacken', 'Gorge / cou', 'Garganta / cuello', 'Gola / collo', 'Garganta / pescoço', 'الحلق / الرقبة', 'गला / गर्दन', '喉／首', 'Тамак / моюн', '喉／頸'],
  chest: ['Груди', 'Brust', 'Poitrine', 'Pecho', 'Torace', 'Peito', 'الصدر', 'छाती', '胸', 'Көкүрөк', '胸部'],
  stomach: ['Верх живота', 'Oberbauch', 'Haut de l’abdomen', 'Abdomen superior', 'Addome superiore', 'Abdómen superior', 'أعلى البطن', 'ऊपरी पेट', '上腹部', 'Курсактын жогорку бөлүгү', '上腹部'],
  lower_abdomen: ['Низ живота', 'Unterbauch', 'Bas de l’abdomen', 'Abdomen inferior', 'Addome inferiore', 'Abdómen inferior', 'أسفل البطن', 'निचला पेट', '下腹部', 'Курсактын төмөнкү бөлүгү', '下腹部'],
  pelvis: ['Таз / пах', 'Becken / Leiste', 'Bassin / aine', 'Pelvis / ingle', 'Bacino / inguine', 'Pélvis / virilha', 'الحوض / الفخذ', 'श्रोणि / जांघ का जोड़', '骨盤／鼠径部', 'Жамбаш / чат', '骨盆／鼠蹊'],
  shoulder: ['Плече', 'Schulter', 'Épaule', 'Hombro', 'Spalla', 'Ombro', 'الكتف', 'कंधा', '肩', 'Ийин', '肩膀'],
  upper_arm: ['Плече (рука)', 'Oberarm', 'Bras (haut)', 'Brazo (parte superior)', 'Braccio (parte alta)', 'Braço (parte superior)', 'أعلى الذراع', 'ऊपरी बाँह', '上腕', 'Кардын жогорку бөлүгү', '上臂'],
  forearm: ['Передпліччя / лікоть', 'Unterarm / Ellbogen', 'Avant-bras / coude', 'Antebrazo / codo', 'Avambraccio / gomito', 'Antebraço / cotovelo', 'الساعد / المرفق', 'अग्रबाहु / कोहनी', '前腕／肘', 'Билек / чыканак', '前臂／手肘'],
  hand: ['Кисть / зап’ясток', 'Hand / Handgelenk', 'Main / poignet', 'Mano / muñeca', 'Mano / polso', 'Mão / pulso', 'اليد / المعصم', 'हाथ / कलाई', '手／手首', 'Алакан / билек', '手／手腕'],
  hip: ['Стегно (кульшовий суглоб)', 'Hüfte', 'Hanche', 'Cadera', 'Anca', 'Anca', 'الورك', 'कूल्हा', '股関節', 'Жамбаш муун', '髖部'],
  thigh: ['Стегно', 'Oberschenkel', 'Cuisse', 'Muslo', 'Coscia', 'Coxa', 'الفخذ', 'जाँघ', '太もも', 'Сан', '大腿'],
  knee: ['Коліно', 'Knie', 'Genou', 'Rodilla', 'Ginocchio', 'Joelho', 'الركبة', 'घुटना', '膝', 'Тизе', '膝蓋'],
  shin: ['Гомілка / литка', 'Schienbein / Wade', 'Tibia / mollet', 'Espinilla / pantorrilla', 'Stinco / polpaccio', 'Canela / barriga da perna', 'الساق / بطة الساق', 'पिंडली', 'すね／ふくらはぎ', 'Шыйрак / балтыр', '小腿／小腿肚'],
  foot: ['Стопа / гомілковостоп', 'Fuß / Knöchel', 'Pied / cheville', 'Pie / tobillo', 'Piede / caviglia', 'Pé / tornozelo', 'القدم / الكاحل', 'पैर / टखना', '足／足首', 'Таман / шыйрак муун', '腳／腳踝'],
  upper_back: ['Верх спини', 'Oberer Rücken', 'Haut du dos', 'Espalda alta', 'Parte alta della schiena', 'Parte superior das costas', 'أعلى الظهر', 'ऊपरी पीठ', '背中上部', 'Жондун жогорку бөлүгү', '上背部'],
  lower_back: ['Поперек', 'Unterer Rücken', 'Bas du dos', 'Zona lumbar', 'Zona lombare', 'Zona lombar', 'أسفل الظهر', 'निचली पीठ', '腰', 'Бел', '下背部'],
  tooth: ['Зуб / щелепа', 'Zahn / Kiefer', 'Dent / mâchoire', 'Diente / mandíbula', 'Dente / mascella', 'Dente / maxilar', 'السن / الفك', 'दाँत / जबड़ा', '歯／あご', 'Тиш / жаак', '牙／下顎']
});

// Фигури — ключ = id (man/woman/girl/boy)
export const BODY_MORE = map({
  man: ['Чоловік', 'Mann', 'Homme', 'Hombre', 'Uomo', 'Homem', 'رجل', 'पुरुष', '男性', 'Эркек', '男性'],
  woman: ['Жінка', 'Frau', 'Femme', 'Mujer', 'Donna', 'Mulher', 'امرأة', 'महिला', '女性', 'Аял', '女性'],
  girl: ['Дівчинка', 'Mädchen', 'Fille', 'Niña', 'Bambina', 'Menina', 'فتاة', 'लड़की', '女の子', 'Кыз', '女孩'],
  boy: ['Хлопчик', 'Junge', 'Garçon', 'Niño', 'Bambino', 'Menino', 'فتى', 'लड़का', '男の子', 'Бала', '男孩']
});
