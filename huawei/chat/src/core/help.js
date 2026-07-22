// Version: 1.0018
// help.js — УНИВЕРСАЛЕН бутон „Обратна връзка" за ВСЯКО приложение (еднакъв файл навсякъде).
// Бутонът вече живее в ЕДИННАТА долна лента (core/kcy-bar.js) → модал → праща АНОНИМЕН доклад
// към порталната таблица (portal_bug_reports) през /api/portals/bug-report/anon. Без вход.
// Полета: От кого / Телефон-имейл / Заглавие (едноредови) + Съобщение (многоредово). Заглавието
// става „относно" в имейла; От кого + контакт се добавят пред текста на съобщението.
// Полето `app` (подава се на mountHelp) казва от кое приложение идва грешката. На телефон ползва
// CapacitorHttp (заобикаля CORS); в браузър — fetch. БЕЗ AbortController (чупи CapacitorHttp —
// виж net.js бележките).
import { kcyBarButton } from './kcy-bar.js';

const ENDPOINT = 'https://selflearning.bot.nu/api/portals/bug-report/anon';

// Кратки етикети на 15-те езика (fallback → en). Езикът се чете от <html lang> на приложението.
const L = {
  btn:    { bg:'Обратна връзка', ru:'Обратная связь', uk:'Відгук', en:'Feedback', de:'Feedback', fr:'Commentaires', es:'Comentarios', 'es-MX':'Comentarios', it:'Feedback', pt:'Feedback', ar:'ملاحظات', hi:'प्रतिक्रिया', ja:'フィードバック', ky:'Пикир', 'zh-Hant':'意見回饋' },
  title:  { bg:'Изпрати ни съобщение', ru:'Напишите нам', uk:'Напишіть нам', en:'Send us a message', de:'Schreib uns', fr:'Écris-nous', es:'Envíanos un mensaje', 'es-MX':'Envíanos un mensaje', it:'Scrivici', pt:'Envia-nos uma mensagem', ar:'أرسل لنا رسالة', hi:'हमें संदेश भेजें', ja:'メッセージを送る', ky:'Бизге жазыңыз', 'zh-Hant':'傳訊息給我們' },
  from:   { bg:'От кого (име)', ru:'От кого (имя)', uk:'Від кого (ім’я)', en:'From (name)', de:'Von wem (Name)', fr:'De la part de (nom)', es:'De (nombre)', 'es-MX':'De (nombre)', it:'Da (nome)', pt:'De (nome)', ar:'من (الاسم)', hi:'किससे (नाम)', ja:'お名前', ky:'Кимден (аты)', 'zh-Hant':'來自（姓名）' },
  contact:{ bg:'Телефон или имейл', ru:'Телефон или эл. почта', uk:'Телефон або e-mail', en:'Phone or email', de:'Telefon oder E-Mail', fr:'Téléphone ou e-mail', es:'Teléfono o correo', 'es-MX':'Teléfono o correo', it:'Telefono o email', pt:'Telefone ou e-mail', ar:'الهاتف أو البريد الإلكتروني', hi:'फ़ोन या ईमेल', ja:'電話またはメール', ky:'Телефон же электрондук почта', 'zh-Hant':'電話或電子郵件' },
  subject:{ bg:'Заглавие', ru:'Заголовок', uk:'Заголовок', en:'Subject', de:'Betreff', fr:'Objet', es:'Asunto', 'es-MX':'Asunto', it:'Oggetto', pt:'Assunto', ar:'الموضوع', hi:'विषय', ja:'件名', ky:'Тема', 'zh-Hant':'主旨' },
  ph:     { bg:'Опиши проблема или въпроса…', ru:'Опиши проблему или вопрос…', uk:'Опиши проблему або питання…', en:'Describe the problem or question…', de:'Beschreibe das Problem oder die Frage…', fr:'Décris le problème ou la question…', es:'Describe el problema o la pregunta…', 'es-MX':'Describe el problema o la pregunta…', it:'Descrivi il problema o la domanda…', pt:'Descreve o problema ou a pergunta…', ar:'صف المشكلة أو السؤال…', hi:'समस्या या प्रश्न बताएं…', ja:'問題や質問を書いてください…', ky:'Маселени же суроону жазыңыз…', 'zh-Hant':'描述問題或提問…' },
  send:   { bg:'Изпрати', ru:'Отправить', uk:'Надіслати', en:'Send', de:'Senden', fr:'Envoyer', es:'Enviar', 'es-MX':'Enviar', it:'Invia', pt:'Enviar', ar:'إرسال', hi:'भेजें', ja:'送信', ky:'Жөнөтүү', 'zh-Hant':'傳送' },
  cancel: { bg:'Отказ', ru:'Отмена', uk:'Скасувати', en:'Cancel', de:'Abbrechen', fr:'Annuler', es:'Cancelar', 'es-MX':'Cancelar', it:'Annulla', pt:'Cancelar', ar:'إلغاء', hi:'रद्द करें', ja:'キャンセル', ky:'Жокко чыгаруу', 'zh-Hant':'取消' },
  thanks: { bg:'Благодарим! Изпратено.', ru:'Спасибо! Отправлено.', uk:'Дякуємо! Надіслано.', en:'Thanks! Sent.', de:'Danke! Gesendet.', fr:'Merci ! Envoyé.', es:'¡Gracias! Enviado.', 'es-MX':'¡Gracias! Enviado.', it:'Grazie! Inviato.', pt:'Obrigado! Enviado.', ar:'شكرًا! تم الإرسال.', hi:'धन्यवाद! भेजा गया।', ja:'ありがとう！送信しました。', ky:'Рахмат! Жөнөтүлдү.', 'zh-Hant':'謝謝！已送出。' },
  err:    { bg:'Грешка. Опитай пак.', ru:'Ошибка. Попробуй снова.', uk:'Помилка. Спробуй ще раз.', en:'Error. Try again.', de:'Fehler. Erneut versuchen.', fr:'Erreur. Réessaie.', es:'Error. Inténtalo de nuevo.', 'es-MX':'Error. Inténtalo de nuevo.', it:'Errore. Riprova.', pt:'Erro. Tenta de novo.', ar:'خطأ. حاول مرة أخرى.', hi:'त्रुटि। फिर से प्रयास करें।', ja:'エラー。もう一度お試しください。', ky:'Ката. Кайра аракет кыл.', 'zh-Hant':'錯誤，請再試一次。' }
};
// Надеждно откриване на езика: 1) ключа „<апп>.lang" от localStorage (ИСТИНСКИЯТ избор на
// потребителя — приоритет, защото някои апове оставят <html lang> на default); 2) <html lang>; 3) en.
function lang() {
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /\.lang$/.test(k)) { const v = localStorage.getItem(k); if (v && L.btn[v]) return v; } } } catch (e) {}
  try { const h = document.documentElement.getAttribute('lang'); if (h && L.btn[h]) return h; } catch (e) {}
  return 'en';
}
function tr(k) { const m = L[k] || {}; return m[lang()] || m.en || m.bg || k; }

async function post(app, data) {
  let appName = '';
  try { appName = (document.title || '').trim(); } catch (e) {}
  const payload = {
    app: app,
    appName: appName,          // ЦЯЛОТО име на приложението (от <title>) — водещо в имейла
    lang: lang(),              // избраният език (код) — показва се в имейла
    name: (data && data.name) || '',
    contact: (data && data.contact) || '',
    title: (data && data.title) || '',
    body: (data && data.body) || ''
  };
  try {
    const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
    if (CH && CH.post) {
      const r = await CH.post({ url: ENDPOINT, headers: { 'Content-Type': 'application/json' }, data: payload });
      return r && r.status >= 200 && r.status < 300;
    }
  } catch (e) { /* пробвай fetch */ }
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return r.ok;
  } catch (e) { return false; }
}

export function mountHelp(appId) {
  const app = appId || 'unknown';
  function openModal() {
    if (document.getElementById('kcy-help-ov')) return;
    const ov = document.createElement('div'); ov.id = 'kcy-help-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px';
    const box = document.createElement('div');
    box.style.cssText = 'max-width:360px;width:100%;background:#141a24;color:#e6edf3;border-radius:14px;padding:16px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif';
    const h = document.createElement('div'); h.textContent = tr('title'); h.style.cssText = 'font-weight:600;margin-bottom:10px';
    // Едноредови полета: От кого / Телефон-имейл / Заглавие
    const inputCss = 'width:100%;box-sizing:border-box;background:#0d1117;color:#e6edf3;border:1px solid #2a3550;border-radius:10px;padding:10px;font:14px system-ui;margin-bottom:8px';
    const mkInput = (ph) => { const i = document.createElement('input'); i.type = 'text'; i.placeholder = ph; i.style.cssText = inputCss; return i; };
    const inFrom = mkInput(tr('from'));
    const inContact = mkInput(tr('contact'));
    const inSubject = mkInput(tr('subject'));
    // Многоредово поле: съобщение
    const ta = document.createElement('textarea'); ta.placeholder = tr('ph');
    ta.style.cssText = 'width:100%;height:110px;box-sizing:border-box;background:#0d1117;color:#e6edf3;border:1px solid #2a3550;border-radius:10px;padding:10px;font:14px system-ui;resize:none';
    const msg = document.createElement('div'); msg.style.cssText = 'min-height:18px;font-size:13px;margin-top:8px';
    const cancel = document.createElement('button'); cancel.textContent = tr('cancel');
    cancel.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#30363d;color:#cdd;font:600 14px system-ui';
    cancel.onclick = () => ov.remove();
    const send = document.createElement('button'); send.textContent = tr('send');
    send.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#2ea043;color:#fff;font:600 14px system-ui';
    send.onclick = async () => {
      const v = ta.value.trim(); if (!v) { ta.focus(); return; }
      send.disabled = true; msg.style.color = '#8b949e'; msg.textContent = '…';
      const okr = await post(app, { name: inFrom.value.trim(), contact: inContact.value.trim(), title: inSubject.value.trim(), body: v });
      if (okr) { msg.style.color = '#3fb950'; msg.textContent = tr('thanks'); setTimeout(() => ov.remove(), 1300); }
      else { send.disabled = false; msg.style.color = '#f85149'; msg.textContent = tr('err'); }
    };
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:12px'; row.append(cancel, send);
    box.append(h, inFrom, inContact, inSubject, ta, msg, row); ov.appendChild(box); document.body.appendChild(ov); inFrom.focus();
  }
  kcyBarButton({ id: 'kcy-help-btn', order: 20, label: () => '💬 ' + tr('btn'), onClick: openModal });
}
