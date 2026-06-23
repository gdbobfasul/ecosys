// i18n.js — преводен слой за обвивката на „KCY Chat" на 15-те езика на екосистемата.
// Обвивката е малка: локализират се само нейните собствени низове (зареждане,
// липса на връзка, „Опитай пак", избор на език). Самият чат е сървърен.
// Език по подразбиране: руски (до избор от потребителя при първо стартиране).
// Верига на отстъпление: текущ → ru → en → ключ.
import { LANGUAGES, languageByCode, RTL_CODES } from './languages.js';

const LS_KEY = 'chat.lang';
const DEFAULT_LANG = 'ru';
const FALLBACK_LANG = 'en';

// Само низовете на обвивката (shell). Всичко останало е сървърно.
const STR = {
  // Марка (показва се горе на всеки екран).
  brand: { bg:'KCY Чат', ru:'KCY Чат', uk:'KCY Чат', en:'KCY Chat', de:'KCY Chat', fr:'KCY Chat', es:'KCY Chat', 'es-MX':'KCY Chat', it:'KCY Chat', pt:'KCY Chat', ar:'دردشة KCY', hi:'KCY चैट', ja:'KCY チャット', ky:'KCY Чат', 'zh-Hant':'KCY 聊天' },

  // Екран на зареждане.
  connecting: { bg:'Свързване със сървъра…', ru:'Подключение к серверу…', uk:'Підключення до сервера…', en:'Connecting to the server…', de:'Verbindung zum Server…', fr:'Connexion au serveur…', es:'Conectando al servidor…', 'es-MX':'Conectando al servidor…', it:'Connessione al server…', pt:'Conectando ao servidor…', ar:'جارٍ الاتصال بالخادم…', hi:'सर्वर से कनेक्ट हो रहा है…', ja:'サーバーに接続中…', ky:'Серверге туташууда…', 'zh-Hant':'正在連線到伺服器…' },

  // Екран „няма връзка".
  offline_title: { bg:'Няма връзка със сървъра', ru:'Нет связи с сервером', uk:'Немає зв’язку з сервером', en:'No connection to the server', de:'Keine Verbindung zum Server', fr:'Pas de connexion au serveur', es:'Sin conexión con el servidor', 'es-MX':'Sin conexión con el servidor', it:'Nessuna connessione al server', pt:'Sem conexão com o servidor', ar:'لا يوجد اتصال بالخادم', hi:'सर्वर से कनेक्शन नहीं', ja:'サーバーに接続できません', ky:'Сервер менен байланыш жок', 'zh-Hant':'無法連線到伺服器' },
  offline_desc: { bg:'Провери интернет връзката и опитай пак.', ru:'Проверьте подключение к интернету и повторите попытку.', uk:'Перевірте підключення до інтернету та спробуйте ще раз.', en:'Check your internet connection and try again.', de:'Prüfe deine Internetverbindung und versuche es erneut.', fr:'Vérifie ta connexion internet et réessaie.', es:'Revisa tu conexión a internet e inténtalo de nuevo.', 'es-MX':'Revisa tu conexión a internet e inténtalo de nuevo.', it:'Controlla la connessione a internet e riprova.', pt:'Verifique sua conexão com a internet e tente novamente.', ar:'تحقق من اتصالك بالإنترنت وحاول مرة أخرى.', hi:'अपना इंटरनेट कनेक्शन जांचें और फिर से प्रयास करें।', ja:'インターネット接続を確認して、もう一度お試しください。', ky:'Интернет байланышын текшерип, кайра аракет кылыңыз.', 'zh-Hant':'請檢查您的網路連線並重試。' },
  retry: { bg:'Опитай пак', ru:'Повторить', uk:'Повторити', en:'Try again', de:'Erneut versuchen', fr:'Réessayer', es:'Reintentar', 'es-MX':'Reintentar', it:'Riprova', pt:'Tentar de novo', ar:'حاول مرة أخرى', hi:'फिर से प्रयास करें', ja:'再試行', ky:'Кайра аракет', 'zh-Hant':'重試' },

  // Избор на език (първо стартиране + повторен избор).
  pick_lang: { bg:'Избери език', ru:'Выберите язык', uk:'Виберіть мову', en:'Choose language', de:'Sprache wählen', fr:'Choisir la langue', es:'Elegir idioma', 'es-MX':'Elegir idioma', it:'Scegli la lingua', pt:'Escolher idioma', ar:'اختر اللغة', hi:'भाषा चुनें', ja:'言語を選択', ky:'Тилди тандаңыз', 'zh-Hant':'選擇語言' },
  lang_btn: { bg:'🌐 Език', ru:'🌐 Язык', uk:'🌐 Мова', en:'🌐 Language', de:'🌐 Sprache', fr:'🌐 Langue', es:'🌐 Idioma', 'es-MX':'🌐 Idioma', it:'🌐 Lingua', pt:'🌐 Idioma', ar:'🌐 اللغة', hi:'🌐 भाषा', ja:'🌐 言語', ky:'🌐 Тил', 'zh-Hant':'🌐 語言' }
};

// Ключ-сонда за валидиране, че даден език изобщо съществува в речника.
const PROBE_KEY = 'retry';

let current = detect();

function detect() {
  try { const s = localStorage.getItem(LS_KEY); if (s && STR[PROBE_KEY][s] != null) return s; } catch (e) {}
  return DEFAULT_LANG;
}

export function hasLangChosen() {
  try { return !!localStorage.getItem(LS_KEY); } catch (e) { return false; }
}
export function getLang() { return current; }
export function setLang(code) {
  if (STR[PROBE_KEY][code] == null) return;
  current = code;
  try { localStorage.setItem(LS_KEY, code); } catch (e) {}
  applyDir();
}
export function isRTL() { return RTL_CODES.indexOf(current) > -1; }
export function applyDir() {
  try {
    document.documentElement.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', current);
  } catch (e) {}
}
export function t(key) {
  const row = STR[key];
  if (!row) return key;
  if (row[current] != null) return row[current];
  if (row[DEFAULT_LANG] != null) return row[DEFAULT_LANG];
  if (row[FALLBACK_LANG] != null) return row[FALLBACK_LANG];
  return key;
}
export function tf(key, ...vals) {
  let s = t(key);
  vals.forEach((v, i) => { s = s.replace(new RegExp('\\{' + i + '\\}', 'g'), String(v)); });
  return s;
}
export { LANGUAGES, languageByCode };
