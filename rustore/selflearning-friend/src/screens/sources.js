// Version: 1.0014
// sources.js (екран) — „Източници на знание“: локалното е ВИНАГИ master.
//
// Секции: Локално (по подразбиране) · Запази знанието (бекъп) · Внеси от файл ·
//         Изтегли от URL (по избор) · Синхронизирай към сървъра · Слушай (push).
import { el, clear, toast } from '../ui/dom.js';
import { pickTextFile } from '../core/filepick.js';
import { memoryCount } from '../core/memory-store.js';
import {
  exportToFile, importFromJsonText, pullFromUrl, exportToServer,
  sourcesSettings, saveSourcesSettings, storageLocationLabel
} from '../core/knowledge.js';
import { getLearnRole } from '../core/learning-loop.js';
import {
  listBundledPacks, importBundledPack, importPackFromJsonText,
  catalogUrl, setCatalogUrl, listCatalog, importFromCatalog
} from '../core/packs.js';
import {
  listenSettings, saveListenSettings, listenLog, pollOnce,
  startListening, stopListening, isListening
} from '../core/listen.js';
import { serverLink, currentUrls, saveServerLink, connectWithKey, buildConnectionUrl, disconnectServer, serverLinkConfigured, serverInfo, pingHealth } from '../core/server-link.js';
import { SERVER_PRESETS, DEFAULT_PRESET_DOMAIN } from '../core/server-presets.js';
import { t, tf } from '../core/i18n.js';

export function renderSources(root, { rerender }) {
  clear(root);
  root.appendChild(el('h2', {}, t('screen_sources')));

  // Блок „Към кой модел/сървър съм свързан“ + проверка НА ЖИВО (виртуалката отговаря ли сега).
  // Показва ИМЕТО на модела, обявен от сървъра (от connection.bot.token), и бутон, който пита
  // {домейн}/api/selflearning/health → казва веднага дали връзката работи в момента.
  function serverHealthBlock() {
    const info = serverInfo();
    const wrap = el('div', { style: 'margin-top:12px' });
    if (!info.configured) return wrap; // не сме свързани → нищо (горе вече пише „локално“)
    const modelTxt = info.model
      ? tf('sr_srv_model', info.model)
      : (info.aiMode === 'local' ? t('sr_srv_local_nomodel') : t('sr_srv_none'));
    wrap.appendChild(el('div', { class: 'muted', style: 'font-size:13px;margin-bottom:6px' }, modelTxt));
    const status = el('div', { class: 'muted', style: 'font-size:13px;min-height:18px;margin-top:6px' });
    const btn = el('button', { class: 'block', style: 'margin-top:4px', onclick: async () => {
      btn.disabled = true; status.textContent = t('sr_check_run');
      let r; try { r = await pingHealth(); } catch (_) { r = { ok: false, error: '—' }; }
      btn.disabled = false;
      if (r.ok) status.textContent = r.model ? tf('sr_check_okm', r.model) : t('sr_check_ok');
      else status.textContent = tf('sr_check_bad', r.error || '—');
    } }, t('sr_check_btn'));
    wrap.appendChild(btn);
    wrap.appendChild(status);
    return wrap;
  }

  // --- Индикатор „Къде се пази знанието“ + значка за ролята ---
  const loc = storageLocationLabel();
  const reader = getLearnRole() === 'reader';
  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent-2)' }, [
    el('div', { style: 'font-weight:700' }, loc.text),
    el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' },
      loc.serverConfigured ? t('sr_loc_server') : t('sr_loc_local')),
    el('div', { style: 'margin-top:8px' }, [
      el('span', {
        class: 'badge',
        style: 'background:' + (reader ? 'transparent' : 'var(--accent-2)') + (reader ? ';border:1px solid var(--accent-2)' : '')
      }, reader ? t('sr_role_reader') : t('sr_role_learner'))
    ])
  ]));

  // --- Локално (master) — ТОЧКА 1, винаги първа и препоръчана ---
  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent-2)' }, [
    el('h3', {}, t('sr_local_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, tf('sr_local_desc', memoryCount())),
    el('p', { class: 'muted', style: 'font-size:12px' }, t('sr_local_master'))
  ]));

  // --- Запази знанието (бекъп) ---
  const pathBox = el('p', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap' }, '');
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('sr_backup_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_backup_desc')),
    el('button', { class: 'block', onclick: async () => {
      const r = await exportToFile();
      if (r.ok) {
        pathBox.textContent = tf('sr_file_here', r.path) + (r.shared ? '\n' + t('sr_shared_opened') : '');
        toast(t('sr_backup_ready'));
      } else {
        pathBox.textContent = tf('sr_error_p', r.reason || t('sr_unknown'));
      }
    } }, t('sr_backup_btn')),
    pathBox
  ]));

  // --- Внеси от файл (надежден нативен picker — виж filepick.js: `<input type=file>` в Android
  // WebView връщаше празен файл за файлове от Downloads/Drive) ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('sr_import_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_import_desc')),
    el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: async () => {
      let picked; try { picked = await pickTextFile(); } catch (e) { toast(t('sr_read_fail')); return; }
      if (!picked) return;
      if (!picked.text) { toast(t('sr_read_fail')); return; }
      const r = importFromJsonText(picked.text);
      if (r.ok) { toast(tf('sr_imported_new', r.added, r.skipped)); rerender(); }
      else toast(tf('sr_error_p', r.reason || t('sr_unknown')));
    } }, t('sr_import_btn'))
  ]));

  // --- Пакети знание (готови знания + стартови основи) ---
  const packsRes = el('p', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap;margin-top:8px' }, '');
  const reportPack = (label, r) => {
    if (r.ok) {
      packsRes.textContent = tf('sr_pack_result', label, r.added, r.skipped);
      toast(tf('sr_imported_count', r.added));
      rerender();
    } else {
      packsRes.textContent = tf('sr_error_p', r.reason || t('sr_unknown'));
      toast(t('sr_import_error'));
    }
  };

  // Бутони за вградените стартови пакети (реално съдържание, офлайн).
  const bundledBtns = listBundledPacks().map((p) =>
    el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: () => {
      reportPack(tf('sr_basics_label', p.name), importBundledPack(p.id));
    } }, tf('sr_import_basics', p.name, p.count))
  );

  // Текстово поле + файл за внасяне на собствен пакет знание (JSON).
  const packArea = el('textarea', {
    placeholder: '{ "name": "...", "topic": "...", "entries": [ { "type":"qa", "key":"...", "value":"..." } ] }',
    style: 'width:100%;min-height:90px;margin-top:8px;font-family:monospace;font-size:12px'
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('sr_packs_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_packs_desc')),
    ...bundledBtns,
    el('label', { style: 'margin-top:12px' }, t('sr_own_pack_label')), packArea,
    el('button', { class: 'block', style: 'margin-top:8px', onclick: () => {
      const txt = String(packArea.value || '').trim();
      if (!txt) { toast(t('sr_paste_json')); return; }
      reportPack(t('sr_pasted_pack'), importPackFromJsonText(txt));
    } }, t('sr_import_from_text')),
    el('label', { style: 'margin-top:12px' }, t('sr_or_load_file')),
    el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: async () => {
      let picked; try { picked = await pickTextFile(); } catch (e) { toast(t('sr_read_fail')); return; }
      if (!picked) return;
      if (!picked.text) { toast(t('sr_read_fail')); return; }
      reportPack(t('sr_file_pack'), importPackFromJsonText(picked.text));
    } }, t('sr_import_from_file')),
    packsRes
  ]));

  // --- Изтегли от URL (по избор) ---
  const srcCfg = sourcesSettings();
  const pullUrl = el('input', { type: 'text', placeholder: t('sr_pull_ph'), value: srcCfg.pullUrl });
  const pullSw = el('div', { class: 'switch' + (srcCfg.pullEnabled ? ' on' : '') });
  pullSw.addEventListener('click', () => {
    const next = !sourcesSettings().pullEnabled;
    saveSourcesSettings({ pullEnabled: next });
    pullSw.className = 'switch' + (next ? ' on' : '');
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('sr_pull_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_pull_desc')),
    el('div', { class: 'toggle' }, [ el('div', {}, el('div', {}, t('sr_pull_allow'))), pullSw ]),
    el('label', {}, t('sr_pack_url')), pullUrl,
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      el('button', { class: 'secondary grow', onclick: () => {
        saveSourcesSettings({ pullUrl: pullUrl.value.trim() }); toast(t('saved'));
      } }, t('sr_save_url')),
      el('button', { class: 'grow', onclick: async () => {
        if (!sourcesSettings().pullEnabled) { toast(t('sr_allow_pull_first')); return; }
        saveSourcesSettings({ pullUrl: pullUrl.value.trim() });
        const r = await pullFromUrl(pullUrl.value.trim());
        if (r.ok) { toast(tf('sr_pulled_new', r.added, r.skipped)); rerender(); }
        else toast(tf('sr_error_p', r.reason || t('sr_unknown')));
      } }, t('sr_pull_now'))
    ])
  ]));

  // --- КАТАЛОГ с готови тематични речници (по желание на клиента) ------------
  // Каталог = хостнат catalog.json (генериран от tools/collect-all.mjs). По подразбиране се търси
  // на свързания сървър (/dict/catalog.json). Клиентът избира тема/категория → сваля се в базата.
  const catIn = el('input', { type: 'text', placeholder: 'https://<домейн>/dict/catalog.json', value: catalogUrl(), autocapitalize: 'none', autocomplete: 'off' });
  const catThemeIn = el('input', { type: 'text', placeholder: 'тема или категория (напр. Математика)', autocapitalize: 'none', autocomplete: 'off' });
  const catMsg = el('div', { class: 'muted', style: 'font-size:12px;margin-top:8px;white-space:pre-wrap' }, '');
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '📚 Каталог с готови знания'),
    el('p', { class: 'muted', style: 'font-size:13px' }, 'Зареди готови тематични речници (курсове/учебници/термини) по желание. Ученето после ги надгражда.'),
    el('label', {}, 'Адрес на каталога (празно = от свързания сървър)'), catIn,
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      el('button', { class: 'secondary grow', onclick: () => { setCatalogUrl(catIn.value.trim()); toast(t('saved')); } }, 'Запази'),
      el('button', { class: 'secondary grow', onclick: async () => {
        setCatalogUrl(catIn.value.trim());
        const r = await listCatalog({});
        catMsg.textContent = r.ok
          ? `Каталогът има ${r.packs.length} речника в ${r.categories.length} категории:\n${r.categories.join(', ')}`
          : ('Каталогът не е достъпен: ' + (r.reason || ''));
      } }, 'Виж темите')
    ]),
    el('label', { style: 'margin-top:8px' }, 'Зареди тема/категория'), catThemeIn,
    el('button', { style: 'margin-top:8px', onclick: async () => {
      const q = catThemeIn.value.trim();
      if (!q) { toast('Напиши тема или категория.'); return; }
      catMsg.textContent = 'Свалям…';
      const r = await importFromCatalog(q);
      if (r.ok) {
        catMsg.textContent = r.kind === 'category'
          ? `Заредих „${r.matched}": ${r.loaded}/${r.total} речника, ${r.termSubjects || 0} теми.`
          : `Заредих „${r.matched || q}": ${r.termSubjects || 0} теми, ${(r.termNotes || 0) + (r.added || 0)} записа.`;
        toast(t('saved')); rerender();
      } else { catMsg.textContent = 'Не се зареди: ' + (r.reason || ''); }
    } }, '⬇️ Зареди в базата'),
    catMsg
  ]));

  // --- СВЪРЖИ КЪМ СЪРВЪР (само ДОМЕЙН + TOKEN) ------------------------------
  // Собственикът въвежда само домейна и token-а от деплой-скрипт 39. Апът сам прави
  // пълните URL-та (същата схема като скрипта). Така е лесно и без грешки.
  const link = serverLink();
  const domainIn = el('input', { type: 'text', placeholder: 'selflearning.bot.nu', value: link.domain || 'selflearning.bot.nu', autocapitalize: 'none', autocomplete: 'off' });
  const tokenIn = el('input', { type: 'text', placeholder: t('sr_token_ph'), value: link.token, autocapitalize: 'none', autocomplete: 'off' });
  const urlsBox = el('div', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap;margin-top:8px' }, '');
  function renderUrls() {
    const u = currentUrls();
    urlsBox.textContent = u.ok
      ? tf('sr_app_will_use', u.sync, u.listen, u.health)
      : t('sr_enter_domain_token');
  }
  renderUrls();

  // --- ЛЕСНО: свържи робота с КЛЮЧ за връзка ---------------------------------
  const presetOptions = SERVER_PRESETS.map((p) => el('option', { value: p.domain }, p.label));
  presetOptions.push(el('option', { value: '__custom__' }, t('sr_other_manual')));
  const keyDomainSel = el('select', { style: 'width:100%' }, presetOptions);
  const keyDomainCustom = el('input', { type: 'text', placeholder: t('sr_eg_domain'), autocapitalize: 'none', autocomplete: 'off', style: 'display:none;margin-top:6px' });
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
  const keyIn = el('input', { type: 'text', placeholder: t('sr_conn_key_ph'), autocapitalize: 'none', autocomplete: 'off' });
  const keyHint = el('div', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap;margin-top:8px' }, '');
  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent)' }, [
    el('h3', {}, t('sr_connect_robot_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_connect_robot_desc')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_connect_domain_help')),
    el('label', {}, t('sr_server_domain_select')), keyDomainSel, keyDomainCustom,
    el('label', {}, t('sr_conn_key_label')), keyIn,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: async (ev) => {
      const btn = ev.currentTarget;
      const dom = resolveKeyDomain() || DEFAULT_PRESET_DOMAIN;
      const k = keyIn.value.trim();
      if (!k) { toast(t('sr_enter_conn_key')); return; }
      const ref = /^https?:\/\//i.test(k) ? k : (dom + '/' + k);
      btn.disabled = true;
      keyHint.textContent = t('sr_connecting');
      const r = await connectWithKey(ref, {
        onProgress: ({ attempt, total, waitingMs }) => {
          if (waitingMs > 0) {
            keyHint.textContent = tf('sr_not_ready', attempt, total);
          } else {
            keyHint.textContent = tf('sr_connecting_attempt', attempt, total);
          }
        }
      });
      btn.disabled = false;
      if (r.ok) {
        domainIn.value = r.domain; tokenIn.value = r.token; renderUrls();
        keyHint.textContent = tf('sr_connected_ok', r.domain);
        toast(t('sr_conn_ready'));
      } else {
        keyHint.textContent = '✗ ' + (r.error || t('sr_unknown'));
        toast(tf('sr_failed_p', r.error || t('sr_unknown')));
      }
    } }, t('sr_connect_btn')),
    keyHint,
    // ПРЕКЪСВАНЕ → връщане към ЛОКАЛНАТА база. Наученото ОСТАВА на телефона.
    el('div', { class: 'muted', style: 'font-size:12px;margin-top:12px' },
      serverLinkConfigured() ? tf('sr_now_connected', serverLink().domain) : t('sr_now_local')),
    el('button', { class: 'block secondary', style: 'margin-top:8px', onclick: () => {
      if (!serverLinkConfigured()) { toast(t('sr_already_local')); return; }
      const r = disconnectServer();
      toast(tf('sr_disconnected', r.was || t('sr_the_server')));
      try { rerender(); } catch (_) {}
    } }, t('sr_disconnect_btn')),
    // „Към кой модел/сървър съм свързан“ + проверка НА ЖИВО, че виртуалката отговаря сега.
    serverHealthBlock()
  ]));

  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent-2)' }, [
    el('h3', {}, t('sr_connect_manual_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_connect_manual_desc')),
    el('p', { class: 'muted', style: 'font-size:12px' }, t('sr_connect_manual_help')),
    el('label', {}, t('sr_server_domain')), domainIn,
    el('label', {}, t('sr_token_label')), tokenIn,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: () => {
      const d = domainIn.value.trim(), tok = tokenIn.value.trim();
      if (!d || !tok) { toast(t('sr_enter_domain_and_token')); return; }
      const r = saveServerLink(d, tok);
      domainIn.value = r.domain; // показва нормализирания домейн
      renderUrls();
      toast(t('sr_link_saved'));
    } }, t('sr_save_link')),
    urlsBox,
    el('p', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, t('sr_same_token_note'))
  ]));

  // --- Синхронизирай към сървъра (ползва запазената връзка) ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('sr_sync_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_sync_desc')),
    el('button', { class: 'block', onclick: async () => {
      const ep = currentUrls().sync;
      if (!ep) { toast(t('sr_connect_first')); return; }
      const r = await exportToServer(ep);
      if (r.ok) toast(tf('sr_sent_records', r.count));
      else toast(tf('sr_error_p', r.reason || t('sr_unknown')));
    } }, t('sr_send_now'))
  ]));

  // --- Слушай (push от външен учител; ползва запазената връзка) ---
  const lc = listenSettings();
  const listenSw = el('div', { class: 'switch' + (lc.enabled ? ' on' : '') });
  listenSw.addEventListener('click', () => {
    if (!currentUrls().ok) { toast(t('sr_connect_first')); return; }
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
  if (!listenLog().length) logBox.appendChild(el('div', { class: 'muted' }, t('sr_no_activity')));

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('sr_listen_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('sr_listen_desc')),
    el('div', { class: 'toggle' }, [
      el('div', {}, el('div', {}, t('sr_listening') + (isListening() ? ' ' + t('sr_listening_active') : ''))),
      listenSw
    ]),
    el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
      el('button', { class: 'grow', onclick: async () => {
        if (!currentUrls().ok) { toast(t('sr_connect_first_short')); return; }
        await pollOnce(); rerender();
      } }, t('sr_check_now'))
    ]),
    el('div', {}, [ el('div', { class: 'muted', style: 'margin-top:10px;font-weight:600' }, t('sr_log')), logBox ])
  ]));
}
