/*
 * Pupikes AI Client — реален Claude (Anthropic) за програмите с изкуствен интелект.
 * По образеца на selflearning-friend/renderer/src/core/teacher.js.
 *
 * ДВА режима (както в екосистемата):
 *   • Собствен proxy endpoint (препоръчан за магазина): POST {endpoint} {prompt, system} -> {text}
 *     — ключът стои на СЪРВЪРА, не в приложението.
 *   • Директно към Anthropic: POST https://api.anthropic.com/v1/messages
 *     — с личен x-api-key (пази се ЛОКАЛНО в localStorage, НИКОГА не се вгражда в кода).
 *
 * Платена функция → иска одобрение преди харчене. Без ключ/endpoint приложението
 * пада обратно към офлайн евристиката (винаги работи).
 *
 * Използване:
 *   if (PupikesAI.ready()) { const text = await PupikesAI.ask(prompt, {system, maxTokens}); ... }
 *   else { ...офлайн евристика... }
 *   PupikesAI.mountSettings(document.getElementById('ai-settings'));
 */
(function (global) {
  'use strict';
  var ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
  var LS = 'pupikes_ai_settings';

  function raw() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function persist(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }

  function settings() {
    var t = raw();
    return {
      apiKey: (t.apiKey || '').trim(),
      endpoint: (t.endpoint || '').trim(),
      model: (t.model || 'claude-3-5-haiku-latest').trim(),
      anthropicVersion: (t.anthropicVersion || '2023-06-01').trim(),
      approved: !!t.approved,
      approvePerCall: t.approvePerCall !== false // по подразбиране пита всеки път
    };
  }
  function update(patch) { var t = raw(); for (var k in patch) t[k] = patch[k]; persist(t); }

  function configured() { var t = settings(); return !!(t.apiKey || t.endpoint); }
  // ready = има ключ/endpoint И е одобрено (ако се иска одобрение)
  function ready() { var t = settings(); return configured() && t.approved; }

  function approve() { update({ approved: true }); }
  function revoke() { update({ approved: false }); }

  async function callProxy(endpoint, prompt, system, maxTokens, timeoutMs) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 25000) : null;
    try {
      var res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, system: system || '', maxTokens: maxTokens || 800 }),
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) throw new Error('proxy ' + res.status);
      var data = await res.json();
      return (data && (data.text || data.output || data.content)) || '';
    } finally { if (timer) clearTimeout(timer); }
  }

  async function callDirect(t, prompt, system, maxTokens, timeoutMs) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 25000) : null;
    try {
      var body = {
        model: t.model,
        max_tokens: maxTokens || 800,
        messages: [{ role: 'user', content: prompt }]
      };
      if (system) body.system = system;
      var res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': t.apiKey,
          'anthropic-version': t.anthropicVersion,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) throw new Error('anthropic ' + res.status);
      var data = await res.json();
      if (data && data.content && data.content[0] && data.content[0].text) return data.content[0].text;
      return '';
    } finally { if (timer) clearTimeout(timer); }
  }

  // Основен вход. Хвърля 'ai-not-ready', ако не е конфигуриран/одобрен — извикващият пада към офлайн.
  async function ask(prompt, opts) {
    opts = opts || {};
    var t = settings();
    if (!configured()) throw new Error('ai-not-ready');
    if (!t.approved) throw new Error('ai-not-approved');
    if (t.approvePerCall) revoke(); // еднократно одобрение — следващият път пита пак
    if (t.endpoint) return callProxy(t.endpoint, prompt, opts.system, opts.maxTokens, opts.timeoutMs);
    return callDirect(t, prompt, opts.system, opts.maxTokens, opts.timeoutMs);
  }

  // Малък настройки-панел (по избор). Влага се в подаден контейнер.
  function mountSettings(el) {
    if (!el) return;
    var t = settings();
    el.innerHTML =
      '<div style="font-family:system-ui,Arial;font-size:14px;line-height:1.5">' +
      '<p style="margin:.2em 0"><b>🤖 Реален ИИ (Claude)</b> — по избор. Без него програмата работи офлайн (по-опростено).</p>' +
      '<label style="display:block;margin:.4em 0">Proxy endpoint (препоръчан):<br><input id="pai-ep" style="width:100%;padding:.4em" placeholder="https://твой-сървър/api/ai"></label>' +
      '<label style="display:block;margin:.4em 0">…или личен Anthropic API ключ (пази се само на устройството):<br><input id="pai-key" type="password" style="width:100%;padding:.4em" placeholder="sk-ant-..."></label>' +
      '<label style="display:block;margin:.4em 0">Модел:<br><input id="pai-model" style="width:100%;padding:.4em"></label>' +
      '<label style="display:block;margin:.4em 0"><input type="checkbox" id="pai-peracall"> Питай за одобрение при всяко ИИ извикване</label>' +
      '<button id="pai-save" style="padding:.5em 1em">Запази</button> <span id="pai-status" style="opacity:.7"></span>' +
      '<p style="opacity:.7;font-size:12px;margin:.5em 0">Ключът и настройките се пазят само на това устройство и не се вграждат в приложението. ИИ е платена функция и се харчи само с твое одобрение.</p>' +
      '</div>';
    el.querySelector('#pai-ep').value = t.endpoint;
    el.querySelector('#pai-key').value = t.apiKey;
    el.querySelector('#pai-model').value = t.model;
    el.querySelector('#pai-peracall').checked = t.approvePerCall;
    el.querySelector('#pai-save').onclick = function () {
      update({
        endpoint: el.querySelector('#pai-ep').value.trim(),
        apiKey: el.querySelector('#pai-key').value.trim(),
        model: (el.querySelector('#pai-model').value.trim() || 'claude-3-5-haiku-latest'),
        approvePerCall: el.querySelector('#pai-peracall').checked
      });
      el.querySelector('#pai-status').textContent = configured() ? 'Запазено ✓ (реалният ИИ е готов)' : 'Запазено ✓ (офлайн режим)';
    };
  }

  global.PupikesAI = {
    settings: settings, update: update, configured: configured, ready: ready,
    approve: approve, revoke: revoke, ask: ask, mountSettings: mountSettings
  };
})(typeof window !== 'undefined' ? window : this);
