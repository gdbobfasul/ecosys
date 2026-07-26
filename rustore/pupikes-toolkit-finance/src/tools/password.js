// Version: 1.0001
// Генератор на пароли — 4 метода, криптографски случайни числа.
import { copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  pwd_hint_random: { bg:'Случайни символи от избраните набори. Най-силна, но трудна за запомняне.', ru:'Случайные символы из выбранных наборов. Самая надёжная, но трудно запомнить.', uk:'Випадкові символи з обраних наборів. Найнадійніша, але важко запам’ятати.', en:'Random characters from the selected sets. Strongest, but hard to remember.', de:'Zufällige Zeichen aus den gewählten Sätzen. Am stärksten, aber schwer zu merken.', fr:'Caractères aléatoires des jeux choisis. La plus forte, mais difficile à retenir.', es:'Caracteres aleatorios de los conjuntos elegidos. La más fuerte, pero difícil de recordar.', 'es-MX':'Caracteres aleatorios de los conjuntos elegidos. La más fuerte, pero difícil de recordar.', it:'Caratteri casuali dai set scelti. La più forte, ma difficile da ricordare.', pt:'Caracteres aleatórios dos conjuntos escolhidos. A mais forte, mas difícil de lembrar.', ar:'رموز عشوائية من المجموعات المختارة. الأقوى، لكن يصعب تذكّرها.', hi:'चुने गए सेट से यादृच्छिक अक्षर। सबसे मज़बूत, पर याद रखना कठिन।', ja:'選択した文字種からランダムに生成。最も強力だが覚えにくい。', ky:'Тандалган топтордон туш келди белгилер. Эң күчтүү, бирок эстеп калуу кыйын.', 'zh-Hant':'從所選字元集隨機產生。最強，但難以記住。' },
  pwd_hint_words: { bg:'Свързва случайни думи — лесна за запомняне, дълга и силна.', ru:'Соединяет случайные слова — легко запомнить, длинная и надёжная.', uk:'З’єднує випадкові слова — легко запам’ятати, довга й надійна.', en:'Joins random words — easy to remember, long and strong.', de:'Verbindet zufällige Wörter — leicht zu merken, lang und stark.', fr:'Relie des mots aléatoires — facile à retenir, longue et forte.', es:'Une palabras aleatorias — fácil de recordar, larga y fuerte.', 'es-MX':'Une palabras aleatorias — fácil de recordar, larga y fuerte.', it:'Unisce parole casuali — facile da ricordare, lunga e forte.', pt:'Junta palavras aleatórias — fácil de lembrar, longa e forte.', ar:'يربط كلمات عشوائية — سهلة التذكّر، طويلة وقوية.', hi:'यादृच्छिक शब्द जोड़ता है — याद रखना आसान, लंबी और मज़बूत।', ja:'ランダムな単語を連結 — 覚えやすく、長くて強力。', ky:'Туш келди сөздөрдү бириктирет — эстеп калуу оңой, узун жана күчтүү.', 'zh-Hant':'串接隨機單字 — 易記、長且強。' },
  pwd_hint_pin: { bg:'Само цифри — за устройства/карти. По-слаба, използвай дълъг PIN.', ru:'Только цифры — для устройств/карт. Слабее, используй длинный PIN.', uk:'Лише цифри — для пристроїв/карток. Слабша, використовуй довгий PIN.', en:'Digits only — for devices/cards. Weaker, use a long PIN.', de:'Nur Ziffern — für Geräte/Karten. Schwächer, verwende eine lange PIN.', fr:'Chiffres seulement — pour appareils/cartes. Plus faible, utilise un long PIN.', es:'Solo dígitos — para dispositivos/tarjetas. Más débil, usa un PIN largo.', 'es-MX':'Solo dígitos — para dispositivos/tarjetas. Más débil, usa un PIN largo.', it:'Solo cifre — per dispositivi/carte. Più debole, usa un PIN lungo.', pt:'Apenas dígitos — para dispositivos/cartões. Mais fraca, use um PIN longo.', ar:'أرقام فقط — للأجهزة/البطاقات. أضعف، استخدم رقمًا سريًا طويلًا.', hi:'केवल अंक — डिवाइस/कार्ड हेतु। कमज़ोर, लंबा PIN उपयोग करें।', ja:'数字のみ — 端末/カード向け。弱いので長いPINを使用。', ky:'Сандар гана — түзмөктөр/карталар үчүн. Алсызыраак, узун PIN колдон.', 'zh-Hant':'僅數字 — 適用裝置／卡片。較弱，請用較長 PIN。' },
  pwd_hint_pronounce: { bg:'Редува съгласна+гласна — звучи като дума, по-лесна за изговаряне.', ru:'Чередует согласную+гласную — звучит как слово, легче произносить.', uk:'Чергує приголосну+голосну — звучить як слово, легше вимовляти.', en:'Alternates consonant+vowel — sounds like a word, easier to pronounce.', de:'Wechselt Konsonant+Vokal — klingt wie ein Wort, leichter auszusprechen.', fr:'Alterne consonne+voyelle — sonne comme un mot, plus facile à prononcer.', es:'Alterna consonante+vocal — suena como palabra, más fácil de pronunciar.', 'es-MX':'Alterna consonante+vocal — suena como palabra, más fácil de pronunciar.', it:'Alterna consonante+vocale — suona come una parola, più facile da pronunciare.', pt:'Alterna consoante+vogal — soa como palavra, mais fácil de pronunciar.', ar:'يتناوب ساكن+حرف علة — يبدو كأنه كلمة، أسهل في النطق.', hi:'व्यंजन+स्वर बारी-बारी — शब्द जैसा लगता है, बोलना आसान।', ja:'子音+母音を交互に — 単語のように聞こえ、発音しやすい。', ky:'Үнсүз+үндүү алмашат — сөздөй угулат, айтуу оңой.', 'zh-Hant':'子音+母音交替 — 像單字，較易發音。' },
  pwd_method_label: { bg:'Метод на генериране', ru:'Метод генерации', uk:'Метод генерації', en:'Generation method', de:'Generierungsmethode', fr:'Méthode de génération', es:'Método de generación', 'es-MX':'Método de generación', it:'Metodo di generazione', pt:'Método de geração', ar:'طريقة التوليد', hi:'जनरेशन विधि', ja:'生成方式', ky:'Түзүү ыкмасы', 'zh-Hant':'產生方式' },
  pwd_opt_random: { bg:'Случайни символи — максимална сила', ru:'Случайные символы — максимальная сила', uk:'Випадкові символи — максимальна сила', en:'Random characters — maximum strength', de:'Zufällige Zeichen — maximale Stärke', fr:'Caractères aléatoires — force maximale', es:'Caracteres aleatorios — fuerza máxima', 'es-MX':'Caracteres aleatorios — fuerza máxima', it:'Caratteri casuali — forza massima', pt:'Caracteres aleatórios — força máxima', ar:'رموز عشوائية — أقصى قوة', hi:'यादृच्छिक अक्षर — अधिकतम मज़बूती', ja:'ランダム文字 — 最大の強度', ky:'Туш келди белгилер — максималдуу күч', 'zh-Hant':'隨機字元 — 最高強度' },
  pwd_opt_words: { bg:'Лесна за запомняне — думи', ru:'Легко запомнить — слова', uk:'Легко запам’ятати — слова', en:'Easy to remember — words', de:'Leicht zu merken — Wörter', fr:'Facile à retenir — mots', es:'Fácil de recordar — palabras', 'es-MX':'Fácil de recordar — palabras', it:'Facile da ricordare — parole', pt:'Fácil de lembrar — palavras', ar:'سهلة التذكّر — كلمات', hi:'याद रखना आसान — शब्द', ja:'覚えやすい — 単語', ky:'Эстеп калуу оңой — сөздөр', 'zh-Hant':'易記 — 單字' },
  pwd_opt_pin: { bg:'Цифров PIN код', ru:'Цифровой PIN-код', uk:'Цифровий PIN-код', en:'Numeric PIN code', de:'Numerischer PIN-Code', fr:'Code PIN numérique', es:'Código PIN numérico', 'es-MX':'Código PIN numérico', it:'Codice PIN numerico', pt:'Código PIN numérico', ar:'رمز PIN رقمي', hi:'संख्यात्मक PIN कोड', ja:'数字のPINコード', ky:'Сандык PIN код', 'zh-Hant':'數字 PIN 碼' },
  pwd_opt_pronounce: { bg:'Произносима — срички', ru:'Произносимая — слоги', uk:'Вимовна — склади', en:'Pronounceable — syllables', de:'Aussprechbar — Silben', fr:'Prononçable — syllabes', es:'Pronunciable — sílabas', 'es-MX':'Pronunciable — sílabas', it:'Pronunciabile — sillabe', pt:'Pronunciável — sílabas', ar:'قابلة للنطق — مقاطع', hi:'उच्चारणीय — अक्षर-समूह', ja:'発音可能 — 音節', ky:'Айтууга мүмкүн — муундар', 'zh-Hant':'可發音 — 音節' },
  pwd_len_label: { bg:'Дължина: {0}', ru:'Длина: {0}', uk:'Довжина: {0}', en:'Length: {0}', de:'Länge: {0}', fr:'Longueur : {0}', es:'Longitud: {0}', 'es-MX':'Longitud: {0}', it:'Lunghezza: {0}', pt:'Comprimento: {0}', ar:'الطول: {0}', hi:'लंबाई: {0}', ja:'長さ: {0}', ky:'Узундугу: {0}', 'zh-Hant':'長度：{0}' },
  pwd_incl_label: { bg:'Включи символи:', ru:'Включить символы:', uk:'Увімкнути символи:', en:'Include characters:', de:'Zeichen einbeziehen:', fr:'Inclure les caractères :', es:'Incluir caracteres:', 'es-MX':'Incluir caracteres:', it:'Includi caratteri:', pt:'Incluir caracteres:', ar:'تضمين الرموز:', hi:'अक्षर शामिल करें:', ja:'含める文字:', ky:'Белгилерди кошуу:', 'zh-Hant':'包含字元：' },
  pwd_chk_upper: { bg:'Главни (A-Z)', ru:'Заглавные (A-Z)', uk:'Великі (A-Z)', en:'Uppercase (A-Z)', de:'Großbuchstaben (A-Z)', fr:'Majuscules (A-Z)', es:'Mayúsculas (A-Z)', 'es-MX':'Mayúsculas (A-Z)', it:'Maiuscole (A-Z)', pt:'Maiúsculas (A-Z)', ar:'أحرف كبيرة (A-Z)', hi:'बड़े अक्षर (A-Z)', ja:'大文字 (A-Z)', ky:'Баш тамгалар (A-Z)', 'zh-Hant':'大寫 (A-Z)' },
  pwd_chk_lower: { bg:'Малки (a-z)', ru:'Строчные (a-z)', uk:'Малі (a-z)', en:'Lowercase (a-z)', de:'Kleinbuchstaben (a-z)', fr:'Minuscules (a-z)', es:'Minúsculas (a-z)', 'es-MX':'Minúsculas (a-z)', it:'Minuscole (a-z)', pt:'Minúsculas (a-z)', ar:'أحرف صغيرة (a-z)', hi:'छोटे अक्षर (a-z)', ja:'小文字 (a-z)', ky:'Кичине тамгалар (a-z)', 'zh-Hant':'小寫 (a-z)' },
  pwd_chk_digits: { bg:'Цифри (0-9)', ru:'Цифры (0-9)', uk:'Цифри (0-9)', en:'Digits (0-9)', de:'Ziffern (0-9)', fr:'Chiffres (0-9)', es:'Dígitos (0-9)', 'es-MX':'Dígitos (0-9)', it:'Cifre (0-9)', pt:'Dígitos (0-9)', ar:'أرقام (0-9)', hi:'अंक (0-9)', ja:'数字 (0-9)', ky:'Сандар (0-9)', 'zh-Hant':'數字 (0-9)' },
  pwd_chk_symbols: { bg:'Специални (!@#$%…)', ru:'Спецсимволы (!@#$%…)', uk:'Спецсимволи (!@#$%…)', en:'Special (!@#$%…)', de:'Sonderzeichen (!@#$%…)', fr:'Spéciaux (!@#$%…)', es:'Especiales (!@#$%…)', 'es-MX':'Especiales (!@#$%…)', it:'Speciali (!@#$%…)', pt:'Especiais (!@#$%…)', ar:'رموز خاصة (!@#$%…)', hi:'विशेष (!@#$%…)', ja:'記号 (!@#$%…)', ky:'Атайын (!@#$%…)', 'zh-Hant':'特殊符號 (!@#$%…)' },
  pwd_chk_nosimilar: { bg:'Без объркващи (0/O, 1/l/I)', ru:'Без похожих (0/O, 1/l/I)', uk:'Без схожих (0/O, 1/l/I)', en:'No confusing (0/O, 1/l/I)', de:'Keine verwechselbaren (0/O, 1/l/I)', fr:'Sans ambigus (0/O, 1/l/I)', es:'Sin confusos (0/O, 1/l/I)', 'es-MX':'Sin confusos (0/O, 1/l/I)', it:'Senza ambigui (0/O, 1/l/I)', pt:'Sem confusos (0/O, 1/l/I)', ar:'بدون متشابهة (0/O, 1/l/I)', hi:'भ्रामक नहीं (0/O, 1/l/I)', ja:'紛らわしい文字なし (0/O, 1/l/I)', ky:'Чаташтырбоо (0/O, 1/l/I)', 'zh-Hant':'排除易混淆 (0/O, 1/l/I)' },
  pwd_gen_btn: { bg:'Генерирай парола', ru:'Создать пароль', uk:'Створити пароль', en:'Generate password', de:'Passwort erstellen', fr:'Générer le mot de passe', es:'Generar contraseña', 'es-MX':'Generar contraseña', it:'Genera password', pt:'Gerar senha', ar:'إنشاء كلمة مرور', hi:'पासवर्ड बनाएं', ja:'パスワードを生成', ky:'Сырсөз түзүү', 'zh-Hant':'產生密碼' },
  pwd_out_title: { bg:'Кликни за копиране', ru:'Нажми, чтобы скопировать', uk:'Натисни, щоб скопіювати', en:'Click to copy', de:'Klicken zum Kopieren', fr:'Cliquer pour copier', es:'Clic para copiar', 'es-MX':'Clic para copiar', it:'Clicca per copiare', pt:'Clique para copiar', ar:'انقر للنسخ', hi:'कॉपी करने हेतु क्लिक करें', ja:'クリックでコピー', ky:'Көчүрүү үчүн басыңыз', 'zh-Hant':'點擊以複製' },
  pwd_need_set: { bg:'Избери поне един набор символи.', ru:'Выбери хотя бы один набор символов.', uk:'Обери хоча б один набір символів.', en:'Select at least one character set.', de:'Wähle mindestens einen Zeichensatz.', fr:'Sélectionne au moins un jeu de caractères.', es:'Selecciona al menos un conjunto de caracteres.', 'es-MX':'Selecciona al menos un conjunto de caracteres.', it:'Seleziona almeno un set di caratteri.', pt:'Selecione pelo menos um conjunto de caracteres.', ar:'اختر مجموعة رموز واحدة على الأقل.', hi:'कम से कम एक अक्षर सेट चुनें।', ja:'少なくとも1つの文字種を選択してください。', ky:'Жок дегенде бир белгилер тобун танда.', 'zh-Hant':'請至少選擇一個字元集。' },
  pwd_str_weak: { bg:'Слаба', ru:'Слабый', uk:'Слабкий', en:'Weak', de:'Schwach', fr:'Faible', es:'Débil', 'es-MX':'Débil', it:'Debole', pt:'Fraca', ar:'ضعيفة', hi:'कमज़ोर', ja:'弱い', ky:'Алсыз', 'zh-Hant':'弱' },
  pwd_str_medium: { bg:'Средна', ru:'Средний', uk:'Середній', en:'Medium', de:'Mittel', fr:'Moyenne', es:'Media', 'es-MX':'Media', it:'Media', pt:'Média', ar:'متوسطة', hi:'मध्यम', ja:'普通', ky:'Орто', 'zh-Hant':'中等' },
  pwd_str_strong: { bg:'Силна', ru:'Сильный', uk:'Сильний', en:'Strong', de:'Stark', fr:'Forte', es:'Fuerte', 'es-MX':'Fuerte', it:'Forte', pt:'Forte', ar:'قوية', hi:'मज़बूत', ja:'強い', ky:'Күчтүү', 'zh-Hant':'強' },
  pwd_strength_label: { bg:'Сила: {0}', ru:'Сила: {0}', uk:'Сила: {0}', en:'Strength: {0}', de:'Stärke: {0}', fr:'Force : {0}', es:'Fuerza: {0}', 'es-MX':'Fuerza: {0}', it:'Forza: {0}', pt:'Força: {0}', ar:'القوة: {0}', hi:'मज़बूती: {0}', ja:'強度: {0}', ky:'Күчү: {0}', 'zh-Hant':'強度：{0}' },
  pwd_copied: { bg:'✓ копирано', ru:'✓ скопировано', uk:'✓ скопійовано', en:'✓ copied', de:'✓ kopiert', fr:'✓ copié', es:'✓ copiado', 'es-MX':'✓ copiado', it:'✓ copiato', pt:'✓ copiado', ar:'✓ تم النسخ', hi:'✓ कॉपी किया', ja:'✓ コピー済み', ky:'✓ көчүрүлдү', 'zh-Hant':'✓ 已複製' },
  pwd_copy_fail: { bg:'не успя', ru:'не удалось', uk:'не вдалося', en:'failed', de:'fehlgeschlagen', fr:'échec', es:'falló', 'es-MX':'falló', it:'non riuscito', pt:'falhou', ar:'فشل', hi:'विफल', ja:'失敗', ky:'болбоду', 'zh-Hant':'失敗' }
});

export const title = 'Генератор на пароли';

const HINT_KEYS = {
  random: 'pwd_hint_random',
  words: 'pwd_hint_words',
  pin: 'pwd_hint_pin',
  pronounce: 'pwd_hint_pronounce'
};
const WORDS = ['ябълка','река','планина','облак','книга','стол','прозорец','звезда','море','гора','цвете','камък','вятър','слънце','луна','птица','риба','мост','ключ','врата','лампа','маса','огън','лед','пясък','злато','сребро','диамант','тигър','орел'];
const CONS = 'bcdfghjklmnprstvz', VOW = 'aeiou';

function rnd(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}
const pick = (s) => s[rnd(s.length)];

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>${t('pwd_method_label')}</label>
      <select id="method">
        <option value="random">${t('pwd_opt_random')}</option>
        <option value="words">${t('pwd_opt_words')}</option>
        <option value="pin">${t('pwd_opt_pin')}</option>
        <option value="pronounce">${t('pwd_opt_pronounce')}</option>
      </select>
      <p class="hint" id="mhint"></p>
      <label>${t('pwd_len_label').replace('{0}', '<span id="lenval">16</span>')}</label>
      <input type="number" id="len" value="16" min="4" max="64" />
      <div id="opts">
        <label>${t('pwd_incl_label')}</label>
        <div class="check"><input type="checkbox" id="upper" checked><span>${t('pwd_chk_upper')}</span></div>
        <div class="check"><input type="checkbox" id="lower" checked><span>${t('pwd_chk_lower')}</span></div>
        <div class="check"><input type="checkbox" id="digits" checked><span>${t('pwd_chk_digits')}</span></div>
        <div class="check"><input type="checkbox" id="symbols" checked><span>${t('pwd_chk_symbols')}</span></div>
        <div class="check"><input type="checkbox" id="nosimilar"><span>${t('pwd_chk_nosimilar')}</span></div>
      </div>
      <button class="btn" id="genbtn">${t('pwd_gen_btn')}</button>
      <div class="mono-out" id="out" title="${t('pwd_out_title')}">—</div>
      <div class="strength"><div id="sbar"></div></div>
      <div class="slabel" id="slabel"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  function onMethod() {
    const m = $('#method').value;
    $('#mhint').textContent = t(HINT_KEYS[m]);
    $('#opts').style.display = m === 'random' ? 'block' : 'none';
  }
  $('#method').addEventListener('change', onMethod);
  $('#len').addEventListener('input', () => { $('#lenval').textContent = $('#len').value; });

  function gen() {
    const m = $('#method').value;
    const len = Math.max(4, Math.min(64, parseInt($('#len').value, 10) || 16));
    let pw = '';
    if (m === 'random') {
      let set = '';
      if ($('#upper').checked) set += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if ($('#lower').checked) set += 'abcdefghijklmnopqrstuvwxyz';
      if ($('#digits').checked) set += '0123456789';
      if ($('#symbols').checked) set += '!@#$%^&*()-_=+[]{}';
      if ($('#nosimilar').checked) set = set.replace(/[0O1lI]/g, '');
      if (!set) { alert(t('pwd_need_set')); return; }
      for (let i = 0; i < len; i++) pw += pick(set);
    } else if (m === 'words') {
      const n = Math.max(3, Math.round(len / 5));
      const parts = [];
      for (let j = 0; j < n; j++) {
        const w = WORDS[rnd(WORDS.length)];
        parts.push(w.charAt(0).toUpperCase() + w.slice(1));
      }
      pw = parts.join('-') + rnd(100);
    } else if (m === 'pin') {
      for (let k = 0; k < len; k++) pw += rnd(10);
    } else if (m === 'pronounce') {
      for (let p = 0; p < len; p++) pw += (p % 2 === 0) ? pick(CONS) : pick(VOW);
      pw = pw.charAt(0).toUpperCase() + pw.slice(1) + rnd(100);
    }
    $('#out').textContent = pw;
    rate(pw);
  }

  function rate(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (pw.length >= 20) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    const pct = Math.min(100, score * 17);
    const bar = $('#sbar');
    bar.style.width = pct + '%';
    let lab, col;
    if (score <= 2) { lab = t('pwd_str_weak'); col = 'var(--err)'; }
    else if (score <= 4) { lab = t('pwd_str_medium'); col = 'var(--warn)'; }
    else { lab = t('pwd_str_strong'); col = 'var(--ok)'; }
    bar.style.background = col;
    const sl = $('#slabel');
    sl.textContent = t('pwd_strength_label').replace('{0}', lab);
    sl.style.color = col;
  }

  $('#genbtn').addEventListener('click', gen);
  $('#out').addEventListener('click', async () => {
    const val = $('#out').textContent;
    if (val && val !== '—') {
      const ok = await copyText(val);
      const o = $('#out'); const old = o.textContent;
      o.textContent = ok ? t('pwd_copied') : t('pwd_copy_fail');
      setTimeout(() => { o.textContent = old; }, 800);
    }
  });

  onMethod();
  gen();
}
