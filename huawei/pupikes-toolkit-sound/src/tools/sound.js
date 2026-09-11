// Version: 1.0020
// „Студио за звук и глас" — сърцевината на Pupikes Toolkit Sound (Huawei 4.3, 11.09.2026):
// модулатори и модификатори на звук и глас (височина, темпо, ехо, реверб, еквалайзер, нормализация,
// шумопотискане, fade, реверс, робот, „бурундук"/„дълбок глас", телефон/радио, хор, вибрато, тремоло…),
// запис от микрофона + обработка на файл, преглед преди/след (вълнова форма + прослушване), верига от
// ефекти с отмяна, запис/споделяне като WAV (веднага) или MP3/OGG/M4A (през вградения ffmpeg.wasm).
// Самите алгоритми са в sound-fx.js (чист двигател, без интерфейс — споделя се с Pupikes Toolkit).
// Старият конвертор на формати остава като второстепенен таб „Конвертор".
// Всичко е НА УСТРОЙСТВОТО — нищо не се качва в интернет.
import { esc, setStatus, fmtSize } from '../core/ui.js';
import { saveFile } from '../core/filesave.js';
import { pickBinaryFile } from '../core/filepick.js';
import { getFFmpeg, base64ToBytes } from '../core/ffm.js';
import { t, tf, register } from '../core/i18n.js';
import * as FX from './sound-fx.js';

register({
  // --- стар конвертор (второстепенен таб) ---
  snd_title: { bg:'Студио за звук и глас', ru:'Студия звука и голоса', uk:'Студія звуку та голосу', en:'Sound & Voice Studio', de:'Sound- & Stimm-Studio', fr:'Studio son et voix', es:'Estudio de sonido y voz', 'es-MX':'Estudio de sonido y voz', it:'Studio suono e voce', pt:'Estúdio de som e voz', ar:'استوديو الصوت والكلام', hi:'साउंड और वॉइस स्टूडियो', ja:'サウンド＆ボイススタジオ', ky:'Үн жана добуш студиясы', 'zh-Hant':'聲音與人聲工作室' },
  snd_notice: { bg:'Конвертира звукови файлове от телефонните формати (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, звук от WebM/3GP видео) към MP4, MP3, WAV или OGG — изцяло на устройството, нищо не се качва в интернет.', ru:'Конвертирует аудиофайлы из телефонных форматов (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, звук из WebM/3GP видео) в MP4, MP3, WAV или OGG — полностью на устройстве, ничего не загружается в интернет.', uk:'Конвертує аудіофайли з телефонних форматів (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, звук із WebM/3GP відео) у MP4, MP3, WAV або OGG — повністю на пристрої, нічого не завантажується в інтернет.', en:'Converts audio files from phone formats (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio from WebM/3GP video) to MP4, MP3, WAV or OGG — fully on your device, nothing is uploaded.', de:'Konvertiert Audiodateien aus Telefonformaten (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, Ton aus WebM/3GP-Video) zu MP4, MP3, WAV oder OGG — komplett auf dem Gerät, nichts wird hochgeladen.', fr:'Convertit les fichiers audio des formats téléphone (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio de vidéo WebM/3GP) vers MP4, MP3, WAV ou OGG — entièrement sur l’appareil, rien n’est envoyé.', es:'Convierte archivos de audio de formatos de teléfono (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio de vídeo WebM/3GP) a MP4, MP3, WAV u OGG — totalmente en el dispositivo, nada se sube.', 'es-MX':'Convierte archivos de audio de formatos de teléfono (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio de video WebM/3GP) a MP4, MP3, WAV u OGG — totalmente en el dispositivo, nada se sube.', it:'Converte file audio dai formati del telefono (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio da video WebM/3GP) in MP4, MP3, WAV o OGG — interamente sul dispositivo, nulla viene caricato.', pt:'Converte arquivos de áudio dos formatos do telefone (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, áudio de vídeo WebM/3GP) para MP4, MP3, WAV ou OGG — totalmente no aparelho, nada é enviado.', ar:'يحوّل ملفات الصوت من صيغ الهاتف (MP3، M4A/AAC، WAV، OGG/Opus، FLAC، صوت فيديو WebM/3GP) إلى MP4 أو MP3 أو WAV أو OGG — بالكامل على جهازك، لا يُرفع شيء.', hi:'फ़ोन फ़ॉर्मेट्स (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, WebM/3GP वीडियो का ऑडियो) से MP4, MP3, WAV या OGG में बदलता है — पूरी तरह डिवाइस पर, कुछ अपलोड नहीं होता।', ja:'電話のフォーマット（MP3・M4A/AAC・WAV・OGG/Opus・FLAC・WebM/3GP動画の音声）を MP4・MP3・WAV・OGG に変換。すべて端末内で処理、アップロードなし。', ky:'Телефон форматтарынан (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, WebM/3GP видеонун үнү) MP4, MP3, WAV же OGG форматына которот — толугу менен түзмөктө.', 'zh-Hant':'將手機格式的音訊檔（MP3、M4A/AAC、WAV、OGG/Opus、FLAC、WebM/3GP 影片的音訊）轉換為 MP4、MP3、WAV 或 OGG — 全程在裝置上，不上傳任何內容。' },
  snd_pick: { bg:'🎵 Избери звуков файл', ru:'🎵 Выбрать аудиофайл', uk:'🎵 Вибрати аудіофайл', en:'🎵 Choose an audio file', de:'🎵 Audiodatei wählen', fr:'🎵 Choisir un fichier audio', es:'🎵 Elegir archivo de audio', 'es-MX':'🎵 Elegir archivo de audio', it:'🎵 Scegli un file audio', pt:'🎵 Escolher arquivo de áudio', ar:'🎵 اختر ملف صوت', hi:'🎵 ऑडियो फ़ाइल चुनें', ja:'🎵 音声ファイルを選択', ky:'🎵 Аудио файл тандоо', 'zh-Hant':'🎵 選擇音訊檔' },
  snd_target: { bg:'Целеви формат', ru:'Целевой формат', uk:'Цільовий формат', en:'Target format', de:'Zielformat', fr:'Format cible', es:'Formato de destino', 'es-MX':'Formato de destino', it:'Formato di destinazione', pt:'Formato de destino', ar:'الصيغة الهدف', hi:'लक्ष्य फ़ॉर्मेट', ja:'変換先フォーマット', ky:'Максат формат', 'zh-Hant':'目標格式' },
  snd_go: { bg:'Конвертирай', ru:'Конвертировать', uk:'Конвертувати', en:'Convert', de:'Konvertieren', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'変換', ky:'Которуу', 'zh-Hant':'轉換' },
  snd_need_file: { bg:'Първо избери звуков файл.', ru:'Сначала выберите аудиофайл.', uk:'Спочатку виберіть аудіофайл.', en:'Choose an audio file first.', de:'Wähle zuerst eine Audiodatei.', fr:'Choisis d’abord un fichier audio.', es:'Primero elige un archivo de audio.', 'es-MX':'Primero elige un archivo de audio.', it:'Prima scegli un file audio.', pt:'Primeiro escolha um arquivo de áudio.', ar:'اختر ملف صوت أولًا.', hi:'पहले ऑडियो फ़ाइल चुनें।', ja:'まず音声ファイルを選択してください。', ky:'Адегенде аудио файл танда.', 'zh-Hant':'請先選擇音訊檔。' },
  snd_working: { bg:'Конвертирам… {0}%', ru:'Конвертирую… {0}%', uk:'Конвертую… {0}%', en:'Converting… {0}%', de:'Konvertiere… {0}%', fr:'Conversion… {0}%', es:'Convirtiendo… {0}%', 'es-MX':'Convirtiendo… {0}%', it:'Conversione… {0}%', pt:'Convertendo… {0}%', ar:'جارٍ التحويل… {0}%', hi:'बदल रहा… {0}%', ja:'変換中… {0}%', ky:'Которулууда… {0}%', 'zh-Hant':'轉換中… {0}%' },
  snd_done: { bg:'Готово! {0} → {1} ({2}). Файлът е записан/споделен.', ru:'Готово! {0} → {1} ({2}). Файл сохранён/отправлен.', uk:'Готово! {0} → {1} ({2}). Файл збережено/надіслано.', en:'Done! {0} → {1} ({2}). The file was saved/shared.', de:'Fertig! {0} → {1} ({2}). Die Datei wurde gespeichert/geteilt.', fr:'Terminé ! {0} → {1} ({2}). Le fichier a été enregistré/partagé.', es:'¡Listo! {0} → {1} ({2}). El archivo se guardó/compartió.', 'es-MX':'¡Listo! {0} → {1} ({2}). El archivo se guardó/compartió.', it:'Fatto! {0} → {1} ({2}). Il file è stato salvato/condiviso.', pt:'Pronto! {0} → {1} ({2}). O arquivo foi salvo/compartilhado.', ar:'تم! {0} ← {1} ({2}). حُفظ/شورك الملف.', hi:'हो गया! {0} → {1} ({2})। फ़ाइल सहेजी/साझा की गई।', ja:'完了！{0} → {1}（{2}）。ファイルを保存／共有しました。', ky:'Даяр! {0} → {1} ({2}). Файл сакталды/бөлүшүлдү.', 'zh-Hant':'完成！{0} → {1}（{2}）。檔案已儲存／分享。' },
  snd_error: { bg:'Грешка при конвертиране: {0}. Ако файлът е AMR/3GP запис, този формат може да не се поддържа.', ru:'Ошибка конвертации: {0}. Если файл — запись AMR/3GP, этот формат может не поддерживаться.', uk:'Помилка конвертації: {0}. Якщо файл — запис AMR/3GP, цей формат може не підтримуватися.', en:'Conversion error: {0}. If the file is an AMR/3GP recording, that format may be unsupported.', de:'Konvertierungsfehler: {0}. Bei AMR/3GP-Aufnahmen wird das Format evtl. nicht unterstützt.', fr:'Erreur de conversion : {0}. Si le fichier est un enregistrement AMR/3GP, ce format peut ne pas être pris en charge.', es:'Error de conversión: {0}. Si el archivo es una grabación AMR/3GP, ese formato puede no estar soportado.', 'es-MX':'Error de conversión: {0}. Si el archivo es una grabación AMR/3GP, ese formato puede no estar soportado.', it:'Errore di conversione: {0}. Se il file è una registrazione AMR/3GP, quel formato può non essere supportato.', pt:'Erro de conversão: {0}. Se o arquivo é uma gravação AMR/3GP, esse formato pode não ser suportado.', ar:'خطأ في التحويل: {0}. إذا كان الملف تسجيل AMR/3GP فقد لا تكون الصيغة مدعومة.', hi:'रूपांतरण त्रुटि: {0}। यदि फ़ाइल AMR/3GP रिकॉर्डिंग है तो वह फ़ॉर्मेट समर्थित नहीं हो सकता।', ja:'変換エラー: {0}。AMR/3GP 録音の場合、そのフォーマットは未対応の可能性があります。', ky:'Которуу катасы: {0}. Файл AMR/3GP жазуу болсо, ал формат колдоого алынбашы мүмкүн.', 'zh-Hant':'轉換錯誤：{0}。若檔案是 AMR/3GP 錄音，該格式可能不受支援。' },
  snd_picked: { bg:'Избран: {0} ({1})', ru:'Выбран: {0} ({1})', uk:'Вибрано: {0} ({1})', en:'Selected: {0} ({1})', de:'Ausgewählt: {0} ({1})', fr:'Sélectionné : {0} ({1})', es:'Seleccionado: {0} ({1})', 'es-MX':'Seleccionado: {0} ({1})', it:'Selezionato: {0} ({1})', pt:'Selecionado: {0} ({1})', ar:'المحدد: {0} ({1})', hi:'चुना गया: {0} ({1})', ja:'選択済み: {0}（{1}）', ky:'Тандалды: {0} ({1})', 'zh-Hant':'已選：{0}（{1}）' },
  snd_loading_engine: { bg:'Зареждам звуковия двигател (първия път отнема няколко секунди)…', ru:'Загружаю аудиодвижок (в первый раз занимает несколько секунд)…', uk:'Завантажую аудіодвигун (першого разу займає кілька секунд)…', en:'Loading the audio engine (takes a few seconds the first time)…', de:'Lade die Audio-Engine (beim ersten Mal dauert es ein paar Sekunden)…', fr:'Chargement du moteur audio (quelques secondes la première fois)…', es:'Cargando el motor de audio (la primera vez tarda unos segundos)…', 'es-MX':'Cargando el motor de audio (la primera vez tarda unos segundos)…', it:'Carico il motore audio (la prima volta richiede qualche secondo)…', pt:'Carregando o motor de áudio (a primeira vez leva alguns segundos)…', ar:'جارٍ تحميل محرك الصوت (يستغرق ثوانٍ في المرة الأولى)…', hi:'ऑडियो इंजन लोड हो रहा है (पहली बार कुछ सेकंड लगते हैं)…', ja:'音声エンジンを読み込み中（初回は数秒かかります）…', ky:'Аудио кыймылдаткыч жүктөлүүдө (биринчи жолу бир нече секунд)…', 'zh-Hant':'正在載入音訊引擎（首次需要幾秒）…' },

  // --- студио: табове и източник ---
  sfx_tab_studio: { bg:'🎛 Студио', ru:'🎛 Студия', uk:'🎛 Студія', en:'🎛 Studio', de:'🎛 Studio', fr:'🎛 Studio', es:'🎛 Estudio', 'es-MX':'🎛 Estudio', it:'🎛 Studio', pt:'🎛 Estúdio', ar:'🎛 الاستوديو', hi:'🎛 स्टूडियो', ja:'🎛 スタジオ', ky:'🎛 Студия', 'zh-Hant':'🎛 工作室' },
  sfx_tab_rec: { bg:'🎙 Запис', ru:'🎙 Запись', uk:'🎙 Запис', en:'🎙 Record', de:'🎙 Aufnahme', fr:'🎙 Enregistrer', es:'🎙 Grabar', 'es-MX':'🎙 Grabar', it:'🎙 Registra', pt:'🎙 Gravar', ar:'🎙 تسجيل', hi:'🎙 रिकॉर्ड', ja:'🎙 録音', ky:'🎙 Жазуу', 'zh-Hant':'🎙 錄音' },
  sfx_tab_conv: { bg:'🔁 Конвертор', ru:'🔁 Конвертер', uk:'🔁 Конвертер', en:'🔁 Converter', de:'🔁 Konverter', fr:'🔁 Convertisseur', es:'🔁 Conversor', 'es-MX':'🔁 Conversor', it:'🔁 Convertitore', pt:'🔁 Conversor', ar:'🔁 المحوّل', hi:'🔁 कन्वर्टर', ja:'🔁 変換', ky:'🔁 Конвертер', 'zh-Hant':'🔁 轉換器' },
  sfx_intro: { bg:'Модулатори и модификатори на звук и глас: зареди файл, запиши от микрофона или пробвай с примера; прилагай ефекти един върху друг, слушай „преди/след" и запази. Всичко на устройството.', ru:'Модуляторы и модификаторы звука и голоса: загрузите файл, запишите с микрофона или попробуйте пример; накладывайте эффекты друг на друга, слушайте «до/после» и сохраняйте. Всё на устройстве.', uk:'Модулятори та модифікатори звуку й голосу: завантажте файл, запишіть із мікрофона або спробуйте приклад; накладайте ефекти один на одного, слухайте «до/після» та зберігайте. Усе на пристрої.', en:'Sound and voice modulators and modifiers: load a file, record from the microphone or try the example; stack effects one on top of another, listen before/after and save. Everything on your device.', de:'Sound- und Stimm-Modulatoren und -Modifikatoren: Datei laden, mit dem Mikrofon aufnehmen oder das Beispiel probieren; Effekte übereinander stapeln, Vorher/Nachher anhören und speichern. Alles auf dem Gerät.', fr:'Modulateurs et modificateurs de son et de voix : charge un fichier, enregistre au micro ou essaie l’exemple ; empile les effets, écoute avant/après et enregistre. Tout sur l’appareil.', es:'Moduladores y modificadores de sonido y voz: carga un archivo, graba con el micrófono o prueba el ejemplo; apila efectos uno sobre otro, escucha antes/después y guarda. Todo en el dispositivo.', 'es-MX':'Moduladores y modificadores de sonido y voz: carga un archivo, graba con el micrófono o prueba el ejemplo; apila efectos uno sobre otro, escucha antes/después y guarda. Todo en el dispositivo.', it:'Modulatori e modificatori di suono e voce: carica un file, registra dal microfono o prova l’esempio; sovrapponi gli effetti, ascolta prima/dopo e salva. Tutto sul dispositivo.', pt:'Moduladores e modificadores de som e voz: carregue um arquivo, grave pelo microfone ou experimente o exemplo; empilhe efeitos, ouça antes/depois e salve. Tudo no aparelho.', ar:'معدّلات ومغيّرات للصوت والكلام: حمّل ملفًا أو سجّل من الميكروفون أو جرّب المثال؛ ضع المؤثرات فوق بعضها، واستمع قبل/بعد، ثم احفظ. كل شيء على جهازك.', hi:'साउंड और वॉइस मॉड्युलेटर व मॉडिफ़ायर: फ़ाइल लोड करें, माइक से रिकॉर्ड करें या उदाहरण आज़माएं; इफ़ेक्ट एक के ऊपर एक लगाएं, पहले/बाद सुनें और सहेजें। सब कुछ डिवाइस पर।', ja:'サウンドと声のモジュレーター／モディファイア：ファイルを読み込むか、マイクで録音するか、サンプルを試して、エフェクトを重ねがけし、加工前後を聴き比べて保存。すべて端末内で処理。', ky:'Үн жана добуш модуляторлору: файл жүкте, микрофондон жаз же мисалды сына; эффекттерди бири-бирине кошуп, «чейин/кийин» угуп, сакта. Баары түзмөктө.', 'zh-Hant':'聲音與人聲調變器／修改器：載入檔案、用麥克風錄音或試試範例；疊加多個效果，聆聽前後對比並儲存。一切都在裝置上。' },
  sfx_pick: { bg:'🎵 Файл', ru:'🎵 Файл', uk:'🎵 Файл', en:'🎵 File', de:'🎵 Datei', fr:'🎵 Fichier', es:'🎵 Archivo', 'es-MX':'🎵 Archivo', it:'🎵 File', pt:'🎵 Arquivo', ar:'🎵 ملف', hi:'🎵 फ़ाइल', ja:'🎵 ファイル', ky:'🎵 Файл', 'zh-Hant':'🎵 檔案' },
  sfx_rec_btn: { bg:'🎙 Запиши', ru:'🎙 Записать', uk:'🎙 Записати', en:'🎙 Record', de:'🎙 Aufnehmen', fr:'🎙 Enregistrer', es:'🎙 Grabar', 'es-MX':'🎙 Grabar', it:'🎙 Registra', pt:'🎙 Gravar', ar:'🎙 سجّل', hi:'🎙 रिकॉर्ड', ja:'🎙 録音', ky:'🎙 Жазуу', 'zh-Hant':'🎙 錄音' },
  sfx_demo: { bg:'✨ Пробвай с пример', ru:'✨ Попробовать пример', uk:'✨ Спробувати приклад', en:'✨ Try the example', de:'✨ Beispiel probieren', fr:'✨ Essayer l’exemple', es:'✨ Probar el ejemplo', 'es-MX':'✨ Probar el ejemplo', it:'✨ Prova l’esempio', pt:'✨ Testar o exemplo', ar:'✨ جرّب المثال', hi:'✨ उदाहरण आज़माएं', ja:'✨ サンプルを試す', ky:'✨ Мисалды сынап көр', 'zh-Hant':'✨ 試試範例' },
  sfx_clear: { bg:'✕ Изчисти', ru:'✕ Очистить', uk:'✕ Очистити', en:'✕ Clear', de:'✕ Leeren', fr:'✕ Effacer', es:'✕ Borrar', 'es-MX':'✕ Borrar', it:'✕ Svuota', pt:'✕ Limpar', ar:'✕ مسح', hi:'✕ साफ़ करें', ja:'✕ クリア', ky:'✕ Тазалоо', 'zh-Hant':'✕ 清除' },
  sfx_src_none: { bg:'Няма зареден звук — избери файл, запиши или пробвай с примера.', ru:'Звук не загружен — выберите файл, запишите или попробуйте пример.', uk:'Звук не завантажено — виберіть файл, запишіть або спробуйте приклад.', en:'No sound loaded — choose a file, record or try the example.', de:'Kein Ton geladen — Datei wählen, aufnehmen oder das Beispiel probieren.', fr:'Aucun son chargé — choisis un fichier, enregistre ou essaie l’exemple.', es:'No hay sonido cargado — elige un archivo, graba o prueba el ejemplo.', 'es-MX':'No hay sonido cargado — elige un archivo, graba o prueba el ejemplo.', it:'Nessun suono caricato — scegli un file, registra o prova l’esempio.', pt:'Nenhum som carregado — escolha um arquivo, grave ou teste o exemplo.', ar:'لا يوجد صوت محمّل — اختر ملفًا أو سجّل أو جرّب المثال.', hi:'कोई साउंड लोड नहीं — फ़ाइल चुनें, रिकॉर्ड करें या उदाहरण आज़माएं।', ja:'音声が未読み込み — ファイルを選ぶか、録音するか、サンプルを試してください。', ky:'Үн жүктөлгөн жок — файл танда, жаз же мисалды сына.', 'zh-Hant':'尚未載入聲音 — 請選擇檔案、錄音或試試範例。' },
  sfx_src_demo: { bg:'Пример (синтезиран на устройството — не е ваш файл)', ru:'Пример (синтезирован на устройстве — не ваш файл)', uk:'Приклад (синтезований на пристрої — не ваш файл)', en:'Example (synthesized on the device — not your file)', de:'Beispiel (auf dem Gerät erzeugt — nicht deine Datei)', fr:'Exemple (synthétisé sur l’appareil — pas ton fichier)', es:'Ejemplo (sintetizado en el dispositivo — no es tu archivo)', 'es-MX':'Ejemplo (sintetizado en el dispositivo — no es tu archivo)', it:'Esempio (sintetizzato sul dispositivo — non è il tuo file)', pt:'Exemplo (sintetizado no aparelho — não é seu arquivo)', ar:'مثال (مُولَّد على الجهاز — ليس ملفك)', hi:'उदाहरण (डिवाइस पर बनाया गया — आपकी फ़ाइल नहीं)', ja:'サンプル（端末で合成 — あなたのファイルではありません）', ky:'Мисал (түзмөктө синтезделген — сиздин файл эмес)', 'zh-Hant':'範例（於裝置上合成 — 非您的檔案）' },
  sfx_src_rec: { bg:'Запис от микрофона', ru:'Запись с микрофона', uk:'Запис із мікрофона', en:'Microphone recording', de:'Mikrofonaufnahme', fr:'Enregistrement micro', es:'Grabación del micrófono', 'es-MX':'Grabación del micrófono', it:'Registrazione dal microfono', pt:'Gravação do microfone', ar:'تسجيل من الميكروفون', hi:'माइक रिकॉर्डिंग', ja:'マイク録音', ky:'Микрофондон жазуу', 'zh-Hant':'麥克風錄音' },
  sfx_src_info: { bg:'{0} · {1} с · {2} Hz · {3} кан.', ru:'{0} · {1} с · {2} Гц · {3} кан.', uk:'{0} · {1} с · {2} Гц · {3} кан.', en:'{0} · {1} s · {2} Hz · {3} ch', de:'{0} · {1} s · {2} Hz · {3} Kan.', fr:'{0} · {1} s · {2} Hz · {3} can.', es:'{0} · {1} s · {2} Hz · {3} can.', 'es-MX':'{0} · {1} s · {2} Hz · {3} can.', it:'{0} · {1} s · {2} Hz · {3} can.', pt:'{0} · {1} s · {2} Hz · {3} can.', ar:'{0} · {1} ث · {2} هرتز · {3} قناة', hi:'{0} · {1} से · {2} Hz · {3} चैनल', ja:'{0} · {1} 秒 · {2} Hz · {3} ch', ky:'{0} · {1} с · {2} Гц · {3} кан.', 'zh-Hant':'{0} · {1} 秒 · {2} Hz · {3} 聲道' },
  sfx_play_orig: { bg:'▶ Оригинал', ru:'▶ Оригинал', uk:'▶ Оригінал', en:'▶ Original', de:'▶ Original', fr:'▶ Original', es:'▶ Original', 'es-MX':'▶ Original', it:'▶ Originale', pt:'▶ Original', ar:'▶ الأصل', hi:'▶ मूल', ja:'▶ 元の音', ky:'▶ Түпнуска', 'zh-Hant':'▶ 原始' },
  sfx_play_res: { bg:'▶ Резултат', ru:'▶ Результат', uk:'▶ Результат', en:'▶ Result', de:'▶ Ergebnis', fr:'▶ Résultat', es:'▶ Resultado', 'es-MX':'▶ Resultado', it:'▶ Risultato', pt:'▶ Resultado', ar:'▶ النتيجة', hi:'▶ परिणाम', ja:'▶ 結果', ky:'▶ Натыйжа', 'zh-Hant':'▶ 結果' },
  sfx_stop: { bg:'■ Стоп', ru:'■ Стоп', uk:'■ Стоп', en:'■ Stop', de:'■ Stopp', fr:'■ Stop', es:'■ Parar', 'es-MX':'■ Parar', it:'■ Stop', pt:'■ Parar', ar:'■ إيقاف', hi:'■ रोकें', ja:'■ 停止', ky:'■ Токтот', 'zh-Hant':'■ 停止' },
  sfx_before: { bg:'Преди', ru:'До', uk:'До', en:'Before', de:'Vorher', fr:'Avant', es:'Antes', 'es-MX':'Antes', it:'Prima', pt:'Antes', ar:'قبل', hi:'पहले', ja:'加工前', ky:'Чейин', 'zh-Hant':'處理前' },
  sfx_after: { bg:'След', ru:'После', uk:'Після', en:'After', de:'Nachher', fr:'Après', es:'Después', 'es-MX':'Después', it:'Dopo', pt:'Depois', ar:'بعد', hi:'बाद', ja:'加工後', ky:'Кийин', 'zh-Hant':'處理後' },
  sfx_presets: { bg:'Гласови модулатори — с едно докосване', ru:'Голосовые модуляторы — одним касанием', uk:'Голосові модулятори — одним дотиком', en:'Voice modulators — one tap', de:'Stimm-Modulatoren — ein Tipp', fr:'Modulateurs de voix — en un geste', es:'Moduladores de voz — con un toque', 'es-MX':'Moduladores de voz — con un toque', it:'Modulatori vocali — con un tocco', pt:'Moduladores de voz — com um toque', ar:'معدّلات الصوت — بلمسة واحدة', hi:'वॉइस मॉड्युलेटर — एक टैप', ja:'ボイスモジュレーター — ワンタップ', ky:'Добуш модуляторлору — бир тийүү', 'zh-Hant':'人聲調變器 — 一鍵套用' },
  sfx_effect: { bg:'Ефект / модификатор', ru:'Эффект / модификатор', uk:'Ефект / модифікатор', en:'Effect / modifier', de:'Effekt / Modifikator', fr:'Effet / modificateur', es:'Efecto / modificador', 'es-MX':'Efecto / modificador', it:'Effetto / modificatore', pt:'Efeito / modificador', ar:'مؤثر / مغيّر', hi:'इफ़ेक्ट / मॉडिफ़ायर', ja:'エフェクト／モディファイア', ky:'Эффект / модификатор', 'zh-Hant':'效果／修改器' },
  sfx_apply: { bg:'Приложи ефекта', ru:'Применить эффект', uk:'Застосувати ефект', en:'Apply effect', de:'Effekt anwenden', fr:'Appliquer l’effet', es:'Aplicar efecto', 'es-MX':'Aplicar efecto', it:'Applica effetto', pt:'Aplicar efeito', ar:'تطبيق المؤثر', hi:'इफ़ेक्ट लागू करें', ja:'エフェクトを適用', ky:'Эффектти колдонуу', 'zh-Hant':'套用效果' },
  sfx_chain: { bg:'Приложени ефекти (верига)', ru:'Применённые эффекты (цепочка)', uk:'Застосовані ефекти (ланцюжок)', en:'Applied effects (chain)', de:'Angewandte Effekte (Kette)', fr:'Effets appliqués (chaîne)', es:'Efectos aplicados (cadena)', 'es-MX':'Efectos aplicados (cadena)', it:'Effetti applicati (catena)', pt:'Efeitos aplicados (cadeia)', ar:'المؤثرات المطبّقة (سلسلة)', hi:'लागू इफ़ेक्ट (चेन)', ja:'適用済みエフェクト（チェーン）', ky:'Колдонулган эффекттер (чынжыр)', 'zh-Hant':'已套用效果（鏈）' },
  sfx_chain_none: { bg:'Още няма приложени ефекти.', ru:'Эффекты ещё не применены.', uk:'Ефекти ще не застосовано.', en:'No effects applied yet.', de:'Noch keine Effekte angewandt.', fr:'Aucun effet appliqué pour l’instant.', es:'Aún no hay efectos aplicados.', 'es-MX':'Aún no hay efectos aplicados.', it:'Nessun effetto applicato.', pt:'Nenhum efeito aplicado ainda.', ar:'لم تُطبَّق مؤثرات بعد.', hi:'अभी कोई इफ़ेक्ट लागू नहीं।', ja:'まだエフェクトは適用されていません。', ky:'Азырынча эффект колдонулган жок.', 'zh-Hant':'尚未套用任何效果。' },
  sfx_undo: { bg:'↶ Отмени последния', ru:'↶ Отменить последний', uk:'↶ Скасувати останній', en:'↶ Undo last', de:'↶ Letzten rückgängig', fr:'↶ Annuler le dernier', es:'↶ Deshacer el último', 'es-MX':'↶ Deshacer el último', it:'↶ Annulla l’ultimo', pt:'↶ Desfazer o último', ar:'↶ تراجع عن الأخير', hi:'↶ आख़िरी पूर्ववत', ja:'↶ 最後を取り消す', ky:'↶ Акыркысын жокко чыгар', 'zh-Hant':'↶ 復原上一個' },
  sfx_reset: { bg:'Нулирай до оригинала', ru:'Сбросить к оригиналу', uk:'Скинути до оригіналу', en:'Reset to original', de:'Auf Original zurücksetzen', fr:'Revenir à l’original', es:'Volver al original', 'es-MX':'Volver al original', it:'Torna all’originale', pt:'Voltar ao original', ar:'إعادة إلى الأصل', hi:'मूल पर रीसेट', ja:'元に戻す', ky:'Түпнускага кайтар', 'zh-Hant':'重設為原始' },
  sfx_export_fmt: { bg:'Формат за запис', ru:'Формат сохранения', uk:'Формат збереження', en:'Save format', de:'Speicherformat', fr:'Format d’enregistrement', es:'Formato de guardado', 'es-MX':'Formato de guardado', it:'Formato di salvataggio', pt:'Formato de gravação', ar:'صيغة الحفظ', hi:'सहेजने का फ़ॉर्मेट', ja:'保存形式', ky:'Сактоо форматы', 'zh-Hant':'儲存格式' },
  sfx_fmt_note: { bg:'WAV е без загуба и се записва веднага; MP3 / OGG / M4A минават през вградения звуков двигател (по-бавно).', ru:'WAV — без потерь и сохраняется сразу; MP3 / OGG / M4A проходят через встроенный аудиодвижок (медленнее).', uk:'WAV — без втрат і зберігається одразу; MP3 / OGG / M4A проходять через вбудований аудіодвигун (повільніше).', en:'WAV is lossless and saves instantly; MP3 / OGG / M4A go through the built-in audio engine (slower).', de:'WAV ist verlustfrei und wird sofort gespeichert; MP3 / OGG / M4A laufen durch die eingebaute Audio-Engine (langsamer).', fr:'WAV est sans perte et s’enregistre aussitôt ; MP3 / OGG / M4A passent par le moteur audio intégré (plus lent).', es:'WAV no tiene pérdida y se guarda al instante; MP3 / OGG / M4A pasan por el motor de audio integrado (más lento).', 'es-MX':'WAV no tiene pérdida y se guarda al instante; MP3 / OGG / M4A pasan por el motor de audio integrado (más lento).', it:'WAV è senza perdita e si salva subito; MP3 / OGG / M4A passano dal motore audio integrato (più lento).', pt:'WAV é sem perdas e salva na hora; MP3 / OGG / M4A passam pelo motor de áudio embutido (mais lento).', ar:'WAV بلا فقد ويُحفظ فورًا؛ MP3 / OGG / M4A تمر عبر محرك الصوت المدمج (أبطأ).', hi:'WAV बिना नुकसान का है और तुरंत सहेजता है; MP3 / OGG / M4A इनबिल्ट ऑडियो इंजन से गुज़रते हैं (धीमा)।', ja:'WAV は無劣化で即保存。MP3 / OGG / M4A は内蔵の音声エンジンを経由（やや遅い）。', ky:'WAV жоготуусуз жана дароо сакталат; MP3 / OGG / M4A камтылган аудио кыймылдаткычтан өтөт (жайыраак).', 'zh-Hant':'WAV 為無損且立即儲存；MP3 / OGG / M4A 會經由內建音訊引擎（較慢）。' },
  sfx_save: { bg:'💾 Запази / сподели', ru:'💾 Сохранить / поделиться', uk:'💾 Зберегти / поділитися', en:'💾 Save / share', de:'💾 Speichern / teilen', fr:'💾 Enregistrer / partager', es:'💾 Guardar / compartir', 'es-MX':'💾 Guardar / compartir', it:'💾 Salva / condividi', pt:'💾 Salvar / compartilhar', ar:'💾 حفظ / مشاركة', hi:'💾 सहेजें / साझा करें', ja:'💾 保存／共有', ky:'💾 Сактоо / бөлүшүү', 'zh-Hant':'💾 儲存／分享' },
  sfx_working: { bg:'Обработвам… {0}%', ru:'Обрабатываю… {0}%', uk:'Обробляю… {0}%', en:'Processing… {0}%', de:'Verarbeite… {0}%', fr:'Traitement… {0}%', es:'Procesando… {0}%', 'es-MX':'Procesando… {0}%', it:'Elaborazione… {0}%', pt:'Processando… {0}%', ar:'جارٍ المعالجة… {0}%', hi:'प्रोसेस हो रहा… {0}%', ja:'処理中… {0}%', ky:'Иштетилүүдө… {0}%', 'zh-Hant':'處理中… {0}%' },
  sfx_done_fx: { bg:'Готово: {0} — резултатът е {1} с. Чуй „▶ Резултат".', ru:'Готово: {0} — результат {1} с. Послушайте «▶ Результат».', uk:'Готово: {0} — результат {1} с. Послухайте «▶ Результат».', en:'Done: {0} — the result is {1} s. Listen with “▶ Result”.', de:'Fertig: {0} — Ergebnis {1} s. Anhören mit „▶ Ergebnis“.', fr:'Terminé : {0} — résultat de {1} s. Écoute avec « ▶ Résultat ».', es:'Listo: {0} — el resultado dura {1} s. Escucha con «▶ Resultado».', 'es-MX':'Listo: {0} — el resultado dura {1} s. Escucha con «▶ Resultado».', it:'Fatto: {0} — il risultato dura {1} s. Ascolta con «▶ Risultato».', pt:'Pronto: {0} — o resultado tem {1} s. Ouça em «▶ Resultado».', ar:'تم: {0} — مدة النتيجة {1} ث. استمع عبر «▶ النتيجة».', hi:'हो गया: {0} — परिणाम {1} से का है। «▶ परिणाम» से सुनें।', ja:'完了: {0} — 結果は {1} 秒。「▶ 結果」で再生。', ky:'Даяр: {0} — натыйжа {1} с. «▶ Натыйжа» менен ук.', 'zh-Hant':'完成：{0} — 結果長 {1} 秒。按「▶ 結果」試聽。' },
  sfx_saved: { bg:'Записано: {0} ({1}). Файлът е записан/споделен.', ru:'Сохранено: {0} ({1}). Файл сохранён/отправлен.', uk:'Збережено: {0} ({1}). Файл збережено/надіслано.', en:'Saved: {0} ({1}). The file was saved/shared.', de:'Gespeichert: {0} ({1}). Die Datei wurde gespeichert/geteilt.', fr:'Enregistré : {0} ({1}). Le fichier a été enregistré/partagé.', es:'Guardado: {0} ({1}). El archivo se guardó/compartió.', 'es-MX':'Guardado: {0} ({1}). El archivo se guardó/compartió.', it:'Salvato: {0} ({1}). Il file è stato salvato/condiviso.', pt:'Salvo: {0} ({1}). O arquivo foi salvo/compartilhado.', ar:'حُفظ: {0} ({1}). حُفظ/شورك الملف.', hi:'सहेजा गया: {0} ({1})। फ़ाइल सहेजी/साझा की गई।', ja:'保存済み: {0}（{1}）。ファイルを保存／共有しました。', ky:'Сакталды: {0} ({1}). Файл сакталды/бөлүшүлдү.', 'zh-Hant':'已儲存：{0}（{1}）。檔案已儲存／分享。' },
  sfx_need_src: { bg:'Първо зареди звук (файл, запис или пример).', ru:'Сначала загрузите звук (файл, запись или пример).', uk:'Спочатку завантажте звук (файл, запис або приклад).', en:'Load a sound first (file, recording or example).', de:'Lade zuerst einen Ton (Datei, Aufnahme oder Beispiel).', fr:'Charge d’abord un son (fichier, enregistrement ou exemple).', es:'Primero carga un sonido (archivo, grabación o ejemplo).', 'es-MX':'Primero carga un sonido (archivo, grabación o ejemplo).', it:'Prima carica un suono (file, registrazione o esempio).', pt:'Primeiro carregue um som (arquivo, gravação ou exemplo).', ar:'حمّل صوتًا أولًا (ملف أو تسجيل أو مثال).', hi:'पहले साउंड लोड करें (फ़ाइल, रिकॉर्डिंग या उदाहरण)।', ja:'まず音声を読み込んでください（ファイル・録音・サンプル）。', ky:'Адегенде үн жүктө (файл, жазуу же мисал).', 'zh-Hant':'請先載入聲音（檔案、錄音或範例）。' },
  sfx_decode_err: { bg:'Този файл не може да се декодира: {0}', ru:'Этот файл не удаётся декодировать: {0}', uk:'Цей файл не вдається декодувати: {0}', en:'This file cannot be decoded: {0}', de:'Diese Datei kann nicht dekodiert werden: {0}', fr:'Ce fichier ne peut pas être décodé : {0}', es:'Este archivo no se puede decodificar: {0}', 'es-MX':'Este archivo no se puede decodificar: {0}', it:'Questo file non può essere decodificato: {0}', pt:'Este arquivo não pode ser decodificado: {0}', ar:'تعذّر فك ترميز هذا الملف: {0}', hi:'यह फ़ाइल डिकोड नहीं हो सकी: {0}', ja:'このファイルはデコードできません: {0}', ky:'Бул файлды декоддоо мүмкүн эмес: {0}', 'zh-Hant':'無法解碼此檔案：{0}' },
  sfx_loading: { bg:'Зареждам звука…', ru:'Загружаю звук…', uk:'Завантажую звук…', en:'Loading the sound…', de:'Lade den Ton…', fr:'Chargement du son…', es:'Cargando el sonido…', 'es-MX':'Cargando el sonido…', it:'Carico il suono…', pt:'Carregando o som…', ar:'جارٍ تحميل الصوت…', hi:'साउंड लोड हो रहा…', ja:'音声を読み込み中…', ky:'Үн жүктөлүүдө…', 'zh-Hant':'正在載入聲音…' },
  sfx_loaded: { bg:'Заредено: {0}', ru:'Загружено: {0}', uk:'Завантажено: {0}', en:'Loaded: {0}', de:'Geladen: {0}', fr:'Chargé : {0}', es:'Cargado: {0}', 'es-MX':'Cargado: {0}', it:'Caricato: {0}', pt:'Carregado: {0}', ar:'تم التحميل: {0}', hi:'लोड हुआ: {0}', ja:'読み込み完了: {0}', ky:'Жүктөлдү: {0}', 'zh-Hant':'已載入：{0}' },
  // --- запис ---
  sfx_rec_hint: { bg:'Записът се прави на устройството и не се изпраща никъде. До 5 минути. След „Спри" записът се зарежда в Студиото за ефекти и запазване.', ru:'Запись делается на устройстве и никуда не отправляется. До 5 минут. После «Стоп» запись загружается в Студию для эффектов и сохранения.', uk:'Запис робиться на пристрої й нікуди не надсилається. До 5 хвилин. Після «Стоп» запис завантажується в Студію для ефектів і збереження.', en:'The recording is made on the device and is not sent anywhere. Up to 5 minutes. After “Stop” the recording is loaded into the Studio for effects and saving.', de:'Die Aufnahme erfolgt auf dem Gerät und wird nirgends hingeschickt. Bis 5 Minuten. Nach „Stopp“ wird sie ins Studio geladen (Effekte, Speichern).', fr:'L’enregistrement se fait sur l’appareil et n’est envoyé nulle part. Jusqu’à 5 minutes. Après « Stop », il est chargé dans le Studio pour les effets et la sauvegarde.', es:'La grabación se hace en el dispositivo y no se envía a ningún sitio. Hasta 5 minutos. Tras «Parar» se carga en el Estudio para efectos y guardado.', 'es-MX':'La grabación se hace en el dispositivo y no se envía a ningún lado. Hasta 5 minutos. Tras «Parar» se carga en el Estudio para efectos y guardado.', it:'La registrazione avviene sul dispositivo e non viene inviata da nessuna parte. Fino a 5 minuti. Dopo «Stop» viene caricata nello Studio per effetti e salvataggio.', pt:'A gravação é feita no aparelho e não é enviada a lugar nenhum. Até 5 minutos. Após «Parar» ela é carregada no Estúdio para efeitos e gravação.', ar:'يتم التسجيل على الجهاز ولا يُرسل إلى أي مكان. حتى 5 دقائق. بعد «إيقاف» يُحمَّل التسجيل في الاستوديو للمؤثرات والحفظ.', hi:'रिकॉर्डिंग डिवाइस पर होती है और कहीं नहीं भेजी जाती। 5 मिनट तक। «रोकें» के बाद रिकॉर्डिंग इफ़ेक्ट और सहेजने के लिए स्टूडियो में लोड होती है।', ja:'録音は端末内で行われ、どこにも送信されません。最長5分。「停止」後、録音はエフェクトと保存のためスタジオに読み込まれます。', ky:'Жазуу түзмөктө жасалат жана эч жакка жөнөтүлбөйт. 5 мүнөткө чейин. «Токтот» баскандан кийин жазуу Студияга жүктөлөт.', 'zh-Hant':'錄音在裝置上完成，不會傳送到任何地方。最長 5 分鐘。按「停止」後，錄音會載入工作室以套用效果並儲存。' },
  sfx_rec_start: { bg:'● Започни запис', ru:'● Начать запись', uk:'● Почати запис', en:'● Start recording', de:'● Aufnahme starten', fr:'● Démarrer l’enregistrement', es:'● Empezar a grabar', 'es-MX':'● Empezar a grabar', it:'● Avvia registrazione', pt:'● Iniciar gravação', ar:'● بدء التسجيل', hi:'● रिकॉर्डिंग शुरू करें', ja:'● 録音開始', ky:'● Жазууну баштоо', 'zh-Hant':'● 開始錄音' },
  sfx_rec_stop: { bg:'■ Спри записа', ru:'■ Остановить запись', uk:'■ Зупинити запис', en:'■ Stop recording', de:'■ Aufnahme stoppen', fr:'■ Arrêter l’enregistrement', es:'■ Parar la grabación', 'es-MX':'■ Parar la grabación', it:'■ Ferma registrazione', pt:'■ Parar gravação', ar:'■ إيقاف التسجيل', hi:'■ रिकॉर्डिंग रोकें', ja:'■ 録音停止', ky:'■ Жазууну токтотуу', 'zh-Hant':'■ 停止錄音' },
  sfx_rec_time: { bg:'Записвам… {0} с', ru:'Записываю… {0} с', uk:'Записую… {0} с', en:'Recording… {0} s', de:'Aufnahme… {0} s', fr:'Enregistrement… {0} s', es:'Grabando… {0} s', 'es-MX':'Grabando… {0} s', it:'Registro… {0} s', pt:'Gravando… {0} s', ar:'جارٍ التسجيل… {0} ث', hi:'रिकॉर्ड हो रहा… {0} से', ja:'録音中… {0} 秒', ky:'Жазылууда… {0} с', 'zh-Hant':'錄音中… {0} 秒' },
  sfx_rec_done: { bg:'Записът ({0} с) е зареден в Студиото.', ru:'Запись ({0} с) загружена в Студию.', uk:'Запис ({0} с) завантажено в Студію.', en:'The recording ({0} s) is loaded into the Studio.', de:'Die Aufnahme ({0} s) ist ins Studio geladen.', fr:'L’enregistrement ({0} s) est chargé dans le Studio.', es:'La grabación ({0} s) está cargada en el Estudio.', 'es-MX':'La grabación ({0} s) está cargada en el Estudio.', it:'La registrazione ({0} s) è caricata nello Studio.', pt:'A gravação ({0} s) foi carregada no Estúdio.', ar:'حُمِّل التسجيل ({0} ث) في الاستوديو.', hi:'रिकॉर्डिंग ({0} से) स्टूडियो में लोड हो गई।', ja:'録音（{0} 秒）をスタジオに読み込みました。', ky:'Жазуу ({0} с) Студияга жүктөлдү.', 'zh-Hant':'錄音（{0} 秒）已載入工作室。' },
  sfx_rec_err: { bg:'Микрофонът не е достъпен: {0}. Разреши микрофона за приложението в настройките на телефона.', ru:'Микрофон недоступен: {0}. Разрешите микрофон для приложения в настройках телефона.', uk:'Мікрофон недоступний: {0}. Дозвольте мікрофон для застосунку в налаштуваннях телефона.', en:'The microphone is not available: {0}. Allow the microphone for the app in the phone settings.', de:'Das Mikrofon ist nicht verfügbar: {0}. Erlaube das Mikrofon für die App in den Telefoneinstellungen.', fr:'Le micro n’est pas disponible : {0}. Autorise le micro pour l’application dans les réglages du téléphone.', es:'El micrófono no está disponible: {0}. Permite el micrófono para la app en los ajustes del teléfono.', 'es-MX':'El micrófono no está disponible: {0}. Permite el micrófono para la app en la configuración del teléfono.', it:'Il microfono non è disponibile: {0}. Consenti il microfono all’app nelle impostazioni del telefono.', pt:'O microfone não está disponível: {0}. Permita o microfone para o app nas configurações do telefone.', ar:'الميكروفون غير متاح: {0}. اسمح للتطبيق باستخدام الميكروفون من إعدادات الهاتف.', hi:'माइक उपलब्ध नहीं: {0}। फ़ोन सेटिंग्स में ऐप के लिए माइक की अनुमति दें।', ja:'マイクを利用できません: {0}。端末の設定でアプリにマイクを許可してください。', ky:'Микрофон жеткиликсиз: {0}. Телефондун жөндөөлөрүнөн колдонмого микрофонго уруксат бер.', 'zh-Hant':'無法使用麥克風：{0}。請在手機設定中允許此應用程式使用麥克風。' },
  sfx_to_studio: { bg:'→ Към Студиото', ru:'→ В Студию', uk:'→ До Студії', en:'→ To the Studio', de:'→ Zum Studio', fr:'→ Vers le Studio', es:'→ Al Estudio', 'es-MX':'→ Al Estudio', it:'→ Allo Studio', pt:'→ Para o Estúdio', ar:'→ إلى الاستوديو', hi:'→ स्टूडियो में', ja:'→ スタジオへ', ky:'→ Студияга', 'zh-Hant':'→ 前往工作室' },
  sfx_level: { bg:'Ниво', ru:'Уровень', uk:'Рівень', en:'Level', de:'Pegel', fr:'Niveau', es:'Nivel', 'es-MX':'Nivel', it:'Livello', pt:'Nível', ar:'المستوى', hi:'स्तर', ja:'レベル', ky:'Деңгээл', 'zh-Hant':'音量' },
  // --- групи ---
  g_voice: { bg:'Глас', ru:'Голос', uk:'Голос', en:'Voice', de:'Stimme', fr:'Voix', es:'Voz', 'es-MX':'Voz', it:'Voce', pt:'Voz', ar:'الصوت البشري', hi:'आवाज़', ja:'声', ky:'Добуш', 'zh-Hant':'人聲' },
  g_space: { bg:'Пространство', ru:'Пространство', uk:'Простір', en:'Space', de:'Raum', fr:'Espace', es:'Espacio', 'es-MX':'Espacio', it:'Spazio', pt:'Espaço', ar:'الفضاء', hi:'स्पेस', ja:'空間', ky:'Мейкиндик', 'zh-Hant':'空間' },
  g_tone: { bg:'Тембър и чистота', ru:'Тембр и чистота', uk:'Тембр і чистота', en:'Tone & clean-up', de:'Klang & Reinigung', fr:'Timbre et nettoyage', es:'Timbre y limpieza', 'es-MX':'Timbre y limpieza', it:'Timbro e pulizia', pt:'Timbre e limpeza', ar:'النغمة والتنظيف', hi:'टोन और सफ़ाई', ja:'音色と除去', ky:'Тембр жана тазалоо', 'zh-Hant':'音色與清理' },
  g_time: { bg:'Време', ru:'Время', uk:'Час', en:'Time', de:'Zeit', fr:'Temps', es:'Tiempo', 'es-MX':'Tiempo', it:'Tempo', pt:'Tempo', ar:'الزمن', hi:'समय', ja:'時間', ky:'Убакыт', 'zh-Hant':'時間' },
  g_level: { bg:'Сила', ru:'Громкость', uk:'Гучність', en:'Level', de:'Pegel', fr:'Niveau', es:'Nivel', 'es-MX':'Nivel', it:'Livello', pt:'Nível', ar:'المستوى', hi:'स्तर', ja:'音量', ky:'Деңгээл', 'zh-Hant':'音量' },
  // --- ефекти ---
  fx_pitch: { bg:'Височина (pitch, без смяна на темпото)', ru:'Высота (pitch, без смены темпа)', uk:'Висота (pitch, без зміни темпу)', en:'Pitch (tempo unchanged)', de:'Tonhöhe (Tempo bleibt)', fr:'Hauteur (tempo inchangé)', es:'Tono (sin cambiar el tempo)', 'es-MX':'Tono (sin cambiar el tempo)', it:'Intonazione (tempo invariato)', pt:'Tom (sem mudar o andamento)', ar:'طبقة الصوت (دون تغيير الإيقاع)', hi:'पिच (टेम्पो वही)', ja:'ピッチ（テンポそのまま）', ky:'Бийиктик (темп өзгөрбөйт)', 'zh-Hant':'音高（速度不變）' },
  fx_chipmunk: { bg:'Бурундук (тънък глас)', ru:'Бурундук (тонкий голос)', uk:'Бурундук (тонкий голос)', en:'Chipmunk (high voice)', de:'Chipmunk (hohe Stimme)', fr:'Chipmunk (voix aiguë)', es:'Ardilla (voz aguda)', 'es-MX':'Ardilla (voz aguda)', it:'Scoiattolo (voce acuta)', pt:'Esquilo (voz fina)', ar:'سنجاب (صوت رفيع)', hi:'चिपमंक (पतली आवाज़)', ja:'チップマンク（高い声）', ky:'Бурундук (ичке добуш)', 'zh-Hant':'花栗鼠（尖細嗓音）' },
  fx_deep: { bg:'Дълбок глас', ru:'Глубокий голос', uk:'Глибокий голос', en:'Deep voice', de:'Tiefe Stimme', fr:'Voix grave', es:'Voz grave', 'es-MX':'Voz grave', it:'Voce profonda', pt:'Voz grave', ar:'صوت عميق', hi:'गहरी आवाज़', ja:'低い声', ky:'Терең добуш', 'zh-Hant':'低沉嗓音' },
  fx_robot: { bg:'Робот (пръстенова модулация)', ru:'Робот (кольцевая модуляция)', uk:'Робот (кільцева модуляція)', en:'Robot (ring modulation)', de:'Roboter (Ringmodulation)', fr:'Robot (modulation en anneau)', es:'Robot (modulación en anillo)', 'es-MX':'Robot (modulación en anillo)', it:'Robot (modulazione ad anello)', pt:'Robô (modulação em anel)', ar:'روبوت (تعديل حلقي)', hi:'रोबोट (रिंग मॉड्युलेशन)', ja:'ロボット（リング変調）', ky:'Робот (шакек модуляциясы)', 'zh-Hant':'機器人（環形調變）' },
  fx_telephone: { bg:'Телефон', ru:'Телефон', uk:'Телефон', en:'Telephone', de:'Telefon', fr:'Téléphone', es:'Teléfono', 'es-MX':'Teléfono', it:'Telefono', pt:'Telefone', ar:'هاتف', hi:'टेलीफ़ोन', ja:'電話', ky:'Телефон', 'zh-Hant':'電話' },
  fx_radio: { bg:'Радио (с пращене)', ru:'Радио (с треском)', uk:'Радіо (з тріском)', en:'Radio (with static)', de:'Radio (mit Rauschen)', fr:'Radio (avec grésillement)', es:'Radio (con estática)', 'es-MX':'Radio (con estática)', it:'Radio (con fruscio)', pt:'Rádio (com chiado)', ar:'راديو (مع تشويش)', hi:'रेडियो (स्टैटिक के साथ)', ja:'ラジオ（ノイズ付き）', ky:'Радио (чырылдоо менен)', 'zh-Hant':'收音機（含雜訊）' },
  fx_vibrato: { bg:'Вибрато', ru:'Вибрато', uk:'Вібрато', en:'Vibrato', de:'Vibrato', fr:'Vibrato', es:'Vibrato', 'es-MX':'Vibrato', it:'Vibrato', pt:'Vibrato', ar:'فيبراتو', hi:'वाइब्रेटो', ja:'ビブラート', ky:'Вибрато', 'zh-Hant':'顫音' },
  fx_tremolo: { bg:'Тремоло', ru:'Тремоло', uk:'Тремоло', en:'Tremolo', de:'Tremolo', fr:'Trémolo', es:'Trémolo', 'es-MX':'Trémolo', it:'Tremolo', pt:'Tremolo', ar:'تريمولو', hi:'ट्रेमोलो', ja:'トレモロ', ky:'Тремоло', 'zh-Hant':'震音' },
  fx_chorus: { bg:'Хор', ru:'Хор', uk:'Хор', en:'Chorus', de:'Chorus', fr:'Chorus', es:'Coro', 'es-MX':'Coro', it:'Chorus', pt:'Chorus', ar:'كورس', hi:'कोरस', ja:'コーラス', ky:'Хор', 'zh-Hant':'合唱' },
  fx_echo: { bg:'Ехо', ru:'Эхо', uk:'Луна', en:'Echo', de:'Echo', fr:'Écho', es:'Eco', 'es-MX':'Eco', it:'Eco', pt:'Eco', ar:'صدى', hi:'इको', ja:'エコー', ky:'Жаңырык', 'zh-Hant':'回聲' },
  fx_reverb: { bg:'Реверб (зала)', ru:'Реверберация (зал)', uk:'Реверберація (зала)', en:'Reverb (hall)', de:'Hall', fr:'Réverbération (salle)', es:'Reverberación (sala)', 'es-MX':'Reverberación (sala)', it:'Riverbero (sala)', pt:'Reverb (sala)', ar:'صدى القاعة', hi:'रीवर्ब (हॉल)', ja:'リバーブ（ホール）', ky:'Реверб (зал)', 'zh-Hant':'殘響（大廳）' },
  fx_eq: { bg:'Еквалайзер (ниски / средни / високи)', ru:'Эквалайзер (низкие / средние / высокие)', uk:'Еквалайзер (низькі / середні / високі)', en:'Equalizer (low / mid / high)', de:'Equalizer (Tiefen / Mitten / Höhen)', fr:'Égaliseur (graves / médiums / aigus)', es:'Ecualizador (graves / medios / agudos)', 'es-MX':'Ecualizador (graves / medios / agudos)', it:'Equalizzatore (bassi / medi / alti)', pt:'Equalizador (graves / médios / agudos)', ar:'موازن (منخفض / متوسط / مرتفع)', hi:'इक्वलाइज़र (लो / मिड / हाई)', ja:'イコライザー（低／中／高）', ky:'Эквалайзер (төмөн / орто / жогору)', 'zh-Hant':'等化器（低／中／高）' },
  fx_denoise: { bg:'Шумопотискане (спектрално)', ru:'Шумоподавление (спектральное)', uk:'Шумозаглушення (спектральне)', en:'Noise reduction (spectral)', de:'Rauschunterdrückung (spektral)', fr:'Réduction du bruit (spectrale)', es:'Reducción de ruido (espectral)', 'es-MX':'Reducción de ruido (espectral)', it:'Riduzione del rumore (spettrale)', pt:'Redução de ruído (espectral)', ar:'تقليل الضجيج (طيفي)', hi:'शोर कम करना (स्पेक्ट्रल)', ja:'ノイズ除去（スペクトル）', ky:'Ызы-чууну басуу (спектралдык)', 'zh-Hant':'降噪（頻譜）' },
  fx_tempo: { bg:'Темпо (без смяна на височината)', ru:'Темп (без смены высоты)', uk:'Темп (без зміни висоти)', en:'Tempo (pitch unchanged)', de:'Tempo (Tonhöhe bleibt)', fr:'Tempo (hauteur inchangée)', es:'Tempo (sin cambiar el tono)', 'es-MX':'Tempo (sin cambiar el tono)', it:'Tempo (intonazione invariata)', pt:'Andamento (sem mudar o tom)', ar:'الإيقاع (دون تغيير الطبقة)', hi:'टेम्पो (पिच वही)', ja:'テンポ（ピッチそのまま）', ky:'Темп (бийиктик өзгөрбөйт)', 'zh-Hant':'速度（音高不變）' },
  fx_speed: { bg:'Скорост (променя и височината)', ru:'Скорость (меняет и высоту)', uk:'Швидкість (змінює й висоту)', en:'Speed (changes pitch too)', de:'Geschwindigkeit (ändert auch Tonhöhe)', fr:'Vitesse (change aussi la hauteur)', es:'Velocidad (cambia también el tono)', 'es-MX':'Velocidad (cambia también el tono)', it:'Velocità (cambia anche l’intonazione)', pt:'Velocidade (muda também o tom)', ar:'السرعة (تغيّر الطبقة أيضًا)', hi:'गति (पिच भी बदलती है)', ja:'速度（ピッチも変わる）', ky:'Ылдамдык (бийиктикти да өзгөртөт)', 'zh-Hant':'速度（音高也會改變）' },
  fx_reverse: { bg:'Реверс (наобратно)', ru:'Реверс (задом наперёд)', uk:'Реверс (навпаки)', en:'Reverse', de:'Rückwärts', fr:'Inverser', es:'Invertir', 'es-MX':'Invertir', it:'Inverti', pt:'Inverter', ar:'عكس', hi:'रिवर्स', ja:'逆再生', ky:'Тескери', 'zh-Hant':'倒轉' },
  fx_trim: { bg:'Изрязване (от / до секунда)', ru:'Обрезка (от / до секунды)', uk:'Обрізання (від / до секунди)', en:'Trim (from / to second)', de:'Zuschneiden (von / bis Sekunde)', fr:'Couper (de / à seconde)', es:'Recortar (de / a segundo)', 'es-MX':'Recortar (de / a segundo)', it:'Taglia (da / a secondo)', pt:'Cortar (de / até segundo)', ar:'قص (من / إلى ثانية)', hi:'ट्रिम (से / तक सेकंड)', ja:'トリム（開始／終了 秒）', ky:'Кесүү (секунддан / секундга)', 'zh-Hant':'裁剪（起／迄 秒）' },
  fx_fade: { bg:'Плавно начало / край (fade)', ru:'Плавное начало / конец (fade)', uk:'Плавний початок / кінець (fade)', en:'Fade in / out', de:'Ein-/Ausblenden', fr:'Fondu d’entrée / de sortie', es:'Fundido de entrada / salida', 'es-MX':'Fundido de entrada / salida', it:'Dissolvenza in / out', pt:'Fade in / out', ar:'تلاشٍ تدريجي بداية / نهاية', hi:'फ़ेड इन / आउट', ja:'フェードイン／アウト', ky:'Жумшак башталыш / аяк', 'zh-Hant':'淡入／淡出' },
  fx_gain: { bg:'Сила (усилване / затихване)', ru:'Громкость (усиление / ослабление)', uk:'Гучність (підсилення / послаблення)', en:'Volume (boost / cut)', de:'Lautstärke (anheben / senken)', fr:'Volume (augmenter / réduire)', es:'Volumen (subir / bajar)', 'es-MX':'Volumen (subir / bajar)', it:'Volume (alza / abbassa)', pt:'Volume (aumentar / reduzir)', ar:'مستوى الصوت (رفع / خفض)', hi:'वॉल्यूम (बढ़ाएं / घटाएं)', ja:'音量（上げ／下げ）', ky:'Үн катуулугу (күчөтүү / азайтуу)', 'zh-Hant':'音量（增／減）' },
  fx_normalize: { bg:'Нормализация (до върхово ниво)', ru:'Нормализация (по пику)', uk:'Нормалізація (за піком)', en:'Normalize (to peak level)', de:'Normalisieren (auf Spitzenpegel)', fr:'Normaliser (niveau crête)', es:'Normalizar (a nivel pico)', 'es-MX':'Normalizar (a nivel pico)', it:'Normalizza (al livello di picco)', pt:'Normalizar (ao nível de pico)', ar:'تطبيع (إلى مستوى الذروة)', hi:'नॉर्मलाइज़ (पीक स्तर तक)', ja:'ノーマライズ（ピーク基準）', ky:'Нормалдаштыруу (чоку деңгээлге)', 'zh-Hant':'正規化（至峰值）' },
  fx_mono: { bg:'Моно (сливане на каналите)', ru:'Моно (слияние каналов)', uk:'Моно (злиття каналів)', en:'Mono (merge channels)', de:'Mono (Kanäle zusammenführen)', fr:'Mono (fusion des canaux)', es:'Mono (unir canales)', 'es-MX':'Mono (unir canales)', it:'Mono (unisci i canali)', pt:'Mono (juntar canais)', ar:'أحادي (دمج القنوات)', hi:'मोनो (चैनल मिलाएं)', ja:'モノラル（チャンネル統合）', ky:'Моно (каналдарды бириктирүү)', 'zh-Hant':'單聲道（合併聲道）' },
  // --- готови модулатори ---
  pr_robot: { bg:'🤖 Робот', ru:'🤖 Робот', uk:'🤖 Робот', en:'🤖 Robot', de:'🤖 Roboter', fr:'🤖 Robot', es:'🤖 Robot', 'es-MX':'🤖 Robot', it:'🤖 Robot', pt:'🤖 Robô', ar:'🤖 روبوت', hi:'🤖 रोबोट', ja:'🤖 ロボット', ky:'🤖 Робот', 'zh-Hant':'🤖 機器人' },
  pr_chipmunk: { bg:'🐿 Бурундук', ru:'🐿 Бурундук', uk:'🐿 Бурундук', en:'🐿 Chipmunk', de:'🐿 Chipmunk', fr:'🐿 Chipmunk', es:'🐿 Ardilla', 'es-MX':'🐿 Ardilla', it:'🐿 Scoiattolo', pt:'🐿 Esquilo', ar:'🐿 سنجاب', hi:'🐿 चिपमंक', ja:'🐿 チップマンク', ky:'🐿 Бурундук', 'zh-Hant':'🐿 花栗鼠' },
  pr_deep: { bg:'🐻 Дълбок глас', ru:'🐻 Глубокий голос', uk:'🐻 Глибокий голос', en:'🐻 Deep voice', de:'🐻 Tiefe Stimme', fr:'🐻 Voix grave', es:'🐻 Voz grave', 'es-MX':'🐻 Voz grave', it:'🐻 Voce profonda', pt:'🐻 Voz grave', ar:'🐻 صوت عميق', hi:'🐻 गहरी आवाज़', ja:'🐻 低い声', ky:'🐻 Терең добуш', 'zh-Hant':'🐻 低沉嗓音' },
  pr_telephone: { bg:'☎ Телефон', ru:'☎ Телефон', uk:'☎ Телефон', en:'☎ Telephone', de:'☎ Telefon', fr:'☎ Téléphone', es:'☎ Teléfono', 'es-MX':'☎ Teléfono', it:'☎ Telefono', pt:'☎ Telefone', ar:'☎ هاتف', hi:'☎ टेलीफ़ोन', ja:'☎ 電話', ky:'☎ Телефон', 'zh-Hant':'☎ 電話' },
  pr_radio: { bg:'📻 Радио', ru:'📻 Радио', uk:'📻 Радіо', en:'📻 Radio', de:'📻 Radio', fr:'📻 Radio', es:'📻 Radio', 'es-MX':'📻 Radio', it:'📻 Radio', pt:'📻 Rádio', ar:'📻 راديو', hi:'📻 रेडियो', ja:'📻 ラジオ', ky:'📻 Радио', 'zh-Hant':'📻 收音機' },
  pr_hall: { bg:'🏛 Зала', ru:'🏛 Зал', uk:'🏛 Зала', en:'🏛 Hall', de:'🏛 Halle', fr:'🏛 Salle', es:'🏛 Sala', 'es-MX':'🏛 Sala', it:'🏛 Sala', pt:'🏛 Sala', ar:'🏛 قاعة', hi:'🏛 हॉल', ja:'🏛 ホール', ky:'🏛 Зал', 'zh-Hant':'🏛 大廳' },
  pr_cave: { bg:'🕳 Пещера', ru:'🕳 Пещера', uk:'🕳 Печера', en:'🕳 Cave', de:'🕳 Höhle', fr:'🕳 Grotte', es:'🕳 Cueva', 'es-MX':'🕳 Cueva', it:'🕳 Grotta', pt:'🕳 Caverna', ar:'🕳 كهف', hi:'🕳 गुफा', ja:'🕳 洞窟', ky:'🕳 Үңкүр', 'zh-Hant':'🕳 洞穴' },
  pr_choir: { bg:'🎶 Хор', ru:'🎶 Хор', uk:'🎶 Хор', en:'🎶 Choir', de:'🎶 Chor', fr:'🎶 Chœur', es:'🎶 Coro', 'es-MX':'🎶 Coro', it:'🎶 Coro', pt:'🎶 Coral', ar:'🎶 جوقة', hi:'🎶 कॉयर', ja:'🎶 合唱', ky:'🎶 Хор', 'zh-Hant':'🎶 合唱團' },
  pr_alien: { bg:'👽 Извънземен', ru:'👽 Инопланетянин', uk:'👽 Прибулець', en:'👽 Alien', de:'👽 Alien', fr:'👽 Extraterrestre', es:'👽 Alienígena', 'es-MX':'👽 Alienígena', it:'👽 Alieno', pt:'👽 Alienígena', ar:'👽 كائن فضائي', hi:'👽 एलियन', ja:'👽 エイリアン', ky:'👽 Бөтөн планеталык', 'zh-Hant':'👽 外星人' },
  pr_clean: { bg:'🧹 Изчисти шума', ru:'🧹 Убрать шум', uk:'🧹 Прибрати шум', en:'🧹 Clean noise', de:'🧹 Rauschen entfernen', fr:'🧹 Nettoyer le bruit', es:'🧹 Limpiar ruido', 'es-MX':'🧹 Limpiar ruido', it:'🧹 Pulisci rumore', pt:'🧹 Limpar ruído', ar:'🧹 إزالة الضجيج', hi:'🧹 शोर हटाएं', ja:'🧹 ノイズ除去', ky:'🧹 Ызы-чууну тазалоо', 'zh-Hant':'🧹 清除雜訊' },
  // --- параметри ---
  p_semitones: { bg:'Полутонове', ru:'Полутона', uk:'Півтони', en:'Semitones', de:'Halbtöne', fr:'Demi-tons', es:'Semitonos', 'es-MX':'Semitonos', it:'Semitoni', pt:'Semitons', ar:'أنصاف النغمات', hi:'सेमीटोन', ja:'半音', ky:'Жарым тондор', 'zh-Hant':'半音' },
  p_amount: { bg:'Сила (полутонове)', ru:'Степень (полутона)', uk:'Ступінь (півтони)', en:'Amount (semitones)', de:'Stärke (Halbtöne)', fr:'Intensité (demi-tons)', es:'Cantidad (semitonos)', 'es-MX':'Cantidad (semitonos)', it:'Quantità (semitoni)', pt:'Intensidade (semitons)', ar:'المقدار (أنصاف نغمات)', hi:'मात्रा (सेमीटोन)', ja:'量（半音）', ky:'Өлчөм (жарым тон)', 'zh-Hant':'幅度（半音）' },
  p_freq_hz: { bg:'Носеща честота (Hz)', ru:'Несущая частота (Гц)', uk:'Несуча частота (Гц)', en:'Carrier frequency (Hz)', de:'Trägerfrequenz (Hz)', fr:'Fréquence porteuse (Hz)', es:'Frecuencia portadora (Hz)', 'es-MX':'Frecuencia portadora (Hz)', it:'Frequenza portante (Hz)', pt:'Frequência portadora (Hz)', ar:'التردد الحامل (هرتز)', hi:'कैरियर आवृत्ति (Hz)', ja:'キャリア周波数（Hz）', ky:'Алып жүрүүчү жыштык (Гц)', 'zh-Hant':'載波頻率（Hz）' },
  p_drive: { bg:'Изкривяване (%)', ru:'Перегруз (%)', uk:'Перевантаження (%)', en:'Drive (%)', de:'Verzerrung (%)', fr:'Saturation (%)', es:'Saturación (%)', 'es-MX':'Saturación (%)', it:'Saturazione (%)', pt:'Saturação (%)', ar:'تشويه (%)', hi:'ड्राइव (%)', ja:'ドライブ（%）', ky:'Бурмалоо (%)', 'zh-Hant':'失真（%）' },
  p_static: { bg:'Пращене (%)', ru:'Треск (%)', uk:'Тріск (%)', en:'Static (%)', de:'Rauschen (%)', fr:'Grésillement (%)', es:'Estática (%)', 'es-MX':'Estática (%)', it:'Fruscio (%)', pt:'Chiado (%)', ar:'تشويش (%)', hi:'स्टैटिक (%)', ja:'ノイズ（%）', ky:'Чырылдоо (%)', 'zh-Hant':'雜訊（%）' },
  p_rate_hz: { bg:'Честота (Hz)', ru:'Частота (Гц)', uk:'Частота (Гц)', en:'Rate (Hz)', de:'Rate (Hz)', fr:'Vitesse (Hz)', es:'Frecuencia (Hz)', 'es-MX':'Frecuencia (Hz)', it:'Frequenza (Hz)', pt:'Frequência (Hz)', ar:'المعدل (هرتز)', hi:'दर (Hz)', ja:'速さ（Hz）', ky:'Жыштык (Гц)', 'zh-Hant':'速率（Hz）' },
  p_depth: { bg:'Дълбочина (%)', ru:'Глубина (%)', uk:'Глибина (%)', en:'Depth (%)', de:'Tiefe (%)', fr:'Profondeur (%)', es:'Profundidad (%)', 'es-MX':'Profundidad (%)', it:'Profondità (%)', pt:'Profundidade (%)', ar:'العمق (%)', hi:'गहराई (%)', ja:'深さ（%）', ky:'Тереңдик (%)', 'zh-Hant':'深度（%）' },
  p_depth_ms: { bg:'Дълбочина (ms)', ru:'Глубина (мс)', uk:'Глибина (мс)', en:'Depth (ms)', de:'Tiefe (ms)', fr:'Profondeur (ms)', es:'Profundidad (ms)', 'es-MX':'Profundidad (ms)', it:'Profondità (ms)', pt:'Profundidade (ms)', ar:'العمق (مللي ثانية)', hi:'गहराई (ms)', ja:'深さ（ms）', ky:'Тереңдик (мс)', 'zh-Hant':'深度（ms）' },
  p_mix: { bg:'Смес сух/обработен (%)', ru:'Смесь сухой/обработанный (%)', uk:'Суміш сухий/оброблений (%)', en:'Dry/wet mix (%)', de:'Dry/Wet-Mix (%)', fr:'Mélange sec/traité (%)', es:'Mezcla seco/procesado (%)', 'es-MX':'Mezcla seco/procesado (%)', it:'Mix dry/wet (%)', pt:'Mistura seco/processado (%)', ar:'مزج جاف/معالج (%)', hi:'ड्राई/वेट मिक्स (%)', ja:'ドライ／ウェット（%）', ky:'Кургак/иштетилген аралашма (%)', 'zh-Hant':'乾／濕混合（%）' },
  p_delay_ms: { bg:'Закъснение (ms)', ru:'Задержка (мс)', uk:'Затримка (мс)', en:'Delay (ms)', de:'Verzögerung (ms)', fr:'Délai (ms)', es:'Retardo (ms)', 'es-MX':'Retardo (ms)', it:'Ritardo (ms)', pt:'Atraso (ms)', ar:'التأخير (مللي ثانية)', hi:'विलंब (ms)', ja:'ディレイ（ms）', ky:'Кечигүү (мс)', 'zh-Hant':'延遲（ms）' },
  p_feedback: { bg:'Повторения (feedback %)', ru:'Повторы (feedback %)', uk:'Повтори (feedback %)', en:'Feedback (%)', de:'Feedback (%)', fr:'Réinjection (%)', es:'Realimentación (%)', 'es-MX':'Realimentación (%)', it:'Feedback (%)', pt:'Realimentação (%)', ar:'التغذية الراجعة (%)', hi:'फ़ीडबैक (%)', ja:'フィードバック（%）', ky:'Кайталоо (%)', 'zh-Hant':'回授（%）' },
  p_size_s: { bg:'Размер на залата (с)', ru:'Размер зала (с)', uk:'Розмір зали (с)', en:'Room size (s)', de:'Raumgröße (s)', fr:'Taille de la salle (s)', es:'Tamaño de la sala (s)', 'es-MX':'Tamaño de la sala (s)', it:'Dimensione sala (s)', pt:'Tamanho da sala (s)', ar:'حجم القاعة (ث)', hi:'हॉल का आकार (से)', ja:'空間の大きさ（秒）', ky:'Залдын өлчөмү (с)', 'zh-Hant':'空間大小（秒）' },
  p_low_db: { bg:'Ниски (dB)', ru:'Низкие (дБ)', uk:'Низькі (дБ)', en:'Low (dB)', de:'Tiefen (dB)', fr:'Graves (dB)', es:'Graves (dB)', 'es-MX':'Graves (dB)', it:'Bassi (dB)', pt:'Graves (dB)', ar:'منخفض (ديسيبل)', hi:'लो (dB)', ja:'低音（dB）', ky:'Төмөн (дБ)', 'zh-Hant':'低音（dB）' },
  p_mid_db: { bg:'Средни (dB)', ru:'Средние (дБ)', uk:'Середні (дБ)', en:'Mid (dB)', de:'Mitten (dB)', fr:'Médiums (dB)', es:'Medios (dB)', 'es-MX':'Medios (dB)', it:'Medi (dB)', pt:'Médios (dB)', ar:'متوسط (ديسيبل)', hi:'मिड (dB)', ja:'中音（dB）', ky:'Орто (дБ)', 'zh-Hant':'中音（dB）' },
  p_high_db: { bg:'Високи (dB)', ru:'Высокие (дБ)', uk:'Високі (дБ)', en:'High (dB)', de:'Höhen (dB)', fr:'Aigus (dB)', es:'Agudos (dB)', 'es-MX':'Agudos (dB)', it:'Alti (dB)', pt:'Agudos (dB)', ar:'مرتفع (ديسيبل)', hi:'हाई (dB)', ja:'高音（dB）', ky:'Жогору (дБ)', 'zh-Hant':'高音（dB）' },
  p_strength: { bg:'Сила (%)', ru:'Сила (%)', uk:'Сила (%)', en:'Strength (%)', de:'Stärke (%)', fr:'Intensité (%)', es:'Intensidad (%)', 'es-MX':'Intensidad (%)', it:'Intensità (%)', pt:'Intensidade (%)', ar:'الشدة (%)', hi:'तीव्रता (%)', ja:'強さ（%）', ky:'Күч (%)', 'zh-Hant':'強度（%）' },
  p_percent: { bg:'Процент от оригинала (%)', ru:'Процент от оригинала (%)', uk:'Відсоток від оригіналу (%)', en:'Percent of original (%)', de:'Prozent des Originals (%)', fr:'Pourcentage de l’original (%)', es:'Porcentaje del original (%)', 'es-MX':'Porcentaje del original (%)', it:'Percentuale dell’originale (%)', pt:'Percentual do original (%)', ar:'نسبة من الأصل (%)', hi:'मूल का प्रतिशत (%)', ja:'元に対する割合（%）', ky:'Түпнускадан пайыз (%)', 'zh-Hant':'原始的百分比（%）' },
  p_start_s: { bg:'От секунда', ru:'С секунды', uk:'Від секунди', en:'From second', de:'Ab Sekunde', fr:'À partir de la seconde', es:'Desde el segundo', 'es-MX':'Desde el segundo', it:'Dal secondo', pt:'Do segundo', ar:'من الثانية', hi:'सेकंड से', ja:'開始（秒）', ky:'Секунддан', 'zh-Hant':'從第幾秒' },
  p_end_s: { bg:'До секунда (0 = до края)', ru:'До секунды (0 = до конца)', uk:'До секунди (0 = до кінця)', en:'To second (0 = end)', de:'Bis Sekunde (0 = Ende)', fr:'Jusqu’à la seconde (0 = fin)', es:'Hasta el segundo (0 = final)', 'es-MX':'Hasta el segundo (0 = final)', it:'Al secondo (0 = fine)', pt:'Até o segundo (0 = fim)', ar:'إلى الثانية (0 = النهاية)', hi:'सेकंड तक (0 = अंत)', ja:'終了（秒、0 = 最後まで）', ky:'Секундга чейин (0 = аягына)', 'zh-Hant':'到第幾秒（0 = 結尾）' },
  p_fade_in_ms: { bg:'Плавно начало (ms)', ru:'Плавное начало (мс)', uk:'Плавний початок (мс)', en:'Fade in (ms)', de:'Einblenden (ms)', fr:'Fondu d’entrée (ms)', es:'Fundido de entrada (ms)', 'es-MX':'Fundido de entrada (ms)', it:'Dissolvenza in (ms)', pt:'Fade in (ms)', ar:'تلاشٍ بداية (مللي ثانية)', hi:'फ़ेड इन (ms)', ja:'フェードイン（ms）', ky:'Жумшак башталыш (мс)', 'zh-Hant':'淡入（ms）' },
  p_fade_out_ms: { bg:'Плавен край (ms)', ru:'Плавный конец (мс)', uk:'Плавний кінець (мс)', en:'Fade out (ms)', de:'Ausblenden (ms)', fr:'Fondu de sortie (ms)', es:'Fundido de salida (ms)', 'es-MX':'Fundido de salida (ms)', it:'Dissolvenza out (ms)', pt:'Fade out (ms)', ar:'تلاشٍ نهاية (مللي ثانية)', hi:'फ़ेड आउट (ms)', ja:'フェードアウト（ms）', ky:'Жумшак аяк (мс)', 'zh-Hant':'淡出（ms）' },
  p_db: { bg:'Усилване (dB)', ru:'Усиление (дБ)', uk:'Підсилення (дБ)', en:'Gain (dB)', de:'Verstärkung (dB)', fr:'Gain (dB)', es:'Ganancia (dB)', 'es-MX':'Ganancia (dB)', it:'Guadagno (dB)', pt:'Ganho (dB)', ar:'الكسب (ديسيبل)', hi:'गेन (dB)', ja:'ゲイン（dB）', ky:'Күчөтүү (дБ)', 'zh-Hant':'增益（dB）' },
  p_target_db: { bg:'Целево върхово ниво (dB)', ru:'Целевой пиковый уровень (дБ)', uk:'Цільовий піковий рівень (дБ)', en:'Target peak (dB)', de:'Ziel-Spitzenpegel (dB)', fr:'Niveau crête cible (dB)', es:'Pico objetivo (dB)', 'es-MX':'Pico objetivo (dB)', it:'Picco target (dB)', pt:'Pico alvo (dB)', ar:'ذروة الهدف (ديسيبل)', hi:'लक्ष्य पीक (dB)', ja:'目標ピーク（dB）', ky:'Максаттуу чоку (дБ)', 'zh-Hant':'目標峰值（dB）' }
});

export const title = t('snd_title');

// ---------------------------------------------------------------- стар конвертор (второстепенен)
const TARGETS = {
  mp4: { args: (i, o) => ['-i', i, '-vn', '-c:a', 'aac', '-b:a', '192k', o], mime: 'audio/mp4' },
  mp3: { args: (i, o) => ['-i', i, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', o], mime: 'audio/mpeg' },
  wav: { args: (i, o) => ['-i', i, '-vn', '-c:a', 'pcm_s16le', o], mime: 'audio/wav' },
  ogg: { args: (i, o) => ['-i', i, '-vn', '-c:a', 'libvorbis', '-q:a', '5', o], mime: 'audio/ogg' }
};
// Формати за запис от студиото (WAV е нативен; останалите през ffmpeg от WAV).
const EXPORT = {
  wav: { mime: 'audio/wav' },
  mp3: { args: (i, o) => ['-i', i, '-c:a', 'libmp3lame', '-b:a', '192k', o], mime: 'audio/mpeg' },
  ogg: { args: (i, o) => ['-i', i, '-c:a', 'libvorbis', '-q:a', '5', o], mime: 'audio/ogg' },
  m4a: { args: (i, o) => ['-i', i, '-c:a', 'aac', '-b:a', '192k', o], mime: 'audio/mp4' }
};

// Състоянието живее на ниво модул — записът/заредения звук оцеляват при връщане назад и обратно.
const S = { orig: null, cur: null, chain: [], srcLabel: '', srcKind: '', picked: null, playing: null, rec: null };

const CSS = `
.sfx-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.sfx-row .btn{margin-top:0;flex:1;min-width:96px;padding:10px 8px;font-size:.92em}
.sfx-wave{margin-top:10px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:6px 8px 4px}
.sfx-wave .wl{font-size:.72em;color:var(--text-dim);margin-bottom:2px}
.sfx-wave canvas{width:100%;height:56px;display:block}
.sfx-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin-top:6px}
.sfx-preset{padding:10px 6px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);font-weight:600;font-size:.86em;cursor:pointer;text-align:center}
.sfx-preset:active{border-color:var(--accent)}
.sfx-param{margin-top:10px}
.sfx-param .pl{display:flex;justify-content:space-between;font-size:.86em;color:var(--text-dim);margin-bottom:2px}
.sfx-param .pl b{color:var(--accent-2)}
.sfx-chain{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.sfx-chip{background:var(--bg);border:1px solid var(--accent);color:var(--accent-2);border-radius:999px;padding:4px 10px;font-size:.8em}
.sfx-src{margin-top:8px;font-size:.86em;color:var(--text)}
.sfx-src .k{display:inline-block;padding:1px 8px;border-radius:6px;font-size:.78em;margin-inline-end:6px;border:1px solid var(--warn);color:var(--warn)}
.sfx-rec-big{width:100%;padding:22px 12px;font-size:1.15em;border-radius:14px;margin-top:12px}
.sfx-rec-big.on{background:var(--err)}
.sfx-lvl{height:12px;background:var(--bg-3);border-radius:6px;overflow:hidden;margin-top:10px}
.sfx-lvl>div{height:100%;width:0;background:linear-gradient(90deg,var(--ok),var(--warn),var(--err));transition:width .08s}
.sfx-time{text-align:center;font-size:1.4em;font-weight:700;margin-top:8px;color:var(--accent-2)}
`;
function ensureCss() { if (document.getElementById('sfx-css')) return; const s = document.createElement('style'); s.id = 'sfx-css'; s.textContent = CSS; document.head.appendChild(s); }

const fmt1 = (v) => (Math.round(v * 10) / 10).toString();
function stopPlay() { try { if (S.playing) { S.playing.onended = null; S.playing.stop(); } } catch (e) {} S.playing = null; }
function play(buf) {
  stopPlay(); if (!buf) return;
  const ctx = FX.audioContext(); const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.onended = () => { if (S.playing === src) S.playing = null; };
  src.start(0); S.playing = src;
}
function drawWave(canvas, buf, color) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1; const w = Math.max(10, canvas.clientWidth || 300), h = 56;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(139,148,158,.35)'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  if (!buf) return;
  const n = Math.floor(w / 2); const pk = FX.peaks(buf, n); g.fillStyle = color;
  for (let i = 0; i < n; i++) { const a = Math.max(1, pk[i] * (h / 2 - 2)); g.fillRect(i * 2, h / 2 - a, 1.4, a * 2); }
}

// ---------------------------------------------------------------- запис от микрофона (PCM през ScriptProcessor — без кодеци)
async function startRecording(onLevel) {
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) throw new Error('getUserMedia');
  // Huawei 3.1 поука (auto-sound-diagnostics): 1) нативно искане на RECORD_AUDIO преди getUserMedia; 2) първо
  // „сурови" ограничения, при грешка — най-простото { audio: true }. Диалогът за разрешение изкарва апа на заден
  // план → спираме пробното заключване през __PUPIKES_SUSPEND_LOCK__ (както при избора на файл).
  try { window.__PUPIKES_SUSPEND_LOCK__ = true; } catch (e) {}
  let stream;
  try {
    try { const nat = window.PupikesNative; if (nat && typeof nat.ensureMic === 'function' && nat.ensureMic() === 'requested') await new Promise((r) => setTimeout(r, 1500)); } catch (_) {}
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (e1) { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  } finally { try { window.__PUPIKES_SUSPEND_LOCK__ = false; } catch (e) {} }
  const ctx = FX.audioContext();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const sink = ctx.createGain(); sink.gain.value = 0;      // процесорът трябва да е свързан към изхода, за да работи; нула = без самопрослушване
  const chunks = []; let frames = 0; const MAX = ctx.sampleRate * 300;   // до 5 минути
  proc.onaudioprocess = (ev) => {
    if (frames >= MAX) return;
    const d = ev.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d)); frames += d.length;
    let s = 0; for (let i = 0; i < d.length; i += 8) s += d[i] * d[i]; const rms = Math.sqrt(s / (d.length / 8));
    if (onLevel) onLevel(Math.min(1, rms * 4), frames / ctx.sampleRate);
  };
  src.connect(proc); proc.connect(sink); sink.connect(ctx.destination);
  return {
    stop() {
      try { proc.disconnect(); src.disconnect(); sink.disconnect(); } catch (e) {}
      try { stream.getTracks().forEach((tr) => tr.stop()); } catch (e) {}
      const all = new Float32Array(frames); let o = 0; for (const c of chunks) { if (o + c.length > frames) break; all.set(c, o); o += c.length; }
      return FX.makeBuffer([all.length ? all : new Float32Array(1)], ctx.sampleRate);
    }
  };
}

// Декодиране на файл: първо вграденият декодер; ако той не може (AMR/3GP и др.) — ffmpeg → WAV → декодер.
async function decodeBytes(bytes, name, onStatus) {
  try { return await FX.decodeAudio(bytes); } catch (e1) {
    if (onStatus) onStatus(t('snd_loading_engine'));
    const ff = await getFFmpeg(null);
    const inName = 'dec_' + String(name || 'audio').replace(/[^\w.\-]+/g, '_'); const outName = 'dec_out.wav';
    await ff.writeFile(inName, bytes);
    await ff.exec(['-i', inName, '-vn', '-c:a', 'pcm_s16le', outName]);
    const out = await ff.readFile(outName);
    try { await ff.deleteFile(inName); await ff.deleteFile(outName); } catch (e) {}
    if (!out || !out.length) throw e1;
    return FX.decodeAudio(out);
  }
}

// ---------------------------------------------------------------- екран
export function render(root) {
  ensureCss();
  const opt = (v, label) => `<option value="${v}">${esc(label)}</option>`;
  const groups = ['voice', 'space', 'tone', 'time', 'level'];
  const fxOptions = groups.map((g) => `<optgroup label="${esc(t('g_' + g))}">${FX.EFFECTS.filter((e) => e.group === g).map((e) => opt(e.id, t('fx_' + e.id))).join('')}</optgroup>`).join('');
  root.innerHTML = `
    <div class="tabs" id="sfxTabs">
      <button class="tab active" data-tab="studio">${esc(t('sfx_tab_studio'))}</button>
      <button class="tab" data-tab="rec">${esc(t('sfx_tab_rec'))}</button>
      <button class="tab" data-tab="conv">${esc(t('sfx_tab_conv'))}</button>
    </div>
    <div data-pane="studio">
      <div class="tool-card">
        <p class="hint">${esc(t('sfx_intro'))}</p>
        <div class="sfx-row">
          <button class="btn sec" id="sfxPick">${esc(t('sfx_pick'))}</button>
          <button class="btn sec" id="sfxRecGo">${esc(t('sfx_rec_btn'))}</button>
          <button class="btn sec" id="sfxDemo">${esc(t('sfx_demo'))}</button>
        </div>
        <div class="sfx-src" id="sfxSrc"></div>
        <div class="sfx-wave"><div class="wl">${esc(t('sfx_before'))}</div><canvas id="sfxWaveA"></canvas></div>
        <div class="sfx-wave"><div class="wl">${esc(t('sfx_after'))}</div><canvas id="sfxWaveB"></canvas></div>
        <div class="sfx-row">
          <button class="btn sec" id="sfxPlayA">${esc(t('sfx_play_orig'))}</button>
          <button class="btn" id="sfxPlayB">${esc(t('sfx_play_res'))}</button>
          <button class="btn sec" id="sfxStop" style="flex:0 0 auto;min-width:70px">${esc(t('sfx_stop'))}</button>
        </div>
        <div class="status" id="sfxSrcStatus"></div>
      </div>
      <div class="tool-card">
        <label>${esc(t('sfx_presets'))}</label>
        <div class="sfx-presets" id="sfxPresets">${FX.PRESETS.map((p) => `<button class="sfx-preset" data-preset="${p.id}">${esc(t('pr_' + p.id))}</button>`).join('')}</div>
      </div>
      <div class="tool-card">
        <label>${esc(t('sfx_effect'))}</label>
        <select id="sfxFx">${fxOptions}</select>
        <div id="sfxParams"></div>
        <button class="btn" id="sfxApply">${esc(t('sfx_apply'))}</button>
        <div class="bar" id="sfxBarWrap" style="display:none"><div id="sfxBar"></div></div>
        <div class="status" id="sfxStatus"></div>
      </div>
      <div class="tool-card">
        <label>${esc(t('sfx_chain'))}</label>
        <div class="sfx-chain" id="sfxChain"></div>
        <div class="sfx-row">
          <button class="btn sec" id="sfxUndo">${esc(t('sfx_undo'))}</button>
          <button class="btn sec" id="sfxReset">${esc(t('sfx_reset'))}</button>
        </div>
        <label>${esc(t('sfx_export_fmt'))}</label>
        <select id="sfxFmt"><option value="wav">WAV (PCM 16-bit)</option><option value="mp3">MP3</option><option value="ogg">OGG (Vorbis)</option><option value="m4a">M4A (AAC)</option></select>
        <p class="hint">${esc(t('sfx_fmt_note'))}</p>
        <button class="btn" id="sfxSave">${esc(t('sfx_save'))}</button>
        <div class="bar" id="sfxSaveBarWrap" style="display:none"><div id="sfxSaveBar"></div></div>
        <div class="status" id="sfxSaveStatus"></div>
      </div>
    </div>
    <div data-pane="rec" style="display:none">
      <div class="tool-card">
        <p class="hint">${esc(t('sfx_rec_hint'))}</p>
        <button class="btn sfx-rec-big" id="sfxRecToggle">${esc(t('sfx_rec_start'))}</button>
        <div class="hint" style="margin-top:12px">${esc(t('sfx_level'))}</div>
        <div class="sfx-lvl"><div id="sfxLvl"></div></div>
        <div class="sfx-time" id="sfxRecTime">0.0 s</div>
        <div class="status" id="sfxRecStatus"></div>
        <button class="btn sec" id="sfxToStudio" style="display:none">${esc(t('sfx_to_studio'))}</button>
      </div>
    </div>
    <div data-pane="conv" style="display:none">
      <div class="tool-card">
        <p class="hint">${esc(t('snd_notice'))}</p>
        <button class="btn" id="sndPick">${esc(t('snd_pick'))}</button>
        <div class="hint" id="sndFile"></div>
        <label>${esc(t('snd_target'))}</label>
        <select id="sndTarget">
          <option value="mp4">MP4 (AAC)</option><option value="mp3">MP3</option><option value="wav">WAV</option><option value="ogg">OGG (Vorbis)</option>
        </select>
        <button class="btn" id="sndGo">${esc(t('snd_go'))}</button>
        <div class="bar" id="barWrap" style="display:none"><div id="bar"></div></div>
        <div class="status" id="status"></div>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);

  // --- табове ---
  function showTab(id) {
    root.querySelectorAll('#sfxTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    root.querySelectorAll('[data-pane]').forEach((p) => { p.style.display = p.getAttribute('data-pane') === id ? '' : 'none'; });
    if (id === 'studio') refresh();
  }
  root.querySelectorAll('#sfxTabs .tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // --- източник / преглед ---
  function setSource(buf, label, kind) {
    stopPlay(); S.orig = buf; S.cur = buf; S.chain = []; S.srcLabel = label; S.srcKind = kind; refresh();
  }
  function refresh() {
    const src = $('#sfxSrc'); if (!src) return;
    if (!S.orig) { src.innerHTML = `<span class="hint">${esc(t('sfx_src_none'))}</span>`; }
    else {
      const d = FX.describe(S.cur); const tag = S.srcKind === 'demo' ? `<span class="k">${esc(t('sfx_src_demo'))}</span>` : (S.srcKind === 'rec' ? `<span class="k">${esc(t('sfx_src_rec'))}</span>` : '');
      src.innerHTML = tag + esc(tf('sfx_src_info', S.srcLabel, fmt1(d.duration), d.sampleRate, d.channels));
    }
    drawWave($('#sfxWaveA'), S.orig, 'rgba(139,148,158,.9)');
    drawWave($('#sfxWaveB'), S.cur, getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#e8536a');
    const ch = $('#sfxChain');
    ch.innerHTML = S.chain.length ? S.chain.map((c) => `<span class="sfx-chip">${esc(c)}</span>`).join('') : `<span class="hint">${esc(t('sfx_chain_none'))}</span>`;
    $('#sfxUndo').disabled = !S.chain.length; $('#sfxReset').disabled = !S.chain.length;
  }
  $('#sfxPlayA').addEventListener('click', () => { if (!S.orig) { setStatus($('#sfxSrcStatus'), 'err', t('sfx_need_src')); return; } play(S.orig); });
  $('#sfxPlayB').addEventListener('click', () => { if (!S.cur) { setStatus($('#sfxSrcStatus'), 'err', t('sfx_need_src')); return; } play(S.cur); });
  $('#sfxStop').addEventListener('click', stopPlay);
  $('#sfxDemo').addEventListener('click', () => { setSource(FX.makeDemo(), t('sfx_src_demo').split(' (')[0], 'demo'); setStatus($('#sfxSrcStatus'), 'ok', tf('sfx_loaded', t('sfx_src_demo'))); });
  $('#sfxRecGo').addEventListener('click', () => showTab('rec'));
  $('#sfxPick').addEventListener('click', async () => {
    const st = $('#sfxSrcStatus');
    try {
      const f = await pickBinaryFile('audio/*'); if (!f) return;
      const bytes = base64ToBytes(f.base64 || (f.dataUrl && f.dataUrl.split(',')[1]) || '');
      if (!bytes || !bytes.length) { setStatus(st, 'err', tf('sfx_decode_err', 'empty')); return; }
      setStatus(st, 'work', t('sfx_loading'));
      const buf = await decodeBytes(bytes, f.name, (m) => setStatus(st, 'work', m));
      setSource(buf, f.name || 'audio', 'file');
      setStatus(st, 'ok', tf('sfx_loaded', (f.name || 'audio') + ' (' + fmtSize(bytes.length) + ')'));
    } catch (e) { setStatus(st, 'err', tf('sfx_decode_err', (e && e.message) || e)); }
  });

  // --- параметри на избрания ефект ---
  function renderParams() {
    const e = FX.effectById($('#sfxFx').value); const box = $('#sfxParams'); box.innerHTML = '';
    if (!e) return;
    e.params.forEach((p) => {
      const row = document.createElement('div'); row.className = 'sfx-param';
      row.innerHTML = `<div class="pl"><span>${esc(t('p_' + p.key))}</span><b data-v>${p.def}</b></div><input type="range" data-key="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.def}">`;
      const inp = row.querySelector('input'); inp.addEventListener('input', () => { row.querySelector('[data-v]').textContent = inp.value; });
      box.appendChild(row);
    });
  }
  $('#sfxFx').addEventListener('change', renderParams); renderParams();
  function readParams() { const p = {}; root.querySelectorAll('#sfxParams input[data-key]').forEach((i) => { p[i.dataset.key] = parseFloat(i.value); }); return p; }
  const chipLabel = (id, params) => { const e = FX.effectById(id); const vals = e ? e.params.map((q) => params[q.key]).filter((v) => v != null).join('/') : ''; return t('fx_' + id).split(' (')[0] + (vals ? ' ' + vals : ''); };

  let busy = false;
  async function runChain(chainList, label) {
    if (!S.cur) { setStatus($('#sfxStatus'), 'err', t('sfx_need_src')); return; }
    if (busy) return; busy = true; stopPlay();
    const st = $('#sfxStatus'), wrap = $('#sfxBarWrap'), bar = $('#sfxBar'); wrap.style.display = ''; bar.style.width = '0%';
    setStatus(st, 'work', tf('sfx_working', 0));
    try {
      const out = await FX.applyChain(S.cur, chainList, (p) => { const pct = Math.round(p * 100); bar.style.width = pct + '%'; setStatus(st, 'work', tf('sfx_working', pct)); });
      S.cur = out; S.chain.push(label); refresh();
      setStatus(st, 'ok', tf('sfx_done_fx', label, fmt1(FX.describe(out).duration)));
    } catch (e) { setStatus(st, 'err', (e && e.message) || String(e)); }
    finally { busy = false; wrap.style.display = 'none'; }
  }
  $('#sfxApply').addEventListener('click', () => { const id = $('#sfxFx').value; const p = readParams(); runChain([[id, p]], chipLabel(id, p)); });
  root.querySelectorAll('.sfx-preset').forEach((b) => b.addEventListener('click', () => { const pr = FX.PRESETS.find((x) => x.id === b.dataset.preset); if (pr) runChain(pr.chain, t('pr_' + pr.id)); }));
  $('#sfxUndo').addEventListener('click', async () => {
    // Отмяна = преизчисляване на веригата без последната стъпка (буферите не се пазят — паметта на телефона е ограничена).
    if (!S.chain.length || busy) return; S.chain.pop(); const labels = S.chain.slice(); S.chain = []; S.cur = S.orig; refresh();
    for (const l of labels) { const pr = FX.PRESETS.find((x) => t('pr_' + x.id) === l); if (pr) await runChain(pr.chain, l); else { const m = parseChip(l); if (m) await runChain([[m.id, m.params]], l); } }
  });
  // чип „Ехо 300/40/45" → { id, params } (обратно от етикета)
  function parseChip(label) {
    for (const e of FX.EFFECTS) { const nm = t('fx_' + e.id).split(' (')[0]; if (label === nm || label.indexOf(nm + ' ') === 0) { const vals = label.slice(nm.length).trim().split('/').map(parseFloat); const p = {}; e.params.forEach((q, i) => { p[q.key] = isFinite(vals[i]) ? vals[i] : q.def; }); return { id: e.id, params: p }; } }
    return null;
  }
  $('#sfxReset').addEventListener('click', () => { if (busy) return; stopPlay(); S.cur = S.orig; S.chain = []; refresh(); setStatus($('#sfxStatus'), 'ok', t('sfx_reset')); });

  // --- запис/споделяне ---
  $('#sfxSave').addEventListener('click', async () => {
    const st = $('#sfxSaveStatus'); if (!S.cur) { setStatus(st, 'err', t('sfx_need_src')); return; }
    if (busy) return; busy = true;
    const fmt = $('#sfxFmt').value; const cfg = EXPORT[fmt] || EXPORT.wav; const btn = $('#sfxSave'); btn.disabled = true;
    const wrap = $('#sfxSaveBarWrap'), bar = $('#sfxSaveBar');
    try {
      const wav = FX.encodeWav(S.cur); let out = wav; const base = (S.srcLabel || 'sound').replace(/\.[^.]+$/, '').replace(/[^\wЀ-ӿ.\- ]+/g, '_').slice(0, 40) || 'sound';
      if (fmt !== 'wav') {
        wrap.style.display = ''; bar.style.width = '0%'; setStatus(st, 'work', t('snd_loading_engine'));
        const ff = await getFFmpeg((p) => { const pct = Math.round(p * 100); bar.style.width = pct + '%'; setStatus(st, 'work', tf('sfx_working', pct)); });
        await ff.writeFile('studio_in.wav', wav); const outName = 'studio_out.' + fmt;
        await ff.exec(cfg.args('studio_in.wav', outName));
        out = await ff.readFile(outName);
        try { await ff.deleteFile('studio_in.wav'); await ff.deleteFile(outName); } catch (e) {}
        if (!out || !out.length) throw new Error('empty output');
      }
      const name = base + '-studio.' + fmt;
      await saveFile(name, new Blob([out], { type: cfg.mime }), cfg.mime);
      setStatus(st, 'ok', tf('sfx_saved', name, fmtSize(out.length)));
    } catch (e) { setStatus(st, 'err', tf('snd_error', (e && e.message) || e)); }
    finally { busy = false; btn.disabled = false; wrap.style.display = 'none'; }
  });

  // --- таб „Запис" ---
  const recBtn = $('#sfxRecToggle'), lvl = $('#sfxLvl'), recTime = $('#sfxRecTime'), recSt = $('#sfxRecStatus');
  function paintRec() { recBtn.textContent = S.rec ? t('sfx_rec_stop') : t('sfx_rec_start'); recBtn.classList.toggle('on', !!S.rec); }
  paintRec();
  recBtn.addEventListener('click', async () => {
    if (S.rec) {
      const buf = S.rec.stop(); S.rec = null; paintRec(); lvl.style.width = '0%';
      setSource(buf, t('sfx_src_rec'), 'rec');
      setStatus(recSt, 'ok', tf('sfx_rec_done', fmt1(FX.describe(buf).duration))); $('#sfxToStudio').style.display = '';
      return;
    }
    try {
      setStatus(recSt, 'work', tf('sfx_rec_time', '0.0')); $('#sfxToStudio').style.display = 'none';
      S.rec = await startRecording((level, secs) => { lvl.style.width = Math.round(level * 100) + '%'; recTime.textContent = fmt1(secs) + ' s'; setStatus(recSt, 'work', tf('sfx_rec_time', fmt1(secs))); if (secs >= 300) recBtn.click(); });
      paintRec();
    } catch (e) { S.rec = null; paintRec(); setStatus(recSt, 'err', tf('sfx_rec_err', (e && (e.name || e.message)) || e)); }
  });
  $('#sfxToStudio').addEventListener('click', () => showTab('studio'));

  // --- таб „Конвертор" (старият инструмент, непроменен по поведение) ---
  const status = $('#status');
  $('#sndPick').addEventListener('click', async () => {
    try {
      const f = await pickBinaryFile('audio/*'); if (!f) return;
      const bytes = base64ToBytes(f.base64 || (f.dataUrl && f.dataUrl.split(',')[1]) || '');
      if (!bytes || !bytes.length) { setStatus(status, 'err', tf('snd_error', 'empty file')); return; }
      S.picked = { name: f.name || 'audio', bytes };
      $('#sndFile').textContent = tf('snd_picked', S.picked.name, fmtSize(S.picked.bytes.length));
    } catch (e) { setStatus(status, 'err', (e && e.message) || tf('snd_error', 'read failed')); }
  });
  $('#sndGo').addEventListener('click', async () => {
    if (!S.picked) { setStatus(status, 'err', t('snd_need_file')); return; }
    const target = $('#sndTarget').value; const cfg = TARGETS[target];
    const btn = $('#sndGo'); btn.disabled = true; const barWrap = $('#barWrap'); const bar = $('#bar'); barWrap.style.display = '';
    setStatus(status, 'work', t('snd_loading_engine'));
    try {
      const ff = await getFFmpeg((p) => { const pct = Math.round(p * 100); bar.style.width = pct + '%'; setStatus(status, 'work', tf('snd_working', pct)); });
      const inSize = S.picked.bytes.length;   // ПРЕДИ writeFile — буферът се прехвърля и занулява
      const inName = 'in_' + S.picked.name.replace(/[^\w.\-]+/g, '_'); const outName = 'out.' + target;
      await ff.writeFile(inName, S.picked.bytes); await ff.exec(cfg.args(inName, outName));
      const out = await ff.readFile(outName); try { await ff.deleteFile(inName); await ff.deleteFile(outName); } catch (e) {}
      if (!out || !out.length) throw new Error('empty output');
      const base = S.picked.name.replace(/\.[^.]+$/, '') || 'audio';
      await saveFile(base + '.' + target, new Blob([out], { type: cfg.mime }), cfg.mime);
      setStatus(status, 'ok', tf('snd_done', fmtSize(inSize), fmtSize(out.length), base + '.' + target));
      S.picked = null; $('#sndFile').textContent = '';
    } catch (e) { setStatus(status, 'err', tf('snd_error', (e && e.message) || e)); }
    finally { btn.disabled = false; }
  });

  // При първо отваряне (нищо заредено) — примерът се зарежда автоматично, ясно маркиран като „пример",
  // за да е видно веднага какво прави студиото (изтрива се с „Нулирай"/зареждане на файл или запис).
  if (!S.orig) { try { setSource(FX.makeDemo(), t('sfx_src_demo').split(' (')[0], 'demo'); } catch (e) { refresh(); } }
  else refresh();
}
