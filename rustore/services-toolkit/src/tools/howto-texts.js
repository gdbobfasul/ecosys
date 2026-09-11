// Version: 1.0021
// howto-texts.js — текстовете ВЪТРЕ в урока (на избрания „език на надписите", независим от езика на
// интерфейса): етикет „Стъпка", подзаглавие на заглавния екран, финален текст по подразбиране и
// 4-те шаблона (заглавие + 4 примерни стъпки). 15 езика. Ползват се и за примерната инструкция.
const T = {
  bg: { step: 'Стъпка', inSteps: 'Видео инструкция · стъпки: {0}', outro: 'Готово! Благодаря, че гледахте.', tpl: {
    repair: { t: 'Смяна на крушка', s: ['Изключи лампата от контакта и изчакай крушката да изстине.', 'Развий старата крушка обратно на часовниковата стрелка.', 'Завий новата крушка по часовниковата стрелка до упор.', 'Включи лампата и провери дали свети.'] },
    recipe: { t: 'Бърз омлет за 5 минути', s: ['Счупи 2 яйца в купа и добави щипка сол.', 'Разбий с вилица, докато сместа стане гладка.', 'Изсипи в загрят тиган с малко масло.', 'Сгъни наполовина и сервирай топъл.'] },
    product: { t: 'Първо пускане на слушалки', s: ['Разопаковай и провери съдържанието на кутията.', 'Зареди калъфа с кабела около 30 минути.', 'Отвори калъфа и сдвои слушалките по Bluetooth.', 'Пусни песен и настрой силата на звука.'] },
    exercise: { t: 'Разгрявка за 2 минути', s: ['Застани изправен, краката на ширината на раменете.', 'Кръгове с ръцете — 10 напред и 10 назад.', '10 бавни клякания с изправен гръб.', 'Поеми дълбоко въздух и пийни вода.'] } } },
  ru: { step: 'Шаг', inSteps: 'Видеоинструкция · шагов: {0}', outro: 'Готово! Спасибо за просмотр.', tpl: {
    repair: { t: 'Замена лампочки', s: ['Отключите лампу от розетки и дайте лампочке остыть.', 'Выкрутите старую лампочку против часовой стрелки.', 'Вкрутите новую лампочку по часовой стрелке до упора.', 'Включите лампу и проверьте, что она горит.'] },
    recipe: { t: 'Быстрый омлет за 5 минут', s: ['Разбейте 2 яйца в миску и добавьте щепотку соли.', 'Взбейте вилкой до однородности.', 'Вылейте на разогретую сковороду с каплей масла.', 'Сложите пополам и подавайте горячим.'] },
    product: { t: 'Первое включение наушников', s: ['Распакуйте и проверьте содержимое коробки.', 'Зарядите кейс кабелем около 30 минут.', 'Откройте кейс и подключите наушники по Bluetooth.', 'Включите песню и настройте громкость.'] },
    exercise: { t: 'Разминка за 2 минуты', s: ['Встаньте прямо, ноги на ширине плеч.', 'Круги руками — 10 вперёд и 10 назад.', '10 медленных приседаний с прямой спиной.', 'Глубоко вдохните и выпейте воды.'] } } },
  uk: { step: 'Крок', inSteps: 'Відеоінструкція · кроків: {0}', outro: 'Готово! Дякуємо за перегляд.', tpl: {
    repair: { t: 'Заміна лампочки', s: ['Вимкніть лампу з розетки й дайте лампочці охолонути.', 'Викрутіть стару лампочку проти годинникової стрілки.', 'Вкрутіть нову лампочку за годинниковою стрілкою до упору.', 'Увімкніть лампу й перевірте, чи світить.'] },
    recipe: { t: 'Швидкий омлет за 5 хвилин', s: ['Розбийте 2 яйця в миску й додайте дрібку солі.', 'Збийте виделкою до однорідності.', 'Вилийте на розігріту сковороду з краплею олії.', 'Складіть навпіл і подавайте гарячим.'] },
    product: { t: 'Перше ввімкнення навушників', s: ['Розпакуйте й перевірте вміст коробки.', 'Зарядіть кейс кабелем близько 30 хвилин.', 'Відкрийте кейс і під’єднайте навушники через Bluetooth.', 'Увімкніть пісню й налаштуйте гучність.'] },
    exercise: { t: 'Розминка за 2 хвилини', s: ['Станьте рівно, ноги на ширині плечей.', 'Кола руками — 10 вперед і 10 назад.', '10 повільних присідань із рівною спиною.', 'Глибоко вдихніть і випийте води.'] } } },
  en: { step: 'Step', inSteps: 'How-to video · {0} steps', outro: 'Done! Thanks for watching.', tpl: {
    repair: { t: 'Changing a light bulb', s: ['Unplug the lamp and let the bulb cool down.', 'Unscrew the old bulb counter-clockwise.', 'Screw in the new bulb clockwise until snug.', 'Plug the lamp in and check that it lights up.'] },
    recipe: { t: 'Quick 5-minute omelette', s: ['Crack 2 eggs into a bowl and add a pinch of salt.', 'Whisk with a fork until smooth.', 'Pour into a hot pan with a little butter.', 'Fold in half and serve warm.'] },
    product: { t: 'Setting up new earbuds', s: ['Unbox and check what is inside.', 'Charge the case with the cable for about 30 minutes.', 'Open the case and pair the earbuds via Bluetooth.', 'Play a song and adjust the volume.'] },
    exercise: { t: '2-minute warm-up', s: ['Stand straight, feet shoulder-width apart.', 'Arm circles — 10 forward and 10 back.', '10 slow squats with a straight back.', 'Take a deep breath and drink some water.'] } } },
  de: { step: 'Schritt', inSteps: 'Video-Anleitung · {0} Schritte', outro: 'Fertig! Danke fürs Zuschauen.', tpl: {
    repair: { t: 'Glühbirne wechseln', s: ['Lampe ausstecken und die Birne abkühlen lassen.', 'Alte Birne gegen den Uhrzeigersinn herausdrehen.', 'Neue Birne im Uhrzeigersinn fest eindrehen.', 'Lampe einstecken und prüfen, ob sie leuchtet.'] },
    recipe: { t: 'Schnelles Omelett in 5 Minuten', s: ['2 Eier in eine Schüssel schlagen und etwas Salz dazugeben.', 'Mit einer Gabel glatt verquirlen.', 'In eine heiße Pfanne mit etwas Butter gießen.', 'Zur Hälfte falten und warm servieren.'] },
    product: { t: 'Neue Kopfhörer einrichten', s: ['Auspacken und den Inhalt der Schachtel prüfen.', 'Das Etui etwa 30 Minuten mit dem Kabel laden.', 'Etui öffnen und die Kopfhörer per Bluetooth koppeln.', 'Ein Lied abspielen und die Lautstärke einstellen.'] },
    exercise: { t: 'Aufwärmen in 2 Minuten', s: ['Gerade stehen, Füße schulterbreit.', 'Armkreisen — 10 nach vorn und 10 nach hinten.', '10 langsame Kniebeugen mit geradem Rücken.', 'Tief durchatmen und etwas Wasser trinken.'] } } },
  fr: { step: 'Étape', inSteps: 'Tutoriel vidéo · {0} étapes', outro: 'Terminé ! Merci d’avoir regardé.', tpl: {
    repair: { t: 'Changer une ampoule', s: ['Débranchez la lampe et laissez l’ampoule refroidir.', 'Dévissez l’ancienne ampoule dans le sens inverse des aiguilles d’une montre.', 'Vissez la nouvelle ampoule dans le sens des aiguilles d’une montre.', 'Rebranchez la lampe et vérifiez qu’elle s’allume.'] },
    recipe: { t: 'Omelette express en 5 minutes', s: ['Cassez 2 œufs dans un bol et ajoutez une pincée de sel.', 'Battez à la fourchette jusqu’à obtenir un mélange lisse.', 'Versez dans une poêle chaude avec un peu de beurre.', 'Pliez en deux et servez chaud.'] },
    product: { t: 'Premier démarrage des écouteurs', s: ['Déballez et vérifiez le contenu de la boîte.', 'Chargez l’étui avec le câble pendant environ 30 minutes.', 'Ouvrez l’étui et appairez les écouteurs en Bluetooth.', 'Lancez une chanson et réglez le volume.'] },
    exercise: { t: 'Échauffement en 2 minutes', s: ['Tenez-vous droit, pieds écartés à la largeur des épaules.', 'Cercles de bras — 10 vers l’avant et 10 vers l’arrière.', '10 squats lents, dos bien droit.', 'Respirez profondément et buvez un peu d’eau.'] } } },
  es: { step: 'Paso', inSteps: 'Videotutorial · {0} pasos', outro: '¡Listo! Gracias por ver.', tpl: {
    repair: { t: 'Cambiar una bombilla', s: ['Desenchufa la lámpara y deja que la bombilla se enfríe.', 'Desenrosca la bombilla vieja en sentido antihorario.', 'Enrosca la nueva en sentido horario hasta que quede firme.', 'Enchufa la lámpara y comprueba que se enciende.'] },
    recipe: { t: 'Tortilla francesa en 5 minutos', s: ['Casca 2 huevos en un bol y añade una pizca de sal.', 'Bate con un tenedor hasta que quede homogéneo.', 'Vierte en una sartén caliente con un poco de mantequilla.', 'Dobla por la mitad y sirve caliente.'] },
    product: { t: 'Primer uso de los auriculares', s: ['Desembala y revisa el contenido de la caja.', 'Carga el estuche con el cable unos 30 minutos.', 'Abre el estuche y empareja los auriculares por Bluetooth.', 'Pon una canción y ajusta el volumen.'] },
    exercise: { t: 'Calentamiento de 2 minutos', s: ['Ponte recto, con los pies a la anchura de los hombros.', 'Círculos con los brazos: 10 hacia delante y 10 hacia atrás.', '10 sentadillas lentas con la espalda recta.', 'Respira hondo y bebe un poco de agua.'] } } },
  'es-MX': { step: 'Paso', inSteps: 'Videotutorial · {0} pasos', outro: '¡Listo! Gracias por ver.', tpl: {
    repair: { t: 'Cambiar un foco', s: ['Desconecta la lámpara y deja que el foco se enfríe.', 'Desenrosca el foco viejo en sentido contrario a las manecillas.', 'Enrosca el nuevo en el sentido de las manecillas hasta que quede firme.', 'Conecta la lámpara y revisa que encienda.'] },
    recipe: { t: 'Omelette rápido en 5 minutos', s: ['Rompe 2 huevos en un tazón y agrega una pizca de sal.', 'Bate con un tenedor hasta que quede uniforme.', 'Vierte en un sartén caliente con un poco de mantequilla.', 'Dóblalo a la mitad y sírvelo caliente.'] },
    product: { t: 'Primer uso de los audífonos', s: ['Desempaca y revisa el contenido de la caja.', 'Carga el estuche con el cable unos 30 minutos.', 'Abre el estuche y vincula los audífonos por Bluetooth.', 'Pon una canción y ajusta el volumen.'] },
    exercise: { t: 'Calentamiento de 2 minutos', s: ['Párate derecho, con los pies al ancho de los hombros.', 'Círculos con los brazos: 10 hacia adelante y 10 hacia atrás.', '10 sentadillas lentas con la espalda recta.', 'Respira profundo y toma un poco de agua.'] } } },
  it: { step: 'Passo', inSteps: 'Video guida · {0} passaggi', outro: 'Fatto! Grazie per la visione.', tpl: {
    repair: { t: 'Cambiare una lampadina', s: ['Stacca la lampada e lascia raffreddare la lampadina.', 'Svita la vecchia lampadina in senso antiorario.', 'Avvita la nuova lampadina in senso orario fino in fondo.', 'Ricollega la lampada e controlla che si accenda.'] },
    recipe: { t: 'Frittata veloce in 5 minuti', s: ['Rompi 2 uova in una ciotola e aggiungi un pizzico di sale.', 'Sbatti con una forchetta fino a renderle omogenee.', 'Versa in una padella calda con un po’ di burro.', 'Piega a metà e servi calda.'] },
    product: { t: 'Primo avvio degli auricolari', s: ['Apri la confezione e controlla il contenuto.', 'Ricarica la custodia con il cavo per circa 30 minuti.', 'Apri la custodia e associa gli auricolari via Bluetooth.', 'Avvia una canzone e regola il volume.'] },
    exercise: { t: 'Riscaldamento di 2 minuti', s: ['Stai dritto, piedi alla larghezza delle spalle.', 'Cerchi con le braccia: 10 avanti e 10 indietro.', '10 squat lenti con la schiena dritta.', 'Respira profondamente e bevi un po’ d’acqua.'] } } },
  pt: { step: 'Passo', inSteps: 'Vídeo tutorial · {0} passos', outro: 'Pronto! Obrigado por assistir.', tpl: {
    repair: { t: 'Trocar uma lâmpada', s: ['Desligue a luminária da tomada e espere a lâmpada esfriar.', 'Desrosqueie a lâmpada velha no sentido anti-horário.', 'Rosqueie a lâmpada nova no sentido horário até ficar firme.', 'Ligue a luminária e confira se ela acende.'] },
    recipe: { t: 'Omelete rápida em 5 minutos', s: ['Quebre 2 ovos em uma tigela e adicione uma pitada de sal.', 'Bata com um garfo até ficar homogêneo.', 'Despeje em uma frigideira quente com um pouco de manteiga.', 'Dobre ao meio e sirva quente.'] },
    product: { t: 'Primeiro uso dos fones de ouvido', s: ['Desembale e confira o conteúdo da caixa.', 'Carregue o estojo com o cabo por cerca de 30 minutos.', 'Abra o estojo e pareie os fones via Bluetooth.', 'Toque uma música e ajuste o volume.'] },
    exercise: { t: 'Aquecimento de 2 minutos', s: ['Fique em pé, pés na largura dos ombros.', 'Círculos com os braços — 10 para frente e 10 para trás.', '10 agachamentos lentos com as costas retas.', 'Respire fundo e beba um pouco de água.'] } } },
  ar: { step: 'الخطوة', inSteps: 'فيديو تعليمي · عدد الخطوات: {0}', outro: 'تم! شكرًا على المشاهدة.', tpl: {
    repair: { t: 'تغيير مصباح كهربائي', s: ['افصل المصباح عن المقبس واترك اللمبة تبرد.', 'فكّ اللمبة القديمة عكس اتجاه عقارب الساعة.', 'ركّب اللمبة الجديدة باتجاه عقارب الساعة حتى تثبت.', 'أعد توصيل المصباح وتأكد من أنه يضيء.'] },
    recipe: { t: 'عجة سريعة في 5 دقائق', s: ['اكسر بيضتين في وعاء وأضف رشة ملح.', 'اخفق بالشوكة حتى يصبح الخليط ناعمًا.', 'اسكب في مقلاة ساخنة مع قليل من الزبدة.', 'اطوِها إلى نصفين وقدّمها ساخنة.'] },
    product: { t: 'التشغيل الأول لسماعات الأذن', s: ['أخرج السماعات من العلبة وتحقق من محتوياتها.', 'اشحن العلبة بالكابل لمدة 30 دقيقة تقريبًا.', 'افتح العلبة واقرن السماعات عبر البلوتوث.', 'شغّل أغنية واضبط مستوى الصوت.'] },
    exercise: { t: 'إحماء في دقيقتين', s: ['قف مستقيمًا والقدمان بعرض الكتفين.', 'دوائر بالذراعين — 10 للأمام و10 للخلف.', '10 قرفصاء بطيئة مع ظهر مستقيم.', 'خذ نفسًا عميقًا واشرب بعض الماء.'] } } },
  hi: { step: 'चरण', inSteps: 'वीडियो गाइड · {0} चरण', outro: 'हो गया! देखने के लिए धन्यवाद।', tpl: {
    repair: { t: 'बल्ब बदलना', s: ['लैंप का प्लग निकालें और बल्ब को ठंडा होने दें।', 'पुराने बल्ब को घड़ी की उलटी दिशा में खोलें।', 'नया बल्ब घड़ी की दिशा में कसकर लगाएँ।', 'लैंप चालू करें और जाँचें कि वह जलता है।'] },
    recipe: { t: '5 मिनट में झटपट ऑमलेट', s: ['2 अंडे कटोरे में तोड़ें और चुटकी भर नमक डालें।', 'काँटे से चिकना होने तक फेंटें।', 'थोड़े मक्खन के साथ गरम तवे पर डालें।', 'आधा मोड़ें और गरम परोसें।'] },
    product: { t: 'नए ईयरबड्स पहली बार चालू करना', s: ['डिब्बा खोलें और सामग्री जाँचें।', 'केस को केबल से लगभग 30 मिनट चार्ज करें।', 'केस खोलें और ईयरबड्स को Bluetooth से जोड़ें।', 'गाना चलाएँ और आवाज़ सेट करें।'] },
    exercise: { t: '2 मिनट का वार्म-अप', s: ['सीधे खड़े हों, पैर कंधों की चौड़ाई पर।', 'बाँहों से गोले — 10 आगे और 10 पीछे।', 'सीधी पीठ के साथ 10 धीमे स्क्वॉट।', 'गहरी साँस लें और थोड़ा पानी पिएँ।'] } } },
  ja: { step: 'ステップ', inSteps: '動画マニュアル · 全{0}ステップ', outro: '完成！ご覧いただきありがとうございました。', tpl: {
    repair: { t: '電球の交換', s: ['ランプのプラグを抜き、電球が冷えるまで待ちます。', '古い電球を反時計回りに外します。', '新しい電球を時計回りにしっかり締めます。', 'プラグを差し、点灯するか確認します。'] },
    recipe: { t: '5分でできるオムレツ', s: ['卵2個をボウルに割り、塩をひとつまみ入れます。', 'フォークでなめらかになるまで混ぜます。', 'バターを少し溶かした熱いフライパンに流し入れます。', '半分に折り、温かいうちに盛り付けます。'] },
    product: { t: '新しいイヤホンの初期設定', s: ['箱を開けて中身を確認します。', 'ケーブルでケースを約30分充電します。', 'ケースを開け、Bluetoothでイヤホンをペアリングします。', '曲を再生して音量を調整します。'] },
    exercise: { t: '2分間のウォームアップ', s: ['背筋を伸ばし、足を肩幅に開いて立ちます。', '腕回し — 前に10回、後ろに10回。', '背中をまっすぐにしてゆっくりスクワット10回。', '深呼吸して水を少し飲みます。'] } } },
  ky: { step: 'Кадам', inSteps: 'Видео нускама · кадамдар: {0}', outro: 'Даяр! Көргөнүңүз үчүн рахмат.', tpl: {
    repair: { t: 'Лампочканы алмаштыруу', s: ['Лампаны розеткадан ажыратып, лампочканын муздашын күтүңүз.', 'Эски лампочканы саат жебесине каршы бурап чыгарыңыз.', 'Жаңы лампочканы саат жебеси боюнча бекем бурап салыңыз.', 'Лампаны кошуп, күйүп жатканын текшериңиз.'] },
    recipe: { t: '5 мүнөттө тез омлет', s: ['2 жумуртканы идишке чагып, бир чымчым туз кошуңуз.', 'Айры менен бир калыпка келгенче чабыңыз.', 'Бир аз май салынган ысык табага куюңуз.', 'Экиге бүктөп, ысык бойдон бериңиз.'] },
    product: { t: 'Кулакчындарды биринчи жолу иштетүү', s: ['Кутуну ачып, ичиндегисин текшериңиз.', 'Капты кабель менен 30 мүнөттөй кубаттаңыз.', 'Капты ачып, кулакчындарды Bluetooth аркылуу туташтырыңыз.', 'Ыр коюп, үндүн катуулугун жөндөңүз.'] },
    exercise: { t: '2 мүнөттүк жылытуу көнүгүүсү', s: ['Түз туруңуз, буттар ийин кеңдигинде.', 'Колдор менен айлануу — 10 алдыга, 10 артка.', 'Түз арка менен 10 жай отуруп-туруу.', 'Терең дем алып, бир аз суу ичиңиз.'] } } },
  'zh-Hant': { step: '步驟', inSteps: '影片教學 · 共 {0} 個步驟', outro: '完成！感謝收看。', tpl: {
    repair: { t: '更換燈泡', s: ['拔掉檯燈插頭，等燈泡冷卻。', '逆時針轉下舊燈泡。', '順時針轉緊新燈泡。', '插上插頭，確認燈會亮。'] },
    recipe: { t: '5 分鐘快速歐姆蛋', s: ['將 2 顆蛋打入碗中，加一小撮鹽。', '用叉子攪拌至均勻滑順。', '倒入放了少許奶油的熱鍋。', '對折後趁熱上桌。'] },
    product: { t: '新耳機首次設定', s: ['拆開包裝並檢查盒內物品。', '用充電線為充電盒充電約 30 分鐘。', '打開充電盒，透過藍牙配對耳機。', '播放一首歌並調整音量。'] },
    exercise: { t: '2 分鐘暖身', s: ['站直，雙腳與肩同寬。', '手臂繞圈 — 向前 10 次、向後 10 次。', '背部挺直，慢速深蹲 10 次。', '深呼吸並喝點水。'] } } }
};

// Текстовете на урока за даден език (резерва: английски).
export function lessonTexts(lang) { return T[lang] || T.en; }
export const LESSON_LANGS = Object.keys(T);
