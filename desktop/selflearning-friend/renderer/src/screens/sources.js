// sources.js (екран) — „Източници на знание“: локалното е ВИНАГИ master.
//
// Секции: Локално (по подразбиране) · Запази знанието (бекъп) · Внеси от файл ·
//         Изтегли от URL (по избор) · Синхронизирай към сървъра · Слушай (push).
import { el, clear, toast } from '../ui/dom.js';
import { memoryCount } from '../core/memory-store.js';
import {
  exportToFile, importFromJsonText, pullFromUrl, exportToServer,
  sourcesSettings, saveSourcesSettings, storageLocationLabel
} from '../core/knowledge.js';
import { getLearnRole } from '../core/learning-loop.js';
import {
  listBundledPacks, importBundledPack, importPackFromJsonText
} from '../core/packs.js';
import {
  listenSettings, saveListenSettings, listenLog, pollOnce,
  startListening, stopListening, isListening
} from '../core/listen.js';
import { serverLink, currentUrls, saveServerLink, connectWithKey, buildConnectionUrl } from '../core/server-link.js';
import { SERVER_PRESETS, DEFAULT_PRESET_DOMAIN } from '../core/server-presets.js';
import { t } from '../core/i18n.js';

export function renderSources(root, { rerender }) {
  clear(root);
  root.appendChild(el('h2', {}, t('screen_sources')));

  // --- Индикатор „Къде се пази знанието“ + значка за ролята ---
  const loc = storageLocationLabel();
  const reader = getLearnRole() === 'reader';
  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent-2)' }, [
    el('div', { style: 'font-weight:700' }, loc.text),
    el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' },
      loc.serverConfigured
        ? 'Локалното е главно (master). Към сървъра се изпраща само когато ти поискаш — не автоматично.'
        : 'Локалното е главно (master). Не е зададен сървър — знанието не напуска това устройство.'),
    el('div', { style: 'margin-top:8px' }, [
      el('span', {
        class: 'badge',
        style: 'background:' + (reader ? 'transparent' : 'var(--accent-2)') + (reader ? ';border:1px solid var(--accent-2)' : '')
      }, reader ? '🔖 Роля: Само чете (не трупа знание)' : '🎓 Роля: Учащ')
    ])
  ]));

  // --- Локално (master) — ТОЧКА 1, винаги първа и препоръчана ---
  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent-2)' }, [
    el('h3', {}, '1) Локално — препоръчано (работи веднага)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'За повечето хора това е достатъчно: започни СЕГА, без сървър и без акаунт. ' +
      `Цялото знание живее тук, на устройството ти (${memoryCount()} записа) и работи офлайн. ` +
      'Ограничено е (само това устройство), но можеш да ме тестваш веднага. ' +
      'Всичко по-долу (сървър, синхрон, „Слушай") е ПО ИЗБОР — за по-напреднали.'),
    el('p', { class: 'muted', style: 'font-size:12px' },
      'Локалното е винаги главно (master) — дори всичко друго да изчезне, аз пазя това знание.')
  ]));

  // --- Запази знанието (бекъп) ---
  const pathBox = el('p', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap' }, '');
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Запази знанието (бекъп)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Прави JSON с цялата памет, записва го на телефона и предлага споделяне. ' +
      'Честно: апът не може да пише директно на компютъра — ти прехвърляш файла.'),
    el('button', { class: 'block', onclick: async () => {
      const r = await exportToFile();
      if (r.ok) {
        pathBox.textContent = `Файлът е тук:\n${r.path}` + (r.shared ? '\n(отворих и менюто за споделяне)' : '');
        toast('Бекъпът е готов.');
      } else {
        pathBox.textContent = 'Грешка: ' + (r.reason || 'неизвестно');
      }
    } }, 'Запази знанието'),
    pathBox
  ]));

  // --- Внеси от файл ---
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json' });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Внеси от файл'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Зареди предишен бекъп (или пакет знание). Сливам в локалното, без дубликати — нищо не трия.'),
    fileInput,
    el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) { toast('Първо избери файл.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const r = importFromJsonText(String(reader.result || ''));
        if (r.ok) { toast(`Внесох ${r.added} нови (пропуснати ${r.skipped}).`); rerender(); }
        else toast('Грешка: ' + (r.reason || 'неизвестно'));
      };
      reader.onerror = () => toast('Не можах да прочета файла.');
      reader.readAsText(f);
    } }, 'Внеси и слей')
  ]));

  // --- Пакети знание (готови знания + стартови основи) ---
  const packsRes = el('p', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap;margin-top:8px' }, '');
  const reportPack = (label, r) => {
    if (r.ok) {
      packsRes.textContent = `${label}: внесох ${r.added} нови (пропуснати ${r.skipped} вече налични).`;
      toast(`Внесох ${r.added} нови знания.`);
      rerender();
    } else {
      packsRes.textContent = 'Грешка: ' + (r.reason || 'неизвестно');
      toast('Грешка при внасяне.');
    }
  };

  // Бутони за вградените стартови пакети (реално съдържание, офлайн).
  const bundledBtns = listBundledPacks().map((p) =>
    el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: () => {
      reportPack('Основи: ' + p.name, importBundledPack(p.id));
    } }, `Внеси основи: ${p.name} (${p.count})`)
  );

  // Текстово поле + файл за внасяне на собствен пакет знание (JSON).
  const packArea = el('textarea', {
    placeholder: '{ "name": "...", "topic": "...", "entries": [ { "type":"qa", "key":"...", "value":"..." } ] }',
    style: 'width:100%;min-height:90px;margin-top:8px;font-family:monospace;font-size:12px'
  });
  const packFile = el('input', { type: 'file', accept: 'application/json,.json', style: 'margin-top:8px' });

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Пакети знание'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Внеси готови знания наведнъж. „Основите“ са вградени (програмиране и Linux) — работят офлайн ' +
      'и се сливат в локалното без дубликати. Можеш и да поставиш/заредиш свой пакет ' +
      '(JSON с „entries“) от учител или Claude Code.'),
    ...bundledBtns,
    el('label', { style: 'margin-top:12px' }, 'Свой пакет (постави JSON)'), packArea,
    el('button', { class: 'block', style: 'margin-top:8px', onclick: () => {
      const txt = String(packArea.value || '').trim();
      if (!txt) { toast('Първо постави JSON.'); return; }
      reportPack('Поставен пакет', importPackFromJsonText(txt));
    } }, 'Внеси от текста'),
    el('label', { style: 'margin-top:12px' }, 'или зареди пакет от файл'), packFile,
    el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: () => {
      const f = packFile.files && packFile.files[0];
      if (!f) { toast('Първо избери файл.'); return; }
      const reader = new FileReader();
      reader.onload = () => reportPack('Пакет от файл', importPackFromJsonText(String(reader.result || '')));
      reader.onerror = () => toast('Не можах да прочета файла.');
      reader.readAsText(f);
    } }, 'Внеси от файла'),
    packsRes
  ]));

  // --- Изтегли от URL (по избор) ---
  const srcCfg = sourcesSettings();
  const pullUrl = el('input', { type: 'text', placeholder: 'https://… (пакет знание)', value: srcCfg.pullUrl });
  const pullSw = el('div', { class: 'switch' + (srcCfg.pullEnabled ? ' on' : '') });
  pullSw.addEventListener('click', () => {
    const next = !sourcesSettings().pullEnabled;
    saveSourcesSettings({ pullEnabled: next });
    pullSw.className = 'switch' + (next ? ' on' : '');
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Изтегли от URL (по избор)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Взема пакет знание от твой линк (продукционен сървър или безплатен линк) и ДОБАВЯ към локалното. ' +
      'Никога не замества. Изключено по подразбиране.'),
    el('div', { class: 'toggle' }, [ el('div', {}, el('div', {}, 'Разреши изтегляне от URL')), pullSw ]),
    el('label', {}, 'URL на пакета'), pullUrl,
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      el('button', { class: 'secondary grow', onclick: () => {
        saveSourcesSettings({ pullUrl: pullUrl.value.trim() }); toast('Запазено.');
      } }, 'Запази URL'),
      el('button', { class: 'grow', onclick: async () => {
        if (!sourcesSettings().pullEnabled) { toast('Първо разреши изтеглянето.'); return; }
        saveSourcesSettings({ pullUrl: pullUrl.value.trim() });
        const r = await pullFromUrl(pullUrl.value.trim());
        if (r.ok) { toast(`Изтеглих ${r.added} нови (пропуснати ${r.skipped}).`); rerender(); }
        else toast('Грешка: ' + (r.reason || 'неизвестно'));
      } }, 'Изтегли сега')
    ])
  ]));

  // --- СВЪРЖИ КЪМ СЪРВЪР (само ДОМЕЙН + TOKEN) ------------------------------
  // Собственикът въвежда само домейна и token-а от деплой-скрипт 39. Апът сам прави
  // пълните URL-та (същата схема като скрипта). Така е лесно и без грешки.
  const link = serverLink();
  const domainIn = el('input', { type: 'text', placeholder: 'selflearning.bot.nu', value: link.domain || 'selflearning.bot.nu', autocapitalize: 'none', autocomplete: 'off' });
  const tokenIn = el('input', { type: 'text', placeholder: 'token от скрипт 39', value: link.token, autocapitalize: 'none', autocomplete: 'off' });
  const urlsBox = el('div', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap;margin-top:8px' }, '');
  function renderUrls() {
    const u = currentUrls();
    urlsBox.textContent = u.ok
      ? 'Апът ще ползва:\n• sync:   ' + u.sync + '\n• слушай: ' + u.listen + '\n• проверка: ' + u.health
      : 'Въведи домейн + token — пълните адреси се правят автоматично.';
  }
  renderUrls();

  // --- ЛЕСНО: свържи робота с КЛЮЧ за връзка ---------------------------------
  // Свързването със сървър се настройва от специалист (деплой опция 2 → 38 → 39).
  // Собственикът въвежда само ключа (домейнът е по подразбиране); чужд сървър → свой домейн + ключ.
  // Падащо меню с ГОТОВИ домейни (идват от private/configs/.env при компилация → server-presets.js),
  // за да не се преписват на ръка. Плюс опция „Друг" за ръчно въвеждане.
  const presetOptions = SERVER_PRESETS.map((p) => el('option', { value: p.domain }, p.label));
  presetOptions.push(el('option', { value: '__custom__' }, 'Друг (въведи ръчно)…'));
  const keyDomainSel = el('select', { style: 'width:100%' }, presetOptions);
  const keyDomainCustom = el('input', { type: 'text', placeholder: 'напр. kcy-srv.tail3c87c4.ts.net', autocapitalize: 'none', autocomplete: 'off', style: 'display:none;margin-top:6px' });
  const savedDom = link.domain || DEFAULT_PRESET_DOMAIN;
  if (SERVER_PRESETS.some((p) => p.domain === savedDom)) {
    keyDomainSel.value = savedDom;
  } else if (link.domain) {
    keyDomainSel.value = '__custom__';
    keyDomainCustom.value = link.domain;
    keyDomainCustom.style.display = '';
  }
  keyDomainSel.addEventListener('change', () => {
    keyDomainCustom.style.display = (keyDomainSel.value === '__custom__') ? '' : 'none';
  });
  const resolveKeyDomain = () => (keyDomainSel.value === '__custom__' ? keyDomainCustom.value.trim() : keyDomainSel.value);
  const keyIn = el('input', { type: 'text', placeholder: 'ключ за връзка', autocapitalize: 'none', autocomplete: 'off' });
  const keyHint = el('div', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap;margin-top:8px' }, '');
  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent)' }, [
    el('h3', {}, '🔑 Свържи робота (ключ за връзка)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Свързването със сървър се настройва от СПЕЦИАЛИСТ, който има деплой скриптовете ' +
      '(накратко: деплой опция 2 → опция 38 → опция 39). За повечето хора това НЕ е нужно — ' +
      'работя си отлично и само локално.'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Избери домейна от списъка (готовите идват от настройката при компилация). ' +
      '„Публичен" — за истинския сайт; „Tailscale" — за телефон към твоята виртуалка; „Друг" — ръчно.'),
    el('label', {}, 'Домейн на сървъра (избери)'), keyDomainSel, keyDomainCustom,
    el('label', {}, 'Ключ за връзка'), keyIn,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: async () => {
      const dom = resolveKeyDomain() || DEFAULT_PRESET_DOMAIN;
      const k = keyIn.value.trim();
      if (!k) { toast('Въведи ключа за връзка.'); return; }
      const ref = /^https?:\/\//i.test(k) ? k : (dom + '/' + k);
      keyHint.textContent = 'Свързвам се…';
      const r = await connectWithKey(ref);
      if (r.ok) {
        domainIn.value = r.domain; tokenIn.value = r.token; renderUrls();
        keyHint.textContent = `✓ Свързан с ${r.domain}`;
        toast('Връзката е готова — настроих се сам.');
      } else {
        keyHint.textContent = '✗ ' + (r.error || 'неуспех');
        toast('Не успях: ' + (r.error || 'неизвестно'));
      }
    } }, 'Свържи'),
    keyHint
  ]));

  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent-2)' }, [
    el('h3', {}, '🔗 Свържи към сървър (ръчно: домейн + token)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Въведи САМО домейна и token-а. Останалото го прави апът сам — еднакво за всеки сървър. ' +
      'Локалното знание остава главно (master).'),
    el('p', { class: 'muted', style: 'font-size:12px' },
      '❓ Тези данни ги подготвя СПЕЦИАЛИСТ, който има деплой скриптовете: деплой (опция 2) → ' +
      'опция 38 (вдига услугата на сървъра) → опция 39 (показва ДОМЕЙНА и TOKEN-а). Копираш ги тук. ' +
      'Същият token върви за десктоп и за телефон (1 сървър = 1 робот). Сървър не е задължителен — ' +
      'без него работя само локално.'),
    el('label', {}, 'Домейн на сървъра'), domainIn,
    el('label', {}, 'Token (от опция 39 на сървъра)'), tokenIn,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: () => {
      const d = domainIn.value.trim(), t = tokenIn.value.trim();
      if (!d || !t) { toast('Въведи и домейн, и token.'); return; }
      const r = saveServerLink(d, t);
      domainIn.value = r.domain; // показва нормализирания домейн
      renderUrls();
      toast('Връзката е запазена. Готово за sync и „Слушай“.');
    } }, 'Запази връзката'),
    urlsBox,
    el('p', { class: 'muted', style: 'font-size:12px;margin-top:6px' },
      'Същият token върви за десктоп И телефон на ЕДИН робот (1 сървър = 1 робот).')
  ]));

  // --- Синхронизирай към сървъра (ползва запазената връзка) ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Синхронизирай към сървъра (по избор)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Изпраща (POST) знанието към сървъра от връзката по-горе. Локалното остава главно. ' +
      'Може и през чат командата „<кодова дума>, синхронизирай към сървъра!“.'),
    el('button', { class: 'block', onclick: async () => {
      const ep = currentUrls().sync;
      if (!ep) { toast('Първо свържи към сървър (домейн + token) по-горе.'); return; }
      const r = await exportToServer(ep);
      if (r.ok) toast(`Изпратих ${r.count} записа.`);
      else toast('Грешка: ' + (r.reason || 'неизвестно'));
    } }, 'Изпрати сега')
  ]));

  // --- Слушай (push от външен учител; ползва запазената връзка) ---
  const lc = listenSettings();
  const listenSw = el('div', { class: 'switch' + (lc.enabled ? ' on' : '') });
  listenSw.addEventListener('click', () => {
    if (!currentUrls().ok) { toast('Първо свържи към сървър (домейн + token) по-горе.'); return; }
    const next = !listenSettings().enabled;
    saveListenSettings({ enabled: next });
    listenSw.className = 'switch' + (next ? ' on' : '');
    if (next) startListening(rerender); else stopListening();
    rerender();
  });
  const logBox = el('div', { style: 'margin-top:8px;font-size:12px' });
  for (const e of listenLog().slice(0, 10)) {
    logBox.appendChild(el('div', { class: 'muted' }, `• ${e.note || ''}`));
  }
  if (!listenLog().length) logBox.appendChild(el('div', { class: 'muted' }, 'Още няма активност.'));

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Слушай (безплатен push)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Когато е включено, периодично питам сървъра (от връзката по-горе) за нови уроци и ги вливам в локалното. ' +
      'Така външен учител (напр. Claude Code) ми праща уроци безплатно — аз само слушам, нищо не плащам.'),
    el('div', { class: 'toggle' }, [
      el('div', {}, el('div', {}, 'Слушане ' + (isListening() ? '(активно)' : ''))),
      listenSw
    ]),
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      el('button', { class: 'grow', onclick: async () => {
        if (!currentUrls().ok) { toast('Първо свържи към сървър по-горе.'); return; }
        await pollOnce(); rerender();
      } }, 'Провери сега')
    ]),
    el('div', {}, [ el('div', { class: 'muted', style: 'margin-top:10px;font-weight:600' }, 'Дневник:'), logBox ])
  ]));
}
