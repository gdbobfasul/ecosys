// config.js — настройки: източник (телефон/друга камера), чувствителност, класове за
// аларма, cooldown, нотификации. Записва се локално.

import { el, mount } from '../ui/dom.js';
import { loadSettings, saveSettings } from '../core/storage.js';
import { getPairing, setPairing, generatePairKey, checkPairing } from '../core/pairing.js';

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

  const pairingCard = buildPairingCard(go);

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

    pairingCard,

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

// --- Сдвояване (2 телефона): страж (до камерата) ↔ наблюдаващ ---
function buildPairingCard(go) {
  const p = getPairing();
  const roleSel = el('select', {}, [
    optionEl('solo', 'Сам (един телефон)', p.role),
    optionEl('monitor', 'Страж (до камерата — праща)', p.role),
    optionEl('watcher', 'Наблюдаващ (получава известията)', p.role)
  ]);
  const keyIn = el('input', { type: 'text', value: p.pairKey, placeholder: 'ключ за двойката', autocapitalize: 'none', autocomplete: 'off' });
  const baseIn = el('input', { type: 'text', value: p.relayBase, placeholder: 'https://selflearning.bot.nu', autocapitalize: 'none', autocomplete: 'off' });
  const pollIn = el('input', { type: 'number', value: String(p.pollSeconds), min: '3' });
  const statusEl = el('span', { class: 'pill' }, '');

  return el('div', { class: 'card' }, [
    el('h2', { text: '🔗 Сдвояване (2 телефона)' }),
    el('p', { class: 'muted', text:
      'Два телефона: единият до камерата („Страж" — гледа и праща), другият при теб ' +
      '(„Наблюдаващ" — получава известията). Свържи ги с ЕДИН и същ ключ за двойката. ' +
      '„Сам" = един телефон (по подразбиране).' }),
    el('label', { text: 'Режим / роля' }), roleSel,
    el('label', { text: 'Ключ за двойката (еднакъв на двата телефона)' }), keyIn,
    el('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, [
      el('button', { class: 'btn ghost', onclick: () => { keyIn.value = generatePairKey(); } }, 'Генерирай ключ')
    ]),
    el('label', { text: 'Сървър (релей)' }), baseIn,
    el('label', { text: 'Проверка на всеки (сек) — за наблюдаващия' }), pollIn,
    el('div', { class: 'row', style: 'gap:8px;margin-top:10px;align-items:center' }, [
      el('button', {
        class: 'btn', onclick: () => {
          setPairing({ role: roleSel.value, pairKey: keyIn.value.trim(), relayBase: baseIn.value.trim(), pollSeconds: parseInt(pollIn.value, 10) || 6 });
          statusEl.className = 'pill on';
          statusEl.textContent = 'запазено ✓';
        }
      }, 'Запази'),
      el('button', {
        class: 'btn ghost', onclick: async () => {
          setPairing({ role: roleSel.value, pairKey: keyIn.value.trim(), relayBase: baseIn.value.trim() });
          statusEl.className = 'pill';
          statusEl.textContent = 'проверявам…';
          const r = await checkPairing();
          statusEl.className = 'pill ' + (r.ok ? 'on' : 'off');
          statusEl.textContent = r.ok ? 'връзката работи ✓' : ('няма връзка' + (r.reason ? ` (${r.reason})` : ''));
        }
      }, 'Провери'),
      statusEl
    ])
  ]);
}

function optionEl(value, label, current) {
  const o = el('option', { value, text: label });
  if (value === current) o.setAttribute('selected', '');
  return o;
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
