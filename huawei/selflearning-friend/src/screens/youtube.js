// Version: 1.0001
// youtube.js (екран) — „YouTube“: гледай + учи по тема.
//
// OWNER-GATED: рутерът в main.js рисува този екран само когато сме отключени
// (същата защита като другите екрани).
//
// ЧЕСТНО: гледането работи винаги (вграден плейър). Ученето става от ТЕКСТА —
// поставен транскрипт/бележки (или авто-субтитри САМО ако източникът позволи CORS).
// Никакви платени услуги освен вече по избор Claude слоя. Без YouTube Data API ключ.
import { el, clear, toast } from '../ui/dom.js';
import { listInterests } from '../core/subjects.js';
import {
  parseVideoId, embedUrl, watchUrl, searchEmbedUrl,
  youtubeSettings, saveYoutubeSettings,
  tryFetchCaptions, learnFromText
} from '../core/youtube.js';
import { t, tf } from '../core/i18n.js';

export function renderYoutube(root, { rerender }) {
  clear(root);
  root.appendChild(el('h2', {}, t('yt_title')));

  // Честен дисклеймър.
  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent-2)' }, [
    el('div', { style: 'font-weight:700' }, t('yt_honest_title')),
    el('p', { class: 'muted', style: 'font-size:13px;margin:6px 0 0' }, t('yt_honest_desc'))
  ]));

  // --- Вход: URL / id / търсене ---
  const srcInput = el('input', {
    type: 'text',
    placeholder: t('yt_src_ph'),
    style: 'width:100%'
  });
  const player = el('div', { style: 'margin-top:10px' });
  const idLabel = el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, '');

  function showVideo() {
    const raw = String(srcInput.value || '').trim();
    if (!raw) { toast(t('yt_paste_first')); return; }
    clear(player);
    const id = parseVideoId(raw);
    let url, kind;
    if (id) { url = embedUrl(id); kind = 'video'; }
    else { url = searchEmbedUrl(raw); kind = 'search'; }
    if (!url) { idLabel.textContent = t('yt_not_recognized'); return; }

    const frame = el('iframe', {
      src: url,
      style: 'width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#000',
      allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: true,
      referrerpolicy: 'no-referrer'
    });
    player.appendChild(frame);

    if (kind === 'video') {
      idLabel.textContent = tf('yt_video_id', id, watchUrl(id));
      // запомни последния id за бутона за авто-субтитри
      _lastId = id;
    } else {
      idLabel.textContent = t('yt_search_results');
      _lastId = '';
    }
  }

  let _lastId = '';

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('yt_step_watch')),
    srcInput,
    el('button', { class: 'block', style: 'margin-top:8px', onclick: showVideo }, t('yt_show_watch')),
    player,
    idLabel
  ]));

  // --- Тема (по избор) ---
  const topicInput = el('input', {
    type: 'text',
    placeholder: t('yt_topic_ph'),
    list: 'yt-topics',
    style: 'width:100%'
  });
  const datalist = el('datalist', { id: 'yt-topics' },
    listInterests().map((s) => el('option', { value: s })));
  const titleInput = el('input', {
    type: 'text', placeholder: t('yt_title_ph'), style: 'width:100%;margin-top:8px'
  });

  // --- Транскрипт/бележки (ГЛАВНИЯТ надежден път) ---
  const transcript = el('textarea', {
    placeholder: t('yt_transcript_ph'),
    style: 'width:100%;min-height:140px;margin-top:8px'
  });
  const learnResult = el('div', { style: 'margin-top:10px;font-size:13px;white-space:pre-wrap' });

  // Best-effort авто-субтитри (честно за CORS).
  const tryCaptionsBtn = el('button', {
    class: 'secondary block', style: 'margin-top:8px',
    onclick: async () => {
      const id = _lastId || parseVideoId(srcInput.value);
      if (!id) { toast(t('yt_need_video')); return; }
      learnResult.textContent = t('yt_trying_captions');
      let r;
      try { r = await tryFetchCaptions(id); }
      catch (_) { r = { ok: false, reason: t('yt_captions_blocked') }; }
      if (r.ok && r.text) {
        transcript.value = r.text;
        learnResult.textContent = t('yt_captions_pulled');
      } else {
        learnResult.textContent = '⚠️ ' + (r.reason || t('yt_failed_short')) +
          (r.blocked ? t('yt_blocked_note') : '');
      }
    }
  }, t('yt_try_captions_btn'));

  const learnBtn = el('button', {
    class: 'block', style: 'margin-top:8px',
    onclick: async () => {
      const material = String(transcript.value || '').trim();
      if (!material) { toast(t('yt_paste_transcript')); return; }
      learnBtn.setAttribute('disabled', '');
      learnResult.textContent = t('yt_summarizing');
      let r;
      try {
        r = await learnFromText({
          material,
          title: String(titleInput.value || '').trim(),
          topic: String(topicInput.value || '').trim(),
          id: _lastId || parseVideoId(srcInput.value) || ''
        });
      } catch (e) {
        r = { ok: false, reason: tf('yt_error_short', (e && e.message ? e.message : t('yt_unknown'))) };
      }
      learnBtn.removeAttribute('disabled');
      if (r.ok) {
        const via = r.tier === 1 ? 'Claude' : (r.tier === 2 ? t('yt_via_pollinations') : t('yt_via_local'));
        learnResult.textContent =
          t('yt_learned') + (r.subject ? tf('yt_under_topic', r.subject) : '') +
          tf('yt_summary_body', via, r.summary);
        toast(t('yt_saved_to_memory'));
      } else {
        learnResult.textContent = '⚠️ ' + (r.reason || t('yt_learn_fail'));
      }
    }
  }, t('yt_learn_btn'));

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('yt_step_learn')),
    el('label', {}, t('yt_topic_label')), topicInput, datalist,
    titleInput,
    el('label', { style: 'margin-top:10px' }, t('yt_transcript_label')),
    transcript,
    tryCaptionsBtn,
    learnBtn,
    learnResult
  ]));

  // --- По избор: CORS-proxy за авто-субтитри (по подразбиране ПРАЗЕН) ---
  const cfg = youtubeSettings();
  const proxyInput = el('input', {
    type: 'text', value: cfg.corsProxy,
    placeholder: t('yt_proxy_ph'),
    style: 'width:100%'
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('yt_proxy_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('yt_proxy_desc')),
    el('label', {}, t('yt_proxy_label')), proxyInput,
    el('button', {
      class: 'secondary block', style: 'margin-top:8px',
      onclick: () => { saveYoutubeSettings({ corsProxy: proxyInput.value.trim() }); toast(t('saved')); }
    }, t('yt_save_proxy'))
  ]));
}
