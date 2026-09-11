// Version: 1.0020
// „Анализатор на пароли" (обогатяване Huawei 4.1, 09.09.2026) — проверява ВАША парола изцяло на устройството:
// ентропия (битове), оценка на времето за разбиване (офлайн атака 10 млрд опита/сек и онлайн 100/сек), открити
// слабости (много кратка, само цифри, последователности 1234/abcd/qwerty, повторения, години, думи от речника,
// най-често използвани пароли), препоръки. По избор: проверка в изтекли бази (Have I Been Pwned, k-анонимност —
// изпращат се само първите 5 знака от SHA-1 хеша, никога паролата). Паролата не напуска телефона.
import { esc } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  ps_title: { bg:'Анализатор на пароли', ru:'Анализатор паролей', uk:'Аналізатор паролів', en:'Password analyzer', de:'Passwort-Analyse', fr:'Analyseur de mots de passe', es:'Analizador de contraseñas', 'es-MX':'Analizador de contraseñas', it:'Analizzatore password', pt:'Analisador de palavras-passe', ar:'محلل كلمات المرور', hi:'पासवर्ड विश्लेषक', ja:'パスワード分析', ky:'Сырсөз анализатору', 'zh-Hant':'密碼分析器' },
  ps_in: { bg:'Въведи парола за проверка (не се изпраща никъде)', ru:'Введите пароль для проверки (никуда не отправляется)', uk:'Введіть пароль для перевірки (нікуди не надсилається)', en:'Enter a password to check (never sent anywhere)', de:'Passwort zum Prüfen eingeben (wird nirgends gesendet)', fr:'Saisissez un mot de passe à vérifier (jamais envoyé)', es:'Escribe una contraseña para comprobar (nunca se envía)', 'es-MX':'Escribe una contraseña para comprobar (nunca se envía)', it:'Inserisci una password da verificare (mai inviata)', pt:'Introduza uma palavra-passe para verificar (nunca é enviada)', ar:'أدخل كلمة مرور للفحص (لا تُرسل أبداً)', hi:'जाँच के लिए पासवर्ड दर्ज करें (कहीं नहीं भेजा जाता)', ja:'確認するパスワードを入力（送信されません）', ky:'Текшерүү үчүн сырсөз киргиз (эч жакка жөнөтүлбөйт)', 'zh-Hant':'輸入要檢查的密碼（不會傳送）' },
  ps_verdict: { bg:'Оценка', ru:'Оценка', uk:'Оцінка', en:'Verdict', de:'Bewertung', fr:'Verdict', es:'Veredicto', 'es-MX':'Veredicto', it:'Giudizio', pt:'Veredito', ar:'الحكم', hi:'निर्णय', ja:'判定', ky:'Баа', 'zh-Hant':'評定' },
  ps_v_weak: { bg:'СЛАБА', ru:'СЛАБЫЙ', uk:'СЛАБКИЙ', en:'WEAK', de:'SCHWACH', fr:'FAIBLE', es:'DÉBIL', 'es-MX':'DÉBIL', it:'DEBOLE', pt:'FRACA', ar:'ضعيفة', hi:'कमज़ोर', ja:'弱い', ky:'АЛСЫЗ', 'zh-Hant':'弱' },
  ps_v_medium: { bg:'СРЕДНА', ru:'СРЕДНИЙ', uk:'СЕРЕДНІЙ', en:'MEDIUM', de:'MITTEL', fr:'MOYEN', es:'MEDIA', 'es-MX':'MEDIA', it:'MEDIA', pt:'MÉDIA', ar:'متوسطة', hi:'मध्यम', ja:'普通', ky:'ОРТО', 'zh-Hant':'中等' },
  ps_v_strong: { bg:'СИЛНА', ru:'НАДЁЖНЫЙ', uk:'НАДІЙНИЙ', en:'STRONG', de:'STARK', fr:'FORT', es:'FUERTE', 'es-MX':'FUERTE', it:'FORTE', pt:'FORTE', ar:'قوية', hi:'मज़बूत', ja:'強い', ky:'КҮЧТҮҮ', 'zh-Hant':'強' },
  ps_v_vstrong: { bg:'МНОГО СИЛНА', ru:'ОЧЕНЬ НАДЁЖНЫЙ', uk:'ДУЖЕ НАДІЙНИЙ', en:'VERY STRONG', de:'SEHR STARK', fr:'TRÈS FORT', es:'MUY FUERTE', 'es-MX':'MUY FUERTE', it:'MOLTO FORTE', pt:'MUITO FORTE', ar:'قوية جداً', hi:'बहुत मज़बूत', ja:'非常に強い', ky:'АБДАН КҮЧТҮҮ', 'zh-Hant':'非常強' },
  ps_entropy: { bg:'Ентропия', ru:'Энтропия', uk:'Ентропія', en:'Entropy', de:'Entropie', fr:'Entropie', es:'Entropía', 'es-MX':'Entropía', it:'Entropia', pt:'Entropia', ar:'الإنتروبيا', hi:'एन्ट्रॉपी', ja:'エントロピー', ky:'Энтропия', 'zh-Hant':'熵' },
  ps_bits: { bg:'бита', ru:'бит', uk:'біт', en:'bits', de:'Bit', fr:'bits', es:'bits', 'es-MX':'bits', it:'bit', pt:'bits', ar:'بت', hi:'बिट', ja:'ビット', ky:'бит', 'zh-Hant':'位元' },
  ps_offline: { bg:'Офлайн атака (10 млрд/сек)', ru:'Офлайн-атака (10 млрд/с)', uk:'Офлайн-атака (10 млрд/с)', en:'Offline attack (10 billion/s)', de:'Offline-Angriff (10 Mrd./s)', fr:'Attaque hors ligne (10 milliards/s)', es:'Ataque sin conexión (10 mil millones/s)', 'es-MX':'Ataque sin conexión (10 mil millones/s)', it:'Attacco offline (10 miliardi/s)', pt:'Ataque offline (10 mil milhões/s)', ar:'هجوم دون اتصال (10 مليار/ث)', hi:'ऑफ़लाइन हमला (10 अरब/सेकंड)', ja:'オフライン攻撃（100億/秒）', ky:'Офлайн чабуул (10 млрд/сек)', 'zh-Hant':'離線攻擊（100 億次/秒）' },
  ps_online: { bg:'Онлайн атака (100/сек)', ru:'Онлайн-атака (100/с)', uk:'Онлайн-атака (100/с)', en:'Online attack (100/s)', de:'Online-Angriff (100/s)', fr:'Attaque en ligne (100/s)', es:'Ataque en línea (100/s)', 'es-MX':'Ataque en línea (100/s)', it:'Attacco online (100/s)', pt:'Ataque online (100/s)', ar:'هجوم عبر الإنترنت (100/ث)', hi:'ऑनलाइन हमला (100/सेकंड)', ja:'オンライン攻撃（100/秒）', ky:'Онлайн чабуул (100/сек)', 'zh-Hant':'線上攻擊（100 次/秒）' },
  ps_issues: { bg:'Слабости', ru:'Слабости', uk:'Слабкості', en:'Weaknesses', de:'Schwächen', fr:'Faiblesses', es:'Debilidades', 'es-MX':'Debilidades', it:'Debolezze', pt:'Fraquezas', ar:'نقاط الضعف', hi:'कमज़ोरियाँ', ja:'弱点', ky:'Алсыздыктар', 'zh-Hant':'弱點' },
  ps_ok: { bg:'Няма открити слабости', ru:'Слабостей не найдено', uk:'Слабкостей не знайдено', en:'No weaknesses found', de:'Keine Schwächen gefunden', fr:'Aucune faiblesse trouvée', es:'Sin debilidades', 'es-MX':'Sin debilidades', it:'Nessuna debolezza', pt:'Sem fraquezas', ar:'لا توجد نقاط ضعف', hi:'कोई कमज़ोरी नहीं', ja:'弱点なし', ky:'Алсыздык табылган жок', 'zh-Hant':'未發現弱點' },
  ps_i_short: { bg:'Твърде кратка (под 12 знака)', ru:'Слишком короткий (меньше 12 знаков)', uk:'Занадто короткий (менше 12 знаків)', en:'Too short (under 12 characters)', de:'Zu kurz (unter 12 Zeichen)', fr:'Trop court (moins de 12 caractères)', es:'Demasiado corta (menos de 12 caracteres)', 'es-MX':'Demasiado corta (menos de 12 caracteres)', it:'Troppo corta (meno di 12 caratteri)', pt:'Demasiado curta (menos de 12 caracteres)', ar:'قصيرة جداً (أقل من 12 حرفاً)', hi:'बहुत छोटा (12 अक्षर से कम)', ja:'短すぎます（12文字未満）', ky:'Өтө кыска (12 белгиден аз)', 'zh-Hant':'太短（少於 12 字元）' },
  ps_i_digits: { bg:'Само цифри', ru:'Только цифры', uk:'Лише цифри', en:'Digits only', de:'Nur Ziffern', fr:'Chiffres seulement', es:'Solo dígitos', 'es-MX':'Solo dígitos', it:'Solo cifre', pt:'Só dígitos', ar:'أرقام فقط', hi:'सिर्फ़ अंक', ja:'数字のみ', ky:'Цифралар гана', 'zh-Hant':'僅數字' },
  ps_i_lower: { bg:'Само малки букви', ru:'Только строчные буквы', uk:'Лише малі літери', en:'Lowercase letters only', de:'Nur Kleinbuchstaben', fr:'Minuscules seulement', es:'Solo minúsculas', 'es-MX':'Solo minúsculas', it:'Solo minuscole', pt:'Só minúsculas', ar:'أحرف صغيرة فقط', hi:'सिर्फ़ छोटे अक्षर', ja:'小文字のみ', ky:'Кичине тамгалар гана', 'zh-Hant':'僅小寫字母' },
  ps_i_seq: { bg:'Последователност (1234, abcd, qwerty)', ru:'Последовательность (1234, abcd, qwerty)', uk:'Послідовність (1234, abcd, qwerty)', en:'Sequence (1234, abcd, qwerty)', de:'Sequenz (1234, abcd, qwerty)', fr:'Séquence (1234, abcd, qwerty)', es:'Secuencia (1234, abcd, qwerty)', 'es-MX':'Secuencia (1234, abcd, qwerty)', it:'Sequenza (1234, abcd, qwerty)', pt:'Sequência (1234, abcd, qwerty)', ar:'تسلسل (1234، abcd، qwerty)', hi:'क्रम (1234, abcd, qwerty)', ja:'連続（1234、abcd、qwerty）', ky:'Ырааттуулук (1234, abcd, qwerty)', 'zh-Hant':'連續序列（1234、abcd、qwerty）' },
  ps_i_repeat: { bg:'Повтарящи се знаци (aaa, 111)', ru:'Повторяющиеся знаки (aaa, 111)', uk:'Повторювані знаки (aaa, 111)', en:'Repeated characters (aaa, 111)', de:'Wiederholte Zeichen (aaa, 111)', fr:'Caractères répétés (aaa, 111)', es:'Caracteres repetidos (aaa, 111)', 'es-MX':'Caracteres repetidos (aaa, 111)', it:'Caratteri ripetuti (aaa, 111)', pt:'Caracteres repetidos (aaa, 111)', ar:'أحرف مكررة (aaa، 111)', hi:'दोहराए अक्षर (aaa, 111)', ja:'繰り返し文字（aaa、111）', ky:'Кайталанган белгилер (aaa, 111)', 'zh-Hant':'重複字元（aaa、111）' },
  ps_i_year: { bg:'Съдържа година (19xx/20xx)', ru:'Содержит год (19xx/20xx)', uk:'Містить рік (19xx/20xx)', en:'Contains a year (19xx/20xx)', de:'Enthält eine Jahreszahl (19xx/20xx)', fr:'Contient une année (19xx/20xx)', es:'Contiene un año (19xx/20xx)', 'es-MX':'Contiene un año (19xx/20xx)', it:'Contiene un anno (19xx/20xx)', pt:'Contém um ano (19xx/20xx)', ar:'تحتوي على سنة (19xx/20xx)', hi:'वर्ष शामिल है (19xx/20xx)', ja:'年を含む（19xx/20xx）', ky:'Жыл камтыйт (19xx/20xx)', 'zh-Hant':'包含年份（19xx/20xx）' },
  ps_i_common: { bg:'Много често използвана парола', ru:'Очень распространённый пароль', uk:'Дуже поширений пароль', en:'Very common password', de:'Sehr häufiges Passwort', fr:'Mot de passe très courant', es:'Contraseña muy común', 'es-MX':'Contraseña muy común', it:'Password molto comune', pt:'Palavra-passe muito comum', ar:'كلمة مرور شائعة جداً', hi:'बहुत आम पासवर्ड', ja:'非常によくあるパスワード', ky:'Абдан кеңири колдонулган сырсөз', 'zh-Hant':'非常常見的密碼' },
  ps_i_word: { bg:'Съдържа речникова дума', ru:'Содержит словарное слово', uk:'Містить словникове слово', en:'Contains a dictionary word', de:'Enthält ein Wörterbuchwort', fr:'Contient un mot du dictionnaire', es:'Contiene una palabra del diccionario', 'es-MX':'Contiene una palabra del diccionario', it:'Contiene una parola del dizionario', pt:'Contém uma palavra do dicionário', ar:'تحتوي على كلمة من القاموس', hi:'शब्दकोश का शब्द शामिल', ja:'辞書の単語を含む', ky:'Сөздүктөгү сөздү камтыйт', 'zh-Hant':'包含字典單字' },
  ps_leak: { bg:'Провери в изтекли бази (HIBP, само 5 знака от хеша)', ru:'Проверить в утечках (HIBP, только 5 знаков хеша)', uk:'Перевірити у витоках (HIBP, лише 5 знаків хешу)', en:'Check in leaked databases (HIBP, only 5 hash chars sent)', de:'In Leak-Datenbanken prüfen (HIBP, nur 5 Hash-Zeichen)', fr:'Vérifier dans les fuites (HIBP, 5 caractères du hash seulement)', es:'Comprobar en filtraciones (HIBP, solo 5 caracteres del hash)', 'es-MX':'Comprobar en filtraciones (HIBP, solo 5 caracteres del hash)', it:'Verifica nei database violati (HIBP, solo 5 caratteri dell\'hash)', pt:'Verificar em fugas (HIBP, só 5 caracteres do hash)', ar:'الفحص في قواعد التسريب (HIBP، 5 أحرف من التجزئة فقط)', hi:'लीक डेटाबेस में जाँचें (HIBP, केवल 5 हैश अक्षर)', ja:'漏洩DBで確認（HIBP、ハッシュの先頭5文字のみ送信）', ky:'Агып кеткен базаларда текшер (HIBP, хештин 5 белгиси гана)', 'zh-Hant':'在外洩資料庫檢查（HIBP，只傳送 5 個雜湊字元）' },
  ps_leak_no: { bg:'Не е открита в изтекли бази', ru:'В утечках не найдена', uk:'У витоках не знайдено', en:'Not found in leaked databases', de:'Nicht in Leaks gefunden', fr:'Introuvable dans les fuites', es:'No aparece en filtraciones', 'es-MX':'No aparece en filtraciones', it:'Non trovata in database violati', pt:'Não encontrada em fugas', ar:'غير موجودة في التسريبات', hi:'लीक में नहीं मिला', ja:'漏洩DBに該当なし', ky:'Агып кеткен базаларда табылган жок', 'zh-Hant':'外洩資料庫中未發現' },
  ps_leak_yes: { bg:'ИЗТЕКЛА — срещана {0} пъти. Смени я!', ru:'УТЕКЛА — встречается {0} раз. Смените её!', uk:'ВИТЕКЛА — зустрічається {0} разів. Змініть її!', en:'LEAKED — seen {0} times. Change it!', de:'GELEAKT — {0}-mal gesehen. Ändern!', fr:'FUITÉ — vu {0} fois. Changez-le !', es:'FILTRADA — vista {0} veces. ¡Cámbiala!', 'es-MX':'FILTRADA — vista {0} veces. ¡Cámbiala!', it:'TRAPELATA — vista {0} volte. Cambiala!', pt:'EXPOSTA — vista {0} vezes. Mude-a!', ar:'مسرّبة — ظهرت {0} مرة. غيّرها!', hi:'लीक हुआ — {0} बार मिला। इसे बदलें!', ja:'漏洩済み — {0}回出現。変更してください！', ky:'АГЫП КЕТКЕН — {0} жолу кездешет. Алмаштыр!', 'zh-Hant':'已外洩 — 出現 {0} 次。請更換！' },
  ps_leak_err: { bg:'Проверката не е достъпна сега', ru:'Проверка сейчас недоступна', uk:'Перевірка зараз недоступна', en:'Check not available right now', de:'Prüfung derzeit nicht verfügbar', fr:'Vérification indisponible', es:'Comprobación no disponible', 'es-MX':'Comprobación no disponible', it:'Verifica non disponibile', pt:'Verificação indisponível', ar:'الفحص غير متاح الآن', hi:'जाँच अभी उपलब्ध नहीं', ja:'現在確認できません', ky:'Текшерүү азыр жеткиликсиз', 'zh-Hant':'目前無法檢查' },
  ps_sec: { bg:'секунди', ru:'секунд', uk:'секунд', en:'seconds', de:'Sekunden', fr:'secondes', es:'segundos', 'es-MX':'segundos', it:'secondi', pt:'segundos', ar:'ثوانٍ', hi:'सेकंड', ja:'秒', ky:'секунд', 'zh-Hant':'秒' },
  ps_min: { bg:'минути', ru:'минут', uk:'хвилин', en:'minutes', de:'Minuten', fr:'minutes', es:'minutos', 'es-MX':'minutos', it:'minuti', pt:'minutos', ar:'دقائق', hi:'मिनट', ja:'分', ky:'мүнөт', 'zh-Hant':'分鐘' },
  ps_hr: { bg:'часа', ru:'часов', uk:'годин', en:'hours', de:'Stunden', fr:'heures', es:'horas', 'es-MX':'horas', it:'ore', pt:'horas', ar:'ساعات', hi:'घंटे', ja:'時間', ky:'саат', 'zh-Hant':'小時' },
  ps_day: { bg:'дни', ru:'дней', uk:'днів', en:'days', de:'Tage', fr:'jours', es:'días', 'es-MX':'días', it:'giorni', pt:'dias', ar:'أيام', hi:'दिन', ja:'日', ky:'күн', 'zh-Hant':'天' },
  ps_yr: { bg:'години', ru:'лет', uk:'років', en:'years', de:'Jahre', fr:'ans', es:'años', 'es-MX':'años', it:'anni', pt:'anos', ar:'سنوات', hi:'वर्ष', ja:'年', ky:'жыл', 'zh-Hant':'年' },
  ps_instant: { bg:'мигновено', ru:'мгновенно', uk:'миттєво', en:'instantly', de:'sofort', fr:'instantanément', es:'al instante', 'es-MX':'al instante', it:'istantaneo', pt:'instantâneo', ar:'فوراً', hi:'तुरंत', ja:'瞬時', ky:'заматта', 'zh-Hant':'瞬間' },
  ps_forever: { bg:'над 1 млн години', ru:'более 1 млн лет', uk:'понад 1 млн років', en:'over 1 million years', de:'über 1 Mio. Jahre', fr:'plus d\'un million d\'années', es:'más de 1 millón de años', 'es-MX':'más de 1 millón de años', it:'oltre 1 milione di anni', pt:'mais de 1 milhão de anos', ar:'أكثر من مليون سنة', hi:'10 लाख साल से ज़्यादा', ja:'100万年以上', ky:'1 млн жылдан ашык', 'zh-Hant':'超過 100 萬年' }
});

export const title = 'Password analyzer';

const COMMON = ['password', 'parola', 'пароль', '123456', '12345678', '123456789', 'qwerty', 'abc123', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'master', 'sunshine', 'princess', '1q2w3e4r', 'password1', 'qwerty123', '111111', '000000', '654321', 'zaq12wsx', 'passw0rd', 'login', 'hello', 'secret', 'qazwsx', 'trustno1'];
const WORDS = ['love', 'summer', 'winter', 'flower', 'money', 'house', 'family', 'happy', 'super', 'star', 'king', 'queen', 'apple', 'dog', 'cat', 'sun', 'moon', 'music', 'phone', 'hello', 'secret', 'work', 'life', 'обич', 'лято', 'зима', 'пари', 'слънце', 'любов', 'лето', 'зима', 'деньги', 'солнце', 'liebe', 'sommer', 'amour', 'amor', 'sole'];
const SEQ = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'абвгдежзийклмнопрстуфхцчшщъьюя', 'йцукенгшщзхъ', 'фывапролджэ'];

export function analyze(pw) {
  const issues = [];
  const n = pw.length;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26; if (/[A-Z]/.test(pw)) pool += 26; if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9Ѐ-ӿ]/.test(pw)) pool += 33; if (/[Ѐ-ӿ]/.test(pw)) pool += 32;
  if (!pool) pool = 10;
  let bits = n * Math.log2(pool);
  const low = pw.toLowerCase();
  if (n < 12) issues.push('ps_i_short');
  if (/^\d+$/.test(pw)) issues.push('ps_i_digits');
  else if (/^[a-zа-я]+$/.test(pw)) issues.push('ps_i_lower');
  if (/(.)\1\1/.test(pw)) { issues.push('ps_i_repeat'); bits -= 8; }
  if (/(19|20)\d\d/.test(pw)) { issues.push('ps_i_year'); bits -= 6; }
  for (const s of SEQ) { const r = s.split('').reverse().join(''); for (let i = 0; i + 4 <= s.length; i++) { const frag = s.slice(i, i + 4); if (low.includes(frag) || low.includes(r.slice(i, i + 4))) { if (!issues.includes('ps_i_seq')) issues.push('ps_i_seq'); bits -= 10; break; } } }
  if (COMMON.includes(low) || COMMON.includes(low.replace(/[0-9!@#$%^&*._-]+$/, ''))) { issues.push('ps_i_common'); bits = Math.min(bits, 10); }
  else if (WORDS.some((w) => w.length >= 4 && low.includes(w))) { issues.push('ps_i_word'); bits -= 12; }
  bits = Math.max(0, Math.round(bits));
  return { bits, issues, pool, n };
}
export function crackTime(bits, perSec) {
  const secs = Math.pow(2, bits) / perSec / 2;
  if (secs < 1) return t('ps_instant');
  if (secs < 60) return Math.round(secs) + ' ' + t('ps_sec');
  if (secs < 3600) return Math.round(secs / 60) + ' ' + t('ps_min');
  if (secs < 86400) return Math.round(secs / 3600) + ' ' + t('ps_hr');
  if (secs < 31536000) return Math.round(secs / 86400) + ' ' + t('ps_day');
  if (secs < 31536000 * 1e6) return Math.round(secs / 31536000).toLocaleString() + ' ' + t('ps_yr');
  return t('ps_forever');
}
async function sha1Hex(s) { const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(); }
async function fetchText(url) {
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  const tmo = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
  if (CH && CH.get) { const r = await Promise.race([CH.get({ url, headers: { 'Add-Padding': 'true' } }), tmo]); return typeof r.data === 'string' ? r.data : JSON.stringify(r.data); }
  const r = await Promise.race([fetch(url, { headers: { 'Add-Padding': 'true' } }), tmo]); return await r.text();
}
// HIBP k-анонимност: праща се САМО префиксът (5 hex знака); резултатът се търси локално по суфикса.
export async function hibpCount(pw) {
  const h = await sha1Hex(pw); const prefix = h.slice(0, 5), suffix = h.slice(5);
  let body = '';
  try { body = await fetchText('https://api.pwnedpasswords.com/range/' + prefix); }
  catch (_) { body = await fetchText('https://pupikes.app/api/relay/get?url=' + encodeURIComponent('https://api.pwnedpasswords.com/range/' + prefix)); }
  const line = body.split(/\r?\n/).find((l) => l.startsWith(suffix));
  return line ? parseInt(line.split(':')[1], 10) || 0 : 0;
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>${esc(t('ps_in'))}</label>
      <input type="text" id="ps-in" autocomplete="off" autocapitalize="off" spellcheck="false" />
      <div id="ps-out" style="margin-top:10px"></div>
      <button class="btn sec" id="ps-leak" style="margin-top:10px">${esc(t('ps_leak'))}</button>
      <div id="ps-leakres" style="margin-top:8px"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const inp = $('#ps-in'), out = $('#ps-out');
  const draw = () => {
    const pw = inp.value; if (!pw) { out.innerHTML = ''; return; }
    const a = analyze(pw);
    const pct = Math.min(100, Math.round(a.bits / 80 * 100));
    const col = a.bits < 40 ? 'var(--err)' : (a.bits < 64 ? 'var(--warn)' : 'var(--ok)');
    const verdict = a.bits < 36 ? t('ps_v_weak') : a.bits < 56 ? t('ps_v_medium') : a.bits < 80 ? t('ps_v_strong') : t('ps_v_vstrong');
    out.innerHTML = `<div style="font-size:20px;font-weight:700;color:${col};margin:4px 0">${esc(t('ps_verdict'))}: ${esc(verdict)} · ${pct}%</div><div style="height:8px;background:rgba(127,127,127,.25);border-radius:6px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${col}"></div></div>
      <div style="margin-top:6px"><b>${esc(t('ps_entropy'))}:</b> ${a.bits} ${esc(t('ps_bits'))} · ${a.n} chars · pool ${a.pool}</div>
      <div><b>${esc(t('ps_offline'))}:</b> ${esc(crackTime(a.bits, 1e10))}</div>
      <div><b>${esc(t('ps_online'))}:</b> ${esc(crackTime(a.bits, 100))}</div>
      <div style="margin-top:6px"><b>${esc(t('ps_issues'))}:</b> ${a.issues.length ? '<ul style="margin:4px 0 0 18px">' + a.issues.map((k) => '<li>' + esc(t(k)) + '</li>').join('') + '</ul>' : '<span style="color:var(--ok)">' + esc(t('ps_ok')) + '</span>'}</div>`;
  };
  inp.addEventListener('input', draw);
  $('#ps-leak').addEventListener('click', async () => {
    const pw = inp.value; if (!pw) return; const res = $('#ps-leakres'); res.textContent = '…';
    try { const n = await hibpCount(pw); res.innerHTML = n ? '<b style="color:var(--err)">' + esc(t('ps_leak_yes').replace('{0}', n.toLocaleString())) + '</b>' : '<span style="color:var(--ok)">' + esc(t('ps_leak_no')) + '</span>'; }
    catch (_) { res.textContent = t('ps_leak_err'); }
  });
}
