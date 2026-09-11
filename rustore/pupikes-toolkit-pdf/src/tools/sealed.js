// Version: 1.0027
// Затворен кръг (Pupikes Sealed Docs) — ГЛАВНИЯТ инструмент на приложението.
// Затворен кръг за документи между адвокат/нотариус/роднини/партньори: всеки телефон има свой
// QR (двойка ключове; публичният е в кода). Групата се събира НА ЖИВО — един телефон сканира
// QR-овете на всички, генерира общ ключ, запечатва го за всеки член (ECDH) и показва QR за
// раздаване; всеки член сканира своя и получава ключа САМО на своето устройство. Оттам всеки
// файл се шифрова с ключа на групата (AES-256-GCM), носи подпис на подателя (ECDSA) и се чете
// само на телефоните на членовете. Без сървър: запечатаният пакет (.pupsealed) тръгва през
// какъвто и да е канал (Telegram/WhatsApp/имейл/Bluetooth) и се отваря само с апа.
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { esc, fmtSize, setStatus } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';
import { pickBinaryFile } from '../core/filepick.js';
import { saveFile } from '../core/filesave.js';
import * as SC from '../core/sealcrypto.js';

register({
  sd_intro: { bg:'Затворен кръг за документи: ключове през QR на живо, всеки файл се шифрова за групата и се чете само на телефоните на членовете. Без сървър.', ru:'Закрытый круг для документов: ключи через QR вживую, каждый файл шифруется для группы и читается только на телефонах участников. Без сервера.', uk:'Закрите коло для документів: ключі через QR наживо, кожен файл шифрується для групи й читається лише на телефонах учасників. Без сервера.', en:'A closed circle for documents: keys exchanged by QR in person, every file is encrypted for the group and readable only on the members’ phones. No server.', de:'Ein geschlossener Kreis für Dokumente: Schlüssel per QR vor Ort, jede Datei wird für die Gruppe verschlüsselt und nur auf den Telefonen der Mitglieder lesbar. Kein Server.', fr:'Un cercle fermé pour les documents : clés échangées par QR en personne, chaque fichier est chiffré pour le groupe et lisible uniquement sur les téléphones des membres. Sans serveur.', es:'Un círculo cerrado para documentos: claves por QR en persona, cada archivo se cifra para el grupo y solo se lee en los teléfonos de los miembros. Sin servidor.', 'es-MX':'Un círculo cerrado para documentos: claves por QR en persona, cada archivo se cifra para el grupo y solo se lee en los teléfonos de los miembros. Sin servidor.', it:'Un cerchio chiuso per i documenti: chiavi scambiate via QR di persona, ogni file è cifrato per il gruppo e leggibile solo sui telefoni dei membri. Nessun server.', pt:'Um círculo fechado para documentos: chaves por QR ao vivo, cada arquivo é cifrado para o grupo e lido apenas nos telefones dos membros. Sem servidor.', ar:'دائرة مغلقة للمستندات: تُتبادل المفاتيح عبر QR حضوريًا، ويُشفَّر كل ملف للمجموعة ولا يُقرأ إلا على هواتف الأعضاء. بلا خادم.', hi:'दस्तावेज़ों के लिए बंद घेरा: QR से आमने-सामने कुंजियाँ, हर फ़ाइल समूह के लिए एन्क्रिप्ट होती है और केवल सदस्यों के फ़ोन पर पढ़ी जाती है। कोई सर्वर नहीं।', ja:'書類のための閉じた輪：鍵は対面でQR交換、各ファイルはグループ用に暗号化され、メンバーの端末でのみ読めます。サーバーなし。', ky:'Документтер үчүн жабык чөйрө: ачкычтар QR аркылуу жүзмө-жүз, ар бир файл топ үчүн шифрленет жана мүчөлөрдүн телефондорунда гана окулат. Серверсиз.', 'zh-Hant':'文件的封閉圈子：以 QR 當面交換金鑰，每個檔案為群組加密，只能在成員手機上讀取。無伺服器。' },
  sd_tab_groups: { bg:'Групи', ru:'Группы', uk:'Групи', en:'Groups', de:'Gruppen', fr:'Groupes', es:'Grupos', 'es-MX':'Grupos', it:'Gruppi', pt:'Grupos', ar:'المجموعات', hi:'समूह', ja:'グループ', ky:'Топтор', 'zh-Hant':'群組' },
  sd_tab_me: { bg:'Моят QR', ru:'Мой QR', uk:'Мій QR', en:'My QR', de:'Mein QR', fr:'Mon QR', es:'Mi QR', 'es-MX':'Mi QR', it:'Il mio QR', pt:'Meu QR', ar:'رمز QR الخاص بي', hi:'मेरा QR', ja:'自分のQR', ky:'Менин QR', 'zh-Hant':'我的 QR' },
  sd_tab_open: { bg:'Получен файл', ru:'Полученный файл', uk:'Отриманий файл', en:'Received file', de:'Empfangene Datei', fr:'Fichier reçu', es:'Archivo recibido', 'es-MX':'Archivo recibido', it:'File ricevuto', pt:'Arquivo recebido', ar:'ملف مستلم', hi:'प्राप्त फ़ाइल', ja:'受信ファイル', ky:'Алынган файл', 'zh-Hant':'收到的檔案' },
  sd_name_label: { bg:'Твоето име (вижда се в QR и при файловете)', ru:'Твоё имя (видно в QR и у файлов)', uk:'Твоє ім’я (видно в QR і біля файлів)', en:'Your name (shown in the QR and next to files)', de:'Dein Name (im QR und bei Dateien sichtbar)', fr:'Ton nom (visible dans le QR et près des fichiers)', es:'Tu nombre (se ve en el QR y junto a los archivos)', 'es-MX':'Tu nombre (se ve en el QR y junto a los archivos)', it:'Il tuo nome (visibile nel QR e accanto ai file)', pt:'Seu nome (aparece no QR e junto aos arquivos)', ar:'اسمك (يظهر في QR وبجانب الملفات)', hi:'आपका नाम (QR में और फ़ाइलों के पास दिखता है)', ja:'あなたの名前（QRとファイルの横に表示）', ky:'Атың (QR жана файлдардын жанында көрүнөт)', 'zh-Hant':'你的名字（顯示於 QR 與檔案旁）' },
  sd_name_ph: { bg:'напр. Иван Петров', ru:'напр. Иван Петров', uk:'напр. Іван Петренко', en:'e.g. John Smith', de:'z. B. Max Mustermann', fr:'p. ex. Jean Dupont', es:'p. ej. Juan Pérez', 'es-MX':'p. ej. Juan Pérez', it:'es. Mario Rossi', pt:'ex. João Silva', ar:'مثال: أحمد علي', hi:'जैसे राहुल शर्मा', ja:'例：山田太郎', ky:'мис. Айбек Асанов', 'zh-Hant':'例如：王小明' },
  sd_create_id: { bg:'Създай моя ключ', ru:'Создать мой ключ', uk:'Створити мій ключ', en:'Create my key', de:'Meinen Schlüssel erstellen', fr:'Créer ma clé', es:'Crear mi clave', 'es-MX':'Crear mi clave', it:'Crea la mia chiave', pt:'Criar minha chave', ar:'إنشاء مفتاحي', hi:'मेरी कुंजी बनाएं', ja:'自分の鍵を作成', ky:'Менин ачкычымды түзүү', 'zh-Hant':'建立我的金鑰' },
  sd_need_name: { bg:'Въведи име.', ru:'Введи имя.', uk:'Введи ім’я.', en:'Enter a name.', de:'Namen eingeben.', fr:'Saisis un nom.', es:'Introduce un nombre.', 'es-MX':'Introduce un nombre.', it:'Inserisci un nome.', pt:'Insira um nome.', ar:'أدخل اسمًا.', hi:'नाम दर्ज करें।', ja:'名前を入力。', ky:'Ат киргиз.', 'zh-Hant':'請輸入名稱。' },
  sd_my_qr_hint: { bg:'Покажи този QR на този, който събира групата. Публичният ключ е в кода; личният никога не напуска телефона.', ru:'Покажи этот QR тому, кто собирает группу. В коде — публичный ключ; личный никогда не покидает телефон.', uk:'Покажи цей QR тому, хто збирає групу. У коді — публічний ключ; особистий ніколи не залишає телефон.', en:'Show this QR to the person collecting the group. The code holds the public key; the private key never leaves the phone.', de:'Zeige diesen QR der Person, die die Gruppe sammelt. Der Code enthält den öffentlichen Schlüssel; der private verlässt das Telefon nie.', fr:'Montre ce QR à la personne qui réunit le groupe. Le code contient la clé publique ; la clé privée ne quitte jamais le téléphone.', es:'Muestra este QR a quien reúne el grupo. El código lleva la clave pública; la privada nunca sale del teléfono.', 'es-MX':'Muestra este QR a quien reúne el grupo. El código lleva la clave pública; la privada nunca sale del teléfono.', it:'Mostra questo QR a chi raccoglie il gruppo. Il codice contiene la chiave pubblica; quella privata non lascia mai il telefono.', pt:'Mostre este QR a quem reúne o grupo. O código traz a chave pública; a privada nunca sai do telefone.', ar:'أظهر هذا الرمز لمن يجمع المجموعة. يحمل الرمز المفتاح العام؛ المفتاح الخاص لا يغادر الهاتف أبدًا.', hi:'यह QR समूह बनाने वाले को दिखाएं। कोड में सार्वजनिक कुंजी है; निजी कुंजी कभी फ़ोन से बाहर नहीं जाती।', ja:'このQRをグループを集める人に見せてください。コードには公開鍵のみ；秘密鍵は端末から出ません。', ky:'Бул QR-ди топту чогулткан адамга көрсөт. Коддо ачык ачкыч; жеке ачкыч телефондон эч качан чыкпайт.', 'zh-Hant':'將此 QR 出示給召集群組的人。代碼含公鑰；私鑰永不離開手機。' },
  sd_share_qr: { bg:'Сподели като снимка', ru:'Поделиться картинкой', uk:'Поділитися картинкою', en:'Share as picture', de:'Als Bild teilen', fr:'Partager en image', es:'Compartir como imagen', 'es-MX':'Compartir como imagen', it:'Condividi come immagine', pt:'Compartilhar como imagem', ar:'مشاركة كصورة', hi:'चित्र के रूप में साझा करें', ja:'画像として共有', ky:'Сүрөт катары бөлүшүү', 'zh-Hant':'以圖片分享' },
  sd_my_id: { bg:'Идентификатор', ru:'Идентификатор', uk:'Ідентифікатор', en:'Identifier', de:'Kennung', fr:'Identifiant', es:'Identificador', 'es-MX':'Identificador', it:'Identificativo', pt:'Identificador', ar:'المعرّف', hi:'पहचानकर्ता', ja:'識別子', ky:'Идентификатор', 'zh-Hant':'識別碼' },
  sd_fp: { bg:'Отпечатък на подписа', ru:'Отпечаток подписи', uk:'Відбиток підпису', en:'Signature fingerprint', de:'Signatur-Fingerabdruck', fr:'Empreinte de signature', es:'Huella de la firma', 'es-MX':'Huella de la firma', it:'Impronta della firma', pt:'Impressão da assinatura', ar:'بصمة التوقيع', hi:'हस्ताक्षर फ़िंगरप्रिंट', ja:'署名フィンガープリント', ky:'Кол тамга изи', 'zh-Hant':'簽章指紋' },
  sd_pin_title: { bg:'ПИН на приложението (по избор)', ru:'ПИН приложения (по желанию)', uk:'ПІН застосунку (за бажанням)', en:'App PIN (optional)', de:'App-PIN (optional)', fr:'Code PIN de l’app (facultatif)', es:'PIN de la app (opcional)', 'es-MX':'PIN de la app (opcional)', it:'PIN dell’app (facoltativo)', pt:'PIN do app (opcional)', ar:'رمز PIN للتطبيق (اختياري)', hi:'ऐप PIN (वैकल्पिक)', ja:'アプリPIN（任意）', ky:'Тиркеменин PIN коду (милдеттүү эмес)', 'zh-Hant':'應用程式 PIN（選填）' },
  sd_pin_hint: { bg:'С ПИН ключовете на телефона се пазят шифровани и кръгът се отваря само след ПИН.', ru:'С ПИН ключи на телефоне хранятся зашифрованными, и круг открывается только после ПИН.', uk:'З ПІН ключі на телефоні зберігаються зашифрованими, і коло відкривається лише після ПІН.', en:'With a PIN the keys on this phone are stored encrypted and the circle opens only after the PIN.', de:'Mit PIN werden die Schlüssel auf dem Telefon verschlüsselt gespeichert und der Kreis öffnet sich erst nach der PIN.', fr:'Avec un PIN, les clés du téléphone sont stockées chiffrées et le cercle ne s’ouvre qu’après le PIN.', es:'Con PIN, las claves del teléfono se guardan cifradas y el círculo se abre solo tras el PIN.', 'es-MX':'Con PIN, las claves del teléfono se guardan cifradas y el círculo se abre solo tras el PIN.', it:'Con il PIN le chiavi sul telefono sono salvate cifrate e il cerchio si apre solo dopo il PIN.', pt:'Com PIN, as chaves no telefone ficam cifradas e o círculo abre só após o PIN.', ar:'مع رمز PIN تُحفظ المفاتيح على الهاتف مشفّرة ولا تُفتح الدائرة إلا بعد إدخاله.', hi:'PIN के साथ फ़ोन की कुंजियाँ एन्क्रिप्टेड रहती हैं और घेरा PIN के बाद ही खुलता है।', ja:'PINを設定すると端末の鍵は暗号化保存され、PIN入力後にのみ開きます。', ky:'PIN менен телефондогу ачкычтар шифрленип сакталат жана чөйрө PIN-ден кийин гана ачылат.', 'zh-Hant':'設定 PIN 後，手機上的金鑰以加密方式儲存，輸入 PIN 後才開啟圈子。' },
  sd_pin_set: { bg:'Задай ПИН', ru:'Задать ПИН', uk:'Задати ПІН', en:'Set PIN', de:'PIN setzen', fr:'Définir le PIN', es:'Establecer PIN', 'es-MX':'Establecer PIN', it:'Imposta PIN', pt:'Definir PIN', ar:'تعيين PIN', hi:'PIN सेट करें', ja:'PINを設定', ky:'PIN коюу', 'zh-Hant':'設定 PIN' },
  sd_pin_remove: { bg:'Махни ПИН', ru:'Убрать ПИН', uk:'Прибрати ПІН', en:'Remove PIN', de:'PIN entfernen', fr:'Supprimer le PIN', es:'Quitar PIN', 'es-MX':'Quitar PIN', it:'Rimuovi PIN', pt:'Remover PIN', ar:'إزالة PIN', hi:'PIN हटाएं', ja:'PINを解除', ky:'PIN алып салуу', 'zh-Hant':'移除 PIN' },
  sd_pin_enter: { bg:'Въведи ПИН', ru:'Введи ПИН', uk:'Введи ПІН', en:'Enter PIN', de:'PIN eingeben', fr:'Saisir le PIN', es:'Introduce el PIN', 'es-MX':'Introduce el PIN', it:'Inserisci il PIN', pt:'Digite o PIN', ar:'أدخل رمز PIN', hi:'PIN दर्ज करें', ja:'PINを入力', ky:'PIN киргиз', 'zh-Hant':'輸入 PIN' },
  sd_pin_unlock: { bg:'Отключи', ru:'Открыть', uk:'Відкрити', en:'Unlock', de:'Entsperren', fr:'Déverrouiller', es:'Desbloquear', 'es-MX':'Desbloquear', it:'Sblocca', pt:'Desbloquear', ar:'فتح', hi:'अनलॉक', ja:'ロック解除', ky:'Ачуу', 'zh-Hant':'解鎖' },
  sd_pin_wrong: { bg:'Грешен ПИН.', ru:'Неверный ПИН.', uk:'Невірний ПІН.', en:'Wrong PIN.', de:'Falsche PIN.', fr:'PIN incorrect.', es:'PIN incorrecto.', 'es-MX':'PIN incorrecto.', it:'PIN errato.', pt:'PIN incorreto.', ar:'رمز PIN خاطئ.', hi:'गलत PIN।', ja:'PINが違います。', ky:'PIN туура эмес.', 'zh-Hant':'PIN 錯誤。' },
  sd_pin_short: { bg:'ПИН поне 4 знака.', ru:'ПИН не менее 4 знаков.', uk:'ПІН щонайменше 4 знаки.', en:'PIN of at least 4 characters.', de:'PIN mit mindestens 4 Zeichen.', fr:'PIN d’au moins 4 caractères.', es:'PIN de al menos 4 caracteres.', 'es-MX':'PIN de al menos 4 caracteres.', it:'PIN di almeno 4 caratteri.', pt:'PIN com pelo menos 4 caracteres.', ar:'رمز PIN من 4 أحرف على الأقل.', hi:'कम से कम 4 अक्षरों का PIN।', ja:'PINは4文字以上。', ky:'PIN кеминде 4 белги.', 'zh-Hant':'PIN 至少 4 個字元。' },
  sd_pin_ok: { bg:'ПИН е зададен.', ru:'ПИН задан.', uk:'ПІН задано.', en:'PIN set.', de:'PIN gesetzt.', fr:'PIN défini.', es:'PIN establecido.', 'es-MX':'PIN establecido.', it:'PIN impostato.', pt:'PIN definido.', ar:'تم تعيين PIN.', hi:'PIN सेट हो गया।', ja:'PINを設定しました。', ky:'PIN коюлду.', 'zh-Hant':'已設定 PIN。' },
  sd_pin_removed: { bg:'ПИН е махнат.', ru:'ПИН убран.', uk:'ПІН прибрано.', en:'PIN removed.', de:'PIN entfernt.', fr:'PIN supprimé.', es:'PIN eliminado.', 'es-MX':'PIN eliminado.', it:'PIN rimosso.', pt:'PIN removido.', ar:'تمت إزالة PIN.', hi:'PIN हटा दिया गया।', ja:'PINを解除しました。', ky:'PIN алынды.', 'zh-Hant':'已移除 PIN。' },
  sd_no_id: { bg:'Първо създай своя ключ в „Моят QR".', ru:'Сначала создай свой ключ в «Мой QR».', uk:'Спершу створи свій ключ у «Мій QR».', en:'First create your key under “My QR”.', de:'Erstelle zuerst deinen Schlüssel unter „Mein QR".', fr:'Crée d’abord ta clé dans « Mon QR ».', es:'Primero crea tu clave en «Mi QR».', 'es-MX':'Primero crea tu clave en «Mi QR».', it:'Crea prima la tua chiave in «Il mio QR».', pt:'Primeiro crie sua chave em “Meu QR”.', ar:'أنشئ مفتاحك أولًا في «رمز QR الخاص بي».', hi:'पहले “मेरा QR” में अपनी कुंजी बनाएं।', ja:'まず「自分のQR」で鍵を作成してください。', ky:'Адегенде «Менин QR» бөлүмүндө ачкычыңды түз.', 'zh-Hant':'請先在「我的 QR」建立你的金鑰。' },
  sd_no_groups: { bg:'Още няма групи. Създай група (сканирай членовете) или сканирай ключ на група, който ти показват.', ru:'Групп пока нет. Создай группу (отсканируй участников) или отсканируй ключ группы, который тебе показывают.', uk:'Груп ще немає. Створи групу (відскануй учасників) або відскануй ключ групи, який тобі показують.', en:'No groups yet. Create a group (scan the members) or scan a group key shown to you.', de:'Noch keine Gruppen. Erstelle eine Gruppe (Mitglieder scannen) oder scanne einen dir gezeigten Gruppenschlüssel.', fr:'Aucun groupe. Crée un groupe (scanne les membres) ou scanne une clé de groupe qu’on te montre.', es:'Aún no hay grupos. Crea un grupo (escanea a los miembros) o escanea una clave de grupo que te muestren.', 'es-MX':'Aún no hay grupos. Crea un grupo (escanea a los miembros) o escanea una clave de grupo que te muestren.', it:'Nessun gruppo. Crea un gruppo (scansiona i membri) o scansiona una chiave di gruppo che ti mostrano.', pt:'Ainda não há grupos. Crie um grupo (escaneie os membros) ou escaneie uma chave de grupo que lhe mostrem.', ar:'لا مجموعات بعد. أنشئ مجموعة (امسح الأعضاء) أو امسح مفتاح مجموعة يُعرض عليك.', hi:'अभी कोई समूह नहीं। समूह बनाएं (सदस्यों को स्कैन करें) या दिखाई गई समूह कुंजी स्कैन करें।', ja:'グループはまだありません。グループを作成（メンバーをスキャン）するか、見せられたグループ鍵をスキャン。', ky:'Азырынча топ жок. Топ түз (мүчөлөрдү скандa) же сага көрсөтүлгөн топтун ачкычын скандa.', 'zh-Hant':'尚無群組。建立群組（掃描成員）或掃描他人出示的群組金鑰。' },
  sd_new_group: { bg:'Нова група', ru:'Новая группа', uk:'Нова група', en:'New group', de:'Neue Gruppe', fr:'Nouveau groupe', es:'Nuevo grupo', 'es-MX':'Nuevo grupo', it:'Nuovo gruppo', pt:'Novo grupo', ar:'مجموعة جديدة', hi:'नया समूह', ja:'新しいグループ', ky:'Жаңы топ', 'zh-Hant':'新群組' },
  sd_scan_key: { bg:'Сканирай ключ на група', ru:'Сканировать ключ группы', uk:'Сканувати ключ групи', en:'Scan a group key', de:'Gruppenschlüssel scannen', fr:'Scanner une clé de groupe', es:'Escanear clave de grupo', 'es-MX':'Escanear clave de grupo', it:'Scansiona chiave di gruppo', pt:'Escanear chave de grupo', ar:'مسح مفتاح مجموعة', hi:'समूह कुंजी स्कैन करें', ja:'グループ鍵をスキャン', ky:'Топтун ачкычын скандоо', 'zh-Hant':'掃描群組金鑰' },
  sd_key_file: { bg:'Отвори файл с ключ (.pupkey)', ru:'Открыть файл ключа (.pupkey)', uk:'Відкрити файл ключа (.pupkey)', en:'Open a key file (.pupkey)', de:'Schlüsseldatei öffnen (.pupkey)', fr:'Ouvrir un fichier clé (.pupkey)', es:'Abrir archivo de clave (.pupkey)', 'es-MX':'Abrir archivo de clave (.pupkey)', it:'Apri file chiave (.pupkey)', pt:'Abrir arquivo de chave (.pupkey)', ar:'فتح ملف مفتاح (.pupkey)', hi:'कुंजी फ़ाइल खोलें (.pupkey)', ja:'鍵ファイルを開く (.pupkey)', ky:'Ачкыч файлын ачуу (.pupkey)', 'zh-Hant':'開啟金鑰檔 (.pupkey)' },
  sd_group_name: { bg:'Име на групата', ru:'Название группы', uk:'Назва групи', en:'Group name', de:'Gruppenname', fr:'Nom du groupe', es:'Nombre del grupo', 'es-MX':'Nombre del grupo', it:'Nome del gruppo', pt:'Nome do grupo', ar:'اسم المجموعة', hi:'समूह का नाम', ja:'グループ名', ky:'Топтун аты', 'zh-Hant':'群組名稱' },
  sd_group_ph: { bg:'напр. Семейство, Адвокат Иванов, Съдружници', ru:'напр. Семья, Адвокат Иванов, Партнёры', uk:'напр. Родина, Адвокат Іваненко, Партнери', en:'e.g. Family, Lawyer Smith, Partners', de:'z. B. Familie, Anwalt Müller, Partner', fr:'p. ex. Famille, Avocat Dupont, Associés', es:'p. ej. Familia, Abogado Pérez, Socios', 'es-MX':'p. ej. Familia, Abogado Pérez, Socios', it:'es. Famiglia, Avvocato Rossi, Soci', pt:'ex. Família, Advogado Silva, Sócios', ar:'مثال: العائلة، المحامي أحمد، الشركاء', hi:'जैसे परिवार, वकील शर्मा, साझेदार', ja:'例：家族、弁護士、パートナー', ky:'мис. Үй-бүлө, Адвокат Асанов, Өнөктөштөр', 'zh-Hant':'例如：家人、王律師、合夥人' },
  sd_members: { bg:'Членове', ru:'Участники', uk:'Учасники', en:'Members', de:'Mitglieder', fr:'Membres', es:'Miembros', 'es-MX':'Miembros', it:'Membri', pt:'Membros', ar:'الأعضاء', hi:'सदस्य', ja:'メンバー', ky:'Мүчөлөр', 'zh-Hant':'成員' },
  sd_members_hint: { bg:'Сканирай QR кода на всеки участник — по един от всеки телефон (10 души = 10 сканирания).', ru:'Отсканируй QR каждого участника — по одному с каждого телефона (10 человек = 10 сканирований).', uk:'Відскануй QR кожного учасника — по одному з кожного телефона (10 людей = 10 сканувань).', en:'Scan each member’s QR — one per phone (10 people = 10 scans).', de:'Scanne den QR jedes Mitglieds — einen pro Telefon (10 Personen = 10 Scans).', fr:'Scanne le QR de chaque membre — un par téléphone (10 personnes = 10 scans).', es:'Escanea el QR de cada miembro — uno por teléfono (10 personas = 10 escaneos).', 'es-MX':'Escanea el QR de cada miembro — uno por teléfono (10 personas = 10 escaneos).', it:'Scansiona il QR di ogni membro — uno per telefono (10 persone = 10 scansioni).', pt:'Escaneie o QR de cada membro — um por telefone (10 pessoas = 10 leituras).', ar:'امسح رمز QR لكل عضو — واحد لكل هاتف (10 أشخاص = 10 عمليات مسح).', hi:'हर सदस्य का QR स्कैन करें — प्रति फ़ोन एक (10 लोग = 10 स्कैन)।', ja:'各メンバーのQRをスキャン — 端末ごとに1回（10人＝10回）。', ky:'Ар бир мүчөнүн QR-ин скандa — ар телефондон бирден (10 адам = 10 скандоо).', 'zh-Hant':'掃描每位成員的 QR — 每支手機一次（10 人＝10 次）。' },
  sd_scan_member: { bg:'Сканирай член', ru:'Сканировать участника', uk:'Сканувати учасника', en:'Scan a member', de:'Mitglied scannen', fr:'Scanner un membre', es:'Escanear miembro', 'es-MX':'Escanear miembro', it:'Scansiona membro', pt:'Escanear membro', ar:'مسح عضو', hi:'सदस्य स्कैन करें', ja:'メンバーをスキャン', ky:'Мүчөнү скандоо', 'zh-Hant':'掃描成員' },
  sd_from_picture: { bg:'От снимка', ru:'Из картинки', uk:'З картинки', en:'From picture', de:'Aus Bild', fr:'Depuis une image', es:'Desde imagen', 'es-MX':'Desde imagen', it:'Da immagine', pt:'De imagem', ar:'من صورة', hi:'चित्र से', ja:'画像から', ky:'Сүрөттөн', 'zh-Hant':'從圖片' },
  sd_you: { bg:'ти', ru:'ты', uk:'ти', en:'you', de:'du', fr:'toi', es:'tú', 'es-MX':'tú', it:'tu', pt:'você', ar:'أنت', hi:'आप', ja:'自分', ky:'сен', 'zh-Hant':'你' },
  sd_organizer: { bg:'организатор', ru:'организатор', uk:'організатор', en:'organizer', de:'Organisator', fr:'organisateur', es:'organizador', 'es-MX':'organizador', it:'organizzatore', pt:'organizador', ar:'المنظّم', hi:'आयोजक', ja:'主催者', ky:'уюштуруучу', 'zh-Hant':'召集人' },
  sd_remove: { bg:'Махни', ru:'Убрать', uk:'Прибрати', en:'Remove', de:'Entfernen', fr:'Retirer', es:'Quitar', 'es-MX':'Quitar', it:'Rimuovi', pt:'Remover', ar:'إزالة', hi:'हटाएं', ja:'削除', ky:'Алып салуу', 'zh-Hant':'移除' },
  sd_gen_key: { bg:'Генерирай ключ на групата', ru:'Создать ключ группы', uk:'Створити ключ групи', en:'Generate the group key', de:'Gruppenschlüssel erzeugen', fr:'Générer la clé du groupe', es:'Generar la clave del grupo', 'es-MX':'Generar la clave del grupo', it:'Genera la chiave del gruppo', pt:'Gerar a chave do grupo', ar:'توليد مفتاح المجموعة', hi:'समूह कुंजी बनाएं', ja:'グループ鍵を生成', ky:'Топтун ачкычын түзүү', 'zh-Hant':'產生群組金鑰' },
  sd_need_members: { bg:'Добави поне един член освен теб.', ru:'Добавь хотя бы одного участника кроме себя.', uk:'Додай хоча б одного учасника, крім себе.', en:'Add at least one member besides you.', de:'Füge mindestens ein Mitglied außer dir hinzu.', fr:'Ajoute au moins un membre en plus de toi.', es:'Añade al menos un miembro además de ti.', 'es-MX':'Agrega al menos un miembro además de ti.', it:'Aggiungi almeno un membro oltre a te.', pt:'Adicione pelo menos um membro além de você.', ar:'أضف عضوًا واحدًا على الأقل غيرك.', hi:'अपने अलावा कम से कम एक सदस्य जोड़ें।', ja:'自分以外に少なくとも1人追加してください。', ky:'Өзүңдөн тышкары кеминде бир мүчө кош.', 'zh-Hant':'請至少新增你以外的一位成員。' },
  sd_need_gname: { bg:'Въведи име на групата.', ru:'Введи название группы.', uk:'Введи назву групи.', en:'Enter a group name.', de:'Gruppennamen eingeben.', fr:'Saisis un nom de groupe.', es:'Introduce un nombre de grupo.', 'es-MX':'Introduce un nombre de grupo.', it:'Inserisci un nome del gruppo.', pt:'Insira um nome de grupo.', ar:'أدخل اسم المجموعة.', hi:'समूह का नाम दर्ज करें।', ja:'グループ名を入力。', ky:'Топтун атын киргиз.', 'zh-Hant':'請輸入群組名稱。' },
  sd_dup_member: { bg:'Този участник вече е добавен.', ru:'Этот участник уже добавлен.', uk:'Цей учасник уже доданий.', en:'This member is already added.', de:'Dieses Mitglied ist bereits hinzugefügt.', fr:'Ce membre est déjà ajouté.', es:'Este miembro ya está añadido.', 'es-MX':'Este miembro ya está agregado.', it:'Questo membro è già aggiunto.', pt:'Este membro já foi adicionado.', ar:'هذا العضو مضاف بالفعل.', hi:'यह सदस्य पहले से जोड़ा गया है।', ja:'このメンバーは追加済みです。', ky:'Бул мүчө мурда кошулган.', 'zh-Hant':'此成員已加入。' },
  sd_member_added: { bg:'Добавен: {0}', ru:'Добавлен: {0}', uk:'Додано: {0}', en:'Added: {0}', de:'Hinzugefügt: {0}', fr:'Ajouté : {0}', es:'Añadido: {0}', 'es-MX':'Agregado: {0}', it:'Aggiunto: {0}', pt:'Adicionado: {0}', ar:'تمت الإضافة: {0}', hi:'जोड़ा गया: {0}', ja:'追加：{0}', ky:'Кошулду: {0}', 'zh-Hant':'已新增：{0}' },
  sd_bad_qr: { bg:'Този QR не е от Pupikes Sealed Docs.', ru:'Этот QR не из Pupikes Sealed Docs.', uk:'Цей QR не з Pupikes Sealed Docs.', en:'This QR is not from Pupikes Sealed Docs.', de:'Dieser QR stammt nicht von Pupikes Sealed Docs.', fr:'Ce QR ne vient pas de Pupikes Sealed Docs.', es:'Este QR no es de Pupikes Sealed Docs.', 'es-MX':'Este QR no es de Pupikes Sealed Docs.', it:'Questo QR non è di Pupikes Sealed Docs.', pt:'Este QR não é do Pupikes Sealed Docs.', ar:'هذا الرمز ليس من Pupikes Sealed Docs.', hi:'यह QR Pupikes Sealed Docs का नहीं है।', ja:'このQRはPupikes Sealed Docsのものではありません。', ky:'Бул QR Pupikes Sealed Docs-тан эмес.', 'zh-Hant':'此 QR 非來自 Pupikes Sealed Docs。' },
  sd_not_member_qr: { bg:'Това е ключ на група, не QR на участник.', ru:'Это ключ группы, а не QR участника.', uk:'Це ключ групи, а не QR учасника.', en:'This is a group key, not a member QR.', de:'Das ist ein Gruppenschlüssel, kein Mitglieds-QR.', fr:'C’est une clé de groupe, pas un QR de membre.', es:'Esto es una clave de grupo, no un QR de miembro.', 'es-MX':'Esto es una clave de grupo, no un QR de miembro.', it:'Questa è una chiave di gruppo, non un QR di membro.', pt:'Isto é uma chave de grupo, não um QR de membro.', ar:'هذا مفتاح مجموعة وليس رمز عضو.', hi:'यह समूह कुंजी है, सदस्य QR नहीं।', ja:'これはグループ鍵で、メンバーQRではありません。', ky:'Бул топтун ачкычы, мүчөнүн QR-и эмес.', 'zh-Hant':'這是群組金鑰，不是成員 QR。' },
  sd_key_ready: { bg:'Ключ v{0} е готов. Раздай го: всеки член сканира СВОЯ QR (показвай ги един по един).', ru:'Ключ v{0} готов. Раздай его: каждый участник сканирует СВОЙ QR (показывай по одному).', uk:'Ключ v{0} готовий. Роздай його: кожен учасник сканує СВІЙ QR (показуй по одному).', en:'Key v{0} is ready. Hand it out: each member scans THEIR OWN QR (show them one at a time).', de:'Schlüssel v{0} ist bereit. Verteile ihn: jedes Mitglied scannt SEINEN QR (einzeln zeigen).', fr:'Clé v{0} prête. Distribue-la : chaque membre scanne SON QR (montre-les un par un).', es:'Clave v{0} lista. Repártela: cada miembro escanea SU QR (muéstralos de uno en uno).', 'es-MX':'Clave v{0} lista. Repártela: cada miembro escanea SU QR (muéstralos de uno en uno).', it:'Chiave v{0} pronta. Distribuiscila: ogni membro scansiona il PROPRIO QR (mostrali uno alla volta).', pt:'Chave v{0} pronta. Distribua: cada membro escaneia o SEU QR (mostre um de cada vez).', ar:'المفتاح v{0} جاهز. وزّعه: يمسح كل عضو رمزه الخاص (اعرضها واحدًا تلو الآخر).', hi:'कुंजी v{0} तैयार। बाँटें: हर सदस्य अपना QR स्कैन करे (एक-एक करके दिखाएं)।', ja:'鍵 v{0} が準備できました。各メンバーが自分のQRをスキャン（1つずつ表示）。', ky:'Ачкыч v{0} даяр. Тарат: ар бир мүчө ӨЗҮНҮН QR-ин скандайт (бирден көрсөт).', 'zh-Hant':'金鑰 v{0} 已就緒。發放：每位成員掃描自己的 QR（逐一顯示）。' },
  sd_key_for: { bg:'Ключ за: {0}', ru:'Ключ для: {0}', uk:'Ключ для: {0}', en:'Key for: {0}', de:'Schlüssel für: {0}', fr:'Clé pour : {0}', es:'Clave para: {0}', 'es-MX':'Clave para: {0}', it:'Chiave per: {0}', pt:'Chave para: {0}', ar:'مفتاح لـ: {0}', hi:'कुंजी: {0} के लिए', ja:'鍵の宛先：{0}', ky:'Ачкыч: {0} үчүн', 'zh-Hant':'金鑰給：{0}' },
  sd_prev: { bg:'← Предишен', ru:'← Предыдущий', uk:'← Попередній', en:'← Previous', de:'← Zurück', fr:'← Précédent', es:'← Anterior', 'es-MX':'← Anterior', it:'← Precedente', pt:'← Anterior', ar:'→ السابق', hi:'← पिछला', ja:'← 前へ', ky:'← Мурунку', 'zh-Hant':'← 上一位' },
  sd_next: { bg:'Следващ →', ru:'Следующий →', uk:'Наступний →', en:'Next →', de:'Weiter →', fr:'Suivant →', es:'Siguiente →', 'es-MX':'Siguiente →', it:'Successivo →', pt:'Próximo →', ar:'التالي ←', hi:'अगला →', ja:'次へ →', ky:'Кийинки →', 'zh-Hant':'下一位 →' },
  sd_send_key_file: { bg:'Изпрати ключа като файл', ru:'Отправить ключ файлом', uk:'Надіслати ключ файлом', en:'Send the key as a file', de:'Schlüssel als Datei senden', fr:'Envoyer la clé en fichier', es:'Enviar la clave como archivo', 'es-MX':'Enviar la clave como archivo', it:'Invia la chiave come file', pt:'Enviar a chave como arquivo', ar:'إرسال المفتاح كملف', hi:'कुंजी फ़ाइल के रूप में भेजें', ja:'鍵をファイルで送る', ky:'Ачкычты файл катары жөнөтүү', 'zh-Hant':'以檔案傳送金鑰' },
  sd_dist_hint: { bg:'Ключът в кода е запечатан само за този член — отваря се единствено с неговия личен ключ. За отсъстващ член ползвай „Изпрати ключа като файл".', ru:'Ключ в коде запечатан только для этого участника — открывается лишь его личным ключом. Для отсутствующего — «Отправить ключ файлом».', uk:'Ключ у коді запечатано лише для цього учасника — відкривається тільки його особистим ключем. Для відсутнього — «Надіслати ключ файлом».', en:'The key in the code is sealed for this member only — it opens solely with their private key. For an absent member use “Send the key as a file”.', de:'Der Schlüssel im Code ist nur für dieses Mitglied versiegelt — er öffnet sich allein mit dessen privatem Schlüssel. Für Abwesende: „Schlüssel als Datei senden".', fr:'La clé du code est scellée pour ce membre seul — elle ne s’ouvre qu’avec sa clé privée. Pour un absent : « Envoyer la clé en fichier ».', es:'La clave del código está sellada solo para este miembro — se abre únicamente con su clave privada. Para un ausente: «Enviar la clave como archivo».', 'es-MX':'La clave del código está sellada solo para este miembro — se abre únicamente con su clave privada. Para un ausente: «Enviar la clave como archivo».', it:'La chiave nel codice è sigillata solo per questo membro — si apre unicamente con la sua chiave privata. Per un assente: «Invia la chiave come file».', pt:'A chave no código é selada só para este membro — abre apenas com a chave privada dele. Para um ausente: “Enviar a chave como arquivo”.', ar:'المفتاح في الرمز مختوم لهذا العضو فقط — لا يُفتح إلا بمفتاحه الخاص. للغائب استخدم «إرسال المفتاح كملف».', hi:'कोड की कुंजी केवल इस सदस्य के लिए सील है — सिर्फ़ उसकी निजी कुंजी से खुलती है। अनुपस्थित सदस्य के लिए “कुंजी फ़ाइल के रूप में भेजें”।', ja:'コード内の鍵はこのメンバー専用に封印され、本人の秘密鍵でのみ開きます。不在の人には「鍵をファイルで送る」。', ky:'Коддогу ачкыч ушул мүчө үчүн гана мөөрлөнгөн — анын жеке ачкычы менен гана ачылат. Жок мүчө үчүн «Ачкычты файл катары жөнөтүү».', 'zh-Hant':'代碼中的金鑰僅為此成員封印，只能以其私鑰開啟。缺席者請用「以檔案傳送金鑰」。' },
  sd_key_saved: { bg:'Ключът на групата „{0}" (v{1}) е записан на този телефон.', ru:'Ключ группы «{0}» (v{1}) сохранён на этом телефоне.', uk:'Ключ групи «{0}» (v{1}) збережено на цьому телефоні.', en:'The key of group “{0}” (v{1}) is stored on this phone.', de:'Der Schlüssel der Gruppe „{0}" (v{1}) ist auf diesem Telefon gespeichert.', fr:'La clé du groupe « {0} » (v{1}) est enregistrée sur ce téléphone.', es:'La clave del grupo «{0}» (v{1}) se guardó en este teléfono.', 'es-MX':'La clave del grupo «{0}» (v{1}) se guardó en este teléfono.', it:'La chiave del gruppo «{0}» (v{1}) è salvata su questo telefono.', pt:'A chave do grupo “{0}” (v{1}) foi salva neste telefone.', ar:'حُفظ مفتاح المجموعة «{0}» (v{1}) على هذا الهاتف.', hi:'समूह “{0}” की कुंजी (v{1}) इस फ़ोन पर सहेजी गई।', ja:'グループ「{0}」の鍵 (v{1}) をこの端末に保存しました。', ky:'«{0}» тобунун ачкычы (v{1}) бул телефонго сакталды.', 'zh-Hant':'群組「{0}」的金鑰 (v{1}) 已儲存於此手機。' },
  sd_key_not_mine: { bg:'Този ключ е запечатан за друг участник ({0}).', ru:'Этот ключ запечатан для другого участника ({0}).', uk:'Цей ключ запечатано для іншого учасника ({0}).', en:'This key is sealed for another member ({0}).', de:'Dieser Schlüssel ist für ein anderes Mitglied versiegelt ({0}).', fr:'Cette clé est scellée pour un autre membre ({0}).', es:'Esta clave está sellada para otro miembro ({0}).', 'es-MX':'Esta clave está sellada para otro miembro ({0}).', it:'Questa chiave è sigillata per un altro membro ({0}).', pt:'Esta chave está selada para outro membro ({0}).', ar:'هذا المفتاح مختوم لعضو آخر ({0}).', hi:'यह कुंजी किसी अन्य सदस्य ({0}) के लिए सील है।', ja:'この鍵は別のメンバー（{0}）用に封印されています。', ky:'Бул ачкыч башка мүчө ({0}) үчүн мөөрлөнгөн.', 'zh-Hant':'此金鑰是為另一位成員（{0}）封印的。' },
  sd_key_open_err: { bg:'Ключът не се отваря с твоя личен ключ.', ru:'Ключ не открывается твоим личным ключом.', uk:'Ключ не відкривається твоїм особистим ключем.', en:'The key does not open with your private key.', de:'Der Schlüssel öffnet sich nicht mit deinem privaten Schlüssel.', fr:'La clé ne s’ouvre pas avec ta clé privée.', es:'La clave no se abre con tu clave privada.', 'es-MX':'La clave no se abre con tu clave privada.', it:'La chiave non si apre con la tua chiave privata.', pt:'A chave não abre com sua chave privada.', ar:'لا يُفتح المفتاح بمفتاحك الخاص.', hi:'यह कुंजी आपकी निजी कुंजी से नहीं खुलती।', ja:'この鍵はあなたの秘密鍵では開きません。', ky:'Ачкыч сенин жеке ачкычың менен ачылбайт.', 'zh-Hant':'此金鑰無法以你的私鑰開啟。' },
  sd_key_scan_hint: { bg:'Сканирай QR кода, който организаторът показва за теб, или отвори файла с ключа (.pupkey), който ти е пратил.', ru:'Отсканируй QR, который организатор показывает для тебя, или открой файл ключа (.pupkey), который он прислал.', uk:'Відскануй QR, який організатор показує для тебе, або відкрий файл ключа (.pupkey), який він надіслав.', en:'Scan the QR the organizer shows for you, or open the key file (.pupkey) they sent you.', de:'Scanne den QR, den der Organisator für dich zeigt, oder öffne die gesendete Schlüsseldatei (.pupkey).', fr:'Scanne le QR que l’organisateur te montre, ou ouvre le fichier clé (.pupkey) qu’il t’a envoyé.', es:'Escanea el QR que el organizador muestra para ti, o abre el archivo de clave (.pupkey) que te envió.', 'es-MX':'Escanea el QR que el organizador muestra para ti, o abre el archivo de clave (.pupkey) que te envió.', it:'Scansiona il QR che l’organizzatore ti mostra, oppure apri il file chiave (.pupkey) che ti ha inviato.', pt:'Escaneie o QR que o organizador mostra para você, ou abra o arquivo de chave (.pupkey) enviado.', ar:'امسح الرمز الذي يعرضه المنظّم لك، أو افتح ملف المفتاح (.pupkey) الذي أرسله.', hi:'आयोजक द्वारा आपके लिए दिखाया QR स्कैन करें, या भेजी गई कुंजी फ़ाइल (.pupkey) खोलें।', ja:'主催者があなた用に表示するQRをスキャンするか、送られた鍵ファイル (.pupkey) を開いてください。', ky:'Уюштуруучу сага көрсөткөн QR-ди скандa же ал жөнөткөн ачкыч файлын (.pupkey) ач.', 'zh-Hant':'掃描召集人為你顯示的 QR，或開啟其傳送的金鑰檔 (.pupkey)。' },
  sd_rekey: { bg:'Нов ключ (смяна на членове)', ru:'Новый ключ (смена участников)', uk:'Новий ключ (зміна учасників)', en:'New key (change members)', de:'Neuer Schlüssel (Mitglieder ändern)', fr:'Nouvelle clé (changer les membres)', es:'Nueva clave (cambiar miembros)', 'es-MX':'Nueva clave (cambiar miembros)', it:'Nuova chiave (cambia membri)', pt:'Nova chave (alterar membros)', ar:'مفتاح جديد (تغيير الأعضاء)', hi:'नई कुंजी (सदस्य बदलें)', ja:'新しい鍵（メンバー変更）', ky:'Жаңы ачкыч (мүчөлөрдү өзгөртүү)', 'zh-Hant':'新金鑰（變更成員）' },
  sd_rekey_hint: { bg:'Махни/добави членове и генерирай нов ключ — старите файлове се четат с предишния ключ, новите само от новия списък.', ru:'Убери/добавь участников и создай новый ключ — старые файлы читаются прежним ключом, новые только новым списком.', uk:'Прибери/додай учасників і створи новий ключ — старі файли читаються попереднім ключем, нові лише новим списком.', en:'Remove/add members and generate a new key — old files still open with the previous key, new ones only for the new list.', de:'Mitglieder entfernen/hinzufügen und neuen Schlüssel erzeugen — alte Dateien öffnen sich mit dem vorigen Schlüssel, neue nur für die neue Liste.', fr:'Retire/ajoute des membres et génère une nouvelle clé — les anciens fichiers s’ouvrent avec l’ancienne clé, les nouveaux seulement pour la nouvelle liste.', es:'Quita/añade miembros y genera una nueva clave — los archivos antiguos se abren con la clave anterior, los nuevos solo para la nueva lista.', 'es-MX':'Quita/agrega miembros y genera una nueva clave — los archivos antiguos se abren con la clave anterior, los nuevos solo para la nueva lista.', it:'Rimuovi/aggiungi membri e genera una nuova chiave — i vecchi file si aprono con la chiave precedente, i nuovi solo per la nuova lista.', pt:'Remova/adicione membros e gere nova chave — arquivos antigos abrem com a chave anterior, os novos só para a nova lista.', ar:'أزل/أضف أعضاء وولّد مفتاحًا جديدًا — الملفات القديمة تُفتح بالمفتاح السابق، والجديدة للقائمة الجديدة فقط.', hi:'सदस्य हटाएं/जोड़ें और नई कुंजी बनाएं — पुरानी फ़ाइलें पिछली कुंजी से खुलती हैं, नई केवल नई सूची के लिए।', ja:'メンバーを削除/追加して新しい鍵を生成 — 旧ファイルは旧鍵で、新ファイルは新リストのみ。', ky:'Мүчөлөрдү алып сал/кош жана жаңы ачкыч түз — эски файлдар мурунку ачкыч менен, жаңылары жаңы тизме үчүн гана.', 'zh-Hant':'移除／新增成員並產生新金鑰 — 舊檔案仍以舊金鑰開啟，新檔案僅限新名單。' },
  sd_show_keys: { bg:'Раздай ключа (QR)', ru:'Раздать ключ (QR)', uk:'Роздати ключ (QR)', en:'Hand out the key (QR)', de:'Schlüssel verteilen (QR)', fr:'Distribuer la clé (QR)', es:'Repartir la clave (QR)', 'es-MX':'Repartir la clave (QR)', it:'Distribuisci la chiave (QR)', pt:'Distribuir a chave (QR)', ar:'توزيع المفتاح (QR)', hi:'कुंजी बाँटें (QR)', ja:'鍵を配る（QR）', ky:'Ачкычты таратуу (QR)', 'zh-Hant':'發放金鑰（QR）' },
  sd_delete_group: { bg:'Изтрий групата от този телефон', ru:'Удалить группу с этого телефона', uk:'Видалити групу з цього телефона', en:'Delete the group from this phone', de:'Gruppe von diesem Telefon löschen', fr:'Supprimer le groupe de ce téléphone', es:'Eliminar el grupo de este teléfono', 'es-MX':'Eliminar el grupo de este teléfono', it:'Elimina il gruppo da questo telefono', pt:'Apagar o grupo deste telefone', ar:'حذف المجموعة من هذا الهاتف', hi:'इस फ़ोन से समूह हटाएं', ja:'この端末からグループを削除', ky:'Топту бул телефондон өчүрүү', 'zh-Hant':'從此手機刪除群組' },
  sd_confirm: { bg:'Сигурен ли си? Ключовете и файловете на групата се трият от този телефон.', ru:'Точно? Ключи и файлы группы будут удалены с этого телефона.', uk:'Точно? Ключі й файли групи буде видалено з цього телефона.', en:'Are you sure? The group keys and files are removed from this phone.', de:'Sicher? Schlüssel und Dateien der Gruppe werden von diesem Telefon gelöscht.', fr:'Sûr ? Les clés et fichiers du groupe seront supprimés de ce téléphone.', es:'¿Seguro? Las claves y archivos del grupo se borran de este teléfono.', 'es-MX':'¿Seguro? Las claves y archivos del grupo se borran de este teléfono.', it:'Sicuro? Chiavi e file del gruppo verranno rimossi da questo telefono.', pt:'Tem certeza? As chaves e arquivos do grupo serão apagados deste telefone.', ar:'هل أنت متأكد؟ ستُحذف مفاتيح المجموعة وملفاتها من هذا الهاتف.', hi:'क्या आप सुनिश्चित हैं? समूह की कुंजियाँ और फ़ाइलें इस फ़ोन से हट जाएंगी।', ja:'本当に？グループの鍵とファイルがこの端末から削除されます。', ky:'Ишенесиңби? Топтун ачкычтары жана файлдары бул телефондон өчүрүлөт.', 'zh-Hant':'確定嗎？群組金鑰與檔案將從此手機移除。' },
  sd_send_file: { bg:'Изпрати файл', ru:'Отправить файл', uk:'Надіслати файл', en:'Send a file', de:'Datei senden', fr:'Envoyer un fichier', es:'Enviar archivo', 'es-MX':'Enviar archivo', it:'Invia file', pt:'Enviar arquivo', ar:'إرسال ملف', hi:'फ़ाइल भेजें', ja:'ファイルを送る', ky:'Файл жөнөтүү', 'zh-Hant':'傳送檔案' },
  sd_feed_empty: { bg:'Още няма файлове в тази група. „Изпрати файл" го запечатва и отваря споделянето; получен .pupsealed се отваря от „Получен файл".', ru:'В этой группе пока нет файлов. «Отправить файл» запечатывает его и открывает «Поделиться»; полученный .pupsealed открывается через «Полученный файл».', uk:'У цій групі ще немає файлів. «Надіслати файл» запечатує його й відкриває «Поділитися»; отриманий .pupsealed відкривається через «Отриманий файл».', en:'No files in this group yet. “Send a file” seals it and opens sharing; a received .pupsealed opens from “Received file”.', de:'Noch keine Dateien in dieser Gruppe. „Datei senden" versiegelt sie und öffnet das Teilen; eine empfangene .pupsealed öffnest du unter „Empfangene Datei".', fr:'Aucun fichier dans ce groupe. « Envoyer un fichier » le scelle et ouvre le partage ; un .pupsealed reçu s’ouvre via « Fichier reçu ».', es:'Aún no hay archivos en este grupo. «Enviar archivo» lo sella y abre compartir; un .pupsealed recibido se abre desde «Archivo recibido».', 'es-MX':'Aún no hay archivos en este grupo. «Enviar archivo» lo sella y abre compartir; un .pupsealed recibido se abre desde «Archivo recibido».', it:'Nessun file in questo gruppo. «Invia file» lo sigilla e apre la condivisione; un .pupsealed ricevuto si apre da «File ricevuto».', pt:'Ainda não há arquivos neste grupo. “Enviar arquivo” o sela e abre o compartilhamento; um .pupsealed recebido abre em “Arquivo recebido”.', ar:'لا ملفات في هذه المجموعة بعد. «إرسال ملف» يختمه ويفتح المشاركة؛ ويُفتح ملف .pupsealed المستلم من «ملف مستلم».', hi:'इस समूह में अभी फ़ाइलें नहीं। “फ़ाइल भेजें” उसे सील कर साझा करना खोलता है; प्राप्त .pupsealed “प्राप्त फ़ाइल” से खुलती है।', ja:'このグループにはまだファイルがありません。「ファイルを送る」で封印して共有；受信した .pupsealed は「受信ファイル」から開きます。', ky:'Бул топто азырынча файл жок. «Файл жөнөтүү» аны мөөрлөп, бөлүшүүнү ачат; алынган .pupsealed «Алынган файл» аркылуу ачылат.', 'zh-Hant':'此群組尚無檔案。「傳送檔案」會封印並開啟分享；收到的 .pupsealed 從「收到的檔案」開啟。' },
  sd_sent: { bg:'изпратен', ru:'отправлен', uk:'надіслано', en:'sent', de:'gesendet', fr:'envoyé', es:'enviado', 'es-MX':'enviado', it:'inviato', pt:'enviado', ar:'مُرسل', hi:'भेजा गया', ja:'送信', ky:'жөнөтүлдү', 'zh-Hant':'已傳送' },
  sd_received: { bg:'получен', ru:'получен', uk:'отримано', en:'received', de:'empfangen', fr:'reçu', es:'recibido', 'es-MX':'recibido', it:'ricevuto', pt:'recebido', ar:'مستلم', hi:'प्राप्त', ja:'受信', ky:'алынды', 'zh-Hant':'已接收' },
  sd_verified: { bg:'подписът е проверен', ru:'подпись проверена', uk:'підпис перевірено', en:'signature verified', de:'Signatur geprüft', fr:'signature vérifiée', es:'firma verificada', 'es-MX':'firma verificada', it:'firma verificata', pt:'assinatura verificada', ar:'تم التحقق من التوقيع', hi:'हस्ताक्षर सत्यापित', ja:'署名検証済み', ky:'кол тамга текшерилди', 'zh-Hant':'簽章已驗證' },
  sd_unverified: { bg:'ПОДПИСЪТ НЕ СЪВПАДА', ru:'ПОДПИСЬ НЕ СОВПАДАЕТ', uk:'ПІДПИС НЕ ЗБІГАЄТЬСЯ', en:'SIGNATURE DOES NOT MATCH', de:'SIGNATUR STIMMT NICHT', fr:'SIGNATURE NON CONCORDANTE', es:'LA FIRMA NO COINCIDE', 'es-MX':'LA FIRMA NO COINCIDE', it:'LA FIRMA NON CORRISPONDE', pt:'ASSINATURA NÃO CONFERE', ar:'التوقيع غير مطابق', hi:'हस्ताक्षर मेल नहीं खाता', ja:'署名が一致しません', ky:'КОЛ ТАМГА ДАЛ КЕЛБЕЙТ', 'zh-Hant':'簽章不符' },
  sd_open: { bg:'Отвори', ru:'Открыть', uk:'Відкрити', en:'Open', de:'Öffnen', fr:'Ouvrir', es:'Abrir', 'es-MX':'Abrir', it:'Apri', pt:'Abrir', ar:'فتح', hi:'खोलें', ja:'開く', ky:'Ачуу', 'zh-Hant':'開啟' },
  sd_save: { bg:'Запази / сподели разкодирания', ru:'Сохранить / поделиться расшифрованным', uk:'Зберегти / поділитися розшифрованим', en:'Save / share the decrypted file', de:'Entschlüsselte Datei speichern / teilen', fr:'Enregistrer / partager le fichier déchiffré', es:'Guardar / compartir el archivo descifrado', 'es-MX':'Guardar / compartir el archivo descifrado', it:'Salva / condividi il file decifrato', pt:'Salvar / compartilhar o arquivo decifrado', ar:'حفظ / مشاركة الملف المفكوك', hi:'डिक्रिप्ट फ़ाइल सहेजें / साझा करें', ja:'復号したファイルを保存／共有', ky:'Чечмеленген файлды сактоо / бөлүшүү', 'zh-Hant':'儲存／分享已解密檔案' },
  sd_share_sealed: { bg:'Сподели запечатания (.pupsealed)', ru:'Поделиться запечатанным (.pupsealed)', uk:'Поділитися запечатаним (.pupsealed)', en:'Share the sealed file (.pupsealed)', de:'Versiegelte Datei teilen (.pupsealed)', fr:'Partager le fichier scellé (.pupsealed)', es:'Compartir el archivo sellado (.pupsealed)', 'es-MX':'Compartir el archivo sellado (.pupsealed)', it:'Condividi il file sigillato (.pupsealed)', pt:'Compartilhar o arquivo selado (.pupsealed)', ar:'مشاركة الملف المختوم (.pupsealed)', hi:'सील फ़ाइल साझा करें (.pupsealed)', ja:'封印ファイルを共有 (.pupsealed)', ky:'Мөөрлөнгөн файлды бөлүшүү (.pupsealed)', 'zh-Hant':'分享封印檔 (.pupsealed)' },
  sd_delete: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Apagar', ar:'حذف', hi:'हटाएं', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  sd_sealing: { bg:'Запечатвам…', ru:'Запечатываю…', uk:'Запечатую…', en:'Sealing…', de:'Versiegle…', fr:'Scellage…', es:'Sellando…', 'es-MX':'Sellando…', it:'Sigillo…', pt:'Selando…', ar:'جارٍ الختم…', hi:'सील कर रहा…', ja:'封印中…', ky:'Мөөрлөнүүдө…', 'zh-Hant':'封印中…' },
  sd_sealed_ok: { bg:'Файлът е запечатан и готов за изпращане — избери канал (Telegram, WhatsApp, имейл, Bluetooth…).', ru:'Файл запечатан и готов к отправке — выбери канал (Telegram, WhatsApp, почта, Bluetooth…).', uk:'Файл запечатано й готово до надсилання — обери канал (Telegram, WhatsApp, пошта, Bluetooth…).', en:'The file is sealed and ready to send — pick a channel (Telegram, WhatsApp, e-mail, Bluetooth…).', de:'Die Datei ist versiegelt und sendebereit — wähle einen Kanal (Telegram, WhatsApp, E-Mail, Bluetooth…).', fr:'Le fichier est scellé et prêt à l’envoi — choisis un canal (Telegram, WhatsApp, e-mail, Bluetooth…).', es:'El archivo está sellado y listo para enviar — elige un canal (Telegram, WhatsApp, correo, Bluetooth…).', 'es-MX':'El archivo está sellado y listo para enviar — elige un canal (Telegram, WhatsApp, correo, Bluetooth…).', it:'Il file è sigillato e pronto per l’invio — scegli un canale (Telegram, WhatsApp, e-mail, Bluetooth…).', pt:'O arquivo está selado e pronto para envio — escolha um canal (Telegram, WhatsApp, e-mail, Bluetooth…).', ar:'الملف مختوم وجاهز للإرسال — اختر قناة (تيليغرام، واتساب، بريد، بلوتوث…).', hi:'फ़ाइल सील है और भेजने के लिए तैयार — चैनल चुनें (Telegram, WhatsApp, ईमेल, Bluetooth…)।', ja:'ファイルは封印され送信準備完了 — 送信手段を選択（Telegram、WhatsApp、メール、Bluetooth…）。', ky:'Файл мөөрлөндү жана жөнөтүүгө даяр — канал танда (Telegram, WhatsApp, почта, Bluetooth…).', 'zh-Hant':'檔案已封印並可傳送 — 選擇管道（Telegram、WhatsApp、電子郵件、藍牙…）。' },
  sd_open_received: { bg:'Отвори получен файл (.pupsealed)', ru:'Открыть полученный файл (.pupsealed)', uk:'Відкрити отриманий файл (.pupsealed)', en:'Open a received file (.pupsealed)', de:'Empfangene Datei öffnen (.pupsealed)', fr:'Ouvrir un fichier reçu (.pupsealed)', es:'Abrir archivo recibido (.pupsealed)', 'es-MX':'Abrir archivo recibido (.pupsealed)', it:'Apri file ricevuto (.pupsealed)', pt:'Abrir arquivo recebido (.pupsealed)', ar:'فتح ملف مستلم (.pupsealed)', hi:'प्राप्त फ़ाइल खोलें (.pupsealed)', ja:'受信ファイルを開く (.pupsealed)', ky:'Алынган файлды ачуу (.pupsealed)', 'zh-Hant':'開啟收到的檔案 (.pupsealed)' },
  sd_open_hint: { bg:'Избери файла .pupsealed, който ти дойде по Telegram/WhatsApp/имейл/Bluetooth — разкодира се само на този телефон, ако си член на групата.', ru:'Выбери файл .pupsealed, пришедший по Telegram/WhatsApp/почте/Bluetooth — он расшифруется только на этом телефоне, если ты участник группы.', uk:'Обери файл .pupsealed, що прийшов через Telegram/WhatsApp/пошту/Bluetooth — він розшифрується лише на цьому телефоні, якщо ти учасник групи.', en:'Pick the .pupsealed file that arrived by Telegram/WhatsApp/e-mail/Bluetooth — it decrypts only on this phone, if you are a member of the group.', de:'Wähle die per Telegram/WhatsApp/E-Mail/Bluetooth erhaltene .pupsealed-Datei — sie wird nur auf diesem Telefon entschlüsselt, wenn du Mitglied der Gruppe bist.', fr:'Choisis le fichier .pupsealed reçu par Telegram/WhatsApp/e-mail/Bluetooth — il ne se déchiffre que sur ce téléphone, si tu es membre du groupe.', es:'Elige el archivo .pupsealed que llegó por Telegram/WhatsApp/correo/Bluetooth — se descifra solo en este teléfono, si eres miembro del grupo.', 'es-MX':'Elige el archivo .pupsealed que llegó por Telegram/WhatsApp/correo/Bluetooth — se descifra solo en este teléfono, si eres miembro del grupo.', it:'Scegli il file .pupsealed arrivato via Telegram/WhatsApp/e-mail/Bluetooth — si decifra solo su questo telefono, se sei membro del gruppo.', pt:'Escolha o arquivo .pupsealed que chegou por Telegram/WhatsApp/e-mail/Bluetooth — ele é decifrado só neste telefone, se você for membro do grupo.', ar:'اختر ملف .pupsealed الذي وصلك عبر تيليغرام/واتساب/البريد/بلوتوث — يُفكّ فقط على هذا الهاتف إن كنت عضوًا في المجموعة.', hi:'Telegram/WhatsApp/ईमेल/Bluetooth से आई .pupsealed फ़ाइल चुनें — यदि आप समूह के सदस्य हैं तो यह केवल इस फ़ोन पर डिक्रिप्ट होती है।', ja:'Telegram/WhatsApp/メール/Bluetoothで届いた .pupsealed を選択 — グループのメンバーであればこの端末でのみ復号されます。', ky:'Telegram/WhatsApp/почта/Bluetooth аркылуу келген .pupsealed файлын танда — топтун мүчөсү болсоң, ал бул телефондо гана чечмеленет.', 'zh-Hant':'選擇經 Telegram/WhatsApp/電子郵件/藍牙收到的 .pupsealed 檔 — 若你是群組成員，僅在此手機解密。' },
  sd_not_sealed: { bg:'Това не е файл .pupsealed.', ru:'Это не файл .pupsealed.', uk:'Це не файл .pupsealed.', en:'This is not a .pupsealed file.', de:'Das ist keine .pupsealed-Datei.', fr:'Ce n’est pas un fichier .pupsealed.', es:'Esto no es un archivo .pupsealed.', 'es-MX':'Esto no es un archivo .pupsealed.', it:'Questo non è un file .pupsealed.', pt:'Isto não é um arquivo .pupsealed.', ar:'هذا ليس ملف .pupsealed.', hi:'यह .pupsealed फ़ाइल नहीं है।', ja:'これは .pupsealed ファイルではありません。', ky:'Бул .pupsealed файлы эмес.', 'zh-Hant':'這不是 .pupsealed 檔案。' },
  sd_no_group_key: { bg:'На този телефон няма ключ за тази група (или за тази версия на ключа). Поискай ключа от организатора.', ru:'На этом телефоне нет ключа этой группы (или этой версии ключа). Попроси ключ у организатора.', uk:'На цьому телефоні немає ключа цієї групи (або цієї версії ключа). Попроси ключ в організатора.', en:'This phone has no key for this group (or this key version). Ask the organizer for the key.', de:'Dieses Telefon hat keinen Schlüssel für diese Gruppe (oder diese Schlüsselversion). Bitte den Organisator um den Schlüssel.', fr:'Ce téléphone n’a pas de clé pour ce groupe (ou cette version de clé). Demande la clé à l’organisateur.', es:'Este teléfono no tiene clave para este grupo (o esta versión de clave). Pide la clave al organizador.', 'es-MX':'Este teléfono no tiene clave para este grupo (o esta versión de clave). Pide la clave al organizador.', it:'Questo telefono non ha la chiave per questo gruppo (o questa versione). Chiedi la chiave all’organizzatore.', pt:'Este telefone não tem chave para este grupo (ou esta versão da chave). Peça a chave ao organizador.', ar:'لا يملك هذا الهاتف مفتاحًا لهذه المجموعة (أو لهذا الإصدار). اطلب المفتاح من المنظّم.', hi:'इस फ़ोन पर इस समूह (या इस कुंजी संस्करण) की कुंजी नहीं है। आयोजक से कुंजी माँगें।', ja:'この端末にはこのグループ（またはこの鍵バージョン）の鍵がありません。主催者に鍵を求めてください。', ky:'Бул телефондо бул топтун (же бул ачкыч версиясынын) ачкычы жок. Уюштуруучудан ачкыч сура.', 'zh-Hant':'此手機沒有該群組（或該金鑰版本）的金鑰。請向召集人索取。' },
  sd_decrypt_err: { bg:'Разкодирането не успя: {0}', ru:'Расшифровка не удалась: {0}', uk:'Розшифрування не вдалося: {0}', en:'Decryption failed: {0}', de:'Entschlüsselung fehlgeschlagen: {0}', fr:'Échec du déchiffrement : {0}', es:'Falló el descifrado: {0}', 'es-MX':'Falló el descifrado: {0}', it:'Decifratura fallita: {0}', pt:'Falha ao decifrar: {0}', ar:'فشل فك التشفير: {0}', hi:'डिक्रिप्शन विफल: {0}', ja:'復号に失敗：{0}', ky:'Чечмелөө ишке ашкан жок: {0}', 'zh-Hant':'解密失敗：{0}' },
  sd_from: { bg:'От', ru:'От', uk:'Від', en:'From', de:'Von', fr:'De', es:'De', 'es-MX':'De', it:'Da', pt:'De', ar:'من', hi:'से', ja:'差出人', ky:'Кимден', 'zh-Hant':'來自' },
  sd_preview_na: { bg:'Няма преглед за този тип файл — запази го или го сподели с подходящо приложение.', ru:'Для этого типа нет предпросмотра — сохрани или открой подходящим приложением.', uk:'Для цього типу немає перегляду — збережи або відкрий відповідним застосунком.', en:'No preview for this file type — save it or share it with a suitable app.', de:'Keine Vorschau für diesen Dateityp — speichern oder mit passender App teilen.', fr:'Pas d’aperçu pour ce type — enregistre-le ou partage-le avec une app adaptée.', es:'Sin vista previa para este tipo — guárdalo o compártelo con una app adecuada.', 'es-MX':'Sin vista previa para este tipo — guárdalo o compártelo con una app adecuada.', it:'Nessuna anteprima per questo tipo — salvalo o condividilo con un’app adatta.', pt:'Sem pré-visualização para este tipo — salve ou compartilhe com um app adequado.', ar:'لا معاينة لهذا النوع — احفظه أو شاركه مع تطبيق مناسب.', hi:'इस प्रकार का पूर्वावलोकन नहीं — सहेजें या उपयुक्त ऐप से साझा करें।', ja:'この種類はプレビューできません — 保存するか適したアプリで開いてください。', ky:'Бул түр үчүн алдын ала көрүү жок — сакта же ылайыктуу тиркеме менен бөлүш.', 'zh-Hant':'此類型無法預覽 — 請儲存或以合適的應用程式分享。' },
  sd_sender_unknown: { bg:'Подателят не е в списъка на членовете на групата!', ru:'Отправитель не в списке участников группы!', uk:'Відправник не в списку учасників групи!', en:'The sender is not in the group’s member list!', de:'Der Absender steht nicht in der Mitgliederliste der Gruppe!', fr:'L’expéditeur n’est pas dans la liste des membres du groupe !', es:'¡El remitente no está en la lista de miembros del grupo!', 'es-MX':'¡El remitente no está en la lista de miembros del grupo!', it:'Il mittente non è nell’elenco dei membri del gruppo!', pt:'O remetente não está na lista de membros do grupo!', ar:'المرسل ليس في قائمة أعضاء المجموعة!', hi:'भेजने वाला समूह की सदस्य सूची में नहीं है!', ja:'送信者はグループのメンバー一覧にいません！', ky:'Жөнөтүүчү топтун мүчөлөр тизмесинде жок!', 'zh-Hant':'寄件者不在群組成員名單中！' },
  sd_key_changed: { bg:'ВНИМАНИЕ: ключът за подпис на подателя не съвпада с този от списъка на групата!', ru:'ВНИМАНИЕ: ключ подписи отправителя не совпадает с ключом из списка группы!', uk:'УВАГА: ключ підпису відправника не збігається з ключем зі списку групи!', en:'WARNING: the sender’s signing key does not match the one in the group list!', de:'ACHTUNG: Der Signaturschlüssel des Absenders stimmt nicht mit dem in der Gruppenliste überein!', fr:'ATTENTION : la clé de signature de l’expéditeur ne correspond pas à celle de la liste du groupe !', es:'ATENCIÓN: la clave de firma del remitente no coincide con la de la lista del grupo.', 'es-MX':'ATENCIÓN: la clave de firma del remitente no coincide con la de la lista del grupo.', it:'ATTENZIONE: la chiave di firma del mittente non corrisponde a quella dell’elenco del gruppo!', pt:'ATENÇÃO: a chave de assinatura do remetente não confere com a da lista do grupo!', ar:'تحذير: مفتاح توقيع المرسل لا يطابق المفتاح في قائمة المجموعة!', hi:'चेतावनी: भेजने वाले की हस्ताक्षर कुंजी समूह सूची वाली से मेल नहीं खाती!', ja:'警告：送信者の署名鍵がグループ一覧のものと一致しません！', ky:'ЭСКЕРТҮҮ: жөнөтүүчүнүн кол тамга ачкычы топтун тизмесиндегиге дал келбейт!', 'zh-Hant':'警告：寄件者的簽章金鑰與群組名單不符！' },
  sd_cam_hint: { bg:'Насочи камерата към QR кода.', ru:'Наведи камеру на QR-код.', uk:'Наведи камеру на QR-код.', en:'Point the camera at the QR code.', de:'Richte die Kamera auf den QR-Code.', fr:'Pointe la caméra vers le code QR.', es:'Apunta la cámara al código QR.', 'es-MX':'Apunta la cámara al código QR.', it:'Inquadra il codice QR con la fotocamera.', pt:'Aponte a câmera para o código QR.', ar:'وجّه الكاميرا نحو رمز QR.', hi:'कैमरे को QR कोड की ओर करें।', ja:'カメラをQRコードに向けてください。', ky:'Камераны QR кодго багытта.', 'zh-Hant':'將相機對準 QR 碼。' },
  sd_cam_stop: { bg:'Спри камерата', ru:'Остановить камеру', uk:'Зупинити камеру', en:'Stop camera', de:'Kamera stoppen', fr:'Arrêter la caméra', es:'Detener cámara', 'es-MX':'Detener cámara', it:'Ferma fotocamera', pt:'Parar câmera', ar:'إيقاف الكاميرا', hi:'कैमरा रोकें', ja:'カメラを停止', ky:'Камераны токтотуу', 'zh-Hant':'停止相機' },
  sd_cam_err: { bg:'Камерата не е достъпна: {0}', ru:'Камера недоступна: {0}', uk:'Камера недоступна: {0}', en:'Camera unavailable: {0}', de:'Kamera nicht verfügbar: {0}', fr:'Caméra indisponible : {0}', es:'Cámara no disponible: {0}', 'es-MX':'Cámara no disponible: {0}', it:'Fotocamera non disponibile: {0}', pt:'Câmera indisponível: {0}', ar:'الكاميرا غير متاحة: {0}', hi:'कैमरा उपलब्ध नहीं: {0}', ja:'カメラが利用できません：{0}', ky:'Камера жеткиликсиз: {0}', 'zh-Hant':'相機無法使用：{0}' },
  sd_qr_not_found: { bg:'QR код не е разпознат в снимката.', ru:'QR-код на картинке не распознан.', uk:'QR-код на картинці не розпізнано.', en:'No QR code recognized in the picture.', de:'Kein QR-Code im Bild erkannt.', fr:'Aucun code QR reconnu dans l’image.', es:'No se reconoció ningún código QR en la imagen.', 'es-MX':'No se reconoció ningún código QR en la imagen.', it:'Nessun codice QR riconosciuto nell’immagine.', pt:'Nenhum código QR reconhecido na imagem.', ar:'لم يُتعرَّف على رمز QR في الصورة.', hi:'चित्र में कोई QR कोड नहीं पहचाना गया।', ja:'画像内にQRコードを認識できませんでした。', ky:'Сүрөттө QR код таанылган жок.', 'zh-Hant':'圖片中未辨識到 QR 碼。' },
  sd_back: { bg:'← Групи', ru:'← Группы', uk:'← Групи', en:'← Groups', de:'← Gruppen', fr:'← Groupes', es:'← Grupos', 'es-MX':'← Grupos', it:'← Gruppi', pt:'← Grupos', ar:'→ المجموعات', hi:'← समूह', ja:'← グループ', ky:'← Топтор', 'zh-Hant':'← 群組' },
  sd_back_group: { bg:'← Към групата', ru:'← К группе', uk:'← До групи', en:'← Back to group', de:'← Zur Gruppe', fr:'← Retour au groupe', es:'← Volver al grupo', 'es-MX':'← Volver al grupo', it:'← Al gruppo', pt:'← Voltar ao grupo', ar:'→ إلى المجموعة', hi:'← समूह पर लौटें', ja:'← グループへ戻る', ky:'← Топко кайтуу', 'zh-Hant':'← 回到群組' },
  sd_key_v: { bg:'ключ v{0}', ru:'ключ v{0}', uk:'ключ v{0}', en:'key v{0}', de:'Schlüssel v{0}', fr:'clé v{0}', es:'clave v{0}', 'es-MX':'clave v{0}', it:'chiave v{0}', pt:'chave v{0}', ar:'مفتاح v{0}', hi:'कुंजी v{0}', ja:'鍵 v{0}', ky:'ачкыч v{0}', 'zh-Hant':'金鑰 v{0}' },
  sd_members_n: { bg:'{0} членове', ru:'{0} участн.', uk:'{0} учасн.', en:'{0} members', de:'{0} Mitglieder', fr:'{0} membres', es:'{0} miembros', 'es-MX':'{0} miembros', it:'{0} membri', pt:'{0} membros', ar:'{0} أعضاء', hi:'{0} सदस्य', ja:'{0}人', ky:'{0} мүчө', 'zh-Hant':'{0} 位成員' },
  sd_working: { bg:'Работя…', ru:'Работаю…', uk:'Працюю…', en:'Working…', de:'Arbeite…', fr:'Traitement…', es:'Procesando…', 'es-MX':'Procesando…', it:'Elaboro…', pt:'Processando…', ar:'جارٍ العمل…', hi:'कार्य जारी…', ja:'処理中…', ky:'Иштөөдө…', 'zh-Hant':'處理中…' },
  sd_read_err: { bg:'Файлът не можа да се прочете: {0}', ru:'Не удалось прочитать файл: {0}', uk:'Не вдалося прочитати файл: {0}', en:'The file could not be read: {0}', de:'Die Datei konnte nicht gelesen werden: {0}', fr:'Impossible de lire le fichier : {0}', es:'No se pudo leer el archivo: {0}', 'es-MX':'No se pudo leer el archivo: {0}', it:'Impossibile leggere il file: {0}', pt:'Não foi possível ler o arquivo: {0}', ar:'تعذّرت قراءة الملف: {0}', hi:'फ़ाइल पढ़ी नहीं जा सकी: {0}', ja:'ファイルを読めませんでした：{0}', ky:'Файл окулган жок: {0}', 'zh-Hant':'無法讀取檔案：{0}' }
});

export const title = 'Затворен кръг';

const CSS = `
.sd-card{background:var(--bg-2);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.sd-main{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.sd-list{display:flex;flex-direction:column;gap:8px}
.sd-item{display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer}
.sd-item .sd-ic{font-size:1.5em;width:32px;text-align:center}
.sd-item .sd-t{flex:1;min-width:0}
.sd-item .sd-t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sd-item .sd-t small{color:var(--text-dim)}
.sd-badge{font-size:.72em;border-radius:8px;padding:2px 7px;background:var(--bg-3);color:var(--text-dim);white-space:nowrap}
.sd-badge.ok{background:rgba(46,160,67,.18);color:#56d364}
.sd-badge.bad{background:rgba(248,81,73,.18);color:#ff7b72}
.sd-qr{display:flex;justify-content:center;margin:12px 0}
.sd-qr canvas{background:#fff;border-radius:12px;padding:8px;max-width:100%;height:auto}
.sd-cam{position:relative;margin-top:10px}
.sd-cam video{width:100%;border-radius:12px;background:#000}
.sd-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.sd-btns .btn{width:auto;flex:1;min-width:120px}
.sd-warn{color:#ff7b72;font-weight:700;margin-top:8px}
.sd-prev img{max-width:100%;border-radius:12px;margin-top:10px}
.sd-prev pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px;max-height:40vh;overflow:auto;margin-top:10px}
.sd-mono{font-family:ui-monospace,monospace;font-size:.85em;color:var(--text-dim);word-break:break-all}
`;

// ---------- общи помощни ----------
const $ = (root, s) => root.querySelector(s);
function when(ms) { try { return new Date(ms).toLocaleString(); } catch (e) { return ''; } }
function dataUrlBytes(b64) { return SC.unb64std(b64); }
function qrText(code) {
  if (!code) return null;
  try { if (code.binaryData && code.binaryData.length) return new TextDecoder('utf-8').decode(new Uint8Array(code.binaryData)); } catch (e) {}
  return code.data;
}
async function drawQR(canvas, text) {
  const w = Math.min(Math.max(280, (window.innerWidth || 360) - 60), 480);
  const lvl = text.length > 600 ? 'L' : 'M';
  await QRCode.toCanvas(canvas, text, { width: w, errorCorrectionLevel: lvl, margin: 1 });
}
function decodeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        resolve(qrText(jsQR(d.data, d.width, d.height)));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('image'));
    img.src = dataUrl;
  });
}

// Скенер с камера: рисува видео в host, връща текста на първия разчетен QR (или null при спиране).
let camStop = null;
function scanCamera(host) {
  if (camStop) camStop();
  return new Promise(async (resolve) => {
    host.innerHTML = `<div class="sd-cam"><p class="hint">${esc(t('sd_cam_hint'))}</p><video playsinline muted></video>
      <button class="btn sec" style="margin-top:8px">${esc(t('sd_cam_stop'))}</button></div>`;
    const v = host.querySelector('video');
    let stream = null, timer = null, done = false;
    const finish = (val) => {
      if (done) return; done = true;
      if (timer) clearTimeout(timer);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      host.innerHTML = ''; camStop = null; resolve(val);
    };
    camStop = () => finish(null);
    host.querySelector('button').addEventListener('click', () => finish(null));
    try {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } }); }
      catch (e1) { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
      v.srcObject = stream; await v.play();
    } catch (e) { finish(null); alert(tf('sd_cam_err', e.message || e)); return; }
    const c = document.createElement('canvas');
    const loop = () => {
      if (done) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
        const txt = qrText(code);
        if (txt) { finish(txt); return; }
      }
      timer = setTimeout(loop, 120);
    };
    loop();
  });
}
async function scanPicture() {
  const f = await pickBinaryFile('image/*');
  if (!f) return null;
  return decodeImage(f.dataUrl);
}
window.addEventListener('hashchange', () => { if (camStop) camStop(); });

// ---------- състояние на екрана ----------
let V = null;              // отключен сейф
const st = { view: 'home', tab: 'groups', gid: null, draft: null, dist: null, opened: null, msg: null };
function group(gid) { return (V.groups || []).find((g) => g.g === gid) || null; }
function me() { return V.identity; }

export function render(root) {
  if (!document.getElementById('sd-css')) { const s = document.createElement('style'); s.id = 'sd-css'; s.textContent = CSS; document.head.appendChild(s); }
  root.innerHTML = `<p class="hint" style="margin:0 0 12px">${esc(t('sd_intro'))}</p><div id="sdbody"></div>`;
  const body = $(root, '#sdbody');
  if (SC.vaultLocked()) { drawPin(body); return; }
  V = SC.getVault();
  draw(body);
}

// --- ПИН екран ---
function drawPin(body) {
  body.innerHTML = `<div class="sd-card sd-main"><label>${esc(t('sd_pin_enter'))}</label>
    <input type="password" id="pin" inputmode="numeric" autocomplete="off" />
    <button class="btn" id="unlock" style="margin-top:10px">${esc(t('sd_pin_unlock'))}</button><div class="status" id="st"></div></div>`;
  const go = async () => {
    const v = await SC.unlockVault($(body, '#pin').value);
    if (!v) { setStatus($(body, '#st'), 'err', t('sd_pin_wrong')); return; }
    V = v; draw(body);
  };
  $(body, '#unlock').addEventListener('click', go);
  $(body, '#pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

function draw(body) {
  if (camStop) camStop();
  if (st.view === 'group') return drawGroup(body);
  if (st.view === 'new') return drawNewGroup(body);
  if (st.view === 'dist') return drawDistribute(body);
  if (st.view === 'file') return drawFile(body);
  body.innerHTML = `<div class="tabs">
      <button class="tab${st.tab === 'groups' ? ' active' : ''}" data-tab="groups">${esc(t('sd_tab_groups'))}</button>
      <button class="tab${st.tab === 'me' ? ' active' : ''}" data-tab="me">${esc(t('sd_tab_me'))}</button>
      <button class="tab${st.tab === 'open' ? ' active' : ''}" data-tab="open">${esc(t('sd_tab_open'))}</button>
    </div><div id="panel"></div>`;
  body.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.tab; st.msg = null; draw(body); }));
  const panel = $(body, '#panel');
  if (st.tab === 'me') drawMe(body, panel);
  else if (st.tab === 'open') drawOpen(body, panel);
  else drawGroups(body, panel);
}

// --- Моят QR ---
async function drawMe(body, panel) {
  const idn = me();
  if (!idn) {
    panel.innerHTML = `<div class="sd-card sd-main"><label>${esc(t('sd_name_label'))}</label>
      <input type="text" id="nm" maxlength="24" placeholder="${esc(t('sd_name_ph'))}" />
      <button class="btn" id="mk" style="margin-top:10px">${esc(t('sd_create_id'))}</button><div class="status" id="st"></div></div>`;
    $(panel, '#mk').addEventListener('click', async () => {
      const n = $(panel, '#nm').value.trim();
      if (!n) { setStatus($(panel, '#st'), 'err', t('sd_need_name')); return; }
      setStatus($(panel, '#st'), 'work', t('sd_working'));
      V.identity = await SC.createIdentity(n); await SC.saveVault(); draw(body);
    });
    return;
  }
  const fp = await SC.fingerprint(idn.s);
  panel.innerHTML = `<div class="sd-card sd-main"><b>${esc(idn.name)}</b>
      <div class="sd-mono">${esc(t('sd_my_id'))}: ${esc(idn.id)} · ${esc(t('sd_fp'))}: ${esc(fp)}</div>
      <div class="sd-qr"><canvas id="qr"></canvas></div>
      <p class="hint">${esc(t('sd_my_qr_hint'))}</p>
      <div class="sd-btns"><button class="btn sec" id="share">${esc(t('sd_share_qr'))}</button></div></div>
    <div class="sd-card"><b>${esc(t('sd_pin_title'))}</b><p class="hint">${esc(t('sd_pin_hint'))}</p>
      <input type="password" id="pin" inputmode="numeric" autocomplete="off" placeholder="${esc(t('sd_pin_enter'))}" />
      <div class="sd-btns"><button class="btn" id="setpin">${esc(t('sd_pin_set'))}</button>
      ${SC.vaultHasPin() ? `<button class="btn sec" id="rmpin">${esc(t('sd_pin_remove'))}</button>` : ''}</div><div class="status" id="st"></div></div>`;
  const canvas = $(panel, '#qr');
  await drawQR(canvas, SC.identityQR(idn));
  $(panel, '#share').addEventListener('click', () => canvas.toBlob((b) => b && saveFile('sealed-qr-' + idn.id + '.png', b, 'image/png'), 'image/png'));
  $(panel, '#setpin').addEventListener('click', async () => {
    const p = $(panel, '#pin').value;
    if (p.length < 4) { setStatus($(panel, '#st'), 'err', t('sd_pin_short')); return; }
    await SC.setPin(p); $(panel, '#pin').value = ''; setStatus($(panel, '#st'), 'ok', t('sd_pin_ok'));
  });
  const rm = $(panel, '#rmpin');
  if (rm) rm.addEventListener('click', async () => { await SC.removePin(); setStatus($(panel, '#st'), 'ok', t('sd_pin_removed')); draw(body); });
}

// --- Списък групи ---
function drawGroups(body, panel) {
  const gs = V.groups || [];
  const feed = SC.readFeed();
  panel.innerHTML = `<div class="sd-btns" style="margin:0 0 12px">
      <button class="btn" id="new">${esc(t('sd_new_group'))}</button>
      <button class="btn sec" id="scankey">${esc(t('sd_scan_key'))}</button>
      <button class="btn sec" id="keyfile">${esc(t('sd_key_file'))}</button></div>
    <div id="cam"></div><div class="status" id="st"></div>
    ${gs.length ? `<div class="sd-list">${gs.map((g) => `<div class="sd-item" data-g="${esc(g.g)}"><div class="sd-ic">🔐</div><div class="sd-t"><b>${esc(g.n)}</b>
      <small>${esc(tf('sd_members_n', g.members.length))} · ${esc(tf('sd_key_v', g.epoch))}${g.mine ? ' · ' + esc(t('sd_organizer')) : ''} · ${(feed[g.g] || []).length} 📄</small></div></div>`).join('')}</div>`
      : `<div class="empty">${esc(t('sd_no_groups'))}</div>`}`;
  if (st.msg) { setStatus($(panel, '#st'), st.msg[0], st.msg[1]); st.msg = null; }
  panel.querySelectorAll('.sd-item').forEach((el) => el.addEventListener('click', () => { st.view = 'group'; st.gid = el.dataset.g; draw(body); }));
  $(panel, '#new').addEventListener('click', () => {
    if (!me()) { setStatus($(panel, '#st'), 'err', t('sd_no_id')); return; }
    st.draft = { n: '', members: [] }; st.view = 'new'; draw(body);
  });
  const takeKey = async (txt) => {
    if (txt == null) return;
    const r = await acceptKeyPacket(txt);
    setStatus($(panel, '#st'), r.ok ? 'ok' : 'err', r.msg);
    if (r.ok) { st.msg = ['ok', r.msg]; draw(body); }
  };
  $(panel, '#scankey').addEventListener('click', async () => {
    if (!me()) { setStatus($(panel, '#st'), 'err', t('sd_no_id')); return; }
    takeKey(await scanCamera($(panel, '#cam')));
  });
  $(panel, '#keyfile').addEventListener('click', async () => {
    if (!me()) { setStatus($(panel, '#st'), 'err', t('sd_no_id')); return; }
    try { const f = await pickBinaryFile('*/*'); if (!f) return; takeKey(new TextDecoder('utf-8').decode(dataUrlBytes(f.base64))); }
    catch (e) { setStatus($(panel, '#st'), 'err', tf('sd_read_err', e.message || e)); }
  });
}

// Приема пакет с ключ (QR текст или .pupkey) → записва/обновява групата на този телефон.
async function acceptKeyPacket(txt) {
  const p = SC.parseQR(txt);
  if (!p) return { ok: false, msg: t('sd_bad_qr') };
  if (p.t !== 'gk') return { ok: false, msg: t('sd_bad_qr') };
  const idn = me();
  if (p.r !== idn.id) return { ok: false, msg: tf('sd_key_not_mine', p.r) };
  let keyBytes;
  try { keyBytes = await SC.unwrapGroupKey(idn, p.p, p.k, p.g, p.e); } catch (e) { return { ok: false, msg: t('sd_key_open_err') }; }
  let g = group(p.g);
  if (!g) { g = { g: p.g, n: p.n, org: p.o.i, mine: false, members: [], keys: {}, epoch: 0 }; V.groups.push(g); }
  if (p.e >= g.epoch) { g.n = p.n; g.org = p.o.i; g.epoch = p.e; g.members = p.m.map((m) => ({ i: m.i, n: m.n, f: m.f })); }
  g.keys[p.e] = SC.b64u(keyBytes);
  await SC.saveVault();
  return { ok: true, msg: tf('sd_key_saved', g.n, p.e) };
}

// --- Нова група / нов ключ (церемония по сканиране) ---
function drawNewGroup(body) {
  const d = st.draft; const idn = me();
  body.innerHTML = `<button class="btn sec" id="back" style="width:auto;margin-bottom:10px">${esc(d.g ? t('sd_back_group') : t('sd_back'))}</button>
    <div class="sd-card sd-main"><label>${esc(t('sd_group_name'))}</label>
      <input type="text" id="gn" maxlength="40" value="${esc(d.n)}" placeholder="${esc(t('sd_group_ph'))}" />
      ${d.g ? `<p class="hint">${esc(t('sd_rekey_hint'))}</p>` : ''}
      <label style="margin-top:10px">${esc(t('sd_members'))}</label><p class="hint">${esc(t('sd_members_hint'))}</p>
      <div class="sd-list" id="ml">
        <div class="sd-item"><div class="sd-ic">👤</div><div class="sd-t"><b>${esc(idn.name)}</b><small>${esc(t('sd_you'))} · ${esc(t('sd_organizer'))}</small></div></div>
        ${d.members.map((m, i) => `<div class="sd-item"><div class="sd-ic">👤</div><div class="sd-t"><b>${esc(m.n)}</b><small>${esc(m.i)}</small></div>
          <button class="btn sec" style="width:auto;padding:6px 10px" data-rm="${i}">${esc(t('sd_remove'))}</button></div>`).join('')}
      </div>
      <div class="sd-btns"><button class="btn" id="scan">${esc(t('sd_scan_member'))}</button><button class="btn sec" id="pic">${esc(t('sd_from_picture'))}</button></div>
      <div id="cam"></div><div class="status" id="st"></div>
      <button class="btn" id="gen" style="margin-top:12px">${esc(t('sd_gen_key'))}</button></div>`;
  $(body, '#back').addEventListener('click', () => { st.view = d.g ? 'group' : 'home'; st.tab = 'groups'; draw(body); });
  $(body, '#gn').addEventListener('input', (e) => { d.n = e.target.value; });
  body.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { d.members.splice(parseInt(b.dataset.rm, 10), 1); draw(body); }));
  const add = async (txt) => {
    if (txt == null) return;
    const p = SC.parseQR(txt);
    if (!p) { setStatus($(body, '#st'), 'err', t('sd_bad_qr')); return; }
    if (p.t !== 'pk') { setStatus($(body, '#st'), 'err', t('sd_not_member_qr')); return; }
    if (p.i === idn.id || d.members.some((m) => m.i === p.i)) { setStatus($(body, '#st'), 'err', t('sd_dup_member')); return; }
    d.members.push({ i: p.i, n: String(p.n || p.i).slice(0, 24), e: p.e, s: p.s, f: await SC.fingerprint(p.s) });
    st.msg = ['ok', tf('sd_member_added', p.n || p.i)]; draw(body);
  };
  if (st.msg) { setStatus($(body, '#st'), st.msg[0], st.msg[1]); st.msg = null; }
  $(body, '#scan').addEventListener('click', async () => add(await scanCamera($(body, '#cam'))));
  $(body, '#pic').addEventListener('click', async () => {
    try { const txt = await scanPicture(); if (txt === null) return; if (!txt) { setStatus($(body, '#st'), 'err', t('sd_qr_not_found')); return; } add(txt); }
    catch (e) { setStatus($(body, '#st'), 'err', t('sd_qr_not_found')); }
  });
  $(body, '#gen').addEventListener('click', async () => {
    const n = d.n.trim();
    if (!n) { setStatus($(body, '#st'), 'err', t('sd_need_gname')); return; }
    if (!d.members.length) { setStatus($(body, '#st'), 'err', t('sd_need_members')); return; }
    setStatus($(body, '#st'), 'work', t('sd_working'));
    let g = d.g ? group(d.g) : null;
    if (!g) { g = { g: SC.randHex(8), n, org: idn.id, mine: true, members: [], keys: {}, epoch: 0 }; V.groups.push(g); }
    g.n = n; g.epoch += 1;
    g.keys[g.epoch] = SC.b64u(SC.newGroupKey());
    g.members = [{ i: idn.id, n: idn.name, f: await SC.fingerprint(idn.s), e: idn.e, s: idn.s }].concat(d.members.map((m) => ({ i: m.i, n: m.n, f: m.f, e: m.e, s: m.s })));
    await SC.saveVault();
    st.gid = g.g; st.draft = null; st.dist = { idx: 0 }; st.view = 'dist'; draw(body);
  });
}

// --- Раздаване на ключа: по един QR за всеки член ---
async function drawDistribute(body) {
  const g = group(st.gid); const idn = me();
  const others = g.members.filter((m) => m.i !== idn.id && m.e);
  if (!others.length) { st.view = 'group'; draw(body); return; }
  const idx = Math.max(0, Math.min(st.dist.idx, others.length - 1)); st.dist.idx = idx;
  const m = others[idx];
  body.innerHTML = `<button class="btn sec" id="back" style="width:auto;margin-bottom:10px">${esc(t('sd_back_group'))}</button>
    <div class="sd-card sd-main"><div class="notice">${esc(tf('sd_key_ready', g.epoch))}</div>
      <h3 style="margin:10px 0 0">${esc(tf('sd_key_for', m.n))} <span class="sd-badge">${idx + 1} / ${others.length}</span></h3>
      <div class="sd-qr"><canvas id="qr"></canvas></div>
      <div class="sd-btns"><button class="btn sec" id="prev" ${idx === 0 ? 'disabled' : ''}>${esc(t('sd_prev'))}</button>
        <button class="btn sec" id="next" ${idx === others.length - 1 ? 'disabled' : ''}>${esc(t('sd_next'))}</button></div>
      <p class="hint">${esc(t('sd_dist_hint'))}</p>
      <button class="btn sec" id="kf">${esc(t('sd_send_key_file'))}</button></div>`;
  const packet = await SC.buildKeyPacket(g, idn, m, g.epoch);
  await drawQR($(body, '#qr'), packet);
  $(body, '#back').addEventListener('click', () => { st.view = 'group'; draw(body); });
  $(body, '#prev').addEventListener('click', () => { st.dist.idx = idx - 1; draw(body); });
  $(body, '#next').addEventListener('click', () => { st.dist.idx = idx + 1; draw(body); });
  $(body, '#kf').addEventListener('click', () => saveFile(g.n.replace(/[^\w\-]+/g, '_') + '-' + m.i + '-v' + g.epoch + '.pupkey', new TextEncoder().encode(packet), 'application/octet-stream'));
}

// --- Лента на групата ---
function drawGroup(body) {
  const g = group(st.gid); const idn = me();
  if (!g) { st.view = 'home'; draw(body); return; }
  const entries = SC.readFeed()[g.g] || [];
  body.innerHTML = `<button class="btn sec" id="back" style="width:auto;margin-bottom:10px">${esc(t('sd_back'))}</button>
    <div class="sd-card sd-main"><h3 style="margin:0">${esc(g.n)}</h3>
      <small class="hint">${esc(tf('sd_members_n', g.members.length))} · ${esc(tf('sd_key_v', g.epoch))}${g.mine ? ' · ' + esc(t('sd_organizer')) : ''}</small>
      <button class="btn" id="send" style="margin-top:12px">${esc(t('sd_send_file'))}</button><div class="status" id="st"></div></div>
    <div class="sd-list" id="feed">${entries.length ? entries.map((e) => `<div class="sd-item" data-e="${esc(e.id)}"><div class="sd-ic">${e.dir === 'out' ? '📤' : '📥'}</div>
        <div class="sd-t"><b>${esc(e.fn)}</b><small>${esc(e.dir === 'out' ? t('sd_sent') : t('sd_received'))} · ${esc(e.n)} · ${esc(fmtSize(e.fz))} · ${esc(when(e.t))}</small></div>
        <span class="sd-badge ${e.ok ? 'ok' : 'bad'}">${esc(e.ok ? '✓' : '!')}</span></div>`).join('')
      : `<div class="empty">${esc(t('sd_feed_empty'))}</div>`}</div>
    <div class="sd-card" style="margin-top:12px"><b>${esc(t('sd_members'))}</b><div class="sd-list" style="margin-top:8px">
      ${g.members.map((m) => `<div class="sd-item" style="cursor:default"><div class="sd-ic">👤</div><div class="sd-t"><b>${esc(m.n)}${m.i === idn.id ? ' (' + esc(t('sd_you')) + ')' : ''}</b><small>${esc(m.i)} · ${esc(m.f || '')}${m.i === g.org ? ' · ' + esc(t('sd_organizer')) : ''}</small></div></div>`).join('')}</div>
      ${g.mine ? `<div class="sd-btns"><button class="btn sec" id="dist">${esc(t('sd_show_keys'))}</button><button class="btn sec" id="rekey">${esc(t('sd_rekey'))}</button></div>` : ''}
      <button class="btn sec" id="del" style="margin-top:10px;color:#ff7b72">${esc(t('sd_delete_group'))}</button></div>`;
  if (st.msg) { setStatus($(body, '#st'), st.msg[0], st.msg[1]); st.msg = null; }
  $(body, '#back').addEventListener('click', () => { st.view = 'home'; st.tab = 'groups'; draw(body); });
  body.querySelectorAll('#feed .sd-item').forEach((el) => el.addEventListener('click', () => openEntry(body, g, el.dataset.e)));
  $(body, '#send').addEventListener('click', async () => {
    const stn = $(body, '#st');
    try {
      const f = await pickBinaryFile('*/*'); if (!f) return;
      setStatus(stn, 'work', t('sd_sealing'));
      const bytes = dataUrlBytes(f.base64);
      const { bytes: sealed, core } = await SC.sealFile(g, idn, f.name, f.mimeType, bytes);
      const id = SC.randHex(6);
      await SC.putBytes(id, sealed);
      SC.addFeedEntry(g.g, { id, dir: 'out', i: idn.id, n: idn.name, fn: core.fn, fm: core.fm, fz: core.fz, t: core.t, e: core.e, ok: true });
      await saveFile(core.fn + '.pupsealed', sealed, 'application/octet-stream');
      st.msg = ['ok', t('sd_sealed_ok')]; draw(body);
    } catch (e) { setStatus(stn, 'err', tf('sd_read_err', e.message || e)); }
  });
  const dist = $(body, '#dist'); if (dist) dist.addEventListener('click', () => { st.dist = { idx: 0 }; st.view = 'dist'; draw(body); });
  const rekey = $(body, '#rekey'); if (rekey) rekey.addEventListener('click', () => {
    st.draft = { g: g.g, n: g.n, members: g.members.filter((m) => m.i !== idn.id).map((m) => ({ i: m.i, n: m.n, e: m.e, s: m.s, f: m.f })) };
    st.view = 'new'; draw(body);
  });
  $(body, '#del').addEventListener('click', async () => {
    if (!confirm(t('sd_confirm'))) return;
    for (const e of entries) { try { await SC.delBytes(e.id); } catch (_) {} }
    SC.dropFeed(g.g); V.groups = V.groups.filter((x) => x.g !== g.g); await SC.saveVault();
    st.view = 'home'; draw(body);
  });
}

// Разпечатва запис от лентата (байтовете са в IndexedDB) → екран на файла.
async function openEntry(body, g, id) {
  const entry = (SC.readFeed()[g.g] || []).find((e) => e.id === id); if (!entry) return;
  const bytes = await SC.getBytes(id);
  if (!bytes) { st.msg = ['err', tf('sd_decrypt_err', 'no data')]; draw(body); return; }
  const r = await unsealBytes(bytes, false);
  if (!r.ok) { st.msg = ['err', r.msg]; draw(body); return; }
  st.opened = Object.assign(r, { id, sealed: bytes }); st.view = 'file'; draw(body);
}

// Разпечатва .pupsealed байтове: намира групата/ключа, проверява подписа и подателя.
async function unsealBytes(bytes, addToFeed) {
  const p = SC.parseSealed(bytes);
  if (!p) return { ok: false, msg: t('sd_not_sealed') };
  const g = group(p.core.g);
  if (!g || !g.keys[p.core.e]) return { ok: false, msg: t('sd_no_group_key') };
  let plain;
  try { plain = await SC.unsealFile(p, g.keys[p.core.e]); } catch (e) { return { ok: false, msg: tf('sd_decrypt_err', e.message || e) }; }
  const sigOk = await SC.verifySealed(p);
  const member = g.members.find((m) => m.i === p.core.i);
  const fp = await SC.fingerprint(p.core.p);
  const warn = [];
  if (!sigOk) warn.push(t('sd_unverified'));
  if (!member) warn.push(t('sd_sender_unknown'));
  else if (member.f && member.f !== fp) warn.push(t('sd_key_changed'));
  const ok = sigOk && !!member && (!member.f || member.f === fp);
  let entry = null;
  if (addToFeed) {
    const id = SC.randHex(6);
    await SC.putBytes(id, bytes);
    entry = SC.addFeedEntry(g.g, { id, dir: p.core.i === me().id ? 'out' : 'in', i: p.core.i, n: p.core.n, fn: p.core.fn, fm: p.core.fm, fz: p.core.fz, t: p.core.t, e: p.core.e, ok });
  }
  return { ok: true, g, core: p.core, plain, sigOk, warn, verified: ok, entry };
}

// --- Получен файл ---
function drawOpen(body, panel) {
  panel.innerHTML = `<div class="sd-card sd-main"><p class="hint" style="margin-top:0">${esc(t('sd_open_hint'))}</p>
    <button class="btn" id="pick">${esc(t('sd_open_received'))}</button><div class="status" id="st"></div></div>
    <div class="sd-card"><p class="hint" style="margin-top:0">${esc(t('sd_key_scan_hint'))}</p>
    <div class="sd-btns"><button class="btn sec" id="scankey">${esc(t('sd_scan_key'))}</button><button class="btn sec" id="keyfile">${esc(t('sd_key_file'))}</button></div><div id="cam"></div></div>`;
  const stn = $(panel, '#st');
  $(panel, '#pick').addEventListener('click', async () => {
    if (!me()) { setStatus(stn, 'err', t('sd_no_id')); return; }
    try {
      const f = await pickBinaryFile('*/*'); if (!f) return;
      setStatus(stn, 'work', t('sd_working'));
      const bytes = dataUrlBytes(f.base64);
      const r = await unsealBytes(bytes, true);
      if (!r.ok) { setStatus(stn, 'err', r.msg); return; }
      st.opened = Object.assign(r, { id: r.entry.id, sealed: bytes }); st.gid = r.g.g; st.view = 'file'; draw(body);
    } catch (e) { setStatus(stn, 'err', tf('sd_read_err', e.message || e)); }
  });
  const takeKey = async (txt) => { if (txt == null) return; const r = await acceptKeyPacket(txt); setStatus(stn, r.ok ? 'ok' : 'err', r.msg); };
  $(panel, '#scankey').addEventListener('click', async () => { if (!me()) { setStatus(stn, 'err', t('sd_no_id')); return; } takeKey(await scanCamera($(panel, '#cam'))); });
  $(panel, '#keyfile').addEventListener('click', async () => {
    if (!me()) { setStatus(stn, 'err', t('sd_no_id')); return; }
    try { const f = await pickBinaryFile('*/*'); if (!f) return; takeKey(new TextDecoder('utf-8').decode(dataUrlBytes(f.base64))); }
    catch (e) { setStatus(stn, 'err', tf('sd_read_err', e.message || e)); }
  });
}

// --- Отворен (разкодиран) файл ---
function drawFile(body) {
  const o = st.opened; if (!o) { st.view = 'group'; draw(body); return; }
  const c = o.core; const mime = c.fm || '';
  let preview = '';
  if (/^image\//.test(mime)) preview = `<img id="pimg" alt="" />`;
  else if (/^text\/|json$|xml$/.test(mime) && o.plain.length < 200000) preview = `<pre>${esc(new TextDecoder('utf-8').decode(o.plain))}</pre>`;
  else preview = `<p class="hint">${esc(t('sd_preview_na'))}</p>`;
  body.innerHTML = `<button class="btn sec" id="back" style="width:auto;margin-bottom:10px">${esc(t('sd_back_group'))}</button>
    <div class="sd-card sd-main"><h3 style="margin:0;word-break:break-word">${esc(c.fn)}</h3>
      <small class="hint">${esc(t('sd_from'))}: ${esc(c.n)} (${esc(c.i)}) · ${esc(fmtSize(c.fz))} · ${esc(when(c.t))} · ${esc(o.g.n)} · ${esc(tf('sd_key_v', c.e))}</small>
      <div><span class="sd-badge ${o.verified ? 'ok' : 'bad'}" style="margin-top:8px;display:inline-block">${esc(o.verified ? t('sd_verified') : t('sd_unverified'))}</span></div>
      ${o.warn.map((w) => `<div class="sd-warn">${esc(w)}</div>`).join('')}
      <div class="sd-prev">${preview}</div>
      <div class="sd-btns"><button class="btn" id="save">${esc(t('sd_save'))}</button><button class="btn sec" id="share">${esc(t('sd_share_sealed'))}</button>
        <button class="btn sec" id="del" style="color:#ff7b72">${esc(t('sd_delete'))}</button></div></div>`;
  const img = $(body, '#pimg');
  if (img) { const url = URL.createObjectURL(new Blob([o.plain], { type: mime })); img.src = url; }
  $(body, '#back').addEventListener('click', () => { st.gid = o.g.g; st.view = 'group'; st.opened = null; draw(body); });
  $(body, '#save').addEventListener('click', () => saveFile(c.fn, o.plain, mime));
  $(body, '#share').addEventListener('click', () => saveFile(c.fn + '.pupsealed', o.sealed, 'application/octet-stream'));
  $(body, '#del').addEventListener('click', async () => {
    try { await SC.delBytes(o.id); } catch (_) {}
    SC.removeFeedEntry(o.g.g, o.id); st.gid = o.g.g; st.view = 'group'; st.opened = null; draw(body);
  });
}
