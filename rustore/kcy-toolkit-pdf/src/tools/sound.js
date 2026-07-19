// Version: 1.0015
// Звуков конвертор — конвертира звукови файлове от телефонни формати (MP3, M4A/AAC,
// WAV, OGG/Opus, FLAC, WebM звук, 3GP) към MP4 (звуков), MP3, WAV или OGG — изцяло
// НА УСТРОЙСТВОТО (ffmpeg.wasm, вграден в приложението, без интернет).
import { setStatus, fmtSize } from '../core/ui.js';
import { saveFile } from '../core/filesave.js';
import { pickBinaryFile } from '../core/filepick.js';
import { getFFmpeg, base64ToBytes } from '../core/ffm.js';
import { t, tf, register } from '../core/i18n.js';

register({
  snd_title: { bg:'Звуков конвертор', ru:'Аудио конвертер', uk:'Аудіо конвертер', en:'Sound converter', de:'Audio-Konverter', fr:'Convertisseur audio', es:'Conversor de sonido', 'es-MX':'Conversor de sonido', it:'Convertitore audio', pt:'Conversor de áudio', ar:'محوّل الصوت', hi:'साउंड कन्वर्टर', ja:'音声コンバーター', ky:'Аудио конвертер', 'zh-Hant':'音訊轉換器' },
  snd_notice: { bg:'Конвертира звукови файлове от телефонните формати (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, звук от WebM/3GP видео) към MP4, MP3, WAV или OGG — изцяло на устройството, нищо не се качва в интернет.', ru:'Конвертирует аудиофайлы из телефонных форматов (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, звук из WebM/3GP видео) в MP4, MP3, WAV или OGG — полностью на устройстве, ничего не загружается в интернет.', uk:'Конвертує аудіофайли з телефонних форматів (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, звук із WebM/3GP відео) у MP4, MP3, WAV або OGG — повністю на пристрої, нічого не завантажується в інтернет.', en:'Converts audio files from phone formats (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio from WebM/3GP video) to MP4, MP3, WAV or OGG — fully on your device, nothing is uploaded.', de:'Konvertiert Audiodateien aus Telefonformaten (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, Ton aus WebM/3GP-Video) zu MP4, MP3, WAV oder OGG — komplett auf dem Gerät, nichts wird hochgeladen.', fr:'Convertit les fichiers audio des formats téléphone (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio de vidéo WebM/3GP) vers MP4, MP3, WAV ou OGG — entièrement sur l’appareil, rien n’est envoyé.', es:'Convierte archivos de audio de formatos de teléfono (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio de vídeo WebM/3GP) a MP4, MP3, WAV u OGG — totalmente en el dispositivo, nada se sube.', 'es-MX':'Convierte archivos de audio de formatos de teléfono (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio de video WebM/3GP) a MP4, MP3, WAV u OGG — totalmente en el dispositivo, nada se sube.', it:'Converte file audio dai formati del telefono (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, audio da video WebM/3GP) in MP4, MP3, WAV o OGG — interamente sul dispositivo, nulla viene caricato.', pt:'Converte arquivos de áudio dos formatos do telefone (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, áudio de vídeo WebM/3GP) para MP4, MP3, WAV ou OGG — totalmente no aparelho, nada é enviado.', ar:'يحوّل ملفات الصوت من صيغ الهاتف (MP3، M4A/AAC، WAV، OGG/Opus، FLAC، صوت فيديو WebM/3GP) إلى MP4 أو MP3 أو WAV أو OGG — بالكامل على جهازك، لا يُرفع شيء.', hi:'फ़ोन फ़ॉर्मेट्स (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, WebM/3GP वीडियो का ऑडियो) से MP4, MP3, WAV या OGG में बदलता है — पूरी तरह डिवाइस पर, कुछ अपलोड नहीं होता।', ja:'電話のフォーマット（MP3・M4A/AAC・WAV・OGG/Opus・FLAC・WebM/3GP動画の音声）を MP4・MP3・WAV・OGG に変換。すべて端末内で処理、アップロードなし。', ky:'Телефон форматтарынан (MP3, M4A/AAC, WAV, OGG/Opus, FLAC, WebM/3GP видеонун үнү) MP4, MP3, WAV же OGG форматына которот — толугу менен түзмөктө.', 'zh-Hant':'將手機格式的音訊檔（MP3、M4A/AAC、WAV、OGG/Opus、FLAC、WebM/3GP 影片的音訊）轉換為 MP4、MP3、WAV 或 OGG — 全程在裝置上，不上傳任何內容。' },
  snd_pick: { bg:'🎵 Избери звуков файл', ru:'🎵 Выбрать аудиофайл', uk:'🎵 Вибрати аудіофайл', en:'🎵 Choose an audio file', de:'🎵 Audiodatei wählen', fr:'🎵 Choisir un fichier audio', es:'🎵 Elegir archivo de audio', 'es-MX':'🎵 Elegir archivo de audio', it:'🎵 Scegli un file audio', pt:'🎵 Escolher arquivo de áudio', ar:'🎵 اختر ملف صوت', hi:'🎵 ऑडियो फ़ाइल चुनें', ja:'🎵 音声ファイルを選択', ky:'🎵 Аудио файл тандоо', 'zh-Hant':'🎵 選擇音訊檔' },
  snd_target: { bg:'Целеви формат', ru:'Целевой формат', uk:'Цільовий формат', en:'Target format', de:'Zielformat', fr:'Format cible', es:'Formato de destino', 'es-MX':'Formato de destino', it:'Formato di destinazione', pt:'Formato de destino', ar:'الصيغة الهدف', hi:'लक्ष्य फ़ॉर्मेट', ja:'変換先フォーマット', ky:'Максат формат', 'zh-Hant':'目標格式' },
  snd_go: { bg:'Конвертирай', ru:'Конвертировать', uk:'Конвертувати', en:'Convert', de:'Konvertieren', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'変換', ky:'Которуу', 'zh-Hant':'轉換' },
  snd_need_file: { bg:'Първо избери звуков файл.', ru:'Сначала выберите аудиофайл.', uk:'Спочатку виберіть аудіофайл.', en:'Choose an audio file first.', de:'Wähle zuerst eine Audiodatei.', fr:'Choisis d’abord un fichier audio.', es:'Primero elige un archivo de audio.', 'es-MX':'Primero elige un archivo de audio.', it:'Prima scegli un file audio.', pt:'Primeiro escolha um arquivo de áudio.', ar:'اختر ملف صوت أولًا.', hi:'पहले ऑडियो फ़ाइल चुनें।', ja:'まず音声ファイルを選択してください。', ky:'Адегенде аудио файл танда.', 'zh-Hant':'請先選擇音訊檔。' },
  snd_working: { bg:'Конвертирам… {0}%', ru:'Конвертирую… {0}%', uk:'Конвертую… {0}%', en:'Converting… {0}%', de:'Konvertiere… {0}%', fr:'Conversion… {0}%', es:'Convirtiendo… {0}%', 'es-MX':'Convirtiendo… {0}%', it:'Conversione… {0}%', pt:'Convertendo… {0}%', ar:'جارٍ التحويل… {0}%', hi:'बदल रहा… {0}%', ja:'変換中… {0}%', ky:'Которулууда… {0}%', 'zh-Hant':'轉換中… {0}%' },
  snd_done: { bg:'Готово! {0} → {1} ({2}). Файлът е записан/споделен.', ru:'Готово! {0} → {1} ({2}). Файл сохранён/отправлен.', uk:'Готово! {0} → {1} ({2}). Файл збережено/надіслано.', en:'Done! {0} → {1} ({2}). The file was saved/shared.', de:'Fertig! {0} → {1} ({2}). Die Datei wurde gespeichert/geteilt.', fr:'Terminé ! {0} → {1} ({2}). Le fichier a été enregistré/partagé.', es:'¡Listo! {0} → {1} ({2}). El archivo se guardó/compartió.', 'es-MX':'¡Listo! {0} → {1} ({2}). El archivo se guardó/compartió.', it:'Fatto! {0} → {1} ({2}). Il file è stato salvato/condiviso.', pt:'Pronto! {0} → {1} ({2}). O arquivo foi salvo/compartilhado.', ar:'تم! {0} ← {1} ({2}). حُفظ/شورك الملف.', hi:'हो गया! {0} → {1} ({2})। फ़ाइल सहेजी/साझा की गई।', ja:'完了！{0} → {1}（{2}）。ファイルを保存／共有しました。', ky:'Даяр! {0} → {1} ({2}). Файл сакталды/бөлүшүлдү.', 'zh-Hant':'完成！{0} → {1}（{2}）。檔案已儲存／分享。' },
  snd_error: { bg:'Грешка при конвертиране: {0}. Ако файлът е AMR/3GP запис, този формат може да не се поддържа.', ru:'Ошибка конвертации: {0}. Если файл — запись AMR/3GP, этот формат может не поддерживаться.', uk:'Помилка конвертації: {0}. Якщо файл — запис AMR/3GP, цей формат може не підтримуватися.', en:'Conversion error: {0}. If the file is an AMR/3GP recording, that format may be unsupported.', de:'Konvertierungsfehler: {0}. Bei AMR/3GP-Aufnahmen wird das Format evtl. nicht unterstützt.', fr:'Erreur de conversion : {0}. Si le fichier est un enregistrement AMR/3GP, ce format peut ne pas être pris en charge.', es:'Error de conversión: {0}. Si el archivo es una grabación AMR/3GP, ese formato puede no estar soportado.', 'es-MX':'Error de conversión: {0}. Si el archivo es una grabación AMR/3GP, ese formato puede no estar soportado.', it:'Errore di conversione: {0}. Se il file è una registrazione AMR/3GP, quel formato può non essere supportato.', pt:'Erro de conversão: {0}. Se o arquivo é uma gravação AMR/3GP, esse formato pode não ser suportado.', ar:'خطأ في التحويل: {0}. إذا كان الملف تسجيل AMR/3GP فقد لا تكون الصيغة مدعومة.', hi:'रूपांतरण त्रुटि: {0}। यदि फ़ाइल AMR/3GP रिकॉर्डिंग है तो वह फ़ॉर्मेट समर्थित नहीं हो सकता।', ja:'変換エラー: {0}。AMR/3GP 録音の場合、そのフォーマットは未対応の可能性があります。', ky:'Которуу катасы: {0}. Файл AMR/3GP жазуу болсо, ал формат колдоого алынбашы мүмкүн.', 'zh-Hant':'轉換錯誤：{0}。若檔案是 AMR/3GP 錄音，該格式可能不受支援。' },
  snd_picked: { bg:'Избран: {0} ({1})', ru:'Выбран: {0} ({1})', uk:'Вибрано: {0} ({1})', en:'Selected: {0} ({1})', de:'Ausgewählt: {0} ({1})', fr:'Sélectionné : {0} ({1})', es:'Seleccionado: {0} ({1})', 'es-MX':'Seleccionado: {0} ({1})', it:'Selezionato: {0} ({1})', pt:'Selecionado: {0} ({1})', ar:'المحدد: {0} ({1})', hi:'चुना गया: {0} ({1})', ja:'選択済み: {0}（{1}）', ky:'Тандалды: {0} ({1})', 'zh-Hant':'已選：{0}（{1}）' },
  snd_loading_engine: { bg:'Зареждам звуковия двигател (първия път отнема няколко секунди)…', ru:'Загружаю аудиодвижок (в первый раз занимает несколько секунд)…', uk:'Завантажую аудіодвигун (першого разу займає кілька секунд)…', en:'Loading the audio engine (takes a few seconds the first time)…', de:'Lade die Audio-Engine (beim ersten Mal dauert es ein paar Sekunden)…', fr:'Chargement du moteur audio (quelques secondes la première fois)…', es:'Cargando el motor de audio (la primera vez tarda unos segundos)…', 'es-MX':'Cargando el motor de audio (la primera vez tarda unos segundos)…', it:'Carico il motore audio (la prima volta richiede qualche secondo)…', pt:'Carregando o motor de áudio (a primeira vez leva alguns segundos)…', ar:'جارٍ تحميل محرك الصوت (يستغرق ثوانٍ في المرة الأولى)…', hi:'ऑडियो इंजन लोड हो रहा है (पहली बार कुछ सेकंड लगते हैं)…', ja:'音声エンジンを読み込み中（初回は数秒かかります）…', ky:'Аудио кыймылдаткыч жүктөлүүдө (биринчи жолу бир нече секунд)…', 'zh-Hant':'正在載入音訊引擎（首次需要幾秒）…' }
});

export const title = t('snd_title');

const TARGETS = {
  mp4: { args: (i, o) => ['-i', i, '-vn', '-c:a', 'aac', '-b:a', '192k', o], mime: 'audio/mp4' },
  mp3: { args: (i, o) => ['-i', i, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', o], mime: 'audio/mpeg' },
  wav: { args: (i, o) => ['-i', i, '-vn', '-c:a', 'pcm_s16le', o], mime: 'audio/wav' },
  ogg: { args: (i, o) => ['-i', i, '-vn', '-c:a', 'libvorbis', '-q:a', '5', o], mime: 'audio/ogg' }
};

let picked = null;

export function render(root) {
  picked = null;
  root.innerHTML = `
    <div class="tool-card">
      <p class="hint">${t('snd_notice')}</p>
      <button class="btn" id="sndPick">${t('snd_pick')}</button>
      <div class="hint" id="sndFile"></div>
      <label>${t('snd_target')}</label>
      <select id="sndTarget">
        <option value="mp4">MP4 (AAC звук)</option>
        <option value="mp3">MP3</option>
        <option value="wav">WAV</option>
        <option value="ogg">OGG (Vorbis)</option>
      </select>
      <button class="btn" id="sndGo">${t('snd_go')}</button>
      <div class="bar" id="barWrap" style="display:none"><div id="bar"></div></div>
      <div class="status" id="status"></div>
    </div>`;

  const status = root.querySelector('#status');

  root.querySelector('#sndPick').addEventListener('click', async () => {
    const f = await pickBinaryFile('audio/*');
    if (!f || (!f.base64 && !f.dataUrl)) return;
    picked = { name: f.name || 'audio', bytes: base64ToBytes(f.base64 || f.dataUrl) };
    root.querySelector('#sndFile').textContent = tf('snd_picked', picked.name, fmtSize(picked.bytes.length));
  });

  root.querySelector('#sndGo').addEventListener('click', async () => {
    if (!picked) { setStatus(status, 'err', t('snd_need_file')); return; }
    const target = root.querySelector('#sndTarget').value;
    const cfg = TARGETS[target];
    const btn = root.querySelector('#sndGo'); btn.disabled = true;
    const barWrap = root.querySelector('#barWrap'); const bar = root.querySelector('#bar');
    barWrap.style.display = '';
    setStatus(status, 'work', t('snd_loading_engine'));
    try {
      const ff = await getFFmpeg((p) => {
        const pct = Math.round(p * 100);
        bar.style.width = pct + '%';
        setStatus(status, 'work', tf('snd_working', pct));
      });
      const inSize = picked.bytes.length;   // ПРЕДИ writeFile — буферът се прехвърля и занулява
      const inName = 'in_' + picked.name.replace(/[^\w.\-]+/g, '_');
      const outName = 'out.' + target;
      await ff.writeFile(inName, picked.bytes);
      await ff.exec(cfg.args(inName, outName));
      const out = await ff.readFile(outName);
      try { await ff.deleteFile(inName); await ff.deleteFile(outName); } catch (e) {}
      if (!out || !out.length) throw new Error('empty output');

      const base = picked.name.replace(/\.[^.]+$/, '') || 'audio';
      await saveFile(base + '.' + target, new Blob([out], { type: cfg.mime }), cfg.mime);
      setStatus(status, 'ok', tf('snd_done', fmtSize(inSize), fmtSize(out.length), base + '.' + target));
      picked = null; root.querySelector('#sndFile').textContent = '';   // буферът е изразходен — избери файла пак за нова конверсия
    } catch (e) {
      setStatus(status, 'err', tf('snd_error', (e && e.message) || e));
    } finally {
      btn.disabled = false;
    }
  });
}
