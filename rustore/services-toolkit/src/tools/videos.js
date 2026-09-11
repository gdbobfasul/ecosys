// Version: 1.0021
// v1.0021 (11.09.2026): „Кадър → снимка (JPG)" увисваше в ffmpeg.wasm (`-ss X -i in -frames:v 1 out.jpg`
// никога не завършваше) → кадърът се взима с <video> + canvas (core/vframe.js, без ffmpeg); ffmpeg остава
// само като резерва за формати, които вграденият декодер не отваря, с `-i in -ss X -frames:v 1 -update 1`.
// Видео инструменти — изцяло НА УСТРОЙСТВОТО (ffmpeg.wasm, еднонишков core, вграден в приложението —
// не тегли нищо от интернет). Обогатяване (Huawei 4.3, 09.09.2026): освен конвертора (mp4 ↔ webm /
// avi / mov / mkv / gif) вече има и ОПЕРАЦИИ: изрязване (от/продължителност), само звукът (MP3),
// завъртане/огледало, скорост (0.5×/1.5×/2×), без звук, смаляване (720p/480p), кадър → снимка,
// GIF с избор на секунди/кадри/ширина, компресия (по-малък файл). Един и същ файл → всяка операция.
import { esc, setStatus, fmtSize } from '../core/ui.js';
import { saveFile } from '../core/filesave.js';
import { pickBinaryFile } from '../core/filepick.js';
import { getFFmpeg, base64ToBytes } from '../core/ffm.js';
import { t, tf, register } from '../core/i18n.js';
import { grabFrameJPEG, videoMime, canvasBlob } from '../core/vframe.js';

// PNG байтове (от ffmpeg) → JPEG Blob през canvas.
async function pngToJpeg(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('png')); i.src = url; });
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext('2d').drawImage(im, 0, 0);
    return await canvasBlob(c, 'image/jpeg', 0.92);
  } finally { URL.revokeObjectURL(url); }
}

register({
  vid_title: { bg:'Видео инструменти', ru:'Видео инструменты', uk:'Відео інструменти', en:'Video tools', de:'Video-Werkzeuge', fr:'Outils vidéo', es:'Herramientas de vídeo', 'es-MX':'Herramientas de video', it:'Strumenti video', pt:'Ferramentas de vídeo', ar:'أدوات الفيديو', hi:'वीडियो उपकरण', ja:'動画ツール', ky:'Видео куралдар', 'zh-Hant':'影片工具' },
  vid_notice: { bg:'Всичко става на устройството — нищо не се качва в интернет. Избери файл, после операция. Големите видеа отнемат време (еднонишков двигател).', ru:'Всё выполняется на устройстве — ничего не загружается в интернет. Выберите файл, затем операцию. Большие видео требуют времени.', uk:'Усе виконується на пристрої — нічого не завантажується в інтернет. Виберіть файл, потім операцію. Великі відео потребують часу.', en:'Everything runs on the device — nothing is uploaded. Pick a file, then an operation. Large videos take time (single-thread engine).', de:'Alles läuft auf dem Gerät — nichts wird hochgeladen. Datei wählen, dann Vorgang. Große Videos brauchen Zeit.', fr:'Tout se fait sur l\'appareil — rien n\'est envoyé. Choisissez un fichier puis une opération. Les grandes vidéos prennent du temps.', es:'Todo ocurre en el dispositivo — no se sube nada. Elige un archivo y luego una operación. Los vídeos grandes tardan.', 'es-MX':'Todo ocurre en el dispositivo — no se sube nada. Elige un archivo y luego una operación. Los videos grandes tardan.', it:'Tutto avviene sul dispositivo — nulla viene caricato. Scegli un file, poi un\'operazione. I video grandi richiedono tempo.', pt:'Tudo acontece no dispositivo — nada é enviado. Escolha um ficheiro e depois uma operação. Vídeos grandes demoram.', ar:'كل شيء يتم على الجهاز — لا يُرفع شيء. اختر ملفاً ثم عملية. الفيديوهات الكبيرة تستغرق وقتاً.', hi:'सब कुछ डिवाइस पर होता है — कुछ अपलोड नहीं होता। फ़ाइल चुनें, फिर ऑपरेशन। बड़े वीडियो में समय लगता है।', ja:'すべて端末内で処理（アップロードなし）。ファイルを選び、操作を選択。大きな動画は時間がかかります。', ky:'Баары түзмөктө аткарылат — эч нерсе жүктөлбөйт. Файл, анан операция танда. Чоң видеолор убакыт алат.', 'zh-Hant':'全部在裝置上完成 — 不會上傳。先選檔案再選操作。大型影片需要時間。' },
  vid_pick: { bg:'🎬 Избери видео файл', ru:'🎬 Выбрать видеофайл', uk:'🎬 Вибрати відеофайл', en:'🎬 Choose a video file', de:'🎬 Videodatei wählen', fr:'🎬 Choisir un fichier vidéo', es:'🎬 Elegir archivo de vídeo', 'es-MX':'🎬 Elegir archivo de video', it:'🎬 Scegli un file video', pt:'🎬 Escolher ficheiro de vídeo', ar:'🎬 اختر ملف فيديو', hi:'🎬 वीडियो फ़ाइल चुनें', ja:'🎬 動画ファイルを選択', ky:'🎬 Видео файл танда', 'zh-Hant':'🎬 選擇影片檔' },
  vid_op: { bg:'Операция', ru:'Операция', uk:'Операція', en:'Operation', de:'Vorgang', fr:'Opération', es:'Operación', 'es-MX':'Operación', it:'Operazione', pt:'Operação', ar:'العملية', hi:'ऑपरेशन', ja:'操作', ky:'Операция', 'zh-Hant':'操作' },
  vid_op_convert: { bg:'Конвертирай формата', ru:'Конвертировать формат', uk:'Конвертувати формат', en:'Convert format', de:'Format konvertieren', fr:'Convertir le format', es:'Convertir formato', 'es-MX':'Convertir formato', it:'Converti formato', pt:'Converter formato', ar:'تحويل الصيغة', hi:'फ़ॉर्मेट बदलें', ja:'形式を変換', ky:'Форматты өзгөрт', 'zh-Hant':'轉換格式' },
  vid_op_trim: { bg:'Изрежи (от / продължителност)', ru:'Обрезать (от / длительность)', uk:'Обрізати (від / тривалість)', en:'Trim (from / duration)', de:'Zuschneiden (ab / Dauer)', fr:'Couper (début / durée)', es:'Recortar (desde / duración)', 'es-MX':'Recortar (desde / duración)', it:'Taglia (da / durata)', pt:'Cortar (de / duração)', ar:'قص (من / المدة)', hi:'काटें (से / अवधि)', ja:'トリミング（開始／長さ）', ky:'Кесүү (башталыш / узактык)', 'zh-Hant':'剪輯（起點／長度）' },
  vid_op_audio: { bg:'Само звукът → MP3', ru:'Только звук → MP3', uk:'Лише звук → MP3', en:'Audio only → MP3', de:'Nur Ton → MP3', fr:'Audio seul → MP3', es:'Solo audio → MP3', 'es-MX':'Solo audio → MP3', it:'Solo audio → MP3', pt:'Só áudio → MP3', ar:'الصوت فقط → MP3', hi:'सिर्फ़ ऑडियो → MP3', ja:'音声のみ → MP3', ky:'Үн гана → MP3', 'zh-Hant':'僅音訊 → MP3' },
  vid_op_rotate: { bg:'Завърти / огледало', ru:'Повернуть / зеркало', uk:'Повернути / дзеркало', en:'Rotate / mirror', de:'Drehen / spiegeln', fr:'Tourner / miroir', es:'Girar / espejo', 'es-MX':'Girar / espejo', it:'Ruota / specchia', pt:'Rodar / espelhar', ar:'تدوير / انعكاس', hi:'घुमाएँ / मिरर', ja:'回転／反転', ky:'Буруу / күзгү', 'zh-Hant':'旋轉／鏡像' },
  vid_op_speed: { bg:'Скорост', ru:'Скорость', uk:'Швидкість', en:'Speed', de:'Geschwindigkeit', fr:'Vitesse', es:'Velocidad', 'es-MX':'Velocidad', it:'Velocità', pt:'Velocidade', ar:'السرعة', hi:'गति', ja:'速度', ky:'Ылдамдык', 'zh-Hant':'速度' },
  vid_op_mute: { bg:'Без звук', ru:'Без звука', uk:'Без звуку', en:'Remove sound', de:'Ton entfernen', fr:'Sans son', es:'Sin sonido', 'es-MX':'Sin sonido', it:'Senza audio', pt:'Sem som', ar:'بدون صوت', hi:'आवाज़ हटाएँ', ja:'音声を削除', ky:'Үнсүз', 'zh-Hant':'移除聲音' },
  vid_op_resize: { bg:'Смали (720p / 480p)', ru:'Уменьшить (720p / 480p)', uk:'Зменшити (720p / 480p)', en:'Downscale (720p / 480p)', de:'Verkleinern (720p / 480p)', fr:'Réduire (720p / 480p)', es:'Reducir (720p / 480p)', 'es-MX':'Reducir (720p / 480p)', it:'Riduci (720p / 480p)', pt:'Reduzir (720p / 480p)', ar:'تصغير (720p / 480p)', hi:'छोटा करें (720p / 480p)', ja:'縮小（720p／480p）', ky:'Кичирейтүү (720p / 480p)', 'zh-Hant':'縮小（720p／480p）' },
  vid_op_compress: { bg:'Компресирай (по-малък файл)', ru:'Сжать (меньше файл)', uk:'Стиснути (менший файл)', en:'Compress (smaller file)', de:'Komprimieren (kleinere Datei)', fr:'Compresser (fichier plus petit)', es:'Comprimir (archivo más pequeño)', 'es-MX':'Comprimir (archivo más pequeño)', it:'Comprimi (file più piccolo)', pt:'Comprimir (ficheiro menor)', ar:'ضغط (ملف أصغر)', hi:'कंप्रेस (छोटी फ़ाइल)', ja:'圧縮（ファイルを小さく）', ky:'Кысуу (кичине файл)', 'zh-Hant':'壓縮（檔案更小）' },
  vid_op_frame: { bg:'Кадър → снимка (JPG)', ru:'Кадр → фото (JPG)', uk:'Кадр → фото (JPG)', en:'Frame → photo (JPG)', de:'Bild → Foto (JPG)', fr:'Image → photo (JPG)', es:'Fotograma → foto (JPG)', 'es-MX':'Fotograma → foto (JPG)', it:'Fotogramma → foto (JPG)', pt:'Fotograma → foto (JPG)', ar:'إطار → صورة (JPG)', hi:'फ़्रेम → फ़ोटो (JPG)', ja:'フレーム → 写真（JPG）', ky:'Кадр → сүрөт (JPG)', 'zh-Hant':'畫格 → 照片（JPG）' },
  vid_op_gif: { bg:'GIF (секунди / кадри / ширина)', ru:'GIF (секунды / кадры / ширина)', uk:'GIF (секунди / кадри / ширина)', en:'GIF (seconds / fps / width)', de:'GIF (Sekunden / fps / Breite)', fr:'GIF (secondes / fps / largeur)', es:'GIF (segundos / fps / ancho)', 'es-MX':'GIF (segundos / fps / ancho)', it:'GIF (secondi / fps / larghezza)', pt:'GIF (segundos / fps / largura)', ar:'GIF (ثوانٍ / إطارات / عرض)', hi:'GIF (सेकंड / fps / चौड़ाई)', ja:'GIF（秒／fps／幅）', ky:'GIF (секунд / кадр / туурасы)', 'zh-Hant':'GIF（秒／fps／寬度）' },
  vid_target: { bg:'Целеви формат', ru:'Целевой формат', uk:'Цільовий формат', en:'Target format', de:'Zielformat', fr:'Format cible', es:'Formato de destino', 'es-MX':'Formato de destino', it:'Formato di destinazione', pt:'Formato de destino', ar:'الصيغة الهدف', hi:'लक्ष्य फ़ॉर्मेट', ja:'出力形式', ky:'Максаттуу формат', 'zh-Hant':'目標格式' },
  vid_from: { bg:'От (сек.)', ru:'От (сек.)', uk:'Від (сек.)', en:'From (s)', de:'Ab (s)', fr:'Début (s)', es:'Desde (s)', 'es-MX':'Desde (s)', it:'Da (s)', pt:'De (s)', ar:'من (ث)', hi:'से (सेकंड)', ja:'開始（秒）', ky:'Башталыш (сек)', 'zh-Hant':'起點（秒）' },
  vid_dur: { bg:'Продължителност (сек.)', ru:'Длительность (сек.)', uk:'Тривалість (сек.)', en:'Duration (s)', de:'Dauer (s)', fr:'Durée (s)', es:'Duración (s)', 'es-MX':'Duración (s)', it:'Durata (s)', pt:'Duração (s)', ar:'المدة (ث)', hi:'अवधि (सेकंड)', ja:'長さ（秒）', ky:'Узактык (сек)', 'zh-Hant':'長度（秒）' },
  vid_at: { bg:'В секунда', ru:'На секунде', uk:'На секунді', en:'At second', de:'Bei Sekunde', fr:'À la seconde', es:'En el segundo', 'es-MX':'En el segundo', it:'Al secondo', pt:'No segundo', ar:'عند الثانية', hi:'सेकंड पर', ja:'秒位置', ky:'Секундада', 'zh-Hant':'於第幾秒' },
  vid_fps: { bg:'Кадри/сек', ru:'Кадров/с', uk:'Кадрів/с', en:'FPS', de:'FPS', fr:'FPS', es:'FPS', 'es-MX':'FPS', it:'FPS', pt:'FPS', ar:'إطار/ث', hi:'FPS', ja:'FPS', ky:'FPS', 'zh-Hant':'FPS' },
  vid_width: { bg:'Ширина (px)', ru:'Ширина (px)', uk:'Ширина (px)', en:'Width (px)', de:'Breite (px)', fr:'Largeur (px)', es:'Ancho (px)', 'es-MX':'Ancho (px)', it:'Larghezza (px)', pt:'Largura (px)', ar:'العرض (px)', hi:'चौड़ाई (px)', ja:'幅（px）', ky:'Туурасы (px)', 'zh-Hant':'寬度（px）' },
  vid_go: { bg:'Изпълни', ru:'Выполнить', uk:'Виконати', en:'Run', de:'Ausführen', fr:'Exécuter', es:'Ejecutar', 'es-MX':'Ejecutar', it:'Esegui', pt:'Executar', ar:'تنفيذ', hi:'चलाएँ', ja:'実行', ky:'Аткаруу', 'zh-Hant':'執行' },
  vid_need_file: { bg:'Първо избери видео файл.', ru:'Сначала выберите видеофайл.', uk:'Спочатку виберіть відеофайл.', en:'Choose a video file first.', de:'Wähle zuerst eine Videodatei.', fr:'Choisissez d\'abord un fichier vidéo.', es:'Elige primero un archivo de vídeo.', 'es-MX':'Elige primero un archivo de video.', it:'Scegli prima un file video.', pt:'Escolha primeiro um ficheiro de vídeo.', ar:'اختر ملف فيديو أولاً.', hi:'पहले वीडियो फ़ाइल चुनें।', ja:'先に動画ファイルを選択してください。', ky:'Адегенде видео файл танда.', 'zh-Hant':'請先選擇影片檔。' },
  vid_loading_engine: { bg:'Зареждам видео двигателя (първия път отнема няколко секунди)…', ru:'Загружаю видеодвижок (в первый раз занимает несколько секунд)…', uk:'Завантажую відеодвигун (першого разу кілька секунд)…', en:'Loading the video engine (first time takes a few seconds)…', de:'Lade Video-Engine (beim ersten Mal einige Sekunden)…', fr:'Chargement du moteur vidéo (quelques secondes la première fois)…', es:'Cargando el motor de vídeo (la primera vez tarda unos segundos)…', 'es-MX':'Cargando el motor de video (la primera vez tarda unos segundos)…', it:'Caricamento del motore video (la prima volta richiede qualche secondo)…', pt:'A carregar o motor de vídeo (a primeira vez demora alguns segundos)…', ar:'جارٍ تحميل محرك الفيديو (أول مرة تستغرق ثوانٍ)…', hi:'वीडियो इंजन लोड हो रहा है (पहली बार कुछ सेकंड)…', ja:'動画エンジンを読み込み中（初回は数秒）…', ky:'Видео кыймылдаткыч жүктөлүүдө (биринчи жолу бир нече секунд)…', 'zh-Hant':'載入影片引擎中（首次需數秒）…' },
  vid_working: { bg:'Обработвам… {0}%', ru:'Обрабатываю… {0}%', uk:'Обробляю… {0}%', en:'Processing… {0}%', de:'Verarbeite… {0}%', fr:'Traitement… {0}%', es:'Procesando… {0}%', 'es-MX':'Procesando… {0}%', it:'Elaborazione… {0}%', pt:'A processar… {0}%', ar:'جارٍ المعالجة… {0}%', hi:'प्रोसेस हो रहा है… {0}%', ja:'処理中… {0}%', ky:'Иштетилүүдө… {0}%', 'zh-Hant':'處理中… {0}%' },
  vid_done: { bg:'Готово! {0} → {1} ({2}). Файлът е записан/споделен.', ru:'Готово! {0} → {1} ({2}). Файл сохранён/отправлен.', uk:'Готово! {0} → {1} ({2}). Файл збережено/надіслано.', en:'Done! {0} → {1} ({2}). The file was saved/shared.', de:'Fertig! {0} → {1} ({2}). Datei gespeichert/geteilt.', fr:'Terminé ! {0} → {1} ({2}). Fichier enregistré/partagé.', es:'¡Listo! {0} → {1} ({2}). Archivo guardado/compartido.', 'es-MX':'¡Listo! {0} → {1} ({2}). Archivo guardado/compartido.', it:'Fatto! {0} → {1} ({2}). File salvato/condiviso.', pt:'Feito! {0} → {1} ({2}). Ficheiro guardado/partilhado.', ar:'تم! {0} → {1} ({2}). حُفظ الملف/شورك.', hi:'हो गया! {0} → {1} ({2})। फ़ाइल सहेजी/साझा की गई।', ja:'完了！{0} → {1}（{2}）。ファイルを保存／共有しました。', ky:'Даяр! {0} → {1} ({2}). Файл сакталды/бөлүшүлдү.', 'zh-Hant':'完成！{0} → {1}（{2}）。檔案已儲存／分享。' },
  vid_error: { bg:'Грешка: {0}', ru:'Ошибка: {0}', uk:'Помилка: {0}', en:'Error: {0}', de:'Fehler: {0}', fr:'Erreur : {0}', es:'Error: {0}', 'es-MX':'Error: {0}', it:'Errore: {0}', pt:'Erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'Ката: {0}', 'zh-Hant':'錯誤：{0}' },
  vid_picked: { bg:'Избран: {0} ({1})', ru:'Выбран: {0} ({1})', uk:'Вибрано: {0} ({1})', en:'Selected: {0} ({1})', de:'Ausgewählt: {0} ({1})', fr:'Sélectionné : {0} ({1})', es:'Seleccionado: {0} ({1})', 'es-MX':'Seleccionado: {0} ({1})', it:'Selezionato: {0} ({1})', pt:'Selecionado: {0} ({1})', ar:'المحدد: {0} ({1})', hi:'चयनित: {0} ({1})', ja:'選択: {0}（{1}）', ky:'Тандалды: {0} ({1})', 'zh-Hant':'已選：{0}（{1}）' }
});

export const title = t('vid_title');

const X264 = ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p'];
const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
// Целеви формати (конвертор) → ffmpeg аргументи. Еднонишково → пресетите са бързи/леки.
const TARGETS = {
  mp4:  { args: (i, o) => ['-i', i, ...X264, '-crf', '26', '-vf', EVEN, '-c:a', 'aac', '-b:a', '128k', o], mime: 'video/mp4' },
  webm: { args: (i, o) => ['-i', i, '-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis', o], mime: 'video/webm' },
  avi:  { args: (i, o) => ['-i', i, '-c:v', 'mpeg4', '-qscale:v', '5', '-c:a', 'libmp3lame', o], mime: 'video/x-msvideo' },
  mov:  { args: (i, o) => ['-i', i, ...X264, '-crf', '26', '-vf', EVEN, '-c:a', 'aac', '-b:a', '128k', o], mime: 'video/quicktime' },
  mkv:  { args: (i, o) => ['-i', i, ...X264, '-crf', '26', '-vf', EVEN, '-c:a', 'aac', '-b:a', '128k', o], mime: 'video/x-matroska' },
  gif:  { args: (i, o) => ['-i', i, '-t', '15', '-vf', 'fps=10,scale=480:-2', o], mime: 'image/gif' }
};
const num = (v, d) => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : d; };
// ОПЕРАЦИИ (обогатяване): всяка връща { args, ext, mime } според параметрите от формата.
const OPS = {
  convert: (i, p) => { const c = TARGETS[p.target] || TARGETS.mp4; return { args: c.args(i, 'out.' + p.target), ext: p.target, mime: c.mime }; },
  trim:    (i, p) => ({ args: ['-ss', String(num(p.from, 0)), '-i', i, '-t', String(num(p.dur, 10) || 10), '-c', 'copy', 'out.mp4'], ext: 'mp4', mime: 'video/mp4' }),
  audio:   (i) => ({ args: ['-i', i, '-vn', '-c:a', 'libmp3lame', '-b:a', '160k', 'out.mp3'], ext: 'mp3', mime: 'audio/mpeg' }),
  rotate:  (i, p) => ({ args: ['-i', i, '-vf', ({ r90: 'transpose=1', r180: 'transpose=1,transpose=1', r270: 'transpose=2', hflip: 'hflip', vflip: 'vflip' })[p.rot] || 'transpose=1', ...X264, '-crf', '24', '-c:a', 'copy', 'out.mp4'], ext: 'mp4', mime: 'video/mp4' }),
  speed:   (i, p) => { const f = num(p.speed, 2) || 2; const a = f >= 0.5 && f <= 2 ? 'atempo=' + f : (f > 2 ? 'atempo=2,atempo=' + (f / 2) : 'atempo=0.5,atempo=' + (f / 0.5)); return { args: ['-i', i, '-filter_complex', '[0:v]setpts=' + (1 / f).toFixed(4) + '*PTS[v];[0:a]' + a + '[a]', '-map', '[v]', '-map', '[a]', ...X264, '-crf', '24', '-c:a', 'aac', 'out.mp4'], ext: 'mp4', mime: 'video/mp4' }; },
  mute:    (i) => ({ args: ['-i', i, '-an', '-c:v', 'copy', 'out.mp4'], ext: 'mp4', mime: 'video/mp4' }),
  resize:  (i, p) => ({ args: ['-i', i, '-vf', 'scale=-2:' + (p.h === '480' ? '480' : '720'), ...X264, '-crf', '24', '-c:a', 'aac', '-b:a', '128k', 'out.mp4'], ext: 'mp4', mime: 'video/mp4' }),
  compress:(i) => ({ args: ['-i', i, ...X264, '-crf', '30', '-vf', EVEN, '-c:a', 'aac', '-b:a', '96k', 'out.mp4'], ext: 'mp4', mime: 'video/mp4' }),
  // резерва (основният път е <video> + canvas). Изпитано 11.09: в този ffmpeg.wasm core ВСЕКИ JPEG изход
  // (mjpeg) увисва или гърми; PNG завършва за ~0.2 сек. → ffmpeg пише PNG, а JPEG се прави в canvas.
  frame:   (i, p) => ({ args: ['-ss', String(num(p.at, 1)), '-i', i, '-frames:v', '1', 'out.png'], ext: 'jpg', mime: 'image/jpeg' }),
  gif:     (i, p) => ({ args: ['-ss', String(num(p.from, 0)), '-i', i, '-t', String(num(p.dur, 6) || 6), '-vf', 'fps=' + (num(p.fps, 10) || 10) + ',scale=' + (num(p.width, 360) || 360) + ':-2', 'out.gif'], ext: 'gif', mime: 'image/gif' })
};
// Кои полета показва всяка операция.
const FIELDS = { convert: ['target'], trim: ['from', 'dur'], rotate: ['rot'], speed: ['speed'], resize: ['h'], frame: ['at'], gif: ['from', 'dur', 'fps', 'width'] };

let picked = null;   // { name, bytes }

export function render(root) {
  picked = null;
  const opt = (k, label) => `<option value="${k}">${esc(label)}</option>`;
  root.innerHTML = `
    <div class="tool-card">
      <p class="hint">${t('vid_notice')}</p>
      <button class="btn" id="vidPick">${t('vid_pick')}</button>
      <div class="hint" id="vidFile"></div>
      <label>${t('vid_op')}</label>
      <select id="vidOp">
        ${opt('convert', t('vid_op_convert'))}${opt('trim', t('vid_op_trim'))}${opt('audio', t('vid_op_audio'))}${opt('rotate', t('vid_op_rotate'))}${opt('speed', t('vid_op_speed'))}${opt('mute', t('vid_op_mute'))}${opt('resize', t('vid_op_resize'))}${opt('compress', t('vid_op_compress'))}${opt('frame', t('vid_op_frame'))}${opt('gif', t('vid_op_gif'))}
      </select>
      <div data-f="target"><label>${t('vid_target')}</label>
        <select id="vidTarget"><option value="mp4">MP4 (H.264 + AAC)</option><option value="webm">WebM (VP8 + Vorbis)</option><option value="avi">AVI (MPEG-4 + MP3)</option><option value="mov">MOV (H.264 + AAC)</option><option value="mkv">MKV (H.264 + AAC)</option><option value="gif">GIF</option></select></div>
      <div data-f="from"><label>${t('vid_from')}</label><input id="vidFrom" type="number" min="0" step="0.5" value="0"></div>
      <div data-f="dur"><label>${t('vid_dur')}</label><input id="vidDur" type="number" min="0.5" step="0.5" value="10"></div>
      <div data-f="at"><label>${t('vid_at')}</label><input id="vidAt" type="number" min="0" step="0.5" value="1"></div>
      <div data-f="rot"><label>${t('vid_op_rotate')}</label><select id="vidRot"><option value="r90">↻ 90°</option><option value="r180">↻ 180°</option><option value="r270">↺ 90°</option><option value="hflip">↔</option><option value="vflip">↕</option></select></div>
      <div data-f="speed"><label>${t('vid_op_speed')}</label><select id="vidSpeed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1.5">1.5×</option><option value="2" selected>2×</option><option value="3">3×</option></select></div>
      <div data-f="h"><label>${t('vid_op_resize')}</label><select id="vidH"><option value="720">720p</option><option value="480">480p</option></select></div>
      <div data-f="fps"><label>${t('vid_fps')}</label><input id="vidFps" type="number" min="2" max="30" value="10"></div>
      <div data-f="width"><label>${t('vid_width')}</label><input id="vidWidth" type="number" min="120" max="1080" step="10" value="360"></div>
      <button class="btn" id="vidGo">${t('vid_go')}</button>
      <div class="bar" id="barWrap" style="display:none"><div id="bar"></div></div>
      <div class="status" id="status"></div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const status = $('#status');
  const opSel = $('#vidOp');
  const showFields = () => { const f = FIELDS[opSel.value] || []; root.querySelectorAll('[data-f]').forEach((el) => { el.style.display = f.indexOf(el.getAttribute('data-f')) >= 0 ? '' : 'none'; }); };
  opSel.addEventListener('change', showFields); showFields();

  $('#vidPick').addEventListener('click', async () => {
    const f = await pickBinaryFile('video/*');
    if (!f || (!f.base64 && !f.dataUrl)) return;
    picked = { name: f.name || 'video', bytes: base64ToBytes(f.base64 || f.dataUrl) };
    $('#vidFile').textContent = tf('vid_picked', picked.name, fmtSize(picked.bytes.length));
  });

  $('#vidGo').addEventListener('click', async () => {
    if (!picked) { setStatus(status, 'err', t('vid_need_file')); return; }
    const p = { target: $('#vidTarget').value, from: $('#vidFrom').value, dur: $('#vidDur').value, at: $('#vidAt').value, rot: $('#vidRot').value, speed: $('#vidSpeed').value, h: $('#vidH').value, fps: $('#vidFps').value, width: $('#vidWidth').value };
    const btn = $('#vidGo'); btn.disabled = true;
    const barWrap = $('#barWrap'); const bar = $('#bar');
    barWrap.style.display = ''; bar.style.width = '0%';
    setStatus(status, 'work', t('vid_loading_engine'));
    try {
      // „Кадър → снимка": първо вграденият декодер (<video> + canvas) — бързо и без увисване (v1.0021).
      if (opSel.value === 'frame') {
        let jpg = null;
        try { jpg = await grabFrameJPEG(new Blob([picked.bytes], { type: videoMime(picked.name) }), num(p.at, 1)); } catch (e) { jpg = null; }
        if (jpg && jpg.size) {
          const nm = (picked.name.replace(/\.[^.]+$/, '') || 'video') + '-frame.jpg';
          bar.style.width = '100%';
          await saveFile(nm, jpg, 'image/jpeg');
          setStatus(status, 'ok', tf('vid_done', fmtSize(picked.bytes.length), fmtSize(jpg.size), nm));
          return;
        }
      }
      const ff = await getFFmpeg((pr) => { const pct = Math.round(pr * 100); bar.style.width = pct + '%'; setStatus(status, 'work', tf('vid_working', pct)); });
      const inSize = picked.bytes.length;   // ПРЕДИ writeFile — буферът се прехвърля и занулява
      const inName = 'in_' + picked.name.replace(/[^\w.\-]+/g, '_');
      const op = (OPS[opSel.value] || OPS.convert)(inName, p);
      const outName = op.args[op.args.length - 1];
      await ff.writeFile(inName, picked.bytes);
      await ff.exec(op.args);
      const out = await ff.readFile(outName);
      try { await ff.deleteFile(inName); await ff.deleteFile(outName); } catch (e) {}
      if (!out || !out.length) throw new Error('empty output');
      const base = (picked.name.replace(/\.[^.]+$/, '') || 'video') + (opSel.value === 'convert' ? '' : '-' + opSel.value);
      let outBlob = new Blob([out], { type: op.mime });
      if (opSel.value === 'frame') outBlob = await pngToJpeg(out);   // резервата пише PNG → JPEG в canvas
      await saveFile(base + '.' + op.ext, outBlob, op.mime);
      setStatus(status, 'ok', tf('vid_done', fmtSize(inSize), fmtSize(outBlob.size), base + '.' + op.ext));
      picked = null; $('#vidFile').textContent = '';   // буферът е изразходен — избери файла пак за нова операция
    } catch (e) {
      setStatus(status, 'err', tf('vid_error', (e && e.message) || e));
    } finally {
      btn.disabled = false;
    }
  });
}
