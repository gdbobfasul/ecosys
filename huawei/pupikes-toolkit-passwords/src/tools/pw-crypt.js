// Version: 1.0021
// „Криптиране на текст" (обогатяване 09.09.2026, по искане): AES-256-GCM с парола (PBKDF2-SHA256, 210 000 итерации,
// случайни salt+IV), изцяло на устройството (WebCrypto). Резултатът е компактен текст (base64) с етикет PUP1, който
// може да се прати в чат/имейл и да се декриптира със същата парола. Нищо не напуска телефона.
import { esc, copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  pc_title: { bg:'Криптиране на текст', ru:'Шифрование текста', uk:'Шифрування тексту', en:'Text encryption', de:'Textverschlüsselung', fr:'Chiffrement de texte', es:'Cifrado de texto', 'es-MX':'Cifrado de texto', it:'Cifratura del testo', pt:'Cifragem de texto', ar:'تشفير النص', hi:'टेक्स्ट एन्क्रिप्शन', ja:'テキスト暗号化', ky:'Текстти шифрлөө', 'zh-Hant':'文字加密' },
  pc_hint: { bg:'AES-256-GCM с парола (PBKDF2 210 000 итерации). Криптираният текст може да се прати навсякъде; отваря се само с паролата. Всичко на устройството.', ru:'AES-256-GCM с паролем (PBKDF2, 210 000 итераций). Зашифрованный текст можно отправить куда угодно; открывается только паролем. Всё на устройстве.', uk:'AES-256-GCM з паролем (PBKDF2, 210 000 ітерацій). Зашифрований текст можна надіслати будь-куди; відкривається лише паролем. Усе на пристрої.', en:'AES-256-GCM with a password (PBKDF2, 210,000 iterations). The encrypted text can be sent anywhere; only the password opens it. Everything on the device.', de:'AES-256-GCM mit Passwort (PBKDF2, 210.000 Iterationen). Der verschlüsselte Text kann überall hin; nur das Passwort öffnet ihn. Alles auf dem Gerät.', fr:'AES-256-GCM avec mot de passe (PBKDF2, 210 000 itérations). Le texte chiffré peut être envoyé partout ; seul le mot de passe l\'ouvre. Tout sur l\'appareil.', es:'AES-256-GCM con contraseña (PBKDF2, 210 000 iteraciones). El texto cifrado puede enviarse a cualquier sitio; solo la contraseña lo abre. Todo en el dispositivo.', 'es-MX':'AES-256-GCM con contraseña (PBKDF2, 210 000 iteraciones). El texto cifrado puede enviarse a cualquier lugar; solo la contraseña lo abre. Todo en el dispositivo.', it:'AES-256-GCM con password (PBKDF2, 210.000 iterazioni). Il testo cifrato può essere inviato ovunque; solo la password lo apre. Tutto sul dispositivo.', pt:'AES-256-GCM com palavra-passe (PBKDF2, 210 000 iterações). O texto cifrado pode ser enviado para qualquer lado; só a palavra-passe o abre. Tudo no dispositivo.', ar:'AES-256-GCM بكلمة مرور (PBKDF2، 210,000 تكرار). يمكن إرسال النص المشفر إلى أي مكان؛ كلمة المرور فقط تفتحه. كل شيء على الجهاز.', hi:'पासवर्ड के साथ AES-256-GCM (PBKDF2, 2,10,000 पुनरावृत्तियाँ)। एन्क्रिप्टेड टेक्स्ट कहीं भी भेजा जा सकता है; केवल पासवर्ड ही खोलता है। सब कुछ डिवाइस पर।', ja:'パスワード付きAES-256-GCM（PBKDF2、210,000回）。暗号化テキストはどこにでも送れ、パスワードでのみ開けます。すべて端末内。', ky:'Сырсөз менен AES-256-GCM (PBKDF2, 210 000 итерация). Шифрленген текстти каалаган жерге жөнөтсө болот; сырсөз гана ачат. Баары түзмөктө.', 'zh-Hant':'使用密碼的 AES-256-GCM（PBKDF2，210,000 次）。加密文字可傳送到任何地方，只有密碼能開啟。全部在裝置上。' },
  pc_text: { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'テキスト', ky:'Текст', 'zh-Hant':'文字' },
  pc_pass: { bg:'Парола', ru:'Пароль', uk:'Пароль', en:'Password', de:'Passwort', fr:'Mot de passe', es:'Contraseña', 'es-MX':'Contraseña', it:'Password', pt:'Palavra-passe', ar:'كلمة المرور', hi:'पासवर्ड', ja:'パスワード', ky:'Сырсөз', 'zh-Hant':'密碼' },
  pc_enc: { bg:'🔒 Криптирай', ru:'🔒 Зашифровать', uk:'🔒 Зашифрувати', en:'🔒 Encrypt', de:'🔒 Verschlüsseln', fr:'🔒 Chiffrer', es:'🔒 Cifrar', 'es-MX':'🔒 Cifrar', it:'🔒 Cifra', pt:'🔒 Cifrar', ar:'🔒 تشفير', hi:'🔒 एन्क्रिप्ट', ja:'🔒 暗号化', ky:'🔒 Шифрлөө', 'zh-Hant':'🔒 加密' },
  pc_dec: { bg:'🔓 Декриптирай', ru:'🔓 Расшифровать', uk:'🔓 Розшифрувати', en:'🔓 Decrypt', de:'🔓 Entschlüsseln', fr:'🔓 Déchiffrer', es:'🔓 Descifrar', 'es-MX':'🔓 Descifrar', it:'🔓 Decifra', pt:'🔓 Decifrar', ar:'🔓 فك التشفير', hi:'🔓 डिक्रिप्ट', ja:'🔓 復号', ky:'🔓 Шифрди чечүү', 'zh-Hant':'🔓 解密' },
  pc_out: { bg:'Резултат (докосни, за да копираш)', ru:'Результат (нажмите, чтобы скопировать)', uk:'Результат (торкніться, щоб скопіювати)', en:'Result (tap to copy)', de:'Ergebnis (tippen zum Kopieren)', fr:'Résultat (touchez pour copier)', es:'Resultado (toca para copiar)', 'es-MX':'Resultado (toca para copiar)', it:'Risultato (tocca per copiare)', pt:'Resultado (toque para copiar)', ar:'النتيجة (اضغط للنسخ)', hi:'परिणाम (कॉपी के लिए टैप)', ja:'結果（タップでコピー）', ky:'Натыйжа (көчүрүү үчүн бас)', 'zh-Hant':'結果（點一下複製）' },
  pc_bad: { bg:'Грешна парола или повреден текст.', ru:'Неверный пароль или повреждённый текст.', uk:'Невірний пароль або пошкоджений текст.', en:'Wrong password or corrupted text.', de:'Falsches Passwort oder beschädigter Text.', fr:'Mot de passe erroné ou texte corrompu.', es:'Contraseña incorrecta o texto dañado.', 'es-MX':'Contraseña incorrecta o texto dañado.', it:'Password errata o testo danneggiato.', pt:'Palavra-passe errada ou texto corrompido.', ar:'كلمة مرور خاطئة أو نص تالف.', hi:'गलत पासवर्ड या क्षतिग्रस्त टेक्स्ट।', ja:'パスワードが違うかデータが壊れています。', ky:'Сырсөз туура эмес же текст бузук.', 'zh-Hant':'密碼錯誤或文字損毀。' },
  pc_need: { bg:'Въведи текст и парола.', ru:'Введите текст и пароль.', uk:'Введіть текст і пароль.', en:'Enter text and a password.', de:'Text und Passwort eingeben.', fr:'Saisissez un texte et un mot de passe.', es:'Escribe un texto y una contraseña.', 'es-MX':'Escribe un texto y una contraseña.', it:'Inserisci testo e password.', pt:'Introduza texto e palavra-passe.', ar:'أدخل نصاً وكلمة مرور.', hi:'टेक्स्ट और पासवर्ड दर्ज करें।', ja:'テキストとパスワードを入力してください。', ky:'Текст жана сырсөз киргиз.', 'zh-Hant':'請輸入文字與密碼。' },
  pc_copied: { bg:'Копирано ✓', ru:'Скопировано ✓', uk:'Скопійовано ✓', en:'Copied ✓', de:'Kopiert ✓', fr:'Copié ✓', es:'Copiado ✓', 'es-MX':'Copiado ✓', it:'Copiato ✓', pt:'Copiado ✓', ar:'تم النسخ ✓', hi:'कॉपी हो गया ✓', ja:'コピーしました ✓', ky:'Көчүрүлдү ✓', 'zh-Hant':'已複製 ✓' }
});

export const title = 'Text encryption';

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8)), unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function keyFrom(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptText(text, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(pass, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)));
  const out = new Uint8Array(16 + 12 + ct.length); out.set(salt, 0); out.set(iv, 16); out.set(ct, 28);
  return 'PUP1.' + b64(out);
}
export async function decryptText(blob, pass) {
  const raw = unb64(String(blob).trim().replace(/^PUP1\./, '').replace(/\s+/g, ''));
  const key = await keyFrom(pass, raw.slice(0, 16));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(16, 28) }, key, raw.slice(28));
  return dec.decode(pt);
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <p class="hint">${esc(t('pc_hint'))}</p>
      <label>${esc(t('pc_text'))}</label>
      <textarea id="pc-in" rows="5"></textarea>
      <label>${esc(t('pc_pass'))}</label>
      <input type="password" id="pc-pass" autocomplete="off" />
      <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="pc-enc">${esc(t('pc_enc'))}</button><button class="btn sec" id="pc-dec">${esc(t('pc_dec'))}</button></div>
      <label style="margin-top:10px">${esc(t('pc_out'))}</label>
      <textarea id="pc-out" rows="5" readonly style="cursor:pointer;word-break:break-all"></textarea>
      <div class="hint" id="pc-msg"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const run = async (encrypt) => {
    const text = $('#pc-in').value, pass = $('#pc-pass').value; const msg = $('#pc-msg'); msg.textContent = '';
    if (!text.trim() || !pass) { msg.textContent = t('pc_need'); return; }
    try { $('#pc-out').value = encrypt ? await encryptText(text, pass) : await decryptText(text, pass); } catch (e) { $('#pc-out').value = ''; msg.textContent = t('pc_bad'); }
  };
  $('#pc-enc').addEventListener('click', () => run(true));
  $('#pc-dec').addEventListener('click', () => run(false));
  $('#pc-out').addEventListener('click', async () => { const v = $('#pc-out').value; if (v && await copyText(v)) { $('#pc-msg').textContent = t('pc_copied'); setTimeout(() => { $('#pc-msg').textContent = ''; }, 900); } });
}
