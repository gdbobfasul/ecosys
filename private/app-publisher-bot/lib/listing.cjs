// listing.cjs — генерира локализираното описание (15 езика) от собствените преводи на апа.
// Вади app_tagline/ob_desc/set_about_text (или зададени в конфига ключове) от src/core/i18n.js
// и долепя локализиран ред за поддръжка с имейла. Резултат: publish/store-listing/<език>.txt
const fs = require('fs');
const path = require('path');

const LANGS = ['bg','ru','uk','en','de','fr','es','es-MX','it','pt','ar','hi','ja','ky','zh-Hant'];
const LANG_NAME = { bg:'Български', ru:'Русский', uk:'Українська', en:'English', de:'Deutsch', fr:'Français', es:'Español', 'es-MX':'Español (MX)', it:'Italiano', pt:'Português', ar:'العربية', hi:'हिन्दी', ja:'日本語', ky:'Кыргызча', 'zh-Hant':'繁體中文' };

const SUPPORT_EMAIL = 'dai.group.ltd.support@gmail.com';
const SUPPORT_LABEL = { bg:'Поддръжка', ru:'Поддержка', uk:'Підтримка', en:'Support', de:'Support', fr:'Assistance', es:'Soporte', 'es-MX':'Soporte', it:'Assistenza', pt:'Suporte', ar:'الدعم', hi:'सहायता', ja:'サポート', ky:'Колдоо', 'zh-Hant':'支援' };
const SUPPORT_LINE = {
  bg:`За въпроси и поддръжка пишете на: ${SUPPORT_EMAIL}`,
  ru:`По вопросам и поддержке пишите на: ${SUPPORT_EMAIL}`,
  uk:`З питань і підтримки пишіть на: ${SUPPORT_EMAIL}`,
  en:`For questions and support, write to: ${SUPPORT_EMAIL}`,
  de:`Bei Fragen und für Support schreiben Sie an: ${SUPPORT_EMAIL}`,
  fr:`Pour toute question ou assistance, écrivez à : ${SUPPORT_EMAIL}`,
  es:`Para preguntas y soporte, escribe a: ${SUPPORT_EMAIL}`,
  'es-MX':`Para dudas y soporte, escribe a: ${SUPPORT_EMAIL}`,
  it:`Per domande e assistenza, scrivi a: ${SUPPORT_EMAIL}`,
  pt:`Para dúvidas e suporte, escreva para: ${SUPPORT_EMAIL}`,
  ar:`للأسئلة والدعم، راسلونا على: ${SUPPORT_EMAIL}`,
  hi:`प्रश्नों और सहायता के लिए लिखें: ${SUPPORT_EMAIL}`,
  ja:`ご質問・サポートは次のメールへ: ${SUPPORT_EMAIL}`,
  ky:`Суроолор жана колдоо үчүн жазыңыз: ${SUPPORT_EMAIL}`,
  'zh-Hant':`如有問題或需要支援，請來信：${SUPPORT_EMAIL}`
};

// Вади обект-литерал `key: { ... },` от i18n.js (записите са на един ред).
function extractObj(src, key) {
  const m = src.match(new RegExp(key + ':\\s*(\\{[\\s\\S]*?\\}),'));
  if (!m) return null;
  try { return (0, eval)('(' + m[1] + ')'); } catch (_) { return null; }
}

// keys: подредени по приоритет ключове, които да влязат в описанието (всеки на нов абзац).
function generateListing(appDir, opts = {}) {
  const i18nPath = path.join(appDir, 'src', 'core', 'i18n.js');
  if (!fs.existsSync(i18nPath)) throw new Error('Липсва ' + i18nPath);
  const src = fs.readFileSync(i18nPath, 'utf8');
  const keys = opts.keys || ['app_tagline', 'ob_desc', 'set_about_text'];
  const objs = keys.map((k) => ({ k, o: extractObj(src, k) })).filter((x) => x.o);
  if (!objs.length) throw new Error('Не намерих описателни ключове (' + keys.join(', ') + ') в i18n.js');

  const outDir = path.join(appDir, 'publish', 'store-listing');
  fs.mkdirSync(outDir, { recursive: true });
  const index = [];
  for (const lang of LANGS) {
    const paras = objs.map((x) => x.o[lang]).filter(Boolean);
    const body = paras.join('\n\n') +
      `\n\n${SUPPORT_LABEL[lang]}: ${SUPPORT_EMAIL}\n${SUPPORT_LINE[lang]}\n`;
    fs.writeFileSync(path.join(outDir, lang + '.txt'), body, 'utf8');
    index.push(`${lang} (${LANG_NAME[lang]}) -> ${lang}.txt`);
  }
  fs.writeFileSync(path.join(outDir, '_index.txt'), index.join('\n') + '\n', 'utf8');
  return { count: LANGS.length, dir: outDir };
}

module.exports = { generateListing, LANGS, LANG_NAME, SUPPORT_EMAIL };
