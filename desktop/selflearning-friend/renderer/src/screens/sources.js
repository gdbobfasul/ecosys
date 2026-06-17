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

export function renderSources(root, { rerender }) {
  clear(root);
  root.appendChild(el('h2', {}, 'Източници на знание'));

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

  // --- Локално (master) ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Локално (главно, по подразбиране)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      `Цялото знание живее тук, на устройството ти (${memoryCount()} записа). ` +
      'Това е каноничният източник — никога не зависи от сървър. Дори всичко друго да изчезне, ' +
      'аз пазя локалното знание.')
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

  // --- Синхронизирай към сървъра ---
  const serverEp = el('input', { type: 'text', placeholder: 'https://твой-сървър/knowledge', value: srcCfg.serverEndpoint });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Синхронизирай към сървъра (по избор)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Изпраща (POST) знанието към твой продукционен endpoint. Локалното остава главно. ' +
      'Може и през чат командата „<кодова дума>, синхронизирай към сървъра!“.'),
    el('label', {}, 'Endpoint'), serverEp,
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      el('button', { class: 'secondary grow', onclick: () => {
        saveSourcesSettings({ serverEndpoint: serverEp.value.trim() }); toast('Запазено.');
      } }, 'Запази'),
      el('button', { class: 'grow', onclick: async () => {
        saveSourcesSettings({ serverEndpoint: serverEp.value.trim() });
        const r = await exportToServer(serverEp.value.trim());
        if (r.ok) toast(`Изпратих ${r.count} записа.`);
        else toast('Грешка: ' + (r.reason || 'неизвестно'));
      } }, 'Изпрати сега')
    ])
  ]));

  // --- Слушай (push от външен учител) ---
  const lc = listenSettings();
  const relayUrl = el('input', { type: 'text', placeholder: 'https://relay/… (GET връща уроци)', value: lc.relayUrl });
  const listenSw = el('div', { class: 'switch' + (lc.enabled ? ' on' : '') });
  listenSw.addEventListener('click', () => {
    const next = !listenSettings().enabled;
    saveListenSettings({ enabled: next, relayUrl: relayUrl.value.trim() });
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
      'Когато е включено, периодично питам твой relay URL за нови уроци и ги вливам в локалното. ' +
      'Така външен учител (напр. Claude Code) ми праща уроци безплатно — аз само слушам, нищо не плащам. ' +
      'Договор: GET връща масив [{type,key,value,keywords}]; по избор POST /ack.'),
    el('div', { class: 'toggle' }, [
      el('div', {}, el('div', {}, 'Слушане ' + (isListening() ? '(активно)' : ''))),
      listenSw
    ]),
    el('label', {}, 'Relay URL'), relayUrl,
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      el('button', { class: 'secondary grow', onclick: () => {
        saveListenSettings({ relayUrl: relayUrl.value.trim() }); toast('Запазено.');
      } }, 'Запази'),
      el('button', { class: 'grow', onclick: async () => {
        saveListenSettings({ relayUrl: relayUrl.value.trim() });
        await pollOnce(); rerender();
      } }, 'Провери сега')
    ]),
    el('div', {}, [ el('div', { class: 'muted', style: 'margin-top:10px;font-weight:600' }, 'Дневник:'), logBox ])
  ]));
}
