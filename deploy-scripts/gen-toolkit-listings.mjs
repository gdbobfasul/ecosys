// Version: 1.0000
// gen-toolkit-listings.mjs — генерира ЯСНИ магазинни описания (15 езика) за toolkit апчетата,
// които изброяват ВСИЧКИ инструменти. Списъкът с инструменти се чете АВТОМАТИЧНО от регистъра
// (src/core/registry.js) + локализираните им имена/описания от src/core/i18n.js (вече на 15 езика).
// Пише: publish/store-listing/<език>.txt + publish/descriptions-languages.md (за двете издания).
//
// Пуск от repo ROOT:  node deploy-scripts/gen-toolkit-listings.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const LANGS = ['bg','ru','uk','en','de','fr','es','es-MX','it','pt','ar','hi','ja','ky','zh-Hant'];
const LANG_NAME = { bg:'Български', ru:'Русский', uk:'Українська', en:'English', de:'Deutsch', fr:'Français', es:'Español', 'es-MX':'Español (MX)', it:'Italiano', pt:'Português', ar:'العربية', hi:'हिन्दी', ja:'日本語', ky:'Кыргызча', 'zh-Hant':'繁體中文' };
// AppGallery език (ky НЕ се поддържа → null, пропуска се в descriptions-languages.md).
const AG_LANG = { bg:'Bulgarian', ru:'Russian', uk:'Ukrainian', en:'English', de:'German', fr:'French', es:'Spanish', 'es-MX':'Spanish (Latin America)', it:'Italian', pt:'Portuguese', ar:'Arabic', hi:'Hindi', ja:'Japanese', ky:null, 'zh-Hant':'Chinese (Traditional)' };
const SUPPORT_EMAIL = 'miroljubkalaydjiev177@gmail.com';
const SUPPORT_LINE = { bg:'За въпроси и поддръжка пишете на:', ru:'По вопросам и поддержке пишите на:', uk:'З питань і підтримки пишіть на:', en:'For questions and support, write to:', de:'Bei Fragen und für Support schreiben Sie an:', fr:'Pour toute question ou assistance, écrivez à :', es:'Para preguntas y soporte, escribe a:', 'es-MX':'Para dudas y soporte, escribe a:', it:'Per domande e assistenza, scrivi a:', pt:'Para dúvidas e suporte, escreva para:', ar:'للأسئلة والدعم، راسلونا على:', hi:'प्रश्नों और सहायता के लिए लिखें:', ja:'ご質問・サポートは:', ky:'Суроолор жана колдоо үчүн:', 'zh-Hant':'如有問題或需要支援，請來信：' };
const TOOLS_HDR = { bg:'Включени инструменти:', ru:'Включённые инструменты:', uk:'Включені інструменти:', en:'Tools included:', de:'Enthaltene Werkzeuge:', fr:'Outils inclus :', es:'Herramientas incluidas:', 'es-MX':'Herramientas incluidas:', it:'Strumenti inclusi:', pt:'Ferramentas incluídas:', ar:'الأدوات المضمّنة:', hi:'शामिल टूल:', ja:'収録ツール:', ky:'Камтылган куралдар:', 'zh-Hant':'包含的工具：' };
const NOADS = { bg:'Без изскачащи реклами и без проследяване — данните остават на устройството ти.', ru:'Без всплывающей рекламы и слежки — данные остаются на вашем устройстве.', uk:'Без спливаючої реклами й стеження — дані залишаються на вашому пристрої.', en:'No pop-up ads, no tracking — your data stays on your device.', de:'Keine Pop-up-Werbung, kein Tracking — deine Daten bleiben auf deinem Gerät.', fr:'Pas de pubs pop-up, pas de suivi — vos données restent sur votre appareil.', es:'Sin anuncios emergentes ni rastreo — tus datos se quedan en tu dispositivo.', 'es-MX':'Sin anuncios emergentes ni rastreo — tus datos se quedan en tu dispositivo.', it:'Niente pop-up pubblicitari né tracciamento — i tuoi dati restano sul dispositivo.', pt:'Sem anúncios pop-up nem rastreamento — seus dados ficam no seu dispositivo.', ar:'بدون إعلانات منبثقة ولا تتبّع — بياناتك تبقى على جهازك.', hi:'कोई पॉप-अप विज्ञापन नहीं, कोई ट्रैकिंग नहीं — आपका डेटा आपके डिवाइस पर रहता है।', ja:'ポップアップ広告なし・追跡なし — データは端末内に留まります。', ky:'Калкып чыкма жарнак жок, көзөмөл жок — маалыматыңыз түзмөгүңүздө калат.', 'zh-Hant':'無彈出式廣告、無追蹤 — 您的資料留在裝置上。' };
const NF = { bg:'Много нови инструменти в едно приложение.', ru:'Много новых инструментов в одном приложении.', uk:'Багато нових інструментів в одному застосунку.', en:'Many new tools in one app.', de:'Viele neue Werkzeuge in einer App.', fr:'De nombreux nouveaux outils dans une seule app.', es:'Muchas herramientas nuevas en una sola app.', 'es-MX':'Muchas herramientas nuevas en una sola app.', it:'Molti nuovi strumenti in un’unica app.', pt:'Muitas ferramentas novas em um só app.', ar:'أدوات جديدة كثيرة في تطبيق واحد.', hi:'एक ऐप में कई नए टूल।', ja:'1つのアプリに多数の新ツール。', ky:'Бир колдонмодо көп жаңы курал.', 'zh-Hant':'一個應用內多款新工具。' };

// Заглавен ред (Brief идва от него — ≤25 знака) + подзаглавие, per приложение.
const TAGLINE = {
  'pupikes-toolkit-qr': { bg:'QR инструменти', ru:'QR-инструменты', uk:'QR-інструменти', en:'QR toolkit', de:'QR-Werkzeuge', fr:'Boîte à outils QR', es:'Kit de QR', 'es-MX':'Kit de QR', it:'Kit QR', pt:'Kit de QR', ar:'أدوات QR', hi:'QR टूलकिट', ja:'QRツール', ky:'QR куралдары', 'zh-Hant':'QR 工具箱' },
  'pupikes-toolkit-text':{ bg:'Текстови инструменти', ru:'Текстовые инструменты', uk:'Текстові інструменти', en:'Text toolkit', de:'Text-Werkzeuge', fr:'Boîte à outils texte', es:'Kit de texto', 'es-MX':'Kit de texto', it:'Kit di testo', pt:'Kit de texto', ar:'أدوات النصوص', hi:'टेक्स्ट टूलकिट', ja:'テキストツール', ky:'Текст куралдары', 'zh-Hant':'文字工具箱' },
};
const SUBTITLE = {
  'pupikes-toolkit-qr': { bg:'Създавай, пази и разчитай QR кодове — офлайн, на устройството.', ru:'Создавай, храни и сканируй QR-коды — офлайн, на устройстве.', uk:'Створюй, зберігай і скануй QR-коди — офлайн, на пристрої.', en:'Create, save and read QR codes — offline, on your device.', de:'QR-Codes erstellen, speichern und lesen — offline, auf dem Gerät.', fr:'Créez, enregistrez et lisez des QR — hors ligne, sur l’appareil.', es:'Crea, guarda y lee códigos QR — sin conexión, en tu dispositivo.', 'es-MX':'Crea, guarda y lee códigos QR — sin conexión, en tu dispositivo.', it:'Crea, salva e leggi QR — offline, sul dispositivo.', pt:'Crie, salve e leia QR — offline, no seu dispositivo.', ar:'أنشئ واحفظ واقرأ رموز QR — دون إنترنت، على جهازك.', hi:'QR कोड बनाएं, सहेजें और पढ़ें — ऑफ़लाइन, आपके डिवाइस पर।', ja:'QRコードの作成・保存・読み取り — オフラインで端末上。', ky:'QR коддорду түз, сакта жана оку — офлайн, түзмөктө.', 'zh-Hant':'建立、儲存與讀取 QR 碼 — 離線、在裝置上。' },
  'pupikes-toolkit-text':{ bg:'Пълен текстов работен плот — офлайн, на устройството.', ru:'Полный текстовый комбайн — офлайн, на устройстве.', uk:'Повний текстовий верстат — офлайн, на пристрої.', en:'A complete text workbench — offline, on your device.', de:'Eine komplette Text-Werkbank — offline, auf dem Gerät.', fr:'Un atelier de texte complet — hors ligne, sur l’appareil.', es:'Un banco de trabajo de texto completo — sin conexión, en tu dispositivo.', 'es-MX':'Un banco de trabajo de texto completo — sin conexión, en tu dispositivo.', it:'Un banco di lavoro per il testo completo — offline, sul dispositivo.', pt:'Uma bancada de texto completa — offline, no seu dispositivo.', ar:'طاولة عمل نصية كاملة — دون إنترنت، على جهازك.', hi:'संपूर्ण टेक्स्ट वर्कबेंच — ऑफ़लाइन, आपके डिवाइस पर।', ja:'完全なテキスト作業台 — オフラインで端末上。', ky:'Толук текст иш столу — офлайн, түзмөктө.', 'zh-Hant':'完整的文字工作台 — 離線、在裝置上。' },
};

function readObj(src, key) {
  const m = src.match(new RegExp(key + ':\\s*(\\{[\\s\\S]*?\\}),'));
  if (!m) return null; try { return (0, eval)('(' + m[1] + ')'); } catch (_) { return null; }
}
function toolsOf(appDir) {
  const reg = fs.readFileSync(path.join(appDir, 'src', 'core', 'registry.js'), 'utf8');
  const out = [];
  const re = /name:\s*'([^']+)'[^}]*?desc:\s*'([^']+)'/g; let m;
  while ((m = re.exec(reg))) out.push({ nameKey: m[1], descKey: m[2] });
  return out;
}
function briefOf(s) {
  let f = (s || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
  const dash = f.indexOf(' — '); if (dash > 0 && dash <= 25) f = f.slice(0, dash);   // само таглайна преди „ — "
  if (f.length > 25) { const b = f.slice(0, 25); const i = b.lastIndexOf(' '); f = (i > 10 ? b.slice(0, i) : b); }
  return f.replace(/[\s—-]+$/, '').trim();
}

function buildForLang(appId, i18n, tools, lang) {
  const tl = (TAGLINE[appId] || {})[lang] || appId;
  const sub = (SUBTITLE[appId] || {})[lang] || '';
  const lines = [`Pupikes ${tl} — ${sub}`, '', TOOLS_HDR[lang]];
  for (const t of tools) {
    const nm = (readObj(i18n, t.nameKey) || {})[lang];
    const ds = (readObj(i18n, t.descKey) || {})[lang];
    if (nm) lines.push('• ' + nm + (ds ? ' — ' + ds : ''));
  }
  lines.push('', NOADS[lang], '', `${SUPPORT_LINE[lang]} ${SUPPORT_EMAIL}`);
  return lines.join('\n') + '\n';
}

function genApp(appId) {
  let done = 0;
  for (const store of ['huawei', 'rustore']) {
    const appDir = path.join(ROOT, store, appId);
    if (!fs.existsSync(appDir)) continue;
    const i18n = fs.readFileSync(path.join(appDir, 'src', 'core', 'i18n.js'), 'utf8');
    const tools = toolsOf(appDir);
    const pub = path.join(appDir, 'publish');
    const slDir = path.join(pub, 'store-listing'); fs.mkdirSync(slDir, { recursive: true });
    const perLang = {};
    for (const lang of LANGS) { const body = buildForLang(appId, i18n, tools, lang); perLang[lang] = body; fs.writeFileSync(path.join(slDir, lang + '.txt'), body); }
    // descriptions-languages.md
    const appName = 'Pupikes ' + ((TAGLINE[appId] || {}).en || appId);
    const md = ['# ' + appName + ' — описание по език (Brief + Full + New features)', '',
      '_За AppGallery: **Manage languages** → добави език → попълни Brief/Full/New features._', '',
      '> ⚠️ **ky (кыргызки) НЕ съществува в AppGallery** — пропусни го.', ''];
    for (const lang of LANGS) {
      if (!AG_LANG[lang]) continue;
      md.push(`## ${LANG_NAME[lang]} (${lang}) — AppGallery: **${AG_LANG[lang]}**`);
      md.push('**Brief introduction (до 25 знака):**', '```', briefOf(perLang[lang]), '```');
      md.push('**Full introduction:**', '```', perLang[lang].trim(), '```');
      md.push('**New features (до 1000 знака):**', '```', NF[lang], '```', '');
    }
    fs.writeFileSync(path.join(pub, 'descriptions-languages.md'), md.join('\n'));
    console.log(`  ✓ ${store}/${appId}: ${tools.length} инструмента × 15 езика`);
    done++;
  }
  return done;
}

let n = 0;
for (const app of ['pupikes-toolkit-qr', 'pupikes-toolkit-text']) n += genApp(app);
console.log(`Готово: обновени описания за ${n} издания (store-listing×15 + descriptions-languages.md).`);
