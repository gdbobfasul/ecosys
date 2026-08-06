// Version: 1.0001
// voice.js — реч → текст (диктовка) за робота-секретарка.
// Използва, по ред на предпочитание:
//   1) Capacitor плъгин SpeechRecognition (нативно, ако е наличен в WebView-а);
//   2) Web Speech API (webkitSpeechRecognition) — работи в браузър/Chrome WebView;
//   3) нищо → връща { available:false } и екранът пада към писане на ръка.
// Езикът е ТОЗИ, който човекът е избрал в началото (подава се voiceLocale).
//
// НИЩО не се праща на сървър — разпознаването е на устройството/браузъра.

// App-код (15-те езика) → локал за разпознаване на реч.
const LOCALE = {
  bg: 'bg-BG', ru: 'ru-RU', uk: 'uk-UA', en: 'en-US', de: 'de-DE', fr: 'fr-FR',
  es: 'es-ES', 'es-MX': 'es-MX', it: 'it-IT', pt: 'pt-PT', ar: 'ar-SA', hi: 'hi-IN',
  ja: 'ja-JP', ky: 'ky-KG', 'zh-Hant': 'zh-TW'
};

export function localeFor(langCode) {
  return LOCALE[langCode] || LOCALE[String(langCode || '').split('-')[0]] || 'en-US';
}

function capSR() {
  try {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition) {
      return window.Capacitor.Plugins.SpeechRecognition;
    }
  } catch (_) {}
  return null;
}
function webSR() {
  try {
    if (typeof window !== 'undefined') return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  } catch (_) {}
  return null;
}

export function voiceAvailable() {
  return !!(capSR() || webSR());
}

let activeWeb = null;   // текущата Web-инстанция (за стоп)
let activeCap = null;   // маркер, че върви нативно разпознаване

// Слуша веднъж и връща финалния текст. onPartial(текст) — за живо показване.
// Резолвва '' при отказ/тишина; отхвърля само при твърда грешка.
export async function listen({ locale = 'en-US', onPartial } = {}) {
  const cap = capSR();
  if (cap && typeof cap.start === 'function') {
    try { return await listenCapacitor(cap, locale, onPartial); }
    catch (_) { /* пада към web/ръчно */ }
  }
  const SR = webSR();
  if (SR) return listenWeb(SR, locale, onPartial);
  return '';
}

export function stopListening() {
  try { if (activeWeb) activeWeb.stop(); } catch (_) {}
  const cap = capSR();
  try { if (activeCap && cap && cap.stop) cap.stop(); } catch (_) {}
  activeWeb = null; activeCap = null;
}

function listenWeb(SR, locale, onPartial) {
  return new Promise((resolve) => {
    let finalText = '';
    let done = false;
    const finish = (txt) => { if (done) return; done = true; activeWeb = null; resolve((txt || finalText || '').trim()); };
    try {
      const rec = new SR();
      activeWeb = rec;
      rec.lang = locale;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (onPartial) onPartial((finalText + ' ' + interim).trim());
      };
      rec.onerror = () => finish('');
      rec.onend = () => finish('');
      rec.start();
      // предпазен таймер — макс 20с слушане
      setTimeout(() => { try { rec.stop(); } catch (_) {} }, 20000);
    } catch (_) { finish(''); }
  });
}

// Най-добро усилие за Capacitor плъгина (API варира между версии).
async function listenCapacitor(cap, locale, onPartial) {
  activeCap = true;
  try {
    if (cap.requestPermissions) { try { await cap.requestPermissions(); } catch (_) {} }
    else if (cap.requestPermission) { try { await cap.requestPermission(); } catch (_) {} }

    let partialHandle = null;
    if (onPartial && cap.addListener) {
      try {
        partialHandle = await cap.addListener('partialResults', (d) => {
          const arr = (d && (d.matches || d.value)) || [];
          if (arr && arr.length) onPartial(String(arr[0]));
        });
      } catch (_) {}
    }
    const res = await cap.start({ language: locale, maxResults: 1, partialResults: !!onPartial, popup: false });
    if (partialHandle && partialHandle.remove) { try { await partialHandle.remove(); } catch (_) {} }
    activeCap = null;
    const matches = (res && (res.matches || res.value)) || [];
    return (matches && matches.length ? String(matches[0]) : '').trim();
  } catch (e) {
    activeCap = null;
    throw e;
  }
}
