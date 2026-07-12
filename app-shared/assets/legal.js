// Version: 1.0001
// legal.js — УНИВЕРСАЛЕН правен footer за ВСЯКО приложение (еднакъв файл навсякъде).
// Слага малък постоянен линк „Поверителност" (долу-ляво), който отваря СПЕЦИФИЧНАТА за апа
// хостната политика — Huawei/RuStore искат линк към политиката ДОСТЪПЕН ВЪТРЕ в приложението
// (Huawei правило 7.1), не само в store listing. Линкът стои на всяка страница (footer), значи
// покрива и „минимум на първата страница", и „на всяка страница".
//
// Ако приложението има акаунти (opts.account:true — напр. chat, houselookbook), добавя и линк
// „Изтрий акаунта". ВАЖНО: потребителят НЕ трие акаунта сам (сигурност) — праща ЗАЯВКА до
// администратора през същата анонимна система за доклади; само админ/модератор изпълнява триенето.
//
// Файлът с политиката е специфичен за магазина (инжектира се от add-privacy-link.cjs):
//   Huawei → hw-privacy.html ; RuStore → rustore-privacy.html (newslator: ru-privacy.html).
const PRIVACY_BASE = 'https://selflearning.bot.nu/privacy';
const PRIVACY_FILE = '__PRIVACY_FILE__';           // заменя се при инжектиране (по магазин)
const REPORT_ENDPOINT = 'https://selflearning.bot.nu/api/portals/bug-report/anon';

const L = {
  priv:   { bg:'Поверителност', ru:'Конфиденциальность', uk:'Конфіденційність', en:'Privacy', de:'Datenschutz', fr:'Confidentialité', es:'Privacidad', 'es-MX':'Privacidad', it:'Privacy', pt:'Privacidade', ar:'الخصوصية', hi:'गोपनीयता', ja:'プライバシー', ky:'Купуялык', 'zh-Hant':'私隱' },
  del:    { bg:'Изтрий акаунта', ru:'Удалить аккаунт', uk:'Видалити акаунт', en:'Delete account', de:'Konto löschen', fr:'Supprimer le compte', es:'Eliminar cuenta', 'es-MX':'Eliminar cuenta', it:'Elimina account', pt:'Eliminar conta', ar:'حذف الحساب', hi:'खाता हटाएं', ja:'アカウント削除', ky:'Аккаунтту өчүрүү', 'zh-Hant':'刪除帳戶' },
  dtitle: { bg:'Заявка за изтриване на акаунт', ru:'Запрос на удаление аккаунта', uk:'Запит на видалення акаунта', en:'Account deletion request', de:'Antrag auf Kontolöschung', fr:'Demande de suppression de compte', es:'Solicitud de eliminación de cuenta', 'es-MX':'Solicitud de eliminación de cuenta', it:'Richiesta di eliminazione account', pt:'Pedido de eliminação de conta', ar:'طلب حذف الحساب', hi:'खाता हटाने का अनुरोध', ja:'アカウント削除リクエスト', ky:'Аккаунтту өчүрүү өтүнүчү', 'zh-Hant':'刪除帳戶請求' },
  ddesc:  { bg:'От съображения за сигурност акаунтите се изтриват само от администратор. Изпрати заявка (по избор посочи потребителско име/имейл) и екипът ще я обработи.', ru:'В целях безопасности аккаунты удаляет только администратор. Отправьте запрос (по желанию укажите имя пользователя/эл. почту), и команда его обработает.', uk:'З міркувань безпеки акаунти видаляє лише адміністратор. Надішліть запит (за бажанням вкажіть імʼя користувача/пошту), і команда його обробить.', en:'For security, accounts are deleted only by an administrator. Send a request (optionally include your username/email) and the team will process it.', de:'Aus Sicherheitsgründen werden Konten nur von einem Administrator gelöscht. Sende eine Anfrage (optional mit Benutzername/E-Mail) und das Team bearbeitet sie.', fr:'Pour des raisons de sécurité, les comptes ne sont supprimés que par un administrateur. Envoie une demande (nom d’utilisateur/e-mail en option) et l’équipe la traitera.', es:'Por seguridad, las cuentas solo las elimina un administrador. Envía una solicitud (opcionalmente con tu usuario/correo) y el equipo la procesará.', 'es-MX':'Por seguridad, las cuentas solo las elimina un administrador. Envía una solicitud (opcionalmente con tu usuario/correo) y el equipo la procesará.', it:'Per sicurezza, gli account vengono eliminati solo da un amministratore. Invia una richiesta (facoltativo: nome utente/email) e il team la elaborerà.', pt:'Por segurança, as contas só são eliminadas por um administrador. Envia um pedido (opcionalmente com o teu utilizador/email) e a equipa tratará dele.', ar:'لأسباب أمنية، لا يحذف الحسابات سوى المسؤول. أرسل طلبًا (اختياريًا مع اسم المستخدم/البريد) وسيقوم الفريق بمعالجته.', hi:'सुरक्षा के लिए, खाते केवल व्यवस्थापक द्वारा हटाए जाते हैं। अनुरोध भेजें (वैकल्पिक रूप से उपयोगकर्ता नाम/ईमेल दें) और टीम इसे संसाधित करेगी।', ja:'セキュリティのため、アカウントは管理者のみが削除します。リクエストを送信してください（任意でユーザー名/メール）。チームが対応します。', ky:'Коопсуздук үчүн аккаунттарды администратор гана өчүрөт. Өтүнүч жөнөт (каалоо боюнча колдонуучу аты/почта) жана команда аны иштетет.', 'zh-Hant':'基於安全，帳戶僅由管理員刪除。請發送請求（可選填使用者名稱/電郵），團隊將處理。' },
  dph:    { bg:'По избор: потребителско име/имейл + причина…', ru:'По желанию: имя пользователя/эл. почта + причина…', uk:'За бажанням: імʼя користувача/пошта + причина…', en:'Optional: username/email + reason…', de:'Optional: Benutzername/E-Mail + Grund…', fr:'Optionnel : nom d’utilisateur/e-mail + raison…', es:'Opcional: usuario/correo + motivo…', 'es-MX':'Opcional: usuario/correo + motivo…', it:'Facoltativo: nome utente/email + motivo…', pt:'Opcional: utilizador/email + motivo…', ar:'اختياري: اسم المستخدم/البريد + السبب…', hi:'वैकल्पिक: उपयोगकर्ता नाम/ईमेल + कारण…', ja:'任意: ユーザー名/メール + 理由…', ky:'Каалоо боюнча: колдонуучу аты/почта + себеп…', 'zh-Hant':'可選：使用者名稱/電郵＋原因…' },
  send:   { bg:'Изпрати заявка', ru:'Отправить запрос', uk:'Надіслати запит', en:'Send request', de:'Anfrage senden', fr:'Envoyer la demande', es:'Enviar solicitud', 'es-MX':'Enviar solicitud', it:'Invia richiesta', pt:'Enviar pedido', ar:'إرسال الطلب', hi:'अनुरोध भेजें', ja:'リクエスト送信', ky:'Өтүнүч жөнөтүү', 'zh-Hant':'送出請求' },
  cancel: { bg:'Отказ', ru:'Отмена', uk:'Скасувати', en:'Cancel', de:'Abbrechen', fr:'Annuler', es:'Cancelar', 'es-MX':'Cancelar', it:'Annulla', pt:'Cancelar', ar:'إلغاء', hi:'रद्द करें', ja:'キャンセル', ky:'Жокко чыгаруу', 'zh-Hant':'取消' },
  thanks: { bg:'Заявката е изпратена. Ще я обработим.', ru:'Запрос отправлен. Мы его обработаем.', uk:'Запит надіслано. Ми його обробимо.', en:'Request sent. We will process it.', de:'Anfrage gesendet. Wir bearbeiten sie.', fr:'Demande envoyée. Nous la traiterons.', es:'Solicitud enviada. La procesaremos.', 'es-MX':'Solicitud enviada. La procesaremos.', it:'Richiesta inviata. La elaboreremo.', pt:'Pedido enviado. Iremos tratá-lo.', ar:'تم إرسال الطلب. سنقوم بمعالجته.', hi:'अनुरोध भेजा गया। हम इसे संसाधित करेंगे।', ja:'リクエストを送信しました。対応します。', ky:'Өтүнүч жөнөтүлдү. Иштетебиз.', 'zh-Hant':'請求已送出，我們會處理。' },
  err:    { bg:'Грешка. Опитай пак.', ru:'Ошибка. Попробуй снова.', uk:'Помилка. Спробуй ще раз.', en:'Error. Try again.', de:'Fehler. Erneut versuchen.', fr:'Erreur. Réessaie.', es:'Error. Inténtalo de nuevo.', 'es-MX':'Error. Inténtalo de nuevo.', it:'Errore. Riprova.', pt:'Erro. Tenta de novo.', ar:'خطأ. حاول مرة أخرى.', hi:'त्रुटि। पुनः प्रयास करें।', ja:'エラー。もう一度お試しください。', ky:'Ката. Кайра аракет кыл.', 'zh-Hant':'錯誤，請再試一次。' }
};
function lang() {
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /\.lang$/.test(k)) { const v = localStorage.getItem(k); if (v && L.priv[v]) return v; } } } catch (e) {}
  try { const h = document.documentElement.getAttribute('lang'); if (h && L.priv[h]) return h; } catch (e) {}
  return 'en';
}
function tr(k) { const m = L[k] || {}; return m[lang()] || m.en || m.bg || k; }

async function postReport(app, body) {
  const payload = { app: app, title: 'ACCOUNT_DELETION_REQUEST', body: body };
  try {
    const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
    if (CH && CH.post) { const r = await CH.post({ url: REPORT_ENDPOINT, headers: { 'Content-Type': 'application/json' }, data: payload }); return r && r.status >= 200 && r.status < 300; }
  } catch (e) {}
  try { const r = await fetch(REPORT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return r.ok; } catch (e) { return false; }
}

function openDeleteModal(app) {
  if (document.getElementById('kcy-del-ov')) return;
  const ov = document.createElement('div'); ov.id = 'kcy-del-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483011;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:360px;width:100%;background:#141a24;color:#e6edf3;border-radius:14px;padding:16px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif';
  const h = document.createElement('div'); h.textContent = tr('dtitle'); h.style.cssText = 'font-weight:600;margin-bottom:8px';
  const p = document.createElement('div'); p.textContent = tr('ddesc'); p.style.cssText = 'font-size:13px;color:#9aa7b4;margin-bottom:10px';
  const ta = document.createElement('textarea'); ta.placeholder = tr('dph');
  ta.style.cssText = 'width:100%;height:90px;box-sizing:border-box;background:#0d1117;color:#e6edf3;border:1px solid #2a3550;border-radius:10px;padding:10px;font:14px system-ui;resize:none';
  const msg = document.createElement('div'); msg.style.cssText = 'min-height:18px;font-size:13px;margin-top:8px';
  const cancel = document.createElement('button'); cancel.textContent = tr('cancel');
  cancel.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#30363d;color:#cdd;font:600 14px system-ui';
  cancel.onclick = () => ov.remove();
  const send = document.createElement('button'); send.textContent = tr('send');
  send.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#d9534f;color:#fff;font:600 14px system-ui';
  send.onclick = async () => {
    send.disabled = true; msg.style.color = '#8b949e'; msg.textContent = '…';
    const okr = await postReport(app, 'ЗАЯВКА ЗА ИЗТРИВАНЕ НА АКАУНТ. Детайли: ' + (ta.value.trim() || '(без)'));
    if (okr) { msg.style.color = '#3fb950'; msg.textContent = tr('thanks'); setTimeout(() => ov.remove(), 1600); }
    else { send.disabled = false; msg.style.color = '#f85149'; msg.textContent = tr('err'); }
  };
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:12px'; row.append(cancel, send);
  box.append(h, p, ta, msg, row); ov.appendChild(box); document.body.appendChild(ov); ta.focus();
}

export function mountPrivacyLink(appId, opts) {
  const app = appId || 'unknown';
  const account = !!(opts && opts.account);
  const url = `${PRIVACY_BASE}/${app}/${PRIVACY_FILE}`;
  function add() {
    if (!document.body || document.getElementById('kcy-legal-bar')) return;
    const bar = document.createElement('div'); bar.id = 'kcy-legal-bar';
    // Долу-ДЯСНО, НАД бутона „Помощ" (който е на bottom:12) — за да НЕ се блъска с балончето
    // „✨ KCY" (долу-ляво) и да не закрива важни бутони. Ненатрапчиво, малко.
    bar.style.cssText = 'position:fixed;right:12px;bottom:58px;z-index:2147483000;display:flex;flex-direction:column;gap:6px;align-items:flex-end;pointer-events:none';
    // линк към политиката (винаги)
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    const relabelP = () => { a.textContent = '🔒 ' + tr('priv'); };
    relabelP();
    a.style.cssText = 'pointer-events:auto;background:rgba(20,26,36,.72);color:#cdd6e0;text-decoration:none;border-radius:14px;padding:5px 10px;font:600 12px system-ui,Segoe UI,Roboto,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    a.onclick = (e) => { try { e.preventDefault(); window.open(url, '_blank'); } catch (_) { location.href = url; } };
    bar.appendChild(a);
    // по избор: заявка за изтриване на акаунт (само за апове с акаунти)
    let relabelD = () => {};
    if (account) {
      const d = document.createElement('button');
      relabelD = () => { d.textContent = '🗑️ ' + tr('del'); };
      relabelD();
      d.style.cssText = 'pointer-events:auto;background:rgba(90,20,26,.72);color:#f2c9c9;border:none;border-radius:14px;padding:5px 10px;font:600 12px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer';
      d.onclick = () => openDeleteModal(app);
      bar.appendChild(d);
    }
    document.body.appendChild(bar);
    try { new MutationObserver(() => { relabelP(); relabelD(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); } catch (e) {}
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
}
