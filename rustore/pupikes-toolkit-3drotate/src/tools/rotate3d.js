// Version: 1.0021
// rotate3d.js — Pupikes Paper 3D (Toolkit 3D Rotate). ГЛАВЕН ЕКРАН = „Хартиен 3D" (r3-paper.js): от снимка до
// предмет в ръката — шаблон за печат на хартиена 3D фигура (куб, пирамида, кутия с капак, фото-фенер, стойка,
// картичка с обем) с линии за сгъване, езичета и инструкции; 3D преглед на сглобената фигура; лист A4/Letter
// (PNG/PDF); стерео карта от една снимка. Старите функции остават като следващи табове.
// Общият WebGL двигател (mat4/кватернион/шейдъри) е в r3-gl.js.
//
// (по-старо) Зарежда картинка и я върти в 3D през WebGL.
// 4 оси; ЗАДЪРЖАНЕ на бутон = бавно въртене в реално време, ПУСКАНЕ = спира. „Запази" → PNG.
// Всичко на устройството — картинката не се качва никъде.
//
// РЕЖИМИ на обем (по искане — картинката да не изглежда като лист хартия):
//   • Плоско  — плосък quad (както досега).
//   • Обем (Метод 1) — картинката се ИЗДЪЛБАВА в плочка с дебелина: лице + гръб + странични
//                       ръбове (цвят = средният цвят на снимката) → има реален обем при въртене.
//   • Релеф (Метод 2) — от яркостта на снимката се гради КАРТА НА ВИСОЧИНИТЕ (по-светлото
//                       изпъква) → истински 3D релеф със сенки; при въртене се вижда обемът.
//
// Въртенето се пази като КВАТЕРНИОН (нормализира се всеки кадър) → няма натрупване на грешка,
// осите остават точни колкото и да въртиш (по-рано матрицата „плуваше" след много въртения).
//
// ОБОГАТЯВАНЕ (Huawei 4.3, 09.09.2026) — вече не е „фото редактор", а 3D работилница за снимки:
//   • Табове (v1.0021): „Хартиен 3D" (главен) | „3D" | „Изправяне" | „360°" | „Пакет".
//   • МАКЕТИ (3D): снимката като картичка (полароид), екран на телефон, кутия, картина в рамка —
//     композират се в текстурата + дебелина/цвят на ръбовете; + падаща СЯНКА върху стена зад обекта.
//   • ТОЧНИ ЪГЛИ: стъпка 5°/15°/30°/45°/90° по двете главни оси (докосване = точно завъртане).
//   • ПРЕСЕТИ: вградени изгледи (изометрия, наляво, надясно, отгоре, гръб) + свои запазени ъгли
//     (име + ориентация + обем + макет + сянка; в localStorage).
//   • ИЗПРАВЯНЕ (r3-straighten.js): 4 ъгъла с влачене → изравнен документ/дъска/фасада; преди/след.
//   • 360° (r3-gif.js): въртящ се продукт — N кадъра около ос → анимиран GIF или лента от кадри PNG.
//   • ПАКЕТ: много снимки, една и съща настройка (ъгъл/обем/макет/сянка) → PNG/JPG за всяка.
import { t, tf, register } from '../core/i18n.js';
import { pickBinaryFile } from '../core/filepick.js';
import { saveFile } from '../core/filesave.js';
import { encodeGif } from './r3-gif.js';
import { mountStraighten } from './r3-straighten.js';
import { mountPaper } from './r3-paper.js';
import { mMul, mPerspective, mTranslate, mScale, qIdent, qNorm, qMul, qRotateWorld, qMat, VERT, FRAG, compile } from './r3-gl.js';

register({
  r3_pick:       { bg:'Избери изображение', ru:'Выберите изображение', uk:'Виберіть зображення', en:'Choose an image', de:'Bild auswählen', fr:'Choisir une image', es:'Elegir imagen', 'es-MX':'Elegir imagen', it:'Scegli un’immagine', pt:'Escolher imagem', ar:'اختر صورة', hi:'छवि चुनें', ja:'画像を選択', ky:'Сүрөт тандаңыз', 'zh-Hant':'選擇圖片' },
  r3_hint:       { bg:'Задръж бутон за ос — картинката се върти бавно; пусни — спира. Всичко става на устройството.', ru:'Удерживай ось — изображение медленно вращается; отпусти — остановится. Всё на устройстве.', uk:'Утримуй вісь — зображення повільно обертається; відпусти — зупиниться. Усе на пристрої.', en:'Hold an axis to rotate slowly; release to stop. Everything runs on your device.', de:'Achse gedrückt halten — das Bild dreht sich langsam; loslassen — es stoppt. Alles auf dem Gerät.', fr:'Maintiens un axe — l’image tourne lentement ; relâche pour arrêter. Tout se passe sur l’appareil.', es:'Mantén un eje — la imagen gira despacio; suelta para parar. Todo en el dispositivo.', 'es-MX':'Mantén un eje — la imagen gira despacio; suelta para parar. Todo en el dispositivo.', it:'Tieni premuto un asse — l’immagine ruota lentamente; rilascia per fermarla. Tutto sul dispositivo.', pt:'Mantém um eixo — a imagem gira devagar; solta para parar. Tudo no dispositivo.', ar:'اضغط مع الاستمرار على محور — تدور الصورة ببطء؛ اترك لتتوقف. كل شيء على جهازك.', hi:'किसी अक्ष को दबाए रखें — छवि धीरे घूमती है; छोड़ें तो रुक जाती है। सब कुछ डिवाइस पर।', ja:'軸を押し続けると画像がゆっくり回転、離すと停止。すべて端末上で動作。', ky:'Октту басып тур — сүрөт жай айланат; кое бер — токтойт. Баары түзмөктө.', 'zh-Hant':'按住某個軸，圖片會緩慢旋轉；放開即停止。全部在裝置上執行。' },
  r3_axis_h:     { bg:'Хоризонтална ос', ru:'Горизонтальная ось', uk:'Горизонтальна вісь', en:'Horizontal axis', de:'Horizontale Achse', fr:'Axe horizontal', es:'Eje horizontal', 'es-MX':'Eje horizontal', it:'Asse orizzontale', pt:'Eixo horizontal', ar:'محور أفقي', hi:'क्षैतिज अक्ष', ja:'水平軸', ky:'Горизонталдык ок', 'zh-Hant':'水平軸' },
  r3_axis_v:     { bg:'Вертикална ос', ru:'Вертикальная ось', uk:'Вертикальна вісь', en:'Vertical axis', de:'Vertikale Achse', fr:'Axe vertical', es:'Eje vertical', 'es-MX':'Eje vertical', it:'Asse verticale', pt:'Eixo vertical', ar:'محور رأسي', hi:'ऊर्ध्वाधर अक्ष', ja:'垂直軸', ky:'Вертикалдык ок', 'zh-Hant':'垂直軸' },
  r3_axis_28:    { bg:'Ос 2–8 ч.', ru:'Ось 2–8 ч.', uk:'Вісь 2–8 год.', en:'2–8 o’clock axis', de:'Achse 2–8 Uhr', fr:'Axe 2–8 h', es:'Eje 2–8 h', 'es-MX':'Eje 2–8 h', it:'Asse 2–8', pt:'Eixo 2–8 h', ar:'محور 2–8', hi:'2–8 बजे अक्ष', ja:'2–8時の軸', ky:'2–8 саат огу', 'zh-Hant':'2–8 點軸' },
  r3_axis_104:   { bg:'Ос 10–4 ч.', ru:'Ось 10–4 ч.', uk:'Вісь 10–4 год.', en:'10–4 o’clock axis', de:'Achse 10–4 Uhr', fr:'Axe 10–4 h', es:'Eje 10–4 h', 'es-MX':'Eje 10–4 h', it:'Asse 10–4', pt:'Eixo 10–4 h', ar:'محور 10–4', hi:'10–4 बजे अक्ष', ja:'10–4時の軸', ky:'10–4 саат огу', 'zh-Hant':'10–4 點軸' },
  r3_reset:      { bg:'Нулирай', ru:'Сбросить', uk:'Скинути', en:'Reset', de:'Zurücksetzen', fr:'Réinitialiser', es:'Restablecer', 'es-MX':'Restablecer', it:'Reimposta', pt:'Repor', ar:'إعادة تعيين', hi:'रीसेट', ja:'リセット', ky:'Баштапкы абалга', 'zh-Hant':'重設' },
  r3_save:       { bg:'Запази', ru:'Сохранить', uk:'Зберегти', en:'Save', de:'Speichern', fr:'Enregistrer', es:'Guardar', 'es-MX':'Guardar', it:'Salva', pt:'Guardar', ar:'حفظ', hi:'सहेजें', ja:'保存', ky:'Сактоо', 'zh-Hant':'儲存' },
  r3_pick_first: { bg:'Първо избери изображение.', ru:'Сначала выберите изображение.', uk:'Спершу виберіть зображення.', en:'Choose an image first.', de:'Wähle zuerst ein Bild.', fr:'Choisis d’abord une image.', es:'Primero elige una imagen.', 'es-MX':'Primero elige una imagen.', it:'Scegli prima un’immagine.', pt:'Escolhe primeiro uma imagem.', ar:'اختر صورة أولاً.', hi:'पहले एक छवि चुनें।', ja:'まず画像を選択してください。', ky:'Адегенде сүрөт тандаңыз.', 'zh-Hant':'請先選擇圖片。' },
  r3_saved:      { bg:'Запазено ({0})', ru:'Сохранено ({0})', uk:'Збережено ({0})', en:'Saved ({0})', de:'Gespeichert ({0})', fr:'Enregistré ({0})', es:'Guardado ({0})', 'es-MX':'Guardado ({0})', it:'Salvato ({0})', pt:'Guardado ({0})', ar:'تم الحفظ ({0})', hi:'सहेजा गया ({0})', ja:'保存しました（{0}）', ky:'Сакталды ({0})', 'zh-Hant':'已儲存（{0}）' },
  r3_nogl:       { bg:'WebGL не се поддържа тук.', ru:'WebGL здесь не поддерживается.', uk:'WebGL тут не підтримується.', en:'WebGL is not supported here.', de:'WebGL wird hier nicht unterstützt.', fr:'WebGL n’est pas pris en charge ici.', es:'WebGL no es compatible aquí.', 'es-MX':'WebGL no es compatible aquí.', it:'WebGL non è supportato qui.', pt:'WebGL não é suportado aqui.', ar:'WebGL غير مدعوم هنا.', hi:'यहाँ WebGL समर्थित नहीं है।', ja:'ここではWebGLがサポートされていません。', ky:'Бул жерде WebGL колдоого алынбайт.', 'zh-Hant':'此處不支援 WebGL。' },
  r3_mode:       { bg:'Обем', ru:'Объём', uk:'Обʼєм', en:'Depth', de:'Tiefe', fr:'Volume', es:'Volumen', 'es-MX':'Volumen', it:'Volume', pt:'Volume', ar:'العمق', hi:'गहराई', ja:'立体', ky:'Көлөм', 'zh-Hant':'立體' },
  r3_mode_flat:  { bg:'Плоско', ru:'Плоско', uk:'Плоско', en:'Flat', de:'Flach', fr:'Plat', es:'Plano', 'es-MX':'Plano', it:'Piatto', pt:'Plano', ar:'مسطّح', hi:'सपाट', ja:'平面', ky:'Түз', 'zh-Hant':'平面' },
  r3_mode_slab:  { bg:'Обем', ru:'Объём', uk:'Обʼєм', en:'Volume', de:'Volumen', fr:'Volume', es:'Volumen', 'es-MX':'Volumen', it:'Volume', pt:'Volume', ar:'حجم', hi:'आयतन', ja:'厚み', ky:'Көлөм', 'zh-Hant':'厚度' },
  r3_mode_relief:{ bg:'Релеф', ru:'Рельеф', uk:'Рельєф', en:'Relief', de:'Relief', fr:'Relief', es:'Relieve', 'es-MX':'Relieve', it:'Rilievo', pt:'Relevo', ar:'نتوء', hi:'उभार', ja:'レリーフ', ky:'Рельеф', 'zh-Hant':'浮雕' },
  // ── табове ──
  r3_tab_paper:  { bg:'Хартиен 3D', ru:'Бумажное 3D', uk:'Паперове 3D', en:'Paper 3D', de:'Papier-3D', fr:'Papier 3D', es:'Papel 3D', 'es-MX':'Papel 3D', it:'Carta 3D', pt:'Papel 3D', ar:'ورق ثلاثي الأبعاد', hi:'पेपर 3D', ja:'ペーパー3D', ky:'Кагаз 3D', 'zh-Hant':'紙藝 3D' },
  r3_tab_3d:     { bg:'3D', ru:'3D', uk:'3D', en:'3D', de:'3D', fr:'3D', es:'3D', 'es-MX':'3D', it:'3D', pt:'3D', ar:'3D', hi:'3D', ja:'3D', ky:'3D', 'zh-Hant':'3D' },
  r3_tab_str:    { bg:'Изправяне', ru:'Выравнивание', uk:'Вирівнювання', en:'Straighten', de:'Begradigen', fr:'Redresser', es:'Enderezar', 'es-MX':'Enderezar', it:'Raddrizza', pt:'Endireitar', ar:'تقويم', hi:'सीधा करें', ja:'補正', ky:'Түздөө', 'zh-Hant':'校正' },
  r3_tab_360:    { bg:'360°', ru:'360°', uk:'360°', en:'360°', de:'360°', fr:'360°', es:'360°', 'es-MX':'360°', it:'360°', pt:'360°', ar:'360°', hi:'360°', ja:'360°', ky:'360°', 'zh-Hant':'360°' },
  r3_tab_batch:  { bg:'Пакет', ru:'Пакет', uk:'Пакет', en:'Batch', de:'Stapel', fr:'Lot', es:'Lote', 'es-MX':'Lote', it:'Serie', pt:'Lote', ar:'دفعة', hi:'बैच', ja:'一括', ky:'Топ', 'zh-Hant':'批次' },
  // ── макети + сянка ──
  r3_mockup:     { bg:'Макет', ru:'Макет', uk:'Макет', en:'Mockup', de:'Mockup', fr:'Maquette', es:'Maqueta', 'es-MX':'Maqueta', it:'Mockup', pt:'Maquete', ar:'نموذج', hi:'मॉकअप', ja:'モックアップ', ky:'Макет', 'zh-Hant':'樣機' },
  r3_mk_none:    { bg:'Без', ru:'Нет', uk:'Немає', en:'None', de:'Keins', fr:'Aucune', es:'Ninguna', 'es-MX':'Ninguna', it:'Nessuno', pt:'Nenhuma', ar:'بدون', hi:'कोई नहीं', ja:'なし', ky:'Жок', 'zh-Hant':'無' },
  r3_mk_card:    { bg:'Картичка', ru:'Карточка', uk:'Картка', en:'Card', de:'Karte', fr:'Carte', es:'Tarjeta', 'es-MX':'Tarjeta', it:'Cartolina', pt:'Cartão', ar:'بطاقة', hi:'कार्ड', ja:'カード', ky:'Карточка', 'zh-Hant':'卡片' },
  r3_mk_phone:   { bg:'Телефон', ru:'Телефон', uk:'Телефон', en:'Phone', de:'Handy', fr:'Téléphone', es:'Teléfono', 'es-MX':'Teléfono', it:'Telefono', pt:'Telemóvel', ar:'هاتف', hi:'फ़ोन', ja:'スマホ', ky:'Телефон', 'zh-Hant':'手機' },
  r3_mk_box:     { bg:'Кутия', ru:'Коробка', uk:'Коробка', en:'Box', de:'Box', fr:'Boîte', es:'Caja', 'es-MX':'Caja', it:'Scatola', pt:'Caixa', ar:'صندوق', hi:'बॉक्स', ja:'ボックス', ky:'Куту', 'zh-Hant':'盒子' },
  r3_mk_frame:   { bg:'Рамка', ru:'Рамка', uk:'Рамка', en:'Frame', de:'Rahmen', fr:'Cadre', es:'Marco', 'es-MX':'Marco', it:'Cornice', pt:'Moldura', ar:'إطار', hi:'फ़्रेम', ja:'額縁', ky:'Рамка', 'zh-Hant':'畫框' },
  r3_shadow:     { bg:'Сянка', ru:'Тень', uk:'Тінь', en:'Shadow', de:'Schatten', fr:'Ombre', es:'Sombra', 'es-MX':'Sombra', it:'Ombra', pt:'Sombra', ar:'ظل', hi:'छाया', ja:'影', ky:'Көлөкө', 'zh-Hant':'陰影' },
  // ── точни ъгли + пресети ──
  r3_step:       { bg:'Точна стъпка', ru:'Точный шаг', uk:'Точний крок', en:'Exact step', de:'Genauer Schritt', fr:'Pas exact', es:'Paso exacto', 'es-MX':'Paso exacto', it:'Passo esatto', pt:'Passo exato', ar:'خطوة دقيقة', hi:'सटीक चरण', ja:'角度ステップ', ky:'Так кадам', 'zh-Hant':'精確步進' },
  r3_presets:    { bg:'Пресети за ъгъл', ru:'Пресеты угла', uk:'Пресети кута', en:'Angle presets', de:'Winkel-Presets', fr:'Préréglages d’angle', es:'Ajustes de ángulo', 'es-MX':'Ajustes de ángulo', it:'Preset di angolo', pt:'Predefinições de ângulo', ar:'زوايا محفوظة', hi:'कोण प्रीसेट', ja:'角度プリセット', ky:'Бурч пресеттери', 'zh-Hant':'角度預設' },
  r3_pre_name:   { bg:'Име на пресета', ru:'Имя пресета', uk:'Назва пресета', en:'Preset name', de:'Preset-Name', fr:'Nom du préréglage', es:'Nombre del ajuste', 'es-MX':'Nombre del ajuste', it:'Nome del preset', pt:'Nome da predefinição', ar:'اسم الإعداد', hi:'प्रीसेट का नाम', ja:'プリセット名', ky:'Пресет аты', 'zh-Hant':'預設名稱' },
  r3_pre_save:   { bg:'Запази ъгъла', ru:'Сохранить угол', uk:'Зберегти кут', en:'Save angle', de:'Winkel speichern', fr:'Enregistrer l’angle', es:'Guardar ángulo', 'es-MX':'Guardar ángulo', it:'Salva angolo', pt:'Guardar ângulo', ar:'حفظ الزاوية', hi:'कोण सहेजें', ja:'角度を保存', ky:'Бурчту сактоо', 'zh-Hant':'儲存角度' },
  r3_pre_iso:    { bg:'Изометрия', ru:'Изометрия', uk:'Ізометрія', en:'Isometric', de:'Isometrisch', fr:'Isométrique', es:'Isométrico', 'es-MX':'Isométrico', it:'Isometrico', pt:'Isométrico', ar:'متساوي القياس', hi:'आइसोमेट्रिक', ja:'アイソメ', ky:'Изометрия', 'zh-Hant':'等軸' },
  r3_pre_left:   { bg:'Наляво', ru:'Влево', uk:'Вліво', en:'Left tilt', de:'Links', fr:'Gauche', es:'Izquierda', 'es-MX':'Izquierda', it:'Sinistra', pt:'Esquerda', ar:'يسار', hi:'बाएँ', ja:'左傾き', ky:'Солго', 'zh-Hant':'左傾' },
  r3_pre_right:  { bg:'Надясно', ru:'Вправо', uk:'Вправо', en:'Right tilt', de:'Rechts', fr:'Droite', es:'Derecha', 'es-MX':'Derecha', it:'Destra', pt:'Direita', ar:'يمين', hi:'दाएँ', ja:'右傾き', ky:'Оңго', 'zh-Hant':'右傾' },
  r3_pre_top:    { bg:'Отгоре', ru:'Сверху', uk:'Зверху', en:'From above', de:'Von oben', fr:'Du dessus', es:'Desde arriba', 'es-MX':'Desde arriba', it:'Dall’alto', pt:'De cima', ar:'من الأعلى', hi:'ऊपर से', ja:'上から', ky:'Үстүнөн', 'zh-Hant':'俯視' },
  r3_pre_back:   { bg:'Гръб', ru:'Обратная сторона', uk:'Зворот', en:'Back side', de:'Rückseite', fr:'Verso', es:'Reverso', 'es-MX':'Reverso', it:'Retro', pt:'Verso', ar:'الخلف', hi:'पीछे', ja:'裏面', ky:'Арткы бет', 'zh-Hant':'背面' },
  // ── 360° ──
  r3_360_hint:   { bg:'Въртящ се продукт от една снимка: кадри около ос от текущия ъгъл → анимиран GIF или лента от кадри. Всичко на устройството.', ru:'Вращающийся продукт из одного фото: кадры вокруг оси от текущего угла → анимированный GIF или лента кадров. Всё на устройстве.', uk:'Обертовий продукт з одного фото: кадри навколо осі від поточного кута → анімований GIF або стрічка кадрів. Усе на пристрої.', en:'Spinning product from one photo: frames around an axis from the current angle → animated GIF or a frame strip. Everything on your device.', de:'Drehendes Produkt aus einem Foto: Bilder um eine Achse ab dem aktuellen Winkel → animiertes GIF oder Bildstreifen. Alles auf dem Gerät.', fr:'Produit en rotation à partir d’une photo : images autour d’un axe depuis l’angle actuel → GIF animé ou bande d’images. Tout sur l’appareil.', es:'Producto giratorio desde una foto: fotogramas alrededor de un eje desde el ángulo actual → GIF animado o tira de fotogramas. Todo en el dispositivo.', 'es-MX':'Producto giratorio desde una foto: cuadros alrededor de un eje desde el ángulo actual → GIF animado o tira de cuadros. Todo en el dispositivo.', it:'Prodotto rotante da una foto: fotogrammi attorno a un asse dall’angolo attuale → GIF animata o striscia di fotogrammi. Tutto sul dispositivo.', pt:'Produto giratório a partir de uma foto: quadros à volta de um eixo desde o ângulo atual → GIF animado ou tira de quadros. Tudo no dispositivo.', ar:'منتج دوّار من صورة واحدة: إطارات حول محور بدءًا من الزاوية الحالية ← GIF متحرك أو شريط إطارات. كل شيء على جهازك.', hi:'एक फ़ोटो से घूमता उत्पाद: वर्तमान कोण से किसी अक्ष के चारों ओर फ़्रेम → एनिमेटेड GIF या फ़्रेम पट्टी। सब कुछ डिवाइस पर।', ja:'1枚の写真から回転する商品: 現在の角度から軸周りにコマ撮り → アニメGIFまたはコマの帯。すべて端末上で。', ky:'Бир сүрөттөн айланган продукт: учурдагы бурчтан ок боюнча кадрлар → анимациялуу GIF же кадрлар тилкеси. Баары түзмөктө.', 'zh-Hant':'用一張照片做旋轉商品：從目前角度繞軸產生多格畫面 → 動態 GIF 或畫面條。全部在裝置上。' },
  r3_360_axis:   { bg:'Ос на въртене', ru:'Ось вращения', uk:'Вісь обертання', en:'Rotation axis', de:'Drehachse', fr:'Axe de rotation', es:'Eje de giro', 'es-MX':'Eje de giro', it:'Asse di rotazione', pt:'Eixo de rotação', ar:'محور الدوران', hi:'घूर्णन अक्ष', ja:'回転軸', ky:'Айлануу огу', 'zh-Hant':'旋轉軸' },
  r3_360_frames: { bg:'Кадри', ru:'Кадры', uk:'Кадри', en:'Frames', de:'Bilder', fr:'Images', es:'Fotogramas', 'es-MX':'Cuadros', it:'Fotogrammi', pt:'Quadros', ar:'الإطارات', hi:'फ़्रेम', ja:'コマ数', ky:'Кадрлар', 'zh-Hant':'畫格數' },
  r3_360_size:   { bg:'Размер (px)', ru:'Размер (px)', uk:'Розмір (px)', en:'Size (px)', de:'Größe (px)', fr:'Taille (px)', es:'Tamaño (px)', 'es-MX':'Tamaño (px)', it:'Dimensione (px)', pt:'Tamanho (px)', ar:'الحجم (بكسل)', hi:'आकार (px)', ja:'サイズ (px)', ky:'Өлчөм (px)', 'zh-Hant':'尺寸 (px)' },
  r3_360_delay:  { bg:'Пауза между кадрите (ms)', ru:'Пауза между кадрами (мс)', uk:'Пауза між кадрами (мс)', en:'Delay between frames (ms)', de:'Pause zwischen Bildern (ms)', fr:'Délai entre images (ms)', es:'Pausa entre fotogramas (ms)', 'es-MX':'Pausa entre cuadros (ms)', it:'Pausa tra fotogrammi (ms)', pt:'Pausa entre quadros (ms)', ar:'التأخير بين الإطارات (مللي ثانية)', hi:'फ़्रेम के बीच विलंब (ms)', ja:'コマ間隔 (ms)', ky:'Кадрлар арасы (мс)', 'zh-Hant':'畫格間隔 (ms)' },
  r3_360_bg:     { bg:'Фон', ru:'Фон', uk:'Тло', en:'Background', de:'Hintergrund', fr:'Fond', es:'Fondo', 'es-MX':'Fondo', it:'Sfondo', pt:'Fundo', ar:'الخلفية', hi:'पृष्ठभूमि', ja:'背景', ky:'Фон', 'zh-Hant':'背景' },
  r3_bg_white:   { bg:'Бял', ru:'Белый', uk:'Білий', en:'White', de:'Weiß', fr:'Blanc', es:'Blanco', 'es-MX':'Blanco', it:'Bianco', pt:'Branco', ar:'أبيض', hi:'सफ़ेद', ja:'白', ky:'Ак', 'zh-Hant':'白色' },
  r3_bg_black:   { bg:'Черен', ru:'Чёрный', uk:'Чорний', en:'Black', de:'Schwarz', fr:'Noir', es:'Negro', 'es-MX':'Negro', it:'Nero', pt:'Preto', ar:'أسود', hi:'काला', ja:'黒', ky:'Кара', 'zh-Hant':'黑色' },
  r3_bg_none:    { bg:'Прозрачен', ru:'Прозрачный', uk:'Прозорий', en:'Transparent', de:'Transparent', fr:'Transparent', es:'Transparente', 'es-MX':'Transparente', it:'Trasparente', pt:'Transparente', ar:'شفاف', hi:'पारदर्शी', ja:'透明', ky:'Тунук', 'zh-Hant':'透明' },
  r3_360_gif:    { bg:'Анимиран GIF', ru:'Анимированный GIF', uk:'Анімований GIF', en:'Animated GIF', de:'Animiertes GIF', fr:'GIF animé', es:'GIF animado', 'es-MX':'GIF animado', it:'GIF animata', pt:'GIF animado', ar:'GIF متحرك', hi:'एनिमेटेड GIF', ja:'アニメGIF', ky:'Анимациялуу GIF', 'zh-Hant':'動態 GIF' },
  r3_360_strip:  { bg:'Лента от кадри (PNG)', ru:'Лента кадров (PNG)', uk:'Стрічка кадрів (PNG)', en:'Frame strip (PNG)', de:'Bildstreifen (PNG)', fr:'Bande d’images (PNG)', es:'Tira de fotogramas (PNG)', 'es-MX':'Tira de cuadros (PNG)', it:'Striscia di fotogrammi (PNG)', pt:'Tira de quadros (PNG)', ar:'شريط إطارات (PNG)', hi:'फ़्रेम पट्टी (PNG)', ja:'コマの帯 (PNG)', ky:'Кадрлар тилкеси (PNG)', 'zh-Hant':'畫面條 (PNG)' },
  r3_360_prog:   { bg:'Кадър {0} от {1}…', ru:'Кадр {0} из {1}…', uk:'Кадр {0} з {1}…', en:'Frame {0} of {1}…', de:'Bild {0} von {1}…', fr:'Image {0} sur {1}…', es:'Fotograma {0} de {1}…', 'es-MX':'Cuadro {0} de {1}…', it:'Fotogramma {0} di {1}…', pt:'Quadro {0} de {1}…', ar:'الإطار {0} من {1}…', hi:'फ़्रेम {0}/{1}…', ja:'コマ {0}/{1}…', ky:'Кадр {0}/{1}…', 'zh-Hant':'畫格 {0}/{1}…' },
  r3_360_enc:    { bg:'Кодирам GIF…', ru:'Кодирую GIF…', uk:'Кодую GIF…', en:'Encoding GIF…', de:'GIF wird kodiert…', fr:'Encodage du GIF…', es:'Codificando GIF…', 'es-MX':'Codificando GIF…', it:'Codifica GIF…', pt:'A codificar GIF…', ar:'جارٍ ترميز GIF…', hi:'GIF एन्कोड हो रहा…', ja:'GIFを作成中…', ky:'GIF коддолууда…', 'zh-Hant':'GIF 編碼中…' },
  // ── пакет ──
  r3_b_hint:     { bg:'Добави няколко снимки — всяка ще се обработи с ТЕКУЩИТЕ настройки от „3D" (ъгъл, обем, макет, сянка) и ще се запази отделно.', ru:'Добавь несколько фото — каждое обработается с ТЕКУЩИМИ настройками из «3D» (угол, объём, макет, тень) и сохранится отдельно.', uk:'Додай кілька фото — кожне обробиться з ПОТОЧНИМИ налаштуваннями з «3D» (кут, обʼєм, макет, тінь) і збережеться окремо.', en:'Add several photos — each is rendered with the CURRENT “3D” settings (angle, depth, mockup, shadow) and saved separately.', de:'Füge mehrere Fotos hinzu — jedes wird mit den AKTUELLEN „3D“-Einstellungen (Winkel, Tiefe, Mockup, Schatten) gerendert und einzeln gespeichert.', fr:'Ajoute plusieurs photos — chacune est rendue avec les réglages ACTUELS de « 3D » (angle, volume, maquette, ombre) et enregistrée séparément.', es:'Añade varias fotos — cada una se procesa con los ajustes ACTUALES de «3D» (ángulo, volumen, maqueta, sombra) y se guarda por separado.', 'es-MX':'Agrega varias fotos — cada una se procesa con los ajustes ACTUALES de «3D» (ángulo, volumen, maqueta, sombra) y se guarda por separado.', it:'Aggiungi più foto — ognuna viene resa con le impostazioni ATTUALI di «3D» (angolo, volume, mockup, ombra) e salvata separatamente.', pt:'Adiciona várias fotos — cada uma é processada com as definições ATUAIS de «3D» (ângulo, volume, maquete, sombra) e guardada separadamente.', ar:'أضف عدة صور — تُعالج كل واحدة بإعدادات «3D» الحالية (الزاوية، العمق، النموذج، الظل) وتُحفظ على حدة.', hi:'कई फ़ोटो जोड़ें — हर एक “3D” की वर्तमान सेटिंग (कोण, गहराई, मॉकअप, छाया) से बनेगी और अलग सहेजी जाएगी।', ja:'複数の写真を追加 — それぞれ「3D」の現在の設定（角度・立体・モックアップ・影）で描画し、個別に保存します。', ky:'Бир нече сүрөт кош — ар бири «3D» учурдагы жөндөөлөрү (бурч, көлөм, макет, көлөкө) менен иштелип, өзүнчө сакталат.', 'zh-Hant':'加入多張照片 — 每張都以「3D」目前的設定（角度、立體、樣機、陰影）繪製並分別儲存。' },
  r3_b_add:      { bg:'+ Добави снимка', ru:'+ Добавить фото', uk:'+ Додати фото', en:'+ Add photo', de:'+ Foto hinzufügen', fr:'+ Ajouter une photo', es:'+ Añadir foto', 'es-MX':'+ Agregar foto', it:'+ Aggiungi foto', pt:'+ Adicionar foto', ar:'+ إضافة صورة', hi:'+ फ़ोटो जोड़ें', ja:'+ 写真を追加', ky:'+ Сүрөт кошуу', 'zh-Hant':'+ 加入照片' },
  r3_b_empty:    { bg:'Няма добавени снимки.', ru:'Фото не добавлены.', uk:'Фото не додано.', en:'No photos added.', de:'Keine Fotos hinzugefügt.', fr:'Aucune photo ajoutée.', es:'No hay fotos añadidas.', 'es-MX':'No hay fotos agregadas.', it:'Nessuna foto aggiunta.', pt:'Sem fotos adicionadas.', ar:'لم تُضف صور.', hi:'कोई फ़ोटो नहीं जोड़ी गई।', ja:'写真が追加されていません。', ky:'Сүрөт кошулган жок.', 'zh-Hant':'尚未加入照片。' },
  r3_b_clear:    { bg:'Изчисти', ru:'Очистить', uk:'Очистити', en:'Clear', de:'Leeren', fr:'Vider', es:'Vaciar', 'es-MX':'Vaciar', it:'Svuota', pt:'Limpar', ar:'مسح', hi:'साफ़ करें', ja:'クリア', ky:'Тазалоо', 'zh-Hant':'清除' },
  r3_b_run:      { bg:'Обработи всички', ru:'Обработать все', uk:'Обробити всі', en:'Process all', de:'Alle verarbeiten', fr:'Tout traiter', es:'Procesar todo', 'es-MX':'Procesar todo', it:'Elabora tutto', pt:'Processar tudo', ar:'معالجة الكل', hi:'सभी प्रोसेस करें', ja:'すべて処理', ky:'Баарын иштетүү', 'zh-Hant':'全部處理' },
  r3_b_format:   { bg:'Формат', ru:'Формат', uk:'Формат', en:'Format', de:'Format', fr:'Format', es:'Formato', 'es-MX':'Formato', it:'Formato', pt:'Formato', ar:'الصيغة', hi:'फ़ॉर्मेट', ja:'形式', ky:'Формат', 'zh-Hant':'格式' },
  r3_b_prog:     { bg:'Снимка {0} от {1}…', ru:'Фото {0} из {1}…', uk:'Фото {0} з {1}…', en:'Photo {0} of {1}…', de:'Foto {0} von {1}…', fr:'Photo {0} sur {1}…', es:'Foto {0} de {1}…', 'es-MX':'Foto {0} de {1}…', it:'Foto {0} di {1}…', pt:'Foto {0} de {1}…', ar:'الصورة {0} من {1}…', hi:'फ़ोटो {0}/{1}…', ja:'写真 {0}/{1}…', ky:'Сүрөт {0}/{1}…', 'zh-Hant':'照片 {0}/{1}…' },
  r3_b_done:     { bg:'Готово: {0} файла запазени.', ru:'Готово: сохранено файлов — {0}.', uk:'Готово: збережено файлів — {0}.', en:'Done: {0} files saved.', de:'Fertig: {0} Dateien gespeichert.', fr:'Terminé : {0} fichiers enregistrés.', es:'Listo: {0} archivos guardados.', 'es-MX':'Listo: {0} archivos guardados.', it:'Fatto: {0} file salvati.', pt:'Concluído: {0} ficheiros guardados.', ar:'تم: حُفظ {0} ملفات.', hi:'पूर्ण: {0} फ़ाइलें सहेजी गईं।', ja:'完了: {0} 個のファイルを保存。', ky:'Даяр: {0} файл сакталды.', 'zh-Hant':'完成：已儲存 {0} 個檔案。' }
});

export const title = t('t_rotate3d_name');

// ── Помощници за анализ на снимката (среден цвят + карта на височините за релефа) ──
function imgPixels(img, size) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, size, size);
  return cx.getImageData(0, 0, size, size).data;
}
function avgColor(img) {
  const d = imgPixels(img, 16); let r = 0, g = 0, b = 0, n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
  return [ (r/n)/255, (g/n)/255, (b/n)/255 ];
}
// Мрежа яркости G×G, ОБЪРНАТА по Y (за да съвпадне с FLIP_Y текстурата: ред 0 = долу).
function lumGrid(img, G) {
  const d = imgPixels(img, G); const out = new Float32Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const src = ((G - 1 - j) * G + i) * 4;                      // канвасът е отгоре-надолу
    out[j * G + i] = (0.299*d[src] + 0.587*d[src+1] + 0.114*d[src+2]) / 255;
  }
  return out;
}
// RGB мрежа (0..255) — за оценка кой е ОБЕКТ и кой е ФОН (по разлика от цвета на ръба на кадъра).
function rgbGrid(img, G) {
  const d = imgPixels(img, G); const out = new Float32Array(G * G * 3);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const src = ((G - 1 - j) * G + i) * 4, k = (j * G + i) * 3;
    out[k] = d[src]; out[k+1] = d[src+1]; out[k+2] = d[src+2];
  }
  return out;
}

// ── МАКЕТИ: снимката се композира в рамка (картичка / телефон / кутия / картина) → текстура ──
// Връща { src (Image|Canvas), w, h, thick (половин дебелина), side (цвят на ръбовете или null=среден) }.
function roundRect(cx, x, y, w, h, r) {
  cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
}
function composeMockup(img, kind) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (kind === 'box')  return { src: img, w: iw, h: ih, thick: 0.32, side: 'dark' };
  if (kind !== 'card' && kind !== 'phone' && kind !== 'frame') return { src: img, w: iw, h: ih, thick: 0.05, side: null };
  const s = Math.min(1, 1600 / Math.max(iw, ih)); const w = Math.round(iw * s), h = Math.round(ih * s);
  const m = Math.round(Math.max(w, h) * 0.05);
  const c = document.createElement('canvas'); const cx = c.getContext('2d');
  if (kind === 'card') {                       // полароид: бяло поле, отдолу по-широко
    c.width = w + 2 * m; c.height = h + m + Math.round(m * 3.2);
    cx.fillStyle = '#fbfbf8'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(img, m, m, w, h);
    return { src: c, w: c.width, h: c.height, thick: 0.015, side: [0.97, 0.97, 0.95] };
  }
  if (kind === 'phone') {                      // черна рамка със заоблени ъгли + процеп за говорител
    const p = Math.round(m * 0.9), top = Math.round(m * 1.4);
    c.width = w + 2 * p; c.height = h + top + p;
    cx.clearRect(0, 0, c.width, c.height);
    roundRect(cx, 0, 0, c.width, c.height, Math.round(m * 1.8)); cx.fillStyle = '#101114'; cx.fill();
    cx.save(); roundRect(cx, p, top, w, h, Math.round(m * 0.5)); cx.clip(); cx.drawImage(img, p, top, w, h); cx.restore();
    roundRect(cx, c.width / 2 - w * 0.12, top * 0.38, w * 0.24, Math.max(2, top * 0.22), 4); cx.fillStyle = '#2a2c31'; cx.fill();
    return { src: c, w: c.width, h: c.height, thick: 0.04, side: [0.1, 0.1, 0.11] };
  }
  // рамка: дървен кант + бяло паспарту
  const f = Math.round(m * 1.6), mat = Math.round(m * 1.2);
  c.width = w + 2 * (f + mat); c.height = h + 2 * (f + mat);
  const g = cx.createLinearGradient(0, 0, c.width, c.height); g.addColorStop(0, '#8a5a2b'); g.addColorStop(1, '#5a3612');
  cx.fillStyle = g; cx.fillRect(0, 0, c.width, c.height);
  cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(f, f, c.width - 2 * f, c.height - 2 * f);
  cx.fillStyle = '#f4f2ec'; cx.fillRect(f + 2, f + 2, c.width - 2 * f - 4, c.height - 2 * f - 4);
  cx.drawImage(img, f + mat, f + mat, w, h);
  return { src: c, w: c.width, h: c.height, thick: 0.07, side: [0.36, 0.22, 0.1] };
}

// ── WebGL рендер (един за всички табове): текстуриран обект + режим на обем + макет + сянка ──
function makeRenderer(canvas) {
  let gl;
  try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true }); } catch (e) {}
  if (!gl) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aUv  = gl.getAttribLocation(prog, 'aUv');
  const aShade = gl.getAttribLocation(prog, 'aShade');
  const uMVP = gl.getUniformLocation(prog, 'uMVP');
  const uUseTex = gl.getUniformLocation(prog, 'uUseTex');
  const uSolid = gl.getUniformLocation(prog, 'uSolid');
  const uShadow = gl.getUniformLocation(prog, 'uShadow');
  // Буфери: текстурираната част (лице/гръб/релеф) + плътната част (странични ръбове при „Обем").
  const bPos = gl.createBuffer(), bUv = gl.createBuffer(), bSh = gl.createBuffer(), bIdx = gl.createBuffer();
  const bsPos = gl.createBuffer(), bsSh = gl.createBuffer(), bsIdx = gl.createBuffer();
  let texCount = 0, solidCount = 0;
  const tex = gl.createTexture();

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.disable(gl.CULL_FACE);          // виждаме и „гърба"
  gl.enable(gl.DEPTH_TEST);          // при обем/релеф лицата се подреждат правилно по дълбочина
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const persp = mPerspective(40 * Math.PI / 180, 1, 0.1, 100);
  const view  = mTranslate(0, 0, -3.2);
  // Сянка: силуетът се „сплесква" (z→0) върху стена зад обекта и се отмества надолу-вдясно.
  const shadowMat = mMul(mMul(persp, view), mMul(mTranslate(0.18, -0.18, -1.2), mScale(1, 1, 0)));
  const S = { q: qIdent(), mode: 1, mockup: 'none', shadow: false, img: null, texReady: false };
  let texW = 1, texH = 1, thick = 0.05, curSolid = [0.8, 0.8, 0.82], texSrc = null;

  const HALF = 0.9;                  // половин размер на най-дългата страна
  const RELIEF = 0.22;               // амплитуда на релефа (повърхностна текстура, Метод 2)
  const BULGE = 0.6;                 // амплитуда на радиалния КУПОЛ (обектът изпъква в средата)
  const GRID = 96;                   // резолюция на релефната мрежа

  function quadSize(imgW, imgH) {
    const asp = imgW / imgH; let qw = HALF, qh = HALF;
    if (asp >= 1) qh = HALF / asp; else qw = HALF * asp;
    return [qw, qh];
  }

  // ── Построяване на геометрията според режима ──
  function buildFlat(qw, qh) {
    const pos = new Float32Array([-qw,-qh,0,  qw,-qh,0,  -qw,qh,0,  qw,qh,0]);
    const uv  = new Float32Array([0,0, 1,0, 0,1, 1,1]);
    const sh  = new Float32Array([1, 1, 1, 1]);
    const idx = new Uint16Array([0,1,2, 2,1,3]);
    return { pos, uv, sh, idx, solidPos: null };
  }
  function buildSlab(qw, qh) {
    const h = thick;
    // Лице (z=+h) и гръб (z=-h) — текстурирани.
    const pos = new Float32Array([
      -qw,-qh, h,  qw,-qh, h,  -qw,qh, h,  qw,qh, h,      // лице
      -qw,-qh,-h,  qw,-qh,-h,  -qw,qh,-h,  qw,qh,-h       // гръб
    ]);
    const uv = new Float32Array([0,0, 1,0, 0,1, 1,1,  0,0, 1,0, 0,1, 1,1]);
    const sh = new Float32Array([1,1,1,1, 0.92,0.92,0.92,0.92]);
    const idx = new Uint16Array([0,1,2, 2,1,3,  4,6,5, 5,6,7]);
    // Странични ръбове — плътен цвят (средният цвят на снимката / цветът на макета), лека сянка за обем.
    const sp = new Float32Array([
      -qw,-qh, h,  qw,-qh, h,  qw,qh, h,  -qw,qh, h,       // 0..3 лицев ринг
      -qw,-qh,-h,  qw,-qh,-h,  qw,qh,-h,  -qw,qh,-h        // 4..7 заден ринг
    ]);
    const ssh = new Float32Array([0.8,0.8,0.8,0.8, 0.62,0.62,0.62,0.62]);
    const sidx = new Uint16Array([
      0,1,5, 5,4,0,   1,2,6, 6,5,1,   2,3,7, 7,6,2,   3,0,4, 4,7,3
    ]);
    return { pos, uv, sh, idx, solidPos: sp, solidSh: ssh, solidIdx: sidx };
  }
  function buildRelief(qw, qh) {
    const G = GRID, src = texSrc || S.img;
    const lum = src ? lumGrid(src, G) : new Float32Array(G * G);
    const rgb = src ? rgbGrid(src, G) : new Float32Array(G * G * 3);
    const n = G * G;
    // ── ОБЕМ НА ОБЕКТА (а не на цялата снимка): радиален КУПОЛ, модулиран от „преден план". ──
    // Фонов цвят = среден по РЪБА на кадъра (там обикновено е фонът). Клетка, която се различава
    // силно от фона → ОБЕКТ (тегло 1); близка до фона → ФОН (тегло 0). Куполът (центърът изпъква)
    // се прилага само върху обекта → кръгло кошче изпъква в средата, фонът остава плосък.
    let br = 0, bgc = 0, bb = 0, bc = 0;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      if (i === 0 || j === 0 || i === G - 1 || j === G - 1) { const k = (j*G+i)*3; br += rgb[k]; bgc += rgb[k+1]; bb += rgb[k+2]; bc++; }
    }
    br /= bc || 1; bgc /= bc || 1; bb /= bc || 1;
    const fgRaw = new Float32Array(n);
    for (let p = 0; p < n; p++) { const k = p*3; const dist = Math.hypot(rgb[k]-br, rgb[k+1]-bgc, rgb[k+2]-bb); fgRaw[p] = Math.min(1, dist / 85); }
    // изглаждане на маската (3×3) → меки граници, без стъпала
    const fg = new Float32Array(n);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      let s = 0, c = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const jj = j+dj, ii = i+di; if (ii<0||jj<0||ii>=G||jj>=G) continue; s += fgRaw[jj*G+ii]; c++; }
      fg[j*G+i] = s / (c || 1);
    }
    const cx = (G-1)/2, cy = (G-1)/2;
    const heights = new Float32Array(n);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const rx = (i-cx)/cx, ry = (j-cy)/cy, r2 = Math.min(1, rx*rx + ry*ry);
      const dome = Math.sqrt(1 - r2);                              // 1 в центъра → 0 в ръба
      const p = j*G+i;
      heights[p] = dome * BULGE * fg[p] + (lum[p] - 0.5) * RELIEF * 0.45;   // купол по обекта + фина текстура
    }
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), sh = new Float32Array(n);
    const H = (i, j) => heights[Math.max(0, Math.min(G-1, j)) * G + Math.max(0, Math.min(G-1, i))];
    const dx = (2 * qw) / (G - 1), dy = (2 * qh) / (G - 1);
    const Lx = 0.35, Ly = 0.45, Lz = 0.82, Ll = Math.hypot(Lx, Ly, Lz);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const k = j * G + i, u = i / (G - 1), v = j / (G - 1);
      pos[k*3] = -qw + u * 2 * qw; pos[k*3+1] = -qh + v * 2 * qh; pos[k*3+2] = H(i, j);
      uv[k*2] = u; uv[k*2+1] = v;
      // Нормала от наклона на височинното поле → Ламбертова сянка (прави релефа видим).
      const nx = -(H(i+1, j) - H(i-1, j)) / (2 * dx);
      const ny = -(H(i, j+1) - H(i, j-1)) / (2 * dy);
      const nl = Math.hypot(nx, ny, 1) || 1;
      const d = (nx*Lx + ny*Ly + 1*Lz) / (nl * Ll);
      sh[k] = 0.55 + 0.5 * Math.max(0, d);
    }
    const idx = new Uint16Array((G - 1) * (G - 1) * 6); let p = 0;
    for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) {
      const a = j*G + i, b = a + 1, c = a + G, e = c + 1;
      idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = c; idx[p++] = b; idx[p++] = e;
    }
    return { pos, uv, sh, idx, solidPos: null };
  }

  function upload(buf, data) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); }
  function rebuild() {
    if (!S.img) { texCount = 0; solidCount = 0; return; }
    const [qw, qh] = quadSize(texW, texH);
    const g = S.mode === 2 ? buildRelief(qw, qh) : S.mode === 1 ? buildSlab(qw, qh) : buildFlat(qw, qh);
    upload(bPos, g.pos); upload(bUv, g.uv); upload(bSh, g.sh);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    texCount = g.idx.length;
    if (g.solidPos) {
      upload(bsPos, g.solidPos); upload(bsSh, g.solidSh);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bsIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.solidIdx, gl.STATIC_DRAW);
      solidCount = g.solidIdx.length;
    } else solidCount = 0;
  }

  // Един проход на геометрията с дадена матрица (shadow=1 → черен силует).
  function pass(mvp, shadow) {
    gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
    gl.uniform1f(uShadow, shadow);
    gl.enableVertexAttribArray(aUv);
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bSh); gl.enableVertexAttribArray(aShade); gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uUseTex, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx);
    gl.drawElements(gl.TRIANGLES, texCount, gl.UNSIGNED_SHORT, 0);
    if (solidCount) {                          // плътни странични ръбове (само „Обем")
      gl.disableVertexAttribArray(aUv);        // константа (0,0) — без значение при uUseTex=0
      gl.bindBuffer(gl.ARRAY_BUFFER, bsPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bsSh); gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uUseTex, 0);
      gl.uniform3f(uSolid, curSolid[0], curSolid[1], curSolid[2]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bsIdx);
      gl.drawElements(gl.TRIANGLES, solidCount, gl.UNSIGNED_SHORT, 0);
    }
  }
  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!S.texReady || !texCount) return;
    const rot = qMat(S.q);
    if (S.shadow) pass(mMul(shadowMat, rot), 1);
    pass(mMul(mMul(persp, view), rot), 0);
  }

  // Качва снимката (с макета) като текстура и построява геометрията.
  function applyTexture() {
    const mk = composeMockup(S.img, S.mockup);
    texSrc = mk.src; texW = mk.w; texH = mk.h; thick = mk.thick;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mk.src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    let avg; try { avg = avgColor(S.img); } catch (e) { avg = [0.8, 0.8, 0.82]; }
    curSolid = mk.side === 'dark' ? avg.map((v) => v * 0.75) : (mk.side || avg);
    S.texReady = true; rebuild();
  }

  return {
    S,
    load(img, keepAngle) { S.img = img; if (!keepAngle) S.q = qIdent(); applyTexture(); draw(); },
    setMode(m) { S.mode = m; if (S.img) { rebuild(); draw(); } },
    setMockup(k) { S.mockup = k; if (S.img) { applyTexture(); draw(); } },
    setShadow(on) { S.shadow = !!on; draw(); },
    rotate(ax, rad) { S.q = qRotateWorld(S.q, ax[0], ax[1], ax[2], rad); draw(); },
    setQ(q) { S.q = qNorm(q.slice()); draw(); },
    reset() { S.q = qIdent(); draw(); },
    draw
  };
}

// Общи помощници
function loadImg(dataUrl) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image')); im.src = dataUrl; });
}
async function pickImage() {
  const f = await pickBinaryFile('image/*');
  if (!f || !f.dataUrl) return null;
  const im = await loadImg(f.dataUrl); im.pupName = f.name || ''; return im;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const AXES = { h: [1,0,0], v: [0,1,0], '28': [1,1,0], '104': [1,-1,0] };
const DEG = Math.PI / 180;
const PRESETS_KEY = 'r3.presets';
// Вградени изгледи: поредица от завъртания (ос, градуси) от нулево положение.
const BUILTIN = [
  { key: 'r3_pre_iso',   steps: [['h', 30], ['v', -35]] },
  { key: 'r3_pre_left',  steps: [['v', -28]] },
  { key: 'r3_pre_right', steps: [['v', 28]] },
  { key: 'r3_pre_top',   steps: [['h', 55]] },
  { key: 'r3_pre_back',  steps: [['v', 180]] }
];
function loadPresets() { try { const a = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function savePresets(a) { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(a)); } catch (e) {} }
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function render(root) {
  const CHECK = 'conic-gradient(#e9edf3 90deg,#f6f8fb 0 180deg,#e9edf3 0 270deg,#f6f8fb 0) 0 0/28px 28px';
  const STAGE = 'position:relative;width:100%;max-width:420px;margin:0 auto;aspect-ratio:1/1;border-radius:14px;overflow:hidden;border:1px solid #d7dde8;background:' + CHECK;
  const opt = (v, key, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${esc(t(key))}</option>`;
  root.innerHTML = `
    <div class="tool-card" style="user-select:none;-webkit-user-select:none;-webkit-touch-callout:none">
      <div class="tabs" id="r3tabs">
        <button class="tab active" data-tab="paper">📐 ${t('r3_tab_paper')}</button>
        <button class="tab" data-tab="3d">🧊 ${t('r3_tab_3d')}</button>
        <button class="tab" data-tab="str">📐 ${t('r3_tab_str')}</button>
        <button class="tab" data-tab="360">🔄 ${t('r3_tab_360')}</button>
        <button class="tab" data-tab="batch">🗂 ${t('r3_tab_batch')}</button>
      </div>
      <div id="panePaper"></div>
      <div id="r3wrap" style="${STAGE};display:none"><canvas id="r3cv" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas></div>
      <div id="r3swrap" style="${STAGE};display:none"></div>
      <div class="save-msg" id="r3msg" style="min-height:18px;margin-top:8px"></div>

      <div id="pane3d" style="display:none">
        <p class="hint">${t('r3_hint')}</p>
        <button class="btn" id="r3pick">📁 ${t('r3_pick')}</button>
        <div id="r3modes" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px">
          <button class="btn modeb" data-m="0" style="margin-top:0">▭ ${t('r3_mode_flat')}</button>
          <button class="btn modeb" data-m="1" style="margin-top:0">🧊 ${t('r3_mode_slab')}</button>
          <button class="btn modeb" data-m="2" style="margin-top:0">⛰ ${t('r3_mode_relief')}</button>
        </div>
        <div class="row" style="margin-top:10px;align-items:end">
          <div><label>${t('r3_mockup')}</label>
            <select id="r3mock">${opt('none','r3_mk_none',true)}${opt('card','r3_mk_card')}${opt('phone','r3_mk_phone')}${opt('box','r3_mk_box')}${opt('frame','r3_mk_frame')}</select></div>
          <div><label class="check" style="margin:0 0 12px"><input type="checkbox" id="r3shadow" /> ${t('r3_shadow')}</label></div>
        </div>
        <div id="r3axes" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
          <button class="btn axb" data-ax="h"   style="touch-action:none;margin-top:0">↕ ${t('r3_axis_h')}</button>
          <button class="btn axb" data-ax="v"   style="touch-action:none;margin-top:0">↔ ${t('r3_axis_v')}</button>
          <button class="btn axb" data-ax="28"  style="touch-action:none;margin-top:0">⤢ ${t('r3_axis_28')}</button>
          <button class="btn axb" data-ax="104" style="touch-action:none;margin-top:0">⤡ ${t('r3_axis_104')}</button>
        </div>
        <label>${t('r3_step')}</label>
        <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:6px">
          <select id="r3step"><option>5</option><option selected>15</option><option>30</option><option>45</option><option>90</option></select>
          <button class="btn sec stepb" data-ax="h" data-dir="1" style="margin-top:0;padding:10px 4px">↕ +</button>
          <button class="btn sec stepb" data-ax="h" data-dir="-1" style="margin-top:0;padding:10px 4px">↕ −</button>
          <button class="btn sec stepb" data-ax="v" data-dir="1" style="margin-top:0;padding:10px 4px">↔ +</button>
          <button class="btn sec stepb" data-ax="v" data-dir="-1" style="margin-top:0;padding:10px 4px">↔ −</button>
        </div>
        <label>${t('r3_presets')}</label>
        <div id="r3presets" style="display:flex;flex-wrap:wrap;gap:6px"></div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <input id="r3pname" type="text" maxlength="24" placeholder="${esc(t('r3_pre_name'))}" style="flex:2" />
          <button class="btn sec" id="r3psave" style="flex:1;margin-top:0">＋ ${t('r3_pre_save')}</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn" id="r3reset" style="flex:1;background:#5b6472;margin-top:0">↺ ${t('r3_reset')}</button>
          <button class="btn" id="r3save"  style="flex:2;margin-top:0">💾 ${t('r3_save')}</button>
        </div>
      </div>

      <div id="paneStr" style="display:none"></div>

      <div id="pane360" style="display:none">
        <p class="hint">${t('r3_360_hint')}</p>
        <button class="btn" id="r3pick2">📁 ${t('r3_pick')}</button>
        <div class="row">
          <div><label>${t('r3_360_axis')}</label><select id="r3ax360">${opt('v','r3_axis_v',true)}${opt('h','r3_axis_h')}${opt('28','r3_axis_28')}${opt('104','r3_axis_104')}</select></div>
          <div><label>${t('r3_360_frames')}</label><select id="r3n360"><option>12</option><option selected>24</option><option>36</option></select></div>
        </div>
        <div class="row">
          <div><label>${t('r3_360_size')}</label><select id="r3s360"><option>240</option><option selected>360</option><option>480</option></select></div>
          <div><label>${t('r3_360_delay')}</label><select id="r3d360"><option>60</option><option selected>100</option><option>150</option></select></div>
          <div><label>${t('r3_360_bg')}</label><select id="r3bg360">${opt('#ffffff','r3_bg_white',true)}${opt('#000000','r3_bg_black')}${opt('none','r3_bg_none')}</select></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn" id="r3gif" style="flex:1;margin-top:0">🎞 ${t('r3_360_gif')}</button>
          <button class="btn sec" id="r3strip" style="flex:1;margin-top:0">🖼 ${t('r3_360_strip')}</button>
        </div>
      </div>

      <div id="paneBatch" style="display:none">
        <p class="hint">${t('r3_b_hint')}</p>
        <button class="btn" id="r3badd">${t('r3_b_add')}</button>
        <div id="r3blist" style="margin-top:10px"></div>
        <div class="row" style="align-items:end">
          <div><label>${t('r3_b_format')}</label><select id="r3bfmt"><option value="png">PNG</option><option value="jpg">JPG</option></select></div>
          <div><button class="btn sec" id="r3bclear" style="margin-top:0">${t('r3_b_clear')}</button></div>
        </div>
        <button class="btn" id="r3brun">▶ ${t('r3_b_run')}</button>
      </div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  const canvas = $('#r3cv'), msg = $('#r3msg');
  canvas.width = 900; canvas.height = 900;
  function flash(text, err) { msg.style.color = err ? '#c0392b' : '#2e7d32'; msg.textContent = text; }

  const R = makeRenderer(canvas);
  if (!R) { msg.style.color = '#c0392b'; msg.textContent = t('r3_nogl'); return; }
  const need = () => { if (!R.S.texReady) { flash(t('r3_pick_first'), true); return false; } return true; };

  // ── табове ──
  const panes = { paper: $('#panePaper'), '3d': $('#pane3d'), str: $('#paneStr'), '360': $('#pane360'), batch: $('#paneBatch') };
  const paper = mountPaper({ pane: panes.paper, flash }); // ГЛАВНИЯТ екран — „Хартиен 3D"
  const straight = mountStraighten({ stage: $('#r3swrap'), pane: panes.str, getImage: () => R.S.img, pickImage: async () => { const im = await pickImage(); if (im) setImage(im); return im; }, flash });
  function showTab(id) {
    root.querySelectorAll('#r3tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    for (const k in panes) panes[k].style.display = k === id ? '' : 'none';
    $('#r3wrap').style.display = (id === 'str' || id === 'paper') ? 'none' : '';
    $('#r3swrap').style.display = id === 'str' ? '' : 'none';
    msg.textContent = '';
    if (id === 'str') straight.activate();
    if (id === 'paper') paper.activate();
  }
  root.querySelectorAll('#r3tabs .tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  function setImage(im) { R.load(im); }
  $('#r3pick').addEventListener('click', async () => { try { const im = await pickImage(); if (im) { setImage(im); msg.textContent = ''; } } catch (e) { flash(e.message, true); } });
  $('#r3pick2').addEventListener('click', async () => { try { const im = await pickImage(); if (im) { setImage(im); msg.textContent = ''; } } catch (e) { flash(e.message, true); } });

  // ── въртене при задържане на бутон (екранни оси, кватернион) ──
  const SPEED = 0.6; // rad/сек ≈ 34°/сек
  let active = null, raf = 0, lastT = 0;
  function frame(ts) {
    if (!active) { raf = 0; lastT = 0; return; }
    if (!lastT) lastT = ts;
    const dt = Math.min((ts - lastT) / 1000, 0.05); lastT = ts;
    R.rotate(active, SPEED * dt);
    raf = requestAnimationFrame(frame);
  }
  function startAxis(key) { if (!need()) return; active = AXES[key]; lastT = 0; if (!raf) raf = requestAnimationFrame(frame); }
  function stopAxis() { active = null; lastT = 0; }
  root.querySelectorAll('.axb').forEach((b) => {
    const key = b.getAttribute('data-ax');
    const down = (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} startAxis(key); };
    const up = (e) => { if (e) { e.preventDefault(); try { b.releasePointerCapture(e.pointerId); } catch (_) {} } stopAxis(); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault()); // без меню при дълго задържане
  });
  // точни стъпки
  root.querySelectorAll('.stepb').forEach((b) => b.addEventListener('click', () => {
    if (!need()) return;
    R.rotate(AXES[b.dataset.ax], Number(b.dataset.dir) * Number($('#r3step').value) * DEG);
  }));

  // ── режими (Плоско / Обем / Релеф), макет, сянка ──
  const modeBtns = root.querySelectorAll('.modeb');
  function paintModes() {
    modeBtns.forEach((b) => {
      const on = Number(b.getAttribute('data-m')) === R.S.mode;
      b.style.background = on ? '#2f7d32' : ''; b.style.color = on ? '#fff' : ''; b.style.fontWeight = on ? '700' : '';
    });
  }
  modeBtns.forEach((b) => b.addEventListener('click', () => { R.setMode(Number(b.getAttribute('data-m'))); paintModes(); }));
  paintModes();
  $('#r3mock').addEventListener('change', (e) => R.setMockup(e.target.value));
  $('#r3shadow').addEventListener('change', (e) => R.setShadow(e.target.checked));

  // ── пресети ──
  function applyBuiltin(p) { let q = qIdent(); for (const [ax, deg] of p.steps) q = qRotateWorld(q, AXES[ax][0], AXES[ax][1], AXES[ax][2], deg * DEG); R.setQ(q); }
  function applyUser(p) {
    if (p.mode != null) { R.S.mode = p.mode; paintModes(); }
    if (p.mockup) { $('#r3mock').value = p.mockup; R.S.mockup = p.mockup; }
    R.S.shadow = !!p.shadow; $('#r3shadow').checked = R.S.shadow;
    if (R.S.img) R.load(R.S.img, true);
    R.setQ(p.q || qIdent());
  }
  function paintPresets() {
    const box = $('#r3presets'); const users = loadPresets();
    const chip = 'padding:7px 10px;border-radius:999px;border:1px solid var(--line);background:var(--bg-3);color:var(--text);font-size:.85em;cursor:pointer';
    box.innerHTML = BUILTIN.map((p, i) => `<button style="${chip}" data-b="${i}">${esc(t(p.key))}</button>`).join('') +
      users.map((p, i) => `<span style="display:inline-flex;border-radius:999px;overflow:hidden;border:1px solid var(--accent)"><button style="${chip};border:none;border-radius:0;background:var(--bg-2)" data-u="${i}">★ ${esc(p.name)}</button><button style="${chip};border:none;border-radius:0;background:var(--bg-2);padding-left:6px" data-del="${i}" aria-label="×">×</button></span>`).join('');
    box.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => applyBuiltin(BUILTIN[Number(b.dataset.b)])));
    box.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => applyUser(loadPresets()[Number(b.dataset.u)] || {})));
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const a = loadPresets(); a.splice(Number(b.dataset.del), 1); savePresets(a); paintPresets(); }));
  }
  $('#r3psave').addEventListener('click', () => {
    const inp = $('#r3pname'); const name = (inp.value || '').trim() || (new Date()).toLocaleTimeString();
    const a = loadPresets(); a.push({ name, q: R.S.q.slice(), mode: R.S.mode, mockup: R.S.mockup, shadow: R.S.shadow });
    if (a.length > 20) a.shift();
    savePresets(a); inp.value = ''; paintPresets();
  });
  paintPresets();

  $('#r3reset').addEventListener('click', () => R.reset());
  $('#r3save').addEventListener('click', () => {
    if (!need()) return;
    R.draw(); // гарантирай текущия кадър в буфера
    canvas.toBlob(async (blob) => {
      if (!blob) { flash(t('r3_nogl'), true); return; }
      await saveFile('pupikes-3d-' + Date.now() + '.png', blob, 'image/png');
      flash(tf('r3_saved', 'PNG'));
    }, 'image/png');
  });

  // ── 360°: кадри около ос от текущия ъгъл → GIF / лента ──
  let busy = false;
  async function capture360() {
    const ax = AXES[$('#r3ax360').value], N = Number($('#r3n360').value), S = Number($('#r3s360').value), bg = $('#r3bg360').value;
    const q0 = R.S.q.slice();
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const cx = cv.getContext('2d');
    const frames = [];
    for (let i = 0; i < N; i++) {
      R.setQ(qRotateWorld(q0, ax[0], ax[1], ax[2], 2 * Math.PI * i / N));
      cx.clearRect(0, 0, S, S);
      if (bg !== 'none') { cx.fillStyle = bg; cx.fillRect(0, 0, S, S); }
      cx.drawImage(canvas, 0, 0, S, S);
      frames.push(cx.getImageData(0, 0, S, S).data);
      flash(tf('r3_360_prog', i + 1, N)); await tick();
    }
    R.setQ(q0);
    return { frames, S, N, transparent: bg === 'none' };
  }
  $('#r3gif').addEventListener('click', async () => {
    if (busy || !need()) return; busy = true;
    try {
      const { frames, S, transparent } = await capture360();
      flash(t('r3_360_enc')); await tick();
      const bytes = encodeGif(frames, S, S, Number($('#r3d360').value), transparent);
      await saveFile('pupikes-360-' + Date.now() + '.gif', new Blob([bytes], { type: 'image/gif' }), 'image/gif');
      flash(tf('r3_saved', 'GIF'));
    } catch (e) { flash(String(e.message || e), true); }
    busy = false;
  });
  $('#r3strip').addEventListener('click', async () => {
    if (busy || !need()) return; busy = true;
    try {
      const { frames, S, N } = await capture360();
      const cols = Math.min(N, 6), rows = Math.ceil(N / cols);
      const sheet = document.createElement('canvas'); sheet.width = cols * S; sheet.height = rows * S;
      const cx = sheet.getContext('2d');
      frames.forEach((f, i) => cx.putImageData(new ImageData(f, S, S), (i % cols) * S, Math.floor(i / cols) * S));
      await new Promise((res) => sheet.toBlob(async (blob) => { if (blob) await saveFile('pupikes-360-strip-' + Date.now() + '.png', blob, 'image/png'); res(); }, 'image/png'));
      flash(tf('r3_saved', 'PNG'));
    } catch (e) { flash(String(e.message || e), true); }
    busy = false;
  });

  // ── пакет: списък снимки → същите настройки → файл за всяка ──
  const queue = [];
  function paintQueue() {
    const box = $('#r3blist');
    if (!queue.length) { box.innerHTML = `<div class="hint">${t('r3_b_empty')}</div>`; return; }
    box.innerHTML = queue.map((im, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)">
      <img src="${im.src}" style="width:44px;height:44px;object-fit:cover;border-radius:8px" alt="" />
      <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.9em">${esc(im.pupName || ('#' + (i + 1)))}</div>
      <button class="btn sec inline" data-rm="${i}" style="margin:0;padding:6px 12px">×</button></div>`).join('');
    box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { queue.splice(Number(b.dataset.rm), 1); paintQueue(); }));
  }
  paintQueue();
  $('#r3badd').addEventListener('click', async () => { try { const im = await pickImage(); if (im) { queue.push(im); paintQueue(); } } catch (e) { flash(e.message, true); } });
  $('#r3bclear').addEventListener('click', () => { queue.length = 0; paintQueue(); });
  $('#r3brun').addEventListener('click', async () => {
    if (busy) return;
    if (!queue.length) { flash(t('r3_b_empty'), true); return; }
    busy = true;
    const fmt = $('#r3bfmt').value, mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
    const orig = R.S.img; let done = 0;
    try {
      for (let i = 0; i < queue.length; i++) {
        flash(tf('r3_b_prog', i + 1, queue.length)); await tick();
        R.load(queue[i], true); R.draw();
        let src = canvas;
        if (fmt === 'jpg') { src = document.createElement('canvas'); src.width = canvas.width; src.height = canvas.height; const cx = src.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, src.width, src.height); cx.drawImage(canvas, 0, 0); }
        const blob = await new Promise((res) => src.toBlob(res, mime, 0.92));
        if (blob) { await saveFile('pupikes-3d-' + (i + 1) + '-' + Date.now() + '.' + fmt, blob, mime); done++; }
      }
      flash(tf('r3_b_done', done));
    } catch (e) { flash(String(e.message || e), true); }
    if (orig) R.load(orig, true); else R.draw();
    busy = false;
  });

  R.draw(); // празен прозрачен кадър в началото
}
