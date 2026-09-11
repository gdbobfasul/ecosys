// Version: 1.0020
// „Парола-фраза" (обогатяване Huawei 4.1, 09.09.2026) — пароли от 3–8 случайни думи (diceware-подход): лесни за
// запомняне, дълги и силни. Речници на 6 езика (английски, български, руски, немски, испански, френски),
// разделител по избор, главна буква, добавена цифра/знак. Показва ентропия и генерира до 10 варианта наведнъж.
// Криптографски случайни числа (crypto.getRandomValues). Изцяло на устройството.
import { esc, copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';
import { analyze } from './pw-strength.js';

register({
  pp_title: { bg:'Парола-фраза', ru:'Парольная фраза', uk:'Парольна фраза', en:'Passphrase', de:'Passphrase', fr:'Phrase de passe', es:'Frase de contraseña', 'es-MX':'Frase de contraseña', it:'Passphrase', pt:'Frase-passe', ar:'عبارة مرور', hi:'पासफ़्रेज़', ja:'パスフレーズ', ky:'Сырсөз-фраза', 'zh-Hant':'密語' },
  pp_hint: { bg:'Случайни думи от речник — лесни за запомняне, но много силни (всяка дума добавя ~11 бита).', ru:'Случайные слова из словаря — легко запомнить, но очень надёжно (каждое слово ~11 бит).', uk:'Випадкові слова зі словника — легко запам’ятати, але дуже надійно (кожне слово ~11 біт).', en:'Random dictionary words — easy to remember, very strong (each word adds ~11 bits).', de:'Zufällige Wörterbuchwörter — leicht zu merken, sehr stark (jedes Wort ~11 Bit).', fr:'Mots aléatoires du dictionnaire — faciles à retenir, très forts (~11 bits par mot).', es:'Palabras aleatorias del diccionario — fáciles de recordar, muy fuertes (~11 bits por palabra).', 'es-MX':'Palabras aleatorias del diccionario — fáciles de recordar, muy fuertes (~11 bits por palabra).', it:'Parole casuali dal dizionario — facili da ricordare, molto forti (~11 bit per parola).', pt:'Palavras aleatórias do dicionário — fáceis de lembrar, muito fortes (~11 bits por palavra).', ar:'كلمات عشوائية من القاموس — سهلة التذكر وقوية جداً (كل كلمة ~11 بت).', hi:'शब्दकोश के यादृच्छिक शब्द — याद रखने में आसान, बहुत मज़बूत (हर शब्द ~11 बिट)।', ja:'辞書からランダムな単語 — 覚えやすく非常に強力（1語あたり約11ビット）。', ky:'Сөздүктөн кокус сөздөр — эстөө оңой, абдан күчтүү (ар бир сөз ~11 бит).', 'zh-Hant':'隨機字典單字 — 容易記憶且非常強（每個單字約 11 位元）。' },
  pp_lang: { bg:'Език на думите', ru:'Язык слов', uk:'Мова слів', en:'Word language', de:'Wortsprache', fr:'Langue des mots', es:'Idioma de las palabras', 'es-MX':'Idioma de las palabras', it:'Lingua delle parole', pt:'Idioma das palavras', ar:'لغة الكلمات', hi:'शब्दों की भाषा', ja:'単語の言語', ky:'Сөздөрдүн тили', 'zh-Hant':'單字語言' },
  pp_count: { bg:'Брой думи', ru:'Число слов', uk:'Кількість слів', en:'Number of words', de:'Anzahl Wörter', fr:'Nombre de mots', es:'Número de palabras', 'es-MX':'Número de palabras', it:'Numero di parole', pt:'Número de palavras', ar:'عدد الكلمات', hi:'शब्दों की संख्या', ja:'単語数', ky:'Сөздөрдүн саны', 'zh-Hant':'單字數' },
  pp_sep: { bg:'Разделител', ru:'Разделитель', uk:'Роздільник', en:'Separator', de:'Trennzeichen', fr:'Séparateur', es:'Separador', 'es-MX':'Separador', it:'Separatore', pt:'Separador', ar:'الفاصل', hi:'विभाजक', ja:'区切り', ky:'Бөлгүч', 'zh-Hant':'分隔符' },
  pp_cap: { bg:'Главна буква на всяка дума', ru:'Заглавная буква каждого слова', uk:'Велика літера кожного слова', en:'Capitalize each word', de:'Jedes Wort groß', fr:'Majuscule à chaque mot', es:'Mayúscula en cada palabra', 'es-MX':'Mayúscula en cada palabra', it:'Maiuscola per ogni parola', pt:'Maiúscula em cada palavra', ar:'حرف كبير لكل كلمة', hi:'हर शब्द का पहला अक्षर बड़ा', ja:'各単語を大文字始まり', ky:'Ар бир сөз баш тамга', 'zh-Hant':'每個單字首字母大寫' },
  pp_num: { bg:'Добави цифра и знак', ru:'Добавить цифру и знак', uk:'Додати цифру і знак', en:'Add a digit and a symbol', de:'Ziffer und Zeichen anhängen', fr:'Ajouter un chiffre et un symbole', es:'Añadir un dígito y un símbolo', 'es-MX':'Agregar un dígito y un símbolo', it:'Aggiungi cifra e simbolo', pt:'Adicionar dígito e símbolo', ar:'إضافة رقم ورمز', hi:'अंक और चिह्न जोड़ें', ja:'数字と記号を追加', ky:'Цифра жана белги кош', 'zh-Hant':'加入數字與符號' },
  pp_gen: { bg:'Генерирай 5 варианта', ru:'Создать 5 вариантов', uk:'Створити 5 варіантів', en:'Generate 5 variants', de:'5 Varianten erzeugen', fr:'Générer 5 variantes', es:'Generar 5 variantes', 'es-MX':'Generar 5 variantes', it:'Genera 5 varianti', pt:'Gerar 5 variantes', ar:'إنشاء 5 خيارات', hi:'5 विकल्प बनाएँ', ja:'5案を生成', ky:'5 вариант түзүү', 'zh-Hant':'產生 5 個變體' },
  pp_tap: { bg:'Докосни, за да копираш', ru:'Нажмите, чтобы скопировать', uk:'Торкніться, щоб скопіювати', en:'Tap to copy', de:'Tippen zum Kopieren', fr:'Touchez pour copier', es:'Toca para copiar', 'es-MX':'Toca para copiar', it:'Tocca per copiare', pt:'Toque para copiar', ar:'اضغط للنسخ', hi:'कॉपी करने के लिए टैप करें', ja:'タップでコピー', ky:'Көчүрүү үчүн бас', 'zh-Hant':'點一下複製' },
  pp_copied: { bg:'Копирано ✓', ru:'Скопировано ✓', uk:'Скопійовано ✓', en:'Copied ✓', de:'Kopiert ✓', fr:'Copié ✓', es:'Copiado ✓', 'es-MX':'Copiado ✓', it:'Copiato ✓', pt:'Copiado ✓', ar:'تم النسخ ✓', hi:'कॉपी हो गया ✓', ja:'コピーしました ✓', ky:'Көчүрүлдү ✓', 'zh-Hant':'已複製 ✓' }
});

export const title = 'Passphrase';

const DICT = {
  en: 'apple river mountain cloud book chair window star sea forest flower stone wind sun moon bridge garden horse candle silver dragon castle island rocket pencil tiger lemon coffee winter summer autumn spring copper marble velvet thunder meadow harbor falcon comet piano violin saddle anchor lantern compass orchard canyon glacier ember pepper maple walnut cactus turtle salmon otter panda zebra koala eagle raven spider beetle butterfly ladder hammer needle basket bucket carpet mirror pillow blanket helmet jacket pocket ribbon button zipper wallet ticket puzzle rocket engine planet galaxy nebula crystal diamond emerald sapphire ruby amber'.split(' '),
  bg: 'ябълка река планина облак книга стол прозорец звезда море гора цвете камък вятър слънце луна мост градина кон свещ сребро дракон замък остров ракета молив тигър лимон кафе зима лято есен пролет мед мрамор кадифе гръм ливада пристанище сокол комета пиано цигулка седло котва фенер компас овощна каньон ледник жарава пипер клен орех кактус костенурка сьомга видра панда зебра коала орел гарван паяк бръмбар пеперуда стълба чук игла кошница кофа килим огледало възглавница одеяло шлем яке джоб панделка копче цип портфейл билет пъзел двигател планета галактика кристал диамант смарагд сапфир рубин кехлибар'.split(' '),
  ru: 'яблоко река гора облако книга стул окно звезда море лес цветок камень ветер солнце луна мост сад лошадь свеча серебро дракон замок остров ракета карандаш тигр лимон кофе зима лето осень весна медь мрамор бархат гром луг гавань сокол комета пианино скрипка седло якорь фонарь компас каньон ледник уголёк перец клён орех кактус черепаха лосось выдра панда зебра коала орёл ворон паук жук бабочка лестница молоток игла корзина ведро ковёр зеркало подушка одеяло шлем куртка карман лента пуговица молния кошелёк билет пазл двигатель планета галактика кристалл алмаз изумруд сапфир рубин янтарь'.split(' '),
  de: 'Apfel Fluss Berg Wolke Buch Stuhl Fenster Stern Meer Wald Blume Stein Wind Sonne Mond Brücke Garten Pferd Kerze Silber Drache Burg Insel Rakete Bleistift Tiger Zitrone Kaffee Winter Sommer Herbst Frühling Kupfer Marmor Samt Donner Wiese Hafen Falke Komet Klavier Geige Sattel Anker Laterne Kompass Schlucht Gletscher Glut Pfeffer Ahorn Walnuss Kaktus Schildkröte Lachs Otter Panda Zebra Koala Adler Rabe Spinne Käfer Schmetterling Leiter Hammer Nadel Korb Eimer Teppich Spiegel Kissen Decke Helm Jacke Tasche Band Knopf Reißverschluss Brieftasche Ticket Puzzle Motor Planet Galaxie Kristall Diamant Smaragd Saphir Rubin Bernstein'.split(' '),
  es: 'manzana río montaña nube libro silla ventana estrella mar bosque flor piedra viento sol luna puente jardín caballo vela plata dragón castillo isla cohete lápiz tigre limón café invierno verano otoño primavera cobre mármol terciopelo trueno prado puerto halcón cometa piano violín silla ancla farol brújula cañón glaciar brasa pimienta arce nuez cactus tortuga salmón nutria panda cebra koala águila cuervo araña escarabajo mariposa escalera martillo aguja cesta cubo alfombra espejo almohada manta casco chaqueta bolsillo cinta botón cremallera cartera boleto rompecabezas motor planeta galaxia cristal diamante esmeralda zafiro rubí ámbar'.split(' '),
  fr: 'pomme rivière montagne nuage livre chaise fenêtre étoile mer forêt fleur pierre vent soleil lune pont jardin cheval bougie argent dragon château île fusée crayon tigre citron café hiver été automne printemps cuivre marbre velours tonnerre prairie port faucon comète piano violon selle ancre lanterne boussole canyon glacier braise poivre érable noix cactus tortue saumon loutre panda zèbre koala aigle corbeau araignée scarabée papillon échelle marteau aiguille panier seau tapis miroir oreiller couverture casque veste poche ruban bouton fermeture portefeuille billet puzzle moteur planète galaxie cristal diamant émeraude saphir rubis ambre'.split(' ')
};
function rnd(max) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max; }
export function makePhrase(lang, count, sep, cap, extra) {
  const d = DICT[lang] || DICT.en; const words = [];
  for (let i = 0; i < count; i++) { let w = d[rnd(d.length)]; if (cap) w = w[0].toUpperCase() + w.slice(1); words.push(w); }
  let s = words.join(sep);
  if (extra) s += String(rnd(10)) + '!@#$%&*?'[rnd(8)];
  return s;
}

export function render(root) {
  const langs = Object.keys(DICT);
  root.innerHTML = `
    <div class="tool-card">
      <p class="hint">${esc(t('pp_hint'))}</p>
      <label>${esc(t('pp_lang'))}</label>
      <select id="pp-lang">${langs.map((l) => `<option value="${l}">${l.toUpperCase()}</option>`).join('')}</select>
      <label>${esc(t('pp_count'))}: <span id="pp-cv">4</span></label>
      <input type="range" id="pp-count" min="3" max="8" value="4" />
      <label>${esc(t('pp_sep'))}</label>
      <select id="pp-sep"><option value="-">-</option><option value=".">.</option><option value="_">_</option><option value=" ">␣</option><option value="">∅</option></select>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="pp-cap" checked> ${esc(t('pp_cap'))}</label>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="pp-num" checked> ${esc(t('pp_num'))}</label>
      <button class="btn" id="pp-gen">${esc(t('pp_gen'))}</button>
      <p class="hint">${esc(t('pp_tap'))}</p>
      <div id="pp-out"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  $('#pp-count').addEventListener('input', (e) => { $('#pp-cv').textContent = e.target.value; });
  const gen = () => {
    const out = $('#pp-out'); out.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = makePhrase($('#pp-lang').value, parseInt($('#pp-count').value, 10), $('#pp-sep').value, $('#pp-cap').checked, $('#pp-num').checked);
      const bits = analyze(s).bits;
      const row = document.createElement('div');
      row.style.cssText = 'padding:10px;margin:6px 0;border:1px solid rgba(127,127,127,.35);border-radius:10px;cursor:pointer;word-break:break-all';
      row.innerHTML = `<div style="font-family:monospace;font-size:16px">${esc(s)}</div><div class="hint">${bits} bits</div>`;
      row.addEventListener('click', async () => { if (await copyText(s)) { const h = row.querySelector('.hint'); h.textContent = t('pp_copied'); setTimeout(() => { h.textContent = bits + ' bits'; }, 900); } });
      out.appendChild(row);
    }
  };
  $('#pp-gen').addEventListener('click', gen);
  gen();
}
