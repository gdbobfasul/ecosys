// Version: 1.0013
// rss-directory.js — ГОЛЕМИЯТ КАТАЛОГ с емисии на „KCY Site Monitor".
//
// ДВА слоя (както newslator, но многократно по-голям и с категории):
//  1) ПРОВЕРЕНИ ПОИМЕННИ източници (222 емисии, проверени наживо при генерирането):
//     официални телевизии/радиа/вестници/агенции + научни, икономически, юридически,
//     технологични и здравни професионални източници. Мъртъв URL просто се прескача.
//  2) ГЕНЕРИРАНИ Google News емисии за ВСЯКА от ${COUNTRIES.length} държави: обща + по
//     официалните категории (бизнес, технологии, наука, здраве, спорт, развлечения, свят,
//     местни) → гарантирано покритие за всички държави по света на местния език.
//
// Файлът се ГЕНЕРИРА от deploy-scripts/../scratchpad gen-rss-directory.mjs — не се пише на ръка.

export const REGIONS = ['europe', 'middle_east', 'asia', 'africa', 'americas', 'oceania'];

export const COUNTRIES = [
  // ── Европа ──
  { code: 'BG', name: 'Bulgaria', region: 'europe', hl: 'bg' },
  { code: 'GB', name: 'United Kingdom', region: 'europe', hl: 'en' },
  { code: 'IE', name: 'Ireland', region: 'europe', hl: 'en' },
  { code: 'DE', name: 'Germany', region: 'europe', hl: 'de' },
  { code: 'AT', name: 'Austria', region: 'europe', hl: 'de' },
  { code: 'CH', name: 'Switzerland', region: 'europe', hl: 'de' },
  { code: 'FR', name: 'France', region: 'europe', hl: 'fr' },
  { code: 'BE', name: 'Belgium', region: 'europe', hl: 'fr' },
  { code: 'NL', name: 'Netherlands', region: 'europe', hl: 'nl' },
  { code: 'ES', name: 'Spain', region: 'europe', hl: 'es' },
  { code: 'PT', name: 'Portugal', region: 'europe', hl: 'pt-PT' },
  { code: 'IT', name: 'Italy', region: 'europe', hl: 'it' },
  { code: 'GR', name: 'Greece', region: 'europe', hl: 'el' },
  { code: 'PL', name: 'Poland', region: 'europe', hl: 'pl' },
  { code: 'CZ', name: 'Czechia', region: 'europe', hl: 'cs' },
  { code: 'SK', name: 'Slovakia', region: 'europe', hl: 'sk' },
  { code: 'HU', name: 'Hungary', region: 'europe', hl: 'hu' },
  { code: 'RO', name: 'Romania', region: 'europe', hl: 'ro' },
  { code: 'RS', name: 'Serbia', region: 'europe', hl: 'sr' },
  { code: 'HR', name: 'Croatia', region: 'europe', hl: 'hr' },
  { code: 'SI', name: 'Slovenia', region: 'europe', hl: 'sl' },
  { code: 'BA', name: 'Bosnia and Herzegovina', region: 'europe', hl: 'bs' },
  { code: 'MK', name: 'North Macedonia', region: 'europe', hl: 'mk' },
  { code: 'AL', name: 'Albania', region: 'europe', hl: 'sq' },
  { code: 'ME', name: 'Montenegro', region: 'europe', hl: 'sr' },
  { code: 'UA', name: 'Ukraine', region: 'europe', hl: 'uk' },
  { code: 'BY', name: 'Belarus', region: 'europe', hl: 'ru' },
  { code: 'RU', name: 'Russia', region: 'europe', hl: 'ru' },
  { code: 'MD', name: 'Moldova', region: 'europe', hl: 'ro' },
  { code: 'LT', name: 'Lithuania', region: 'europe', hl: 'lt' },
  { code: 'LV', name: 'Latvia', region: 'europe', hl: 'lv' },
  { code: 'EE', name: 'Estonia', region: 'europe', hl: 'et' },
  { code: 'FI', name: 'Finland', region: 'europe', hl: 'fi' },
  { code: 'SE', name: 'Sweden', region: 'europe', hl: 'sv' },
  { code: 'NO', name: 'Norway', region: 'europe', hl: 'no' },
  { code: 'DK', name: 'Denmark', region: 'europe', hl: 'da' },
  { code: 'IS', name: 'Iceland', region: 'europe', hl: 'is' },
  { code: 'LU', name: 'Luxembourg', region: 'europe', hl: 'fr' },
  { code: 'MT', name: 'Malta', region: 'europe', hl: 'en' },
  { code: 'CY', name: 'Cyprus', region: 'europe', hl: 'el' },

  // ── Близък изток ──
  { code: 'TR', name: 'Turkey', region: 'middle_east', hl: 'tr' },
  { code: 'IL', name: 'Israel', region: 'middle_east', hl: 'he' },
  { code: 'PS', name: 'Palestine', region: 'middle_east', hl: 'ar' },
  { code: 'SA', name: 'Saudi Arabia', region: 'middle_east', hl: 'ar' },
  { code: 'AE', name: 'United Arab Emirates', region: 'middle_east', hl: 'ar' },
  { code: 'QA', name: 'Qatar', region: 'middle_east', hl: 'ar' },
  { code: 'KW', name: 'Kuwait', region: 'middle_east', hl: 'ar' },
  { code: 'BH', name: 'Bahrain', region: 'middle_east', hl: 'ar' },
  { code: 'OM', name: 'Oman', region: 'middle_east', hl: 'ar' },
  { code: 'YE', name: 'Yemen', region: 'middle_east', hl: 'ar' },
  { code: 'JO', name: 'Jordan', region: 'middle_east', hl: 'ar' },
  { code: 'LB', name: 'Lebanon', region: 'middle_east', hl: 'ar' },
  { code: 'SY', name: 'Syria', region: 'middle_east', hl: 'ar' },
  { code: 'IQ', name: 'Iraq', region: 'middle_east', hl: 'ar' },
  { code: 'IR', name: 'Iran', region: 'middle_east', hl: 'fa' },

  // ── Азия ──
  { code: 'IN', name: 'India', region: 'asia', hl: 'en-IN' },
  { code: 'PK', name: 'Pakistan', region: 'asia', hl: 'en-PK' },
  { code: 'BD', name: 'Bangladesh', region: 'asia', hl: 'bn' },
  { code: 'LK', name: 'Sri Lanka', region: 'asia', hl: 'en' },
  { code: 'NP', name: 'Nepal', region: 'asia', hl: 'ne' },
  { code: 'AF', name: 'Afghanistan', region: 'asia', hl: 'fa' },
  { code: 'CN', name: 'China', region: 'asia', hl: 'zh-CN' },
  { code: 'TW', name: 'Taiwan, China', region: 'asia', hl: 'zh-TW', flag: '🇨🇳' },
  { code: 'HK', name: 'Hong Kong, China', region: 'asia', hl: 'zh-HK', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', region: 'asia', hl: 'ja' },
  { code: 'KR', name: 'South Korea', region: 'asia', hl: 'ko' },
  { code: 'MN', name: 'Mongolia', region: 'asia', hl: 'mn' },
  { code: 'KZ', name: 'Kazakhstan', region: 'asia', hl: 'ru' },
  { code: 'KG', name: 'Kyrgyzstan', region: 'asia', hl: 'ru' },
  { code: 'UZ', name: 'Uzbekistan', region: 'asia', hl: 'ru' },
  { code: 'TJ', name: 'Tajikistan', region: 'asia', hl: 'ru' },
  { code: 'TM', name: 'Turkmenistan', region: 'asia', hl: 'ru' },
  { code: 'GE', name: 'Georgia', region: 'asia', hl: 'ka' },
  { code: 'AM', name: 'Armenia', region: 'asia', hl: 'hy' },
  { code: 'AZ', name: 'Azerbaijan', region: 'asia', hl: 'az' },
  { code: 'TH', name: 'Thailand', region: 'asia', hl: 'th' },
  { code: 'VN', name: 'Vietnam', region: 'asia', hl: 'vi' },
  { code: 'PH', name: 'Philippines', region: 'asia', hl: 'en-PH' },
  { code: 'ID', name: 'Indonesia', region: 'asia', hl: 'id' },
  { code: 'MY', name: 'Malaysia', region: 'asia', hl: 'ms' },
  { code: 'SG', name: 'Singapore', region: 'asia', hl: 'en' },
  { code: 'MM', name: 'Myanmar', region: 'asia', hl: 'my' },
  { code: 'KH', name: 'Cambodia', region: 'asia', hl: 'km' },
  { code: 'LA', name: 'Laos', region: 'asia', hl: 'lo' },
  { code: 'BN', name: 'Brunei', region: 'asia', hl: 'ms' },

  // ── Африка ──
  { code: 'EG', name: 'Egypt', region: 'africa', hl: 'ar' },
  { code: 'LY', name: 'Libya', region: 'africa', hl: 'ar' },
  { code: 'TN', name: 'Tunisia', region: 'africa', hl: 'ar' },
  { code: 'DZ', name: 'Algeria', region: 'africa', hl: 'ar' },
  { code: 'MA', name: 'Morocco', region: 'africa', hl: 'ar' },
  { code: 'SD', name: 'Sudan', region: 'africa', hl: 'ar' },
  { code: 'NG', name: 'Nigeria', region: 'africa', hl: 'en-NG' },
  { code: 'GH', name: 'Ghana', region: 'africa', hl: 'en' },
  { code: 'KE', name: 'Kenya', region: 'africa', hl: 'en-KE' },
  { code: 'TZ', name: 'Tanzania', region: 'africa', hl: 'sw' },
  { code: 'UG', name: 'Uganda', region: 'africa', hl: 'en' },
  { code: 'ET', name: 'Ethiopia', region: 'africa', hl: 'am' },
  { code: 'ZA', name: 'South Africa', region: 'africa', hl: 'en-ZA' },
  { code: 'ZW', name: 'Zimbabwe', region: 'africa', hl: 'en' },
  { code: 'ZM', name: 'Zambia', region: 'africa', hl: 'en' },
  { code: 'MZ', name: 'Mozambique', region: 'africa', hl: 'pt-PT' },
  { code: 'AO', name: 'Angola', region: 'africa', hl: 'pt-PT' },
  { code: 'CM', name: 'Cameroon', region: 'africa', hl: 'fr' },
  { code: 'CI', name: "Côte d'Ivoire", region: 'africa', hl: 'fr' },
  { code: 'SN', name: 'Senegal', region: 'africa', hl: 'fr' },
  { code: 'ML', name: 'Mali', region: 'africa', hl: 'fr' },
  { code: 'CD', name: 'DR Congo', region: 'africa', hl: 'fr' },
  { code: 'RW', name: 'Rwanda', region: 'africa', hl: 'en' },
  { code: 'BW', name: 'Botswana', region: 'africa', hl: 'en' },
  { code: 'NA', name: 'Namibia', region: 'africa', hl: 'en' },
  { code: 'MU', name: 'Mauritius', region: 'africa', hl: 'en' },

  // ── Северна и Южна Америка ──
  { code: 'US', name: 'United States', region: 'americas', hl: 'en-US' },
  { code: 'CA', name: 'Canada', region: 'americas', hl: 'en-CA' },
  { code: 'MX', name: 'Mexico', region: 'americas', hl: 'es-419' },
  { code: 'GT', name: 'Guatemala', region: 'americas', hl: 'es-419' },
  { code: 'CU', name: 'Cuba', region: 'americas', hl: 'es-419' },
  { code: 'DO', name: 'Dominican Republic', region: 'americas', hl: 'es-419' },
  { code: 'CR', name: 'Costa Rica', region: 'americas', hl: 'es-419' },
  { code: 'PA', name: 'Panama', region: 'americas', hl: 'es-419' },
  { code: 'CO', name: 'Colombia', region: 'americas', hl: 'es-419' },
  { code: 'VE', name: 'Venezuela', region: 'americas', hl: 'es-419' },
  { code: 'PE', name: 'Peru', region: 'americas', hl: 'es-419' },
  { code: 'EC', name: 'Ecuador', region: 'americas', hl: 'es-419' },
  { code: 'BO', name: 'Bolivia', region: 'americas', hl: 'es-419' },
  { code: 'CL', name: 'Chile', region: 'americas', hl: 'es-419' },
  { code: 'AR', name: 'Argentina', region: 'americas', hl: 'es-419' },
  { code: 'UY', name: 'Uruguay', region: 'americas', hl: 'es-419' },
  { code: 'PY', name: 'Paraguay', region: 'americas', hl: 'es-419' },
  { code: 'BR', name: 'Brazil', region: 'americas', hl: 'pt-BR' },

  // ── Океания ──
  { code: 'AU', name: 'Australia', region: 'oceania', hl: 'en-AU' },
  { code: 'NZ', name: 'New Zealand', region: 'oceania', hl: 'en-NZ' },
  { code: 'FJ', name: 'Fiji', region: 'oceania', hl: 'en' },
  { code: 'PG', name: 'Papua New Guinea', region: 'oceania', hl: 'en' },

  // ── Допълнени държави (пълно покритие ~195) ──
  // По-малките държави ползват само Google News агрегатора (по-малко новини, но винаги има).
  // Европа
  { code: 'AD', name: 'Andorra', region: 'europe', hl: 'ca' },
  { code: 'MC', name: 'Monaco', region: 'europe', hl: 'fr' },
  { code: 'LI', name: 'Liechtenstein', region: 'europe', hl: 'de' },
  { code: 'SM', name: 'San Marino', region: 'europe', hl: 'it' },
  { code: 'VA', name: 'Vatican City', region: 'europe', hl: 'it' },
  { code: 'XK', name: 'Kosovo', region: 'europe', hl: 'sq' },
  // Азия
  { code: 'BT', name: 'Bhutan', region: 'asia', hl: 'en' },
  { code: 'MV', name: 'Maldives', region: 'asia', hl: 'en' },
  { code: 'KP', name: 'North Korea', region: 'asia', hl: 'ko' },
  { code: 'TL', name: 'Timor-Leste', region: 'asia', hl: 'pt-PT' },
  // Африка
  { code: 'BJ', name: 'Benin', region: 'africa', hl: 'fr' },
  { code: 'BF', name: 'Burkina Faso', region: 'africa', hl: 'fr' },
  { code: 'BI', name: 'Burundi', region: 'africa', hl: 'fr' },
  { code: 'CV', name: 'Cabo Verde', region: 'africa', hl: 'pt-PT' },
  { code: 'CF', name: 'Central African Republic', region: 'africa', hl: 'fr' },
  { code: 'TD', name: 'Chad', region: 'africa', hl: 'fr' },
  { code: 'KM', name: 'Comoros', region: 'africa', hl: 'fr' },
  { code: 'CG', name: 'Congo', region: 'africa', hl: 'fr' },
  { code: 'DJ', name: 'Djibouti', region: 'africa', hl: 'fr' },
  { code: 'GQ', name: 'Equatorial Guinea', region: 'africa', hl: 'es' },
  { code: 'ER', name: 'Eritrea', region: 'africa', hl: 'en' },
  { code: 'SZ', name: 'Eswatini', region: 'africa', hl: 'en' },
  { code: 'GA', name: 'Gabon', region: 'africa', hl: 'fr' },
  { code: 'GM', name: 'Gambia', region: 'africa', hl: 'en' },
  { code: 'GN', name: 'Guinea', region: 'africa', hl: 'fr' },
  { code: 'GW', name: 'Guinea-Bissau', region: 'africa', hl: 'pt-PT' },
  { code: 'LS', name: 'Lesotho', region: 'africa', hl: 'en' },
  { code: 'LR', name: 'Liberia', region: 'africa', hl: 'en' },
  { code: 'MG', name: 'Madagascar', region: 'africa', hl: 'fr' },
  { code: 'MW', name: 'Malawi', region: 'africa', hl: 'en' },
  { code: 'MR', name: 'Mauritania', region: 'africa', hl: 'ar' },
  { code: 'NE', name: 'Niger', region: 'africa', hl: 'fr' },
  { code: 'ST', name: 'Sao Tome and Principe', region: 'africa', hl: 'pt-PT' },
  { code: 'SC', name: 'Seychelles', region: 'africa', hl: 'en' },
  { code: 'SL', name: 'Sierra Leone', region: 'africa', hl: 'en' },
  { code: 'SO', name: 'Somalia', region: 'africa', hl: 'en' },
  { code: 'SS', name: 'South Sudan', region: 'africa', hl: 'en' },
  { code: 'TG', name: 'Togo', region: 'africa', hl: 'fr' },
  // Америките
  { code: 'BZ', name: 'Belize', region: 'americas', hl: 'en' },
  { code: 'SV', name: 'El Salvador', region: 'americas', hl: 'es-419' },
  { code: 'HN', name: 'Honduras', region: 'americas', hl: 'es-419' },
  { code: 'NI', name: 'Nicaragua', region: 'americas', hl: 'es-419' },
  { code: 'HT', name: 'Haiti', region: 'americas', hl: 'fr' },
  { code: 'JM', name: 'Jamaica', region: 'americas', hl: 'en' },
  { code: 'TT', name: 'Trinidad and Tobago', region: 'americas', hl: 'en' },
  { code: 'BS', name: 'Bahamas', region: 'americas', hl: 'en' },
  { code: 'BB', name: 'Barbados', region: 'americas', hl: 'en' },
  { code: 'AG', name: 'Antigua and Barbuda', region: 'americas', hl: 'en' },
  { code: 'DM', name: 'Dominica', region: 'americas', hl: 'en' },
  { code: 'GD', name: 'Grenada', region: 'americas', hl: 'en' },
  { code: 'KN', name: 'Saint Kitts and Nevis', region: 'americas', hl: 'en' },
  { code: 'LC', name: 'Saint Lucia', region: 'americas', hl: 'en' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', region: 'americas', hl: 'en' },
  { code: 'GY', name: 'Guyana', region: 'americas', hl: 'en' },
  { code: 'SR', name: 'Suriname', region: 'americas', hl: 'nl' },
  // Океания
  { code: 'SB', name: 'Solomon Islands', region: 'oceania', hl: 'en' },
  { code: 'VU', name: 'Vanuatu', region: 'oceania', hl: 'en' },
  { code: 'WS', name: 'Samoa', region: 'oceania', hl: 'en' },
  { code: 'TO', name: 'Tonga', region: 'oceania', hl: 'en' },
  { code: 'KI', name: 'Kiribati', region: 'oceania', hl: 'en' },
  { code: 'TV', name: 'Tuvalu', region: 'oceania', hl: 'en' },
  { code: 'NR', name: 'Nauru', region: 'oceania', hl: 'en' },
  { code: 'FM', name: 'Micronesia', region: 'oceania', hl: 'en' },
  { code: 'MH', name: 'Marshall Islands', region: 'oceania', hl: 'en' },
  { code: 'PW', name: 'Palau', region: 'oceania', hl: 'en' }
];

const byCode = {};
COUNTRIES.forEach((c) => { byCode[c.code] = c; });
export function countryByCode(code) { return byCode[code] || null; }
export function countriesByRegion(region) {
  return COUNTRIES.filter((c) => c.region === region).sort((a, b) => a.name.localeCompare(b.name));
}

// Емоджи знаме от ISO кода (с override за специалните случаи, напр. Тайван/Хонконг → 🇨🇳).
export function flagOf(code) {
  const c = byCode[code];
  if (c && c.flag) return c.flag;
  if (!/^[A-Z]{2}$/.test(String(code || ''))) return '🌐';
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// Категории в каталога (ключовете за i18n са cat_<име>).
export const CATEGORIES = ['general', 'world', 'nation', 'business', 'tech', 'science', 'health', 'sports', 'entertainment', 'legal'];

// ── 1) Проверени поименни източници ──────────────────────────────────────────
// { c: ISO код ('' = световен), name, type: tv|radio|newspaper|agency|site,
//   cat: категория, official: официален ли е, lang, url }
export const OUTLETS = [
  { c:'BG', name:'БНТ', type:'tv', cat:'general', official:true, lang:'bg', url:'https://bntnews.bg/bg/rss/news.xml' },
  { c:'BG', name:'Дневник', type:'newspaper', cat:'general', official:false, lang:'bg', url:'https://www.dnevnik.bg/rss/' },
  { c:'BG', name:'Капитал', type:'newspaper', cat:'business', official:false, lang:'bg', url:'https://www.capital.bg/rss/' },
  { c:'GB', name:'BBC News', type:'tv', cat:'general', official:true, lang:'en', url:'https://feeds.bbci.co.uk/news/rss.xml' },
  { c:'GB', name:'BBC Business', type:'tv', cat:'business', official:true, lang:'en', url:'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { c:'GB', name:'BBC Science', type:'tv', cat:'science', official:true, lang:'en', url:'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { c:'GB', name:'BBC Technology', type:'tv', cat:'tech', official:true, lang:'en', url:'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { c:'GB', name:'BBC Health', type:'tv', cat:'health', official:true, lang:'en', url:'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { c:'GB', name:'Sky News', type:'tv', cat:'general', official:false, lang:'en', url:'https://feeds.skynews.com/feeds/rss/home.xml' },
  { c:'GB', name:'The Guardian', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.theguardian.com/uk/rss' },
  { c:'GB', name:'The Independent', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.independent.co.uk/rss' },
  { c:'GB', name:'The Telegraph', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.telegraph.co.uk/rss.xml' },
  { c:'GB', name:'Financial Times', type:'newspaper', cat:'business', official:false, lang:'en', url:'https://www.ft.com/rss/home' },
  { c:'IE', name:'RTÉ News', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.rte.ie/rss/news.xml' },
  { c:'IE', name:'The Irish Times', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.irishtimes.com/arc/outboundfeeds/feed-irish-news/' },
  { c:'DE', name:'Tagesschau', type:'tv', cat:'general', official:true, lang:'de', url:'https://www.tagesschau.de/index~rss2.xml' },
  { c:'DE', name:'Deutsche Welle', type:'tv', cat:'world', official:true, lang:'en', url:'https://rss.dw.com/rdf/rss-en-all' },
  { c:'DE', name:'Der Spiegel', type:'newspaper', cat:'general', official:false, lang:'de', url:'https://www.spiegel.de/schlagzeilen/tops/index.rss' },
  { c:'DE', name:'FAZ', type:'newspaper', cat:'general', official:false, lang:'de', url:'https://www.faz.net/rss/aktuell/' },
  { c:'DE', name:'Handelsblatt', type:'newspaper', cat:'business', official:false, lang:'de', url:'https://www.handelsblatt.com/contentexport/feed/schlagzeilen' },
  { c:'DE', name:'heise online', type:'site', cat:'tech', official:false, lang:'de', url:'https://www.heise.de/rss/heise-atom.xml' },
  { c:'AT', name:'ORF News', type:'tv', cat:'general', official:true, lang:'de', url:'https://rss.orf.at/news.xml' },
  { c:'AT', name:'Der Standard', type:'newspaper', cat:'general', official:false, lang:'de', url:'https://www.derstandard.at/rss' },
  { c:'CH', name:'NZZ', type:'newspaper', cat:'general', official:false, lang:'de', url:'https://www.nzz.ch/recent.rss' },
  { c:'FR', name:'France 24', type:'tv', cat:'general', official:true, lang:'fr', url:'https://www.france24.com/fr/rss' },
  { c:'FR', name:'RFI', type:'radio', cat:'general', official:true, lang:'fr', url:'https://www.rfi.fr/fr/rss' },
  { c:'FR', name:'Le Monde', type:'newspaper', cat:'general', official:false, lang:'fr', url:'https://www.lemonde.fr/rss/une.xml' },
  { c:'FR', name:'Le Figaro', type:'newspaper', cat:'general', official:false, lang:'fr', url:'https://www.lefigaro.fr/rss/figaro_actualites.xml' },
  { c:'FR', name:'Les Échos', type:'newspaper', cat:'business', official:false, lang:'fr', url:'https://services.lesechos.fr/rss/les-echos-economie.xml' },
  { c:'BE', name:'VRT NWS', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.vrt.be/vrtnws/en.rss.articles.xml' },
  { c:'NL', name:'NOS', type:'tv', cat:'general', official:true, lang:'nl', url:'https://feeds.nos.nl/nosnieuwsalgemeen' },
  { c:'NL', name:'NU.nl', type:'site', cat:'general', official:false, lang:'nl', url:'https://www.nu.nl/rss/Algemeen' },
  { c:'NL', name:'De Telegraaf', type:'newspaper', cat:'general', official:false, lang:'nl', url:'https://www.telegraaf.nl/rss' },
  { c:'ES', name:'RTVE', type:'tv', cat:'general', official:true, lang:'es', url:'https://api2.rtve.es/rss/temas_noticias.xml' },
  { c:'ES', name:'El País', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { c:'ES', name:'El Mundo', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml' },
  { c:'ES', name:'ABC', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.abc.es/rss/feeds/abcPortada.xml' },
  { c:'ES', name:'Expansión', type:'newspaper', cat:'business', official:false, lang:'es', url:'https://e00-expansion.uecdn.es/rss/portada.xml' },
  { c:'PT', name:'RTP', type:'tv', cat:'general', official:true, lang:'pt', url:'https://www.rtp.pt/noticias/rss' },
  { c:'PT', name:'Público', type:'newspaper', cat:'general', official:false, lang:'pt', url:'https://feeds.feedburner.com/PublicoRSS' },
  { c:'PT', name:'Observador', type:'site', cat:'general', official:false, lang:'pt', url:'https://observador.pt/feed/' },
  { c:'IT', name:'ANSA', type:'agency', cat:'general', official:true, lang:'it', url:'https://www.ansa.it/sito/ansait_rss.xml' },
  { c:'IT', name:'Rai News', type:'tv', cat:'general', official:true, lang:'it', url:'https://www.rainews.it/rss/tutti' },
  { c:'IT', name:'la Repubblica', type:'newspaper', cat:'general', official:false, lang:'it', url:'https://www.repubblica.it/rss/homepage/rss2.0.xml' },
  { c:'IT', name:'Corriere della Sera', type:'newspaper', cat:'general', official:false, lang:'it', url:'https://xml2.corriereobjects.it/rss/homepage.xml' },
  { c:'GR', name:'ERT News', type:'tv', cat:'general', official:true, lang:'el', url:'https://www.ert.gr/feed/' },
  { c:'PL', name:'TVN24', type:'tv', cat:'general', official:false, lang:'pl', url:'https://tvn24.pl/najnowsze.xml' },
  { c:'PL', name:'RMF24', type:'radio', cat:'general', official:false, lang:'pl', url:'https://www.rmf24.pl/fakty/feed' },
  { c:'PL', name:'Notes from Poland', type:'site', cat:'general', official:false, lang:'en', url:'https://notesfrompoland.com/feed/' },
  { c:'CZ', name:'iROZHLAS', type:'radio', cat:'general', official:true, lang:'cs', url:'https://www.irozhlas.cz/rss/irozhlas' },
  { c:'CZ', name:'iDNES', type:'site', cat:'general', official:false, lang:'cs', url:'https://servis.idnes.cz/rss.aspx?c=zpravodaj' },
  { c:'SK', name:'Aktuality.sk', type:'site', cat:'general', official:false, lang:'sk', url:'https://www.aktuality.sk/rss/' },
  { c:'HU', name:'Telex', type:'site', cat:'general', official:false, lang:'hu', url:'https://telex.hu/rss' },
  { c:'HU', name:'hvg.hu', type:'site', cat:'general', official:false, lang:'hu', url:'https://hvg.hu/rss' },
  { c:'RO', name:'Digi24', type:'tv', cat:'general', official:false, lang:'ro', url:'https://www.digi24.ro/rss' },
  { c:'RO', name:'HotNews', type:'site', cat:'general', official:false, lang:'ro', url:'https://hotnews.ro/feed' },
  { c:'RS', name:'N1', type:'tv', cat:'general', official:false, lang:'sr', url:'https://n1info.rs/feed/' },
  { c:'HR', name:'HRT Vijesti', type:'tv', cat:'general', official:true, lang:'hr', url:'https://www.hrt.hr/rss/vijesti' },
  { c:'HR', name:'Index.hr', type:'site', cat:'general', official:false, lang:'hr', url:'https://www.index.hr/rss' },
  { c:'SI', name:'RTVSLO', type:'tv', cat:'general', official:true, lang:'sl', url:'https://img.rtvslo.si/feeds/00.xml' },
  { c:'BA', name:'Klix.ba', type:'site', cat:'general', official:false, lang:'bs', url:'https://www.klix.ba/rss' },
  { c:'MK', name:'МИА', type:'agency', cat:'general', official:true, lang:'mk', url:'https://mia.mk/feed/' },
  { c:'ME', name:'Vijesti', type:'site', cat:'general', official:false, lang:'sr', url:'https://www.vijesti.me/rss' },
  { c:'XK', name:'Koha', type:'site', cat:'general', official:false, lang:'sq', url:'https://www.koha.net/rss' },
  { c:'UA', name:'Українська правда', type:'newspaper', cat:'general', official:false, lang:'uk', url:'https://www.pravda.com.ua/rss/' },
  { c:'RU', name:'TASS', type:'agency', cat:'general', official:true, lang:'en', url:'https://tass.com/rss/v2.xml' },
  { c:'RU', name:'Meduza', type:'site', cat:'general', official:false, lang:'ru', url:'https://meduza.io/rss/all' },
  { c:'RU', name:'Интерфакс', type:'agency', cat:'general', official:false, lang:'ru', url:'https://www.interfax.ru/rss.asp' },
  { c:'RU', name:'РБК', type:'site', cat:'business', official:false, lang:'ru', url:'https://rssexport.rbc.ru/rbcnews/news/30/full.rss' },
  { c:'BY', name:'Зеркало', type:'site', cat:'general', official:false, lang:'ru', url:'https://news.zerkalo.io/rss/all.rss' },
  { c:'LT', name:'Delfi LT', type:'site', cat:'general', official:false, lang:'lt', url:'https://www.delfi.lt/rss/feeds/daily.xml' },
  { c:'LV', name:'LSM', type:'tv', cat:'general', official:true, lang:'lv', url:'https://www.lsm.lv/rss/' },
  { c:'EE', name:'ERR News', type:'tv', cat:'general', official:true, lang:'en', url:'https://news.err.ee/rss' },
  { c:'FI', name:'Yle Uutiset', type:'tv', cat:'general', official:true, lang:'fi', url:'https://feeds.yle.fi/uutiset/v1/majorHeadlines/YLE_UUTISET.rss' },
  { c:'FI', name:'Helsingin Sanomat', type:'newspaper', cat:'general', official:false, lang:'fi', url:'https://www.hs.fi/rss/tuoreimmat.xml' },
  { c:'SE', name:'SVT Nyheter', type:'tv', cat:'general', official:true, lang:'sv', url:'https://www.svt.se/nyheter/rss.xml' },
  { c:'SE', name:'Dagens Nyheter', type:'newspaper', cat:'general', official:false, lang:'sv', url:'https://www.dn.se/rss/' },
  { c:'NO', name:'NRK', type:'tv', cat:'general', official:true, lang:'no', url:'https://www.nrk.no/toppsaker.rss' },
  { c:'NO', name:'Aftenposten', type:'newspaper', cat:'general', official:false, lang:'no', url:'https://www.aftenposten.no/rss' },
  { c:'DK', name:'DR Nyheder', type:'tv', cat:'general', official:true, lang:'da', url:'https://www.dr.dk/nyheder/service/feeds/allenyheder' },
  { c:'IS', name:'RÚV', type:'tv', cat:'general', official:true, lang:'is', url:'https://www.ruv.is/rss/frettir' },
  { c:'CY', name:'Cyprus Mail', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://cyprus-mail.com/feed/' },
  { c:'LU', name:'Luxembourg Times', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.luxtimes.lu/en/rss' },
  { c:'TR', name:'Anadolu Agency', type:'agency', cat:'general', official:true, lang:'en', url:'https://www.aa.com.tr/en/rss/default?cat=guncel' },
  { c:'TR', name:'Hürriyet Daily News', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.hurriyetdailynews.com/rss' },
  { c:'TR', name:'Daily Sabah', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.dailysabah.com/rssFeed/10' },
  { c:'IL', name:'The Jerusalem Post', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.jpost.com/rss/rssfeedsfrontpage.aspx' },
  { c:'IL', name:'Ynetnews', type:'site', cat:'general', official:false, lang:'en', url:'https://www.ynetnews.com/Integration/StoryRss3082.xml' },
  { c:'QA', name:'Al Jazeera', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.aljazeera.com/xml/rss/all.xml' },
  { c:'SA', name:'Arab News', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.arabnews.com/rss.xml' },
  { c:'SA', name:'Saudi Gazette', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://saudigazette.com.sa/rssFeed/74' },
  { c:'OM', name:'Times of Oman', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://timesofoman.com/feed' },
  { c:'SY', name:'SANA', type:'agency', cat:'general', official:true, lang:'en', url:'https://sana.sy/en/?feed=rss2' },
  { c:'IR', name:'Press TV', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.presstv.ir/rss.xml' },
  { c:'IR', name:'IRNA', type:'agency', cat:'general', official:true, lang:'en', url:'https://en.irna.ir/rss' },
  { c:'IN', name:'The Hindu', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.thehindu.com/news/national/feeder/default.rss' },
  { c:'IN', name:'The Times of India', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { c:'IN', name:'NDTV', type:'tv', cat:'general', official:false, lang:'en', url:'https://feeds.feedburner.com/ndtvnews-top-stories' },
  { c:'IN', name:'Hindustan Times', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml' },
  { c:'IN', name:'The Economic Times', type:'newspaper', cat:'business', official:false, lang:'en', url:'https://economictimes.indiatimes.com/rssfeedstopstories.cms' },
  { c:'PK', name:'Dawn', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.dawn.com/feeds/home' },
  { c:'PK', name:'The Express Tribune', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://tribune.com.pk/feed/home' },
  { c:'BD', name:'The Daily Star', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.thedailystar.net/frontpage/rss.xml' },
  { c:'LK', name:'Ada Derana', type:'tv', cat:'general', official:false, lang:'en', url:'http://www.adaderana.lk/rss.php' },
  { c:'NP', name:'The Kathmandu Post', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://kathmandupost.com/rss' },
  { c:'NP', name:'Online Khabar', type:'site', cat:'general', official:false, lang:'en', url:'https://english.onlinekhabar.com/feed' },
  { c:'CN', name:'China Daily', type:'newspaper', cat:'general', official:true, lang:'en', url:'https://www.chinadaily.com.cn/rss/world_rss.xml' },
  { c:'CN', name:'CGTN', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.cgtn.com/subscribe/rss/section/world.xml' },
  { c:'CN', name:'Global Times', type:'newspaper', cat:'general', official:true, lang:'en', url:'https://www.globaltimes.cn/rss/outbrain.xml' },
  { c:'TW', name:'Focus Taiwan (CNA)', type:'agency', cat:'general', official:true, lang:'en', url:'https://feeds.feedburner.com/rsscna/intworld' },
  { c:'TW', name:'Taipei Times', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.taipeitimes.com/xml/index.rss' },
  { c:'HK', name:'SCMP', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.scmp.com/rss/91/feed' },
  { c:'HK', name:'RTHK', type:'radio', cat:'general', official:true, lang:'en', url:'https://rthk9.rthk.hk/rthk/news/rss/e_expressnews_elocal.xml' },
  { c:'JP', name:'NHK', type:'tv', cat:'general', official:true, lang:'ja', url:'https://www.nhk.or.jp/rss/news/cat0.xml' },
  { c:'JP', name:'The Japan Times', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.japantimes.co.jp/feed/' },
  { c:'JP', name:'Nikkei Asia', type:'newspaper', cat:'business', official:false, lang:'en', url:'https://asia.nikkei.com/rss/feed/nar' },
  { c:'KR', name:'Yonhap', type:'agency', cat:'general', official:true, lang:'en', url:'https://en.yna.co.kr/RSS/news.xml' },
  { c:'KR', name:'KBS World', type:'tv', cat:'general', official:true, lang:'en', url:'http://world.kbs.co.kr/rss/rss_news.htm?lang=e' },
  { c:'KG', name:'24.kg', type:'agency', cat:'general', official:false, lang:'ru', url:'https://24.kg/rss/' },
  { c:'KG', name:'AKIpress', type:'agency', cat:'general', official:false, lang:'en', url:'https://akipress.com/rss/news.rss' },
  { c:'UZ', name:'Gazeta.uz', type:'site', cat:'general', official:false, lang:'ru', url:'https://www.gazeta.uz/ru/rss/' },
  { c:'UZ', name:'Kun.uz', type:'site', cat:'general', official:false, lang:'ru', url:'https://kun.uz/ru/news/rss' },
  { c:'TJ', name:'Asia-Plus', type:'agency', cat:'general', official:false, lang:'ru', url:'https://asiaplustj.info/ru/rss' },
  { c:'GE', name:'Civil.ge', type:'site', cat:'general', official:false, lang:'en', url:'https://civil.ge/feed' },
  { c:'AZ', name:'Trend', type:'agency', cat:'general', official:false, lang:'en', url:'https://en.trend.az/feeds/index.rss' },
  { c:'AZ', name:'APA', type:'agency', cat:'general', official:false, lang:'en', url:'https://apa.az/rss' },
  { c:'TH', name:'Bangkok Post', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.bangkokpost.com/rss/data/topstories.xml' },
  { c:'VN', name:'VnExpress', type:'site', cat:'general', official:false, lang:'vi', url:'https://vnexpress.net/rss/tin-moi-nhat.rss' },
  { c:'PH', name:'Rappler', type:'site', cat:'general', official:false, lang:'en', url:'https://www.rappler.com/feed/' },
  { c:'PH', name:'The Philippine Star', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.philstar.com/rss/headlines' },
  { c:'PH', name:'GMA News', type:'tv', cat:'general', official:false, lang:'en', url:'https://data.gmanetwork.com/gno/rss/news/feed.xml' },
  { c:'ID', name:'ANTARA', type:'agency', cat:'general', official:true, lang:'id', url:'https://www.antaranews.com/rss/terkini.xml' },
  { c:'MY', name:'Malay Mail', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.malaymail.com/feed/rss/malaysia' },
  { c:'SG', name:'CNA', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml' },
  { c:'SG', name:'The Straits Times', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.straitstimes.com/news/singapore/rss.xml' },
  { c:'KH', name:'Khmer Times', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.khmertimeskh.com/feed/' },
  { c:'ZA', name:'SABC News', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.sabcnews.com/sabcnews/feed/' },
  { c:'ZA', name:'Daily Maverick', type:'site', cat:'general', official:false, lang:'en', url:'https://www.dailymaverick.co.za/dmrss/' },
  { c:'NG', name:'The Punch', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://punchng.com/feed/' },
  { c:'NG', name:'Vanguard', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.vanguardngr.com/feed/' },
  { c:'NG', name:'Premium Times', type:'site', cat:'general', official:false, lang:'en', url:'https://www.premiumtimesng.com/feed' },
  { c:'NG', name:'Channels TV', type:'tv', cat:'general', official:false, lang:'en', url:'https://www.channelstv.com/feed/' },
  { c:'KE', name:'The Standard', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.standardmedia.co.ke/rss/headlines.php' },
  { c:'KE', name:'Capital FM', type:'radio', cat:'general', official:false, lang:'en', url:'https://www.capitalfm.co.ke/news/feed/' },
  { c:'GH', name:'MyJoyOnline', type:'site', cat:'general', official:false, lang:'en', url:'https://www.myjoyonline.com/feed/' },
  { c:'ET', name:'Fana Broadcasting', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.fanabc.com/english/feed/' },
  { c:'SO', name:'Hiiraan Online', type:'site', cat:'general', official:false, lang:'en', url:'https://www.hiiraan.com/rss.xml' },
  { c:'ZW', name:'The Herald', type:'newspaper', cat:'general', official:true, lang:'en', url:'https://www.herald.co.zw/feed/' },
  { c:'ZM', name:'Lusaka Times', type:'site', cat:'general', official:false, lang:'en', url:'https://www.lusakatimes.com/feed/' },
  { c:'MW', name:'Nyasa Times', type:'site', cat:'general', official:false, lang:'en', url:'https://www.nyasatimes.com/feed/' },
  { c:'MZ', name:'Club of Mozambique', type:'site', cat:'general', official:false, lang:'en', url:'https://clubofmozambique.com/feed/' },
  { c:'CD', name:'Radio Okapi', type:'radio', cat:'general', official:true, lang:'fr', url:'https://www.radiookapi.net/rss.xml' },
  { c:'MA', name:'Hespress', type:'site', cat:'general', official:false, lang:'en', url:'https://en.hespress.com/feed' },
  { c:'DZ', name:'TSA', type:'site', cat:'general', official:false, lang:'fr', url:'https://www.tsa-algerie.com/feed/' },
  { c:'TN', name:'Kapitalis', type:'site', cat:'general', official:false, lang:'fr', url:'https://kapitalis.com/tunisie/feed/' },
  { c:'MU', name:'Le Mauricien', type:'newspaper', cat:'general', official:false, lang:'fr', url:'https://www.lemauricien.com/feed/' },
  { c:'NA', name:'The Namibian', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.namibian.com.na/feed/' },
  { c:'US', name:'NPR', type:'radio', cat:'general', official:true, lang:'en', url:'https://feeds.npr.org/1001/rss.xml' },
  { c:'US', name:'The New York Times', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { c:'US', name:'CNN', type:'tv', cat:'general', official:false, lang:'en', url:'http://rss.cnn.com/rss/edition.rss' },
  { c:'US', name:'Fox News', type:'tv', cat:'general', official:false, lang:'en', url:'https://moxie.foxnews.com/google-publisher/latest.xml' },
  { c:'US', name:'CBS News', type:'tv', cat:'general', official:false, lang:'en', url:'https://www.cbsnews.com/latest/rss/main' },
  { c:'US', name:'ABC News', type:'tv', cat:'general', official:false, lang:'en', url:'https://abcnews.go.com/abcnews/topstories' },
  { c:'US', name:'PBS NewsHour', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.pbs.org/newshour/feeds/rss/headlines' },
  { c:'US', name:'The Washington Post', type:'newspaper', cat:'world', official:false, lang:'en', url:'https://feeds.washingtonpost.com/rss/world' },
  { c:'US', name:'CNBC', type:'tv', cat:'business', official:false, lang:'en', url:'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { c:'US', name:'MarketWatch', type:'site', cat:'business', official:false, lang:'en', url:'http://feeds.marketwatch.com/marketwatch/topstories/' },
  { c:'US', name:'The Wall Street Journal', type:'newspaper', cat:'business', official:false, lang:'en', url:'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
  { c:'US', name:'SCOTUSblog', type:'site', cat:'legal', official:false, lang:'en', url:'https://www.scotusblog.com/feed/' },
  { c:'US', name:'JURIST', type:'site', cat:'legal', official:false, lang:'en', url:'https://www.jurist.org/news/feed/' },
  { c:'US', name:'ABA Journal', type:'site', cat:'legal', official:false, lang:'en', url:'https://www.abajournal.com/rss/topstories.rss' },
  { c:'US', name:'NASA', type:'site', cat:'science', official:true, lang:'en', url:'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
  { c:'CA', name:'Global News', type:'tv', cat:'general', official:false, lang:'en', url:'https://globalnews.ca/feed/' },
  { c:'MX', name:'La Jornada', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.jornada.com.mx/rss/edicion.xml' },
  { c:'BR', name:'G1', type:'tv', cat:'general', official:false, lang:'pt', url:'https://g1.globo.com/rss/g1/' },
  { c:'BR', name:'Folha de S.Paulo', type:'newspaper', cat:'general', official:false, lang:'pt', url:'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml' },
  { c:'BR', name:'Agência Brasil', type:'agency', cat:'general', official:true, lang:'pt', url:'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml' },
  { c:'BR', name:'UOL Notícias', type:'site', cat:'general', official:false, lang:'pt', url:'https://rss.uol.com.br/feed/noticias.xml' },
  { c:'AR', name:'Clarín', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.clarin.com/rss/lo-ultimo/' },
  { c:'AR', name:'La Nación', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml' },
  { c:'AR', name:'Infobae', type:'site', cat:'general', official:false, lang:'es', url:'https://www.infobae.com/arc/outboundfeeds/rss/' },
  { c:'CO', name:'El Tiempo', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.eltiempo.com/rss/colombia.xml' },
  { c:'PE', name:'El Comercio', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://elcomercio.pe/arc/outboundfeeds/rss/?outputType=xml' },
  { c:'PE', name:'RPP', type:'radio', cat:'general', official:false, lang:'es', url:'https://rpp.pe/feed' },
  { c:'VE', name:'El Nacional', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.elnacional.com/feed/' },
  { c:'EC', name:'El Universo', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.eluniverso.com/arc/outboundfeeds/rss/?outputType=xml' },
  { c:'BO', name:'Los Tiempos', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.lostiempos.com/rss/actualidad' },
  { c:'CU', name:'Granma', type:'newspaper', cat:'general', official:true, lang:'es', url:'http://www.granma.cu/feed' },
  { c:'CR', name:'La Nación CR', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.nacion.com/arc/outboundfeeds/rss/?outputType=xml' },
  { c:'PA', name:'La Prensa', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.prensa.com/arc/outboundfeeds/rss/?outputType=xml' },
  { c:'GT', name:'Prensa Libre', type:'newspaper', cat:'general', official:false, lang:'es', url:'https://www.prensalibre.com/feed/' },
  { c:'JM', name:'Jamaica Gleaner', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://jamaica-gleaner.com/feed/rss.xml' },
  { c:'AU', name:'ABC News (AU)', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.abc.net.au/news/feed/2942460/rss.xml' },
  { c:'AU', name:'SBS News', type:'tv', cat:'general', official:true, lang:'en', url:'https://www.sbs.com.au/news/feed' },
  { c:'AU', name:'The Sydney Morning Herald', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.smh.com.au/rss/feed.xml' },
  { c:'NZ', name:'RNZ', type:'radio', cat:'general', official:true, lang:'en', url:'https://www.rnz.co.nz/rss/national.xml' },
  { c:'NZ', name:'NZ Herald', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.nzherald.co.nz/arc/outboundfeeds/rss/curated/78/?outputType=xml' },
  { c:'PG', name:'Post-Courier', type:'newspaper', cat:'general', official:false, lang:'en', url:'https://www.postcourier.com.pg/feed/' },
  { c:'', name:'Nature', type:'site', cat:'science', official:false, lang:'en', url:'https://www.nature.com/nature.rss' },
  { c:'', name:'Science (AAAS)', type:'site', cat:'science', official:false, lang:'en', url:'https://www.science.org/rss/news_current.xml' },
  { c:'', name:'ScienceDaily', type:'site', cat:'science', official:false, lang:'en', url:'https://www.sciencedaily.com/rss/all.xml' },
  { c:'', name:'Phys.org', type:'site', cat:'science', official:false, lang:'en', url:'https://phys.org/rss-feed/' },
  { c:'', name:'New Scientist', type:'site', cat:'science', official:false, lang:'en', url:'https://www.newscientist.com/feed/home/' },
  { c:'', name:'Scientific American', type:'site', cat:'science', official:false, lang:'en', url:'http://rss.sciam.com/ScientificAmerican-Global' },
  { c:'', name:'Live Science', type:'site', cat:'science', official:false, lang:'en', url:'https://www.livescience.com/feeds/all' },
  { c:'', name:'MIT News', type:'site', cat:'science', official:false, lang:'en', url:'https://news.mit.edu/rss/feed' },
  { c:'', name:'ESA', type:'site', cat:'science', official:true, lang:'en', url:'https://www.esa.int/rssfeed/Our_Activities/Space_News' },
  { c:'', name:'The Economist', type:'newspaper', cat:'business', official:false, lang:'en', url:'https://www.economist.com/finance-and-economics/rss.xml' },
  { c:'', name:'Investing.com', type:'site', cat:'business', official:false, lang:'en', url:'https://www.investing.com/rss/news.rss' },
  { c:'', name:'Business Insider', type:'site', cat:'business', official:false, lang:'en', url:'https://www.businessinsider.com/rss' },
  { c:'', name:'Forbes', type:'site', cat:'business', official:false, lang:'en', url:'https://www.forbes.com/business/feed/' },
  { c:'', name:'Courthouse News', type:'site', cat:'legal', official:false, lang:'en', url:'https://www.courthousenews.com/feed/' },
  { c:'', name:'Legal Cheek', type:'site', cat:'legal', official:false, lang:'en', url:'https://www.legalcheek.com/feed/' },
  { c:'', name:'The Verge', type:'site', cat:'tech', official:false, lang:'en', url:'https://www.theverge.com/rss/index.xml' },
  { c:'', name:'Ars Technica', type:'site', cat:'tech', official:false, lang:'en', url:'http://feeds.arstechnica.com/arstechnica/index' },
  { c:'', name:'TechCrunch', type:'site', cat:'tech', official:false, lang:'en', url:'https://techcrunch.com/feed/' },
  { c:'', name:'Wired', type:'site', cat:'tech', official:false, lang:'en', url:'https://www.wired.com/feed/rss' },
  { c:'', name:'Engadget', type:'site', cat:'tech', official:false, lang:'en', url:'https://www.engadget.com/rss.xml' },
  { c:'', name:'WHO', type:'site', cat:'health', official:true, lang:'en', url:'https://www.who.int/rss-feeds/news-english.xml' },
  { c:'', name:'STAT News', type:'site', cat:'health', official:false, lang:'en', url:'https://www.statnews.com/feed/' },
  { c:'', name:'UN News', type:'site', cat:'world', official:true, lang:'en', url:'https://news.un.org/feed/subscribe/en/news/all/rss.xml' },
  { c:'', name:'Euronews', type:'tv', cat:'world', official:false, lang:'en', url:'https://www.euronews.com/rss' }
];

// ── 2) Генерирани Google News емисии по държава ──────────────────────────────
const GN_TOPICS = [
  ['business', 'BUSINESS'], ['tech', 'TECHNOLOGY'], ['science', 'SCIENCE'], ['health', 'HEALTH'],
  ['sports', 'SPORTS'], ['entertainment', 'ENTERTAINMENT'], ['world', 'WORLD'], ['nation', 'NATION']
];
function gnBase(c) {
  const hl = c.hl || 'en';
  return 'hl=' + encodeURIComponent(hl) + '&gl=' + encodeURIComponent(c.code) +
    '&ceid=' + encodeURIComponent(c.code + ':' + hl);
}
export function generatedForCountry(code) {
  const c = byCode[code];
  if (!c) return [];
  const lang = (c.hl || 'en').split('-')[0];
  const list = [{
    gen: true, c: code, name: 'Google News', type: 'agency', cat: 'general', official: false, lang,
    url: 'https://news.google.com/rss?' + gnBase(c)
  }];
  for (const [cat, topic] of GN_TOPICS) {
    list.push({
      gen: true, c: code, name: 'Google News', type: 'agency', cat, official: false, lang,
      url: 'https://news.google.com/rss/headlines/section/topic/' + topic + '?' + gnBase(c)
    });
  }
  return list;
}

// Пълният списък за държава: поименните (проверени) отгоре + генерираните отдолу.
export function feedsForCountry(code) {
  return OUTLETS.filter((o) => o.c === code).concat(generatedForCountry(code));
}
export function globalOutlets() { return OUTLETS.filter((o) => !o.c); }
export function outletCount() { return OUTLETS.length; }
export function totalFeedCount() { return OUTLETS.length + COUNTRIES.length * (1 + GN_TOPICS.length); }

// ── Търсачка в каталога ──────────────────────────────────────────────────────
// Търси едновременно: държави (име/код) и емисии (име на източник). Връща
// { countries: [...], feeds: [...] } — до limit резултата на група.
export function searchDirectory(query, limit = 40) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { countries: [], feeds: [] };
  const countries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q).slice(0, limit);
  const feeds = OUTLETS.filter((o) =>
    o.name.toLowerCase().includes(q) ||
    (o.c && (byCode[o.c] ? byCode[o.c].name.toLowerCase().includes(q) : false))
  ).slice(0, limit);
  return { countries, feeds };
}
