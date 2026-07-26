// Version: 1.0015
// Видео конвертор — mp4 ↔ webm / avi / mov / mkv / gif, изцяло НА УСТРОЙСТВОТО
// (ffmpeg.wasm, еднонишков core, вграден в приложението — не тегли нищо от интернет).
// Едно и също видео може да се конвертира във всяка посока: избираш файл + целеви формат.
import { esc, setStatus, fmtSize } from '../core/ui.js';
import { saveFile } from '../core/filesave.js';
import { pickBinaryFile } from '../core/filepick.js';
import { getFFmpeg, base64ToBytes } from '../core/ffm.js';
import { t, tf, register } from '../core/i18n.js';

register({
  vid_title: { bg:'Видео конвертор', ru:'Видео конвертер', uk:'Відео конвертер', en:'Video converter', de:'Video-Konverter', fr:'Convertisseur vidéo', es:'Conversor de vídeo', 'es-MX':'Conversor de video', it:'Convertitore video', pt:'Conversor de vídeo', ar:'محوّل الفيديو', hi:'वीडियो कन्वर्टर', ja:'動画コンバーター', ky:'Видео конвертер', 'zh-Hant':'影片轉換器' },
  vid_notice: { bg:'Конвертира видео между формати (MP4, WebM, AVI, MOV, MKV, GIF) изцяло на устройството — нищо не се качва в интернет. Големите видеа отнемат време (обработката е на процесора на телефона).', ru:'Конвертирует видео между форматами (MP4, WebM, AVI, MOV, MKV, GIF) полностью на устройстве — ничего не загружается в интернет. Большие видео занимают время (обработка на процессоре телефона).', uk:'Конвертує відео між форматами (MP4, WebM, AVI, MOV, MKV, GIF) повністю на пристрої — нічого не завантажується в інтернет. Великі відео займають час (обробка на процесорі телефона).', en:'Converts video between formats (MP4, WebM, AVI, MOV, MKV, GIF) fully on your device — nothing is uploaded. Large videos take time (processing runs on the phone CPU).', de:'Konvertiert Videos zwischen Formaten (MP4, WebM, AVI, MOV, MKV, GIF) komplett auf dem Gerät — nichts wird hochgeladen. Große Videos brauchen Zeit (Verarbeitung auf der Telefon-CPU).', fr:'Convertit la vidéo entre formats (MP4, WebM, AVI, MOV, MKV, GIF) entièrement sur l’appareil — rien n’est envoyé. Les grandes vidéos prennent du temps (traitement sur le processeur).', es:'Convierte vídeo entre formatos (MP4, WebM, AVI, MOV, MKV, GIF) totalmente en el dispositivo — nada se sube. Los vídeos grandes tardan (el procesado corre en la CPU del teléfono).', 'es-MX':'Convierte video entre formatos (MP4, WebM, AVI, MOV, MKV, GIF) totalmente en el dispositivo — nada se sube. Los videos grandes tardan (el procesado corre en la CPU del teléfono).', it:'Converte video tra formati (MP4, WebM, AVI, MOV, MKV, GIF) interamente sul dispositivo — nulla viene caricato. I video grandi richiedono tempo (elaborazione sulla CPU del telefono).', pt:'Converte vídeo entre formatos (MP4, WebM, AVI, MOV, MKV, GIF) totalmente no aparelho — nada é enviado. Vídeos grandes levam tempo (o processamento roda na CPU do telefone).', ar:'يحوّل الفيديو بين الصيغ (MP4، WebM، AVI، MOV، MKV، GIF) بالكامل على جهازك — لا يُرفع شيء. الفيديوهات الكبيرة تستغرق وقتًا (المعالجة على معالج الهاتف).', hi:'वीडियो को फ़ॉर्मेट्स (MP4, WebM, AVI, MOV, MKV, GIF) के बीच पूरी तरह डिवाइस पर बदलता है — कुछ अपलोड नहीं होता। बड़े वीडियो में समय लगता है (प्रोसेसिंग फ़ोन CPU पर)।', ja:'動画をフォーマット間（MP4・WebM・AVI・MOV・MKV・GIF）で変換します。すべて端末内で処理され、何もアップロードされません。大きな動画は時間がかかります。', ky:'Видеону форматтар арасында (MP4, WebM, AVI, MOV, MKV, GIF) толугу менен түзмөктө которот — эч нерсе жүктөлбөйт. Чоң видеолор убакыт алат.', 'zh-Hant':'在裝置上直接於格式之間轉換影片（MP4、WebM、AVI、MOV、MKV、GIF）— 不上傳任何內容。大影片需要時間（在手機 CPU 上處理）。' },
  vid_pick: { bg:'🎬 Избери видео файл', ru:'🎬 Выбрать видеофайл', uk:'🎬 Вибрати відеофайл', en:'🎬 Choose a video file', de:'🎬 Videodatei wählen', fr:'🎬 Choisir un fichier vidéo', es:'🎬 Elegir archivo de vídeo', 'es-MX':'🎬 Elegir archivo de video', it:'🎬 Scegli un file video', pt:'🎬 Escolher arquivo de vídeo', ar:'🎬 اختر ملف فيديو', hi:'🎬 वीडियो फ़ाइल चुनें', ja:'🎬 動画ファイルを選択', ky:'🎬 Видео файл тандоо', 'zh-Hant':'🎬 選擇影片檔' },
  vid_target: { bg:'Целеви формат', ru:'Целевой формат', uk:'Цільовий формат', en:'Target format', de:'Zielformat', fr:'Format cible', es:'Formato de destino', 'es-MX':'Formato de destino', it:'Formato di destinazione', pt:'Formato de destino', ar:'الصيغة الهدف', hi:'लक्ष्य फ़ॉर्मेट', ja:'変換先フォーマット', ky:'Максат формат', 'zh-Hant':'目標格式' },
  vid_go: { bg:'Конвертирай', ru:'Конвертировать', uk:'Конвертувати', en:'Convert', de:'Konvertieren', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'変換', ky:'Которуу', 'zh-Hant':'轉換' },
  vid_need_file: { bg:'Първо избери видео файл.', ru:'Сначала выберите видеофайл.', uk:'Спочатку виберіть відеофайл.', en:'Choose a video file first.', de:'Wähle zuerst eine Videodatei.', fr:'Choisis d’abord un fichier vidéo.', es:'Primero elige un archivo de vídeo.', 'es-MX':'Primero elige un archivo de video.', it:'Prima scegli un file video.', pt:'Primeiro escolha um arquivo de vídeo.', ar:'اختر ملف فيديو أولًا.', hi:'पहले वीडियो फ़ाइल चुनें।', ja:'まず動画ファイルを選択してください。', ky:'Адегенде видео файл танда.', 'zh-Hant':'請先選擇影片檔。' },
  vid_loading_engine: { bg:'Зареждам видео двигателя (първия път отнема няколко секунди)…', ru:'Загружаю видеодвижок (в первый раз занимает несколько секунд)…', uk:'Завантажую відеодвигун (першого разу займає кілька секунд)…', en:'Loading the video engine (takes a few seconds the first time)…', de:'Lade die Video-Engine (beim ersten Mal dauert es ein paar Sekunden)…', fr:'Chargement du moteur vidéo (quelques secondes la première fois)…', es:'Cargando el motor de vídeo (la primera vez tarda unos segundos)…', 'es-MX':'Cargando el motor de video (la primera vez tarda unos segundos)…', it:'Carico il motore video (la prima volta richiede qualche secondo)…', pt:'Carregando o motor de vídeo (a primeira vez leva alguns segundos)…', ar:'جارٍ تحميل محرك الفيديو (يستغرق ثوانٍ في المرة الأولى)…', hi:'वीडियो इंजन लोड हो रहा है (पहली बार कुछ सेकंड लगते हैं)…', ja:'動画エンジンを読み込み中（初回は数秒かかります）…', ky:'Видео кыймылдаткыч жүктөлүүдө (биринчи жолу бир нече секунд)…', 'zh-Hant':'正在載入影片引擎（首次需要幾秒）…' },
  vid_working: { bg:'Конвертирам… {0}%', ru:'Конвертирую… {0}%', uk:'Конвертую… {0}%', en:'Converting… {0}%', de:'Konvertiere… {0}%', fr:'Conversion… {0}%', es:'Convirtiendo… {0}%', 'es-MX':'Convirtiendo… {0}%', it:'Conversione… {0}%', pt:'Convertendo… {0}%', ar:'جارٍ التحويل… {0}%', hi:'बदल रहा… {0}%', ja:'変換中… {0}%', ky:'Которулууда… {0}%', 'zh-Hant':'轉換中… {0}%' },
  vid_done: { bg:'Готово! {0} → {1} ({2}). Файлът е записан/споделен.', ru:'Готово! {0} → {1} ({2}). Файл сохранён/отправлен.', uk:'Готово! {0} → {1} ({2}). Файл збережено/надіслано.', en:'Done! {0} → {1} ({2}). The file was saved/shared.', de:'Fertig! {0} → {1} ({2}). Die Datei wurde gespeichert/geteilt.', fr:'Terminé ! {0} → {1} ({2}). Le fichier a été enregistré/partagé.', es:'¡Listo! {0} → {1} ({2}). El archivo se guardó/compartió.', 'es-MX':'¡Listo! {0} → {1} ({2}). El archivo se guardó/compartió.', it:'Fatto! {0} → {1} ({2}). Il file è stato salvato/condiviso.', pt:'Pronto! {0} → {1} ({2}). O arquivo foi salvo/compartilhado.', ar:'تم! {0} ← {1} ({2}). حُفظ/شورك الملف.', hi:'हो गया! {0} → {1} ({2})। फ़ाइल सहेजी/साझा की गई।', ja:'完了！{0} → {1}（{2}）。ファイルを保存／共有しました。', ky:'Даяр! {0} → {1} ({2}). Файл сакталды/бөлүшүлдү.', 'zh-Hant':'完成！{0} → {1}（{2}）。檔案已儲存／分享。' },
  vid_error: { bg:'Грешка при конвертиране: {0}', ru:'Ошибка конвертации: {0}', uk:'Помилка конвертації: {0}', en:'Conversion error: {0}', de:'Konvertierungsfehler: {0}', fr:'Erreur de conversion : {0}', es:'Error de conversión: {0}', 'es-MX':'Error de conversión: {0}', it:'Errore di conversione: {0}', pt:'Erro de conversão: {0}', ar:'خطأ في التحويل: {0}', hi:'रूपांतरण त्रुटि: {0}', ja:'変換エラー: {0}', ky:'Которуу катасы: {0}', 'zh-Hant':'轉換錯誤：{0}' },
  vid_gif_note: { bg:'GIF: взимат се първите ~15 секунди, 10 кадъра/сек, ширина 480 (иначе файлът става огромен).', ru:'GIF: берутся первые ~15 секунд, 10 кадров/с, ширина 480 (иначе файл огромный).', uk:'GIF: беруться перші ~15 секунд, 10 кадрів/с, ширина 480 (інакше файл величезний).', en:'GIF: the first ~15 seconds are taken, 10 fps, width 480 (otherwise the file gets huge).', de:'GIF: die ersten ~15 Sekunden, 10 fps, Breite 480 (sonst wird die Datei riesig).', fr:'GIF : les ~15 premières secondes, 10 i/s, largeur 480 (sinon le fichier devient énorme).', es:'GIF: se toman los primeros ~15 segundos, 10 fps, ancho 480 (si no, el archivo es enorme).', 'es-MX':'GIF: se toman los primeros ~15 segundos, 10 fps, ancho 480 (si no, el archivo es enorme).', it:'GIF: si prendono i primi ~15 secondi, 10 fps, larghezza 480 (altrimenti il file diventa enorme).', pt:'GIF: pegam-se os primeiros ~15 segundos, 10 fps, largura 480 (senão o arquivo fica enorme).', ar:'GIF: تؤخذ أول ~15 ثانية، 10 إطارات/ث، عرض 480 (وإلا يصبح الملف ضخمًا).', hi:'GIF: पहले ~15 सेकंड, 10 fps, चौड़ाई 480 (नहीं तो फ़ाइल बहुत बड़ी हो जाती है)।', ja:'GIF: 最初の約15秒、10fps、幅480（そうしないとファイルが巨大になります）。', ky:'GIF: алгачкы ~15 секунд, 10 кадр/сек, туурасы 480 (болбосо файл өтө чоң болот).', 'zh-Hant':'GIF：取前約 15 秒、10 fps、寬 480（否則檔案會過大）。' },
  vid_picked: { bg:'Избран: {0} ({1})', ru:'Выбран: {0} ({1})', uk:'Вибрано: {0} ({1})', en:'Selected: {0} ({1})', de:'Ausgewählt: {0} ({1})', fr:'Sélectionné : {0} ({1})', es:'Seleccionado: {0} ({1})', 'es-MX':'Seleccionado: {0} ({1})', it:'Selezionato: {0} ({1})', pt:'Selecionado: {0} ({1})', ar:'المحدد: {0} ({1})', hi:'चुना गया: {0} ({1})', ja:'選択済み: {0}（{1}）', ky:'Тандалды: {0} ({1})', 'zh-Hant':'已選：{0}（{1}）' }
});

export const title = t('vid_title');

// Целеви формати → ffmpeg аргументи. Еднонишково → пресетите са бързи/леки.
const TARGETS = {
  mp4:  { args: (i, o) => ['-i', i, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', o], mime: 'video/mp4' },
  webm: { args: (i, o) => ['-i', i, '-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis', o], mime: 'video/webm' },
  avi:  { args: (i, o) => ['-i', i, '-c:v', 'mpeg4', '-qscale:v', '5', '-c:a', 'libmp3lame', o], mime: 'video/x-msvideo' },
  mov:  { args: (i, o) => ['-i', i, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', o], mime: 'video/quicktime' },
  mkv:  { args: (i, o) => ['-i', i, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', o], mime: 'video/x-matroska' },
  gif:  { args: (i, o) => ['-i', i, '-t', '15', '-vf', 'fps=10,scale=480:-2', o], mime: 'image/gif' }
};

let picked = null;   // { name, bytes }

export function render(root) {
  picked = null;
  root.innerHTML = `
    <div class="tool-card">
      <p class="hint">${t('vid_notice')}</p>
      <button class="btn" id="vidPick">${t('vid_pick')}</button>
      <div class="hint" id="vidFile"></div>
      <label>${t('vid_target')}</label>
      <select id="vidTarget">
        <option value="mp4">MP4 (H.264 + AAC)</option>
        <option value="webm">WebM (VP8 + Vorbis)</option>
        <option value="avi">AVI (MPEG-4 + MP3)</option>
        <option value="mov">MOV (H.264 + AAC)</option>
        <option value="mkv">MKV (H.264 + AAC)</option>
        <option value="gif">GIF</option>
      </select>
      <p class="hint" id="vidGifNote" style="display:none">${t('vid_gif_note')}</p>
      <button class="btn" id="vidGo">${t('vid_go')}</button>
      <div class="bar" id="barWrap" style="display:none"><div id="bar"></div></div>
      <div class="status" id="status"></div>
    </div>`;

  const status = root.querySelector('#status');
  const targetSel = root.querySelector('#vidTarget');
  targetSel.addEventListener('change', () => {
    root.querySelector('#vidGifNote').style.display = targetSel.value === 'gif' ? '' : 'none';
  });

  root.querySelector('#vidPick').addEventListener('click', async () => {
    const f = await pickBinaryFile('video/*');
    if (!f || (!f.base64 && !f.dataUrl)) return;
    picked = { name: f.name || 'video', bytes: base64ToBytes(f.base64 || f.dataUrl) };
    root.querySelector('#vidFile').textContent = tf('vid_picked', picked.name, fmtSize(picked.bytes.length));
  });

  root.querySelector('#vidGo').addEventListener('click', async () => {
    if (!picked) { setStatus(status, 'err', t('vid_need_file')); return; }
    const target = targetSel.value;
    const cfg = TARGETS[target];
    const btn = root.querySelector('#vidGo'); btn.disabled = true;
    const barWrap = root.querySelector('#barWrap'); const bar = root.querySelector('#bar');
    barWrap.style.display = '';
    setStatus(status, 'work', t('vid_loading_engine'));
    try {
      const ff = await getFFmpeg((p) => {
        const pct = Math.round(p * 100);
        bar.style.width = pct + '%';
        setStatus(status, 'work', tf('vid_working', pct));
      });
      const inSize = picked.bytes.length;   // ПРЕДИ writeFile — буферът се прехвърля и занулява
      const inName = 'in_' + picked.name.replace(/[^\w.\-]+/g, '_');
      const outName = 'out.' + target;
      await ff.writeFile(inName, picked.bytes);
      await ff.exec(cfg.args(inName, outName));
      const out = await ff.readFile(outName);
      try { await ff.deleteFile(inName); await ff.deleteFile(outName); } catch (e) {}
      if (!out || !out.length) throw new Error('empty output');

      const base = picked.name.replace(/\.[^.]+$/, '') || 'video';
      await saveFile(base + '.' + target, new Blob([out], { type: cfg.mime }), cfg.mime);
      setStatus(status, 'ok', tf('vid_done', fmtSize(inSize), fmtSize(out.length), base + '.' + target));
      picked = null; root.querySelector('#vidFile').textContent = '';   // буферът е изразходен — избери файла пак за нова конверсия
    } catch (e) {
      setStatus(status, 'err', tf('vid_error', (e && e.message) || e));
    } finally {
      btn.disabled = false;
    }
  });
}
