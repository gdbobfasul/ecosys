#!/usr/bin/env node
// prep-app.cjs — подготвя приложение(я) за публикуване от profiles.json.
// За всяко: publish/app-profile.json + store-listing (15 ез.) + huawei.meta + form-android/harmonyos
// + descriptions-languages.md + hw/ru privacy (в publish/ и public/privacy/<ап>/).
//
// Употреба (от корена на репото):
//   node private/app-publisher-bot/prep-app.cjs <ап> [<ап2> ...]
//   node private/app-publisher-bot/prep-app.cjs all
const fs = require('fs');
const path = require('path');
const { generateMeta } = require('./lib/meta.cjs');
const { generateForms } = require('./lib/forms.cjs');
const { generatePrivacy } = require('./lib/privacy.cjs');

const REPO = path.join(__dirname, '..', '..');
const PROFILES = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json'), 'utf8'));

const LANGS = ['bg','ru','uk','en','de','fr','es','es-MX','it','pt','ar','hi','ja','ky','zh-Hant'];
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
const MM = { bg:'bg', ru:'ru', uk:'uk', en:'en', de:'de', fr:'fr', es:'es', 'es-MX':'es-MX', it:'it', pt:'pt', ar:'ar', hi:'hi', ja:'ja', ky:'ky', 'zh-Hant':'zh-TW' };

async function tr(text, code) {
  if (code === 'en' || !text) return text;
  try {
    const lp = 'en|' + (MM[code] || code);
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(lp) + '&de=ltd.dai.grup@gmail.com';
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
    const j = await r.json();
    const o = j && j.responseData && j.responseData.translatedText;
    return (o && !/MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(o)) ? o : text;
  } catch (_) { return text; }
}

// Вади обект-литерал `key: { ... },` от i18n.js.
function extractObj(src, key) {
  const m = src.match(new RegExp(key + ':\\s*(\\{[\\s\\S]*?\\}),'));
  if (!m) return null;
  try { return (0, eval)('(' + m[1] + ')'); } catch (_) { return null; }
}

async function prep(appBase) {
  const profile = PROFILES.apps[appBase];
  if (!profile) throw new Error('няма профил в profiles.json');
  profile.pricing = profile.pricing || PROFILES._pricingDefault;
  const appDir = path.join(REPO, 'huawei', appBase);
  if (!fs.existsSync(appDir)) throw new Error('няма huawei/' + appBase);
  const pub = path.join(appDir, 'publish');
  fs.mkdirSync(pub, { recursive: true });

  // 1) app-profile.json (чете се от generateForms).
  fs.writeFileSync(path.join(pub, 'app-profile.json'), JSON.stringify(profile, null, 2) + '\n', 'utf8');

  // 2) store-listing (15 езика). Авторитетните преводи от descKeys; за игри/тънки — + преведен pitch.
  const i18n = fs.readFileSync(path.join(appDir, 'src', 'core', 'i18n.js'), 'utf8');
  const objs = (profile.descKeys || []).map((k) => extractObj(i18n, k)).filter(Boolean);
  const outDir = path.join(pub, 'store-listing');
  fs.mkdirSync(outDir, { recursive: true });
  for (const lang of LANGS) {
    // Водещ абзац: маркетинговият pitch (гарантирано смислено описание), преведен за езика.
    // После: автентичните описателни ключове на приложението (ако носят реален текст).
    // eslint-disable-next-line no-await-in-loop
    const pit = await tr(profile.pitchEn, lang);
    const extra = objs.map((o) => o[lang]).filter(Boolean).filter((x) => x && x !== pit);
    const paras = [pit, ...extra].filter(Boolean);
    const body = paras.join('\n\n') + `\n\n${SUPPORT_LABEL[lang]}: ${SUPPORT_EMAIL}\n${SUPPORT_LINE[lang]}\n`;
    fs.writeFileSync(path.join(outDir, lang + '.txt'), body, 'utf8');
  }

  // 3) huawei.meta (категория + тип от профила).
  generateMeta(appDir, {
    category: profile.categoryHuawei,
    type: profile.isGame ? 'Game (игра)' : 'App (приложение, НЕ игра)',
    force: true
  });

  // 4) форми (чете app-profile.json + store-listing) + descriptions-languages.md.
  await generateForms(appDir);

  // 5) политика за поверителност (hw + ru).
  const pv = generatePrivacy(appDir, REPO, profile);

  return { appBase, category: profile.categoryHuawei, paid: /paid/i.test(profile.pricing.type), hwUrl: pv.hwUrl };
}

(async () => {
  const args = process.argv.slice(2);
  const list = (!args.length || args[0] === 'all') ? Object.keys(PROFILES.apps) : args;
  const ok = [], fail = [];
  for (const a of list) {
    try { const r = await prep(a); ok.push(r); console.log('✅ ' + a + '  (' + r.category + (r.paid ? ', Paid' : ', Free') + ')'); }
    catch (e) { fail.push(a); console.error('❌ ' + a + ': ' + (e.message || e)); }
  }
  console.log('\nГотови: ' + ok.length + ' / ' + list.length + (fail.length ? '  — паднали: ' + fail.join(', ') : ''));
})();
