// Version: 1.0001
// gen-privacy.mjs — генератор на privacy политики за ВСИЧКИ приложения (Huawei + RuStore).
//
// За всяко приложение записва:
//   huawei/<app>/publish/hw-privacy.html        (изцяло на английски — за AppGallery)
//   huawei/<app>/publish/rustore-privacy.html   (двуезична: руски отгоре + английски отдолу — за RuStore)
// и трие стария общ ru-privacy.html (освен за newslator, който вече е подаден).
//
// Хостват се на: https://selflearning.bot.nu/privacy/<app>/hw-privacy.html | rustore-privacy.html
// (08-setup-domain.sh ги копира от */publish/*-privacy.html в /var/www/html/privacy/<app>/).
//
// Съдържанието НЕ е сляпо копие — всяко приложение описва РЕАЛНИТЕ си потоци (проверени в кода):
// универсалният слой KCY (анонимен доклад към selflearning.bot.nu + сваляне на промо каталог +
// вградена самореклама), плюс конкретните трети страни/разрешения на всяко приложение.
//
// Пускане:  node deploy-scripts/gen-privacy.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EFFECTIVE = '2026-07-12';
const CONTACT = 'dai.group.ltd.support@gmail.com';
const PROVIDER = 'Dai Grup Ltd.';

// ── Универсални трети страни (важат за ВСЯКО приложение заради общия слой KCY) ────────────────
function kcyRows() {
  return [
    {
      recipient: `${PROVIDER} — our own server <code>selflearning.bot.nu</code>`,
      data: {
        en: 'Only if you tap the in-app “Help” button and send a message: the text you write and the name of the app it came from (anonymous — no account, no name, no device identifier). Your IP address, as with any internet request.',
        ru: 'Только если вы нажмёте кнопку «Помощь» в приложении и отправите сообщение: написанный вами текст и название приложения (анонимно — без аккаунта, имени и идентификатора устройства). IP-адрес, как при любом интернет-запросе.'
      },
      purpose: {
        en: 'To receive and answer your support/feedback message, and to download our own catalogue of other KCY apps to display (see “In-app promotion” below).',
        ru: 'Приём и обработка вашего обращения в поддержку и загрузка нашего собственного каталога других приложений KCY для показа (см. «Реклама внутри приложения» ниже).'
      },
      policy: `<a href="mailto:${CONTACT}">${CONTACT}</a>`
    }
  ];
}

// ── HTML скелет ───────────────────────────────────────────────────────────────────────────────
const STYLE = `  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 820px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a1a1a; background: #fff; }
  h1 { font-size: 1.6rem; } h2 { font-size: 1.15rem; margin-top: 1.6em; }
  code { background: #f0f0f3; padding: 1px 5px; border-radius: 4px; }
  .muted { color: #666; font-size: .92rem; }
  a { color: #2a7cf0; }
  ul { padding-left: 1.2em; }
  hr { border: none; border-top: 2px solid #ccc; margin: 2.4em 0; }
  table { border-collapse: collapse; width: 100%; margin: .6em 0; font-size: .95rem; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  @media (prefers-color-scheme: dark) { body { color: #eee; background: #16171b; } code { background: #26272c; } th, td, hr { border-color: #3a3b40; } }`;

function page(title, bodyHtml) {
  return `<!DOCTYPE html>
<!-- Version: 1.0001 -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${STYLE}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

// ── Речник с фиксирания (общ) текст на двата езика ──────────────────────────────────────────────
const T = {
  storeName: { en: (s) => s === 'hw' ? 'HUAWEI AppGallery' : 'RuStore', ru: () => 'RuStore' },
  h_title: { en: (n) => `Privacy Policy — ${n}`, ru: (n) => `Политика конфиденциальности — ${n}` },
  meta: {
    en: (n, pkg, store) => `App: <strong>${n}</strong> · Package: <code>${pkg}</code> · Store: ${store} · Provider (data controller): ${PROVIDER} · Effective date: ${EFFECTIVE}`,
    ru: (n, pkg, store) => `Приложение: <strong>${n}</strong> · Пакет: <code>${pkg}</code> · Магазин: ${store} · Оператор данных: ${PROVIDER} · Дата вступления в силу: ${EFFECTIVE}`
  },
  s_device: { en: 'Data stored on your device', ru: 'Данные, хранящиеся на вашем устройстве' },
  s_network: { en: 'Network requests and third parties (purpose, method, scope)', ru: 'Сетевые запросы и третьи стороны (цель, способ, объём)' },
  net_intro: {
    en: 'The app makes network requests to the services below. All requests use <strong>HTTPS/TLS</strong> where the service supports it. As with any internet request, these recipients necessarily receive your device’s <strong>IP address</strong> and standard request metadata; this is required to deliver their service and is governed by <em>their own</em> privacy policies. We do not attach your identity to these requests.',
    ru: 'Приложение делает сетевые запросы к перечисленным ниже сервисам. Все запросы используют <strong>HTTPS/TLS</strong>, где сервис это поддерживает. Как и при любом интернет-запросе, эти получатели неизбежно получают <strong>IP-адрес</strong> вашего устройства и стандартные метаданные запроса; это необходимо для работы сервиса и регулируется <em>их собственными</em> политиками конфиденциальности. Мы не связываем эти запросы с вашей личностью.'
  },
  th: { en: ['Recipient', 'Data sent', 'Purpose', 'Their policy'], ru: ['Получатель', 'Передаваемые данные', 'Цель', 'Их политика'] },
  s_promo: { en: 'In-app promotion', ru: 'Реклама внутри приложения' },
  promo_txt: {
    en: `The app occasionally shows a full-screen card promoting <strong>another app by the same publisher</strong> (${PROVIDER} / “KCY Ecosystem”). The promoted app is chosen at random from a catalogue we download from our own server — it is <strong>not personalised</strong>, is not based on any profile of you, and uses <strong>no third-party advertising network, no advertising identifier and no tracking SDK</strong>. You can close the card immediately.`,
    ru: `Приложение иногда показывает полноэкранную карточку, рекламирующую <strong>другое приложение того же издателя</strong> (${PROVIDER} / «KCY Ecosystem»). Рекламируемое приложение выбирается случайно из каталога, который мы загружаем с нашего собственного сервера — реклама <strong>не персонализирована</strong>, не основана на вашем профиле и <strong>не использует сторонние рекламные сети, рекламные идентификаторы или трекинговые SDK</strong>. Карточку можно сразу закрыть.`
  },
  s_perm: { en: 'Device permissions', ru: 'Разрешения устройства' },
  perm_intro: { en: 'The app requests a permission only when a feature needs it:', ru: 'Приложение запрашивает разрешение только когда функция этого требует:' },
  perm_none: { en: 'The app requests no special device permissions (no camera, microphone, location, contacts, SMS, call logs or precise location).', ru: 'Приложение не запрашивает специальных разрешений (нет камеры, микрофона, геолокации, контактов, SMS, журналов звонков или точного местоположения).' },
  s_sell: { en: 'We do not sell data', ru: 'Мы не продаём данные' },
  sell_txt: {
    en: `The app does <strong>not sell</strong> personal data to anyone, and does not share it for anyone else’s independent marketing.`,
    ru: `Приложение <strong>не продаёт</strong> персональные данные кому-либо и не передаёт их для чьего-либо самостоятельного маркетинга.`
  },
  s_child: { en: 'Sensitive data and children', ru: 'Чувствительные данные и дети' },
  child_txt: {
    en: `The app does not use call logs, SMS, contacts, biometrics for identification, health data or precise device location for any purpose beyond what is described above. The app does not target children and does not knowingly collect data from anyone.`,
    ru: `Приложение не использует журналы звонков, SMS, контакты, биометрию для идентификации, данные о здоровье или точную геолокацию сверх описанного выше. Приложение не предназначено для детей и сознательно не собирает данные ни от кого.`
  },
  s_sec: { en: 'Security', ru: 'Безопасность' },
  s_rights: { en: 'Your rights and how to exercise them', ru: 'Ваши права и как ими воспользоваться' },
  s_ai: { en: 'Generative AI', ru: 'Генеративный ИИ' },
  s_changes: { en: 'Changes to this policy', ru: 'Изменения политики' },
  changes_txt: {
    en: 'If this policy changes, the updated version will be published at this same address, with a new effective date.',
    ru: 'При изменении политики обновлённая версия будет опубликована по этому же адресу с новой датой вступления в силу.'
  },
  s_contact: { en: 'Contact', ru: 'Контакт' },
  contact_txt: {
    en: `For any privacy question, request or complaint, write to: <a href="mailto:${CONTACT}">${CONTACT}</a> (${PROVIDER}).`,
    ru: `По любым вопросам, запросам или жалобам о конфиденциальности пишите: <a href="mailto:${CONTACT}">${CONTACT}</a> (${PROVIDER}).`
  },
  rights_feedback: {
    en: '<strong>Questions or complaints (feedback channel):</strong> email us and we will respond within 30 days.',
    ru: '<strong>Вопросы или жалобы (канал обратной связи):</strong> напишите нам, и мы ответим в течение 30 дней.'
  }
};

// Секция 1 (интро) + секция „данни на нашия сървър" — зависят дали има акаунт/сървър.
function introSection(app, lang) {
  const pitch = app.pitch[lang];
  if (app.serverWrapper) {
    const dom = app.serverWrapper.domain;
    return lang === 'en'
      ? `<p>${pitch} This app is a thin shell that loads our live online service at <code>${dom}</code> in a secure web view. Because it is an online service, some data you provide <strong>leaves your device and is stored on our server</strong> — this policy explains what and why. <strong>We do not sell any data and we do not use third-party advertising or tracking SDKs.</strong></p>
<h2>1. Data processed by our online service</h2>
<p>To use ${app.name} you create an account / sign in and use the service. The following data is sent to and stored on our server (${PROVIDER}, <code>${dom}</code>): your account/registration details and the content you create in the service (${app.serverWrapper.content_en}). We use it solely to operate the service for you. ${app.serverWrapper.extra_en || ''}</p>`
      : `<p>${pitch} Это приложение — тонкая оболочка, которая загружает наш действующий онлайн-сервис <code>${dom}</code> в защищённом веб-представлении. Поскольку это онлайн-сервис, часть предоставляемых вами данных <strong>покидает устройство и хранится на нашем сервере</strong> — эта политика объясняет, что и зачем. <strong>Мы не продаём данные и не используем сторонние рекламные или трекинговые SDK.</strong></p>
<h2>1. Данные, обрабатываемые нашим онлайн-сервисом</h2>
<p>Чтобы пользоваться приложением «${app.name}», вы создаёте аккаунт / входите и пользуетесь сервисом. Следующие данные отправляются и хранятся на нашем сервере (${PROVIDER}, <code>${dom}</code>): данные вашего аккаунта/регистрации и создаваемый вами в сервисе контент (${app.serverWrapper.content_ru}). Мы используем их исключительно для работы сервиса. ${app.serverWrapper.extra_ru || ''}</p>`;
  }
  // локални апове
  return lang === 'en'
    ? `<p>${pitch} This policy explains, in plain terms, what data the app processes, why, and with whom it is shared. <strong>We run no user accounts for this app, we do not sell any data, and we do not use third-party advertising or analytics/tracking SDKs.</strong></p>
<h2>1. We do not collect personal data on our servers</h2>
<p>${app.name} has <strong>no registration, no login and no user accounts operated by us</strong>. We do not collect, store or transmit to ourselves your name, email, phone number, contacts, precise location, photos or any advertising identifier. The only thing that reaches our server is an <em>optional</em> anonymous support message you choose to send (see the table below).</p>`
    : `<p>${pitch} Эта политика простыми словами объясняет, какие данные обрабатывает приложение, зачем и с кем ими делится. <strong>В этом приложении у нас нет аккаунтов пользователей, мы не продаём данные и не используем сторонние рекламные или аналитические/трекинговые SDK.</strong></p>
<h2>1. Мы не собираем персональные данные на наших серверах</h2>
<p>В приложении «${app.name}» <strong>нет регистрации, входа и управляемых нами аккаунтов</strong>. Мы не собираем, не храним и не передаём себе ваше имя, e-mail, телефон, контакты, точное местоположение, фото или рекламные идентификаторы. Единственное, что попадает на наш сервер, — это <em>необязательное</em> анонимное сообщение в поддержку, которое вы решите отправить (см. таблицу ниже).</p>`;
}

function deviceSection(app, lang) {
  const txt = app.device[lang];
  return `<h2>2. ${T.s_device[lang]}</h2>\n<p>${txt}</p>`;
}

function tableSection(app, lang) {
  const rows = [...kcyRows(), ...(app.thirdParties || [])];
  const th = T.th[lang];
  let html = `<h2>3. ${T.s_network[lang]}</h2>\n<p>${T.net_intro[lang]}</p>\n<table>\n<tr><th>${th[0]}</th><th>${th[1]}</th><th>${th[2]}</th><th>${th[3]}</th></tr>\n`;
  for (const r of rows) {
    const data = typeof r.data === 'string' ? r.data : r.data[lang];
    const purpose = typeof r.purpose === 'string' ? r.purpose : r.purpose[lang];
    html += `<tr><td>${r.recipient}</td><td>${data}</td><td>${purpose}</td><td>${r.policy || '—'}</td></tr>\n`;
  }
  html += `</table>`;
  if (app.netNote) html += `\n<p>${app.netNote[lang]}</p>`;
  return html;
}

function promoSection(lang) {
  return `<h2>4. ${T.s_promo[lang]}</h2>\n<p>${T.promo_txt[lang]}</p>`;
}

function permSection(app, lang, n) {
  if (!app.permissions || !app.permissions.length) {
    return `<h2>${n}. ${T.s_perm[lang]}</h2>\n<p>${T.perm_none[lang]}</p>`;
  }
  let html = `<h2>${n}. ${T.s_perm[lang]}</h2>\n<p>${T.perm_intro[lang]}</p>\n<ul>`;
  for (const p of app.permissions) html += `\n<li><strong>${p.name[lang]}</strong> — ${p.why[lang]}</li>`;
  html += `\n</ul>`;
  return html;
}

function rightsSection(app, lang, n) {
  const local = !app.serverWrapper;
  const li = [];
  if (local) {
    li.push(lang === 'en'
      ? '<strong>Withdraw consent / stop processing:</strong> stop using any optional online feature, or uninstall the app, at any time.'
      : '<strong>Отозвать согласие / прекратить обработку:</strong> в любой момент прекратите пользоваться необязательными онлайн-функциями или удалите приложение.');
    li.push(lang === 'en'
      ? '<strong>Delete your data:</strong> clear the app’s storage in your device settings, or uninstall the app — this removes all locally stored data.'
      : '<strong>Удалить свои данные:</strong> очистите хранилище приложения в настройках устройства или удалите приложение — это удалит все локально сохранённые данные.');
  } else {
    li.push(lang === 'en'
      ? '<strong>Access or correct your account data:</strong> from within the service, or by emailing us.'
      : '<strong>Доступ или исправление данных аккаунта:</strong> в самом сервисе или по e-mail.');
    li.push(lang === 'en'
      ? '<strong>Delete your account:</strong> for security reasons account deletion is not self-service — tap <em>“Delete account”</em> inside the app (or email us) to send a deletion request; only an administrator/moderator performs the deletion. We action verified requests within 30 days and confirm by our support channel.'
      : '<strong>Удаление аккаунта:</strong> из соображений безопасности удаление не является самообслуживанием — нажмите <em>«Удалить аккаунт»</em> внутри приложения (или напишите нам), чтобы отправить запрос на удаление; удаление выполняет только администратор/модератор. Проверенные запросы мы обрабатываем в течение 30 дней и подтверждаем через канал поддержки.');
  }
  li.push(lang === 'en'
    ? 'Data held by the third parties listed above is subject to their own policies; you may exercise your rights directly with them.'
    : 'Данные у перечисленных выше третьих сторон регулируются их политиками; вы можете обращаться к ним напрямую.');
  li.push(T.rights_feedback[lang]);
  const head = local
    ? (lang === 'en'
      ? 'Since we hold no account for this app, you remain in full control on your device:'
      : 'Поскольку для этого приложения у нас нет аккаунта, вы полностью управляете данными на своём устройстве:')
    : (lang === 'en'
      ? 'You have the right to access, correct, export or delete your personal data:'
      : 'Вы вправе получить доступ к своим персональным данным, исправить, экспортировать или удалить их:');
  return `<h2>${n}. ${T.s_rights[lang]}</h2>\n<p>${head}</p>\n<ul>\n${li.map((x) => `<li>${x}</li>`).join('\n')}\n</ul>`;
}

function securitySection(app, lang, n) {
  const txt = app.serverWrapper
    ? (lang === 'en'
      ? 'Traffic between the app and our server is encrypted over <strong>HTTPS/TLS</strong>. We protect account data with standard access controls.'
      : 'Трафик между приложением и нашим сервером шифруется по <strong>HTTPS/TLS</strong>. Данные аккаунта защищены стандартными средствами контроля доступа.')
    : (lang === 'en'
      ? 'Any outbound requests are made over encrypted <strong>HTTPS</strong> where the service offers it. Because there are no accounts operated by us for this app, there is no account database on our side that could be breached.'
      : 'Любые исходящие запросы выполняются по <strong>HTTPS</strong>, где сервис это поддерживает. Так как для этого приложения у нас нет аккаунтов, на нашей стороне нет базы аккаунтов, которую можно было бы взломать.');
  return `<h2>${n}. ${T.s_sec[lang]}</h2>\n<p>${txt}</p>`;
}

function aiSection(app, lang, n) {
  if (!app.genAI) return '';
  return `<h2>${n}. ${T.s_ai[lang]}</h2>\n<p>${app.genAI[lang]}</p>`;
}

// Сглобяване на секциите за един език.
function sections(app, lang, pkg, storeLabel) {
  const parts = [];
  parts.push(`<h1>${T.h_title[lang](app.name)}</h1>`);
  parts.push(`<p class="muted">${T.meta[lang](app.name, pkg, storeLabel)}</p>`);
  parts.push(introSection(app, lang));
  parts.push(deviceSection(app, lang));
  parts.push(tableSection(app, lang));
  parts.push(promoSection(lang));
  // номерирани по-нататъшни секции
  let n = 5;
  parts.push(permSection(app, lang, n++));
  parts.push(`<h2>${n++}. ${T.s_sell[lang]}</h2>\n<p>${T.sell_txt[lang]}</p>`);
  parts.push(`<h2>${n++}. ${T.s_child[lang]}</h2>\n<p>${T.child_txt[lang]}</p>`);
  parts.push(securitySection(app, lang, n++));
  parts.push(rightsSection(app, lang, n++));
  const ai = aiSection(app, lang, n);
  if (ai) { parts.push(ai); n++; }
  parts.push(`<h2>${n++}. ${T.s_changes[lang]}</h2>\n<p>${T.changes_txt[lang]}</p>`);
  parts.push(`<h2>${n++}. ${T.s_contact[lang]}</h2>\n<p>${T.contact_txt[lang]}</p>`);
  return parts.join('\n\n');
}

function renderHw(app) {
  const body = sections(app, 'en', app.hwPkg, 'HUAWEI AppGallery');
  return page(`Privacy Policy — ${app.name} (${app.hwPkg})`, body);
}
function renderRustore(app) {
  const ru = sections(app, 'ru', app.ruPkg, 'RuStore');
  const en = sections(app, 'en', app.ruPkg, 'RuStore');
  const body = ru + '\n\n<hr>\n\n' + en;
  return page(`Privacy Policy / Политика конфиденциальности — ${app.name} (${app.ruPkg})`, body);
}

// ── Помощни фабрики за често срещани разрешения/трети страни ────────────────────────────────────
const PERM = {
  camera: (why) => ({ name: { en: 'Camera', ru: 'Камера' }, why }),
  mic: (why) => ({ name: { en: 'Microphone', ru: 'Микрофон' }, why }),
  notif: () => ({ name: { en: 'Notifications', ru: 'Уведомления' }, why: { en: 'to show you local alerts on your device (no message is sent to us).', ru: 'чтобы показывать локальные уведомления на устройстве (нам ничего не отправляется).' } }),
  files: (why) => ({ name: { en: 'Files / Storage', ru: 'Файлы / Хранилище' }, why }),
  location: (why) => ({ name: { en: 'Location (optional)', ru: 'Геолокация (необязательно)' }, why })
};

const GAMES_DEVICE = {
  en: 'The app stores only a self-entered nickname, your scores/progress and the interface language <strong>locally on your device</strong>. This never reaches us and is removed when you uninstall the app or clear its storage.',
  ru: 'Приложение хранит только введённый вами ник, ваши результаты/прогресс и язык интерфейса <strong>локально на устройстве</strong>. Эти данные к нам не попадают и удаляются при удалении приложения или очистке его хранилища.'
};

// ── СПЕЦИФИКАЦИИ ЗА ВСИЧКИ 19 ПРИЛОЖЕНИЯ ────────────────────────────────────────────────────────
function game(id, name, pitchEn, pitchRu, extraTP) {
  return {
    id, name, hwPkg: `com.kcy.${id.replace(/-/g, '')}.hw`, ruPkg: `com.kcy.${id.replace(/-/g, '')}.rustore`,
    pitch: { en: pitchEn, ru: pitchRu },
    device: GAMES_DEVICE,
    thirdParties: extraTP || [],
    permissions: []
  };
}

const APPS = [
  // ── 7 офлайн игри (мрежа = само слоят KCY) ──
  game('dodge-master', 'Dodge Master',
    'Dodge Master is a top-down survival arcade game: you dodge projectiles across 10 levels of rising difficulty and climb a local leaderboard.',
    'Dodge Master — аркадная игра на выживание: вы уворачиваетесь от снарядов на 10 уровнях растущей сложности и поднимаетесь в локальной таблице рекордов.'),
  game('fps-hunter', 'FPS Hunter',
    'FPS Hunter is a 3D first-person hunting shooter with 100 levels, a range of weapons and targets, and a local leaderboard.',
    'FPS Hunter — 3D-шутер от первого лица со 100 уровнями, разным оружием и целями и локальной таблицей рекордов.'),
  game('plane-shooter', 'Plane Shooter',
    'Plane Shooter is a fast arcade shoot-’em-up: pilot a plane and survive 10 increasingly difficult levels. Fully offline single-player action.',
    'Plane Shooter — быстрый аркадный шутер: пилотируйте самолёт и пройдите 10 уровней растущей сложности. Полностью офлайн, одиночная игра.'),
  game('titans-fight', 'Titans Fight',
    'Titans Fight is a single-player arcade fighting game across 10 levels: pick your weapon, beat each foe and climb from Rookie to God of War, saving scores to a local leaderboard.',
    'Titans Fight — одиночный аркадный файтинг на 10 уровней: выберите оружие, побеждайте противников и пройдите путь от новичка до Бога войны; результаты сохраняются в локальной таблице.'),
  game('rustam', 'Rustam',
    'Rustam is a casual arcade game where you help a gardener pick all the cucumbers before the moles get them across 10 levels. A light, offline single-player challenge.',
    'Rustam — казуальная аркада: помогите садовнику собрать все огурцы, пока их не забрали кроты, на 10 уровнях. Лёгкая офлайн-игра для одного игрока.'),
  game('hmm', 'HMM Team Battle',
    'HMM is a 3-vs-3 turn-based team battle where your randomly assigned heroes fight across 10 levels, each with a hidden 4-key special combo.',
    'HMM — пошаговая командная битва 3 на 3: случайно назначенные герои сражаются на 10 уровнях, у каждого есть скрытая спецкомбинация из 4 клавиш.'),
  // Дуел — офлайн игра, но зарежда Google шрифт
  (() => {
    const g = game('duel', 'Duel Arena',
      'Duel Arena is a 1-vs-1 turn-based fighting game where your randomly assigned hero battles across 10 levels, each with a hidden 4-key special combo.',
      'Duel Arena — пошаговый файтинг 1 на 1: случайно назначенный герой сражается на 10 уровнях, у каждого есть скрытая спецкомбинация из 4 клавиш.');
    g.thirdParties = [{
      recipient: 'Google Fonts (Google LLC), <code>fonts.googleapis.com</code>',
      data: { en: 'Your IP address and a standard request to download the display fonts used in the game.', ru: 'IP-адрес и стандартный запрос на загрузку экранных шрифтов, используемых в игре.' },
      purpose: { en: 'To load the game’s decorative web fonts.', ru: 'Загрузка декоративных веб-шрифтов игры.' },
      policy: '<a href="https://policies.google.com/privacy">policies.google.com/privacy</a>'
    }];
    return g;
  })(),

  // ── authenticator ──
  {
    id: 'authenticator', name: 'KCY Authenticator', hwPkg: 'com.kcy.authenticator.hw', ruPkg: 'com.kcy.authenticator.rustore',
    pitch: {
      en: 'KCY Authenticator is a private two-factor authentication (2FA) app that generates TOTP/HOTP/Steam one-time codes and keeps all secrets in an encrypted, biometric-locked vault on your device.',
      ru: 'KCY Authenticator — приложение двухфакторной аутентификации (2FA): генерирует одноразовые коды TOTP/HOTP/Steam и хранит все секреты в зашифрованном хранилище на устройстве, защищённом биометрией.'
    },
    device: {
      en: 'All 2FA secrets, your master password verifier, imported browser passwords and any wallet notes you add are stored <strong>only in an encrypted vault on your device</strong>. Nothing is uploaded to any server by us. This data is removed when you uninstall the app.',
      ru: 'Все секреты 2FA, проверочные данные мастер-пароля, импортированные пароли браузера и любые заметки о кошельках хранятся <strong>только в зашифрованном хранилище на устройстве</strong>. Мы ничего не выгружаем на сервер. Эти данные удаляются при удалении приложения.'
    },
    thirdParties: [],
    permissions: [
      PERM.camera({ en: 'used only to scan an <code>otpauth://</code> QR code when you add an account; the image is processed on-device and never uploaded.', ru: 'используется только для сканирования QR-кода <code>otpauth://</code> при добавлении аккаунта; изображение обрабатывается на устройстве и не выгружается.' }),
      PERM.files({ en: 'used only when you choose to import or export your vault as a file that you select; files are read/written locally.', ru: 'используется только когда вы импортируете или экспортируете хранилище как выбранный вами файл; файлы читаются/записываются локально.' })
    ]
  },

  // ── baby-monitor ──
  {
    id: 'baby-monitor', name: 'Baby Monitor', hwPkg: 'com.kcy.babymonitor.hw', ruPkg: 'com.kcy.babymonitor.rustore',
    pitch: {
      en: 'Baby Monitor is a camera-based awareness assistant that watches your child through the phone camera and alerts you on motion. Detection runs on-device. It is <strong>not a certified safety device</strong>.',
      ru: 'Baby Monitor — помощник наблюдения на основе камеры: следит за ребёнком через камеру телефона и уведомляет о движении. Распознавание выполняется на устройстве. Это <strong>не сертифицированное устройство безопасности</strong>.'
    },
    device: {
      en: 'The camera video is analysed <strong>on the device and is never uploaded</strong>. Event snapshots, logs and settings stay in local storage on your device and are removed when you uninstall the app.',
      ru: 'Видео с камеры анализируется <strong>на устройстве и никогда не выгружается</strong>. Снимки событий, журналы и настройки хранятся локально и удаляются при удалении приложения.'
    },
    thirdParties: [{
      recipient: 'One-time on-device AI model download (static file host)',
      data: { en: 'Your IP address and a standard request to download the on-device detection model once.', ru: 'IP-адрес и стандартный запрос на однократную загрузку модели распознавания для работы на устройстве.' },
      purpose: { en: 'To fetch the free motion-detection model that then runs locally. Optionally, if you enter your own camera/relay URL, the app connects to that address you supplied.', ru: 'Загрузка бесплатной модели распознавания движения, которая затем работает локально. По желанию, если вы введёте свой URL камеры/ретранслятора, приложение подключается к указанному вами адресу.' },
      policy: '—'
    }],
    permissions: [
      PERM.camera({ en: 'used only to watch the scene for motion; the video is processed on-device and not uploaded by us.', ru: 'используется только для наблюдения за движением; видео обрабатывается на устройстве и нами не выгружается.' }),
      PERM.notif()
    ]
  },

  // ── camera-watch ──
  {
    id: 'camera-watch', name: 'Camera Watch', hwPkg: 'com.kcy.camerawatch.hw', ruPkg: 'com.kcy.camerawatch.rustore',
    pitch: {
      en: 'Camera Watch is a camera-guard assistant that watches a camera feed and warns you on movement, telling you what moved (a person, dog, cat or other). Motion is detected on-device.',
      ru: 'Camera Watch — помощник-охранник на основе камеры: следит за видеопотоком и предупреждает о движении, сообщая, что двигалось (человек, собака, кошка и т. п.). Движение распознаётся на устройстве.'
    },
    device: {
      en: 'The video is analysed <strong>on the device and never leaves it</strong>. Event snapshots and logs stay in local storage and are removed when you uninstall the app.',
      ru: 'Видео анализируется <strong>на устройстве и никогда его не покидает</strong>. Снимки событий и журналы хранятся локально и удаляются при удалении приложения.'
    },
    thirdParties: [{
      recipient: 'One-time on-device AI model download / your own camera URL',
      data: { en: 'Your IP address and a standard request to download the detection model once; if you enter an external camera stream URL, the app connects to that address you supplied (e.g. a camera on your local network).', ru: 'IP-адрес и стандартный запрос на однократную загрузку модели распознавания; если вы введёте URL внешней камеры, приложение подключается к указанному вами адресу (например, камере в вашей локальной сети).' },
      purpose: { en: 'To fetch the free detection model (runs locally) and, optionally, to read the camera stream you configured.', ru: 'Загрузка бесплатной модели распознавания (работает локально) и, по желанию, чтение настроенного вами видеопотока.' },
      policy: '—'
    }],
    permissions: [
      PERM.camera({ en: 'used only to watch the scene for motion; processed on-device, not uploaded by us.', ru: 'используется только для наблюдения за движением; обрабатывается на устройстве, нами не выгружается.' }),
      PERM.notif()
    ]
  },

  // ── monitor-bot ──
  {
    id: 'monitor-bot', name: 'Monitor Bot', hwPkg: 'com.kcy.monitorbot.hw', ruPkg: 'com.kcy.monitorbot.rustore',
    pitch: {
      en: 'Monitor Bot is an on-device watcher for any RSS/Atom feed or public JSON API you choose: it sends a local notification when a new entry appears or a keyword matches.',
      ru: 'Monitor Bot — наблюдатель на устройстве за любыми RSS/Atom-лентами или публичными JSON-API по вашему выбору: присылает локальное уведомление при появлении новой записи или совпадении ключевого слова.'
    },
    device: {
      en: 'The monitors you create, their logs and your settings are stored <strong>only on your device</strong>. There is no account and no cloud sync.',
      ru: 'Создаваемые вами наблюдатели, их журналы и настройки хранятся <strong>только на устройстве</strong>. Нет аккаунта и облачной синхронизации.'
    },
    thirdParties: [{
      recipient: 'The RSS/Atom or JSON sources you enter (and, optionally, a CORS proxy you configure)',
      data: { en: 'A standard request to the exact URL you added, and your IP address. No personal data is added by the app.', ru: 'Стандартный запрос к введённому вами URL и ваш IP-адрес. Приложение не добавляет персональных данных.' },
      purpose: { en: 'To check the source you chose for new content. If you enable an optional CORS proxy (e.g. corsproxy.io), your request passes through it.', ru: 'Проверка выбранного вами источника на новый контент. Если вы включите необязательный CORS-прокси (например, corsproxy.io), запрос идёт через него.' },
      policy: 'Each source’s / proxy’s own policy'
    }],
    permissions: [PERM.notif()]
  },

  // ── price-watch-bot ──
  {
    id: 'price-watch-bot', name: 'Price Watch Bot', hwPkg: 'com.kcy.pricewatchbot.hw', ruPkg: 'com.kcy.pricewatchbot.rustore',
    pitch: {
      en: 'Price Watch Bot tracks selected crypto and currency rates and sends a local notification when a price crosses a threshold you set. It only reads prices from free public sources and never handles wallets or payments.',
      ru: 'Price Watch Bot отслеживает выбранные крипто- и валютные курсы и присылает локальное уведомление, когда цена пересекает заданный вами порог. Он только читает цены из бесплатных публичных источников и не работает с кошельками или платежами.'
    },
    device: {
      en: 'Your watch list, thresholds and logs are stored <strong>only on your device</strong>. No wallet, no trading, no account.',
      ru: 'Ваш список отслеживания, пороги и журналы хранятся <strong>только на устройстве</strong>. Нет кошелька, торговли и аккаунта.'
    },
    thirdParties: [{
      recipient: 'Public price APIs: Binance, CoinGecko, open.er-api.com',
      data: { en: 'A standard read-only request for public price data, and your IP address. No personal data is sent.', ru: 'Стандартный запрос только на чтение публичных данных о ценах и ваш IP-адрес. Персональные данные не отправляются.' },
      purpose: { en: 'To read current market/exchange prices for the assets you chose to watch.', ru: 'Чтение текущих рыночных/обменных цен по выбранным вами активам.' },
      policy: 'Each provider’s own policy'
    }],
    permissions: [PERM.notif()]
  },

  // ── market-pulse (образователен финансов анализатор) ──
  {
    id: 'market-pulse', name: 'Market Pulse', hwPkg: 'com.kcy.marketpulse.hw', ruPkg: 'com.kcy.marketpulse.rustore',
    pitch: {
      en: 'Market Pulse is an EDUCATIONAL market analyzer. It reads public market data (crypto, gold, stock indices, real-estate ETFs), market sentiment and news, computes classic indicators for a period you choose, and shows an educational reading. It is NOT investment advice, handles no wallets or payments, and has no account.',
      ru: 'Market Pulse — ОБРАЗОВАТЕЛЬНЫЙ анализатор рынков. Он читает публичные рыночные данные (крипто, золото, биржевые индексы, ETF на недвижимость), настроение рынка и новости, рассчитывает классические индикаторы за выбранный период и показывает образовательный вывод. Это НЕ инвестиционный совет; нет кошельков, платежей и аккаунта.'
    },
    device: {
      en: 'Your language and app preferences are stored <strong>only on your device</strong>. There is no account, no wallet, no trading and no payments. All analysis is educational.',
      ru: 'Ваш язык и настройки приложения хранятся <strong>только на устройстве</strong>. Нет аккаунта, кошелька, торговли и платежей. Весь анализ — образовательный.'
    },
    thirdParties: [{
      recipient: 'Public market/data & news APIs: CoinGecko, Stooq, alternative.me (Fear & Greed), Google News RSS',
      data: { en: 'Standard read-only requests for public market data and news headlines, plus your IP address. No personal data is sent.', ru: 'Стандартные запросы только на чтение публичных рыночных данных и заголовков новостей, а также ваш IP-адрес. Персональные данные не отправляются.' },
      purpose: { en: 'To read public prices/indices, market sentiment and news for the market and period you choose.', ru: 'Чтение публичных цен/индексов, настроений рынка и новостей по выбранному рынку и периоду.' },
      policy: 'Each provider’s own policy'
    }],
    permissions: []
  },

  // ── routine-bot ──
  {
    id: 'routine-bot', name: 'Routine Bot', hwPkg: 'com.kcy.routinebot.hw', ruPkg: 'com.kcy.routinebot.rustore',
    pitch: {
      en: 'Routine Bot is a personal daily assistant: a morning briefing (weather, agenda, motivation), reminders for medication, habits and tasks, an optional evening summary, and it can read your notes aloud in 15 languages.',
      ru: 'Routine Bot — личный ежедневный помощник: утренний брифинг (погода, план, мотивация), напоминания о лекарствах, привычках и задачах, необязательное вечернее резюме и чтение ваших заметок вслух на 15 языках.'
    },
    device: {
      en: 'Your reminders, notes, habits and settings are stored <strong>only on your device</strong>. Text-to-speech uses your device’s speaker. There is no account and no cloud.',
      ru: 'Ваши напоминания, заметки, привычки и настройки хранятся <strong>только на устройстве</strong>. Синтез речи использует динамик устройства. Нет аккаунта и облака.'
    },
    thirdParties: [{
      recipient: 'Open-Meteo (weather), <code>open-meteo.com</code>',
      data: { en: 'The city name you type or, only if you grant location, your approximate coordinates; plus your IP address.', ru: 'Название города, которое вы вводите, или — только если вы дадите разрешение — ваши приблизительные координаты; плюс IP-адрес.' },
      purpose: { en: 'To fetch the public weather forecast for the morning briefing.', ru: 'Получение публичного прогноза погоды для утреннего брифинга.' },
      policy: '<a href="https://open-meteo.com/en/terms">open-meteo.com/en/terms</a>'
    }],
    permissions: [
      PERM.notif(),
      PERM.location({ en: 'requested only if you choose “use my location” for local weather; otherwise you simply type a city name and no location is used.', ru: 'запрашивается только если вы выберете «использовать моё местоположение» для погоды; иначе вы просто вводите название города и геолокация не используется.' })
    ]
  },

  // ── autoreply-bot ──
  {
    id: 'autoreply-bot', name: 'Auto-Reply Bot', hwPkg: 'com.kcy.autoreplybot.hw', ruPkg: 'com.kcy.autoreplybot.rustore',
    pitch: {
      en: 'Auto-Reply Bot answers messages for you by your own rules: keyword triggers with ready replies, office hours, away messages and allow/block lists, with a built-in demo inbox to test everything.',
      ru: 'Auto-Reply Bot отвечает на сообщения за вас по вашим правилам: триггеры по ключевым словам с готовыми ответами, рабочие часы, сообщения об отсутствии и списки разрешённых/заблокированных, со встроенным демо-ящиком для проверки.'
    },
    device: {
      en: 'Your rules and reply logs are stored <strong>only on your device</strong>. The core works fully offline; no contacts are read.',
      ru: 'Ваши правила и журналы ответов хранятся <strong>только на устройстве</strong>. Основная работа полностью офлайн; контакты не читаются.'
    },
    thirdParties: [{
      recipient: 'A KCY chat channel you choose to connect (e.g. <code>my.girl.place</code>, <code>kaji.kak.si</code>)',
      data: { en: 'Only if you connect a channel: the messages of that channel and your replies pass over HTTP to the server you configured, plus your IP address.', ru: 'Только если вы подключите канал: сообщения этого канала и ваши ответы передаются по HTTP на настроенный вами сервер, плюс ваш IP-адрес.' },
      purpose: { en: 'To let the bot read incoming messages of the channel you connected and post your automatic replies. This is optional.', ru: 'Чтобы бот читал входящие сообщения подключённого канала и отправлял ваши автоответы. Это необязательно.' },
      policy: 'The connected service’s own policy'
    }],
    permissions: [PERM.notif()]
  },

  // ── business-faq-bot ──
  {
    id: 'business-faq-bot', name: 'Business FAQ Bot', hwPkg: 'com.kcy.businessfaqbot.hw', ruPkg: 'com.kcy.businessfaqbot.rustore',
    pitch: {
      en: 'Business FAQ Bot automatically answers your customers’ frequently asked questions from a keyword FAQ knowledge base, with greetings, office-hours messages, quick replies and a fallback to a human. It runs entirely on-device with no paid AI.',
      ru: 'Business FAQ Bot автоматически отвечает на частые вопросы клиентов из базы FAQ по ключевым словам, с приветствиями, сообщениями о рабочих часах, быстрыми ответами и передачей человеку. Работает полностью на устройстве без платного ИИ.'
    },
    device: {
      en: 'The FAQ knowledge base and settings are stored <strong>only on your device</strong>. Answering works fully offline.',
      ru: 'База FAQ и настройки хранятся <strong>только на устройстве</strong>. Ответы работают полностью офлайн.'
    },
    thirdParties: [{
      recipient: 'A KCY chat channel you choose to connect (e.g. <code>my.girl.place</code>)',
      data: { en: 'Only if you connect a channel: its incoming messages and your answers pass over HTTP to the server you configured, plus your IP address.', ru: 'Только если вы подключите канал: его входящие сообщения и ваши ответы передаются по HTTP на настроенный вами сервер, плюс ваш IP-адрес.' },
      purpose: { en: 'To let the bot answer messages on the channel you connected. This is optional.', ru: 'Чтобы бот отвечал на сообщения подключённого канала. Это необязательно.' },
      policy: 'The connected service’s own policy'
    }],
    permissions: [PERM.notif()]
  },

  // ── services-toolkit ──
  {
    id: 'services-toolkit', name: 'Services Toolkit', hwPkg: 'com.kcy.servicestoolkit.hw', ruPkg: 'com.kcy.servicestoolkit.rustore',
    genAI: {
      en: 'One tool is a free AI text helper. When (and only when) you use it, the prompt text you type is sent to a free third-party generative-AI service, <code>text.pollinations.ai</code>, which returns the generated text. Do not enter personal or sensitive information into that tool. All other tools work without AI.',
      ru: 'Один из инструментов — бесплатный ИИ-помощник для текста. Когда (и только когда) вы им пользуетесь, введённый вами текст запроса отправляется в бесплатный сторонний сервис генеративного ИИ <code>text.pollinations.ai</code>, который возвращает сгенерированный текст. Не вводите в него личную или конфиденциальную информацию. Остальные инструменты работают без ИИ.'
    },
    pitch: {
      en: 'Services Toolkit is an all-in-one utility box: QR codes, password and text tools, calculators, image and PDF compression, currency rates and crypto charts, a web scraper and a free AI text helper. Most tools run entirely on-device; a few fetch live online data.',
      ru: 'Services Toolkit — универсальный набор инструментов: QR-коды, инструменты для паролей и текста, калькуляторы, сжатие изображений и PDF, курсы валют и графики крипты, веб-скрапер и бесплатный ИИ-помощник для текста. Большинство инструментов работают на устройстве; некоторые загружают данные онлайн.'
    },
    device: {
      en: 'The offline tools (QR, passwords, calculators, text tools, image/PDF compression) run <strong>fully on-device</strong>. Your settings stay local. There is no account.',
      ru: 'Офлайн-инструменты (QR, пароли, калькуляторы, текст, сжатие изображений/PDF) работают <strong>полностью на устройстве</strong>. Настройки остаются локальными. Аккаунта нет.'
    },
    thirdParties: [
      {
        recipient: 'text.pollinations.ai (free AI text)',
        data: { en: 'Only when you use the AI text tool: the prompt text you type, and your IP address.', ru: 'Только при использовании ИИ-инструмента: введённый текст запроса и ваш IP-адрес.' },
        purpose: { en: 'To generate the text you asked for.', ru: 'Генерация запрошенного вами текста.' },
        policy: '<a href="https://pollinations.ai">pollinations.ai</a>'
      },
      {
        recipient: 'Public data APIs: Binance, CoinGecko, exchangerate.host, open.er-api.com; a CDN (jsdelivr) and an optional CORS proxy',
        data: { en: 'Only when you use the online tools: a standard read-only request and your IP address. No personal data is added.', ru: 'Только при использовании онлайн-инструментов: стандартный запрос только на чтение и ваш IP-адрес. Персональные данные не добавляются.' },
        purpose: { en: 'To fetch currency rates and crypto charts, load libraries, or run the web scraper on a URL you enter.', ru: 'Получение курсов валют и графиков крипты, загрузка библиотек или работа веб-скрапера по введённому вами URL.' },
        policy: 'Each provider’s own policy'
      }
    ],
    permissions: [
      PERM.camera({ en: 'used only when you open the QR-scanner tool; the image is processed on-device.', ru: 'используется только при открытии инструмента сканирования QR; изображение обрабатывается на устройстве.' }),
      PERM.files({ en: 'used only when you pick a file to compress or process; files are handled locally.', ru: 'используется только когда вы выбираете файл для сжатия или обработки; файлы обрабатываются локально.' }),
      PERM.notif()
    ]
  },

  // ── selflearning-friend ──
  {
    id: 'selflearning-friend', name: 'Self-Learning Friend', hwPkg: 'com.kcy.selflearningfriend.hw', ruPkg: 'com.kcy.selflearningfriend.rustore',
    genAI: {
      en: 'The app is a self-learning AI companion. It generates conversation and learns from public web knowledge on-device. It has <strong>no developer AI backend collecting your data</strong>; knowledge and translation come from the public sources listed above, and everything the companion learns and remembers stays on your device.',
      ru: 'Приложение — самообучающийся ИИ-компаньон. Он ведёт беседу и учится из публичных веб-знаний на устройстве. У него <strong>нет разработческого ИИ-бэкенда, собирающего ваши данные</strong>; знания и перевод берутся из перечисленных выше публичных источников, а всё, что компаньон выучил и запомнил, остаётся на вашем устройстве.'
    },
    pitch: {
      en: 'Self-Learning Friend is a private AI companion that you name and teach yourself: it talks with you by voice or text, learns knowledge from the web, and can see through the camera. Everything it learns stays on your device, tied to a secret code word only you know.',
      ru: 'Self-Learning Friend — личный ИИ-компаньон, которого вы называете и обучаете сами: общается голосом или текстом, учится из интернета и может «видеть» через камеру. Всё, что он узнаёт, остаётся на вашем устройстве и защищено секретным кодовым словом, известным только вам.'
    },
    device: {
      en: 'There is <strong>no developer account or sign-in</strong>; access is guarded by a code word you choose. The companion’s name, everything it learns, your conversations and habits are stored <strong>only on your device</strong> and are not uploaded by us.',
      ru: '<strong>Аккаунта разработчика и входа нет</strong>; доступ защищён выбранным вами кодовым словом. Имя компаньона, всё выученное, ваши беседы и привычки хранятся <strong>только на устройстве</strong> и нами не выгружаются.'
    },
    thirdParties: [
      {
        recipient: 'Public knowledge sources (e.g. Wikipedia / Wikimedia, OpenSearch, YouTube) that you or the learning feature query',
        data: { en: 'The search terms / topic being learned, and your IP address. No personal identity is attached.', ru: 'Поисковые слова / изучаемая тема и ваш IP-адрес. Личность не прикрепляется.' },
        purpose: { en: 'To fetch general public knowledge the companion learns from.', ru: 'Получение общедоступных знаний, на которых учится компаньон.' },
        policy: 'Each source’s own policy'
      },
      {
        recipient: 'MyMemory translation (Translated S.r.l.)',
        data: { en: 'The text to translate, the language pair, and a fixed developer contact email used only to raise the free quota (not your email); your IP address.', ru: 'Текст для перевода, пара языков и фиксированный контактный e-mail разработчика, используемый только для повышения бесплатной квоты (не ваш e-mail); ваш IP-адрес.' },
        purpose: { en: 'To translate text when translation is used.', ru: 'Перевод текста, когда используется перевод.' },
        policy: '<a href="https://mymemory.translated.net/doc/en/privacy.php">mymemory.translated.net privacy</a>'
      },
      {
        recipient: 'Optional: your own server, if you enter its address',
        data: { en: 'Only if you configure it: a sync of the companion’s knowledge to the server you supplied, over HTTPS.', ru: 'Только если вы его настроите: синхронизация знаний компаньона на указанный вами сервер по HTTPS.' },
        purpose: { en: 'Optional self-hosted sync/execution you control. Off by default.', ru: 'Необязательная синхронизация/выполнение на вашем сервере под вашим контролем. По умолчанию выключено.' },
        policy: 'Your own server'
      }
    ],
    permissions: [
      PERM.camera({ en: 'used only for the optional Vision feature when you ask the companion to “see”; images are processed for the conversation and not uploaded by us.', ru: 'используется только для необязательной функции «Зрение», когда вы просите компаньона «посмотреть»; изображения обрабатываются для беседы и нами не выгружаются.' }),
      PERM.mic({ en: 'used only for voice conversation (speech recognition) when you talk to the companion.', ru: 'используется только для голосового общения (распознавание речи), когда вы говорите с компаньоном.' })
    ]
  },

  // ── chat (обвивка към сървър) ──
  {
    id: 'chat', name: 'KCY Chat', hwPkg: 'com.kcy.chat.hw', ruPkg: 'com.kcy.chat.rustore',
    serverWrapper: {
      domain: 'my.girl.place',
      content_en: 'the messages you send, and profile/service details you choose to add',
      content_ru: 'отправляемые вами сообщения и данные профиля/услуг, которые вы решите добавить',
      extra_en: 'Messages are delivered to the people you chat with. Do not share more personal data than you are comfortable with.',
      extra_ru: 'Сообщения доставляются вашим собеседникам. Не делитесь большим объёмом персональных данных, чем вам комфортно.'
    },
    name_ru: 'KCY Chat',
    pitch: {
      en: 'KCY Chat is a real-time messaging app that connects you to the KCY chat service. Pick from 15 languages and start chatting once you are online.',
      ru: 'KCY Chat — приложение для обмена сообщениями в реальном времени, подключающее вас к сервису чата KCY. Выберите один из 15 языков и начните общение, когда вы онлайн.'
    },
    device: {
      en: 'On the device itself the app stores essentially only your chosen interface language. Your account and messages live on the server so the service can deliver them.',
      ru: 'На самом устройстве приложение хранит по сути только выбранный язык интерфейса. Ваш аккаунт и сообщения находятся на сервере, чтобы сервис мог их доставлять.'
    },
    thirdParties: [],
    permissions: []
  },

  // ── houselookbook (обвивка към сървър) ──
  {
    id: 'houselookbook', name: 'HouseLookBook', hwPkg: 'com.kcy.houselookbook.hw', ruPkg: 'com.kcy.houselookbook.rustore',
    serverWrapper: {
      domain: 'look.myhousesetup.com',
      content_en: 'the home designs, room layouts, colours and any photos you upload',
      content_ru: 'дизайны дома, планировки комнат, цвета и любые загружаемые вами фото',
      extra_en: 'Designs you publish and your likes are visible in the community gallery/ranking. A subscription for premium features is handled through the store billing.',
      extra_ru: 'Публикуемые вами дизайны и лайки видны в галерее/рейтинге сообщества. Подписка на премиум-функции оформляется через биллинг магазина.'
    },
    pitch: {
      en: 'HouseLookBook lets you design and arrange your dream home floor by floor, upload photos, browse a gallery of other people’s homes and climb a community ranking.',
      ru: 'HouseLookBook позволяет проектировать и обустраивать дом дома этаж за этажом, загружать фото, просматривать галерею чужих домов и подниматься в рейтинге сообщества.'
    },
    device: {
      en: 'On the device the app stores essentially only your chosen interface language. Your account, designs and uploaded photos live on the server so the service can show and rank them.',
      ru: 'На устройстве приложение хранит по сути только выбранный язык интерфейса. Ваш аккаунт, дизайны и загруженные фото находятся на сервере, чтобы сервис мог их показывать и ранжировать.'
    },
    thirdParties: [],
    permissions: []
  }
];

// ── Запис ───────────────────────────────────────────────────────────────────────────────────────
let written = 0, removed = 0;
for (const app of APPS) {
  const dir = path.join(ROOT, 'huawei', app.id, 'publish');
  if (!fs.existsSync(dir)) { console.log('! няма папка:', dir); continue; }
  fs.writeFileSync(path.join(dir, 'hw-privacy.html'), renderHw(app)); written++;
  fs.writeFileSync(path.join(dir, 'rustore-privacy.html'), renderRustore(app)); written++;
  // Стария общ ru-privacy.html го трием (заменен от rustore-privacy.html). Newslator не пипаме.
  const oldRu = path.join(dir, 'ru-privacy.html');
  if (fs.existsSync(oldRu)) { fs.unlinkSync(oldRu); removed++; }
  console.log('✓', app.id, '→ hw-privacy.html + rustore-privacy.html');
}
console.log(`\nГотово: записани ${written} файла, изтрити ${removed} стари ru-privacy.html.`);
