'use strict';
/* Pupikes Дом — статичен i18n слой (без рънтайм превод; всички текстове са фиксирани).
 * 15 поддържани езика; арабският е RTL. Ключ → t('ключ', {параметри}). Речникът е в DICT
 * (попълва се на партиди; липсващ превод пада към български). */

const I18N_LANGS = [
  { code: 'bg', name: 'Български' }, { code: 'en', name: 'English' }, { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' }, { code: 'ky', name: 'Кыргызча' }, { code: 'zh-Hant', name: '繁體中文' },
  { code: 'hi', name: 'हिन्दी' }, { code: 'ar', name: 'العربية' }, { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' }, { code: 'es', name: 'Español' }, { code: 'es-MX', name: 'Español (MX)' },
  { code: 'fr', name: 'Français' }, { code: 'pt', name: 'Português' }, { code: 'ja', name: '日本語' },
];
const I18N_RTL = ['ar'];

let LANG = (function () {
  try { const s = localStorage.getItem('pd_lang'); if (s && I18N_LANGS.some(l => l.code === s)) return s; } catch (e) {}
  return 'bg';
})();

/* речник: ключ → { bg, en, ru, uk, ky, 'zh-Hant', hi, ar, de, it, es, 'es-MX', fr, pt, ja } */
const DICT = {
  // --- роли ---
  role_owner: { bg: 'собственик', en: 'owner', ru: 'владелец', uk: 'власник', ky: 'ээси', 'zh-Hant': '業主', hi: 'मालिक', ar: 'المالك', de: 'Eigentümer', it: 'proprietario', es: 'propietario', 'es-MX': 'propietario', fr: 'propriétaire', pt: 'proprietário', ja: '所有者' },
  role_tech: { bg: 'майстор', en: 'technician', ru: 'мастер', uk: 'майстер', ky: 'уста', 'zh-Hant': '技師', hi: 'तकनीशियन', ar: 'الفني', de: 'Techniker', it: 'tecnico', es: 'técnico', 'es-MX': 'técnico', fr: 'technicien', pt: 'técnico', ja: '技術者' },
  role_center: { bg: 'център', en: 'center', ru: 'центр', uk: 'центр', ky: 'борбор', 'zh-Hant': '中心', hi: 'केंद्र', ar: 'المركز', de: 'Zentrale', it: 'centro', es: 'centro', 'es-MX': 'centro', fr: 'centre', pt: 'central', ja: 'センター' },
  role_moderator: { bg: 'модератор', en: 'moderator', ru: 'модератор', uk: 'модератор', ky: 'модератор', 'zh-Hant': '版主', hi: 'मॉडरेटर', ar: 'المشرف', de: 'Moderator', it: 'moderatore', es: 'moderador', 'es-MX': 'moderador', fr: 'modérateur', pt: 'moderador', ja: 'モデレーター' },
  role_admin: { bg: 'админ', en: 'admin', ru: 'админ', uk: 'адмін', ky: 'админ', 'zh-Hant': '管理員', hi: 'एडमिन', ar: 'المسؤول', de: 'Admin', it: 'admin', es: 'admin', 'es-MX': 'admin', fr: 'admin', pt: 'admin', ja: '管理者' },

  // --- групи специалисти ---
  trade_power: { bg: 'Електричество (ток)', en: 'Electricity (power)', ru: 'Электричество (ток)', uk: 'Електрика (струм)', ky: 'Электр (ток)', 'zh-Hant': '電力', hi: 'बिजली', ar: 'الكهرباء', de: 'Strom', it: 'Elettricità', es: 'Electricidad', 'es-MX': 'Electricidad', fr: 'Électricité', pt: 'Eletricidade', ja: '電気' },
  trade_water: { bg: 'Водопровод (вода)', en: 'Plumbing (water)', ru: 'Водопровод (вода)', uk: 'Водопровід (вода)', ky: 'Суу түтүгү', 'zh-Hant': '水管', hi: 'नलसाजी', ar: 'السباكة', de: 'Sanitär', it: 'Idraulica', es: 'Fontanería', 'es-MX': 'Plomería', fr: 'Plomberie', pt: 'Canalização', ja: '配管' },
  trade_software: { bg: 'Компютри — софтуер', en: 'Computers — software', ru: 'Компьютеры — ПО', uk: 'Комп’ютери — ПЗ', ky: 'Компьютер — программа', 'zh-Hant': '電腦 — 軟體', hi: 'कंप्यूटर — सॉफ़्टवेयर', ar: 'حواسيب — برمجيات', de: 'Computer — Software', it: 'Computer — software', es: 'Ordenadores — software', 'es-MX': 'Computadoras — software', fr: 'Ordinateurs — logiciel', pt: 'Computadores — software', ja: 'コンピュータ — ソフトウェア' },
  trade_hardware: { bg: 'Компютри — хардуер', en: 'Computers — hardware', ru: 'Компьютеры — железо', uk: 'Комп’ютери — залізо', ky: 'Компьютер — аппараттык', 'zh-Hant': '電腦 — 硬體', hi: 'कंप्यूटर — हार्डवेयर', ar: 'حواسيب — عتاد', de: 'Computer — Hardware', it: 'Computer — hardware', es: 'Ordenadores — hardware', 'es-MX': 'Computadoras — hardware', fr: 'Ordinateurs — matériel', pt: 'Computadores — hardware', ja: 'コンピュータ — ハードウェア' },
  trade_medical: { bg: 'Медицинска помощ', en: 'Medical help', ru: 'Медпомощь', uk: 'Медична допомога', ky: 'Медициналык жардам', 'zh-Hant': '醫療協助', hi: 'चिकित्सा सहायता', ar: 'مساعدة طبية', de: 'Medizinische Hilfe', it: 'Assistenza medica', es: 'Ayuda médica', 'es-MX': 'Ayuda médica', fr: 'Aide médicale', pt: 'Ajuda médica', ja: '医療支援' },
  trade_pharmacy: { bg: 'Доставка на лекарства', en: 'Medicine delivery', ru: 'Доставка лекарств', uk: 'Доставка ліків', ky: 'Дары жеткирүү', 'zh-Hant': '藥品配送', hi: 'दवा वितरण', ar: 'توصيل الأدوية', de: 'Medikamentenlieferung', it: 'Consegna farmaci', es: 'Entrega de medicamentos', 'es-MX': 'Entrega de medicamentos', fr: 'Livraison de médicaments', pt: 'Entrega de medicamentos', ja: '医薬品配達' },

  // --- статуси на сигнал ---
  st_open: { bg: 'отворен', en: 'open', ru: 'открыт', uk: 'відкритий', ky: 'ачык', 'zh-Hant': '開放', hi: 'खुला', ar: 'مفتوح', de: 'offen', it: 'aperto', es: 'abierto', 'es-MX': 'abierto', fr: 'ouvert', pt: 'aberto', ja: '未対応' },
  st_accepted: { bg: 'приет', en: 'accepted', ru: 'принят', uk: 'прийнятий', ky: 'кабыл алынды', 'zh-Hant': '已接受', hi: 'स्वीकृत', ar: 'مقبول', de: 'angenommen', it: 'accettato', es: 'aceptado', 'es-MX': 'aceptado', fr: 'accepté', pt: 'aceito', ja: '受付済' },
  st_assigned: { bg: 'възложен', en: 'assigned', ru: 'назначен', uk: 'призначений', ky: 'дайындалды', 'zh-Hant': '已指派', hi: 'सौंपा गया', ar: 'مُسند', de: 'zugewiesen', it: 'assegnato', es: 'asignado', 'es-MX': 'asignado', fr: 'assigné', pt: 'atribuído', ja: '割当済' },
  st_resolved: { bg: 'приключен', en: 'resolved', ru: 'завершён', uk: 'завершений', ky: 'бүттү', 'zh-Hant': '已完成', hi: 'हल किया गया', ar: 'منجز', de: 'erledigt', it: 'risolto', es: 'resuelto', 'es-MX': 'resuelto', fr: 'résolu', pt: 'concluído', ja: '完了' },

  // --- общи бутони/надписи ---
  save: { bg: 'Запази', en: 'Save', ru: 'Сохранить', uk: 'Зберегти', ky: 'Сактоо', 'zh-Hant': '儲存', hi: 'सहेजें', ar: 'حفظ', de: 'Speichern', it: 'Salva', es: 'Guardar', 'es-MX': 'Guardar', fr: 'Enregistrer', pt: 'Guardar', ja: '保存' },
  add: { bg: 'Добави', en: 'Add', ru: 'Добавить', uk: 'Додати', ky: 'Кошуу', 'zh-Hant': '新增', hi: 'जोड़ें', ar: 'إضافة', de: 'Hinzufügen', it: 'Aggiungi', es: 'Añadir', 'es-MX': 'Agregar', fr: 'Ajouter', pt: 'Adicionar', ja: '追加' },
  create: { bg: 'Създай', en: 'Create', ru: 'Создать', uk: 'Створити', ky: 'Түзүү', 'zh-Hant': '建立', hi: 'बनाएँ', ar: 'إنشاء', de: 'Erstellen', it: 'Crea', es: 'Crear', 'es-MX': 'Crear', fr: 'Créer', pt: 'Criar', ja: '作成' },
  approve: { bg: 'Одобри', en: 'Approve', ru: 'Одобрить', uk: 'Схвалити', ky: 'Жактыруу', 'zh-Hant': '核准', hi: 'स्वीकृत करें', ar: 'الموافقة', de: 'Genehmigen', it: 'Approva', es: 'Aprobar', 'es-MX': 'Aprobar', fr: 'Approuver', pt: 'Aprovar', ja: '承認' },
  reject: { bg: 'Откажи', en: 'Reject', ru: 'Отклонить', uk: 'Відхилити', ky: 'Четке кагуу', 'zh-Hant': '拒絕', hi: 'अस्वीकार करें', ar: 'رفض', de: 'Ablehnen', it: 'Rifiuta', es: 'Rechazar', 'es-MX': 'Rechazar', fr: 'Refuser', pt: 'Rejeitar', ja: '却下' },
  error: { bg: 'Грешка', en: 'Error', ru: 'Ошибка', uk: 'Помилка', ky: 'Ката', 'zh-Hant': '錯誤', hi: 'त्रुटि', ar: 'خطأ', de: 'Fehler', it: 'Errore', es: 'Error', 'es-MX': 'Error', fr: 'Erreur', pt: 'Erro', ja: 'エラー' },
  saved: { bg: 'Запазено', en: 'Saved', ru: 'Сохранено', uk: 'Збережено', ky: 'Сакталды', 'zh-Hant': '已儲存', hi: 'सहेजा गया', ar: 'تم الحفظ', de: 'Gespeichert', it: 'Salvato', es: 'Guardado', 'es-MX': 'Guardado', fr: 'Enregistré', pt: 'Guardado', ja: '保存しました' },
  logout: { bg: 'Изход', en: 'Log out', ru: 'Выход', uk: 'Вихід', ky: 'Чыгуу', 'zh-Hant': '登出', hi: 'लॉग आउट', ar: 'خروج', de: 'Abmelden', it: 'Esci', es: 'Salir', 'es-MX': 'Salir', fr: 'Déconnexion', pt: 'Sair', ja: 'ログアウト' },
  currency: { bg: 'сома', en: 'som', ru: 'сом', uk: 'сомів', ky: 'сом', 'zh-Hant': '索姆', hi: 'सोम', ar: 'سوم', de: 'Som', it: 'som', es: 'som', 'es-MX': 'som', fr: 'som', pt: 'som', ja: 'ソム' },
};

function t(key, params) {
  var row = DICT[key];
  var s = row ? (row[LANG] != null ? row[LANG] : row.bg) : key;
  if (params) s = String(s).replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ''; });
  return s;
}
function setLang(code) {
  if (!I18N_LANGS.some(l => l.code === code)) return;
  LANG = code;
  try { localStorage.setItem('pd_lang', code); } catch (e) {}
  applyI18nDir();
  if (typeof window.__onLangChange === 'function') window.__onLangChange();
}
function applyI18nDir() {
  try {
    document.documentElement.setAttribute('lang', LANG);
    document.documentElement.setAttribute('dir', I18N_RTL.indexOf(LANG) >= 0 ? 'rtl' : 'ltr');
  } catch (e) {}
}
function langPickerHTML() {
  return '<select id="langpick" class="langpick" title="Език">'
    + I18N_LANGS.map(l => `<option value="${l.code}" ${l.code === LANG ? 'selected' : ''}>${l.name}</option>`).join('')
    + '</select>';
}
applyI18nDir();
