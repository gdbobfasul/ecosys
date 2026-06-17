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

export function renderYoutube(root, { rerender }) {
  clear(root);
  root.appendChild(el('h2', {}, '📺 YouTube — гледай и учи'));

  // Честен дисклеймър.
  root.appendChild(el('div', { class: 'card', style: 'border-left:3px solid var(--accent-2)' }, [
    el('div', { style: 'font-weight:700' }, 'Какво мога честно'),
    el('p', { class: 'muted', style: 'font-size:13px;margin:6px 0 0' },
      'Гледането работи (вграждам плейъра). Ученето е от ТЕКСТА — поставяш транскрипт ' +
      'или бележки, аз ги обобщавам (безплатно през Pollinations, или по избор Claude, ' +
      'или локално офлайн) и ги пазя в паметта под темата. ' +
      'Автоматичните субтитри са best-effort — браузърът обикновено ги блокира (CORS). ' +
      'Не ползвам платен YouTube API ключ и не измислям транскрипт.')
  ]));

  // --- Вход: URL / id / търсене ---
  const srcInput = el('input', {
    type: 'text',
    placeholder: 'YouTube линк, video id, или дума за търсене',
    style: 'width:100%'
  });
  const player = el('div', { style: 'margin-top:10px' });
  const idLabel = el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, '');

  function showVideo() {
    const raw = String(srcInput.value || '').trim();
    if (!raw) { toast('Постави линк, id или дума за търсене.'); return; }
    clear(player);
    const id = parseVideoId(raw);
    let url, kind;
    if (id) { url = embedUrl(id); kind = 'video'; }
    else { url = searchEmbedUrl(raw); kind = 'search'; }
    if (!url) { idLabel.textContent = 'Не разпознах видео или термин.'; return; }

    const frame = el('iframe', {
      src: url,
      style: 'width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#000',
      allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: true,
      referrerpolicy: 'no-referrer'
    });
    player.appendChild(frame);

    if (kind === 'video') {
      idLabel.textContent = `Видео id: ${id} · ${watchUrl(id)}`;
      // запомни последния id за бутона за авто-субтитри
      _lastId = id;
    } else {
      idLabel.textContent = 'Резултати от търсене (избери видео вътре, после копирай линка му за учене).';
      _lastId = '';
    }
  }

  let _lastId = '';

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '1) Гледай'),
    srcInput,
    el('button', { class: 'block', style: 'margin-top:8px', onclick: showVideo }, 'Покажи / гледай'),
    player,
    idLabel
  ]));

  // --- Тема (по избор) ---
  const topicInput = el('input', {
    type: 'text',
    placeholder: 'напр. Математика, Физика, История…',
    list: 'yt-topics',
    style: 'width:100%'
  });
  const datalist = el('datalist', { id: 'yt-topics' },
    listInterests().map((s) => el('option', { value: s })));
  const titleInput = el('input', {
    type: 'text', placeholder: 'Заглавие на видеото (по избор)', style: 'width:100%;margin-top:8px'
  });

  // --- Транскрипт/бележки (ГЛАВНИЯТ надежден път) ---
  const transcript = el('textarea', {
    placeholder: 'Постави тук транскрипта или бележките си от видеото…',
    style: 'width:100%;min-height:140px;margin-top:8px'
  });
  const learnResult = el('div', { style: 'margin-top:10px;font-size:13px;white-space:pre-wrap' });

  // Best-effort авто-субтитри (честно за CORS).
  const tryCaptionsBtn = el('button', {
    class: 'secondary block', style: 'margin-top:8px',
    onclick: async () => {
      const id = _lastId || parseVideoId(srcInput.value);
      if (!id) { toast('Първо покажи конкретно видео (нужен е id).'); return; }
      learnResult.textContent = 'Опитвам автоматичните субтитри…';
      let r;
      try { r = await tryFetchCaptions(id); }
      catch (_) { r = { ok: false, reason: 'автоматичните субтитри са блокирани от браузъра — постави транскрипта ръчно' }; }
      if (r.ok && r.text) {
        transcript.value = r.text;
        learnResult.textContent = '✅ Издърпах субтитрите. Прегледай ги и натисни „Научи от текста“.';
      } else {
        learnResult.textContent = '⚠️ ' + (r.reason || 'не успях') +
          (r.blocked ? '\n(Това е нормално — браузърите блокират YouTube субтитрите. Постави транскрипта ръчно или задай CORS-proxy в настройките по-долу.)' : '');
      }
    }
  }, 'Опитай авто-субтитри (best-effort)');

  const learnBtn = el('button', {
    class: 'block', style: 'margin-top:8px',
    onclick: async () => {
      const material = String(transcript.value || '').trim();
      if (!material) { toast('Постави транскрипт или бележки.'); return; }
      learnBtn.setAttribute('disabled', '');
      learnResult.textContent = 'Обобщавам и пазя…';
      let r;
      try {
        r = await learnFromText({
          material,
          title: String(titleInput.value || '').trim(),
          topic: String(topicInput.value || '').trim(),
          id: _lastId || parseVideoId(srcInput.value) || ''
        });
      } catch (e) {
        r = { ok: false, reason: 'грешка: ' + (e && e.message ? e.message : 'неизвестно') };
      }
      learnBtn.removeAttribute('disabled');
      if (r.ok) {
        const via = r.tier === 1 ? 'Claude' : (r.tier === 2 ? 'Pollinations (безплатно)' : 'локален обобщител (офлайн)');
        learnResult.textContent =
          `✅ Научих и запазих в паметта` + (r.subject ? ` под тема „${r.subject}“` : '') +
          ` (обобщено чрез ${via}).\n\nРезюме:\n${r.summary}\n\n` +
          'Сега можеш да ме питаш по темата в „Чат“ — ще си спомня това.';
        toast('Запазено в паметта.');
      } else {
        learnResult.textContent = '⚠️ ' + (r.reason || 'не успях да науча');
      }
    }
  }, 'Научи от текста → запази в паметта');

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '2) Учи от видеото'),
    el('label', {}, 'Тема (групира наученото)'), topicInput, datalist,
    titleInput,
    el('label', { style: 'margin-top:10px' }, 'Транскрипт / бележки (главният, надежден път)'),
    transcript,
    tryCaptionsBtn,
    learnBtn,
    learnResult
  ]));

  // --- По избор: CORS-proxy за авто-субтитри (по подразбиране ПРАЗЕН) ---
  const cfg = youtubeSettings();
  const proxyInput = el('input', {
    type: 'text', value: cfg.corsProxy,
    placeholder: 'https://твой-cors-proxy/?url=  (по избор, празно = изключено)',
    style: 'width:100%'
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'CORS-proxy за авто-субтитри (по избор)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Празно по подразбиране — нищо не е вградено. Ако имаш свой безплатен CORS-proxy ' +
      '(който добавя CORS заглавия), сложи го тук и опитът за авто-субтитри ще мине през него. ' +
      'Без него браузърът блокира субтитрите — тогава поставяй транскрипта ръчно.'),
    el('label', {}, 'Proxy URL (префикс преди целевия адрес)'), proxyInput,
    el('button', {
      class: 'secondary block', style: 'margin-top:8px',
      onclick: () => { saveYoutubeSettings({ corsProxy: proxyInput.value.trim() }); toast('Запазено.'); }
    }, 'Запази proxy')
  ]));
}
