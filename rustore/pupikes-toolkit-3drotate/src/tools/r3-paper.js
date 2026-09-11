// Version: 1.0021
// r3-paper.js — „Pupikes Paper 3D": от снимка до ПРЕДМЕТ В РЪКАТА. Главната функция на приложението.
//
// Снимката (или по една снимка за всяка страна) се разгъва в ШАБЛОН ЗА ПЕЧАТ на хартиена 3D фигура:
//   • фото-куб, пирамида, кутия за подарък с капак, фото-фенер (призма с прозорчета), стойка/рамка
//     за снимка (триъгълна „палатка"), картичка с обем (поп-ъп със стояща снимка).
// Шаблонът е в РЕАЛЕН МАЩАБ (mm): плътни линии = режи, пунктир = сгъни, сиви езичета с номер = лепи
// под страната със същия номер; номера на страните; кратки инструкции на езика на апа.
// Под-табове: Фигура (форма, размер, снимки по страни) · Преглед 3D (сглобената фигура, въртене с
// пръст — WebGL през общия двигател r3-gl.js) · Лист за печат (A4/Letter, DPI, брой фигури на лист,
// PNG или PDF) · Стерео карта (от ЕДНА снимка две гледни точки ляво/дясно по дълбочина от простия 3D
// модел — успоредно / кръстосан поглед / червено-син анаглиф, + стерео картичка на лист).
// Всичко на устройството (платно + WebGL); нищо не се качва.
//
// Вътрешна геометрия: всяка фигура има net(a) → { faces, tabs, folds, texts } в mm (y надолу) и
// mesh(a) → 3D стени (3 или 4 върха) със същия „слот" (снимка). Снимката се рисува ЕДНАКВО в шаблона
// и в текстурния атлас (paint(kind, …) в mm координати), затова прегледът и разпечатката съвпадат.
import { t, tf, register } from '../core/i18n.js';
import { pickBinaryFile } from '../core/filepick.js';
import { saveFile } from '../core/filesave.js';
import { mMul, mPerspective, mTranslate, qIdent, qRotateWorld, qMat, VERT, FRAG, compile } from './r3-gl.js';

register({
  pp_sub_fig:    { bg:'Фигура', ru:'Фигура', uk:'Фігура', en:'Figure', de:'Figur', fr:'Figure', es:'Figura', 'es-MX':'Figura', it:'Figura', pt:'Figura', ar:'الشكل', hi:'आकृति', ja:'図形', ky:'Фигура', 'zh-Hant':'圖形' },
  pp_sub_prev:   { bg:'Преглед 3D', ru:'Просмотр 3D', uk:'Перегляд 3D', en:'3D preview', de:'3D-Vorschau', fr:'Aperçu 3D', es:'Vista 3D', 'es-MX':'Vista 3D', it:'Anteprima 3D', pt:'Pré-visualização 3D', ar:'معاينة ثلاثية الأبعاد', hi:'3D पूर्वावलोकन', ja:'3Dプレビュー', ky:'3D көрүү', 'zh-Hant':'3D 預覽' },
  pp_sub_sheet:  { bg:'Лист за печат', ru:'Лист для печати', uk:'Аркуш для друку', en:'Print sheet', de:'Druckbogen', fr:'Feuille à imprimer', es:'Hoja de impresión', 'es-MX':'Hoja de impresión', it:'Foglio da stampare', pt:'Folha de impressão', ar:'ورقة الطباعة', hi:'प्रिंट शीट', ja:'印刷シート', ky:'Басма барагы', 'zh-Hant':'列印頁' },
  pp_sub_stereo: { bg:'Стерео карта', ru:'Стереокарта', uk:'Стереокартка', en:'Stereo card', de:'Stereokarte', fr:'Carte stéréo', es:'Tarjeta estéreo', 'es-MX':'Tarjeta estéreo', it:'Scheda stereo', pt:'Cartão estéreo', ar:'بطاقة مجسّمة', hi:'स्टीरियो कार्ड', ja:'ステレオカード', ky:'Стерео карта', 'zh-Hant':'立體卡' },
  pp_hint:       { bg:'Избери фигура и размер, сложи снимка на всяка страна (празните страни взимат първата снимка) — после я виж сглобена в 3D и отпечатай шаблона за изрязване и сгъване.', ru:'Выбери фигуру и размер, поставь фото на каждую сторону (пустые стороны берут первое фото) — затем посмотри её собранной в 3D и распечатай шаблон для вырезания и сгибания.', uk:'Вибери фігуру й розмір, постав фото на кожну сторону (порожні сторони беруть перше фото) — потім переглянь її зібраною в 3D і роздрукуй шаблон для вирізання та згинання.', en:'Pick a figure and size, put a photo on each side (empty sides take the first photo) — then see it assembled in 3D and print the cut-and-fold template.', de:'Wähle Figur und Größe, lege auf jede Seite ein Foto (leere Seiten nehmen das erste Foto) — dann sieh sie zusammengebaut in 3D und drucke die Schneide-und-Falt-Vorlage.', fr:'Choisis une figure et une taille, mets une photo sur chaque face (les faces vides prennent la première photo) — puis vois-la assemblée en 3D et imprime le gabarit à découper et plier.', es:'Elige una figura y un tamaño, pon una foto en cada cara (las caras vacías toman la primera foto) — luego mírala armada en 3D e imprime la plantilla para recortar y doblar.', 'es-MX':'Elige una figura y un tamaño, pon una foto en cada cara (las caras vacías toman la primera foto) — luego mírala armada en 3D e imprime la plantilla para recortar y doblar.', it:'Scegli una figura e una misura, metti una foto su ogni lato (i lati vuoti prendono la prima foto) — poi guardala montata in 3D e stampa la sagoma da ritagliare e piegare.', pt:'Escolhe uma figura e um tamanho, põe uma foto em cada lado (os lados vazios usam a primeira foto) — depois vê-a montada em 3D e imprime o molde para recortar e dobrar.', ar:'اختر شكلاً وحجماً، وضع صورة على كل جانب (الجوانب الفارغة تأخذ الصورة الأولى) — ثم شاهده مجمّعاً بثلاثة أبعاد واطبع قالب القص والطي.', hi:'आकृति और आकार चुनें, हर तरफ़ एक फ़ोटो लगाएँ (खाली तरफ़ें पहली फ़ोटो लेती हैं) — फिर इसे 3D में जुड़ा देखें और काट-मोड़ टेम्पलेट प्रिंट करें।', ja:'図形とサイズを選び、各面に写真を置く（空の面は最初の写真を使用）。組み立てた状態を3Dで確認し、切って折る型紙を印刷。', ky:'Фигура жана өлчөм танда, ар бир тарапка сүрөт кой (бош тараптар биринчи сүрөттү алат) — анан аны 3Dде чогултулган түрдө көрүп, кесип-бүктөө үлгүсүн басып чыгар.', 'zh-Hant':'選擇圖形與尺寸，為每一面放上照片（空白面使用第一張照片）——然後以 3D 檢視組裝效果，並列印裁切摺疊模板。' },
  pp_shape:      { bg:'Фигура', ru:'Фигура', uk:'Фігура', en:'Figure', de:'Figur', fr:'Figure', es:'Figura', 'es-MX':'Figura', it:'Figura', pt:'Figura', ar:'الشكل', hi:'आकृति', ja:'図形', ky:'Фигура', 'zh-Hant':'圖形' },
  pp_sh_cube:    { bg:'Фото-куб', ru:'Фотокуб', uk:'Фотокуб', en:'Photo cube', de:'Fotowürfel', fr:'Cube photo', es:'Cubo de fotos', 'es-MX':'Cubo de fotos', it:'Cubo fotografico', pt:'Cubo de fotos', ar:'مكعب صور', hi:'फ़ोटो क्यूब', ja:'フォトキューブ', ky:'Фото-куб', 'zh-Hant':'照片立方體' },
  pp_sh_pyr:     { bg:'Пирамида', ru:'Пирамида', uk:'Піраміда', en:'Pyramid', de:'Pyramide', fr:'Pyramide', es:'Pirámide', 'es-MX':'Pirámide', it:'Piramide', pt:'Pirâmide', ar:'هرم', hi:'पिरामिड', ja:'ピラミッド', ky:'Пирамида', 'zh-Hant':'金字塔' },
  pp_sh_box:     { bg:'Кутия за подарък с капак', ru:'Подарочная коробка с крышкой', uk:'Подарункова коробка з кришкою', en:'Gift box with lid', de:'Geschenkbox mit Deckel', fr:'Boîte cadeau avec couvercle', es:'Caja de regalo con tapa', 'es-MX':'Caja de regalo con tapa', it:'Scatola regalo con coperchio', pt:'Caixa de presente com tampa', ar:'علبة هدية بغطاء', hi:'ढक्कन वाला गिफ़्ट बॉक्स', ja:'ふた付きギフトボックス', ky:'Капкактуу белек кутусу', 'zh-Hant':'附蓋禮物盒' },
  pp_sh_lant:    { bg:'Фото-фенер', ru:'Фотофонарь', uk:'Фотоліхтар', en:'Photo lantern', de:'Fotolaterne', fr:'Lanterne photo', es:'Farol de fotos', 'es-MX':'Farol de fotos', it:'Lanterna fotografica', pt:'Lanterna de fotos', ar:'فانوس صور', hi:'फ़ोटो लालटेन', ja:'フォトランタン', ky:'Фото-фонарь', 'zh-Hant':'照片燈籠' },
  pp_sh_stand:   { bg:'Стойка за снимка', ru:'Подставка для фото', uk:'Підставка для фото', en:'Photo stand', de:'Fotoständer', fr:'Support photo', es:'Soporte de foto', 'es-MX':'Soporte de foto', it:'Supporto per foto', pt:'Suporte de foto', ar:'حامل صور', hi:'फ़ोटो स्टैंड', ja:'フォトスタンド', ky:'Сүрөт тирөөчү', 'zh-Hant':'相片立架' },
  pp_sh_pop:     { bg:'Картичка с обем', ru:'Объёмная открытка', uk:'Об’ємна листівка', en:'Pop-up card', de:'Pop-up-Karte', fr:'Carte pop-up', es:'Tarjeta desplegable', 'es-MX':'Tarjeta desplegable', it:'Biglietto pop-up', pt:'Cartão pop-up', ar:'بطاقة منبثقة', hi:'पॉप-अप कार्ड', ja:'飛び出すカード', ky:'Көлөмдүү открытка', 'zh-Hant':'立體卡片' },
  pp_size:       { bg:'Размер на фигурата (mm)', ru:'Размер фигуры (мм)', uk:'Розмір фігури (мм)', en:'Figure size (mm)', de:'Figurgröße (mm)', fr:'Taille de la figure (mm)', es:'Tamaño de la figura (mm)', 'es-MX':'Tamaño de la figura (mm)', it:'Dimensione della figura (mm)', pt:'Tamanho da figura (mm)', ar:'حجم الشكل (مم)', hi:'आकृति का आकार (मिमी)', ja:'図形サイズ (mm)', ky:'Фигуранын өлчөмү (мм)', 'zh-Hant':'圖形尺寸 (mm)' },
  pp_faces:      { bg:'Снимки по страни', ru:'Фото по сторонам', uk:'Фото по сторонах', en:'Photos per side', de:'Fotos je Seite', fr:'Photos par face', es:'Fotos por cara', 'es-MX':'Fotos por cara', it:'Foto per lato', pt:'Fotos por lado', ar:'صور لكل جانب', hi:'हर तरफ़ की फ़ोटो', ja:'各面の写真', ky:'Тараптар боюнча сүрөттөр', 'zh-Hant':'各面照片' },
  pp_face_tap:   { bg:'Докосни страна, за да сложиш снимка', ru:'Коснись стороны, чтобы поставить фото', uk:'Торкнись сторони, щоб поставити фото', en:'Tap a side to set its photo', de:'Tippe auf eine Seite, um ein Foto zu setzen', fr:'Touche une face pour y mettre une photo', es:'Toca una cara para ponerle una foto', 'es-MX':'Toca una cara para ponerle una foto', it:'Tocca un lato per mettere la foto', pt:'Toca num lado para pôr a foto', ar:'المس جانباً لوضع صورته', hi:'फ़ोटो लगाने के लिए किसी तरफ़ को छुएँ', ja:'面をタップして写真を設定', ky:'Сүрөт коюу үчүн тарапты бас', 'zh-Hant':'點一面以設定照片' },
  pp_clear:      { bg:'Махни снимките', ru:'Убрать фото', uk:'Прибрати фото', en:'Remove photos', de:'Fotos entfernen', fr:'Retirer les photos', es:'Quitar fotos', 'es-MX':'Quitar fotos', it:'Rimuovi foto', pt:'Remover fotos', ar:'إزالة الصور', hi:'फ़ोटो हटाएँ', ja:'写真を削除', ky:'Сүрөттөрдү алып салуу', 'zh-Hant':'移除照片' },
  pp_no_photo:   { bg:'Първо сложи поне една снимка (в „Фигура").', ru:'Сначала поставь хотя бы одно фото (в «Фигура»).', uk:'Спершу постав хоча б одне фото (у «Фігура»).', en:'Add at least one photo first (in “Figure”).', de:'Füge zuerst mindestens ein Foto hinzu (unter „Figur“).', fr:'Ajoute d’abord au moins une photo (dans « Figure »).', es:'Primero pon al menos una foto (en «Figura»).', 'es-MX':'Primero pon al menos una foto (en «Figura»).', it:'Metti prima almeno una foto (in «Figura»).', pt:'Põe primeiro pelo menos uma foto (em «Figura»).', ar:'أضف صورة واحدة على الأقل أولاً (في «الشكل»).', hi:'पहले कम से कम एक फ़ोटो लगाएँ («आकृति» में)।', ja:'まず写真を1枚以上追加してください（「図形」で）。', ky:'Адегенде жок дегенде бир сүрөт кой («Фигура» ичинде).', 'zh-Hant':'請先加入至少一張照片（在「圖形」中）。' },
  pp_f_front:    { bg:'Предна', ru:'Передняя', uk:'Передня', en:'Front', de:'Vorne', fr:'Avant', es:'Frontal', 'es-MX':'Frontal', it:'Fronte', pt:'Frente', ar:'الأمام', hi:'सामने', ja:'前面', ky:'Алды', 'zh-Hant':'正面' },
  pp_f_back:     { bg:'Задна', ru:'Задняя', uk:'Задня', en:'Back', de:'Hinten', fr:'Arrière', es:'Trasera', 'es-MX':'Trasera', it:'Retro', pt:'Trás', ar:'الخلف', hi:'पीछे', ja:'背面', ky:'Арты', 'zh-Hant':'背面' },
  pp_f_left:     { bg:'Лява', ru:'Левая', uk:'Ліва', en:'Left', de:'Links', fr:'Gauche', es:'Izquierda', 'es-MX':'Izquierda', it:'Sinistra', pt:'Esquerda', ar:'اليسار', hi:'बायीं', ja:'左面', ky:'Сол', 'zh-Hant':'左面' },
  pp_f_right:    { bg:'Дясна', ru:'Правая', uk:'Права', en:'Right', de:'Rechts', fr:'Droite', es:'Derecha', 'es-MX':'Derecha', it:'Destra', pt:'Direita', ar:'اليمين', hi:'दायीं', ja:'右面', ky:'Оң', 'zh-Hant':'右面' },
  pp_f_top:      { bg:'Горна', ru:'Верхняя', uk:'Верхня', en:'Top', de:'Oben', fr:'Dessus', es:'Superior', 'es-MX':'Superior', it:'Sopra', pt:'Topo', ar:'الأعلى', hi:'ऊपर', ja:'上面', ky:'Үстү', 'zh-Hant':'頂面' },
  pp_f_bottom:   { bg:'Долна', ru:'Нижняя', uk:'Нижня', en:'Bottom', de:'Unten', fr:'Dessous', es:'Inferior', 'es-MX':'Inferior', it:'Sotto', pt:'Fundo', ar:'الأسفل', hi:'नीचे', ja:'底面', ky:'Асты', 'zh-Hant':'底面' },
  pp_f_base:     { bg:'Основа', ru:'Основание', uk:'Основа', en:'Base', de:'Boden', fr:'Base', es:'Base', 'es-MX':'Base', it:'Base', pt:'Base', ar:'القاعدة', hi:'आधार', ja:'底', ky:'Негиз', 'zh-Hant':'底座' },
  pp_f_side:     { bg:'Страна {0}', ru:'Сторона {0}', uk:'Сторона {0}', en:'Side {0}', de:'Seite {0}', fr:'Face {0}', es:'Cara {0}', 'es-MX':'Cara {0}', it:'Lato {0}', pt:'Lado {0}', ar:'جانب {0}', hi:'तरफ़ {0}', ja:'面 {0}', ky:'Тарап {0}', 'zh-Hant':'面 {0}' },
  pp_f_lid:      { bg:'Капак', ru:'Крышка', uk:'Кришка', en:'Lid', de:'Deckel', fr:'Couvercle', es:'Tapa', 'es-MX':'Tapa', it:'Coperchio', pt:'Tampa', ar:'الغطاء', hi:'ढक्कन', ja:'ふた', ky:'Капкак', 'zh-Hant':'蓋子' },
  pp_f_stand:    { bg:'Изправена снимка', ru:'Стоящее фото', uk:'Стояче фото', en:'Standing photo', de:'Stehendes Foto', fr:'Photo debout', es:'Foto de pie', 'es-MX':'Foto de pie', it:'Foto in piedi', pt:'Foto em pé', ar:'صورة قائمة', hi:'खड़ी फ़ोटो', ja:'立つ写真', ky:'Тик турган сүрөт', 'zh-Hant':'直立照片' },
  pp_f_bg:       { bg:'Фон', ru:'Фон', uk:'Тло', en:'Background', de:'Hintergrund', fr:'Fond', es:'Fondo', 'es-MX':'Fondo', it:'Sfondo', pt:'Fundo', ar:'الخلفية', hi:'पृष्ठभूमि', ja:'背景', ky:'Фон', 'zh-Hant':'背景' },
  pp_prev_hint:  { bg:'Влачи с пръст, за да въртиш сглобената фигура. Така ще изглежда след сгъване.', ru:'Води пальцем, чтобы вращать собранную фигуру. Так она будет выглядеть после сгибания.', uk:'Веди пальцем, щоб обертати зібрану фігуру. Так вона виглядатиме після згинання.', en:'Drag with a finger to rotate the assembled figure. This is how it will look once folded.', de:'Mit dem Finger ziehen, um die zusammengebaute Figur zu drehen. So sieht sie gefaltet aus.', fr:'Fais glisser le doigt pour tourner la figure assemblée. Voilà à quoi elle ressemblera une fois pliée.', es:'Arrastra con el dedo para girar la figura armada. Así se verá una vez doblada.', 'es-MX':'Arrastra con el dedo para girar la figura armada. Así se verá una vez doblada.', it:'Trascina con il dito per ruotare la figura montata. Così apparirà una volta piegata.', pt:'Arrasta com o dedo para rodar a figura montada. É assim que ficará depois de dobrada.', ar:'اسحب بإصبعك لتدوير الشكل المجمّع. هكذا سيبدو بعد الطي.', hi:'जुड़ी आकृति घुमाने के लिए उँगली से खींचें। मोड़ने के बाद यह ऐसी दिखेगी।', ja:'指でドラッグして組み立てた図形を回転。折った後の見た目です。', ky:'Чогултулган фигураны айландыруу үчүн манжаң менен сүйрө. Бүктөгөндөн кийин ушундай көрүнөт.', 'zh-Hant':'用手指拖曳旋轉組裝後的圖形。這就是摺好後的樣子。' },
  pp_spin:       { bg:'Самовъртене', ru:'Автовращение', uk:'Автообертання', en:'Auto-spin', de:'Auto-Drehung', fr:'Rotation auto', es:'Giro automático', 'es-MX':'Giro automático', it:'Rotazione automatica', pt:'Rotação automática', ar:'دوران تلقائي', hi:'स्वतः घुमाव', ja:'自動回転', ky:'Өзү айлануу', 'zh-Hant':'自動旋轉' },
  pp_prev_save:  { bg:'Запази изгледа (PNG)', ru:'Сохранить вид (PNG)', uk:'Зберегти вигляд (PNG)', en:'Save view (PNG)', de:'Ansicht speichern (PNG)', fr:'Enregistrer la vue (PNG)', es:'Guardar vista (PNG)', 'es-MX':'Guardar vista (PNG)', it:'Salva vista (PNG)', pt:'Guardar vista (PNG)', ar:'حفظ العرض (PNG)', hi:'दृश्य सहेजें (PNG)', ja:'表示を保存 (PNG)', ky:'Көрүнүштү сактоо (PNG)', 'zh-Hant':'儲存視圖 (PNG)' },
  pp_sheet_hint: { bg:'Шаблонът се печата в реален мащаб (mm): плътна линия = режи, пунктир = сгъни, сиво езиче с номер = лепи под страната със същия номер.', ru:'Шаблон печатается в реальном масштабе (мм): сплошная линия — резать, пунктир — сгибать, серый язычок с номером — клеить под сторону с тем же номером.', uk:'Шаблон друкується в реальному масштабі (мм): суцільна лінія — різати, пунктир — згинати, сірий язичок із номером — клеїти під сторону з тим самим номером.', en:'The template prints at real scale (mm): solid line = cut, dashed = fold, grey numbered tab = glue under the side with the same number.', de:'Die Vorlage wird maßstabsgetreu (mm) gedruckt: durchgezogene Linie = schneiden, gestrichelt = falten, graue nummerierte Lasche = unter die Seite mit derselben Nummer kleben.', fr:'Le gabarit s’imprime à l’échelle réelle (mm) : trait plein = couper, pointillé = plier, languette grise numérotée = coller sous la face du même numéro.', es:'La plantilla se imprime a escala real (mm): línea continua = cortar, discontinua = doblar, pestaña gris numerada = pegar bajo la cara con el mismo número.', 'es-MX':'La plantilla se imprime a escala real (mm): línea continua = cortar, discontinua = doblar, pestaña gris numerada = pegar bajo la cara con el mismo número.', it:'La sagoma si stampa in scala reale (mm): linea continua = taglia, tratteggiata = piega, linguetta grigia numerata = incolla sotto il lato con lo stesso numero.', pt:'O molde imprime-se à escala real (mm): linha contínua = cortar, tracejada = dobrar, aba cinzenta numerada = colar sob o lado com o mesmo número.', ar:'يُطبع القالب بالمقياس الحقيقي (مم): خط متصل = قص، متقطع = طي، لسان رمادي مرقّم = لصق تحت الجانب بنفس الرقم.', hi:'टेम्पलेट असली माप (मिमी) में छपता है: ठोस रेखा = काटें, बिंदीदार = मोड़ें, नंबर वाला ग्रे टैब = उसी नंबर की तरफ़ के नीचे चिपकाएँ।', ja:'型紙は実寸 (mm) で印刷：実線＝切る、破線＝折る、番号付きの灰色のりしろ＝同じ番号の面の下に貼る。', ky:'Үлгү чыныгы масштабда (мм) басылат: туташ сызык = кес, пунктир = бүктө, номерлүү боз тилче = ошол эле номердеги тараптын астына чапта.', 'zh-Hant':'模板以實際比例 (mm) 列印：實線＝裁切，虛線＝摺疊，灰色編號黏貼片＝黏在相同編號的面下方。' },
  pp_page:       { bg:'Лист', ru:'Лист', uk:'Аркуш', en:'Paper', de:'Papier', fr:'Papier', es:'Papel', 'es-MX':'Papel', it:'Carta', pt:'Papel', ar:'الورق', hi:'कागज़', ja:'用紙', ky:'Кагаз', 'zh-Hant':'紙張' },
  pp_dpi:        { bg:'Качество (DPI)', ru:'Качество (DPI)', uk:'Якість (DPI)', en:'Quality (DPI)', de:'Qualität (DPI)', fr:'Qualité (DPI)', es:'Calidad (DPI)', 'es-MX':'Calidad (DPI)', it:'Qualità (DPI)', pt:'Qualidade (DPI)', ar:'الجودة (DPI)', hi:'गुणवत्ता (DPI)', ja:'品質 (DPI)', ky:'Сапат (DPI)', 'zh-Hant':'品質 (DPI)' },
  pp_copies:     { bg:'Брой фигури', ru:'Число фигур', uk:'Кількість фігур', en:'Number of figures', de:'Anzahl Figuren', fr:'Nombre de figures', es:'Número de figuras', 'es-MX':'Número de figuras', it:'Numero di figure', pt:'Número de figuras', ar:'عدد الأشكال', hi:'आकृतियों की संख्या', ja:'図形の数', ky:'Фигуралардын саны', 'zh-Hant':'圖形數量' },
  pp_fits:       { bg:'Побира се: {0} на лист · {1} стр. · шаблон {2}×{3} mm', ru:'Помещается: {0} на лист · {1} стр. · шаблон {2}×{3} мм', uk:'Вміщується: {0} на аркуш · {1} стор. · шаблон {2}×{3} мм', en:'Fits: {0} per sheet · {1} page(s) · template {2}×{3} mm', de:'Passt: {0} pro Bogen · {1} Seite(n) · Vorlage {2}×{3} mm', fr:'Tient : {0} par feuille · {1} page(s) · gabarit {2}×{3} mm', es:'Caben: {0} por hoja · {1} pág. · plantilla {2}×{3} mm', 'es-MX':'Caben: {0} por hoja · {1} pág. · plantilla {2}×{3} mm', it:'Entrano: {0} per foglio · {1} pag. · sagoma {2}×{3} mm', pt:'Cabem: {0} por folha · {1} pág. · molde {2}×{3} mm', ar:'يتسع: {0} في الورقة · {1} صفحة · القالب {2}×{3} مم', hi:'समाता है: {0} प्रति शीट · {1} पृष्ठ · टेम्पलेट {2}×{3} मिमी', ja:'配置: 1枚に{0}個 · {1}ページ · 型紙 {2}×{3} mm', ky:'Батат: баракка {0} · {1} бет · үлгү {2}×{3} мм', 'zh-Hant':'可容納：每頁 {0} 個 · {1} 頁 · 模板 {2}×{3} mm' },
  pp_too_big:    { bg:'Фигурата не се побира на листа — размерът е намален до {0} mm.', ru:'Фигура не помещается на лист — размер уменьшен до {0} мм.', uk:'Фігура не вміщується на аркуш — розмір зменшено до {0} мм.', en:'The figure does not fit the sheet — size reduced to {0} mm.', de:'Die Figur passt nicht auf den Bogen — Größe auf {0} mm verringert.', fr:'La figure ne tient pas sur la feuille — taille réduite à {0} mm.', es:'La figura no cabe en la hoja — tamaño reducido a {0} mm.', 'es-MX':'La figura no cabe en la hoja — tamaño reducido a {0} mm.', it:'La figura non entra nel foglio — dimensione ridotta a {0} mm.', pt:'A figura não cabe na folha — tamanho reduzido para {0} mm.', ar:'الشكل لا يتسع في الورقة — تم تصغير الحجم إلى {0} مم.', hi:'आकृति शीट में नहीं समाती — आकार घटाकर {0} मिमी किया गया।', ja:'図形が用紙に収まらないため、サイズを {0} mm に縮小しました。', ky:'Фигура баракка батпайт — өлчөмү {0} ммге чейин кичирейтилди.', 'zh-Hant':'圖形超出紙張——尺寸已縮小為 {0} mm。' },
  pp_dl_png:     { bg:'Изтегли PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG herunterladen', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Transferir PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड करें', ja:'PNGをダウンロード', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  pp_dl_pdf:     { bg:'Изтегли PDF', ru:'Скачать PDF', uk:'Завантажити PDF', en:'Download PDF', de:'PDF herunterladen', fr:'Télécharger PDF', es:'Descargar PDF', 'es-MX':'Descargar PDF', it:'Scarica PDF', pt:'Transferir PDF', ar:'تنزيل PDF', hi:'PDF डाउनलोड करें', ja:'PDFをダウンロード', ky:'PDF жүктөө', 'zh-Hant':'下載 PDF' },
  pp_page_prog:  { bg:'Страница {0} от {1}…', ru:'Страница {0} из {1}…', uk:'Сторінка {0} з {1}…', en:'Page {0} of {1}…', de:'Seite {0} von {1}…', fr:'Page {0} sur {1}…', es:'Página {0} de {1}…', 'es-MX':'Página {0} de {1}…', it:'Pagina {0} di {1}…', pt:'Página {0} de {1}…', ar:'صفحة {0} من {1}…', hi:'पृष्ठ {0} / {1}…', ja:'ページ {0}/{1}…', ky:'Бет {0} / {1}…', 'zh-Hant':'第 {0}/{1} 頁…' },
  pp_ins_title:  { bg:'Сглобяване', ru:'Сборка', uk:'Збирання', en:'Assembly', de:'Zusammenbau', fr:'Assemblage', es:'Montaje', 'es-MX':'Montaje', it:'Montaggio', pt:'Montagem', ar:'التجميع', hi:'जोड़ना', ja:'組み立て', ky:'Чогултуу', 'zh-Hant':'組裝' },
  pp_ins_1:      { bg:'1. Изрежи по плътните линии.', ru:'1. Вырежи по сплошным линиям.', uk:'1. Виріж по суцільних лініях.', en:'1. Cut along the solid lines.', de:'1. Entlang der durchgezogenen Linien ausschneiden.', fr:'1. Découpe le long des traits pleins.', es:'1. Recorta por las líneas continuas.', 'es-MX':'1. Recorta por las líneas continuas.', it:'1. Ritaglia lungo le linee continue.', pt:'1. Recorta pelas linhas contínuas.', ar:'1. قص على طول الخطوط المتصلة.', hi:'1. ठोस रेखाओं पर काटें।', ja:'1. 実線に沿って切る。', ky:'1. Туташ сызыктар боюнча кес.', 'zh-Hant':'1. 沿實線裁切。' },
  pp_ins_2:      { bg:'2. Сгъни по пунктираните линии, снимките навън.', ru:'2. Согни по пунктирным линиям, фото наружу.', uk:'2. Зігни по пунктирних лініях, фото назовні.', en:'2. Fold along the dashed lines, photos facing out.', de:'2. Entlang der gestrichelten Linien falten, Fotos nach außen.', fr:'2. Plie le long des pointillés, photos vers l’extérieur.', es:'2. Dobla por las líneas discontinuas, fotos hacia fuera.', 'es-MX':'2. Dobla por las líneas discontinuas, fotos hacia fuera.', it:'2. Piega lungo le linee tratteggiate, foto verso l’esterno.', pt:'2. Dobra pelas linhas tracejadas, fotos para fora.', ar:'2. اطوِ على طول الخطوط المتقطعة، والصور إلى الخارج.', hi:'2. बिंदीदार रेखाओं पर मोड़ें, फ़ोटो बाहर की ओर।', ja:'2. 破線で折る（写真を外側に）。', ky:'2. Пунктир сызыктар боюнча бүктө, сүрөттөр сыртка.', 'zh-Hant':'2. 沿虛線摺疊，照片朝外。' },
  pp_ins_3:      { bg:'3. Намажи сивите езичета с лепило и залепи всяко ПОД страната със същия номер.', ru:'3. Намажь серые язычки клеем и приклей каждый ПОД сторону с тем же номером.', uk:'3. Намаж сірі язички клеєм і приклей кожен ПІД сторону з тим самим номером.', en:'3. Put glue on the grey tabs and stick each one UNDER the side with the same number.', de:'3. Die grauen Laschen mit Klebstoff bestreichen und jede UNTER die Seite mit derselben Nummer kleben.', fr:'3. Encolle les languettes grises et colle chacune SOUS la face du même numéro.', es:'3. Pon pegamento en las pestañas grises y pega cada una BAJO la cara con el mismo número.', 'es-MX':'3. Pon pegamento en las pestañas grises y pega cada una BAJO la cara con el mismo número.', it:'3. Metti la colla sulle linguette grigie e incolla ognuna SOTTO il lato con lo stesso numero.', pt:'3. Põe cola nas abas cinzentas e cola cada uma SOB o lado com o mesmo número.', ar:'3. ضع الغراء على الألسنة الرمادية وألصق كلاً منها تحت الجانب بنفس الرقم.', hi:'3. ग्रे टैब पर गोंद लगाएँ और हर एक को उसी नंबर वाली तरफ़ के नीचे चिपकाएँ।', ja:'3. 灰色ののりしろに糊を付け、同じ番号の面の下に貼る。', ky:'3. Боз тилчелерге желим сүйкөп, ар бирин ошол эле номердеги тараптын АСТЫНА чапта.', 'zh-Hant':'3. 在灰色黏貼片上塗膠，每片黏在相同編號的面下方。' },
  pp_ins_4:      { bg:'4. Лепи по ред на номерата и притискай няколко секунди.', ru:'4. Клей по порядку номеров и прижимай несколько секунд.', uk:'4. Клей за порядком номерів і притискай кілька секунд.', en:'4. Glue in number order and press for a few seconds.', de:'4. In Nummernreihenfolge kleben und einige Sekunden andrücken.', fr:'4. Colle dans l’ordre des numéros et presse quelques secondes.', es:'4. Pega en orden de números y presiona unos segundos.', 'es-MX':'4. Pega en orden de números y presiona unos segundos.', it:'4. Incolla in ordine di numero e premi per qualche secondo.', pt:'4. Cola por ordem dos números e pressiona alguns segundos.', ar:'4. ألصق بترتيب الأرقام واضغط لبضع ثوانٍ.', hi:'4. नंबर के क्रम में चिपकाएँ और कुछ सेकंड दबाएँ।', ja:'4. 番号順に貼り、数秒押さえる。', ky:'4. Номер тартибинде чаптап, бир нече секунд басып тур.', 'zh-Hant':'4. 依編號順序黏貼並按壓幾秒。' },
  pp_ins_lant:   { bg:'Фенер: дъното остава отворено — сложи вътре LED свещ (не истинска).', ru:'Фонарь: дно остаётся открытым — поставь внутрь LED-свечу (не настоящую).', uk:'Ліхтар: дно лишається відкритим — постав усередину LED-свічку (не справжню).', en:'Lantern: the bottom stays open — put an LED candle inside (never a real flame).', de:'Laterne: Der Boden bleibt offen — eine LED-Kerze hineinstellen (keine echte Flamme).', fr:'Lanterne : le fond reste ouvert — place une bougie LED à l’intérieur (jamais de vraie flamme).', es:'Farol: el fondo queda abierto — pon dentro una vela LED (nunca una llama real).', 'es-MX':'Farol: el fondo queda abierto — pon dentro una vela LED (nunca una llama real).', it:'Lanterna: il fondo resta aperto — metti dentro una candela LED (mai una fiamma vera).', pt:'Lanterna: o fundo fica aberto — põe dentro uma vela LED (nunca uma chama real).', ar:'الفانوس: يبقى القاع مفتوحاً — ضع بداخله شمعة LED (لا لهباً حقيقياً أبداً).', hi:'लालटेन: तल खुला रहता है — अंदर LED मोमबत्ती रखें (असली लौ कभी नहीं)।', ja:'ランタン：底は開けたまま。中にLEDキャンドルを入れる（本物の火は厳禁）。', ky:'Фонарь: түбү ачык калат — ичине LED шам кой (чыныгы от эмес).', 'zh-Hant':'燈籠：底部保持開口——放入 LED 蠟燭（切勿使用明火）。' },
  pp_ins_pop:    { bg:'Картичка: залепи езиче A на основата и езиче B на задната стена (по маркерите) — снимката се изправя при отваряне.', ru:'Открытка: приклей язычок A на основание и язычок B на заднюю стенку (по меткам) — фото поднимается при открытии.', uk:'Листівка: приклей язичок A на основу і язичок B на задню стінку (за мітками) — фото піднімається при відкриванні.', en:'Card: glue tab A onto the base and tab B onto the back panel (at the marks) — the photo stands up when the card opens.', de:'Karte: Lasche A auf die Grundfläche und Lasche B auf die Rückwand kleben (an den Markierungen) — das Foto richtet sich beim Öffnen auf.', fr:'Carte : colle la languette A sur la base et la B sur le panneau arrière (aux repères) — la photo se redresse à l’ouverture.', es:'Tarjeta: pega la pestaña A en la base y la B en el panel trasero (en las marcas) — la foto se levanta al abrir.', 'es-MX':'Tarjeta: pega la pestaña A en la base y la B en el panel trasero (en las marcas) — la foto se levanta al abrir.', it:'Biglietto: incolla la linguetta A sulla base e la B sul pannello posteriore (sui segni) — la foto si alza all’apertura.', pt:'Cartão: cola a aba A na base e a aba B no painel de trás (nas marcas) — a foto levanta-se ao abrir.', ar:'البطاقة: ألصق اللسان A على القاعدة واللسان B على اللوح الخلفي (عند العلامات) — تنتصب الصورة عند الفتح.', hi:'कार्ड: टैब A को आधार पर और टैब B को पिछले पैनल पर (निशानों पर) चिपकाएँ — खोलने पर फ़ोटो खड़ी हो जाती है।', ja:'カード：のりしろAを台紙に、Bを背面パネルに（印の位置に）貼ると、開いたとき写真が立ち上がる。', ky:'Открытка: A тилчесин негизге, B тилчесин арткы дубалга (белгилер боюнча) чапта — ачканда сүрөт тик турат.', 'zh-Hant':'卡片：將黏貼片 A 黏在底板、B 黏在背板（對準標記）——打開時照片會立起。' },
  pp_ins_stand:  { bg:'Стойка: залепи езичето под задната страна — получава се триъгълна стойка, която стои сама.', ru:'Подставка: приклей язычок под заднюю сторону — получится треугольная подставка, стоящая сама.', uk:'Підставка: приклей язичок під задню сторону — вийде трикутна підставка, що стоїть сама.', en:'Stand: glue the tab under the back side — you get a triangular stand that stands on its own.', de:'Ständer: Die Lasche unter die Rückseite kleben — es entsteht ein freistehender Dreieckständer.', fr:'Support : colle la languette sous la face arrière — tu obtiens un support triangulaire qui tient seul.', es:'Soporte: pega la pestaña bajo la cara trasera — queda un soporte triangular que se sostiene solo.', 'es-MX':'Soporte: pega la pestaña bajo la cara trasera — queda un soporte triangular que se sostiene solo.', it:'Supporto: incolla la linguetta sotto il lato posteriore — ottieni un supporto triangolare che sta in piedi da solo.', pt:'Suporte: cola a aba sob o lado de trás — fica um suporte triangular que se aguenta sozinho.', ar:'الحامل: ألصق اللسان تحت الجانب الخلفي — تحصل على حامل مثلث يقف بنفسه.', hi:'स्टैंड: टैब को पिछली तरफ़ के नीचे चिपकाएँ — एक त्रिकोणीय स्टैंड बनता है जो खुद खड़ा रहता है।', ja:'スタンド：のりしろを背面の下に貼ると、自立する三角スタンドになる。', ky:'Тирөөч: тилчени арткы тараптын астына чапта — өзү турган үч бурчтуу тирөөч чыгат.', 'zh-Hant':'立架：將黏貼片黏在背面下方——即成可自立的三角立架。' },
  pp_ins_box:    { bg:'Кутия: капакът е с 2 mm по-широк от кутията и се слага отгоре.', ru:'Коробка: крышка на 2 мм шире коробки и надевается сверху.', uk:'Коробка: кришка на 2 мм ширша за коробку і надягається зверху.', en:'Box: the lid is 2 mm wider than the box and sits on top.', de:'Box: Der Deckel ist 2 mm breiter als die Box und wird aufgesetzt.', fr:'Boîte : le couvercle est 2 mm plus large que la boîte et se pose dessus.', es:'Caja: la tapa es 2 mm más ancha que la caja y se coloca encima.', 'es-MX':'Caja: la tapa es 2 mm más ancha que la caja y se coloca encima.', it:'Scatola: il coperchio è 2 mm più largo della scatola e si appoggia sopra.', pt:'Caixa: a tampa é 2 mm mais larga do que a caixa e encaixa por cima.', ar:'العلبة: الغطاء أعرض من العلبة بـ 2 مم ويوضع فوقها.', hi:'बॉक्स: ढक्कन बॉक्स से 2 मिमी चौड़ा है और ऊपर बैठता है।', ja:'ボックス：ふたは箱より2 mm大きく、上にかぶせる。', ky:'Куту: капкагы кутудан 2 мм кененирээк жана үстүнө кийгизилет.', 'zh-Hant':'盒子：蓋子比盒身寬 2 mm，套在上方。' },
  pp_lg_cut:     { bg:'режи', ru:'резать', uk:'різати', en:'cut', de:'schneiden', fr:'couper', es:'cortar', 'es-MX':'cortar', it:'taglia', pt:'cortar', ar:'قص', hi:'काटें', ja:'切る', ky:'кес', 'zh-Hant':'裁切' },
  pp_lg_fold:    { bg:'сгъни', ru:'сгибать', uk:'згинати', en:'fold', de:'falten', fr:'plier', es:'doblar', 'es-MX':'doblar', it:'piega', pt:'dobrar', ar:'طي', hi:'मोड़ें', ja:'折る', ky:'бүктө', 'zh-Hant':'摺疊' },
  pp_lg_glue:    { bg:'лепи', ru:'клеить', uk:'клеїти', en:'glue', de:'kleben', fr:'coller', es:'pegar', 'es-MX':'pegar', it:'incolla', pt:'colar', ar:'لصق', hi:'चिपकाएँ', ja:'貼る', ky:'чапта', 'zh-Hant':'黏貼' },
  pp_st_hint:    { bg:'От една снимка — две гледни точки (ляво/дясно) по дълбочина от простия 3D модел: за стерео картичка, кръстосан поглед или червено-сини очила.', ru:'Из одного фото — две точки зрения (лево/право) по глубине из простой 3D-модели: для стереооткрытки, перекрёстного взгляда или красно-синих очков.', uk:'З одного фото — дві точки зору (ліво/право) за глибиною з простої 3D-моделі: для стереолистівки, перехресного погляду чи червоно-синіх окулярів.', en:'From one photo — two viewpoints (left/right) using depth from the simple 3D model: for a stereo card, cross-eyed viewing or red-cyan glasses.', de:'Aus einem Foto — zwei Blickpunkte (links/rechts) mit Tiefe aus dem einfachen 3D-Modell: für Stereokarte, Kreuzblick oder Rot-Cyan-Brille.', fr:'À partir d’une photo — deux points de vue (gauche/droite) selon la profondeur du modèle 3D simple : carte stéréo, vision croisée ou lunettes rouge-cyan.', es:'De una foto — dos puntos de vista (izquierda/derecha) según la profundidad del modelo 3D simple: para tarjeta estéreo, visión cruzada o gafas rojo-cian.', 'es-MX':'De una foto — dos puntos de vista (izquierda/derecha) según la profundidad del modelo 3D simple: para tarjeta estéreo, visión cruzada o lentes rojo-cian.', it:'Da una foto — due punti di vista (sinistra/destra) con la profondità del semplice modello 3D: per scheda stereo, visione incrociata o occhiali rosso-ciano.', pt:'De uma foto — dois pontos de vista (esquerda/direita) pela profundidade do modelo 3D simples: para cartão estéreo, visão cruzada ou óculos vermelho-ciano.', ar:'من صورة واحدة — وجهتا نظر (يسار/يمين) بحسب العمق من النموذج ثلاثي الأبعاد البسيط: لبطاقة مجسّمة أو الرؤية المتقاطعة أو نظارة حمراء-زرقاء.', hi:'एक फ़ोटो से — सरल 3D मॉडल की गहराई से दो दृष्टिकोण (बाएँ/दाएँ): स्टीरियो कार्ड, क्रॉस-आई देखने या लाल-नीले चश्मे के लिए।', ja:'1枚の写真から、簡易3Dモデルの奥行きで左右2つの視点を生成：ステレオカード、交差法、赤青メガネ用。', ky:'Бир сүрөттөн — жөнөкөй 3D моделдин тереңдиги боюнча эки көз караш (сол/оң): стерео карта, кайчылаш кароо же кызыл-көк көз айнек үчүн.', 'zh-Hant':'由一張照片，依簡易 3D 模型的深度產生左右兩個視點：可做立體卡、交叉視法或紅藍眼鏡。' },
  pp_st_mode:    { bg:'Изглед', ru:'Вид', uk:'Вигляд', en:'View', de:'Ansicht', fr:'Vue', es:'Vista', 'es-MX':'Vista', it:'Vista', pt:'Vista', ar:'العرض', hi:'दृश्य', ja:'表示', ky:'Көрүнүш', 'zh-Hant':'視圖' },
  pp_st_par:     { bg:'Успоредно (ляво | дясно)', ru:'Параллельно (лево | право)', uk:'Паралельно (ліво | право)', en:'Parallel (left | right)', de:'Parallel (links | rechts)', fr:'Parallèle (gauche | droite)', es:'Paralelo (izq. | der.)', 'es-MX':'Paralelo (izq. | der.)', it:'Parallelo (sinistra | destra)', pt:'Paralelo (esq. | dir.)', ar:'متوازٍ (يسار | يمين)', hi:'समानांतर (बाएँ | दाएँ)', ja:'平行法（左｜右）', ky:'Параллель (сол | оң)', 'zh-Hant':'平行法（左｜右）' },
  pp_st_cross:   { bg:'Кръстосан поглед (дясно | ляво)', ru:'Перекрёстный взгляд (право | лево)', uk:'Перехресний погляд (право | ліво)', en:'Cross-eyed (right | left)', de:'Kreuzblick (rechts | links)', fr:'Vision croisée (droite | gauche)', es:'Visión cruzada (der. | izq.)', 'es-MX':'Visión cruzada (der. | izq.)', it:'Visione incrociata (destra | sinistra)', pt:'Visão cruzada (dir. | esq.)', ar:'رؤية متقاطعة (يمين | يسار)', hi:'क्रॉस-आई (दाएँ | बाएँ)', ja:'交差法（右｜左）', ky:'Кайчылаш кароо (оң | сол)', 'zh-Hant':'交叉法（右｜左）' },
  pp_st_ana:     { bg:'Анаглиф (червено-синьо)', ru:'Анаглиф (красно-синий)', uk:'Анагліф (червоно-синій)', en:'Anaglyph (red-cyan)', de:'Anaglyphe (Rot-Cyan)', fr:'Anaglyphe (rouge-cyan)', es:'Anaglifo (rojo-cian)', 'es-MX':'Anaglifo (rojo-cian)', it:'Anaglifo (rosso-ciano)', pt:'Anaglifo (vermelho-ciano)', ar:'أناغليف (أحمر-أزرق)', hi:'एनाग्लिफ़ (लाल-नीला)', ja:'アナグリフ（赤青）', ky:'Анаглиф (кызыл-көк)', 'zh-Hant':'紅藍立體（Anaglyph）' },
  pp_st_depth:   { bg:'Дълбочина', ru:'Глубина', uk:'Глибина', en:'Depth', de:'Tiefe', fr:'Profondeur', es:'Profundidad', 'es-MX':'Profundidad', it:'Profondità', pt:'Profundidade', ar:'العمق', hi:'गहराई', ja:'奥行き', ky:'Тереңдик', 'zh-Hant':'深度' },
  pp_st_save:    { bg:'Запази PNG', ru:'Сохранить PNG', uk:'Зберегти PNG', en:'Save PNG', de:'PNG speichern', fr:'Enregistrer PNG', es:'Guardar PNG', 'es-MX':'Guardar PNG', it:'Salva PNG', pt:'Guardar PNG', ar:'حفظ PNG', hi:'PNG सहेजें', ja:'PNGを保存', ky:'PNG сактоо', 'zh-Hant':'儲存 PNG' },
  pp_st_sheet:   { bg:'Стерео картичка на лист (PDF)', ru:'Стереооткрытка на лист (PDF)', uk:'Стереолистівка на аркуш (PDF)', en:'Stereo card on a sheet (PDF)', de:'Stereokarte auf Bogen (PDF)', fr:'Carte stéréo sur feuille (PDF)', es:'Tarjeta estéreo en hoja (PDF)', 'es-MX':'Tarjeta estéreo en hoja (PDF)', it:'Scheda stereo su foglio (PDF)', pt:'Cartão estéreo em folha (PDF)', ar:'بطاقة مجسّمة على ورقة (PDF)', hi:'शीट पर स्टीरियो कार्ड (PDF)', ja:'ステレオカードをシートに (PDF)', ky:'Стерео карта баракка (PDF)', 'zh-Hant':'立體卡列印頁 (PDF)' },
  pp_st_note:    { bg:'Стерео картичка: гледай лявата снимка с лявото око и дясната с дясното — отпусни погледа „през" картата на ~30 cm. Червено-синята — с очила (червено отляво).', ru:'Стереооткрытка: смотри левое фото левым глазом, правое — правым, расслабь взгляд «сквозь» карту с ~30 см. Красно-синюю — в очках (красное слева).', uk:'Стереолистівка: дивись ліве фото лівим оком, праве — правим, розслаб погляд «крізь» картку з ~30 см. Червоно-синю — в окулярах (червоне зліва).', en:'Stereo card: look at the left photo with the left eye and the right one with the right eye — relax your gaze “through” the card at ~30 cm. Red-cyan: use glasses (red on the left).', de:'Stereokarte: linkes Foto mit dem linken Auge, rechtes mit dem rechten — den Blick aus ~30 cm „durch“ die Karte entspannen. Rot-Cyan: mit Brille (Rot links).', fr:'Carte stéréo : regarde la photo gauche avec l’œil gauche et la droite avec l’œil droit — détends le regard « à travers » la carte à ~30 cm. Rouge-cyan : avec lunettes (rouge à gauche).', es:'Tarjeta estéreo: mira la foto izquierda con el ojo izquierdo y la derecha con el derecho — relaja la vista «a través» de la tarjeta a ~30 cm. Rojo-cian: con gafas (rojo a la izquierda).', 'es-MX':'Tarjeta estéreo: mira la foto izquierda con el ojo izquierdo y la derecha con el derecho — relaja la vista «a través» de la tarjeta a ~30 cm. Rojo-cian: con lentes (rojo a la izquierda).', it:'Scheda stereo: guarda la foto sinistra con l’occhio sinistro e la destra con il destro — rilassa lo sguardo «attraverso» la scheda a ~30 cm. Rosso-ciano: con occhiali (rosso a sinistra).', pt:'Cartão estéreo: olha a foto esquerda com o olho esquerdo e a direita com o direito — relaxa o olhar «através» do cartão a ~30 cm. Vermelho-ciano: com óculos (vermelho à esquerda).', ar:'البطاقة المجسّمة: انظر إلى الصورة اليسرى بالعين اليسرى واليمنى باليمنى — أرخِ نظرك «عبر» البطاقة من ~30 سم. الأحمر-الأزرق: بنظارة (الأحمر على اليسار).', hi:'स्टीरियो कार्ड: बाईं फ़ोटो बाईं आँख से और दाईं फ़ोटो दाईं आँख से देखें — ~30 सेमी से कार्ड के «आर-पार» नज़र ढीली रखें। लाल-नीला: चश्मे से (लाल बाईं ओर)।', ja:'ステレオカード：左の写真を左目、右の写真を右目で見る。約30 cmでカードの「向こう」を見るように視線を緩める。赤青版はメガネ（左が赤）で。', ky:'Стерео карта: сол сүрөттү сол көз, оң сүрөттү оң көз менен кара — ~30 см аралыктан картанын «аркы жагына» карагандай көзүңдү бошот. Кызыл-көк — көз айнек менен (кызылы солдо).', 'zh-Hant':'立體卡：左眼看左圖、右眼看右圖，在約 30 cm 處放鬆視線「穿過」卡片。紅藍版請戴眼鏡（紅色在左）。' },
  pp_st_use:     { bg:'Снимка за стереото', ru:'Фото для стерео', uk:'Фото для стерео', en:'Photo for stereo', de:'Foto für Stereo', fr:'Photo pour la stéréo', es:'Foto para estéreo', 'es-MX':'Foto para estéreo', it:'Foto per lo stereo', pt:'Foto para estéreo', ar:'صورة للمجسّم', hi:'स्टीरियो के लिए फ़ोटो', ja:'ステレオ用写真', ky:'Стерео үчүн сүрөт', 'zh-Hant':'立體用照片' },
  pp_working:    { bg:'Изчислявам…', ru:'Вычисляю…', uk:'Обчислюю…', en:'Working…', de:'Berechne…', fr:'Calcul…', es:'Calculando…', 'es-MX':'Calculando…', it:'Elaboro…', pt:'A calcular…', ar:'جارٍ الحساب…', hi:'गणना हो रही है…', ja:'処理中…', ky:'Эсептеп жатам…', 'zh-Hant':'處理中…' },
  pp_tab_to:     { bg:'към', ru:'к', uk:'до', en:'to', de:'an', fr:'vers', es:'a', 'es-MX':'a', it:'a', pt:'para', ar:'إلى', hi:'की ओर', ja:'→', ky:'га', 'zh-Hant':'→' }
});

// ─────────────────────────── помощници ───────────────────────────
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tick = () => new Promise((r) => setTimeout(r, 0));
const PAGES = { A4: [210, 297], Letter: [215.9, 279.4] };
const MARGIN = 8, FOOTER = 24, GAP = 6;
const CREAM = '#f3ead8', GREY = '#e4e4e4', INK = '#222';

function rect(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
function bboxOf(polys) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
function centroid(p) { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }
// Езиче (трапец) навън от ръба p1→p2; посоката „навън" е обратна на центъра на страната c. to = номер на страната, под която се лепи.
function tab(p1, p2, c, to, depth) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L;
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
  if ((mx - c[0]) * nx + (my - c[1]) * ny < 0) { nx = -nx; ny = -ny; }
  const d = Math.min(depth, L * 0.45), in_ = Math.min(depth * 0.9, L * 0.3);
  const ux = dx / L, uy = dy / L;
  return { poly: [p1, p2, [p2[0] - ux * in_ + nx * d, p2[1] - uy * in_ + ny * d], [p1[0] + ux * in_ + nx * d, p1[1] + uy * in_ + ny * d]], fold: [p1, p2], to };
}
// Стандартна рамка на снимката за правоъгълник в шаблона с картинката „нагоре" = -y (o = долу-ляво).
function frameUp(x, y, w, h) { return { o: [x, y + h], ex: [1, 0], ey: [0, -1], w, h }; }
function frameDown(x, y, w, h) { return { o: [x + w, y], ex: [-1, 0], ey: [0, 1], w, h }; }     // картинката „нагоре" = +y
function frameLeft(x, y, w, h) { return { o: [x + w, y + h], ex: [0, -1], ey: [-1, 0], w: h, h: w }; } // „нагоре" = -x
function frameRight(x, y, w, h) { return { o: [x, y], ex: [0, 1], ey: [1, 0], w: h, h: w }; }        // „нагоре" = +x

// ─────────────────────────── фигури ───────────────────────────
// Всяка фигура: slots (етикети на страните), net(a) и mesh(a). Страните на шаблона: { slot|color, poly, frame, kind, num }.
// kind: 'photo' | 'border' (снимка с бяла рамка) | 'lantern' (прозорче) | 'solid' | 'lanttop' | 'cardbase'.
const SHAPES = {
  cube: {
    key: 'pp_sh_cube', slots: ['pp_f_front', 'pp_f_back', 'pp_f_left', 'pp_f_right', 'pp_f_top', 'pp_f_bottom'],
    net(a) {
      const T = Math.max(7, a * 0.16);
      const F = (slot, x, y) => ({ slot, poly: rect(x, y, a, a), frame: frameUp(x, y, a, a), kind: 'photo', num: slot + 1 });
      const faces = [F(4, a, 0), F(2, 0, a), F(0, a, a), F(3, 2 * a, a), F(1, 3 * a, a), F(5, a, 2 * a)];
      const c = (i) => centroid(faces[i].poly);
      const tabs = [
        tab([a, 0], [2 * a, 0], c(0), 2, T), tab([a, 0], [a, a], c(0), 3, T), tab([2 * a, 0], [2 * a, a], c(0), 4, T),
        tab([a, 2 * a], [a, 3 * a], c(5), 3, T), tab([2 * a, 2 * a], [2 * a, 3 * a], c(5), 4, T), tab([a, 3 * a], [2 * a, 3 * a], c(5), 2, T),
        tab([4 * a, a], [4 * a, 2 * a], c(4), 3, T)
      ];
      const folds = [[[a, a], [2 * a, a]], [[a, a], [a, 2 * a]], [[2 * a, a], [2 * a, 2 * a]], [[3 * a, a], [3 * a, 2 * a]], [[a, 2 * a], [2 * a, 2 * a]]];
      return { faces, tabs, folds };
    },
    mesh(a) {
      const h = a / 2, Q = (slot, v, shade) => ({ slot, v, shade });
      return [
        Q(0, [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]], 1),
        Q(1, [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]], 0.8),
        Q(2, [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]], 0.88),
        Q(3, [[h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]], 0.88),
        Q(4, [[-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]], 0.95),
        Q(5, [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]], 0.7)
      ];
    }
  },
  pyr: {
    key: 'pp_sh_pyr', slots: ['pp_f_front', 'pp_f_right', 'pp_f_back', 'pp_f_left', 'pp_f_base'],
    net(a) {
      const s = a, T = Math.max(7, a * 0.16), h2 = a / 2;
      const base = { slot: 4, poly: rect(s, s, a, a), frame: frameUp(s, s, a, a), kind: 'photo', num: 5 };
      // Триъгълни страни: рамката е с ширина a и височина s, „нагоре" = към върха.
      const top = { slot: 0, poly: [[s, s], [s + a, s], [s + h2, 0]], frame: { o: [s, s], ex: [1, 0], ey: [0, -1], w: a, h: s }, kind: 'photo', num: 1 };
      const right = { slot: 1, poly: [[s + a, s], [s + a, s + a], [2 * s + a, s + h2]], frame: { o: [s + a, s], ex: [0, 1], ey: [1, 0], w: a, h: s }, kind: 'photo', num: 2 };
      const bottom = { slot: 2, poly: [[s + a, s + a], [s, s + a], [s + h2, 2 * s + a]], frame: { o: [s + a, s + a], ex: [-1, 0], ey: [0, 1], w: a, h: s }, kind: 'photo', num: 3 };
      const left = { slot: 3, poly: [[s, s + a], [s, s], [0, s + h2]], frame: { o: [s, s + a], ex: [0, -1], ey: [-1, 0], w: a, h: s }, kind: 'photo', num: 4 };
      const faces = [top, right, bottom, left, base];
      const tabs = [
        tab([s + a, s], [s + h2, 0], centroid(top.poly), 2, T),
        tab([s + a, s + a], [2 * s + a, s + h2], centroid(right.poly), 3, T),
        tab([s, s + a], [s + h2, 2 * s + a], centroid(bottom.poly), 4, T),
        tab([s, s], [0, s + h2], centroid(left.poly), 1, T)
      ];
      const folds = [[[s, s], [s + a, s]], [[s + a, s], [s + a, s + a]], [[s, s + a], [s + a, s + a]], [[s, s], [s, s + a]]];
      return { faces, tabs, folds };
    },
    mesh(a) {
      const s = a, H = Math.sqrt(s * s - a * a / 4), h = a / 2, y0 = -H / 2, ap = [0, H / 2, 0];
      const TRI = (slot, bl, br, shade) => ({ slot, v: [bl, br, ap], uv: [[0, 0], [1, 0], [0.5, 1]], shade });
      return [
        TRI(0, [-h, y0, h], [h, y0, h], 1), TRI(1, [h, y0, h], [h, y0, -h], 0.88),
        TRI(2, [h, y0, -h], [-h, y0, -h], 0.78), TRI(3, [-h, y0, -h], [-h, y0, h], 0.88),
        { slot: 4, v: [[-h, y0, -h], [h, y0, -h], [h, y0, h], [-h, y0, h]], shade: 0.7 }
      ];
    }
  },
  box: {
    key: 'pp_sh_box', slots: ['pp_f_front', 'pp_f_back', 'pp_f_left', 'pp_f_right', 'pp_f_lid', 'pp_f_bottom'],
    net(a) {
      const b = Math.round(a * 0.6), T = Math.max(7, a * 0.14), al = a + 2, r = Math.max(8, Math.round(a * 0.16));
      const faces = [
        { slot: 5, poly: rect(b, b, a, a), frame: frameUp(b, b, a, a), kind: 'photo', num: 6 },
        { slot: 0, poly: rect(b, b + a, a, b), frame: frameDown(b, b + a, a, b), kind: 'photo', num: 1 },
        { slot: 1, poly: rect(b, 0, a, b), frame: frameUp(b, 0, a, b), kind: 'photo', num: 2 },
        { slot: 2, poly: rect(0, b, b, a), frame: frameLeft(0, b, b, a), kind: 'photo', num: 3 },
        { slot: 3, poly: rect(b + a, b, b, a), frame: frameRight(b + a, b, b, a), kind: 'photo', num: 4 }
      ];
      const cF = centroid(faces[1].poly), cB = centroid(faces[2].poly);
      const tabs = [
        tab([b, b + a], [b, b + a + b], cF, 3, T), tab([b + a, b + a], [b + a, b + a + b], cF, 4, T),
        tab([b, 0], [b, b], cB, 3, T), tab([b + a, 0], [b + a, b], cB, 4, T)
      ];
      const folds = [[[b, b], [b + a, b]], [[b, b + a], [b + a, b + a]], [[b, b], [b, b + a]], [[b + a, b], [b + a, b + a]]];
      // Капак — под кутията: квадрат al×al с 4 борда (r) и 4 езичета.
      const y0 = a + 2 * b + GAP + r, x0 = r + Math.max(0, (a + 2 * b - al - 2 * r) / 2);
      const lid = { slot: 4, poly: rect(x0, y0, al, al), frame: frameUp(x0, y0, al, al), kind: 'photo', num: 5 };
      const rims = [
        { color: 'lid', poly: rect(x0, y0 - r, al, r), kind: 'solid' }, { color: 'lid', poly: rect(x0, y0 + al, al, r), kind: 'solid' },
        { color: 'lid', poly: rect(x0 - r, y0, r, al), kind: 'solid' }, { color: 'lid', poly: rect(x0 + al, y0, r, al), kind: 'solid' }
      ];
      faces.push(lid, ...rims);
      const cT = centroid(rims[0].poly), cBt = centroid(rims[1].poly);
      tabs.push(tab([x0, y0 - r], [x0, y0], cT, 5, T * 0.8), tab([x0 + al, y0 - r], [x0 + al, y0], cT, 5, T * 0.8),
        tab([x0, y0 + al], [x0, y0 + al + r], cBt, 5, T * 0.8), tab([x0 + al, y0 + al], [x0 + al, y0 + al + r], cBt, 5, T * 0.8));
      folds.push([[x0, y0], [x0 + al, y0]], [[x0, y0 + al], [x0 + al, y0 + al]], [[x0, y0], [x0, y0 + al]], [[x0 + al, y0], [x0 + al, y0 + al]]);
      return { faces, tabs, folds };
    },
    mesh(a) {
      const b = Math.round(a * 0.6), h = a / 2, hb = b / 2, al = a + 2, hl = al / 2, r = Math.max(8, Math.round(a * 0.16));
      const yt = hb + 0.6, yr = yt - r;
      return [
        { slot: 0, v: [[-h, -hb, h], [h, -hb, h], [h, hb, h], [-h, hb, h]], shade: 1 },
        { slot: 1, v: [[h, -hb, -h], [-h, -hb, -h], [-h, hb, -h], [h, hb, -h]], shade: 0.8 },
        { slot: 2, v: [[-h, -hb, -h], [-h, -hb, h], [-h, hb, h], [-h, hb, -h]], shade: 0.88 },
        { slot: 3, v: [[h, -hb, h], [h, -hb, -h], [h, hb, -h], [h, hb, h]], shade: 0.88 },
        { slot: 5, v: [[-h, -hb, -h], [h, -hb, -h], [h, -hb, h], [-h, -hb, h]], shade: 0.7 },
        { slot: 4, v: [[-hl, yt, hl], [hl, yt, hl], [hl, yt, -hl], [-hl, yt, -hl]], shade: 0.97 },
        { color: 'lid', v: [[-hl, yr, hl], [hl, yr, hl], [hl, yt, hl], [-hl, yt, hl]], shade: 0.9 },
        { color: 'lid', v: [[hl, yr, -hl], [-hl, yr, -hl], [-hl, yt, -hl], [hl, yt, -hl]], shade: 0.75 },
        { color: 'lid', v: [[-hl, yr, -hl], [-hl, yr, hl], [-hl, yt, hl], [-hl, yt, -hl]], shade: 0.82 },
        { color: 'lid', v: [[hl, yr, hl], [hl, yr, -hl], [hl, yt, -hl], [hl, yt, hl]], shade: 0.82 }
      ];
    }
  },
  lant: {
    key: 'pp_sh_lant', slots: ['pp_f_side:1', 'pp_f_side:2', 'pp_f_side:3', 'pp_f_side:4'],
    net(a) {
      const hl = Math.round(a * 1.5), T = Math.max(7, a * 0.14);
      const faces = [];
      for (let i = 0; i < 4; i++) faces.push({ slot: i, poly: rect(i * a, a, a, hl), frame: frameUp(i * a, a, a, hl), kind: 'lantern', num: i + 1 });
      const top = { color: 'cream', poly: rect(a, 0, a, a), kind: 'lanttop', frame: frameUp(a, 0, a, a) };
      faces.push(top);
      const cT = centroid(top.poly);
      const tabs = [
        tab([4 * a, a], [4 * a, a + hl], centroid(faces[3].poly), 1, T),
        tab([a, 0], [2 * a, 0], cT, 4, T), tab([a, 0], [a, a], cT, 1, T), tab([2 * a, 0], [2 * a, a], cT, 3, T)
      ];
      const folds = [[[a, a], [a, a + hl]], [[2 * a, a], [2 * a, a + hl]], [[3 * a, a], [3 * a, a + hl]], [[a, a], [2 * a, a]]];
      return { faces, tabs, folds };
    },
    mesh(a) {
      const hl = Math.round(a * 1.5), h = a / 2, hh = hl / 2;
      return [
        { slot: 0, v: [[-h, -hh, h], [h, -hh, h], [h, hh, h], [-h, hh, h]], shade: 1 },
        { slot: 1, v: [[h, -hh, h], [h, -hh, -h], [h, hh, -h], [h, hh, h]], shade: 0.88 },
        { slot: 2, v: [[h, -hh, -h], [-h, -hh, -h], [-h, hh, -h], [h, hh, -h]], shade: 0.8 },
        { slot: 3, v: [[-h, -hh, -h], [-h, -hh, h], [-h, hh, h], [-h, hh, -h]], shade: 0.88 },
        { color: 'cream', kind: 'lanttop', v: [[-h, hh, h], [h, hh, h], [h, hh, -h], [-h, hh, -h]], shade: 0.95 }
      ];
    }
  },
  stand: {
    key: 'pp_sh_stand', slots: ['pp_f_front', 'pp_f_back'],
    net(a) {
      const hs = Math.round(a * 1.3), d = Math.round(hs * 0.45), T = Math.max(7, a * 0.14);
      const faces = [
        { slot: 1, poly: rect(0, 0, a, hs), frame: frameDown(0, 0, a, hs), kind: 'border', num: 2 },
        { slot: 0, poly: rect(0, hs, a, hs), frame: frameUp(0, hs, a, hs), kind: 'border', num: 1 },
        { color: 'cream', poly: rect(0, 2 * hs, a, d), kind: 'solid' }
      ];
      const tabs = [tab([0, 2 * hs + d], [a, 2 * hs + d], centroid(faces[2].poly), 2, T)];
      const folds = [[[0, hs], [a, hs]], [[0, 2 * hs], [a, 2 * hs]]];
      return { faces, tabs, folds };
    },
    mesh(a) {
      const hs = Math.round(a * 1.3), d = Math.round(hs * 0.45), Hh = Math.sqrt(hs * hs - d * d / 4), h = a / 2, y0 = -Hh / 2, y1 = Hh / 2, z = d / 2;
      return [
        { slot: 0, v: [[-h, y0, z], [h, y0, z], [h, y1, 0], [-h, y1, 0]], shade: 1 },
        { slot: 1, v: [[h, y0, -z], [-h, y0, -z], [-h, y1, 0], [h, y1, 0]], shade: 0.8 },
        { color: 'cream', v: [[-h, y0, -z], [h, y0, -z], [h, y0, z], [-h, y0, z]], shade: 0.7 }
      ];
    }
  },
  pop: {
    key: 'pp_sh_pop', slots: ['pp_f_stand', 'pp_f_bg'],
    net(a) {
      const d = a, W = Math.round(a * 1.7), Hc = Math.round(a * 1.45), tb = 8, x0 = W + GAP, xm = (W - a) / 2;
      const faces = [
        { slot: 1, poly: rect(0, 0, W, Hc), frame: frameUp(0, 0, W, Hc), kind: 'photo', num: 2, mark: { y: Hc - d - tb, x: xm, w: a, h: tb, label: 'B' } },
        { color: 'cream', poly: rect(0, Hc, W, Hc), frame: frameUp(0, Hc, W, Hc), kind: 'cardbase', mark: { y: Hc + d, x: xm, w: a, h: tb, label: 'A' } },
        { color: 'grey', poly: rect(x0, 0, a, tb), kind: 'solid', label: 'B' },
        { color: 'cream', poly: rect(x0, tb, a, d), kind: 'solid' },
        { slot: 0, poly: rect(x0, tb + d, a, d), frame: frameUp(x0, tb + d, a, d), kind: 'photo', num: 1 },
        { color: 'grey', poly: rect(x0, tb + 2 * d, a, tb), kind: 'solid', label: 'A' }
      ];
      const folds = [[[0, Hc], [W, Hc]], [[x0, tb], [x0 + a, tb]], [[x0, tb + d], [x0 + a, tb + d]], [[x0, tb + 2 * d], [x0 + a, tb + 2 * d]]];
      return { faces, tabs: [], folds };
    },
    mesh(a) {
      const d = a, W = Math.round(a * 1.7), Hc = Math.round(a * 1.45), hw = W / 2, h = a / 2, y0 = -Hc * 0.45;
      return [
        { slot: 1, v: [[-hw, y0, 0], [hw, y0, 0], [hw, y0 + Hc, 0], [-hw, y0 + Hc, 0]], shade: 0.85 },
        { color: 'cream', v: [[-hw, y0, Hc], [hw, y0, Hc], [hw, y0, 0], [-hw, y0, 0]], shade: 0.75 },
        { slot: 0, v: [[-h, y0 + 0.3, d], [h, y0 + 0.3, d], [h, y0 + d, d], [-h, y0 + d, d]], shade: 1 },
        { color: 'cream', v: [[-h, y0 + d, d], [h, y0 + d, d], [h, y0 + d, 0], [-h, y0 + d, 0]], shade: 0.9 }
      ];
    }
  }
};
const SHAPE_ORDER = ['cube', 'pyr', 'box', 'lant', 'stand', 'pop'];
const COLORS = { cream: CREAM, grey: GREY, lid: '#c9b8a0' };

// ─────────────────────────── рисуване на страна (еднакво в шаблона и в атласа) ───────────────────────────
// ctx е вече трансформиран така, че (0,0)-(w,h) са mm координати на картинката (y надолу).
function coverImage(ctx, img, x, y, w, h) {
  const iw = img.width, ih = img.height, s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}
function placeholder(ctx, w, h) {
  ctx.fillStyle = '#d9dde3'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#b7bcc4'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
}
function paintFace(ctx, kind, w, h, img, extra) {
  if (kind === 'solid') { ctx.fillStyle = extra.color; ctx.fillRect(0, 0, w, h); return; }
  if (kind === 'lanttop') {
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.28, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.28, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (kind === 'cardbase') {
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d8ccb4'; ctx.lineWidth = 0.25;
    for (let y = 6; y < h; y += 6) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(w - 4, y); ctx.stroke(); }
    return;
  }
  if (kind === 'lantern') {
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, w, h);
    const m = w * 0.11, ww = w - 2 * m, wh = h - 2 * m, rr = ww / 2;
    ctx.save(); ctx.beginPath(); ctx.moveTo(m, m + rr); ctx.arc(m + rr, m + rr, rr, Math.PI, 0); ctx.lineTo(m + ww, m + wh); ctx.lineTo(m, m + wh); ctx.closePath(); ctx.clip();
    if (img) coverImage(ctx, img, m, m, ww, wh); else placeholder(ctx, w, h);
    ctx.restore();
    ctx.strokeStyle = '#6b4f2a'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(m, m + rr); ctx.arc(m + rr, m + rr, rr, Math.PI, 0); ctx.lineTo(m + ww, m + wh); ctx.lineTo(m, m + wh); ctx.closePath(); ctx.stroke();
    return;
  }
  if (kind === 'border') {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    const m = Math.min(w, h) * 0.07;
    if (img) coverImage(ctx, img, m, m, w - 2 * m, h - 2 * m - m * 0.8); else { ctx.translate(m, m); placeholder(ctx, w - 2 * m, h - 2 * m); ctx.translate(-m, -m); }
    return;
  }
  if (img) coverImage(ctx, img, 0, 0, w, h); else placeholder(ctx, w, h);
}
// Прилага рамката (o, ex, ey) → локални mm координати (y надолу) и рисува.
function withFrame(ctx, fr, fn) {
  const tlx = fr.o[0] + fr.h * fr.ey[0], tly = fr.o[1] + fr.h * fr.ey[1];
  ctx.save(); ctx.transform(fr.ex[0], fr.ex[1], -fr.ey[0], -fr.ey[1], tlx, tly); fn(); ctx.restore();
}
function pathPoly(ctx, p) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); }

// Рисува целия шаблон при (ox, oy) mm в ctx (вече мащабиран към mm). imgs[slot] = картинка (може null).
function drawNet(ctx, net, ox, oy, imgs, opts) {
  ctx.save(); ctx.translate(ox, oy);
  const lab = opts && opts.tabWord ? opts.tabWord : '';
  // страни
  for (const f of net.faces) {
    ctx.save(); pathPoly(ctx, f.poly); ctx.clip();
    if (f.frame) withFrame(ctx, f.frame, () => paintFace(ctx, f.kind, f.frame.w, f.frame.h, f.slot != null ? imgs[f.slot] : null, { color: COLORS[f.color] || '#eee' }));
    else { ctx.fillStyle = COLORS[f.color] || '#eee'; pathPoly(ctx, f.poly); ctx.fill(); }
    ctx.restore();
    if (f.mark) { // маркер за лепене (поп-ъп): пунктиран правоъгълник + буква
      ctx.save(); ctx.setLineDash([1.2, 1]); ctx.strokeStyle = '#555'; ctx.lineWidth = 0.25; ctx.strokeRect(f.mark.x, f.mark.y, f.mark.w, f.mark.h); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(f.mark.x, f.mark.y, f.mark.w, f.mark.h);
      ctx.fillStyle = INK; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.mark.label, f.mark.x + f.mark.w / 2, f.mark.y + f.mark.h / 2); ctx.restore();
    }
    if (f.label) { ctx.save(); const c = centroid(f.poly); ctx.fillStyle = INK; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.label, c[0], c[1]); ctx.restore(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 0.3; pathPoly(ctx, f.poly); ctx.stroke();
  }
  // езичета
  for (const tb of net.tabs) {
    ctx.fillStyle = GREY; pathPoly(ctx, tb.poly); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.3; ctx.stroke();
    const c = centroid(tb.poly); ctx.save(); ctx.fillStyle = '#333'; ctx.font = 'bold 3px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((lab ? lab + ' ' : '→') + tb.to, c[0], c[1]); ctx.restore();
  }
  // сгъвки: бял подслой + пунктир (върху ръбовете на страните и основите на езичетата)
  const folds = net.folds.concat(net.tabs.map((x) => x.fold));
  for (const [p, q] of folds) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    ctx.setLineDash([1.6, 1.1]); ctx.strokeStyle = '#333'; ctx.lineWidth = 0.28; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.restore();
  }
  // номера на страните (малък кръг долу-ляво)
  for (const f of net.faces) {
    if (f.num == null) continue;
    const p = f.poly.length === 4 ? [f.poly[3][0] + 4, f.poly[3][1] - 4] : centroid(f.poly);
    ctx.save(); ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.25; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = 'bold 3px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(f.num), p[0], p[1] + 0.1); ctx.restore();
  }
  ctx.restore();
}
function netBounds(net) { return bboxOf(net.faces.map((f) => f.poly).concat(net.tabs.map((x) => x.poly))); }

// ─────────────────────────── текстурен атлас + 3D мрежа ───────────────────────────
const ATLAS = 2048, CELL = 660;
function buildAtlas(shape, a, imgs) {
  const cv = document.createElement('canvas'); cv.width = ATLAS; cv.height = ATLAS;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#888'; ctx.fillRect(0, 0, ATLAS, ATLAS);
  const net = shape.net(a), regions = {};
  // по една област за всеки слот (аспект = рамката на страната в шаблона)
  let i = 0;
  for (const f of net.faces) {
    if (f.slot == null || regions['s' + f.slot]) continue;
    const col = i % 3, row = Math.floor(i / 3); i++;
    const asp = f.frame.w / f.frame.h; let w = CELL, h = CELL; if (asp >= 1) h = CELL / asp; else w = CELL * asp;
    const x = col * CELL + 4, y = row * CELL + 4; w -= 8; h -= 8;
    ctx.save(); ctx.translate(x, y); ctx.scale(w / f.frame.w, h / f.frame.h);
    paintFace(ctx, f.kind, f.frame.w, f.frame.h, imgs[f.slot], {}); ctx.restore();
    regions['s' + f.slot] = { x, y, w, h };
  }
  // цветни петна + „капак на фенера" — в долния ред
  let cx = 0;
  const patch = (key, fn) => { const x = cx, y = ATLAS - 128, w = 120, h = 120; cx += 128; ctx.save(); ctx.translate(x, y); fn(x, y, w, h); ctx.restore(); regions[key] = { x, y, w, h }; };
  for (const k in COLORS) patch('c:' + k, (x, y, w, h) => { ctx.fillStyle = COLORS[k]; ctx.fillRect(0, 0, w, h); });
  patch('k:lanttop', (x, y, w, h) => { ctx.scale(w / a, h / a); paintFace(ctx, 'lanttop', a, a, null, {}); });
  return { canvas: cv, regions };
}
function buildMesh(shape, a, regions) {
  const faces = shape.mesh(a), pos = [], uv = [], sh = [], idx = [];
  let n = 0, ext = 0;
  for (const f of faces) {
    const key = f.kind === 'lanttop' ? 'k:lanttop' : (f.slot != null ? 's' + f.slot : 'c:' + f.color);
    const r = regions[key]; if (!r) continue;
    const luv = f.uv || (f.v.length === 4 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [1, 0], [0.5, 1]]);
    for (let k = 0; k < f.v.length; k++) {
      pos.push(f.v[k][0], f.v[k][1], f.v[k][2]); ext = Math.max(ext, Math.abs(f.v[k][0]), Math.abs(f.v[k][1]), Math.abs(f.v[k][2]));
      let u = luv[k][0], v = luv[k][1];
      if (f.slot == null && f.kind !== 'lanttop') { u = 0.5; v = 0.5; } // плътен цвят — центърът на петното
      uv.push((r.x + u * r.w) / ATLAS, 1 - (r.y + (1 - v) * r.h) / ATLAS);
      sh.push(f.shade);
    }
    if (f.v.length === 4) idx.push(n, n + 1, n + 2, n, n + 2, n + 3); else idx.push(n, n + 1, n + 2);
    n += f.v.length;
  }
  const s = 1.15 / (ext || 1);
  for (let k = 0; k < pos.length; k++) pos[k] *= s;
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), sh: new Float32Array(sh), idx: new Uint16Array(idx) };
}
// Малък WebGL преглед на сглобената фигура (общ двигател r3-gl.js).
function makePreview(canvas) {
  let gl; try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true }); } catch (e) {}
  if (!gl) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  const aPos = gl.getAttribLocation(prog, 'aPos'), aUv = gl.getAttribLocation(prog, 'aUv'), aShade = gl.getAttribLocation(prog, 'aShade');
  const uMVP = gl.getUniformLocation(prog, 'uMVP'), uUseTex = gl.getUniformLocation(prog, 'uUseTex'), uShadow = gl.getUniformLocation(prog, 'uShadow'), uSolid = gl.getUniformLocation(prog, 'uSolid');
  const bPos = gl.createBuffer(), bUv = gl.createBuffer(), bSh = gl.createBuffer(), bIdx = gl.createBuffer(), tex = gl.createTexture();
  gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
  const pv = mMul(mPerspective(40 * Math.PI / 180, 1, 0.1, 100), mTranslate(0, 0, -5.0) /* 11.09: камерата по-далеч — кубът/фенерът се изрязваха на предната стена */);
  let count = 0, q = qIdent();
  function setMesh(m, atlas) {
    const up = (b, d) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); };
    up(bPos, m.pos); up(bUv, m.uv); up(bSh, m.sh);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW); count = m.idx.length;
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); if (!count) return;
    gl.uniformMatrix4fv(uMVP, false, new Float32Array(mMul(pv, qMat(q)))); gl.uniform1f(uShadow, 0); gl.uniform1f(uUseTex, 1); gl.uniform3f(uSolid, 0.8, 0.8, 0.8);
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bUv); gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bSh); gl.enableVertexAttribArray(aShade); gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
  }
  return {
    setMesh, draw,
    rotate(ax, ay, az, rad) { q = qRotateWorld(q, ax, ay, az, rad); draw(); },
    reset() { q = qRotateWorld(qRotateWorld(qIdent(), 1, 0, 0, 0.45), 0, 1, 0, -0.6); draw(); }
  };
}

// ─────────────────────────── лист за печат (страници в mm → платно) ───────────────────────────
// Връща масив от платна (по едно на страница). painter(ctx, pageW, pageH, pageIndex) рисува в mm.
function renderPages(pageKey, dpi, pages, painter) {
  const [pw, ph] = PAGES[pageKey] || PAGES.A4, ppm = dpi / 25.4, out = [];
  for (let p = 0; p < pages; p++) {
    const cv = document.createElement('canvas'); cv.width = Math.round(pw * ppm); cv.height = Math.round(ph * ppm);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.scale(ppm, ppm); ctx.lineJoin = 'round'; painter(ctx, pw, ph, p); out.push(cv);
  }
  return out;
}
function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let line = '';
  for (const w of words) { const tst = line ? line + ' ' + w : w; if (ctx.measureText(tst).width > maxW && line) { lines.push(line); line = w; } else line = tst; }
  if (line) lines.push(line); return lines;
}
// Долен колонтитул с инструкции + легенда (mm).
function drawFooter(ctx, pw, ph, title, lines) {
  const x = MARGIN, y = ph - MARGIN - FOOTER + 2, w = pw - 2 * MARGIN;
  ctx.save(); ctx.strokeStyle = '#999'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(x, y - 1.5); ctx.lineTo(x + w, y - 1.5); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = 'bold 3.2px sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(title, x, y);
  // легенда
  let lx = x + w - 62; const ly = y + 1.4;
  ctx.font = '2.6px sans-serif';
  ctx.strokeStyle = INK; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 8, ly); ctx.stroke(); ctx.fillText(t('pp_lg_cut'), lx + 9.5, ly - 1.4); lx += 22;
  ctx.setLineDash([1.6, 1.1]); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 8, ly); ctx.stroke(); ctx.setLineDash([]); ctx.fillText(t('pp_lg_fold'), lx + 9.5, ly - 1.4); lx += 22;
  ctx.fillStyle = GREY; ctx.fillRect(lx, ly - 1.6, 8, 3.2); ctx.strokeRect(lx, ly - 1.6, 8, 3.2); ctx.fillStyle = INK; ctx.fillText(t('pp_lg_glue'), lx + 9.5, ly - 1.4);
  // инструкции в 2 колони
  ctx.font = '2.5px sans-serif'; const colW = (w - 4) / 2; let cy = y + 4.6, col = 0;
  for (const s of lines) {
    for (const ln of wrapText(ctx, s, colW)) {
      if (cy > ph - MARGIN - 1) { if (col === 1) break; col = 1; cy = y + 4.6; }
      ctx.fillText(ln, x + col * (colW + 4), cy); cy += 3.1;
    }
  }
  ctx.restore();
}

// ─────────────────────────── стерео от една снимка ───────────────────────────
// Дълбочина: радиален купол (центърът изпъква) + изгладена яркост (по-светлото е по-близо), както релефът в „3D".
function depthGrid(img, G) {
  const c = document.createElement('canvas'); c.width = G; c.height = G; const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, G, G);
  const d = cx.getImageData(0, 0, G, G).data, lum = new Float32Array(G * G), out = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    let s = 0, n = 0; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const jj = j + dj, ii = i + di; if (jj >= 0 && jj < G && ii >= 0 && ii < G) { s += lum[jj * G + ii]; n++; } }
    const x = (i + 0.5) / G * 2 - 1, y = (j + 0.5) / G * 2 - 1, dome = Math.max(0, 1 - (x * x + y * y) * 0.9);
    out[j * G + i] = 0.6 * dome + 0.4 * (s / n);
  }
  return out;
}
function stereoPair(img, strength) {
  const W = Math.min(900, img.width), H = Math.round(img.height * W / img.width), G = 48;
  const src = document.createElement('canvas'); src.width = W; src.height = H; src.getContext('2d').drawImage(img, 0, 0, W, H);
  const sd = src.getContext('2d').getImageData(0, 0, W, H).data, dg = depthGrid(img, G);
  const S = W * 0.012 * strength;
  const mk = (sign) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
    const im = cx.createImageData(W, H), od = im.data;
    for (let y = 0; y < H; y++) {
      const gy = Math.min(G - 1, Math.floor(y / H * G));
      for (let x = 0; x < W; x++) {
        const gx = Math.min(G - 1, Math.floor(x / W * G)), dep = dg[gy * G + gx];
        let sx = Math.round(x - sign * S * (dep - 0.5)); if (sx < 0) sx = 0; if (sx >= W) sx = W - 1;
        const o = (y * W + x) * 4, s = (y * W + sx) * 4; od[o] = sd[s]; od[o + 1] = sd[s + 1]; od[o + 2] = sd[s + 2]; od[o + 3] = 255;
      }
    }
    cx.putImageData(im, 0, 0); return cv;
  };
  return { left: mk(1), right: mk(-1), W, H };
}
function composeStereo(pair, mode) {
  const { left, right, W, H } = pair, cv = document.createElement('canvas');
  if (mode === 'ana') {
    cv.width = W; cv.height = H; const cx = cv.getContext('2d');
    const L = left.getContext('2d').getImageData(0, 0, W, H).data, R = right.getContext('2d').getImageData(0, 0, W, H);
    const d = R.data; for (let i = 0; i < d.length; i += 4) d[i] = L[i];
    cx.putImageData(R, 0, 0); return cv;
  }
  const gap = Math.round(W * 0.03); cv.width = W * 2 + gap; cv.height = H; const cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  const A = mode === 'cross' ? right : left, B = mode === 'cross' ? left : right;
  cx.drawImage(A, 0, 0); cx.drawImage(B, W + gap, 0);
  cx.fillStyle = '#000'; cx.beginPath(); cx.arc(W / 2, H * 0.03 + 6, 4, 0, Math.PI * 2); cx.arc(W + gap + W / 2, H * 0.03 + 6, 4, 0, Math.PI * 2); cx.fill();
  return cv;
}

// ─────────────────────────── изход (PNG / PDF) ───────────────────────────
async function savePng(canvas, name) { await new Promise((res) => canvas.toBlob(async (b) => { if (b) await saveFile(name, b, 'image/png'); res(); }, 'image/png')); }
async function savePdf(canvases, pageKey, name) {
  const { PDFDocument } = await import('pdf-lib');
  const [pw, ph] = PAGES[pageKey] || PAGES.A4, doc = await PDFDocument.create(), PT = 72 / 25.4;
  for (const cv of canvases) {
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.92));
    const jpg = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const page = doc.addPage([pw * PT, ph * PT]); page.drawImage(jpg, { x: 0, y: 0, width: pw * PT, height: ph * PT });
  }
  const bytes = await doc.save();
  await saveFile(name, new Blob([bytes], { type: 'application/pdf' }), 'application/pdf');
}
function loadImg(dataUrl) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image')); im.src = dataUrl; }); }
// Снимката се смалява до 1400 px (памет) и се пази като платно.
async function pickPhoto() {
  const f = await pickBinaryFile('image/*'); if (!f || !f.dataUrl) return null;
  const im = await loadImg(f.dataUrl), s = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * s)); cv.height = Math.max(1, Math.round(im.naturalHeight * s));
  cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); return cv;
}

// ─────────────────────────── UI ───────────────────────────
export function mountPaper({ pane, flash }) {
  const STAGE = 'position:relative;width:100%;max-width:420px;margin:0 auto;aspect-ratio:1/1;border-radius:14px;overflow:hidden;border:1px solid #d7dde8;background:conic-gradient(#e9edf3 90deg,#f6f8fb 0 180deg,#e9edf3 0 270deg,#f6f8fb 0) 0 0/28px 28px';
  const opt = (v, key, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${esc(t(key))}</option>`;
  pane.innerHTML = `
    <div class="tabs" id="ppsub" style="margin-bottom:10px">
      <button class="tab active" data-sub="fig">🧩 ${esc(t('pp_sub_fig'))}</button>
      <button class="tab" data-sub="prev">🧊 ${esc(t('pp_sub_prev'))}</button>
      <button class="tab" data-sub="sheet">🖨 ${esc(t('pp_sub_sheet'))}</button>
      <button class="tab" data-sub="st">👓 ${esc(t('pp_sub_stereo'))}</button>
    </div>
    <div id="ppFig">
      <p class="hint" style="margin-top:0">${esc(t('pp_hint'))}</p>
      <div class="row" style="align-items:end">
        <div><label>${esc(t('pp_shape'))}</label><select id="ppshape">${SHAPE_ORDER.map((k, i) => opt(k, SHAPES[k].key, i === 0)).join('')}</select></div>
        <div><label>${esc(t('pp_size'))}</label><input id="ppsize" type="number" min="30" max="150" step="5" value="50" /></div>
      </div>
      <label>${esc(t('pp_faces'))}</label>
      <div class="hint" style="margin:0 0 6px">${esc(t('pp_face_tap'))}</div>
      <div id="ppslots" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>
      <button class="btn sec" id="ppclear">${esc(t('pp_clear'))}</button>
    </div>
    <div id="ppPrev" style="display:none">
      <div id="ppstage" style="${STAGE}"><canvas id="ppcv" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas></div>
      <p class="hint">${esc(t('pp_prev_hint'))}</p>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn sec" id="ppspin" style="flex:1;margin-top:0">🔄 ${esc(t('pp_spin'))}</button>
        <button class="btn" id="ppreset" style="flex:1;background:#5b6472;margin-top:0">↺ ${esc(t('r3_reset'))}</button>
      </div>
      <button class="btn" id="ppsaveview">💾 ${esc(t('pp_prev_save'))}</button>
    </div>
    <div id="ppSheet" style="display:none">
      <p class="hint" style="margin-top:0">${esc(t('pp_sheet_hint'))}</p>
      <div class="row">
        <div><label>${esc(t('pp_page'))}</label><select id="pppage"><option value="A4" selected>A4</option><option value="Letter">Letter</option></select></div>
        <div><label>${esc(t('pp_dpi'))}</label><select id="ppdpi"><option value="150">150</option><option value="300" selected>300</option></select></div>
        <div><label>${esc(t('pp_copies'))}</label><input id="ppcopies" type="number" min="1" max="20" value="1" /></div>
      </div>
      <div class="hint" id="ppfits"></div>
      <div id="ppsheetprev" style="margin-top:10px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff"></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn sec" id="pppng" style="flex:1;margin-top:0">🖼 ${esc(t('pp_dl_png'))}</button>
        <button class="btn" id="pppdf" style="flex:1;margin-top:0">📄 ${esc(t('pp_dl_pdf'))}</button>
      </div>
      <div class="out-block" id="ppins"></div>
    </div>
    <div id="ppSt" style="display:none">
      <p class="hint" style="margin-top:0">${esc(t('pp_st_hint'))}</p>
      <div id="ppstprev" style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;min-height:80px"></div>
      <button class="btn sec" id="ppstpick">📁 ${esc(t('pp_st_use'))}</button>
      <div class="row">
        <div><label>${esc(t('pp_st_mode'))}</label><select id="ppstmode">${opt('par', 'pp_st_par', true)}${opt('cross', 'pp_st_cross')}${opt('ana', 'pp_st_ana')}</select></div>
        <div><label>${esc(t('pp_st_depth'))}</label><input id="ppstdepth" type="range" min="1" max="4" step="0.5" value="2" /></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn sec" id="ppstsave" style="flex:1;margin-top:0">💾 ${esc(t('pp_st_save'))}</button>
        <button class="btn" id="ppstsheet" style="flex:1;margin-top:0">📄 ${esc(t('pp_st_sheet'))}</button>
      </div>
      <p class="hint">${esc(t('pp_st_note'))}</p>
    </div>
  `;
  const $ = (s) => pane.querySelector(s);
  const S = { shape: 'cube', photos: [], stPhoto: null, stPair: null, busy: false };
  const shape = () => SHAPES[S.shape];
  // снимки по слотове: празните вземат първата налична
  function imgs() { const first = S.photos.find((p) => p) || null; return shape().slots.map((_, i) => S.photos[i] || first); }
  function hasPhoto() { return !!S.photos.find((p) => p); }
  function slotLabel(k) { const [key, arg] = k.split(':'); return arg ? tf(key, arg) : t(key); }
  function sizeMm() { const v = Number($('#ppsize').value) || 50; return Math.max(30, Math.min(150, v)); }

  // ── под-табове ──
  const subs = { fig: $('#ppFig'), prev: $('#ppPrev'), sheet: $('#ppSheet'), st: $('#ppSt') };
  function showSub(id) {
    pane.querySelectorAll('#ppsub .tab').forEach((b) => b.classList.toggle('active', b.dataset.sub === id));
    for (const k in subs) subs[k].style.display = k === id ? '' : 'none';
    if (id === 'prev') refreshPreview();
    if (id === 'sheet') refreshSheet();
    if (id === 'st') refreshStereo();
  }
  pane.querySelectorAll('#ppsub .tab').forEach((b) => b.addEventListener('click', () => showSub(b.dataset.sub)));

  // ── Фигура ──
  function paintSlots() {
    const box = $('#ppslots');
    box.innerHTML = shape().slots.map((k, i) => `
      <div data-slot="${i}" style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg);cursor:pointer;position:relative">
        <div style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:var(--bg-3);overflow:hidden">
          ${S.photos[i] ? `<img src="${S.photos[i].toDataURL('image/jpeg', 0.7)}" style="width:100%;height:100%;object-fit:cover" alt="" />` : '<span style="font-size:1.8em;opacity:.6">＋</span>'}
        </div>
        <div style="font-size:.78em;padding:5px 6px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>${i + 1}</b> · ${esc(slotLabel(k))}</div>
        ${S.photos[i] ? `<button data-rm="${i}" style="position:absolute;top:4px;right:4px;border:none;border-radius:50%;width:24px;height:24px;background:rgba(0,0,0,.6);color:#fff;cursor:pointer">×</button>` : ''}
      </div>`).join('');
    box.querySelectorAll('[data-slot]').forEach((el) => el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-rm]')) return;
      try { const p = await pickPhoto(); if (p) { S.photos[Number(el.dataset.slot)] = p; paintSlots(); } } catch (err) { flash(String(err.message || err), true); }
    }));
    box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); S.photos[Number(b.dataset.rm)] = null; paintSlots(); }));
  }
  $('#ppshape').addEventListener('change', (e) => { S.shape = e.target.value; paintSlots(); });
  $('#ppclear').addEventListener('click', () => { S.photos = []; paintSlots(); });
  paintSlots();

  // ── Преглед 3D ──
  const cv = $('#ppcv'); cv.width = 900; cv.height = 900;
  const P = makePreview(cv);
  if (!P) $('#ppstage').innerHTML = `<div class="hint" style="padding:20px">${esc(t('r3_nogl'))}</div>`;
  function refreshPreview() {
    if (!P) return;
    const a = sizeMm(), at = buildAtlas(shape(), a, imgs());
    P.setMesh(buildMesh(shape(), a, at.regions), at.canvas); P.reset();
    if (!hasPhoto()) flash(t('pp_no_photo'), true); else flash('');
  }
  let drag = null, spinning = false, raf = 0, lastT = 0;
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || !P) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    P.rotate(0, 1, 0, dx * 0.011); P.rotate(1, 0, 0, dy * 0.011);
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  function spinFrame(ts) { if (!spinning) { raf = 0; return; } if (!lastT) lastT = ts; const dt = Math.min((ts - lastT) / 1000, 0.05); lastT = ts; P.rotate(0, 1, 0, 0.7 * dt); raf = requestAnimationFrame(spinFrame); }
  $('#ppspin').addEventListener('click', () => { if (!P) return; spinning = !spinning; lastT = 0; $('#ppspin').style.background = spinning ? '#2f7d32' : ''; if (spinning && !raf) raf = requestAnimationFrame(spinFrame); });
  $('#ppreset').addEventListener('click', () => P && P.reset());
  $('#ppsaveview').addEventListener('click', async () => { if (!P) return; if (!hasPhoto()) { flash(t('pp_no_photo'), true); return; } P.draw(); await savePng(cv, 'pupikes-paper3d-view-' + Date.now() + '.png'); flash(tf('r3_saved', 'PNG')); });

  // ── Лист за печат ──
  function instructionLines() {
    const extra = { lant: 'pp_ins_lant', pop: 'pp_ins_pop', stand: 'pp_ins_stand', box: 'pp_ins_box' }[S.shape];
    const L = [t('pp_ins_1'), t('pp_ins_2'), t('pp_ins_3'), t('pp_ins_4')]; if (extra) L.push(t(extra)); return L;
  }
  // Подредба: колко шаблона се побират. Пробва шаблона и завъртян на 90° (широките разгъвки — куб, фенер —
  // лягат по дължината на листа); ако и така не се побира, размерът се смалява до побиране.
  function layout(pageKey, copies) {
    const [pw, ph] = PAGES[pageKey] || PAGES.A4, availW = pw - 2 * MARGIN, availH = ph - 2 * MARGIN - FOOTER;
    const want = sizeMm();
    function attempt(rot) {
      let a = want, net = shape().net(a), bb = netBounds(net), reduced = false;
      const dims = (b) => rot ? [b.h, b.w] : [b.w, b.h];
      for (let k = 0; k < 3; k++) {
        const [w, h] = dims(bb); if (w <= availW && h <= availH) break;
        a = Math.max(20, Math.floor(a * Math.min(availW / w, availH / h) * 0.97)); net = shape().net(a); bb = netBounds(net); reduced = true;
      }
      const [w, h] = dims(bb);
      const cols = Math.max(1, Math.floor((availW + GAP) / (w + GAP))), rows = Math.max(1, Math.floor((availH + GAP) / (h + GAP)));
      const per = cols * rows;
      return { a, net, bb, w, h, cols, rows, per, pages: Math.max(1, Math.ceil(copies / per)), reduced, rot, pw, ph };
    }
    const A = attempt(false), B = attempt(true);
    if (A.a !== B.a) return A.a > B.a ? A : B;           // по-големият реален размер печели
    return B.per > A.per ? B : A;                        // при равен размер — повече фигури на лист
  }
  function paintPages(pageKey, dpi, copies, L) {
    const im = imgs(), title = 'Pupikes Paper 3D · ' + t(shape().key) + ' · ' + L.a + ' mm', lines = instructionLines(), to = t('pp_tab_to');
    return renderPages(pageKey, dpi, L.pages, (ctx, pw, ph, p) => {
      for (let k = 0; k < L.per; k++) {
        const n = p * L.per + k; if (n >= copies) break;
        const col = k % L.cols, row = Math.floor(k / L.cols), px = MARGIN + col * (L.w + GAP), py = MARGIN + row * (L.h + GAP);
        if (L.rot) { // завъртян на 90° по часовниковата стрелка: заема (bb.h × bb.w)
          ctx.save(); ctx.translate(px + L.bb.h, py); ctx.rotate(Math.PI / 2);
          drawNet(ctx, L.net, -L.bb.x0, -L.bb.y0, im, { tabWord: to }); ctx.restore();
        } else drawNet(ctx, L.net, px - L.bb.x0, py - L.bb.y0, im, { tabWord: to });
      }
      drawFooter(ctx, pw, ph, title + (L.pages > 1 ? ' · ' + (p + 1) + '/' + L.pages : ''), lines);
    });
  }
  let sheetTimer = 0;
  function refreshSheet() {
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(() => {
      const pageKey = $('#pppage').value, copies = Math.max(1, Math.min(20, Number($('#ppcopies').value) || 1));
      const L = layout(pageKey, copies);
      $('#ppfits').textContent = tf('pp_fits', L.per, L.pages, Math.round(L.w), Math.round(L.h)) + (L.reduced ? ' — ' + tf('pp_too_big', L.a) : '');
      const prev = paintPages(pageKey, 60, 1, L)[0]; prev.style.width = '100%'; prev.style.display = 'block';
      $('#ppsheetprev').innerHTML = ''; $('#ppsheetprev').appendChild(prev);
      $('#ppins').innerHTML = `<div style="font-weight:700;margin-bottom:4px">${esc(t('pp_ins_title'))}</div>` + instructionLines().map((s) => `<div style="font-size:.9em;padding:2px 0">${esc(s)}</div>`).join('');
      if (!hasPhoto()) flash(t('pp_no_photo'), true);
    }, 60);
  }
  ['#pppage', '#ppcopies'].forEach((s) => $(s).addEventListener('change', refreshSheet));
  $('#ppsize').addEventListener('change', () => { if (subs.sheet.style.display !== 'none') refreshSheet(); });
  async function exportSheet(kind) {
    if (S.busy) return; if (!hasPhoto()) { flash(t('pp_no_photo'), true); return; }
    S.busy = true;
    try {
      const pageKey = $('#pppage').value, dpi = Number($('#ppdpi').value) || 300, copies = Math.max(1, Math.min(20, Number($('#ppcopies').value) || 1));
      const L = layout(pageKey, copies); flash(t('pp_working')); await tick();
      const pages = paintPages(pageKey, dpi, copies, L), stamp = Date.now();
      if (kind === 'pdf') { await savePdf(pages, pageKey, 'pupikes-paper3d-' + S.shape + '-' + stamp + '.pdf'); flash(tf('r3_saved', 'PDF')); }
      else { for (let i = 0; i < pages.length; i++) { flash(tf('pp_page_prog', i + 1, pages.length)); await tick(); await savePng(pages[i], 'pupikes-paper3d-' + S.shape + '-' + stamp + (pages.length > 1 ? '-' + (i + 1) : '') + '.png'); } flash(tf('r3_saved', 'PNG')); }
    } catch (e) { flash(String(e.message || e), true); }
    S.busy = false;
  }
  $('#pppng').addEventListener('click', () => exportSheet('png'));
  $('#pppdf').addEventListener('click', () => exportSheet('pdf'));

  // ── Стерео карта ──
  let stTimer = 0, stOut = null;
  function stSource() { return S.stPhoto || S.photos.find((p) => p) || null; }
  function refreshStereo() {
    clearTimeout(stTimer);
    stTimer = setTimeout(() => {
      const src = stSource(); const box = $('#ppstprev'); box.innerHTML = '';
      if (!src) { S.stPair = null; stOut = null; flash(t('pp_no_photo'), true); return; }
      S.stPair = stereoPair(src, Number($('#ppstdepth').value) || 2);
      stOut = composeStereo(S.stPair, $('#ppstmode').value); stOut.style.width = '100%'; stOut.style.display = 'block'; box.appendChild(stOut); flash('');
    }, 60);
  }
  $('#ppstpick').addEventListener('click', async () => { try { const p = await pickPhoto(); if (p) { S.stPhoto = p; refreshStereo(); } } catch (e) { flash(String(e.message || e), true); } });
  $('#ppstmode').addEventListener('change', refreshStereo); $('#ppstdepth').addEventListener('change', refreshStereo);
  $('#ppstsave').addEventListener('click', async () => { if (!stOut) { flash(t('pp_no_photo'), true); return; } await savePng(stOut, 'pupikes-stereo-' + $('#ppstmode').value + '-' + Date.now() + '.png'); flash(tf('r3_saved', 'PNG')); });
  // Стерео картичка на лист: двойка по 62 mm (центрове на 65 mm — успореден поглед) + анаглиф 100 mm + бележка.
  $('#ppstsheet').addEventListener('click', async () => {
    if (S.busy) return; if (!S.stPair) { flash(t('pp_no_photo'), true); return; } S.busy = true;
    try {
      flash(t('pp_working')); await tick();
      const pageKey = $('#pppage').value, pair = S.stPair, ana = composeStereo(pair, 'ana'), asp = pair.H / pair.W;
      const pages = renderPages(pageKey, 300, 1, (ctx, pw, ph) => {
        const w = 62, g = 3, x = (pw - 2 * w - g) / 2, y = MARGIN + 6, h = w * asp;
        ctx.fillStyle = INK; ctx.font = 'bold 3.5px sans-serif'; ctx.textBaseline = 'top'; ctx.fillText('Pupikes Paper 3D · ' + t('pp_sub_stereo'), MARGIN, MARGIN);
        ctx.drawImage(pair.left, x, y, w, h); ctx.drawImage(pair.right, x + w + g, y, w, h);
        ctx.strokeStyle = INK; ctx.lineWidth = 0.3; ctx.setLineDash([1.6, 1.1]); ctx.strokeRect(x - 4, y - 4, 2 * w + g + 8, h + 8); ctx.setLineDash([]);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + w / 2, y + 3, 1, 0, Math.PI * 2); ctx.arc(x + w + g + w / 2, y + 3, 1, 0, Math.PI * 2); ctx.fill();
        const aw = Math.min(100, pw - 2 * MARGIN), ax = (pw - aw) / 2, ay = y + h + 16, ah = aw * asp;
        if (ay + ah < ph - MARGIN - FOOTER) { ctx.drawImage(ana, ax, ay, aw, ah); ctx.setLineDash([1.6, 1.1]); ctx.strokeRect(ax - 4, ay - 4, aw + 8, ah + 8); ctx.setLineDash([]); }
        drawFooter(ctx, pw, ph, 'Pupikes Paper 3D · ' + t('pp_sub_stereo'), [t('pp_st_note'), t('pp_ins_1')]);
      });
      await savePdf(pages, pageKey, 'pupikes-stereo-card-' + Date.now() + '.pdf'); flash(tf('r3_saved', 'PDF'));
    } catch (e) { flash(String(e.message || e), true); }
    S.busy = false;
  });

  return { activate() { showSub('fig'); }, getFirstPhoto: () => S.photos.find((p) => p) || null };
}
