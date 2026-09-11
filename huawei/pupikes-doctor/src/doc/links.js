// Version: 1.0023
// links.js — „Повече за това": ЛИНКОВЕ към надеждни публични страници на езика на интерфейса (11.09.2026, искане на
// собственика: онлайн информацията се тегли при нужда, апът не носи бази с описания). Нищо не се тегли тук —
// само се строят URL-и, които се отварят в системния браузър. Вградените пакети reference/*.json остават
// основните данни за 25-те чести състояния; линковете са „за повече".
//   • Wikipedia на езика: директна статия, ако вграденият пакет знае заглавието (langs[lang].title), иначе търсене
//     по името на състоянието на езика; + английската статия (винаги).
//   • MedlinePlus (NIH, en; на испански — испанската версия) и NHS (en) — здравни теми.
//   • По един надежден източник на езика: MSD Manuals (потребителска версия) за ru/uk/de/fr/es/it/pt/ar/hi/ja/zh;
//     gesund.bund.de за de; за bg/ky няма проверен източник → търсене в Wikipedia на езика.
import { LANGUAGES } from '../core/languages.js';
import { condName } from './i18n-doc.js';

// Английски заглавия в Wikipedia (директни статии).
const EN_TITLE = { bruise: 'Bruise', fracture: 'Bone_fracture', sprain: 'Sprain', cut: 'Wound', burn: 'Burn', bite: 'Insect_bites_and_stings', rash: 'Rash', infection: 'Skin_infection', swelling: 'Swelling_(medical)', nosebleed: 'Nosebleed', blister: 'Blister', abrasion: 'Abrasion_(medical)', boil: 'Boil', eczema: 'Dermatitis', psoriasis: 'Psoriasis', fungal: 'Dermatophytosis', hives: 'Hives', sunburn: 'Sunburn', frostbite: 'Frostbite', dislocation: 'Joint_dislocation', muscle_strain: 'Strain_(injury)', ingrown_nail: 'Ingrown_nail' };
// Английско име за търсене (NHS/MSD).
const EN_NAME = { bruise: 'bruise', fracture: 'fracture', sprain: 'sprain', cut: 'cut wound', burn: 'burn', bite: 'insect bite', rash: 'rash', infection: 'skin infection', swelling: 'swelling', nosebleed: 'nosebleed', blister: 'blister', abrasion: 'abrasion', boil: 'boil', eczema: 'eczema', psoriasis: 'psoriasis', fungal: 'fungal skin infection', hives: 'hives', sunburn: 'sunburn', frostbite: 'frostbite', dislocation: 'dislocation', muscle_strain: 'muscle strain', ingrown_nail: 'ingrown toenail' };
// MedlinePlus здравни теми (проверени 11.09.2026); стойност с „/" = статия от енциклопедията (.htm).
const MEDLINE = { bruise: 'bruises', fracture: 'fractures', sprain: 'sprainsandstrains', cut: 'woundsandinjuries', burn: 'burns', bite: 'insectbitesandstings', rash: 'rashes', infection: 'skininfections', swelling: 'edema', nosebleed: 'ency/article/003106', blister: 'blisters', abrasion: 'woundsandinjuries', boil: 'abscess', eczema: 'eczema', psoriasis: 'psoriasis', fungal: 'fungalinfections', hives: 'hives', sunburn: 'sunexposure', frostbite: 'frostbite', dislocation: 'dislocations', muscle_strain: 'sprainsandstrains', ingrown_nail: 'naildiseases' };
// MSD Manuals — потребителска версия, път по език (проверени: връщат 200).
const MSD = { ru: 'ru/home', uk: 'uk/home', de: 'de/heim', fr: 'fr/accueil', es: 'es/hogar', 'es-MX': 'es/hogar', it: 'it/casa', pt: 'pt/casa', ar: 'ar/home', hi: 'hi/home', ja: 'ja-jp/ホーム', 'zh-Hant': 'zh/home' };
// Език на интерфейса → под-домейн на Wikipedia и ключ в пакета reference/*.json.
function wikiLang(lang) { if (lang === 'zh-Hant') return { sub: 'zh', key: 'zh', variant: 'zh-tw' }; const b = String(lang || 'en').split('-')[0]; return { sub: b, key: b, variant: '' }; }
function native(lang) { const l = LANGUAGES.find((x) => x.code === lang) || LANGUAGES.find((x) => x.code === String(lang).split('-')[0]); return l ? l.native : lang; }

// pack = обектът от reference/<id>.json (или null). Връща [{ name, url }] — първо на езика, после en.
export function linksFor(id, lang, pack) {
  const out = []; const W = wikiLang(lang); const nm = condName(id); const en = EN_NAME[id] || id.replace(/_/g, ' ');
  const title = pack && pack.langs && pack.langs[W.key] && pack.langs[W.key].title;
  if (W.sub !== 'en') {
    if (title) out.push({ name: 'Wikipedia (' + native(lang) + ')', url: 'https://' + W.sub + '.wikipedia.org/' + (W.variant ? W.variant + '/' : 'wiki/') + encodeURIComponent(String(title).replace(/ /g, '_')) });
    else out.push({ name: 'Wikipedia (' + native(lang) + ')', url: 'https://' + W.sub + '.wikipedia.org/w/index.php?search=' + encodeURIComponent(nm), search: true });
  }
  if (MSD[lang] || MSD[W.key]) out.push({ name: 'MSD Manuals (' + native(lang) + ')', url: 'https://www.msdmanuals.com/' + (MSD[lang] || MSD[W.key]) + '/SearchResults?query=' + encodeURIComponent(en), search: true });
  if (W.key === 'de') out.push({ name: 'gesund.bund.de', url: 'https://gesund.bund.de/suche?query=' + encodeURIComponent(nm), search: true });
  const ml = MEDLINE[id];
  if (ml) { const es = W.key === 'es'; out.push({ name: 'MedlinePlus (' + (es ? 'Español' : 'English') + ')', url: 'https://medlineplus.gov/' + (es ? 'spanish/' : '') + ml + (ml.indexOf('/') >= 0 ? '.htm' : '.html') }); }
  out.push({ name: 'NHS (English)', url: 'https://www.nhs.uk/search/results?q=' + encodeURIComponent(en), search: true });
  out.push({ name: 'Wikipedia (English)', url: 'https://en.wikipedia.org/wiki/' + (EN_TITLE[id] || encodeURIComponent(en)) });
  return out;
}
// Отваряне в системния браузър: Capacitor Browser (ако е наличен) → window.open(_blank) (Capacitor го праща
// навън) → location. Същият ред като core/ecosystem.js.
export function openExternal(url) {
  try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url }); return; } } catch (e) {}
  try { const w = window.open(url, '_blank', 'noopener'); if (w) return; } catch (e) {}
  try { location.href = url; } catch (e2) {}
}
