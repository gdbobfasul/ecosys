// KCY — Комплаенс за Кыргызская Республика (КР). Един споделен скрипт за ВСИЧКИ
// приложения. Включи го на страниците с вход/регистрация/плащане:
//   <script src="/shared/js/kg-compliance.js?v=1.0003"></script>
// Автоматично (само ако има поле за парола): footer (г. Бишкек, тел, e-mail) + логота
// Visa/Mastercard/Элкарт + линк „Помощь" (оплата картой) + 2 ЗАДЪЛЖИТЕЛНИ отметки:
//   1) Политика конфиденциальности + Публичная оферта → /shared/legal/policy.html
//   2) Возврат средств + оплата картой               → /shared/legal/payment.html
// Текстовете следват избрания език отгоре (i18n) и се пре-рендират при смяна.
// Плюс KGCompliance.priceLine()/payLogos() за цени в сом.
(function () {
  'use strict';
  if (window.KGCompliance) return;

  var CFG = {
    company: 'ОсОО «ДАЙ ГРУП»', inn: '01412202310074',
    city: 'г. Бишкек', phone: '+996 509 324 709', email: 'miroljubkalaydjiev177@gmail.com',
    legal: { policy: '/shared/legal/policy.html', payment: '/shared/legal/payment.html' }
  };

  // Речник (т.1/4/6). Отметка: [префикс, текст-линк, суфикс]. Всичките 15 езика са налични.
  // es-MX → es (псевдоним). Липсващ/непознат език → en (резерв).
  var DICT = {
    en: { c1: ['I agree to the ', 'Privacy Policy and Public Offer', ''], c2: ['I have read the ', 'Refund Rules and Card Payment terms', ''],
      err: 'You must accept both conditions to continue.', helpBtn: 'Help — card payment', tel: 'Tel', mail: 'E-mail' },
    ru: { c1: ['Я согласен(на) с ', 'Политикой конфиденциальности и Публичной офертой', ''], c2: ['Я ознакомлен(а) с ', 'Правилами возврата и оплаты картой', ''],
      err: 'Необходимо принять оба условия, чтобы продолжить.', helpBtn: 'Помощь — оплата картой', tel: 'Тел', mail: 'E-mail' },
    ky: { c1: ['Мен ', 'Купуялык саясаты жана ачык оферта', ' менен макулмун'], c2: ['Мен ', 'кайтаруу жана карта менен төлөө эрежелери', ' менен таанышканмын'],
      err: 'Улантуу үчүн эки шартты тең кабыл алышыңыз керек.', helpBtn: 'Жардам — карта менен төлөө', tel: 'Тел', mail: 'E-mail' },
    bg: { c1: ['Съгласявам се с ', 'Политиката за поверителност и Публичната оферта', ''], c2: ['Запознат съм с ', 'Правилата за връщане и плащане с карта', ''],
      err: 'Трябва да приемете и двете условия, за да продължите.', helpBtn: 'Помощ — плащане с карта', tel: 'Тел', mail: 'Имейл' },
    uk: { c1: ['Я погоджуюся з ', 'Політикою конфіденційності та Публічною офертою', ''], c2: ['Я ознайомлений(а) з ', 'Правилами повернення та оплати карткою', ''],
      err: 'Потрібно прийняти обидві умови, щоб продовжити.', helpBtn: 'Допомога — оплата карткою', tel: 'Тел', mail: 'E-mail' },
    de: { c1: ['Ich stimme der ', 'Datenschutzrichtlinie und dem öffentlichen Angebot', ' zu'], c2: ['Ich habe die ', 'Rückerstattungs- und Kartenzahlungsregeln', ' gelesen'],
      err: 'Sie müssen beide Bedingungen akzeptieren, um fortzufahren.', helpBtn: 'Hilfe — Kartenzahlung', tel: 'Tel', mail: 'E-Mail' },
    fr: { c1: ['J’accepte la ', 'Politique de confidentialité et l’Offre publique', ''], c2: ['J’ai pris connaissance des ', 'Règles de remboursement et de paiement par carte', ''],
      err: 'Vous devez accepter les deux conditions pour continuer.', helpBtn: 'Aide — paiement par carte', tel: 'Tél', mail: 'E-mail' },
    es: { c1: ['Acepto la ', 'Política de privacidad y la Oferta pública', ''], c2: ['He leído las ', 'Reglas de reembolso y pago con tarjeta', ''],
      err: 'Debe aceptar ambas condiciones para continuar.', helpBtn: 'Ayuda — pago con tarjeta', tel: 'Tel', mail: 'Correo' },
    it: { c1: ['Accetto l’', 'Informativa sulla privacy e l’Offerta pubblica', ''], c2: ['Ho letto le ', 'Regole di rimborso e pagamento con carta', ''],
      err: 'Devi accettare entrambe le condizioni per continuare.', helpBtn: 'Aiuto — pagamento con carta', tel: 'Tel', mail: 'E-mail' },
    pt: { c1: ['Concordo com a ', 'Política de Privacidade e a Oferta Pública', ''], c2: ['Li as ', 'Regras de Reembolso e Pagamento com Cartão', ''],
      err: 'Você deve aceitar ambas as condições para continuar.', helpBtn: 'Ajuda — pagamento com cartão', tel: 'Tel', mail: 'E-mail' },
    ja: { c1: ['', 'プライバシーポリシーと公開オファー', 'に同意します'], c2: ['', '返金規則とカード決済の条件', 'を読みました'],
      err: '続行するには両方の条件に同意する必要があります。', helpBtn: 'ヘルプ — カード決済', tel: '電話', mail: 'メール' },
    'zh-Hant': { c1: ['我同意', '隱私政策與公開要約', ''], c2: ['我已閱讀', '退款規則與卡片付款條款', ''],
      err: '您必須接受這兩項條件才能繼續。', helpBtn: '說明 — 卡片付款', tel: '電話', mail: '電子郵件' },
    hi: { c1: ['मैं ', 'गोपनीयता नीति और सार्वजनिक प्रस्ताव', ' से सहमत हूँ'], c2: ['मैंने ', 'धनवापसी नियम और कार्ड भुगतान शर्तें', ' पढ़ी हैं'],
      err: 'जारी रखने के लिए आपको दोनों शर्तें स्वीकार करनी होंगी।', helpBtn: 'सहायता — कार्ड भुगतान', tel: 'फ़ोन', mail: 'ईमेल' },
    ar: { c1: ['أوافق على ', 'سياسة الخصوصية والعرض العام', ''], c2: ['لقد اطّلعت على ', 'قواعد الاسترداد وشروط الدفع بالبطاقة', ''],
      err: 'يجب قبول كلا الشرطين للمتابعة.', helpBtn: 'مساعدة — الدفع بالبطاقة', tel: 'هاتف', mail: 'بريد إلكتروني' }
  };
  DICT['es-MX'] = DICT.es;

  function getLang() {
    try {
      var l = (window.KCY_I18N && KCY_I18N.lang) || (window.FBP_I18N && FBP_I18N.lang);
      if (l) return l;
      var ls = localStorage.getItem('kcy-lang') || localStorage.getItem('fbp-lang');
      if (ls) return ls;
    } catch (e) {}
    return document.documentElement.getAttribute('lang') || 'en';
  }
  function D() { var l = getLang(); return DICT[l] || DICT[(l || '').split('-')[0]] || DICT.en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var CSS =
    '.kg-foot{margin-top:28px;padding:18px 16px;background:rgba(15,23,42,.6);border-top:1px solid rgba(148,163,184,.25);' +
      'color:#cbd5e1;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;text-align:center;line-height:1.7}' +
    '.kg-foot a{color:#60a5fa;text-decoration:none}.kg-foot a:hover{text-decoration:underline}' +
    '.kg-pay{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;margin-bottom:10px}' +
    '.kg-logo{display:inline-flex;align-items:center;height:26px;padding:0 9px;border-radius:5px;background:#fff;' +
      'font-weight:800;font-size:13px;letter-spacing:.3px;box-shadow:0 1px 2px rgba(0,0,0,.25)}' +
    '.kg-logo.kg-visa{color:#1a1f71;font-style:italic}.kg-logo.kg-mc{gap:5px;color:#222}' +
    '.kg-logo.kg-elkart{background:linear-gradient(90deg,#0a8f4f,#0b6db8);color:#fff}' +
    '.kg-help{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:5px;border:1px solid #60a5fa;' +
      'background:transparent;color:#60a5fa;cursor:pointer;font-size:12px;font-weight:600;text-decoration:none}.kg-help:hover{background:rgba(96,165,250,.15)}' +
    '.kg-legal{margin:6px 0}.kg-company{color:#94a3b8}' +
    '.kg-consent{margin:12px 0;padding:10px 12px;background:rgba(148,163,184,.10);border:1px solid rgba(148,163,184,.25);' +
      'border-radius:8px;text-align:left;font-size:13px;line-height:1.5}' +
    '.kg-consent label{display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin:5px 0;color:inherit}' +
    '.kg-consent input{margin-top:2px;width:16px;height:16px;flex:0 0 auto;accent-color:#2563eb}' +
    '.kg-consent a{color:#2563eb}' +
    '.kg-price{display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:8px}' +
    '.kg-price .som{font-weight:800}.kg-price .alt{opacity:.75;font-size:.85em}';

  function payLogos() {
    var d = D();
    return '<span class="kg-pay">' +
      '<span class="kg-logo kg-visa">VISA</span>' +
      '<span class="kg-logo kg-mc"><svg width="22" height="14" viewBox="0 0 38 24" aria-hidden="true">' +
        '<circle cx="15" cy="12" r="11" fill="#EB001B"/><circle cx="23" cy="12" r="11" fill="#F79E1B"/>' +
        '<path d="M19 4a11 11 0 000 16 11 11 0 000-16z" fill="#FF5F00"/></svg>Mastercard</span>' +
      '<span class="kg-logo kg-elkart">ЭЛКАРТ</span>' +
      '<a class="kg-help" href="' + CFG.legal.payment + '" target="_blank" rel="noopener">' + esc(d.helpBtn) + '</a>' +
    '</span>';
  }

  function priceLine(som, alt) {
    alt = alt || {}; var extra = [];
    ['usd', 'eur', 'rub', 'tng'].forEach(function (k) { if (alt[k]) extra.push(alt[k]); });
    return '<span class="kg-price"><span class="som">' + som + ' сом</span>' +
      (extra.length ? '<span class="alt">· ' + extra.join(' · ') + '</span>' : '') + '</span>';
  }

  // Само линкът „Help — card payment" (без логата) — за до сумите/регистрациите.
  function helpLink() {
    return '<a class="kg-help" href="' + CFG.legal.payment + '" target="_blank" rel="noopener">' + esc(D().helpBtn) + '</a>';
  }

  function footerInner() {
    var d = D();
    // Логата Visa/Mastercard/Элкарт + „Помощ" са САМО във футъра (най-отдолу). До сумите
    // за плащане се показва само линкът „Help" (data-kg-pay → helpLink()).
    return payLogos() +
      '<div class="kg-legal">' +
        '<a href="' + CFG.legal.policy + '" target="_blank" rel="noopener">' + esc(d.c1[1]) + '</a> · ' +
        '<a href="' + CFG.legal.payment + '" target="_blank" rel="noopener">' + esc(d.c2[1]) + '</a></div>' +
      '<div class="kg-company">' + esc(CFG.company) + ' · ИНН ' + CFG.inn + ' · ' + CFG.city +
        ' · ' + esc(d.tel) + ': <a href="tel:' + CFG.phone.replace(/\s/g, '') + '">' + CFG.phone + '</a>' +
        ' · ' + esc(d.mail) + ': <a href="mailto:' + CFG.email + '">' + CFG.email + '</a></div>';
  }

  function fillConsent(label, item, href) {
    label.querySelector('.kg-pre').textContent = item[0];
    var a = label.querySelector('.kg-link'); a.textContent = item[1]; a.href = href;
    label.querySelector('.kg-suf').textContent = item[2] || '';
  }
  function consentBlock() {
    var d = D();
    var div = document.createElement('div');
    div.className = 'kg-consent';
    div.innerHTML = ['1', '2'].map(function () {
      return '<label><input type="checkbox" class="kg-cb" required> ' +
        '<span><span class="kg-pre"></span><a class="kg-link" target="_blank" rel="noopener"></a><span class="kg-suf"></span></span></label>';
    }).join('');
    var labels = div.querySelectorAll('label');
    fillConsent(labels[0], d.c1, CFG.legal.policy);
    fillConsent(labels[1], d.c2, CFG.legal.payment);
    return div;
  }

  function authButtons() {
    var set = new Set();
    document.querySelectorAll('form').forEach(function (f) {
      if (f.querySelector('input[type="password"]')) {
        f.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(function (b) { set.add(b); });
      }
    });
    ['btn-login', 'btn-register', 'btnSubmit', 'btnLogin', 'btnReg'].forEach(function (id) {
      var b = document.getElementById(id); if (b) set.add(b);
    });
    return Array.from(set);
  }

  function gate(btn) {
    if (btn.__kgGated) return;
    btn.__kgGated = true;
    var block = consentBlock();
    btn.parentNode.insertBefore(block, btn);
    btn.addEventListener('click', function (e) {
      var cbs = block.querySelectorAll('.kg-cb');
      var ok = Array.prototype.every.call(cbs, function (c) { return c.checked; });
      if (!ok) {
        e.preventDefault(); e.stopImmediatePropagation();
        block.style.boxShadow = '0 0 0 2px #ef4444';
        var w = block.querySelector('.kg-err');
        if (!w) { w = document.createElement('div'); w.className = 'kg-err'; w.style.cssText = 'color:#ef4444;margin-top:6px;font-weight:600'; block.appendChild(w); }
        w.textContent = D().err;
      }
    }, true);
  }

  function applyLang() {
    var d = D();
    document.querySelectorAll('.kg-foot').forEach(function (f) { f.innerHTML = footerInner(); });
    document.querySelectorAll('.kg-consent').forEach(function (block) {
      var labels = block.querySelectorAll('label');
      if (labels.length >= 2) { fillConsent(labels[0], d.c1, CFG.legal.policy); fillConsent(labels[1], d.c2, CFG.legal.payment); }
      var err = block.querySelector('.kg-err'); if (err) err.textContent = d.err;
    });
    document.querySelectorAll('[data-kg-pay]').forEach(function (el) { el.innerHTML = helpLink(); });
  }

  function init() {
    var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

    document.querySelectorAll('[data-kg-pay]').forEach(function (el) { el.innerHTML = helpLink(); });
    document.querySelectorAll('[data-kg-price]').forEach(function (el) {
      el.innerHTML = priceLine(el.getAttribute('data-kg-price'), {
        usd: el.getAttribute('data-kg-usd'), eur: el.getAttribute('data-kg-eur'),
        rub: el.getAttribute('data-kg-rub'), tng: el.getAttribute('data-kg-tng')
      });
    });

    var hasPw = !!document.querySelector('input[type="password"]');
    var hasPay = !!document.querySelector('[data-kg-pay]');
    // Задължителни съгласия — само на login/registration (има парола).
    if (hasPw) authButtons().forEach(gate);
    // Footer — на login/registration И на платежни страници (има суми/data-kg-pay).
    if ((hasPw || hasPay) && !document.querySelector('.kg-foot')) {
      var f = document.createElement('div'); f.innerHTML = '<footer class="kg-foot"></footer>';
      var footEl = f.firstChild;
      document.body.appendChild(footEl);
      // Ако <body> е flex (центрира съдържанието) → footer-ът да е цял ред НАЙ-ОТДОЛУ,
      // а не flex-съсед до картата. Колона → само пълна ширина; ред → пренеси на нов ред.
      var cs = getComputedStyle(document.body);
      if (cs.display.indexOf('flex') >= 0) {
        footEl.style.width = '100%';
        if (cs.flexDirection.indexOf('column') === 0) { footEl.style.flexShrink = '0'; }
        else { footEl.style.flex = '0 0 100%'; document.body.style.flexWrap = 'wrap'; }
      }
    }
    applyLang();

    ['kcy-lang-changed', 'kcy-lang-ready', 'fbp-lang-changed', 'fbp-lang-ready'].forEach(function (ev) {
      document.addEventListener(ev, applyLang);
    });
  }

  window.KGCompliance = { priceLine: priceLine, payLogos: payLogos, applyLang: applyLang, cfg: CFG };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
