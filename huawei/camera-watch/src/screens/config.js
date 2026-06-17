// config.js — настройки: източник (телефон/друга камера), чувствителност, класове за
// аларма, cooldown, нотификации. Записва се локално.

import { el, mount } from '../ui/dom.js';
import { loadSettings, saveSettings } from '../core/storage.js';

export async function renderConfig(root, { go }) {
  const s = await loadSettings();

  const otherWrap = el('div', { class: s.source === 'other' ? '' : 'spacer' });
  const otherUrl = el('input', { type: 'url', placeholder: 'https://example/stream.m3u8  или  http://cam/mjpeg', value: s.otherUrl || '' });

  function renderOther() {
    otherWrap.innerHTML = '';
    if (s.source === 'other') {
      otherWrap.appendChild(el('label', { text: 'URL на „друга камера“' }));
      otherWrap.appendChild(otherUrl);
      otherWrap.appendChild(el('div', { class: 'notice warn', html:
        '<b>Честно:</b> работи само ако потокът е възпроизводим в браузър и позволява CORS ' +
        '(MJPEG/HLS/HTTP видео). <b>RTSP и произволни IP камери не се поддържат</b> директно — ' +
        'нужен е сървър/gateway, който транскодира към HLS/MJPEG.' }));
    }
  }
  renderOther();

  const sourceSel = el('select', {
    onchange: (e) => { s.source = e.target.value; renderOther(); }
  }, [
    el('option', { value: 'phone', text: 'Камера на телефона (задна)', selected: s.source === 'phone' }),
    el('option', { value: 'other', text: 'Друга камера (поток по URL)', selected: s.source === 'other' })
  ]);

  const sensVal = el('span', { class: 'muted', text: pct(s.sensitivity) });
  const sens = el('input', {
    type: 'range', min: '0.005', max: '0.2', step: '0.005', value: String(s.sensitivity),
    oninput: (e) => { s.sensitivity = parseFloat(e.target.value); sensVal.textContent = pct(s.sensitivity); }
  });

  const cdVal = el('span', { class: 'muted', text: s.cooldownSec + ' сек' });
  const cd = el('input', {
    type: 'range', min: '3', max: '60', step: '1', value: String(s.cooldownSec),
    oninput: (e) => { s.cooldownSec = parseInt(e.target.value, 10); cdVal.textContent = s.cooldownSec + ' сек'; }
  });

  const cbClassify = checkbox(s.classify, (v) => s.classify = v);
  const cbNotify = checkbox(s.notify, (v) => s.notify = v);
  const cbPerson = checkbox(s.watchPerson, (v) => s.watchPerson = v);
  const cbAnimal = checkbox(s.watchAnimal, (v) => s.watchAnimal = v);
  const cbOther = checkbox(s.watchOther, (v) => s.watchOther = v);

  const view = el('div', {}, [
    el('div', { class: 'steps' }, [
      el('div', { class: 's active' }), el('div', { class: 's active' }),
      el('div', { class: 's active' }), el('div', { class: 's' })
    ]),
    el('h1', { text: 'Настройки' }),

    el('div', { class: 'card' }, [
      el('label', { text: 'Източник на видео' }),
      sourceSel,
      otherWrap
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [el('label', { text: 'Чувствителност на движение', class: 'grow' }), sensVal]),
      sens,
      el('p', { class: 'muted', text: 'По-ниско = реагира и на малко движение (повече сигнали). По-високо = само големи промени.' })
    ]),

    el('div', { class: 'card' }, [
      el('h2', { text: 'Какво да алармира' }),
      toggle('Човек / нарушител', cbPerson),
      toggle('Животни (куче, котка, птица…)', cbAnimal),
      toggle('Друго движение (немаркиран обект)', cbOther),
      el('div', { class: 'spacer' }),
      toggle('Разпознавай какво помръдна (TF.js)', cbClassify),
      el('p', { class: 'muted', text: 'Ако е изключено: алармира само „движение“, без класификация (по-малко работа).' })
    ]),

    el('div', { class: 'card' }, [
      toggle('Локални нотификации при детекция', cbNotify),
      el('div', { class: 'spacer' }),
      el('div', { class: 'row between' }, [el('label', { text: 'Пауза между сигнали (cooldown)', class: 'grow' }), cdVal]),
      cd
    ]),

    el('div', { class: 'row' }, [
      el('button', { class: 'btn ghost', onclick: () => go('permissions') }, 'Назад'),
      el('button', {
        class: 'btn grow', onclick: async () => {
          s.otherUrl = otherUrl.value.trim();
          await saveSettings(s);
          go('dashboard');
        }
      }, 'Запази и към таблото')
    ])
  ]);

  mount(root, view);
}

function pct(v) { return Math.round(v * 1000) / 10 + '% пиксели'; }

function checkbox(checked, onChange) {
  const c = el('input', { type: 'checkbox' });
  c.checked = !!checked;
  c.addEventListener('change', () => onChange(c.checked));
  return c;
}

function toggle(labelText, checkboxEl) {
  return el('div', { class: 'toggle' }, [el('span', { text: labelText }), checkboxEl]);
}
