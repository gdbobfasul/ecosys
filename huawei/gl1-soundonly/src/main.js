// main.js — магазинна обвивка на играта „Само звук" (Echo Duel, GL1) за huawei.
// Играта е самостоятелен canvas-2D енджин + WebAudio (реален звук/пинг) — inline в index.html.
// Тук закачаме САМО СПОДЕЛЕНИТЕ ядрени модули (както fps-hunter/gl1-gravity): задължителен
// 15-езичен избор при старт, анти-sideload лиценз, монетизация/пробно заключване, лого-интро,
// реклами, „Помощ", правен footer линк и правния екран (съгласие). Мостовете работят върху
// DOM/localStorage — не пипат вътрешния енджин или WebAudio на играта.
import { mountLangGate } from './core/lang-gate.js';
import { LANGUAGES, getLang, setLang } from './core/i18n.js';
import { enforceLicense } from './core/license.js';
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';

const APP = 'gl1-soundonly';

// ЕКРАН 1: задължителен избор на език при ВСЯко пускане (15 езика).
mountLangGate({ languages: LANGUAGES, current: getLang(), setLang });
// Лог на инсталация СЛЕД избора на език (huawei билд).
enforceLicense(APP, 'huawei');
// Монетизация / 4-дневно пробно заключване (следва publish/monetization.json → src/monetize.js).
enforceLock();
mountEcosystem(APP);   // „Още от Pupikes" showcase
playIntro();           // кратко „Pupikes" интро при старт
startPromoAds(APP);    // реклами: старт + среда + край
mountHelp(APP);        // универсален бутон „Помощ" (анонимен доклад → портал)
mountPrivacyLink(APP); // footer линк към политиката (Huawei 7.1) + заявка за изтриване
mountLegalGate(APP);   // ЕКРАН 3: задължителни политики/предупреждения + отметка
