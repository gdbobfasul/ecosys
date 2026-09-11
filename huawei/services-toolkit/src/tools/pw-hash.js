// Version: 1.0021
// „Хешове, кодиране и парола за сайт" (обогатяване 09.09.2026, по искане): SHA-256/384/512 и HMAC на текст,
// кодиране/декодиране Base64 · Hex · URL, и ДЕТЕРМИНИРАНА парола за сайт: от една главна парола + име на сайта се
// извежда винаги една и съща силна парола (PBKDF2-SHA256, 100 000 итерации) — без да се пази никъде. На устройството.
import { esc, copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  ph_title: { bg:'Хешове, кодиране и парола за сайт', ru:'Хеши, кодирование и пароль для сайта', uk:'Хеші, кодування і пароль для сайту', en:'Hashes, encoding & site password', de:'Hashes, Kodierung & Website-Passwort', fr:'Hachages, encodage et mot de passe de site', es:'Hashes, codificación y contraseña de sitio', 'es-MX':'Hashes, codificación y contraseña de sitio', it:'Hash, codifica e password per sito', pt:'Hashes, codificação e palavra-passe de site', ar:'تجزئة وترميز وكلمة مرور للموقع', hi:'हैश, एन्कोडिंग और साइट पासवर्ड', ja:'ハッシュ・エンコード・サイト用パスワード', ky:'Хэш, коддоо жана сайт үчүн сырсөз', 'zh-Hant':'雜湊、編碼與網站密碼' },
  ph_mode: { bg:'Действие', ru:'Действие', uk:'Дія', en:'Action', de:'Aktion', fr:'Action', es:'Acción', 'es-MX':'Acción', it:'Azione', pt:'Ação', ar:'الإجراء', hi:'क्रिया', ja:'操作', ky:'Аракет', 'zh-Hant':'動作' },
  ph_m_hash: { bg:'Хеш (SHA-256 / 384 / 512)', ru:'Хеш (SHA-256 / 384 / 512)', uk:'Хеш (SHA-256 / 384 / 512)', en:'Hash (SHA-256 / 384 / 512)', de:'Hash (SHA-256 / 384 / 512)', fr:'Hachage (SHA-256 / 384 / 512)', es:'Hash (SHA-256 / 384 / 512)', 'es-MX':'Hash (SHA-256 / 384 / 512)', it:'Hash (SHA-256 / 384 / 512)', pt:'Hash (SHA-256 / 384 / 512)', ar:'تجزئة (SHA-256 / 384 / 512)', hi:'हैश (SHA-256 / 384 / 512)', ja:'ハッシュ（SHA-256/384/512）', ky:'Хэш (SHA-256 / 384 / 512)', 'zh-Hant':'雜湊（SHA-256/384/512）' },
  ph_m_hmac: { bg:'HMAC-SHA256 (с ключ)', ru:'HMAC-SHA256 (с ключом)', uk:'HMAC-SHA256 (з ключем)', en:'HMAC-SHA256 (with key)', de:'HMAC-SHA256 (mit Schlüssel)', fr:'HMAC-SHA256 (avec clé)', es:'HMAC-SHA256 (con clave)', 'es-MX':'HMAC-SHA256 (con clave)', it:'HMAC-SHA256 (con chiave)', pt:'HMAC-SHA256 (com chave)', ar:'HMAC-SHA256 (بمفتاح)', hi:'HMAC-SHA256 (कुंजी के साथ)', ja:'HMAC-SHA256（鍵付き）', ky:'HMAC-SHA256 (ачкыч менен)', 'zh-Hant':'HMAC-SHA256（含金鑰）' },
  ph_m_b64: { bg:'Base64 кодирай / декодирай', ru:'Base64 закодировать / раскодировать', uk:'Base64 закодувати / розкодувати', en:'Base64 encode / decode', de:'Base64 kodieren / dekodieren', fr:'Base64 encoder / décoder', es:'Base64 codificar / decodificar', 'es-MX':'Base64 codificar / decodificar', it:'Base64 codifica / decodifica', pt:'Base64 codificar / descodificar', ar:'ترميز / فك ترميز Base64', hi:'Base64 एन्कोड / डिकोड', ja:'Base64 エンコード／デコード', ky:'Base64 коддоо / чечүү', 'zh-Hant':'Base64 編碼／解碼' },
  ph_m_hex: { bg:'Hex кодирай / декодирай', ru:'Hex закодировать / раскодировать', uk:'Hex закодувати / розкодувати', en:'Hex encode / decode', de:'Hex kodieren / dekodieren', fr:'Hex encoder / décoder', es:'Hex codificar / decodificar', 'es-MX':'Hex codificar / decodificar', it:'Hex codifica / decodifica', pt:'Hex codificar / descodificar', ar:'ترميز / فك ترميز Hex', hi:'Hex एन्कोड / डिकोड', ja:'Hex エンコード／デコード', ky:'Hex коддоо / чечүү', 'zh-Hant':'Hex 編碼／解碼' },
  ph_m_url: { bg:'URL кодирай / декодирай', ru:'URL закодировать / раскодировать', uk:'URL закодувати / розкодувати', en:'URL encode / decode', de:'URL kodieren / dekodieren', fr:'URL encoder / décoder', es:'URL codificar / decodificar', 'es-MX':'URL codificar / decodificar', it:'URL codifica / decodifica', pt:'URL codificar / descodificar', ar:'ترميز / فك ترميز URL', hi:'URL एन्कोड / डिकोड', ja:'URL エンコード／デコード', ky:'URL коддоо / чечүү', 'zh-Hant':'URL 編碼／解碼' },
  ph_m_site: { bg:'Парола за сайт от главна парола', ru:'Пароль для сайта из главного пароля', uk:'Пароль для сайту з головного пароля', en:'Site password from a master password', de:'Website-Passwort aus Master-Passwort', fr:'Mot de passe de site depuis un mot de passe maître', es:'Contraseña de sitio desde una contraseña maestra', 'es-MX':'Contraseña de sitio desde una contraseña maestra', it:'Password per sito da una password principale', pt:'Palavra-passe de site a partir de uma mestra', ar:'كلمة مرور للموقع من كلمة مرور رئيسية', hi:'मास्टर पासवर्ड से साइट पासवर्ड', ja:'マスターパスワードからサイト用パスワード', ky:'Башкы сырсөздөн сайт үчүн сырсөз', 'zh-Hant':'由主密碼產生網站密碼' },
  ph_in: { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'テキスト', ky:'Текст', 'zh-Hant':'文字' },
  ph_key: { bg:'Ключ / главна парола', ru:'Ключ / главный пароль', uk:'Ключ / головний пароль', en:'Key / master password', de:'Schlüssel / Master-Passwort', fr:'Clé / mot de passe maître', es:'Clave / contraseña maestra', 'es-MX':'Clave / contraseña maestra', it:'Chiave / password principale', pt:'Chave / palavra-passe mestra', ar:'المفتاح / كلمة المرور الرئيسية', hi:'कुंजी / मास्टर पासवर्ड', ja:'鍵／マスターパスワード', ky:'Ачкыч / башкы сырсөз', 'zh-Hant':'金鑰／主密碼' },
  ph_site: { bg:'Сайт / услуга (напр. gmail.com)', ru:'Сайт / сервис (напр. gmail.com)', uk:'Сайт / сервіс (напр. gmail.com)', en:'Site / service (e.g. gmail.com)', de:'Website / Dienst (z. B. gmail.com)', fr:'Site / service (ex. gmail.com)', es:'Sitio / servicio (p. ej. gmail.com)', 'es-MX':'Sitio / servicio (p. ej. gmail.com)', it:'Sito / servizio (es. gmail.com)', pt:'Site / serviço (ex. gmail.com)', ar:'الموقع / الخدمة (مثال gmail.com)', hi:'साइट / सेवा (जैसे gmail.com)', ja:'サイト／サービス（例: gmail.com）', ky:'Сайт / кызмат (мис. gmail.com)', 'zh-Hant':'網站／服務（例：gmail.com）' },
  ph_site_hint: { bg:'Същата главна парола + същият сайт → винаги същата силна парола (20 знака). Не се пази никъде — извежда се всеки път.', ru:'Тот же главный пароль + тот же сайт → всегда тот же надёжный пароль (20 знаков). Нигде не хранится — выводится каждый раз.', uk:'Той самий головний пароль + той самий сайт → завжди той самий надійний пароль (20 знаків). Ніде не зберігається.', en:'Same master password + same site → always the same strong password (20 characters). Stored nowhere — derived every time.', de:'Gleiches Master-Passwort + gleiche Website → immer dasselbe starke Passwort (20 Zeichen). Nirgends gespeichert.', fr:'Même mot de passe maître + même site → toujours le même mot de passe fort (20 caractères). Stocké nulle part.', es:'Misma contraseña maestra + mismo sitio → siempre la misma contraseña fuerte (20 caracteres). No se guarda en ningún sitio.', 'es-MX':'Misma contraseña maestra + mismo sitio → siempre la misma contraseña fuerte (20 caracteres). No se guarda en ningún lugar.', it:'Stessa password principale + stesso sito → sempre la stessa password forte (20 caratteri). Non salvata da nessuna parte.', pt:'Mesma palavra-passe mestra + mesmo site → sempre a mesma palavra-passe forte (20 caracteres). Não é guardada em lado nenhum.', ar:'نفس كلمة المرور الرئيسية + نفس الموقع → دائماً نفس كلمة المرور القوية (20 حرفاً). لا تُخزَّن في أي مكان.', hi:'वही मास्टर पासवर्ड + वही साइट → हमेशा वही मज़बूत पासवर्ड (20 अक्षर)। कहीं सहेजा नहीं जाता।', ja:'同じマスターパスワード＋同じサイト → 常に同じ強力なパスワード（20文字）。どこにも保存されません。', ky:'Ошол эле башкы сырсөз + ошол эле сайт → ар дайым ошол эле күчтүү сырсөз (20 белги). Эч жерде сакталбайт.', 'zh-Hant':'相同主密碼＋相同網站 → 永遠是同一組強密碼（20 字元）。不儲存於任何地方。' },
  ph_go: { bg:'Изчисли', ru:'Вычислить', uk:'Обчислити', en:'Compute', de:'Berechnen', fr:'Calculer', es:'Calcular', 'es-MX':'Calcular', it:'Calcola', pt:'Calcular', ar:'احسب', hi:'गणना करें', ja:'計算', ky:'Эсептөө', 'zh-Hant':'計算' },
  ph_decode: { bg:'Декодирай', ru:'Раскодировать', uk:'Розкодувати', en:'Decode', de:'Dekodieren', fr:'Décoder', es:'Decodificar', 'es-MX':'Decodificar', it:'Decodifica', pt:'Descodificar', ar:'فك الترميز', hi:'डिकोड', ja:'デコード', ky:'Чечүү', 'zh-Hant':'解碼' },
  ph_out: { bg:'Резултат (докосни, за да копираш)', ru:'Результат (нажмите, чтобы скопировать)', uk:'Результат (торкніться, щоб скопіювати)', en:'Result (tap to copy)', de:'Ergebnis (tippen zum Kopieren)', fr:'Résultat (touchez pour copier)', es:'Resultado (toca para copiar)', 'es-MX':'Resultado (toca para copiar)', it:'Risultato (tocca per copiare)', pt:'Resultado (toque para copiar)', ar:'النتيجة (اضغط للنسخ)', hi:'परिणाम (कॉपी के लिए टैप)', ja:'結果（タップでコピー）', ky:'Натыйжа (көчүрүү үчүн бас)', 'zh-Hant':'結果（點一下複製）' },
  ph_bad: { bg:'Невалиден вход за декодиране.', ru:'Неверные данные для раскодирования.', uk:'Невірні дані для розкодування.', en:'Invalid input for decoding.', de:'Ungültige Eingabe zum Dekodieren.', fr:'Entrée invalide pour le décodage.', es:'Entrada no válida para decodificar.', 'es-MX':'Entrada no válida para decodificar.', it:'Input non valido per la decodifica.', pt:'Entrada inválida para descodificar.', ar:'إدخال غير صالح لفك الترميز.', hi:'डिकोड के लिए अमान्य इनपुट।', ja:'デコードできない入力です。', ky:'Чечүү үчүн жараксыз маалымат.', 'zh-Hant':'無法解碼的輸入。' },
  ph_copied: { bg:'Копирано ✓', ru:'Скопировано ✓', uk:'Скопійовано ✓', en:'Copied ✓', de:'Kopiert ✓', fr:'Copié ✓', es:'Copiado ✓', 'es-MX':'Copiado ✓', it:'Copiato ✓', pt:'Copiado ✓', ar:'تم النسخ ✓', hi:'कॉपी हो गया ✓', ja:'コピーしました ✓', ky:'Көчүрүлдү ✓', 'zh-Hant':'已複製 ✓' }
});

export const title = 'Hashes & encoding';

const enc = new TextEncoder(), dec = new TextDecoder();
const hex = (u8) => Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => { const c = s.replace(/[^0-9a-f]/gi, ''); if (c.length % 2) throw new Error('hex'); return Uint8Array.from(c.match(/../g).map((h) => parseInt(h, 16))); };
const b64 = (u8) => btoa(String.fromCharCode(...u8)), unb64 = (s) => Uint8Array.from(atob(s.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
export async function sha(text, algo) { return hex(new Uint8Array(await crypto.subtle.digest(algo, enc.encode(text)))); }
export async function hmac(text, key) { const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)))); }
// Детерминирана парола за сайт: PBKDF2(master, salt='pupikes:'+site) → 20 знака от 4 набора (гарантирано по един от всеки).
export async function sitePassword(master, site) {
  const base = await crypto.subtle.importKey('raw', enc.encode(master), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('pupikes:' + site.trim().toLowerCase()), iterations: 100000, hash: 'SHA-256' }, base, 256));
  const sets = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*?'], all = sets.join('');
  const out = [];
  for (let i = 0; i < 4; i++) out.push(sets[i][bits[i] % sets[i].length]);
  for (let i = 4; i < 20; i++) out.push(all[bits[i] % all.length]);
  // детерминирано разбъркване по остатъка от байтовете
  for (let i = out.length - 1; i > 0; i--) { const j = bits[20 + (i % 12)] % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

export function render(root) {
  const opt = (v, l) => `<option value="${v}">${esc(l)}</option>`;
  root.innerHTML = `
    <div class="tool-card">
      <label>${esc(t('ph_mode'))}</label>
      <select id="ph-mode">${opt('sha', t('ph_m_hash'))}${opt('hmac', t('ph_m_hmac'))}${opt('b64', t('ph_m_b64'))}${opt('hex', t('ph_m_hex'))}${opt('url', t('ph_m_url'))}${opt('site', t('ph_m_site'))}</select>
      <div data-f="in"><label>${esc(t('ph_in'))}</label><textarea id="ph-in" rows="4"></textarea></div>
      <div data-f="key"><label>${esc(t('ph_key'))}</label><input type="password" id="ph-key" autocomplete="off" /></div>
      <div data-f="site"><label>${esc(t('ph_site'))}</label><input type="text" id="ph-site" autocomplete="off" /><p class="hint">${esc(t('ph_site_hint'))}</p></div>
      <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="ph-go">${esc(t('ph_go'))}</button><button class="btn sec" id="ph-dec">${esc(t('ph_decode'))}</button></div>
      <label style="margin-top:10px">${esc(t('ph_out'))}</label>
      <textarea id="ph-out" rows="4" readonly style="cursor:pointer;word-break:break-all;font-family:monospace"></textarea>
      <div class="hint" id="ph-msg"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const FIELDS = { sha: ['in'], hmac: ['in', 'key'], b64: ['in'], hex: ['in'], url: ['in'], site: ['key', 'site'] };
  const mode = $('#ph-mode');
  const show = () => { const f = FIELDS[mode.value]; root.querySelectorAll('[data-f]').forEach((el) => { el.style.display = f.indexOf(el.getAttribute('data-f')) >= 0 ? '' : 'none'; }); $('#ph-dec').style.display = /b64|hex|url/.test(mode.value) ? '' : 'none'; };
  mode.addEventListener('change', show); show();
  const run = async (decode) => {
    const m = mode.value, text = $('#ph-in').value, key = $('#ph-key').value, site = $('#ph-site').value; const msg = $('#ph-msg'); msg.textContent = '';
    try {
      let out = '';
      if (m === 'sha') out = ['SHA-256', 'SHA-384', 'SHA-512'].map((a) => a + ': ').join('\n');
      if (m === 'sha') { const parts = []; for (const a of ['SHA-256', 'SHA-384', 'SHA-512']) parts.push(a + ':\n' + await sha(text, a)); out = parts.join('\n\n'); }
      else if (m === 'hmac') out = await hmac(text, key);
      else if (m === 'b64') out = decode ? dec.decode(unb64(text)) : b64(enc.encode(text));
      else if (m === 'hex') out = decode ? dec.decode(unhex(text)) : hex(enc.encode(text));
      else if (m === 'url') out = decode ? decodeURIComponent(text) : encodeURIComponent(text);
      else if (m === 'site') { if (!key || !site.trim()) { msg.textContent = t('ph_bad'); return; } out = await sitePassword(key, site); }
      $('#ph-out').value = out;
    } catch (e) { $('#ph-out').value = ''; msg.textContent = t('ph_bad'); }
  };
  $('#ph-go').addEventListener('click', () => run(false));
  $('#ph-dec').addEventListener('click', () => run(true));
  $('#ph-out').addEventListener('click', async () => { const v = $('#ph-out').value; if (v && await copyText(v)) { $('#ph-msg').textContent = t('ph_copied'); setTimeout(() => { $('#ph-msg').textContent = ''; }, 900); } });
}
