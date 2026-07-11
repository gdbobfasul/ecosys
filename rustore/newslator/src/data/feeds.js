// Version: 1.0010
// feeds.js — източниците на новини по държава.
//
// ДВА слоя:
//  1) УНИВЕРСАЛЕН агрегатор за ВСЯКА държава по света: националната RSS емисия на Google
//     News по схемата news.google.com/rss?hl=<език>&gl=<държава>&ceid=<държава>:<език>.
//     Това гарантира новини за всичките ~195 държави на местния им език още от старта.
//  2) ПОИМЕННИ реални източници (официален вестник/телевизия/радио/агенция + няколко
//     неофициални) за водещите държави — добавят се над агрегатора. Ако някой URL остарее,
//     емисията просто се прескача (агрегаторът пак носи новини за държавата).
//
// Всеки запис за държава: { code (ISO-3166-1 alpha-2), name, region, hl (език за Google News
// и изходен език за превода) }. gl = code, ceid = `${code}:${hl}`.
// Източник (outlet): { name, type:'newspaper'|'tv'|'radio'|'agency'|'site', official, lang, url }.

export const REGIONS = ['africa', 'americas', 'asia', 'middle_east', 'europe', 'oceania'];

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

// Поименни реални източници за водещите държави. Прескача се тихо при остарял URL.
export const OUTLETS = {
  BG: [
    { name: 'БНР', type: 'radio', official: true, lang: 'bg', url: 'https://bnr.bg/rss' },
    { name: 'Дневник', type: 'newspaper', official: false, lang: 'bg', url: 'https://www.dnevnik.bg/rss/' }
  ],
  GB: [
    { name: 'BBC News', type: 'tv', official: true, lang: 'en', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
    { name: 'The Guardian', type: 'newspaper', official: false, lang: 'en', url: 'https://www.theguardian.com/uk/rss' }
  ],
  US: [
    { name: 'The New York Times', type: 'newspaper', official: false, lang: 'en', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
    { name: 'NPR', type: 'radio', official: true, lang: 'en', url: 'https://feeds.npr.org/1001/rss.xml' }
  ],
  CA: [
    { name: 'CBC News', type: 'tv', official: true, lang: 'en', url: 'https://www.cbc.ca/cmlink/rss-topstories' }
  ],
  RU: [
    { name: 'TASS', type: 'agency', official: true, lang: 'en', url: 'https://tass.com/rss/v2.xml' },
    { name: 'Meduza', type: 'site', official: false, lang: 'ru', url: 'https://meduza.io/rss/all' }
  ],
  UA: [
    { name: 'Ukrinform', type: 'agency', official: true, lang: 'uk', url: 'https://www.ukrinform.net/rss/' },
    { name: 'Українська правда', type: 'newspaper', official: false, lang: 'uk', url: 'https://www.pravda.com.ua/rss/' }
  ],
  DE: [
    { name: 'Tagesschau', type: 'tv', official: true, lang: 'de', url: 'https://www.tagesschau.de/index~rss2.xml' },
    { name: 'Der Spiegel', type: 'newspaper', official: false, lang: 'de', url: 'https://www.spiegel.de/schlagzeilen/tops/index.rss' }
  ],
  FR: [
    { name: 'France 24', type: 'tv', official: true, lang: 'fr', url: 'https://www.france24.com/fr/rss' },
    { name: 'Le Monde', type: 'newspaper', official: false, lang: 'fr', url: 'https://www.lemonde.fr/rss/une.xml' },
    { name: 'RFI', type: 'radio', official: true, lang: 'fr', url: 'https://www.rfi.fr/fr/rss' }
  ],
  ES: [
    { name: 'El País', type: 'newspaper', official: false, lang: 'es', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
    { name: 'El Mundo', type: 'newspaper', official: false, lang: 'es', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml' }
  ],
  IT: [
    { name: 'ANSA', type: 'agency', official: true, lang: 'it', url: 'https://www.ansa.it/sito/ansait_rss.xml' },
    { name: 'la Repubblica', type: 'newspaper', official: false, lang: 'it', url: 'https://www.repubblica.it/rss/homepage/rss2.0.xml' }
  ],
  PT: [
    { name: 'RTP', type: 'tv', official: true, lang: 'pt', url: 'https://www.rtp.pt/noticias/rss' },
    { name: 'Público', type: 'newspaper', official: false, lang: 'pt', url: 'https://feeds.feedburner.com/PublicoRSS' }
  ],
  BR: [
    { name: 'G1', type: 'tv', official: false, lang: 'pt', url: 'https://g1.globo.com/rss/g1/' },
    { name: 'Folha de S.Paulo', type: 'newspaper', official: false, lang: 'pt', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml' }
  ],
  MX: [
    { name: 'El Universal', type: 'newspaper', official: false, lang: 'es', url: 'https://www.eluniversal.com.mx/rss.xml' },
    { name: 'La Jornada', type: 'newspaper', official: false, lang: 'es', url: 'https://www.jornada.com.mx/rss/edicion.xml' }
  ],
  AR: [
    { name: 'Clarín', type: 'newspaper', official: false, lang: 'es', url: 'https://www.clarin.com/rss/lo-ultimo/' }
  ],
  NL: [
    { name: 'NOS', type: 'tv', official: true, lang: 'nl', url: 'https://feeds.nos.nl/nosnieuwsalgemeen' }
  ],
  CH: [
    { name: 'SWI swissinfo', type: 'site', official: true, lang: 'en', url: 'https://www.swissinfo.ch/eng/rss' }
  ],
  TR: [
    { name: 'TRT World', type: 'tv', official: true, lang: 'en', url: 'https://www.trtworld.com/rss' },
    { name: 'Hürriyet Daily News', type: 'newspaper', official: false, lang: 'en', url: 'https://www.hurriyetdailynews.com/rss' }
  ],
  GR: [
    { name: 'eKathimerini', type: 'newspaper', official: false, lang: 'en', url: 'https://www.ekathimerini.com/feed/' }
  ],
  IL: [
    { name: 'The Times of Israel', type: 'newspaper', official: false, lang: 'en', url: 'https://www.timesofisrael.com/feed/' }
  ],
  QA: [
    { name: 'Al Jazeera', type: 'tv', official: true, lang: 'en', url: 'https://www.aljazeera.com/xml/rss/all.xml' }
  ],
  SA: [
    { name: 'Arab News', type: 'newspaper', official: false, lang: 'en', url: 'https://www.arabnews.com/rss.xml' }
  ],
  AE: [
    { name: 'Gulf News', type: 'newspaper', official: false, lang: 'en', url: 'https://gulfnews.com/rss' },
    { name: 'Khaleej Times', type: 'newspaper', official: false, lang: 'en', url: 'https://www.khaleejtimes.com/rss' }
  ],
  IN: [
    { name: 'The Hindu', type: 'newspaper', official: false, lang: 'en', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
    { name: 'The Times of India', type: 'newspaper', official: false, lang: 'en', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' }
  ],
  JP: [
    { name: 'NHK', type: 'tv', official: true, lang: 'ja', url: 'https://www.nhk.or.jp/rss/news/cat0.xml' },
    { name: 'The Japan Times', type: 'newspaper', official: false, lang: 'en', url: 'https://www.japantimes.co.jp/feed/' }
  ],
  KR: [
    { name: 'Yonhap', type: 'agency', official: true, lang: 'en', url: 'https://en.yna.co.kr/RSS/news.xml' }
  ],
  CN: [
    { name: 'China Daily', type: 'newspaper', official: true, lang: 'en', url: 'https://www.chinadaily.com.cn/rss/world_rss.xml' }
  ],
  TW: [
    { name: 'Focus Taiwan (CNA)', type: 'agency', official: true, lang: 'en', url: 'https://feeds.feedburner.com/rsscna/intworld' },
    { name: 'Taipei Times', type: 'newspaper', official: false, lang: 'en', url: 'https://www.taipeitimes.com/xml/index.rss' }
  ],
  KG: [
    { name: 'Кабар', type: 'agency', official: true, lang: 'ru', url: 'http://kabar.kg/rss/' },
    { name: '24.kg', type: 'agency', official: false, lang: 'ru', url: 'https://24.kg/rss/' }
  ],
  AU: [
    { name: 'ABC News', type: 'tv', official: true, lang: 'en', url: 'https://www.abc.net.au/news/feed/2942460/rss.xml' }
  ],
  NZ: [
    { name: 'RNZ', type: 'radio', official: true, lang: 'en', url: 'https://www.rnz.co.nz/rss/national.xml' }
  ],
  ZA: [
    { name: 'News24', type: 'site', official: false, lang: 'en', url: 'https://feeds.24.com/articles/news24/TopStories/rss' }
  ],
  NG: [
    { name: 'The Punch', type: 'newspaper', official: false, lang: 'en', url: 'https://punchng.com/feed/' }
  ],
  KE: [
    { name: 'The Standard', type: 'newspaper', official: false, lang: 'en', url: 'https://www.standardmedia.co.ke/rss/headlines.php' }
  ],
  EG: [
    { name: 'Al-Ahram', type: 'newspaper', official: true, lang: 'en', url: 'https://english.ahram.org.eg/Rss/1.aspx' }
  ]
};

const byCode = {};
COUNTRIES.forEach((c) => { byCode[c.code] = c; });

export function countryByCode(code) { return byCode[code] || null; }

export function countriesByRegion(region) {
  return COUNTRIES.filter((c) => c.region === region)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Националната агрегаторна емисия на Google News за дадена държава.
export function googleNewsUrl(country) {
  const hl = country.hl || 'en';
  const gl = country.code;
  const ceid = gl + ':' + hl;
  return 'https://news.google.com/rss?hl=' + encodeURIComponent(hl) +
    '&gl=' + encodeURIComponent(gl) + '&ceid=' + encodeURIComponent(ceid);
}

// Пълният списък източници за държава: агрегаторът (винаги) + поименните (ако има).
// Всеки запис: { name, type, official, lang, url, kind:'aggregator'|'outlet' }.
export function feedsForCountry(code) {
  const c = byCode[code];
  if (!c) return [];
  const list = [{
    name: 'Google News',
    type: 'agency',
    official: false,
    aggregator: true,
    lang: (c.hl || 'en').split('-')[0],
    url: googleNewsUrl(c),
    kind: 'aggregator'
  }];
  (OUTLETS[code] || []).forEach((o) => list.push(Object.assign({ kind: 'outlet' }, o)));
  return list;
}

// Има ли поименни (не само агрегатор) източници за държавата?
export function hasNamedSources(code) { return !!(OUTLETS[code] && OUTLETS[code].length); }
