// Version: 1.0014
// legal-gate.js — УНИВЕРСАЛЕН „ЕКРАН 3" (стандарт за ВСИЧКИ апове/билдове):
//   Екран 1 = Pupikes интро (intro.js) · Екран 2 = избор на език · ЕКРАН 3 = ТУК:
//   задължителните предупреждения/обяснения/политики, изисквани от Huawei/RuStore, ПРЕДИ апа.
//
// Работи като overlay НАД приложението (не пипа рутера на всеки апп). Показва се СЛЕД като е избран
// език (за да е на разбираемия за потребителя език) и само ВЕДНЪЖ (пази флаг). Изисква ИЗРИЧНО
// приемане, преди да пусне апа. Per-store: сочи hw-* или rustore-* документите (инжектира се).
//
// opts.finance:true → добавя ЗАДЪЛЖИТЕЛНИЯ финансов disclaimer (крипто/финанси апове).
const BASE = 'https://selflearning.bot.nu/privacy';
const PRIVACY_FILE = 'rustore-privacy.html';   // заменя се по магазин при инжектиране
const TERMS_FILE = 'rustore-terms.html';       // заменя се по магазин при инжектиране

const L = {
  title:   { bg:'Преди да започнеш', ru:'Прежде чем начать', uk:'Перш ніж почати', en:'Before you start', de:'Bevor du beginnst', fr:'Avant de commencer', es:'Antes de empezar', 'es-MX':'Antes de empezar', it:'Prima di iniziare', pt:'Antes de começar', ar:'قبل أن تبدأ', hi:'शुरू करने से पहले', ja:'始める前に', ky:'Баштоодон мурун', 'zh-Hant':'開始之前' },
  intro:   { bg:'Този производител е Pupikes. Моля, прегледай нашите правила по-долу. Като продължиш, приемаш Политиката за поверителност и Общите условия.', ru:'Издатель — Pupikes. Пожалуйста, ознакомьтесь с правилами ниже. Продолжая, вы принимаете Политику конфиденциальности и Условия использования.', uk:'Видавець — Pupikes. Перегляньте правила нижче. Продовжуючи, ви приймаєте Політику конфіденційності та Умови використання.', en:'This publisher is Pupikes. Please review our terms below. By continuing, you accept the Privacy Policy and the Terms & Conditions.', de:'Herausgeber ist Pupikes. Bitte lies unsere Bedingungen unten. Wenn du fortfährst, akzeptierst du die Datenschutzerklärung und die Nutzungsbedingungen.', fr:'L’éditeur est Pupikes. Consulte nos conditions ci-dessous. En continuant, tu acceptes la Politique de confidentialité et les Conditions générales.', es:'El editor es Pupikes. Revisa nuestros términos abajo. Al continuar, aceptas la Política de privacidad y los Términos y condiciones.', 'es-MX':'El editor es Pupikes. Revisa nuestros términos abajo. Al continuar, aceptas la Política de privacidad y los Términos y condiciones.', it:'L’editore è Pupikes. Consulta i termini qui sotto. Continuando, accetti l’Informativa sulla privacy e i Termini e condizioni.', pt:'A editora é Pupikes. Reveja os nossos termos abaixo. Ao continuar, aceita a Política de Privacidade e os Termos e Condições.', ar:'الناشر هو Pupikes. يرجى مراجعة الشروط أدناه. بالمتابعة فإنك تقبل سياسة الخصوصية والشروط والأحكام.', hi:'प्रकाशक Pupikes है। कृपया नीचे हमारी शर्तें देखें। जारी रखने पर आप गोपनीयता नीति और नियम व शर्तें स्वीकार करते हैं।', ja:'発行者は Pupikes です。以下の規約をご確認ください。続行すると、プライバシーポリシーおよび利用規約に同意したことになります。', ky:'Басып чыгаруучу — Pupikes. Төмөндөгү шарттарды карап чык. Улантуу менен сен Купуялык саясатын жана Колдонуу шарттарын кабыл аласың.', 'zh-Hant':'發行者為 Pupikes。請檢視下方條款。繼續即表示你接受私隱政策與條款細則。' },
  privacy: { bg:'Политика за поверителност', ru:'Политика конфиденциальности', uk:'Політика конфіденційності', en:'Privacy Policy', de:'Datenschutzerklärung', fr:'Politique de confidentialité', es:'Política de privacidad', 'es-MX':'Política de privacidad', it:'Informativa sulla privacy', pt:'Política de Privacidade', ar:'سياسة الخصوصية', hi:'गोपनीयता नीति', ja:'プライバシーポリシー', ky:'Купуялык саясаты', 'zh-Hant':'私隱政策' },
  terms:   { bg:'Общи условия', ru:'Условия использования', uk:'Умови використання', en:'Terms & Conditions', de:'Nutzungsbedingungen', fr:'Conditions générales', es:'Términos y condiciones', 'es-MX':'Términos y condiciones', it:'Termini e condizioni', pt:'Termos e Condições', ar:'الشروط والأحكام', hi:'नियम एवं शर्तें', ja:'利用規約', ky:'Колдонуу шарттары', 'zh-Hant':'條款與細則' },
  agree:   { bg:'Разбрах и съм съгласен', ru:'Я понял и согласен', uk:'Я зрозумів і згоден', en:'I have read and I agree', de:'Ich habe gelesen und stimme zu', fr:'J’ai lu et j’accepte', es:'He leído y estoy de acuerdo', 'es-MX':'He leído y estoy de acuerdo', it:'Ho letto e accetto', pt:'Li e concordo', ar:'قرأت وأوافق', hi:'मैंने पढ़ा और सहमत हूँ', ja:'読みました。同意します', ky:'Окудум жана макулмун', 'zh-Hant':'我已閱讀並同意' },
  cont:    { bg:'Продължи', ru:'Продолжить', uk:'Продовжити', en:'Continue', de:'Weiter', fr:'Continuer', es:'Continuar', 'es-MX':'Continuar', it:'Continua', pt:'Continuar', ar:'متابعة', hi:'जारी रखें', ja:'続ける', ky:'Улантуу', 'zh-Hant':'繼續' }
};
// ЗАДЪЛЖИТЕЛЕН финансов disclaimer (само за opts.finance:true).
const FIN = {
  bg:'⚠️ Само с ОБРАЗОВАТЕЛНА цел — НЕ Е ИНВЕСТИЦИОНЕН СЪВЕТ. Приложението показва изводи от публични финансови данни и индикатори. Пазарите са рискови и могат да направят ТОЧНО ОБРАТНОТО на всеки индикатор. Ти носиш пълната отговорност за решенията си; миналите резултати не гарантират бъдещи.',
  ru:'⚠️ Только в ОБРАЗОВАТЕЛЬНЫХ целях — НЕ ИНВЕСТИЦИОННЫЙ СОВЕТ. Приложение показывает выводы из публичных финансовых данных и индикаторов. Рынки рискованны и могут сделать ПРЯМО ПРОТИВОПОЛОЖНОЕ. Вся ответственность на вас; прошлые результаты не гарантируют будущих.',
  uk:'⚠️ Лише з ОСВІТНЬОЮ метою — НЕ ІНВЕСТИЦІЙНА ПОРАДА. Застосунок показує висновки з публічних фінансових даних. Ринки ризиковані й можуть зробити ПРЯМО ПРОТИЛЕЖНЕ. Уся відповідальність на вас; минуле не гарантує майбутнього.',
  en:'⚠️ EDUCATIONAL ONLY — NOT INVESTMENT ADVICE. The app shows conclusions from public financial data and indicators. Markets are risky and can do the EXACT OPPOSITE of any indicator. You are solely responsible for your decisions; past performance does not guarantee future results.',
  de:'⚠️ NUR ZU BILDUNGSZWECKEN — KEINE ANLAGEBERATUNG. Die App zeigt Schlussfolgerungen aus öffentlichen Finanzdaten. Märkte sind riskant und können GENAU DAS GEGENTEIL tun. Du bist allein verantwortlich; vergangene Ergebnisse garantieren keine künftigen.',
  fr:'⚠️ À BUT ÉDUCATIF UNIQUEMENT — PAS UN CONSEIL EN INVESTISSEMENT. L’app montre des conclusions issues de données financières publiques. Les marchés sont risqués et peuvent faire EXACTEMENT L’INVERSE. Tu es seul responsable ; le passé ne garantit pas l’avenir.',
  es:'⚠️ SOLO EDUCATIVO — NO ES ASESORAMIENTO DE INVERSIÓN. La app muestra conclusiones de datos financieros públicos. Los mercados son arriesgados y pueden hacer EXACTAMENTE LO CONTRARIO. Eres el único responsable; el pasado no garantiza el futuro.',
  'es-MX':'⚠️ SOLO EDUCATIVO — NO ES ASESORÍA DE INVERSIÓN. La app muestra conclusiones de datos financieros públicos. Los mercados son riesgosos y pueden hacer EXACTAMENTE LO CONTRARIO. Eres el único responsable; el pasado no garantiza el futuro.',
  it:'⚠️ SOLO EDUCATIVO — NON È UN CONSIGLIO DI INVESTIMENTO. L’app mostra conclusioni da dati finanziari pubblici. I mercati sono rischiosi e possono fare ESATTAMENTE L’OPPOSTO. Sei l’unico responsabile; il passato non garantisce il futuro.',
  pt:'⚠️ APENAS EDUCATIVO — NÃO É ACONSELHAMENTO DE INVESTIMENTO. O app mostra conclusões de dados financeiros públicos. Os mercados são arriscados e podem fazer EXATAMENTE O CONTRÁRIO. Você é o único responsável; o passado não garante o futuro.',
  ar:'⚠️ لأغراض تعليمية فقط — ليست نصيحة استثمارية. يعرض التطبيق استنتاجات من بيانات مالية عامة. الأسواق محفوفة بالمخاطر وقد تفعل العكس تمامًا. أنت وحدك المسؤول؛ الأداء السابق لا يضمن المستقبل.',
  hi:'⚠️ केवल शैक्षिक — निवेश सलाह नहीं। ऐप सार्वजनिक वित्तीय डेटा से निष्कर्ष दिखाता है। बाज़ार जोखिमपूर्ण हैं और बिल्कुल उल्टा कर सकते हैं। केवल आप ज़िम्मेदार हैं; अतीत भविष्य की गारंटी नहीं।',
  ja:'⚠️ 教育目的のみ — 投資助言ではありません。公開財務データから得た結論を表示します。市場はリスクがあり、正反対に動くことがあります。責任はすべてあなたにあり、過去は将来を保証しません。',
  ky:'⚠️ БИЛИМ ҮЧҮН ГАНА — ИНВЕСТИЦИЯЛЫК КЕҢЕШ ЭМЕС. Колдонмо ачык каржы маалыматтарынан жыйынтык көрсөтөт. Рынок тобокелдүү жана так тескерисин жасашы мүмкүн. Жоопкерчилик өзүңдө; өткөн келечекти кепилдебейт.',
  'zh-Hant':'⚠️ 僅供教育 — 非投資建議。應用顯示公開財務數據的結論。市場有風險，可能完全相反。你負全部責任；過往不保證未來。'
};
function lang() {
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /\.lang$/.test(k)) { const v = localStorage.getItem(k); if (v && L.title[v]) return v; } } } catch (e) {}
  try { const h = document.documentElement.getAttribute('lang'); if (h && L.title[h]) return h; } catch (e) {}
  return 'en';
}
function tr(k) { const m = L[k] || {}; return m[lang()] || m.en || m.bg || k; }
function openDoc(file) {
  const url = BASE + '/' + (window.__KCY_APP__ || 'app') + '/' + file;
  try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url }); return; } } catch (e) {}
  try { window.open(url, '_blank'); } catch (e) { try { location.href = url; } catch (e2) {} }
}

export function mountLegalGate(appId, opts) {
  const app = appId || 'unknown';
  const finance = !!(opts && opts.finance);
  const hasLang = !opts || opts.hasLang !== false;   // има ли апът екран за избор на език (екран 2)
  try { window.__KCY_APP__ = app; } catch (e) {}
  const KEY = 'kcy.legal.' + app + '.v1';
  try { if (localStorage.getItem(KEY)) return; } catch (e) {}
  let shown = false;

  function langChosen() {
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /\.lang$/.test(k) && localStorage.getItem(k)) return true; } } catch (e) {}
    return false;
  }
  function build() {
    if (shown || !document.body || document.getElementById('kcy-legal-gate')) return;
    shown = true;
    const lg = lang();
    const ov = document.createElement('div'); ov.id = 'kcy-legal-gate';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483350;background:#0b1220;color:#e6edf3;font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column;overflow:auto;' + (lg === 'ar' ? 'direction:rtl;' : '');
    const finBlock = finance
      ? '<div style="background:#3a1720;border:1px solid #6b2531;border-radius:12px;padding:12px;margin:12px 0;font-size:13px;line-height:1.5;color:#ffd7dd">' + (FIN[lg] || FIN.en) + '</div>'
      : '';
    ov.innerHTML =
      '<div style="max-width:520px;width:100%;margin:0 auto;padding:22px 18px 26px;box-sizing:border-box">' +
        '<div style="text-align:center;font-weight:800;font-size:18px;background:linear-gradient(90deg,#4a9eff,#8bd450);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:4px">Pupikes</div>' +
        '<h2 style="text-align:center;margin:6px 0 12px;font-size:20px">' + tr('title') + '</h2>' +
        '<p style="font-size:14px;line-height:1.55;color:#c7d2de">' + tr('intro') + '</p>' +
        finBlock +
        '<div style="display:flex;flex-direction:column;gap:10px;margin:14px 0 18px">' +
          '<button id="kcy-lg-priv" style="text-align:' + (lg === 'ar' ? 'right' : 'left') + ';padding:13px 14px;background:#141c2b;border:1px solid #26324a;border-radius:12px;color:#cfe0ff;font:600 14px system-ui;cursor:pointer">' + tr('privacy') + ' ›</button>' +
          '<button id="kcy-lg-terms" style="text-align:' + (lg === 'ar' ? 'right' : 'left') + ';padding:13px 14px;background:#141c2b;border:1px solid #26324a;border-radius:12px;color:#cfe0ff;font:600 14px system-ui;cursor:pointer">' + tr('terms') + ' ›</button>' +
        '</div>' +
        '<label id="kcy-lg-agree-row" style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:#0f1626;border:1px solid #26324a;border-radius:12px;cursor:pointer;margin-bottom:12px">' +
          '<input id="kcy-lg-chk" type="checkbox" style="width:20px;height:20px;margin-top:1px;flex-shrink:0">' +
          '<span style="font-size:14px;font-weight:600;color:#e6edf3">' + tr('agree') + '</span>' +
        '</label>' +
        '<button id="kcy-lg-accept" disabled style="width:100%;padding:15px;border:none;border-radius:12px;background:#2b3444;color:#8b98a8;font:800 16px system-ui;cursor:not-allowed;opacity:.7">' + tr('cont') + '</button>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('kcy-lg-priv').onclick = () => openDoc(PRIVACY_FILE);
    document.getElementById('kcy-lg-terms').onclick = () => openDoc(TERMS_FILE);
    const chk = document.getElementById('kcy-lg-chk');
    const btn = document.getElementById('kcy-lg-accept');
    // Бутонът „Продължи" е активен САМО след като отметката е сложена.
    chk.addEventListener('change', () => {
      if (chk.checked) { btn.disabled = false; btn.style.background = '#2ea043'; btn.style.color = '#fff'; btn.style.cursor = 'pointer'; btn.style.opacity = '1'; }
      else { btn.disabled = true; btn.style.background = '#2b3444'; btn.style.color = '#8b98a8'; btn.style.cursor = 'not-allowed'; btn.style.opacity = '.7'; }
    });
    btn.onclick = () => {
      if (!chk.checked) return;
      try { localStorage.setItem(KEY, new Date().toISOString()); } catch (e) {}
      try { ov.remove(); } catch (e) {}
    };
  }

  // РЕД НА ЕКРАНИТЕ (изрично изискване): 1) интрото с логото Pupikes (като начало
  // на филм) → 2) избор на език (ако апът има такъв екран) → 3) ТОЗИ екран с условията.
  // Затова НЕ разчитаме на слепи таймери: чакаме слоят на интрото (#kcy-intro) да си е
  // ЗАМИНАЛ (то върви ~1.8с при всяко пускане) и — при апове с езиков екран — езикът да е
  // избран. Минимум ~2.1с изчакване покрива и късно монтирано интро. Предпазител ~120с.
  function ready() {
    try { if (document.getElementById('kcy-intro')) return false; } catch (e) {}
    return hasLang ? langChosen() : true;
  }
  let ticks = 0;
  const iv = setInterval(() => {
    ticks++;
    if (ticks < 7) return;                                  // мин. ~2.1с — логото да мине
    if (ready()) { clearInterval(iv); build(); }
    else if (ticks > 400) { clearInterval(iv); build(); }   // ~120с предпазител
  }, 300);
}
